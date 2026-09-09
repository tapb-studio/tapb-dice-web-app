import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "D&D Real-Time Dice Roller",
  description:
    "A real-time, 3D physics-driven collaborative dice roller for D&D adventurers and tabletop parties.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23f59e0b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polygon points='12 2 2 8.5 2 15.5 12 22 22 15.5 22 8.5 12 2'/><line x1='12' y1='22' x2='12' y2='15.5'/><polyline points='22 8.5 12 15.5 2 8.5'/><polyline points='2 15.5 12 8.5 22 15.5'/><line x1='12' y1='2' x2='12' y2='8.5'/></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased selection:bg-amber-500 selection:text-neutral-950 flex flex-col">
        {children}
      </body>
    </html>
  );
}
