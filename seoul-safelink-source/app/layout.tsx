import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAFELINK | 연쇄재난 위험지도",
  description: "서울 지역의 호우·산사태·침수 연쇄재난 위험을 확인하세요.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
