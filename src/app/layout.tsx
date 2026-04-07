import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = {
  title: "XSMB Analytics - Thống kê xổ số miền Bắc",
  description: "Hệ thống thống kê và dự đoán kết quả xổ số miền Bắc (XSMB) với phân tích xác suất nâng cao, tần suất xuất hiện, và các dự đoán thông minh.",
  keywords: ["xổ số miền bắc", "XSMB", "lô đề", "thống kê xổ số", "dự đoán xổ số", "loto"],
  openGraph: {
    title: "XSMB Analytics",
    description: "Thống kê và dự đoán xổ số miền Bắc",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
