"use client";

import { useRef, useState } from "react";
import { renderTemplate, DEFAULT_PROMO } from "@/app/lib/sms";

type Tpl = { id: number; name: string; body: string };

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500";

export default function SmsSection({
  templates,
  web,
  phone,
}: {
  templates: Tpl[];
  web: string;
  phone: string;
}) {
  const [id, setId] = useState<number>(templates[0]?.id ?? 0);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  if (templates.length === 0) return null;

  const tpl = templates.find((t) => t.id === id) ?? templates[0];
  const text = renderTemplate(tpl.body, { web, phone, promo: DEFAULT_PROMO });

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard อาจถูกบล็อก — ไม่เป็นไร */
    }
    setCopied(true);
    // ติ๊ก checkbox "ส่ง SMS หลังโทร" ในฟอร์มเดียวกันให้อัตโนมัติ
    const form = rootRef.current?.closest("form");
    const cb = form?.querySelector<HTMLInputElement>('input[name="smsSent"]');
    if (cb) cb.checked = true;
  }

  return (
    <div ref={rootRef} className="rounded-lg bg-zinc-50 p-3 ring-1 ring-zinc-200">
      <p className="mb-2 text-xs font-medium text-zinc-500">💬 ส่ง SMS</p>
      {/* บันทึกว่าใช้ template ไหน */}
      <input type="hidden" name="smsTemplateId" value={copied ? id : ""} />
      <select
        value={id}
        onChange={(e) => {
          setId(Number(e.target.value));
          setCopied(false);
        }}
        className={inputCls}
      >
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-2.5 text-sm text-zinc-700 ring-1 ring-zinc-200">
        {text}
      </div>
      <button
        type="button"
        onClick={copy}
        className={`mt-2 w-full rounded-lg py-1.5 text-sm font-medium transition ${
          copied ? "bg-green-100 text-green-700" : "bg-indigo-600 text-white hover:bg-indigo-700"
        }`}
      >
        {copied ? "✓ คัดลอกแล้ว (ติ๊กส่ง SMS ให้แล้ว)" : "คัดลอกข้อความ"}
      </button>
    </div>
  );
}
