MapExporter = MapExporter or {
    areas = {},
    dir = getMudletHomeDir() .. "/plugins/mudlet-map-reader/"
}

function MapExporter:echoUrl()
    cecho("<blue>(<white>Map Explorer<blue>) ")
    echoLink(self.fileLocation, string.format([[openUrl("%s")]], MapExporter:getFileLocation()), "Otworz", false)
    echo(" \n")
end

function MapExporter:openUrl()
    openUrl("file:///" .. self:getFileLocation())
end

function MapExporter:export()
    self:exportRooms()
    self:exportColors()
    if getPlayerRoom() then
       self:exportPosition()
    end

    self:openUrl()
end

function MapExporter:getFileLocation()
    return self.dir .. "index.html"
end

function MapExporter:exportRooms()
    local areas = {}
		local combinedAreaViewRooms = {
				areaId = 99999999,
				areaName = "Combined Area View",
				rooms = {},
				labels = {},
		}
    for areaName, areaId in pairs(getAreaTable()) do

        local areaId = tonumber(areaId)
        local rooms = getAreaRooms(areaId)
        local labelIds = getMapLabels(areaId)

        local areaRooms = {
            areaId = areaId,
            areaName = getRoomAreaName(areaId),
            rooms = {},
            labels = {}
        }
				
        labels = {}
        if type(labelIds) == "table" then
            for k,v in pairs(labelIds) do
                local label = getMapLabel(areaId, k)
                label.id = k
                table.insert(labels, label)
								if MapExporterCombinedAreaView and
									 MapExporterCombinedAreaView[areaRooms.areaName] then
										table.insert(combinedAreaViewRooms.labels,label)
								end
            end
        end
				areaRooms.labels = labels

        local i = 0

        for k, v in pairs(rooms) do
            local x,y,z = getRoomCoordinates(v)
            local userDataKeys = getRoomUserDataKeys(v)
            local userData = {}
            for _,key in ipairs(userDataKeys) do
                userData[key] = getRoomUserData(v,key)
            end
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
                specialExits = getSpecialExitsSwap(v),
                stubs = getExitStubs1(v),
                userData = table.size(userData) > 0 and userData or nil
            }
            table.insert(areaRooms.rooms, roomInfo)
						if MapExporterCombinedAreaView and
							 MapExporterCombinedAreaView[areaRooms.areaName] then
								local shift = function(a,b) if a and type(a) == "number" and b and type(b) == "number" then return a+b else return a end end
								local combinedX = shift(roomInfo.x,MapExporterCombinedAreaView[areaRooms.areaName].xShift)
								local combinedY = shift(roomInfo.y,MapExporterCombinedAreaView[areaRooms.areaName].yShift)
								local combinedZ = shift(roomInfo.z,MapExporterCombinedAreaView[areaRooms.areaName].zShift)							 
								local combinedRoomInfo = {
										id = v,
										x = combinedX,
										y = combinedY,
										z = combinedZ,
										name = getRoomName(v),
										exits = getRoomExits(v),
										env = getRoomEnv(v),
										roomChar = getRoomChar(v),
										doors = getDoors(v),
										customLines = self:fixCustomLines(getCustomLines(v)),
										specialExits = getSpecialExitsSwap(v),
										stubs = getExitStubs1(v),
										userData = table.size(userData) > 0 and userData or nil
								}
								table.insert(combinedAreaViewRooms.rooms,combinedRoomInfo)
						end
        end

        if areaId > 0 then
            table.insert(areas, areaRooms)
        end

    end
		if MapExporterCombinedAreaView then
				table.insert(areas,combinedAreaViewRooms)
		end

    local fileName = self.dir .. "data/mapExport.js"
    file = io.open (fileName, "w+")
    file:write("mapData = ")
    file:write(yajl.to_string(areas))
    file:close()
end

function MapExporter:exportColors()
    local colors = {}
    local adjustedColors = {}
    for i=0,255 do
        if i ~= 16 then -- ansi 016 is ignored.
            local key = string.format("ansi_%03d",i)
            local envID
            if i == 0 or i == 8 then -- ansi 000 is set to envID 8, and ansi 008 is set to envID 16, due to envID starting at 1 and ansi colors at 0
                envID = i + 8
            else
                envID = i
            end
            colors[envID] = color_table[key]
        end
    end
    for k,v in pairs(getCustomEnvColorTable()) do
        colors[k] = v
    end
    for envID,color in pairs(colors) do
        table.insert(adjustedColors, {
            envId = envID,
            colors = color
        })
    end
    colors = adjustedColors

    local colorsFileName = self.dir .. "data/colors.js"
    colorsFile = io.open (colorsFileName, "w+")
    colorsFile:write("colors = ")
    colorsFile:write(yajl.to_string(colors))
    colorsFile:close()
end

function MapExporter:exportPosition()
    local position = {
        area = getRoomArea(getPlayerRoom()),
        room = getPlayerRoom()
    }
    local currentPosition = self.dir .. "/data/current.js"
    currentPosition = io.open (currentPosition, "w+")
    currentPosition:write("position = ")
    currentPosition:write(yajl.to_string(position))
    currentPosition:close()
end

function MapExporter:fixCustomLines(lineObj)
    for k,v in pairs(lineObj) do
        local tempPoints = {}
        for i,j in pairs(v.points) do
            table.insert(tempPoints, math.max(1, tonumber(i)), j)
        end

        v.points = tempPoints
    end
    return lineObj
end
