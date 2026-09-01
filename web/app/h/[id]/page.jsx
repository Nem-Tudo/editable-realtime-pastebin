'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    DEFAULT_RATES,
    buildMessage,
    formatDuration,
    formatMoney,
    summarizeProject
} from '../../../lib/hours';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function makeId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function todayIso() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}

function blankProject() {
    return {
        title: '',
        summary: '',
        rates: { ...DEFAULT_RATES },
        nightStart: '18:00',
        nightEnd: '06:00',
        days: []
    };
}

export default function HoursEditor({ params }) {
    const [id, setId] = useState(null);
    const [project, setProject] = useState(blankProject());
    const [auth, setAuth] = useState('');
    const [authReady, setAuthReady] = useState(false);
    const [authorized, setAuthorized] = useState(false);
    const [status, setStatus] = useState('Carregando...');
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        Promise.resolve(params).then(value => setId(value.id));
        setAuth(localStorage.getItem('codepaste-basic-auth') || '');
        setAuthReady(true);
    }, [params]);

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
        try {
            const response = await fetch(`${API}/api/hours/${encodeURIComponent(id)}`, {
                headers: headers(),
                cache: 'no-store'
            });
            if (response.status === 404) {
                setProject(current => ({ ...blankProject(), title: id === 'new' ? '' : id }));
                setStatus('Novo projeto');
                return;
            }
            if (!response.ok) throw new Error('load');
            const data = await response.json();
            setProject({
                title: data.title || '',
                summary: data.summary || '',
                rates: { ...DEFAULT_RATES, ...(data.rates || {}) },
                nightStart: data.nightStart || '18:00',
                nightEnd: data.nightEnd || '06:00',
                days: Array.isArray(data.days) ? data.days : []
            });
            setStatus('Pronto');
        } catch {
            setStatus('Erro ao carregar');
        }
    }, [headers, id]);

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
        });
    }, [auth, authReady]);

    useEffect(() => {
        if (authorized) load();
    }, [authorized, load]);

    const report = useMemo(() => summarizeProject(project), [project]);
    const message = useMemo(() => buildMessage(project), [project]);

    function updateRate(field, value) {
        setProject(current => ({
            ...current,
            rates: { ...current.rates, [field]: value }
        }));
    }

    function addDay() {
        const day = {
            id: makeId(),
            date: todayIso(),
            content: '',
            periods: [{ id: makeId(), start: '', end: '', force: '' }]
        };
        setProject(current => ({ ...current, days: [...current.days, day] }));
    }

    function updateDay(dayId, field, value) {
        setProject(current => ({
            ...current,
            days: current.days.map(day => day.id === dayId ? { ...day, [field]: value } : day)
        }));
    }

    function removeDay(dayId) {
        setProject(current => ({
            ...current,
            days: current.days.filter(day => day.id !== dayId)
        }));
    }

    function addPeriod(dayId) {
        setProject(current => ({
            ...current,
            days: current.days.map(day => day.id === dayId
                ? { ...day, periods: [...day.periods, { id: makeId(), start: '', end: '', force: '' }] }
                : day)
        }));
    }

    function updatePeriod(dayId, periodId, field, value) {
        setProject(current => ({
            ...current,
            days: current.days.map(day => day.id !== dayId ? day : {
                ...day,
                periods: day.periods.map(period => period.id === periodId ? { ...period, [field]: value } : period)
            })
        }));
    }

    function removePeriod(dayId, periodId) {
        setProject(current => ({
            ...current,
            days: current.days.map(day => day.id !== dayId ? day : {
                ...day,
                periods: day.periods.filter(period => period.id !== periodId)
            })
        }));
    }

    async function save() {
        if (!id) return;
        const targetId = id === 'new'
            ? Array.from({ length: 6 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')
            : id;
        if (!auth && !askAuth()) return;

        setSaving(true);
        setStatus('Salvando...');
        try {
            const response = await fetch(`${API}/api/hours/${encodeURIComponent(targetId)}`, {
                method: 'PUT',
                headers: headers(),
                body: JSON.stringify(project)
            });
            if (response.status === 401) {
                localStorage.removeItem('codepaste-basic-auth');
                setAuth('');
                throw new Error('auth');
            }
            if (!response.ok) throw new Error('save');
            setStatus('Salvo');
            if (id === 'new') window.location.href = `/h/${encodeURIComponent(targetId)}`;
        } catch (err) {
            setStatus(err.message === 'auth' ? 'Credenciais inválidas' : 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    }

    async function copyMessage() {
        try {
            await navigator.clipboard.writeText(message);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            window.prompt('Copie a mensagem:', message);
        }
    }

    if (!id || !authReady) return <main className="center"><div className="card">Verificando autorização...</div></main>;

    if (!authorized) return (
        <main className="center">
            <div className="card auth-card">
                <h1>Acesso restrito</h1>
                <p>O gerenciador de horas usa o mesmo Basic Auth dos pastes.</p>
                <button className="primary" onClick={() => askAuth()}>Entrar</button>
            </div>
        </main>
    );

    return (
        <main className="editor-page">
            <header className="toolbar">
                <a href="/h" className="brand">Horas</a>
                <div className="spacer" />
                <span className="status">{status}</span>
                <button onClick={copyMessage}>{copied ? 'Copiado' : 'Copiar mensagem'}</button>
                <button className="primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </header>

            <section className="management">
                <div className="grid">
                    <input
                        value={project.title}
                        onChange={e => setProject(current => ({ ...current, title: e.target.value }))}
                        placeholder="Título do projeto"
                    />
                    <div className="row" style={{ marginBottom: 0 }}>
                        <input
                            value={project.nightStart}
                            onChange={e => setProject(current => ({ ...current, nightStart: e.target.value }))}
                            placeholder="Início noite (18:00)"
                        />
                        <input
                            value={project.nightEnd}
                            onChange={e => setProject(current => ({ ...current, nightEnd: e.target.value }))}
                            placeholder="Fim noite (06:00)"
                        />
                    </div>
                </div>
                <textarea
                    value={project.summary}
                    onChange={e => setProject(current => ({ ...current, summary: e.target.value }))}
                    placeholder="O que foi feito"
                />
                <div className="hours-rates">
                    <label>Diurna agora<input type="number" step="0.01" value={project.rates.dayNow} onChange={e => updateRate('dayNow', e.target.value)} /></label>
                    <label>Diurna futuro<input type="number" step="0.01" value={project.rates.dayFuture} onChange={e => updateRate('dayFuture', e.target.value)} /></label>
                    <label>Noturna agora<input type="number" step="0.01" value={project.rates.nightNow} onChange={e => updateRate('nightNow', e.target.value)} /></label>
                    <label>Noturna futuro<input type="number" step="0.01" value={project.rates.nightFuture} onChange={e => updateRate('nightFuture', e.target.value)} /></label>
                </div>
                <div className="paste-card-meta">
                    <span>{formatDuration(report.totals.totalMinutes)}</span>
                    <span>Agora: {formatMoney(report.totals.now)}</span>
                    <span>Futuro: {formatMoney(report.totals.future)}</span>
                    <span>Total: {formatMoney(report.totals.total)}</span>
                </div>
            </section>

            <section className="management rules-section">
                <div className="section-head">
                    <strong>Dias</strong>
                    <button onClick={addDay}>+ Novo dia</button>
                </div>

                {project.days.length === 0 && <small className="muted">Adicione um dia e os períodos trabalhados.</small>}

                {report.days.map(({ day, stats }) => (
                    <div className="panel" key={day.id}>
                        <div className="row">
                            <input type="date" value={day.date || ''} onChange={e => updateDay(day.id, 'date', e.target.value)} />
                            <input value={day.content} onChange={e => updateDay(day.id, 'content', e.target.value)} placeholder="Conteúdo do dia" />
                            <button onClick={() => removeDay(day.id)}>Remover dia</button>
                        </div>

                        {day.periods.map(period => (
                            <div className="row" key={period.id}>
                                <input value={period.start} onChange={e => updatePeriod(day.id, period.id, 'start', e.target.value)} placeholder="Início 17h30" />
                                <input value={period.end} onChange={e => updatePeriod(day.id, period.id, 'end', e.target.value)} placeholder="Fim 19h" />
                                <select value={period.force || ''} onChange={e => updatePeriod(day.id, period.id, 'force', e.target.value)}>
                                    <option value="">Auto (corta na noite)</option>
                                    <option value="day">Forçar diurna</option>
                                    <option value="night">Forçar noturna</option>
                                </select>
                                <button onClick={() => removePeriod(day.id, period.id)}>Remover</button>
                            </div>
                        ))}

                        <div className="row" style={{ marginBottom: 0 }}>
                            <button onClick={() => addPeriod(day.id)}>+ Período</button>
                            <span className="muted">
                                {formatDuration(stats.totalMinutes)} · agora {formatMoney(stats.now)} · futuro {formatMoney(stats.future)} · dia {formatMoney(stats.total)}
                            </span>
                        </div>
                    </div>
                ))}
            </section>

            <section className="management">
                <div className="section-head">
                    <strong>Mensagem</strong>
                </div>
                <pre className="hours-message">{message}</pre>
            </section>
        </main>
    );
}