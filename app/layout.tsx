import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leftover Clock",
  description: "How old is each leftover container in your fridge? Just from photos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
