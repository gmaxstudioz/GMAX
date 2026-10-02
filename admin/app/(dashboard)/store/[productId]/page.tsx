import type { Metadata } from "next";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq } from "drizzle-orm";
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
        where: eq(schema.product.id, productId),
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
        where: eq(schema.member.userId, session.user.id),
        columns: { role: true },
    });

    const adminRoles = ["owner", "developer"];
    const hasAdminRole = members.some((m: any) => adminRoles.includes(m.role));
    if (members.length > 0 && !hasAdminRole) redirect("/my-tasks");

    const productData = await db.query.product.findFirst({
        where: eq(schema.product.id, productId),
        with: {
            productCategory: true,
            productAccesses: { columns: { id: true } },
        },
    });

    if (!productData) notFound();

    const product = {
        ...productData,
        category: (productData as any).productCategory,
        _count: {
            purchases: (productData as any).productAccesses.length,
        },
    };
    delete (product as any).productAccesses;
    delete (product as any).productCategory;

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