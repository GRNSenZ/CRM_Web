export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/app/components/AppShell";
import PeriodFilter from "@/app/components/PeriodFilter";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth";
import { canManageUsers } from "@/app/lib/roles";
import { resolvePeriod } from "@/app/lib/period";
import { baht, num, pct, phoneFmt, dateFmt, STATUS_LABEL } from "@/app/lib/format";

const PAGE_SIZE = 50;

const statusBadge: Record<string, string> = {
  answered: "bg-green-100 text-green-700",
  no_answer: "bg-amber-100 text-amber-700",
  pending: "bg-zinc-100 text-zinc-500",
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#13213f] to-[#22386a] p-4 text-white ring-1 ring-amber-400/20">
      <p className="text-xs text-slate-300">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-amber-300">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default async function BrandPage(props: PageProps<"/brands/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const brandId = Number(id);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const period = resolvePeriod(sp);
  const { from, to } = period.range;
  const dateFilter = { gte: from, lte: to };

  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) notFound();

  const me = await requireUser();
  const canExport = canManageUsers(me.role);

  // ลิงก์ต่าง ๆ ต้องพกช่วงเวลา + คำค้นไปด้วย
  const baseParams: Record<string, string> = { period: period.mode };
  if (period.mode === "range") {
    baseParams.from = period.rangeFrom;
    baseParams.to = period.rangeTo;
  } else {
    baseParams.value = period.value;
  }
  if (q) baseParams.q = q;
  const exportHref = `/api/customers/export?brand=${brandId}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  const where = {
    brandId,
    ...(q ? { phone: { contains: q.replace(/\D/g, "") } } : {}),
  };
  const brandWhere = { customer: { brandId }, callDate: dateFilter };

  const [total, customers, calls, answered, depAgg, bonusAgg, returned] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { id: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        followUps: { where: { callDate: dateFilter }, orderBy: { callDate: "desc" }, take: 1 },
        dailyActivities: { where: { date: dateFilter, deposit: { gt: 0 } }, select: { deposit: true } },
        _count: { select: { followUps: { where: { callDate: dateFilter } } } },
      },
    }),
    prisma.followUp.count({ where: brandWhere }),
    prisma.followUp.count({ where: { ...brandWhere, status: "answered" } }),
    prisma.dailyActivity.aggregate({
      where: { customer: { brandId }, date: dateFilter, deposit: { gt: 0 } },
      _sum: { deposit: true },
    }),
    prisma.bonusAdjustment.aggregate({
      where: { customer: { brandId }, adjustDate: dateFilter },
      _sum: { amount: true },
    }),
    prisma.dailyActivity.findMany({
      where: { customer: { brandId }, date: dateFilter, deposit: { gt: 0 } },
      distinct: ["customerId"],
      select: { customerId: true },
    }),
  ]);

  const totalDeposit = depAgg._sum.deposit ?? 0;
  const totalBonus = bonusAgg._sum.amount ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <AppShell>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{brand.name}</h1>
          <p className="text-sm text-zinc-500">
            ลูกค้า {total.toLocaleString("th-TH")} ราย · ช่วง{" "}
            <b className="text-zinc-700">{period.label}</b>
          </p>
        </div>
        <PeriodFilter mode={period.mode} value={period.value} today={period.today} rangeFrom={period.rangeFrom} rangeTo={period.rangeTo} options={period.options} />
      </header>

      {/* สรุปของเว็บนี้ตามช่วงที่เลือก */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="ติดตาม (ช่วงนี้)" value={num(calls)} sub={`รับสาย ${calls ? pct(answered / calls) : "-"}`} />
        <Stat label="รับสาย" value={num(answered)} />
        <Stat label="ยอดกลับมาฝาก" value={`฿${baht(totalDeposit)}`} sub={`${returned.length} คนกลับมาฝาก`} />
        <Stat label="โบนัสที่เติม" value={`฿${baht(totalBonus)}`} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <form className="flex gap-2">
          <input type="hidden" name="period" value={period.mode} />
          {period.mode === "range" ? (
            <>
              <input type="hidden" name="from" value={period.rangeFrom} />
              <input type="hidden" name="to" value={period.rangeTo} />
            </>
          ) : (
            <input type="hidden" name="value" value={period.value} />
          )}
          <input
            name="q"
            defaultValue={q}
            placeholder="ค้นหาเบอร์โทร..."
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            ค้นหา
          </button>
        </form>
        {canExport && (
          <a
            href={exportHref}
            className="rounded-lg border border-green-600 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
          >
            ⬇ ดาวน์โหลด CSV
          </a>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-semibold">เบอร์โทร</th>
              <th className="px-4 py-3 font-semibold">สถานะ (ช่วงนี้)</th>
              <th className="px-4 py-3 font-semibold">โทรล่าสุด</th>
              <th className="px-4 py-3 text-center font-semibold">ครั้งที่ติดตาม</th>
              <th className="px-4 py-3 text-right font-semibold">ยอดกลับมาฝาก</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {customers.map((c) => {
              const last = c.followUps[0];
              const dep = c.dailyActivities.reduce((s, d) => s + d.deposit, 0);
              const hasActivity = c._count.followUps > 0 || dep > 0;
              return (
                <tr key={c.id} className={`hover:bg-zinc-50 ${hasActivity ? "" : "text-zinc-400"}`}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/customers/${c.id}`} className="text-indigo-600 hover:underline">
                      {phoneFmt(c.phone)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {last ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge[last.status]}`}>
                        {STATUS_LABEL[last.status]}
                        {last.smsSent ? " · SMS" : ""}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-300">— ไม่มีในช่วงนี้</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{dateFmt(last?.callDate ?? null)}</td>
                  <td className="px-4 py-3 text-center text-zinc-500">{c._count.followUps}</td>
                  <td className="px-4 py-3 text-right">{dep > 0 ? `฿${baht(dep)}` : "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/customers/${c.id}`} className="text-indigo-600 hover:underline">
                      ดู/บันทึก →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-400">
                  ไม่พบลูกค้า
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
              href={`/brands/${brandId}?${new URLSearchParams({ ...baseParams, page: String(page - 1) })}`}
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
              href={`/brands/${brandId}?${new URLSearchParams({ ...baseParams, page: String(page + 1) })}`}
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
