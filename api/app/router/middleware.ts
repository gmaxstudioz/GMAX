import { contract } from "@/app/contract";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { implement } from "@orpc/server";
import { eq } from "drizzle-orm";

export interface User {
    id: string;
    role?: string;
}

export interface BaseContext {
    headers: Headers;
}

export interface AuthContext extends BaseContext {
    user: User;
}

export interface OptionalAuthContext extends BaseContext {
    user: User | null;
}

const os = implement(contract);

export const authMiddleware = os.$context<BaseContext>().middleware(
    async ({ context, next, errors }) => {
        const session = await auth.api.getSession({
            headers: context.headers,
        });

        if (!session?.user) {
            throw errors.UNAUTHORIZED();
        }

        const dbUser = await db.query.user.findFirst({
            where: eq(schema.user.id, session.user.id),
            columns: { role: true },
        });

        if (!dbUser || dbUser.role === "deleted") {
            throw errors.UNAUTHORIZED();
        }

        return next({
            context: {
                ...context,
                user: { id: session.user.id, role: dbUser.role },
            },
        });
    }
);

export const optionalAuthMiddleware = os.$context<BaseContext>().middleware(
    async ({ context, next }) => {
        const session = await auth.api.getSession({
            headers: context.headers,
        });

        let user: User | null = null;
        if (session?.user) {
            const dbUser = await db.query.user.findFirst({
                where: eq(schema.user.id, session.user.id),
                columns: { role: true },
            });
            if (dbUser && dbUser.role !== "deleted") {
                user = { id: session.user.id, role: dbUser.role };
            }
        }

        return next({
            context: {
                ...context,
                user,
            },
        });
    }
);