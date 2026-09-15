import { NextResponse } from "next/server";
import { Types } from "mongoose";
import ExcelJS from "exceljs";

import { getCurrentSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";

import GeneratedFile from "@/models/GeneratedFile";
import Transaction from "@/models/Transaction";
import SDHTransaction from "@/models/SDHTransaction";

export const runtime = "nodejs";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const CSV_CONTENT_TYPE =
  "text/csv; charset=utf-8";

interface TransactionRow {
  cardNumber: string;
  amount: number;
}

function normalizeCardNumber(
  value: string,
): string {
  return value
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

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

        if (Buffer.isBuffer(result)) {
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
      Array.isArray(binary.data)
    ) {
      return Buffer.from(
        binary.data as number[],
      );
    }
  }

  return null;
}

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
      " ",
    ],
  );
}

function findDuplicates(
  transactions: TransactionRow[],
): Set<string> {
  const counts =
    new Map<string, number>();

  for (const transaction of transactions) {
    const card =
      normalizeCardNumber(
        transaction.cardNumber,
      );

    counts.set(
      card,
      (counts.get(card) ?? 0) + 1,
    );
  }

  const duplicates =
    new Set<string>();

  for (const [card, count] of counts) {
    if (count > 1) {
      duplicates.add(card);
    }
  }

  return duplicates;
}

function createCsvBuffer(
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

async function createXlsxBuffer(
  transactions: TransactionRow[],
  departmentCode:
    | "MMM11473"
    | "SDH09066",
): Promise<Buffer> {
  const workbook =
    new ExcelJS.Workbook();

  const now = new Date();

  workbook.creator =
    "Transport Department";

  workbook.lastModifiedBy =
    "Transport Department";

  workbook.created = now;
  workbook.modified = now;

  const worksheet =
    workbook.addWorksheet(
      departmentCode ===
        "SDH09066"
        ? "SALARY_SDH09066_20161229"
        : "SALARY_MMM11473_20210202_0RE00O",
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
    {
      key: "blank",
      width: 1.77734375,
    },
  ];

  const duplicateCards =
    findDuplicates(
      transactions,
    );

  /*
   * transactions are already:
   *
   * oldest -> latest
   */

  for (const transaction of transactions) {
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
        " ",
      ]);

    row.getCell(1).numFmt = "@";

    row.getCell(1).value =
      String(
        transaction.cardNumber,
      );

    row.getCell(2).numFmt = "@";

    row.getCell(3).numFmt = "0.00";

    row.getCell(4).numFmt = "@";

    row.getCell(5).numFmt = "@";

    row.getCell(6).numFmt = "@";

    /*
     * DUPLICATE HIGHLIGHT
     *
     * NOW BOTH MMM + SDH.
     */
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
        column <= 6;
        column++
      ) {
        const cell =
          row.getCell(column);

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

  const excelBuffer =
    await workbook.xlsx.writeBuffer();

  return Buffer.from(
    excelBuffer,
  );
}

function changeExtension(
  fileName: string,
  extension:
    | "xlsx"
    | "csv",
): string {
  const withoutExtension =
    fileName.replace(
      /\.[^.]+$/,
      "",
    );

  return `${withoutExtension}.${extension}`;
}

export async function GET(
  request: Request,
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
          message:
            "Unauthorized.",
        },
        { status: 401 },
      );
    }

    const { id } =
      await context.params;

    if (
      !Types.ObjectId.isValid(id)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid file ID.",
        },
        { status: 400 },
      );
    }

    const { searchParams } =
      new URL(request.url);

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
        { status: 400 },
      );
    }

    await connectToDatabase();

    const fileObjectId =
      new Types.ObjectId(id);

    const userObjectId =
      new Types.ObjectId(
        session.userId,
      );

    const rawFile =
      await GeneratedFile.collection.findOne(
        {
          _id: fileObjectId,
          userId: userObjectId,
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
        { status: 404 },
      );
    }

    /*
     * Determine department from filename.
     */
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

    /*
     * ==========================================================
     * FETCH LINKED TRANSACTIONS
     * ==========================================================
     */

    let transactions:
      TransactionRow[] = [];

    if (isSDHFile) {
      /*
       * SDH:
       *
       * sequence is authoritative.
       */
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
            "cardNumber amount sequence createdAt _id",
          )
          .sort({
            sequence: 1,
            createdAt: 1,
            _id: 1,
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
      /*
       * MMM:
       *
       * New generated transactions are
       * inserted in exact file order.
       *
       * _id ascending therefore preserves
       * that insertion order.
       *
       * createdAt + _id is also used as
       * fallback for old records.
       */
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
            "cardNumber amount createdAt _id",
          )
          .sort({
            createdAt: 1,
            _id: 1,
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

    if (
      transactions.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            isSDHFile
              ? "No SDH transactions are linked with this file."
              : "No transactions are linked with this file.",
        },
        { status: 404 },
      );
    }

    /*
     * ==========================================================
     * CSV
     * ==========================================================
     */

    if (
      requestedFormat === "csv"
    ) {
      const csvBuffer =
        createCsvBuffer(
          transactions,
          departmentCode,
        );

      const fileName =
        changeExtension(
          String(
            rawFile.fileName,
          ),
          "csv",
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

    /*
     * ==========================================================
     * XLSX
     * ==========================================================
     *
     * IMPORTANT:
     *
     * Always rebuild.
     *
     * This fixes:
     *
     * 1. MMM duplicate highlighting
     * 2. SDH duplicate highlighting
     * 3. Correct entry order
     * 4. Old/corrupt stored XLSX
     */

    const xlsxBuffer =
      await createXlsxBuffer(
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
        { status: 500 },
      );
    }

    const fileName =
      changeExtension(
        String(
          rawFile.fileName,
        ),
        "xlsx",
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
            `attachment; filename="${fileName}"`,

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
      "Download generated file error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to download file.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
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
          message:
            "Unauthorized.",
        },
        { status: 401 },
      );
    }

    const { id } =
      await context.params;

    if (
      !Types.ObjectId.isValid(id)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid file ID.",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const userObjectId =
      new Types.ObjectId(
        session.userId,
      );

    const fileObjectId =
      new Types.ObjectId(id);

    const file =
      await GeneratedFile.findOne(
        {
          _id: fileObjectId,
          userId: userObjectId,
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
        { status: 404 },
      );
    }

    const isSDHFile =
      String(
        file.fileName ?? "",
      )
        .toUpperCase()
        .includes(
          "SDH09066",
        );

    /*
     * Preserve transaction history.
     */
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

    await GeneratedFile.deleteOne(
      {
        _id: file._id,
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
          "Unable to delete file.",
      },
      { status: 500 },
    );
  }
}