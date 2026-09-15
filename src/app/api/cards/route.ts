import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { normalizeCardNumber } from "@/lib/card";
import { connectToDatabase } from "@/lib/mongodb";
import { createCardSchema } from "@/lib/validations";
import Card from "@/models/Card";

export const runtime = "nodejs";

/**
 * Escape special regular-expression characters.
 *
 * This keeps card search safe when the user enters
 * search characters.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET /api/cards
 *
 * Returns cards belonging to the currently logged-in user.
 *
 * IMPORTANT:
 * The response structure is intentionally kept compatible
 * with the existing CardsPage:
 *
 * data: [...]
 */
export async function GET(request: Request) {
  try {
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

    const { searchParams } = new URL(request.url);

    const search =
      searchParams.get("search")?.trim() ?? "";

    const pageParam = Number(
      searchParams.get("page") ?? "1",
    );

    const limitParam = Number(
      searchParams.get("limit") ?? "10",
    );

    const page =
      Number.isFinite(pageParam) && pageParam > 0
        ? Math.floor(pageParam)
        : 1;

    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(Math.floor(limitParam), 50)
        : 10;

    await connectToDatabase();

    /**
     * Base filter.
     *
     * Only cards belonging to the current user
     * can ever be returned.
     */
    const filter: {
      userId: string;
      cardNumberNormalized?: {
        $regex: string;
        $options: string;
      };
    } = {
      userId: session.userId,
    };

    /**
     * Search card number.
     */
    if (search) {
      filter.cardNumberNormalized = {
        $regex: escapeRegex(search),
        $options: "i",
      };
    }

    const skip = (page - 1) * limit;

    const [cards, total] = await Promise.all([
      Card.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Card.countDocuments(filter),
    ]);

    /**
     * KEEP THE EXISTING RESPONSE STRUCTURE.
     *
     * CardsPage already expects:
     *
     * result.data
     *
     * to be an array.
     */
    return NextResponse.json(
      {
        success: true,
        data: cards,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Get cards error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to fetch cards.",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/cards
 *
 * Creates a new card for the current user.
 */
export async function POST(request: Request) {
  try {
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

    const body = await request.json();

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

    const cardNumber =
      validationResult.data.cardNumber.trim();

    const cardNumberNormalized =
      normalizeCardNumber(cardNumber);

    await connectToDatabase();

    const existingCard = await Card.findOne({
      userId: session.userId,
      cardNumberNormalized,
    });

    if (existingCard) {
      return NextResponse.json(
        {
          success: false,
          message: "This card already exists.",
        },
        { status: 409 },
      );
    }

    const card = await Card.create({
      userId: session.userId,
      cardNumber,
      cardNumberNormalized,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Card added successfully.",
        data: {
          id: card._id.toString(),
          cardNumber: card.cardNumber,
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("Create card error:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "This card already exists.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Unable to add card.",
      },
      { status: 500 },
    );
  }
}