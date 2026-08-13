import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sales Command Centre",
  description: "Real-time sales enquiry dashboard for the office TV",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
