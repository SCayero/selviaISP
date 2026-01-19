import type { Metadata } from "next";
import { Onest } from "next/font/google";
import "./globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Selvia ISP Calculator - Plan de Estudio Ideal",
  description: "Calcula tu Plan de Estudio Ideal para las oposiciones de maestro en España usando el Método Selvia v0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={onest.variable}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
