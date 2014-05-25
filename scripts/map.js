// Stores the map object from Leaflet
var map;

// Stores the Leaflet marker objects
var markers = [];

// Custom marker icons
var plentyMarker;
var fewMarker;
var emptyMarker;

// Return a string for displaying the current status of a rack in a map label.
function formatLabel(id) {
    var s = '';

    s += '<strong>' + racks[id].name + '</strong>';
    s += '<br />';

    var status = rackStatus[id];
    if (status && status.bikes !== undefined && status.locks !== undefined) {
        s += status.bikes + ' free ';
        s += status.bikes === 1 ? 'bike' : 'bikes';
        s += '<br />';
        s += status.locks + ' free ';
        s += status.locks === 1 ? 'lock' : 'locks';
    }
    return s;
}

function initMap() {
    map = L.map('map').setView(params.defaultMapPos, params.defaultZoom);

    L.tileLayer('map/{z}/{x}/{y}.png', {
        attribution: '<span class="unselectable">&copy; OpenStreetMap contributors</span>',
        minZoom: params.minZoom,
        maxZoom: params.maxZoom
    }).addTo(map);

    map.setMaxBounds([params.southWestCorner, params.northEastCorner]);

    var MarkerIcon = L.Icon.extend({
        options: {
            shadowUrl: 'images/marker-shadow.png',
            iconSize:     [25, 41],
            shadowSize:   [41, 41],
            iconAnchor:   [12, 41],
            shadowAnchor: [12, 41],
            popupAnchor:  [-1, -34]
        }
    });

    plentyMarker = new MarkerIcon({iconUrl: 'images/marker-icon-green.png'});
    fewMarker = new MarkerIcon({iconUrl: 'images/marker-icon-yellow.png'});
    emptyMarker = new MarkerIcon({iconUrl: 'images/marker-icon-red.png'});
}

// Return the icon representing the given number of free bikes.
function pickIcon(bikes) {
    var icon = plentyMarker;
    if (bikes === 0) {
        icon = emptyMarker;
    } else if (bikes < params.fewBikesThreshold) {
        icon = fewMarker;
    }
    return icon;
}

function refreshMap() {
    for (var id in racks) {
        if (id in rackStatus) {
            var rack = racks[id];
            var icon = pickIcon(rackStatus[id].bikes);

            var marker;
            var popupLabel = formatLabel(id);
            if (id in markers) {
                marker = markers[id];
                marker.setIcon(icon);
                marker.setPopupContent(popupLabel);
            } else {
                marker = L.marker([rack.lat, rack.lon], { icon: icon });
                marker.bindPopup(popupLabel);
                marker.addTo(map);
                markers[id] = marker;
            }
        }
    }
}
