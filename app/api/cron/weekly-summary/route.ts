import { checkCron } from "@/app/lib/cron";
import { getBrandStats, sumStats } from "@/app/lib/queries";
import { bangkokDayRange } from "@/app/lib/dates";
import { getSettings, sendTelegram, baht } from "@/app/lib/notify";

export const dynamic = "force-dynamic";

// สรุปสัปดาห์ก่อน เทียบสัปดาห์ก่อนหน้า → กลุ่มหัวหน้า (จันทร์ 08:00)
export async function GET(request: Request) {
  if (!checkCron(request)) return new Response("Unauthorized", { status: 401 });

  const thisWeek = { from: bangkokDayRange(-7).from, to: bangkokDayRange(-1).to };
  const prevWeek = { from: bangkokDayRange(-14).from, to: bangkokDayRange(-8).to };
  const [a, b] = await Promise.all([
    getBrandStats(thisWeek).then(sumStats),
    getBrandStats(prevWeek).then(sumStats),
  ]);

  const diff = (now: number, before: number) => {
    if (!before) return now ? "▲ ใหม่" : "-";
    const p = ((now - before) / before) * 100;
    return `${p >= 0 ? "▲" : "▼"} ${Math.abs(p).toFixed(0)}%`;
  };

  const s = await getSettings();
  const text =
    `🗓️ <b>สรุปสัปดาห์ก่อน</b> (เทียบสัปดาห์ก่อนหน้า)\n` +
    `โทร: ${a.calls} (${diff(a.calls, b.calls)})\n` +
    `รับสาย: ${a.answered} (${diff(a.answered, b.answered)})\n` +
    `ยอดฝาก: ฿${baht(a.totalDeposit)} (${diff(a.totalDeposit, b.totalDeposit)})\n` +
    `โบนัส: ฿${baht(a.totalBonus)}`;
  const r = await sendTelegram(s.boss_chat_id, text);
  return Response.json({ ok: true, sent: r.ok, reason: r.reason });
}
