export const dynamic = "force-dynamic";

import AppShell from "@/app/components/AppShell";
import { requireManager } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { creatableRoles, roleLabel } from "@/app/lib/roles";
import { dateFmt, phoneFmt } from "@/app/lib/format";
import { toggleUserActive } from "@/app/actions/users";
import CreateUserForm from "./CreateUserForm";

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  partner: "bg-blue-100 text-blue-700",
  head: "bg-indigo-100 text-indigo-700",
  admin: "bg-teal-100 text-teal-700",
  member: "bg-zinc-100 text-zinc-600",
};

export default async function UsersAdminPage() {
  const me = await requireManager();
  const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
  const roleOptions = creatableRoles(me.role).map((r) => ({ value: r, label: roleLabel(r) }));

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">จัดการผู้ใช้</h1>
        <p className="text-sm text-zinc-500">
          สร้างบัญชีให้ทีมงาน — คุณ ({roleLabel(me.role)}) สร้างได้เฉพาะบทบาทที่ต่ำกว่าตัวเอง
        </p>
      </header>

      {/* ฟอร์มสร้างผู้ใช้ */}
      <div className="mb-8 max-w-3xl rounded-2xl bg-white p-6 ring-1 ring-zinc-200">
        <h2 className="mb-4 text-sm font-semibold uppercase text-zinc-400">สร้างบัญชีใหม่</h2>
        {roleOptions.length > 0 ? (
          <CreateUserForm roleOptions={roleOptions} />
        ) : (
          <p className="text-sm text-zinc-500">บทบาทของคุณไม่สามารถสร้างบัญชีผู้ใช้ได้</p>
        )}
      </div>

      {/* รายชื่อผู้ใช้ */}
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-semibold">ชื่อผู้ใช้</th>
              <th className="px-4 py-3 font-semibold">ชื่อแสดง</th>
              <th className="px-4 py-3 font-semibold">บทบาท</th>
              <th className="px-4 py-3 font-semibold">เบอร์โทร</th>
              <th className="px-4 py-3 font-semibold">อีเมล</th>
              <th className="px-4 py-3 font-semibold">สถานะ</th>
              <th className="px-4 py-3 font-semibold">สร้างเมื่อ</th>
              <th className="px-4 py-3 text-right font-semibold">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {users.map((u) => {
              const canManageThis = me.userId !== u.id && roleOptions.some((r) => r.value === u.role);
              return (
                <tr key={u.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">{u.username}</td>
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        ROLE_BADGE[u.role] ?? "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{u.phone ? phoneFmt(u.phone) : "-"}</td>
                  <td className="px-4 py-3 text-zinc-600">{u.email ?? "-"}</td>
                  <td className="px-4 py-3">
                    {u.active ? (
                      <span className="text-green-600">ใช้งาน</span>
                    ) : (
                      <span className="text-red-500">ปิดใช้งาน</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{dateFmt(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {canManageThis ? (
                      <form action={toggleUserActive}>
                        <input type="hidden" name="userId" value={u.id} />
                        <button className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200">
                          {u.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-zinc-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
