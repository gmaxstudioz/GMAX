import { auth } from "@/lib/auth"; // path to your auth file
import { isDeniedByArcjet } from "@/lib/arcjet";
import { toNextJsHandler } from "better-auth/next-js";

const authHandler = toNextJsHandler(auth);

export const GET = authHandler.GET;

export async function POST(req: Request) {
    if (await isDeniedByArcjet(req)) {
        return new Response("Too Many Requests", { status: 429 });
    }
    return authHandler.POST(req);
}