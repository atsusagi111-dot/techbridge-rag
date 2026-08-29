# テックブリッジ 社内文書アシスタント（RAG）

就業規則・経費精算・セキュリティ規程などの社内PDFを根拠に、Web画面またはSlackでの質問に回答するQAボットです。回答には出典（文書名・ページ番号）を添え、根拠となるPDFの該当ページに直接ジャンプできます。

## 公開URL

- Web: https://techbridge-rag.vercel.app
- Slack: `@RAGtest` にメンションして質問すると、社内文書を根拠に回答します。

## 概要

- 対象文書: `reference/` 配下の就業規則・経費精算マニュアル・情報セキュリティ規程・リモートワーク規程・ITツールガイド（Markdown原本 + PDF）
- 文書に根拠がない質問には「該当なし」と回答し、憶測で答えない設計
- 回答には出典バッジ（例: `就業規則.pdf p.1`）を表示し、クリックで `public/docs/` 配下のPDFの該当ページを新規タブで開ける

## アーキテクチャ

```
[reference/*.md + *.pdf]
        │  scripts/ingest.js（セクション分割 → OpenAI Embeddings → ページ番号をPDFの実テキストと突き合わせ）
        ▼
[Supabase Postgres + pgvector]  documents / chunks テーブル、match_chunks() で類似検索
        ▲
        │  lib/rag.js: answerQuestion()
        │    1. 質問文をOpenAI Embeddingsでベクトル化
        │    2. match_chunks RPCで類似チャンクを検索（閾値未満は「該当なし」）
        │    3. 抜粋のみを根拠にGPT-4.1(chat.completions)で回答生成
        │    4. 出典（文書名・ページ番号）を付与して返却
        │
   ┌────┴─────────────────┐
   │                       │
[Web] app/page.js          [Slack] app/api/slack/events/route.js
  Server Action(actions.js)  署名検証 → app_mentionに非同期で返信
  でRSCから直接呼び出し        （lib/slack.js）
```

- 社外向けAPI: `app/api/ask/route.js`（`x-internal-secret` ヘッダーで認証する内部API）
- ホスティング: Vercel（Next.js 16 / App Router / Server Actions / Turbopack）
- データベース: Supabase（Postgres + `pgvector`拡張、`service_role`キーはサーバー専用でRLS有効）
- LLM: OpenAI `text-embedding-3-small`（埋め込み）/ `gpt-4.1`（回答生成）

## はじめに

まず、開発サーバーを起動します。

```bash
npm run dev
# または
yarn dev
# または
pnpm dev
# または
bun dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開くと結果が確認できます。

`app/page.js` を編集するとページの編集を開始できます。ファイルを保存すると自動的に更新されます。

このプロジェクトでは [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) を使用して、Vercelの新しいフォントファミリーである [Geist](https://vercel.com/font) を自動的に最適化して読み込んでいます。

## さらに詳しく

Next.jsについてさらに詳しく知りたい場合は、以下のリソースを参照してください。

- [Next.js Documentation](https://nextjs.org/docs) - Next.jsの機能とAPIについて学べます。
- [Learn Next.js](https://nextjs.org/learn) - インタラクティブなNext.jsチュートリアルです。

[Next.jsのGitHubリポジトリ](https://github.com/vercel/next.js) もぜひご覧ください。フィードバックやコントリビューションを歓迎します。

## Vercelへのデプロイ

Next.jsアプリをデプロイする最も簡単な方法は、Next.jsの開発元が提供する [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) を利用することです。

詳細は [Next.jsのデプロイに関するドキュメント](https://nextjs.org/docs/app/building-your-application/deploying) をご確認ください。
