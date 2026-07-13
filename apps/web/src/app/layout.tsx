import type { Metadata } from "next";
import { ToastProvider } from "@calm-point/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Calm Point — Mental health care that meets you where you are",
    template: "%s · Calm Point",
  },
  description:
    "Licensed providers for ADHD, anxiety, depression, and more. Video visits, secure messaging, and support between appointments — from your phone.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
