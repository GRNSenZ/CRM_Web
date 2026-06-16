import { checkCron } from "@/app/lib/cron";
import { prisma } from "@/app/lib/prisma";
import { bangkokDayRange } from "@/app/lib/dates";
import { isStaff } from "@/app/lib/roles";
import { getSettings, sendTelegram } from "@/app/lib/notify";

export const dynamic = "force-dynamic";

// พนักงานที่โทรน้อยกว่าเกณฑ์วันนี้ → กลุ่มหัวหน้า (13:00)
export async function GET(request: Request) {
  if (!checkCron(request)) return new Response("Unauthorized", { status: 401 });

  const range = bangkokDayRange(0);
  const [grouped, users, s] = await Promise.all([
    prisma.followUp.groupBy({
      by: ["agentId"],
      where: { callDate: { gte: range.from, lte: range.to }, agentId: { not: null } },
      _count: { _all: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true, role: true } }),
    getSettings(),
  ]);

  const countByAgent = new Map(grouped.map((g) => [g.agentId, g._count._all]));
  const min = Number(s.min_calls_before_noon) || 30;
  const slow = users
    .filter((u) => isStaff(u.role))
    .map((u) => ({ name: u.name, calls: countByAgent.get(u.id) ?? 0 }))
    .filter((u) => u.calls < min);

  if (slow.length === 0) {
    return Response.json({ ok: true, sent: false, reason: "ทุกคนถึงเกณฑ์" });
  }

  const text =
    `🐢 <b>พนักงานโทรน้อยกว่าเกณฑ์</b> (ขั้นต่ำ ${min} สาย)\n` +
    slow.map((u) => `• ${u.name}: ${u.calls} สาย`).join("\n");
  const r = await sendTelegram(s.boss_chat_id, text);
  return Response.json({ ok: true, sent: r.ok, reason: r.reason });
}
