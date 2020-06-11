MapExporter.updateCheck = MapExporter.updateCheck or {
    file = MapExporter.dir .. "commits",
    url = "https://api.github.com/repos/Delwing/mudlet-map-reader/commits",
    storeKey = "MapExporter"
}

function MapExporter.updateCheck:checkNewVersion()
    downloadFile(self.file, self.url)
    registerAnonymousEventHandler("sysDownloadDone", function(_, file)
        self:handle(file)
    end, true)
    coroutine.yield(self.coroutine)
end

function MapExporter.updateCheck:handle(fileName)
    if fileName ~= self.file then
        return
    end

    local mapExporterState = scripts.state_store:get(self.storeKey) or {}

    local file, s, contents = io.open(self.file)
    if file then
        contents = yajl.to_value(file:read("*a"))
        io.close(file)
        os.remove(self.file)
        local sha = contents[1].sha
        if mapExporterState.sha ~= nil and sha ~= mapExporterState.sha then
            echo("\n")
            cecho("<CadetBlue>(skrypty)<tomato>: Plugin mudlet-map-reader posiad nowa aktualizacje. Kliknij ")
            cechoLink("<green>tutaj", [[MapExporter.updateCheck:update()]], "Aktualizuj", true)
            cecho(" <tomato>aby pobrac")
            echo("\n")
        end
        mapExporterState.sha = sha
        scripts.state_store:set(self.storeKey, mapExporterState)
    end
end

function MapExporter.updateCheck:update()
    scripts.plugins_installer:install_from_url("https://codeload.github.com/Delwing/mudlet-map-reader/zip/master")
end

MapExporter.updateCheck.coroutine = coroutine.create(function()
    MapExporter.updateCheck:checkNewVersion()
end)
coroutine.resume(MapExporter.updateCheck.coroutine)


