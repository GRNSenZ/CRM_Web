"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  startSignup,
  verifyPhone,
  resendPhoneOtp,
  setSignupPassword,
  sendEmailCode,
  verifyEmailAndFinish,
  type StepResult,
} from "@/app/actions/register";

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const btnCls =
  "w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50";

const STEPS = ["บัญชี", "ยืนยันเบอร์", "ตั้งรหัสผ่าน", "อีเมล", "ยืนยันอีเมล"];

export default function RegisterWizard() {
  const [step, setStep] = useState(1); // 1..5, 6 = done
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>("");
  const [devCode, setDevCode] = useState<string>("");

  // ฟิลด์
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [finishedUser, setFinishedUser] = useState("");

  function run(fn: () => Promise<StepResult>, onOk: (r: StepResult) => void) {
    setError("");
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error ?? "เกิดข้อผิดพลาด");
        return;
      }
      if (r.devCode) setDevCode(r.devCode);
      onOk(r);
    });
  }

  // ---- ปุ่มต่อขั้นตอน ----
  const submitAccount = () =>
    run(
      () => startSignup({ username, phone }),
      () => setStep(2),
    );

  const submitPhoneOtp = () =>
    run(
      () => verifyPhone({ code: phoneOtp }),
      () => {
        setDevCode("");
        setStep(3);
      },
    );

  const submitPassword = () =>
    run(
      () => setSignupPassword({ password, confirm }),
      () => setStep(4),
    );

  const submitEmail = () =>
    run(
      () => sendEmailCode({ email }),
      () => setStep(5),
    );

  const submitEmailOtp = () =>
    run(
      () => verifyEmailAndFinish({ code: emailOtp }),
      (r) => {
        setFinishedUser(r.username ?? username);
        setDevCode("");
        setStep(6);
      },
    );

  const resend = () => run(resendPhoneOtp, () => {});

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold text-zinc-900">สมัครสมาชิก</h1>
        <p className="mt-1 text-sm text-zinc-500">CRM ติดตามลูกค้า</p>
      </div>

      {step <= 5 && (
        <ol className="mb-6 flex items-center justify-between text-[11px]">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = n === step;
            const done = n < step;
            return (
              <li key={label} className="flex flex-1 flex-col items-center gap-1">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    done
                      ? "bg-green-500 text-white"
                      : active
                        ? "bg-indigo-600 text-white"
                        : "bg-zinc-200 text-zinc-500"
                  }`}
                >
                  {done ? "✓" : n}
                </span>
                <span className={active ? "text-indigo-600" : "text-zinc-400"}>{label}</span>
              </li>
            );
          })}
        </ol>
      )}

      {devCode && step <= 5 && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          🔑 รหัสทดสอบ (โหมดยังไม่ส่งจริง): <b className="tracking-widest">{devCode}</b>
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* ขั้น 1 */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">ชื่อผู้ใช้</label>
            <input
              className={inputCls}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="a-z, 0-9, _ (3–20 ตัว)"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">เบอร์โทร</label>
            <input
              className={inputCls}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08x-xxx-xxxx"
              inputMode="tel"
            />
          </div>
          <button className={btnCls} disabled={pending} onClick={submitAccount}>
            {pending ? "กำลังส่งรหัส..." : "ถัดไป — รับรหัส OTP"}
          </button>
        </div>
      )}

      {/* ขั้น 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">
            ใส่รหัส OTP 6 หลักที่ส่งไปยังเบอร์ <b>{phone}</b>
          </p>
          <input
            className={`${inputCls} text-center text-lg tracking-[0.5em]`}
            value={phoneOtp}
            onChange={(e) => setPhoneOtp(e.target.value)}
            placeholder="------"
            inputMode="numeric"
            maxLength={6}
          />
          <button className={btnCls} disabled={pending} onClick={submitPhoneOtp}>
            {pending ? "กำลังตรวจสอบ..." : "ยืนยันเบอร์โทร"}
          </button>
          <button
            className="w-full text-center text-xs text-indigo-600 hover:underline"
            disabled={pending}
            onClick={resend}
          >
            ส่งรหัสใหม่อีกครั้ง
          </button>
        </div>
      )}

      {/* ขั้น 3 */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">ตั้งรหัสผ่าน</label>
            <input
              type="password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="อย่างน้อย 6 ตัวอักษร"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">ยืนยันรหัสผ่าน</label>
            <input
              type="password"
              className={inputCls}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
          <button className={btnCls} disabled={pending} onClick={submitPassword}>
            {pending ? "กำลังบันทึก..." : "ถัดไป"}
          </button>
        </div>
      )}

      {/* ขั้น 4 */}
      {step === 4 && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">อีเมล</label>
            <input
              type="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="off"
            />
          </div>
          <button className={btnCls} disabled={pending} onClick={submitEmail}>
            {pending ? "กำลังส่งรหัส..." : "ถัดไป — รับรหัสยืนยันอีเมล"}
          </button>
        </div>
      )}

      {/* ขั้น 5 */}
      {step === 5 && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">
            ใส่รหัสยืนยันที่ส่งไปยังอีเมล <b>{email}</b>
          </p>
          <input
            className={`${inputCls} text-center text-lg tracking-[0.5em]`}
            value={emailOtp}
            onChange={(e) => setEmailOtp(e.target.value)}
            placeholder="------"
            inputMode="numeric"
            maxLength={6}
          />
          <button className={btnCls} disabled={pending} onClick={submitEmailOtp}>
            {pending ? "กำลังสร้างบัญชี..." : "ยืนยันอีเมลและสมัครให้เสร็จ"}
          </button>
        </div>
      )}

      {/* เสร็จสิ้น */}
      {step === 6 && (
        <div className="space-y-4 text-center">
          <div className="text-5xl">🎉</div>
          <h2 className="text-lg font-bold text-zinc-900">สมัครสมาชิกสำเร็จ!</h2>
          <p className="text-sm text-zinc-600">
            บัญชี <b>{finishedUser}</b> ถูกสร้างแล้ว (บทบาท: Member)
            <br />
            เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่านที่ตั้งไว้ได้เลย
          </p>
          <Link href="/login" className={`${btnCls} block`}>
            ไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      )}

      {step <= 5 && (
        <p className="mt-6 text-center text-xs text-zinc-400">
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/login" className="text-indigo-600 hover:underline">
            เข้าสู่ระบบ
          </Link>
        </p>
      )}
    </div>
  );
}
