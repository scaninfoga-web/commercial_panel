import Navbar from "@/components/custom/navbar";
import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import { SidebarProvider } from '@/context/SidebarContext';
import { Toaster } from "sonner";
import "../styles/globals.css";
import Providers from "./provider";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Scaninfoga: Commercial-Panel",
  description: "",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className={inter.className}>
        <Toaster richColors position="top-right" />
        <SidebarProvider>
        <Providers>
          <Navbar />
          {children}
        </Providers>
        </SidebarProvider>
      </body>
    </html>
  );
}
