import { describe, it, expect } from "vitest";
import { bangkokLocalToUtc, bangkokDayRange, endOfTodayBangkok } from "../app/lib/dates";

const DAY = 86400000;

describe("dates — เวลาไทย ↔ UTC", () => {
  it("bangkokLocalToUtc: 18:00 ไทย = 11:00 UTC", () => {
    const d = bangkokLocalToUtc("2026-06-17T18:00");
    expect(d).not.toBeNull();
    expect(d!.getUTCHours()).toBe(11);
    expect(d!.getUTCFullYear()).toBe(2026);
  });

  it("bangkokLocalToUtc: ค่าว่าง/ไม่ถูกต้อง → null", () => {
    expect(bangkokLocalToUtc("")).toBeNull();
    expect(bangkokLocalToUtc("ไม่ใช่วันที่")).toBeNull();
  });

  it("bangkokDayRange: ช่วง 1 วันพอดี (to-from = 86399999 ms)", () => {
    const { from, to } = bangkokDayRange(0);
    expect(to.getTime() - from.getTime()).toBe(DAY - 1);
    // from = เที่ยงคืน UTC (แทนวันตามปฏิทินไทย)
    expect(from.getTime() % DAY).toBe(0);
  });

  it("bangkokDayRange: offset เลื่อนวันถูกต้อง", () => {
    expect(bangkokDayRange(0).from.getTime() - bangkokDayRange(-1).from.getTime()).toBe(DAY);
    expect(bangkokDayRange(1).from.getTime() - bangkokDayRange(0).from.getTime()).toBe(DAY);
  });

  it("endOfTodayBangkok: 23:59 ไทย = 16:59 UTC และอยู่หลังต้นวัน", () => {
    const end = endOfTodayBangkok();
    expect(end.getUTCHours()).toBe(16);
    expect(end.getUTCMinutes()).toBe(59);
    expect(end.getTime()).toBeGreaterThan(bangkokDayRange(0).from.getTime());
  });
});
