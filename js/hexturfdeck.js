const bbox = turf.bbox(seoulhousingpricewgs);
const cellSide = 0.3;
const options = {};
var cleanHexGrid =[];
var hexGrid = turf.hexGrid(bbox, cellSide, options);    
hexGrid.features.forEach(f => {
  f.properties = { density: Math.random() };
});

var hexGrid = turf.collect(hexGrid, seoulhousingpricewgs, 'A15', 'values');
var hexGrid = turf.collect(hexGrid, seoulhousingpricewgs, 'A9', 'types');


hexGrid.features.forEach(f => {
  f.properties.count = f.properties.types.length;
  f.properties.values = _.mean(f.properties.values);

});


var matchingFeatures = hexGrid.features.filter(function (feature){ 
   return feature.properties.types.length > 0 
})



// var scaledFeatures = turf.transformScale(collection, 0.5);

var hexpricemax = _.max(_.map(matchingFeatures, _.property('properties.values')));
var hexpricemin = _.min(_.map(matchingFeatures, _.property('properties.values')));
var hexcountmax = _.max(_.map(matchingFeatures, _.property('properties.count')));
var hexcountmin = _.min(_.map(matchingFeatures, _.property('properties.count')));

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


matchingFeatures.forEach(f=>{
  f.properties.scale = countLinearScale(f.properties.count);
  var fcolor = rgbVal(d3.interpolateSpectral(1-colorLinearScale(f.properties.values)));
  fcolor.push(Math.round(alphaLinearScale(f.properties.values)));
  f.properties.color = fcolor;
});

var scaledFeatures = matchingFeatures.map(f => turf.transformScale(f, f.properties.scale)); 

var collection = turf.featureCollection(scaledFeatures);

const {DeckGL, GeoJsonLayer} = deck;

const geojsonLayer = new GeoJsonLayer({
  data: collection,
  opacity: 1,
  stroked: true,
  filled: true,
  extruded: true,
  wireframe: false,
  fp64: true,

  getElevation: f => valueLinearScale(f.properties.values),
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
  layers: [geojsonLayer]
});

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
