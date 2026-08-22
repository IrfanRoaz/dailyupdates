import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { TopBar } from "@/components/TopBar";
import { MainNav } from "@/components/MainNav";
import { Notices } from "@/components/Notices";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Status Dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AppProvider>
          <TopBar />
          <MainNav />
          <div id="wpcontent">
            <div id="wpbody">
              <div className="wrap">
                <Notices />
                {children}
              </div>
            </div>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
