import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "Metro Kyiv — маршрути київським метро",
    description:
      "Офлайн-планувальник поїздок Київським метрополітеном: 52 станції, пересадки, час, схема та найближча станція.",
    applicationName: "Metro Kyiv",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: "Metro Kyiv",
      statusBarStyle: "black-translucent",
    },
    openGraph: {
      title: "Metro Kyiv — місто ближче",
      description: "Найкоротший маршрут, 52 станції та жива схема — навіть офлайн.",
      type: "website",
      locale: "uk_UA",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 632, alt: "Metro Kyiv" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Metro Kyiv — місто ближче",
      description: "Найкоротший маршрут київським метро — навіть офлайн.",
      images: [`${origin}/og.png`],
    },
    icons: {
      icon: "/metro-logo.svg",
      shortcut: "/metro-logo.svg",
      apple: "/metro-logo.svg",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <body className={`${inter.variable} ${manrope.variable}`}>
        {children}
      </body>
    </html>
  );
}
