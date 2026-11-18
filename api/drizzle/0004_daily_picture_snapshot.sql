-- Migration: Add daily_picture_snapshot table
-- This table stores pre-aggregated daily picture counts per studio
-- to avoid expensive GROUP BY queries on the booking table at dashboard load time.
-- Fields:
--   picturesOnDay    - sum of extraPicturesCount for all bookings on that date
--   cumulativePictures - running total of all pictures up to and including that date
--   bookingCount     - number of non-cancelled bookings on that date

CREATE TABLE IF NOT EXISTS "daily_picture_snapshot" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "picturesOnDay" INTEGER NOT NULL DEFAULT 0,
    "cumulativePictures" INTEGER NOT NULL DEFAULT 0,
    "bookingCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_picture_snapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "daily_picture_snapshot_studioId_fkey"
        FOREIGN KEY ("studioId") REFERENCES "studio"("id")
        ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "daily_picture_snapshot_studioId_date_key"
    ON "daily_picture_snapshot" ("studioId", "date");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "daily_picture_snapshot_studioId_idx"
    ON "daily_picture_snapshot" ("studioId");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "daily_picture_snapshot_date_idx"
    ON "daily_picture_snapshot" ("date");
--> statement-breakpoint

WITH daily_counts AS (
    SELECT
        booking."studioId",
        booking."bookingDate"::date::text AS "date",
        SUM(GREATEST(COALESCE(booking."extraPicturesCount", 0), 0))::integer AS "picturesOnDay",
        COUNT(*)::integer AS "bookingCount"
    FROM "booking" AS booking
    WHERE booking."bookingStatus" <> 'CANCELLED'
    GROUP BY booking."studioId", booking."bookingDate"::date
),
running_counts AS (
    SELECT
        "studioId",
        "date",
        "picturesOnDay",
        SUM("picturesOnDay") OVER (
            PARTITION BY "studioId"
            ORDER BY "date"
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        )::integer AS "cumulativePictures",
        "bookingCount"
    FROM daily_counts
)
INSERT INTO "daily_picture_snapshot" (
    "id",
    "studioId",
    "date",
    "picturesOnDay",
    "cumulativePictures",
    "bookingCount",
    "updatedAt"
)
SELECT
    "studioId" || ':' || "date",
    "studioId",
    "date",
    "picturesOnDay",
    "cumulativePictures",
    "bookingCount",
    CURRENT_TIMESTAMP
FROM running_counts
ON CONFLICT ("studioId", "date") DO UPDATE SET
    "picturesOnDay" = EXCLUDED."picturesOnDay",
    "cumulativePictures" = EXCLUDED."cumulativePictures",
    "bookingCount" = EXCLUDED."bookingCount",
    "updatedAt" = CURRENT_TIMESTAMP;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION refresh_daily_picture_snapshot(
    target_studio_id text,
    target_date date
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    pictures_count integer;
    booking_count integer;
    previous_total integer;
BEGIN
    PERFORM 1
    FROM "studio"
    WHERE "id" = target_studio_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT
        COUNT(*)::integer,
        COALESCE(SUM(GREATEST(COALESCE("extraPicturesCount", 0), 0)), 0)::integer
    INTO booking_count, pictures_count
    FROM "booking"
    WHERE "studioId" = target_studio_id
      AND "bookingDate"::date = target_date
      AND "bookingStatus" <> 'CANCELLED';

    IF booking_count = 0 THEN
        DELETE FROM "daily_picture_snapshot"
        WHERE "studioId" = target_studio_id
          AND "date" = target_date::text;
    ELSE
        INSERT INTO "daily_picture_snapshot" (
            "id",
            "studioId",
            "date",
            "picturesOnDay",
            "cumulativePictures",
            "bookingCount",
            "updatedAt"
        )
        VALUES (
            target_studio_id || ':' || target_date::text,
            target_studio_id,
            target_date::text,
            pictures_count,
            0,
            booking_count,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT ("studioId", "date") DO UPDATE SET
            "picturesOnDay" = EXCLUDED."picturesOnDay",
            "bookingCount" = EXCLUDED."bookingCount",
            "updatedAt" = CURRENT_TIMESTAMP;
    END IF;

    SELECT "cumulativePictures"
    INTO previous_total
    FROM "daily_picture_snapshot"
    WHERE "studioId" = target_studio_id
      AND "date" < target_date::text
    ORDER BY "date" DESC
    LIMIT 1;

    WITH updated_totals AS (
        SELECT
            snapshot."id",
            COALESCE(previous_total, 0) + SUM(snapshot."picturesOnDay") OVER (
                ORDER BY snapshot."date"
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS "cumulativePictures"
        FROM "daily_picture_snapshot" AS snapshot
        WHERE snapshot."studioId" = target_studio_id
          AND snapshot."date" >= target_date::text
    )
    UPDATE "daily_picture_snapshot" AS snapshot
    SET
        "cumulativePictures" = updated_totals."cumulativePictures"::integer,
        "updatedAt" = CURRENT_TIMESTAMP
    FROM updated_totals
    WHERE snapshot."id" = updated_totals."id";
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION sync_daily_picture_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM refresh_daily_picture_snapshot(NEW."studioId", NEW."bookingDate"::date);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM refresh_daily_picture_snapshot(OLD."studioId", OLD."bookingDate"::date);
        RETURN OLD;
    END IF;

    PERFORM refresh_daily_picture_snapshot(OLD."studioId", OLD."bookingDate"::date);
    IF OLD."studioId" IS DISTINCT FROM NEW."studioId"
       OR OLD."bookingDate"::date IS DISTINCT FROM NEW."bookingDate"::date THEN
        PERFORM refresh_daily_picture_snapshot(NEW."studioId", NEW."bookingDate"::date);
    END IF;
    RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "booking_daily_picture_snapshot_trigger" ON "booking";
--> statement-breakpoint

CREATE TRIGGER "booking_daily_picture_snapshot_trigger"
AFTER INSERT OR DELETE OR UPDATE OF
    "studioId",
    "bookingDate",
    "bookingStatus",
    "extraPicturesCount"
ON "booking"
FOR EACH ROW
EXECUTE FUNCTION sync_daily_picture_snapshot();
