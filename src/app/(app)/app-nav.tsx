"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "../(auth)/page-chrome";

// Menu for signed-in pages (Krishna's design): across the header on computers,
// a bar at the bottom on phones. Styles: the "Signed-in menu" part of (auth)/pace-ui.css.
// Community and My profile are design pages for now (public/community.html and
// public/profile.html, sample data only), so they are plain links, not app routes.
const ITEMS = [
  { href: "/dashboard", label: "Home", short: "Home", icon: <path d="M3 11.5 12 4l9 7.5M5 10v10h5v-6h4v6h5V10" />, app: true },
  {
    href: "/community.html",
    label: "Community",
    short: "Community",
    icon: <path d="M9 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM2 21c0-3.5 3-5.5 7-5.5s7 2 7 5.5M16 4a4 4 0 0 1 0 8M22 21c0-3-2-5-5-5.4" />,
    app: false,
  },
  { href: "/profile.html", label: "My profile", short: "Profile", icon: <path d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c0-4 3.6-6 8-6s8 2 8 6" />, app: false },
];

export function AppNav({ variant }: { variant: "top" | "bottom" }) {
  const pathname = usePathname();
  return (
    <nav className={variant === "top" ? "app-nav" : "bottom-nav"} aria-label="Main">
      {ITEMS.map((item) => {
        const current = item.app && pathname === item.href ? "page" : undefined;
        const content = (
          <>
            <Icon>{item.icon}</Icon>
            {variant === "top" ? item.label : <span>{item.short}</span>}
          </>
        );
        return item.app ? (
          <Link key={item.href} href={item.href} aria-current={current}>
            {content}
          </Link>
        ) : (
          <a key={item.href} href={item.href}>
            {content}
          </a>
        );
      })}
    </nav>
  );
}
