import "server-only";
import { prisma } from "./prisma";

export type BrandStat = {
  brandId: number;
  brand: string;
  calls: number; // จำนวนการติดตาม
  answered: number; // รับสาย
  noAnswer: number; // ไม่รับสาย
  answeredPct: number;
  noAnswerPct: number;
  returnedCustomers: number; // กลับมาฝาก (จำนวนคน)
  totalDeposit: number; // ยอดกลับมาฝาก
  totalBonus: number; // โบนัสที่เติม
  bonusPerDeposit: number; // โบนัส/ยอดฝาก
  totalCustomers: number;
};

export type DateRange = { from?: Date; to?: Date };

function callWhere(brandId: number, range?: DateRange) {
  const w: Record<string, unknown> = { customer: { brandId } };
  if (range?.from || range?.to) {
    w.callDate = {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    };
  }
  return w;
}

function dateWhere(brandId: number, range?: DateRange) {
  const w: Record<string, unknown> = { customer: { brandId } };
  if (range?.from || range?.to) {
    w.date = {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    };
  }
  return w;
}

// BonusAdjustment ใช้ฟิลด์ชื่อ adjustDate (ไม่ใช่ date)
function bonusWhere(brandId: number, range?: DateRange) {
  const w: Record<string, unknown> = { customer: { brandId } };
  if (range?.from || range?.to) {
    w.adjustDate = {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    };
  }
  return w;
}

export async function getBrandStats(range?: DateRange): Promise<BrandStat[]> {
  const brands = await prisma.brand.findMany({ orderBy: { id: "asc" } });
  const stats = await Promise.all(
    brands.map(async (b) => {
      const [calls, answered, noAnswer, totalCustomers, deposits, bonus, returned] =
        await Promise.all([
          prisma.followUp.count({ where: callWhere(b.id, range) }),
          prisma.followUp.count({ where: { ...callWhere(b.id, range), status: "answered" } }),
          prisma.followUp.count({ where: { ...callWhere(b.id, range), status: "no_answer" } }),
          prisma.customer.count({ where: { brandId: b.id } }),
          prisma.dailyActivity.aggregate({
            where: { ...dateWhere(b.id, range), deposit: { gt: 0 } },
            _sum: { deposit: true },
          }),
          prisma.bonusAdjustment.aggregate({
            where: bonusWhere(b.id, range),
            _sum: { amount: true },
          }),
          prisma.dailyActivity.findMany({
            where: { ...dateWhere(b.id, range), deposit: { gt: 0 } },
            distinct: ["customerId"],
            select: { customerId: true },
          }),
        ]);

      const totalDeposit = deposits._sum.deposit ?? 0;
      const totalBonus = bonus._sum.amount ?? 0;
      return {
        brandId: b.id,
        brand: b.name,
        calls,
        answered,
        noAnswer,
        answeredPct: calls ? answered / calls : 0,
        noAnswerPct: calls ? noAnswer / calls : 0,
        returnedCustomers: returned.length,
        totalDeposit,
        totalBonus,
        bonusPerDeposit: totalDeposit ? totalBonus / totalDeposit : 0,
        totalCustomers,
      } satisfies BrandStat;
    }),
  );
  return stats;
}

export function sumStats(stats: BrandStat[]) {
  const calls = stats.reduce((s, x) => s + x.calls, 0);
  const answered = stats.reduce((s, x) => s + x.answered, 0);
  const noAnswer = stats.reduce((s, x) => s + x.noAnswer, 0);
  const totalDeposit = stats.reduce((s, x) => s + x.totalDeposit, 0);
  const totalBonus = stats.reduce((s, x) => s + x.totalBonus, 0);
  return {
    calls,
    answered,
    noAnswer,
    answeredPct: calls ? answered / calls : 0,
    noAnswerPct: calls ? noAnswer / calls : 0,
    returnedCustomers: stats.reduce((s, x) => s + x.returnedCustomers, 0),
    totalDeposit,
    totalBonus,
    bonusPerDeposit: totalDeposit ? totalBonus / totalDeposit : 0,
    totalCustomers: stats.reduce((s, x) => s + x.totalCustomers, 0),
  };
}
