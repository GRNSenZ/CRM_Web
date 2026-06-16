/** ดึงเบอร์โทรไทยจากข้อความ/ไฟล์ (10 หลักขึ้น 0 หรือ 9 หลักเติม 0) แล้วยุบซ้ำ — pure, ใช้ได้ทั้ง client/server */
export function extractPhones(text: string): string[] {
  const found = new Set<string>();
  // แยกด้วย บรรทัดใหม่/คอมมา/เซมิโคลอน/แท็บ/ช่องว่าง 2 ตัวขึ้นไป
  // (เก็บช่องว่างเดี่ยวไว้ เพราะอาจเป็นเบอร์รูปแบบ "081 234 5678")
  for (const token of text.split(/[\n\r,;|\t]+|\s{2,}/)) {
    const d = token.replace(/\D/g, "");
    if (d.length === 9) found.add("0" + d);
    else if (d.length === 10 && d.startsWith("0")) found.add(d);
  }
  return [...found];
}
