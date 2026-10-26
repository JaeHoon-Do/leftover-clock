import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { PersistStorage } from "@/components/PersistStorage";
import "./globals.css";

const display = Fredoka({ variable: "--font-display", subsets: ["latin"] });
const body = Nunito({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Leftover Clock",
  description: "How old is each leftover container in your fridge? Just from photos.",
};

export const viewport: Viewport = {
  themeColor: "#fff8ee",
  // Light only: the palette has no dark variant, and auto-darkened pins looked wrong.
  colorScheme: "only light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <PersistStorage />
        {children}
      </body>
    </html>
  );
}
