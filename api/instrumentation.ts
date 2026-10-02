import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { resourceFromAttributes } from "@opentelemetry/resources";

const posthogProjectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

function reportMissingConfiguration(variableName: string) {
    if (process.env.NODE_ENV === "development") {
        throw new Error(
            `${variableName} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variableName} is configured`,
        );
    }
}

if (!posthogProjectToken) {
    reportMissingConfiguration("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN");
}

if (!posthogHost) {
    reportMissingConfiguration("NEXT_PUBLIC_POSTHOG_HOST");
}

export const posthogLogProvider = posthogProjectToken && posthogHost
    ? new LoggerProvider({
        resource: resourceFromAttributes({ "service.name": "gmax-studioz" }),
        processors: [
            new BatchLogRecordProcessor({
                exporter: new OTLPLogExporter({
                    url: `${posthogHost}/i/v1/logs`,
                    headers: {
                        Authorization: `Bearer ${posthogProjectToken}`,
                        "Content-Type": "application/json",
                    },
                }),
            }),
        ],
    })
    : null;

export const posthogLog = posthogLogProvider?.getLogger("posthog-exporter");

export function register() {}
