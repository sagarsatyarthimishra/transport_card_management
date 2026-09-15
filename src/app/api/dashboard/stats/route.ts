import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";

import Card from "@/models/Card";
import SDHCard from "@/models/SDHCard";

import Transaction from "@/models/Transaction";
import SDHTransaction from "@/models/SDHTransaction";

import GeneratedFile from "@/models/GeneratedFile";

export const runtime = "nodejs";

type Period = "7days" | "30days" | "90days";

function getPeriodStart(period: Period): Date {
  const now = new Date();

  const days =
    period === "7days"
      ? 7
      : period === "90days"
        ? 90
        : 30;

  const start = new Date(now);

  start.setDate(start.getDate() - days);

  return start;
}

function getPeriodDays(period: Period): number {
  if (period === "7days") {
    return 7;
  }

  if (period === "90days") {
    return 90;
  }

  return 30;
}

function escapeRegex(value: string): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

export async function GET(request: Request) {
  try {
    // ============================================================
    // 1. Authentication
    // ============================================================

    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }

    // ============================================================
    // 2. Period
    // ============================================================

    const { searchParams } = new URL(request.url);

    const requestedPeriod =
      searchParams.get("period")?.toLowerCase();

    const period: Period =
      requestedPeriod === "7days" ||
      requestedPeriod === "90days"
        ? requestedPeriod
        : "30days";

    const periodStart = getPeriodStart(period);
    const periodDays = getPeriodDays(period);

    // ============================================================
    // 3. Database
    // ============================================================

    await connectToDatabase();

    // ============================================================
    // 4. User ID
    // ============================================================

    const userId = session.userId;

    // ============================================================
    // 5. Transaction date filter
    // ============================================================

    const transactionDateFilter = {
      userId,
      createdAt: {
        $gte: periodStart,
      },
    };

    // ============================================================
    // 6. Count cards
    //
    // Cards are all-time counts.
    // ============================================================

    const [
      mmmCardCount,
      sdhCardCount,
    ] = await Promise.all([
      Card.countDocuments({
        userId,
      }),

      SDHCard.countDocuments({
        userId,
      }),
    ]);

    // ============================================================
    // 7. MMM transaction statistics
    // ============================================================

    const [
      mmmTransactionCount,
      mmmAmountResult,
    ] = await Promise.all([
      Transaction.countDocuments(
        transactionDateFilter,
      ),

      Transaction.aggregate([
        {
          $match: transactionDateFilter,
        },

        {
          $group: {
            _id: null,
            totalAmount: {
              $sum: "$amount",
            },
          },
        },
      ]),
    ]);

    // ============================================================
    // 8. SDH transaction statistics
    // ============================================================

    const [
      sdhTransactionCount,
      sdhAmountResult,
    ] = await Promise.all([
      SDHTransaction.countDocuments(
        transactionDateFilter,
      ),

      SDHTransaction.aggregate([
        {
          $match: transactionDateFilter,
        },

        {
          $group: {
            _id: null,
            totalAmount: {
              $sum: "$amount",
            },
          },
        },
      ]),
    ]);

    // ============================================================
    // 9. Amounts
    // ============================================================

    const mmmAmount = Number(
      mmmAmountResult?.[0]?.totalAmount ?? 0,
    );

    const sdhAmount = Number(
      sdhAmountResult?.[0]?.totalAmount ?? 0,
    );

    // ============================================================
    // 10. Generated files
    //
    // MMM:
    // SALARY_MMM11473...
    //
    // SDH:
    // SALARY_SDH09066...
    //
    // Files are shared in GeneratedFile collection.
    // ============================================================

    const fileDateFilter = {
      userId,
      createdAt: {
        $gte: periodStart,
      },
    };

    const [
      mmmFileCount,
      sdhFileCount,
    ] = await Promise.all([
      GeneratedFile.countDocuments({
        ...fileDateFilter,

        fileName: {
          $regex: `^SALARY_${escapeRegex(
            "MMM11473",
          )}_`,
          $options: "i",
        },
      }),

      GeneratedFile.countDocuments({
        ...fileDateFilter,

        fileName: {
          $regex: `^SALARY_${escapeRegex(
            "SDH09066",
          )}_`,
          $options: "i",
        },
      }),
    ]);

    // ============================================================
    // 11. Transaction overview
    //
    // Combined MMM + SDH amount per day.
    // ============================================================

    const [
      mmmTrend,
      sdhTrend,
    ] = await Promise.all([
      Transaction.aggregate([
        {
          $match: transactionDateFilter,
        },

        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },

            amount: {
              $sum: "$amount",
            },

            count: {
              $sum: 1,
            },
          },
        },

        {
          $sort: {
            _id: 1,
          },
        },
      ]),

      SDHTransaction.aggregate([
        {
          $match: transactionDateFilter,
        },

        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },

            amount: {
              $sum: "$amount",
            },

            count: {
              $sum: 1,
            },
          },
        },

        {
          $sort: {
            _id: 1,
          },
        },
      ]),
    ]);

    // ============================================================
    // 12. Merge MMM + SDH trend
    // ============================================================

    const trendMap = new Map<
      string,
      {
        date: string;
        amount: number;
        count: number;
      }
    >();

    for (const item of mmmTrend) {
      trendMap.set(item._id, {
        date: item._id,
        amount: Number(item.amount ?? 0),
        count: Number(item.count ?? 0),
      });
    }

    for (const item of sdhTrend) {
      const existing = trendMap.get(item._id);

      if (existing) {
        existing.amount += Number(
          item.amount ?? 0,
        );

        existing.count += Number(
          item.count ?? 0,
        );
      } else {
        trendMap.set(item._id, {
          date: item._id,
          amount: Number(item.amount ?? 0),
          count: Number(item.count ?? 0),
        });
      }
    }

    const trend = Array.from(
      trendMap.values(),
    ).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    // ============================================================
    // 13. Recent MMM transactions
    // ============================================================

    const recentMMM =
      await Transaction.find({
        userId,
      })
        .select(
          "cardNumber amount createdAt",
        )
        .sort({
          createdAt: -1,
        })
        .limit(5)
        .lean();

    // ============================================================
    // 14. Recent SDH transactions
    // ============================================================

    const recentSDH =
      await SDHTransaction.find({
        userId,
      })
        .select(
          "cardNumber amount createdAt",
        )
        .sort({
          createdAt: -1,
        })
        .limit(5)
        .lean();

    // ============================================================
    // 15. Merge recent transactions
    // ============================================================

    const recentTransactions = [
      ...recentMMM.map(
        (transaction) => ({
          id: transaction._id.toString(),

          department: "MMM",

          cardNumber:
            transaction.cardNumber,

          amount:
            Number(transaction.amount),

          createdAt:
            transaction.createdAt,
        }),
      ),

      ...recentSDH.map(
        (transaction) => ({
          id: transaction._id.toString(),

          department: "SDH",

          cardNumber:
            transaction.cardNumber,

          amount:
            Number(transaction.amount),

          createdAt:
            transaction.createdAt,
        }),
      ),
    ]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      )
      .slice(0, 8);

    // ============================================================
    // 16. Combined values
    // ============================================================

    const totalCards =
      mmmCardCount + sdhCardCount;

    const totalTransactions =
      mmmTransactionCount +
      sdhTransactionCount;

    const totalAmount =
      mmmAmount + sdhAmount;

    const totalFiles =
      mmmFileCount + sdhFileCount;

    // ============================================================
    // 17. Response
    // ============================================================

    return NextResponse.json(
      {
        success: true,

        data: {
          period,

          periodDays,

          summary: {
            totalCards,

            totalTransactions,

            totalAmount,

            totalFiles,
          },

          mmm: {
            cards: {
              total: mmmCardCount,
            },

            transactions: {
              total: mmmTransactionCount,

              totalAmount: mmmAmount,
            },

            files: {
              total: mmmFileCount,
            },
          },

          sdh: {
            cards: {
              total: sdhCardCount,
            },

            transactions: {
              total: sdhTransactionCount,

              totalAmount: sdhAmount,
            },

            files: {
              total: sdhFileCount,
            },
          },

          trend,

          recentTransactions,
        },
      },

      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "Dashboard stats error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load dashboard statistics.",
      },
      {
        status: 500,
      },
    );
  }
}