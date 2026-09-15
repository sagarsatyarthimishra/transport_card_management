"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CreditCard,
  FileSpreadsheet,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type DashboardStats = {
  cards: {
    total: number;
  };

  transactions: {
    total: number;
    totalAmount: number;
    pending: number;
    successful: number;
    failed: number;
  };

  files: {
    total: number;
  };

  trend: Array<{
    date: string;
    count: number;
    amount: number;
  }>;

  recentTransactions: Array<{
    id: string;
    cardNumber: string;
    amount: number;
    status: "pending" | "successful" | "failed";
    createdAt: string;
  }>;
};

type Period = "7days" | "30days" | "90days";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function maskCard(value: string) {
  const normalized = value.replace(/\s+/g, "");

  if (!normalized) {
    return "—";
  }

  if (normalized.length <= 4) {
    return normalized;
  }

  return `•••• ${normalized.slice(-4)}`;
}

function StatCard({
  title,
  value,
  description,
  icon,
  iconClass,
  href,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  iconClass: string;
  href?: string;
}) {
  const content = (
    <div className="group h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block h-full">
        {content}
      </a>
    );
  }

  return content;
}

function QuickAction({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-sm"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">
          {title}
        </p>

        <p className="mt-0.5 truncate text-xs text-slate-500">
          {description}
        </p>
      </div>
    </a>
  );
}

function StatusBadge({
  status,
}: {
  status: "pending" | "successful" | "failed";
}) {
  if (status === "successful") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        Successful
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
        Failed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
      Pending
    </span>
  );
}

export default function DashboardPage() {
  const [stats, setStats] =
    useState<DashboardStats | null>(null);

  const [period, setPeriod] =
    useState<Period>("30days");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  async function fetchDashboard(
    selectedPeriod: Period = period,
  ) {
    try {
      setError("");

      const response = await fetch(
        `/api/dashboard/stats?period=${selectedPeriod}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const result =
        await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ??
            "Unable to load dashboard.",
        );
      }

      setStats(result.data);
    } catch (dashboardError) {
      console.error(
        "Dashboard loading error:",
        dashboardError,
      );

      setError(
        dashboardError instanceof Error
          ? dashboardError.message
          : "Unable to load dashboard.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchDashboard(period);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  function handleRefresh() {
    setRefreshing(true);
    fetchDashboard(period);
  }

  const maxAmount = useMemo(() => {
    if (!stats?.trend?.length) {
      return 1;
    }

    return Math.max(
      ...stats.trend.map(
        (item) => Number(item.amount) || 0,
      ),
      1,
    );
  }, [stats]);

  const successRate = useMemo(() => {
    if (!stats?.transactions.total) {
      return 0;
    }

    return (
      (stats.transactions.successful /
        stats.transactions.total) *
      100
    );
  }, [stats]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <RefreshCw className="h-7 w-7 animate-spin text-blue-600" />

          <p className="text-sm">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (!stats || error) {
    return (
      <main className="min-h-full bg-[#f6f9fd] p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h2 className="font-semibold text-red-900">
              Unable to load dashboard
            </h2>

            <p className="mt-1 text-sm text-red-700">
              {error ||
                "Dashboard data is currently unavailable."}
            </p>

            <button
              type="button"
              onClick={handleRefresh}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[#f6f9fd]">
      <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-5 lg:p-6">
        {/* =====================================================
            HEADER
        ====================================================== */}

        <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <ShieldCheck className="h-4 w-4" />
              </span>

              <p className="text-sm font-semibold text-blue-600">
                Transport Department
              </p>
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Payment Management Dashboard
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Monitor cards, transactions and generated
              payment files from one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {(
                [
                  ["7days", "7 Days"],
                  ["30days", "30 Days"],
                  ["90days", "90 Days"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setPeriod(value)
                  }
                  className={[
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    period === value
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={[
                  "h-4 w-4",
                  refreshing
                    ? "animate-spin"
                    : "",
                ].join(" ")}
              />

              Refresh
            </button>
          </div>
        </section>

        {/* =====================================================
            KPI CARDS
        ====================================================== */}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Cards"
            value={formatNumber(
              stats.cards.total,
            )}
            description="Cards available in system"
            icon={
              <CreditCard className="h-5 w-5" />
            }
            iconClass="bg-blue-50 text-blue-600"
            href="/cards"
          />

          <StatCard
            title="Total Transactions"
            value={formatNumber(
              stats.transactions.total,
            )}
            description={`${stats.transactions.pending} pending transactions`}
            icon={
              <ReceiptText className="h-5 w-5" />
            }
            iconClass="bg-violet-50 text-violet-600"
            href="/transactions"
          />

          <StatCard
            title="Total Amount"
            value={formatCurrency(
              stats.transactions.totalAmount,
            )}
            description="Transaction amount"
            icon={
              <span className="text-lg font-bold">
                ₹
              </span>
            }
            iconClass="bg-emerald-50 text-emerald-600"
          />

          <StatCard
            title="Generated Files"
            value={formatNumber(
              stats.files.total,
            )}
            description="Payment files generated"
            icon={
              <FileSpreadsheet className="h-5 w-5" />
            }
            iconClass="bg-amber-50 text-amber-600"
            href="/files"
          />
        </section>

        {/* =====================================================
            DEPARTMENT SUMMARY
        ====================================================== */}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-600 to-blue-700 p-5 text-white shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                  MMM Department
                </p>

                <p className="mt-2 text-lg font-bold">
                  MMM Payment Module
                </p>

                <p className="mt-1 text-xs text-blue-100">
                  Manage MMM cards and transactions.
                </p>
              </div>

              <CreditCard className="h-6 w-6 text-blue-100" />
            </div>

            <div className="mt-5 flex gap-2">
              <a
                href="/cards"
                className="rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold hover:bg-white/20"
              >
                Cards
              </a>

              <a
                href="/transactions"
                className="rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold hover:bg-white/20"
              >
                Transactions
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-600 to-indigo-700 p-5 text-white shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-100">
                  SDH Department
                </p>

                <p className="mt-2 text-lg font-bold">
                  SDH Payment Module
                </p>

                <p className="mt-1 text-xs text-indigo-100">
                  Manage SDH cards and transactions.
                </p>
              </div>

              <CreditCard className="h-6 w-6 text-indigo-100" />
            </div>

            <div className="mt-5 flex gap-2">
              <a
                href="/card"
                className="rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold hover:bg-white/20"
              >
                Cards
              </a>

              <a
                href="/transaction"
                className="rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold hover:bg-white/20"
              >
                Transactions
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-600 to-emerald-700 p-5 text-white shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100">
                  Success Rate
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {successRate.toFixed(1)}%
                </p>

                <p className="mt-1 text-xs text-emerald-100">
                  Successful transactions
                </p>
              </div>

              <BarChart3 className="h-6 w-6 text-emerald-100" />
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{
                  width: `${Math.min(
                    successRate,
                    100,
                  )}%`,
                }}
              />
            </div>
          </div>
        </section>

        {/* =====================================================
            CHART + QUICK ACTIONS
        ====================================================== */}

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* Chart */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Transaction Overview
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Amount and transaction count over time.
                </p>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
                  Amount
                </span>

                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Transactions
                </span>
              </div>
            </div>

            <div className="p-5">
              {stats.trend.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
                  No transaction data available.
                </div>
              ) : (
                <div className="flex h-[280px] items-end gap-2 overflow-x-auto sm:gap-3">
                  {stats.trend.map(
                    (item, index) => {
                      const amount =
                        Number(item.amount) || 0;

                      const count =
                        Number(item.count) || 0;

                      const height =
                        Math.max(
                          (amount /
                            maxAmount) *
                            190,
                          amount > 0
                            ? 8
                            : 2,
                        );

                      return (
                        <div
                          key={`${item.date}-${index}`}
                          className="flex min-w-[42px] flex-1 flex-col items-center justify-end gap-2"
                        >
                          <div className="group relative flex w-full max-w-[46px] items-end justify-center">
                            <div
                              className="w-full rounded-t-lg bg-blue-600 transition-all duration-300 group-hover:bg-blue-700"
                              style={{
                                height: `${height}px`,
                              }}
                            />

                            <div className="pointer-events-none absolute -top-12 left-1/2 hidden -translate-x-1/2 rounded-lg bg-slate-900 px-2 py-1 text-[10px] text-white shadow-lg group-hover:block">
                              {formatCurrency(amount)}
                            </div>
                          </div>

                          <p className="text-[10px] font-medium text-slate-400">
                            {new Intl.DateTimeFormat(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                              },
                            ).format(
                              new Date(
                                item.date,
                              ),
                            )}
                          </p>

                          <p className="text-[10px] font-semibold text-slate-500">
                            {count}
                          </p>
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h2 className="text-base font-bold text-slate-900">
                Quick Actions
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Frequently used payment operations.
              </p>
            </div>

            <div className="space-y-2 p-4">
              <QuickAction
                href="/transactions"
                title="Create MMM Transaction"
                description="Add MMM payments"
                icon={
                  <Plus className="h-5 w-5" />
                }
              />

              <QuickAction
                href="/transaction"
                title="Create SDH Transaction"
                description="Add SDH payments"
                icon={
                  <Plus className="h-5 w-5" />
                }
              />

              <QuickAction
                href="/cards"
                title="Manage MMM Cards"
                description="View MMM card master"
                icon={
                  <Users className="h-5 w-5" />
                }
              />

              <QuickAction
                href="/card"
                title="Manage SDH Cards"
                description="View SDH card master"
                icon={
                  <CreditCard className="h-5 w-5" />
                }
              />

              <QuickAction
                href="/files"
                title="Generated Files"
                description="Download payment files"
                icon={
                  <FileSpreadsheet className="h-5 w-5" />
                }
              />
            </div>
          </div>
        </section>

        {/* =====================================================
            TRANSACTION STATUS + RECENT TRANSACTIONS
        ====================================================== */}

        <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          {/* Status */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h2 className="text-base font-bold text-slate-900">
                Transaction Status
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Current transaction distribution.
              </p>
            </div>

            <div className="p-5">
              <div className="flex items-center gap-6">
                <div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-slate-100">
                  <div
                    className="absolute inset-2 rounded-full bg-white"
                  />

                  <div className="relative text-center">
                    <p className="text-xl font-bold text-slate-900">
                      {formatNumber(
                        stats.transactions.total,
                      )}
                    </p>

                    <p className="text-[10px] text-slate-400">
                      Total
                    </p>
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        Successful
                      </span>

                      <span className="text-xs font-bold text-slate-800">
                        {formatNumber(
                          stats.transactions.successful,
                        )}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                        Pending
                      </span>

                      <span className="text-xs font-bold text-slate-800">
                        {formatNumber(
                          stats.transactions.pending,
                        )}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                        Failed
                      </span>

                      <span className="text-xs font-bold text-slate-800">
                        {formatNumber(
                          stats.transactions.failed,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Total Amount
                  </span>

                  <span className="text-sm font-bold text-slate-900">
                    {formatCurrency(
                      stats.transactions.totalAmount,
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Recent Transactions
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Latest payment entries.
                </p>
              </div>

              <a
                href="/transactions"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                View All
              </a>
            </div>

            {stats.recentTransactions.length ===
            0 ? (
              <div className="flex min-h-[220px] items-center justify-center text-sm text-slate-400">
                No recent transactions.
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-5 py-3">
                          Card
                        </th>

                        <th className="px-5 py-3">
                          Amount
                        </th>

                        <th className="px-5 py-3">
                          Status
                        </th>

                        <th className="px-5 py-3">
                          Date
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {stats.recentTransactions
                        .slice(0, 8)
                        .map((transaction) => (
                          <tr
                            key={
                              transaction.id
                            }
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                  <CreditCard className="h-4 w-4" />
                                </div>

                                <span className="text-sm font-semibold text-slate-800">
                                  {maskCard(
                                    transaction.cardNumber,
                                  )}
                                </span>
                              </div>
                            </td>

                            <td className="px-5 py-4 text-sm font-bold text-slate-900">
                              {formatCurrency(
                                transaction.amount,
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <StatusBadge
                                status={
                                  transaction.status
                                }
                              />
                            </td>

                            <td className="px-5 py-4 text-xs text-slate-500">
                              {formatDate(
                                transaction.createdAt,
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="divide-y divide-slate-100 md:hidden">
                  {stats.recentTransactions
                    .slice(0, 6)
                    .map((transaction) => (
                      <div
                        key={
                          transaction.id
                        }
                        className="flex items-center justify-between gap-3 p-4"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <CreditCard className="h-4 w-4" />
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800">
                              {maskCard(
                                transaction.cardNumber,
                              )}
                            </p>

                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {formatDate(
                                transaction.createdAt,
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">
                            {formatCurrency(
                              transaction.amount,
                            )}
                          </p>

                          <div className="mt-1">
                            <StatusBadge
                              status={
                                transaction.status
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* =====================================================
            FOOTER QUICK LINKS
        ====================================================== */}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <a
            href="/cards"
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-200 hover:text-blue-700"
          >
            <CreditCard className="h-5 w-5 text-blue-600" />
            MMM Card Management
          </a>

          <a
            href="/card"
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-200 hover:text-blue-700"
          >
            <CreditCard className="h-5 w-5 text-indigo-600" />
            SDH Card Management
          </a>

          <a
            href="/transaction"
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-200 hover:text-blue-700"
          >
            <Plus className="h-5 w-5 text-emerald-600" />
            New SDH Transaction
          </a>

          <a
            href="/files"
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-200 hover:text-blue-700"
          >
            <Upload className="h-5 w-5 text-amber-600" />
            View Generated Files
          </a>
        </section>
      </div>
    </main>
  );
}