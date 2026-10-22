import type { CookieOptions } from "@supabase/ssr";

// "Remember Me" on the login page. Supabase's session cookies last 400 days by
// default. When the box is unchecked we set this cookie to "0", and every Supabase
// client then drops the cookies' lifetimes, so the browser forgets the session
// when it closes.
export const REMEMBER_COOKIE = "pace-remember";

export function applyRemember(options: CookieOptions, remember: boolean): CookieOptions {
  // maxAge 0 means "delete this cookie" (sign-out), which must keep working.
  if (remember || options.maxAge === 0) return options;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { maxAge, expires, ...sessionOnly } = options;
  return sessionOnly;
}
