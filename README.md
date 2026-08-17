# Code Paste

Pastebin-like editor with Next.js, Monaco, Express and MongoDB.

## Rotas

- `GET /p/:id` — editor
- `POST /api/pastes` — criar paste
- `GET /api/pastes/:id` — obter paste
- `PUT /api/pastes/:id` — salvar paste
- `GET /raw/:id` — RAW (servido pelo domínio da web)
- `GET /health` — health da API

O `/raw/:id` público passa pelo Next.js e encaminha o `User-Agent` para a API. Assim, o RAW fica no mesmo domínio da interface, enquanto a API continua separada.

## User-Agent

Cada paste pode ter regras de User-Agent no formato:

```json
{
  "userAgentRegex": "Discordbot|Googlebot",
  "content": "conteúdo específico"
}
```

As regras são avaliadas em ordem e a primeira regex que casar com o `User-Agent` vence. Se nenhuma casar, o conteúdo principal do paste é retornado.

As regex são interpretadas pelo JavaScript com flag `i` (case-insensitive). Regex inválida é ignorada.

## Docker

```bash
docker compose up --build
```

A aplicação web fica na porta `55017` e a API na `55018`.

Defina `NEXT_PUBLIC_API_URL` com a URL pública da API, por exemplo:

```env
NEXT_PUBLIC_API_URL=https://apibin.nemtudo.me
```

O `API_INTERNAL_URL` usado pelo container web já aponta para `http://api:4000`.

## Segurança

O servidor não executa o conteúdo dos pastes. O RAW apenas retorna texto armazenado.
