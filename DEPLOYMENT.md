# Gmax Studioz Deployment Guide (Vercel)

This workspace consists of three distinct Next.js applications: `api`, `admin`, and `public`. The recommended way to deploy this structure is as **three separate projects** on Vercel, all linked to the same GitHub repository.

## Step 1: Prepare the API
1. In Vercel, create a new project and import this repository.
2. Under "Framework Preset", ensure **Next.js** is selected.
3. Under "Root Directory", click **Edit** and type `api`.
4. Leave the Build Command as the default (`next build`), since `package.json` already has a `postinstall` script (`prisma generate`) that Vercel will automatically run.
5. In the "Environment Variables" section, copy the keys from `api/.env.example` and supply your real values.
6. Click **Deploy**. Note the assigned domain name (e.g. `gmax-api.vercel.app`), this will be your `NEXT_PUBLIC_API_URL` for the other apps.

## Step 2: Run Database Migrations
Before deploying the Admin app, apply the database migrations. The daily picture snapshot table and its booking sync trigger are managed by the Drizzle migration in `api/drizzle`. Apply it from the API project with its `DATABASE_URL` configured:
```bash
cd api
npx drizzle-kit migrate
```
> **CRITICAL:** The Drizzle migration must run before the Admin app deployment. The admin app must not receive any traffic until the migration completes successfully, as features depend on the snapshot schema and triggers.

Also deploy standard Prisma migrations if applicable:
```bash
cd admin # (or api)
export DATABASE_URL="your-production-db-url"
export DIRECT_URL="your-production-direct-url"
npx prisma migrate deploy
```

## Step 3: Prepare the Admin App
1. Create a second project in Vercel and import the same repository.
2. Under "Root Directory", set it to `admin`.
3. In the "Environment Variables" section, copy the keys from `admin/.env.example`.
4. Ensure you set:
   - `NEXT_PUBLIC_API_URL` to the domain from Step 1 (e.g., `https://api.gmaxstudioz.com/api`).
   - `NEXT_PUBLIC_AUTH_URL` to the domain Vercel provides for this admin app (e.g., `https://admin.gmaxstudioz.com`).
   - `BETTER_AUTH_URL` to the same as `NEXT_PUBLIC_AUTH_URL`.
5. Click **Deploy**. Note the domain name. Do not route production traffic to this domain until Step 2 migrations have finished.

## Step 4: Prepare the Public App
1. Create a third project in Vercel, importing the same repository.
2. Under "Root Directory", set it to `public`.
3. In the "Environment Variables", copy the keys from `public/.env.example`.
4. Set `NEXT_PUBLIC_API_URL` to the API base path from Step 1 (e.g., `https://api.gmaxstudioz.com/api`).
5. Click **Deploy**. Note the domain name (e.g., `https://gmaxstudioz.com`).

## Step 5: Finalize Configuration
Once all applications are deployed and you have their final domains, go back into the Vercel dashboard:
1. In the **API Project**: Update the `PORTAL_URL` env variable to match your Public app's domain, and `BETTER_AUTH_URL` to the Admin app's domain if BetterAuth expects it.
2. In the **Admin Project**: Update `NEXT_PUBLIC_APP_URL` to the Public app's domain (this is used to generate the download links for clients).

## CORS Considerations
The API uses `@orpc/server/plugins` `CORSPlugin()`. By default, this plugin is configured to allow all origins. If you wish to restrict it in production, modify `api/app/api/[[...rest]]/route.ts` to only allow your Admin and Public domains.
