'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function Home() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function createPaste() {
    setCreating(true);
    try {
      const response = await fetch(`${API}/api/pastes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '', language: 'plaintext' })
      });

      if (!response.ok) throw new Error('create failed');

      const paste = await response.json();
      router.push(`/p/${paste.id}`);
    } catch {
      alert('Não foi possível criar o paste.');
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    createPaste();
  }, []);

  return (
    <main className="center">
      <div className="card">
        <h1>Code Paste</h1>
        <p>{creating ? 'Criando seu paste...' : 'Redirecionando...'}</p>
      </div>
    </main>
  );
}
