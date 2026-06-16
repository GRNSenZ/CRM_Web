export const dynamic = "force-dynamic";

import Link from "next/link";
import AppShell from "@/app/components/AppShell";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { requireManager } from "@/app/lib/auth";
import { resolveReportRange, rangePresets } from "@/app/lib/period";
import { baht, num, pct, dateFmt } from "@/app/lib/format";

const inputCls =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500";

// แถบสีตามอัตรา conversion (% สูง = เขียวเข้ม)
function heat(p: number): string {
  if (p >= 0.4) return "bg-green-600 text-white";
  if (p >= 0.25) return "bg-green-400 text-white";
  if (p >= 0.12) return "bg-green-200 text-green-900";
  if (p > 0) return "bg-green-50 text-green-800";
  return "text-zinc-400";
}

// แต่ละลูกค้า: การโทรครั้งแรกในช่วง + ฝากเร็วสุดกี่วันหลังโทร + ยอดฝากใน 31 วัน
type ConvRow = {
  cid: number;
  brandId: number;
  brand: string;
  firstStatus: string;
  minDiff: number | bigint | null;
  dep31: number | null;
};
type BonusRow = { cid: number; bonus31: number | null };

export default async function CohortPage(props: PageProps<"/reports/cohort">) {
  await requireManager();

  const sp = await props.searchParams;
  const { fromStr, toStr, valid, range } = resolveReportRange(sp);
  const presets = rangePresets();

  const fromIso = range.from!.toISOString();
  const toIso = range.to!.toISOString();

  // CTE: หา "การโทรครั้งแรก" ต่อลูกค้าในช่วง แล้วดูยอดฝากภายใน 0–31 วันหลังวันโทร
  const baseCte = Prisma.sql`
    WITH ranked AS (
      SELECT f.customerId AS cid, f.callDate AS callDate, f.status AS status,
        ROW_NUMBER() OVER (PARTITION BY f.customerId ORDER BY f.callDate ASC, f.id ASC) AS rn
      FROM FollowUp f
      WHERE datetime(f.callDate) BETWEEN datetime(${fromIso}) AND datetime(${toIso})
    ),
    first_call AS (
      SELECT r.cid AS cid, r.callDate AS firstCall, r.status AS firstStatus, c.brandId AS brandId
      FROM ranked r JOIN Customer c ON c.id = r.cid
      WHERE r.rn = 1
    )
  `;

  const [convRows, bonusRows, brands, maxDep] = valid
    ? await Promise.all([
        prisma.$queryRaw<ConvRow[]>(Prisma.sql`
          ${baseCte}
          SELECT fc.cid AS cid, fc.brandId AS brandId, b.name AS brand, fc.firstStatus AS firstStatus,
            MIN(CASE WHEN da.deposit > 0
              THEN CAST(julianday(date(da.date)) - julianday(date(fc.firstCall)) AS INTEGER) END) AS minDiff,
            COALESCE(SUM(da.deposit), 0) AS dep31
          FROM first_call fc
          JOIN Brand b ON b.id = fc.brandId
          LEFT JOIN DailyActivity da ON da.customerId = fc.cid AND da.deposit > 0
            AND date(da.date) >= date(fc.firstCall)
            AND julianday(date(da.date)) <= julianday(date(fc.firstCall)) + 31
          GROUP BY fc.cid
        `),
        prisma.$queryRaw<BonusRow[]>(Prisma.sql`
          ${baseCte}
          SELECT fc.cid AS cid, COALESCE(SUM(ba.amount), 0) AS bonus31
          FROM first_call fc
          LEFT JOIN BonusAdjustment ba ON ba.customerId = fc.cid
            AND date(ba.adjustDate) >= date(fc.firstCall)
            AND julianday(date(ba.adjustDate)) <= julianday(date(fc.firstCall)) + 31
          GROUP BY fc.cid
        `),
        prisma.brand.findMany({ orderBy: { id: "asc" } }),
        prisma.$queryRaw<{ d: string | null }[]>(
          Prisma.sql`SELECT MAX(date) AS d FROM DailyActivity`,
        ),
      ])
    : [[], [], [], [{ d: null }]];

  const bonusMap = new Map(bonusRows.map((b) => [b.cid, Number(b.bonus31 ?? 0)]));

  // ---- ตารางที่ 1: conversion ต่อเว็บ + รวม ----
  type Agg = {
    customers: number;
    in3: number;
    in7: number;
    in14: number;
    in31: number;
    dep31: number;
  };
  const newAgg = (): Agg => ({ customers: 0, in3: 0, in7: 0, in14: 0, in31: 0, dep31: 0 });
  const perBrand = new Map<number, Agg & { brand: string }>();
  const totalAgg = newAgg();

  // ---- ตารางที่ 2: คุยได้ (รับสาย) vs ไม่ได้คุย ----
  type Grp = { customers: number; in7: number; in31: number; dep31: number; bonus31: number };
  const newGrp = (): Grp => ({ customers: 0, in7: 0, in31: 0, dep31: 0, bonus31: 0 });
  const answered = newGrp();
  const notAnswered = newGrp();

  for (const r of convRows) {
    const diff = r.minDiff == null ? null : Number(r.minDiff);
    const dep = Number(r.dep31 ?? 0);
    const a = perBrand.get(r.brandId) ?? { ...newAgg(), brand: r.brand };
    a.customers++;
    totalAgg.customers++;
    if (diff != null) {
      if (diff <= 3) (a.in3++, totalAgg.in3++);
      if (diff <= 7) (a.in7++, totalAgg.in7++);
      if (diff <= 14) (a.in14++, totalAgg.in14++);
      a.in31++;
      totalAgg.in31++;
    }
    a.dep31 += dep;
    totalAgg.dep31 += dep;
    perBrand.set(r.brandId, a);

    const g = r.firstStatus === "answered" ? answered : notAnswered;
    g.customers++;
    if (diff != null) {
      if (diff <= 7) g.in7++;
      g.in31++;
    }
    g.dep31 += dep;
    g.bonus31 += bonusMap.get(r.cid) ?? 0;
  }

  const brandRows = brands
    .map((b) => perBrand.get(b.id))
    .filter((x): x is Agg & { brand: string } => !!x && x.customers > 0);

  const rate = (n: number, d: number) => (d ? n / d : 0);
  const avg = (g: Grp) => (g.customers ? g.dep31 / g.customers : 0);
  const net = (g: Grp) => g.dep31 - g.bonus31;
  const gapPoints = (rate(answered.in31, answered.customers) - rate(notAnswered.in31, notAnswered.customers)) * 100;

  // หมายเหตุ cohort ยังไม่ครบกำหนด
  const maxDepDate = maxDep[0]?.d ? new Date(maxDep[0].d) : null;
  const matureCutoff = maxDepDate ? new Date(maxDepDate.getTime() - 31 * 86400000) : null;
  const immature = valid && matureCutoff && range.to! > matureCutoff;

  const link = (over: Record<string, string>) => {
    const p = new URLSearchParams({ from: fromStr, to: toStr });
    for (const [k, v] of Object.entries(over)) p.set(k, v);
    return `/reports/cohort?${p.toString()}`;
  };

  return (
    <AppShell>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Cohort Analysis</h1>
          <p className="text-sm text-zinc-500">
            โทรติดตามแล้วลูกค้ากลับมาฝากภายใน 3 / 7 / 14 / 31 วันหรือไม่
          </p>
        </div>
        <Link href="/summary" className="text-sm font-medium text-indigo-600 hover:underline">
          ← รายงานสรุปผล
        </Link>
      </header>

      <div className="mb-5 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        <div className="mb-3 flex flex-wrap gap-2">
          {presets.map((p) => (
            <Link
              key={p.key}
              href={link({ from: p.from, to: p.to })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                p.from === fromStr && p.to === toStr
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <form className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">โทรตั้งแต่วันที่</label>
            <input type="date" name="from" defaultValue={fromStr} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">ถึงวันที่</label>
            <input type="date" name="to" defaultValue={toStr} className={inputCls} />
          </div>
          <button className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            วิเคราะห์
          </button>
        </form>
      </div>

      {!valid ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          วันที่เริ่มต้องไม่อยู่หลังวันที่จบ
        </p>
      ) : (
        <>
          {immature && (
            <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
              ⚠️ ข้อมูลยอดฝากล่าสุดถึง {dateFmt(maxDepDate)} — cohort ของสายที่โทรหลัง{" "}
              {dateFmt(matureCutoff)} อาจ<b>ยังไม่ครบ 31 วัน</b> (ตัวเลขช่วงท้ายอาจต่ำกว่าจริง)
            </p>
          )}

          {/* ตารางที่ 1 */}
          <h2 className="mb-2 font-semibold text-zinc-800">
            1) Conversion ต่อเว็บ — ช่วงโทร {dateFmt(fromStr)} – {dateFmt(toStr)}
          </h2>
          <div className="mb-8 overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">เว็บ</th>
                  <th className="px-4 py-3 text-right font-semibold">ลูกค้าที่โทร</th>
                  <th className="px-4 py-3 text-center font-semibold">ใน 3 วัน</th>
                  <th className="px-4 py-3 text-center font-semibold">ใน 7 วัน</th>
                  <th className="px-4 py-3 text-center font-semibold">ใน 14 วัน</th>
                  <th className="px-4 py-3 text-center font-semibold">ใน 31 วัน</th>
                  <th className="px-4 py-3 text-right font-semibold">ยอดฝากใน 31 วัน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {brandRows.map((r) => (
                  <CohortRow key={r.brand} label={r.brand} a={r} />
                ))}
                {brandRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-zinc-400">
                      ไม่มีการโทรในช่วงนี้
                    </td>
                  </tr>
                )}
              </tbody>
              {brandRows.length > 0 && (
                <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-semibold">
                  <CohortRow label="รวมทุกเว็บ" a={totalAgg} foot />
                </tfoot>
              )}
            </table>
          </div>

          {/* ตารางที่ 2 */}
          <h2 className="mb-2 font-semibold text-zinc-800">2) เทียบกลุ่ม &ldquo;คุยได้&rdquo; vs &ldquo;ไม่ได้คุย&rdquo; (จากผลการโทรครั้งแรก)</h2>
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">กลุ่ม</th>
                  <th className="px-4 py-3 text-right font-semibold">จำนวนคน</th>
                  <th className="px-4 py-3 text-right font-semibold">กลับมาฝากใน 7 วัน</th>
                  <th className="px-4 py-3 text-right font-semibold">ใน 31 วัน</th>
                  <th className="px-4 py-3 text-right font-semibold">ยอดฝากเฉลี่ย/คน</th>
                  <th className="px-4 py-3 text-right font-semibold">โบนัสที่จ่าย</th>
                  <th className="px-4 py-3 text-right font-semibold">ยอดฝากสุทธิ (หักโบนัส)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {[
                  { name: "✅ คุยได้ (รับสาย)", g: answered },
                  { name: "❌ ไม่ได้คุย (ไม่รับสาย/ยังไม่โทร)", g: notAnswered },
                ].map(({ name, g }) => (
                  <tr key={name} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium">{name}</td>
                    <td className="px-4 py-3 text-right">{num(g.customers)}</td>
                    <td className="px-4 py-3 text-right">{pct(rate(g.in7, g.customers))}</td>
                    <td className="px-4 py-3 text-right">{pct(rate(g.in31, g.customers))}</td>
                    <td className="px-4 py-3 text-right">฿{baht(avg(g))}</td>
                    <td className="px-4 py-3 text-right">฿{baht(g.bonus31)}</td>
                    <td className="px-4 py-3 text-right font-medium">฿{baht(net(g))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {answered.customers > 0 && notAnswered.customers > 0 && (
            <p className="mt-3 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
              💡 กลุ่ม <b>คุยได้</b> กลับมาฝากใน 31 วันมากกว่ากลุ่มไม่ได้คุย{" "}
              <b>{gapPoints.toFixed(1)} จุด</b> (
              {pct(rate(answered.in31, answered.customers))} vs{" "}
              {pct(rate(notAnswered.in31, notAnswered.customers))}) — ยอดฝากสุทธิหลังหักโบนัสกลุ่มคุยได้{" "}
              <b>฿{baht(net(answered))}</b>{" "}
              {net(answered) > net(notAnswered) ? "สูงกว่า คุ้มค่าที่จะโทรคุย" : ""}
            </p>
          )}

          <p className="mt-3 text-xs text-zinc-400">
            * นับจาก &ldquo;การโทรครั้งแรก&rdquo; ของลูกค้าแต่ละคนในช่วงที่เลือก · ลูกค้า 1 คนนับครั้งเดียว ·
            ฝากก่อนวันโทรไม่นับ · 3 ⊆ 7 ⊆ 14 ⊆ 31 วัน · (โจทย์เดิมเทียบกลุ่ม &ldquo;เสนอโปร 20%&rdquo; จาก disposition —
            ข้อมูลเราไม่มี จึงเทียบ &ldquo;คุยได้ vs ไม่ได้คุย&rdquo; แทน)
          </p>
        </>
      )}
    </AppShell>
  );
}

function CohortRow({
  label,
  a,
  foot,
}: {
  label: string;
  a: { customers: number; in3: number; in7: number; in14: number; in31: number; dep31: number };
  foot?: boolean;
}) {
  const cell = (n: number) => {
    const p = a.customers ? n / a.customers : 0;
    return (
      <td className="px-2 py-2 text-center">
        <span className={`inline-block min-w-[64px] rounded-md px-2 py-1 text-xs ${heat(p)}`}>
          {num(n)} · {pct(p)}
        </span>
      </td>
    );
  };
  return (
    <tr className={foot ? "" : "hover:bg-zinc-50"}>
      <td className="px-4 py-2 font-medium">{label}</td>
      <td className="px-4 py-2 text-right">{num(a.customers)}</td>
      {cell(a.in3)}
      {cell(a.in7)}
      {cell(a.in14)}
      {cell(a.in31)}
      <td className="px-4 py-2 text-right">฿{baht(a.dep31)}</td>
    </tr>
  );
}
