"use client";

import { useActionState, useEffect, useRef } from "react";
import { createStaffUser, type CreateUserState } from "@/app/actions/users";

const initial: CreateUserState = {};

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function CreateUserForm({
  roleOptions,
}: {
  roleOptions: { value: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(createStaffUser, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">ชื่อผู้ใช้ *</label>
        <input name="username" className={inputCls} placeholder="เช่น head01" autoComplete="off" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">ชื่อแสดง *</label>
        <input name="name" className={inputCls} placeholder="เช่น สมชาย" autoComplete="off" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">บทบาท *</label>
        <select name="role" className={inputCls} defaultValue="">
          <option value="" disabled>
            — เลือกบทบาท —
          </option>
          {roleOptions.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">รหัสผ่าน *</label>
        <input
          name="password"
          type="password"
          className={inputCls}
          placeholder="อย่างน้อย 6 ตัวอักษร"
          autoComplete="new-password"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">เบอร์โทร (ไม่บังคับ)</label>
        <input name="phone" className={inputCls} placeholder="08x-xxx-xxxx" autoComplete="off" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">อีเมล (ไม่บังคับ)</label>
        <input name="email" type="email" className={inputCls} placeholder="name@example.com" autoComplete="off" />
      </div>

      <div className="sm:col-span-2">
        {state.error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
        )}
        {state.success && (
          <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            {state.success}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {pending ? "กำลังสร้าง..." : "สร้างบัญชีผู้ใช้"}
        </button>
      </div>
    </form>
  );
}
