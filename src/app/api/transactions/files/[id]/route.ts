import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { Binary } from "mongodb";
import ExcelJS from "exceljs";

import { getCurrentSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";

import GeneratedFile from "@/models/GeneratedFile";
import Transaction from "@/models/Transaction";
import SDHTransaction from "@/models/SDHTransaction";
import Card from "@/models/Card";
import SDHCard from "@/models/SDHCard";

export const runtime = "nodejs";

// ============================================================
// CONSTANTS
// ============================================================

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const CSV_CONTENT_TYPE =
  "text/csv; charset=utf-8";

// ============================================================
// TYPES
// ============================================================

type Department =
  | "MMM"
  | "SDH";

interface TransactionInput {
  cardId: string;
  amount: number;
}

interface UpdateRequestBody {
  department: Department;
  format?: "xlsx" | "csv";
  transactions: TransactionInput[];
}

interface TransactionRow {
  cardNumber: string;
  amount: number;
}

// ============================================================
// HELPERS
// ============================================================

function normalizeCardNumber(
  value: string,
): string {
  return value
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

// ============================================================
// CSV ESCAPE
// ============================================================

function csvEscape(
  value: unknown,
): string {
  const text = String(
    value ?? "",
  );

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replace(
      /"/g,
      '""',
    )}"`;
  }

  return text;
}

// ============================================================
// BUFFER HELPER
// ============================================================

function toBuffer(
  value: unknown,
): Buffer | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    const binary =
      value as {
        buffer?: unknown;
        value?: () => unknown;
        type?: unknown;
        data?: unknown;
      };

    if (binary.buffer) {
      if (
        Buffer.isBuffer(
          binary.buffer,
        )
      ) {
        return binary.buffer;
      }

      if (
        binary.buffer instanceof
        Uint8Array
      ) {
        return Buffer.from(
          binary.buffer,
        );
      }

      if (
        binary.buffer instanceof
        ArrayBuffer
      ) {
        return Buffer.from(
          binary.buffer,
        );
      }
    }

    if (
      typeof binary.value ===
      "function"
    ) {
      try {
        const result =
          binary.value();

        if (
          Buffer.isBuffer(
            result,
          )
        ) {
          return result;
        }

        if (
          result instanceof
          Uint8Array
        ) {
          return Buffer.from(
            result,
          );
        }
      } catch {
        // Continue.
      }
    }

    if (
      binary.type === "Buffer" &&
      Array.isArray(
        binary.data,
      )
    ) {
      return Buffer.from(
        binary.data as number[],
      );
    }
  }

  return null;
}

// ============================================================
// DUPLICATE CARDS
// ============================================================

function findDuplicateCards(
  transactions: TransactionRow[],
): Set<string> {
  const counts =
    new Map<string, number>();

  for (const transaction of transactions) {
    const normalized =
      normalizeCardNumber(
        transaction.cardNumber,
      );

    counts.set(
      normalized,
      (counts.get(
        normalized,
      ) ?? 0) + 1,
    );
  }

  const duplicates =
    new Set<string>();

  for (
    const [cardNumber, count] of counts
  ) {
    if (count > 1) {
      duplicates.add(
        cardNumber,
      );
    }
  }

  return duplicates;
}

// ============================================================
// BUILD 5-COLUMN ROWS
//
// A = Card Number
// B = CR
// C = Amount
// D = PETY EXP
// E = Department Code
// ============================================================

function buildRows(
  transactions: TransactionRow[],
  departmentCode:
    | "MMM11473"
    | "SDH09066",
): string[][] {
  return transactions.map(
    (transaction) => [
      String(
        transaction.cardNumber,
      ),

      "CR",

      Number(
        transaction.amount,
      ).toFixed(2),

      "PETY EXP",

      departmentCode,
    ],
  );
}

// ============================================================
// CREATE CSV
// ============================================================

function createCsv(
  transactions: TransactionRow[],
  departmentCode:
    | "MMM11473"
    | "SDH09066",
): Buffer {
  const rows =
    buildRows(
      transactions,
      departmentCode,
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

  return Buffer.from(
    content,
    "utf8",
  );
}

// ============================================================
// CREATE XLSX
//
// IMPORTANT:
// Only A:E are used.
// No extra sixth column.
// ============================================================

async function createXlsx(
  transactions: TransactionRow[],
  departmentCode:
    | "MMM11473"
    | "SDH09066",
): Promise<Buffer> {
  const workbook =
    new ExcelJS.Workbook();

  const now =
    new Date();

  workbook.creator =
    "Transport Department";

  workbook.lastModifiedBy =
    "Transport Department";

  workbook.created =
    now;

  workbook.modified =
    now;

  const worksheet =
    workbook.addWorksheet(
      departmentCode ===
        "SDH09066"
        ? "SALARY_SDH09066_20161229"
        : "SALARY_MMM11473_20210202",
    );

  // ----------------------------------------------------------
  // EXACTLY FIVE COLUMNS
  // ----------------------------------------------------------

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
    findDuplicateCards(
      transactions,
    );

  // ----------------------------------------------------------
  // TRANSACTIONS ARE ALREADY
  // oldest -> newest
  // ----------------------------------------------------------

  for (
    const transaction of transactions
  ) {
    const row =
      worksheet.addRow([
        String(
          transaction.cardNumber,
        ),

        "CR",

        Number(
          transaction.amount,
        ),

        "PETY EXP",

        departmentCode,
      ]);

    // --------------------------------------------------------
    // Card number as TEXT
    // --------------------------------------------------------

    row.getCell(1).numFmt =
      "@";

    row.getCell(1).value =
      String(
        transaction.cardNumber,
      );

    // --------------------------------------------------------
    // Type
    // --------------------------------------------------------

    row.getCell(2).numFmt =
      "@";

    // --------------------------------------------------------
    // Amount
    // --------------------------------------------------------

    row.getCell(3).numFmt =
      "0.00";

    // --------------------------------------------------------
    // Description
    // --------------------------------------------------------

    row.getCell(4).numFmt =
      "@";

    // --------------------------------------------------------
    // Department
    // --------------------------------------------------------

    row.getCell(5).numFmt =
      "@";

    // --------------------------------------------------------
    // Borders
    // --------------------------------------------------------

    for (
      let column = 1;
      column <= 5;
      column++
    ) {
      const cell =
        row.getCell(
          column,
        );

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

    // --------------------------------------------------------
    // Duplicate highlighting
    // --------------------------------------------------------

    const normalized =
      normalizeCardNumber(
        transaction.cardNumber,
      );

    if (
      duplicateCards.has(
        normalized,
      )
    ) {
      for (
        let column = 1;
        column <= 5;
        column++
      ) {
        const cell =
          row.getCell(
            column,
          );

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

  const buffer =
    await workbook.xlsx.writeBuffer();

  return Buffer.from(
    buffer,
  );
}

// ============================================================
// GET TRANSACTIONS FOR EDIT
//
// GET /api/transactions/files/:id?mode=edit
//
// Returns:
// - file
// - department
// - transactions
//
// Transactions are returned oldest -> newest.
// Frontend reverses them for preview.
// ============================================================

async function getEditData(
  fileObjectId: Types.ObjectId,
  userObjectId: Types.ObjectId,
) {
  const file =
    await GeneratedFile.findOne(
      {
        _id: fileObjectId,
        userId: userObjectId,
      },
    )
      .select(
        "_id fileName fileSize transactionCount totalAmount contentType createdAt updatedAt",
      )
      .lean();

  if (!file) {
    return null;
  }

  const isSDHFile =
    String(
      file.fileName ?? "",
    )
      .toUpperCase()
      .includes(
        "SDH09066",
      );

  if (isSDHFile) {
    const transactions =
      await SDHTransaction.find(
        {
          generatedFileId:
            fileObjectId,

          userId:
            userObjectId,
        },
      )
        .select(
          "_id cardId cardNumber amount sequence status",
        )
        .sort({
          sequence: 1,
          createdAt: 1,
        })
        .lean();

    return {
      file: {
        id:
          file._id.toString(),

        fileName:
          file.fileName,

        fileSize:
          file.fileSize ?? null,

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

      department:
        "SDH" as const,

      transactions:
        transactions.map(
          (transaction) => ({
            id:
              transaction._id.toString(),

            cardId:
              transaction.cardId.toString(),

            cardNumber:
              transaction.cardNumber,

            amount:
              Number(
                transaction.amount,
              ),

            sequence:
              transaction.sequence,

            status:
              transaction.status,
          }),
        ),
    };
  }

  const transactions =
    await Transaction.find(
      {
        generatedFileId:
          fileObjectId,

        userId:
          userObjectId,
      },
    )
      .select(
        "_id cardId cardNumber amount status createdAt",
      )
      .sort({
        createdAt: 1,
      })
      .lean();

  return {
    file: {
      id:
        file._id.toString(),

      fileName:
        file.fileName,

      fileSize:
        file.fileSize ?? null,

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

    department:
      "MMM" as const,

    transactions:
      transactions.map(
        (transaction) => ({
          id:
            transaction._id.toString(),

          cardId:
            transaction.cardId.toString(),

          cardNumber:
            transaction.cardNumber,

          amount:
            Number(
              transaction.amount,
            ),

          status:
            transaction.status,
        }),
      ),
  };
}

// ============================================================
// GET
//
// Two modes:
//
// 1. Download
//
// /api/transactions/files/:id?format=xlsx
//
// 2. Edit data
//
// /api/transactions/files/:id?mode=edit
// ============================================================

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    // ========================================================
    // AUTH
    // ========================================================

    const session =
      await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }

    // ========================================================
    // FILE ID
    // ========================================================

    const { id } =
      await context.params;

    if (
      !Types.ObjectId.isValid(
        id,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid file ID.",
        },
        {
          status: 400,
        },
      );
    }

    const fileObjectId =
      new Types.ObjectId(id);

    const userObjectId =
      new Types.ObjectId(
        session.userId,
      );

    // ========================================================
    // DATABASE
    // ========================================================

    await connectToDatabase();

    const { searchParams } =
      new URL(request.url);

    const mode =
      searchParams.get(
        "mode",
      );

    // ========================================================
    // EDIT MODE
    // ========================================================

    if (mode === "edit") {
      const data =
        await getEditData(
          fileObjectId,
          userObjectId,
        );

      if (!data) {
        return NextResponse.json(
          {
            success: false,
            message:
              "File not found.",
          },
          {
            status: 404,
          },
        );
      }

      return NextResponse.json(
        {
          success: true,
          data,
        },
        {
          status: 200,
        },
      );
    }

    // ========================================================
    // DOWNLOAD MODE
    // ========================================================

    const requestedFormat =
      searchParams
        .get("format")
        ?.trim()
        .toLowerCase() ??
      "xlsx";

    if (
      requestedFormat !==
        "xlsx" &&
      requestedFormat !==
        "csv"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid download format.",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // GET FILE
    // ========================================================

    const rawFile =
      await GeneratedFile.collection.findOne(
        {
          _id:
            fileObjectId,

          userId:
            userObjectId,
        },
        {
          projection: {
            fileName: 1,
            fileSize: 1,
            fileData: 1,
            contentType: 1,
          },
        },
      );

    if (!rawFile) {
      return NextResponse.json(
        {
          success: false,
          message:
            "File not found.",
        },
        {
          status: 404,
        },
      );
    }

    // ========================================================
    // DEPARTMENT
    // ========================================================

    const isSDHFile =
      String(
        rawFile.fileName ?? "",
      )
        .toUpperCase()
        .includes(
          "SDH09066",
        );

    const departmentCode =
      isSDHFile
        ? "SDH09066"
        : "MMM11473";

    // ========================================================
    // FETCH LINKED TRANSACTIONS
    // ========================================================

    let transactions:
      TransactionRow[] = [];

    if (isSDHFile) {
      const sdhTransactions =
        await SDHTransaction.find(
          {
            generatedFileId:
              fileObjectId,

            userId:
              userObjectId,
          },
        )
          .select(
            "cardNumber amount sequence createdAt",
          )
          .sort({
            sequence: 1,
            createdAt: 1,
          })
          .lean();

      transactions =
        sdhTransactions.map(
          (transaction) => ({
            cardNumber:
              transaction.cardNumber,

            amount:
              Number(
                transaction.amount,
              ),
          }),
        );
    } else {
      const mmmTransactions =
        await Transaction.find(
          {
            generatedFileId:
              fileObjectId,

            userId:
              userObjectId,
          },
        )
          .select(
            "cardNumber amount createdAt",
          )
          .sort({
            createdAt: 1,
          })
          .lean();

      transactions =
        mmmTransactions.map(
          (transaction) => ({
            cardNumber:
              transaction.cardNumber,

            amount:
              Number(
                transaction.amount,
              ),
          }),
        );
    }

    // ========================================================
    // CSV
    // ========================================================

    if (
      requestedFormat ===
      "csv"
    ) {
      const csvBuffer =
        createCsv(
          transactions,
          departmentCode,
        );

      const fileName =
        String(
          rawFile.fileName,
        ).replace(
          /\.[^.]+$/,
          ".csv",
        );

      return new NextResponse(
        new Uint8Array(
          csvBuffer,
        ),
        {
          status: 200,

          headers: {
            "Content-Type":
              CSV_CONTENT_TYPE,

            "Content-Disposition":
              `attachment; filename="${fileName}"`,

            "Content-Length":
              String(
                csvBuffer.length,
              ),

            "Cache-Control":
              "no-store, no-cache, must-revalidate",
          },
        },
      );
    }

    // ========================================================
    // XLSX
    //
    // Always rebuild from transactions.
    // This guarantees updated data is downloaded.
    // ========================================================

    const xlsxBuffer =
      await createXlsx(
        transactions,
        departmentCode,
      );

    if (
      !xlsxBuffer.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Generated XLSX file is empty.",
        },
        {
          status: 500,
        },
      );
    }

    const xlsxFileName =
      String(
        rawFile.fileName,
      ).replace(
        /\.[^.]+$/,
        ".xlsx",
      );

    return new NextResponse(
      new Uint8Array(
        xlsxBuffer,
      ),
      {
        status: 200,

        headers: {
          "Content-Type":
            XLSX_CONTENT_TYPE,

          "Content-Disposition":
            `attachment; filename="${xlsxFileName}"`,

          "Content-Length":
            String(
              xlsxBuffer.length,
            ),

          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error(
      "Get generated file error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to process generated file.",
      },
      {
        status: 500,
      },
    );
  }
}

// ============================================================
// PUT
//
// UPDATE EXISTING FILE
//
// IMPORTANT:
//
// Same GeneratedFile _id is preserved.
//
// Existing transactions belonging to that file are replaced.
//
// MMM -> Transaction
// SDH -> SDHTransaction
// ============================================================

export async function PUT(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    // ========================================================
    // AUTH
    // ========================================================

    const session =
      await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }

    // ========================================================
    // FILE ID
    // ========================================================

    const { id } =
      await context.params;

    if (
      !Types.ObjectId.isValid(
        id,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid file ID.",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // BODY
    // ========================================================

    let body: UpdateRequestBody;

    try {
      body =
        (await request.json()) as UpdateRequestBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid request body.",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // VALIDATE DEPARTMENT
    // ========================================================

    if (
      body.department !==
        "MMM" &&
      body.department !==
        "SDH"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid department.",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // VALIDATE TRANSACTIONS
    // ========================================================

    if (
      !Array.isArray(
        body.transactions,
      ) ||
      body.transactions.length ===
        0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please keep at least one transaction.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      body.transactions.length >
      1000
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You can have a maximum of 1000 transactions.",
        },
        {
          status: 400,
        },
      );
    }

    for (
      const transaction of
        body.transactions
    ) {
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
          {
            status: 400,
          },
        );
      }

      if (
        typeof transaction.amount !==
          "number" ||
        !Number.isFinite(
          transaction.amount,
        ) ||
        transaction.amount <=
          0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "One or more transaction amounts are invalid.",
          },
          {
            status: 400,
          },
        );
      }
    }

    // ========================================================
    // DATABASE
    // ========================================================

    await connectToDatabase();

    const userObjectId =
      new Types.ObjectId(
        session.userId,
      );

    const fileObjectId =
      new Types.ObjectId(id);

    // ========================================================
    // FIND EXISTING FILE
    // ========================================================

    const file =
      await GeneratedFile.findOne(
        {
          _id:
            fileObjectId,

          userId:
            userObjectId,
        },
      );

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message:
            "File not found.",
        },
        {
          status: 404,
        },
      );
    }

    // ========================================================
    // DETERMINE ACTUAL DEPARTMENT
    //
    // Never allow MMM page to update SDH file
    // or SDH page to update MMM file.
    // ========================================================

    const isSDHFile =
      String(
        file.fileName ?? "",
      )
        .toUpperCase()
        .includes(
          "SDH09066",
        );

    const actualDepartment:
      Department =
      isSDHFile
        ? "SDH"
        : "MMM";

    if (
      body.department !==
      actualDepartment
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Department mismatch. This is a ${actualDepartment} file.`,
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // FORMAT
    // ========================================================

    const format =
      body.format ===
      "csv"
        ? "csv"
        : "xlsx";

    // ========================================================
    // RESOLVE CARDS
    //
    // IMPORTANT:
    //
    // MMM uses Card
    // SDH uses SDHCard
    // ========================================================

    const cardIds =
      body.transactions.map(
        (transaction) =>
          new Types.ObjectId(
            transaction.cardId,
          ),
      );

    let resolvedTransactions:
      TransactionRow[] = [];

    const cardMap =
      new Map<
        string,
        string
      >();

    if (
      actualDepartment ===
      "SDH"
    ) {
      const cards =
        await SDHCard.find(
          {
            _id: {
              $in: cardIds,
            },

            userId:
              userObjectId,
          },
        )
          .select(
            "_id cardNumber",
          )
          .lean();

      for (
        const card of cards
      ) {
        cardMap.set(
          card._id.toString(),
          card.cardNumber,
        );
      }
    } else {
      const cards =
        await Card.find(
          {
            _id: {
              $in: cardIds,
            },

            userId:
              userObjectId,
          },
        )
          .select(
            "_id cardNumber",
          )
          .lean();

      for (
        const card of cards
      ) {
        cardMap.set(
          card._id.toString(),
          card.cardNumber,
        );
      }
    }

    // ========================================================
    // Make sure EVERY card belongs to correct user/department.
    // ========================================================

    for (
      const transaction of
        body.transactions
    ) {
      const cardNumber =
        cardMap.get(
          transaction.cardId,
        );

      if (!cardNumber) {
        return NextResponse.json(
          {
            success: false,
            message:
              "One or more selected cards were not found.",
          },
          {
            status: 400,
          },
        );
      }

      const roundedAmount =
        Math.round(
          (transaction.amount +
            Number.EPSILON) *
            100,
        ) / 100;

      resolvedTransactions.push(
        {
          cardNumber,
          amount:
            roundedAmount,
        },
      );
    }

    // ========================================================
    // IMPORTANT ORDER
    //
    // Frontend sends:
    //
    // newest -> oldest
    //
    // Generated file must be:
    //
    // oldest -> newest
    // ========================================================

    resolvedTransactions =
      resolvedTransactions.reverse();

    // ========================================================
    // TOTAL
    // ========================================================

    const totalAmount =
      resolvedTransactions.reduce(
        (
          total,
          transaction,
        ) =>
          total +
          transaction.amount,
        0,
      );

    // ========================================================
    // BUILD UPDATED FILE
    // ========================================================

    let fileBuffer:
      Buffer;

    let contentType:
      string;

    const departmentCode =
      actualDepartment ===
      "SDH"
        ? "SDH09066"
        : "MMM11473";

    if (
      format ===
      "csv"
    ) {
      fileBuffer =
        createCsv(
          resolvedTransactions,
          departmentCode,
        );

      contentType =
        CSV_CONTENT_TYPE;
    } else {
      fileBuffer =
        await createXlsx(
          resolvedTransactions,
          departmentCode,
        );

      contentType =
        XLSX_CONTENT_TYPE;
    }

    if (
      !fileBuffer.length
    ) {
      throw new Error(
        "Generated file is empty.",
      );
    }

    // ========================================================
    // REPLACE TRANSACTIONS
    //
    // We DO NOT create a new GeneratedFile.
    //
    // Existing GeneratedFile _id remains same.
    // ========================================================

    if (
      actualDepartment ===
      "SDH"
    ) {
      // ------------------------------------------------------
      // Delete old SDH transactions
      // ------------------------------------------------------

      await SDHTransaction.deleteMany(
        {
          generatedFileId:
            fileObjectId,

          userId:
            userObjectId,
        },
      );

      // ------------------------------------------------------
      // Insert updated SDH transactions
      //
      // sequence:
      // 0 = oldest
      // 1 = next
      // ...
      // ------------------------------------------------------

      await SDHTransaction.insertMany(
        resolvedTransactions.map(
          (
            transaction,
            index,
          ) => ({
            userId:
              userObjectId,

            cardId:
              new Types.ObjectId(
                body.transactions[
                  body.transactions.length -
                    1 -
                    index
                ].cardId,
              ),

            cardNumber:
              transaction.cardNumber,

            amount:
              transaction.amount,

            sequence:
              index,

            status:
              "pending" as const,

            generatedFileId:
              fileObjectId,
          }),
        ),
      );
    } else {
      // ------------------------------------------------------
      // Delete old MMM transactions
      // ------------------------------------------------------

      await Transaction.deleteMany(
        {
          generatedFileId:
            fileObjectId,

          userId:
            userObjectId,
        },
      );

      // ------------------------------------------------------
      // Insert updated MMM transactions
      //
      // MMM has no sequence field.
      //
      // Insert in file order.
      // ------------------------------------------------------

      await Transaction.insertMany(
        resolvedTransactions.map(
          (
            transaction,
            index,
          ) => ({
            userId:
              userObjectId,

            cardId:
              new Types.ObjectId(
                body.transactions[
                  body.transactions.length -
                    1 -
                    index
                ].cardId,
              ),

            cardNumber:
              transaction.cardNumber,

            amount:
              transaction.amount,

            status:
              "pending" as const,

            generatedFileId:
              fileObjectId,

            /*
             * This is intentionally
             * not a model field.
             *
             * createdAt from insert order
             * preserves file order.
             */
          }),
        ),
      );
    }

    // ========================================================
    // UPDATE SAME GeneratedFile
    // ========================================================

    await GeneratedFile.updateOne(
      {
        _id:
          fileObjectId,

        userId:
          userObjectId,
      },
      {
        $set: {
          fileSize:
            fileBuffer.length,

          transactionCount:
            resolvedTransactions.length,

          totalAmount,

          fileData:
            new Binary(
              fileBuffer,
            ),

          contentType,
        },
      },
    );

    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "File updated successfully.",

        data: {
          fileId:
            fileObjectId.toString(),

          fileName:
            file.fileName,

          fileSize:
            fileBuffer.length,

          transactionCount:
            resolvedTransactions.length,

          totalAmount,

          format,

          department:
            actualDepartment,
        },
      },
      {
        status: 200,
      },
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
      {
        status: 500,
      },
    );
  }
}

// ============================================================
// DELETE
//
// Existing behavior preserved:
//
// Delete GeneratedFile
// but preserve transaction history
// by setting generatedFileId = null.
// ============================================================

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    // ========================================================
    // AUTH
    // ========================================================

    const session =
      await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }

    // ========================================================
    // FILE ID
    // ========================================================

    const { id } =
      await context.params;

    if (
      !Types.ObjectId.isValid(
        id,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid file ID.",
        },
        {
          status: 400,
        },
      );
    }

    await connectToDatabase();

    const userObjectId =
      new Types.ObjectId(
        session.userId,
      );

    const fileObjectId =
      new Types.ObjectId(id);

    // ========================================================
    // FIND FILE
    // ========================================================

    const file =
      await GeneratedFile.findOne(
        {
          _id:
            fileObjectId,

          userId:
            userObjectId,
        },
      ).select(
        "_id fileName",
      );

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message:
            "File not found.",
        },
        {
          status: 404,
        },
      );
    }

    // ========================================================
    // DETERMINE DEPARTMENT
    // ========================================================

    const isSDHFile =
      String(
        file.fileName ?? "",
      )
        .toUpperCase()
        .includes(
          "SDH09066",
        );

    // ========================================================
    // PRESERVE TRANSACTION HISTORY
    // ========================================================

    if (isSDHFile) {
      await SDHTransaction.updateMany(
        {
          generatedFileId:
            file._id,

          userId:
            userObjectId,
        },
        {
          $set: {
            generatedFileId:
              null,
          },
        },
      );
    } else {
      await Transaction.updateMany(
        {
          generatedFileId:
            file._id,

          userId:
            userObjectId,
        },
        {
          $set: {
            generatedFileId:
              null,
          },
        },
      );
    }

    // ========================================================
    // DELETE FILE ONLY
    // ========================================================

    await GeneratedFile.deleteOne(
      {
        _id:
          file._id,

        userId:
          userObjectId,
      },
    );

    return NextResponse.json(
      {
        success: true,
        message:
          "File deleted successfully.",
      },
      {
        status: 200,
      },
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
          "Unable to delete file.",
      },
      {
        status: 500,
      },
    );
  }
}