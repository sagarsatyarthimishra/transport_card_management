import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { Binary } from "mongodb";
import ExcelJS from "exceljs";

import { getCurrentSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";

import Card from "@/models/Card";
import Transaction from "@/models/Transaction";

import SDHCard from "@/models/SDHCard";
import SDHTransaction from "@/models/SDHTransaction";

import GeneratedFile from "@/models/GeneratedFile";

export const runtime = "nodejs";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const CSV_CONTENT_TYPE = "text/csv; charset=utf-8";

const MMM_CODE = "MMM11473";
const SDH_CODE = "SDH09066";

interface TransactionInput {
  cardId: string;
  amount: number;
}

function isSDHFile(fileName: string) {
  return fileName.includes(SDH_CODE);
}

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
  department: "MMM" | "SDH",
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const now = new Date();

  workbook.creator = "Transport Department";
  workbook.lastModifiedBy = "Transport Department";
  workbook.created = now;
  workbook.modified = now;

  const code =
    department === "SDH"
      ? SDH_CODE
      : MMM_CODE;

  const worksheet = workbook.addWorksheet(
    `SALARY_${code}_20161229`,
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

  for (const transaction of transactions) {
    const row = worksheet.addRow([
      String(transaction.cardNumber),
      "CR",
      Number(transaction.amount),
      "PETY EXP",
      code,
    ]);

    row.getCell(1).numFmt = "@";
    row.getCell(1).value =
      String(transaction.cardNumber);

    row.getCell(2).numFmt = "@";
    row.getCell(3).numFmt = "0.00";
    row.getCell(4).numFmt = "@";
    row.getCell(5).numFmt = "@";

    // Exactly A:E
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

    const normalized = normalizeCardNumber(
      transaction.cardNumber,
    );

    if (duplicateCards.has(normalized)) {
      for (let column = 1; column <= 5; column++) {
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
  department: "MMM" | "SDH",
): Buffer {
  const code =
    department === "SDH"
      ? SDH_CODE
      : MMM_CODE;

  const rows = transactions.map(
    (transaction) => [
      String(transaction.cardNumber),
      "CR",
      Number(transaction.amount).toFixed(2),
      "PETY EXP",
      code,
    ],
  );

  const content =
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map(csvEscape)
          .join(","),
      )
      .join("\r\n");

  return Buffer.from(content, "utf8");
}

async function generateFileBuffer(
  transactions: {
    cardNumber: string;
    amount: number;
  }[],
  department: "MMM" | "SDH",
  format: "xlsx" | "csv",
) {
  if (format === "csv") {
    return {
      buffer: createCsv(
        transactions,
        department,
      ),
      contentType: CSV_CONTENT_TYPE,
    };
  }

  return {
    buffer: await createXlsx(
      transactions,
      department,
    ),
    contentType: XLSX_CONTENT_TYPE,
  };
}

function getFormatFromFileName(
  fileName: string,
): "xlsx" | "csv" {
  return fileName.toLowerCase().endsWith(".csv")
    ? "csv"
    : "xlsx";
}

/**
 * GET
 *
 * Normal:
 * /api/transactions/files/:id?format=xlsx
 *
 * Edit:
 * /api/transactions/files/:id?mode=edit
 */
export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
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

    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid file ID.",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const userId = new Types.ObjectId(
      session.userId,
    );

    const file =
      await GeneratedFile.findOne({
        _id: id,
        userId,
      }).lean();

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message: "File not found.",
        },
        { status: 404 },
      );
    }

    const { searchParams } =
      request.nextUrl;

    /**
     * EDIT MODE
     */
    if (
      searchParams.get("mode") === "edit"
    ) {
      const isSDH = isSDHFile(
        file.fileName,
      );

      if (isSDH) {
        const transactions =
          await SDHTransaction.find({
            generatedFileId: file._id,
            userId,
          })
            .sort({
              sequence: 1,
              createdAt: 1,
              _id: 1,
            })
            .lean();

        return NextResponse.json(
          {
            success: true,
            data: {
              file: {
                id: file._id.toString(),
                fileName: file.fileName,
                fileSize:
                  file.fileSize,
                transactionCount:
                  file.transactionCount,
                totalAmount:
                  file.totalAmount,
                contentType:
                  file.contentType,
                createdAt:
                  file.createdAt,
                updatedAt:
                  file.updatedAt,
              },

              department: "SDH",

              transactions:
                transactions.map(
                  (transaction) => ({
                    id: transaction._id.toString(),
                    cardId:
                      transaction.cardId.toString(),
                    cardNumber:
                      transaction.cardNumber,
                    amount:
                      transaction.amount,
                    sequence:
                      transaction.sequence,
                    status:
                      transaction.status,
                  }),
                ),
            },
          },
          { status: 200 },
        );
      }

      const transactions =
        await Transaction.find({
          generatedFileId: file._id,
          userId,
        })
          .sort({
            createdAt: 1,
            _id: 1,
          })
          .lean();

      return NextResponse.json(
        {
          success: true,
          data: {
            file: {
              id: file._id.toString(),
              fileName: file.fileName,
              fileSize:
                file.fileSize,
              transactionCount:
                file.transactionCount,
              totalAmount:
                file.totalAmount,
              contentType:
                file.contentType,
              createdAt:
                file.createdAt,
              updatedAt:
                file.updatedAt,
            },

            department: "MMM",

            transactions:
              transactions.map(
                (transaction) => ({
                  id: transaction._id.toString(),
                  cardId:
                    transaction.cardId.toString(),
                  cardNumber:
                    transaction.cardNumber,
                  amount:
                    transaction.amount,
                  status:
                    transaction.status,
                }),
              ),
          },
        },
        { status: 200 },
      );
    }

    /**
     * NORMAL DOWNLOAD MODE
     */
    const requestedFormat =
      searchParams
        .get("format")
        ?.trim()
        .toLowerCase();

    const format =
      requestedFormat === "csv"
        ? "csv"
        : "xlsx";

    const isSDH = isSDHFile(
      file.fileName,
    );

    let transactions: {
      cardNumber: string;
      amount: number;
    }[];

    if (isSDH) {
      const dbTransactions =
        await SDHTransaction.find({
          generatedFileId: file._id,
          userId,
        })
          .sort({
            sequence: 1,
            createdAt: 1,
            _id: 1,
          })
          .lean();

      transactions =
        dbTransactions.map(
          (transaction) => ({
            cardNumber:
              transaction.cardNumber,
            amount:
              transaction.amount,
          }),
        );
    } else {
      const dbTransactions =
        await Transaction.find({
          generatedFileId: file._id,
          userId,
        })
          .sort({
            createdAt: 1,
            _id: 1,
          })
          .lean();

      transactions =
        dbTransactions.map(
          (transaction) => ({
            cardNumber:
              transaction.cardNumber,
            amount:
              transaction.amount,
          }),
        );
    }

    const { buffer, contentType } =
      await generateFileBuffer(
        transactions,
        isSDH ? "SDH" : "MMM",
        format,
      );

    const baseName =
      file.fileName.replace(
        /\.(xlsx|csv)$/i,
        "",
      );

    const downloadFileName =
      `${baseName}.${format}`;

    return new NextResponse(
      new Uint8Array(buffer),
      {
        status: 200,

        headers: {
          "Content-Type":
            contentType,

          "Content-Disposition":
            `attachment; filename="${downloadFileName}"`,

          "Content-Length":
            String(buffer.length),

          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error(
      "Get/download generated file error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to process generated file.",
      },
      { status: 500 },
    );
  }
}

/**
 * PUT
 *
 * Updates the EXISTING GeneratedFile.
 *
 * IMPORTANT:
 * It does NOT create a new GeneratedFile.
 */
export async function PUT(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
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

    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid file ID.",
        },
        { status: 400 },
      );
    }

    let body: {
      transactions?: TransactionInput[];
      format?: "xlsx" | "csv";
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid request body.",
        },
        { status: 400 },
      );
    }

    const inputTransactions =
      body.transactions;

    if (
      !Array.isArray(
        inputTransactions,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Transactions are required.",
        },
        { status: 400 },
      );
    }

    if (
      inputTransactions.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please keep at least one transaction.",
        },
        { status: 400 },
      );
    }

    if (
      inputTransactions.length > 1000
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You can save a maximum of 1000 transactions.",
        },
        { status: 400 },
      );
    }

    for (const transaction of inputTransactions) {
      if (
        !transaction ||
        typeof transaction.cardId !==
          "string" ||
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
        typeof transaction.amount !==
          "number" ||
        !Number.isFinite(
          transaction.amount,
        ) ||
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

    const userId = new Types.ObjectId(
      session.userId,
    );

    /**
     * Find the SAME GeneratedFile.
     */
    const file =
      await GeneratedFile.findOne({
        _id: id,
        userId,
      });

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message: "File not found.",
        },
        { status: 404 },
      );
    }

    const isSDH = isSDHFile(
      file.fileName,
    );

    /**
     * Format:
     *
     * If frontend sends format,
     * use it.
     *
     * Otherwise preserve existing
     * file extension.
     */
    const format =
      body.format === "csv" ||
      body.format === "xlsx"
        ? body.format
        : getFormatFromFileName(
            file.fileName,
          );

    /**
     * UI is newest-first.
     *
     * File/database sequence is
     * oldest-first.
     */
    const transactions =
      [...inputTransactions].reverse();

    /**
     * Resolve cards from the CORRECT
     * department collection.
     */
    const cardIds =
      transactions.map(
        (transaction) =>
          transaction.cardId,
      );

    if (isSDH) {
      const cards =
        await SDHCard.find({
          _id: {
            $in: cardIds,
          },
          userId,
        })
          .select(
            "_id cardNumber",
          )
          .lean();

      const cardMap =
        new Map<string, string>();

      for (const card of cards) {
        cardMap.set(
          card._id.toString(),
          card.cardNumber,
        );
      }

      for (const transaction of transactions) {
        if (
          !cardMap.has(
            transaction.cardId,
          )
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "One or more selected SDH cards were not found.",
            },
            { status: 404 },
          );
        }
      }

      const resolvedTransactions =
        transactions.map(
          (transaction) => ({
            cardId:
              transaction.cardId,

            cardNumber:
              cardMap.get(
                transaction.cardId,
              )!,

            amount:
              Number(
                transaction.amount.toFixed(
                  2,
                ),
              ),
          }),
        );

      const totalAmount =
        resolvedTransactions.reduce(
          (total, transaction) =>
            total +
            transaction.amount,
          0,
        );

      const { buffer, contentType } =
        await generateFileBuffer(
          resolvedTransactions,
          "SDH",
          format,
        );

      if (!buffer.length) {
        throw new Error(
          "Generated file is empty.",
        );
      }

      /**
       * Remove old SDH transactions
       * linked to THIS file.
       */
      await SDHTransaction.deleteMany({
        generatedFileId: file._id,
        userId,
      });

      /**
       * Insert new transactions using
       * the SAME GeneratedFile ID.
       */
      await SDHTransaction.insertMany(
        resolvedTransactions.map(
          (
            transaction,
            index,
          ) => ({
            userId,

            cardId:
              new Types.ObjectId(
                transaction.cardId,
              ),

            cardNumber:
              transaction.cardNumber,

            amount:
              transaction.amount,

            sequence: index,

            status:
              "pending" as const,

            generatedFileId:
              file._id,
          }),
        ),
      );

      const baseName =
        file.fileName.replace(
          /\.(xlsx|csv)$/i,
          "",
        );

      const fileName =
        `${baseName}.${format}`;

      file.fileName = fileName;
      file.fileSize = buffer.length;
      file.transactionCount =
        resolvedTransactions.length;
      file.totalAmount =
        Number(
          totalAmount.toFixed(2),
        );
      file.fileData =
        new Binary(buffer) as any;
      file.contentType =
        contentType;

      await file.save();

      return NextResponse.json(
        {
          success: true,
          message:
            "SDH file updated successfully.",
          data: {
            fileId:
              file._id.toString(),
            fileName,
            fileSize:
              buffer.length,
            transactionCount:
              resolvedTransactions.length,
            totalAmount:
              Number(
                totalAmount.toFixed(2),
              ),
            format,
          },
        },
        { status: 200 },
      );
    }

    /**
     * ============================
     * MMM UPDATE
     * ============================
     */

    const cards =
      await Card.find({
        _id: {
          $in: cardIds,
        },
        userId,
      })
        .select(
          "_id cardNumber",
        )
        .lean();

    const cardMap =
      new Map<string, string>();

    for (const card of cards) {
      cardMap.set(
        card._id.toString(),
        card.cardNumber,
      );
    }

    for (const transaction of transactions) {
      if (
        !cardMap.has(
          transaction.cardId,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "One or more selected MMM cards were not found.",
          },
          { status: 404 },
        );
      }
    }

    const resolvedTransactions =
      transactions.map(
        (transaction) => ({
          cardId:
            transaction.cardId,

          cardNumber:
            cardMap.get(
              transaction.cardId,
            )!,

          amount:
            Number(
              transaction.amount.toFixed(
                2,
              ),
            ),
        }),
      );

    const totalAmount =
      resolvedTransactions.reduce(
        (total, transaction) =>
          total +
          transaction.amount,
        0,
      );

    const { buffer, contentType } =
      await generateFileBuffer(
        resolvedTransactions,
        "MMM",
        format,
      );

    if (!buffer.length) {
      throw new Error(
        "Generated file is empty.",
      );
    }

    /**
     * Remove old MMM transactions
     * linked to THIS file.
     */
    await Transaction.deleteMany({
      generatedFileId: file._id,
      userId,
    });

    /**
     * Insert updated transactions
     * with SAME GeneratedFile ID.
     */
    await Transaction.insertMany(
      resolvedTransactions.map(
        (transaction) => ({
          userId,

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
            file._id,
        }),
      ),
    );

    const baseName =
      file.fileName.replace(
        /\.(xlsx|csv)$/i,
        "",
      );

    const fileName =
      `${baseName}.${format}`;

    file.fileName = fileName;
    file.fileSize = buffer.length;
    file.transactionCount =
      resolvedTransactions.length;
    file.totalAmount =
      Number(
        totalAmount.toFixed(2),
      );
    file.fileData =
      new Binary(buffer) as any;
    file.contentType =
      contentType;

    await file.save();

    return NextResponse.json(
      {
        success: true,
        message:
          "MMM file updated successfully.",
        data: {
          fileId:
            file._id.toString(),
          fileName,
          fileSize:
            buffer.length,
          transactionCount:
            resolvedTransactions.length,
          totalAmount:
            Number(
              totalAmount.toFixed(2),
            ),
          format,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Update generated file error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to update generated file.",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE
 *
 * Deletes the GeneratedFile and
 * unlinks related transactions.
 */
export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
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

    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid file ID.",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const userId = new Types.ObjectId(
      session.userId,
    );

    const file =
      await GeneratedFile.findOne({
        _id: id,
        userId,
      });

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message: "File not found.",
        },
        { status: 404 },
      );
    }

    /**
     * Unlink both types safely.
     *
     * Only matching generatedFileId
     * and userId are affected.
     */
    await Transaction.updateMany(
      {
        generatedFileId: file._id,
        userId,
      },
      {
        $set: {
          generatedFileId: null,
        },
      },
    );

    await SDHTransaction.updateMany(
      {
        generatedFileId: file._id,
        userId,
      },
      {
        $set: {
          generatedFileId: null,
        },
      },
    );

    await GeneratedFile.deleteOne({
      _id: file._id,
      userId,
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "File deleted successfully.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Delete generated file error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to delete generated file.",
      },
      { status: 500 },
    );
  }
}