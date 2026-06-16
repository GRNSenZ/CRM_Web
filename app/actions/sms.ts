"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import { requireManager } from "@/app/lib/auth";

/** สร้าง/แก้ template (มี id = แก้, ไม่มี = สร้าง) */
export async function saveSmsTemplate(formData: FormData) {
  await requireManager();
  const id = Number(formData.get("id")) || 0;
  const name = String(formData.get("name") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!name || !body) return;

  if (id) {
    await prisma.smsTemplate.update({ where: { id }, data: { name, body } });
  } else {
    const max = await prisma.smsTemplate.aggregate({ _max: { sortOrder: true } });
    await prisma.smsTemplate.create({
      data: { name, body, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
  }
  revalidatePath("/admin/sms-templates");
  revalidatePath("/customers", "layout");
  redirect("/admin/sms-templates");
}

export async function toggleSmsTemplate(formData: FormData) {
  await requireManager();
  const id = Number(formData.get("id"));
  const t = await prisma.smsTemplate.findUnique({ where: { id } });
  if (!t) return;
  await prisma.smsTemplate.update({ where: { id }, data: { active: !t.active } });
  revalidatePath("/admin/sms-templates");
}

export async function deleteSmsTemplate(formData: FormData) {
  await requireManager();
  const id = Number(formData.get("id"));
  await prisma.smsTemplate.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/sms-templates");
}

/** เลื่อนลำดับ (สลับ sortOrder กับเพื่อนบ้าน) */
export async function moveSmsTemplate(formData: FormData) {
  await requireManager();
  const id = Number(formData.get("id"));
  const dir = String(formData.get("dir"));
  const cur = await prisma.smsTemplate.findUnique({ where: { id } });
  if (!cur) return;
  const neighbor = await prisma.smsTemplate.findFirst({
    where:
      dir === "up"
        ? { sortOrder: { lt: cur.sortOrder } }
        : { sortOrder: { gt: cur.sortOrder } },
    orderBy: { sortOrder: dir === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return;
  await prisma.$transaction([
    prisma.smsTemplate.update({ where: { id: cur.id }, data: { sortOrder: neighbor.sortOrder } }),
    prisma.smsTemplate.update({ where: { id: neighbor.id }, data: { sortOrder: cur.sortOrder } }),
  ]);
  revalidatePath("/admin/sms-templates");
}
