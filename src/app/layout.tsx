import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque, Manrope, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { DebugOverlay } from "@/components/debug/DebugOverlay";

const inter = Inter({ subsets: ["latin"] });

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "neuralCut — AI Video Studio for Shorts & Ads",
  description:
    "neuralCut is the AI-native video studio for brands and studios. Turn raw footage into scroll-stopping shorts and high-converting ads — auto subtitles, smart B-roll, scene intelligence, and a full timeline editor.",
  openGraph: {
    title: "neuralCut — AI Video Studio for Shorts & Ads",
    description:
      "Turn raw footage into cinema-grade shorts and ads with AI. Built for brands and studios.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${bricolage.variable} ${manrope.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable}`}
    >
      <body className={`${inter.className} antialiased`}>
        <Providers>
          {children}
        </Providers>
        <DebugOverlay />
      </body>
    </html>
  );
}
