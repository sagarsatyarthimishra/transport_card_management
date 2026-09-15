import { NextRequest, NextResponse } from "next/server";

import { Types } from "mongoose";

import { getCurrentSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { createTransactionSchema } from "@/lib/validations";

import Card from "@/models/Card";
import Transaction from "@/models/Transaction";

export const runtime = "nodejs";

/**
 * Escape special regex characters so user input
 * is treated as plain text during search.
 */
function escapeRegex(value: string): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

/**
 * GET /api/transactions
 *
 * Returns transactions belonging only to
 * the currently authenticated user.
 *
 * Supported query parameters:
 *
 * - search
 * - page
 * - limit
 * - status
 */
export async function GET(
  request: NextRequest,
) {
  try {
    // ============================================================
    // 1. Authentication
    // ============================================================

    const session =
      await getCurrentSession();

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
    // 2. Database connection
    // ============================================================

    await connectToDatabase();

    // ============================================================
    // 3. Query parameters
    // ============================================================

    const { searchParams } =
      new URL(request.url);

    const search =
      searchParams
        .get("search")
        ?.trim() ?? "";

    const pageParam = Number(
      searchParams.get("page") ?? "1",
    );

    const limitParam = Number(
      searchParams.get("limit") ?? "20",
    );

    const status =
      searchParams
        .get("status")
        ?.trim() ?? "";

    // ============================================================
    // 4. Pagination validation
    // ============================================================

    const page =
      Number.isInteger(pageParam) &&
      pageParam > 0
        ? pageParam
        : 1;

    const limit =
      Number.isInteger(limitParam) &&
      limitParam >= 1 &&
      limitParam <= 100
        ? limitParam
        : 20;

    // ============================================================
    // 5. Build user-scoped filter
    // ============================================================

    const filter: Record<
      string,
      unknown
    > = {
      userId: session.userId,
    };

    // ============================================================
    // 6. Search by card number
    // ============================================================

    if (search) {
      filter.cardNumber = {
        $regex: escapeRegex(search),
        $options: "i",
      };
    }

    // ============================================================
    // 7. Status filter
    // ============================================================

    const allowedStatuses = [
      "pending",
      "successful",
      "failed",
    ];

    if (
      status &&
      allowedStatuses.includes(status)
    ) {
      filter.status = status;
    }

    // ============================================================
    // 8. Pagination calculation
    // ============================================================

    const skip =
      (page - 1) * limit;

    // ============================================================
    // 9. Fetch transactions + total
    // ============================================================

    const [
      transactions,
      total,
    ] = await Promise.all([
      Transaction.find(filter)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      Transaction.countDocuments(
        filter,
      ),
    ]);

    // ============================================================
    // 10. Format response
    // ============================================================

    const formattedTransactions =
      transactions.map(
        (transaction) => ({
          id: transaction._id.toString(),

          cardId:
            transaction.cardId.toString(),

          cardNumber:
            transaction.cardNumber,

          amount:
            transaction.amount,

          status:
            transaction.status,

          generatedFileId:
            transaction.generatedFileId
              ?.toString() ?? null,

          createdAt:
            transaction.createdAt,

          updatedAt:
            transaction.updatedAt,
        }),
      );

    // ============================================================
    // 11. Calculate total pages
    // ============================================================

    const totalPages =
      total === 0
        ? 1
        : Math.ceil(
            total / limit,
          );

    // ============================================================
    // 12. Response
    //
    // IMPORTANT:
    // Existing API contract is preserved:
    //
    // data.transactions
    // data.pagination
    // ============================================================

    return NextResponse.json(
      {
        success: true,

        data: {
          transactions:
            formattedTransactions,

          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "Get transactions error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load transactions.",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * POST /api/transactions
 *
 * Creates ONE transaction after verifying
 * that the selected card belongs to the
 * currently logged-in user.
 *
 * NOTE:
 * This endpoint intentionally only creates
 * a transaction.
 *
 * Excel generation/file storage is handled
 * by /api/transactions/generate so that the
 * same transaction is not accidentally inserted
 * twice.
 */
export async function POST(
  request: NextRequest,
) {
  try {
    // ============================================================
    // 1. Authentication
    // ============================================================

    const session =
      await getCurrentSession();

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
    // 2. Parse request body
    // ============================================================

    const body =
      await request.json();

    // ============================================================
    // 3. Validate request
    // ============================================================

    const parsed =
      createTransactionSchema.safeParse(
        body,
      );

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            parsed.error.issues[0]
              ?.message ??
            "Invalid data.",
        },
        {
          status: 400,
        },
      );
    }

    const {
      cardId,
      amount,
    } = parsed.data;

    // ============================================================
    // 4. Validate ObjectId
    // ============================================================

    if (
      !Types.ObjectId.isValid(
        cardId,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid card.",
        },
        {
          status: 400,
        },
      );
    }

    // ============================================================
    // 5. Database connection
    // ============================================================

    await connectToDatabase();

    // ============================================================
    // 6. Verify card ownership
    //
    // A user can only create a transaction
    // against their own card.
    // ============================================================

    const card =
      await Card.findOne({
        _id: cardId,
        userId: session.userId,
      }).lean();

    if (!card) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Card not found.",
        },
        {
          status: 404,
        },
      );
    }

    // ============================================================
    // 7. Create transaction
    // ============================================================

    const transaction =
      await Transaction.create({
        userId: session.userId,

        cardId:
          card._id,

        cardNumber:
          card.cardNumber,

        amount,

        status: "pending",

        generatedFileId:
          null,
      });

    // ============================================================
    // 8. Response
    // ============================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "Transaction created successfully.",

        data: {
          id:
            transaction._id.toString(),

          cardId:
            transaction.cardId.toString(),

          cardNumber:
            transaction.cardNumber,

          amount:
            transaction.amount,

          status:
            transaction.status,

          generatedFileId:
            transaction.generatedFileId
              ?.toString() ?? null,

          createdAt:
            transaction.createdAt,

          updatedAt:
            transaction.updatedAt,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Create transaction error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to create transaction.",
      },
      {
        status: 500,
      },
    );
  }
}