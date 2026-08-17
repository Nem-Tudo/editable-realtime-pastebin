'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function Home() {
  const [authReady, setAuthReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem('codepaste-basic-auth') || '';

    if (!auth) {
      setAuthReady(true);
      return;
    }

    fetch(`${API}/api/auth/check`, {
      headers: { Authorization: `Basic ${auth}` },
      cache: 'no-store'
    })
      .then(response => {
        if (!response.ok) throw new Error('unauthorized');
        setAuthorized(true);
      })
      .catch(() => {
        localStorage.removeItem('codepaste-basic-auth');
        setAuthorized(false);
      })
      .finally(() => setAuthReady(true));
  }, []);

  function createPaste() {
    const handle = window.prompt('Handle do paste:');
    if (handle === null) return;

    const normalized = handle.trim();
    if (!normalized) return;

    window.location.href = `/p/${encodeURIComponent(normalized)}`;
  }

  return (
    <main className="center">
      <div className="card">
        <h1>Code Paste</h1>
        {!authReady ? (
          <p className="muted">Verificando autorização...</p>
        ) : authorized ? (
          <button className="primary" onClick={createPaste}>Criar paste</button>
        ) : (
          <p className="muted">Acesse um paste existente pela URL.</p>
        )}
      </div>
    </main>
  );
}
