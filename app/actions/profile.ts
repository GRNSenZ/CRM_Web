"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth";
import { logAudit } from "@/app/lib/audit";

export type ChangePwState = { error?: string; success?: string };

/**
 * เปลี่ยนรหัสผ่านของผู้ใช้ที่ login อยู่
 * - อ่าน userId จาก session เท่านั้น (ห้ามรับจากฟอร์ม กันคนแก้ค่าใน HTML)
 * - ตรวจรหัสเดิมด้วย bcrypt.compare
 * - รหัสใหม่ยาว ≥ 6 ตัว และตรงกับช่องยืนยัน
 */
export async function changePassword(
  _prev: ChangePwState,
  formData: FormData,
): Promise<ChangePwState> {
  const user = await requireUser();

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!current || !next || !confirm) {
    return { error: "กรุณากรอกข้อมูลให้ครบทุกช่อง" };
  }
  if (next.length < 6) {
    return { error: "รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร" };
  }
  if (next !== confirm) {
    return { error: "รหัสผ่านใหม่กับช่องยืนยันไม่ตรงกัน" };
  }

  // ดึง hash ปัจจุบันจาก DB (session ไม่ได้เก็บรหัสผ่าน)
  const record = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!record) {
    return { error: "ไม่พบบัญชีผู้ใช้" };
  }

  const ok = await bcrypt.compare(current, record.password);
  if (!ok) {
    return { error: "รหัสผ่านเดิมไม่ถูกต้อง" };
  }

  if (await bcrypt.compare(next, record.password)) {
    return { error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม" };
  }

  const hash = await bcrypt.hash(next, 10);
  await prisma.user.update({
    where: { id: user.userId },
    data: { password: hash },
  });

  // audit — บันทึกแค่ "มีการเปลี่ยนรหัส" ไม่เก็บค่ารหัสผ่านใด ๆ
  await logAudit({
    userId: user.userId,
    action: "user.password_change",
    entity: "User",
    entityId: user.userId,
  });

  return { success: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" };
}
