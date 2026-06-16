"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { requireManager } from "@/app/lib/auth";
import { canCreateRole, roleLabel } from "@/app/lib/roles";
import { logAudit } from "@/app/lib/audit";

export type CreateUserState = { error?: string; success?: string };

function normalizePhone(raw: string): string {
  let p = raw.replace(/\D/g, "");
  if (p.length === 9) p = "0" + p;
  return p;
}

/**
 * สร้างบัญชีผู้ใช้ภายในระบบ
 * - เฉพาะผู้ที่มีสิทธิ์จัดการผู้ใช้ (Admin ขึ้นไป)
 * - สร้างได้เฉพาะบทบาทที่ "ต่ำกว่า" ตัวเอง (บังคับฝั่ง server ไม่เชื่อค่าจากฟอร์ม)
 */
export async function createStaffUser(
  _prev: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const creator = await requireManager();

  const username = String(formData.get("username") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!username || !name || !role || !password) {
    return { error: "กรุณากรอกชื่อผู้ใช้ ชื่อแสดง บทบาท และรหัสผ่านให้ครบ" };
  }

  // บังคับสิทธิ์: ต้องสร้างบทบาทที่ต่ำกว่าตัวเองเท่านั้น
  if (!canCreateRole(creator.role, role)) {
    return { error: `คุณไม่มีสิทธิ์สร้างบัญชีบทบาท “${roleLabel(role)}”` };
  }

  if (password.length < 6) {
    return { error: "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร" };
  }

  // ชื่อผู้ใช้ห้ามซ้ำ
  const dup = await prisma.user.findUnique({ where: { username } });
  if (dup) {
    return { error: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" };
  }

  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phone) {
    const dupPhone = await prisma.user.findUnique({ where: { phone } });
    if (dupPhone) return { error: "เบอร์โทรนี้ถูกใช้แล้ว" };
  }
  if (email) {
    const dupEmail = await prisma.user.findUnique({ where: { email } });
    if (dupEmail) return { error: "อีเมลนี้ถูกใช้แล้ว" };
  }

  const hash = await bcrypt.hash(password, 10);
  const created = await prisma.user.create({
    data: {
      username,
      name,
      role,
      password: hash,
      phone,
      email: email || null,
      emailVerified: !!email, // บัญชีที่ผู้ดูแลสร้างถือว่ายืนยันแล้ว
      active: true,
      createdById: creator.userId,
    },
  });

  // audit — ไม่เก็บรหัสผ่าน/hash ลง log
  await logAudit({
    userId: creator.userId,
    action: "user.create",
    entity: "User",
    entityId: created.id,
    after: { username, name, role },
  });

  revalidatePath("/admin/users");
  return { success: `สร้างบัญชี “${username}” (${roleLabel(role)}) เรียบร้อยแล้ว` };
}

/** เปิด/ปิดการใช้งานบัญชี (เฉพาะบทบาทที่ต่ำกว่าตัวเอง) */
export async function toggleUserActive(formData: FormData): Promise<void> {
  const creator = await requireManager();
  const id = Number(formData.get("userId"));
  if (!id || id === creator.userId) return;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return;
  if (!canCreateRole(creator.role, target.role)) return; // คุมระดับเดียวกับการสร้าง

  await prisma.user.update({ where: { id }, data: { active: !target.active } });
  await logAudit({
    userId: creator.userId,
    action: "user.toggle_active",
    entity: "User",
    entityId: id,
    before: { active: target.active },
    after: { active: !target.active },
  });
  revalidatePath("/admin/users");
}
