const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function Home() {
  return (
    <main className="center">
      <div className="card">
        <h1>Code Paste</h1>
        <p>Abra um paste existente ou use o editor administrativo.</p>
        <p style={{ opacity: .7 }}>A criação e edição exigem Basic Auth.</p>
      </div>
    </main>
  );
}
