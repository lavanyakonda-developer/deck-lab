import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ExportActions } from "@/components/ExportActions";
import { ThemePicker } from "@/components/toolbar/ThemePicker";
import { UndoRedo } from "@/components/toolbar/UndoRedo";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Deck Lab",
  description: "AI-powered presentation builder",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex h-full min-h-full flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-100 px-6 dark:border-zinc-900">
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Deck Lab
          </span>
          <div className="flex items-center gap-4">
            <UndoRedo />
            <ExportActions />
            <ThemePicker />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
