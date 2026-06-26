import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hot Telegram | Instance Manager",
  description: "Manage your Telegram API instances with ease.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
