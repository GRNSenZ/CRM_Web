import Link from "next/link";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth";
import { logout } from "@/app/actions/auth";
import { canManageUsers, roleLabel } from "@/app/lib/roles";

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const showUserAdmin = canManageUsers(user.role);

  const navLink =
    "block rounded-lg px-3 py-2 font-medium text-slate-300 transition hover:bg-white/5 hover:text-amber-200";

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col bg-gradient-to-b from-[#0f3a2a] via-[#0a2c20] to-[#06201a] text-slate-300 shadow-xl">
        <div className="border-b border-amber-400/15 px-5 py-5">
          <Link href="/" className="block">
            <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-lg font-bold tracking-wide text-transparent">
              ✦ CRM ติดตามลูกค้า
            </span>
            <p className="mt-0.5 text-xs text-slate-400">ลูกค้าขาดฝาก</p>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-3 text-sm">
          <Link href="/" className={navLink}>
            📊 ภาพรวม (Dashboard)
          </Link>
          <Link href="/summary" className={navLink}>
            📊 รายงานสรุปผล
          </Link>
          <Link href="/queue" className={navLink}>
            📞 คิวโทร
          </Link>
          <Link href="/customers" className={navLink}>
            🔎 ค้นหาลูกค้า
          </Link>
          <Link href="/brands" className={navLink}>
            🌐 เว็บ/แบรนด์
          </Link>
          {showUserAdmin && (
            <>
              <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-amber-400/60">
                ตั้งค่า
              </p>
              <Link href="/admin/users" className={navLink}>
                👥 จัดการผู้ใช้
              </Link>
              <Link href="/sms" className={navLink}>
                ✉️ ส่ง SMS
              </Link>
              <Link href="/admin/sms-templates" className={navLink}>
                💬 คลัง SMS
              </Link>
              <Link href="/admin/notifications" className={navLink}>
                🔔 แจ้งเตือน Telegram
              </Link>
              <Link href="/admin/audit" className={navLink}>
                📋 Audit Log
              </Link>
            </>
          )}
        </nav>
        <div className="border-t border-amber-400/15 px-4 py-3">
          <Link href="/profile" className="block rounded-lg px-1 py-1 hover:bg-white/5">
            <p className="text-sm font-medium text-amber-100">{user.name}</p>
            <p className="mb-2 text-xs text-slate-400">{roleLabel(user.role)} · ดูโปรไฟล์</p>
          </Link>
          <form action={logout}>
            <button className="w-full rounded-lg border border-amber-400/30 bg-white/5 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-400/10">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto px-8 py-6">{children}</main>
    </div>
  );
}
