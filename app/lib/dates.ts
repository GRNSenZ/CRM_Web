import "server-only";

const TZ = "Asia/Bangkok";

/** แปลงค่าจาก <input type="datetime-local"> (เวลาไทย) → Date (UTC) */
export function bangkokLocalToUtc(value: string): Date | null {
  if (!value) return null;
  // value เช่น "2026-06-17T18:00" → ตีความเป็นเวลาไทย (+07:00)
  const d = new Date(value.length === 16 ? `${value}:00+07:00` : `${value}+07:00`);
  return isNaN(d.getTime()) ? null : d;
}

/** ช่วงของวัน (เวลาไทย) เป็น Date UTC — offset วัน (0=วันนี้, -1=เมื่อวาน) */
export function bangkokDayRange(offset = 0): { from: Date; to: Date } {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split("-")
    .map(Number);
  const from = new Date(Date.UTC(y, m - 1, d) + offset * 86400000);
  const to = new Date(from.getTime() + 86400000 - 1);
  return { from, to };
}

/** สิ้นวัน "วันนี้" ตามเวลาไทย เป็น Date (UTC) — ใช้เช็ค "ถึงนัดวันนี้/เลยนัด" */
export function endOfTodayBangkok(): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split("-");
  return new Date(`${y}-${m}-${d}T23:59:59.999+07:00`);
}
