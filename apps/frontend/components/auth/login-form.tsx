import Link from "next/link";

import { loginAction } from "@/app/actions/auth";
import { PasswordField } from "@/components/auth/password-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

export function LoginForm({
  nextPath,
  initialEmail,
  errorMessage,
}: Readonly<{
  nextPath: string;
  initialEmail?: string;
  errorMessage?: string;
}>) {
  return (
    <form action={loginAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      <div className="space-y-2">
        <label htmlFor="email" className="auth-label">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={initialEmail ?? ""}
          className="auth-input"
          placeholder="team@company.com"
          required
        />
      </div>

      <PasswordField
        id="password"
        name="password"
        label="Password"
        autoComplete="current-password"
        placeholder="Enter your password"
        required
      />

      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-teal underline decoration-teal/50">
          Forgot password?
        </Link>
      </div>

      {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

      <AuthSubmitButton idleLabel="Enter dashboard" pendingLabel="Checking session..." />

      <p className="text-sm text-slate-600">
        New here?{" "}
        <Link href="/register" className="font-semibold text-ink underline decoration-teal/60">
          Create your workspace
        </Link>
      </p>
    </form>
  );
}
