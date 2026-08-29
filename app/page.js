"use client";

import { useActionState } from "react";
import { askQuestion } from "./actions.js";
import styles from "./page.module.css";

const initialState = { question: "", answer: null, citations: [], error: null };

export default function Home() {
  const [state, formAction, pending] = useActionState(askQuestion, initialState);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>テックブリッジ</p>
        <h1 className={styles.title}>社内文書アシスタント</h1>
        <p className={styles.subtitle}>
          就業規則・経費精算・セキュリティ規程などについて質問すると、根拠となる文書とページ番号を示して回答します。
        </p>

        <form action={formAction} className={styles.form}>
          <textarea
            name="question"
            rows={3}
            placeholder="例: 経費精算の申請期限はいつですか？"
            className={styles.textarea}
            defaultValue={state.question}
            required
          />
          <button type="submit" disabled={pending} className={styles.button}>
            {pending ? "検索中…" : "質問する"}
          </button>
        </form>

        {state.error && <p className={styles.error}>{state.error}</p>}

        {state.answer && (
          <div className={styles.answerBox}>
            <p className={styles.answerLabel}>回答</p>
            <p className={styles.answerText}>{state.answer}</p>
            {state.citations.length > 0 && (
              <div className={styles.citationList}>
                {state.citations.map((c, i) => (
                  <a
                    key={i}
                    href={`/docs/${c.filename}#page=${c.page_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.citationBadge}
                  >
                    {c.display_name} p.{c.page_number}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
