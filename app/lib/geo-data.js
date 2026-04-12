/**
 * geo-data.js — Pure geographic data and helper functions
 * --------------------------------------------------------
 * This file has ZERO dependencies (no Leaflet, no DOM).
 * It is shared between:
 *   - The browser (loaded as a <script> tag; exposes window.GeoData)
 *   - Node.js unit tests (loaded via require(); exports GeoData)
 *
 * Nothing in here may reference `L`, `document`, `window`, or `fetch`.
 *
 * Wrapped in an IIFE so internal const/let declarations stay scoped
 * to this file and do not leak into the browser's global scope —
 * preventing "already declared" conflicts with map.js.
 */

(function () {
'use strict';

/* ─── Fall Line coordinates ─────────────────────────────────────
   The Atlantic Seaboard Fall Line from Peekskill NY / Hudson Highlands south
   through Paterson NJ, New Brunswick NJ, Trenton NJ, Philadelphia PA,
   Baltimore MD, Washington DC, Richmond VA, Raleigh NC, Columbia SC,
   Augusta GA, Macon GA to Columbus GA. Runs roughly NNE–SSW, tracing the
   boundary between ancient crystalline Piedmont bedrock and soft Coastal
   Plain sediments.

   Key anchors (river crossings):
     Hudson at Peekskill NY ≈ 41.290°N, 73.920°W
     Passaic at Paterson NJ  ≈ 40.917°N, 74.174°W
     Raritan at New Brunswick NJ ≈ 40.490°N, 74.445°W
     Delaware at Trenton NJ ≈ 40.220°N, 74.770°W
     Potomac at Great Falls  ≈ 39.000°N, 77.245°W
     Rappahannock at Fredericksburg ≈ 38.302°N, 77.468°W
     James at Belle Isle, Richmond ≈ 37.527°N, 77.464°W
     Appomattox at Petersburg ≈ 37.222°N, 77.395°W
     Roanoke at Roanoke Rapids ≈ 36.462°N, 77.655°W
     Neuse at Falls of Neuse, Raleigh ≈ 35.897°N, 78.648°W
     Savannah at Augusta GA ≈ 33.470°N, 82.020°W
     Ocmulgee at Macon GA ≈ 32.840°N, 83.630°W
     Chattahoochee at Columbus GA ≈ 32.460°N, 84.990°W

   GeoJSON coordinate order: [longitude, latitude]
   Source: derived from USGS geological survey maps of the
           Atlantic Coastal Plain / Piedmont boundary.
   ────────────────────────────────────────────────────────────── */
const FALL_LINE_COORDS = [
  // === New York / New Jersey (northeast extension) ===
  [-73.920, 41.290],   // Peekskill NY — Hudson Highlands boundary — northern terminus
  [-74.140, 41.120],   // Suffern NY / Ramapo River gorge, NY–NJ state border
  [-74.300, 41.000],   // Pompton NJ / Ramapo–Pompton River falls
  [-74.174, 40.917],   // Paterson NJ / Great Falls of the Passaic — Hamilton's industrial city
  [-74.310, 40.710],   // Passaic County / Watchung escarpment
  [-74.380, 40.600],   // Bound Brook NJ / South Branch Raritan falls
  [-74.445, 40.490],   // New Brunswick NJ / Raritan River falls
  [-74.625, 40.320],   // Princeton Junction NJ / Millstone Brook transition
  // === Pennsylvania / New Jersey / Delaware ===
  [-74.770, 40.220],   // Trenton NJ / Delaware River falls
  [-75.100, 40.000],   // Philadelphia PA / Schuylkill and Delaware falls
  [-75.540, 39.740],   // Wilmington DE / Brandywine Creek falls
  // === Maryland (north of DC) ===
  [-76.000, 39.720],   // MD/PA border
  [-76.080, 39.540],   // Susquehanna River / Havre de Grace
  [-76.340, 39.520],   // Bel Air / Bush River
  [-76.440, 39.440],   // Gunpowder Falls
  [-76.620, 39.330],   // Baltimore / Jones Falls
  [-76.730, 39.270],   // Elkridge / Patapsco River
  [-76.900, 39.090],   // Laurel / Patuxent River falls
  // === Washington DC / Potomac ===
  [-77.245, 39.000],   // Great Falls of the Potomac (Mather Gorge rapids)
  [-77.170, 38.905],   // Little Falls / Georgetown — head of Potomac tidal zone
  [-77.130, 38.870],   // Arlington / Rosslyn
  [-77.150, 38.830],   // Alexandria area
  // === Northern Virginia ===
  [-77.220, 38.770],   // Franconia / Springfield
  [-77.290, 38.700],   // Prince William / Fairfax border
  [-77.360, 38.600],   // Quantico / Triangle
  [-77.420, 38.490],   // Stafford County
  // === Fredericksburg ===
  [-77.468, 38.302],   // Fredericksburg — Rappahannock River falls
  [-77.460, 38.150],   // Caroline County
  [-77.455, 38.000],   // Southern Caroline County
  [-77.450, 37.830],   // Northern Hanover / Ashland approaches
  // === Richmond area ===
  [-77.445, 37.680],   // Northern Hanover County
  [-77.448, 37.650],   // Chamberlayne corridor
  [-77.455, 37.610],   // Near Laurel / Staples Mill
  [-77.460, 37.575],   // North Richmond
  [-77.462, 37.555],   // Near Lombardy / Brook Road
  [-77.463, 37.540],   // Northern downtown / Jackson Ward
  [-77.464, 37.527],   // James River rapids — Belle Isle (primary anchor)
  [-77.463, 37.512],   // Manchester / south bank
  [-77.460, 37.495],   // Southern Richmond / Chesterfield line
  [-77.455, 37.465],   // Northern Chesterfield
  [-77.450, 37.430],   // Central Chesterfield
  [-77.445, 37.390],   // Southern Chesterfield
  [-77.442, 37.350],   // Colonial Heights
  // === Petersburg / Southside Virginia ===
  [-77.395, 37.222],   // Petersburg — Appomattox River falls
  [-77.420, 37.100],   // Dinwiddie / Sussex County
  [-77.480, 36.950],   // Emporia approaches
  [-77.537, 36.686],   // Emporia — Meherrin River
  // === North Carolina fall line ===
  [-77.655, 36.462],   // Roanoke Rapids — Roanoke River falls
  [-77.760, 36.280],   // Warren County, NC
  [-77.960, 36.150],   // Vance / Franklin County
  [-78.150, 36.050],   // Granville County
  [-78.400, 35.950],   // Durham County western edge
  [-78.570, 35.900],   // Durham — Eno / Flat Rivers area
  [-78.648, 35.897],   // Falls of Neuse — Raleigh anchor
  [-78.720, 35.820],   // South Raleigh / Wake County
  [-78.820, 35.700],   // Southwest Wake County
  // === Southern North Carolina ===
  [-78.870, 35.560],   // Fuquay-Varina / Harnett County
  [-78.870, 35.390],   // Cape Fear River near Lillington
  [-79.170, 35.350],   // Western Harnett / Lee County
  [-79.450, 35.170],   // Moore County / Southern Pines
  [-79.780, 34.930],   // Rockingham / Pee Dee River falls
  [-79.460, 34.770],   // Laurinburg / Scotland County
  [-79.010, 34.620],   // Lumberton / Lumber River
  [-78.700, 34.270],   // Whiteville / Columbus County
  [-78.350, 33.900],   // Brunswick County / NC–SC border
  // === South Carolina ===
  [-79.050, 33.800],   // Conway SC / Waccamaw River
  [-79.830, 33.700],   // Kingstree SC / Black River
  [-80.340, 33.900],   // Sumter SC / Wateree River falls
  [-81.000, 34.000],   // Columbia SC / Congaree-Saluda confluence — "The Falls"
  [-81.720, 33.560],   // Aiken SC / South Fork Edisto
  [-82.020, 33.470],   // Augusta GA / Savannah River falls
  // === Georgia ===
  [-82.500, 33.310],   // Wilkes County GA / Ogeechee River headwaters
  [-83.230, 33.080],   // Milledgeville GA / Oconee River falls
  [-83.630, 32.840],   // Macon GA / Ocmulgee River falls
  [-84.120, 32.620],   // Fort Valley / Peach County GA
  [-84.990, 32.460],   // Columbus GA / Chattahoochee River falls — southern terminus
];

const FALL_LINE_GEOJSON = {
  type: 'Feature',
  properties: {
    name: 'Atlantic Seaboard Fall Line',
    note: 'Approximate — based on published USGS geological surveys',
  },
  geometry: {
    type: 'LineString',
    coordinates: FALL_LINE_COORDS,
  },
};


/* ─── Region polygons ───────────────────────────────────────────
   Two polygons covering the DC → Richmond → Raleigh corridor,
   split at the fall line. They share the fall line as their
   common boundary.

   Bounding box: ~35.40–39.20°N, ~76.70–79.20°W
   ────────────────────────────────────────────────────────────── */

// BBOX: corridor bounding box — used by isInCorridor() for search relevance
const BBOX_NORTH =  41.400;   // above Peekskill NY / Hudson Highlands
const BBOX_SOUTH =  32.300;   // below Columbus GA / Chattahoochee River falls
const BBOX_EAST  = -73.800;   // east of Peekskill NY
const BBOX_WEST  = -85.100;   // west of Columbus GA

// REGION: full corridor extent — used for Coastal Plain & Piedmont polygon bounds
const REGION_NORTH =  41.400;  // Peekskill NY / Hudson Highlands
const REGION_SOUTH =  32.300;  // Columbus GA / Chattahoochee River falls
const REGION_EAST  = -73.800;  // east of Peekskill NY
const REGION_WEST  = -85.100;  // west of Columbus GA

const fallLineReversed = [...FALL_LINE_COORDS].reverse();

/* ─── Atlantic coastline (eastern boundary of Coastal Plain) ────────────────
   US Atlantic coast from Peekskill NY south to the SC/GA coast, used as the
   eastern boundary of COASTAL_PLAIN_GEOJSON instead of an arbitrary straight
   longitude line. Prevents the Coastal Plain overlay from shading open ocean.

   Algorithm: for each 0.2° latitude band, keep the easternmost coastline
   point across all Natural Earth 50m features. This naturally jumps across
   bay mouths (Delaware Bay, Chesapeake Bay, Pamlico Sound) without tracing
   bay interiors that would create self-intersecting polygon rings.

   Source: Natural Earth 50m Coastline — public domain.
   Pipeline: node scripts/extract-coastline.js ne_50m_coastline.geojson
   ────────────────────────────────────────────────────────────── */
const EAST_COAST_COORDS = [
  // US Atlantic coastline, N→S, outer (ocean-facing) coast.
  // Bay mouths (Delaware Bay, Chesapeake Bay, Pamlico Sound) are
  // jumped by keeping the easternmost point per 0.2° latitude band.
  // Source: Natural Earth 50m Coastline (public domain).
  // Generated: node scripts/extract-coastline.js ne_50m_coastline.geojson
  // First point = fall line N terminus (Peekskill NY) for polygon closure.
  [-73.920, 41.290],  // Peekskill NY — polygon anchor (= fall line N terminus)
  [-73.583, 41.022],  // NJ/NY coast — Raritan Bay area
  [-73.574, 40.920],  // Sandy Hook gateway
  [-73.799, 40.641],  // NJ coast — Sea Bright area
  [-73.621, 40.600],  // NJ coast
  [-73.958, 40.328],  // NJ coast — Manasquan area
  [-74.004, 40.171],  // NJ coast — Point Pleasant
  [-74.049, 39.923],  // NJ coast — Barnegat area
  [-74.080, 39.788],  // NJ coast — Toms River area
  [-74.250, 39.529],  // NJ coast — Ship Bottom / Long Beach Island
  [-74.429, 39.387],  // NJ coast — Atlantic City
  [-74.794, 39.002],  // NJ coast — Stone Harbor / Wildwood
  [-74.923, 38.941],  // Cape May NJ
  [-75.084, 38.723],  // Cape Henlopen DE — bay mouth jump from Cape May
  [-75.036, 38.503],  // Rehoboth Beach / Lewes DE
  [-75.051, 38.383],  // Assateague Island north / Ocean City MD
  [-75.136, 38.181],  // Assateague Island south
  [-75.333, 37.888],  // Chincoteague Island VA
  [-75.596, 37.631],  // Wallops Island VA
  [-75.587, 37.559],  // Eastern Shore VA
  [-75.854, 37.297],  // Eastern Shore VA — approaching Cape Charles
  [-75.934, 37.152],  // Cape Charles VA — tip of Delmarva Peninsula
  [-75.966, 36.862],  // Virginia Beach / Cape Henry — bay mouth jump
  [-75.890, 36.657],  // Currituck Banks / NC state line
  [-75.857, 36.551],  // NC outer banks — Nags Head area
  [-75.758, 36.229],  // NC outer banks — continuing south
  [-75.728, 36.104],  // NC outer banks — Kill Devil Hills
  [-75.534, 35.819],  // NC outer banks — Outer Banks / Oregon Inlet
  [-75.479, 35.717],  // NC outer banks — Outer Banks mid-section
  [-75.456, 35.564],  // NC outer banks — approaching Cape Hatteras
  [-75.509, 35.280],  // Cape Hatteras NC — southernmost Outer Banks tip
  [-75.782, 35.190],  // Core Banks — south of Cape Hatteras
  [-76.207, 34.939],  // Cape Lookout area
  [-76.437, 34.756],  // Beaufort / Morehead City NC
  [-77.380, 34.527],  // Surf City / Topsail Island NC
  [-77.650, 34.358],  // Wrightsville Beach NC
  [-77.861, 34.149],  // Wilmington NC area
  [-77.928, 33.940],  // Cape Fear NC
  [-78.841, 33.724],  // Brunswick County / Holden Beach NC
  [-79.138, 33.406],  // Myrtle Beach SC
  [-79.194, 33.244],  // Pawleys Island SC
  [-79.229, 33.185],  // SC coast
  [-79.615, 32.909],  // Georgetown SC
  [-79.805, 32.787],  // SC coast — approaching Charleston
  [-80.123, 32.589],  // Charleston SC / Isle of Palms
  [-80.486, 32.352],  // SC coast — southern corridor limit
];

const COASTAL_PLAIN_GEOJSON = {
  type: 'Feature',
  properties: {
    region: 'coastal',
    name: 'Coastal Plain (Tidewater)',
    description:
      'East of the fall line. Flat terrain underlain by soft sedimentary ' +
      'deposits — sandy soils with fast drainage and low water retention. ' +
      'Rivers are tidal and navigable to the sea. Extends from the New Jersey ' +
      'coast south through the Virginia Tidewater, North Carolina Outer Banks, ' +
      'and South Carolina coast to the Georgia border.',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      ...EAST_COAST_COORDS,         // north→south along outer Atlantic coast
      ...fallLineReversed,          // south→north along fall line (west boundary)
      EAST_COAST_COORDS[0],         // close polygon at Peekskill NY
    ]],
  },
};

const PIEDMONT_GEOJSON = {
  type: 'Feature',
  properties: {
    region: 'piedmont',
    name: 'Piedmont',
    description:
      'West of the fall line. Rolling hills underlain by ancient crystalline ' +
      'bedrock (granite, gneiss, schist). Heavy clay soils with poor drainage. ' +
      'Rivers run fast over rapids at the fall line. Extends from the Maryland ' +
      'Piedmont through central Virginia to the North Carolina Piedmont Triad ' +
      'and Sandhills, bounded by the Blue Ridge and Appalachians to the west.',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [REGION_WEST, REGION_NORTH],  // NW corner (Appalachians / MD-PA border lat)
      ...FALL_LINE_COORDS,          // north→south along fall line (east boundary)
      [REGION_WEST, REGION_SOUTH],  // SW corner (Appalachians / NC-SC border lat)
      [REGION_WEST, REGION_NORTH],  // close polygon
    ]],
  },
};


/* ─── Map styles ────────────────────────────────────────────── */
const STYLES = {
  coastal: {
    fillColor:   '#4682DC',
    fillOpacity: 0.18,
    color:       '#4682DC',
    weight:      0,
    interactive: true,
  },
  piedmont: {
    fillColor:   '#C88232',
    fillOpacity: 0.18,
    color:       '#C88232',
    weight:      0,
    interactive: true,
  },
  fallLine: {
    color:       '#e84393',
    weight:      3,
    opacity:     0.9,
    dashArray:   null,
    interactive: true,
  },
  regionHover: {
    fillOpacity: 0.32,
  },
};


/* ─── Native plant recommendations by ecoregion ─────────────────
   Curated lists of representative native plants for the Piedmont,
   Coastal Plain, and fall line ecotone. Used in region and fall line
   popups. Each entry has:
     name   — common name
     latin  — binomial (genus species)
     type   — 'tree' | 'shrub' | 'perennial' | 'grass' | 'fern'
     note   — one-line habitat / soil context
   ────────────────────────────────────────────────────────────── */
const NATIVE_PLANTS = {
  piedmont: [
    {
      name:  'Post Oak',
      latin: 'Quercus stellata',
      type:  'tree',
      note:  'Dryland oak of dry Piedmont ridges and clay flats',
    },
    {
      name:  'Winged Elm',
      latin: 'Ulmus alata',
      type:  'tree',
      note:  'Common Piedmont canopy tree; corky wings on branches',
    },
    {
      name:  'Carolina Silverbell',
      latin: 'Halesia carolina',
      type:  'tree',
      note:  'Spring-flowering understory; Piedmont ravines and stream banks',
    },
    {
      name:  'Wild Blue Indigo',
      latin: 'Baptisia australis',
      type:  'perennial',
      note:  'Deep taproot breaks Piedmont clay; blue spring flowers',
    },
    {
      name:  'Little Bluestem',
      latin: 'Schizachyrium scoparium',
      type:  'grass',
      note:  'Native bunch grass; thrives in heavy Piedmont clay soils',
    },
    {
      name:  'Pawpaw',
      latin: 'Asimina triloba',
      type:  'shrub',
      note:  'Largest native fruit; riparian corridors and bottomlands',
    },
  ],
  coastal: [
    {
      name:  'Loblolly Pine',
      latin: 'Pinus taeda',
      type:  'tree',
      note:  'Dominant Coastal Plain canopy; thrives in sandy, well-drained soils',
    },
    {
      name:  'Sweetbay Magnolia',
      latin: 'Magnolia virginiana',
      type:  'tree',
      note:  'Tidewater wetland indicator; semi-evergreen, fragrant flowers',
    },
    {
      name:  'Bald Cypress',
      latin: 'Taxodium distichum',
      type:  'tree',
      note:  'Iconic tidal swamp tree; knees emerge from saturated soils',
    },
    {
      name:  'Atlantic White Cedar',
      latin: 'Chamaecyparis thyoides',
      type:  'tree',
      note:  'Coastal Plain bogs and pocosins; important for black bears',
    },
    {
      name:  'Switchgrass',
      latin: 'Panicum virgatum',
      type:  'grass',
      note:  'Salt marsh edges and sandy Coastal Plain soils; erosion control',
    },
    {
      name:  'Venus Flytrap',
      latin: 'Dionaea muscipula',
      type:  'perennial',
      note:  'Endemic to NC Coastal Plain longleaf pine savannas; globally rare',
    },
  ],
  ecotone: [
    {
      name:  'Witch-Hazel',
      latin: 'Hamamelis virginiana',
      type:  'shrub',
      note:  'Blooms in autumn at fall line stream crossings; last native flower of the year',
    },
    {
      name:  'Wild Columbine',
      latin: 'Aquilegia canadensis',
      type:  'perennial',
      note:  'Rocky fall line slopes and outcrops; red-yellow spring flowers',
    },
    {
      name:  'Christmas Fern',
      latin: 'Polystichum acrostichoides',
      type:  'fern',
      note:  'Evergreen fern of fall line ravines; stays green through winter',
    },
    {
      name:  'Spicebush',
      latin: 'Lindera benzoin',
      type:  'shrub',
      note:  'Aromatic understory at fall line creek bottoms; early spring bloomer',
    },
    {
      name:  'Bloodroot',
      latin: 'Sanguinaria canadensis',
      type:  'perennial',
      note:  'Spring ephemeral on rich fall line slopes; fleeting white flowers',
    },
  ],
};

/**
 * Returns an HTML string listing native plants for a given ecoregion.
 * @param {'piedmont'|'coastal'|'ecotone'} region
 * @returns {string}  HTML fragment — empty string if region not found
 */
function makeNativePlantsSection(region) {
  const plants = NATIVE_PLANTS[region];
  if (!plants || plants.length === 0) return '';
  return (
    '<div class="plant-section">' +
      '<h4 class="plant-section-header">Native plants</h4>' +
      '<ul class="plant-list">' +
        plants.map(function (p) {
          return (
            '<li>' +
              '<span class="plant-name">' + p.name + '</span>' +
              ' <em class="plant-latin">' + p.latin + '</em>' +
              '<span class="plant-note">' + p.note + '</span>' +
            '</li>'
          );
        }).join('') +
      '</ul>' +
    '</div>'
  );
}


/* ─── Popup content generators ──────────────────────────────── */

/**
 * Returns an HTML string for a region feature popup.
 * @param {{ region: string, name: string, description: string }} props
 * @returns {string}
 */
function makeRegionPopup(props) {
  // No innerHTML or user-controlled strings — props come from our own GeoJSON.
  return (
    '<div class="popup-content">' +
      '<h3>' + props.name + '</h3>' +
      '<p>' + props.description + '</p>' +
      '<span class="region-tag ' + props.region + '">' + props.name + '</span>' +
      makeNativePlantsSection(props.region) +
    '</div>'
  );
}

/**
 * Returns an HTML string for the fall line popup.
 * @returns {string}
 */
function makeFallLinePopup() {
  return (
    '<div class="popup-content">' +
      '<h3>Atlantic Seaboard Fall Line</h3>' +
      '<p>' +
        'The geological boundary where ancient Piedmont crystalline rock meets ' +
        'soft Coastal Plain sediments. Rivers drop over rapids here — the last ' +
        'navigable point from the sea. Washington DC, Richmond VA, and Raleigh NC ' +
        'all grew up at or near this boundary.' +
      '</p>' +
      makeNativePlantsSection('ecotone') +
      '<p style="margin-top:8px; color:#888; font-size:0.75rem;">' +
        'This path is approximate. The true boundary is gradational over several miles.' +
      '</p>' +
    '</div>'
  );
}


/* ─── Geographic helper utilities ───────────────────────────── */

/**
 * Haversine distance in kilometers between two [lon, lat] points.
 * Used internally to verify the fall line anchor point in tests.
 * @param {[number, number]} a  [longitude, latitude]
 * @param {[number, number]} b  [longitude, latitude]
 * @returns {number} distance in km
 */
function haversineKm(a, b) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const c =
    sinLat * sinLat +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinLon * sinLon;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

/**
 * Returns the minimum distance in km from any fall line point to a target.
 * @param {[number, number]} target  [longitude, latitude]
 * @returns {number} minimum distance in km
 */
function minDistanceToFallLine(target) {
  return Math.min(
    ...FALL_LINE_COORDS.map((coord) => haversineKm(coord, target))
  );
}


/* ─── Plant Hardiness Zone helpers ──────────────────────────────
   Zone colors follow the USDA standard palette.
   Virginia spans approximately zones 5b–8b.
   Each zone = 10°F range; a/b half-zones = 5°F each.
   ────────────────────────────────────────────────────────────── */

const HARDINESS_ZONE_COLORS = {
  '5a': '#afd2e8', '5b': '#90bedd',
  '6a': '#72a9d2', '6b': '#5595c8',
  '7a': '#7ec87a', '7b': '#5aaf56',
  '8a': '#f5d63c', '8b': '#f5a800',
  '9a': '#f07800', '9b': '#e05000',
};

const HARDINESS_ZONE_INFO = {
  '5a': {
    tempRange:     '-20°F to -15°F (-29°C to -26°C)',
    description:   'Cool continental climate. Cold winters limit many broadleaf evergreens.',
    firstFrost:    'early October',
    lastFrost:     'early May',
    growingSeason: '~155 days',
    plants:        'forsythia, peonies, most hardy roses, crabapple, lilac',
  },
  '5b': {
    tempRange:     '-15°F to -10°F (-26°C to -23°C)',
    description:   'Cool continental climate. Long growing season with cold winters.',
    firstFrost:    'mid-October',
    lastFrost:     'late April',
    growingSeason: '~170 days',
    plants:        'forsythia, peonies, most roses, crabapple, Eastern redbud',
  },
  '6a': {
    tempRange:     '-10°F to -5°F (-23°C to -21°C)',
    description:   'Moderate climate. Suitable for a wide range of trees and shrubs.',
    firstFrost:    'late October',
    lastFrost:     'mid-April',
    growingSeason: '~180 days',
    plants:        'dogwood, azalea, boxwood, ornamental grasses, most roses',
  },
  '6b': {
    tempRange:     '-5°F to 0°F (-21°C to -18°C)',
    description:   'Moderate climate. Typical of the northern Virginia Piedmont and DC suburbs.',
    firstFrost:    'early November',
    lastFrost:     'early April',
    growingSeason: '~195 days',
    plants:        'dogwood, azalea, boxwood, crepe myrtle (marginal), American holly',
  },
  '7a': {
    tempRange:     '0°F to 5°F (-18°C to -15°C)',
    description:   'Mild winters. DC metro area and northern Virginia fall line corridor.',
    firstFrost:    'early–mid November',
    lastFrost:     'late March',
    growingSeason: '~210 days',
    plants:        'crepe myrtle, camellia (marginal), gardenia (marginal), Encore azaleas',
  },
  '7b': {
    tempRange:     '5°F to 10°F (-15°C to -12°C)',
    description:   'Mild winters. Richmond VA city and the fall line corridor through central Virginia and into Raleigh NC.',
    firstFrost:    'mid–late November',
    lastFrost:     'mid-March',
    growingSeason: '~220 days',
    plants:        'southern magnolia, camellia, gardenia, crepe myrtle, nandina',
  },
  '8a': {
    tempRange:     '10°F to 15°F (-12°C to -9°C)',
    description:   'Warm winters. Eastern Coastal Plain, Tidewater, and the Raleigh NC area. Broadleaf evergreens thrive.',
    firstFrost:    'late November',
    lastFrost:     'early–mid March',
    growingSeason: '~235 days',
    plants:        'fig, tea olive (osmanthus), live oak, pittosporum, loropetalum',
  },
  '8b': {
    tempRange:     '15°F to 20°F (-9°C to -7°C)',
    description:   'Very mild winters. Coastal Virginia near Hampton Roads.',
    firstFrost:    'early December',
    lastFrost:     'late February',
    growingSeason: '~250 days',
    plants:        'loquat, large crepe myrtle, sabal palm (marginal), gardenias freely',
  },
  '9a': {
    tempRange:     '20°F to 25°F (-7°C to -4°C)',
    description:   'Subtropical. Coastal Georgia and the South Carolina Lowcountry — rarely freezes hard.',
    firstFrost:    'late December',
    lastFrost:     'mid-February',
    growingSeason: '~295 days',
    plants:        'live oak, sago palm, sweet olive (osmanthus), camellias, wax myrtle, bougainvillea (marginal)',
  },
};

/**
 * Returns the fill color for a USDA hardiness zone string (e.g. "7b").
 * Falls back to a neutral grey for unknown zones.
 * @param {string} zone
 * @returns {string} CSS color
 */
function getZoneColor(zone) {
  return HARDINESS_ZONE_COLORS[zone] || '#cccccc';
}

/**
 * Returns display info for a zone.
 * @param {string} zone
 * @returns {{ tempRange: string, description: string, firstFrost: string, lastFrost: string, growingSeason: string, plants: string }}
 */
function getZoneInfo(zone) {
  return HARDINESS_ZONE_INFO[zone] || {
    tempRange:     'Unknown',
    description:   'No data available for this zone.',
    firstFrost:    'unknown',
    lastFrost:     'unknown',
    growingSeason: 'unknown',
    plants:        'unknown',
  };
}

/**
 * Returns an HTML string for a hardiness zone popup with five zone facts.
 * @param {string} zone  e.g. "7b"
 * @returns {string}
 */
function makeZonePopup(zone) {
  const info  = getZoneInfo(zone);
  const color = getZoneColor(zone);
  const row = function (label, value) {
    return (
      '<div class="zone-fact">' +
        '<span class="zone-fact-label">' + label + '</span>' +
        '<span class="zone-fact-value">' + value + '</span>' +
      '</div>'
    );
  };
  return (
    '<div class="popup-content">' +
      '<div class="zone-popup-header" style="border-left:3px solid ' + color + '">' +
        '<h3>Zone ' + zone + '</h3>' +
        '<span class="zone-badge" style="background:' + color + ';color:#1a1a2e">Zone ' + zone + '</span>' +
      '</div>' +
      '<p class="zone-desc">' + info.description + '</p>' +
      '<div class="zone-facts">' +
        row('Min. winter temp', info.tempRange) +
        row('First frost',      info.firstFrost) +
        row('Last frost',       info.lastFrost) +
        row('Growing season',   info.growingSeason) +
        row('Thrives here',     info.plants) +
      '</div>' +
    '</div>'
  );
}


/* ─── Fall Line city markers ─────────────────────────────────────
   Key metros founded at the head of navigation on each river
   crossing the fall line, listed north to south.

   Fields:
     name    — city name
     state   — 2-letter state code
     lat/lon — city centre coordinates (decimal degrees)
     river   — river at the fall line crossing
     region  — 'piedmont' | 'coastal'  (which side of the fall line)
     soil    — general soil description for that city
     zone    — USDA hardiness zone for the city centre
     note    — one-line founding / geographic context
   ────────────────────────────────────────────────────────────── */
const FALL_LINE_CITIES = [
  {
    name:   'Peekskill',
    state:  'NY',
    lat:     41.290,
    lon:    -73.920,
    river:  'Hudson River',
    region: 'piedmont',
    soil:   'Piedmont gneiss & granite soils',
    zone:   '6b',
    note:   'The Hudson Highlands mark the geological boundary between the Manhattan Prong and the Coastal Plain lowlands — the fall line\'s northern terminus.',
  },
  {
    name:   'Paterson',
    state:  'NJ',
    lat:     40.917,
    lon:    -74.174,
    river:  'Passaic River',
    region: 'piedmont',
    soil:   'Piedmont clay loam (Passaic series)',
    zone:   '6b',
    note:   'Founded 1792 by Alexander Hamilton as America\'s first planned industrial city, harnessing the 77-foot Great Falls of the Passaic.',
  },
  {
    name:   'New Brunswick',
    state:  'NJ',
    lat:     40.490,
    lon:    -74.445,
    river:  'Raritan River',
    region: 'coastal',
    soil:   'Coastal Plain sandy loam',
    zone:   '7a',
    note:   'Head of navigation on the Raritan; colonial trading port linking the Piedmont interior to New York Harbor.',
  },
  {
    name:   'Trenton',
    state:  'NJ',
    lat:     40.220,
    lon:    -74.770,
    river:  'Delaware River',
    region: 'coastal',
    soil:   'Coastal Plain sandy loam (Sassafras series)',
    zone:   '7a',
    note:   'Delaware River falls — New Jersey\'s capital; Washington crossed the Delaware here on Christmas night 1776.',
  },
  {
    name:   'Philadelphia',
    state:  'PA',
    lat:     40.000,
    lon:    -75.100,
    river:  'Schuylkill & Delaware Rivers',
    region: 'coastal',
    soil:   'Coastal Plain sandy loam',
    zone:   '7a',
    note:   'Penn\'s 1682 "Green Country Towne" sits where the Schuylkill drops from the Piedmont — the busiest colonial port in North America.',
  },
  {
    name:   'Wilmington',
    state:  'DE',
    lat:     39.740,
    lon:    -75.540,
    river:  'Brandywine Creek',
    region: 'coastal',
    soil:   'Coastal Plain sandy loam (Matapeake series)',
    zone:   '7a',
    note:   'Brandywine Creek falls powered colonial flour and paper mills; the DuPont gunpowder mill (1802) launched America\'s chemical industry here.',
  },
  {
    name:   'Baltimore',
    state:  'MD',
    lat:     39.270,
    lon:    -76.730,
    river:  'Patapsco River',
    region: 'piedmont',
    soil:   'Piedmont clay loam (Glenelg series)',
    zone:   '7b',
    note:   'Jones Falls and Patapsco River falls drove colonial flour mills; the Baltimore & Ohio Railroad (1827) followed the fall line corridor southwest.',
  },
  {
    name:   'Washington',
    state:  'DC',
    lat:     38.905,
    lon:    -77.030,
    river:  'Potomac River',
    region: 'coastal',
    soil:   'Coastal Plain sandy silt (Urban land)',
    zone:   '7b',
    note:   'Little Falls of the Potomac marked the head of tidal navigation; Georgetown grew as the fall line trading post before DC was founded in 1790.',
  },
  {
    name:   'Fredericksburg',
    state:  'VA',
    lat:     38.302,
    lon:    -77.468,
    river:  'Rappahannock River',
    region: 'piedmont',
    soil:   'Piedmont clay loam (Appling series)',
    zone:   '7b',
    note:   'Rappahannock River falls — platted 1728 as a tobacco inspection and ferry port; George Washington grew up across the river in King George County.',
  },
  {
    name:   'Richmond',
    state:  'VA',
    lat:     37.527,
    lon:    -77.464,
    river:  'James River',
    region: 'piedmont',
    soil:   'Piedmont clay (Cecil series)',
    zone:   '7b',
    note:   'Belle Isle rapids — chartered 1742 at the furthest inland point ships could reach from Hampton Roads; Confederate capital 1861–1865.',
  },
  {
    name:   'Raleigh',
    state:  'NC',
    lat:     35.897,
    lon:    -78.648,
    river:  'Neuse River',
    region: 'piedmont',
    soil:   'Piedmont clay loam (Cecil-Appling complex)',
    zone:   '7b',
    note:   'Falls of the Neuse mark the fall line; purpose-built as the state capital in 1792, mid-way between the Piedmont and coastal towns.',
  },
  {
    name:   'Columbia',
    state:  'SC',
    lat:     34.000,
    lon:    -81.030,
    river:  'Congaree & Saluda Rivers',
    region: 'piedmont',
    soil:   'Piedmont clay loam (Cecil series)',
    zone:   '8a',
    note:   '"The Falls" of the Congaree and Saluda — South Carolina\'s purpose-built capital (1786) at the geographic centre of the state.',
  },
  {
    name:   'Augusta',
    state:  'GA',
    lat:     33.470,
    lon:    -82.020,
    river:  'Savannah River',
    region: 'piedmont',
    soil:   'Piedmont sandy clay loam (Madison series)',
    zone:   '8b',
    note:   'Savannah River falls — Georgia\'s oldest city (1736), founded by James Oglethorpe as the inland trading terminus for the Savannah colony.',
  },
  {
    name:   'Macon',
    state:  'GA',
    lat:     32.840,
    lon:    -83.630,
    river:  'Ocmulgee River',
    region: 'piedmont',
    soil:   'Piedmont sandy clay loam (Appling series)',
    zone:   '8b',
    note:   'Ocmulgee River falls — site of 10,000 years of continuous Native American habitation; Fort Hawkins (1806) guarded the fall line crossing.',
  },
  {
    name:   'Columbus',
    state:  'GA',
    lat:     32.460,
    lon:    -84.990,
    river:  'Chattahoochee River',
    region: 'piedmont',
    soil:   'Piedmont sandy clay loam (Appling-Madison complex)',
    zone:   '8b',
    note:   'Chattahoochee River falls — Georgia\'s second-largest city; the falls powered antebellum textile mills and today drive hydroelectric turbines.',
  },
];

/**
 * Returns an HTML string for a fall line city marker popup.
 * @param {{ name: string, state: string, river: string, note: string, soil: string, region: string, zone: string }} city
 * @returns {string}
 */
function makeMarkerPopup(city) {
  var regionLabel = city.region === 'coastal' ? 'Coastal Plain' : 'Piedmont';
  var zoneColor   = getZoneColor(city.zone);
  var row = function (label, value) {
    return (
      '<div class="city-fact">' +
        '<span class="city-fact-label">' + label + '</span>' +
        '<span class="city-fact-value">' + value + '</span>' +
      '</div>'
    );
  };
  return (
    '<div class="popup-content city-popup">' +
      '<div class="city-popup-header">' +
        '<h3>' + city.name + ', ' + city.state + '</h3>' +
        '<span class="city-region-badge ' + city.region + '">' + regionLabel + '</span>' +
      '</div>' +
      '<p class="city-river">' + city.river + '</p>' +
      '<p class="city-note">' + city.note + '</p>' +
      '<div class="city-facts">' +
        row('Soil', city.soil) +
        row('Zone', '<span class="zone-badge" style="background:' + zoneColor + ';color:#1a1a2e">Zone ' + city.zone + '</span>') +
      '</div>' +
    '</div>'
  );
}


/* ─── Location search helpers ────────────────────────────────────
   Pure functions used by map.js for the location search feature.
   All are dependency-free so they can be unit-tested in Node.js.
   ────────────────────────────────────────────────────────────── */

/**
 * Returns true if the input is a valid US 5-digit zip code.
 * Trims surrounding whitespace before checking.
 * @param {string} input
 * @returns {boolean}
 */
function isValidUSZipCode(input) {
  return /^\d{5}$/.test(String(input).trim());
}

/**
 * Returns true if the given coordinates fall within the
 * DC–Richmond–Raleigh corridor bounding box.
 * @param {number} lat
 * @param {number} lon
 * @returns {boolean}
 */
function isInCorridor(lat, lon) {
  return lat >= BBOX_SOUTH && lat <= BBOX_NORTH &&
         lon >= BBOX_WEST  && lon <= BBOX_EAST;
}

/**
 * Builds a Nominatim (OpenStreetMap) geocoding URL for the given input.
 * Zip codes use the postalcode= parameter; everything else uses q=.
 * Always restricts to US results and requests a single JSON result.
 * @param {string} input  Zip code or city/place name
 * @returns {string}      Nominatim search URL
 */
function buildSearchQuery(input) {
  var q    = String(input).trim();
  var base = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us';
  if (isValidUSZipCode(q)) {
    return base + '&postalcode=' + encodeURIComponent(q);
  }
  return base + '&q=' + encodeURIComponent(q);
}


/* ─── Export ─────────────────────────────────────────────────── */
const GeoData = {
  FALL_LINE_COORDS,
  EAST_COAST_COORDS,
  FALL_LINE_GEOJSON,
  COASTAL_PLAIN_GEOJSON,
  PIEDMONT_GEOJSON,
  STYLES,
  BBOX: { NORTH: BBOX_NORTH, SOUTH: BBOX_SOUTH, EAST: BBOX_EAST, WEST: BBOX_WEST },
  NATIVE_PLANTS,
  makeNativePlantsSection,
  makeRegionPopup,
  makeFallLinePopup,
  haversineKm,
  minDistanceToFallLine,
  HARDINESS_ZONE_COLORS,
  HARDINESS_ZONE_INFO,
  getZoneColor,
  getZoneInfo,
  makeZonePopup,
  FALL_LINE_CITIES,
  makeMarkerPopup,
  isValidUSZipCode,
  isInCorridor,
  buildSearchQuery,
};

// Browser: attach to window so map.js can access it
if (typeof window !== 'undefined') {
  window.GeoData = GeoData;
}

// Node.js: CommonJS export for unit tests (no build step required)
if (typeof module !== 'undefined') {
  module.exports = GeoData;
}

}()); // end IIFE
