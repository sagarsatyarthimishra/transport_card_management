"use client";

import {
  BarChart3,
  Bell,
  CreditCard,
  FileText,
  Grid2X2,
  HelpCircle,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

type DashboardShellProps = {
  children: React.ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
    username?: string | null;
  };
};

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
  soon?: boolean;
};

const mainMenu: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <Grid2X2 className="h-[18px] w-[18px]" />,
  },
  {
    label: "MMM Card Management",
    href: "/cards",
    icon: <CreditCard className="h-[18px] w-[18px]" />,
  },
  {
    label: "SDH Card Management",
    href: "/card",
    icon: <CreditCard className="h-[18px] w-[18px]" />,
  },
  {
    label: "MMM Transactions",
    href: "/transactions",
    icon: <ReceiptText className="h-[18px] w-[18px]" />,
  },
  {
    label: "SDH Transactions",
    href: "/transaction",
    icon: <ReceiptText className="h-[18px] w-[18px]" />,
  },
  {
    label: "Files",
    href: "/files",
    icon: <FileText className="h-[18px] w-[18px]" />,
  },
  {
    label: "Create Transaction File",
    href: "#",
    icon: <FileText className="h-[18px] w-[18px]" />,
    disabled: true,
    soon: true,
  },
  {
    label: "Reports & Analytics",
    href: "#",
    icon: <BarChart3 className="h-[18px] w-[18px]" />,
    disabled: true,
    soon: true,
  },
];

const systemMenu: NavItem[] = [
  {
    label: "Settings",
    href: "#",
    icon: <Settings className="h-[18px] w-[18px]" />,
    disabled: true,
    soon: true,
  },
];

export default function DashboardShell({
  children,
  user,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName =
    user.name?.trim() ||
    user.username?.trim() ||
    "User";

  const displayEmail =
    user.email?.trim() || "";

  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

  /*
   * IMPORTANT:
   *
   * Exact pathname matching is used.
   *
   * Do NOT use:
   *
   * pathname.includes("/card")
   *
   * because:
   *
   * /cards and /card
   *
   * would both become active.
   */
  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return pathname === href;
  }

  function handleLogout() {
    window.location.href = "/api/auth/logout";
  }

  function renderNavItem(item: NavItem) {
    const active = isActive(item.href);

    if (item.disabled) {
      return (
        <div
          key={item.label}
          className="group flex min-h-[42px] cursor-not-allowed items-center gap-3 rounded-xl px-3 text-slate-400"
        >
          <span className="shrink-0 text-slate-400">
            {item.icon}
          </span>

          <span className="min-w-0 flex-1 text-sm font-medium">
            {item.label}
          </span>

          {item.soon && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
              Soon
            </span>
          )}
        </div>
      );
    }

    return (
      <a
        key={item.label}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={[
          "group relative flex min-h-[42px] items-center gap-3 rounded-xl px-3 text-sm transition-all duration-200",
          active
            ? "bg-blue-600 font-semibold text-white shadow-md shadow-blue-600/20"
            : "font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700",
        ].join(" ")}
      >
        <span
          className={
            active
              ? "shrink-0 text-white"
              : "shrink-0 text-slate-500 group-hover:text-blue-600"
          }
        >
          {item.icon}
        </span>

        <span className="min-w-0 flex-1 truncate">
          {item.label}
        </span>

        {active && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
        )}
      </a>
    );
  }

  const sidebar = (
    <aside className="flex h-full w-[256px] flex-col border-r border-slate-200 bg-white">
      {/* Brand */}
      <div className="flex h-[78px] shrink-0 items-center border-b border-slate-200 px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/20">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-slate-900">
              Transport Department
            </p>

            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Payment Management
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          Main Menu
        </p>

        <nav className="space-y-1">
          {mainMenu.map(renderNavItem)}
        </nav>

        <div className="my-5 border-t border-slate-100" />

        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          System
        </p>

        <nav className="space-y-1">
          {systemMenu.map(renderNavItem)}
        </nav>
      </div>

      {/* Bottom user */}
      <div className="shrink-0 border-t border-slate-200 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            {initials}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {displayName}
            </p>

            <p className="truncate text-[11px] text-slate-500">
              {displayEmail}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign Out
        </button>

        <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Transport Payment System</span>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-[#f6f9fd]">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        {sidebar}
      </div>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-slate-900/40"
          />

          <div className="relative h-full">
            {sidebar}

            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-[78px] shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden sm:block">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Payment Management
              </p>

              <p className="text-sm font-semibold text-slate-800">
                Transport Department
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="hidden w-[280px] md:block">
              <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
                <svg
                  className="h-4 w-4 shrink-0 text-slate-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-4-4" />
                </svg>

                <input
                  type="text"
                  placeholder="Search cards, files..."
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Notification */}
            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-blue-600"
            >
              <Bell className="h-[18px] w-[18px]" />

              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-blue-600" />
            </button>

            {/* User */}
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                {initials}
              </div>

              <div className="hidden lg:block">
                <p className="max-w-[150px] truncate text-xs font-semibold text-slate-800">
                  {displayName}
                </p>

                <p className="text-[10px] text-slate-400">
                  Transport Department
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}