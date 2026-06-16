"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import { requireStaff } from "@/app/lib/auth";
import { bangkokLocalToUtc } from "@/app/lib/dates";
import { logAudit } from "@/app/lib/audit";
import {
  notifyBigDeposit,
  notifyBonus,
  notifyDoNotCall,
  notifyReactivation,
  notifyDailyGoalReached,
  getSettings,
} from "@/app/lib/notify";

function parseDate(v: FormDataEntryValue | null): Date {
  const s = String(v ?? "");
  const d = s ? new Date(s) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
}

/** บันทึกการโทร/ติดตามใหม่ */
export async function addFollowUp(formData: FormData) {
  const user = await requireStaff();
  const customerId = Number(formData.get("customerId"));
  const status = String(formData.get("status") || "pending");
  const smsSent = formData.get("smsSent") === "on";
  const callTime = String(formData.get("callTime") || "") || null;
  const note = String(formData.get("note") || "") || null;
  const smsTemplateId = Number(formData.get("smsTemplateId")) || null;
  // นัดโทรอีกครั้ง (datetime-local เวลาไทย) — ไม่กรอก = ล้างนัดเดิม (ถือว่าทำแล้ว)
  const nextCallAt = bangkokLocalToUtc(String(formData.get("nextCallAt") || ""));

  // บังคับกฎห้ามโทร — กันคนยิง action ตรงแม้เลี่ยงผ่านหน้าจอ
  const target = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { status: true },
  });
  if (target?.status === "do_not_call") {
    throw new Error("ลูกค้ารายนี้อยู่ในสถานะห้ามโทร — บันทึกการโทรไม่ได้");
  }

  await prisma.$transaction([
    prisma.followUp.create({
      data: {
        customerId,
        agentId: user.userId,
        callDate: parseDate(formData.get("callDate")),
        callTime,
        status,
        smsSent,
        smsTemplateId,
        note,
      },
    }),
    prisma.customer.update({ where: { id: customerId }, data: { nextCallAt } }),
  ]);
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/queue");
}

/** บันทึก login + ยอดฝากรายวัน (รวมยอดถ้ามีวันซ้ำ) */
export async function addDailyActivity(formData: FormData) {
  const user = await requireStaff();
  const customerId = Number(formData.get("customerId"));
  const date = parseDate(formData.get("date"));
  const loggedIn = formData.get("loggedIn") === "on";
  const deposit = Number(formData.get("deposit") || 0);

  // อ่านค่าเดิมก่อนทับ (upsert) เพื่อเก็บ before ที่ถูกต้อง
  const existing = await prisma.dailyActivity.findUnique({
    where: { customerId_date: { customerId, date } },
  });

  await prisma.dailyActivity.upsert({
    where: { customerId_date: { customerId, date } },
    create: { customerId, date, loggedIn, deposit },
    update: { loggedIn, deposit },
  });
  await logAudit({
    userId: user.userId,
    action: "deposit.upsert",
    entity: "Customer",
    entityId: customerId,
    before: existing ? { deposit: existing.deposit, loggedIn: existing.loggedIn } : null,
    after: { deposit, loggedIn },
  });

  // แจ้งเตือนยอดฝาก: ก้อนใหญ่ (💰) หรือ กลับมาฝากทั่วไป (🎯) + ทะลุเป้ารวมวันนี้ (🎉)
  if (deposit > 0) {
    const c = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { phone: true, brand: { select: { name: true } } },
    });
    if (c) {
      const s = await getSettings();
      const threshold = Number(s.big_deposit_threshold) || 0;
      const info = { web: c.brand.name, phone: c.phone, amount: deposit, by: user.name };
      if (threshold > 0 && deposit >= threshold) {
        await notifyBigDeposit(info).catch(() => {});
      } else {
        await notifyReactivation(info).catch(() => {});
      }

      // ทะลุเป้ายอดฝากรวมของวันนั้น — แจ้งครั้งเดียวตอน "ข้ามเส้น"
      const goal = Number(s.daily_deposit_goal) || 0;
      if (goal > 0) {
        const agg = await prisma.dailyActivity.aggregate({
          where: { date, deposit: { gt: 0 } },
          _sum: { deposit: true },
        });
        const afterTotal = agg._sum.deposit ?? 0;
        const delta = deposit - (existing?.deposit ?? 0); // ส่วนที่เพิ่งเพิ่มเข้าไป
        const beforeTotal = afterTotal - delta;
        if (beforeTotal < goal && afterTotal >= goal) {
          await notifyDailyGoalReached({ total: afterTotal, goal }).catch(() => {});
        }
      }
    }
  }

  revalidatePath(`/customers/${customerId}`);
}

/** บันทึกการปรับโบนัส */
export async function addBonus(formData: FormData) {
  const user = await requireStaff();
  const customerId = Number(formData.get("customerId"));
  const amount = Number(formData.get("amount") || 0);
  const percent = Number(formData.get("percent") || 20);
  await prisma.bonusAdjustment.create({
    data: { customerId, adjustDate: parseDate(formData.get("adjustDate")), amount, percent },
  });
  await logAudit({
    userId: user.userId,
    action: "bonus.create",
    entity: "Customer",
    entityId: customerId,
    after: { amount, percent },
  });

  if (amount > 0) {
    const c = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { phone: true, brand: { select: { name: true } } },
    });
    if (c) await notifyBonus({ web: c.brand.name, phone: c.phone, amount, by: user.name }).catch(() => {});
  }
  revalidatePath(`/customers/${customerId}`);
}

/** เพิ่มลูกค้าใหม่ */
export async function addCustomer(formData: FormData) {
  await requireStaff();
  const brandId = Number(formData.get("brandId"));
  let phone = String(formData.get("phone") || "").replace(/\D/g, "");
  if (!phone) return;
  if (phone.length === 9) phone = "0" + phone;

  const existing = await prisma.customer.findUnique({
    where: { brandId_phone: { brandId, phone } },
  });
  const customer =
    existing ??
    (await prisma.customer.create({
      data: { brandId, phone, name: String(formData.get("name") || "") || null },
    }));
  redirect(`/customers/${customer.id}`);
}

export type StatusState = { error?: string; success?: string };

/** เปลี่ยนสถานะลูกค้า (ปกติ ↔ ห้ามโทร) — ตั้งห้ามโทรต้องมีเหตุผล + เก็บ log + ล้างนัด */
export async function changeCustomerStatus(
  _prev: StatusState,
  formData: FormData,
): Promise<StatusState> {
  const user = await requireStaff();
  const customerId = Number(formData.get("customerId"));
  const toStatus = String(formData.get("status") || "");
  const reason = String(formData.get("reason") || "").trim();

  if (toStatus !== "active" && toStatus !== "do_not_call") {
    return { error: "สถานะไม่ถูกต้อง" };
  }
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { brand: { select: { name: true } } },
  });
  if (!customer) return { error: "ไม่พบลูกค้า" };
  if (customer.status === toStatus) {
    return { error: "ลูกค้าอยู่ในสถานะนี้อยู่แล้ว" };
  }
  if (toStatus === "do_not_call" && !reason) {
    return { error: "กรุณากรอกเหตุผลเมื่อตั้งสถานะห้ามโทร" };
  }

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: customerId },
      data: {
        status: toStatus,
        // ตั้งห้ามโทร → ล้างนัดที่ค้างอยู่ (เก็บกวาด)
        ...(toStatus === "do_not_call" ? { nextCallAt: null } : {}),
      },
    }),
    prisma.statusChangeLog.create({
      data: {
        customerId,
        fromStatus: customer.status,
        toStatus,
        reason: reason || null,
        changedById: user.userId,
      },
    }),
  ]);

  await logAudit({
    userId: user.userId,
    action: "customer.status_change",
    entity: "Customer",
    entityId: customerId,
    before: { status: customer.status },
    after: { status: toStatus, reason: reason || null },
  });

  if (toStatus === "do_not_call") {
    await notifyDoNotCall({
      web: customer.brand.name,
      phone: customer.phone,
      reason,
      by: user.name,
    }).catch(() => {});
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/queue");
  return {
    success: toStatus === "do_not_call" ? "ตั้งสถานะห้ามโทรเรียบร้อย" : "ปลดห้ามโทรเรียบร้อย",
  };
}
