(function (L, Mustache, mergedIdMap, racks) {
    'use strict';

    var params = {
        'rackStatusURL': 'http://bysykkel-prod.appspot.com/json',
        'rackListLength': 12,
        'updateInterval': 40000,
        'defaultMapPos': [59.921323, 10.737931],
        'defaultZoom': 13,
        'minZoom': 13,
        'maxZoom': 16,
        'southWestCorner': [59.879365, 10.637612],
        'northEastCorner': [59.965550, 10.819897],
        'fewBikesThreshold': 5,
    };

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

    // Stores the map object from Leaflet
    var map;

    // Stores the Leaflet marker objects
    var markers = [];

    // Custom marker icons
    var plentyMarker;
    var fewMarker;
    var emptyMarker;

    var err = {
        'noBikeLocation': {
            'header': "Location not available",
            'body': "Waiting for current location in order to " +
                "display the list of closest bikes ..."
        },
        'noLockLocation': {
            'header': "Location not available",
            'body': "Waiting for current location in order to " +
                "display the list of closest locks ..."
        },
        'noData': {
            'header': "No data found",
            'body': "Make sure that your device is connected to " +
                "the Internet."
        },
        'noGeoBikes': {
            'header': "Geolocation not available",
            'body': "You need a device with geolocation support in " +
                "order to see the list of closest bikes."
        },
        'noGeoLocks': {
            'header': "Geolocation not available",
            'body': "You need a device with geolocation support in " +
                "order to see the list of closest locks."
        }
    };

    function renderErrorMessage (elementId, errorId) {
        var template =
                '<li><div class="error-message">' +
                '<p><i>{{header}}</i><p>' +
                '<p>{{body}}</p>' +
                '</div></li>';

        document.getElementById(elementId).innerHTML =
            Mustache.render(template, err[errorId]);
    }

    // Return the internal version of the given id. This is for
    // instance useful when several rack ids should map to the same
    // internal id.
    function internalId (id) {
        return id in mergedIdMap ? mergedIdMap[id] : id;
    }

    // Convert angle from degrees to radians.
    function degree2rad (angle) {
        return angle * Math.PI / 180.0;
    }

    // Return the distance in km from (lat1, lon1) to (lat2, lon2).
    // Algorithm: Spherical law of cosines for sufficient results down
    // to 1 meter.
    function distance (lat1, lon1, lat2, lon2) {
        var R = 6371; // radius of earth, in km
        lat1 = degree2rad(lat1);
        lat2 = degree2rad(lat2);
        lon1 = degree2rad(lon1);
        lon2 = degree2rad(lon2);
        return Math.acos(Math.sin(lat1) * Math.sin(lat2) +
                         Math.cos(lat1) * Math.cos(lat2) *
                         Math.cos(lon2 - lon1)) * R;
    }

    // Return a string for displaying the current status of a rack in
    // a map label.
    function formatLabel (id) {
        var status = rackStatus[id];
        var s = '';

        s += '<strong>' + racks[id].name + '</strong>';
        s += '<br />';
        if (status && status.bikes >= 0 && status.locks >= 0) {
            s += status.bikes + ' free ';
            s += status.bikes === 1 ? 'bike' : 'bikes';
            s += '<br />';
            s += status.locks + ' free ';
            s += status.locks === 1 ? 'lock' : 'locks';
        }
        return s;
    }

    function initMap () {
        var MarkerIcon = L.Icon.extend({
            options: {
                shadowUrl: 'images/marker-shadow.png',
                iconSize: [25, 41],
                shadowSize: [41, 41],
                iconAnchor: [12, 41],
                shadowAnchor: [12, 41],
                popupAnchor: [-1, -34]
            }
        });

        map = L.map('map').setView(
            params.defaultMapPos,
            params.defaultZoom
        );

        L.tileLayer('map/{z}/{x}/{y}.png', {
            attribution: '<span class="unselectable">' +
                '&copy; OpenStreetMap contributors</span>',
            minZoom: params.minZoom,
            maxZoom: params.maxZoom
        }).addTo(map);

        map.setMaxBounds([
            params.southWestCorner,
            params.northEastCorner
        ]);

        plentyMarker = new MarkerIcon({
            iconUrl: 'images/marker-icon-green.png'
        });
        fewMarker = new MarkerIcon({
            iconUrl: 'images/marker-icon-yellow.png'
        });
        emptyMarker = new MarkerIcon({
            iconUrl: 'images/marker-icon-red.png'
        });
    }

    // Return the icon representing the given number of free bikes.
    function pickIcon (bikes) {
        var icon = plentyMarker;
        if (bikes === 0) {
            icon = emptyMarker;
        } else if (bikes < params.fewBikesThreshold) {
            icon = fewMarker;
        }
        return icon;
    }

    function refreshMap () {
        var id, rack, icon, marker, popupLabel;

        for (id in racks) {
            if (id in rackStatus) {
                rack = racks[id];
                icon = pickIcon(rackStatus[id].bikes);
                popupLabel = formatLabel(id);

                if (id in markers) {
                    marker = markers[id];
                    marker.setIcon(icon);
                    marker.setPopupContent(popupLabel);
                } else {
                    marker = L.marker([rack.lat, rack.lon], {
                        icon: icon
                    });
                    marker.bindPopup(popupLabel);
                    marker.addTo(map);
                    markers[id] = marker;
                }
            }
        }
    }

    // Return a neatly formatted string, describing the distance to a
    // rack.
    function formatDistance (distance) {
        if (distance < 1) { // Less than 1 km to rack
            return Math.round(distance * 100) * 10 + ' m';
        } else {
            return distance.toFixed(1) + ' km';
        }
    }

    // Return a string displaying the current status of a rack.
    // TODO: Merge with 'formatLabel'?
    function formatStatus (status) {
        var s = '';
        if (status && status.bikes >= 0 && status.locks >= 0) {
            s += status.bikes + ' free ';
            s += status.bikes === 1 ? 'bike' : 'bikes';
            s += ', ';
            s += status.locks + ' free ';
            s += status.locks === 1 ? 'lock' : 'locks';
        }
        return s;
    }

    // Update 'rackDistance' table with the distances to every given
    // rack.
    function updateRackDistance (racks, lat, lon) {
        var id, rack, dist;

        rackDistance = {};
        for (id in racks) {
            id = internalId(id);
            rack = racks[id];
            dist = distance(lat, lon, rack.lat, rack.lon);
            if (id in rackDistance) {
                rackDistance[id] += dist;
            } else {
                rackDistance[id] = dist;
            }
        }
    }

    // Update 'rackStatus' table based on the given status.
    function updateRackStatus (status) {
        var i, id, rack, newStatus;
        var rackData = status.stationsData;

        rackStatus = {};
        for (i = 0; i < rackData.length; i++) {
            rack = rackData[i];
            if (rack.online) {
                newStatus = {};
                newStatus.bikes = rack.bikesReady;
                newStatus.locks = rack.emptyLocks;

                id = internalId(rack.id);
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

    // Register a geolocation watcher if the geolocation feature is
    // available.
    function registerPositionWatch () {
        if (!features.geolocation) {
            renderErrorMessage('bike-list', 'noGeoBikes');
            renderErrorMessage('lock-list', 'noGeoLocks');
        } else {
            positionWatchID = navigator.geolocation.watchPosition(
                function (position) {
                    var crd = position.coords;
                    pos.lat = crd.latitude;
                    pos.lon = crd.longitude;
                    updateRackDistance(racks, pos.lat, pos.lon);
                    refreshRackLists();
                }, function (err) {
                    // Geolocation couldn't be retrieved
                }, {
                    enableHighAccuracy: false,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        }
    }

    // Refresh both rack lists.
    function refreshRackLists () {
        if (pos.lat && pos.lon) {
            refreshRackList('bike-list', function (id) {
                return rackStatus[id] && rackStatus[id].bikes > 0;
            });
            refreshRackList('lock-list', function (id) {
                return rackStatus[id] && rackStatus[id].locks > 0;
            });
        } else {
            renderErrorMessage('bike-list', 'noBikeLocation');
            renderErrorMessage('lock-list', 'noLockLocation');
        }
    }

    // Return the IDs of the n closest racks, filtered by the given
    // function.
    function getClosestRacks (n, filter) {
        var id;
        var ids = [];

        for (id in rackDistance) {
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
    function refreshRackList (listId, filter) {
        var i, id, rack, data;
        var template =
                '<li data-rack-id={{id}}><a href="#map-panel">' +
                '<aside class="pack-end"><p>{{distance}}</p></aside>' +
                '<p>{{name}}</p>' +
                '<p>{{status}}</p>' +
                '</a></li>';
        var bikeList = document.getElementById(listId);
        var closest = getClosestRacks(params.rackListLength, filter);

        bikeList.innerHTML = '';
        for (i = 0; i < closest.length; i++) {
            id = closest[i];
            rack = racks[id];
            data = {
                'id': id,
                'distance': formatDistance(rackDistance[id]),
                'name': rack.name,
                'status': formatStatus(rackStatus[id])
            };

            bikeList.innerHTML += Mustache.render(template, data);
        }

        for (i = 0; i < bikeList.children.length; i++) {
            bikeList.children[i].onclick = function (e) {
                var rackId = e.currentTarget.dataset.rackId;
                var rack = racks[rackId];
                map.panTo([rack.lat, rack.lon]);
                markers[rackId].openPopup();
            };
        }
    }

    // Detect geolocation feature.
    function checkGeolocation () {
        features.geolocation = 'geolocation' in navigator;
    }

    function requestAndUpdateRackStatus (src) {
        var xhr = new XMLHttpRequest({ mozSystem: true });

        xhr.onload = function (e) {
            if (xhr.status === 200 || xhr.status === 0) {
                updateRackStatus(JSON.parse(xhr.responseText));
                refreshRackLists();
                refreshMap();
            }
        };

        xhr.open('get', src, true);
        xhr.send();
    }

    // Start position and status updates when app is focused, or stop
    // them if app is unfocused.
    function focusHandler () {
        if (document.hidden) {
            navigator.geolocation.clearWatch(positionWatchID);
            window.clearInterval(statusTimerID);
        } else {
            navigator.geolocation.clearWatch(positionWatchID);
            registerPositionWatch();

            window.clearInterval(statusTimerID);
            requestAndUpdateRackStatus(params.rackStatusURL);
            statusTimerID = window.setInterval(function () {
                requestAndUpdateRackStatus(params.rackStatusURL);
            }, params.updateInterval);
        }
    }

    // Initialize application.
    (function () {
        window.location.href = '#map-panel';

        checkGeolocation();

        ['bike-list', 'lock-list'].forEach(
            function (id) {
                renderErrorMessage(id, 'noData');
            }
        );

        initMap();

        document.addEventListener('visibilitychange', focusHandler);
        focusHandler();
    })();
})(window.L, window.Mustache, window.data.mergedIdMap,
   window.data.racks);
