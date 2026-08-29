-- techbridge-rag: 初期スキーマ
-- Supabaseダッシュボード → SQL Editor → New query に全文を貼り付けて実行してください。
-- 何度実行してもエラーにならない（既にあれば作り直す）ようになっています。

-- 1. ベクトル検索用の拡張機能を有効化
-- （文章を数値の羅列＝embeddingに変換したものを、類似度検索するための機能）
create extension if not exists vector;
-- id列の自動採番（gen_random_uuid）に使う拡張機能
create extension if not exists pgcrypto;

-- 2. documents: 取り込んだ文書そのものの情報を保存するテーブル
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null unique,       -- 例: case3-doc1-employment-rules.pdf
  display_name text,                    -- 例: 就業規則.pdf（回答の出典表示に使う）
  title text,
  department text,
  revised_on date,
  created_at timestamptz not null default now()
);

-- 3. chunks: 文書をセクション単位に分割した断片と、その埋め込みを保存するテーブル
create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int not null,
  section_heading text,
  page_number int,
  content text not null,
  embedding vector(1536),               -- text-embedding-3-small の次元数
  created_at timestamptz not null default now()
);

create index if not exists chunks_document_id_idx on chunks(document_id);

-- 4. match_chunks: 質問文の埋め込みに近い断片を類似度が高い順に返す検索関数
-- lib/rag.js から supabase.rpc("match_chunks", { query_embedding, match_count }) で呼ばれる
create or replace function match_chunks(query_embedding vector(1536), match_count int)
returns table (
  id uuid,
  document_id uuid,
  content text,
  section_heading text,
  page_number int,
  display_name text,
  filename text,
  similarity float
)
language sql
stable
as $$
  select
    chunks.id,
    chunks.document_id,
    chunks.content,
    chunks.section_heading,
    chunks.page_number,
    documents.display_name,
    documents.filename,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  join documents on documents.id = chunks.document_id
  order by chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- 5. RLS（行単位のアクセス制御）を有効化しておく
-- このアプリはサーバー側で service_role キー（RLSを無視する特別な鍵）だけを使うので、
-- 一般公開用の anon キーからはこの2テーブルに一切アクセスできない状態にしておく（安全のため）。
alter table documents enable row level security;
alter table chunks enable row level security;
