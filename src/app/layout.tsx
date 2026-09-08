import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tra cứu vé Vietjet",
  description: "Tra cứu vé Vietjet theo mã đặt chỗ, xuất text dán CSKH",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
