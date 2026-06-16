import * as XLSX from "xlsx";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";
import { canManageUsers } from "@/app/lib/roles";
import { sendSms, extractPhones, isMockMode } from "@/app/lib/sms-provider";
import { renderTemplate } from "@/app/lib/sms";
import { logAudit } from "@/app/lib/audit";
import { notifySmsBatchDone } from "@/app/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX = 2000;

/** อ่านเบอร์ทั้งหมดจากไฟล์ (csv/txt/xlsx) */
function phonesFromFile(name: string, buf: ArrayBuffer): string[] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const wb = XLSX.read(buf, { type: "array" });
    let text = "";
    for (const sn of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], { header: 1 });
      for (const r of rows) text += " " + r.map((c) => String(c ?? "")).join(" ");
    }
    return extractPhones(text);
  }
  return extractPhones(new TextDecoder().decode(buf));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "ต้องเข้าสู่ระบบ" }, { status: 401 });
  if (!canManageUsers(user.role)) {
    return Response.json({ error: "ไม่มีสิทธิ์ส่ง SMS" }, { status: 403 });
  }

  const form = await request.formData();
  const message = String(form.get("message") ?? "").trim();
  const phonesText = String(form.get("phones") ?? "");
  const file = form.get("file");

  if (!message) return Response.json({ error: "กรุณาพิมพ์ข้อความ" }, { status: 400 });

  // รวมเบอร์จาก textarea + ไฟล์
  const set = new Set<string>(extractPhones(phonesText));
  let hasFile = false;
  if (file && typeof file !== "string") {
    hasFile = true;
    const buf = await file.arrayBuffer();
    for (const p of phonesFromFile(file.name, buf)) set.add(p);
  }
  const phones = [...set];

  if (phones.length === 0) {
    return Response.json({ error: "ไม่พบเบอร์โทรที่ถูกต้อง" }, { status: 400 });
  }
  if (phones.length > MAX) {
    return Response.json({ error: `ส่งได้สูงสุด ${MAX} เบอร์ต่อครั้ง (พบ ${phones.length})` }, { status: 400 });
  }

  const source = hasFile ? "file" : phones.length > 1 ? "group" : "single";

  const batch = await prisma.smsBatch.create({
    data: { body: message, source, total: phones.length, createdById: user.userId },
  });

  let sent = 0;
  let failed = 0;
  const rows: { batchId: number; phone: string; status: string; error: string | null }[] = [];
  for (const phone of phones) {
    // แทนค่า {{เบอร์}} ต่อผู้รับ (ตัวแปรอื่นที่ไม่มีบริบทจะคงไว้)
    const body = renderTemplate(message, { phone });
    const r = await sendSms(phone, body);
    if (r.ok) sent++;
    else failed++;
    rows.push({
      batchId: batch.id,
      phone,
      status: r.ok ? (r.mock ? "mock" : "sent") : "failed",
      error: r.error ?? null,
    });
  }

  await prisma.smsMessage.createMany({ data: rows });
  await prisma.smsBatch.update({
    where: { id: batch.id },
    data: { sentCount: sent, failedCount: failed },
  });
  await logAudit({
    userId: user.userId,
    action: "sms.send",
    entity: "SmsBatch",
    entityId: batch.id,
    after: { source, total: phones.length, sent, failed, mock: isMockMode },
  });
  await notifySmsBatchDone({
    total: phones.length,
    sent,
    failed,
    mock: isMockMode,
    by: user.name ?? "ระบบ",
  }).catch(() => {});

  return Response.json({
    ok: true,
    summary: { total: phones.length, sent, failed, mock: isMockMode, source },
  });
}
