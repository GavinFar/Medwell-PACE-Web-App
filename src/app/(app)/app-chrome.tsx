import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Icon, icons } from "../(auth)/page-chrome";

// Header and footer for signed-in pages, in Krishna's design.
export function AppPage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header className="site-header">
        <div className="container">
          <Link className="logo" href="/" aria-label="Medwell PACE home">
            <span className="logo-mark">
              <Icon>
                <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z" />
              </Icon>
            </span>
            <span>
              Medwell <span className="logo-pace">PACE</span>
            </span>
          </Link>
          <nav className="header-actions" aria-label="Account">
            <Suspense fallback={null}>
              <UserChip />
            </Suspense>
            <form action={signOut}>
              <button type="submit" className="btn btn-secondary btn-small">
                Log out
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main id="main" className="dash-main">
        <div className="container">{children}</div>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <p>© 2026 Medwell Solutions</p>
          <nav className="footer-links" aria-label="Footer">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Help &amp; Support</a>
          </nav>
        </div>
      </footer>
    </>
  );
}

async function UserChip() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const name = (data?.display_name as string | null | undefined) || user.email || "Your account";
  return (
    <Link className="user-chip" href="/account">
      <Icon>{icons.person}</Icon>
      <span>{name}</span>
    </Link>
  );
}
