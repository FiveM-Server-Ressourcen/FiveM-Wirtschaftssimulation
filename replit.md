# Harbor Ledger · FiveM Wirtschaftssimulation

Harbor Ledger ist eine FiveM-Resource für staatliche Finanzen, Frachtschiffe, Hafenrouten und ein serverseitig geschütztes Hafenlager.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/fivem-economic-control run dev` — run the Harbor-Ledger-Weboberfläche
- `pnpm --filter @workspace/fivem-economic-control run build` — build the NUI bundle
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `fivem-resource/` — installierbare FiveM-Resource mit `fxmanifest.lua`, Lua-Serverlogik, Client-NUI-Callbacks, Persistenz und Vue-Referenzkomponente
- `artifacts/fivem-economic-control/` — React/Vite-NUI mit Dashboard, Schiffsansicht, Karte und Lagerverwaltung
- `artifacts/fivem-economic-control/src/App.tsx` — UI und NUI-Bridge
- `fivem-resource/server/main.lua` — Staatskonto, Lager-Events/Exports, Persistenz und Schiffs-Simulation
- `fivem-resource/config.lua` — Häfen, Waren, ACE-Rechte und Tick-Intervalle

## Architecture decisions

- React ist die laufende FiveM-NUI; die Vue-Datei in `fivem-resource/web-vue/` ist eine getrennte, wiederverwendbare Lager-Ansicht statt eines schwer wartbaren Framework-Mix im selben Bundle.
- Der Server ist autoritativ: Lagerzugänge und -abgänge werden über ACE-Rechte, Whitelist-Waren, Mengen- und Kapazitätsgrenzen geprüft.
- Der Spielstand wird als JSON in der Resource gespeichert, damit der erste Betrieb ohne zusätzliche Datenbank auskommt und Zustände nach Neustarts erhalten bleiben.
- Die Weboberfläche nutzt im Browser Demo-Daten, wechselt in FiveM automatisch auf NUI-Callbacks und empfängt Updates über `SendNUIMessage`.

## Product

- `/harborledger` oder `F7` öffnet die Leitstelle.
- Übersicht mit Staatskonto, Trend, aktiven Frachtschiffen, Route-Karte und Manifesten.
- Flottenansicht mit Status, ETA und laufender Position.
- Hafenlager mit Bestands-, Kapazitäts- und Nachbestell-Anzeige sowie Ein-/Auslagerung.
- Server-Events `harbor_ledger:server:addCargo` / `removeCargo` und Exports `AddCargo` / `RemoveCargo` für andere Resources.

## User preferences

- Oberfläche und Dokumentation sind für einen deutschsprachigen FiveM-Server gedacht.

## Gotchas

- Nach einem UI-Build muss `artifacts/fivem-economic-control/dist/public/` nach `fivem-resource/web/` kopiert werden, bevor die Resource auf dem FiveM-Server aktualisiert wird.
- Für Lageränderungen in `server.cfg` `add_ace group.admin harborledger.admin allow` setzen.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
