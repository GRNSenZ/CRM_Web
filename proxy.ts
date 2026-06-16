import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ตรวจแบบ optimistic: มี cookie session ไหม (การตรวจจริงอยู่ใน Data Access Layer)
// หน้าที่เข้าได้โดยไม่ต้อง login
const PUBLIC_PATHS = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("session");
  const { pathname } = request.nextUrl;

  // API routes จัดการสิทธิ์เอง (เช่น cron ใช้ CRON_SECRET, อื่น ๆ ใช้ session) — ไม่ redirect
  if (pathname.startsWith("/api/")) return NextResponse.next();

  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // ยกเว้น static assets และ api ภายในของ next
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
