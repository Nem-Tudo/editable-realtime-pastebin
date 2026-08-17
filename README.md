# Code Paste

Pastebin-like editor with Next.js, Monaco Editor, Express and MongoDB.

## Run with Docker

```bash
docker compose up --build
```

Open http://localhost:3000

## Development

### API

```bash
cd api
npm install
npm run dev
```

Requires MongoDB and:
`MONGO_URI=mongodb://localhost:27017/codepaste`

### Web

```bash
cd web
npm install
npm run dev
```

Set:
`NEXT_PUBLIC_API_URL=http://localhost:4000`

## Routes

- `GET /p/:id` — editor
- `POST /api/pastes` — create paste
- `GET /api/pastes/:id` — get paste
- `PUT /api/pastes/:id` — update paste
- `GET /raw/:id` — raw content
- `GET /health` — API health

## Security note

This starter intentionally does not execute code on the server. The `/raw/:id` endpoint only serves stored text.
