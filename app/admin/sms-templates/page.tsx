export const dynamic = "force-dynamic";

import AppShell from "@/app/components/AppShell";
import { prisma } from "@/app/lib/prisma";
import { requireManager } from "@/app/lib/auth";
import { toggleSmsTemplate, deleteSmsTemplate, moveSmsTemplate } from "@/app/actions/sms";
import TemplateEditor from "./TemplateEditor";

export default async function SmsTemplatesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();
  const sp = await props.searchParams;
  const editId = typeof sp.edit === "string" ? Number(sp.edit) : 0;

  const templates = await prisma.smsTemplate.findMany({ orderBy: { sortOrder: "asc" } });
  const editing = editId ? templates.find((t) => t.id === editId) : null;

  return (
    <AppShell>
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-zinc-900">คลังข้อความ SMS</h1>
        <p className="text-sm text-zinc-500">
          เทมเพลตกลางสำหรับส่ง SMS — พนักงานเลือกใช้และคัดลอกได้ในหน้าบันทึกผลสาย
        </p>
      </header>

      <div className="mb-6 rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
        <h2 className="mb-4 text-sm font-semibold uppercase text-zinc-400">
          {editing ? `แก้ไข: ${editing.name}` : "เพิ่ม template ใหม่"}
        </h2>
        <TemplateEditor editing={editing ?? null} />
      </div>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-semibold">ลำดับ</th>
              <th className="px-4 py-3 font-semibold">ชื่อ</th>
              <th className="px-4 py-3 font-semibold">เนื้อความ</th>
              <th className="px-4 py-3 font-semibold">สถานะ</th>
              <th className="px-4 py-3 text-right font-semibold">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {templates.map((t, i) => (
              <tr key={t.id} className="align-top hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <form action={moveSmsTemplate}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="dir" value="up" />
                      <button disabled={i === 0} className="text-zinc-400 hover:text-indigo-600 disabled:opacity-30">
                        ▲
                      </button>
                    </form>
                    <form action={moveSmsTemplate}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="dir" value="down" />
                      <button disabled={i === templates.length - 1} className="text-zinc-400 hover:text-indigo-600 disabled:opacity-30">
                        ▼
                      </button>
                    </form>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="max-w-md px-4 py-3 text-zinc-500">{t.body}</td>
                <td className="px-4 py-3">
                  {t.active ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      ใช้งาน
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                      ปิด
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <a href={`/admin/sms-templates?edit=${t.id}`} className="text-xs text-indigo-600 hover:underline">
                      แก้ไข
                    </a>
                    <form action={toggleSmsTemplate}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="rounded-lg bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200">
                        {t.active ? "ปิด" : "เปิด"}
                      </button>
                    </form>
                    <form action={deleteSmsTemplate}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">
                        ลบ
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-400">
                  ยังไม่มี template — เพิ่มอันแรกด้านบน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
