import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentViewer } from "@/lib/auth";

function readQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export default async function LoginPage({
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
  const initialEmail = readQueryValue(searchParams?.email);

  return (
    <main className="auth-stage px-6 py-8 md:px-10 lg:px-14">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-8">
          <div className="auth-pill">Secure workspace access</div>
          <div className="space-y-5">
            <p className="text-sm uppercase tracking-[0.38em] text-slate-500">
              Session-first control room
            </p>
            <h1 className="font-display text-5xl leading-[0.95] text-ink md:text-6xl">
              Log in without the flimsy shortcuts.
            </h1>
            <p className="max-w-xl text-lg text-slate-700">
              This flow uses secure frontend cookies, Redis-backed API sessions, and role-aware
              access checks to protect the dashboard surface end to end.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[28px] border border-ink/10 bg-white/75 p-5">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">What changed</p>
              <p className="mt-3 text-base font-semibold text-ink">No raw account query bypasses</p>
              <p className="mt-2 text-sm text-slate-600">
                Dashboard data now comes from your active session instead of trusting URL params.
              </p>
            </div>
            <div className="rounded-[28px] border border-ink/10 bg-[#163221] p-5 text-white">
              <p className="text-sm uppercase tracking-[0.24em] text-white/55">Enterprise path</p>
              <p className="mt-3 text-base font-semibold">Need SSO or access reviews?</p>
              <p className="mt-2 text-sm text-white/72">
                Start with the standard login now, then layer in higher-touch access controls later.
              </p>
            </div>
          </div>
        </section>

        <section className="auth-card rounded-[36px] p-6 md:p-8">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Welcome back</p>
            <h2 className="font-display text-4xl text-ink">Access your tracking cockpit</h2>
            <p className="text-sm text-slate-600">
              Don&apos;t have a workspace yet?{" "}
              <Link href="/register" className="font-semibold text-teal underline decoration-teal/60">
                Create one
              </Link>
            </p>
          </div>

          <div className="mt-8">
            <LoginForm
              nextPath={nextPath}
              initialEmail={initialEmail}
              errorMessage={errorMessage}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
