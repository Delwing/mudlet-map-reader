if(!translateString) {
    function translateString(input) {
        return input
    }
}

let envColors = {};
colors.forEach(function (element) {
    envColors[element.envId] = element.colors;
});
envColors.default = 'white';

let params = new URLSearchParams(location.search);

/* global mapData */
mapData.sort(function (areaElement1, areaElement2) {
    if (areaElement1.areaName < areaElement2.areaName) {
        return -1
    }
    if (areaElement1.areaName > areaElement2.areaName) {
        return 1
    }
    return 0;
});

let mapDataIndex = {};
let roomIndex = {};
mapData.forEach(function (value, index) {
    mapDataIndex[value.areaId] = index;
    value.rooms.forEach(room => {
        room.areaId = value.areaId;
        roomIndex[room.id] = room;
    });
});

rooms = [];

class MapRenderer {
    constructor(controls, canvas, area, scale) {
        this.controls = controls;
        this.baseSize = parseInt(this.controls.getSettings().baseSize);
        this.ladders = ["up", "down"];
        this.canvas = canvas;
        this.area = area;
        this.scale = scale;
        this.backgroundLayer = new Layer();
        this.linkLayer = new Layer();
        this.roomLayer = new Layer();
        this.labelsLayer = new Layer();
        this.specialLinkLayer = new Layer();
        this.charsLayer = new Layer();
        this.roomSelected = undefined;
        this.isDrag = false;
    }

    render() {
        this.hideRoomInfo();

        let textOffset = 50;

        let text = new PointText(new Point(0, 0));
        text.fillColor = envColors.default;
        text.fontSize = 60;
        text.content = this.area.areaName;
        if (this.area.getZIndex() !== 0) {
            text.content += " (" + this.area.getZIndex() + ")"
        }
        text.justification = 'left';
        text.locked = true;
        text.scale(1, -1);

        if (!this.controls.getSettings().areaName) {
            text.content = "";
        }

        this.setDrawingBounds(text, textOffset);
        this.drawBackground(textOffset);
        this.setViewZoom(textOffset);

        let targetPoint = new Point(this.drawingBounds.minX + this.baseSize * 2 - textOffset, this.drawingBounds.maxY - this.baseSize * 2 + textOffset);
        text.setPoint(targetPoint);

        this.area.rooms.forEach(value => this.renderRoom(new Room(value, this.baseSize, this.controls.getSettings().roomSize)), this);
        if (this.area.labels !== undefined && this.controls.getSettings().showLabels) {
            this.area.labels.forEach(value => this.renderLabel(value), this);
        }

        if (this.controls.getExtras().highlights !== undefined) {
            this.controls.getExtras().highlights.forEach(value => this.renderHighlight(value));
        }

        project.layers.forEach(function (layer) {
            layer.transform(new Matrix(1, 0, 0, -1, textOffset, textOffset));
        });
    }

    setDrawingBounds(text, textOffset) {
        let bounds = this.area.getAreaBounds();
        let additionalPadding = this.baseSize * 2;

        this.drawingBounds = {
            minX: this.calculateCoordinates(bounds.minX) - this.baseSize - additionalPadding,
            minY: this.calculateCoordinates(bounds.minY) - this.baseSize - additionalPadding - textOffset,
            maxX: Math.max(this.calculateCoordinates(bounds.maxX) + this.baseSize + additionalPadding),
            maxY: Math.max(this.calculateCoordinates(bounds.maxY) + this.baseSize + additionalPadding)
        };

        this.drawingBounds.width = Math.max(Math.abs(this.drawingBounds.maxX - this.drawingBounds.minX), text.bounds.width);
        this.drawingBounds.height = Math.max(Math.abs(this.drawingBounds.maxY - this.drawingBounds.minY), text.bounds.height);
        this.drawingBounds.xMid = (this.drawingBounds.minX + this.drawingBounds.maxX) / 2;
        this.drawingBounds.yMid = (this.drawingBounds.minY + this.drawingBounds.maxY) / 2;
    }

    drawBackground(offset) {
        this.backgroundLayer.activate();
        let background = new Path.Rectangle(this.drawingBounds.minX - offset, this.drawingBounds.minY + offset, this.drawingBounds.width + offset, this.drawingBounds.height + offset);
        background.fillColor = 'black';
        let that = this;
        background.onClick = function () {
            if (!that.isDrag) {
                that.clearSelection();
            }
        };
    }

    setViewZoom(offset) {
        view.center = new Point(this.drawingBounds.xMid + offset / 2, -this.drawingBounds.yMid);
        view.scale(Math.min((view.size.height - offset * 2) / this.drawingBounds.height, (view.size.width - offset * 2) / this.drawingBounds.width));
        view.minZoom = view.zoom
    }

    getBounds() {
        return this.drawingBounds;
    }

    renderRoom(room) {
        this.roomLayer.activate();
        let strokeWidth = 1;
        let size = this.baseSize;
        let roomShape;
        if (!this.controls.getSettings().round) {
            roomShape = new Path.Rectangle(room.getX(), room.getY(), size, size);
        } else {
            roomShape = new Path.Circle(room.getX() + size / 2, room.getY() + size / 2, size / 2);
        }
        let color = envColors[room.env];
        if (color === undefined) {
            color = [114, 1, 0];
        }

        let strokeColor, frameColor;
        if (this.controls.getSettings().frameMode) {
            frameColor = [...color];
            color = [0, 0, 0];
        }
        roomShape.fillColor = new Color(color[0] / 255, color[1] / 255, color[2] / 255);
        if (roomShape.fillColor.lightness > 0.1) {
            strokeColor = new Color(color[0] / 255, color[1] / 255, color[2] / 255)
        } else {
            strokeColor = new Color(0.3, 0.3, 0.3)
        }
        roomShape.strokeColor = strokeColor;
        roomShape.strokeWidth = strokeWidth;

        if (this.controls.getSettings().borders) {
            roomShape.strokeColor = new Color(0.8, 0.8, 0.8);
        }

        if (this.controls.getSettings().frameMode) {
            roomShape.strokeColor = frameColor
        }

        room.render = roomShape;
        room.render.orgStrokeColor = room.render.strokeColor;
        room.render.orgFillColor = room.render.fillColor;
        this.pointerReactor(room.render);

        room.exitRenders = [];
        for (let dir in room.exits) {
            if (this.ladders.indexOf(dir) <= -1) {
                if (room.exits.hasOwnProperty(dir) && !room.customLines.hasOwnProperty(dirLongToShort(dir))) {
                    let secondRoom = new Room(this.area.getRoomById(room.exits[dir]), this.baseSize, this.controls.getSettings().roomSize)
                    if (roomIndex[room.exits[dir]].exitRenders && roomIndex[room.exits[dir]].exitRenders.some(function (item) {
                        return item.roomId === room.id;
                    })) {
                        if(secondRoom.exists()) {
                            continue;
                        }
                    }
                    room.exitRenders.push({
                        roomId: room.exits[dir],
                        render: this.renderLink(room, dir, secondRoom, room.exits[dir])
                    });
                }
            } else {
                room.exitRenders.push({roomId: room.exits[dir], render: this.renderLadder(room, dir)});
            }
        }

        for (let dir in room.specialExits) {
            if (room.specialExits.hasOwnProperty(dir) && !room.customLines.hasOwnProperty(dir)) {
                room.exitRenders.push({
                    roomId: room.specialExits[dir],
                    render: this.renderSpecialLink(room, dir, new Room(this.area.getRoomById(room.specialExits[dir]), this.baseSize, this.controls.getSettings().roomSize))
                });
            }
        }

        room.stubRenders = [];
        for (let dir in room.stubs) {
            if (room.stubs.hasOwnProperty(dir)) {
                room.stubRenders.push(this.renderStub(room, dirNumbers[room.stubs[dir]], this.baseSize))
            }
        }

        for (let dir in room.customLines) {
            room.exitRenders.push({render: this.renderCustomLine(room, dir)});
        }

        if (room.roomChar !== undefined) {
            this.renderChar(room);
        }

        roomIndex[room.id] = room;

        let that = this;
        if (!this.controls.getSettings().disableClicks) {
            room.render.onClick = function () {
                if (!that.isDrag) {
                    that.onRoomClick(room);
                }
            };
        }
    }

    onRoomClick(room) {
        this.clearSelection();
        let mainSelectionColor = new Color(180 / 255, 93 / 255, 60 / 255, 0.9);
        let gradient = new Gradient([[room.render.fillColor, 0.38], new Color(1, 1, 1)], false);
        room.render.fillColor = new Color(gradient, room.render.bounds.topCenter, room.render.bounds.bottomCenter);
        room.render.strokeColor = mainSelectionColor;
        this.roomSelected = room;

        room.exitRenders.forEach(exit => {
            let path = exit.render;
            if (path !== undefined) {
                path.bringToFront();
                path.orgStrokeColor = path.strokeColor;
                path.strokeColor = mainSelectionColor;
            }
        });

        for (let dir in room.exits) {
            if (room.exits.hasOwnProperty(dir) && !room.customLines.hasOwnProperty(dirLongToShort(dir))) {
                let neighbourRoom = roomIndex[room.exits[dir]];
                if (neighbourRoom && neighbourRoom.render && neighbourRoom.roomId !== room.id) {
                    //neighbourRoom.render.strokeColor = supportSelectionColor;
                    neighbourRoom.exitRenders.forEach(exit => {
                        if (room.id === exit.roomId) {
                            let path = exit.render;
                            if (path !== undefined) {
                                path.orgStrokeColor = path.strokeColor
                                path.strokeColor = mainSelectionColor;
                            }
                        }
                    });
                }
            }
        }

        if (this.controls.getSettings().dotSelectionMarker) {
            room.circle = new Path.Circle(room.render.position, this.baseSize / 2);
            room.circle.fillColor = this.controls.getSettings().dotSelectionMarker;
            room.circle.strokeColor = 'white';
        }

        this.showRoomInfo(room)
    }

    clearSelection() {
        if (this.roomSelected !== undefined) {
            this.roomSelected.render.strokeColor = this.roomSelected.render.orgStrokeColor;
            this.roomSelected.render.fillColor = this.roomSelected.render.orgFillColor;
            let room = this.roomSelected;
            room.exitRenders.forEach(exit => {
                let path = exit.render;
                if (path !== undefined) {
                    path.strokeColor = path.orgStrokeColor;
                }
            });

            for (let dir in room.exits) {
                if (room.exits.hasOwnProperty(dir) && !room.customLines.hasOwnProperty(dirLongToShort(dir))) {
                    let neighbourRoom = roomIndex[room.exits[dir]];
                    if (neighbourRoom && neighbourRoom.render && neighbourRoom.roomId !== room.id) {
                        //neighbourRoom.render.strokeColor = supportSelectionColor;
                        neighbourRoom.exitRenders.forEach(exit => {
                            if (room.id === exit.roomId) {
                                let path = exit.render;
                                if (path !== undefined) {
                                    path.strokeColor = path.orgStrokeColor;
                                }
                            }
                        });
                    }
                }
            }

        }
        this.hideRoomInfo()
    }

    renderLink(room1, dir1, room2, exit) {
        let round = this.controls.getSettings().round;
        this.linkLayer.activate();
        if (room1 !== undefined && !room1.specialExits.hasOwnProperty(dir1)) {
            let path;

            let exitPoint = new Point(room1.getExitX(dir1, round), room1.getExitY(dir1, round));
            let secondPoint;

            if (room2.exists()) {
                let connectedDir = getKeyByValue(room2.exits, room1.id);
                let isOneWay = connectedDir === undefined;
                secondPoint = new Point(room2.getExitX(connectedDir, round), room2.getExitY(connectedDir, round));
                if (!isOneWay) {
                    path = new Path();
                    path.moveTo(exitPoint);
                    path.lineTo(secondPoint);
                } else {
                    path = this.drawArrow(exitPoint, secondPoint, envColors.default, this.baseSize / 2, [], 2, envColors.default, true);
                }
                path.strokeColor = envColors.default;
            } else {
                secondPoint = new Point(room1.getXMid(), room1.getYMid());
                let roomProperties = roomIndex[exit];
                let color = envColors[roomProperties.env];
                if (color === undefined) {
                    color = [114, 1, 0];
                }
                path = this.drawArrow(exitPoint, secondPoint, new Color(color[0] / 255, color[1] / 255, color[2] / 255), this.baseSize / 4, [], 1);
                path.scale(3, exitPoint);
                path.rotate(180, exitPoint);
                let that = this;
                if (!this.controls.getSettings().disableClicks) {
                    path.onClick = function () {
                        that.onExitClick(roomProperties)
                    };
                }
                this.pointerReactor(path);
            }

            if (room1.doors[dirLongToShort(dir1)] !== undefined) {
                this.renderDoors(exitPoint, secondPoint)
            }

            path.strokeWidth = 1;
            path.orgStrokeColor = path.strokeColor;

            return path;
        }

    }

    renderStub(room, dir) {
        this.linkLayer.activate();
        let startPoint = new Point(room.getXMid(dir), room.getYMid(dir));
        let exitPoint = new Point(room.getExitX(dir), room.getExitY(dir));
        let path = new Path();
        path.moveTo(startPoint);
        path.lineTo(exitPoint);
        path.pivot = startPoint;
        path.position = exitPoint;
        path.strokeColor = envColors.default;
        return path
    }

    onExitClick(room) {
        this.controls.draw(room.areaId, room.z)
    }

    pointerReactor(path) {
        let that = this;
        path.onMouseEnter = function (event) {
            that.canvas.style.cursor = "pointer";
        };
        path.onMouseLeave = function (event) {
            that.canvas.style.cursor = "default";
        };
    }

    renderSpecialLink(room1, dir1, room2) {
        this.linkLayer.activate();
        if (room1 !== undefined && !room1.specialExits.hasOwnProperty(dir1)) {

            let path;
            let exitPoint = new Point(room1.getXMid(), room1.getYMid());
            let secondPoint;

            if (room2.exists()) {
                path = new Path();
                path.moveTo(exitPoint);
                let connectedDir = getKeyByValue(room2.exits, room1.id);
                secondPoint = new Point(room2.getExitX(connectedDir), room2.getExitY(connectedDir));
                path.lineTo(secondPoint);

                path.strokeWidth = 1;
            } else {
                secondPoint = new Point(room1.getXMid(), room1.getYMid());
                path = this.drawArrow(exitPoint, secondPoint, envColors.default, this.baseSize / 4, [], 1);
                path.strokeColor = envColors.default;
                path.scale(1, exitPoint);
                path.rotate(180, exitPoint);
            }

            if (room1.doors[dirLongToShort(dir1)] !== undefined) {
                this.renderDoors(exitPoint, secondPoint)
            }

            path.orgStrokeColor = path.strokeColor;

            return path;
        }
    }

    drawArrow(exitPoint, secondPoint, color, sizeFactor, dashArray, strokeWidth, strokeColor, isOneWay) {
        let headLength = sizeFactor;
        let headAngle = isOneWay ? 160 : 150;

        let lineStart = exitPoint;
        let lineEnd = secondPoint;

        let tailLine = new Path.Line(lineStart, lineEnd);
        let tailVector = new Point(lineEnd.x - lineStart.x, lineEnd.y - lineStart.y);
        let headLine = tailVector.normalize(headLength);

        let arrow = new Path([
            new Point(lineEnd.x + headLine.rotate(headAngle).x, lineEnd.y + headLine.rotate(headAngle).y),
            lineEnd,
            new Point(lineEnd.x + headLine.rotate(-headAngle).x, lineEnd.y + headLine.rotate(-headAngle).y),
            new Point(lineEnd.x + headLine.rotate(headAngle).x, lineEnd.y + headLine.rotate(headAngle).y),
            lineEnd,
        ]);

        let path = new Group([
            tailLine,
            arrow
        ]);
        path.closed = true;
        arrow.fillColor = color;
        arrow.strokeColor = color;
        tailLine.fillColor = strokeColor ? strokeColor : color;
        tailLine.strokeColor = strokeColor ? strokeColor : color;
        tailLine.dashArray = dashArray;

        if (isOneWay) {
            arrow.position = new Point(lineStart.x + ((lineEnd.x - lineStart.x) / 2.8), lineStart.y + ((lineEnd.y - lineStart.y) / 2.8));
            tailLine.dashArray = [1, 1];
            arrow.fillColor = 'red'
        } else {
            tailLine.strokeWidth = strokeWidth;
        }

        return path;
    }

    renderCustomLine(room, dir) {
        if (room.customLines[dir].points !== undefined && room.customLines[dir].points.length === 0) {
            return
        }

        this.linkLayer.activate();

        let customLine = new Group();

        let roomConnected;
        if (room.exits.hasOwnProperty(dirsShortToLong(dir))) {
            roomConnected = new Room(this.area.getRoomById(room.exits[dirsShortToLong(dir)]), this.baseSize, this.controls.getSettings().roomSize);
        }
        if (room.specialExits.hasOwnProperty(dir)) {
            roomConnected = new Room(this.area.getRoomById(room.specialExits[dir]), this.baseSize, this.controls.getSettings().roomSize);
        }

        let path = new Path();
        let style = room.customLines[dir].attributes.style;
        if (style === "dot line") {
            path.dashArray = [1, 1];
        } else if (style === "dash line") {
            path.dashArray = [4, 2];
        } else if (style === "solid line") {

        } else {
            console.log("Brak opisu stylu: " + style);
        }


        if (room.customLines[dir].attributes.color !== undefined) {
            let color = room.customLines[dir].attributes.color;
            path.strokeColor = new Color(color.r / 255, color.g / 255, color.b / 255);
        } else {
            path.strokeColor = envColors.default;
        }
        let lastPoint = new Point(room.getXMid(), room.getYMid());
        path.moveTo(lastPoint);


        if (room.customLines[dir].points !== undefined) {
            let points = [];

            room.customLines[dir].points.forEach(value => points.push(value));

            for (let point in points) {
                let customPoint = points[point];
                let pointCoords = new Point(this.calculateCoordinates(customPoint.x), this.calculateCoordinates(customPoint.y));

                lastPoint = new Point(pointCoords);
                path.lineTo(lastPoint);
            }
        }

        customLine.addChild(path);

        if (room.customLines[dir].attributes.arrow && path.segments.length > 1) {
            let arrow = this.drawArrow(path.segments[path.segments.length - 2].point, path.segments[path.segments.length - 1].point, path.strokeColor, this.baseSize / 2, path.strokeColor, path.dashArray);
            customLine.addChild(arrow);
        }

        path.orgStrokeColor = path.strokeColor;

        return path;

    }

    renderLadder(room, direction) {
        this.labelsLayer.activate();
        let myPath = new Path();

        let sizeOffset = this.baseSize * 0.85;
        let oppositeOffset = this.baseSize - sizeOffset;
        let height = 0.35;

        myPath.add(new Point(room.getXMid(), room.getY() + sizeOffset - sizeOffset * height));
        myPath.add(new Point(oppositeOffset + room.getX(), room.getY() + sizeOffset));
        myPath.add(new Point(room.getX() + sizeOffset, room.getY() + sizeOffset));

        let baseColor = this.lightnessDependantColor(room);

        myPath.fillColor = new Color(baseColor, baseColor, baseColor, 0.75);
        myPath.strokeColor = new Color(baseColor, baseColor, baseColor);

        myPath.locked = true;

        myPath.bringToFront();

        if (direction === "up") {
            myPath.rotate(180, new Point(room.getXMid(), room.getYMid()));
        }

        myPath.closed = true;

        return myPath;
    }

    lightnessDependantColor(room) {
        if (room.render.fillColor.lightness > 0.41) {
            return 0.10;
        } else {
            return 0.90;
        }
    }

    renderDoors(firstPoint, secondPoint) {
        this.specialLinkLayer.activate();
        let x = (firstPoint.x + secondPoint.x) / 2;
        let y = (firstPoint.y + secondPoint.y) / 2;
        let door = new Path.Rectangle(x - this.baseSize / 6, y - this.baseSize / 6, this.baseSize / 3, this.baseSize / 3);
        door.scale(0.85, door.center);
        door.strokeColor = 'rgb(226,205,59)';
        door.strokeWidth = 1;
    }

    renderChar(room) {
        this.charsLayer.activate();
        let size = this.baseSize * (0.8 / room.roomChar.length);
        let text = new PointText(new Point(room.getXMid(), room.getYMid() + size / 2.7));
        text.fillColor = this.lightnessDependantColor(room);
        text.fontSize = size;
        text.content = room.roomChar;
        text.justification = 'center';
        text.locked = true;

        text.scale(1, -1, new Point(room.getXMid(), room.getYMid()));
    }

    renderHighlight(roomId) {
        let room = new Room(this.area.getRoomById(roomId), this.baseSize, this.controls.getSettings().roomSize);
        if (room.exists()) {
            this.labelsLayer.activate();
            let circle = new Path.Circle(new Point(room.getXMid(), room.getYMid()), this.baseSize * 0.40);
            circle.fillColor = 'red';
            circle.strokeColor = '#e8fdff';
            circle.strokeWidth = 5;
            circle.bringToFront();
        }
    }

    calculateCoordinates(coord) {
        return coord * (10 / parseInt(this.controls.getSettings().roomSize)) * this.baseSize;
    }

    showRoomInfo(room) {
        let infoBox = jQuery(".info-box");
        infoBox.toggle(true);
        infoBox.find(".room-id").html(room.id);
        infoBox.find(".room-name").html(room.name);
        infoBox.find(".room-env").html(room.env);
        infoBox.find(".coord-x").html(room.x);
        infoBox.find(".coord-y").html(room.y);
        infoBox.find(".coord-z").html(room.z);
        infoBox.find(".room-hash").html("")
        infoBox.find(".room-hash").html(room.hash);

        this.infoExitsGroup(infoBox.find(".exits"), room.exits);
        this.infoExitsGroup(infoBox.find(".special"), room.specialExits);

        this.userDataGroup(infoBox.find(".userData"), room.userData);
    }

    userDataGroup(container, userData) {
        let containerList = container.find("ul");
        containerList.html("");
        let show = false;
        for (let userDataKey in userData) {
            show = true;
            containerList.append("<li>" + userDataKey + ":<br>&nbsp; &nbsp; &nbsp;" + userData[userDataKey] + "</li>");
        }
        container.toggle(show);
    }

    infoExitsGroup(container, exits) {
        let containerList = container.find("ul");
        containerList.html("");
        let show = false;
        for (let exit in exits) {
            show = true;
            containerList.append(this.infoExit(exit, exits[exit]));
        }
        container.toggle(show);
    }

    infoExit(exit, id) {
        let areaLink = "";
        if (roomIndex[id].areaId !== this.area.areaId) {
            let destRoom = roomIndex[id];
            let area = this.controls.reader.data[mapDataIndex[destRoom.areaId]];
            areaLink = ' ->  ' + '<a href="#" data-room="' + destRoom.id + '">' + area.areaName + '</a>'
        }
        return "<li>" + this.translateDir(exit) + " : " + '<a href="#" data-room="' + id + '">' + id + '</a>' + areaLink + "</li>";
    }

    translateDir(dir) {
        if (plDirs.hasOwnProperty(dir)) {
            return translateString(plDirs[dir]);
        }
        return dir
    }

    hideRoomInfo() {
        let infBox = jQuery(".info-box");
        infBox.toggle(false);
    }

    renderLabel(value) {
        let label = new paper.Raster("data:image/png;base64," + value.Pixmap)
        label.position = new Point(this.calculateCoordinates(value.X) + this.calculateCoordinates(value.Width) / 2, this.calculateCoordinates(value.Y) - this.calculateCoordinates(value.Height) / 2)
        label.width = this.calculateCoordinates(value.Width)
        label.height = this.calculateCoordinates(value.Height)
        label.scale(1,-1)
    }

    focus(room) {
        view.center = room.render.position
    }

}

class Room {

    constructor(props, baseSize, roomSize) {
        Object.assign(this, props);
        this.baseSize = baseSize;
        this.roomSize = roomSize;
    }

    exists() {
        return this.id;
    }

    calculateCoordinates(coord) {
        return coord * (10 / this.roomSize) * this.baseSize - (this.baseSize / 2);
    }

    getX() {
        return this.calculateCoordinates(this.x);
    }

    getY() {
        return this.calculateCoordinates(this.y);
    }

    getXMid() {
        return this.getX() + this.baseSize / 2;
    }

    getYMid() {
        return this.getY() + this.baseSize / 2;
    }

    getExitX(dir, round) {
        if (round) {
            return this.getXMid()
        }
        switch (dir) {
            case "west":
            case "w":
            case "northwest":
            case "nw":
            case "southwest":
            case "sw":
                return this.getX();
            case "east":
            case "e":
            case "northeast":
            case "ne":
            case "southeast":
            case "se":
                return this.getX() + this.baseSize;
            default:
                return this.getX() + this.baseSize / 2;
        }
    }

    getExitY(dir, round) {
        if (round) {
            return this.getYMid()
        }
        switch (dir) {
            case "north":
            case "n":
            case "northwest":
            case "nw":
            case "northeast":
            case "ne":
                return this.getY() + this.baseSize;
            case "south":
            case "s":
            case "southwest":
            case "sw":
            case "southeast":
            case "se":
                return this.getY();
            default:
                return this.getY() + this.baseSize / 2;
        }
    }
}

class MapReader {

    constructor(data) {
        this.data = data;
        this.data.sort(function (areaElement1, areaElement2) {
            if (areaElement1.areaName < areaElement2.areaName) {
                return -1
            }
            if (areaElement1.areaName > areaElement2.areaName) {
                return 1
            }
            return 0;
        });
    }

    getAreas() {
        return this.data;
    }

    getArea(areaId, zIndex, limits) {
        let area = this.data[mapDataIndex[areaId]];

        // area.rooms = area.rooms.concat(this.data[mapDataIndex[50]].rooms)
        // area.rooms = area.rooms.concat(this.data[mapDataIndex[34]].rooms)
        // area.rooms = area.rooms.concat(this.data[mapDataIndex[37]].rooms)
        // area.rooms = area.rooms.concat(this.data[mapDataIndex[35]].rooms)
        

        let levels = new Set();
        //TODO: Not optimal...
        let candidateArea = new Area(areaId, area.areaName, area.rooms.filter(room => {
            levels.add(parseInt(room.z));
            let isOnLevel = room.z === zIndex;
            let isWithinBounds = true;
            if (limits) {
                isWithinBounds = limits.xMin < room.x && limits.xMax > room.x && limits.yMin < room.y && limits.yMax > room.y;
            }
            return isOnLevel && isWithinBounds
        }), area.labels.filter(value => value.Z === zIndex), zIndex, levels);
        if (!levels.has(zIndex)) {
            candidateArea = this.getArea(areaId, levels.values().next().value)
        }
        return candidateArea;
    }

}

class Area {
    constructor(areaId, areaName, rooms, labels, zIndex, levels) {
        this.areaId = parseInt(areaId);
        this.areaName = areaName;
        this.rooms = [];
        this.labels = labels;
        let that = this;
        rooms.forEach(function (element) {
            that.rooms[element.id] = element;
        });
        this.levels = levels;
        this.zIndex = zIndex;
    }

    getAreaBounds() {
        if (this.bounds === undefined) {
            let minX = 9999999999;
            let minY = 9999999999;
            let maxX = -9999999999;
            let maxY = -9999999999;
        this.rooms.forEach(function (element) {
            minX = Math.min(minX, element.x);
            minY = Math.min(minY, element.y);
            maxX = Math.max(maxX, element.x);
            maxY = Math.max(maxY, element.y);
        });
            this.bounds = { minX: minX, minY: minY, maxX: maxX, maxY: maxY }
        }

        return this.bounds
    }

    getRoomById(id) {
        return this.rooms[id];
    }

    getLevels() {
        return this.levels;
    }

    getZIndex() {
        return this.zIndex;
    }
}

class Controls {

    constructor(canvas, settings, mapData, extras) {
        this.canvas = canvas;
        this.reader = new MapReader(mapData);
        this.scale = 1;
        this.areaId = 1;
        this.zIndex = 0;

        this.select = jQuery("#area");
        this.levels = jQuery(".levels");
        this.saveImageButton = jQuery(".save-image");
        this.copyImageButton = jQuery(".copy-image");
        this.zoomButton = jQuery(".zoom-controls .btn");
        this.toastContainer = jQuery('.toast');
        this.searchModal = jQuery('#search');
        this.search = jQuery(".search-form");
        this.helpModal = jQuery("#help");
        this.zoomBar = jQuery(".progress-container");
        this.settingsModal = jQuery("#settings");
        this.settingsForm = jQuery("#settings form");

        this.settings = settings;
        this.extras = extras || {};

        this.activateMouseEvents();
        this.populateSelectBox(this.select);
        this.populateSettings();

        let that = this;

        jQuery(".btn").on("click", function () {
            jQuery(this).blur();
        });

        this.levels.on("click", ".btn-level", function (event) {
            event.preventDefault();
            let zIndex = parseInt(jQuery(this).attr("data-level"));
            that.draw(that.areaId, zIndex);
        });

        this.saveImageButton.on("click", function () {
            that.saveImage();
        });

        this.copyImageButton.on("click", function () {
            that.copyImage();
        });

        this.zoomButton.on("click", function () {
            that.zoom(parseFloat(jQuery(this).attr("data-factor")), view.center);
        });

        this.search.on("submit", function (event) {
            event.preventDefault();
            that.submitSearch(event);
        });

        this.searchModal.on('shown.bs.modal', function () {
            that.searchModal.find("input").first().focus();
        });

        this.settingsModal.on('shown.bs.modal', function () {
            that.populateSettings();
            that.settingsModal.find("input").first().focus();
        });

        this.settingsForm.on("submit", function (event) {
            event.preventDefault();
            that.handleSaveSettings();
        });

        let directionKeys = {
            "Numpad1": 'sw',
            "Numpad2": 's',
            "Numpad3": 'se',
            "Numpad4": 'w',
            "Numpad6": 'e',
            "Numpad7": 'nw',
            "Numpad8": 'n',
            "Numpad9": 'ne',
            "NumpadMultiply": 'u',
            "NumpadDivide": 'd',
        };

        window.addEventListener("keydown", function keydown(event) {
            if (that.settings.disableKeyBinds) {
                return;
            }

            if (event.code === "F1") {
                that.showHelp();
                event.preventDefault();
            }

            if (directionKeys.hasOwnProperty(event.code)) {
                that.goDirection(directionKeys[event.code]);
                event.preventDefault();
            }

            if (event.ctrlKey && event.key === "KeyF") {
                that.showSearch();
                event.preventDefault();
            }
        });


        window.addEventListener("keydown", function keydown(event) {
            if (that.settings.disableKeyBinds) {
                return;
            }

            if (jQuery("input").is(":focus")) {
                return;
            }
            if (event.ctrlKey && event.code === "KeyC") {
                that.copyImage();
                event.preventDefault();
            }

            if (event.ctrlKey && event.code === "KeyS") {
                that.saveImage();
                event.preventDefault();
            }

            if (event.code === "Equal") {
                that.zoom(1.1);
                event.preventDefault();
            }

            if (event.code === "Minus") {
                that.zoom(0.9);
                event.preventDefault();
            }

            if (event.code === "ArrowUp") {
                that.move(0, -1);
                event.preventDefault();
            }
            if (event.code === "ArrowDown") {
                that.move(0, 1);
                event.preventDefault();
            }
            if (event.code === "ArrowLeft") {
                that.move(-1, 0);
                event.preventDefault();
            }
            if (event.code === "ArrowRight") {
                that.move(1, 0);
                event.preventDefault();
            }
        });


        jQuery(window).on("resize", function () {
            if (!that.settings.disableRedrawOnResize) {
                that.redraw()
            }
        });

        jQuery("body").on("click", "[data-room]", function (e) {
            that.findRoom(parseInt(jQuery(this).attr("data-room")));
            e.preventDefault();
        });
    }

    activateMouseEvents() {
        this.activateDrag();
        this.activateZoom();
    }

    activateDrag() {
        let toolPan = new Tool();
        toolPan.activate();
        let that = this;
        toolPan.onMouseDrag = function (event) {
            if (that.settings.disableDrag) {
                return;
            }
            that.canvas.style.cursor = "all-scroll";
            let bounds = that.renderer.getBounds(); //TODO prevent drag over bounds
            let delta = event.downPoint.subtract(event.point);
            view.scrollBy(delta);
            that.renderer.isDrag = true;
        };
        toolPan.onMouseDown = function (event) {
            that.renderer.isDrag = false;
        };
        toolPan.onMouseUp = function (event) {
            that.renderer.isDrag = false;
            that.canvas.style.cursor = "default";
        }
    }

    activateZoom() {
        let that = this;
        jQuery(this.canvas).on('wheel mousewheel', function (e) {
            let oldZoom = view.zoom;
            if (e.originalEvent.deltaY / 240 > 0) {
                that.zoom(0.9);
            } else {
                that.zoom(1.1);
            }

            let viewPos = view.viewToProject(new Point(e.originalEvent.x, e.originalEvent.y));
            let zoomScale = oldZoom / view.zoom;
            let centerAdjust = viewPos.subtract(view.center);
            let offset = viewPos.subtract(centerAdjust.multiply(zoomScale))
                .subtract(view.center);

            view.center = view.center.add(offset);
            that.adjustZoomBar();
        });
    }

    zoom(factor) {
        view.zoom *= factor;
        if (Math.abs(view.zoom - 1) < 0.05) {
            view.zoom = 1;
        }

        view.zoom = Math.min(Math.max(view.zoom, view.minZoom), 10);

        this.adjustZoomBar()
    }

    setZoom(zoom) {
        view.zoom = zoom;
        this.adjustZoomBar()
    }

    adjustZoomBar() {
        let percentage = (view.zoom - view.minZoom) / (10 - view.minZoom);

        this.zoomBar.find(".progress-bar").css("width", (percentage * 100) + "%");
        let that = this;
        if (!this.zoomBar.is(":visible")) {
            this.zoomBar.fadeIn();
            this.progressTimeout = setTimeout(function () {
                that.zoomBar.fadeOut();
            }, 3000);
        } else {
            if (this.progressTimeout !== undefined) {
                clearTimeout(this.progressTimeout);
                this.progressTimeout = undefined;
            }
            this.progressTimeout = setTimeout(function () {
                that.zoomBar.fadeOut('slow');
            }, 3000);
        }
    }

    move(x, y) {
        view.scrollBy(new Point(x * 20, y * 20));
    }

    populateSelectBox(select) {
        this.reader.getAreas().forEach(function (areaElement, index) {
            select.append(new Option(areaElement.areaName, areaElement.areaId));
        });
        let that = this;
        select.on("change", function (event) {
            that.draw(jQuery(this).val(), 0);
        })
    }


    populateLevelButtons(levelsSet, zIndex) {
        this.levels.html("");
        if(levelsSet.size <= 1) {
            return;
        }
        let levelsSorted = Array.from(levelsSet).sort(function (a, b) {
            return a - b;
        });

        if(levelsSorted.length > 10) {
            let container = jQuery('<div class="dropdown"></div>');
            let button = jQuery('<button class="btn btn-secondary dropdown-toggle" type="button" data-toggle="dropdown">'+zIndex+'</button>');
            let menu = jQuery('<div class="dropdown-menu" aria-labelledby="dropdownMenuButton"></div>');
            container.append(button);
            container.append(menu);
            for (let level of levelsSorted) {
                menu.append('<a class="dropdown-item btn-level" href="#" data-level="' + level + '">' + level + '</a>')
            }
            this.levels.append(container)
        } else {
            for (let level of levelsSorted) {
                let classes = "btn btn-level";
                if (level === zIndex) {
                    classes += " btn-primary";
                } else {
                    classes += " btn-secondary";
                }
                this.levels.append("<button type=\"button\" class=\"" + classes + "\" data-level=\"" + level + "\">" + level + "</button>");
            }
        }
    }

    draw(areaId, zIndex, room) {
        view.zoom = 1;
        project.clear();
        this.areaId = areaId;
        this.zIndex = zIndex;
        let area = this.reader.getArea(this.areaId, zIndex, this.getLimits(room));
        this.zIndex = area.getZIndex();
        this.populateLevelButtons(area.getLevels(), this.zIndex);
        this.renderer = new MapRenderer(this, this.canvas, area, 1);
        this.renderer.render();
        view.draw();
        this.select.val(areaId);
    }

    getLimits(room) {
        if (!room || this.settings.radiusLimit === 0) {
            return false;
        }
        return {
            xMin: room.x - this.settings.radiusLimit,
            xMax: room.x + this.settings.radiusLimit,
            yMin: room.y - this.settings.radiusLimit / 2,
            yMax: room.y + this.settings.radiusLimit / 2,
        };
    }

    redraw() {
        this.draw(this.areaId, this.zIndex);
    }

    saveImage() {
        let a = jQuery("<a>")
            .attr("href", this.canvas.toDataURL())
            .attr("download", this.renderer.area.areaName + ".png")
            .appendTo("body");
        a[0].click();
        a.remove();
    }

    copyImage() {
        let that = this;
        if (typeof ClipboardItem !== "undefined") {
            that.canvas.toBlob(blob => navigator.clipboard.write([new ClipboardItem({'image/png': blob})]));
            this.showToast(translateString("Skopiowano do schowka"))
        } else {
            this.showToast("Twoja przeglądarka nie wspiera kopiowania do schowka")
        }
        this.toastContainer.toast('show')
    }

    showSearch() {
        this.searchModal.modal('show');
    }

    submitSearch() {
        this.searchModal.modal('toggle');
        let inputs = this.search.find(':input');

        let formData = {};
        inputs.each(function () {
            formData[this.name] = jQuery(this).val();
            jQuery(this).val("")
        });

        if (formData.roomId !== undefined) {
            this.findRoom(parseInt(formData.roomId))
        }
    }

    findRoom(id) {
        let room = roomIndex[id];
        if (room !== undefined) {
            this.draw(room.areaId, room.z, room);
            this.setZoom(1);
            this.renderer.focus(roomIndex[parseInt(id)]);
            this.renderer.onRoomClick(roomIndex[parseInt(id)]);
        } else {
            this.showToast("Nie znaleziono takiej lokacji")
        }
    }

    showToast(text) {
        this.toastContainer.find(".toast-body").html(text);
        this.toastContainer.toast('show')
    }

    showHelp() {
        this.helpModal.modal('show');
    }

    handleSaveSettings() {
        let inputs = this.settingsModal.find('input');

        let formData = {};
        inputs.each(function () {
            let name = jQuery(this).attr("name");
            let type = jQuery(this).attr("type");
            if (type === "checkbox") {
                formData[name] = jQuery(this).is(":checked");
            } else if (type === "number") {
                formData[name] = parseInt(jQuery(this).val());
            } else {
                formData[name] = jQuery(this).val();
            }
        });

        this.settings = {...this.settings, ...formData};

        this.showToast("Zapisano ustawienia");
        this.redraw();
        this.settingsModal.modal('toggle');
        this.saveSettings();
    }

    saveSettings() {
        setCookie("settings", JSON.stringify(this.settings), 999);
    }

    populateSettings() {
        for (let setting in this.settings) {
            let input = this.settingsModal.find("input[name='" + setting + "']");
            if (input.attr("type") === "checkbox") {
                input.attr("checked", this.settings[setting]);
            } else {
                input.val(this.settings[setting]);
            }
        }
    }

    goDirection(directionKey) {
        let fullDirection = dirsShortToLong(directionKey);
        if (this.renderer.roomSelected) {
            this.findRoom(this.renderer.roomSelected.exits[fullDirection]);

        }
    }

    setSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();
    }

    getSettings() {
        return this.settings;
    }

    getExtras() {
        return this.extras;
    }
}

jQuery.fn.mudletMap = function (settings, extras) {

    let canvas = this[0];
    paper.setup(canvas);
    paper.install(window);

    let area = params.get('area');
    if (!area && typeof position !== 'undefined') {
        area = position.area
    }
    if (!area) {
        area = 1;
    }

    let defaults = {
        roomSize: 7,
        baseSize: 20,
        borders: true,
        frameMode: false,
        round: false,
        areaName: true,
        showLabels: true,
        radiusLimit: 0,
        monochromatic: false,
        dotSelect1ionMarker: false,
        disableDrag: false,
        disableRedrawOnResize: false,
        disableKeyBinds: false,
        disableClicks: false,
    };

    settings = {
        ...defaults, ...settings
    }
    let loaded = getCookie("settings");
    if (loaded) {
        settings = {...settings, ...JSON.parse(loaded)}
    }

    window.MapControls = new Controls(canvas, settings, mapData, extras);
    let roomSearch = params.get('id');
    if (!roomSearch) {
        MapControls.draw(area, 0);
    } else {
        MapControls.findRoom(parseInt(roomSearch));
    }
}

function getKeyByValue(obj, val) {
    for (let k in obj) {
        if (obj.hasOwnProperty(k) && obj[k] === val) {
            return k;
        }
    }
}

let dirs = {
    "north": "n",
    "south": "s",
    "east": "e",
    "west": "w",
    "northeast": "ne",
    "northwest": "nw",
    "southeast": "se",
    "southwest": "sw",
    "up": "u",
    "down": "d",
};

let dirNumbers = {
    1: "n",
    2: "ne",
    3: "nw",
    4: "e",
    5: "w",
    6: "s",
    7: "se",
    8: "sw",
    9: "u",
    10: "d",
};

let plDirs = {
    "north": "polnoc",
    "south": "poludnie",
    "east": "wschod",
    "west": "zachod",
    "northeast": "polnocny-wschod",
    "northwest": "polnocny-zachod",
    "southeast": "poludniowy-wschod",
    "southwest": "poludniowy-zachod",
    "up": "gora",
    "down": "dol",
};

function dirsShortToLong(dir) {
    let result = getKeyByValue(dirs, dir);
    return result !== undefined ? result : dir;
}

function dirLongToShort(dir) {
    return dirs[dir] !== undefined ? dirs[dir] : dir;
}

function setCookie(cname, cvalue, exdays) {
    localStorage.setItem(cname, cvalue);
}

function getCookie(cname) {
    return localStorage.getItem(cname);
}
