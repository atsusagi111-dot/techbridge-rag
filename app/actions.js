"use server";

import { answerQuestion } from "@/lib/rag.js";

const MAX_QUESTION_LENGTH = 300;

export async function askQuestion(prevState, formData) {
  const question = String(formData.get("question") ?? "").trim();

  if (!question) {
    return { ...prevState, error: "質問を入力してください。" };
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return { ...prevState, error: `質問は${MAX_QUESTION_LENGTH}文字以内で入力してください。` };
  }

  try {
    const { answer, citations } = await answerQuestion(question);
    // answerQuestion() already appends a "（出典: ...）" suffix meant for
    // plain-text Slack replies; strip it here so the UI can render citations
    // as separate badges instead of duplicating them inline.
    const displayAnswer = answer.replace(/(?:\s*（出典:.*?）)$/, "").trim();
    return { question, answer: displayAnswer, citations, error: null };
  } catch (err) {
    console.error("askQuestion failed:", err);
    return {
      question,
      answer: null,
      citations: [],
      error: "エラーが発生しました。時間をおいて再度お試しください。",
    };
  }
}
