import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";

let posthogLogProvider: LoggerProvider | null = null;

function getPostHogLogProvider() {
    if (posthogLogProvider) {
        return posthogLogProvider;
    }

    const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (!projectToken || !host) {
        if (process.env.NODE_ENV === "development") {
            const missingVariable = !projectToken
                ? "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN"
                : "NEXT_PUBLIC_POSTHOG_HOST";
            throw new Error(
                `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
            );
        }

        return null;
    }

    posthogLogProvider = new LoggerProvider({
        resource: resourceFromAttributes({
            "service.name": "gmax-api",
            "deployment.environment": process.env.NODE_ENV ?? "production",
        }),
        processors: [
            new BatchLogRecordProcessor({
                exporter: new OTLPLogExporter({
                    url: `${host.replace(/\/$/, "")}/i/v1/logs`,
                    headers: {
                        Authorization: `Bearer ${projectToken}`,
                        "Content-Type": "application/json",
                    },
                }),
            }),
        ],
    });

    return posthogLogProvider;
}

export function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        getPostHogLogProvider();
    }
}

export function getPostHogLogger() {
    return getPostHogLogProvider()?.getLogger("posthog-dedicated-logs") ?? null;
}

export async function flushPostHogLogs() {
    await posthogLogProvider?.forceFlush();
}
