# @lumen/shared

Data model, SQLite schema and local-first sync logic shared by the Lumen desktop app, mobile app and sync server.

- `src/model.ts`: record types (space, block, collection, collection_view) and rich text
- `src/schema/client.ts`: Drizzle schema for every device (records + `ops` outbox + `field_clock`)
- `src/schema/server.ts`: Drizzle schema for the sync server (`server_ops` relay log)
- `src/hlc.ts`: hybrid logical clock
- `src/ops.ts`: ops and the convergent last-writer-wins merge (`applyOp`)
- `src/sync.ts`: push/pull wire format (zod)
- `drizzle/`: generated migrations; `client/0001_block_fts.sql` adds FTS5 search

Consumers link it (`"@lumen/shared": "link:../shared"`) and import TypeScript source directly. There is no build step.

```sh
pnpm install
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm db:generate # regenerate migrations after schema changes
```
