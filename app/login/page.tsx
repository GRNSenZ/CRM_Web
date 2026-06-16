"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";

const initial: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initial);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0c1428] via-[#13213f] to-[#0c1428] px-4">
      <div className="w-full max-w-sm rounded-2xl border-t-2 border-amber-400/60 bg-white p-8 shadow-2xl ring-1 ring-amber-400/10">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#13213f] to-[#22386a] text-xl text-amber-300 shadow-md ring-1 ring-amber-400/30">
            ✦
          </div>
          <h1 className="text-xl font-bold text-[#13213f]">CRM ติดตามลูกค้า</h1>
          <p className="mt-1 text-sm text-zinc-500">ลูกค้าขาดฝาก</p>
        </div>
        <form action={formAction} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">ชื่อผู้ใช้</label>
            <input
              name="username"
              autoComplete="username"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">รหัสผ่าน</label>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="••••••••"
            />
          </div>
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-gradient-to-r from-[#13213f] to-[#22386a] py-2.5 text-sm font-semibold text-amber-200 ring-1 ring-amber-400/30 transition hover:from-[#1a2c50] hover:to-[#2a4170] disabled:opacity-50"
          >
            {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-600">
          ยังไม่มีบัญชี?{" "}
          <a href="/register" className="font-medium text-indigo-600 hover:underline">
            สมัครสมาชิก
          </a>
        </p>
        <p className="mt-2 text-center text-xs text-zinc-400">ทดลอง: admin / admin1234</p>
      </div>
    </div>
  );
}
