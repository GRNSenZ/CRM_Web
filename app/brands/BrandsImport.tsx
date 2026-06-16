"use client";

import { useState } from "react";

type Summary = {
  sheets: number;
  brandsCreated: number;
  customersCreated: number;
  followUpsAdded: number;
  dailyUpserted: number;
  bonusesAdded: number;
  dncSkipped: number;
  rows: number;
  perBrand: { brand: string; rows: number; customers: number }[];
};

type Preview = {
  sheets: number;
  rows: number;
  newCustomers: number;
  perBrand: {
    brand: string;
    brandExists: boolean;
    rows: number;
    phones: number;
    newCustomers: number;
    existingCustomers: number;
    followUpRows: number;
    bonusRows: number;
  }[];
};

export type ImportHistory = {
  id: number;
  userName: string;
  source: string;
  fileName: string | null;
  targetBrand: string | null;
  customersCreated: number;
  followUpsAdded: number;
  rows: number;
  createdAt: string;
};

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function BrandsImport({
  brands,
  history,
}: {
  brands: { id: number; name: string }[];
  history: ImportHistory[];
}) {
  const [open, setOpen] = useState(false);
  const [brandId, setBrandId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Summary | null>(null);
  const [drag, setDrag] = useState(false);
  // โหมดดูตัวอย่างก่อนยืนยัน
  const [pending, setPending] = useState<null | "file" | "url">(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const targetName = brandId ? brands.find((b) => String(b.id) === brandId)?.name : null;

  // ยิงไป /api/import — preview=true จะ parse อย่างเดียวไม่เขียน DB
  async function callImport(mode: "file" | "url", isPreview: boolean) {
    if (mode === "file") {
      const fd = new FormData();
      fd.append("file", file!);
      if (brandId) fd.append("brandId", brandId);
      if (isPreview) fd.append("preview", "1");
      return fetch("/api/import", { method: "POST", body: fd });
    }
    return fetch("/api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        googleSheetUrl: sheetUrl.trim(),
        brandId: brandId || undefined,
        preview: isPreview ? "1" : undefined,
      }),
    });
  }

  async function requestPreview(mode: "file" | "url") {
    setBusy(true);
    setError("");
    setResult(null);
    setPreview(null);
    try {
      const res = await callImport(mode, true);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "อ่านไฟล์ไม่สำเร็จ");
        return;
      }
      setPreview(data.preview);
      setPending(mode); // เปิด modal ตัวอย่าง
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    const mode = pending!;
    setPending(null);
    setBusy(true);
    setError("");
    try {
      const res = await callImport(mode, false);
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "นำเข้าไม่สำเร็จ");
      else setResult(data.summary);
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ");
    } finally {
      setBusy(false);
      setPreview(null);
    }
  }

  return (
    <div className="mb-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200/70">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-zinc-50"
      >
        <span className="flex items-center gap-2 font-semibold text-[#13213f]">
          📥 นำเข้า / อัปเดตข้อมูล
          <span className="text-xs font-normal text-zinc-400">เพิ่ม/อัปเดตข้อมูลโดยไม่ลบของเดิม</span>
        </span>
        <span className={`text-zinc-400 transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-zinc-100 p-5">
          {/* เลือกเว็บปลายทาง */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">อัปโหลดลงเว็บ</label>
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inputCls}>
              <option value="">🔄 อัตโนมัติ (ตามชื่อชีตในไฟล์)</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-400">
              เลือกเว็บ = บังคับให้ข้อมูลทุกชีตในไฟล์เข้าเว็บนั้น · อัตโนมัติ = แยกตามชื่อชีต
            </p>
          </div>

          {/* อัปโหลดไฟล์ */}
          <div>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) setFile(f);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
                drag ? "border-indigo-500 bg-indigo-50" : "border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <span className="text-2xl">⬆️</span>
              <span className="mt-2 text-sm text-zinc-600">
                {file ? <b className="text-indigo-700">{file.name}</b> : "ลากไฟล์ Excel (.xlsx) มาวาง หรือคลิกเลือก"}
              </span>
            </label>
            <button
              onClick={() => requestPreview("file")}
              disabled={!file || busy}
              className="mt-3 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? "กำลังอ่านไฟล์..." : "ดูตัวอย่างก่อนนำเข้า"}
            </button>
          </div>

          {/* Google Sheet */}
          <div className="border-t border-zinc-100 pt-4">
            <label className="mb-1 block text-sm font-medium text-zinc-700">🔗 หรือจากลิงก์ Google Sheet</label>
            <div className="flex gap-2">
              <input
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className={inputCls}
              />
              <button
                onClick={() => requestPreview("url")}
                disabled={!sheetUrl.trim() || busy}
                className="shrink-0 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? "กำลังดึง..." : "ดูตัวอย่าง"}
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-400">ตั้งสิทธิ์ Google Sheet ให้ &ldquo;ผู้ที่มีลิงก์&rdquo; ดูได้ก่อน</p>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

          {result && (
            <div className="rounded-2xl bg-green-50 p-5 ring-1 ring-green-200">
              <h3 className="mb-3 font-semibold text-green-800">✅ นำเข้าสำเร็จ</h3>
              <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <Stat label="ชีตที่อ่าน" value={result.sheets} />
                <Stat label="แถวที่ประมวลผล" value={result.rows} />
                <Stat label="ลูกค้าใหม่" value={result.customersCreated} />
                <Stat label="บันทึกโทรเพิ่ม" value={result.followUpsAdded} />
                <Stat label="โบนัสเพิ่ม" value={result.bonusesAdded} />
                <Stat label="ยอดฝาก (อัปเดต)" value={result.dailyUpserted} />
                <Stat label="เว็บใหม่" value={result.brandsCreated} />
                <Stat label="ข้าม(ห้ามโทร)" value={result.dncSkipped} />
              </div>
              <p className="text-xs text-zinc-500">รีเฟรชหน้าเพื่อดูจำนวนลูกค้าที่อัปเดต</p>
            </div>
          )}

          {/* ประวัติการนำเข้า */}
          {history.length > 0 && (
            <div className="border-t border-zinc-100 pt-4">
              <h3 className="mb-2 text-sm font-semibold text-zinc-700">🕘 ประวัติการนำเข้าล่าสุด</h3>
              <div className="overflow-x-auto rounded-lg ring-1 ring-zinc-100">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 text-left text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">เวลา</th>
                      <th className="px-3 py-2 font-semibold">โดย</th>
                      <th className="px-3 py-2 font-semibold">แหล่ง</th>
                      <th className="px-3 py-2 font-semibold">เว็บ</th>
                      <th className="px-3 py-2 text-right font-semibold">ลูกค้าใหม่</th>
                      <th className="px-3 py-2 text-right font-semibold">โทรเพิ่ม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-600">
                          {new Date(h.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="px-3 py-2">{h.userName}</td>
                        <td className="px-3 py-2">
                          {h.source === "gsheet" ? "🔗 Sheet" : "📂 " + (h.fileName ?? "ไฟล์")}
                        </td>
                        <td className="px-3 py-2">{h.targetBrand ?? "อัตโนมัติ"}</td>
                        <td className="px-3 py-2 text-right">{h.customersCreated.toLocaleString("th-TH")}</td>
                        <td className="px-3 py-2 text-right">{h.followUpsAdded.toLocaleString("th-TH")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ป๊อปอัพ "ดูตัวอย่าง" ก่อนนำเข้าจริง */}
      {pending && preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => !busy && setPending(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-2xl">👀</div>
            </div>
            <h3 className="text-center text-lg font-bold text-zinc-900">ตรวจสอบก่อนนำเข้า</h3>
            <p className="mt-1 text-center text-sm text-zinc-500">
              อัปโหลดลง <b className="text-indigo-700">{targetName ?? "อัตโนมัติ (ตามชื่อชีต)"}</b> ·{" "}
              {preview.sheets} ชีต · {preview.rows.toLocaleString("th-TH")} แถว ·{" "}
              <b className="text-green-700">ลูกค้าใหม่ {preview.newCustomers.toLocaleString("th-TH")}</b>
            </p>

            <div className="my-4 overflow-x-auto rounded-lg ring-1 ring-zinc-200">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 text-left text-zinc-500">
                  <tr>
                    <th className="px-2 py-2 font-semibold">เว็บ</th>
                    <th className="px-2 py-2 text-right font-semibold">แถว</th>
                    <th className="px-2 py-2 text-right font-semibold">ลูกค้าใหม่</th>
                    <th className="px-2 py-2 text-right font-semibold">มีอยู่แล้ว</th>
                    <th className="px-2 py-2 text-right font-semibold">โทร</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {preview.perBrand.map((b, i) => (
                    <tr key={i}>
                      <td className="px-2 py-2 font-medium">
                        {b.brand} {!b.brandExists && <span className="text-amber-600">(ใหม่)</span>}
                      </td>
                      <td className="px-2 py-2 text-right">{b.rows.toLocaleString("th-TH")}</td>
                      <td className="px-2 py-2 text-right font-semibold text-green-700">
                        +{b.newCustomers.toLocaleString("th-TH")}
                      </td>
                      <td className="px-2 py-2 text-right text-zinc-400">{b.existingCustomers.toLocaleString("th-TH")}</td>
                      <td className="px-2 py-2 text-right">{b.followUpRows.toLocaleString("th-TH")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mb-4 text-center text-xs text-zinc-400">ระบบจะเพิ่ม/อัปเดตข้อมูล โดยไม่ลบของเดิม</p>

            <div className="flex gap-3">
              <button
                onClick={() => setPending(null)}
                disabled={busy}
                className="flex-1 rounded-lg border border-zinc-300 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmImport}
                disabled={busy}
                className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? "กำลังนำเข้า..." : "ยืนยันนำเข้า"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-200">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-lg font-bold text-zinc-900">{value.toLocaleString("th-TH")}</p>
    </div>
  );
}
