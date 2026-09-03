import type { Metadata } from "next";
import { Noto_Sans_Thai, Source_Sans_3, Source_Code_Pro } from "next/font/google";
import "./globals.css";

const sans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
});

const thai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai"],
  weight: ["400", "600", "700", "800"],
});

const mono = Source_Code_Pro({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Contexto",
  description:
    "Find the secret word. Each guess is ranked by semantic similarity using embeddings and a vector database.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${sans.variable} ${thai.variable} ${mono.variable} h-full antialiased lang-th`}
      suppressHydrationWarning
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
