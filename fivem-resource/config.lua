Config = {}

Config.OpenCommand = 'harborledger'
Config.OpenKey = 'F7'
Config.AdminAce = 'harborledger.admin'
Config.StateFile = 'state.json'
Config.ShipTickSeconds = 15
Config.StartingTreasury = 1250000

Config.Ports = {
    { id = 'lsia', name = 'Los Santos International', shortName = 'LSIA', lat = 33.9416, lng = -118.4085 },
    { id = 'terminal', name = 'Terminal Island', shortName = 'TERM', lat = 33.7396, lng = -118.2620 },
    { id = 'paleto', name = 'Paleto Cove', shortName = 'PALETO', lat = 34.0181, lng = -118.4370 },
    { id = 'eastsandy', name = 'Sandy Shores East', shortName = 'SANDY', lat = 33.9475, lng = -118.2110 }
}

local cargoProfiles = {
    { label = 'Elektronikmodule', unit = 'Kisten', color = '#62d6c8', icon = 'EL', category = 'Technik', capacity = 220, reorder = 48, basePrice = 4800, volatility = 0.14 },
    { label = 'Treibstoff', unit = 'Fässer', color = '#70b6d6', icon = 'TR', category = 'Energie', capacity = 180, reorder = 72, basePrice = 2100, volatility = 0.18 },
    { label = 'Baustahl', unit = 'Paletten', color = '#aab7cf', icon = 'ST', category = 'Baustoffe', capacity = 160, reorder = 36, basePrice = 3200, volatility = 0.09 },
    { label = 'Frischware', unit = 'Kisten', color = '#e4b365', icon = 'FW', category = 'Versorgung', capacity = 240, reorder = 84, basePrice = 950, volatility = 0.22 },
    { label = 'Textilien', unit = 'Ballen', color = '#d49bd7', icon = 'TX', category = 'Handel', capacity = 140, reorder = 24, basePrice = 1750, volatility = 0.13 },
    { label = 'Maschinenteile', unit = 'Kisten', color = '#62d6c8', icon = 'MS', category = 'Industrie', capacity = 180, reorder = 42, basePrice = 5600, volatility = 0.11 },
    { label = 'Medizinbedarf', unit = 'Kisten', color = '#70b6d6', icon = 'MB', category = 'Gesundheit', capacity = 150, reorder = 30, basePrice = 3900, volatility = 0.08 },
    { label = 'Zement', unit = 'Säcke', color = '#aab7cf', icon = 'ZE', category = 'Baustoffe', capacity = 260, reorder = 60, basePrice = 680, volatility = 0.12 },
    { label = 'Kaffee', unit = 'Säcke', color = '#e4b365', icon = 'KA', category = 'Versorgung', capacity = 170, reorder = 45, basePrice = 1250, volatility = 0.19 },
    { label = 'Ersatzteile', unit = 'Kisten', color = '#d49bd7', icon = 'ER', category = 'Industrie', capacity = 130, reorder = 28, basePrice = 2900, volatility = 0.16 }
}

Config.Cargo = {}

for index = 1, 200 do
    local profile = cargoProfiles[((index - 1) % #cargoProfiles) + 1]
    local id = ('cargo-%03d'):format(index)
    table.insert(Config.Cargo, {
        id = id,
        label = ('%s %03d'):format(profile.label, index),
        unit = profile.unit,
        color = profile.color,
        icon = profile.icon,
        category = profile.category,
        capacity = profile.capacity + ((index - 1) % 5) * 20,
        reorder = profile.reorder + ((index - 1) % 4) * 6,
        basePrice = profile.basePrice + ((index - 1) % 5) * 120,
        volatility = profile.volatility
    })
end
