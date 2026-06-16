// ข้อความโปรเริ่มต้นสำหรับตัวแปร {{โปร}} (แก้เป็น config ภายหลังได้)
export const DEFAULT_PROMO = "รับโบนัส 20%";

export const SMS_VARS = ["เว็บ", "เบอร์", "โปร"] as const;

export type SmsContext = { web?: string; phone?: string; promo?: string };

/**
 * แทนค่าตัวแปรในข้อความ SMS — pure function (ใช้ได้ทั้ง server/client, ทดสอบง่าย)
 * รองรับ {{เว็บ}} {{เบอร์}} {{โปร}} · ตัวแปรที่ไม่รู้จัก = คงไว้เหมือนเดิม
 */
export function renderTemplate(body: string, ctx: SmsContext): string {
  const map: Record<string, string> = {
    เว็บ: ctx.web ?? "",
    เบอร์: ctx.phone ?? "",
    โปร: ctx.promo ?? DEFAULT_PROMO,
  };
  return body.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (whole, key: string) => {
    const k = key.trim();
    return k in map ? map[k] : whole;
  });
}
