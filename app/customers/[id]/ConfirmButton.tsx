"use client";

import { useRef, useState } from "react";

const TONE: Record<string, string> = {
  indigo: "bg-indigo-600 hover:bg-indigo-700",
  green: "bg-green-600 hover:bg-green-700",
  amber: "bg-amber-500 hover:bg-amber-600",
  red: "bg-red-600 hover:bg-red-700",
};

/** ปุ่ม submit ที่เด้ง modal ยืนยันกลางจอก่อน — กันกดโดนแล้วบันทึกทันที */
export default function ConfirmButton({
  children,
  className,
  title = "ยืนยันการบันทึก",
  message,
  tone = "indigo",
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  message: string;
  tone?: "indigo" | "green" | "amber" | "red";
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  function confirm() {
    setOpen(false);
    btnRef.current?.closest("form")?.requestSubmit();
  }

  return (
    <>
      <button ref={btnRef} type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-2xl">
                ❓
              </div>
            </div>
            <h3 className="text-center text-lg font-bold text-zinc-900">{title}</h3>
            <p className="mt-1 mb-6 text-center text-sm text-zinc-500">{message}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-zinc-300 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirm}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition ${TONE[tone]}`}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
