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

Config.Cargo = {
    { id = 'electronics', label = 'Elektronik', unit = 'Kisten', color = '#62d6c8', icon = 'EL' },
    { id = 'fuel', label = 'Treibstoff', unit = 'Fässer', color = '#f2b36a', icon = 'TR' },
    { id = 'steel', label = 'Stahl', unit = 'Paletten', color = '#aab7cf', icon = 'ST' },
    { id = 'food', label = 'Lebensmittel', unit = 'Kisten', color = '#a8d889', icon = 'LM' },
    { id = 'textiles', label = 'Textilien', unit = 'Ballen', color = '#d49bd7', icon = 'TX' }
}
