import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { EditProductForm } from "./_components/EditProductForm";

interface Props {
    params: Promise<{ productId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { productId } = await params;
    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { title: true },
    });
    return { title: product ? `Edit — ${product.title}` : "Edit Product" };
}

export default async function EditProductPage({ params }: Props) {
    const { productId } = await params;

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login");

    const members = await prisma.member.findMany({
        where: { userId: session.user.id },
        select: { role: true },
    });

    const adminRoles = ["owner", "developer", "manager"];
    const hasAdminRole = members.some((m) => adminRoles.includes(m.role));
    if (members.length > 0 && !hasAdminRole) redirect("/my-tasks");

    const [product, categories] = await Promise.all([
        prisma.product.findUnique({
            where: { id: productId },
            include: { category: true },
        }),
        prisma.productCategory.findMany({ orderBy: { name: "asc" } }),
    ]);

    if (!product) notFound();

    return (
        <div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6">
            <EditProductForm product={product} categories={categories} />
        </div>
    );
}