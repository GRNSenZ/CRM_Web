"use client";

import { useState, useTransition } from "react";
import { discoverChats } from "@/app/actions/notifications";
import type { TgChat } from "@/app/lib/notify";

// เติมค่า chat id ลงช่อง input ในฟอร์ม (อ้างด้วย id ของ input)
function fill(inputId: string, value: string) {
  const el = document.getElementById(inputId) as HTMLInputElement | null;
  if (el) {
    el.value = value;
    el.classList.add("ring-2", "ring-green-300");
    setTimeout(() => el.classList.remove("ring-2", "ring-green-300"), 1200);
  }
}

export default function ChatDiscovery() {
  const [chats, setChats] = useState<TgChat[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = () =>
    start(async () => {
      setError(null);
      const r = await discoverChats();
      if (!r.ok) {
        setError(r.reason ?? "ดึงข้อมูลไม่สำเร็จ");
        setChats(null);
      } else {
        setChats(r.chats);
        if (!r.chats.length) setError(r.reason ?? "ไม่พบแชท");
      }
    });

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase text-zinc-400">ดึง Chat ID อัตโนมัติ</h2>
        <button
          type="button"
          onClick={load}
          disabled={pending}
          className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
        >
          {pending ? "กำลังดึง…" : "🔄 ดึงรายชื่อกลุ่ม"}
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-400">
        เพิ่มบอทเข้ากลุ่ม แล้ว “พิมพ์ข้อความในกลุ่ม 1 ครั้ง” จากนั้นกดปุ่มนี้ — ระบบจะลิสต์กลุ่มที่บอทเห็นให้เลือกเติมเอง
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>
      )}

      {chats && chats.length > 0 && (
        <ul className="mt-3 divide-y divide-zinc-100 rounded-lg ring-1 ring-zinc-100">
          {chats.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-800">
                  {c.title} <span className="text-xs font-normal text-zinc-400">({c.type})</span>
                </p>
                <p className="font-mono text-xs text-zinc-500">{c.id}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => fill("team_chat_id", c.id)}
                  className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  → กลุ่มทีม
                </button>
                <button
                  type="button"
                  onClick={() => fill("boss_chat_id", c.id)}
                  className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  → กลุ่มหัวหน้า
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {chats && chats.length > 0 && (
        <p className="mt-2 text-xs text-zinc-400">เลือกแล้วอย่าลืมกด “บันทึกการตั้งค่า” ด้านล่าง</p>
      )}
    </div>
  );
}
