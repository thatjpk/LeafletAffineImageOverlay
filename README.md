*Deprecated*: Check out https://github.com/fedealconada/Leaflet.AffineImage

[@fedealconada][3] greatly improved this by making it an actual leaflet layer,
which is much better; you should use his instead.  This repository remains
for posterity.

A super-hacky overlay for [leaflet][1] that lets you display an image on top of
the map, transform it using three anchors, and output ground control points
you can pass to gdal_translate.  (Rule #2: Inspired by Chris Broadfoot's 
[overlay-tiler][2].)
      
This should probably end up as a Leaflet layer object that you can add with
map.addLayer(), but until then, there's this joint.

[1]: http://leaflet.cloudmade.com/
[2]: http://code.google.com/p/overlay-tiler/
[3]: https://github.com/fedealconada

Look at index.html and style.css for a usage example.

Works in Firefox 10, and Chromium 17.  Probably breaks on some other browsers.
