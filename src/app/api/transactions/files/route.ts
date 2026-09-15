import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";

import GeneratedFile from "@/models/GeneratedFile";

export const runtime = "nodejs";

/**
 * Escape special regex characters.
 */
function escapeRegex(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

/**
 * Start of calendar day.
 */
function getStartOfDay(
  value: string,
): Date | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return null;
  }

  const date = new Date(
    `${value}T00:00:00.000`,
  );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date;
}

/**
 * End of calendar day.
 */
function getEndOfDay(
  value: string,
): Date | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return null;
  }

  const date = new Date(
    `${value}T23:59:59.999`,
  );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date;
}

export async function GET(
  request: Request,
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

    const { searchParams } =
      new URL(request.url);

    const search =
      searchParams
        .get("search")
        ?.trim() ?? "";

    const fromDate =
      searchParams
        .get("fromDate")
        ?.trim() ?? "";

    const toDate =
      searchParams
        .get("toDate")
        ?.trim() ?? "";

    const pageParam =
      Number(
        searchParams.get(
          "page",
        ) ?? "1",
      );

    const limitParam =
      Number(
        searchParams.get(
          "limit",
        ) ?? "10",
      );

    const page =
      Number.isFinite(
        pageParam,
      ) && pageParam > 0
        ? Math.floor(pageParam)
        : 1;

    const allowedLimits = [
      10,
      20,
      30,
    ];

    const limit =
      allowedLimits.includes(
        limitParam,
      )
        ? limitParam
        : 10;

    await connectToDatabase();

    const filter: Record<
      string,
      unknown
    > = {
      userId: session.userId,
    };

    /*
     * Search.
     */
    if (search) {
      filter.fileName = {
        $regex:
          escapeRegex(search),
        $options: "i",
      };
    }

    /*
     * Date validation.
     */
    const startDate =
      fromDate
        ? getStartOfDay(fromDate)
        : null;

    const endDate =
      toDate
        ? getEndOfDay(toDate)
        : null;

    if (
      fromDate &&
      !startDate
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid From Date.",
        },
        { status: 400 },
      );
    }

    if (
      toDate &&
      !endDate
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid To Date.",
        },
        { status: 400 },
      );
    }

    if (
      startDate &&
      endDate &&
      startDate > endDate
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "From Date cannot be after To Date.",
        },
        { status: 400 },
      );
    }

    /*
     * Date filter.
     */
    if (
      startDate ||
      endDate
    ) {
      const createdAt: Record<
        string,
        Date
      > = {};

      if (startDate) {
        createdAt.$gte =
          startDate;
      }

      if (endDate) {
        createdAt.$lte =
          endDate;
      }

      filter.createdAt =
        createdAt;
    }

    const skip =
      (page - 1) * limit;

    /*
     * Keep generated files newest-first
     * on the Files page.
     *
     * This is separate from the order
     * INSIDE each generated file.
     */
    const [
      files,
      total,
    ] = await Promise.all([
      GeneratedFile.find(
        filter,
      )
        .select(
          "_id fileName fileSize transactionCount totalAmount contentType createdAt updatedAt",
        )
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      GeneratedFile.countDocuments(
        filter,
      ),
    ]);

    const data =
      files.map(
        (file) => ({
          id: file._id.toString(),

          fileName:
            file.fileName,

          fileSize:
            file.fileSize ??
            null,

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
        }),
      );

    const totalPages =
      total === 0
        ? 1
        : Math.ceil(
            total / limit,
          );

    return NextResponse.json(
      {
        success: true,

        data,

        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Get generated files error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to fetch generated files.",
      },
      { status: 500 },
    );
  }
}