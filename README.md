# Crabdrop 🦀

A direct image hotlink CDN — like [Catbox](https://catbox.moe/) — built with a modern stack.

## Tech Stack

- **Frontend:** React + TypeScript (Vite)
- **Backend:** Rust (Axum)
- **Database:** Supabase (PostgreSQL)
- **ORM:** SeaORM
- **Storage:** Cloudflare R2

## Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/) (v9+)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [cargo-watch](https://github.com/watchexec/cargo-watch) — `cargo install cargo-watch`
- [sea-orm-cli](https://www.sea-ql.org/SeaORM/) — `cargo install sea-orm-cli`

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy env and add your Supabase connection string
cp apps/server/.env.example apps/server/.env

# Run migrations
pnpm db:migrate

# Run frontend + backend concurrently (with hot reload)
pnpm dev

# Or run them individually
pnpm dev:client
pnpm dev:server
```

| Service  | URL                   |
| -------- | --------------------- |
| Frontend | http://localhost:3000 |
| Backend  | http://localhost:3001 |

## Project Structure

```
crabdrop/
├── apps/
│   ├── client/          # Vite + React + TypeScript
│   └── server/          # Rust + Axum + SeaORM
│       ├── src/
│       │   ├── entities/    # Auto-generated DB entities
│       │   └── main.rs
│       └── migration/       # SeaORM migrations
├── package.json         # Root scripts (concurrently)
└── pnpm-workspace.yaml
```

## Database Commands

| Command                | What it does                    |
| ---------------------- | ------------------------------- |
| `pnpm db:migrate`      | Run pending migrations          |
| `pnpm db:migrate:down` | Rollback last migration         |
| `pnpm db:generate`     | Regenerate entity files from DB |
