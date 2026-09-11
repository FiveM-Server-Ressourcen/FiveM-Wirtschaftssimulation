fx_version 'cerulean'
game 'gta5'

author 'Harbor Ledger'
description 'Wirtschaftssimulation mit Staatskonto, Frachtschiffen und Hafenlager'
version '1.0.0'

lua54 'yes'

ui_page 'web/index.html'

files {
    'web/**/*'
}

shared_scripts {
    'config.lua'
}

server_scripts {
    'server/main.lua'
}

client_scripts {
    'client/main.lua'
}