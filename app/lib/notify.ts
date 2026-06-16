import "server-only";
import { prisma } from "./prisma";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const telegramConfigured = !!TOKEN;

// คีย์ค่าตั้ง + ค่าเริ่มต้น
export const DEFAULT_SETTINGS: Record<string, string> = {
  team_chat_id: "",
  boss_chat_id: "",
  big_deposit_threshold: "5000",
  min_calls_before_noon: "30",
  daily_deposit_goal: "0", // 0 = ปิด (ไม่แจ้งทะลุเป้า)
  notify_big_deposit: "on",
  notify_reactivation: "on",
  notify_goal: "off",
  notify_bonus: "on",
  notify_dnc: "on",
  notify_import: "on",
  notify_sms_done: "on",
};

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.notificationSetting.findMany();
  const map = { ...DEFAULT_SETTINGS };
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.notificationSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/** ส่งข้อความเข้า Telegram — ไม่ throw (กันงานหลักพัง) */
export async function sendTelegram(
  chatId: string,
  text: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!TOKEN) return { ok: false, reason: "ยังไม่ตั้ง TELEGRAM_BOT_TOKEN" };
  if (!chatId) return { ok: false, reason: "ยังไม่ตั้ง chat id" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    return { ok: !!data.ok, reason: data.description };
  } catch (e) {
    console.error("[telegram] ส่งไม่สำเร็จ:", e);
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export type TgChat = { id: string; title: string; type: string };

/** ดึงรายการแชท/กลุ่มที่บอทเห็นจาก getUpdates (ไว้ดึง chat id อัตโนมัติ) */
export async function fetchTelegramChats(): Promise<{
  ok: boolean;
  reason?: string;
  chats: TgChat[];
}> {
  if (!TOKEN) return { ok: false, reason: "ยังไม่ตั้ง TELEGRAM_BOT_TOKEN", chats: [] };
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates`, {
      cache: "no-store",
    });
    const data = (await res.json()) as {
      ok: boolean;
      description?: string;
      result?: Array<Record<string, { chat?: { id: number; title?: string; first_name?: string; username?: string; type: string } }>>;
    };
    if (!data.ok) return { ok: false, reason: data.description ?? "getUpdates ล้มเหลว", chats: [] };

    const byId = new Map<string, TgChat>();
    for (const update of data.result ?? []) {
      // chat อาจอยู่ใน message / channel_post / my_chat_member ฯลฯ
      for (const key of Object.keys(update)) {
        const chat = update[key]?.chat;
        if (!chat) continue;
        const id = String(chat.id);
        byId.set(id, {
          id,
          title: chat.title ?? chat.first_name ?? chat.username ?? "(ไม่มีชื่อ)",
          type: chat.type,
        });
      }
    }
    const chats = [...byId.values()];
    return {
      ok: true,
      reason: chats.length ? undefined : "ไม่พบแชท — ลองพิมพ์ข้อความในกลุ่มหลังเพิ่มบอทแล้วลองใหม่",
      chats,
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e), chats: [] };
  }
}

/** ปิดเลขกลางเบอร์: 089-xxx-1234 */
export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 7) return phone;
  return `${d.slice(0, 3)}-xxx-${d.slice(-4)}`;
}

export function baht(n: number): string {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(n);
}

// ---------- แจ้งเตือนทันที (เรียกจาก action ต่าง ๆ) ----------

/** ยอดฝากใหญ่ → กลุ่มทีม */
export async function notifyBigDeposit(info: {
  web: string;
  phone: string;
  amount: number;
  by: string;
}): Promise<void> {
  const s = await getSettings();
  if (s.notify_big_deposit !== "on") return;
  const threshold = Number(s.big_deposit_threshold) || 0;
  if (info.amount < threshold) return;
  const text =
    `💰 <b>ยอดฝากใหญ่</b>\n` +
    `เว็บ: ${info.web}\n` +
    `เบอร์: ${maskPhone(info.phone)}\n` +
    `ยอด: <b>฿${baht(info.amount)}</b>\n` +
    `บันทึกโดย: ${info.by}`;
  await sendTelegram(s.team_chat_id, text);
}

/** ปรับโบนัส → กลุ่มหัวหน้า */
export async function notifyBonus(info: {
  web: string;
  phone: string;
  amount: number;
  by: string;
}): Promise<void> {
  const s = await getSettings();
  if (s.notify_bonus !== "on") return;
  const text =
    `🎁 <b>ปรับโบนัส</b>\n` +
    `เว็บ: ${info.web}\n` +
    `เบอร์: ${maskPhone(info.phone)}\n` +
    `โบนัส: <b>฿${baht(info.amount)}</b>\n` +
    `โดย: ${info.by}`;
  await sendTelegram(s.boss_chat_id, text);
}

/** ตั้งห้ามโทร → กลุ่มหัวหน้า */
export async function notifyDoNotCall(info: {
  web: string;
  phone: string;
  reason: string;
  by: string;
}): Promise<void> {
  const s = await getSettings();
  if (s.notify_dnc !== "on") return;
  const text =
    `🚫 <b>ตั้งสถานะห้ามโทร</b>\n` +
    `เว็บ: ${info.web}\n` +
    `เบอร์: ${maskPhone(info.phone)}\n` +
    `เหตุผล: ${info.reason || "-"}\n` +
    `โดย: ${info.by}`;
  await sendTelegram(s.boss_chat_id, text);
}

/** นำเข้า Excel เสร็จ → กลุ่มทีม */
export async function notifyImport(info: {
  customersCreated: number;
  followUpsAdded: number;
  by: string;
}): Promise<void> {
  const s = await getSettings();
  if (s.notify_import !== "on") return;
  const text =
    `📥 <b>นำเข้าข้อมูลเสร็จ</b>\n` +
    `ลูกค้าใหม่: ${info.customersCreated}\n` +
    `บันทึกโทรเพิ่ม: ${info.followUpsAdded}\n` +
    `โดย: ${info.by}`;
  await sendTelegram(s.team_chat_id, text);
}

/** ลูกค้าขาดฝากกลับมาฝาก (ยอดไม่ถึงเกณฑ์ก้อนใหญ่) → กลุ่มทีม */
export async function notifyReactivation(info: {
  web: string;
  phone: string;
  amount: number;
  by: string;
}): Promise<void> {
  const s = await getSettings();
  if (s.notify_reactivation !== "on") return;
  const text =
    `🎯 <b>ลูกค้ากลับมาฝาก!</b>\n` +
    `เว็บ: ${info.web}\n` +
    `เบอร์: ${maskPhone(info.phone)}\n` +
    `ยอด: ฿${baht(info.amount)}\n` +
    `โดย: ${info.by}`;
  await sendTelegram(s.team_chat_id, text);
}

/** ยอดฝากรวมของวันทะลุเป้า → กลุ่มทีม (เรียกเมื่อ "ข้ามเส้น" เป้าเท่านั้น) */
export async function notifyDailyGoalReached(info: {
  total: number;
  goal: number;
}): Promise<void> {
  const s = await getSettings();
  if (s.notify_goal !== "on") return;
  const text =
    `🎉 <b>ทะลุเป้ายอดฝากวันนี้!</b>\n` +
    `เป้า: ฿${baht(info.goal)}\n` +
    `ยอดรวมตอนนี้: <b>฿${baht(info.total)}</b> 🔥`;
  await sendTelegram(s.team_chat_id, text);
}

/** ส่ง SMS เสร็จ → กลุ่มทีม */
export async function notifySmsBatchDone(info: {
  total: number;
  sent: number;
  failed: number;
  mock: boolean;
  by: string;
}): Promise<void> {
  const s = await getSettings();
  if (s.notify_sms_done !== "on") return;
  const text =
    `✉️ <b>ส่ง SMS เสร็จแล้ว</b>\n` +
    `ทั้งหมด: ${info.total} เบอร์\n` +
    `สำเร็จ: ${info.sent} · ไม่สำเร็จ: ${info.failed}` +
    (info.mock ? `\n⚠️ โหมดทดสอบ (mock) — ยังไม่ส่งจริง` : ``) +
    `\nโดย: ${info.by}`;
  await sendTelegram(s.team_chat_id, text);
}
