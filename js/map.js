//TODO tooltips for special exits

let envColors = {};
colors.forEach(function (element) {
    envColors[element.envId] = element.colors;
});
envColors.default = 'white';


let params = new URLSearchParams(location.search);


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
        this.baseSize = 20;
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

    render(highlights) {
        this.hideRoomInfo();

        let textOffset = 80;

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

        this.setDrawingBounds(text, textOffset);
        this.drawBackground(textOffset);
        this.setViewZoom(textOffset);

        let targetPoint = new Point(this.drawingBounds.minX + this.baseSize * 2 - textOffset, this.drawingBounds.maxY - this.baseSize * 2 + textOffset);
        text.setPoint(targetPoint);

        this.area.rooms.forEach(value => this.renderRoom(new Room(value, this.baseSize)), this);
        if (this.area.labels !== undefined) {
            this.area.labels.forEach(value => this.renderLabel(value), this);
        }

        if (highlights !== undefined) {
            highlights.forEach(value => this.renderHighlight(value));
        }

        project.layers.forEach(function (layer) {
            layer.transform(new Matrix(1, 0, 0, -1, textOffset, textOffset));
        });
    }

    setDrawingBounds(text, textOffset) {
        let bounds = this.area.getAreaBounds();
        let additionalPadding = this.baseSize * 4;

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
        let strokeWidth = 4;
        let size = this.baseSize;
        let rectangle = new Path.Rectangle(room.getX(), room.getY(), size, size);
        let color = envColors[room.env];
        if (color === undefined) {
            color = [114, 1, 0];
        }
        rectangle.fillColor = new Color(color[0] / 255, color[1] / 255, color[2] / 255);
        let strokeColor;
        if (rectangle.fillColor.lightness > 0.1) {
            strokeColor = new Color(color[0] / 255, color[1] / 255, color[2] / 255)
        } else {
            strokeColor = new Color(0.3, 0.3, 0.3)
        }
        rectangle.strokeColor = strokeColor;
        rectangle.strokeWidth = strokeWidth;

        room.render = rectangle;
        this.pointerReactor(room.render);

        room.exitRenders = [];
        for (let dir in room.exits) {
            if (this.ladders.indexOf(dir) <= -1) {
                if (room.exits.hasOwnProperty(dir) && !room.customLines.hasOwnProperty(dirLongToShort(dir))) {
                    room.exitRenders.push(this.renderLink(room, dir, new Room(this.area.getRoomById(room.exits[dir]), this.baseSize), room.exits[dir]));
                }
            } else {
                this.renderLadder(room, dir);
            }
        }

        for (let dir in room.specialExits) {
            if (room.specialExits.hasOwnProperty(dir) && !room.customLines.hasOwnProperty(dir)) {
                room.exitRenders.push(this.renderSpecialLink(room, dir, new Room(this.area.getRoomById(room.specialExits[dir]), this.baseSize)))
            }
        }

        room.stubRenders = [];
        for (let dir in room.stubs) {
            if (room.stubs.hasOwnProperty(dir)) {
                room.stubRenders.push(this.renderStub(room, dirNumbers[room.stubs[dir]], this.baseSize))
            }
        }

        for (let dir in room.customLines) {
            room.exitRenders.push(this.renderCustomLine(room, dir));
        }

        if (room.roomChar !== undefined) {
            this.renderChar(room);
        }

        roomIndex[room.id] = room;

        let that = this;
        room.render.onClick = function () {
            if (!that.isDrag) {
                that.onRoomClick(room);
            }
        };
    }

    onRoomClick(room) {
        this.clearSelection();
        let selectionColor = new Color(180 / 255, 93 / 255, 60 / 255, 0.9);
        room.render.orgStrokeColor = room.render.strokeColor;
        room.render.strokeColor = selectionColor;
        this.roomSelected = room;
        let exits = {...room.exits, ...room.specialExits};

        room.exitRenders.forEach(path => {
            if (path !== undefined) {
                path.bringToFront();
                path.orgStrokeColor = path.strokeColor;
                path.strokeColor = selectionColor;
                path.strokeWidth = 1;
            }
        });

        //TODO add highlight for connected rooms
        this.roomsConnectedSelection = [];
        for (let key in exits) {
            //console.log(exits[key]);
        }
        this.showRoomInfo(room)
    }

    clearSelection() {
        if (this.roomSelected !== undefined) {
            this.roomSelected.render.strokeColor = this.roomSelected.render.orgStrokeColor;
            this.roomSelected.exitRenders.forEach(path => {
                if (path !== undefined) {
                    path.strokeColor = path.orgStrokeColor;
                    path.bringToFront();
                    path.strokeWidth = 1;
                }
            });
        }

        this.hideRoomInfo()
    }

    renderHighlight(roomId) {
        let room = roomIndex[roomId]
        if (room.exists()) {
            this.labelsLayer.activate();
            let circle = new Path.Circle(new Point(room.getXMid(), room.getYMid()), this.baseSize * 0.40);
            circle.fillColor = 'red';
            circle.strokeColor = '#e8fdff';
            circle.strokeWidth = 5;
            circle.bringToFront();
        }
    }

    renderLink(room1, dir1, room2, exit) {
        this.linkLayer.activate();
        if (room1 !== undefined && !room1.specialExits.hasOwnProperty(dir1)) {
            let path;

            let exitPoint = new Point(room1.getExitX(dir1), room1.getExitY(dir1));
            let secondPoint;

            if (room2.exists()) {
                let connectedDir = getKeyByValue(room2.exits, room1.id);
                let isOneWay = connectedDir === undefined;
                secondPoint = new Point(room2.getExitX(connectedDir), room2.getExitY(connectedDir));
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
                path.onClick = function () {
                    that.onExitClick(roomProperties)
                };
                this.pointerReactor(path);
            }

            if (room1.doors[dirLongToShort(dir1)] !== undefined) {
                this.renderDoors(exitPoint, secondPoint)
            }

            path.strokeWidth = 1;

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
            roomConnected = new Room(this.area.getRoomById(room.exits[dirsShortToLong(dir)]), this.baseSize);
        }
        if (room.specialExits.hasOwnProperty(dir)) {
            roomConnected = new Room(this.area.getRoomById(room.specialExits[dir]), this.baseSize);
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

        if (roomConnected !== undefined && roomConnected.exists()) {
            // lastPoint = new Point(roomConnected.getXMid(), roomConnected.getYMid());
            // path.lineTo(lastPoint);
            // let tempRender = new Path.Rectangle(roomConnected.getX(), roomConnected.getY(), this.baseSize, this.baseSize);
            // let intersections = path.getIntersections(tempRender);
            // if (intersections.length > 0) {
            //     path.getLastSegment().point = intersections[intersections.length - 1].point;
            // }
        }

        customLine.addChild(path);

        if (room.customLines[dir].attributes.arrow && path.segments.length > 1) {
            let arrow = this.drawArrow(path.segments[path.segments.length - 2].point, path.segments[path.segments.length - 1].point, path.strokeColor, this.baseSize / 2, path.strokeColor, path.dashArray);
            customLine.addChild(arrow);
        }

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

        let baseColor;
        if (room.render.fillColor.lightness > 0.4) {
            baseColor = 0.20;
        } else {
            baseColor = 0.80;
        }

        myPath.fillColor = new Color(baseColor, baseColor, baseColor, 0.75);
        myPath.strokeColor = new Color(baseColor, baseColor, baseColor);

        myPath.locked = true;

        myPath.bringToFront();

        if (direction === "up") {
            myPath.rotate(180, new Point(room.getXMid(), room.getYMid()));
        }

        myPath.closed = true;
    }

    renderDoors(firstPoint, secondPoint) {
        this.specialLinkLayer.activate();
        let x = (firstPoint.x + secondPoint.x) / 2;
        let y = (firstPoint.y + secondPoint.y) / 2;
        let door = new Path.Rectangle(x - this.baseSize / 4, y - this.baseSize / 4, this.baseSize / 2, this.baseSize / 2);
        door.scale(0.85, door.center);
        door.strokeColor = 'rgb(47,168,255)';
        door.strokeWidth = 2;
    }

    renderChar(room) {
        this.charsLayer.activate();
        let text = new PointText(new Point(room.getXMid(), room.getYMid() + 5));
        text.fillColor = 'black';
        text.fontSize = 15;
        text.content = room.roomChar;
        text.justification = 'center';
        text.locked = true;

        text.scale(1, -1, new Point(room.getXMid(), room.getYMid()));
    }

    calculateCoordinates(coord) {
        return coord * 1.1 * this.baseSize;
    }

    showRoomInfo(room) {
        let infoBox = jQuery(".info-box");
        infoBox.toggle(true);
        infoBox.find(".room-id").html(room.id);
        infoBox.find(".room-name").html(room.name);
        infoBox.find(".coord-x").html(room.x);
        infoBox.find(".coord-y").html(room.y);
        infoBox.find(".coord-z").html(room.z);

        let special = infoBox.find(".special");
        let specialList = special.find("ul")
        specialList.html("");
        let show = false;
        for (let exit in room.specialExits) {
            show = true;
            specialList.append("<li>" + exit + " : " + room.specialExits[exit] + "</li>")
        }
        special.toggle(show)
    }

    hideRoomInfo() {
        let infBox = jQuery(".info-box");
        infBox.toggle(false);
    }

    renderLabel(value) {
        let text = new PointText(new Point(this.calculateCoordinates(value.X) + this.calculateCoordinates(value.Width) / 2, this.calculateCoordinates(value.Y) - this.calculateCoordinates(value.Height) / 2));
        text.fillColor = 'yellow';
        text.fontSize = 15;
        text.content = value.Text;
        text.justification = 'center';
        text.locked = true;
        text.scale(1, -1)
    }

    focus(roomProperties) {
        view.center = roomIndex[roomProperties.id].render.position
    }

}

class Room {

    constructor(props, baseSize) {
        Object.assign(this, props);
        this.baseSize = baseSize;
    }

    exists() {
        return this.id;
    }

    calculateCoordinates(coord) {
        return coord * 1.1 * this.baseSize - (this.baseSize / 2);
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

    getExitX(dir) {
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

    getExitY(dir) {
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

    getArea(areaId, zIndex) {
        let area = this.data[mapDataIndex[areaId]];
        let levels = new Set();
        return new Area(area.areaName, area.rooms.filter(value => {
            levels.add(parseInt(value.z));
            return value.z === zIndex
        }), area.labels.filter(value => value.Z === zIndex), zIndex, levels);
    }


}

class Area {
    constructor(areaName, rooms, labels, zIndex, levels) {
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
        return {minX: minX, minY: minY, maxX: maxX, maxY: maxY}
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

    constructor(canvas, mapData) {
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

        this.activateMouseEvents();
        this.populateSelectBox(this.select);

        let that = this;

        this.levels.on("click", ".btn-level", function () {
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
        })
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
        var that = this;
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
        });
    }

    zoom(factor) {
        view.zoom *= factor;
        if (Math.abs(view.zoom - 1) < 0.05) {
            view.zoom = 1;
        }

        view.zoom = Math.min(Math.max(view.zoom, view.minZoom), 10);
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
        let levelsSorted = Array.from(levelsSet).sort(function (a, b) {
            return a - b;
        });
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

    draw(areaId, zIndex, highlights) {
        view.zoom = 1;
        project.clear();
        this.areaId = areaId;
        this.zIndex = zIndex;
        let area = this.reader.getArea(this.areaId, this.zIndex);
        this.populateLevelButtons(area.getLevels(), this.zIndex);
        this.renderer = new MapRenderer(this, this.canvas, area, 1);
        this.renderer.render(highlights);
        view.draw();
        this.select.val(areaId);
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
            this.showToast("Skopiowano do schowka")
        } else {
            this.showToast("Twoja przeglądarka nie wspiera kopiowania do schowka")
        }
        this.toastContainer.toast('show')
    }

    submitSearch(event) {
        this.searchModal.modal('toggle');
        let inputs = this.search.find(':input');

        let formData = {};
        inputs.each(function () {
            formData[this.name] = jQuery(this).val();
            jQuery(this).val("")
        });

        if (formData.roomId !== undefined) {
            let room = roomIndex[parseInt(formData.roomId)];
            if (room !== undefined) {
                this.draw(room.areaId, room.z);
                this.zoom(6);
                this.renderer.focus(room);
                this.renderer.onRoomClick(roomIndex[parseInt(formData.roomId)]);
            } else {
                this.showToast("Nie znaleziono takiej lokacji")
            }
        }
    }

    showToast(text) {
        this.toastContainer.find(".toast-body").html(text);
        this.toastContainer.toast('show')
    }

}

jQuery(function () {
    let canvas = document.getElementById('map');
    paper.setup(canvas);
    paper.install(window);

    let area = params.get('area');
    if (area == null) {
        area = position.area
    }


    let highlights = [];
    let toHighlight = params.get('highlights');
    if (toHighlight !== null) {
        highlights = toHighlight.split(",")
    }
    let controls = new Controls(canvas, mapData);
    controls.draw(area, 0, highlights);
    jQuery("select").val(area);

});

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

function dirsShortToLong(dir) {
    let result = getKeyByValue(dirs, dir);
    return result !== undefined ? result : dir;
}

function dirLongToShort(dir) {
    return dirs[dir] !== undefined ? dirs[dir] : dir;
}
