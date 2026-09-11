# Harbor Ledger · FiveM Resource

Harbor Ledger simuliert eine staatliche Hafenwirtschaft und stellt die Leitstelle als FiveM-NUI bereit.

## Installation

1. Den Ordner `fivem-resource` nach `resources/[local]/harbor-ledger` kopieren.
2. In `server.cfg` ergänzen:

```cfg
ensure harbor-ledger
add_ace group.admin harborledger.admin allow
```

3. Den gebauten Inhalt von `artifacts/fivem-economic-control/dist/public/` nach `fivem-resource/web/` kopieren. Für einen neuen Build:

```bash
pnpm --filter @workspace/fivem-economic-control run build
```

4. Im Spiel `/harborledger` oder `F7` nutzen.

## Server-Events und Exports

Lagerzugänge und -abgänge werden serverseitig validiert. Spieler benötigen `harborledger.admin`.

```lua
TriggerEvent('harbor_ledger:server:addCargo', 'electronics', 20, 'Lieferung')
TriggerEvent('harbor_ledger:server:removeCargo', 'fuel', 10, 'Tankstelle')

exports['harbor-ledger']:AddCargo('steel', 50, 'Import')
exports['harbor-ledger']:RemoveCargo('steel', 20, 'Baustelle')
local state = exports['harbor-ledger']:GetState()
```

Die Events sind für Client-Aufrufe geschützt. Andere Server-Resources sollten die Exports verwenden.

## NUI-Vertrag

Die Resource nutzt folgende NUI-Callbacks:

- `getState`
- `addCargo` mit `{ itemId, amount, note }`
- `removeCargo` mit `{ itemId, amount, note }`
- `close`

Serverdaten kommen über `harbor_ledger:client:stateUpdate`. Die JSON-Datei `state.json` wird automatisch im Resource-Ordner angelegt und enthält Staatskonto, Lager, Schiffe und Aktivitäten.