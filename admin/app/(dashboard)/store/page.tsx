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
  const adminRoles = ["owner", "developer"];
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

  const totalSold = products.reduce((acc, p) => acc + p._count.purchases, 0);
  const totalRevenue = products.reduce((acc, p) => {
      const price = p.salePrice ?? p.price;
      return acc + (p._count.purchases * price.toNumber());
  }, 0);

  // Serialize Prisma Decimal objects to plain numbers for Client Components
  const serializedProducts = JSON.parse(JSON.stringify(products, (_key, value) =>
      value !== null && typeof value === "object" && typeof value.toNumber === "function"
          ? value.toNumber()
          : value
  ));

  return (
    <div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6">
      <StoreView 
          initialProducts={serializedProducts} 
          totalSold={totalSold}
          totalRevenue={totalRevenue}
      />
    </div>
  )
}
