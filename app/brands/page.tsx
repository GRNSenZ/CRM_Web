export const dynamic = "force-dynamic";

import Link from "next/link";
import AppShell from "@/app/components/AppShell";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth";
import { canManageUsers } from "@/app/lib/roles";
import { num } from "@/app/lib/format";
import BrandsImport from "./BrandsImport";

export default async function BrandsPage() {
  const user = await requireUser();
  const canImport = canManageUsers(user.role);

  const brands = await prisma.brand.findMany({
    orderBy: { id: "asc" },
    include: { _count: { select: { customers: true } } },
  });

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-wide text-[#13213f]">เว็บ / แบรนด์</h1>
        <div className="mt-1 h-0.5 w-16 rounded-full bg-gradient-to-r from-amber-400 to-amber-200" />
        <p className="mt-2 text-sm text-zinc-500">เลือกเว็บเพื่อดูรายชื่อลูกค้าและบันทึกการติดตาม</p>
      </header>

      {canImport && <BrandsImport brands={brands.map((b) => ({ id: b.id, name: b.name }))} />}

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {brands.map((b) => (
          <Link
            key={b.id}
            href={`/brands/${b.id}`}
            className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:ring-amber-300"
          >
            {/* แถบทองด้านบน */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#13213f] via-amber-400 to-[#13213f]" />
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#13213f] to-[#24386a] text-xl text-amber-300 shadow-md ring-1 ring-amber-400/20">
                🌐
              </div>
              <span className="text-lg text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-amber-500">
                →
              </span>
            </div>
            <h2 className="mt-4 text-lg font-bold text-[#13213f]">{b.name}</h2>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-zinc-500">
              <span className="font-semibold text-amber-600">{num(b._count.customers)}</span> ลูกค้า
            </p>
          </Link>
        ))}
        {brands.length === 0 && (
          <p className="col-span-full rounded-2xl bg-white px-6 py-10 text-center text-sm text-zinc-400 ring-1 ring-zinc-200">
            ยังไม่มีเว็บ/แบรนด์
          </p>
        )}
      </div>
    </AppShell>
  );
}
