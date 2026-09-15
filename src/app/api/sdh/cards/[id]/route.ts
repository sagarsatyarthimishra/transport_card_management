import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { normalizeCardNumber } from "@/lib/card";
import { connectToDatabase } from "@/lib/mongodb";
import { updateCardSchema } from "@/lib/validations";
import SDHCard from "@/models/SDHCard";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * PATCH /api/sdh/cards/[id]
 *
 * Update SDH card.
 */
export async function PATCH(
  request: Request,
  context: RouteContext,
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
    // Card ID
    // ============================================================

    const { id } =
      await context.params;

    // ============================================================
    // Request body
    // ============================================================

    const body =
      await request.json();

    const validationResult =
      updateCardSchema.safeParse(body);

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
    // Normalize
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
        _id: {
          $ne: id,
        },
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
    // Update
    // ============================================================

    const card =
      await SDHCard.findOneAndUpdate(
        {
          _id: id,
          userId: session.userId,
        },
        {
          cardNumber,
          cardNumberNormalized,
        },
        {
          new: true,
          runValidators: true,
        },
      ).lean();

    if (!card) {
      return NextResponse.json(
        {
          success: false,
          message:
            "SDH card not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,

        message:
          "SDH card updated successfully.",

        data: {
          id: card._id.toString(),
          cardNumber:
            card.cardNumber,
          createdAt:
            card.createdAt,
          updatedAt:
            card.updatedAt,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Update SDH card error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to update SDH card.",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/sdh/cards/[id]
 *
 * Delete SDH card.
 */
export async function DELETE(
  _request: Request,
  context: RouteContext,
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
    // Card ID
    // ============================================================

    const { id } =
      await context.params;

    // ============================================================
    // Database
    // ============================================================

    await connectToDatabase();

    // ============================================================
    // Delete only current user's SDH card
    // ============================================================

    const deletedCard =
      await SDHCard.findOneAndDelete({
        _id: id,
        userId: session.userId,
      });

    if (!deletedCard) {
      return NextResponse.json(
        {
          success: false,
          message:
            "SDH card not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "SDH card deleted successfully.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Delete SDH card error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to delete SDH card.",
      },
      { status: 500 },
    );
  }
}