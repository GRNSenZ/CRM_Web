import "server-only";

/** สร้างรหัสยืนยัน 6 หลัก */
export function genCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * โหมดทดสอบ: ยัง "ไม่ส่งจริง" — แค่ log ไว้ฝั่ง server
 * เมื่อมี SMS/Email gateway ค่อยแทนที่ฟังก์ชันเหล่านี้ด้วยการเรียก provider จริง
 *
 * คืนค่า devCode เพื่อเอาไปแสดงบนหน้าจอตอนทดสอบ (ปิดได้ด้วย env ในโปรดักชัน)
 */
const SHOW_DEV_CODE = process.env.OTP_DEV_MODE !== "false";

export function sendSmsOtp(phone: string, code: string): { devCode?: string } {
  console.log(`[OTP/SMS] ส่งรหัส ${code} ไปยังเบอร์ ${phone} (โหมดทดสอบ: ยังไม่ส่งจริง)`);
  return SHOW_DEV_CODE ? { devCode: code } : {};
}

export function sendEmailOtp(email: string, code: string): { devCode?: string } {
  console.log(`[OTP/Email] ส่งรหัส ${code} ไปยังอีเมล ${email} (โหมดทดสอบ: ยังไม่ส่งจริง)`);
  return SHOW_DEV_CODE ? { devCode: code } : {};
}
