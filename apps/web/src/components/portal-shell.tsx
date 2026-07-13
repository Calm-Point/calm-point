import { GlassPanel, Badge, Avatar } from "@calm-point/ui";
import { SignOutButton } from "./sign-out-button";
import { MobileNav } from "./mobile-nav";
import { Wordmark } from "./brand";

export function PortalShell({
  title,
  userName,
  roleLabel,
  nav,
  children,
}: {
  title: string;
  userName: string;
  roleLabel: string;
  nav: Array<{ href: string; label: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <GlassPanel className="sticky top-0 z-10 rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Wordmark markClassName="size-7" />
            <nav className="hidden items-center gap-1 sm:flex">
              {nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3.5 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone="brand">{roleLabel}</Badge>
            <span className="hidden items-center gap-2 sm:flex">
              <Avatar name={userName || roleLabel} size="sm" />
              <span className="text-sm text-ink-soft">{userName}</span>
            </span>
            <SignOutButton />
            <MobileNav nav={nav} />
          </div>
        </div>
      </GlassPanel>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mb-8 text-4xl font-medium tracking-tight">{title}</h1>
        {children}
      </main>
    </div>
  );
}
