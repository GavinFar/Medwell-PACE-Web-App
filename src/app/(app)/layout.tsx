import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import "../(auth)/pace-ui.css";
import "./dashboard.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["600", "700", "800"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "600", "700"] });

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className={`pace-ui ${manrope.variable} ${jakarta.variable}`}>{children}</div>;
}