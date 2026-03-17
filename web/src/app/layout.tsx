import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import TopNav from "@/components/TopNav";
import { AppProvider } from "@/context/AppContext";

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
    <html lang="en" className="dark">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className={`${manrope.variable} ${inter.variable} min-h-screen flex bg-background text-on-surface antialiased`}>
        <AppProvider>
          <Sidebar />
          <main className="flex-1 flex flex-col overflow-hidden">
            <TopNav />
            <section className="flex-1 overflow-y-auto p-12 space-y-16">
              {children}
            </section>
          </main>
        </AppProvider>
      </body>
    </html>
  );
}
