#!/bin/bash

# This script downloads a selection of map tiles provided by the The
# Humanitarian OpenStreetMap Team[1], and organizes them so that they can be
# easily retrieved by the Leaflet[2] map library.
#
# [1] http://hot.openstreetmap.org/
# [2] http://leafletjs.com/

function riptiles
{
    zoom=$1
    xlo=$2
    xhi=$3
    ylo=$4
    yhi=$5

    for x in `seq $xlo $xhi`
    do
        for y in `seq $ylo $yhi`
        do
            if [[ ! -f $zoom/$x/$y.png ]]; then
                mkdir -p $zoom/$x;
                wget http://a.tile.openstreetmap.fr/hot/$zoom/$x/$y.png;
                mv $y.png $zoom/$x/;
                sleep 0.5; # give the server a break ...
            fi
        done
    done
}

# Retrieve tiles for Oslo, zoom levels 13-16
riptiles 13 4337 4342 2380 2384;
riptiles 14 8675 8684 4761 4768;
riptiles 15 17354 17366 9525 9534;
riptiles 16 34710 34731 19052 19068;
