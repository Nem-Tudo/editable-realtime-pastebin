 'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const languages = [
  ['plaintext', 'Plain Text'], ['javascript', 'JavaScript'], ['typescript', 'TypeScript'],
  ['json', 'JSON'], ['html', 'HTML'], ['css', 'CSS'], ['powershell', 'PowerShell'],
  ['shell', 'Shell'], ['python', 'Python'], ['java', 'Java'], ['csharp', 'C#'],
  ['cpp', 'C++'], ['sql', 'SQL'], ['yaml', 'YAML']
];

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function PasteEditor({ params }) {
  const [id, setId] = useState(null);
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('plaintext');
  const [texts, setTexts] = useState([]);
  const [rules, setRules] = useState([]);
  const [status, setStatus] = useState('Carregando...');
  const [saving, setSaving] = useState(false);
  const [auth, setAuth] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    Promise.resolve(params).then(p => setId(p.id));
    setAuth(sessionStorage.getItem('codepaste-basic-auth') || '');
    setAuthReady(true);
  }, [params]);

  const rawUrl = useMemo(() => id ? `${window.location.origin}/raw/${id}` : '', [id]);
  const viewUrl = useMemo(() => id ? `${window.location.origin}/view/${id}` : '', [id]);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    ...(auth ? { Authorization: `Basic ${auth}` } : {})
  }), [auth]);

  function askAuth() {
    const user = window.prompt('Usuário Basic Auth:');
    if (user === null) return false;
    const password = window.prompt('Senha Basic Auth:');
    if (password === null) return false;
    const encoded = btoa(unescape(encodeURIComponent(`${user}:${password}`)));
    sessionStorage.setItem('codepaste-basic-auth', encoded);
    setAuth(encoded);
    return true;
  }

  const load = useCallback(async () => {
    if (!id) return;
    setStatus('Carregando...');
    try {
      const response = await fetch(`${API}/api/pastes/${id}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('not found');
      const paste = await response.json();
      setContent(paste.content || '');
      setLanguage(paste.language || 'plaintext');
      setTexts(Array.isArray(paste.texts) ? paste.texts : []);
      setRules(Array.isArray(paste.rules) ? paste.rules : []);
      setUpdatedAt(paste.updatedAt);
      setStatus('Pronto');
    } catch {
      setStatus('Erro ao carregar');
    }
  }, [id]);

  useEffect(() => {
    if (authReady) load();
  }, [load, authReady]);

  function addText() {
    setTexts(value => [...value, { id: makeId(), name: `Texto ${value.length + 1}`, content: '' }]);
  }

  function updateText(index, field, value) {
    setTexts(value => value.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  function removeText(index) {
    const removed = texts[index];
    setTexts(value => value.filter((_, i) => i !== index));
    setRules(value => value.filter(rule => rule.textId !== removed?.id));
  }

  function addRule() {
    setRules(value => [...value, {
      id: makeId(),
      userAgentRegex: '',
      ipRegex: '',
      country: '',
      region: '',
      city: '',
      textId: texts[0]?.id || ''
    }]);
  }

  function updateRule(index, field, value) {
    setRules(value => value.map((rule, i) => i === index ? { ...rule, [field]: value } : rule));
  }

  async function save() {
    if (!id) return;
    if (!auth && !askAuth()) return;

    setSaving(true);
    setStatus('Salvando...');
    try {
      const response = await fetch(`${API}/api/pastes/${id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ content, language, texts, rules })
      });

      if (response.status === 401) {
        sessionStorage.removeItem('codepaste-basic-auth');
        setAuth('');
        throw new Error('auth');
      }
      if (!response.ok) throw new Error('save');
      const paste = await response.json();
      setUpdatedAt(paste.updatedAt);
      setTexts(paste.texts || []);
      setRules(paste.rules || []);
      setStatus('Salvo');
    } catch (err) {
      setStatus(err.message === 'auth' ? 'Credenciais inválidas' : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function createPaste() {
    if (!auth && !askAuth()) return;
    try {
      const response = await fetch(`${API}/api/pastes`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ content: '', language: 'plaintext', texts: [], rules: [] })
      });
      if (!response.ok) throw new Error('create');
      const paste = await response.json();
      window.location.href = `/p/${paste.id}`;
    } catch {
      setStatus('Erro ao criar paste');
    }
  }

  if (!id) return <main className="center"><div className="card">Carregando...</div></main>;

  return (
    <main className="editor-page">
      <header className="toolbar">
        <div className="brand">Code Paste</div>
        <select value={language} onChange={e => setLanguage(e.target.value)}>
          {languages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <div className="spacer" />
        <span className="status">{status}</span>
        <button onClick={createPaste}>Novo paste</button>
        <a href={viewUrl} target="_blank" rel="noreferrer">Visualizar</a>
        <a href={rawUrl} target="_blank" rel="noreferrer">RAW</a>
        <button className="primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
      </header>

      <div className="urlbar">
        <span>RAW:</span><code>{rawUrl}</code>
        {updatedAt && <span className="updated">atualizado {new Date(updatedAt).toLocaleString('pt-BR')}</span>}
      </div>

      <section className="management">
        <div className="section-head">
          <strong>Textos salvos</strong>
          <button onClick={addText}>+ Novo texto</button>
        </div>
        {texts.length === 0 && <small className="muted">Crie textos nomeados aqui. As regras apenas apontam para um desses textos.</small>}
        {texts.map((text, index) => (
          <div className="panel" key={text.id}>
            <div className="row">
              <input value={text.name} onChange={e => updateText(index, 'name', e.target.value)} placeholder="Nome do texto" />
              <button onClick={() => removeText(index)}>Remover</button>
            </div>
            <textarea value={text.content} onChange={e => updateText(index, 'content', e.target.value)}
              placeholder="Conteúdo retornado por este texto" rows={5} />
          </div>
        ))}

        <div className="section-head" style={{ marginTop: 18 }}>
          <strong>Filtros / regras</strong>
          <button onClick={addRule} disabled={!texts.length}>+ Nova regra</button>
        </div>
        {!texts.length && <small className="muted">Crie pelo menos um texto antes de criar uma regra.</small>}
        {rules.map((rule, index) => (
          <div className="panel" key={rule.id}>
            <div className="row">
              <select value={rule.textId} onChange={e => updateRule(index, 'textId', e.target.value)}>
                <option value="">Selecione o texto...</option>
                {texts.map(text => <option key={text.id} value={text.id}>{text.name}</option>)}
              </select>
              <button onClick={() => setRules(value => value.filter((_, i) => i !== index))}>Remover</button>
            </div>
            <div className="grid">
              <input value={rule.userAgentRegex} onChange={e => updateRule(index, 'userAgentRegex', e.target.value)} placeholder="User-Agent regex (opcional)" />
              <input value={rule.ipRegex} onChange={e => updateRule(index, 'ipRegex', e.target.value)} placeholder="IP regex (opcional)" />
              <input value={rule.country} onChange={e => updateRule(index, 'country', e.target.value)} placeholder="País ex.: Brazil" />
              <input value={rule.region} onChange={e => updateRule(index, 'region', e.target.value)} placeholder="Estado/região ex.: São Paulo" />
              <input value={rule.city} onChange={e => updateRule(index, 'city', e.target.value)} placeholder="Cidade ex.: São José dos Campos" />
            </div>
            <small className="muted">Todos os campos preenchidos nessa regra precisam coincidir. Regex vazia não restringe.</small>
          </div>
        ))}
      </section>

      <section className="editor">
        <Editor theme="vs-dark" language={language} value={content} onChange={value => setContent(value ?? '')}
          options={{ minimap: { enabled: true }, fontSize: 14, automaticLayout: true, tabSize: 2, wordWrap: 'off', padding: { top: 12 } }} />
      </section>
    </main>
  );
}
