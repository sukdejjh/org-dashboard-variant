import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Org Dashboard",
  description: "Drilldown table (Next + TanStack Table)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "Inter, system-ui, Arial, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
