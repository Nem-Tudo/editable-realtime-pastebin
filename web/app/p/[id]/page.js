'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const languages = [
  ['plaintext', 'Plain Text'],
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['json', 'JSON'],
  ['html', 'HTML'],
  ['css', 'CSS'],
  ['powershell', 'PowerShell'],
  ['shell', 'Shell'],
  ['python', 'Python'],
  ['java', 'Java'],
  ['csharp', 'C#'],
  ['cpp', 'C++'],
  ['sql', 'SQL'],
  ['yaml', 'YAML']
];

export default function PasteEditor({ params }) {
  const [id, setId] = useState(null);
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('plaintext');
  const [status, setStatus] = useState('Carregando...');
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    Promise.resolve(params).then(p => setId(p.id));
  }, [params]);

  const rawUrl = useMemo(
    () => id ? `${API}/raw/${id}` : '',
    [id]
  );

  const load = useCallback(async () => {
    if (!id) return;

    setStatus('Carregando...');
    try {
      const response = await fetch(`${API}/api/pastes/${id}`, {
        cache: 'no-store'
      });

      if (!response.ok) throw new Error('not found');

      const paste = await response.json();
      setContent(paste.content);
      setLanguage(paste.language || 'plaintext');
      setUpdatedAt(paste.updatedAt);
      setStatus('Pronto');
    } catch {
      setStatus('Erro ao carregar');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!id) return;

    setSaving(true);
    setStatus('Salvando...');

    try {
      const response = await fetch(`${API}/api/pastes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, language })
      });

      if (!response.ok) throw new Error('save failed');

      const paste = await response.json();
      setUpdatedAt(paste.updatedAt);
      setStatus('Salvo');
    } catch {
      setStatus('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function copyRaw() {
    await navigator.clipboard.writeText(rawUrl);
    setStatus('URL RAW copiada');
  }

  if (!id) {
    return <main className="center"><div className="card">Carregando...</div></main>;
  }

  return (
    <main className="editor-page">
      <header className="toolbar">
        <div className="brand">Code Paste</div>

        <select
          value={language}
          onChange={e => setLanguage(e.target.value)}
          aria-label="Linguagem"
        >
          {languages.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <div className="spacer" />

        <span className="status">{status}</span>

        <button onClick={copyRaw}>Copiar RAW</button>
        <a href={rawUrl} target="_blank" rel="noreferrer">Abrir RAW</a>
        <button className="primary" onClick={save} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </header>

      <div className="urlbar">
        <span>RAW:</span>
        <code>{rawUrl}</code>
        {updatedAt && (
          <span className="updated">
            atualizado {new Date(updatedAt).toLocaleString('pt-BR')}
          </span>
        )}
      </div>

      <section className="editor">
        <Editor
          theme="vs-dark"
          language={language}
          value={content}
          onChange={value => setContent(value ?? '')}
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'off',
            padding: { top: 12 }
          }}
        />
      </section>
    </main>
  );
}
