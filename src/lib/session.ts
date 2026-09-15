import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  throw new Error("Please define SESSION_SECRET in .env.local");
}

const secretKey = new TextEncoder().encode(SESSION_SECRET);

export interface SessionPayload extends JWTPayload{
  userId: string;
  email: string;
  username: string;
}

export async function createSessionToken(
  payload: SessionPayload
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);

    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.username !== "string"
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      username: payload.username,
    };
  } catch {
    return null;
  }
}