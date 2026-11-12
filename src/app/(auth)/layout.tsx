import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import "./pace-ui.css";

// Shared frame for Krishna's login, sign-up, verify-email and reset-password pages
// (public/*.html). Each page draws its own header and footer with <AuthPage>
// (./page-chrome.tsx), because the "Back to …" link differs per page.
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["600", "700", "800"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "600", "700"] });

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className={`pace-ui ${manrope.variable} ${jakarta.variable}`}>{children}</div>;
}
