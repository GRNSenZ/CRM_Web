import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { getCurrentUser } from "@/app/lib/auth";
import { canManageUsers } from "@/app/lib/roles";
import { STATUS_LABEL } from "@/app/lib/format";

/** ใส่ 0 นำหน้าให้เบอร์ 9 หลัก (กันเบอร์ที่เก็บแบบตัด 0) */
function normalizePhone(p: string): string {
  const d = p.replace(/\D/g, "");
  return d.length === 9 ? "0" + d : d;
}

/** escape ค่าตามมาตรฐาน CSV (RFC 4180) */
function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

type Row = {
  phone: string;
  brand: string;
  lastStatus: string | null;
  callCount: number | bigint;
  deposit: number | null;
  bonus: number | null;
};

/**
 * GET /api/customers/export?brand=<id>&q=<เบอร์บางส่วน>
 * คืนไฟล์ CSV (UTF-8 + BOM) ของลูกค้าตาม filter เดียวกับหน้า /brands/[id]
 * สิทธิ์: Admin ขึ้นไปเท่านั้น (พนักงาน/Member เรียกตรง → 403)
 *
 * ใช้ raw SQL query เดียว (correlated subquery) แทนการ include relation
 * เพราะ include กับลูกค้าหลักพันรายทำให้ IN(...) เกินลิมิต parameter ของ SQLite (P2029)
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!canManageUsers(user.role)) {
    return new Response("Forbidden — ต้องเป็น Admin ขึ้นไป", { status: 403 });
  }

  const url = new URL(request.url);
  const brandParam = url.searchParams.get("brand");
  const q = (url.searchParams.get("q") ?? "").trim().replace(/\D/g, "");
  const brandId = brandParam ? Number(brandParam) : null;

  const conds: Prisma.Sql[] = [];
  if (brandId) conds.push(Prisma.sql`c.brandId = ${brandId}`);
  if (q) conds.push(Prisma.sql`c.phone LIKE ${"%" + q + "%"}`);
  const whereSql = conds.length
    ? Prisma.sql`WHERE ${Prisma.join(conds, " AND ")}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT
      c.phone AS phone,
      b.name  AS brand,
      (SELECT f.status FROM FollowUp f WHERE f.customerId = c.id ORDER BY f.callDate DESC LIMIT 1) AS lastStatus,
      (SELECT COUNT(*) FROM FollowUp f WHERE f.customerId = c.id) AS callCount,
      (SELECT COALESCE(SUM(d.deposit), 0) FROM DailyActivity d WHERE d.customerId = c.id AND d.deposit > 0) AS deposit,
      (SELECT COALESCE(SUM(bo.amount), 0) FROM BonusAdjustment bo WHERE bo.customerId = c.id) AS bonus
    FROM Customer c
    JOIN Brand b ON b.id = c.brandId
    ${whereSql}
    ORDER BY c.brandId ASC, c.id ASC
  `);

  const headers = [
    "เบอร์โทร",
    "เว็บ",
    "ผลโทรล่าสุด",
    "จำนวนครั้งที่ติดตาม",
    "ยอดกลับมาฝากรวม",
    "โบนัสรวม",
  ];

  const lines: string[] = [headers.map(csvCell).join(",")];

  for (const r of rows) {
    const status = r.lastStatus ?? "pending";
    const row = [
      // ใส่ ="..." กัน Excel ตัดเลข 0 หน้าเบอร์
      `="${normalizePhone(r.phone)}"`,
      r.brand,
      STATUS_LABEL[status] ?? status,
      String(Number(r.callCount)),
      String(r.deposit ?? 0),
      String(r.bonus ?? 0),
    ];
    lines.push(row.map(csvCell).join(","));
  }

  const csv = "﻿" + lines.join("\r\n");
  const filename = brandId ? `customers_brand${brandId}.csv` : "customers.csv";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
