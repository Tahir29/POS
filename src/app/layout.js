// src/app/layout.jsx
// Root layout — wraps the entire app in Providers.
// SEC-002: Checks token expiry immediately after Redux Persist rehydrates.
//          If the stored token is expired, auth state is cleared before
//          any protected route renders, preventing stale-token access.
// SEC-006: Bootstraps the idle timeout hook so it runs globally across
//          all authenticated sessions.

import { Geist, Geist_Mono } from "next/font/google";
import Providers from '@/components/shared/Providers';
import RehydrationGuard from '@/components/shared/RehydrationGuard';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'Lucira POS',
  description: 'Point of Sale System — Lucira Jewelry',
  icons: {
    icon: "https://luciraonline.myshopify.com/cdn/shop/files/Favicon_New_10.png?crop=center&height=32&v=1767615434&width=32",
    apple: "https://luciraonline.myshopify.com/cdn/shop/files/Favicon_New_10.png?crop=center&height=32&v=1767615434&width=32",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} font-figtree h-full antialiased`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <Providers>
          {/*
            RehydrationGuard runs two jobs on mount (client-side only):
            1. SEC-002 — Checks if the rehydrated access token is expired.
                         If so, dispatches logout() before any child renders.
            2. SEC-006 — Activates the idle timeout listener so the customer
                         session auto-detaches after 15 minutes of inactivity.
          */}
          <RehydrationGuard />
          {children}
        </Providers>
      </body>
    </html>
  );
}
