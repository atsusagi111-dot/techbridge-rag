import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/rag.js";

export async function POST(request) {
  const secret = request.headers.get("x-internal-secret");
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const question = body?.question;
  if (!question || typeof question !== "string") {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const result = await answerQuestion(question);
  return NextResponse.json(result, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
