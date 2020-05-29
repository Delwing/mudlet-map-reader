MapExporter = MapExporter or {
    areas = {},
    dir = getMudletHomeDir() .. "/plugins/map-reader/"
}

function MapExporter:export()
    local areas = {}
    for areaName, areaId in pairs(getAreaTable()) do

        local areaId = tonumber(areaId)
        local rooms = getAreaRooms(areaId)
        local labelIds = getMapLabels(areaId)

        labels = {}
        if type(labelIds) == "table" then
            for k,v in pairs(labelIds) do
                local label = getMapLabel(areaId, k)
                label.id = k
                table.insert(labels, label)
            end
        end

        local i = 0
        local areaRooms = {
            areaId = areaId,
            areaName = getRoomAreaName(areaId),
            rooms = {},
            labels = labels
        }
        for k, v in pairs(rooms) do
            local x,y,z = getRoomCoordinates(v)
            local roomInfo = {
                id = v,
                x = x,
                y = y,
                z = z,
                name = getRoomName(v),
                exits = getRoomExits(v),
                env = getRoomEnv(v),
                roomChar = getRoomChar(v),
                doors = getDoors(v),
                customLines = self:fixCustomLines(getCustomLines(v)),
                specialExits = getSpecialExitsSwap(v)
            }
            table.insert(areaRooms.rooms, roomInfo)
        end

        if areaId > 0 then
            table.insert(areas, areaRooms)
        end

    end

    local fileName = self.dir .. "data/mapExport.js"
    file = io.open (fileName, "w+")
    file:write("mapData = ")
    file:write(yajl.to_string(areas))
    file:close()

    local colors = {}
    for k,v in pairs(getCustomEnvColorTable()) do
        local singleColor = {
            envId = k,
            colors = v
        }
        table.insert(colors, singleColor)
    end


    local colorsFileName = self.dir .. "data/colors.js"
    colorsFile = io.open (colorsFileName, "w+")
    colorsFile:write("colors = ")
    colorsFile:write(yajl.to_string(colors))
    colorsFile:close()

    local position = {
        area = getRoomArea(getPlayerRoom()),
        room = getPlayerRoom()
    }
    local currentPosition = self.dir .. "/data/current.js"
    currentPosition = io.open (currentPosition, "w+")
    currentPosition:write("position = ")
    currentPosition:write(yajl.to_string(position))
    currentPosition:close()

    openUrl("file:///" .. self.dir .. "index.html")
end

function MapExporter:fixCustomLines(lineObj)
    for k,v in pairs(lineObj) do
        local tempPoints = {}
        local index = 1
        for i,j in pairs(v.points) do
            table.insert(tempPoints, math.max(1, tonumber(i)), j)
        end

        v.points = tempPoints
    end
    return lineObj
end
