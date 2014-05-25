function requestAndUpdateRackStatus(src) {
    var xhr = new XMLHttpRequest({ mozSystem: true });

    xhr.onload = function(e) {
        if (xhr.status === 200 || xhr.status === 0) {
            updateRackStatus(JSON.parse(xhr.responseText));
            refreshRackLists();
            refreshMap();
        }
    };

    xhr.open("get", src, true);
    xhr.send();
}
