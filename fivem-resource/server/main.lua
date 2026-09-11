local RESOURCE = GetCurrentResourceName()
local state = nil

local function now()
    return os.time()
end

local function round(value, decimals)
    local multiplier = 10 ^ (decimals or 0)
    return math.floor(value * multiplier + 0.5) / multiplier
end

local function defaultInventory()
    local inventory = {}
    for index, cargo in ipairs(Config.Cargo) do
        local quantity = 22 + ((index * 17) % math.max(30, cargo.capacity - 20))
        inventory[cargo.id] = {
            quantity = math.min(quantity, cargo.capacity),
            capacity = cargo.capacity,
            reserved = math.floor(quantity * 0.14)
        }
    end
    return inventory
end

local function defaultEconomy()
    local prices = {}
    local demand = {}
    for index, cargo in ipairs(Config.Cargo) do
        prices[cargo.id] = cargo.basePrice
        demand[cargo.id] = math.min(95, 42 + ((index * 13) % 48))
    end

    return {
        marketIndex = 104.8,
        tradeVolumeToday = 1840000,
        importsToday = 1290000,
        exportsToday = 550000,
        taxRevenueToday = 18400,
        prices = prices,
        demand = demand,
        trend = { 96.0, 98.0, 97.0, 100.0, 101.0, 103.0, 104.8 },
        updatedAt = now()
    }
end

local function defaultShips()
    return {
        {
            id = 'atlas-meridian',
            name = 'Atlas Meridian',
            code = 'AM-204',
            status = 'underway',
            cargo = 'cargo-001',
            cargoLabel = 'Elektronikmodule 001',
            from = 'terminal',
            to = 'lsia',
            progress = 0.62,
            etaMinutes = 18,
            lat = 33.8630,
            lng = -118.3340,
            manifest = { ['cargo-001'] = 620, ['cargo-003'] = 80 }
        },
        {
            id = 'pacific-dawn',
            name = 'Pacific Dawn',
            code = 'PD-088',
            status = 'docked',
            cargo = 'cargo-002',
            cargoLabel = 'Treibstoff 002',
            from = 'paleto',
            to = 'terminal',
            progress = 1.0,
            etaMinutes = 0,
            lat = 33.7396,
            lng = -118.2620,
            manifest = { ['cargo-002'] = 420 }
        },
        {
            id = 'sierra-luce',
            name = 'Sierra Luce',
            code = 'SL-631',
            status = 'underway',
            cargo = 'cargo-004',
            cargoLabel = 'Frischware 004',
            from = 'eastsandy',
            to = 'paleto',
            progress = 0.28,
            etaMinutes = 41,
            lat = 33.9673,
            lng = -118.2740,
            manifest = { ['cargo-004'] = 940, ['cargo-005'] = 130 }
        },
        {
            id = 'northstar-9',
            name = 'Northstar 9',
            code = 'NS-419',
            status = 'anchored',
            cargo = 'cargo-003',
            cargoLabel = 'Baustahl 003',
            from = 'lsia',
            to = 'eastsandy',
            progress = 0.86,
            etaMinutes = 9,
            lat = 33.9250,
            lng = -118.2520,
            manifest = { ['cargo-003'] = 560 }
        }
    }
end

local function defaultState()
    return {
        version = 1,
        treasury = {
            balance = Config.StartingTreasury,
            changeToday = 18400,
            incomeToday = 56200,
            expenseToday = 37800,
            trend = { 1080000, 1110000, 1090000, 1160000, 1190000, 1170000, 1250000 }
        },
        inventory = defaultInventory(),
        economy = defaultEconomy(),
        ships = defaultShips(),
        activity = {
            { id = 'boot-1', type = 'system', title = 'Harbor Ledger gestartet', detail = 'Wirtschaftssimulation ist aktiv', timestamp = now() },
            { id = 'boot-2', type = 'cargo', title = 'Pacific Dawn entladen', detail = '420 Fässer Treibstoff im Terminal', timestamp = now() - 820 },
            { id = 'boot-3', type = 'treasury', title = 'Hafengebühr verbucht', detail = '+$18.400 Staatskonto', timestamp = now() - 1480 },
            { id = 'boot-4', type = 'ship', title = 'Atlas Meridian ausgelaufen', detail = 'Route Terminal → LSIA', timestamp = now() - 2300 }
        },
        updatedAt = now()
    }
end

local function saveState()
    state.updatedAt = now()
    SaveResourceFile(RESOURCE, Config.StateFile, json.encode(state), -1)
end

local function loadState()
    local raw = LoadResourceFile(RESOURCE, Config.StateFile)
    if raw and raw ~= '' then
        local ok, decoded = pcall(json.decode, raw)
        if ok and decoded then
            return decoded
        end
    end

    local initial = defaultState()
    SaveResourceFile(RESOURCE, Config.StateFile, json.encode(initial), -1)
    return initial
end

local function migrateState(loaded)
    loaded.treasury = loaded.treasury or defaultState().treasury
    loaded.activity = loaded.activity or {}
    loaded.ships = loaded.ships or defaultShips()
    loaded.economy = loaded.economy or defaultEconomy()
    loaded.economy.prices = loaded.economy.prices or {}
    loaded.economy.demand = loaded.economy.demand or {}
    loaded.economy.trend = loaded.economy.trend or { 96.0, 98.0, 97.0, 100.0, 101.0, 103.0, loaded.economy.marketIndex or 104.8 }

    local legacyIds = { 'electronics', 'fuel', 'steel', 'food', 'textiles' }
    local existing = loaded.inventory or {}
    local inventory = {}

    for index, cargo in ipairs(Config.Cargo) do
        local old = existing[cargo.id]
        if not old and index <= #legacyIds then
            old = existing[legacyIds[index]]
        end

        local fallbackQuantity = 22 + ((index * 17) % math.max(30, cargo.capacity - 20))
        inventory[cargo.id] = {
            quantity = math.max(0, math.min(cargo.capacity, tonumber(old and old.quantity) or fallbackQuantity)),
            capacity = cargo.capacity,
            reserved = math.max(0, math.min(tonumber(old and old.reserved) or math.floor(fallbackQuantity * 0.14), cargo.capacity))
        }
        loaded.economy.prices[cargo.id] = tonumber(loaded.economy.prices[cargo.id]) or cargo.basePrice
        loaded.economy.demand[cargo.id] = tonumber(loaded.economy.demand[cargo.id]) or math.min(95, 42 + ((index * 13) % 48))
    end

    loaded.inventory = inventory
    loaded.version = 2
    return loaded
end

local function getCargoDefinition(itemId)
    for _, item in ipairs(Config.Cargo) do
        if item.id == itemId then
            return item
        end
    end
    return nil
end

local function canManageCargo(source)
    return source == 0 or IsPlayerAceAllowed(source, Config.AdminAce)
end

local function clamp(value, minimum, maximum)
    return math.max(minimum, math.min(maximum, value))
end

local function pushActivity(kind, title, detail)
    table.insert(state.activity, 1, {
        id = ('activity-%s-%s'):format(now(), math.random(100, 999)),
        type = kind,
        title = title,
        detail = detail,
        timestamp = now()
    })

    while #state.activity > 12 do
        table.remove(state.activity)
    end
end

local function broadcast()
    TriggerClientEvent('harbor_ledger:client:stateUpdate', -1, state)
end

local function sendState(source)
    if source == 0 then
        return
    end
    TriggerClientEvent('harbor_ledger:client:stateUpdate', source, state)
end

local function addCargo(source, itemId, amount, note)
    if not canManageCargo(source) then
        if source > 0 then
            TriggerClientEvent('harbor_ledger:client:actionResult', source, false, 'Keine Berechtigung für das Hafenlager.')
        end
        return false
    end

    local cargo = getCargoDefinition(itemId)
    local numericAmount = math.floor(tonumber(amount) or 0)
    if not cargo or numericAmount < 1 or numericAmount > 10000 then
        return false
    end

    local stock = state.inventory[itemId]
    if not stock or stock.quantity + numericAmount > stock.capacity then
        if source > 0 then
            TriggerClientEvent('harbor_ledger:client:actionResult', source, false, 'Die Lagerkapazität reicht dafür nicht aus.')
        end
        return false
    end

    stock.quantity = stock.quantity + numericAmount
    pushActivity('cargo', 'Lagerzugang verbucht', ('%s %s hinzugefügt%s'):format(numericAmount, cargo.label, note and (' · ' .. note) or ''))
    saveState()
    broadcast()
    if source > 0 then
        TriggerClientEvent('harbor_ledger:client:actionResult', source, true, ('%s %s hinzugefügt.'):format(numericAmount, cargo.label))
    end
    return true
end

local function removeCargo(source, itemId, amount, note)
    if not canManageCargo(source) then
        if source > 0 then
            TriggerClientEvent('harbor_ledger:client:actionResult', source, false, 'Keine Berechtigung für das Hafenlager.')
        end
        return false
    end

    local cargo = getCargoDefinition(itemId)
    local numericAmount = math.floor(tonumber(amount) or 0)
    if not cargo or numericAmount < 1 or numericAmount > 10000 then
        return false
    end

    local stock = state.inventory[itemId]
    local available = stock and (stock.quantity - (stock.reserved or 0)) or 0
    if not stock or numericAmount > available then
        if source > 0 then
            TriggerClientEvent('harbor_ledger:client:actionResult', source, false, 'So viel freie Ware ist nicht im Lager verfügbar.')
        end
        return false
    end

    stock.quantity = stock.quantity - numericAmount
    pushActivity('cargo', 'Lagerausgang verbucht', ('%s %s entfernt%s'):format(numericAmount, cargo.label, note and (' · ' .. note) or ''))
    saveState()
    broadcast()
    if source > 0 then
        TriggerClientEvent('harbor_ledger:client:actionResult', source, true, ('%s %s entfernt.'):format(numericAmount, cargo.label))
    end
    return true
end

local function updateShips()
    for _, ship in ipairs(state.ships) do
        if ship.status == 'underway' then
            ship.progress = math.min(1.0, (ship.progress or 0) + 0.04)
            ship.etaMinutes = math.max(0, math.floor((1.0 - ship.progress) * 52))

            local origin
            local destination
            for _, port in ipairs(Config.Ports) do
                if port.id == ship.from then origin = port end
                if port.id == ship.to then destination = port end
            end

            if origin and destination then
                ship.lat = round(origin.lat + (destination.lat - origin.lat) * ship.progress, 4)
                ship.lng = round(origin.lng + (destination.lng - origin.lng) * ship.progress, 4)
            end

            if ship.progress >= 1.0 then
                ship.status = 'docked'
                ship.etaMinutes = 0
                ship.lat = destination and destination.lat or ship.lat
                ship.lng = destination and destination.lng or ship.lng
                pushActivity('ship', ('%s hat angelegt'):format(ship.name), ('Fracht ist in %s verfügbar'):format(destination and destination.name or ship.to))
            end
        elseif ship.status == 'docked' then
            ship.status = 'underway'
            ship.progress = 0.04
            local previousDestination = ship.to
            ship.from = previousDestination
            local nextIndex = math.random(1, #Config.Ports)
            local nextPort = Config.Ports[nextIndex]
            while nextPort.id == ship.from do
                nextIndex = math.random(1, #Config.Ports)
                nextPort = Config.Ports[nextIndex]
            end
            ship.to = nextPort.id
            ship.etaMinutes = 50
        end
    end

    saveState()
    broadcast()
end

state = migrateState(loadState())
saveState()
math.randomseed(now())

RegisterNetEvent('harbor_ledger:server:requestState', function()
    sendState(source)
end)

RegisterNetEvent('harbor_ledger:server:addCargo', function(itemId, amount, note)
    addCargo(source, itemId, amount, note)
end)

RegisterNetEvent('harbor_ledger:server:removeCargo', function(itemId, amount, note)
    removeCargo(source, itemId, amount, note)
end)

exports('AddCargo', function(itemId, amount, note)
    return addCargo(0, itemId, amount, note)
end)

exports('RemoveCargo', function(itemId, amount, note)
    return removeCargo(0, itemId, amount, note)
end)

exports('GetState', function()
    return state
end)

CreateThread(function()
    while true do
        Wait(Config.ShipTickSeconds * 1000)
        updateShips()
    end
end)

print(('[Harbor Ledger] %s geladen · %s'):format(RESOURCE, Config.AdminAce))