import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";

import { getCurrentSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import SDHCard from "@/models/SDHCard";
import SDHTransaction from "@/models/SDHTransaction";

const createTransactionSchema = z.object({
  cardId: z.string().min(1),
  amount: z.number().positive(),
});

export async function GET(request: NextRequest) {
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

    await connectToDatabase();

    const searchParams = request.nextUrl.searchParams;

    const page = Math.max(
      Number(searchParams.get("page") || 1),
      1,
    );

    const allowedLimits = [10, 20, 30];

    const requestedLimit = Number(
      searchParams.get("limit") || 10,
    );

    const limit = allowedLimits.includes(
      requestedLimit,
    )
      ? requestedLimit
      : 10;

    const search =
      searchParams.get("search")?.trim() || "";

    const userId = new Types.ObjectId(
      session.userId,
    );

    const filter: Record<string, unknown> = {
      userId,
    };

    if (search) {
      const escapedSearch = search.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );

      filter.cardNumber = {
        $regex: escapedSearch,
        $options: "i",
      };
    }

    const total =
      await SDHTransaction.countDocuments(filter);

    const transactions =
      await SDHTransaction.find(filter)
        .sort({
          createdAt: -1,
          sequence: -1,
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    return NextResponse.json(
      {
        success: true,
        data: {
          transactions:
            transactions.map(
              (transaction) => ({
                _id: transaction._id.toString(),
                cardId:
                  transaction.cardId.toString(),
                cardNumber:
                  transaction.cardNumber,
                amount: transaction.amount,
                sequence:
                  transaction.sequence,
                status:
                  transaction.status,
                generatedFileId:
                  transaction.generatedFileId
                    ? transaction.generatedFileId.toString()
                    : null,
                createdAt:
                  transaction.createdAt,
                updatedAt:
                  transaction.updatedAt,
              }),
            ),

          pagination: {
            page,
            limit,
            total,
            totalPages:
              total === 0
                ? 1
                : Math.ceil(total / limit),
          },
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Get SDH transactions error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load SDH transactions.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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

    const parsed =
      createTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            parsed.error.issues[0]?.message ??
            "Invalid transaction.",
        },
        { status: 400 },
      );
    }

    const { cardId, amount } = parsed.data;

    if (!Types.ObjectId.isValid(cardId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid card.",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const userId = new Types.ObjectId(
      session.userId,
    );

    const card = await SDHCard.findOne({
      _id: cardId,
      userId,
    }).lean();

    if (!card) {
      return NextResponse.json(
        {
          success: false,
          message: "Card not found.",
        },
        { status: 404 },
      );
    }

    const lastTransaction =
      await SDHTransaction.findOne({
        userId,
      })
        .sort({
          sequence: -1,
        })
        .select("sequence")
        .lean();

    const sequence =
      (lastTransaction?.sequence ?? -1) + 1;

    const transaction =
      await SDHTransaction.create({
        userId,
        cardId: new Types.ObjectId(cardId),
        cardNumber: card.cardNumber,
        amount: Number(amount.toFixed(2)),
        sequence,
        status: "pending",
        generatedFileId: null,
      });

    return NextResponse.json(
      {
        success: true,
        message:
          "SDH transaction created successfully.",
        data: {
          _id: transaction._id.toString(),
          cardId: transaction.cardId.toString(),
          cardNumber:
            transaction.cardNumber,
          amount: transaction.amount,
          sequence:
            transaction.sequence,
          status:
            transaction.status,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Create SDH transaction error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to create SDH transaction.",
      },
      { status: 500 },
    );
  }
}