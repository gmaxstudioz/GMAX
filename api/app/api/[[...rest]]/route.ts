import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins'
import { CORSPlugin } from '@orpc/server/plugins'
import { onError } from '@orpc/server'
import { SmartCoercionPlugin } from "@orpc/json-schema"
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { router } from '@/app/router';

const schemaConverters = [new ZodToJsonSchemaConverter()]

const configuredOrigins = [
  ...(process.env.ALLOWED_ORIGINS?.split(",") ?? []),
  process.env.PORTAL_URL ?? "",
  process.env.BETTER_AUTH_URL ?? "",
]
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const allowedOriginSet = new Set(configuredOrigins);

if (allowedOriginSet.size === 0) {
  console.warn("[CORS] No ALLOWED_ORIGINS, PORTAL_URL, or BETTER_AUTH_URL configured — CORSPlugin falling back to permissive origin reflection.");
}

const handler = new OpenAPIHandler(router, {
  plugins: [
    new CORSPlugin({
      origin: (origin) => {
        if (allowedOriginSet.size === 0) {
          return origin;
        }
        return allowedOriginSet.has(origin.replace(/\/+$/, "")) ? origin : null;
      },
    }),
    new SmartCoercionPlugin({ schemaConverters }),
    new OpenAPIReferencePlugin({ 
        schemaConverters,
        specGenerateOptions: {
            info: {
                title: 'Gmax Studioz API',
                version: '1.0.0',
                description: 'Gmax Studioz API for booking and managing studio',
            }
        }
     })
  ],
  interceptors: [
    onError((_error) => {
      const error = _error as Record<string, unknown>;
      console.error(error)
      
      const cause = error.cause as Record<string, unknown> | undefined;
      if (cause && typeof cause === 'object' && 'issues' in cause) {
        console.error('Validation failed', {
          issueCount: Array.isArray(cause.issues) ? cause.issues.length : undefined,
        });
     }
    }),
  ],
});

async function handleRequest(request: Request) {
    const { response } = await handler.handle(request, {
        prefix: '/api',
        context: { headers: request.headers }
    });

    return response ?? new Response('Not Found', { status: 404 });
}

export const HEAD = handleRequest;
export const GET = handleRequest;
export const POST = handleRequest; 
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
export const OPTIONS = handleRequest;
export const TRACE = handleRequest;
export const CONNECT = handleRequest;