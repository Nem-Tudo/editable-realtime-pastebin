import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://api:4000';
const PUBLIC_ORIGIN = process.env.PUBLIC_WEB_URL || 'http://localhost:55017';

async function getPaste(id) {
  const response = await fetch(`${API}/api/pastes/${encodeURIComponent(id)}/render`, {
    cache: 'no-store'
  });
  if (!response.ok) return null;
  return response.json();
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const paste = await getPaste(id);
  if (!paste) return { title: 'Paste não encontrado' };

  const plain = paste.content.replace(/[#*_`>\[\]]/g, '').replace(/\s+/g, ' ').trim();
  const description = plain.slice(0, 180) || 'Code Paste';

  return {
    title: `Paste ${id}`,
    description,
    openGraph: {
      title: `Paste ${id}`,
      description,
      type: 'article',
      url: `${PUBLIC_ORIGIN}/view/${id}`
    },
    twitter: {
      card: 'summary',
      title: `Paste ${id}`,
      description
    }
  };
}

export default async function ViewPage({ params }) {
  const { id } = await params;
  const paste = await getPaste(id);
  if (!paste) notFound();

  return (
    <main className="view-page">
      <header className="view-toolbar">
        <strong>Code Paste</strong>
        <div className="spacer" />
        <a href={`/raw/${id}`}>RAW</a>
        <a href={`/p/${id}`}>Editar</a>
      </header>
      <article className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {paste.content}
        </ReactMarkdown>
      </article>
    </main>
  );
}
