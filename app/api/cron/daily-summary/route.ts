import { checkCron } from "@/app/lib/cron";
import { prisma } from "@/app/lib/prisma";
import { getBrandStats, sumStats } from "@/app/lib/queries";
import { bangkokDayRange } from "@/app/lib/dates";
import { getSettings, sendTelegram, baht } from "@/app/lib/notify";

export const dynamic = "force-dynamic";

// สรุปวันนี้ → กลุ่มทีม (ตั้ง cron 20:00 ทุกวัน)
export async function GET(request: Request) {
  if (!checkCron(request)) return new Response("Unauthorized", { status: 401 });
  const range = bangkokDayRange(0);

  const [total, dncToday, callsByAgent, users, s] = await Promise.all([
    getBrandStats(range).then(sumStats),
    // ลูกค้าที่ถูกตั้งห้ามโทรวันนี้ (สัญญาณ churn)
    prisma.statusChangeLog.count({
      where: { toStatus: "do_not_call", createdAt: { gte: range.from, lte: range.to } },
    }),
    // พนักงานที่โทรเยอะสุดวันนี้
    prisma.followUp.groupBy({
      by: ["agentId"],
      where: { callDate: { gte: range.from, lte: range.to }, agentId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { agentId: "desc" } },
      take: 1,
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
    getSettings(),
  ]);

  const goal = Number(s.daily_deposit_goal) || 0;
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const top = callsByAgent[0];
  const topLine = top
    ? `🏆 โทรเยอะสุด: ${nameById.get(top.agentId!) ?? "ไม่ระบุ"} (${top._count._all} สาย)\n`
    : "";

  const text =
    `📊 <b>สรุปผลวันนี้</b>\n` +
    `โทรติดตาม: <b>${total.calls}</b>\n` +
    `รับสาย: ${total.answered} (${(total.answeredPct * 100).toFixed(1)}%)\n` +
    `🎯 กลับมาฝาก: ${total.returnedCustomers} คน · ฿${baht(total.totalDeposit)}` +
    (goal > 0 ? ` (เป้า ฿${baht(goal)} ${total.totalDeposit >= goal ? "✅" : "⏳"})` : "") +
    `\n` +
    `🎁 โบนัสที่เติม: ฿${baht(total.totalBonus)}\n` +
    topLine +
    `🚫 ตั้งห้ามโทรวันนี้: ${dncToday} ราย`;
  const r = await sendTelegram(s.team_chat_id, text);
  return Response.json({ ok: true, sent: r.ok, reason: r.reason });
}
