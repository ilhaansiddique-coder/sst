import Link from "next/link";
import type { Route } from "next";

import { logoutAction } from "@/app/actions/auth";
import { AuthSessionProvider } from "@/components/auth/auth-session-provider";
import { ViewerChip } from "@/components/auth/viewer-chip";
import { requireCurrentViewer } from "@/lib/auth";

const navigation = [
  { href: "/dashboard", label: "Overview" },
  { href: "/containers", label: "Containers" },
  { href: "/gateways", label: "Gateways" },
  { href: "/store", label: "Store" },
  { href: "/analytics", label: "Analytics" },
  { href: "/logs", label: "Logs" },
  { href: "/settings", label: "Settings" },
] satisfies Array<{ href: Route; label: string }>;

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = await requireCurrentViewer();

  return (
    <AuthSessionProvider viewer={viewer}>
      <div className="min-h-screen px-6 py-6 md:px-10">
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[290px_1fr]">
          <aside className="panel rounded-[36px] p-6">
            <div className="rounded-[28px] bg-[#163221] p-5 text-white">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-white/55">SST</p>
              <div className="mt-4">
                <ViewerChip />
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-teal">
                Control center
              </p>
              <p className="mt-3 text-sm text-slate-600">
                Session-protected routes for containers, gateways, analytics, logs, and security.
              </p>
            </div>

            <nav className="mt-8 space-y-2">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-[20px] border border-transparent px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-ink/8 hover:bg-white/90"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <form action={logoutAction} className="mt-8">
              <button type="submit" className="auth-button w-full">
                Sign out
              </button>
            </form>
          </aside>

          <div className="space-y-6">{children}</div>
        </div>
      </div>
    </AuthSessionProvider>
  );
}
