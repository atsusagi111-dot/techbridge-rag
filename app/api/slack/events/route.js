import { NextResponse, after } from "next/server";
import { verifySlackSignature, slackClient } from "@/lib/slack.js";
import { answerQuestion } from "@/lib/rag.js";

export const maxDuration = 30;

export async function POST(request) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");

  if (!verifySlackSignature({ body: rawBody, timestamp, signature })) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  // One-time handshake required when first registering the Request URL in Slack.
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type === "event_callback" && payload.event?.type === "app_mention") {
    const { channel, ts, text } = payload.event;

    // Ack immediately (Slack requires a fast response); do the real work after responding.
    after(async () => {
      try {
        const question = text.replace(/<@[^>]+>\s*/, "").trim();
        const { answer } = await answerQuestion(question);
        await slackClient.chat.postMessage({ channel, thread_ts: ts, text: answer });
      } catch (err) {
        console.error("Slack app_mention handling failed:", err);
        await slackClient.chat
          .postMessage({
            channel,
            thread_ts: ts,
            text: "エラーが発生しました。時間をおいて再度お試しください。",
          })
          .catch(() => {});
      }
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
