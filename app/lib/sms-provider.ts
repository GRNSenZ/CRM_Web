import "server-only";
export { extractPhones } from "./sms-client";

export type SendResult = { ok: boolean; mock?: boolean; error?: string };

/** กำหนดค่า gateway จริงผ่าน .env (เช่น ThaiBulkSMS / Twilio) ค่อยเสียบทีหลังได้ */
const GATEWAY_URL = process.env.SMS_GATEWAY_URL;
const GATEWAY_KEY = process.env.SMS_GATEWAY_KEY;
const SENDER = process.env.SMS_SENDER ?? "CRM";

export const isMockMode = !GATEWAY_URL || !GATEWAY_KEY;

/**
 * ส่ง SMS หนึ่งเบอร์
 * - ถ้ายังไม่ตั้งค่า gateway → โหมดทดสอบ: บันทึกว่าส่ง (ไม่ออกจริง)
 * - ถ้าตั้งค่าแล้ว → ยิง POST ไป gateway (ปรับ payload ตามผู้ให้บริการจริง)
 */
export async function sendSms(phone: string, body: string): Promise<SendResult> {
  if (isMockMode) {
    console.log(`[SMS mock] → ${phone}: ${body}`);
    return { ok: true, mock: true };
  }
  try {
    const res = await fetch(GATEWAY_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GATEWAY_KEY}` },
      body: JSON.stringify({ to: phone, message: body, sender: SENDER }),
    });
    if (!res.ok) return { ok: false, error: `gateway ตอบ ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
