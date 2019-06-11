// const bbox = turf.bbox(seoulhousingpricewgs);
// const cellSide = 0.3;
// const options = {};
// var cleanHexGrid =[];
// var hexGrid = turf.hexGrid(bbox, cellSide, options);    
// hexGrid.features.forEach(f => {
//     f.properties = { density: Math.random() };
// });
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

var geojson = geojson2h3.h3SetToFeatureCollection(
    Object.keys(hexset),
    hex => ({densityvalue: hexset[hex]})
);

var geojson = turf.collect(geojson, seoulhousingpricewgs, 'A15', 'values');
var geojson = turf.collect(geojson, seoulhousingpricewgs, 'A9', 'types');

geojson.features.forEach(f => {
    f.properties.count = f.properties.types.length;
    f.properties.values = _.mean(f.properties.values);

});

// var matchingFeatures = hexGrid.features.filter(function (feature){ 
//     return feature.properties.types.length > 0 
// })

// const datamin = turf.sample(seoulhousingpricewgs, 100);

var hexpricemax = _.max(_.map(geojson.features, _.property('properties.values')));
var hexpricemin = _.min(_.map(geojson.features, _.property('properties.values')));
var hexcountmax = _.max(_.map(geojson.features, _.property('properties.count')));
var hexcountmin = _.min(_.map(geojson.features, _.property('properties.count')));

var colorLinearScale = d3.scaleLinear()
                .domain([hexpricemin, hexpricemax])
                .range([0.00,1.00]);

var valueLinearScale = d3.scaleLinear()
                .domain([hexpricemin, hexpricemax])
                .range([0.00,3000.00]);

var countLinearScale = d3.scaleLinear()
                .domain([hexcountmin, hexcountmax])
                .range([0.50,2.0]);

var alphaLinearScale = d3.scaleLinear()
                .domain([hexpricemin, hexpricemax])
                // .domain([hexcountmin, hexcountmax])
                .range([50,300]);

geojson.features.forEach(f=>{
    f.properties.scale = countLinearScale(f.properties.count);
    var fcolor = rgbVal(d3.interpolateSpectral(1-colorLinearScale(f.properties.values)));
    fcolor.push(Math.round(alphaLinearScale(f.properties.values)));
    f.properties.color = fcolor;
});

var geojson = geojson.features.map(f => turf.transformScale(f, f.properties.scale)); 

// var collection = turf.featureCollection(scaledFeatures);



const {DeckGL, GeoJsonLayer} = deck;

const pointLayer = new ScatterplotLayer({
    id: 'scatter-plot',
    data: seoulhousingpricewgs.features,
    radiusScale: 10,
    radiusMinPixels: 0.5,
    getPosition: d => turf.getCoords(d),
})

const geojsonLayer = new GeoJsonLayer({
    data: geojson.features,
    opacity: 1,
    stroked: true,
    filled: true,
    extruded: true,
    wireframe: false,
    fp64: true,
    getElevation: f => valueLinearScale(f.properties.values),
    // getFillColor: f => rgbVal(d3.interpolateSpectral(1-f.properties.value)),
    getFillColor: f => f.properties.color,
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
<div><div>${object.properties.value} / m<sup>2</sup></div></div>
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
