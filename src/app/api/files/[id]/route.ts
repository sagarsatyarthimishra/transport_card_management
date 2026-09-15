import { NextResponse } from "next/server";
import { Types } from "mongoose";

import { getCurrentSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import GeneratedFile from "@/models/GeneratedFile";
import Transaction from "@/models/Transaction";

export const runtime = "nodejs";

/**
 * Extract a Node.js Buffer from MongoDB's BSON Binary,
 * Mongoose Buffer, Uint8Array, or other compatible binary values.
 */
function extractFileBuffer(
  value: unknown,
): Buffer | null {
  if (!value) {
    return null;
  }

  // Normal Node.js Buffer
  if (Buffer.isBuffer(value)) {
    return value;
  }

  // Uint8Array
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  // MongoDB BSON Binary normally exposes `.buffer`
  if (
    typeof value === "object" &&
    value !== null &&
    "buffer" in value
  ) {
    const bufferValue = (
      value as {
        buffer?: unknown;
      }
    ).buffer;

    if (Buffer.isBuffer(bufferValue)) {
      return bufferValue;
    }

    if (
      bufferValue instanceof Uint8Array
    ) {
      return Buffer.from(bufferValue);
    }
  }

  // MongoDB BSON Binary can expose a `value()` method.
  if (
    typeof value === "object" &&
    value !== null &&
    "value" in value &&
    typeof (
      value as {
        value?: unknown;
      }
    ).value === "function"
  ) {
    try {
      const binaryValue = (
        value as {
          value: () => unknown;
        }
      ).value();

      if (Buffer.isBuffer(binaryValue)) {
        return binaryValue;
      }

      if (
        binaryValue instanceof Uint8Array
      ) {
        return Buffer.from(binaryValue);
      }
    } catch {
      // Continue with other conversion methods.
    }
  }

  return null;
}

/**
 * GET /api/transactions/files/[id]
 *
 * Downloads a previously generated Excel file.
 *
 * The file is read directly from the MongoDB collection
 * so BSON Binary data is handled correctly.
 */
export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    // ============================================================
    // 1. Authentication
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
    // 2. Get file ID
    // ============================================================

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

    // ============================================================
    // 3. Database connection
    // ============================================================

    await connectToDatabase();

    const fileObjectId =
      new Types.ObjectId(id);

    const userObjectId =
      new Types.ObjectId(session.userId);

    // ============================================================
    // 4. Read RAW MongoDB document
    //
    // We intentionally use the native MongoDB collection here.
    // This avoids Mongoose Buffer hydration/casting issues.
    // ============================================================

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
          message: "File not found.",
        },
        { status: 404 },
      );
    }

    // ============================================================
    // 5. Extract binary file data
    // ============================================================

    const fileBuffer =
      extractFileBuffer(
        rawFile.fileData,
      );

    // ============================================================
    // 6. Validate binary data
    // ============================================================

    if (!fileBuffer) {
      console.error(
        "Unable to extract stored file data.",
        {
          fileId: id,
          fileName: rawFile.fileName,
          storedFileSize:
            rawFile.fileSize,
          fileDataType:
            typeof rawFile.fileData,
        },
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to read stored file data.",
        },
        { status: 500 },
      );
    }

    if (fileBuffer.length === 0) {
      console.error(
        "Stored file binary contains zero bytes.",
        {
          fileId: id,
          fileName: rawFile.fileName,
          storedFileSize:
            rawFile.fileSize,
        },
      );

      return NextResponse.json(
        {
          success: false,
          message: "Stored file is empty.",
        },
        { status: 500 },
      );
    }

    // ============================================================
    // 7. Validate XLSX ZIP signature
    //
    // XLSX files are ZIP containers.
    // A normal XLSX starts with:
    //
    // 50 4B 03 04
    // ============================================================

    const isXlsxZip =
      fileBuffer.length >= 4 &&
      fileBuffer[0] === 0x50 &&
      fileBuffer[1] === 0x4b &&
      fileBuffer[2] === 0x03 &&
      fileBuffer[3] === 0x04;

    if (!isXlsxZip) {
      console.error(
        "Stored file does not have a valid XLSX ZIP signature.",
        {
          fileId: id,
          fileName: rawFile.fileName,
          fileSize: fileBuffer.length,
          firstBytes:
            fileBuffer
              .subarray(0, 8)
              .toString("hex"),
        },
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Stored file is not a valid Excel file.",
        },
        { status: 500 },
      );
    }

    // ============================================================
    // 8. Logging for debugging
    // ============================================================

    console.log(
      "Generated file download:",
      {
        fileId: id,
        fileName: rawFile.fileName,
        storedSize: rawFile.fileSize,
        actualSize: fileBuffer.length,
      },
    );

    // ============================================================
    // 9. Return Excel binary
    // ============================================================

    return new NextResponse(
      new Uint8Array(fileBuffer),
      {
        status: 200,

        headers: {
          "Content-Type":
            rawFile.contentType ||
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

          "Content-Disposition":
            `attachment; filename="${rawFile.fileName}"`,

          "Content-Length":
            String(fileBuffer.length),

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

/**
 * DELETE /api/transactions/files/[id]
 *
 * Deletes the generated Excel file.
 *
 * Transactions remain in the database.
 */
export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    // ============================================================
    // 1. Authentication
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
    // 2. Get file ID
    // ============================================================

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

    // ============================================================
    // 3. Database connection
    // ============================================================

    await connectToDatabase();

    const userObjectId =
      new Types.ObjectId(session.userId);

    const fileObjectId =
      new Types.ObjectId(id);

    // ============================================================
    // 4. Verify ownership
    // ============================================================

    const file =
      await GeneratedFile.findOne({
        _id: fileObjectId,
        userId: userObjectId,
      }).select("_id fileName");

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message: "File not found.",
        },
        { status: 404 },
      );
    }

    // ============================================================
    // 5. Keep transaction history
    //
    // Only remove generatedFileId reference.
    // ============================================================

    await Transaction.updateMany(
      {
        generatedFileId: file._id,
        userId: userObjectId,
      },
      {
        $set: {
          generatedFileId: null,
        },
      },
    );

    // ============================================================
    // 6. Delete generated file
    // ============================================================

    await GeneratedFile.deleteOne({
      _id: file._id,
      userId: userObjectId,
    });

    // ============================================================
    // 7. Success
    // ============================================================

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