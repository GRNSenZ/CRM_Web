"use client";

import { useState } from "react";
import Link from "next/link";
import { saveSmsTemplate } from "@/app/actions/sms";
import { renderTemplate, DEFAULT_PROMO, SMS_VARS } from "@/app/lib/sms";

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function TemplateEditor({
  editing,
}: {
  editing?: { id: number; name: string; body: string } | null;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [body, setBody] = useState(editing?.body ?? "");

  // ตัวอย่างการแทนค่า (ลูกค้าสมมุติ)
  const preview = renderTemplate(body, {
    web: "มรกต",
    phone: "0891234567",
    promo: DEFAULT_PROMO,
  });

  return (
    <form action={saveSmsTemplate} className="grid gap-4 lg:grid-cols-2">
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">ชื่อ template</label>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น ทวงรัก + โปร 20%"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">เนื้อความ</label>
          <textarea
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="สวัสดีค่ะ ลูกค้า {{เว็บ}} รับ {{โปร}} วันนี้"
            className={inputCls}
          />
          <p className="mt-1 text-xs text-zinc-400">
            ตัวแปรที่ใช้ได้: {SMS_VARS.map((v) => `{{${v}}}`).join(" · ")}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            {editing ? "อัปเดต" : "เพิ่ม template"}
          </button>
          {editing && (
            <Link
              href="/admin/sms-templates"
              className="rounded-lg border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
            >
              ยกเลิก
            </Link>
          )}
        </div>
      </div>

      {/* ตัวอย่างผลลัพธ์สด */}
      <div>
        <p className="mb-1 text-sm font-medium text-zinc-700">ตัวอย่าง (ลูกค้าเว็บมรกต)</p>
        <div className="min-h-[120px] whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-sm text-zinc-800 ring-1 ring-zinc-200">
          {preview || <span className="text-zinc-400">— พิมพ์เนื้อความเพื่อดูตัวอย่าง —</span>}
        </div>
      </div>
    </form>
  );
}
