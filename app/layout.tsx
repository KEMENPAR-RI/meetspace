import type { Metadata } from 'next';
import { Geist, Geist_Mono } from "next/font/google";
import { loadBrand, ThemeVars } from './_components/brand';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Tab title + favicon follow the appearance settings.
export async function generateMetadata(): Promise<Metadata> {
  const { appName, institutionName, logoUrl } = await loadBrand();
  return {
    title: { default: appName, template: `%s - ${appName}` },
    description: institutionName ? `Pemesanan ruang rapat ${institutionName}` : 'Pemesanan ruang rapat',
    icons: logoUrl ?? '/images/logo.webp',
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Extensions (e.g. ColorZilla `cz-shortcut-listen`) inject attributes here.
    <html
      lang="id"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Cached appearance: the CSS variables ship in the prerendered shell (no colour flash). */}
        <ThemeVars />
        {children}
      </body>
    </html>
  );
}
