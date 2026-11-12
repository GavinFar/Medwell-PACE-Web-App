// Form rules shared by the browser (to show messages under each field, as in Krishna's
// design) and the server (which checks again, because the browser can't be trusted).
// The wording comes from Krishna's pages (public/*.html).

export const PASSWORD_RULES = {
  length: (v: string) => v.length >= 8,
  upper: (v: string) => /[A-Z]/.test(v),
  symbol: (v: string) => /[^A-Za-z0-9\s]/.test(v),
} as const;

export type PasswordRule = keyof typeof PASSWORD_RULES;

export function passwordChecks(password: string): Record<PasswordRule, boolean> {
  return {
    length: PASSWORD_RULES.length(password),
    upper: PASSWORD_RULES.upper(password),
    symbol: PASSWORD_RULES.symbol(password),
  };
}

export function isEmail(value: string): boolean {
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

type Errors<K extends string> = Partial<Record<K, string>>;

export function passwordErrors(f: { password: string; confirmPassword: string }): Errors<"password" | "confirmPassword"> {
  const errors: Errors<"password" | "confirmPassword"> = {};
  if (!f.password) errors.password = "Please create a password.";
  else if (!Object.values(passwordChecks(f.password)).every(Boolean)) {
    errors.password = "Your password doesn’t meet all the needs listed below yet.";
  }
  // Supabase stores passwords with bcrypt, which only uses the first 72 characters.
  else if (f.password.length > 72) errors.password = "Please use 72 characters or fewer.";

  if (!f.confirmPassword) errors.confirmPassword = "Please type your password again.";
  else if (f.confirmPassword !== f.password) errors.confirmPassword = "The two passwords don’t match.";
  return errors;
}

export type SignupFields = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
  agreeSharing: boolean;
};

export function signupErrors(f: SignupFields): Errors<keyof SignupFields> {
  const errors: Errors<keyof SignupFields> = {};
  const name = f.fullName.trim();
  if (!name) errors.fullName = "Please enter your full name.";
  else if (name.length > 80) errors.fullName = "Please use 80 characters or fewer.";

  if (!f.email.trim()) errors.email = "Please enter your email address.";
  else if (!isEmail(f.email)) errors.email = "Please enter a full email address, like name@example.com.";

  Object.assign(errors, passwordErrors(f));

  if (!f.agreeTerms) errors.agreeTerms = "Please tick this box to continue.";
  if (!f.agreeSharing) errors.agreeSharing = "Please tick this box to continue.";
  return errors;
}

export function loginErrors(f: { email: string; password: string }): Errors<"email" | "password"> {
  const errors: Errors<"email" | "password"> = {};
  if (!f.email.trim()) errors.email = "Please enter your email address.";
  else if (!isEmail(f.email)) errors.email = "Please enter a full email address, like name@example.com.";
  if (!f.password) errors.password = "Please enter your password.";
  return errors;
}

// The 6-digit code from the confirmation email, or null if it isn't one.
export function readCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}
