'use client';

import { useCallback, useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function preview(content) {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  return text.length > 140 ? `${text.slice(0, 140)}…` : text || 'Sem conteúdo';
}

function getDefaultText(paste) {
  return (paste.texts || []).find(text => text.id === 'default') || paste.texts?.[0] || null;
}

export default function Home() {
  const [authReady, setAuthReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [pastes, setPastes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadPastes = useCallback(async auth => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API}/api/pastes`, {
        headers: { Authorization: `Basic ${auth}` },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('failed');
      setPastes(await response.json());
    } catch {
      setError('Não foi possível carregar os pastes.');
    } finally {
      setLoading(false);
    }
  }, []);

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
        return loadPastes(auth);
      })
      .catch(() => {
        localStorage.removeItem('codepaste-basic-auth');
        setAuthorized(false);
      })
      .finally(() => setAuthReady(true));
  }, [loadPastes]);

  function createPaste() {
    const handle = window.prompt('Handle do paste:');
    if (handle === null) return;

    const normalized = handle.trim();
    if (!normalized) return;

    window.location.href = `/p/${encodeURIComponent(normalized)}`;
  }

  function editPaste(id) {
    window.location.href = `/p/${encodeURIComponent(id)}`;
  }

  function viewPaste(id) {
    window.open(`/${encodeURIComponent(id)}`, '_blank', 'noopener,noreferrer');
  }

  function rawPaste(id) {
    window.open(`/raw/${encodeURIComponent(id)}`, '_blank', 'noopener,noreferrer');
  }

  async function deletePaste(id) {
    const confirmed = window.confirm(`Excluir o paste "${id}"? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;

    const auth = localStorage.getItem('codepaste-basic-auth') || '';
    try {
      const response = await fetch(`${API}/api/pastes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Basic ${auth}` }
      });

      if (response.status === 401) {
        localStorage.removeItem('codepaste-basic-auth');
        setAuthorized(false);
        setPastes([]);
        return;
      }
      if (!response.ok) throw new Error('delete');
      setPastes(current => current.filter(paste => paste.id !== id));
    } catch {
      window.alert('Não foi possível excluir o paste.');
    }
  }

  return (
    <main className="home-page">
      <div className="home-container">
        <header className="home-header">
          <div>
            <h1>Code Paste</h1>
            {authorized && <p className="muted">Pastes criados</p>}
          </div>
          {authReady && authorized && (
            <button className="primary" onClick={createPaste}>Criar paste</button>
          )}
        </header>

        {!authReady ? (
          <div className="card"><p className="muted">Verificando autorização...</p></div>
        ) : !authorized ? (
          <div className="card">
            <p className="muted">Acesse um paste existente pela URL.</p>
          </div>
        ) : loading ? (
          <div className="card"><p className="muted">Carregando pastes...</p></div>
        ) : error ? (
          <div className="card"><p className="error">{error}</p></div>
        ) : pastes.length === 0 ? (
          <div className="card empty-state">
            <strong>Nenhum paste criado.</strong>
            <p className="muted">Clique em “Criar paste” para começar.</p>
          </div>
        ) : (
          <section className="paste-list">
            {pastes.map(paste => {
              const text = getDefaultText(paste);
              const textCount = paste.texts?.length || 0;
              const ruleCount = paste.rules?.length || 0;

              return (
                <article className="paste-card" key={paste.id}>
                  <div className="paste-card-main">
                    <div className="paste-card-title">
                      <strong>{paste.id}</strong>
                      <span className="muted">{textCount} {textCount === 1 ? 'texto' : 'textos'} · {ruleCount} {ruleCount === 1 ? 'filtro' : 'filtros'}</span>
                    </div>
                    <div className="paste-card-preview">{preview(text?.content)}</div>
                    <div className="paste-card-meta">
                      <span>Página: {Number(text?.pageViews || 0).toLocaleString('pt-BR')}</span>
                      <span>RAW: {Number(text?.rawViews || 0).toLocaleString('pt-BR')}</span>
                      {paste.updatedAt && <span>Atualizado: {new Date(paste.updatedAt).toLocaleString('pt-BR')}</span>}
                    </div>
                  </div>

                  <div className="paste-card-actions">
                    <button onClick={() => editPaste(paste.id)}>Editar</button>
                    <button onClick={() => viewPaste(paste.id)}>Visualizar</button>
                    <button onClick={() => rawPaste(paste.id)}>Visualizar RAW</button>
                    <button className="danger" onClick={() => deletePaste(paste.id)}>Excluir</button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
