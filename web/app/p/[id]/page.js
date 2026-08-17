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
  const [rawRules, setRawRules] = useState([]);
  const [status, setStatus] = useState('Carregando...');
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    Promise.resolve(params).then(p => setId(p.id));
  }, [params]);

  const rawUrl = useMemo(
    () => id ? `${window.location.origin}/raw/${id}` : '',
    [id]
  );

  const load = useCallback(async () => {
    if (!id) return;

    setStatus('Carregando...');
    try {
      const response = await fetch(`${API}/api/pastes/${id}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('not found');

      const paste = await response.json();
      setContent(paste.content);
      setLanguage(paste.language || 'plaintext');
      setRawRules(Array.isArray(paste.rawRules) ? paste.rawRules : []);
      setUpdatedAt(paste.updatedAt);
      setStatus('Pronto');
    } catch {
      setStatus('Erro ao carregar');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function addRule() {
    setRawRules(rules => [...rules, { userAgentRegex: '', content: '' }]);
  }

  function updateRule(index, field, value) {
    setRawRules(rules =>
      rules.map((rule, i) => i === index ? { ...rule, [field]: value } : rule)
    );
  }

  function removeRule(index) {
    setRawRules(rules => rules.filter((_, i) => i !== index));
  }

  async function save() {
    if (!id) return;

    setSaving(true);
    setStatus('Salvando...');

    try {
      const response = await fetch(`${API}/api/pastes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, language, rawRules })
      });

      if (!response.ok) throw new Error('save failed');

      const paste = await response.json();
      setUpdatedAt(paste.updatedAt);
      setRawRules(paste.rawRules || []);
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

        <select value={language} onChange={e => setLanguage(e.target.value)} aria-label="Linguagem">
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

      <section style={{ padding: '12px 16px', borderBottom: '1px solid #222', background: '#111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <strong>Conteúdo por User-Agent</strong>
          <button onClick={addRule}>+ Adicionar regra</button>
        </div>

        {rawRules.length === 0 ? (
          <small style={{ opacity: 0.7 }}>
            Sem regras: o RAW usa o conteúdo principal acima.
          </small>
        ) : (
          rawRules.map((rule, index) => (
            <div key={index} style={{ marginBottom: 14, padding: 10, border: '1px solid #333', borderRadius: 6 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  value={rule.userAgentRegex}
                  onChange={e => updateRule(index, 'userAgentRegex', e.target.value)}
                  placeholder="Regex do User-Agent. Ex: Discordbot|Googlebot"
                  style={{ flex: 1 }}
                />
                <button onClick={() => removeRule(index)}>Remover</button>
              </div>
              <textarea
                value={rule.content}
                onChange={e => updateRule(index, 'content', e.target.value)}
                placeholder="Conteúdo retornado quando o User-Agent casar com a regex"
                rows={5}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
          ))
        )}

        <small style={{ opacity: 0.7 }}>
          As regras são testadas de cima para baixo. A primeira regex que casar vence. Regex inválida é ignorada.
        </small>
      </section>

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
