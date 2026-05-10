import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { PublicThemeProvider } from "@/components/public/public-theme-provider";
import { PublicLanguageProvider } from "@/components/public/public-language-provider";
import { AuthSessionProvider } from "@/components/auth/session-provider";
import { LANG_ORDER, type Lang } from "@/lib/i18n";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans-brand",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AFRYNTIX - Transport & Logistique Chine - Afrique de l'Ouest",
  description:
    "Fret aérien, fret maritime, envoi express, transport de véhicules et engins BTP, paiement de factures Chine ↔ Afrique de l'Ouest.",
};

const themeInitScript = `
(function(){try{var t=localStorage.getItem('afryntix-public-theme');if(t!=='light'){document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const cookieLang = store.get("afryntix_lang")?.value;
  const initialLang: Lang = (LANG_ORDER as readonly string[]).includes(cookieLang ?? "")
    ? (cookieLang as Lang)
    : "fr";
  const htmlLang = initialLang === "zh" ? "zh-CN" : initialLang === "es" ? "es" : "fr";
  return (
    <html
      lang={htmlLang}
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <AuthSessionProvider>
          <PublicThemeProvider>
            <PublicLanguageProvider initialLang={initialLang}>{children}</PublicLanguageProvider>
          </PublicThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
