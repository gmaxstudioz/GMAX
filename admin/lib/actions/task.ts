"use server";

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, and, or, ilike, desc } from "drizzle-orm";
import { requireSession } from "./with-auth";

const validBookingStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
const validPaymentStatuses = ['PENDING', 'PAID', 'PARTIALLY_PAID', 'CANCELLED'];
const validDeliveryStatuses = ['PENDING', 'DELIVERED', 'CANCELLED'];

const ITEMS_PER_PAGE = 12;

function parseFilters(filtersJson: string) {
    try {
        const filters = JSON.parse(filtersJson);
        return { ok: true as const, filters };
    } catch (e) {
        console.warn("[Action] parseFilters: invalid JSON, falling back to ALL filters.", e);
        return { ok: false as const, filters: { booking: "ALL", payment: "ALL", delivery: "ALL" } };
    }
}

export async function getMemberTasks(
    memberId: string,
    page: number,
    search: string = "",
    filtersJson: string = '{"booking":"ALL","payment":"ALL","delivery":"ALL"}',
) {
    const sessionResult = await requireSession();
    if (sessionResult.status === "error") throw new Error(sessionResult.message);

    const targetMember = await db.query.member.findFirst({ where: eq(schema.member.id, memberId) });
    if (!targetMember) throw new Error("Member not found");

    const callerMember = await db.query.member.findFirst({
        where: and(
            eq(schema.member.userId, sessionResult.session.user.id),
            eq(schema.member.studioId, targetMember.studioId)
        )
    });
    if (!callerMember) throw new Error("Unauthorized");

    const validatedPage = Math.max(0, Math.floor(Number(page) || 0));
    const skipAmount = validatedPage * ITEMS_PER_PAGE;
    const { filters } = parseFilters(filtersJson);

    const conditions: any[] = [eq(schema.booking.memberId, memberId)];

    if (filters.booking && filters.booking !== "ALL" && validBookingStatuses.includes(filters.booking)) {
        conditions.push(eq(schema.booking.bookingStatus, filters.booking as any));
    }
    if (filters.payment && filters.payment !== "ALL" && validPaymentStatuses.includes(filters.payment)) {
        conditions.push(eq(schema.booking.paymentStatus, filters.payment as any));
    }
    if (filters.delivery && filters.delivery !== "ALL" && validDeliveryStatuses.includes(filters.delivery)) {
        conditions.push(eq(schema.booking.deliveryStatus, filters.delivery as any));
    }

    if (search.trim() !== "") {
        // We will need to query clients and services manually or join them.
        // Drizzle query API supports nested filters, but we have to do it carefully or use standard select with joins.
        // Since we are using query API, it's easier to fetch all matching bookings and filter in memory if the dataset is small,
        // or just use relations filtering. Let's do a subquery or join for search.
        // Actually, we can fetch using `db.select().from(booking).leftJoin(...)`
    }

    // Let's implement full search using db.select
    
    let baseQuery = db.select()
        .from(schema.booking)
        .leftJoin(schema.client, eq(schema.booking.clientId, schema.client.id))
        .leftJoin(schema.service, eq(schema.booking.serviceId, schema.service.id))
        .where(and(...conditions));

    if (search.trim() !== "") {
        const searchPattern = `%${search}%`;
        const searchCondition = or(
            ilike(schema.client.name, searchPattern),
            ilike(schema.service.name, searchPattern)
        );
        baseQuery = db.select()
            .from(schema.booking)
            .leftJoin(schema.client, eq(schema.booking.clientId, schema.client.id))
            .leftJoin(schema.service, eq(schema.booking.serviceId, schema.service.id))
            .where(and(...conditions, searchCondition));
    }

    const tasks = await baseQuery
        .orderBy(desc(schema.booking.createdAt))
        .limit(ITEMS_PER_PAGE)
        .offset(skipAmount);

    return tasks.map((row) => ({
        ...row.booking,
        client: row.client,
        service: row.service,
        totalAmount: Number(row.booking.totalAmount)
    }));
}

export async function getClientTasks(
    clientId: string,
    page: number,
    search: string = "",
    filtersJson: string = '{"booking":"ALL","payment":"ALL","delivery":"ALL"}',
) {
    const sessionResult = await requireSession();
    if (sessionResult.status === "error") throw new Error(sessionResult.message);

    const targetClient = await db.query.client.findFirst({ where: eq(schema.client.id, clientId) });
    if (!targetClient) throw new Error("Client not found");

    const callerMember = await db.query.member.findFirst({
        where: and(
            eq(schema.member.userId, sessionResult.session.user.id),
            eq(schema.member.studioId, targetClient.studioId)
        )
    });
    if (!callerMember) throw new Error("Unauthorized");

    const validatedPage = Math.max(0, Math.floor(Number(page) || 0));
    const skipAmount = validatedPage * ITEMS_PER_PAGE;
    const { filters } = parseFilters(filtersJson);

    const conditions: any[] = [eq(schema.booking.clientId, clientId)];

    if (filters.booking && filters.booking !== "ALL" && validBookingStatuses.includes(filters.booking)) {
        conditions.push(eq(schema.booking.bookingStatus, filters.booking as any));
    }
    if (filters.payment && filters.payment !== "ALL" && validPaymentStatuses.includes(filters.payment)) {
        conditions.push(eq(schema.booking.paymentStatus, filters.payment as any));
    }
    if (filters.delivery && filters.delivery !== "ALL" && validDeliveryStatuses.includes(filters.delivery)) {
        conditions.push(eq(schema.booking.deliveryStatus, filters.delivery as any));
    }

    let baseQuery = db.select({
            booking: schema.booking,
            service: schema.service,
            member: schema.member,
            user: schema.user
        })
        .from(schema.booking)
        .leftJoin(schema.service, eq(schema.booking.serviceId, schema.service.id))
        .leftJoin(schema.member, eq(schema.booking.memberId, schema.member.id))
        .leftJoin(schema.user, eq(schema.member.userId, schema.user.id))
        .where(and(...conditions));

    if (search.trim() !== "") {
        const searchPattern = `%${search}%`;
        const searchCondition = ilike(schema.service.name, searchPattern);
        
        baseQuery = db.select({
                booking: schema.booking,
                service: schema.service,
                member: schema.member,
                user: schema.user
            })
            .from(schema.booking)
            .leftJoin(schema.service, eq(schema.booking.serviceId, schema.service.id))
            .leftJoin(schema.member, eq(schema.booking.memberId, schema.member.id))
            .leftJoin(schema.user, eq(schema.member.userId, schema.user.id))
            .where(and(...conditions, searchCondition));
    }

    const tasks = await baseQuery
        .orderBy(desc(schema.booking.createdAt))
        .limit(ITEMS_PER_PAGE)
        .offset(skipAmount);

    return tasks.map((row) => ({
        ...row.booking,
        service: row.service,
        member: row.member ? {
            ...row.member,
            user: row.user
        } : null,
        totalAmount: Number(row.booking.totalAmount)
    }));
}
