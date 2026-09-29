import type { Metadata } from "next";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
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

  const members = await db.query.member.findMany({
      where: (member, { eq }) => eq(member.userId, session.user.id),
      columns: { role: true }
  });
  
  // Only users with some administrative role should access the store manager
  const adminRoles = ["owner", "developer", "manager"];
  const hasAdminRole = members.some((m) => adminRoles.includes(m.role));
  if (members.length > 0 && !hasAdminRole) {
      redirect("/my-tasks");
  }

  const productsRaw = await db.query.product.findMany({
      extras: {
          purchasesCount: sql<number>`(select count(*)::int from "product_access" where "product_access"."productId" = "product"."id")`.as('purchasesCount')
      },
      with: {
          productCategory: true,
      },
      orderBy: (product, { desc }) => [desc(product.createdAt)]
  });

  const products = productsRaw.map(p => {
      const { purchasesCount, ...rest } = p;
      return {
          ...rest,
          _count: { purchases: purchasesCount || 0 }
      };
  });

  // Serialize Prisma Decimal objects to plain numbers for Client Components
  const serializedProducts = JSON.parse(JSON.stringify(products, (_key, value) =>
      value !== null && typeof value === "object" && typeof value.toNumber === "function"
          ? value.toNumber()
          : value
  ));

  return (
    <div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6">
      <StoreView initialProducts={serializedProducts} />
    </div>
  )
}
