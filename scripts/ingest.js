// Ingests every reference/*.md (+ matching .pdf for page numbers) into Supabase.
// Run with:  node --env-file=.env.local scripts/ingest.js

import { readFile, readdir } from "node:fs/promises";
import { extractText, getDocumentProxy } from "unpdf";
import { openai, EMBEDDING_MODEL } from "../lib/openai.js";
import { supabaseAdmin } from "../lib/supabaseServer.js";

const REFERENCE_DIR = new URL("../reference/", import.meta.url);

// Hand-curated short citation names (not reliably derivable automatically).
const DISPLAY_NAMES = {
  "case3-doc1-employment-rules.pdf": "就業規則.pdf",
  "case3-doc2-expense-manual.pdf": "経費精算マニュアル.pdf",
  "case3-doc3-security-policy.pdf": "情報セキュリティ規程.pdf",
  "case3-doc4-remote-work.pdf": "リモートワーク規程.pdf",
  "case3-doc5-it-onboarding.pdf": "社内ITツールガイド.pdf",
};

// Some PDF fonts encode common kanji using CJK Radical / Kangxi Radical
// compatibility code points (e.g. U+2F87 "⽇" instead of U+65E5 "日") instead of
// the standard unified ideograph. NFKC fixes most of these; a couple (⺠→民,
// ⻑→長) have no compatibility decomposition and need a manual map.
const RADICAL_OVERRIDES = { "⺠": "民", "⻑": "長" };

function normalizeForMatch(text) {
  let normalized = text.normalize("NFKC");
  for (const [from, to] of Object.entries(RADICAL_OVERRIDES)) {
    normalized = normalized.split(from).join(to);
  }
  return normalized
    .replace(/\*\*/g, "")
    .replace(/[|｜]/g, "")
    .replace(/^\s*[-・]\s*/gm, "")
    .replace(/^\s*\d+\.\s*/gm, "")
    .replace(/\s+/g, "")
    .trim();
}

function resolvePageNumber(bodyLines, pageBlobs, context) {
  const normLines = bodyLines.map(normalizeForMatch).filter(Boolean);
  if (normLines.length === 0) {
    console.warn(`  [WARN] ${context}: no body lines to match, defaulting to page 1`);
    return 1;
  }

  const counts = pageBlobs.map(() => 0);
  for (const line of normLines) {
    for (let p = 0; p < pageBlobs.length; p++) {
      if (pageBlobs[p].includes(line)) counts[p]++;
    }
  }

  const maxCount = Math.max(...counts);
  if (maxCount === 0) {
    console.warn(`  [WARN] ${context}: zero lines matched any page, defaulting to page 1 (verify manually)`);
    return 1;
  }

  const candidates = counts
    .map((c, i) => ({ c, i }))
    .filter((x) => x.c === maxCount)
    .map((x) => x.i);

  if (candidates.length === 1) return candidates[0] + 1;

  // Tie-break: the page containing the first body line, in reading order.
  const firstLine = normLines[0];
  const firstLineMatch = candidates.find((i) => pageBlobs[i].includes(firstLine));
  return (firstLineMatch !== undefined ? firstLineMatch : candidates[0]) + 1;
}

function parseMarkdown(raw) {
  const titleMatch = raw.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : null;

  const metaMatch = raw.match(/^\*\*(.+)\*\*$/m);
  let department = null;
  let revisedOn = null;
  if (metaMatch) {
    const meta = metaMatch[1];
    const deptMatch = meta.match(/管轄:\s*([^\s／]+)/);
    if (deptMatch) department = deptMatch[1];
    const dateMatch = meta.match(/改定日:\s*(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (dateMatch) {
      const [, y, m, d] = dateMatch;
      revisedOn = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }

  const body = raw.slice(raw.indexOf("\n## ") + 1); // start at first "## " heading
  const parts = body.split(/^##\s+/m).filter((p) => p.trim().length > 0);

  const sections = parts.map((part, index) => {
    const lines = part.split("\n");
    const heading = lines[0].trim();
    const bodyLines = lines
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^[-\s|]+$/.test(l)); // drop blank/table-separator lines
    const content = `${heading}\n${bodyLines.join("\n")}`.trim();
    return { chunkIndex: index, heading, bodyLines, content };
  });

  return { title, department, revisedOn, sections };
}

async function main() {
  const admin = supabaseAdmin();
  const files = (await readdir(REFERENCE_DIR)).filter((f) => f.endsWith(".md"));
  files.sort();

  const allChunkRows = [];
  const summaryRows = [];

  for (const mdFile of files) {
    const baseName = mdFile.replace(/\.md$/, "");
    const pdfFile = `${baseName}.pdf`;
    const displayName = DISPLAY_NAMES[pdfFile];
    if (!displayName) {
      console.warn(`[WARN] No display_name mapping for ${pdfFile}, skipping.`);
      continue;
    }

    const raw = await readFile(new URL(mdFile, REFERENCE_DIR), "utf-8");
    const { title, department, revisedOn, sections } = parseMarkdown(raw);

    const pdfBuffer = await readFile(new URL(pdfFile, REFERENCE_DIR));
    const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
    const { text: pages } = await extractText(pdf, { mergePages: false });
    const pageBlobs = pages.map((p) => normalizeForMatch(p));

    console.log(`\n=== ${pdfFile} (${pages.length} page(s), ${sections.length} section(s)) ===`);

    // Upsert the document row.
    const { data: docRow, error: docError } = await admin
      .from("documents")
      .upsert(
        { filename: pdfFile, display_name: displayName, title, department, revised_on: revisedOn },
        { onConflict: "filename" }
      )
      .select()
      .single();
    if (docError) throw docError;

    // Clear any previously ingested chunks for this document (idempotent re-run).
    const { error: delError } = await admin.from("chunks").delete().eq("document_id", docRow.id);
    if (delError) throw delError;

    for (const section of sections) {
      const pageNumber = resolvePageNumber(
        section.bodyLines,
        pageBlobs,
        `${pdfFile} / ${section.heading}`
      );
      allChunkRows.push({
        document_id: docRow.id,
        chunk_index: section.chunkIndex,
        section_heading: section.heading,
        page_number: pageNumber,
        content: section.content,
      });
      summaryRows.push({
        file: pdfFile,
        heading: section.heading,
        page: pageNumber,
        preview: section.content.slice(0, 40).replace(/\n/g, " "),
      });
    }
  }

  console.log(`\nEmbedding ${allChunkRows.length} chunks via ${EMBEDDING_MODEL}...`);
  const embeddingResponse = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: allChunkRows.map((c) => c.content),
  });

  const rowsWithEmbeddings = allChunkRows.map((row, i) => ({
    ...row,
    embedding: embeddingResponse.data[i].embedding,
  }));

  const admin2 = supabaseAdmin();
  const { error: insertError } = await admin2.from("chunks").insert(rowsWithEmbeddings);
  if (insertError) throw insertError;

  console.log(`\nInserted ${rowsWithEmbeddings.length} chunks. Summary:\n`);
  console.table(summaryRows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
