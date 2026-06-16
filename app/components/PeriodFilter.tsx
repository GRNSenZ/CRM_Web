"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Opt = { value: string; label: string };
type Mode = "day" | "week" | "month" | "range";

const TABS: { key: Mode; label: string }[] = [
  { key: "day", label: "รายวัน" },
  { key: "week", label: "รายสัปดาห์" },
  { key: "month", label: "รายเดือน" },
  { key: "range", label: "กำหนดเอง" },
];

const inputCls =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function PeriodFilter({
  mode,
  value,
  today,
  rangeFrom,
  rangeTo,
  options,
}: {
  mode: Mode;
  value: string;
  today: string;
  rangeFrom: string;
  rangeTo: string;
  options: { weeks: Opt[]; months: Opt[] };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function push(params: URLSearchParams) {
    params.delete("page"); // เปลี่ยนช่วงเวลา → กลับหน้าแรก
    router.push(`${pathname}?${params.toString()}`);
  }

  function goSingle(nextMode: Mode, nextValue: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("period", nextMode);
    params.set("value", nextValue);
    params.delete("from");
    params.delete("to");
    push(params);
  }

  function goRange(from: string, to: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("period", "range");
    params.set("from", from);
    params.set("to", to);
    params.delete("value");
    push(params);
  }

  function switchTab(next: Mode) {
    if (next === "day") goSingle("day", today);
    else if (next === "week") goSingle("week", options.weeks[0].value);
    else if (next === "month") goSingle("month", options.months[0].value);
    else goRange(rangeFrom, rangeTo);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg bg-zinc-100 p-0.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === t.key ? "bg-white text-indigo-700 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "day" && (
        <input
          type="date"
          value={value}
          max={today}
          onChange={(e) => e.target.value && goSingle("day", e.target.value)}
          className={inputCls}
        />
      )}

      {mode === "week" && (
        <select value={value} onChange={(e) => goSingle("week", e.target.value)} className={inputCls}>
          {options.weeks.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      {mode === "month" && (
        <select value={value} onChange={(e) => goSingle("month", e.target.value)} className={inputCls}>
          {options.months.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      {mode === "range" && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-500">
          <span>จาก</span>
          <input
            type="date"
            value={rangeFrom}
            max={rangeTo || today}
            onChange={(e) => e.target.value && goRange(e.target.value, rangeTo)}
            className={inputCls}
          />
          <span>ถึง</span>
          <input
            type="date"
            value={rangeTo}
            min={rangeFrom}
            max={today}
            onChange={(e) => e.target.value && goRange(rangeFrom, e.target.value)}
            className={inputCls}
          />
        </div>
      )}
    </div>
  );
}
