import type { Metadata } from "next";
import { DM_Mono, Lora, Manrope } from "next/font/google";
import "./styles.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MUKTI-SETU | Justice Intelligence Console",
  description: "Auditable human-in-the-loop undertrial review console under Section 479 BNSS.",
  keywords: ["Justice Intelligence", "Section 479", "Undertrial Review", "Legal Aid", "Bail Eligibility"],
  openGraph: {
    title: "MUKTI-SETU | Justice Intelligence Console",
    description: "Auditable human-in-the-loop undertrial review console under Section 479 BNSS.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${dmMono.variable} ${lora.variable}`}>
      <body>{children}</body>
    </html>
  );
}
