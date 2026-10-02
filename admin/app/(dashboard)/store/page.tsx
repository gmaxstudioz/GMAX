import type { Metadata } from "next";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
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
      where: eq(schema.member.userId, session.user.id),
      columns: { role: true }
  });
  
  // Only users with some administrative role should access the store manager
  const adminRoles = ["owner", "developer"];
  const hasAdminRole = members.some((m: any) => adminRoles.includes(m.role));
  if (members.length > 0 && !hasAdminRole) {
      redirect("/my-tasks");
  }

  const productsData = await db.query.product.findMany({
      with: {
          productCategory: true,
          productAccesses: { columns: { id: true } }
      },
      orderBy: [desc(schema.product.createdAt)]
  });

  const products = productsData.map((p) => {
      const product = {
          ...p,
          category: (p as any).productCategory,
          _count: { purchases: (p as any).productAccesses.length }
      };
      delete (product as any).productAccesses;
      delete (product as any).productCategory;
      return product;
  });

  const totalSold = products.reduce((acc: any, p: any) => acc + p._count.purchases, 0);
  const totalRevenue = products.reduce((acc: any, p: any) => {
      const price = p.salePrice ?? p.price;
      // Depending on whether price is a string or a Number/Decimal, handle it.
      // Drizzle typically returns numeric fields as string in postgres/pg driver.
      const priceVal = typeof price?.toNumber === "function" ? price.toNumber() : Number(price || 0);
      return acc + (p._count.purchases * priceVal);
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
