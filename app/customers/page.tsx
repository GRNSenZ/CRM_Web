export const dynamic = "force-dynamic";

import Link from "next/link";
import AppShell from "@/app/components/AppShell";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth";
import { baht, phoneFmt, dateFmt, dateTimeFmt, STATUS_LABEL, CUSTOMER_STATUS_LABEL } from "@/app/lib/format";

const statusBadge: Record<string, string> = {
  answered: "bg-green-100 text-green-700",
  no_answer: "bg-amber-100 text-amber-700",
  pending: "bg-zinc-100 text-zinc-500",
};

const MAX = 100;

export default async function CustomerSearchPage(props: PageProps<"/customers">) {
  await requireUser();
  const sp = await props.searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim();
  const status = typeof sp.status === "string" ? sp.status : "";
  const digits = q.replace(/\D/g, "");
  const active = !!digits || !!status; // มีเงื่อนไขค้นหาอย่างน้อย 1 อย่าง

  const customers = active
    ? await prisma.customer.findMany({
        where: {
          ...(digits ? { phone: { contains: digits } } : {}),
          ...(status ? { status } : {}),
        },
        orderBy: [{ phone: "asc" }, { brandId: "asc" }],
        take: MAX,
        include: {
          brand: true,
          followUps: { orderBy: [{ callDate: "desc" }, { id: "desc" }], include: { agent: { select: { name: true } } } },
          dailyActivities: { where: { deposit: { gt: 0 } }, select: { deposit: true } },
          bonuses: { select: { amount: true } },
        },
      })
    : [];

  // จัดกลุ่มตามเบอร์ (เบอร์เดียวอาจอยู่หลายเว็บ)
  const groups = new Map<string, typeof customers>();
  for (const c of customers) {
    const arr = groups.get(c.phone) ?? [];
    arr.push(c);
    groups.set(c.phone, arr);
  }

  return (
    <AppShell>
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-zinc-900">ค้นหาลูกค้า (ข้ามเว็บ)</h1>
        <p className="text-sm text-zinc-500">
          ใส่เบอร์โทรเพื่อดูว่าเบอร์นี้มีอยู่เว็บไหนบ้าง และประวัติการติดตามแต่ละเว็บ
        </p>
      </header>

      <form className="mb-6 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="กรอกเบอร์โทร เช่น 0870248821 หรือบางส่วน 0891"
          className="w-full max-w-md rounded-lg border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
        >
          <option value="">ทุกสถานะ</option>
          <option value="active">{CUSTOMER_STATUS_LABEL.active}</option>
          <option value="do_not_call">{CUSTOMER_STATUS_LABEL.do_not_call}</option>
        </select>
        <button className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
          ค้นหา
        </button>
      </form>

      {!active && (
        <p className="rounded-2xl bg-white px-6 py-10 text-center text-sm text-zinc-400 ring-1 ring-zinc-200">
          🔎 กรอกเบอร์โทร หรือเลือกสถานะเพื่อค้นหา
        </p>
      )}

      {active && groups.size === 0 && (
        <p className="rounded-2xl bg-white px-6 py-10 text-center text-sm text-zinc-400 ring-1 ring-zinc-200">
          ไม่พบลูกค้าตามเงื่อนไข
        </p>
      )}

      {active && groups.size > 0 && (
        <p className="mb-3 text-sm text-zinc-500">
          พบ {groups.size.toLocaleString("th-TH")} เบอร์
          {customers.length >= MAX ? ` (แสดงสูงสุด ${MAX} รายการ — ลองระบุให้ชัดขึ้น)` : ""}
        </p>
      )}

      <div className="space-y-6">
        {[...groups.entries()].map(([phone, entries]) => (
          <div key={phone} className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-5 py-3">
              <h2 className="text-lg font-bold text-zinc-900">📱 {phoneFmt(phone)}</h2>
              <span className="text-sm text-zinc-500">
                พบใน <b className="text-indigo-600">{entries.length}</b> เว็บ
              </span>
            </div>

            <div className="divide-y divide-zinc-100">
              {entries.map((c) => {
                const deposit = c.dailyActivities.reduce((s, d) => s + d.deposit, 0);
                const bonus = c.bonuses.reduce((s, b) => s + b.amount, 0);
                return (
                  <div key={c.id} className="px-5 py-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-sm font-semibold text-indigo-700">
                          {c.brand.name}
                        </span>
                        {c.status === "do_not_call" && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                            🚫 ห้ามโทร
                          </span>
                        )}
                        <span className="text-sm text-zinc-500">
                          โทร {c.followUps.length} ครั้ง · ฝาก ฿{baht(deposit)} · โบนัส ฿{baht(bonus)}
                        </span>
                        {c.status !== "do_not_call" && c.nextCallAt && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            📅 นัด {dateTimeFmt(c.nextCallAt)}
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/customers/${c.id}`}
                        className="text-sm font-medium text-indigo-600 hover:underline"
                      >
                        เปิดหน้าเต็ม →
                      </Link>
                    </div>

                    {c.followUps.length === 0 ? (
                      <p className="text-sm text-zinc-400">ยังไม่มีประวัติการโทร</p>
                    ) : (
                      <div className="overflow-hidden rounded-lg ring-1 ring-zinc-100">
                        <table className="w-full text-sm">
                          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-400">
                            <tr>
                              <th className="px-3 py-2 font-semibold">วันที่</th>
                              <th className="px-3 py-2 font-semibold">เวลา</th>
                              <th className="px-3 py-2 font-semibold">ผลสาย</th>
                              <th className="px-3 py-2 font-semibold">SMS</th>
                              <th className="px-3 py-2 font-semibold">พนักงาน</th>
                              <th className="px-3 py-2 font-semibold">หมายเหตุ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {c.followUps.map((f) => (
                              <tr key={f.id}>
                                <td className="px-3 py-2">{dateFmt(f.callDate)}</td>
                                <td className="px-3 py-2 text-zinc-500">{f.callTime ?? "-"}</td>
                                <td className="px-3 py-2">
                                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge[f.status]}`}>
                                    {STATUS_LABEL[f.status] ?? f.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2">{f.smsSent ? "✓" : "-"}</td>
                                <td className="px-3 py-2 text-zinc-500">{f.agent?.name ?? "-"}</td>
                                <td className="px-3 py-2 text-zinc-500">{f.note ?? "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
