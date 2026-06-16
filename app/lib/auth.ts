import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "./session";
import { canManageUsers, isStaff, rankOf } from "./roles";

/** ดึงผู้ใช้ปัจจุบัน (memoized ต่อ request) */
export const getCurrentUser = cache(async (): Promise<SessionPayload | null> => {
  return getSession();
});

/** บังคับว่าต้อง login — ไม่งั้นเด้งไปหน้า /login */
export async function requireUser(): Promise<SessionPayload> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** บังคับว่าต้องเป็น staff (ไม่ใช่ member) — member ดูได้อย่างเดียว แก้ไขไม่ได้ */
export async function requireStaff(): Promise<SessionPayload> {
  const user = await requireUser();
  if (!isStaff(user.role)) redirect("/");
  return user;
}

/** บังคับสิทธิ์จัดการผู้ใช้ (Admin ขึ้นไป) */
export async function requireManager(): Promise<SessionPayload> {
  const user = await requireUser();
  if (!canManageUsers(user.role)) redirect("/");
  return user;
}

/** บังคับสิทธิ์ขั้นต่ำตามอันดับบทบาท (เช่น "admin" = Admin ขึ้นไป) */
export async function requireRank(minRole: string): Promise<SessionPayload> {
  const user = await requireUser();
  if (rankOf(user.role) < rankOf(minRole)) redirect("/");
  return user;
}

/** (คงไว้เพื่อความเข้ากันได้) บังคับ Admin ขึ้นไป */
export async function requireAdmin(): Promise<SessionPayload> {
  return requireRank("admin");
}
