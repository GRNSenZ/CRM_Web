# 📞 CRM ติดตามลูกค้าขาดฝาก (Telesales Win-Back)

ระบบ CRM สำหรับทีม telesales ใช้ติดตามลูกค้าที่ "ขาดการฝาก" ของแต่ละเว็บ/แบรนด์ ให้กลับมาใช้งานอีกครั้ง — แปลงจากไฟล์ Excel เดิมเป็นเว็บแอปเต็มรูปแบบ พร้อมคิวโทร บันทึกผล รายงานวิเคราะห์ ส่ง SMS และแจ้งเตือน Telegram

> 🔗 **Live demo:** https://crm-web-tawny-iota.vercel.app
> บัญชีทดสอบ: `owner / owner1234` · `admin / admin1234` · `agent1 / agent1234`

---

## ✨ ความสามารถ

**จัดการลูกค้า & คิวโทร**
- คิวโทรรายวัน กรองตามสถานะ/นัดโทรกลับ + เบอร์โทรกดโทรได้ทันที (`tel:`)
- บันทึกผลการโทร (รับสาย/ไม่รับสาย/ยังไม่โทร) + หมายเหตุ + ส่ง SMS
- บันทึก Login + ยอดฝากรายวัน + ปรับโบนัส พร้อมประวัติทั้งหมด
- นัดโทรกลับ (`nextCallAt`) + บังคับสถานะ **ห้ามโทร (Do-Not-Call)** พร้อมประวัติการเปลี่ยนสถานะ
- ค้นหาลูกค้าข้ามทุกเว็บด้วยเบอร์โทร

**นำเข้าข้อมูล**
- อัปโหลด Excel (.xlsx) หรือลิงก์ Google Sheet — เลือกเว็บปลายทาง + ป๊อปอัพยืนยันก่อนนำเข้า
- นำเข้าแบบ merge (idempotent) ไม่สร้างข้อมูลซ้ำ ไม่ลบของเดิม

**รายงาน & วิเคราะห์**
- Dashboard ภาพรวม KPI ทุกเว็บ + เป้ารายวัน
- รายงานรายวัน/สัปดาห์/เดือน/กำหนดช่วงเอง — เทียบทุกเว็บ
- แดชบอร์ดผลงานรายพนักงาน + Cohort analysis
- Export ลูกค้าเป็น CSV และรายงานเป็น Excel

**ความปลอดภัย & สิทธิ์**
- JWT auth ผ่าน httpOnly cookie + bcrypt
- สมัครสมาชิกแบบ OTP เบอร์ + ยืนยันอีเมล
- บทบาท 5 ระดับ (owner / partner / head / admin / member) — สร้างผู้ใช้ได้ตามลำดับชั้น
- เปลี่ยนรหัสผ่านตัวเอง + Audit Log ทุกการกระทำสำคัญ

**เครื่องมือเสริม**
- คลังข้อความ SMS (ตัวแปร `{{เว็บ}} {{เบอร์}} {{โปร}}`) + ส่ง SMS (ทีละเบอร์/กลุ่ม/อัปโหลดไฟล์)
- แจ้งเตือน Telegram: เรียลไทม์ (ยอดใหญ่/กลับมาฝาก/ทะลุเป้า/โบนัส/ห้ามโทร/นำเข้า/ส่ง SMS) + cron สรุป (รายวัน/สัปดาห์/คิวเช้า/เตือนโทรน้อย)
- จัดการเว็บ/แบรนด์ + ผู้ใช้

---

## 🛠 เทคโนโลยี

| ส่วน | เทคโนโลยี |
|------|-----------|
| Framework | Next.js 16 (App Router, Turbopack, Server Actions) |
| UI | React 19 + Tailwind CSS v4 (ธีมน้ำเงินครามตัดทอง) |
| Database | Prisma 7 ORM + SQLite (dev) · PostgreSQL (prod) |
| Auth | JWT (`jose`) + `bcryptjs` |
| ไฟล์ Excel | `xlsx` (SheetJS) |
| แจ้งเตือน | Telegram Bot API + Cron (crontab / launchd / Vercel Cron) |

---

## 🚀 เริ่มใช้งาน (เครื่องตัวเอง)

```bash
npm install
cp .env.example .env        # แล้วแก้ค่าใน .env (อย่างน้อย SESSION_SECRET)

npm run db:migrate          # สร้างตาราง (ครั้งแรกครั้งเดียว)
npm run db:seed             # นำเข้าข้อมูลตัวอย่าง + สร้างบัญชีเริ่มต้น
npm run dev                 # เปิด http://localhost:3000
```

**บัญชีเริ่มต้น** (เปลี่ยนรหัสก่อนใช้งานจริง)

| ผู้ใช้ | รหัสผ่าน | บทบาท |
|--------|----------|-------|
| `owner` | `owner1234` | เจ้าของ (ทุกสิทธิ์) |
| `admin` | `admin1234` | แอดมิน |
| `agent1` | `agent1234` | พนักงาน |

---

## ⚙️ ตัวแปรแวดล้อม (.env)

ดูครบใน [`.env.example`](.env.example) — สรุปสั้น ๆ:

| ตัวแปร | จำเป็น | ใช้ทำอะไร |
|--------|:------:|-----------|
| `DATABASE_URL` | ✅ | ที่อยู่ฐานข้อมูล |
| `SESSION_SECRET` | ✅ | กุญแจเซ็น JWT session |
| `TELEGRAM_BOT_TOKEN` | — | เปิดแจ้งเตือน Telegram (ไม่ใส่ = mock) |
| `CRON_SECRET` | — | ป้องกัน endpoint `/api/cron/*` |
| `SMS_GATEWAY_URL` / `_KEY` | — | เกตเวย์ส่ง SMS (ไม่ใส่ = mock) |
| `OTP_DEV_MODE` | — | แสดง OTP บนจอแทนส่งจริง (dev) |

---

## 📁 โครงสร้างโปรเจกต์

```
app/
  (หน้าหลัก)         page.tsx (Dashboard), summary, queue, customers, brands, reports
  login/ register/   เข้าสู่ระบบ / สมัครสมาชิก
  profile/           โปรไฟล์ + เปลี่ยนรหัสผ่าน
  admin/             จัดการผู้ใช้ / SMS / แจ้งเตือน / Audit Log
  api/               import, sms, cron endpoints
  actions/           Server Actions (crm, auth, sms, notifications, …)
  lib/               auth, roles, queries, import-excel, sms, notify, dates, period
  components/        AppShell, ฯลฯ
prisma/schema.prisma  สคีมาฐานข้อมูล
scripts/              สคริปต์ติดตั้ง cron (crontab + launchd)
```

---

## ⏰ ตั้ง Cron แจ้งเตือนสรุป

ดูสคริปต์พร้อมใช้ใน [`scripts/`](scripts/):
- **macOS (แนะนำ):** `./scripts/launchd/install.sh load` — รองรับข้อจำกัด TCC ของ `~/Desktop` อัตโนมัติ
- **Linux/เซิร์ฟเวอร์:** `crontab scripts/crontab.txt` (แก้พาธก่อน)

ตารางเริ่มต้น: สรุปรายวัน 20:00 · รายสัปดาห์ จ. 08:00 · คิวเช้า จ–ศ 09:00 · เตือนโทรน้อย จ–ศ 13:00

วิธีเชื่อมบอท Telegram + ดึง chat id อัตโนมัติ ดูได้ในหน้า **🔔 แจ้งเตือน Telegram** (`/admin/notifications`)

---

## 🌐 Deploy ขึ้นออนไลน์ — ✅ ขึ้นแล้ว

Production: **https://crm-web-tawny-iota.vercel.app** (Vercel + PostgreSQL บน Supabase)

- ฐานข้อมูล PostgreSQL (Supabase) — ตั้ง `DATABASE_URL` (pooled 6543) + `DIRECT_URL` (5432)
- แจ้งเตือนสรุปตามเวลาใช้ **Vercel Cron** (ดู `vercel.json` — เวลาเป็น UTC)
- ตั้ง Environment Variables บน Vercel: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`
- seed ข้อมูลขึ้น cloud: `npm run db:push && npm run db:seed`

---

> สร้างด้วย [Claude Code](https://claude.com/claude-code)
