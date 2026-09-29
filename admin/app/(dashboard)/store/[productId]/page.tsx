import type { Metadata } from "next";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { ProductDetailsView } from "./_components/ProductDetailsView";

interface Props {
    params: Promise<{ productId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { productId } = await params;
    const product = await db.query.product.findFirst({
        where: (product, { eq }) => eq(product.id, productId),
        columns: { title: true, description: true },
    });

    if (!product) return { title: "Product Not Found" };

    return {
        title: product.title,
        description: product.description,
    };
}

export default async function ProductDetailsPage({ params }: Props) {
    const { productId } = await params;

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login");

    const members = await db.query.member.findMany({
        where: (member, { eq }) => eq(member.userId, session.user.id),
        columns: { role: true },
    });

    const adminRoles = ["owner", "developer", "manager"];
    const hasAdminRole = members.some((m) => adminRoles.includes(m.role));
    if (members.length > 0 && !hasAdminRole) redirect("/my-tasks");

    const productRaw = await db.query.product.findFirst({
        where: (product, { eq }) => eq(product.id, productId),
        extras: {
            purchasesCount: sql<number>`(select count(*)::int from "product_access" where "product_access"."productId" = "product"."id")`.as('purchasesCount')
        },
        with: {
            productCategory: true,
        },
    });

    if (!productRaw) notFound();

    const product = {
        ...productRaw,
        _count: { purchases: (productRaw as any).purchasesCount || 0 }
    };

    // Serialize Prisma Decimal objects to plain numbers for Client Components
    const serializedProduct = JSON.parse(JSON.stringify(product, (_key, value) =>
        value !== null && typeof value === "object" && typeof value.toNumber === "function"
            ? value.toNumber()
            : value
    ));

    return (
        <div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6">
            <ProductDetailsView product={serializedProduct} />
        </div>
    );
}