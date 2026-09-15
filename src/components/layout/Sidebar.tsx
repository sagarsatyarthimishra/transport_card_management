"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CircleHelp,
  CreditCard,
  FileSpreadsheet,
  Files,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const mainNavigation = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    enabled: true,
  },
  {
    label: "MMM Card Management",
    href: "/cards",
    icon: CreditCard,
    enabled: true,
  },
  {
    label: "SDH Card Management",
    href: "/card",
    icon: CreditCard,
    enabled: true,
  },
  {
    label: "MMM Transactions",
    href: "/transactions",
    icon: WalletCards,
    enabled: true,
  },
  {
    label: "SDH Transactions",
    href: "/transaction",
    icon: WalletCards,
    enabled: true,
  },
  {
    label: "Files",
    href: "/files",
    icon: Files,
    enabled: true,
  },
  {
    label: "Create Transaction File",
    href: "/transaction-file",
    icon: FileSpreadsheet,
    enabled: false,
  },
  {
    label: "Reports & Analytics",
    href: "/reports",
    icon: BarChart3,
    enabled: false,
  },
];

const secondaryNavigation = [
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    enabled: false,
  },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand */}
        <div className="flex h-[73px] items-center justify-between border-b border-slate-200 px-5">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="group flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 transition group-hover:scale-105">
              <ShieldCheck className="h-5 w-5" />
            </div>

            <div>
              <p className="text-sm font-bold text-slate-950">
                Transport Department
              </p>

              <p className="mt-0.5 text-[11px] text-slate-500">
                Payment Management
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Main Menu
          </p>

          <nav className="space-y-1">
            {mainNavigation.map((item) => {
              const Icon = item.icon;

              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              if (!item.enabled) {
                return (
                  <div
                    key={item.label}
                    title="This module will be available soon"
                    className="group flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400"
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />

                    <span className="flex-1">{item.label}</span>

                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">
                      Soon
                    </span>
                  </div>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                      : "text-slate-600 hover:bg-blue-50 hover:text-blue-700",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-105",
                      active ? "text-white" : "text-slate-500",
                    )}
                  />

                  <span>{item.label}</span>

                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="my-5 border-t border-slate-100" />

          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            System
          </p>

          <nav className="space-y-1">
            {secondaryNavigation.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  title="This module will be available soon"
                  className="group flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400"
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />

                  <span className="flex-1">{item.label}</span>

                  <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">
                    Soon
                  </span>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Help */}
        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition group-hover:bg-blue-50 group-hover:text-blue-600">
              <CircleHelp className="h-[18px] w-[18px]" />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-700">
                Help & Support
              </p>

              <p className="text-[11px] text-slate-400">Need assistance?</p>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
