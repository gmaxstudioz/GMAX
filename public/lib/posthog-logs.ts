"use client";

import posthog from "posthog-js";

type LogAttributes = Record<string, string | number | boolean | undefined>;

export const posthogLogs = {
  info(message: string, attributes: LogAttributes) {
    posthog.logger.info(message, attributes);
  },
  error(message: string, attributes: LogAttributes) {
    posthog.logger.error(message, attributes);
  },
};
