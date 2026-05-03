"use server";

import { prisma } from "@/lib/prisma";
import { BookingStatus, PaymentStatus, DeliveryStatus } from "@/lib/generated/prisma/client";
import { requireSession } from "./with-auth";

const validBookingStatuses = Object.values(BookingStatus);
const validPaymentStatuses = Object.values(PaymentStatus);
const validDeliveryStatuses = Object.values(DeliveryStatus);

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

function buildStatusFilters(filters: Record<string, string>) {
    const clause: Record<string, string> = {};

    if (filters.booking && filters.booking !== "ALL" && validBookingStatuses.includes(filters.booking as BookingStatus)) {
        clause.bookingStatus = filters.booking;
    }
    if (filters.payment && filters.payment !== "ALL" && validPaymentStatuses.includes(filters.payment as PaymentStatus)) {
        clause.paymentStatus = filters.payment;
    }
    if (filters.delivery && filters.delivery !== "ALL" && validDeliveryStatuses.includes(filters.delivery as DeliveryStatus)) {
        clause.deliveryStatus = filters.delivery;
    }

    return clause;
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
    const targetMember = await prisma.member.findUnique({ where: { id: memberId } });
    if (!targetMember) throw new Error("Member not found");

    // Verify caller is a member of that same studio
    const callerMember = await prisma.member.findFirst({
        where: {
            userId: sessionResult.session.user.id,
            studioId: targetMember.studioId,
        },
    });
    if (!callerMember) throw new Error("Unauthorized");

    const validatedPage = Math.max(0, Math.floor(Number(page) || 0));
    const skip = validatedPage * ITEMS_PER_PAGE;
    const { filters } = parseFilters(filtersJson);

    const whereClause: Record<string, unknown> = {
        memberId,
        ...buildStatusFilters(filters),
    };

    if (search.trim() !== "") {
        whereClause.OR = [
            { client: { name: { contains: search, mode: "insensitive" } } },
            { service: { name: { contains: search, mode: "insensitive" } } },
        ];
    }

    const tasks = await prisma.booking.findMany({
        where: whereClause,
        include: { client: true, service: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: ITEMS_PER_PAGE,
    });

    return tasks;
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
    const targetClient = await prisma.client.findUnique({ where: { id: clientId } });
    if (!targetClient) throw new Error("Client not found");

    // Verify caller is a member of that studio
    const callerMember = await prisma.member.findFirst({
        where: {
            userId: sessionResult.session.user.id,
            studioId: targetClient.studioId,
        },
    });
    if (!callerMember) throw new Error("Unauthorized");

    const validatedPage = Math.max(0, Math.floor(Number(page) || 0));
    const skip = validatedPage * ITEMS_PER_PAGE;
    const { filters } = parseFilters(filtersJson);

    const whereClause: Record<string, unknown> = {
        clientId,
        ...buildStatusFilters(filters),
    };

    if (search.trim() !== "") {
        whereClause.OR = [
            { service: { name: { contains: search, mode: "insensitive" } } },
        ];
    }

    const tasks = await prisma.booking.findMany({
        where: whereClause,
        include: {
            service: true,
            member: { include: { user: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: ITEMS_PER_PAGE,
    });

    return tasks;
}