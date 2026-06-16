"use client";

import { useState } from "react";
import { extractPhones } from "@/app/lib/sms-client";

type Tpl = { id: number; name: string; body: string };
type Summary = { total: number; sent: number; failed: number; mock: boolean; source: string };

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function SmsConsole({ templates }: { templates: Tpl[] }) {
  const [message, setMessage] = useState("");
  const [phonesText, setPhonesText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Summary | null>(null);

  const typedCount = extractPhones(phonesText).length;

  async function send() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("message", message);
      fd.append("phones", phonesText);
      if (file) fd.append("file", file);
      const res = await fetch("/api/sms/send", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "ส่งไม่สำเร็จ");
      else {
        setResult(data.summary);
        setPhonesText("");
        setFile(null);
      }
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ข้อความ */}
      <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
        <h2 className="mb-3 font-semibold text-zinc-800">1) ข้อความที่จะส่ง</h2>
        {templates.length > 0 && (
          <select
            defaultValue=""
            onChange={(e) => {
              const t = templates.find((x) => String(x.id) === e.target.value);
              if (t) setMessage(t.body);
            }}
            className={`${inputCls} mb-2`}
          >
            <option value="">— เลือกจากคลัง SMS (หรือพิมพ์เอง) —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          placeholder="พิมพ์ข้อความ SMS ที่นี่ (ใช้ {{เบอร์}} เพื่อแทนเบอร์ผู้รับได้)"
          className={inputCls}
        />
        <p className="mt-1 text-xs text-zinc-400">{message.length} ตัวอักษร</p>
      </div>

      {/* ผู้รับ */}
      <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
        <h2 className="mb-3 font-semibold text-zinc-800">2) ส่งถึงใคร</h2>

        <label className="mb-1 block text-sm font-medium text-zinc-700">
          เบอร์โทร (ทีละเบอร์ หรือหลายเบอร์ — บรรทัดละเบอร์/คั่นด้วย ,)
        </label>
        <textarea
          value={phonesText}
          onChange={(e) => setPhonesText(e.target.value)}
          rows={4}
          placeholder={"0812345678\n0898765432, 0911112222"}
          className={inputCls}
        />
        {typedCount > 0 && (
          <p className="mt-1 text-xs text-green-600">พบ {typedCount} เบอร์ที่พิมพ์</p>
        )}

        <div className="my-3 text-center text-xs text-zinc-400">— หรือ —</div>

        <label className="mb-1 block text-sm font-medium text-zinc-700">
          อัปโหลดไฟล์เบอร์ (.csv / .txt / .xlsx)
        </label>
        <input
          type="file"
          accept=".csv,.txt,.xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700"
        />
        {file && <p className="mt-1 text-xs text-indigo-600">ไฟล์: {file.name}</p>}

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        {result && (
          <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            ✅ ส่งแล้ว {result.sent} เบอร์ {result.failed > 0 && `· ล้มเหลว ${result.failed}`}
            {result.mock && " (โหมดทดสอบ — ยังไม่ส่งออกจริง)"}
          </div>
        )}

        <button
          onClick={send}
          disabled={busy || !message.trim() || (typedCount === 0 && !file)}
          className="mt-4 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? "กำลังส่ง..." : "ส่ง SMS"}
        </button>
      </div>
    </div>
  );
}
