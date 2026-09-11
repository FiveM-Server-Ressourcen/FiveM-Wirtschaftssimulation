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
    return {
        electronics = { quantity = 1240, capacity = 2000, reserved = 380 },
        fuel = { quantity = 860, capacity = 1200, reserved = 140 },
        steel = { quantity = 640, capacity = 900, reserved = 220 },
        food = { quantity = 1830, capacity = 2500, reserved = 460 },
        textiles = { quantity = 420, capacity = 800, reserved = 80 }
    }
end

local function defaultShips()
    return {
        {
            id = 'atlas-meridian',
            name = 'Atlas Meridian',
            code = 'AM-204',
            status = 'underway',
            cargo = 'electronics',
            cargoLabel = 'Elektronik',
            from = 'terminal',
            to = 'lsia',
            progress = 0.62,
            etaMinutes = 18,
            lat = 33.8630,
            lng = -118.3340,
            manifest = { electronics = 620, steel = 80 }
        },
        {
            id = 'pacific-dawn',
            name = 'Pacific Dawn',
            code = 'PD-088',
            status = 'docked',
            cargo = 'fuel',
            cargoLabel = 'Treibstoff',
            from = 'paleto',
            to = 'terminal',
            progress = 1.0,
            etaMinutes = 0,
            lat = 33.7396,
            lng = -118.2620,
            manifest = { fuel = 420 }
        },
        {
            id = 'sierra-luce',
            name = 'Sierra Luce',
            code = 'SL-631',
            status = 'underway',
            cargo = 'food',
            cargoLabel = 'Lebensmittel',
            from = 'eastsandy',
            to = 'paleto',
            progress = 0.28,
            etaMinutes = 41,
            lat = 33.9673,
            lng = -118.2740,
            manifest = { food = 940, textiles = 130 }
        },
        {
            id = 'northstar-9',
            name = 'Northstar 9',
            code = 'NS-419',
            status = 'anchored',
            cargo = 'steel',
            cargoLabel = 'Stahl',
            from = 'lsia',
            to = 'eastsandy',
            progress = 0.86,
            etaMinutes = 9,
            lat = 33.9250,
            lng = -118.2520,
            manifest = { steel = 560 }
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

state = loadState()
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