import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Renata Matos • Gestão & Faturamento",
  description: "Painel de gestão operacional, agendamentos e faturamento de serviços de limpeza.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ServiceWorkerRegister />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
