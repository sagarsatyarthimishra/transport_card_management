import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { normalizeCardNumber } from "@/lib/card";
import { connectToDatabase } from "@/lib/mongodb";
import { createCardSchema } from "@/lib/validations";
import SDHCard from "@/models/SDHCard";

export const runtime = "nodejs";

/**
 * Escape special regular-expression characters.
 *
 * Search input is treated as plain text.
 */
function escapeRegex(value: string): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

/**
 * GET /api/sdh/cards
 *
 * Returns SDH cards belonging to
 * the currently logged-in user.
 *
 * Response:
 *
 * {
 *   success: true,
 *   data: [...]
 * }
 */
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
    // Query parameters
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
      searchParams.get("limit") ?? "10",
    );

    const page =
      Number.isFinite(pageParam) &&
      pageParam > 0
        ? Math.floor(pageParam)
        : 1;

    const limit =
      Number.isFinite(limitParam) &&
      limitParam > 0
        ? Math.min(
            Math.floor(limitParam),
            50,
          )
        : 10;

    // ============================================================
    // Database
    // ============================================================

    await connectToDatabase();

    // ============================================================
    // Base filter
    //
    // IMPORTANT:
    // SDH cards only.
    // ============================================================

    const filter: {
      userId: string;
      cardNumberNormalized?: {
        $regex: string;
        $options: string;
      };
    } = {
      userId: session.userId,
    };

    // ============================================================
    // Search
    // ============================================================

    if (search) {
      const normalizedSearch =
        normalizeCardNumber(search);

      filter.cardNumberNormalized = {
        $regex: escapeRegex(
          normalizedSearch,
        ),
        $options: "i",
      };
    }

    // ============================================================
    // Pagination
    // ============================================================

    const skip =
      (page - 1) * limit;

    const [cards, total] =
      await Promise.all([
        SDHCard.find(filter)
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean(),

        SDHCard.countDocuments(filter),
      ]);

    // ============================================================
    // Response
    // ============================================================

    return NextResponse.json(
      {
        success: true,

        data: cards,

        pagination: {
          page,
          limit,
          total,
          totalPages:
            Math.ceil(
              total / limit,
            ),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Get SDH cards error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to fetch SDH cards.",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/sdh/cards
 *
 * Creates a new SDH card.
 */
export async function POST(
  request: Request,
) {
  try {
    // ============================================================
    // Authentication
    // ============================================================

    const session =
      await getCurrentSession();

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
    // Request body
    // ============================================================

    const body =
      await request.json();

    // Use the same validation rules
    // as MMM Card Management.
    const validationResult =
      createCardSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please enter a valid card number.",
          errors:
            validationResult.error.flatten()
              .fieldErrors,
        },
        { status: 400 },
      );
    }

    // ============================================================
    // Normalize card
    // ============================================================

    const cardNumber =
      validationResult.data.cardNumber.trim();

    const cardNumberNormalized =
      normalizeCardNumber(
        cardNumber,
      );

    // ============================================================
    // Database
    // ============================================================

    await connectToDatabase();

    // ============================================================
    // Duplicate check
    // ============================================================

    const existingCard =
      await SDHCard.findOne({
        userId: session.userId,
        cardNumberNormalized,
      });

    if (existingCard) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This SDH card already exists.",
        },
        { status: 409 },
      );
    }

    // ============================================================
    // Create SDH card
    // ============================================================

    const card =
      await SDHCard.create({
        userId: session.userId,
        cardNumber,
        cardNumberNormalized,
      });

    // ============================================================
    // Response
    // ============================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "SDH card added successfully.",

        data: {
          id: card._id.toString(),
          cardNumber: card.cardNumber,
          createdAt:
            card.createdAt,
          updatedAt:
            card.updatedAt,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error(
      "Create SDH card error:",
      error,
    );

    // MongoDB duplicate-key error
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This SDH card already exists.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to add SDH card.",
      },
      { status: 500 },
    );
  }
}