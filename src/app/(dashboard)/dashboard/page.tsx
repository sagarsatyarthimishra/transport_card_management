"use client";

import {
  CreditCard,
  FileText,
  IndianRupee,
  Loader2,
  ReceiptText,
  RefreshCw,
  WalletCards,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type Period =
  | "7days"
  | "30days"
  | "90days";

interface DepartmentStats {
  cards: {
    total: number;
  };

  transactions: {
    total: number;
    totalAmount: number;
  };

  files: {
    total: number;
  };
}

interface TrendItem {
  date: string;
  amount: number;
  count: number;
}

interface RecentTransaction {
  id: string;
  department: "MMM" | "SDH";
  cardNumber: string;
  amount: number;
  createdAt: string;
}

interface DashboardStats {
  period: Period;
  periodDays: number;

  summary: {
    totalCards: number;
    totalTransactions: number;
    totalAmount: number;
    totalFiles: number;
  };

  mmm: DepartmentStats;

  sdh: DepartmentStats;

  trend: TrendItem[];

  recentTransactions: RecentTransaction[];
}

interface DashboardApiResponse {
  success: boolean;
  message?: string;
  data?: DashboardStats;
}

// ============================================================
// Number formatter
// ============================================================

function formatNumber(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-IN",
  ).format(value);
}

// ============================================================
// Currency formatter
// ============================================================

function formatCurrency(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    },
  ).format(value);
}

// ============================================================
// Date formatter
// ============================================================

function formatDate(
  value: string,
): string {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}

// ============================================================
// Summary Card
// ============================================================

function SummaryCard({
  title,
  value,
  description,
  icon,
  iconClassName,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  iconClassName: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-950">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Department Header
// ============================================================

function DepartmentHeader({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle: string;
  href: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-bold text-slate-950">
          {title}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {subtitle}
        </p>
      </div>

      <a
        href={href}
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      >
        <CreditCard className="h-4 w-4" />
        Manage Cards
      </a>
    </div>
  );
}

// ============================================================
// Dashboard
// ============================================================

export default function DashboardPage() {
  const [
    stats,
    setStats,
  ] = useState<DashboardStats | null>(
    null,
  );

  const [
    period,
    setPeriod,
  ] = useState<Period>(
    "7days",
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  // ==========================================================
  // Fetch dashboard
  // ==========================================================

  async function fetchDashboard(
    selectedPeriod: Period = period,
  ) {
    try {
      setError("");

      const response =
        await fetch(
          `/api/dashboard/stats?period=${selectedPeriod}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

      const result: DashboardApiResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ??
            "Unable to load dashboard.",
        );
      }

      if (
        !result.data
      ) {
        throw new Error(
          "Dashboard data is unavailable.",
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

  // ==========================================================
  // Initial / period change
  // ==========================================================

  useEffect(() => {
    void fetchDashboard(period);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // ==========================================================
  // Refresh
  // ==========================================================

  function handleRefresh() {
    setRefreshing(true);

    void fetchDashboard(period);
  }

  // ==========================================================
  // Chart maximum
  // ==========================================================

  const maxAmount = useMemo(() => {
    if (
      !stats?.trend?.length
    ) {
      return 1;
    }

    return Math.max(
      ...stats.trend.map(
        (item) =>
          item.amount,
      ),
      1,
    );
  }, [stats]);

  // ==========================================================
  // Loading
  // ==========================================================

  if (loading) {
    return (
      <main className="flex min-h-[calc(100vh-78px)] items-center justify-center bg-[#f6f9fd]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-7 w-7 animate-spin" />

          <p className="text-sm">
            Loading dashboard...
          </p>
        </div>
      </main>
    );
  }

  // ==========================================================
  // Error
  // ==========================================================

  if (
    !stats ||
    error
  ) {
    return (
      <main className="min-h-full bg-[#f6f9fd] p-4 sm:p-6">
        <div className="mx-auto max-w-[1600px]">
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
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================================
  // Render
  // ==========================================================

  return (
    <main className="min-h-full bg-[#f6f9fd]">
      <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-5 lg:p-6">

        {/* =====================================================
            HEADER
        ====================================================== */}

        <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Transport Department
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Dashboard
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Overview of MMM and SDH payment
              management.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period */}

            <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() =>
                  setPeriod("7days")
                }
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  period === "7days"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                7 Days
              </button>

              <button
                type="button"
                onClick={() =>
                  setPeriod("30days")
                }
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  period === "30days"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                30 Days
              </button>

              <button
                type="button"
                onClick={() =>
                  setPeriod("90days")
                }
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  period === "90days"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                90 Days
              </button>
            </div>

            {/* Refresh */}

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  refreshing
                    ? "animate-spin"
                    : ""
                }`}
              />

              <span className="hidden sm:inline">
                Refresh
              </span>
            </button>
          </div>
        </section>

        {/* =====================================================
            OVERALL SUMMARY
        ====================================================== */}

        <section>
          <div className="mb-3 flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-blue-600" />

            <h2 className="text-lg font-bold text-slate-950">
              Overall Summary
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Total Cards"
              value={formatNumber(
                stats.summary.totalCards,
              )}
              description="MMM + SDH registered cards"
              icon={
                <CreditCard className="h-5 w-5 text-blue-600" />
              }
              iconClassName="bg-blue-50"
            />

            <SummaryCard
              title="Total Transactions"
              value={formatNumber(
                stats.summary.totalTransactions,
              )}
              description={`Transactions in last ${stats.periodDays} days`}
              icon={
                <ReceiptText className="h-5 w-5 text-emerald-600" />
              }
              iconClassName="bg-emerald-50"
            />

            <SummaryCard
              title="Total Amount"
              value={formatCurrency(
                stats.summary.totalAmount,
              )}
              description={`Payment value in last ${stats.periodDays} days`}
              icon={
                <IndianRupee className="h-5 w-5 text-amber-600" />
              }
              iconClassName="bg-amber-50"
            />

            <SummaryCard
              title="Generated Files"
              value={formatNumber(
                stats.summary.totalFiles,
              )}
              description={`Files generated in last ${stats.periodDays} days`}
              icon={
                <FileText className="h-5 w-5 text-purple-600" />
              }
              iconClassName="bg-purple-50"
            />
          </div>
        </section>

        {/* =====================================================
            MMM
        ====================================================== */}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <DepartmentHeader
            title="MMM Payment Management"
            subtitle="MMM card, transaction and payment file statistics."
            href="/cards"
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="MMM Cards"
              value={formatNumber(
                stats.mmm.cards.total,
              )}
              description="MMM registered cards"
              icon={
                <CreditCard className="h-5 w-5 text-blue-600" />
              }
              iconClassName="bg-blue-50"
            />

            <SummaryCard
              title="MMM Transactions"
              value={formatNumber(
                stats.mmm.transactions.total,
              )}
              description={`Last ${stats.periodDays} days`}
              icon={
                <ReceiptText className="h-5 w-5 text-emerald-600" />
              }
              iconClassName="bg-emerald-50"
            />

            <SummaryCard
              title="MMM Amount"
              value={formatCurrency(
                stats.mmm.transactions
                  .totalAmount,
              )}
              description={`Last ${stats.periodDays} days`}
              icon={
                <IndianRupee className="h-5 w-5 text-amber-600" />
              }
              iconClassName="bg-amber-50"
            />

            <SummaryCard
              title="MMM Files"
              value={formatNumber(
                stats.mmm.files.total,
              )}
              description={`Last ${stats.periodDays} days`}
              icon={
                <FileText className="h-5 w-5 text-purple-600" />
              }
              iconClassName="bg-purple-50"
            />
          </div>
        </section>

        {/* =====================================================
            SDH
        ====================================================== */}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <DepartmentHeader
            title="SDH Payment Management"
            subtitle="SDH card, transaction and payment file statistics."
            href="/card"
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="SDH Cards"
              value={formatNumber(
                stats.sdh.cards.total,
              )}
              description="SDH registered cards"
              icon={
                <CreditCard className="h-5 w-5 text-blue-600" />
              }
              iconClassName="bg-blue-50"
            />

            <SummaryCard
              title="SDH Transactions"
              value={formatNumber(
                stats.sdh.transactions.total,
              )}
              description={`Last ${stats.periodDays} days`}
              icon={
                <ReceiptText className="h-5 w-5 text-emerald-600" />
              }
              iconClassName="bg-emerald-50"
            />

            <SummaryCard
              title="SDH Amount"
              value={formatCurrency(
                stats.sdh.transactions
                  .totalAmount,
              )}
              description={`Last ${stats.periodDays} days`}
              icon={
                <IndianRupee className="h-5 w-5 text-amber-600" />
              }
              iconClassName="bg-amber-50"
            />

            <SummaryCard
              title="SDH Files"
              value={formatNumber(
                stats.sdh.files.total,
              )}
              description={`Last ${stats.periodDays} days`}
              icon={
                <FileText className="h-5 w-5 text-purple-600" />
              }
              iconClassName="bg-purple-50"
            />
          </div>
        </section>

        {/* =====================================================
            TRANSACTION OVERVIEW
        ====================================================== */}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Transaction Overview
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                MMM + SDH transaction activity.
              </p>
            </div>

            <div className="text-xs font-medium text-slate-400">
              Last {stats.periodDays} days
            </div>
          </div>

          {stats.trend.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
              No transaction data available.
            </div>
          ) : (
            <div className="mt-8">
              <div className="flex h-[280px] items-end gap-1 overflow-hidden sm:gap-2">
                {stats.trend.map(
                  (item) => {
                    const height =
                      Math.max(
                        6,
                        (item.amount /
                          maxAmount) *
                          220,
                      );

                    return (
                      <div
                        key={item.date}
                        className="group flex min-w-0 flex-1 flex-col items-center justify-end"
                      >
                        <div className="pointer-events-none mb-2 hidden rounded-lg bg-slate-900 px-2 py-1 text-[10px] text-white shadow-lg group-hover:block">
                          {formatCurrency(
                            item.amount,
                          )}
                        </div>

                        <div
                          className="w-full max-w-[32px] rounded-t-md bg-blue-500 transition-all duration-200 group-hover:bg-blue-700"
                          style={{
                            height: `${height}px`,
                          }}
                          title={`${item.date}: ${formatCurrency(item.amount)}`}
                        />
                      </div>
                    );
                  },
                )}
              </div>

              <div className="mt-3 flex justify-between gap-2 overflow-hidden text-[10px] text-slate-400">
                {stats.trend.map(
                  (item) => (
                    <span
                      key={item.date}
                      className="min-w-0 truncate"
                    >
                      {new Date(
                        item.date,
                      ).toLocaleDateString(
                        "en-IN",
                        {
                          day: "2-digit",
                          month: "short",
                        },
                      )}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}
        </section>

        {/* =====================================================
            RECENT TRANSACTIONS
        ====================================================== */}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Recent Transactions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Latest MMM and SDH payment transactions.
              </p>
            </div>

            <div className="flex gap-2">
              <a
                href="/transactions"
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                MMM
              </a>

              <a
                href="/transaction"
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                SDH
              </a>
            </div>
          </div>

          {stats.recentTransactions.length ===
          0 ? (
            <div className="flex min-h-[180px] items-center justify-center px-5 text-sm text-slate-400">
              No transactions available.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Department
                    </th>

                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Card Number
                    </th>

                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Amount
                    </th>

                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Date
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {stats.recentTransactions.map(
                    (transaction) => (
                      <tr
                        key={transaction.id}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                      >
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
                              transaction.department ===
                              "MMM"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-purple-50 text-purple-700"
                            }`}
                          >
                            {transaction.department}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span className="font-mono text-sm font-semibold text-slate-800">
                            {transaction.cardNumber}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span className="text-sm font-bold text-slate-900">
                            {formatCurrency(
                              transaction.amount,
                            )}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span className="text-sm text-slate-500">
                            {formatDate(
                              transaction.createdAt,
                            )}
                          </span>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* =====================================================
            QUICK ACTIONS
        ====================================================== */}

        <section className="grid gap-4 md:grid-cols-3">
          <a
            href="/cards"
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <CreditCard className="h-5 w-5" />
            </div>

            <h3 className="mt-4 text-sm font-bold text-slate-900">
              MMM Card Management
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Add, edit, delete and manage MMM cards.
            </p>
          </a>

          <a
            href="/card"
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <CreditCard className="h-5 w-5" />
            </div>

            <h3 className="mt-4 text-sm font-bold text-slate-900">
              SDH Card Management
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Add, edit, delete and manage SDH cards.
            </p>
          </a>

          <a
            href="/files"
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <FileText className="h-5 w-5" />
            </div>

            <h3 className="mt-4 text-sm font-bold text-slate-900">
              Generated Files
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              View and download generated payment files.
            </p>
          </a>
        </section>

      </div>
    </main>
  );
}