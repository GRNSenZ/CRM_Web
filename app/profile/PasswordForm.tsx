"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword, type ChangePwState } from "@/app/actions/profile";

const initial: ChangePwState = {};

export default function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // ล้างฟอร์มเมื่อเปลี่ยนรหัสสำเร็จ
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">รหัสผ่านเดิม</label>
        <input
          name="current"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          placeholder="••••••••"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">รหัสผ่านใหม่</label>
        <input
          name="next"
          type="password"
          autoComplete="new-password"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          placeholder="อย่างน้อย 6 ตัวอักษร"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">ยืนยันรหัสผ่านใหม่</label>
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          placeholder="••••••••"
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.success}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
      </button>
    </form>
  );
}
