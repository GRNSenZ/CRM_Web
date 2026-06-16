export const dynamic = "force-dynamic";

import Link from "next/link";
import AppShell from "@/app/components/AppShell";
import PeriodFilter from "@/app/components/PeriodFilter";
import { getBrandStats, sumStats } from "@/app/lib/queries";
import { resolvePeriod } from "@/app/lib/period";
import { baht, num, pct } from "@/app/lib/format";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#13213f] to-[#22386a] p-5 text-white ring-1 ring-amber-400/20">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-1 text-2xl font-bold text-amber-300">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default async function Dashboard(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const period = resolvePeriod(sp);
  const stats = await getBrandStats(period.range);
  const total = sumStats(stats);

  return (
    <AppShell>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">ภาพรวมทั้งหมด</h1>
          <p className="text-sm text-zinc-500">
            สรุปผลการติดตามลูกค้าขาดฝากทุกเว็บ · ช่วง <b className="text-zinc-700">{period.label}</b>
          </p>
        </div>
        <PeriodFilter mode={period.mode} value={period.value} today={period.today} rangeFrom={period.rangeFrom} rangeTo={period.rangeTo} options={period.options} />
      </header>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="การติดตามทั้งหมด" value={num(total.calls)} sub={`${num(total.totalCustomers)} ลูกค้า`} />
        <Stat label="รับสาย" value={`${num(total.answered)}`} sub={`รับสาย ${pct(total.answeredPct)}`} />
        <Stat label="ยอดกลับมาฝาก" value={`฿${baht(total.totalDeposit)}`} sub={`${num(total.returnedCustomers)} คนกลับมาฝาก`} />
        <Stat label="โบนัสที่เติม" value={`฿${baht(total.totalBonus)}`} sub={`คิดเป็น ${pct(total.bonusPerDeposit)} ของยอดฝาก`} />
      </div>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-semibold">เว็บ</th>
              <th className="px-4 py-3 text-right font-semibold">ติดตาม</th>
              <th className="px-4 py-3 text-right font-semibold">รับสาย</th>
              <th className="px-4 py-3 text-right font-semibold">รับสาย %</th>
              <th className="px-4 py-3 text-right font-semibold">กลับมาฝาก/คน</th>
              <th className="px-4 py-3 text-right font-semibold">ยอดกลับมาฝาก</th>
              <th className="px-4 py-3 text-right font-semibold">โบนัส</th>
              <th className="px-4 py-3 text-right font-semibold">โบนัส/ฝาก %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {stats.map((s) => (
              <tr key={s.brandId} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/brands/${s.brandId}`} className="text-indigo-600 hover:underline">
                    {s.brand}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right">{num(s.calls)}</td>
                <td className="px-4 py-3 text-right">{num(s.answered)}</td>
                <td className="px-4 py-3 text-right">{pct(s.answeredPct)}</td>
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
              <td className="px-4 py-3 text-right">{pct(total.answeredPct)}</td>
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