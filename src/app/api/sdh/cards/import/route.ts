import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Types } from "mongoose";

import { getCurrentSession } from "@/lib/auth";
import { normalizeCardNumber } from "@/lib/card";
import { connectToDatabase } from "@/lib/mongodb";
import SDHCard from "@/models/SDHCard";

export const runtime = "nodejs";

function getCellText(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined
  ) {
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

  if (
    typeof value === "object" &&
    value !== null
  ) {
    const objectValue =
      value as {
        text?: string;
        result?: unknown;
      };

    if (
      typeof objectValue.text ===
      "string"
    ) {
      return objectValue.text.trim();
    }

    if (
      typeof objectValue.result ===
        "string" ||
      typeof objectValue.result ===
        "number"
    ) {
      return String(
        objectValue.result,
      ).trim();
    }
  }

  return "";
}

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
    // Form data
    // ============================================================

    const formData =
      await request.formData();

    const file =
      formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please select an Excel file.",
        },
        { status: 400 },
      );
    }

    // ============================================================
    // File validation
    // ============================================================

    if (
      !file.name
        .toLowerCase()
        .endsWith(".xlsx")
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only .xlsx files are supported.",
        },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The selected file is empty.",
        },
        { status: 400 },
      );
    }

    // ============================================================
    // Read workbook
    // ============================================================

    const arrayBuffer =
      await file.arrayBuffer();

    const workbook =
      new ExcelJS.Workbook();

    await workbook.xlsx.load(
      arrayBuffer,
    );

    const worksheet =
      workbook.worksheets[0];

    if (!worksheet) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The Excel file does not contain a worksheet.",
        },
        { status: 400 },
      );
    }

    // ============================================================
    // Read cards
    //
    // Card number must be in column A.
    // ============================================================

    const cardsByNormalized =
      new Map<string, string>();

    let totalRows = 0;
    let invalidRows = 0;

    worksheet.eachRow((row) => {
      totalRows += 1;

      const rawCardNumber =
        getCellText(
          row.getCell(1).value,
        );

      const normalized =
        normalizeCardNumber(
          rawCardNumber,
        );

      if (!normalized) {
        invalidRows += 1;
        return;
      }

      if (
        !cardsByNormalized.has(
          normalized,
        )
      ) {
        cardsByNormalized.set(
          normalized,
          rawCardNumber.trim(),
        );
      }
    });

    const uniqueCards =
      Array.from(
        cardsByNormalized.entries(),
      );

    if (uniqueCards.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No valid card numbers were found in column A.",

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

    // ============================================================
    // Database
    // ============================================================

    await connectToDatabase();

    const userObjectId =
      new Types.ObjectId(
        session.userId,
      );

    // ============================================================
    // Bulk upsert
    // ============================================================

    const operations =
      uniqueCards.map(
        ([
          cardNumberNormalized,
          cardNumber,
        ]) => ({
          updateOne: {
            filter: {
              userId:
                userObjectId,

              cardNumberNormalized,
            },

            update: {
              $setOnInsert: {
                userId:
                  userObjectId,

                cardNumber,

                cardNumberNormalized,
              },
            },

            upsert: true,
          },
        }),
      );

    const result =
      await SDHCard.bulkWrite(
        operations,
        {
          ordered: false,
        },
      );

    const imported =
      result.upsertedCount;

    const validRows =
      totalRows - invalidRows;

    const skippedDuplicates =
      Math.max(
        0,
        validRows - imported,
      );

    // ============================================================
    // Response
    // ============================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "SDH card import completed successfully.",

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
    console.error(
      "SDH card import error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to import SDH cards. Please make sure the Excel file is valid.",
      },
      { status: 500 },
    );
  }
}