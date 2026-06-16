export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/app/components/AppShell";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth";
import { isStaff } from "@/app/lib/roles";
import { addFollowUp, addDailyActivity, addBonus } from "@/app/actions/crm";
import {
  baht,
  phoneFmt,
  dateFmt,
  dateTimeFmt,
  STATUS_LABEL,
  CUSTOMER_STATUS_LABEL,
} from "@/app/lib/format";
import { actionLabel } from "@/app/lib/audit";
import ConfirmButton from "./ConfirmButton";
import StatusForm from "./StatusForm";
import SmsSection from "./SmsSection";

const input = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500";
const card = "rounded-2xl bg-white p-5 ring-1 ring-zinc-200";

export default async function CustomerPage(props: PageProps<"/customers/[id]">) {
  const { id } = await props.params;
  const customerId = Number(id);

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      brand: true,
      followUps: { orderBy: { callDate: "desc" }, include: { agent: true } },
      dailyActivities: { orderBy: { date: "asc" } },
      bonuses: { orderBy: { adjustDate: "asc" } },
      statusLogs: { orderBy: { createdAt: "desc" }, include: { changedBy: { select: { name: true } } } },
    },
  });
  if (!customer) notFound();

  const totalDeposit = customer.dailyActivities.reduce((s, d) => s + d.deposit, 0);
  const totalBonus = customer.bonuses.reduce((s, b) => s + b.amount, 0);
  const today = new Date().toISOString().slice(0, 10);

  const me = await requireUser();
  const canEdit = isStaff(me.role);
  const isDnc = customer.status === "do_not_call";

  const auditLogs = canEdit
    ? await prisma.auditLog.findMany({
        where: { entity: "Customer", entityId: customerId },
        orderBy: { createdAt: "desc" },
        take: 15,
        include: { user: { select: { name: true } } },
      })
    : [];

  const smsTemplates = canEdit
    ? await prisma.smsTemplate.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, body: true },
      })
    : [];

  return (
    <AppShell>
      <div className="mb-2 text-sm text-zinc-400">
        <Link href={`/brands/${customer.brandId}`} className="hover:underline">
          {customer.brand.name}
        </Link>{" "}
        / ลูกค้า
      </div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-zinc-900">{phoneFmt(customer.phone)}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isDnc ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
              }`}
            >
              {CUSTOMER_STATUS_LABEL[customer.status] ?? customer.status}
            </span>
          </div>
          {customer.name && <p className="text-sm text-zinc-500">{customer.name}</p>}
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xs text-zinc-400">ยอดกลับมาฝาก</p>
            <p className="text-lg font-bold text-green-600">฿{baht(totalDeposit)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">โบนัสที่เติม</p>
            <p className="text-lg font-bold text-indigo-600">฿{baht(totalBonus)}</p>
          </div>
        </div>
      </header>

      {isDnc && (
        <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          🚫 ลูกค้ารายนี้อยู่ในสถานะ <b>ห้ามโทร</b> — ไม่สามารถบันทึกการโทรได้
        </div>
      )}

      {!isDnc && customer.nextCallAt && (
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
          📅 นัดโทร: {dateTimeFmt(customer.nextCallAt)} น.
        </div>
      )}

      {canEdit && (
      <div className="grid gap-6 lg:grid-cols-3">
        {/* บันทึกการโทร — ซ่อนเมื่อห้ามโทร */}
        {!isDnc && (
        <div className={card}>
          <h2 className="mb-3 font-semibold text-zinc-800">➕ บันทึกการโทร</h2>
          <form action={addFollowUp} className="space-y-3">
            <input type="hidden" name="customerId" value={customer.id} />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" name="callDate" defaultValue={today} className={input} />
              <input type="time" name="callTime" className={input} />
            </div>
            <select name="status" className={input} defaultValue="answered">
              <option value="answered">รับสาย</option>
              <option value="no_answer">ไม่รับสาย</option>
              <option value="pending">ยังไม่โทร</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input type="checkbox" name="smsSent" /> ส่ง SMS หลังโทร
            </label>
            <SmsSection templates={smsTemplates} web={customer.brand.name} phone={customer.phone} />
            <textarea name="note" rows={2} placeholder="หมายเหตุ..." className={input} />
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                📅 นัดโทรอีกครั้ง (ไม่บังคับ)
              </label>
              <input type="datetime-local" name="nextCallAt" className={input} />
            </div>
            <ConfirmButton
              message="ต้องการบันทึกการโทรนี้ใช่ไหม?"
              className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              บันทึก
            </ConfirmButton>
          </form>
        </div>
        )}

        {/* บันทึกยอดฝากรายวัน */}
        <div className={card}>
          <h2 className="mb-3 font-semibold text-zinc-800">💰 บันทึก Login / ยอดฝาก</h2>
          <form action={addDailyActivity} className="space-y-3">
            <input type="hidden" name="customerId" value={customer.id} />
            <input type="date" name="date" defaultValue={today} className={input} />
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input type="checkbox" name="loggedIn" defaultChecked /> Login เข้าระบบ
            </label>
            <input type="number" name="deposit" step="0.01" placeholder="ยอดฝาก (บาท)" className={input} />
            <ConfirmButton
              tone="green"
              message="ต้องการบันทึก Login / ยอดฝากนี้ใช่ไหม?"
              className="w-full rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              บันทึก
            </ConfirmButton>
          </form>
        </div>

        {/* ปรับโบนัส */}
        <div className={card}>
          <h2 className="mb-3 font-semibold text-zinc-800">🎁 ปรับโบนัส</h2>
          <form action={addBonus} className="space-y-3">
            <input type="hidden" name="customerId" value={customer.id} />
            <input type="date" name="adjustDate" defaultValue={today} className={input} />
            <input type="number" name="amount" step="0.01" placeholder="ยอดโบนัส (บาท)" className={input} />
            <input type="number" name="percent" step="1" defaultValue={20} placeholder="% โบนัส" className={input} />
            <ConfirmButton
              tone="amber"
              message="ต้องการบันทึกการปรับโบนัสนี้ใช่ไหม?"
              className="w-full rounded-lg bg-amber-400 py-2 text-sm font-semibold text-white hover:bg-amber-500"
            >
              บันทึก
            </ConfirmButton>
          </form>
        </div>
      </div>
      )}

      {/* จัดการสถานะห้ามโทร + ประวัติการเปลี่ยนสถานะ */}
      {canEdit && (
        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className={card}>
            <h2 className="mb-3 font-semibold text-zinc-800">🚫 สถานะการโทร</h2>
            <p className="mb-3 text-sm text-zinc-500">
              สถานะปัจจุบัน:{" "}
              <b className={isDnc ? "text-red-600" : "text-green-600"}>
                {CUSTOMER_STATUS_LABEL[customer.status]}
              </b>
            </p>
            <StatusForm customerId={customer.id} currentStatus={customer.status} />
          </div>

          <div className={`${card} lg:col-span-2`}>
            <h2 className="mb-3 font-semibold text-zinc-800">
              ประวัติการเปลี่ยนสถานะ ({customer.statusLogs.length})
            </h2>
            {customer.statusLogs.length === 0 ? (
              <p className="text-sm text-zinc-400">ยังไม่มีการเปลี่ยนสถานะ</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {customer.statusLogs.map((log) => (
                  <li key={log.id} className="rounded-lg bg-zinc-50 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-zinc-500">{dateTimeFmt(log.createdAt)}</span>
                      <span className="font-medium">
                        {CUSTOMER_STATUS_LABEL[log.fromStatus] ?? log.fromStatus} →{" "}
                        <span className={log.toStatus === "do_not_call" ? "text-red-600" : "text-green-600"}>
                          {CUSTOMER_STATUS_LABEL[log.toStatus] ?? log.toStatus}
                        </span>
                      </span>
                      <span className="text-zinc-400">โดย {log.changedBy?.name ?? "-"}</span>
                    </div>
                    {log.reason && <p className="mt-0.5 text-zinc-500">เหตุผล: {log.reason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Audit log ของลูกค้ารายนี้ */}
      {canEdit && auditLogs.length > 0 && (
        <section className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
          <h2 className="mb-3 font-semibold text-zinc-800">ประวัติการแก้ไข (Audit)</h2>
          <ul className="space-y-1.5 text-sm">
            {auditLogs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 text-zinc-600">
                <span className="text-zinc-400">{dateTimeFmt(l.createdAt)}</span>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {actionLabel(l.action)}
                </span>
                <span className="text-zinc-400">โดย {l.user?.name ?? "ระบบ"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ประวัติการโทร */}
      <section className="mt-8">
        <h2 className="mb-3 font-semibold text-zinc-800">ประวัติการติดตาม ({customer.followUps.length})</h2>
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">วันที่</th>
                <th className="px-4 py-2.5 font-semibold">เวลา</th>
                <th className="px-4 py-2.5 font-semibold">สถานะ</th>
                <th className="px-4 py-2.5 font-semibold">SMS</th>
                <th className="px-4 py-2.5 font-semibold">พนักงาน</th>
                <th className="px-4 py-2.5 font-semibold">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {customer.followUps.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-2.5">{dateFmt(f.callDate)}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{f.callTime ?? "-"}</td>
                  <td className="px-4 py-2.5">{STATUS_LABEL[f.status]}</td>
                  <td className="px-4 py-2.5">{f.smsSent ? "✓" : "-"}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{f.agent?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{f.note ?? "-"}</td>
                </tr>
              ))}
              {customer.followUps.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-400">
                    ยังไม่มีประวัติ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ยอดฝากรายวัน */}
      {customer.dailyActivities.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-semibold text-zinc-800">Login / ยอดฝากรายวัน</h2>
          <div className="flex flex-wrap gap-2">
            {customer.dailyActivities.map((d) => (
              <div
                key={d.id}
                className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-zinc-200"
              >
                <span className="text-zinc-500">{dateFmt(d.date)}</span>{" "}
                {d.loggedIn && <span className="text-green-600">●</span>}{" "}
                <span className="font-medium">฿{baht(d.deposit)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}