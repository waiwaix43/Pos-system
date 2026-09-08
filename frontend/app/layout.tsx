import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import StartupLoader from "./components/StartupLoader"; // เพิ่มการ Import StartupLoader

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "POS System",
  description: "ระบบจัดการหน้าร้าน POS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={inter.className}>
        {/* นำ StartupLoader มาครอบ children ไว้ */}
        <StartupLoader>
          {children}
        </StartupLoader>
      </body>
    </html>
  );
}