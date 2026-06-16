import "server-only";

/** ตรวจสิทธิ์ cron ด้วย header Authorization: Bearer <CRON_SECRET> */
export function checkCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
