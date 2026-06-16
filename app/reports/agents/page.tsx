export const dynamic = "force-dynamic";

import Link from "next/link";
import AppShell from "@/app/components/AppShell";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { requireManager } from "@/app/lib/auth";
import { resolveReportRange, rangePresets } from "@/app/lib/period";
import { roleLabel } from "@/app/lib/roles";
import { baht, num, pct, dateFmt } from "@/app/lib/format";

const inputCls =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500";

type CallRow = { agentId: number | null; calls: bigint; answered: bigint; sms: bigint };
type DepRow = { agentId: number | null; depCustomers: bigint; depTotal: number | null };
type DailyRow = { day: string; calls: bigint; answered: bigint; sms: bigint };

export default async function AgentReportPage(props: PageProps<"/reports/agents">) {
  await requireManager(); // เฉพาะ Admin ขึ้นไป

  const sp = await props.searchParams;
  const { fromStr, toStr, valid, range } = resolveReportRange(sp);
  const presets = rangePresets();
  const sort = typeof sp.sort === "string" && sp.sort === "deposit" ? "deposit" : "calls";
  const agentParam = typeof sp.agent === "string" ? sp.agent : "";

  const fromIso = range.from!.toISOString();
  const toIso = range.to!.toISOString();
  const inRangeCall = Prisma.sql`datetime(f.callDate) BETWEEN datetime(${fromIso}) AND datetime(${toIso})`;

  const [callStats, depStats, users] = valid
    ? await Promise.all([
        prisma.$queryRaw<CallRow[]>(Prisma.sql`
          SELECT f.agentId AS agentId,
            COUNT(*) AS calls,
            SUM(CASE WHEN f.status = 'answered' THEN 1 ELSE 0 END) AS answered,
            SUM(CASE WHEN f.smsSent = 1 THEN 1 ELSE 0 END) AS sms
          FROM FollowUp f
          WHERE ${inRangeCall}
          GROUP BY f.agentId
        `),
        prisma.$queryRaw<DepRow[]>(Prisma.sql`
          SELECT agentId, COUNT(DISTINCT customerId) AS depCustomers, SUM(deposit) AS depTotal FROM (
            SELECT DISTINCT f.agentId AS agentId, da.id AS daId, da.customerId AS customerId, da.deposit AS deposit
            FROM FollowUp f
            JOIN DailyActivity da ON da.customerId = f.customerId
            WHERE ${inRangeCall}
              AND da.deposit > 0
              AND datetime(da.date) BETWEEN datetime(${fromIso}) AND datetime(${toIso})
          ) t GROUP BY agentId
        `),
        prisma.user.findMany({ select: { id: true, name: true, role: true } }),
      ])
    : [[], [], []];

  const userMap = new Map(users.map((u) => [u.id, u]));

  type Row = {
    agentId: number | null;
    name: string;
    role: string;
    calls: number;
    answered: number;
    sms: number;
    depCustomers: number;
    depTotal: number;
  };
  const byAgent = new Map<number | null, Row>();
  const get = (id: number | null): Row => {
    let r = byAgent.get(id);
    if (!r) {
      const u = id != null ? userMap.get(id) : null;
      r = {
        agentId: id,
        name: u ? u.name : "ไม่ระบุผู้โทร (ข้อมูลนำเข้า)",
        role: u ? roleLabel(u.role) : "-",
        calls: 0,
        answered: 0,
        sms: 0,
        depCustomers: 0,
        depTotal: 0,
      };
      byAgent.set(id, r);
    }
    return r;
  };
  for (const c of callStats) {
    const r = get(c.agentId);
    r.calls = Number(c.calls);
    r.answered = Number(c.answered);
    r.sms = Number(c.sms);
  }
  for (const d of depStats) {
    const r = get(d.agentId);
    r.depCustomers = Number(d.depCustomers);
    r.depTotal = d.depTotal ?? 0;
  }

  const rows = [...byAgent.values()].sort((a, b) =>
    sort === "deposit" ? b.depTotal - a.depTotal : b.calls - a.calls,
  );

  const total = rows.reduce(
    (s, r) => ({
      calls: s.calls + r.calls,
      answered: s.answered + r.answered,
      sms: s.sms + r.sms,
      depCustomers: s.depCustomers + r.depCustomers,
      depTotal: s.depTotal + r.depTotal,
    }),
    { calls: 0, answered: 0, sms: 0, depCustomers: 0, depTotal: 0 },
  );

  // รายละเอียดรายวันของพนักงานที่เลือก (คลิกชื่อ)
  const agentId = agentParam ? Number(agentParam) : null;
  const dailyRows =
    valid && agentParam
      ? await prisma.$queryRaw<DailyRow[]>(Prisma.sql`
          SELECT date(f.callDate) AS day,
            COUNT(*) AS calls,
            SUM(CASE WHEN f.status = 'answered' THEN 1 ELSE 0 END) AS answered,
            SUM(CASE WHEN f.smsSent = 1 THEN 1 ELSE 0 END) AS sms
          FROM FollowUp f
          WHERE ${inRangeCall} AND ${agentParam === "null" ? Prisma.sql`f.agentId IS NULL` : Prisma.sql`f.agentId = ${agentId}`}
          GROUP BY date(f.callDate)
          ORDER BY day ASC
        `)
      : [];
  const selectedName =
    agentParam === "null"
      ? "ไม่ระบุผู้โทร (ข้อมูลนำเข้า)"
      : agentId != null
        ? (userMap.get(agentId)?.name ?? "-")
        : "";

  const link = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    p.set("from", fromStr);
    p.set("to", toStr);
    if (sort !== "calls") p.set("sort", sort);
    for (const [k, v] of Object.entries(over)) v ? p.set(k, v) : p.delete(k);
    return `/reports/agents?${p.toString()}`;
  };

  return (
    <AppShell>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">ผลงานรายพนักงาน</h1>
          <p className="text-sm text-zinc-500">สรุปผลการโทรและยอดฝากที่ตามกลับมา แยกตามพนักงาน</p>
        </div>
        <Link href="/summary" className="text-sm font-medium text-indigo-600 hover:underline">
          ← รายงานสรุปผล
        </Link>
      </header>

      {/* เลือกช่วงวันที่ */}
      <div className="mb-5 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        <div className="mb-3 flex flex-wrap gap-2">
          {presets.map((p) => (
            <Link
              key={p.key}
              href={`/reports/agents?from=${p.from}&to=${p.to}`}
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
            <label className="mb-1 block text-xs font-medium text-zinc-500">วันที่เริ่ม</label>
            <input type="date" name="from" defaultValue={fromStr} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">วันที่จบ</label>
            <input type="date" name="to" defaultValue={toStr} className={inputCls} />
          </div>
          {sort !== "calls" && <input type="hidden" name="sort" value={sort} />}
          <button className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            ดูรายงาน
          </button>
        </form>
      </div>

      {!valid ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          วันที่เริ่มต้องไม่อยู่หลังวันที่จบ
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-zinc-500">
            ช่วง <b className="text-zinc-700">{dateFmt(fromStr)} – {dateFmt(toStr)}</b> · เรียงตาม{" "}
            <Link href={link({ sort: "calls" })} className={sort === "calls" ? "font-bold text-indigo-600" : "text-indigo-600 hover:underline"}>
              จำนวนโทร
            </Link>{" "}
            /{" "}
            <Link href={link({ sort: "deposit" })} className={sort === "deposit" ? "font-bold text-indigo-600" : "text-indigo-600 hover:underline"}>
              ยอดฝาก
            </Link>
          </p>

          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">พนักงาน</th>
                  <th className="px-4 py-3 font-semibold">บทบาท</th>
                  <th className="px-4 py-3 text-right font-semibold">จำนวนโทร</th>
                  <th className="px-4 py-3 text-right font-semibold">รับสาย</th>
                  <th className="px-4 py-3 text-right font-semibold">รับสาย %</th>
                  <th className="px-4 py-3 text-right font-semibold">ส่ง SMS</th>
                  <th className="px-4 py-3 text-right font-semibold">ลูกค้ากลับมาฝาก</th>
                  <th className="px-4 py-3 text-right font-semibold">ยอดฝากที่ตามกลับ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => (
                  <tr key={String(r.agentId)} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={link({ agent: r.agentId == null ? "null" : String(r.agentId) })}
                        className="text-indigo-600 hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{r.role}</td>
                    <td className="px-4 py-3 text-right">{num(r.calls)}</td>
                    <td className="px-4 py-3 text-right">{num(r.answered)}</td>
                    <td className="px-4 py-3 text-right">{r.calls ? pct(r.answered / r.calls) : "-"}</td>
                    <td className="px-4 py-3 text-right">{num(r.sms)}</td>
                    <td className="px-4 py-3 text-right">{num(r.depCustomers)}</td>
                    <td className="px-4 py-3 text-right">{r.depTotal ? `฿${baht(r.depTotal)}` : "-"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-zinc-400">
                      ไม่มีข้อมูลในช่วงนี้
                    </td>
                  </tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-semibold">
                  <tr>
                    <td className="px-4 py-3" colSpan={2}>รวมทุกคน</td>
                    <td className="px-4 py-3 text-right">{num(total.calls)}</td>
                    <td className="px-4 py-3 text-right">{num(total.answered)}</td>
                    <td className="px-4 py-3 text-right">{total.calls ? pct(total.answered / total.calls) : "-"}</td>
                    <td className="px-4 py-3 text-right">{num(total.sms)}</td>
                    <td className="px-4 py-3 text-right">{num(total.depCustomers)}</td>
                    <td className="px-4 py-3 text-right">฿{baht(total.depTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* รายละเอียดรายวันของพนักงานที่เลือก */}
          {agentParam && (
            <section className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-zinc-800">รายวันของ {selectedName}</h2>
                <Link href={link({ agent: "" })} className="text-sm text-zinc-400 hover:underline">
                  ปิด ✕
                </Link>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">วันที่</th>
                    <th className="px-3 py-2 text-right font-semibold">โทร</th>
                    <th className="px-3 py-2 text-right font-semibold">รับสาย</th>
                    <th className="px-3 py-2 text-right font-semibold">ส่ง SMS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {dailyRows.map((d) => (
                    <tr key={d.day}>
                      <td className="px-3 py-2">{dateFmt(d.day)}</td>
                      <td className="px-3 py-2 text-right">{num(Number(d.calls))}</td>
                      <td className="px-3 py-2 text-right">{num(Number(d.answered))}</td>
                      <td className="px-3 py-2 text-right">{num(Number(d.sms))}</td>
                    </tr>
                  ))}
                  {dailyRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-zinc-400">
                        ไม่มีการโทรในช่วงนี้
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          <p className="mt-3 text-xs text-zinc-400">
            * &ldquo;ลูกค้ากลับมาฝาก/ยอดฝาก&rdquo; นับลูกค้าที่พนักงานคนนั้นโทรหาในช่วง แล้วมียอดฝากในช่วงเดียวกัน
            — ถ้าลูกค้าถูกโทรโดยหลายคน จะนับเครดิตให้ทุกคนที่โทร (แถวรวมจึงอาจมากกว่ายอดจริงเล็กน้อย)
          </p>
        </>
      )}
    </AppShell>
  );
}
