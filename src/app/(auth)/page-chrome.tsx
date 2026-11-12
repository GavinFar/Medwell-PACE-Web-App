import Link from "next/link";

// The header, footer and icons shared by Krishna's login, sign-up, verify-email and
// reset-password pages (public/*.html), copied as-is. Styles: ./pace-ui.css.

// `back: "organizer"` is for the organizer's QR screen (from the check-in mockups): the
// header says "Organizer view" instead of a back link, and the page is wider.
export function AuthPage({
  back,
  children,
}: {
  back: "home" | "login" | "organizer";
  children: React.ReactNode;
}) {
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
          {back === "organizer" ? (
            <span className="back-link">Organizer view</span>
          ) : (
            <Link className="back-link" href={back === "home" ? "/" : "/login"}>
              <Icon>
                <path d="M19 12H5M11 5l-7 7 7 7" />
              </Icon>
              <span>
                Back<span className="back-text-long">{back === "home" ? " to home" : " to log in"}</span>
              </span>
            </Link>
          )}
        </div>
      </header>

      <main id="main" className={back === "organizer" ? "org-main" : "auth-main"}>
        {children}
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

// Krishna's line icons: 24×24, 2px stroke, rounded ends.
export function Icon({
  children,
  large = false,
  strokeWidth = 2,
}: {
  children: React.ReactNode;
  large?: boolean;
  strokeWidth?: number;
}) {
  return (
    <svg
      className={large ? "icon icon-lg" : "icon"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const icons = {
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 9.2-9.2M17 6l3 3M14.5 8.5l2 2" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
};

// The red error box used on Krishna's login and verify-email pages.
export function ErrorAlert({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div className="alert alert-error" id={id} role="alert">
      <Icon>{icons.alert}</Icon>
      <p>{children}</p>
    </div>
  );
}

// A field's error line (<p class="field-error">), shown only when there's a message.
export function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p className="field-error" id={id} hidden={!message}>
      {message}
    </p>
  );
}
