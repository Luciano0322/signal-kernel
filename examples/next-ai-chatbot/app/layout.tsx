import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Next AI Chatbot Example",
  description: "A plain Next.js streaming chatbot baseline.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
