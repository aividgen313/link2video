import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import TopNav from "@/components/TopNav";
import GlobalExportProgress from "@/components/GlobalExportProgress";
import { AppProvider } from "@/context/AppContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import ErrorBoundary from "@/components/ErrorBoundary";

const manrope = Manrope({
  variable: "--font-headline",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Link2Video AI - Creator Studio",
  description: "Convert links into AI generated videos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning className={`${manrope.variable} ${inter.variable} min-h-screen flex bg-background text-on-surface antialiased transition-colors duration-300`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {/* Atmospheric gradient orbs */}
          <div className="atmosphere">
            <div className="orb-accent" />
          </div>
          <ErrorBoundary>
            <AppProvider>
              <Sidebar />
              <main className="flex-1 flex flex-col overflow-hidden min-w-0 relative z-0">
                <TopNav />
                <section className="flex-1 overflow-y-auto pt-[72px] md:pt-0 p-4 md:p-8 space-y-6 md:space-y-8 custom-scrollbar">
                  <div className="page-enter">
                    {children}
                  </div>
                </section>
              </main>
              <GlobalExportProgress />
            </AppProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
