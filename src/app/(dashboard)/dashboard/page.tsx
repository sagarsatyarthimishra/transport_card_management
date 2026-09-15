"use client";

import {
  ArrowRight,
  CreditCard,
  FileText,
  IndianRupee,
  Plus,
  Receipt,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DashboardStats {
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
  trend: Array<{
    date: string;
    count: number;
    amount: number;
  }>;
  recentTransactions: Array<{
    _id: string;
    cardNumber: string;
    amount: number;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7");

  useEffect(() => {
    fetchStats();
  }, [period]);

  const fetchStats = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `/api/dashboard/stats?period=${period}`,
        {
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (result.success) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const chartData =
    stats?.trend?.map((item) => ({
      ...item,
      name: new Date(item.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      }),
    })) || [];

  return (
    <div className="space-y-6">
      {/* =========================================================
          HEADER
      ========================================================= */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Dashboard
          </h1>

          <p className="text-muted-foreground">
            Overview of your Transport Department payment management
          </p>
        </div>

        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="h-9 w-fit rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="90">Last 90 Days</option>
        </select>
      </div>

      {/* =========================================================
          KPI CARDS
      ========================================================= */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Cards */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">
                  Total Cards
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  {loading ? "—" : stats?.cards.total ?? 0}
                </h2>

                <p className="mt-1 text-xs text-muted-foreground">
                  Registered payment cards
                </p>
              </div>

              <div className="ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100">
                <CreditCard className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Transactions */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">
                  Total Transactions
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  {loading
                    ? "—"
                    : stats?.transactions.total ?? 0}
                </h2>

                <p className="mt-1 text-xs text-muted-foreground">
                  Transactions recorded
                </p>
              </div>

              <div className="ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100">
                <Receipt className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Amount */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">
                  Total Amount
                </p>

                <h2 className="mt-2 truncate text-2xl font-bold">
                  {loading
                    ? "—"
                    : formatCurrency(
                        stats?.transactions.totalAmount ?? 0
                      )}
                </h2>

                <p className="mt-1 text-xs text-muted-foreground">
                  Total transaction value
                </p>
              </div>

              <div className="ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100">
                <IndianRupee className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Generated Files */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">
                  Generated Files
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  {loading ? "—" : stats?.files.total ?? 0}
                </h2>

                <p className="mt-1 text-xs text-muted-foreground">
                  Transaction files created
                </p>
              </div>

              <div className="ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-100">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* =========================================================
          TRANSACTION OVERVIEW
      ========================================================= */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Transaction Overview</CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                Transaction activity for the selected period
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Transaction Activity
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="h-[320px] w-full">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading transaction overview...
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No transaction data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{
                    top: 10,
                    right: 10,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                  />

                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                    allowDecimals={false}
                  />

                  <Tooltip
                    formatter={(value, name) => [
                      name === "count"
                        ? value
                        : formatCurrency(Number(value)),
                      name === "count"
                        ? "Transactions"
                        : "Amount",
                    ]}
                  />

                  <Area
                    type="monotone"
                    dataKey="count"
                    strokeWidth={2}
                    fillOpacity={0.15}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* =========================================================
          QUICK ACTIONS
      ========================================================= */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* MMM */}
        <Card>
          <CardHeader>
            <CardTitle>MMM Card Management</CardTitle>

            <p className="text-sm text-muted-foreground">
              Manage MMM cards and create MMM transactions
            </p>
          </CardHeader>

          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/cards"
                className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Cards
              </Link>

              <Link
                href="/transactions"
                className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Transaction
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* SDH */}
        <Card>
          <CardHeader>
            <CardTitle>SDH Card Management</CardTitle>

            <p className="text-sm text-muted-foreground">
              Manage SDH cards and create SDH transactions
            </p>
          </CardHeader>

          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/card"
                className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Cards
              </Link>

              <Link
                href="/transaction"
                className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Transaction
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* =========================================================
          RECENT TRANSACTIONS
      ========================================================= */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Recent Transactions</CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                Latest transactions recorded in the system
              </p>
            </div>

            <Link
              href="/transactions"
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Loading transactions...
            </div>
          ) : !stats?.recentTransactions?.length ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No transactions found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 text-sm font-medium text-muted-foreground">
                      Card Number
                    </th>

                    <th className="pb-3 text-sm font-medium text-muted-foreground">
                      Amount
                    </th>

                    <th className="pb-3 text-right text-sm font-medium text-muted-foreground">
                      Date
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {stats.recentTransactions.map(
                    (transaction) => (
                      <tr
                        key={transaction._id}
                        className="border-b last:border-0"
                      >
                        <td className="py-4 font-mono text-sm">
                          {transaction.cardNumber}
                        </td>

                        <td className="py-4 text-sm font-medium">
                          {formatCurrency(transaction.amount)}
                        </td>

                        <td className="py-4 text-right text-sm text-muted-foreground">
                          {formatDate(transaction.createdAt)}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}