import { redirect } from "next/navigation";

import DashboardShell from "@/components/layout/DashboardShell";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  // User is not logged in
  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell
      user={{
        name: user.name,
        email: user.email,
        username: user.username,
      }}
    >
      {children}
    </DashboardShell>
  );
}