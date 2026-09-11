import Navbar from "@/components/custom/navbar";
import type { Metadata, Viewport } from "next";
import { Inter, Geist } from "next/font/google";
import { SidebarProvider } from "@/context/SidebarContext";
import { Toaster } from "sonner";
import "../styles/globals.css";
import { Providers } from "./provider";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Scaninfoga: Commercial-Panel",
  description: "",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#060b17",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body className={cn(inter.className, "overflow-x-hidden bg-[#060b17] antialiased")}>
        <SidebarProvider>
          <Providers>
            <Toaster richColors position="top-right" />
            <Navbar />
            {children}
          </Providers>
        </SidebarProvider>
      </body>
    </html>
  );
}
