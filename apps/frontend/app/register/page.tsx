import Link from "next/link";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentViewer } from "@/lib/auth";

function readQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export default async function RegisterPage({
  searchParams,
}: Readonly<{
  searchParams?: Record<string, string | string[] | undefined>;
}>) {
  const viewer = await getCurrentViewer({ tolerateErrors: true });

  if (viewer) {
    redirect("/dashboard");
  }

  const nextPath =
    typeof searchParams?.next === "string" && searchParams.next.startsWith("/")
      ? searchParams.next
      : "/dashboard";
  const errorMessage = readQueryValue(searchParams?.error);
  const initialAccountName = readQueryValue(searchParams?.accountName);
  const initialEmail = readQueryValue(searchParams?.email);

  return (
    <main className="auth-stage px-6 py-8 md:px-10 lg:px-14">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="auth-card order-2 rounded-[36px] p-6 md:p-8 lg:order-1">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Create workspace</p>
            <h1 className="font-display text-4xl text-ink md:text-5xl">
              Build your private event engine.
            </h1>
            <p className="text-sm text-slate-600">
              Already have access?{" "}
              <Link href="/login" className="font-semibold text-teal underline decoration-teal/60">
                Sign in here
              </Link>
            </p>
          </div>

          <div className="mt-8">
            <RegisterForm
              nextPath={nextPath}
              initialAccountName={initialAccountName}
              initialEmail={initialEmail}
              errorMessage={errorMessage}
            />
          </div>
        </section>

        <section className="order-1 space-y-8 lg:order-2">
          <div className="auth-pill">Distinct from the typical SaaS auth wall</div>
          <div className="space-y-5">
            <p className="text-sm uppercase tracking-[0.38em] text-slate-500">Launch stack</p>
            <h2 className="font-display text-5xl leading-[0.95] text-ink md:text-6xl">
              A sharper start for your tracking workspace.
            </h2>
            <p className="max-w-xl text-lg text-slate-700">
              Account creation provisions the workspace owner, trial subscription, and secure
              session in one pass, then routes you straight into the protected dashboard.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[28px] border border-ink/10 bg-white/75 p-5">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Provisioning</p>
              <p className="mt-3 text-base font-semibold text-ink">Workspace + owner account</p>
              <p className="mt-2 text-sm text-slate-600">
                Registration creates the account, owner user, starter subscription, and active
                session together.
              </p>
            </div>
            <div className="rounded-[28px] border border-ink/10 bg-[#f8d9a2] p-5">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-700">Security baseline</p>
              <p className="mt-3 text-base font-semibold text-ink">Role-aware dashboard access</p>
              <p className="mt-2 text-sm text-slate-700">
                Sensitive writes and billing controls are now scoped by session role before they hit
                the API.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
