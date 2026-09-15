import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import { comparePassword } from "@/lib/password";
import { createSessionToken } from "@/lib/session";
import { loginSchema } from "@/lib/validations";
import User from "@/models/User";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validationResult = loginSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter your login details.",
          errors: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { identifier, password } = validationResult.data;

    const normalizedIdentifier = identifier.trim().toLowerCase();

    await connectToDatabase();

    const user = await User.findOne({
      $or: [
        { email: normalizedIdentifier },
        { username: normalizedIdentifier },
      ],
    }).select("+passwordHash");

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email/username or password.",
        },
        { status: 401 }
      );
    }

    const passwordMatches = await comparePassword(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email/username or password.",
        },
        { status: 401 }
      );
    }

    const sessionToken = await createSessionToken({
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
    });

    const response = NextResponse.json(
      {
        success: true,
        message: "Login successful.",
      },
      { status: 200 }
    );

    response.cookies.set({
      name: "transport_session",
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong. Please try again.",
      },
      { status: 500 }
    );
  }
}