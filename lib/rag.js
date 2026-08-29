import { openai, EMBEDDING_MODEL, CHAT_MODEL } from "./openai.js";
import { supabaseAdmin } from "./supabaseServer.js";

const NOT_FOUND = "該当なし";
const MATCH_COUNT = 5;
const SIMILARITY_THRESHOLD = 0.25;

const SYSTEM_PROMPT = `あなたは株式会社テックブリッジの社内文書アシスタントです。
以下に提供する社内文書の抜粋のみを根拠として質問に答えてください。
抜粋に根拠が含まれない場合は、他の説明を一切加えず「${NOT_FOUND}」という文字列のみを返答してください。
数値・日付・金額は文書内の記載どおり正確に答えてください。憶測や一般論で補完しないでください。`;

function formatCitations(chunks) {
  const seen = new Set();
  const citations = [];
  for (const chunk of chunks) {
    const key = `${chunk.display_name}#${chunk.page_number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({
      display_name: chunk.display_name,
      page_number: chunk.page_number,
      filename: chunk.filename,
    });
  }
  return citations;
}

function formatCitationText(citations) {
  if (citations.length === 0) return "";
  const parts = citations.map((c) => `${c.display_name} p.${c.page_number}`);
  return `（出典: ${parts.join("、")}）`;
}

export async function answerQuestion(question) {
  const embeddingResponse = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: question,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;

  const admin = supabaseAdmin();
  const { data: chunks, error } = await admin.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_count: MATCH_COUNT,
  });
  if (error) throw error;

  if (!chunks || chunks.length === 0 || chunks[0].similarity < SIMILARITY_THRESHOLD) {
    return { answer: NOT_FOUND, citations: [] };
  }

  const context = chunks
    .map(
      (c, i) =>
        `[抜粋${i + 1}] (${c.display_name} / ${c.section_heading} / p.${c.page_number})\n${c.content}`
    )
    .join("\n\n");

  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `# 社内文書の抜粋\n${context}\n\n# 質問\n${question}` },
    ],
  });

  const rawAnswer = completion.choices[0].message.content.trim();

  if (rawAnswer === NOT_FOUND) {
    return { answer: NOT_FOUND, citations: [] };
  }

  const citations = formatCitations(chunks);
  return { answer: `${rawAnswer}${formatCitationText(citations)}`, citations };
}
