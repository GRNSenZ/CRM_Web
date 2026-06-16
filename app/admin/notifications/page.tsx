export const dynamic = "force-dynamic";

import AppShell from "@/app/components/AppShell";
import { requireManager } from "@/app/lib/auth";
import { getSettings, telegramConfigured } from "@/app/lib/notify";
import { saveNotificationSettings, testTelegram } from "@/app/actions/notifications";
import ChatDiscovery from "./ChatDiscovery";

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

const TOGGLES: { key: string; label: string; group: string }[] = [
  { key: "notify_big_deposit", label: "💰 ยอดฝากก้อนใหญ่ (≥ เกณฑ์)", group: "→ กลุ่มทีม" },
  { key: "notify_reactivation", label: "🎯 ลูกค้ากลับมาฝาก (ยอดทั่วไป)", group: "→ กลุ่มทีม" },
  { key: "notify_goal", label: "🎉 ทะลุเป้ายอดฝากวันนี้", group: "→ กลุ่มทีม" },
  { key: "notify_bonus", label: "🎁 ปรับโบนัส", group: "→ กลุ่มหัวหน้า" },
  { key: "notify_dnc", label: "🚫 ตั้งห้ามโทร", group: "→ กลุ่มหัวหน้า" },
  { key: "notify_import", label: "📥 นำเข้าข้อมูลเสร็จ", group: "→ กลุ่มทีม" },
  { key: "notify_sms_done", label: "✉️ ส่ง SMS เสร็จ", group: "→ กลุ่มทีม" },
];

export default async function NotificationsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();
  const sp = await props.searchParams;
  const s = await getSettings();

  return (
    <AppShell>
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-zinc-900">แจ้งเตือน Telegram</h1>
        <p className="text-sm text-zinc-500">ตั้งค่ากลุ่ม เกณฑ์ และเปิด/ปิดการแจ้งเตือนแต่ละประเภท</p>
      </header>

      {!telegramConfigured && (
        <p className="mb-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          ⚠️ ยังไม่ได้ตั้ง <code>TELEGRAM_BOT_TOKEN</code> ใน .env — ระบบจะยังไม่ส่งจริง
          (สร้างบอทกับ @BotFather แล้วใส่ token เพื่อเริ่มส่ง)
        </p>
      )}
      {sp.saved && (
        <p className="mb-5 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">บันทึกการตั้งค่าแล้ว</p>
      )}
      {sp.test === "ok" && (
        <p className="mb-5 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">✅ ส่งข้อความทดสอบสำเร็จ</p>
      )}
      {sp.test === "fail" && (
        <p className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          ❌ ส่งทดสอบไม่สำเร็จ: {sp.reason || "ตรวจ token / chat id"}
        </p>
      )}

      <form action={saveNotificationSettings} className="max-w-2xl space-y-6">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
          <h2 className="mb-4 text-sm font-semibold uppercase text-zinc-400">กลุ่มแจ้งเตือน (chat id)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">กลุ่มทีม</label>
              <input id="team_chat_id" name="team_chat_id" defaultValue={s.team_chat_id} placeholder="-1001234567890" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">กลุ่มหัวหน้า</label>
              <input id="boss_chat_id" name="boss_chat_id" defaultValue={s.boss_chat_id} placeholder="-1009876543210" className={inputCls} />
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            หา chat id: ส่งข้อความในกลุ่ม แล้วเปิด api.telegram.org/bot&lt;TOKEN&gt;/getUpdates (กลุ่มเป็นเลขติดลบ)
            — หรือใช้ปุ่ม “ดึง Chat ID อัตโนมัติ” ด้านล่าง
          </p>
        </div>

        <ChatDiscovery />

        <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
          <h2 className="mb-4 text-sm font-semibold uppercase text-zinc-400">เกณฑ์</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">เกณฑ์ยอดฝากใหญ่ (บาท)</label>
              <input name="big_deposit_threshold" type="number" defaultValue={s.big_deposit_threshold} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">สายขั้นต่ำก่อนเที่ยง (สาย)</label>
              <input name="min_calls_before_noon" type="number" defaultValue={s.min_calls_before_noon} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">เป้ายอดฝากรวมต่อวัน (บาท)</label>
              <input name="daily_deposit_goal" type="number" defaultValue={s.daily_deposit_goal} placeholder="0 = ปิด" className={inputCls} />
              <p className="mt-1 text-xs text-zinc-400">ใส่ 0 เพื่อปิดการแจ้งทะลุเป้า</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
          <h2 className="mb-4 text-sm font-semibold uppercase text-zinc-400">เปิด/ปิดการแจ้งเตือน</h2>
          <div className="space-y-2">
            {TOGGLES.map((t) => (
              <label key={t.key} className="flex items-center gap-3 text-sm text-zinc-700">
                <input type="checkbox" name={t.key} defaultChecked={s[t.key] === "on"} className="h-4 w-4" />
                {t.label} <span className="text-xs text-zinc-400">{t.group}</span>
              </label>
            ))}
          </div>
        </div>

        <button className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
          บันทึกการตั้งค่า
        </button>
      </form>

      {/* ปุ่มทดสอบส่ง */}
      <div className="mt-5 flex max-w-2xl gap-3">
        <form action={testTelegram}>
          <input type="hidden" name="group" value="team" />
          <button className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50">
            🧪 ทดสอบส่งกลุ่มทีม
          </button>
        </form>
        <form action={testTelegram}>
          <input type="hidden" name="group" value="boss" />
          <button className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50">
            🧪 ทดสอบส่งกลุ่มหัวหน้า
          </button>
        </form>
      </div>
    </AppShell>
  );
}
