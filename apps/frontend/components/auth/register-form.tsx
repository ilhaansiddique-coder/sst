import { registerAction } from "@/app/actions/auth";
import { PasswordField } from "@/components/auth/password-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

export function RegisterForm({
  nextPath,
  initialAccountName,
  initialEmail,
  errorMessage,
}: Readonly<{
  nextPath: string;
  initialAccountName?: string;
  initialEmail?: string;
  errorMessage?: string;
}>) {
  return (
    <form action={registerAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="accountName" className="auth-label">
            Workspace name
          </label>
          <input
            id="accountName"
            name="accountName"
            type="text"
            autoComplete="organization"
            defaultValue={initialAccountName ?? ""}
            className="auth-input"
            placeholder="Northern Signal Studio"
            required
          />
        </div>

        <div className="space-y-2 md:col-span-2">
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
            placeholder="founder@company.com"
            required
          />
        </div>

        <PasswordField
          id="password"
          name="password"
          label="Password"
          autoComplete="new-password"
          placeholder="Minimum 12 characters"
          required
        />

        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          required
        />
      </div>

      {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

      <p className="text-xs text-slate-500">
        Use at least 12 characters with uppercase, lowercase, a number, and a symbol.
      </p>

      <AuthSubmitButton idleLabel="Create workspace" pendingLabel="Creating workspace..." />
    </form>
  );
}
