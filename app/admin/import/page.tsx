import { redirect } from "next/navigation";

// ย้ายฟังก์ชันนำเข้าไปอยู่ในหน้า เว็บ/แบรนด์ แล้ว — เปลี่ยนเส้นทางเดิมไปที่นั่น
export default function ImportPage() {
  redirect("/brands");
}
