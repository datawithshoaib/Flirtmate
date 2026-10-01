import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flirtmate — your playful AI companion",
  description: "A playful, consent-aware AI chat companion for adults.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
