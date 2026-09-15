import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { getCurrentSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Card from "@/models/Card";

export const runtime = "nodejs";

export async function GET() {
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

    await connectToDatabase();

    const cards = await Card.find({
      userId: session.userId,
    })
      .sort({ createdAt: 1 })
      .select("cardNumber")
      .lean();

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Transport Payment Management System";
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet("Cards");

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
      worksheet.addRow({
        cardNumber: card.cardNumber,
      });
    }

    worksheet.views = [
      {
        state: "frozen",
        ySplit: 1,
      },
    ];

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="transport_cards.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Card export error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to export cards.",
      },
      { status: 500 }
    );
  }
}