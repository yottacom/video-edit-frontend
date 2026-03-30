import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { DebugOverlay } from "@/components/debug/DebugOverlay";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Video Editor | AI-Powered Video Editing",
  description: "Transform your videos with AI-powered editing tools. Auto subtitles, B-roll, shorts generation, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased`}>
        <Providers>
          {children}
        </Providers>
        <DebugOverlay />
      </body>
    </html>
  );
}
