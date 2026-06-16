export function baht(n: number): string {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n ?? 0);
}

export function num(n: number): string {
  return new Intl.NumberFormat("th-TH").format(n ?? 0);
}

export function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/** 870248821 / "870248821" -> 0870248821 */
export function phoneFmt(p: string): string {
  let s = p.replace(/\D/g, "");
  if (s.length === 9) s = "0" + s;
  if (s.length === 10) return `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6)}`;
  return p;
}

export function dateFmt(d: Date | string | null): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function dateTimeFmt(d: Date | string | null): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

export const STATUS_LABEL: Record<string, string> = {
  answered: "รับสาย",
  no_answer: "ไม่รับสาย",
  pending: "ยังไม่โทร",
};

export const CUSTOMER_STATUS_LABEL: Record<string, string> = {
  active: "ปกติ",
  do_not_call: "ห้ามโทร",
};
