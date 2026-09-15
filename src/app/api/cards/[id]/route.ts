import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { normalizeCardNumber } from "@/lib/card";
import { connectToDatabase } from "@/lib/mongodb";
import { updateCardSchema } from "@/lib/validations";
import Card from "@/models/Card";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const body = await request.json();

    const validationResult = updateCardSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter a valid card number.",
          errors: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const cardNumber = validationResult.data.cardNumber.trim();

    const cardNumberNormalized = normalizeCardNumber(cardNumber);

    await connectToDatabase();

    const existingCard = await Card.findOne({
      userId: session.userId,
      cardNumberNormalized,
      _id: { $ne: id },
    });

    if (existingCard) {
      return NextResponse.json(
        {
          success: false,
          message: "This card already exists.",
        },
        { status: 409 }
      );
    }

    const card = await Card.findOneAndUpdate(
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
      }
    ).lean();

    if (!card) {
      return NextResponse.json(
        {
          success: false,
          message: "Card not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Card updated successfully.",
      data: {
        id: card._id.toString(),
        cardNumber: card.cardNumber,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update card error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update card.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    await connectToDatabase();

    const deletedCard = await Card.findOneAndDelete({
      _id: id,
      userId: session.userId,
    });

    if (!deletedCard) {
      return NextResponse.json(
        {
          success: false,
          message: "Card not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Card deleted successfully.",
    });
  } catch (error) {
    console.error("Delete card error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to delete card.",
      },
      { status: 500 }
    );
  }
}