# GMAX Studioz Deployment Guide (Vercel)

This workspace consists of three distinct Next.js applications: `api`, `admin`, and `public`. The recommended way to deploy this structure is as **three separate projects** on Vercel, all linked to the same GitHub repository.

## Step 1: Prepare the API
1. In Vercel, create a new project and import this repository.
2. Under "Framework Preset", ensure **Next.js** is selected.
3. Under "Root Directory", click **Edit** and type `api`.
4. Leave the Build Command as the default (`next build`), since `package.json` already has a `postinstall` script (`prisma generate`) that Vercel will automatically run.
5. In the "Environment Variables" section, copy the keys from `api/.env.example` and supply your real values.
6. Click **Deploy**. Note the assigned domain name (e.g. `gmax-api.vercel.app`), this will be your `NEXT_PUBLIC_API_URL` for the other apps.

## Step 2: Prepare the Admin App
1. Create a second project in Vercel and import the same repository.
2. Under "Root Directory", set it to `admin`.
3. In the "Environment Variables" section, copy the keys from `admin/.env.example`.
4. Ensure you set:
   - `NEXT_PUBLIC_API_URL` to the domain from Step 1 (e.g., `https://gmax-api.vercel.app/api`).
   - `NEXT_PUBLIC_AUTH_URL` to the domain Vercel provides for this admin app (e.g., `https://gmax-admin.vercel.app`).
   - `BETTER_AUTH_URL` to the same as `NEXT_PUBLIC_AUTH_URL`.
5. Click **Deploy**. Note the domain name.

## Step 3: Prepare the Public App
1. Create a third project in Vercel, importing the same repository.
2. Under "Root Directory", set it to `public`.
3. In the "Environment Variables", copy the keys from `public/.env.example`.
4. Set `NEXT_PUBLIC_API_URL` to the domain from Step 1.
5. Click **Deploy**. Note the domain name (e.g., `https://gmax-public.vercel.app`).

## Step 4: Finalize Configuration
Once all three are deployed and you have their final domains, go back into the Vercel dashboard:
1. In the **API Project**: Update the `PORTAL_URL` env variable to match your Public app's domain, and `BETTER_AUTH_URL` to the Admin app's domain if BetterAuth expects it.
2. In the **Admin Project**: Update `NEXT_PUBLIC_APP_URL` to the Public app's domain (this is used to generate the download links for clients).

## Database Migrations
Since Vercel runs a serverless environment, standard migrations (`prisma migrate dev` or `db push`) shouldn't run automatically on every build if you have multiple apps sharing a database, to avoid race conditions. 

You should run migrations manually from your local machine, pointing to your production database, or use a GitHub Action:
```bash
cd admin # (or api)
export DATABASE_URL="your-production-db-url"
export DIRECT_URL="your-production-direct-url"
npx prisma migrate deploy
```

## CORS Considerations
The API uses `@orpc/server/plugins` `CORSPlugin()`. By default, this plugin is configured to allow all origins. If you wish to restrict it in production, modify `api/app/api/[[...rest]]/route.ts` to only allow your Admin and Public domains.
