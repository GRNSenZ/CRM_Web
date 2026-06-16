import * as XLSX from "xlsx";
import type { PrismaClient } from "@/app/generated/prisma/client";

// โครงไฟล์ Excel ต้นฉบับ (ต่อ 1 ชีต = 1 เว็บ/แบรนด์)
const SUMMARY_SHEETS = new Set(["สรุปรายสัปดาห์", "สรุปรายเดือน"]);
const HEADER_ROW = 3; // แถวที่ 4 (0-based) = หัวคอลัมน์ "ลำดับ|เบอร์|..."
const DATA_START = 4; // แถวที่ 5 = ข้อมูลแถวแรก
const DAY_START_COL = 7; // คอลัมน์ H = Login วันที่ 1
const MAX_DAY = 31;
const BONUS_DATE_COL = 71; // วันที่ปรับโบนัส
const BONUS_AMT_COL = 72; // ยอดที่ปรับ

export type ParsedDay = { day: number; login: boolean; deposit: number };
export type ParsedRow = {
  phone: string;
  callDate: Date | null;
  callTime: string | null;
  status: "answered" | "no_answer" | "pending";
  smsSent: boolean;
  days: ParsedDay[];
  bonusDate: Date | null;
  bonusAmount: number | null;
};
export type ParsedBrand = { brand: string; year: number; month: number; rows: ParsedRow[] };

export type ImportSummary = {
  sheets: number;
  brandsCreated: number;
  customersCreated: number;
  followUpsAdded: number;
  dailyUpserted: number;
  bonusesAdded: number;
  dncSkipped: number;
  rows: number;
  perBrand: { brand: string; rows: number; customers: number }[];
};

/** เบอร์เก็บเป็นตัวเลข ทำให้ 0 หน้าหาย → เติมกลับ */
function normalizePhone(v: unknown): string | null {
  if (v == null || v === "") return null;
  let s = String(v).trim();
  if (s.endsWith(".0")) s = s.slice(0, -2);
  s = s.replace(/\D/g, "");
  if (!s) return null;
  if (s.length === 9) s = "0" + s;
  return s;
}

/** เวลาเก็บเป็นเลข HH.MM (เช่น 13.01 = 13:01, 12.5 = 12:50, 13 = 13:00) */
function parseTime(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const s = (Math.round(v * 100) / 100).toString();
    const [hh, mmRaw = ""] = s.split(".");
    let mm = mmRaw;
    if (mm.length === 0) mm = "00";
    else if (mm.length === 1) mm = mm + "0";
    else mm = mm.slice(0, 2);
    return `${hh.padStart(2, "0")}:${mm}`;
  }
  return String(v).replace(".", ":");
}

/** วันที่ใน Excel ถูก parse เป็นเวลาท้องถิ่น (เครื่องไทย) → ใช้ component ท้องถิ่น แล้วทำเป็น UTC เที่ยงคืน */
function toUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** วันที่โบนัสบางทีเป็นปี พ.ศ. (เช่น 2569) → แปลงเป็น ค.ศ. */
function parseBonusDate(v: unknown): Date | null {
  if (!(v instanceof Date) || isNaN(v.getTime())) return null;
  let y = v.getFullYear();
  if (y > 2400) y -= 543;
  return new Date(Date.UTC(y, v.getMonth(), v.getDate()));
}

function truthy(v: unknown): boolean {
  return v === true || v === 1 || v === "True" || v === "true" || v === "TRUE";
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return isNaN(n) ? 0 : n;
}

/** อ่านไฟล์ xlsx (buffer) → โครงสร้างต่อแบรนด์ */
export function parseWorkbook(buf: ArrayBuffer | Buffer): ParsedBrand[] {
  const wb = XLSX.read(buf, { cellDates: true });
  const result: ParsedBrand[] = [];

  for (const sheetName of wb.SheetNames) {
    if (SUMMARY_SHEETS.has(sheetName)) continue;
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, blankrows: true });
    if (aoa.length <= DATA_START) continue;

    // ตรวจว่าเป็นชีตข้อมูลจริง (หัวคอลัมน์ต้องมี "เบอร์")
    const header = aoa[HEADER_ROW] ?? [];
    if (!header.some((h) => String(h ?? "").includes("เบอร์"))) continue;

    const rows: ParsedRow[] = [];
    let year = 0;
    let month = 0;

    for (let i = DATA_START; i < aoa.length; i++) {
      const r = aoa[i] ?? [];
      const phone = normalizePhone(r[1]);
      if (!phone) continue;

      const callDateCell = r[2];
      let callDate: Date | null = null;
      if (callDateCell instanceof Date && !isNaN(callDateCell.getTime())) {
        callDate = toUtcDay(callDateCell);
        if (!year) {
          year = callDateCell.getFullYear();
          month = callDateCell.getMonth() + 1;
        }
      }

      const answered = truthy(r[4]);
      const noAnswer = truthy(r[5]);
      const status = answered ? "answered" : noAnswer ? "no_answer" : "pending";

      const days: ParsedDay[] = [];
      for (let d = 1; d <= MAX_DAY; d++) {
        const loginCol = DAY_START_COL + (d - 1) * 2;
        const depCol = loginCol + 1;
        const login = truthy(r[loginCol]);
        const deposit = num(r[depCol]);
        if (login || deposit > 0) days.push({ day: d, login, deposit });
      }

      const bonusAmount = num(r[BONUS_AMT_COL]);
      rows.push({
        phone,
        callDate,
        callTime: parseTime(r[3]),
        status,
        smsSent: truthy(r[6]),
        days,
        bonusDate: bonusAmount > 0 ? parseBonusDate(r[BONUS_DATE_COL]) : null,
        bonusAmount: bonusAmount > 0 ? bonusAmount : null,
      });
    }

    if (rows.length) {
      result.push({ brand: sheetName, year: year || 0, month: month || 0, rows });
    }
  }

  return result;
}

const keyOf = (parts: (string | number)[]) => parts.join("|");

/** นำข้อมูลที่ parse แล้วเข้าฐานข้อมูลแบบ merge (ไม่ลบของเดิม) */
export async function importWorkbook(
  prisma: PrismaClient,
  parsed: ParsedBrand[],
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    sheets: parsed.length,
    brandsCreated: 0,
    customersCreated: 0,
    followUpsAdded: 0,
    dailyUpserted: 0,
    bonusesAdded: 0,
    dncSkipped: 0,
    rows: 0,
    perBrand: [],
  };

  for (const b of parsed) {
    // 1) แบรนด์ (upsert by name)
    const existingBrand = await prisma.brand.findUnique({ where: { name: b.brand } });
    const brand =
      existingBrand ?? (await prisma.brand.create({ data: { name: b.brand } }));
    if (!existingBrand) summary.brandsCreated++;

    // 2) ลูกค้า: เพิ่มเฉพาะเบอร์ใหม่ (ยุบซ้ำในไฟล์ + เทียบกับที่มีอยู่)
    const phones = Array.from(new Set(b.rows.map((r) => r.phone)));
    const existing = await prisma.customer.findMany({
      where: { brandId: brand.id },
      select: { id: true, phone: true, status: true },
    });
    const existingPhones = new Set(existing.map((c) => c.phone));
    const newPhones = phones.filter((p) => !existingPhones.has(p));
    if (newPhones.length) {
      await prisma.customer.createMany({
        data: newPhones.map((phone) => ({ phone, brandId: brand.id })),
      });
    }
    const customers = newPhones.length
      ? await prisma.customer.findMany({
          where: { brandId: brand.id },
          select: { id: true, phone: true, status: true },
        })
      : existing;
    const phoneToId = new Map(customers.map((c) => [c.phone, c.id]));
    // ลูกค้าห้ามโทร — ข้ามการเพิ่มบันทึกการโทรจากไฟล์
    const dncIds = new Set(customers.filter((c) => c.status === "do_not_call").map((c) => c.id));
    summary.customersCreated += newPhones.length;

    // 3) โหลดคีย์ที่มีอยู่แล้ว เพื่อกันเพิ่มซ้ำ (idempotent เมื่ออัปโหลดไฟล์เดิมซ้ำ)
    //    กรองผ่าน customer.brandId (ไม่ใช้ id list เพื่อเลี่ยงลิมิต parameter ของ SQLite)
    const existingFu = await prisma.followUp.findMany({
      where: { customer: { brandId: brand.id } },
      select: { customerId: true, callDate: true, callTime: true },
    });
    const fuKeys = new Set(
      existingFu.map((f) => keyOf([f.customerId, f.callDate.getTime(), f.callTime ?? ""])),
    );
    const existingBonus = await prisma.bonusAdjustment.findMany({
      where: { customer: { brandId: brand.id } },
      select: { customerId: true, adjustDate: true, amount: true },
    });
    const bonusKeys = new Set(
      existingBonus.map((x) => keyOf([x.customerId, x.adjustDate.getTime(), x.amount])),
    );

    const newFollowUps: {
      customerId: number;
      callDate: Date;
      callTime: string | null;
      status: string;
      smsSent: boolean;
    }[] = [];
    const newBonuses: { customerId: number; adjustDate: Date; amount: number }[] = [];
    const dailyMap = new Map<
      string,
      { customerId: number; date: Date; loggedIn: boolean; deposit: number }
    >();

    for (const row of b.rows) {
      const cid = phoneToId.get(row.phone);
      if (!cid) continue;
      summary.rows++;

      // ลูกค้าห้ามโทร → ไม่เพิ่มบันทึกการโทรจากไฟล์ (กฎต้องบังคับถึงขา import)
      if (dncIds.has(cid)) {
        if (row.callDate) summary.dncSkipped++;
        continue;
      }

      // สร้างบันทึกการโทรเฉพาะแถวที่มี "วันที่โทร" จริง
      // (แถวที่ช่องวันที่เป็น "ซ้ำ"/ว่าง = รายการซ้ำที่ถูก flag ไว้ ไม่ใช่การโทร → ข้าม)
      if (row.callDate) {
        const fk = keyOf([cid, row.callDate.getTime(), row.callTime ?? ""]);
        if (!fuKeys.has(fk)) {
          fuKeys.add(fk);
          newFollowUps.push({
            customerId: cid,
            callDate: row.callDate,
            callTime: row.callTime,
            status: row.status,
            smsSent: row.smsSent,
          });
        }
      }

      for (const d of row.days) {
        const date = new Date(Date.UTC(b.year || 2026, (b.month || 1) - 1, d.day));
        const k = keyOf([cid, d.day]);
        const ex = dailyMap.get(k);
        if (ex) {
          ex.loggedIn = ex.loggedIn || d.login;
          ex.deposit += d.deposit;
        } else {
          dailyMap.set(k, { customerId: cid, date, loggedIn: d.login, deposit: d.deposit });
        }
      }

      if (row.bonusAmount && row.bonusAmount > 0) {
        const monthStart = new Date(Date.UTC(b.year || 2026, (b.month || 1) - 1, 1));
        let bDate = row.bonusDate ?? row.callDate ?? monthStart;
        // กันวันที่โบนัสเพี้ยน (เช่น ปี 1969/2053 หรือคนละเดือน) → ผูกกับเดือนแคมเปญ
        if (
          b.year &&
          b.month &&
          (bDate.getUTCFullYear() !== b.year || bDate.getUTCMonth() !== b.month - 1)
        ) {
          bDate = row.callDate ?? monthStart;
        }
        const bk = keyOf([cid, bDate.getTime(), row.bonusAmount]);
        if (!bonusKeys.has(bk)) {
          bonusKeys.add(bk);
          newBonuses.push({ customerId: cid, adjustDate: bDate, amount: row.bonusAmount });
        }
      }
    }

    // 4) เขียนลง DB
    if (newFollowUps.length) {
      await prisma.followUp.createMany({ data: newFollowUps });
      summary.followUpsAdded += newFollowUps.length;
    }
    if (newBonuses.length) {
      await prisma.bonusAdjustment.createMany({ data: newBonuses });
      summary.bonusesAdded += newBonuses.length;
    }
    for (const d of dailyMap.values()) {
      await prisma.dailyActivity.upsert({
        where: { customerId_date: { customerId: d.customerId, date: d.date } },
        create: d,
        update: { loggedIn: d.loggedIn, deposit: d.deposit },
      });
      summary.dailyUpserted++;
    }

    summary.perBrand.push({ brand: b.brand, rows: b.rows.length, customers: customers.length });
  }

  return summary;
}
