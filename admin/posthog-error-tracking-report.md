# PostHog error tracking

## What you still need to do

1. Configure the hosting platform that runs production (the provider is not present in this repository) with the build variables `POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID`, and `POSTHOG_HOST`. `POSTHOG_API_KEY` has already been written to the local `.env`; no new key needs to be created for local use. For a hosted build, use the existing personal API key in the provider's secret store and do not use the public project token as `POSTHOG_API_KEY`.
2. Run the production build as `npm run build` wherever you deploy. Ensure the build environment preserves the provider's native Git metadata so source maps can be associated with a release. No project-owned CI pipeline was found, so there is no CI secret name or pipeline file to update in this repository.
3. Before verifying an upload, align the uploader host configuration with the credential contract: the uploader should read `POSTHOG_HOST` (the current configuration handoff reports it still reads `NEXT_PUBLIC_POSTHOG_HOST`).
4. Configure the runtime environment for `npm run start` with `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST`.

## What is working now

The app already has PostHog installed and initialized. Uncaught browser exceptions are handled by the Web SDK's built-in exception autocapture, enabled with `capture_exceptions: true` in `instrumentation-client.ts`. Errors that Next.js catches at the framework boundary are sent with `posthog.captureException(error)` from `app/global-error.tsx`. These complementary paths avoid duplicate custom global listeners.

Source-map upload was wired into the Next.js production build through `@posthog/nextjs-config`. The relevant changed files are:

- `next.config.ts`
- `package.json`
- `package-lock.json`
- `.env`
- `.env.example`

The production command is exactly `npm run build` (`next build`), and the configured build runs the source-map uploader for production builds with uploaded maps deleted afterward. The deployment provider still needs the variables and release identity described above; no deployment configuration exists in this repository.

## Verify in PostHog

Trigger any application error, then view it at:

https://us.posthog.com/project/628631/error_tracking

Uploaded symbol sets appear at:

https://us.posthog.com/project/628631/error_tracking/configuration
