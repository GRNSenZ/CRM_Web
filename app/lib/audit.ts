import "server-only";
import { prisma } from "./prisma";

type Json = Record<string, unknown> | null | undefined;

/**
 * บันทึก audit log — เรียกผ่านฟังก์ชันนี้เท่านั้น
 * ออกแบบให้ "log หายดีกว่างานหลักพัง": ถ้าเขียน log ไม่สำเร็จ แค่ log error
 * ไม่ throw ออกไป (กันไม่ให้การบันทึกหลัก เช่น ปรับโบนัส ล้มเพราะ audit พัง)
 */
export async function logAudit(entry: {
  userId?: number | null;
  action: string;
  entity: string;
  entityId: number;
  before?: Json;
  after?: Json;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: entry.before ? JSON.stringify(entry.before) : null,
        after: entry.after ? JSON.stringify(entry.after) : null,
      },
    });
  } catch (e) {
    console.error("[audit] บันทึก log ไม่สำเร็จ:", e);
  }
}

/** ป้ายภาษาไทยของ action */
export const ACTION_LABEL: Record<string, string> = {
  "customer.status_change": "เปลี่ยนสถานะลูกค้า",
  "deposit.upsert": "บันทึก/แก้ยอดฝาก",
  "bonus.create": "ปรับโบนัส",
  "user.create": "สร้างผู้ใช้",
  "user.toggle_active": "เปิด/ปิดผู้ใช้",
  "user.password_change": "เปลี่ยนรหัสผ่าน",
  "import.run": "นำเข้าข้อมูล Excel",
  "sms.send": "ส่ง SMS",
};

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action;
}
