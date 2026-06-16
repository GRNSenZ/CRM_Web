import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";
import { canManageUsers } from "@/app/lib/roles";
import { parseWorkbook, importWorkbook, previewParsed } from "@/app/lib/import-excel";
import { logAudit } from "@/app/lib/audit";
import { notifyImport } from "@/app/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** ดึง spreadsheet id จากลิงก์ Google Sheet แล้วทำเป็น URL ดาวน์โหลด .xlsx */
function googleSheetExportUrl(link: string): string | null {
  const m = link.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=xlsx`;
}

/**
 * POST /api/import
 * - multipart/form-data ที่มี field "file" (.xlsx) หรือ
 * - JSON { googleSheetUrl: "..." }
 * สิทธิ์: Admin ขึ้นไป
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "ต้องเข้าสู่ระบบ" }, { status: 401 });
  if (!canManageUsers(user.role)) {
    return Response.json({ error: "เฉพาะ Admin ขึ้นไปเท่านั้น" }, { status: 403 });
  }

  let buf: ArrayBuffer | null = null;
  let brandIdRaw: string | null = null;
  let source = "file";
  let fileName: string | null = null;
  let isPreview = false;
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      brandIdRaw = form.get("brandId") ? String(form.get("brandId")) : null;
      isPreview = form.get("preview") === "1";
      if (!file || typeof file === "string") {
        return Response.json({ error: "ไม่พบไฟล์ที่อัปโหลด" }, { status: 400 });
      }
      const name = file.name.toLowerCase();
      if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
        return Response.json(
          { error: "รองรับเฉพาะไฟล์ Excel (.xlsx) — Google Sheet ให้ดาวน์โหลดเป็น .xlsx ก่อน" },
          { status: 400 },
        );
      }
      source = "file";
      fileName = file.name;
      buf = await file.arrayBuffer();
    } else {
      const body = await request.json().catch(() => ({}));
      brandIdRaw = body.brandId != null ? String(body.brandId) : null;
      isPreview = body.preview === true || body.preview === "1";
      source = "gsheet";
      const link = String(body.googleSheetUrl ?? "").trim();
      if (!link) return Response.json({ error: "ไม่พบไฟล์หรือลิงก์" }, { status: 400 });
      const exportUrl = googleSheetExportUrl(link);
      if (!exportUrl) {
        return Response.json({ error: "ลิงก์ Google Sheet ไม่ถูกต้อง" }, { status: 400 });
      }
      const res = await fetch(exportUrl);
      if (!res.ok) {
        return Response.json(
          { error: "ดึงไฟล์จาก Google Sheet ไม่สำเร็จ — ตรวจว่าตั้งสิทธิ์ให้ดูได้ (อย่างน้อย 'ผู้ที่มีลิงก์')" },
          { status: 400 },
        );
      }
      buf = await res.arrayBuffer();
    }

    const parsed = parseWorkbook(buf);
    if (parsed.length === 0) {
      return Response.json(
        { error: "ไม่พบชีตข้อมูลที่อ่านได้ — ตรวจว่าไฟล์เป็นรูปแบบเดียวกับไฟล์ CRM ต้นฉบับ" },
        { status: 400 },
      );
    }

    // เลือกเว็บปลายทาง: ถ้าระบุ brandId → บังคับให้ข้อมูลทุกชีตเข้าเว็บนั้น
    // (ไม่ระบุ = อัตโนมัติตามชื่อชีตในไฟล์)
    let targetBrandName: string | null = null;
    if (brandIdRaw) {
      const brandId = Number(brandIdRaw);
      const brand = Number.isFinite(brandId)
        ? await prisma.brand.findUnique({ where: { id: brandId } })
        : null;
      if (!brand) return Response.json({ error: "ไม่พบเว็บปลายทางที่เลือก" }, { status: 400 });
      targetBrandName = brand.name;
      for (const p of parsed) p.brand = brand.name;
    }

    // โหมดดูตัวอย่าง: parse-only ไม่เขียน DB
    if (isPreview) {
      const preview = await previewParsed(prisma, parsed);
      return Response.json({ ok: true, preview });
    }

    const summary = await importWorkbook(prisma, parsed);
    await logAudit({
      userId: user.userId,
      action: "import.run",
      entity: "Import",
      entityId: 0,
      after: {
        sheets: summary.sheets,
        customersCreated: summary.customersCreated,
        followUpsAdded: summary.followUpsAdded,
        bonusesAdded: summary.bonusesAdded,
        dncSkipped: summary.dncSkipped,
      },
    });
    // บันทึกประวัติการนำเข้า
    await prisma.importLog
      .create({
        data: {
          userId: user.userId,
          userName: user.name,
          source,
          fileName,
          targetBrand: targetBrandName,
          sheets: summary.sheets,
          rows: summary.rows,
          customersCreated: summary.customersCreated,
          followUpsAdded: summary.followUpsAdded,
          bonusesAdded: summary.bonusesAdded,
          dailyUpserted: summary.dailyUpserted,
          dncSkipped: summary.dncSkipped,
        },
      })
      .catch(() => {});
    await notifyImport({
      customersCreated: summary.customersCreated,
      followUpsAdded: summary.followUpsAdded,
      by: user.name,
    }).catch(() => {});
    return Response.json({ ok: true, summary });
  } catch (e) {
    console.error("[import] error:", e);
    return Response.json(
      { error: "เกิดข้อผิดพลาดระหว่างนำเข้า: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}
