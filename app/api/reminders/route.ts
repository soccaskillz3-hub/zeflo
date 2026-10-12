import {timingSafeEqual} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {lifetimeFor, noticeFor, sendNotice} from "../../lib/push";

// Sends the reminders that are due. Called every minute something is due, by a pg_cron job in
// Supabase (see supabase/migrations/20261012120000_reminders.sql), with a secret shared between
// Supabase Vault and Vercel (REMINDERS_SECRET). The same secret is what lets this route claim the
// reminders from the database, so the app needs no Supabase secret key.

type Claimed = {endpoint: string; p256dh: string; auth_key: string; kind: string; tag: string; data: Record<string, unknown>};

function authorized(request: Request, secret: string) {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  const secret = process.env.REMINDERS_SECRET;
  if (!secret) return Response.json({error: "Reminders aren't set up."}, {status: 503});
  if (!authorized(request, secret)) return Response.json({error: "Not allowed."}, {status: 401});

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: {persistSession: false, autoRefreshToken: false},
  });
  const {data, error} = await supabase.rpc("claim_reminders", {secret});
  if (error) {
    console.error("Claiming reminders failed", error.message);
    return Response.json({error: "Couldn't read what's due."}, {status: 500});
  }

  const results = await Promise.all(
    (data as Claimed[]).map(async (row) => {
      const notice = noticeFor(row);
      if (!notice) return {endpoint: row.endpoint, result: "failed" as const};
      const subscription = {endpoint: row.endpoint, keys: {p256dh: row.p256dh, auth: row.auth_key}};
      return {endpoint: row.endpoint, result: await sendNotice(subscription, notice, lifetimeFor(row))};
    }),
  );

  const gone = [...new Set(results.filter((r) => r.result === "gone").map((r) => r.endpoint))];
  if (gone.length) await supabase.rpc("forget_push_endpoints", {secret, endpoints: gone});

  return Response.json({
    sent: results.filter((r) => r.result === "sent").length,
    gone: gone.length,
    failed: results.filter((r) => r.result === "failed").length,
  });
}
