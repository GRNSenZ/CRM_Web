import { describe, it, expect } from "vitest";
import { extractPhones } from "../app/lib/sms-client";

describe("extractPhones — ดึงเบอร์โทรไทย", () => {
  it("เบอร์ 10 หลักขึ้น 0", () => {
    expect(extractPhones("0812345678")).toEqual(["0812345678"]);
  });

  it("เบอร์ 9 หลัก (0 หาย) → เติม 0 ให้", () => {
    expect(extractPhones("812345678")).toEqual(["0812345678"]);
  });

  it("เบอร์มีช่องว่างเดี่ยวคั่น (081 234 5678) = เบอร์เดียว", () => {
    expect(extractPhones("081 234 5678")).toEqual(["0812345678"]);
  });

  it("หลายเบอร์คั่นด้วย comma / บรรทัดใหม่", () => {
    expect(extractPhones("0812345678, 0823456789\n0834567890")).toEqual([
      "0812345678",
      "0823456789",
      "0834567890",
    ]);
  });

  it("ยุบเบอร์ซ้ำ", () => {
    expect(extractPhones("0812345678\n0812345678")).toEqual(["0812345678"]);
  });

  it("ข้ามค่าที่ไม่ใช่เบอร์ (สั้น/ยาวเกิน)", () => {
    expect(extractPhones("12345")).toEqual([]);
    expect(extractPhones("เบอร์: ไม่มี")).toEqual([]);
  });

  it("ดึงเบอร์ออกจากข้อความปนตัวอักษร", () => {
    expect(extractPhones("ติดต่อ 0891112222 ด่วน")).toEqual(["0891112222"]);
  });
});
