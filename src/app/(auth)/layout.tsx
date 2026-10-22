import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";

// Shared frame for the login and account pages, in the landing-page design's
// fonts and colors. Always light, matching that design.
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["600", "700"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${manrope.variable} ${jakarta.variable} flex flex-1 flex-col bg-pace-bg font-body text-pace-ink`}
    >
      <header className="border-b border-pace-line/60 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" className="font-heading text-lg font-bold text-pace-navy">
            Medwell <span className="text-pace-red">PACE</span>
          </Link>
          <Link href="/" className="text-sm text-pace-muted hover:text-pace-navy">
            ← Back to home
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">{children}</main>
    </div>
  );
}
