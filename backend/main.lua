local millennium = require("millennium")
local logger = require("logger")
local fs = require("fs")
local KEY = "message_sound_v1"
local cached = nil
local DEFAULT = '{"enabled":false,"name":"","source":"","wav":"","volume":0.8}'

local function settings_path()
    local dir = fs.join(millennium.steam_path(), "millennium", "config", "sound-switcher")
    local ok, err = fs.create_directories(dir)
    assert(ok or fs.is_directory(dir), "Cannot create sound settings folder: " .. tostring(err))
    return fs.join(dir, "settings.json")
end

local function read_file(path)
    local file = io.open(path, "rb")
    if not file then return nil end
    local value = file:read("*a")
    file:close()
    return value
end

---@ffi
---@return string
function getSoundSettings()
    if cached ~= nil then return cached end
    local path = settings_path()
    local stored = read_file(path)
    if stored == nil and fs.exists(path) then error("Cannot read saved sound settings") end
    if stored ~= nil then
        assert(#stored <= 6000000 and stored:sub(1, 1) == "{" and stored:sub(-1) == "}", "Saved sound settings invalid")
        cached = stored
    else
        -- Backward-compatible fallback; do not overwrite an existing sound file.
        cached = millennium.config.get(KEY) or DEFAULT
    end
    return cached
end

---@ffi
---@param encoded string
---@return boolean
function saveSoundSettings(encoded)
    assert(type(encoded) == "string" and #encoded <= 6000000, "Sound settings too large")
    assert(encoded:sub(1, 1) == "{" and encoded:sub(-1) == "}", "Expected settings document")
    local path = settings_path()
    local temp = path .. ".pending"
    local file, open_error = io.open(temp, "wb")
    assert(file, "Cannot open sound settings for writing: " .. tostring(open_error))
    local wrote, write_error = file:write(encoded)
    local closed, close_error = file:close()
    assert(wrote and closed, "Sound settings write failed: " .. tostring(write_error or close_error))
    assert(read_file(temp) == encoded, "Temporary sound settings verification failed")
    -- Keep the last successful save for recovery if a later write fails.
    if fs.exists(path) then
        local backed_up, backup_error = fs.copy(path, path .. ".bak", false)
        assert(backed_up, "Cannot back up existing settings: " .. tostring(backup_error))
    end
    local copied, copy_error = fs.copy(temp, path, false)
    assert(copied, "Cannot save sound settings: " .. tostring(copy_error))
    assert(read_file(path) == encoded, "Saved settings verification failed")
    cached = encoded
    fs.remove(temp)
    -- Do not put audio into millennium.config: it has a 256 KB value limit.
    return true
end

return {
    on_load = function()
        logger:info("Sound Switcher 0.1.5 loaded; audio settings use a separate local file")
        millennium.ready()
    end,
    on_unload = function() end
}
