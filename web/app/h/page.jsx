'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDuration, formatMoney, summarizeProject } from '../../lib/hours';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function HoursHome() {
    const [authReady, setAuthReady] = useState(false);
    const [authorized, setAuthorized] = useState(false);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadProjects = useCallback(async auth => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`${API}/api/hours`, {
                headers: { Authorization: `Basic ${auth}` },
                cache: 'no-store'
            });
            if (!response.ok) throw new Error('failed');
            setProjects(await response.json());
        } catch {
            setError('Não foi possível carregar os projetos de horas.');
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
                return loadProjects(auth);
            })
            .catch(() => {
                localStorage.removeItem('codepaste-basic-auth');
                setAuthorized(false);
            })
            .finally(() => setAuthReady(true));
    }, [loadProjects]);

    function createProject() {
        const handle = window.prompt('Handle do projeto de horas:');
        if (handle === null) return;
        const normalized = handle.trim();
        if (!normalized) return;
        window.location.href = `/h/${encodeURIComponent(normalized)}`;
    }

    async function deleteProject(id) {
        const confirmed = window.confirm(`Excluir o projeto "${id}"?`);
        if (!confirmed) return;
        const auth = localStorage.getItem('codepaste-basic-auth') || '';
        try {
            const response = await fetch(`${API}/api/hours/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: { Authorization: `Basic ${auth}` }
            });
            if (!response.ok) throw new Error('delete');
            setProjects(current => current.filter(project => project.id !== id));
        } catch {
            window.alert('Não foi possível excluir o projeto.');
        }
    }

    return (
        <main className="home-page">
            <div className="home-container">
                <header className="home-header">
                    <div>
                        <h1>Horas</h1>
                        {authorized && <p className="muted">Controle de horas, agora e a receber</p>}
                    </div>
                    {authReady && authorized && (
                        <div className="row" style={{ marginBottom: 0 }}>
                            <a href="/">Pastes</a>
                            <button className="primary" onClick={createProject}>Novo projeto</button>
                        </div>
                    )}
                </header>

                {!authReady ? (
                    <div className="card"><p className="muted">Verificando autorização...</p></div>
                ) : !authorized ? (
                    <div className="card">
                        <p className="muted">Entre pelo editor de um paste para autenticar, depois volte em /h.</p>
                        <p><a href="/">Voltar</a></p>
                    </div>
                ) : loading ? (
                    <div className="card"><p className="muted">Carregando projetos...</p></div>
                ) : error ? (
                    <div className="card"><p className="error">{error}</p></div>
                ) : projects.length === 0 ? (
                    <div className="card empty-state">
                        <strong>Nenhum projeto de horas.</strong>
                        <p className="muted">Clique em “Novo projeto” para começar.</p>
                    </div>
                ) : (
                    <section className="paste-list">
                        {projects.map(project => {
                            const { totals } = summarizeProject(project);
                            return (
                                <article className="paste-card" key={project.id}>
                                    <div className="paste-card-main">
                                        <div className="paste-card-title">
                                            <strong>{project.title || project.id}</strong>
                                            <span className="muted">{project.days?.length || 0} dia(s)</span>
                                        </div>
                                        <div className="paste-card-preview">{project.summary || 'Sem resumo'}</div>
                                        <div className="paste-card-meta">
                                            <span>{formatDuration(totals.totalMinutes)}</span>
                                            <span>Agora: {formatMoney(totals.now)}</span>
                                            <span>Futuro: {formatMoney(totals.future)}</span>
                                            <span>Total: {formatMoney(totals.total)}</span>
                                        </div>
                                    </div>
                                    <div className="paste-card-actions">
                                        <button onClick={() => window.location.href = `/h/${encodeURIComponent(project.id)}`}>Abrir</button>
                                        <button className="danger" onClick={() => deleteProject(project.id)}>Excluir</button>
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