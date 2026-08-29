これは [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app) で作成された [Next.js](https://nextjs.org) プロジェクトです。

## 公開URL

- Web: https://techbridge-rag.vercel.app
- Slack: `@RAGtest` にメンションして質問すると、社内文書を根拠に回答します。

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
