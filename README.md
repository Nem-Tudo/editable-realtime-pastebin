# Code Paste

Pastebin-like editor with Next.js, Monaco, Express e MongoDB.

## Funcionalidades

- `GET /p/:id` — editor administrativo
- `GET /view/:id` — visualização formatada em Markdown
- `GET /raw/:id` — RAW público
- `POST /api/pastes` — criar paste (Basic Auth)
- `GET /api/pastes/:id` — obter paste
- `PUT /api/pastes/:id` — editar paste (Basic Auth)
- `DELETE /api/pastes/:id` — apagar paste (Basic Auth)
- `GET /api/pastes/:id/render` — conteúdo selecionado para a visualização

### Basic Auth

Configure no `.env`:

```env
ADMIN_USER=admin
ADMIN_PASSWORD=uma-senha-forte
NEXT_PUBLIC_API_URL=https://apibin.nemtudo.me
PUBLIC_WEB_URL=https://bin.nemtudo.me
```

Criação, edição e exclusão exigem `Authorization: Basic ...`.

### Textos reutilizáveis

Cada paste possui uma lista de **Textos salvos**. Cada texto tem:

- nome;
- conteúdo.

As regras não armazenam mais o conteúdo. Elas apontam para `textId`, então o mesmo texto pode ser reutilizado por várias regras.

### Filtros

Cada regra pode combinar:

- `User-Agent regex`;
- `IP regex`;
- país;
- estado/região;
- cidade;
- dispositivo (`pc`, `mobile`, `tablet`, `tv`, `bot`).

Todos os campos preenchidos na regra precisam coincidir. Regras são avaliadas de cima para baixo; a primeira que casar seleciona o texto vinculado.

A localização é obtida server-side usando IP-API para IPs públicos. IPs privados/localhost não possuem geolocalização.

### Visualização / OG

`/view/:id` renderiza Markdown/GFM e gera Open Graph/Twitter metadata dinamicamente, usando o conteúdo selecionado para a requisição.

### Docker

```bash
docker compose up --build
```

Web: `55017`  
API: `55018`


### Autenticação do editor

A rota `/p/:id` não renderiza o editor até que o navegador tenha validado as credenciais em `/api/auth/check`.

Depois do primeiro login, o Basic Auth fica salvo em `localStorage` para continuar autenticado nas próximas visitas. Para sair, remova a credencial salva no navegador ou use a opção de limpeza de credenciais.

### Visualizações

Cada texto salvo possui um contador `views`. Quando uma regra seleciona aquele texto em `/raw/:id` ou na visualização pública, o contador é incrementado.

### Dispositivo

O servidor classifica o User-Agent como:

- `pc`
- `mobile`
- `tablet`
- `tv`
- `bot`

A regra pode selecionar um texto específico por dispositivo.
