import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { auth0 } from "@/lib/auth0";

const redis = Redis.fromEnv();

// AI (Gemini) calls are the expensive, abusable ones — 10 requests per
// minute per identity. Applies across all Gemini-calling Server Actions
// (search parsing, ingredient normalization, recipe explanation,
// substitution, AI meal plan generation) via one shared limiter, so a
// user can't bypass the limit by hopping between features.
export const aiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
  prefix: "ratelimit:ai",
});

async function getRateLimitIdentity(): Promise<string> {
  const session = await auth0.getSession();
  if (session?.user?.sub) return `user:${session.user.sub}`;

  // Public features (Cook With What I Have, natural-language search)
  // have no session — fall back to IP. x-forwarded-for is set by
  // Vercel/most proxies; "unknown" just means every unidentifiable
  // caller shares one bucket, which is an acceptable fallback.
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return `ip:${ip}`;
}

export type RateLimitCheck =
  | { limited: false }
  | { limited: true; message: string };

export async function checkAiRateLimit(): Promise<RateLimitCheck> {
  const identity = await getRateLimitIdentity();
  const { success, reset } = await aiRatelimit.limit(identity);

  if (success) return { limited: false };

  const secondsUntilReset = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return {
    limited: true,
    message: `Too many AI requests — try again in ${secondsUntilReset}s.`,
  };
}
