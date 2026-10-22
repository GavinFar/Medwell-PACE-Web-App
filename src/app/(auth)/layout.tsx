import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";

// Shared frame for the login and account pages: the header and footer from
// Krishna's design (public/login.html). Always light, matching that design.
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["600", "700"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "600", "700"] });

// Icon font used by the design (<span className="material-symbols-outlined">icon_name</span>).
const ICONS_CSS =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${manrope.variable} ${jakarta.variable} flex flex-1 flex-col justify-between bg-surface font-body-md text-on-surface antialiased`}
    >
      <link rel="stylesheet" href={ICONS_CSS} precedence="default" />
      <header className="w-full bg-surface/80 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
        <div className="flex h-16 w-full items-center justify-between px-margin">
          <Link href="/" className="flex items-center gap-space-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container">
              <span className="material-symbols-outlined text-[20px] text-surface-container-lowest">
                health_metrics
              </span>
            </div>
            <div className="flex items-center gap-space-xs">
              <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-primary-container">
                Medwell
              </span>
              <span className="font-label-md text-label-md font-bold uppercase tracking-wider text-secondary">
                PACE
              </span>
            </div>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-space-xs font-label-lg text-label-lg text-on-surface-variant transition-colors hover:text-primary"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col items-center justify-center bg-surface px-margin-mobile py-space-xl md:px-margin">
        {children}
      </main>

      <footer className="w-full bg-surface-container-low py-space-lg shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex w-full flex-col items-center justify-between gap-space-sm px-margin font-label-md text-label-md text-on-surface-variant sm:flex-row">
          <span>© 2026 Medwell Solutions. PACE Measurement Platform. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
