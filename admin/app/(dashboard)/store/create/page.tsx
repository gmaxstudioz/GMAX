import type { Metadata } from "next";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CreateProductForm } from "./_components/Createproductform";

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

  const categories = await db.query.productCategory.findMany({
      orderBy: [asc(schema.productCategory.name)],
  });

  return (
    <div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6">
      <CreateProductForm categories={categories} />
    </div>
  )
}
