import "server-only";

import { and, desc, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";

export interface PictureSnapshotItem {
  id: string;
  studioId: string;
  date: string;
  picturesOnDay: number;
  cumulativePictures: number;
  bookingCount: number;
}

/**
 * Reads the compact daily snapshot table rather than aggregating bookings.
 * The running total is calculated before applying the row limit so it always
 * includes the studio's full history.
 */
export async function getPictureSnapshots(
  studioIds: string[],
  options?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
): Promise<PictureSnapshotItem[]> {
  if (studioIds.length === 0) return [];

  const limit = options?.limit ?? 60;
  const dailySnapshots = db.$with("daily_snapshots").as(
    db
      .select({
        date: schema.dailyPictureSnapshot.date,
        picturesOnDay: sql<string>`COALESCE(SUM(${schema.dailyPictureSnapshot.picturesOnDay}::bigint), 0)::text`.as("picturesOnDay"),
        bookingCount: sql<string>`COALESCE(SUM(${schema.dailyPictureSnapshot.bookingCount}::bigint), 0)::text`.as("bookingCount"),
      })
      .from(schema.dailyPictureSnapshot)
      .where(inArray(schema.dailyPictureSnapshot.studioId, studioIds))
      .groupBy(schema.dailyPictureSnapshot.date)
  );
  const runningSnapshots = db.$with("running_snapshots").as(
    db
      .select({
        date: dailySnapshots.date,
        picturesOnDay: dailySnapshots.picturesOnDay,
        bookingCount: dailySnapshots.bookingCount,
        cumulativePictures: sql<string>`SUM(${dailySnapshots.picturesOnDay}::bigint) OVER (ORDER BY ${dailySnapshots.date} ROWS UNBOUNDED PRECEDING)::text`.as("cumulativePictures"),
      })
      .from(dailySnapshots)
  );

  const conditions = [];
  if (options?.startDate) conditions.push(gte(runningSnapshots.date, options.startDate));
  if (options?.endDate) conditions.push(lte(runningSnapshots.date, options.endDate));

  const rows = await db
    .with(dailySnapshots, runningSnapshots)
    .select({
      id: sql<string>`'aggregate-' || ${runningSnapshots.date}`.as("id"),
      studioId: sql<string>`'all'`.as("studioId"),
      date: runningSnapshots.date,
      picturesOnDay: runningSnapshots.picturesOnDay,
      cumulativePictures: runningSnapshots.cumulativePictures,
      bookingCount: runningSnapshots.bookingCount,
    })
    .from(runningSnapshots)
    .where(and(sql`true`, ...conditions))
    .orderBy(desc(runningSnapshots.date))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    studioId: row.studioId,
    date: row.date,
    picturesOnDay: Number(row.picturesOnDay || 0),
    cumulativePictures: Number(row.cumulativePictures || 0),
    bookingCount: Number(row.bookingCount || 0),
  }));
}
