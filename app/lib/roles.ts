// ระบบบทบาท 5 ระดับ (ยิ่งเลขมากยิ่งสิทธิ์สูง)
// owner > partner > head > admin > member

export type Role = "owner" | "partner" | "head" | "admin" | "member";

export const ROLES: Role[] = ["owner", "partner", "head", "admin", "member"];

export const ROLE_RANK: Record<Role, number> = {
  owner: 5,
  partner: 4,
  head: 3,
  admin: 2,
  member: 1,
};

export const ROLE_LABEL: Record<string, string> = {
  owner: "เจ้าของเว็บไซต์",
  partner: "Partner",
  head: "Head",
  admin: "Admin",
  member: "Member",
  // บัญชีเดิมก่อนปรับระบบ (เผื่อยังหลงเหลือ)
  agent: "Member",
};

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

export function rankOf(role: string): number {
  return ROLE_RANK[role as Role] ?? 0;
}

/** บทบาทที่ผู้ใช้ระดับนี้สร้างได้ = ทุกบทบาทที่ "ต่ำกว่า" ตัวเอง */
export function creatableRoles(creatorRole: string): Role[] {
  const rank = rankOf(creatorRole);
  return ROLES.filter((r) => ROLE_RANK[r] < rank);
}

/** ตรวจว่าผู้สร้าง (creatorRole) มีสิทธิ์สร้างบัญชีบทบาท targetRole หรือไม่ */
export function canCreateRole(creatorRole: string, targetRole: string): boolean {
  return rankOf(targetRole) > 0 && rankOf(targetRole) < rankOf(creatorRole);
}

/** Member = ดูอย่างเดียว (แก้ไขอะไรบนเว็บไม่ได้ ยกเว้นรหัสผ่านตัวเอง) */
export function isMember(role: string): boolean {
  return rankOf(role) <= ROLE_RANK.member;
}

/** staff = ทุกบทบาทที่ไม่ใช่ member (แก้ไขข้อมูลได้) */
export function isStaff(role: string): boolean {
  return rankOf(role) > ROLE_RANK.member;
}

/** ผู้ที่เข้าหน้าจัดการผู้ใช้/สร้างยูสได้ = Admin ขึ้นไป (สร้างใครได้บ้างคุมด้วย creatableRoles) */
export function canManageUsers(role: string): boolean {
  return rankOf(role) >= ROLE_RANK.admin;
}
