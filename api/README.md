remember to run db push

That is exactly right. The architecture we set up guarantees that the actual `Booking` record is **only** created if the Paystack webhook receives a verified `charge.success` event. If the user closes the tab or the payment fails, the system strictly prevents the booking from ever existing.

To handle the second part of your rule—deleting the abandoned `BookingIntent`—we need an automated cleanup mechanism. Because payment gateways don't reliably send a webhook when a user simply closes their browser, the standard approach is to use a **Cron Job** to sweep the database and delete intents that have expired.

Since you already have an `expiresAt` field set to 1 hour in your `createPublicBooking` function, you can create a background route to delete anything past that time.

Here is how to set up the automated cleanup in your Next.js backend.

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