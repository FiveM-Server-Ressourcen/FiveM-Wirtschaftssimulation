local isOpen = false

local function setOpen(value)
    isOpen = value
    SetNuiFocus(value, value)
    SendNUIMessage({
        action = value and 'open' or 'close'
    })

    if value then
        TriggerServerEvent('harbor_ledger:server:requestState')
    end
end

RegisterCommand(Config.OpenCommand, function()
    setOpen(not isOpen)
end, false)

RegisterKeyMapping(Config.OpenCommand, 'Harbor Ledger öffnen', 'keyboard', Config.OpenKey)

RegisterNetEvent('harbor_ledger:client:stateUpdate', function(nextState)
    SendNUIMessage({
        action = 'stateUpdate',
        state = nextState
    })
end)

RegisterNetEvent('harbor_ledger:client:actionResult', function(success, message)
    SendNUIMessage({
        action = 'actionResult',
        success = success,
        message = message
    })
end)

RegisterNUICallback('close', function(_, cb)
    setOpen(false)
    cb({ ok = true })
end)

RegisterNUICallback('getState', function(_, cb)
    TriggerServerEvent('harbor_ledger:server:requestState')
    cb({ ok = true })
end)

RegisterNUICallback('addCargo', function(data, cb)
    TriggerServerEvent('harbor_ledger:server:addCargo', data.itemId, data.amount, data.note)
    cb({ ok = true })
end)

RegisterNUICallback('removeCargo', function(data, cb)
    TriggerServerEvent('harbor_ledger:server:removeCargo', data.itemId, data.amount, data.note)
    cb({ ok = true })
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName == GetCurrentResourceName() then
        SetNuiFocus(false, false)
    end
end)