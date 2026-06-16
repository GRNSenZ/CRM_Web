#!/usr/bin/env bash
# ติดตั้ง launchd agents สำหรับ cron แจ้งเตือน Telegram ของ CRM (เฉพาะผู้ใช้ปัจจุบัน)
#
# ⚠️ ทำไมต้องซับซ้อนกว่า crontab ปกติ:
#    โปรเจกต์อยู่ใน ~/Desktop ซึ่ง macOS ป้องกันด้วย TCC — process ที่ launchd/cron
#    สั่งรัน จะอ่านไฟล์ใน Desktop ไม่ได้ (Operation not permitted)
#    สคริปต์นี้จึง "ย้าย" launcher + log ออกไปนอก Desktop และฝัง secret ไว้ใน plist
#    ทำให้ launchd แค่ยิง curl ไป localhost โดยไม่ต้องแตะ Desktop เลย → ไม่ต้องให้ FDA
#
# ใช้:
#   ./install.sh load      ติดตั้ง+เริ่มทั้ง 4 งาน
#   ./install.sh unload    ถอนทั้ง 4 งาน + ลบไฟล์ที่ติดตั้ง
#   ./install.sh status    ดูสถานะ
#   ./install.sh test      ยิง daily-summary เดี๋ยวนี้ (ทดสอบ)
#   ./install.sh log       ดู log ล่าสุด
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"      # .../crm-web/scripts/launchd
PROJECT_DIR="$(cd "$SRC_DIR/../.." && pwd)"                  # .../crm-web
ENV_FILE="$PROJECT_DIR/.env"

# ปลายทางนอก Desktop (TCC เข้าถึงได้)
APP_DIR="$HOME/Library/Application Support/crm"
LAUNCHER="$APP_DIR/cron-ping.sh"
LOG_FILE="$HOME/Library/Logs/crm-cron.log"
AGENTS_DIR="$HOME/Library/LaunchAgents"
DOMAIN="gui/$(id -u)"

LABELS=(com.crm.daily-summary com.crm.weekly-summary com.crm.morning-queue com.crm.slow-day-alert)

get_env() {
  { grep -E "^$1=" "$ENV_FILE" 2>/dev/null || true; } | tail -1 | cut -d= -f2- \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

# คืน XML ของ StartCalendarInterval ตามชนิดงาน
schedule_xml() {
  case "$1" in
    com.crm.daily-summary)  # ทุกวัน 20:00
      printf '<dict><key>Hour</key><integer>20</integer><key>Minute</key><integer>0</integer></dict>' ;;
    com.crm.weekly-summary) # จันทร์ 08:00
      printf '<dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>8</integer><key>Minute</key><integer>0</integer></dict>' ;;
    com.crm.morning-queue)  # จ-ศ 09:00
      printf '<array>'; for d in 1 2 3 4 5; do
        printf '<dict><key>Weekday</key><integer>%s</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>' "$d"; done; printf '</array>' ;;
    com.crm.slow-day-alert) # จ-ศ 13:00
      printf '<array>'; for d in 1 2 3 4 5; do
        printf '<dict><key>Weekday</key><integer>%s</integer><key>Hour</key><integer>13</integer><key>Minute</key><integer>0</integer></dict>' "$d"; done; printf '</array>' ;;
  esac
}

route_of() { echo "${1#com.crm.}"; }   # com.crm.daily-summary -> daily-summary

write_plist() {
  local label="$1" secret="$2" baseurl="$3"
  local route; route="$(route_of "$label")"
  cat > "$AGENTS_DIR/$label.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$LAUNCHER</string>
    <string>$route</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CRM_CRON_SECRET</key><string>$secret</string>
    <key>CRM_BASE_URL</key><string>$baseurl</string>
    <key>CRM_CRON_LOG</key><string>$LOG_FILE</string>
  </dict>
  <key>StartCalendarInterval</key>
  $(schedule_xml "$label")
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>$LOG_FILE</string>
  <key>StandardErrorPath</key><string>$LOG_FILE</string>
</dict>
</plist>
PLIST
  plutil -lint "$AGENTS_DIR/$label.plist" >/dev/null
}

case "${1:-}" in
  load)
    SECRET="$(get_env CRON_SECRET)"
    [ -n "$SECRET" ] || { echo "❌ ไม่พบ CRON_SECRET ใน $ENV_FILE"; exit 1; }
    BASEURL="$(get_env CRON_BASE_URL)"; BASEURL="${BASEURL:-http://localhost:3000}"

    # ย้าย launcher ออกนอก Desktop
    mkdir -p "$APP_DIR" "$AGENTS_DIR" "$(dirname "$LOG_FILE")"
    cp "$PROJECT_DIR/scripts/cron-ping.sh" "$LAUNCHER"
    chmod +x "$LAUNCHER"

    for L in "${LABELS[@]}"; do
      write_plist "$L" "$SECRET" "$BASEURL"
      launchctl bootout "$DOMAIN/$L" 2>/dev/null || true
      launchctl bootstrap "$DOMAIN" "$AGENTS_DIR/$L.plist"
      echo "✓ โหลดแล้ว: $L"
    done
    echo "launcher : $LAUNCHER"
    echo "base url : $BASEURL"
    echo "log      : $LOG_FILE"
    echo "👉 อย่าลืมให้เซิร์ฟเวอร์ ($BASEURL) รันอยู่ตอน cron ยิง"
    ;;
  unload)
    for L in "${LABELS[@]}"; do
      launchctl bootout "$DOMAIN/$L" 2>/dev/null || true
      rm -f "$AGENTS_DIR/$L.plist"
      echo "✓ ถอนแล้ว: $L"
    done
    rm -f "$LAUNCHER"
    ;;
  status)
    for L in "${LABELS[@]}"; do
      if launchctl print "$DOMAIN/$L" >/dev/null 2>&1; then echo "● $L  — โหลดอยู่"; else echo "○ $L  — ยังไม่โหลด"; fi
    done ;;
  test)
    launchctl kickstart -k "$DOMAIN/com.crm.daily-summary" && echo "ยิง daily-summary แล้ว — ดู: $0 log" ;;
  log)
    tail -n 20 "$LOG_FILE" 2>/dev/null || echo "(ยังไม่มี log ที่ $LOG_FILE)" ;;
  *)
    echo "ใช้: $0 {load|unload|status|test|log}"; exit 1 ;;
esac
