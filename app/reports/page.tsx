import { redirect } from "next/navigation";

// ยุบหน้ารายงานเข้ากับหน้า "รายงานสรุปผล" (/summary) — คงลิงก์เดิมไว้ไม่ให้พัง
export default function ReportsRedirect() {
  redirect("/summary");
}
