import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./context/ThemeContext";
import { GoogleAnalytics } from "@next/third-parties/google";

const inter = Inter({ subsets: ["latin"] });

// Material Icons will be loaded via CDN in the head

export const metadata: Metadata = {
  metadataBase: new URL('https://plcautopilot.com'),
  title: {
    default: "PLCAutoPilot: AI PLC Programming & Ladder Logic Generator",
    template: "%s | PLCAutoPilot"
  },
  description: "Transform PLC specs into production-ready ladder logic in minutes with AI. Automation for Schneider Electric Modicon M221-M580. Cut development time by 80%.",
  keywords: [
    "PLC programming",
    "ladder logic",
    "industrial automation",
    "Schneider Electric",
    "EcoStruxure",
    "AI automation",
    "Modicon PLC",
    "Machine Expert",
    "Control Expert",
    "Vijeo Designer",
    "M221 programming",
    "M241 programming",
    "M251 programming",
    "M258 programming",
    "M340 programming",
    "M580 programming",
    "PLC code generator",
    "automation engineering",
    "IEC 61508",
    "safety interlocks",
    "HMI integration",
    "SCADA programming",
    "industrial control systems",
    "PLC automation software",
    "AI PLC programming",
    "automated ladder logic",
    "PLC development tool",
  ],
  authors: [
    { name: "Dr. Murali BK", url: "https://plcautopilot.com" }
  ],
  creator: "Dr. Murali BK",
  publisher: "Dr.M Hope Softwares",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://plcautopilot.com",
    title: "PLCAutoPilot: AI PLC Programming & Ladder Logic Generator",
    description: "Transform PLC specs into production-ready ladder logic in minutes with AI. Automation for Schneider Electric Modicon M221-M580. Cut development time by 80%.",
    siteName: "PLCAutoPilot",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PLCAutoPilot - AI-Powered PLC Programming Assistant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PLCAutoPilot: AI PLC Programming & Ladder Logic Generator",
    description: "Transform PLC specs into production-ready ladder logic in minutes with AI. Automation for Schneider Electric Modicon M221-M580. Cut development time by 80%.",
    images: ["/og-image.png"],
    creator: "@plcautopilot",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: "google-site-verification-code",
    yandex: "yandex-verification-code",
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "PLCAutoPilot",
              "applicationCategory": "DeveloperApplication",
              "operatingSystem": "Windows",
              "offers": {
                "@type": "AggregateOffer",
                "lowPrice": "497",
                "highPrice": "1497",
                "priceCurrency": "USD",
                "offerCount": "3"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "ratingCount": "127"
              },
              "description": "AI-powered PLC programming assistant that transforms specifications into production-ready ladder logic code for Schneider Electric EcoStruxure platforms.",
              "softwareVersion": "1.4",
              "author": {
                "@type": "Person",
                "name": "Dr. Murali BK"
              },
              "publisher": {
                "@type": "Organization",
                "name": "Dr.M Hope Softwares",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://plcautopilot.com/favicon.svg"
                }
              }
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "PLCAutoPilot",
              "url": "https://plcautopilot.com",
              "logo": "https://plcautopilot.com/favicon.svg",
              "description": "AI-powered PLC programming assistant for industrial automation",
              "founder": {
                "@type": "Person",
                "name": "Dr. Murali BK"
              },
              "sameAs": [
                "https://x.com/plcautopilot",
                "https://github.com/chatgptnotes/plcautopilot.com"
              ]
            })
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
      <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID || "G-XXXXXXXXXX"} />
    </html>
  );
}
