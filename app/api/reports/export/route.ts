import * as XLSX from "xlsx";
import { getCurrentUser } from "@/app/lib/auth";
import { canManageUsers } from "@/app/lib/roles";
import { getBrandStats, sumStats } from "@/app/lib/queries";

export const dynamic = "force-dynamic";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** แยกวันที่ YYYY-MM-DD → คืน null ถ้าไม่ใช่วันที่จริง */
function parseDate(s: string | null) {
  const m = DATE_RE.exec(s ?? "");
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2];
  const d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

const thDate = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

const round1 = (n: number) => Math.round(n * 10) / 10; // เปอร์เซ็นต์
const round2 = (n: number) => Math.round(n * 100) / 100; // ยอดเงิน

/**
 * GET /api/reports/export?from=YYYY-MM-DD&to=YYYY-MM-DD → ไฟล์ .xlsx
 * ใช้ logic เดียวกับหน้ารายงาน (getBrandStats) → ตัวเลขตรงกัน 100%
 * สิทธิ์: Admin ขึ้นไป
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canManageUsers(user.role)) return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const f = parseDate(fromRaw);
  const t = parseDate(toRaw);
  if (!f || !t) {
    return new Response("ต้องระบุ from และ to เป็นวันที่ YYYY-MM-DD", { status: 400 });
  }
  const from = new Date(Date.UTC(f.y, f.m - 1, f.d));
  const to = new Date(Date.UTC(t.y, t.m - 1, t.d, 23, 59, 59, 999));
  if (from.getTime() > to.getTime()) {
    return new Response("วันที่เริ่มต้องไม่อยู่หลังวันที่จบ", { status: 400 });
  }

  const stats = await getBrandStats({ from, to });
  const total = sumStats(stats);

  const header = [
    "เว็บ",
    "โทรติดตาม",
    "รับสาย",
    "รับสาย %",
    "ไม่รับสาย",
    "ไม่รับสาย %",
    "กลับมาฝาก/คน",
    "ยอดกลับมาฝาก",
    "ยอดโบนัส",
    "โบนัส/ฝาก %",
  ];

  const row = (label: string, s: (typeof stats)[number] | ReturnType<typeof sumStats>) => [
    label,
    s.calls,
    s.answered,
    s.calls ? round1(s.answeredPct * 100) : 0,
    s.calls - s.answered,
    s.calls ? round1(((s.calls - s.answered) / s.calls) * 100) : 0,
    s.returnedCustomers,
    round2(s.totalDeposit),
    round2(s.totalBonus),
    s.totalDeposit ? round1(s.bonusPerDeposit * 100) : 0,
  ];

  const aoa: (string | number)[][] = [
    [`สรุปผลติดตามลูกค้า ${thDate(fromRaw!)} - ${thDate(toRaw!)}`],
    [],
    header,
    ...stats.map((s) => row(s.brand, s)),
    row("รวมทุกเว็บ", total),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 14 }, ...header.slice(1).map(() => ({ wch: 12 }))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "สรุปผล");
  const raw = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayLike<number>;
  const u8 = new Uint8Array(raw);
  const buf = new ArrayBuffer(u8.length);
  new Uint8Array(buf).set(u8);

  const filename = `report_${fromRaw}_${toRaw}.xlsx`;
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
