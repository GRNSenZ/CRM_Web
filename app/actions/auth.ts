"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import { createSession, destroySession } from "@/app/lib/session";

export type LoginState = { error?: string };

const MAX_FAILED = 5; // ใส่รหัสผิดติดกันกี่ครั้งถึงล็อก
const LOCK_MINUTES = 15; // ล็อกนานกี่นาที

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  }

  // บัญชีถูกล็อกชั่วคราวอยู่หรือไม่
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `บัญชีถูกล็อกชั่วคราวจากการใส่รหัสผิดหลายครั้ง — ลองใหม่ในอีก ${mins} นาที` };
  }

  // รหัสผิด → นับครั้ง + ล็อกเมื่อครบเกณฑ์
  if (!(await bcrypt.compare(password, user.password))) {
    const failed = user.failedLogins + 1;
    const willLock = failed >= MAX_FAILED;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: willLock ? 0 : failed,
        lockedUntil: willLock ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
      },
    });
    if (willLock) {
      return { error: `ใส่รหัสผิดครบ ${MAX_FAILED} ครั้ง — บัญชีถูกล็อก ${LOCK_MINUTES} นาที` };
    }
    const left = MAX_FAILED - failed;
    return { error: `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (เหลืออีก ${left} ครั้งก่อนถูกล็อก)` };
  }

  if (!user.active) {
    return { error: "บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแล" };
  }

  // สำเร็จ → รีเซ็ตตัวนับ + ปลดล็อก
  if (user.failedLogins > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
    });
  }

  await createSession({
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  });
  redirect("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
