"use server";

import { db } from "@/lib/db";
import { booking, member, client, service, user, bookingStatus, paymentStatus, deliveryStatus } from "@/lib/schema";
import { eq, and, or, ilike, desc } from "drizzle-orm";
import { requireSession } from "./with-auth";

const validBookingStatuses = bookingStatus.enumValues;
const validPaymentStatuses = paymentStatus.enumValues;
const validDeliveryStatuses = deliveryStatus.enumValues;

const ITEMS_PER_PAGE = 12;

// ── Parse and validate filter JSON ──────────────────────────────────────────

function parseFilters(filtersJson: string) {
    try {
        const filters = JSON.parse(filtersJson);
        return { ok: true as const, filters };
    } catch (e) {
        console.warn("[Action] parseFilters: invalid JSON, falling back to ALL filters.", e);
        return { ok: false as const, filters: { booking: "ALL", payment: "ALL", delivery: "ALL" } };
    }
}

// ── Get Member Tasks ─────────────────────────────────────────────────────────

export async function getMemberTasks(
    memberId: string,
    page: number,
    search: string = "",
    filtersJson: string = '{"booking":"ALL","payment":"ALL","delivery":"ALL"}',
) {
    // Auth: get caller's session
    const sessionResult = await requireSession();
    if (sessionResult.status === "error") throw new Error(sessionResult.message);

    // Verify the target member exists and get their studioId
    const targetMember = await db.query.member.findFirst({ where: eq(member.id, memberId) });
    if (!targetMember) throw new Error("Member not found");

    // Verify caller is a member of that same studio
    const callerMember = await db.query.member.findFirst({
        where: and(
            eq(member.userId, sessionResult.session.user.id),
            eq(member.studioId, targetMember.studioId)
        )
    });
    if (!callerMember) throw new Error("Unauthorized");

    const validatedPage = Math.max(0, Math.floor(Number(page) || 0));
    const skip = validatedPage * ITEMS_PER_PAGE;
    const { filters } = parseFilters(filtersJson);

    const conditions = [eq(booking.memberId, memberId)];

    if (filters.booking && filters.booking !== "ALL" && validBookingStatuses.includes(filters.booking as any)) {
        conditions.push(eq(booking.bookingStatus, filters.booking as any));
    }
    if (filters.payment && filters.payment !== "ALL" && validPaymentStatuses.includes(filters.payment as any)) {
        conditions.push(eq(booking.paymentStatus, filters.payment as any));
    }
    if (filters.delivery && filters.delivery !== "ALL" && validDeliveryStatuses.includes(filters.delivery as any)) {
        conditions.push(eq(booking.deliveryStatus, filters.delivery as any));
    }

    if (search.trim() !== "") {
        conditions.push(
            or(
                ilike(client.name, `%${search}%`),
                ilike(service.name, `%${search}%`)
            )!
        );
    }

    const tasksResult = await db.select({
        booking: booking,
        client: client,
        service: service,
    })
    .from(booking)
    .leftJoin(client, eq(booking.clientId, client.id))
    .leftJoin(service, eq(booking.serviceId, service.id))
    .where(and(...conditions))
    .orderBy(desc(booking.createdAt))
    .limit(ITEMS_PER_PAGE)
    .offset(skip);

    return tasksResult.map(t => ({
        ...t.booking,
        client: t.client,
        service: t.service
    }));
}

// ── Get Client Tasks ─────────────────────────────────────────────────────────

export async function getClientTasks(
    clientId: string,
    page: number,
    search: string = "",
    filtersJson: string = '{"booking":"ALL","payment":"ALL","delivery":"ALL"}',
) {
    // Auth: get caller's session
    const sessionResult = await requireSession();
    if (sessionResult.status === "error") throw new Error(sessionResult.message);

    // Verify the target client exists and get their studioId
    const targetClient = await db.query.client.findFirst({ where: eq(client.id, clientId) });
    if (!targetClient) throw new Error("Client not found");

    // Verify caller is a member of that studio
    const callerMember = await db.query.member.findFirst({
        where: and(
            eq(member.userId, sessionResult.session.user.id),
            eq(member.studioId, targetClient.studioId)
        )
    });
    if (!callerMember) throw new Error("Unauthorized");

    const validatedPage = Math.max(0, Math.floor(Number(page) || 0));
    const skip = validatedPage * ITEMS_PER_PAGE;
    const { filters } = parseFilters(filtersJson);

    const conditions = [eq(booking.clientId, clientId)];

    if (filters.booking && filters.booking !== "ALL" && validBookingStatuses.includes(filters.booking as any)) {
        conditions.push(eq(booking.bookingStatus, filters.booking as any));
    }
    if (filters.payment && filters.payment !== "ALL" && validPaymentStatuses.includes(filters.payment as any)) {
        conditions.push(eq(booking.paymentStatus, filters.payment as any));
    }
    if (filters.delivery && filters.delivery !== "ALL" && validDeliveryStatuses.includes(filters.delivery as any)) {
        conditions.push(eq(booking.deliveryStatus, filters.delivery as any));
    }

    if (search.trim() !== "") {
        conditions.push(
            or(
                ilike(service.name, `%${search}%`)
            )!
        );
    }

    const tasksResult = await db.select({
        booking: booking,
        service: service,
        member: member,
        user: user,
    })
    .from(booking)
    .leftJoin(service, eq(booking.serviceId, service.id))
    .leftJoin(member, eq(booking.memberId, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(and(...conditions))
    .orderBy(desc(booking.createdAt))
    .limit(ITEMS_PER_PAGE)
    .offset(skip);

    return tasksResult.map(t => ({
        ...t.booking,
        service: t.service,
        member: t.member ? { ...t.member, user: t.user } : null
    }));
}