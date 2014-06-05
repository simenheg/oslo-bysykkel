// Device feature map
var features = {};

// Current position by latitude and longitude
var pos = {};

// Maps rack ids to current euclidean distance
var rackDistance = {};

// Maps rack ids to the number of currently free bikes & locks
var rackStatus = {};

// Position watcher
var positionWatchID = null;

// Tracks the interval of automatic status updates
var statusTimerID = null;

// Return a neatly formatted string, describing the distance to a rack.
function formatDistance(distance) {
    if (distance < 1) { // Less than 1 km to rack
        return Math.round(distance * 100) * 10 + ' m';
    } else {
        return distance.toFixed(1) + ' km';
    }
}

// Return a string displaying the current status of a rack.
function formatStatus(status) {
    var s = '';
    if (status && status.bikes !== undefined && status.locks !== undefined) {
        s += status.bikes + ' free ';
        s += status.bikes === 1 ? 'bike' : 'bikes';
        s += ', ';
        s += status.locks + ' free ';
        s += status.locks === 1 ? 'lock' : 'locks';
    }
    return s;
}

// Update 'rackDistance' table with the distances to every given rack.
function updateRackDistance(racks, lat, lon) {
    rackDistance = {};
    for (var id in racks) {
        id = internalId(id);
        var rack = racks[id];
        var dist = distance(lat, lon, rack.lat, rack.lon);
        if (id in rackDistance) {
            rackDistance[id] += dist;
        } else {
            rackDistance[id] = dist;
        }
    }
}

// Update 'rackStatus' table based on the given status.
function updateRackStatus(status) {
    var rackData = status.stationsData;
    rackStatus = {};
    for (var i = 0; i < rackData.length; i++) {
        var rack = rackData[i];
        if (rack.online) {
            var newStatus = {};
            newStatus.bikes = rack.bikesReady;
            newStatus.locks = rack.emptyLocks;

            var id = internalId(rack.id);
            if (id in rackStatus) {
                // Merge with new status
                rackStatus[id].bikes += newStatus.bikes;
                rackStatus[id].locks += newStatus.locks;
            } else {
                rackStatus[id] = newStatus;
            }
        }
    }
}

// Register a geolocation watcher if the geolocation feature is available.
function registerPositionWatch() {
    if (!features.geolocation) {
        renderErrorMessage('bike-list', 'noGeoBikes');
        renderErrorMessage('lock-list', 'noGeoLocks');
    } else {
        var options = {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 0
        };

        var success = function(position) {
            var crd = position.coords;
            pos.lat = crd.latitude;
            pos.lon = crd.longitude;
            updateRackDistance(racks, pos.lat, pos.lon);
            refreshRackLists();
        };

        var error = function(err) {
            // geolocation couldn't be retrieved
        };

        positionWatchID = navigator.geolocation.watchPosition(success, error, options);
    }
}

// Refresh both rack lists.
function refreshRackLists() {
    if (pos.lat && pos.lon) {
        var bikeFilter = function(id) {
            return rackStatus[id] &&
                rackStatus[id].bikes !== undefined &&
                rackStatus[id].bikes > 0;
        };

        var lockFilter = function(id) {
            return rackStatus[id] &&
                rackStatus[id].locks !== undefined &&
                rackStatus[id].locks > 0;
        };

        refreshRackList('bike-list', bikeFilter);
        refreshRackList('lock-list', lockFilter);
    } else {
        renderErrorMessage('bike-list', 'noBikeLocation');
        renderErrorMessage('lock-list', 'noLockLocation');
    }
}

// Return the IDs of the n closest racks, filtered by the given function.
function getClosestRacks(n, filter) {
    var ids = [];
    for (var id in rackDistance) {
        if (filter(id)) {
            ids.push(id);
        }
    }
    ids.sort(function (a, b) {
        return rackDistance[a] - rackDistance[b];
    });
    return ids.slice(0, n);
}

// Refresh rack list given by listId.
function refreshRackList(listId, filter) {
    var template =
    '<li><a>' +
      '<aside class="pack-end"><p>{{distance}}</p></aside>' +
      '<p>{{name}}</p>' +
      '<p>{{status}}</p>' +
    '</a></li>';

    var bikeList = document.getElementById(listId);
    bikeList.innerHTML = '';

    var closest = getClosestRacks(params.rackListLength, filter);
    for (var i = 0; i < closest.length; i++) {
        var id = closest[i];
        var rack = racks[id];
        var data = {
            'distance': formatDistance(rackDistance[id]),
            'name': rack.name,
            'status': formatStatus(rackStatus[id])
        };

        bikeList.innerHTML += Mustache.render(template, data);
    }
}

// Detect geolocation feature.
function checkGeolocation() {
    features.geolocation = 'geolocation' in navigator;
}

// Start position and status updates when app is focused, or stop them if app
// is unfocused.
function focusHandler() {
    if (document.hidden) {
        navigator.geolocation.clearWatch(positionWatchID);
        clearInterval(statusTimerID);
    } else {
        navigator.geolocation.clearWatch(positionWatchID);
        registerPositionWatch();

        clearInterval(statusTimerID);
        requestAndUpdateRackStatus(params.rackStatusURL);
        statusTimerID = setInterval(function() {
            requestAndUpdateRackStatus(params.rackStatusURL);
        }, params.updateInterval);
    }
}

// Initialize application.
(function() {
    location.href = '#map-panel';

    checkGeolocation();

    ['bike-list', 'lock-list'].forEach(
        function(id) {
            renderErrorMessage(id, 'noData');
        }
    );

    initMap();

    document.addEventListener("visibilitychange", focusHandler);
    focusHandler();
})();
