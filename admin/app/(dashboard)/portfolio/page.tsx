import type { Metadata } from "next";
import { db } from "@/lib/db";
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
  const user = await db.query.user.findFirst({
    where: (user, { eq }) => eq(user.id, session.user.id),
    columns: { role: true },
  });

  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    const members = await db.query.member.findMany({
      where: (member, { eq }) => eq(member.userId, session.user.id),
      columns: { role: true },
    });
    const adminRoles = ["owner", "developer", "manager"];
    const hasAdminRole = members.some((m) => adminRoles.includes(m.role));
    if (members.length > 0 && !hasAdminRole) {
      redirect("/my-tasks");
    }
  }

  const items = await db.query.portfolioItem.findMany({
    orderBy: (portfolioItem, { asc }) => [asc(portfolioItem.sortOrder)],
  });

  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6">
      <PortfolioView initialItems={items as any} existingCategories={categories} />
    </div>
  );
}
