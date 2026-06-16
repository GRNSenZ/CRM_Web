import "server-only";
import type { DateRange } from "./queries";

// ข้อมูลวันที่ในระบบเก็บเป็น UTC เที่ยงคืน (date-only) — ช่วงเวลาจึงคิดเป็น "วันปฏิทิน"
// แล้วทำเป็นช่วง UTC [ต้นวันแรก, ท้ายวันสุดท้าย]

export type PeriodMode = "day" | "week" | "month" | "range";
export type PeriodOption = { value: string; label: string };
export type ResolvedPeriod = {
  mode: PeriodMode;
  value: string;
  range: DateRange;
  label: string;
  today: string; // วันที่วันนี้ (YYYY-MM-DD) ใช้เป็น max ของ date picker
  rangeFrom: string; // ค่าเริ่มต้น/ปัจจุบันของช่อง "จากวันที่" (โหมดกำหนดเอง)
  rangeTo: string; // ค่าของช่อง "ถึงวันที่"
  options: { weeks: PeriodOption[]; months: PeriodOption[] };
};

const TZ = "Asia/Bangkok";

/** วันปัจจุบันตามเวลาไทย เป็น {y, m(1-12), d} */
function bkkToday(): { y: number; m: number; d: number } {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, d] = f.format(new Date()).split("-").map(Number);
  return { y, m, d };
}

function utcDay(y: number, m1to12: number, d: number): Date {
  return new Date(Date.UTC(y, m1to12 - 1, d));
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}
/** ปลายวัน (UTC) ของวันที่กำหนด */
function endOfDay(d: Date): Date {
  return new Date(d.getTime() + 86400000 - 1);
}

const thDay = new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short" });
const thMonth = new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", month: "long", year: "numeric" });

/** จันทร์ของสัปดาห์ที่มีวันนี้ */
function mondayOf(d: Date): Date {
  const dow = d.getUTCDay(); // 0=อา..6=ส
  const back = (dow + 6) % 7; // ระยะถอยไปถึงจันทร์
  return addDays(d, -back);
}

/** ตรวจ/แยกค่าวันที่ "YYYY-MM-DD" — คืน null ถ้าไม่ใช่วันที่จริง (เช่น 31 ก.พ.) */
function parseDateValue(s?: string): { y: number; m: number; d: number } | null {
  const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!mt) return null;
  const y = +mt[1];
  const m = +mt[2];
  const d = +mt[3];
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return { y, m, d };
}

function buildOptions() {
  const t = bkkToday();
  const today = utcDay(t.y, t.m, t.d);

  const weeks: PeriodOption[] = [];
  const thisMon = mondayOf(today);
  for (let i = 0; i < 4; i++) {
    const start = addDays(thisMon, -i * 7);
    const end = addDays(start, 6);
    const label = `${thDay.format(start)} – ${thDay.format(end)}` + (i === 0 ? " (สัปดาห์นี้)" : "");
    weeks.push({ value: ymd(start), label });
  }

  const months: PeriodOption[] = [];
  for (let i = 0; i < 12; i++) {
    let y = t.y;
    let m = t.m - i;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const first = utcDay(y, m, 1);
    months.push({ value: `${y}-${String(m).padStart(2, "0")}`, label: thMonth.format(first) });
  }

  return { weeks, months, today: ymd(today) };
}

function first<T>(v: T | T[] | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** อ่าน searchParams → ช่วงเวลาที่เลือก (ดีฟอลต์: เดือนปัจจุบัน) */
export function resolvePeriod(sp: {
  period?: string | string[];
  value?: string | string[];
  from?: string | string[];
  to?: string | string[];
}): ResolvedPeriod {
  const built = buildOptions();
  const options = { weeks: built.weeks, months: built.months };
  const today = built.today;
  const modeRaw = first(sp.period);
  const mode: PeriodMode =
    modeRaw === "day" || modeRaw === "week" || modeRaw === "range" ? modeRaw : "month";
  const valueRaw = first(sp.value);

  // ค่าเริ่มต้นของช่อง "กำหนดเอง": ต้นเดือนปัจจุบัน → วันนี้
  const [ty, tm] = today.split("-").map(Number);
  const defaultRangeFrom = ymd(utcDay(ty, tm, 1));
  let rangeFrom = defaultRangeFrom;
  let rangeTo = today;

  if (mode === "day") {
    const parsed = parseDateValue(valueRaw) ?? parseDateValue(today)!;
    const from = utcDay(parsed.y, parsed.m, parsed.d);
    return {
      mode,
      value: ymd(from),
      range: { from, to: endOfDay(from) },
      label: thDay.format(from),
      today,
      rangeFrom,
      rangeTo,
      options,
    };
  }

  if (mode === "week") {
    const value = options.weeks.find((o) => o.value === valueRaw)?.value ?? options.weeks[0].value;
    const [y, m, d] = value.split("-").map(Number);
    const from = utcDay(y, m, d);
    const end = addDays(from, 6);
    return {
      mode,
      value,
      range: { from, to: endOfDay(end) },
      label: `${thDay.format(from)} – ${thDay.format(end)}`,
      today,
      rangeFrom,
      rangeTo,
      options,
    };
  }

  if (mode === "range") {
    let f = parseDateValue(first(sp.from)) ?? parseDateValue(defaultRangeFrom)!;
    let t = parseDateValue(first(sp.to)) ?? parseDateValue(today)!;
    let fromD = utcDay(f.y, f.m, f.d);
    let toD = utcDay(t.y, t.m, t.d);
    if (fromD.getTime() > toD.getTime()) {
      const tmp = fromD;
      fromD = toD;
      toD = tmp;
    }
    rangeFrom = ymd(fromD);
    rangeTo = ymd(toD);
    return {
      mode,
      value: "",
      range: { from: fromD, to: endOfDay(toD) },
      label: `${thDay.format(fromD)} – ${thDay.format(toD)}`,
      today,
      rangeFrom,
      rangeTo,
      options,
    };
  }

  // month
  const value = options.months.find((o) => o.value === valueRaw)?.value ?? options.months[0].value;
  const [y, m] = value.split("-").map(Number);
  const from = utcDay(y, m, 1);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // วันสุดท้ายของเดือน
  const to = endOfDay(utcDay(y, m, lastDay));
  return {
    mode,
    value,
    range: { from, to },
    label: thMonth.format(from),
    today,
    rangeFrom,
    rangeTo,
    options,
  };
}

// ---------- สำหรับหน้ารายงาน (/reports): ช่วงวันที่กำหนดเอง + ปุ่มลัด ----------

export type PresetRange = { key: string; label: string; from: string; to: string };

function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** ปุ่มลัด: สัปดาห์นี้ / สัปดาห์ก่อน / เดือนนี้ / เดือนก่อน */
export function rangePresets(): PresetRange[] {
  const t = bkkToday();
  const today = utcDay(t.y, t.m, t.d);
  const thisMon = mondayOf(today);
  const lastMon = addDays(thisMon, -7);
  let ly = t.y;
  let lm = t.m - 1;
  if (lm <= 0) {
    lm = 12;
    ly -= 1;
  }
  return [
    { key: "thisWeek", label: "สัปดาห์นี้", from: ymd(thisMon), to: ymd(addDays(thisMon, 6)) },
    { key: "lastWeek", label: "สัปดาห์ก่อน", from: ymd(lastMon), to: ymd(addDays(lastMon, 6)) },
    {
      key: "thisMonth",
      label: "เดือนนี้",
      from: ymd(utcDay(t.y, t.m, 1)),
      to: ymd(utcDay(t.y, t.m, lastDayOfMonth(t.y, t.m))),
    },
    {
      key: "lastMonth",
      label: "เดือนก่อน",
      from: ymd(utcDay(ly, lm, 1)),
      to: ymd(utcDay(ly, lm, lastDayOfMonth(ly, lm))),
    },
  ];
}

export type ReportRange = {
  fromStr: string;
  toStr: string;
  valid: boolean; // false ถ้าวันเริ่มอยู่หลังวันจบ
  range: DateRange;
};

/** อ่าน from/to จาก searchParams (ดีฟอลต์: เดือนปัจจุบันถึงวันนี้) — ไม่ swap ให้ แต่บอกว่า valid ไหม */
export function resolveReportRange(sp: {
  from?: string | string[];
  to?: string | string[];
}): ReportRange {
  const t = bkkToday();
  const today = ymd(utcDay(t.y, t.m, t.d));
  const defFrom = ymd(utcDay(t.y, t.m, 1));
  const fromRaw = first(sp.from);
  const toRaw = first(sp.to);
  const fromStr = parseDateValue(fromRaw) ? (fromRaw as string) : defFrom;
  const toStr = parseDateValue(toRaw) ? (toRaw as string) : today;
  const f = parseDateValue(fromStr)!;
  const tt = parseDateValue(toStr)!;
  const fromD = utcDay(f.y, f.m, f.d);
  const toD = utcDay(tt.y, tt.m, tt.d);
  return {
    fromStr,
    toStr,
    valid: fromD.getTime() <= toD.getTime(),
    range: { from: fromD, to: endOfDay(toD) },
  };
}
