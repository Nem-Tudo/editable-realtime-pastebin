'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ViewContent({ id, content }) {
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem('codepaste-basic-auth') || '';
    if (!auth) return;

    fetch(`${API}/api/auth/check`, {
      headers: { Authorization: `Basic ${auth}` },
      cache: 'no-store'
    })
      .then(response => {
        if (response.ok) setCanEdit(true);
      })
      .catch(() => {});
  }, []);

  return (
    <main className="view-page">
      <header className="view-toolbar">
        <strong>Code Paste</strong>
        <div className="spacer" />
        <a href={`/raw/${encodeURIComponent(id)}`}>RAW</a>
        {canEdit && <a href={`/p/${encodeURIComponent(id)}`}>Editar</a>}
      </header>
      <article className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </article>
    </main>
  );
}
