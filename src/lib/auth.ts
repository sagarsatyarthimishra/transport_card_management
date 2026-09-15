import { cookies } from "next/headers";

import { connectToDatabase } from "@/lib/mongodb";
import { verifySessionToken } from "@/lib/session";
import User from "@/models/User";

export async function getCurrentSession() {
  const cookieStore = await cookies();

  const sessionCookie = cookieStore.get("transport_session");

  if (!sessionCookie?.value) {
    return null;
  }

  return verifySessionToken(sessionCookie.value);
}

export async function getCurrentUser() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  await connectToDatabase();

  const user = await User.findById(session.userId)
    .select("name email username createdAt")
    .lean();

  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    username: user.username,
    createdAt: user.createdAt,
  };
}