import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Types } from "mongoose";
import { getCurrentSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { normalizeCardNumber } from "@/lib/card";
import Card from "@/models/Card";

export const runtime = "nodejs";

function getCellText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object") {
    const objectValue = value as {
      text?: string;
      result?: unknown;
    };

    if (typeof objectValue.text === "string") {
      return objectValue.text.trim();
    }

    if (
      typeof objectValue.result === "string" ||
      typeof objectValue.result === "number"
    ) {
      return String(objectValue.result).trim();
    }
  }

  return "";
}

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

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please select an Excel file.",
        },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        {
          success: false,
          message: "Only .xlsx files are supported.",
        },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "The selected file is empty.",
        },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();

    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      return NextResponse.json(
        {
          success: false,
          message: "The Excel file does not contain a worksheet.",
        },
        { status: 400 },
      );
    }

    const cardsByNormalized = new Map<string, string>();

    let totalRows = 0;
    let invalidRows = 0;

    worksheet.eachRow((row) => {
      totalRows += 1;

      const rawCardNumber = getCellText(row.getCell(1).value);

      const normalized = normalizeCardNumber(rawCardNumber);

      if (!normalized) {
        invalidRows += 1;
        return;
      }

      if (!cardsByNormalized.has(normalized)) {
        cardsByNormalized.set(normalized, rawCardNumber.trim());
      }
    });

    const uniqueCards = Array.from(cardsByNormalized.entries());

    if (uniqueCards.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No valid card numbers were found in column A.",
          summary: {
            totalRows,
            validRows: 0,
            imported: 0,
            skippedDuplicates: 0,
            invalidRows,
          },
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const userObjectId = new Types.ObjectId(session.userId);
    const operations = uniqueCards.map(
      ([cardNumberNormalized, cardNumber]) => ({
        updateOne: {
          filter: {
            userId: userObjectId,
            cardNumberNormalized,
          },
          update: {
            $setOnInsert: {
              userId: userObjectId,
              cardNumber,
              cardNumberNormalized,
            },
          },
          upsert: true,
        },
      }),
    );

    const result = await Card.bulkWrite(operations, {
      ordered: false,
    });

    const imported = result.upsertedCount;

    const validRows = totalRows - invalidRows;

    const skippedDuplicates = Math.max(0, validRows - imported);

    return NextResponse.json(
      {
        success: true,
        message: "Card import completed successfully.",
        summary: {
          totalRows,
          validRows,
          imported,
          skippedDuplicates,
          invalidRows,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Card import error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to import cards. Please make sure the Excel file is valid.",
      },
      { status: 500 },
    );
  }
}
