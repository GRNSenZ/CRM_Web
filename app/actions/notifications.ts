"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/app/lib/auth";
import { getSettings, setSetting, sendTelegram, fetchTelegramChats, type TgChat } from "@/app/lib/notify";

const TEXT_KEYS = [
  "team_chat_id",
  "boss_chat_id",
  "big_deposit_threshold",
  "min_calls_before_noon",
  "daily_deposit_goal",
];
const TOGGLE_KEYS = [
  "notify_big_deposit",
  "notify_reactivation",
  "notify_goal",
  "notify_bonus",
  "notify_dnc",
  "notify_import",
  "notify_sms_done",
];

export async function saveNotificationSettings(formData: FormData) {
  await requireManager();
  for (const k of TEXT_KEYS) await setSetting(k, String(formData.get(k) ?? "").trim());
  for (const k of TOGGLE_KEYS) await setSetting(k, formData.get(k) === "on" ? "on" : "off");
  revalidatePath("/admin/notifications");
  redirect("/admin/notifications?saved=1");
}

export async function discoverChats(): Promise<{ ok: boolean; reason?: string; chats: TgChat[] }> {
  await requireManager();
  return fetchTelegramChats();
}

export async function testTelegram(formData: FormData) {
  await requireManager();
  const group = String(formData.get("group"));
  const s = await getSettings();
  const chatId = group === "boss" ? s.boss_chat_id : s.team_chat_id;
  const r = await sendTelegram(
    chatId,
    `✅ <b>ทดสอบการแจ้งเตือน</b>\nระบบ CRM เชื่อมต่อ Telegram สำเร็จ (กลุ่ม${group === "boss" ? "หัวหน้า" : "ทีม"})`,
  );
  redirect(`/admin/notifications?test=${r.ok ? "ok" : "fail"}&reason=${encodeURIComponent(r.reason ?? "")}`);
}
