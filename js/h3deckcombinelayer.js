
var config = ({
    lng: -122.2,
    lat: 37.7923539,
    zoom: 10.5,
    fillOpacity: 0.75,
    colorScale: ['#ffffD9', '#50BAC3', '#1A468A']
});

var h3Resolution = 9;


// var hexset = countPoints(datamin);
// var hexset = bufferPoints(datamin, kmToRadius(1));
var hexset = bufferPointsLinear(seoulhousingpricewgs, kmToRadius(0.1));

var schoolsLayer = school(seouledu);
var resLayer = residential(seoulhousingpricewgs);
var metroLayer = normalizeLayer(bufferPointsLinear(seoulmetro, kmToRadius(1)));

var mapLayers = [
    {hexagons: schoolsLayer, weight: 0.5},
    {hexagons: metroLayer, weight: 0.5},
    {hexagons: resLayer, weight: 0.5},
];

var combinedLayers = combineLayers(mapLayers);

var geojson = geojson2h3.h3SetToFeatureCollection(
    Object.keys(combinedLayers),
    hex => ({value: combinedLayers[hex]})
);

const {DeckGL, GeoJsonLayer} = deck;

const pointLayer = new ScatterplotLayer({
    id: 'scatter-plot',
    data: seoulmetro.features,
    radiusScale: 10,
    radiusMinPixels: 0.5,
    getPosition: d => turf.getCoords(d),
})

const geojsonLayer = new GeoJsonLayer({
    data: geojson.features,
    opacity: 0.5,
    stroked: true,
    filled: true,
    extruded: false,
    wireframe: false,
    fp64: true,
    // getElevation: f => valueLinearScale(f.properties.values),
    getFillColor: f => rgbVal(d3.interpolateSpectral(1-f.properties.value)),
    getLineColor: [255, 255, 255, 255],
    getLineWidth: 2,
    pickable: true,
    onHover: updateTooltip
});

new DeckGL({
    mapboxApiAccessToken: 'pk.eyJ1IjoidGthaG5nIiwiYSI6ImNqOTU3aWtnejRldGgycnF6d3JueG5wb2IifQ.vOYkEc5_mcoA2gtILL5ZmA',
    mapStyle: 'mapbox://styles/mapbox/dark-v9',
    latitude: 37.518,
    longitude: 126.994,
    zoom: 11,
    maxZoom: 16,
    pitch: 60,
    bearing: 150,
    layers: [geojsonLayer, pointLayer]
});

const OPTIONS = ['school', 'coverage', 'upperPercentile'];

function combineLayers(mapLayers){
    const combined = {};
    mapLayers.forEach(({hexagons, weight}) => {
      Object.keys(hexagons).forEach(hex => {
        combined[hex] = (combined[hex] || 0) + hexagons[hex] * weight;
      });
    });
    return normalizeLayer(combined);
}

function residential(geojson){
    const layer = {};
    geojson.features.forEach(feature => {
        const [lng, lat] = feature.geometry.coordinates;
        const h3Index = h3.geoToH3(lat, lng, h3Resolution);
        layer[h3Index] = (layer[h3Index] || 0) + 1;
    });
    return normalizeLayer(layer);
}

function school(geojson) {
    const layer = {};
    geojson.features.forEach(feature => {
        const [lng, lat] = feature.geometry.coordinates;
        const h3Index = h3.geoToH3(lat, lng, h3Resolution);
        // Add school hex
        layer[h3Index] = (layer[h3Index] || 0) + 1;
        // add surrounding kRing, with less weight
        h3.hexRing(h3Index, 1).forEach(neighbor => {
            layer[neighbor] = (layer[neighbor] || 0) + 0.5;
        });
    });
    return normalizeLayer(layer);
}

function bufferPoints(geojson, radius) {
    const layer = {};
    geojson.features.forEach(feature => {
    const [lng, lat] = feature.geometry.coordinates;
    const stationIndex = h3.geoToH3(lat, lng, h3Resolution);
    const ring = h3.kRing(stationIndex, radius);
    ring.forEach(h3Index => {
        layer[h3Index] = (layer[h3Index] || 0) + 1;
    });
    });
    return normalizeLayer(layer, true);
}

function bufferPointsLinear(geojson, radius) {
    const layer = {};
    geojson.features.forEach(feature => {
    const [lng, lat] = feature.geometry.coordinates;
    const stationIndex = h3.geoToH3(lat, lng, h3Resolution);
    // add surrounding multiple surrounding rings, with less weight in each
    const rings = h3.kRingDistances(stationIndex, radius);
    const step = 1 / (radius + 1);
    rings.forEach((ring, distance) => {
        ring.forEach(h3Index => {
        layer[h3Index] = (layer[h3Index] || 0) + 1 - distance * step;
        })
    });
    });
    return normalizeLayer(layer);
}

function normalizeLayer(layer, zeroBaseline = false) {
    const hexagons = Object.keys(layer);
    // Pass one, get max (and min if needed)
    const max = hexagons.reduce((max, hex) => Math.max(max, layer[hex]), -Infinity);
    const min = zeroBaseline ? 0 :
        hexagons.reduce((min, hex) => Math.min(min, layer[hex]), Infinity);
    // Pass two, normalize
    hexagons.forEach(hex => {
    layer[hex] = (layer[hex] - min) / (max - min); 
    });
    return layer;
}

// Transform a kilometer measurement to a k-ring radius
function kmToRadius(km) {
    return Math.floor(km / h3.edgeLength(h3Resolution, h3.UNITS.km));
}

function countPoints(geojson) {
    const layer = {};
    geojson.features.forEach(feature => {
    const [lng, lat] = feature.geometry.coordinates;
    const h3Index = h3.geoToH3(lat, lng, h3Resolution);
    layer[h3Index] = (layer[h3Index] || 0) + 1;
    });
    return normalizeLayer(layer, true);
}

function rgbVal(c) {
    let rgb = _.values(d3.color(c));
    rgb.splice(-1,1);
    return rgb;
}

function updateTooltip({x, y, object}) {
    const tooltip = document.getElementById('tooltip');

    if (object) {
    tooltip.style.top = `${y}px`;
    tooltip.style.left = `${x}px`;
    tooltip.innerHTML = `
<div><b>Average Property Value &nbsp;</b></div>
<div><div>${object.properties.values} / m<sup>2</sup></div></div>
<div><b>scale</b></div>
<div>${object.properties.scale}</div>
<div><b>count</b></div>
<div>${Math.round(object.properties.count)}</div>
<div><b>color</b></div>
<div>${object.properties.color}</div>
`;
    } else { 
    tooltip.innerHTML = '';
    }
}
