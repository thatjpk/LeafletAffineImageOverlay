/*     
* Copyright (c) 2012, John P. Kiffmeyer
* All rights reserved.
* 
* Redistribution and use in source and binary forms, with or without
* modification, are permitted provided that the following conditions are met: 
* 
* 1. Redistributions of source code must retain the above copyright notice, this
*    list of conditions and the following disclaimer. 
* 2. Redistributions in binary form must reproduce the above copyright notice,
*    this list of conditions and the following disclaimer in the documentation
*    and/or other materials provided with the distribution. 
* 
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
* ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
* WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
* DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
* ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
* (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
* LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
* ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
* (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
* SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*
* LeafletAffineImageOverlay
*
* A super-hacky overlay for leaflet[1] that lets you display an image on top of
* the map, transform it using three anchors, and output ground control points
* you can pass to gdal_translate.  (Rule #2: Inspired by Chris Broadfoot's 
* overlay-tiler[2].)
*
* This should probably end up as a Leaflet layer object that you can add with
* map.addLayer(), but until then, there's this joint.
*
* [1] http://leaflet.cloudmade.com/
* [2] http://code.google.com/p/overlay-tiler/
*
*/

define(function(require) {
    var LeafletAffineImageOverlay = function(map, image, canvasId, options) {
        // The leaflet instance
        var map = map;
        // The image element that'll be in the overlay.
        var image = image;
        // The id the canvas element will be given.
        var canvasId = canvasId;
        // The html canvas element.
        var canvas = null;
        // The canvas drawing context
        var ctx = null;
        // Markers at the corners can be used for arbitrary transformation.
        var affineMarkers = [];
        // Array of image pixel locations that match up with affineMarkers
        var imageLocations = null;
        // Layer containing the affine markers
        var affineMarkerLayer = null;
        // Options hash
        var options = options;

        // Sets up the overlay
        function init() {
            if (!options) {
                options = {};
            }

            insertCanvas();
            ctx = canvas.getContext('2d');
            generateMarkers();
            setupListeners();
            render();

            return;
        }

        // Sets up the listeners needed to keep the overlay canvas in sync with 
        // the markers on the map.
        function setupListeners() {
            map.on('move', render);
            for (i in affineMarkers) {
                affineMarkers[i].on('drag', render);
            }
        }

        // Generates the marker objects and adds them to the map
        function generateMarkers() {
            var center = latlngToContainerPoint(map.getCenter()); 

            var north = center.y
            var south = center.y + image.height;
            var west = center.x
            var east = center.x + image.width;

            var nw = new L.Point(west, north);
            var ne = new L.Point(east, north);
            var se = new L.Point(east, south);

            affineMarkers.push(createMarkerAtContainerPoint(nw));
            affineMarkers.push(createMarkerAtContainerPoint(ne));
            affineMarkers.push(createMarkerAtContainerPoint(se));

            affineMarkerLayer = new L.LayerGroup();
            for (i in affineMarkers) {
                affineMarkerLayer.addLayer(affineMarkers[i]);
            }
            map.addLayer(affineMarkerLayer);

            imageLocations = [];
            imageLocations.push([0,0]);
            imageLocations.push([image.width, 0]);
            imageLocations.push([image.width, image.height]);
        }

        // Returns a marker object at the given container location
        function createMarkerAtContainerPoint(container_point) {
            var latlng = containerPointToLatlng(container_point);

            // Use the custom icon, or fall back on the default one if it's
            // not defined.
            var icon;
            if (options.icon) {
                icon = new options.icon();
            } else {
                icon = new L.Icon.Default();
            }
            console.log(icon);
            return new L.Marker(latlng, {
                draggable: true,
                icon: icon,
            });
        }

        // Creates and inserts a canvas element with the same dimensions as the
        // map's container by appending to the map container's parent.
        function insertCanvas() {
            canvas = document.createElement('canvas');
            var mapSize = map.getSize();
            canvas.id = canvasId;
            canvas.width = mapSize.x;
            canvas.height = mapSize.y;
            $(map._container.parentNode).append(canvas); // FIXME better way?
            return;
        }

        // Converts a latlng on the world to a pixel coordinate in the map's 
        // div.
        function latlngToContainerPoint(latlng) {
            var pixel_on_world = map.latLngToLayerPoint(latlng);
            var pixel_in_container = 
                map.layerPointToContainerPoint(pixel_on_world);
            return pixel_in_container;
        }

        // Converts a pixel coordinate in the map's div to a latlng on the 
        // world.
        function containerPointToLatlng(containerPoint) {
            var pixelOnWorld = map.containerPointToLayerPoint(containerPoint);
            var latlng = map.layerPointToLatLng(pixelOnWorld);
            return latlng;
        }

        // Renders the overlay to the given canvas context.
        function render() {
            ctx.save();
            clearCanvas();

            var marker0 = latlngToContainerPoint(affineMarkers[0].getLatLng());
            var marker1 = latlngToContainerPoint(affineMarkers[1].getLatLng());
            var marker2 = latlngToContainerPoint(affineMarkers[2].getLatLng());

            var m11 = (marker1.x - marker0.x) / image.width;
            var m12 = (marker1.y - marker0.y) / image.width;
            var m21 = (marker2.x - marker1.x) / image.height;
            var m22 = (marker2.y - marker1.y) / image.height;
            var dx = marker0.x;
            var dy = marker0.y;

            ctx.setTransform(
                m11, m12,
                m21, m22,
                dx,  dy
            );
            ctx.globalAlpha = 0.5;
            ctx.drawImage(image, 0,0);

            ctx.restore();
            return;
        }

        // Clear the canvas so it may be redrawn
        function clearCanvas() {
            ctx.clearRect(0,0, canvas.width, canvas.height);
            return;
        }

        // Return a list of ground control points that reflect the current state
        // of the overlay.  Ground control point objects have two attributes 
        // containing two-element arrays that express a coordinate pair,
        // image_location, and world_location.  The former being a pixel 
        // location on the image (x,y), the later being a location on the world
        // (lng,lat).
        function getGcpList() {
            var gcps = [];
            for (i in affineMarkers) {
                var image_loc = imageLocations[i];
                var world_loc = affineMarkers[i].getLatLng();
                gcps.push({
                    image_location: image_loc,
                    world_location: [world_loc.lng, world_loc.lat]
                });
            }
            return gcps;
        }

        // TODO other stuff: opacity control, show/hide markers, non-ass ui 
        // improvements, make an actual leaflet layer thing, probably more.

        init();
        return {
            getGcpList: getGcpList,
        };
    };

    return LeafletAffineImageOverlay;
});

