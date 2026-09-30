"use client";

import posthog from "posthog-js";

export function PostHogErrorTrackingTestButton() {
  return (
    <button
      type="button"
      className="mx-4 rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 lg:mx-6"
      onClick={() =>
        posthog.captureException(new Error("PostHog source maps test"))
      }
    >
      Test PostHog Error Tracking
    </button>
  );
}
