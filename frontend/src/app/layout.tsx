import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import FetchInterceptor from '@/lib/FetchInterceptor';
import ToastProvider from '@/components/shared/ToastProvider';

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
        <FetchInterceptor />
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
