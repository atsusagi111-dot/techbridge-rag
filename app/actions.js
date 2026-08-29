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
    return { question, answer, citations, error: null };
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
