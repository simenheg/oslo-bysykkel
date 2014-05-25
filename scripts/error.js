var err = {
    "noBikeLocation": {
        "header": "Location not available",
        "body": "Waiting for current location in order to display the list of closest bikes ..."
    },
    "noLockLocation": {
        "header": "Location not available",
        "body": "Waiting for current location in order to display the list of closest locks ..."
    },
    "noData": {
        "header": "No data found",
        "body": "Make sure that your device is connected to the Internet, and hit the Refresh button."
    },
    "noGeoBikes": {
        "header": "Geolocation not available",
        "body": "You need a device with geolocation support in order to see the list of closest bikes."
    },
    "noGeoLocks": {
        "header": "Geolocation not available",
        "body": "You need a device with geolocation support in order to see the list of closest locks."
    }
};

function renderErrorMessage(elementId, errorId) {
    var template =
    '<li><div class="error-message">' +
      '<p><i>{{header}}</i><p>' +
      '<p>{{body}}</p>' +
    '</div></li>';

    document.getElementById(elementId).innerHTML =
        Mustache.render(template, err[errorId]);
}
