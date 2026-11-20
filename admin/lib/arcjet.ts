import arcjet, { shield, detectBot, fixedWindow } from "@arcjet/next";

export const aj = process.env.ARCJET_KEY
  ? arcjet({
      key: process.env.ARCJET_KEY,
      rules: [
        shield({ mode: "LIVE" }),
        detectBot({
          mode: "LIVE",
          allow: [], // block all bots, but we can allow search engines if needed
        }),
        fixedWindow({
          mode: "LIVE",
          window: "1m",
          max: 30,
        }),
      ],
    })
  : null;

export async function isDeniedByArcjet(req: Request): Promise<boolean> {
  if (!aj) return false;
  try {
    const decision = await aj.protect(req);
    return decision.isDenied();
  } catch (err) {
    console.error("[Arcjet] protect failed:", err);
    return false;
  }
}
