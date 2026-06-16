import { checkCron } from "@/app/lib/cron";
import { prisma } from "@/app/lib/prisma";
import { endOfTodayBangkok, bangkokDayRange } from "@/app/lib/dates";
import { getSettings, sendTelegram } from "@/app/lib/notify";

export const dynamic = "force-dynamic";

// คิวรอโทร + นัดถึงกำหนดวันนี้ + นัดเกินกำหนด → กลุ่มทีม (09:00)
export async function GET(request: Request) {
  if (!checkCron(request)) return new Response("Unauthorized", { status: 401 });

  const endToday = endOfTodayBangkok();
  const startToday = bangkokDayRange(0).from;
  const [queueCount, dueCount, overdueCount] = await Promise.all([
    prisma.customer.count({ where: { status: "active" } }),
    // นัดถึงกำหนดวันนี้ (ตั้งแต่ต้นวันถึงสิ้นวัน)
    prisma.customer.count({
      where: { status: "active", nextCallAt: { gte: startToday, lte: endToday } },
    }),
    // นัดเกินกำหนด (เลยมาก่อนวันนี้แต่ยังไม่ได้ตาม)
    prisma.customer.count({
      where: { status: "active", nextCallAt: { not: null, lt: startToday } },
    }),
  ]);

  const s = await getSettings();
  const text =
    `☀️ <b>คิวงานเช้านี้</b>\n` +
    `ลูกค้าที่ต้องติดตาม: <b>${queueCount.toLocaleString("th-TH")}</b>\n` +
    `📅 นัดถึงกำหนดวันนี้: <b>${dueCount}</b>` +
    (overdueCount > 0 ? `\n⚠️ นัดเกินกำหนด (ค้าง): <b>${overdueCount}</b>` : "");
  const r = await sendTelegram(s.team_chat_id, text);
  return Response.json({ ok: true, sent: r.ok, reason: r.reason });
}
