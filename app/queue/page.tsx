export const dynamic = "force-dynamic";

import Link from "next/link";
import AppShell from "@/app/components/AppShell";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { requireUser } from "@/app/lib/auth";
import { endOfTodayBangkok } from "@/app/lib/dates";
import { phoneFmt, dateFmt, dateTimeFmt, STATUS_LABEL } from "@/app/lib/format";

const PAGE_SIZE = 50;

const statusBadge: Record<string, string> = {
  answered: "bg-green-100 text-green-700",
  no_answer: "bg-amber-100 text-amber-700",
  pending: "bg-zinc-100 text-zinc-500",
};

type Row = {
  id: number;
  phone: string;
  brand: string;
  lastStatus: string | null;
  lastCallDate: string | Date | null;
  callCount: number | bigint;
  nextCallAt: string | Date | null;
};

const inputCls =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500";

export default async function QueuePage(props: PageProps<"/queue">) {
  await requireUser();
  const sp = await props.searchParams;

  const q = (typeof sp.q === "string" ? sp.q : "").trim();
  const brandId = typeof sp.brand === "string" && sp.brand ? Number(sp.brand) : null;
  const outcome = typeof sp.outcome === "string" ? sp.outcome : "";
  const count = typeof sp.count === "string" ? sp.count : "";
  const due = sp.due === "1"; // แท็บ "ถึงนัดวันนี้"
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const endToday = endOfTodayBangkok().toISOString();
  const now = new Date();

  const brands = await prisma.brand.findMany({ orderBy: { id: "asc" } });

  // ---- เงื่อนไขชั้นใน (เลือกลูกค้าตามเว็บ/เบอร์/นัด) ----
  // ลูกค้าห้ามโทรไม่แสดงในคิวทุกกรณี
  const innerConds: Prisma.Sql[] = [Prisma.sql`c.status <> 'do_not_call'`];
  if (brandId) innerConds.push(Prisma.sql`c.brandId = ${brandId}`);
  if (q) innerConds.push(Prisma.sql`c.phone LIKE ${"%" + q.replace(/\D/g, "") + "%"}`);
  if (due)
    innerConds.push(
      Prisma.sql`c.nextCallAt IS NOT NULL AND datetime(c.nextCallAt) <= datetime(${endToday})`,
    );
  const whereInner = innerConds.length
    ? Prisma.sql`WHERE ${Prisma.join(innerConds, " AND ")}`
    : Prisma.empty;

  // จำนวน "ถึงนัดวันนี้" (สำหรับ badge แท็บ)
  const dueCountRes = await prisma.$queryRaw<{ n: number | bigint }[]>(Prisma.sql`
    SELECT COUNT(*) AS n FROM Customer c
    WHERE c.status <> 'do_not_call'
      AND c.nextCallAt IS NOT NULL AND datetime(c.nextCallAt) <= datetime(${endToday})
  `);
  const dueCount = Number(dueCountRes[0]?.n ?? 0);

  // ---- เงื่อนไขชั้นนอก (กรองด้วยผลสายล่าสุด / จำนวนครั้งที่โทร) ----
  const outerConds: Prisma.Sql[] = [];
  if (outcome) outerConds.push(Prisma.sql`lastStatus = ${outcome}`);
  if (count === "0") outerConds.push(Prisma.sql`callCount = 0`);
  else if (count === "1") outerConds.push(Prisma.sql`callCount = 1`);
  else if (count === "2") outerConds.push(Prisma.sql`callCount = 2`);
  else if (count === "3") outerConds.push(Prisma.sql`callCount >= 3`);
  const whereOuter = outerConds.length
    ? Prisma.sql`WHERE ${Prisma.join(outerConds, " AND ")}`
    : Prisma.empty;

  // ผลสายล่าสุด = ผลของ "การโทรครั้งล่าสุด" ของลูกค้ารายนั้น (คำนวณด้วย subquery)
  const inner = Prisma.sql`
    SELECT c.id AS id, c.phone AS phone, b.name AS brand, c.nextCallAt AS nextCallAt,
      (SELECT f.status   FROM FollowUp f WHERE f.customerId = c.id ORDER BY f.callDate DESC, f.id DESC LIMIT 1) AS lastStatus,
      (SELECT f.callDate FROM FollowUp f WHERE f.customerId = c.id ORDER BY f.callDate DESC, f.id DESC LIMIT 1) AS lastCallDate,
      (SELECT COUNT(*)   FROM FollowUp f WHERE f.customerId = c.id) AS callCount
    FROM Customer c JOIN Brand b ON b.id = c.brandId
    ${whereInner}
  `;

  // ถ้าดูแท็บนัด → เรียงตามเวลานัด, ไม่งั้นเรียงแบบคิว (ยังไม่เคยโทร/เก่าสุดก่อน)
  const orderBy = due
    ? Prisma.sql`ORDER BY datetime(t.nextCallAt) ASC`
    : Prisma.sql`ORDER BY (t.lastCallDate IS NOT NULL) ASC, t.lastCallDate ASC, t.id ASC`;

  const [rows, countRes] = await Promise.all([
    prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT * FROM (${inner}) t
      ${whereOuter}
      ${orderBy}
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `),
    prisma.$queryRaw<{ n: number | bigint }[]>(Prisma.sql`
      SELECT COUNT(*) AS n FROM (${inner}) t ${whereOuter}
    `),
  ]);

  const total = Number(countRes[0]?.n ?? 0);
  const pages = Math.ceil(total / PAGE_SIZE);

  const params = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (brandId) p.set("brand", String(brandId));
    if (outcome) p.set("outcome", outcome);
    if (count) p.set("count", count);
    if (due) p.set("due", "1");
    for (const [k, v] of Object.entries(over)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    return p.toString();
  };

  return (
    <AppShell>
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-zinc-900">คิวโทร</h1>
        <p className="text-sm text-zinc-500">
          รายชื่อลูกค้าที่ต้องติดตาม — ทั้งหมด <b className="text-zinc-700">{total.toLocaleString("th-TH")}</b> รายการ
        </p>
      </header>

      {/* แท็บ: ทั้งหมด / ถึงนัดวันนี้ */}
      <div className="mb-4 inline-flex rounded-lg bg-zinc-100 p-0.5">
        <Link
          href={`/queue?${params({ due: "" })}`}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            !due ? "bg-white text-indigo-700 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          ทั้งหมด
        </Link>
        <Link
          href={`/queue?${params({ due: "1" })}`}
          className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition ${
            due ? "bg-white text-indigo-700 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          📅 ถึงนัดวันนี้
          {dueCount > 0 && (
            <span className="rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
              {dueCount}
            </span>
          )}
        </Link>
      </div>

      {/* ตัวกรอง */}
      <form className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        {due && <input type="hidden" name="due" value="1" />}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">เว็บ</label>
          <select name="brand" defaultValue={brandId ?? ""} className={inputCls}>
            <option value="">ทุกเว็บ</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">ค้นหาเบอร์</label>
          <input name="q" defaultValue={q} placeholder="เช่น 0891" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">ผลสายล่าสุด</label>
          <select name="outcome" defaultValue={outcome} className={inputCls}>
            <option value="">ทั้งหมด</option>
            <option value="answered">{STATUS_LABEL.answered}</option>
            <option value="no_answer">{STATUS_LABEL.no_answer}</option>
            <option value="pending">{STATUS_LABEL.pending}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">จำนวนครั้งที่โทร</label>
          <select name="count" defaultValue={count} className={inputCls}>
            <option value="">ทั้งหมด</option>
            <option value="0">ยังไม่เคยโทร</option>
            <option value="1">1 ครั้ง</option>
            <option value="2">2 ครั้ง</option>
            <option value="3">3 ครั้งขึ้นไป</option>
          </select>
        </div>
        <button className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          กรอง
        </button>
        {(q || brandId || outcome || count) && (
          <Link
            href={`/queue?${params({ q: "", brand: "", outcome: "", count: "" })}`}
            className="px-2 py-2 text-sm text-zinc-500 hover:underline"
          >
            ล้างตัวกรอง
          </Link>
        )}
      </form>

      {/* ตาราง */}
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-semibold">เบอร์โทร</th>
              <th className="px-4 py-3 font-semibold">เว็บ</th>
              <th className="px-4 py-3 font-semibold">ผลสายล่าสุด</th>
              <th className="px-4 py-3 text-center font-semibold">จำนวนครั้งที่โทร</th>
              <th className="px-4 py-3 font-semibold">โทรล่าสุด</th>
              <th className="px-4 py-3 font-semibold">นัดโทร</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => {
              const n = Number(r.callCount);
              const next = r.nextCallAt ? new Date(r.nextCallAt) : null;
              const overdue = next ? next.getTime() < now.getTime() : false;
              return (
                <tr key={r.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/customers/${r.id}`} className="text-indigo-600 hover:underline">
                      {phoneFmt(r.phone)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{r.brand}</td>
                  <td className="px-4 py-3">
                    {n === 0 || !r.lastStatus ? (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-400">
                        ยังไม่เคยโทร
                      </span>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge[r.lastStatus]}`}>
                        {STATUS_LABEL[r.lastStatus] ?? r.lastStatus}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-zinc-600">{n}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {r.lastCallDate ? dateFmt(r.lastCallDate) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {next ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          overdue ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {overdue ? "เลยนัด · " : ""}
                        {dateTimeFmt(next)} น.
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/customers/${r.id}`} className="text-indigo-600 hover:underline">
                      ดู/บันทึก →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-zinc-400">
                  ไม่พบรายการตามตัวกรอง
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link
              href={`/queue?${params({ page: String(page - 1) })}`}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-50"
            >
              ← ก่อนหน้า
            </Link>
          )}
          <span className="text-zinc-500">
            หน้า {page} / {pages}
          </span>
          {page < pages && (
            <Link
              href={`/queue?${params({ page: String(page + 1) })}`}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-50"
            >
              ถัดไป →
            </Link>
          )}
        </div>
      )}
    </AppShell>
  );
}
