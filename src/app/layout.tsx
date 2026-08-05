import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sales Command Centre",
  description: "Real-time sales enquiry dashboard for the office TV",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 font-sans text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
