export const dynamic = "force-dynamic";

import AppShell from "@/app/components/AppShell";
import { requireUser } from "@/app/lib/auth";
import { roleLabel } from "@/app/lib/roles";
import PasswordForm from "./PasswordForm";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">โปรไฟล์ของฉัน</h1>
        <p className="text-sm text-zinc-500">ข้อมูลบัญชีและการเปลี่ยนรหัสผ่าน</p>
      </header>

      <div className="grid max-w-3xl gap-6 lg:grid-cols-2">
        {/* ข้อมูลผู้ใช้ */}
        <div className="rounded-2xl bg-white p-6 ring-1 ring-zinc-200">
          <h2 className="mb-4 text-sm font-semibold uppercase text-zinc-400">ข้อมูลบัญชี</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">ชื่อแสดง</dt>
              <dd className="font-medium text-zinc-900">{user.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">ชื่อผู้ใช้</dt>
              <dd className="font-medium text-zinc-900">{user.username}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">บทบาท</dt>
              <dd className="font-medium text-zinc-900">{roleLabel(user.role)}</dd>
            </div>
          </dl>
        </div>

        {/* ฟอร์มเปลี่ยนรหัสผ่าน */}
        <div className="rounded-2xl bg-white p-6 ring-1 ring-zinc-200">
          <h2 className="mb-4 text-sm font-semibold uppercase text-zinc-400">เปลี่ยนรหัสผ่าน</h2>
          <PasswordForm />
        </div>
      </div>
    </AppShell>
  );
}
