"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/app/lib/prisma";
import { genCode, sendSmsOtp, sendEmailOtp } from "@/app/lib/otp";

const SIGNUP_COOKIE = "signup";
const TTL_MIN = 30;

export type StepResult = {
  ok: boolean;
  error?: string;
  devCode?: string; // โหมดทดสอบ: รหัสที่ "ส่ง" เพื่อเอาไปกรอก
  username?: string;
};

function normalizePhone(raw: string): string {
  let p = raw.replace(/\D/g, "");
  if (p.length === 9) p = "0" + p;
  return p;
}

function isValidThaiPhone(p: string): boolean {
  return /^0\d{9}$/.test(p);
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

async function setSignupCookie(id: number) {
  const c = await cookies();
  c.set(SIGNUP_COOKIE, String(id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MIN * 60,
  });
}

async function getPending() {
  const c = await cookies();
  const id = Number(c.get(SIGNUP_COOKIE)?.value);
  if (!id) return null;
  const p = await prisma.pendingSignup.findUnique({ where: { id } });
  if (!p) return null;
  if (p.expiresAt.getTime() < Date.now()) {
    await prisma.pendingSignup.delete({ where: { id } }).catch(() => {});
    return null;
  }
  return p;
}

/** ขั้นที่ 1: กรอกชื่อผู้ใช้ + เบอร์โทร → ส่ง OTP */
export async function startSignup(input: { username: string; phone: string }): Promise<StepResult> {
  const username = input.username.trim();
  const phone = normalizePhone(input.phone);

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return { ok: false, error: "ชื่อผู้ใช้ต้องเป็น a-z, 0-9, _ ยาว 3–20 ตัว" };
  }
  if (!isValidThaiPhone(phone)) {
    return { ok: false, error: "เบอร์โทรไม่ถูกต้อง (ต้องเป็นเบอร์ไทย 10 หลัก)" };
  }

  if (await prisma.user.findUnique({ where: { username } })) {
    return { ok: false, error: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" };
  }
  if (await prisma.user.findUnique({ where: { phone } })) {
    return { ok: false, error: "เบอร์โทรนี้ถูกใช้สมัครแล้ว" };
  }

  const code = genCode();
  const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000);
  const pending = await prisma.pendingSignup.create({
    data: { username, phone, phoneCode: code, expiresAt },
  });
  await setSignupCookie(pending.id);

  const { devCode } = sendSmsOtp(phone, code);
  return { ok: true, devCode };
}

/** ขอ OTP ใหม่ */
export async function resendPhoneOtp(): Promise<StepResult> {
  const p = await getPending();
  if (!p) return { ok: false, error: "เซสชันสมัครหมดอายุ กรุณาเริ่มใหม่" };
  const code = genCode();
  await prisma.pendingSignup.update({ where: { id: p.id }, data: { phoneCode: code } });
  const { devCode } = sendSmsOtp(p.phone, code);
  return { ok: true, devCode };
}

/** ขั้นที่ 2: ยืนยัน OTP เบอร์โทร */
export async function verifyPhone(input: { code: string }): Promise<StepResult> {
  const p = await getPending();
  if (!p) return { ok: false, error: "เซสชันสมัครหมดอายุ กรุณาเริ่มใหม่" };
  if (input.code.trim() !== p.phoneCode) {
    return { ok: false, error: "รหัส OTP ไม่ถูกต้อง" };
  }
  await prisma.pendingSignup.update({ where: { id: p.id }, data: { phoneVerified: true } });
  return { ok: true };
}

/** ขั้นที่ 3: ตั้งรหัสผ่าน + ยืนยันรหัสผ่าน */
export async function setSignupPassword(input: {
  password: string;
  confirm: string;
}): Promise<StepResult> {
  const p = await getPending();
  if (!p) return { ok: false, error: "เซสชันสมัครหมดอายุ กรุณาเริ่มใหม่" };
  if (!p.phoneVerified) return { ok: false, error: "กรุณายืนยันเบอร์โทรก่อน" };
  if (input.password.length < 6) {
    return { ok: false, error: "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร" };
  }
  if (input.password !== input.confirm) {
    return { ok: false, error: "รหัสผ่านกับช่องยืนยันไม่ตรงกัน" };
  }
  const hash = await bcrypt.hash(input.password, 10);
  await prisma.pendingSignup.update({ where: { id: p.id }, data: { passwordHash: hash } });
  return { ok: true };
}

/** ขั้นที่ 4: กรอกอีเมล → ส่งรหัสยืนยันอีเมล */
export async function sendEmailCode(input: { email: string }): Promise<StepResult> {
  const p = await getPending();
  if (!p) return { ok: false, error: "เซสชันสมัครหมดอายุ กรุณาเริ่มใหม่" };
  if (!p.passwordHash) return { ok: false, error: "กรุณาตั้งรหัสผ่านก่อน" };

  const email = input.email.trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: "รูปแบบอีเมลไม่ถูกต้อง" };
  if (await prisma.user.findUnique({ where: { email } })) {
    return { ok: false, error: "อีเมลนี้ถูกใช้แล้ว" };
  }

  const code = genCode();
  await prisma.pendingSignup.update({
    where: { id: p.id },
    data: { email, emailCode: code, emailVerified: false },
  });
  const { devCode } = sendEmailOtp(email, code);
  return { ok: true, devCode };
}

/** ขั้นที่ 5: ยืนยันอีเมล → สร้างบัญชี (role = member) */
export async function verifyEmailAndFinish(input: { code: string }): Promise<StepResult> {
  const p = await getPending();
  if (!p) return { ok: false, error: "เซสชันสมัครหมดอายุ กรุณาเริ่มใหม่" };
  if (!p.email || !p.emailCode || !p.passwordHash) {
    return { ok: false, error: "ข้อมูลสมัครไม่ครบ กรุณาเริ่มใหม่" };
  }
  if (input.code.trim() !== p.emailCode) {
    return { ok: false, error: "รหัสยืนยันอีเมลไม่ถูกต้อง" };
  }

  // เช็คซ้ำกันแย่ง (race) ก่อนสร้างจริง
  if (await prisma.user.findUnique({ where: { username: p.username } })) {
    return { ok: false, error: "ชื่อผู้ใช้นี้เพิ่งถูกใช้ไป กรุณาเริ่มใหม่" };
  }

  await prisma.user.create({
    data: {
      username: p.username,
      name: p.username,
      password: p.passwordHash,
      role: "member",
      phone: p.phone,
      email: p.email,
      emailVerified: true,
      active: true,
    },
  });

  await prisma.pendingSignup.delete({ where: { id: p.id } }).catch(() => {});
  const c = await cookies();
  c.delete(SIGNUP_COOKIE);

  return { ok: true, username: p.username };
}
