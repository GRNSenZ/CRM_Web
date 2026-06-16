import { describe, it, expect } from "vitest";
import {
  rankOf,
  roleLabel,
  creatableRoles,
  canCreateRole,
  isMember,
  isStaff,
  canManageUsers,
} from "../app/lib/roles";

describe("roles — ลำดับชั้นบทบาท", () => {
  it("rankOf คืนค่าลำดับถูกต้อง และไม่รู้จัก = 0", () => {
    expect(rankOf("owner")).toBe(5);
    expect(rankOf("admin")).toBe(2);
    expect(rankOf("member")).toBe(1);
    expect(rankOf("ไม่รู้จัก")).toBe(0);
  });

  it("roleLabel แปลงป้ายไทย + บัญชีเก่า agent → Member + ค่าแปลกคงเดิม", () => {
    expect(roleLabel("owner")).toBe("เจ้าของเว็บไซต์");
    expect(roleLabel("agent")).toBe("Member");
    expect(roleLabel("xyz")).toBe("xyz");
  });

  it("creatableRoles = ทุกบทบาทที่ต่ำกว่าตัวเอง", () => {
    expect(creatableRoles("owner")).toEqual(["partner", "head", "admin", "member"]);
    expect(creatableRoles("head")).toEqual(["admin", "member"]);
    expect(creatableRoles("member")).toEqual([]);
  });

  it("canCreateRole: สร้างได้เฉพาะบทบาทที่ต่ำกว่า (ไม่เท่า ไม่สูงกว่า)", () => {
    expect(canCreateRole("owner", "admin")).toBe(true);
    expect(canCreateRole("admin", "member")).toBe(true);
    expect(canCreateRole("admin", "owner")).toBe(false);
    expect(canCreateRole("admin", "admin")).toBe(false);
    expect(canCreateRole("member", "member")).toBe(false);
    expect(canCreateRole("owner", "ไม่รู้จัก")).toBe(false);
  });

  it("isMember / isStaff แยกสิทธิ์อ่านอย่างเดียว vs แก้ไขได้", () => {
    expect(isMember("member")).toBe(true);
    expect(isMember("admin")).toBe(false);
    expect(isStaff("admin")).toBe(true);
    expect(isStaff("member")).toBe(false);
  });

  it("canManageUsers = Admin ขึ้นไป", () => {
    expect(canManageUsers("admin")).toBe(true);
    expect(canManageUsers("head")).toBe(true);
    expect(canManageUsers("owner")).toBe(true);
    expect(canManageUsers("member")).toBe(false);
  });
});
