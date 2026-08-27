import crypto from "node:crypto";
import { WebClient } from "@slack/web-api";

export const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

const MAX_TIMESTAMP_AGE_SECONDS = 60 * 5;

export function verifySlackSignature({ body, timestamp, signature }) {
  if (!timestamp || !signature) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_TIMESTAMP_AGE_SECONDS) return false;

  const base = `v0:${timestamp}:${body}`;
  const computed =
    "v0=" +
    crypto.createHmac("sha256", process.env.SLACK_SIGNING_SECRET).update(base, "utf8").digest("hex");

  const a = Buffer.from(computed);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
