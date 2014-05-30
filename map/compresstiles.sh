#!/bin/bash

# This script performs a lossy PNG compression of all the available map tiles,
# by means of the pngquant[1] program.
#
# [1] http://pngquant.org/

for f in `find . -type f -name "*.png" -exec ls '{}' \;`
do
    echo "Compressing" $f "...";
    pngquant --quality=65-80 $f -o compressed ; # saves about 30%
    mv compressed $f ;
done
