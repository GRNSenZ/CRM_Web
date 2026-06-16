"use client";

import { useActionState } from "react";
import { changeCustomerStatus, type StatusState } from "@/app/actions/crm";
import ConfirmButton from "./ConfirmButton";

const input =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500";
const initial: StatusState = {};

export default function StatusForm({
  customerId,
  currentStatus,
}: {
  customerId: number;
  currentStatus: string;
}) {
  const [state, action] = useActionState(changeCustomerStatus, initial);
  const isDnc = currentStatus === "do_not_call";
  const target = isDnc ? "active" : "do_not_call";

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="status" value={target} />

      {!isDnc && (
        <textarea
          name="reason"
          rows={2}
          placeholder="เหตุผลที่ตั้งห้ามโทร (บังคับกรอก)"
          className={input}
        />
      )}

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.success}</p>
      )}

      <ConfirmButton
        tone={isDnc ? "green" : "red"}
        title={isDnc ? "ยืนยันปลดห้ามโทร" : "ยืนยันตั้งห้ามโทร"}
        message={
          isDnc
            ? "ลูกค้ารายนี้จะกลับเป็นสถานะปกติ และโทรติดตามได้อีกครั้ง"
            : "ลูกค้ารายนี้จะถูกตั้งเป็นห้ามโทร นำออกจากคิว และล้างนัดที่ค้างอยู่"
        }
        className={`w-full rounded-lg py-2 text-sm font-semibold text-white transition ${
          isDnc ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
        }`}
      >
        {isDnc ? "✅ ปลดห้ามโทร (กลับเป็นปกติ)" : "🚫 ตั้งเป็นห้ามโทร"}
      </ConfirmButton>
    </form>
  );
}
