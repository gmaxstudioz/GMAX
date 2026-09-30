"use client";

import NextError from "next/error";
import posthog from "posthog-js";
import { useEffect } from "react";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
const isPostHogConfigured = Boolean(projectToken && host)

if (isPostHogConfigured) {
  posthog.init(projectToken!, {
    api_host: host,
    capture_exceptions: true,
  })
}

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (isPostHogConfigured) {
      posthog.captureException(error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
