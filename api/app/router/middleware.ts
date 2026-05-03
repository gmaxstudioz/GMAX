import { contract } from "@/contract";
import { auth } from "@/lib/auth";
import { implement } from "@orpc/server";

export interface User {
    id: string;
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

function parseToken(authorization: string | null): User | null {
    if(!authorization) return null;
    const token = authorization.split(" ")[1];
    if (!token) return null;

    return { id: token };
}

const os = implement(contract)

export const authMiddleware = os.$context<BaseContext>().middleware(
    async ({ context, next, errors }) => {
        const session = await auth.api.getSession({
            headers: context.headers,
        });

        if (!session?.user) {
            throw errors.UNAUTHORIZED();
        }

        return next({ 
            context: { 
                ...context, 
                user: { id: session.user.id } 
            } 
        });
    }
);

export const optionalAuthMiddleware = os.$context<BaseContext>().middleware(
    async ({ context, next }) => {
        const session = await auth.api.getSession({
            headers: context.headers,
        });

        return next({ 
            context: { 
                ...context, 
                user: session?.user ? { id: session.user.id } : null 
            } 
        });
    }
);