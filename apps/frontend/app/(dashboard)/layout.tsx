import Link from "next/link";
import type { Route } from "next";

const navigation = [
  { href: "/dashboard", label: "Overview" },
  { href: "/containers", label: "Containers" },
  { href: "/gateways", label: "Gateways" },
  { href: "/store", label: "Store" },
  { href: "/analytics", label: "Analytics" },
  { href: "/logs", label: "Logs" },
  { href: "/settings", label: "Settings" },
] satisfies Array<{ href: Route; label: string }>;

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="panel rounded-[28px] p-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-teal">SST</p>
            <h2 className="mt-3 text-2xl font-semibold text-ink">Control center</h2>
            <p className="mt-2 text-sm text-slate-600">
              Frontend shell for containers, gateways, analytics, and logs.
            </p>
          </div>
          <nav className="mt-8 space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}
