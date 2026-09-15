import { NextResponse } from "next/server";
import { Types } from "mongoose";

import { getCurrentSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Card from "@/models/Card";
import GeneratedFile from "@/models/GeneratedFile";
import Transaction from "@/models/Transaction";

export const runtime = "nodejs";

type Period = "today" | "7days" | "30days";

function getStartDate(period: Period) {
  const now = new Date();

  if (period === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (period === "7days") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);

  return start;
}

export async function GET(request: Request) {
  try {
    // ============================================================
    // Authentication
    // ============================================================

    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 },
      );
    }

    // ============================================================
    // Period
    // ============================================================

    const { searchParams } = new URL(request.url);

    const periodParam = searchParams.get("period");

    const period: Period =
      periodParam === "today" ||
      periodParam === "7days" ||
      periodParam === "30days"
        ? periodParam
        : "30days";

    // ============================================================
    // Database
    // ============================================================

    await connectToDatabase();

    const userObjectId = new Types.ObjectId(session.userId);

    const startDate = getStartDate(period);
    const endDate = new Date();

    // ============================================================
    // Base filters
    // ============================================================

    const transactionFilter = {
      userId: userObjectId,
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    const fileFilter = {
      userId: userObjectId,
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // ============================================================
    // KPI queries
    // ============================================================

    const [
      totalCards,
      totalTransactions,
      transactionSummary,
      successfulTransactions,
      pendingTransactions,
      failedTransactions,
      totalFiles,
      recentTransactions,
    ] = await Promise.all([
      Card.countDocuments({
        userId: userObjectId,
      }),

      Transaction.countDocuments(transactionFilter),

      Transaction.aggregate([
        {
          $match: transactionFilter,
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

      Transaction.countDocuments({
        ...transactionFilter,
        status: "successful",
      }),

      Transaction.countDocuments({
        ...transactionFilter,
        status: "pending",
      }),

      Transaction.countDocuments({
        ...transactionFilter,
        status: "failed",
      }),

      GeneratedFile.countDocuments(fileFilter),

      Transaction.find(transactionFilter)
        .select(
          "_id cardNumber amount status createdAt",
        )
        .sort({
          createdAt: -1,
        })
        .limit(8)
        .lean(),
    ]);

    // ============================================================
    // Daily trend
    // ============================================================

    const trendData = await Transaction.aggregate([
      {
        $match: transactionFilter,
      },

      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },

          count: {
            $sum: 1,
          },

          amount: {
            $sum: "$amount",
          },
        },
      },

      {
        $sort: {
          _id: 1,
        },
      },
    ]);

    // ============================================================
    // Create complete date range
    // ============================================================

    const trendMap = new Map<
      string,
      {
        count: number;
        amount: number;
      }
    >();

    for (const item of trendData) {
      trendMap.set(item._id, {
        count: item.count,
        amount: item.amount,
      });
    }

    const trend: Array<{
      date: string;
      count: number;
      amount: number;
    }> = [];

    const cursor = new Date(startDate);

    while (cursor <= endDate) {
      const year = cursor.getFullYear();
      const month = String(
        cursor.getMonth() + 1,
      ).padStart(2, "0");
      const day = String(
        cursor.getDate(),
      ).padStart(2, "0");

      const dateKey = `${year}-${month}-${day}`;

      const existing = trendMap.get(dateKey);

      trend.push({
        date: dateKey,
        count: existing?.count ?? 0,
        amount: existing?.amount ?? 0,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    // ============================================================
    // Response
    // ============================================================

    const totalAmount =
      transactionSummary[0]?.totalAmount ?? 0;

    return NextResponse.json(
      {
        success: true,

        data: {
          cards: {
            total: totalCards,
          },

          transactions: {
            total: totalTransactions,
            totalAmount,
            pending: pendingTransactions,
            successful: successfulTransactions,
            failed: failedTransactions,
          },

          files: {
            total: totalFiles,
          },

          trend,

          recentTransactions:
            recentTransactions.map((transaction) => ({
              id: transaction._id.toString(),
              cardNumber: transaction.cardNumber,
              amount: transaction.amount,
              status: transaction.status,
              createdAt: transaction.createdAt,
            })),
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
        message: "Unable to load dashboard statistics.",
      },
      {
        status: 500,
      },
    );
  }
}