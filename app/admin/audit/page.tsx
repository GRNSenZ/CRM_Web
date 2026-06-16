export const dynamic = "force-dynamic";

import Link from "next/link";
import AppShell from "@/app/components/AppShell";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { requireManager } from "@/app/lib/auth";
import { actionLabel, ACTION_LABEL } from "@/app/lib/audit";
import { dateTimeFmt } from "@/app/lib/format";

const PAGE_SIZE = 50;
const inputCls =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500";

function parseJson(s: string | null): Record<string, unknown> | null {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** แสดงเฉพาะ field ที่เปลี่ยน อ่านง่าย: field: ค่าเดิม → ค่าใหม่ */
function diffLines(beforeRaw: string | null, afterRaw: string | null): string[] {
  const before = parseJson(beforeRaw);
  const after = parseJson(afterRaw);
  if (!before && !after) return ["—"];
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "-" : String(v));
  return [...keys].map((k) => {
    const b = before?.[k];
    const a = after?.[k];
    if (before && after && k in before) return `${k}: ${fmt(b)} → ${fmt(a)}`;
    return `${k}: ${fmt(a ?? b)}`;
  });
}

export default async function AuditPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();
  const sp = await props.searchParams;

  const userFilter = typeof sp.user === "string" ? sp.user : "";
  const actionFilter = typeof sp.action === "string" ? sp.action : "";
  const fromStr = typeof sp.from === "string" ? sp.from : "";
  const toStr = typeof sp.to === "string" ? sp.to : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.AuditLogWhereInput = {};
  if (userFilter) where.userId = Number(userFilter);
  if (actionFilter) where.action = actionFilter;
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromStr) || /^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
    where.createdAt = {
      ...(/^\d{4}-\d{2}-\d{2}$/.test(fromStr) ? { gte: new Date(`${fromStr}T00:00:00+07:00`) } : {}),
      ...(/^\d{4}-\d{2}-\d{2}$/.test(toStr) ? { lte: new Date(`${toStr}T23:59:59.999+07:00`) } : {}),
    };
  }

  const [total, logs, users] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true } } },
    }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { id: "asc" } }),
  ]);
  const pages = Math.ceil(total / PAGE_SIZE);

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    if (userFilter) p.set("user", userFilter);
    if (actionFilter) p.set("action", actionFilter);
    if (fromStr) p.set("from", fromStr);
    if (toStr) p.set("to", toStr);
    for (const [k, v] of Object.entries(over)) (v ? p.set(k, v) : p.delete(k));
    return p.toString();
  };

  return (
    <AppShell>
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-zinc-900">Audit Log</h1>
        <p className="text-sm text-zinc-500">
          บันทึกการแก้ไขข้อมูลสำคัญ — ทั้งหมด {total.toLocaleString("th-TH")} รายการ
        </p>
      </header>

      <form className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">ผู้ทำ</label>
          <select name="user" defaultValue={userFilter} className={inputCls}>
            <option value="">ทุกคน</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">ประเภท</label>
          <select name="action" defaultValue={actionFilter} className={inputCls}>
            <option value="">ทุกประเภท</option>
            {Object.keys(ACTION_LABEL).map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">ตั้งแต่</label>
          <input type="date" name="from" defaultValue={fromStr} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">ถึง</label>
          <input type="date" name="to" defaultValue={toStr} className={inputCls} />
        </div>
        <button className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          กรอง
        </button>
        {(userFilter || actionFilter || fromStr || toStr) && (
          <Link href="/admin/audit" className="px-2 py-2 text-sm text-zinc-500 hover:underline">
            ล้าง
          </Link>
        )}
      </form>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-semibold">เวลา</th>
              <th className="px-4 py-3 font-semibold">ผู้ทำ</th>
              <th className="px-4 py-3 font-semibold">การกระทำ</th>
              <th className="px-4 py-3 font-semibold">รายการ</th>
              <th className="px-4 py-3 font-semibold">การเปลี่ยนแปลง</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {logs.map((l) => (
              <tr key={l.id} className="align-top hover:bg-zinc-50">
                <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{dateTimeFmt(l.createdAt)}</td>
                <td className="px-4 py-3">{l.user?.name ?? "ระบบ"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    {actionLabel(l.action)}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {l.entity === "Customer" ? (
                    <Link href={`/customers/${l.entityId}`} className="text-indigo-600 hover:underline">
                      ลูกค้า #{l.entityId}
                    </Link>
                  ) : l.entity === "Import" ? (
                    "นำเข้า"
                  ) : (
                    `${l.entity} #${l.entityId}`
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {diffLines(l.before, l.after).map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-400">
                  ยังไม่มีบันทึก
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
              href={`/admin/audit?${qs({ page: String(page - 1) })}`}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-50"
            >
              ← ก่อนหน้า
            </Link>
          )}
          <span className="text-zinc-500">หน้า {page} / {pages}</span>
          {page < pages && (
            <Link
              href={`/admin/audit?${qs({ page: String(page + 1) })}`}
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
