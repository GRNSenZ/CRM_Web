import { describe, it, expect } from "vitest";
import { renderTemplate, DEFAULT_PROMO } from "../app/lib/sms";

describe("renderTemplate — แทนค่าตัวแปร SMS", () => {
  it("แทน {{เว็บ}} {{เบอร์}}", () => {
    expect(renderTemplate("สวัสดีลูกค้า {{เว็บ}} เบอร์ {{เบอร์}}", { web: "ABC", phone: "0812345678" })).toBe(
      "สวัสดีลูกค้า ABC เบอร์ 0812345678",
    );
  });

  it("{{โปร}} ไม่ระบุ → ใช้ค่าเริ่มต้น", () => {
    expect(renderTemplate("รับ {{โปร}}", {})).toBe(`รับ ${DEFAULT_PROMO}`);
  });

  it("{{โปร}} ระบุเอง → ใช้ค่าที่ส่งมา", () => {
    expect(renderTemplate("{{โปร}}", { promo: "โบนัส 50%" })).toBe("โบนัส 50%");
  });

  it("ตัวแปรไม่รู้จัก = คงไว้เหมือนเดิม", () => {
    expect(renderTemplate("{{ไม่รู้จัก}}", {})).toBe("{{ไม่รู้จัก}}");
  });

  it("เว้นวรรคในวงเล็บถูก trim", () => {
    expect(renderTemplate("{{ เว็บ }}", { web: "X" })).toBe("X");
  });

  it("ค่าที่ไม่ส่ง (web/phone) → ว่าง", () => {
    expect(renderTemplate("[{{เว็บ}}]", {})).toBe("[]");
  });
});
