# GMAX API Documentation

*Note: Remember to run the database push command to synchronize the schema.*

## Booking Lifecycle and Automated Cleanup

The system architecture guarantees that a `Booking` record is exclusively created upon receiving a verified `charge.success` webhook event from Paystack. If a payment fails or is abandoned, no booking is created.

The `createPublicBooking` function generates an initial `BookingIntent` record with an `expiresAt` field set to 1 hour. Because payment gateways do not reliably dispatch webhooks for abandoned checkout sessions, an automated cleanup mechanism is required to purge stale records.

The following instructions detail how to configure a Next.js background cron route to automatically sweep and delete expired `BookingIntent` records.

### 1. Create the Cleanup API Route

Create a new file at **`api/app/api/cron/cleanup/route.ts`**. This route will securely find and delete all expired intents.

```typescript
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    // Optional: Protect this route with a secret key so only your cron job can trigger it
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        // Delete all intents that are still PENDING and have passed their expiration time
        const deleted = await prisma.bookingIntent.deleteMany({
            where: {
                status: "PENDING",
                expiresAt: { lt: new Date() },
            },
        });

        console.log(`[Cron] Cleaned up ${deleted.count} abandoned booking intents.`);
        return NextResponse.json({ success: true, deletedCount: deleted.count });
    } catch (error) {
        console.error("[Cron] Failed to clean up intents:", error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}

```

### 2. Schedule the Cron Job (Vercel)

If you are deploying this Next.js app to Vercel, you can easily tell it to run that route every hour.

Create a **`vercel.json`** file at the root of your frontend/API folder:

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 * * * *" 
    }
  ]
}

```

*(The `"0 * * * *"` schedule means it will run precisely at the top of every hour).*

### 3. Add the Environment Variable

Make sure to add a random `CRON_SECRET` string to your `.env` file (and to your hosting provider's environment variables) to secure the endpoint:

```env
CRON_SECRET=your_super_secret_cron_string_here

```