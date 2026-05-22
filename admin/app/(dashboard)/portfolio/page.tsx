import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PortfolioView } from "./_components/PortfolioView";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Manage your portfolio works displayed on the public site.",
};

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/auth/login");

  // Allow admins or studio owners/managers
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    const members = await prisma.member.findMany({
      where: { userId: session.user.id },
      select: { role: true },
    });
    const adminRoles = ["owner", "developer", "manager"];
    const hasAdminRole = members.some((m) => adminRoles.includes(m.role));
    if (members.length > 0 && !hasAdminRole) {
      redirect("/my-tasks");
    }
  }

  const items = await prisma.portfolioItem.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6">
      <PortfolioView initialItems={items} existingCategories={categories} />
    </div>
  );
}
