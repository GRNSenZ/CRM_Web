import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { parseWorkbook, importWorkbook } from "../app/lib/import-excel";

// seed/migrate ใช้ direct (session pooler 5432) เพื่อ bulk insert ได้เสถียร
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

// ไฟล์ Excel ต้นฉบับอยู่ที่โฟลเดอร์แม่ของ crm-web
const EXCEL = join(process.cwd(), "..", "CRM_โทรติดตามลูกค้า_ลูกค้าขาดฝาก_มิถุนายน.xlsx");

async function main() {
  console.log("ล้างข้อมูลเดิม...");
  await prisma.bonusAdjustment.deleteMany();
  await prisma.dailyActivity.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.user.deleteMany();

  console.log("สร้างผู้ใช้เริ่มต้น...");
  await prisma.user.create({
    data: {
      username: "owner",
      password: await bcrypt.hash("owner1234", 10),
      name: "เจ้าของเว็บไซต์",
      role: "owner",
      emailVerified: true,
    },
  });
  await prisma.user.create({
    data: {
      username: "admin",
      password: await bcrypt.hash("admin1234", 10),
      name: "ผู้ดูแลระบบ",
      role: "admin",
      emailVerified: true,
    },
  });
  await prisma.user.create({
    data: {
      username: "agent1",
      password: await bcrypt.hash("agent1234", 10),
      name: "พนักงาน 1",
      role: "member",
      emailVerified: true,
    },
  });

  console.log("นำเข้าข้อมูลจากไฟล์ Excel...");
  const parsed = parseWorkbook(readFileSync(EXCEL));
  const summary = await importWorkbook(prisma, parsed);
  console.log("เสร็จสิ้น:", JSON.stringify(summary, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
