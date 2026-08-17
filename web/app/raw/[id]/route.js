const API_INTERNAL = process.env.API_INTERNAL_URL || 'http://api:4000';

export async function GET(request, { params }) {
  const { id } = await params;

  try {
    const response = await fetch(`${API_INTERNAL}/raw/${encodeURIComponent(id)}`, {
      headers: {
        'user-agent': request.headers.get('user-agent') || ''
      },
      cache: 'no-store'
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
