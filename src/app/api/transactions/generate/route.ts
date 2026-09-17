import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { Binary } from "mongodb";
import ExcelJS from "exceljs";

import { getCurrentSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Card from "@/models/Card";
import GeneratedFile from "@/models/GeneratedFile";
import Transaction from "@/models/Transaction";

export const runtime = "nodejs";

interface TransactionInput {
  cardId: string;
  amount: number;
}

interface GenerateRequestBody {
  transactions: TransactionInput[];
}

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const CSV_CONTENT_TYPE = "text/csv; charset=utf-8";

function normalizeCardNumber(value: string): string {
  return value.replace(/\s+/g, "").trim().toLowerCase();
}

function csvEscape(value: string | number): string {
  const text = String(value);

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

/**
 * Filename:
 *
 * SALARY_MMM11473_20210202_2609142030583.xlsx
 *
 * Length remains below 45 characters.
 */
function createTimestamp(): string {
  const now = new Date();

  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  /*
   * 12-digit timestamp + 2-digit suffix.
   *
   * This keeps the complete filename below 45 characters.
   */
  const suffix = String(
    Math.floor(Math.random() * 100),
  ).padStart(2, "0");

  return `${yy}${mm}${dd}${hh}${min}${ss}${suffix}`;
}

function buildRows(
  transactions: {
    cardNumber: string;
    amount: number;
  }[],
): string[][] {
  return transactions.map((transaction) => [
    String(transaction.cardNumber),
    "CR",
    Number(transaction.amount).toFixed(2),
    "PETY EXP",
    "MMM11473",
  ]);
}

function findDuplicateCards(
  transactions: {
    cardNumber: string;
  }[],
): Set<string> {
  const counts = new Map<string, number>();

  for (const transaction of transactions) {
    const normalized = normalizeCardNumber(
      transaction.cardNumber,
    );

    counts.set(
      normalized,
      (counts.get(normalized) ?? 0) + 1,
    );
  }

  const duplicates = new Set<string>();

  for (const [cardNumber, count] of counts) {
    if (count > 1) {
      duplicates.add(cardNumber);
    }
  }

  return duplicates;
}

async function createXlsx(
  transactions: {
    cardNumber: string;
    amount: number;
  }[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const now = new Date();

  workbook.creator = "Transport Department";
  workbook.lastModifiedBy = "Transport Department";
  workbook.created = now;
  workbook.modified = now;

  const worksheet = workbook.addWorksheet(
    "SALARY_MMM11473_20210202_0RE00O",
  );

  worksheet.columns = [
    {
      key: "cardNumber",
      width: 21.88671875,
    },
    {
      key: "type",
      width: 5.33203125,
    },
    {
      key: "amount",
      width: 11.109375,
    },
    {
      key: "description",
      width: 11.21875,
    },
    {
      key: "employeeCode",
      width: 11.21875,
    },
  ];

  const duplicateCards =
    findDuplicateCards(transactions);

  /*
   * IMPORTANT:
   *
   * transactions are already in:
   *
   * oldest -> latest
   *
   * order.
   */

  for (const transaction of transactions) {
    const row = worksheet.addRow([
      String(transaction.cardNumber),
      "CR",
      Number(transaction.amount),
      "PETY EXP",
      "MMM11473",
    ]);

    row.getCell(1).numFmt = "@";
    row.getCell(1).value =
      String(transaction.cardNumber);

    row.getCell(2).numFmt = "@";

    row.getCell(3).numFmt = "0.00";

    row.getCell(4).numFmt = "@";
    row.getCell(5).numFmt = "@";

    /*
     * ALL BORDERS
     *
     * Apply borders only to the five
     * transaction columns A:E.
     */
    for (let column = 1; column <= 5; column++) {
      const cell = row.getCell(column);

      cell.border = {
        top: {
          style: "thin",
        },
        bottom: {
          style: "thin",
        },
        left: {
          style: "thin",
        },
        right: {
          style: "thin",
        },
      };
    }

    /*
     * DUPLICATE HIGHLIGHT
     *
     * Every occurrence of duplicate card
     * gets yellow highlight.
     */
    const normalized =
      normalizeCardNumber(
        transaction.cardNumber,
      );

    if (duplicateCards.has(normalized)) {
      for (let column = 1; column <= 6; column++) {
        const cell = row.getCell(column);

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: "FFFFE08A",
          },
        };

        cell.font = {
          bold: true,
        };
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return Buffer.from(buffer);
}

function createCsv(
  transactions: {
    cardNumber: string;
    amount: number;
  }[],
): Buffer {
  const rows = buildRows(transactions);

  const content =
    "\uFEFF" +
    rows
      .map((row) =>
        row.map(csvEscape).join(","),
      )
      .join("\r\n");

  return Buffer.from(content, "utf8");
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

    const { searchParams } =
      new URL(request.url);

    const download =
      searchParams.get("download") !== "false";

    const requestedFormat =
      searchParams
        .get("format")
        ?.trim()
        .toLowerCase();

    const format =
      requestedFormat === "csv"
        ? "csv"
        : "xlsx";

    let body: GenerateRequestBody;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request body.",
        },
        { status: 400 },
      );
    }

    const inputTransactions =
      body.transactions;

    if (
      !Array.isArray(inputTransactions) ||
      inputTransactions.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please add at least one transaction.",
        },
        { status: 400 },
      );
    }

    if (inputTransactions.length > 1000) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You can generate a maximum of 1000 transactions at once.",
        },
        { status: 400 },
      );
    }

    for (const transaction of inputTransactions) {
      if (
        !transaction ||
        typeof transaction.cardId !== "string" ||
        !Types.ObjectId.isValid(
          transaction.cardId,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "One or more cards are invalid.",
          },
          { status: 400 },
        );
      }

      if (
        typeof transaction.amount !== "number" ||
        !Number.isFinite(transaction.amount) ||
        transaction.amount <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "One or more transaction amounts are invalid.",
          },
          { status: 400 },
        );
      }
    }

    await connectToDatabase();

    const userObjectId =
      new Types.ObjectId(session.userId);

    const cardIds =
      inputTransactions.map(
        (transaction) =>
          transaction.cardId,
      );

    const cards = await Card.find({
      _id: {
        $in: cardIds,
      },
      userId: userObjectId,
    })
      .select("_id cardNumber")
      .lean();

    const cardMap =
      new Map<string, string>();

    for (const card of cards) {
      cardMap.set(
        card._id.toString(),
        card.cardNumber,
      );
    }

    for (const transaction of inputTransactions) {
      if (
        !cardMap.has(transaction.cardId)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "One or more selected cards were not found.",
          },
          { status: 404 },
        );
      }
    }

    /*
     * VERY IMPORTANT
     *
     * Preview is latest-first.
     *
     * Example:
     *
     * Preview:
     * Entry 4
     * Entry 3
     * Entry 2
     * Entry 1
     *
     * Generated file:
     * Entry 1
     * Entry 2
     * Entry 3
     * Entry 4
     */
    const transactions = [
      ...inputTransactions,
    ].reverse();

    const resolvedTransactions =
      transactions.map((transaction) => ({
        cardNumber:
          cardMap.get(
            transaction.cardId,
          )!,
        amount:
          Number(
            transaction.amount.toFixed(2),
          ),
        cardId: transaction.cardId,
      }));

    const totalAmount =
      resolvedTransactions.reduce(
        (total, transaction) =>
          total + transaction.amount,
        0,
      );

    const timestamp =
      createTimestamp();

    const fileName =
      `SALARY_MMM11473_20210202_${timestamp}.${format}`;

    let fileBuffer: Buffer;
    let contentType: string;

    if (format === "csv") {
      fileBuffer = createCsv(
        resolvedTransactions,
      );

      contentType =
        CSV_CONTENT_TYPE;
    } else {
      fileBuffer = await createXlsx(
        resolvedTransactions,
      );

      contentType =
        XLSX_CONTENT_TYPE;
    }

    if (!fileBuffer.length) {
      throw new Error(
        "Generated file is empty.",
      );
    }

    /*
     * Save generated file.
     */
    const generatedFile =
      await GeneratedFile.create({
        userId: userObjectId,
        fileName,
        fileSize: fileBuffer.length,
        transactionCount:
          resolvedTransactions.length,
        totalAmount,
        fileData:
          new Binary(fileBuffer),
        contentType,
      });

    /*
     * Save MMM transactions in EXACT
     * generated-file order.
     *
     * insertMany preserves the order
     * of this array.
     */
    try {
      await Transaction.insertMany(
        resolvedTransactions.map(
          (transaction) => ({
            userId: userObjectId,
            cardId:
              new Types.ObjectId(
                transaction.cardId,
              ),
            cardNumber:
              transaction.cardNumber,
            amount:
              transaction.amount,
            status:
              "pending" as const,
            generatedFileId:
              generatedFile._id,
          }),
        ),
      );
    } catch (transactionError) {
      await GeneratedFile.deleteOne({
        _id: generatedFile._id,
        userId: userObjectId,
      });

      throw transactionError;
    }

    /*
     * SAVE ONLY
     */
    if (!download) {
      return NextResponse.json(
        {
          success: true,
          message:
            "MMM transactions and file saved successfully.",
          data: {
            fileId:
              generatedFile._id.toString(),
            fileName,
            fileSize:
              fileBuffer.length,
            transactionCount:
              resolvedTransactions.length,
            totalAmount,
            format,
          },
        },
        { status: 200 },
      );
    }

    /*
     * DOWNLOAD
     */
    return new NextResponse(
      new Uint8Array(fileBuffer),
      {
        status: 200,
        headers: {
          "Content-Type":
            contentType,

          "Content-Disposition":
            `attachment; filename="${fileName}"`,

          "Content-Length":
            String(fileBuffer.length),

          "Cache-Control":
            "no-store, no-cache, must-revalidate",

          "X-Generated-File-Id":
            generatedFile._id.toString(),

          "X-Transaction-Count":
            String(
              resolvedTransactions.length,
            ),

          "X-Total-Amount":
            String(totalAmount),

          "X-File-Format":
            format,
        },
      },
    );
  } catch (error) {
    console.error(
      "Generate MMM transaction file error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to generate MMM transaction file.",
      },
      { status: 500 },
    );
  }
}