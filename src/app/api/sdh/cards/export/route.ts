import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { getCurrentSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import SDHCard from "@/models/SDHCard";

export const runtime = "nodejs";

export async function GET() {
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
    // Database
    // ============================================================

    await connectToDatabase();

    const cards =
      await SDHCard.find({
        userId: session.userId,
      })
        .sort({
          createdAt: 1,
        })
        .select("cardNumber")
        .lean();

    // ============================================================
    // Excel workbook
    // ============================================================

    const workbook =
      new ExcelJS.Workbook();

    workbook.creator =
      "Transport Payment Management System";

    workbook.created =
      new Date();

    workbook.modified =
      new Date();

    const worksheet =
      workbook.addWorksheet(
        "SDH Cards",
      );

    worksheet.columns = [
      {
        header: "Card Number",
        key: "cardNumber",
        width: 30,
      },
    ];

    worksheet.getRow(1).font = {
      bold: true,
    };

    worksheet.getRow(1).alignment = {
      vertical: "middle",
    };

    for (const card of cards) {
      const row =
        worksheet.addRow({
          cardNumber:
            card.cardNumber,
        });

      row.getCell(1).numFmt = "@";
      row.getCell(1).value =
        String(card.cardNumber);
    }

    worksheet.views = [
      {
        state: "frozen",
        ySplit: 1,
      },
    ];

    // ============================================================
    // Generate buffer
    // ============================================================

    const buffer =
      await workbook.xlsx.writeBuffer();

    return new NextResponse(
      new Uint8Array(buffer),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

          "Content-Disposition":
            'attachment; filename="sdh_cards.xlsx"',

          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "SDH card export error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to export SDH cards.",
      },
      { status: 500 },
    );
  }
}