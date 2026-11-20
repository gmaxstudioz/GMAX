import type { Metadata } from "next";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { EditProductForm } from "./_components/EditProductForm";

interface Props {
    params: Promise<{ productId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { productId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { title: "Edit Product" };

    const [dbUser, members] = await Promise.all([
        db.query.user.findFirst({ where: eq(schema.user.id, session.user.id), columns: { role: true } }),
        db.query.member.findMany({ where: eq(schema.member.userId, session.user.id), columns: { role: true } }),
    ]);
    const isAllowed = dbUser?.role === "admin" || members.some((m: any) => ["owner", "developer"].includes(m.role));
    if (!isAllowed) return { title: "Edit Product" };

    const product = await db.query.product.findFirst({
        where: eq(schema.product.id, productId),
        columns: { title: true },
    });
    return { title: product ? `Edit — ${product.title}` : "Edit Product" };
}

export default async function EditProductPage({ params }: Props) {
    const { productId } = await params;

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login");

    const [dbUser, members] = await Promise.all([
        db.query.user.findFirst({
            where: eq(schema.user.id, session.user.id),
            columns: { role: true },
        }),
        db.query.member.findMany({
            where: eq(schema.member.userId, session.user.id),
            columns: { role: true },
        }),
    ]);

    const isPlatformAdmin = dbUser?.role === "admin";
    const adminRoles = ["owner", "developer"];
    const hasAdminRole = members.some((m: any) => adminRoles.includes(m.role));
    if (!isPlatformAdmin && !hasAdminRole) redirect("/my-tasks");

    const [product, categories] = await Promise.all([
        db.query.product.findFirst({
            where: eq(schema.product.id, productId),
            with: { productCategory: true },
        }),
        db.query.productCategory.findMany({
            orderBy: [asc(schema.productCategory.name)],
        }),
    ]);

    if (!product) notFound();
    (product as any).category = (product as any).productCategory;

    // Serialize Prisma Decimal objects to plain numbers for Client Components
    const serializedProduct = JSON.parse(JSON.stringify(product, (_key, value) =>
        value !== null && typeof value === "object" && typeof value.toNumber === "function"
            ? value.toNumber()
            : value
    ));

    return (
        <div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6">
            <EditProductForm product={serializedProduct} categories={categories} />
        </div>
    );
}