export const dynamic = "force-dynamic";

import AppShell from "@/app/components/AppShell";
import { prisma } from "@/app/lib/prisma";
import { requireManager } from "@/app/lib/auth";
import { isMockMode } from "@/app/lib/sms-provider";
import { dateTimeFmt } from "@/app/lib/format";
import SmsConsole from "./SmsConsole";

const SOURCE_LABEL: Record<string, string> = {
  single: "ทีละเบอร์",
  group: "ส่งกลุ่ม",
  file: "จากไฟล์",
};

export default async function SmsPage() {
  await requireManager();

  const [templates, batches] = await Promise.all([
    prisma.smsTemplate.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, body: true },
    }),
    prisma.smsBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { createdBy: { select: { name: true } } },
    }),
  ]);

  return (
    <AppShell>
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-zinc-900">ส่ง SMS</h1>
        <p className="text-sm text-zinc-500">
          ส่งทีละเบอร์ · ส่งกลุ่ม · อัปโหลดไฟล์รายชื่อเบอร์
        </p>
      </header>

      {isMockMode && (
        <p className="mb-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          ⚠️ <b>โหมดทดสอบ</b> — ยังไม่ได้เชื่อม SMS Gateway จริง ระบบจะบันทึกการส่งไว้แต่ยังไม่ส่งออกจริง
          (ตั้งค่า <code>SMS_GATEWAY_URL</code> + <code>SMS_GATEWAY_KEY</code> ใน .env เพื่อส่งจริง)
        </p>
      )}

      <SmsConsole templates={templates} />

      {/* ประวัติการส่ง */}
      <section className="mt-8">
        <h2 className="mb-3 font-semibold text-zinc-800">ประวัติการส่ง</h2>
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-semibold">เวลา</th>
                <th className="px-4 py-3 font-semibold">ผู้ส่ง</th>
                <th className="px-4 py-3 font-semibold">วิธี</th>
                <th className="px-4 py-3 font-semibold">ข้อความ</th>
                <th className="px-4 py-3 text-right font-semibold">จำนวน</th>
                <th className="px-4 py-3 text-right font-semibold">สำเร็จ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {batches.map((b) => (
                <tr key={b.id} className="align-top hover:bg-zinc-50">
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{dateTimeFmt(b.createdAt)}</td>
                  <td className="px-4 py-3">{b.createdBy?.name ?? "-"}</td>
                  <td className="px-4 py-3 text-zinc-500">{SOURCE_LABEL[b.source] ?? b.source}</td>
                  <td className="max-w-md px-4 py-3 text-zinc-600">{b.body}</td>
                  <td className="px-4 py-3 text-right">{b.total.toLocaleString("th-TH")}</td>
                  <td className="px-4 py-3 text-right text-green-600">{b.sentCount.toLocaleString("th-TH")}</td>
                </tr>
              ))}
              {batches.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-400">
                    ยังไม่มีประวัติการส่ง
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
