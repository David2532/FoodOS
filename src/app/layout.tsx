import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { PwaRegistration } from "@/components/pwa-registration";
import { ThemeProvider } from "@/features/settings/theme-provider";
import { normalizeThemePreference, THEME_PREFERENCE_COOKIE } from "@/features/settings/theme-preference";

export const metadata: Metadata = {
  title: "FoodOS – dein Ernährungssystem",
  description: "Vorrat, MHD, Inhaltsstoffe, Wochenplan und Einkauf in einer App.",
  applicationName: "FoodOS",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "FoodOS" },
  formatDetection: { telephone: false }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#08130f"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const storedThemePreference = cookieStore.get(THEME_PREFERENCE_COOKIE)?.value;
  const initialThemePreference = normalizeThemePreference(storedThemePreference);
  return (
    <html lang="de" data-theme={initialThemePreference} suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}><ThemeProvider initialPreference={storedThemePreference}><PwaRegistration />{children}</ThemeProvider></body>
    </html>
  );
}
