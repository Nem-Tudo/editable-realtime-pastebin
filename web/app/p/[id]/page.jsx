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

function normalizeTexts(value, legacyContent = '', legacyLanguage = 'plaintext') {
  const source = Array.isArray(value) ? value : [];
  const defaultText = source.find(text => text?.id === 'default');

  return [
    {
      id: 'default',
      name: 'Default',
      content: typeof defaultText?.content === 'string' ? defaultText.content : legacyContent,
      language: defaultText?.language || legacyLanguage || 'plaintext',
      pageViews: Number(defaultText?.pageViews ?? defaultText?.views ?? 0),
      rawViews: Number(defaultText?.rawViews || 0)
    },
    ...source
      .filter(text => text?.id !== 'default')
      .map(text => ({
        id: text.id || makeId(),
        name: text.name || 'Sem nome',
        content: text.content || '',
        language: text.language || 'plaintext',
        pageViews: Number(text.pageViews ?? text.views ?? 0),
        rawViews: Number(text.rawViews || 0)
      }))
  ];
}

function languageLabel(value) {
  return languages.find(([id]) => id === value)?.[1] || value || 'Plain Text';
}

function preview(content) {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  return text.length > 120 ? `${text.slice(0, 120)}…` : text || 'Sem conteúdo';
}

export default function PasteEditor({ params }) {
  const [id, setId] = useState(null);
  const [texts, setTexts] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState('default');
  const [rules, setRules] = useState([]);
  const [status, setStatus] = useState('Carregando...');
  const [saving, setSaving] = useState(false);
  const [auth, setAuth] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [pasteExists, setPasteExists] = useState(false);

  useEffect(() => {
    Promise.resolve(params).then(p => setId(p.id));
    const saved = localStorage.getItem('codepaste-basic-auth') || '';
    setAuth(saved);
    setAuthReady(true);
  }, [params]);

  const viewUrl = useMemo(() => id ? `${window.location.origin}/view/${id}` : '', [id]);
  const selectedText = useMemo(
    () => texts.find(text => text.id === selectedTextId) || texts[0] || null,
    [texts, selectedTextId]
  );

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
    localStorage.setItem('codepaste-basic-auth', encoded);
    setAuth(encoded);
    return true;
  }

  const load = useCallback(async () => {
    if (!id) return;
    setStatus('Carregando...');
    try {
      const response = await fetch(`${API}/api/pastes/${id}`, { cache: 'no-store' });
      if (response.status === 404) {
        const blank = normalizeTexts([]);
        setTexts(blank);
        setSelectedTextId('default');
        setRules([]);
        setUpdatedAt(null);
        setPasteExists(false);
        setStatus('Novo paste');
        return;
      }
      if (!response.ok) throw new Error('not found');
      const paste = await response.json();
      const loadedTexts = normalizeTexts(paste.texts);
      setPasteExists(true);
      setTexts(loadedTexts);
      setSelectedTextId(current => loadedTexts.some(text => text.id === current) ? current : 'default');
      setRules(Array.isArray(paste.rules) ? paste.rules : []);
      setUpdatedAt(paste.updatedAt);
      setStatus('Pronto');
    } catch {
      setStatus('Erro ao carregar');
    }
  }, [id]);

  useEffect(() => {
    if (!authReady || !auth) return;

    fetch(`${API}/api/auth/check`, {
      headers: { Authorization: `Basic ${auth}` },
      cache: 'no-store'
    }).then(response => {
      if (!response.ok) throw new Error('unauthorized');
      setAuthorized(true);
    }).catch(() => {
      localStorage.removeItem('codepaste-basic-auth');
      setAuth('');
      setAuthorized(false);
      setStatus('Não autorizado');
    });
  }, [auth, authReady]);

  useEffect(() => {
    if (authorized) load();
  }, [load, authorized]);

  function addText() {
    const text = {
      id: makeId(),
      name: `Texto ${texts.filter(item => item.id !== 'default').length + 1}`,
      content: '',
      language: 'plaintext',
      views: 0
    };
    setTexts(value => [...value, text]);
    setSelectedTextId(text.id);
  }

  function updateText(index, field, nextValue) {
    setTexts(current => current.map((item, i) =>
      i === index
        ? { ...item, ...(item.id === 'default' && field === 'name' ? {} : { [field]: nextValue }) }
        : item
    ));
  }

  function updateSelectedText(field, nextValue) {
    if (!selectedText) return;
    setTexts(current => current.map(text =>
      text.id === selectedText.id ? { ...text, [field]: nextValue } : text
    ));
  }

  function cloneText(text) {
    if (!text) return;
    const baseName = `${text.name || 'Texto'} (cópia)`;
    const existingNames = new Set(texts.map(item => item.name));
    let name = baseName;
    let suffix = 2;
    while (existingNames.has(name)) {
      name = `${baseName} ${suffix++}`;
    }

    const clone = {
      id: makeId(),
      name,
      content: text.content || '',
      language: text.language || 'plaintext',
      pageViews: 0,
      rawViews: 0
    };
    setTexts(value => [...value, clone]);
    setSelectedTextId(clone.id);
  }

  function removeText(index) {
    const removed = texts[index];
    if (!removed || removed.id === 'default') return;
    setTexts(value => value.filter((_, i) => i !== index));
    setRules(value => value.filter(rule => rule.textId !== removed.id));
    if (selectedTextId === removed.id) setSelectedTextId('default');
  }

  function addRule() {
    setRules(value => [...value, {
      id: makeId(),
      userAgentRegex: '',
      ipRegex: '',
      country: '',
      region: '',
      city: '',
      device: '',
      textId: texts[0]?.id || 'default'
    }]);
  }

  function updateRule(index, field, nextValue) {
    setRules(currentRules => currentRules.map((rule, i) =>
      i === index ? { ...rule, [field]: nextValue } : rule
    ));
  }

  async function save() {
    if (!id) return;
    if (!auth && !askAuth()) return;

    setSaving(true);
    setStatus('Salvando...');
    try {
      const defaultText = texts.find(text => text.id === 'default') || {
        id: 'default', name: 'Default', content: '', language: 'plaintext', pageViews: 0, rawViews: 0
      };
      const payloadTexts = [
        { ...defaultText, id: 'default', name: 'Default' },
        ...texts.filter(text => text.id !== 'default')
      ];

      const response = await fetch(`${API}/api/pastes/${id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({
          texts: payloadTexts,
          rules
        })
      });

      if (response.status === 401) {
        localStorage.removeItem('codepaste-basic-auth');
        setAuth('');
        throw new Error('auth');
      }
      if (!response.ok) throw new Error('save');
      const paste = await response.json();
      const savedTexts = normalizeTexts(paste.texts);
      setPasteExists(true);
      setTexts(savedTexts);
      setSelectedTextId(current => savedTexts.some(text => text.id === current) ? current : 'default');
      setRules(paste.rules || []);
      setUpdatedAt(paste.updatedAt);
      setStatus('Salvo');
    } catch (err) {
      setStatus(err.message === 'auth' ? 'Credenciais inválidas' : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }


  if (!id || !authReady) return <main className="center"><div className="card">Verificando autorização...</div></main>;

  const referencedTextIds = useMemo(() => new Set(rules.map(rule => rule.textId).filter(Boolean)), [rules]);

  if (!authorized) return (
    <main className="center">
      <div className="card auth-card">
        <h1>Acesso restrito</h1>
        <p>Esta página é apenas para usuários autorizados.</p>
        <button className="primary" onClick={() => askAuth()}>Entrar</button>
        <small className="muted">{status}</small>
      </div>
    </main>
  );

  return (
    <main className="editor-page">
      <header className="toolbar">
        <div className="brand">Code Paste</div>
        <select
          value={selectedText?.language || 'plaintext'}
          onChange={e => updateSelectedText('language', e.target.value)}
          disabled={!selectedText}
          title="Linguagem do texto selecionado"
        >
          {languages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <div className="spacer" />
        <span className="status">{status}</span>
        <a href={viewUrl} target="_blank" rel="noreferrer">Visualizar</a>
        <button className="primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : (pasteExists ? 'Salvar' : 'Criar')}</button>
      </header>


      <section className="text-library">
        <div className="section-head">
          <div>
            <strong>Textos</strong>
            <small className="muted section-description">Selecione um texto para abrir seu conteúdo no editor.</small>
          </div>
          <button onClick={addText}>+ Novo texto</button>
        </div>

        <div className="text-cards">
          {texts.map(text => (
            <button
              type="button"
              className={`text-card ${selectedTextId === text.id ? 'active' : ''} ${text.id !== 'default' && !referencedTextIds.has(text.id) ? 'unreachable' : ''}`}
              key={text.id}
              onClick={() => setSelectedTextId(text.id)}
            >
              <div className="text-card-top">
                <strong>{text.name}</strong>
                {text.id === 'default' && <span className="default-badge">DEFAULT</span>}
              </div>
              <div className="text-card-meta">
                <span>ID: <code>{text.id}</code></span>
                <span>{languageLabel(text.language)}</span>
                <span>Página: {Number(text.pageViews || 0).toLocaleString('pt-BR')}</span>
                <span>RAW: {Number(text.rawViews || 0).toLocaleString('pt-BR')}</span>
              </div>
              <div className="text-card-preview">{preview(text.content)}</div>
              {text.id !== 'default' && !referencedTextIds.has(text.id) && (
                <div className="text-card-warning">⚠ Nenhum filtro aponta para este texto — ele nunca vai aparecer.</div>
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="editor-section">
        <div className="editor-head">
          <div>
            <strong>{selectedText?.name || 'Texto'}</strong>
            <span className="editor-id">ID: {selectedText?.id || '—'}</span>
          </div>
          {selectedText?.id !== 'default' && selectedText && (
            <div className="editor-actions">
              <input
                value={selectedText.name}
                onChange={e => updateSelectedText('name', e.target.value)}
                placeholder="Nome do texto"
                aria-label="Nome do texto"
              />
              <button onClick={() => cloneText(selectedText)}>Clonar texto</button>
              <button onClick={() => removeText(texts.findIndex(text => text.id === selectedText.id))}>Remover texto</button>
            </div>
          )}
        </div>
        <div className="editor">
          {selectedText ? (
            <Editor
              theme="vs-dark"
              language={selectedText.language || 'plaintext'}
              value={selectedText.content || ''}
              onChange={value => updateSelectedText('content', value ?? '')}
              options={{ minimap: { enabled: true }, fontSize: 14, automaticLayout: true, tabSize: 2, wordWrap: 'off', padding: { top: 12 } }}
            />
          ) : (
            <div className="empty-editor">Nenhum texto disponível.</div>
          )}
        </div>
      </section>

      <section className="management rules-section">
        <div className="section-head">
          <strong>Filtros / regras</strong>
          <button onClick={addRule} disabled={!texts.length}>+ Nova regra</button>
        </div>
        {rules.length === 0 && <small className="muted">Crie regras para entregar textos diferentes de acordo com o visitante.</small>}
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
              <input value={rule.userAgentRegex || ''} onChange={e => updateRule(index, 'userAgentRegex', e.target.value)} placeholder="User-Agent regex (opcional)" />
              <input value={rule.ipRegex || ''} onChange={e => updateRule(index, 'ipRegex', e.target.value)} placeholder="IP regex (opcional)" />
              <input value={rule.country || ''} onChange={e => updateRule(index, 'country', e.target.value)} placeholder="País ex.: Brazil" />
              <input value={rule.region || ''} onChange={e => updateRule(index, 'region', e.target.value)} placeholder="Estado/região ex.: São Paulo" />
              <input value={rule.city || ''} onChange={e => updateRule(index, 'city', e.target.value)} placeholder="Cidade ex.: São José dos Campos" />
              <select value={rule.device || ''} onChange={e => updateRule(index, 'device', e.target.value)}>
                <option value="">Qualquer dispositivo</option>
                <option value="pc">PC / computador</option>
                <option value="mobile">Celular</option>
                <option value="tablet">Tablet</option>
                <option value="tv">TV / Smart TV</option>
                <option value="bot">Bot / crawler</option>
              </select>
            </div>
            <small className="muted">Todos os campos preenchidos nessa regra precisam coincidir. Regex vazia não restringe.</small>
          </div>
        ))}
      </section>
    </main>
  );
}
