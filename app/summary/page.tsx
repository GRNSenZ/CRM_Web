export const dynamic = "force-dynamic";

import AppShell from "@/app/components/AppShell";
import PeriodFilter from "@/app/components/PeriodFilter";
import BarChart from "@/app/components/BarChart";
import { getBrandStats, sumStats } from "@/app/lib/queries";
import { resolvePeriod } from "@/app/lib/period";
import { requireUser } from "@/app/lib/auth";
import { canManageUsers } from "@/app/lib/roles";
import { baht, num, pct } from "@/app/lib/format";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export default async function SummaryPage(props: PageProps<"/summary">) {
  const sp = await props.searchParams;
  const period = resolvePeriod(sp);

  const me = await requireUser();
  const canExport = canManageUsers(me.role);

  const stats = await getBrandStats(period.range);
  const total = sumStats(stats);

  const exportHref =
    period.range.from && period.range.to
      ? `/api/reports/export?from=${ymd(period.range.from)}&to=${ymd(period.range.to)}`
      : "#";

  return (
    <AppShell>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">รายงานสรุปผล</h1>
          <p className="text-sm text-zinc-500">
            สรุปผลการติดตามแยกรายเว็บ · ช่วง <b className="text-zinc-700">{period.label}</b>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodFilter mode={period.mode} value={period.value} today={period.today} rangeFrom={period.rangeFrom} rangeTo={period.rangeTo} options={period.options} />
          {canExport && (
            <>
              <a
                href="/reports/agents"
                className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
              >
                👥 ผลงานพนักงาน
              </a>
              <a
                href="/reports/cohort"
                className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
              >
                📈 Cohort
              </a>
              <a
                href={exportHref}
                className="rounded-lg border border-green-600 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
              >
                ⬇ ออกรายงาน Excel
              </a>
            </>
          )}
        </div>
      </header>

      {/* กราฟสรุปรายเว็บ */}
      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <BarChart
          title="📞 การติดตามรายเว็บ"
          data={stats.map((s) => ({ label: s.brand, value: s.calls }))}
          accent="#13213f"
          unit=" สาย"
        />
        <BarChart
          title="💰 ยอดกลับมาฝากรายเว็บ"
          data={stats.map((s) => ({ label: s.brand, value: Math.round(s.totalDeposit) }))}
          accent="#c8a24a"
          unit=" ฿"
        />
      </div>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-semibold">เว็บ</th>
              <th className="px-4 py-3 text-right font-semibold">ติดตาม</th>
              <th className="px-4 py-3 text-right font-semibold">รับสาย</th>
              <th className="px-4 py-3 text-right font-semibold">รับสาย %</th>
              <th className="px-4 py-3 text-right font-semibold">ไม่รับสาย</th>
              <th className="px-4 py-3 text-right font-semibold">ไม่รับสาย %</th>
              <th className="px-4 py-3 text-right font-semibold">กลับมาฝาก/คน</th>
              <th className="px-4 py-3 text-right font-semibold">ยอดกลับมาฝาก</th>
              <th className="px-4 py-3 text-right font-semibold">โบนัส</th>
              <th className="px-4 py-3 text-right font-semibold">โบนัส/ฝาก %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {stats.map((s) => (
              <tr key={s.brandId} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium">{s.brand}</td>
                <td className="px-4 py-3 text-right">{num(s.calls)}</td>
                <td className="px-4 py-3 text-right">{num(s.answered)}</td>
                <td className="px-4 py-3 text-right">{s.calls ? pct(s.answeredPct) : "-"}</td>
                <td className="px-4 py-3 text-right">{num(s.calls - s.answered)}</td>
                <td className="px-4 py-3 text-right">
                  {s.calls ? pct((s.calls - s.answered) / s.calls) : "-"}
                </td>
                <td className="px-4 py-3 text-right">{num(s.returnedCustomers)}</td>
                <td className="px-4 py-3 text-right">฿{baht(s.totalDeposit)}</td>
                <td className="px-4 py-3 text-right">฿{baht(s.totalBonus)}</td>
                <td className="px-4 py-3 text-right">{pct(s.bonusPerDeposit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-semibold">
            <tr>
              <td className="px-4 py-3">รวม</td>
              <td className="px-4 py-3 text-right">{num(total.calls)}</td>
              <td className="px-4 py-3 text-right">{num(total.answered)}</td>
              <td className="px-4 py-3 text-right">{total.calls ? pct(total.answeredPct) : "-"}</td>
              <td className="px-4 py-3 text-right">{num(total.calls - total.answered)}</td>
              <td className="px-4 py-3 text-right">
                {total.calls ? pct((total.calls - total.answered) / total.calls) : "-"}
              </td>
              <td className="px-4 py-3 text-right">{num(total.returnedCustomers)}</td>
              <td className="px-4 py-3 text-right">฿{baht(total.totalDeposit)}</td>
              <td className="px-4 py-3 text-right">฿{baht(total.totalBonus)}</td>
              <td className="px-4 py-3 text-right">{pct(total.bonusPerDeposit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </AppShell>
  );
}