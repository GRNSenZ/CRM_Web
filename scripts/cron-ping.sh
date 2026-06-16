#!/usr/bin/env bash
# ยิงเรียก cron route ของ CRM ทีละตัว — อ่าน secret/URL จาก .env (ไม่ฮาร์ดโค้ด)
# ใช้: ./scripts/cron-ping.sh <route>
#   route = daily-summary | weekly-summary | morning-queue | slow-day-alert
set -euo pipefail

ROUTE="${1:?ต้องระบุชื่อ route เช่น daily-summary}"

# โฟลเดอร์โปรเจกต์ = พาเรนต์ของ scripts/ (ทำงานถูกแม้ cron เรียกด้วย path เต็ม)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"
LOG_FILE="$PROJECT_DIR/cron.log"

# อ่านค่าจาก .env (รองรับค่าที่มี/ไม่มีเครื่องหมายคำพูด)
get_env() {
  # || true กันกรณีหา key ไม่เจอ (grep คืน 1) ไม่ให้ set -e หยุดสคริปต์
  { grep -E "^$1=" "$ENV_FILE" 2>/dev/null || true; } | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

# ลำดับการหาค่า: env (สำหรับ launchd/cron ที่เข้า Desktop ไม่ได้) ก่อน แล้วค่อย .env
CRON_SECRET="${CRM_CRON_SECRET:-$(get_env CRON_SECRET)}"
BASE_URL="${CRM_BASE_URL:-$(get_env CRON_BASE_URL)}"
BASE_URL="${BASE_URL:-http://localhost:3000}"   # ดีฟอลต์เครื่องนี้
# log: ใช้ env override ได้ (launchd เขียน Desktop ไม่ได้ → ชี้ไป ~/Library/Logs แทน)
LOG_FILE="${CRM_CRON_LOG:-$LOG_FILE}"

if [ -z "$CRON_SECRET" ]; then
  echo "$(date '+%F %T') [$ROUTE] ERROR: ไม่พบ CRON_SECRET (env CRM_CRON_SECRET หรือ $ENV_FILE)" >>"$LOG_FILE"
  exit 1
fi

URL="$BASE_URL/api/cron/$ROUTE"
# --max-time กันค้าง, -s เงียบ, แยก body กับ http code
RESP="$(curl -s -m 30 -w $'\n%{http_code}' \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$URL" 2>&1 || echo $'\nCURL_FAIL')"

CODE="$(printf '%s' "$RESP" | tail -1)"
BODY="$(printf '%s' "$RESP" | sed '$d')"

echo "$(date '+%F %T') [$ROUTE] HTTP $CODE $BODY" >>"$LOG_FILE"

# คืน exit code ไม่เป็น 0 ถ้าไม่ใช่ 200 (เผื่อ monitoring ภายนอกอ่าน)
[ "$CODE" = "200" ]
