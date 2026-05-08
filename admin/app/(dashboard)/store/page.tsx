import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { StoreView } from "./_components/StoreView";

export const metadata: Metadata = {
  title: "Store",
  description: "Explore merchandise, equipment, and resources available for purchase.",
};

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/auth/login");

  const members = await prisma.member.findMany({
      where: { userId: session.user.id },
      select: { role: true }
  });
  
  // Only users with some administrative role should access the store manager
  const adminRoles = ["owner", "developer", "manager"];
  const hasAdminRole = members.some(m => adminRoles.includes(m.role));
  if (members.length > 0 && !hasAdminRole) {
      redirect("/my-tasks");
  }

  const products = await prisma.product.findMany({
      include: {
          category: true,
          _count: {
              select: { purchases: true }
          }
      },
      orderBy: {
          createdAt: "desc"
      }
  });

  return (
    <div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6">
      <StoreView initialProducts={products} />
    </div>
  )
}
