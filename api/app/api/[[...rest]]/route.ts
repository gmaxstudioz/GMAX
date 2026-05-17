import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins'
import { CORSPlugin } from '@orpc/server/plugins'
import { onError } from '@orpc/server'
import { SmartCoercionPlugin } from "@orpc/json-schema"
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { router } from '@/app/router';

const schemaConverters = [new ZodToJsonSchemaConverter()]

const handler = new OpenAPIHandler(router, {
  plugins: [
    new CORSPlugin(),
    new SmartCoercionPlugin({ schemaConverters }),
    new OpenAPIReferencePlugin({ 
        schemaConverters,
        specGenerateOptions: {
            info: {
                title: 'GMAX Studioz API',
                version: '1.0.0',
                description: 'GMAX Studioz API for booking and managing studio',
            }
        }
     })
  ],
  interceptors: [
    onError((_error) => {
      const error = _error as Record<string, any>;
      console.error(error)
      if (error.cause && 'issues' in (error.cause as any)) {
        console.error('Zod issues:', JSON.stringify((error.cause as any).issues, null, 2));
        console.error('Data sample:', JSON.stringify((error.cause as any).data?.items?.[0], null, 2));
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