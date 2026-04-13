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
const BBOX_NORTH =  44.500;   // above Augusta ME / Kennebec River (New England extension)
const BBOX_SOUTH =  32.300;   // below Columbus GA / Chattahoochee River falls
const BBOX_EAST  = -69.500;   // east of Augusta ME / mouth of Kennebec
const BBOX_WEST  = -85.500;   // west of Chattanooga TN / NW Georgia

// REGION: mid-Atlantic corridor — used for Coastal Plain & Piedmont polygon bounds
// (These polygons only cover the historic fall line corridor, not New England)
const REGION_NORTH =  41.400;  // Peekskill NY / Hudson Highlands
const REGION_SOUTH =  32.300;  // Columbus GA / Chattahoochee River falls
const REGION_EAST  = -73.800;  // east of Peekskill NY
const REGION_WEST  = -85.500;  // west of Chattanooga TN / NW Georgia

/* ─── Blue Ridge eastern escarpment — shared boundary ───────────────────────
   The facing edge of the Blue Ridge / Appalachian front as seen from the
   Piedmont.  Listed NORTH → SOUTH so it can be used directly in the
   BLUE_RIDGE_GEOJSON east boundary and reversed for the PIEDMONT_GEOJSON
   western boundary — guaranteeing the two polygons share an identical edge
   with no overlap or gap.
   ────────────────────────────────────────────────────────────── */
const BLUE_RIDGE_EAST_ESCARPMENT = [
  [-77.400, 39.700],  // South Mountain MD — Blue Ridge faces the Hagerstown Valley
  [-77.800, 39.200],  // Harpers Ferry WV — Blue Ridge meets the Potomac gap
  [-78.300, 38.600],  // Front Royal VA — entrance to Shenandoah National Park
  [-78.500, 38.000],  // Waynesboro VA — Blue Ridge Parkway begins here
  [-79.400, 37.500],  // Bedford County VA — Blue Ridge facing the Roanoke Basin
  [-80.500, 36.500],  // Alleghany County NC / Blue Ridge Parkway south
  [-82.200, 35.500],  // Buncombe County NC — Asheville / Black Mountains
  [-83.800, 34.900],  // Towns County GA / Union County GA — NE Georgia mountains
  [-84.500, 34.600],  // Pickens County GA — southernmost Blue Ridge foothills
];

/* ─── Blue Ridge western escarpment — shared boundary ───────────────────────
   The back (valley-facing) edge of the Blue Ridge: shared between the
   BLUE_RIDGE_GEOJSON western boundary and the VALLEY_RIDGE_GEOJSON
   eastern boundary. Defined north → south.
   ────────────────────────────────────────────────────────────── */
const BLUE_RIDGE_WEST_ESCARPMENT = [
  [-77.900, 39.500],  // Washington County MD / South Mountain PA — valley edge
  [-78.800, 38.800],  // WV panhandle / Cacapon River — Shenandoah's back ridge
  [-79.800, 38.000],  // Highland County VA — Allegheny Highlands
  [-80.100, 37.300],  // Craig County VA — North Mountain escarpment
  [-80.700, 36.800],  // Carroll County VA — New River Gorge approach
  [-81.900, 36.300],  // Watauga County NC — Grandfather Mountain back slope
  [-83.500, 35.600],  // Swain County NC — Great Smokies western boundary
  [-84.800, 35.000],  // Murray County GA / Polk County TN
  [-85.000, 34.700],  // NW Georgia — Cohutta Wilderness
];

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
      [REGION_WEST, REGION_NORTH],                    // NW corner
      ...FALL_LINE_COORDS,                             // east boundary: fall line north→south
      [REGION_WEST, REGION_SOUTH],                     // SW corner (south edge)
      [REGION_WEST, 34.600],                           // west edge: up to Blue Ridge south extent
      ...[...BLUE_RIDGE_EAST_ESCARPMENT].reverse(),    // west boundary: escarpment south→north
      [REGION_WEST, 39.700],                           // west edge: up to NW corner latitude
      [REGION_WEST, REGION_NORTH],                     // close polygon
    ]],
  },
};

/* ─── Blue Ridge / Appalachian Mountains region ──────────────────
   Simplified polygon covering the Blue Ridge and Valley-and-Ridge
   physiographic provinces west of the Piedmont escarpment.
   Eastern boundary follows the Blue Ridge front (escarpment facing
   the Piedmont); western boundary follows the Valley and Ridge edge.
   Runs from South Mountain MD/PA south through the Shenandoah Valley
   and Black Mountains NC to NW Georgia.
   Coordinates: [longitude, latitude] (GeoJSON standard).
   ────────────────────────────────────────────────────────────── */
const BLUE_RIDGE_GEOJSON = {
  type: 'Feature',
  properties: {
    region: 'blueRidge',
    name: 'Blue Ridge / Appalachian Mountains',
    description:
      'Ancient crystalline highlands west of the Piedmont — granite, gneiss, ' +
      'and schist uplifted more than 1 billion years ago. Elevations range from ' +
      '1,500 to over 6,600 feet. Rocky, nutrient-poor, strongly acidic soils ' +
      'support ericaceous shrubs, spruce-fir forests, and globally rare Southern ' +
      'Appalachian endemics. The French Broad, New, and Shenandoah rivers all ' +
      'drain this ancient range toward the Atlantic.',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      // Western boundary — shared with Valley and Ridge eastern boundary
      ...BLUE_RIDGE_WEST_ESCARPMENT,                      // north → south
      // East boundary — shared with Piedmont western boundary (south → north)
      ...[...BLUE_RIDGE_EAST_ESCARPMENT].reverse(),
      // Close ring back to NW corner
      [-77.900, 39.500],
    ]],
  },
};


/* ─── Valley and Ridge / Great Appalachian Valley ───────────────
   The province immediately west of the Blue Ridge escarpment.
   Underlain by folded limestone, dolomite, and shale — the same
   orogenic belt that creates the Great Appalachian Valley system:
   Shenandoah Valley (VA/WV), Great Valley/Cumberland Valley (MD/PA),
   Tennessee Valley (TN), and Coosa Valley (AL/GA).
   Eastern boundary = Blue Ridge western escarpment (shared constant).
   Western boundary = REGION_WEST (edge of the map corridor).
   ────────────────────────────────────────────────────────────── */
const VALLEY_RIDGE_GEOJSON = {
  type: 'Feature',
  properties: {
    region: 'valleyRidge',
    name: 'Valley and Ridge / Great Appalachian Valley',
    description:
      'West of the Blue Ridge, parallel limestone and shale ridges and fertile ' +
      'valley floors define one of the most productive agricultural landscapes ' +
      'in the eastern United States. The Great Appalachian Valley — Shenandoah, ' +
      'Cumberland, and Tennessee segments — has rich calcium-rich Alfisols derived ' +
      'from limestone and dolomite, supporting world-class apple orchards, grain ' +
      'farms, and limestone cedar glades. Rivers cut dramatic water gaps through ' +
      'the ridges: Harpers Ferry, the New River Gorge, and Cumberland Gap.',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [REGION_WEST, 39.700],      // NW corner — top of the valley corridor
      [-77.900, 39.700],          // NE corner — aligns with Blue Ridge NW tip
      // Eastern boundary: Blue Ridge western escarpment north → south
      ...BLUE_RIDGE_WEST_ESCARPMENT,
      // SW corner — bottom of the Piedmont notch / valley corridor
      [REGION_WEST, 34.600],
      // Close ring back to NW corner
      [REGION_WEST, 39.700],
    ]],
  },
};

/* ─── New England Upland ─────────────────────────────────────────
   Crystalline upland NW of the New England fall zone — the glacially
   scoured equivalent of the Piedmont. Covers the mill-river valleys
   of CT, RI, MA, NH, and ME west/inland of the fall line.
   Shares the 'piedmont' region key to reuse plant and soil data.
   Eastern boundary = NE_FALL_ZONE_COORDS.
   ────────────────────────────────────────────────────────────── */
const NE_UPLAND_GEOJSON = {
  type: 'Feature',
  properties: {
    region: 'piedmont',
    name: 'New England Upland',
    section: 'new-england',
    description:
      'Glacially scoured crystalline bedrock — the New England equivalent of the ' +
      'Piedmont. Ancient gneiss, schist, and granite, heavily reworked by Pleistocene ' +
      'ice sheets, underlie a rugged landscape of thin, acidic soils and fast-moving ' +
      'rivers. The same fall line dynamic that powered Richmond and Philadelphia drove ' +
      'the Industrial Revolution in Lowell, Manchester, and Pawtucket.',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      // South: connect to existing Piedmont region at Peekskill NY
      [-73.920, 41.290],
      // West boundary: Hudson Valley / CT-NY border / VT-NH / Maine interior
      [-74.200, 41.500],   // lower Hudson Valley NY
      [-74.500, 42.000],   // mid-Hudson Valley / Catskills NY
      [-73.800, 42.700],   // Albany NY / Rensselaer County
      [-73.400, 43.500],   // Lake George NY / VT border
      [-72.600, 43.900],   // Vermont / NH border area
      [-71.500, 44.500],   // NH / Quebec border
      // North boundary across to Maine
      [-69.781, 44.500],
      // East boundary: NE fall zone north → south (reversed = south→north here going back)
      // Actually we go NORTH from Peekskill to Augusta along fall zone as EAST boundary
      // then close south. Let me trace: east boundary is the fall zone going south:
      [-69.781, 44.311],   // Augusta ME (fall zone NE terminus)
      [-71.455, 43.004],   // Manchester NH
      [-71.312, 42.643],   // Lowell MA
      [-71.383, 41.878],   // Pawtucket RI
      [-73.050, 41.550],   // Waterbury CT
      [-73.920, 41.290],   // Peekskill NY — close ring
    ]],
  },
};

/* ─── New England Coastal ────────────────────────────────────────
   Narrow coastal lowland SE of the New England fall zone — the
   glacial outwash plains and drumlins of coastal CT, RI, and MA.
   Shares the 'coastal' region key to reuse plant and soil data.
   Western boundary = NE_FALL_ZONE_COORDS.
   ────────────────────────────────────────────────────────────── */
const NE_COASTAL_GEOJSON = {
  type: 'Feature',
  properties: {
    region: 'coastal',
    name: 'New England Coastal Lowland',
    section: 'new-england',
    description:
      'South of the fall zone, glacial outwash and marine sediments create a ' +
      'level coastal plain strikingly similar to the Tidewater region further ' +
      'south. Sandy, acidic soils support pitch pine barrens, cranberry bogs, ' +
      'and salt marshes. The same Atlantic storms that shape the Outer Banks ' +
      'also define New England\'s coastal ecology.',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      // West boundary: NE fall zone from Peekskill north to Augusta
      [-73.920, 41.290],   // Peekskill NY
      [-73.050, 41.550],   // Waterbury CT
      [-71.383, 41.878],   // Pawtucket RI
      [-71.312, 42.643],   // Lowell MA
      [-71.455, 43.004],   // Manchester NH
      [-69.781, 44.311],   // Augusta ME
      // East / coastal boundary — simplified Atlantic coast of New England
      [-67.500, 44.500],   // Maine coast (Eastport area / Passamaquoddy Bay)
      [-70.200, 43.700],   // New Hampshire seacoast / Portsmouth area
      [-70.900, 42.600],   // Massachusetts coast / Plymouth area
      [-71.000, 41.500],   // Rhode Island coast / Newport area
      [-72.300, 41.200],   // Connecticut coast / New Haven area
      [-73.920, 41.290],   // Close ring at Peekskill
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
  blueRidge: {
    fillColor:   '#4a7c59',   // Forest green
    fillOpacity: 0.18,
    color:       '#4a7c59',
    weight:      0,
    interactive: true,
  },
  valleyRidge: {
    fillColor:   '#9b7aad',   // Dusty violet — limestone valley character
    fillOpacity: 0.18,
    color:       '#9b7aad',
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
  // Outline-only variants — used when hardiness zone layer is active so
  // zone fill colors are not obscured by region fill colors.
  coastalOutline: {
    fillOpacity: 0,
    fillColor:   '#4682DC',
    color:       '#4682DC',
    weight:      2,
    opacity:     0.65,
    interactive: true,
  },
  piedmontOutline: {
    fillOpacity: 0,
    fillColor:   '#C88232',
    color:       '#C88232',
    weight:      2,
    opacity:     0.65,
    interactive: true,
  },
  blueRidgeOutline: {
    fillOpacity: 0,
    fillColor:   '#4a7c59',
    color:       '#4a7c59',
    weight:      2,
    opacity:     0.65,
    interactive: true,
  },
  valleyRidgeOutline: {
    fillOpacity: 0,
    fillColor:   '#9b7aad',
    color:       '#9b7aad',
    weight:      2,
    opacity:     0.65,
    interactive: true,
  },
  rivers: {
    color:       '#4a9eff',
    weight:      2,
    opacity:     0.75,
    interactive: true,
  },
  riversHover: {
    weight:  3.5,
    opacity: 1.0,
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
  blueRidge: [
    {
      name:  'Fraser Fir',
      latin: 'Abies fraseri',
      type:  'tree',
      note:  'High-elevation fir endemic to Southern Appalachians; grows above 5,500 ft on the highest peaks',
    },
    {
      name:  'Red Spruce',
      latin: 'Picea rubens',
      type:  'tree',
      note:  'Signature spruce of the spruce-fir zone; declining due to acid deposition and climate warming',
    },
    {
      name:  'Rosebay Rhododendron',
      latin: 'Rhododendron maximum',
      type:  'shrub',
      note:  'Dominant understory shrub; forms nearly impenetrable thickets along streams called "rhododendron hells"',
    },
    {
      name:  'Large-flowered Trillium',
      latin: 'Trillium grandiflorum',
      type:  'perennial',
      note:  'Iconic spring ephemeral of cove forests; indicator of undisturbed old-growth soil',
    },
    {
      name:  'Fire Pink',
      latin: 'Silene virginica',
      type:  'perennial',
      note:  'Vivid red tubular flowers attract hummingbirds; thrives on rocky outcrops and woodland edges',
    },
    {
      name:  'Mountain Doghobble',
      latin: 'Leucothoe fontanesiana',
      type:  'shrub',
      note:  'Streamside ericaceous shrub; arching branches and white flowers in late spring',
    },
  ],
  valleyRidge: [
    {
      name:  'Pawpaw',
      latin: 'Asimina triloba',
      type:  'tree',
      note:  'Largest native fruit tree in North America; thrives in limestone-rich bottomlands and river terraces of the Great Valley',
    },
    {
      name:  'Virginia Bluebells',
      latin: 'Mertensia virginica',
      type:  'perennial',
      note:  'Stunning spring ephemeral carpeting floodplains and streambanks; a signature species of the Shenandoah Valley bottomlands',
    },
    {
      name:  'Wild Blue Indigo',
      latin: 'Baptisia australis',
      type:  'perennial',
      note:  'Long-lived prairie/savanna perennial of calcareous soils; indigo-blue flower spikes in late spring; excellent pollinator plant',
    },
    {
      name:  'Eastern Red Cedar',
      latin: 'Juniperus virginiana',
      type:  'tree',
      note:  'Pioneer on limestone outcrops and abandoned farm fields; provides winter wildlife habitat and defines the classic cedar glade community',
    },
    {
      name:  'Black Walnut',
      latin: 'Juglans nigra',
      type:  'tree',
      note:  'Dominant tree of rich limestone bottomlands; produces allelopathic chemicals that limit competitors; prized for timber and wildlife value',
    },
    {
      name:  'Chinkapin Oak',
      latin: 'Quercus muehlenbergii',
      type:  'tree',
      note:  'Specialist of limestone cliffs and outcrops; sharply toothed leaves resemble chestnut; an anchor species of cedar-oak calcareous woodlands',
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


/* ─── Soil type profiles by ecoregion ───────────────────────────
   Key soil characteristics for the Piedmont, Coastal Plain, and
   fall line ecotone. Used in region and fall line click popups.
   Data derived from USDA NRCS soil survey publications (MLRA 148,
   136, 133A, 153A) and the National Cooperative Soil Survey.

   Fields:
     series     — dominant soil series / association name
     texture    — textural class (USDA texture triangle)
     pH         — typical surface horizon pH range
     drainage   — USDA drainage class descriptor
     amendments — top gardening amendment recommendations
   ────────────────────────────────────────────────────────────── */
const SOIL_TYPES = {
  piedmont: {
    series:     'Cecil–Appling–Madison (Ultisols)',
    texture:    'Clay loam to clay',
    pH:         '5.0–6.0 (strongly acidic)',
    drainage:   'Well-drained but compaction-prone',
    amendments: 'Lime to raise pH; generous compost to loosen dense clay structure',
  },
  coastal: {
    series:     'Norfolk–Goldsboro–Lynchburg (Ultisols)',
    texture:    'Sandy loam to loamy sand',
    pH:         '4.5–5.5 (very acidic)',
    drainage:   'Well to excessively drained; dries out quickly',
    amendments: 'Heavy compost and mulch to retain moisture; slow-release fertilizers',
  },
  ecotone: {
    series:     'Appling–Norfolk transition (Ultisols)',
    texture:    'Loam to clay loam (highly variable within metres)',
    pH:         '5.0–6.5 (variable)',
    drainage:   'Variable — can shift dramatically within 100 ft of the fall line',
    amendments: 'Soil test strongly recommended; organic matter benefits both textures',
  },
  blueRidge: {
    series:     'Ramsey–Porters–Ashe (Inceptisols / Entisols)',
    texture:    'Stony loam to sandy loam (thin, rocky profiles)',
    pH:         '4.5–5.5 (strongly acidic)',
    drainage:   'Excessively drained on slopes; perched water tables in coves and hollows',
    amendments: 'Ericaceous compost for acid-loving plants; avoid alkaline lime; deep mulch retains moisture on steep slopes; test for calcium and magnesium deficiency',
  },
  valleyRidge: {
    series:     'Frederick–Hagerstown–Edom (Alfisols / Inceptisols from limestone & dolomite)',
    texture:    'Silt loam to silty clay loam (deep, well-developed profiles)',
    pH:         '6.2–7.5 (near-neutral to mildly alkaline)',
    drainage:   'Well drained on valley floors and gentle slopes; seasonally wet in low-lying limestone karst depressions',
    amendments: 'Generally fertile with minimal amendment needed; phosphorus and potassium often abundant; watch for iron and manganese deficiency at high pH; lime rarely needed — test before applying',
  },
};

/**
 * Returns an HTML string showing the soil profile for a given ecoregion.
 * @param {'piedmont'|'coastal'|'ecotone'} region
 * @returns {string}  HTML fragment — empty string if region not found
 */
function makeSoilSection(region) {
  const soil = SOIL_TYPES[region];
  if (!soil) return '';
  const row = function (label, value) {
    return (
      '<div class="soil-fact">' +
        '<span class="soil-label">' + label + '</span>' +
        '<span class="soil-value">' + value + '</span>' +
      '</div>'
    );
  };
  return (
    '<div class="soil-section">' +
      '<h4 class="soil-section-header">Soil profile</h4>' +
      '<div class="soil-facts">' +
        row('Series',    soil.series) +
        row('Texture',   soil.texture) +
        row('pH',        soil.pH) +
        row('Drainage',  soil.drainage) +
        row('Amend with', soil.amendments) +
      '</div>' +
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
      makeSoilSection(props.region) +
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
      makeSoilSection('ecotone') +
      '<p style="margin-top:8px; color:#888; font-size:0.75rem;">' +
        'This path is approximate. The true boundary is gradational over several miles.' +
      '</p>' +
    '</div>'
  );
}


/* ─── Detail page HTML generators ────────────────────────────────
   Used by hash routing in map.js to render full-screen detail pages.
   Each function returns a complete <article class="detail-page"> fragment.
   Reuse existing popup data (soil, plants, zone info) in a full-width layout.
   ────────────────────────────────────────────────────────────── */

var REGION_LABELS = {
  coastal:    'Coastal Plain (Tidewater)',
  piedmont:   'Piedmont',
  blueRidge:  'Blue Ridge / Appalachian Mountains',
  valleyRidge:'Valley and Ridge / Great Appalachian Valley',
  ecotone:    'Fall Line Ecotone',
};

/**
 * Returns full-page HTML for a region detail view.
 * @param {'piedmont'|'coastal'|'blueRidge'} region
 * @returns {string}
 */
function makeRegionDetailHTML(region) {
  var geojsonMap = { piedmont: PIEDMONT_GEOJSON, coastal: COASTAL_PLAIN_GEOJSON, blueRidge: BLUE_RIDGE_GEOJSON, valleyRidge: VALLEY_RIDGE_GEOJSON };
  var geojson = geojsonMap[region];
  if (!geojson) return '';
  var props = geojson.properties;
  var REGION_COLORS = { piedmont: '#c88232', coastal: '#4682dc', blueRidge: '#4a7c59', valleyRidge: '#9b7aad' };
  var color = REGION_COLORS[region] || '#888888';
  return (
    '<article class="detail-page">' +
      '<div class="detail-region-header" style="border-left:4px solid ' + color + ';padding-left:12px;margin-bottom:0.75rem">' +
        '<h2 class="detail-title" style="margin-bottom:0">' + props.name + '</h2>' +
      '</div>' +
      '<p class="detail-description">' + props.description + '</p>' +
      makeNativePlantsSection(region) +
      makeSoilSection(region) +
    '</article>'
  );
}

/**
 * Returns full-page HTML for the fall line detail view.
 * @returns {string}
 */
function makeFallLineDetailHTML() {
  return (
    '<article class="detail-page">' +
      '<div class="detail-region-header" style="border-left:4px solid #e84393;padding-left:12px;margin-bottom:0.75rem">' +
        '<h2 class="detail-title" style="margin-bottom:0">Atlantic Seaboard Fall Line</h2>' +
      '</div>' +
      '<p class="detail-description">' +
        'The geological boundary where ancient Piedmont crystalline rock meets ' +
        'soft Coastal Plain sediments. Rivers drop over rapids here — the last ' +
        'navigable point from the sea. Washington DC, Richmond VA, Raleigh NC, ' +
        'Columbia SC, and Augusta GA all grew up at or near this boundary.' +
      '</p>' +
      '<p class="detail-description">' +
        'This path is approximate. The true boundary is gradational over several ' +
        'miles, reflecting millennia of erosion at the Piedmont\'s eroded edge.' +
      '</p>' +
      makeNativePlantsSection('ecotone') +
      makeSoilSection('ecotone') +
    '</article>'
  );
}

/**
 * Returns full-page HTML for a hardiness zone detail view.
 * @param {string} zone  e.g. "7b"
 * @returns {string}
 */
function makeZoneDetailHTML(zone) {
  var info  = getZoneInfo(zone);
  var color = getZoneColor(zone);
  var row = function (label, value) {
    return (
      '<div class="detail-fact">' +
        '<span class="detail-fact-label">' + label + '</span>' +
        '<span class="detail-fact-value">' + value + '</span>' +
      '</div>'
    );
  };
  return (
    '<article class="detail-page">' +
      '<div class="detail-zone-header" style="border-left:4px solid ' + color + '">' +
        '<h2 class="detail-title">Hardiness Zone ' + zone + '</h2>' +
        '<span class="zone-badge detail-zone-badge" style="background:' + color + ';color:#1a1a2e">Zone ' + zone + '</span>' +
      '</div>' +
      '<p class="detail-description">' + info.description + '</p>' +
      '<div class="detail-facts">' +
        row('Min. winter temp', info.tempRange) +
        row('First frost',      info.firstFrost) +
        row('Last frost',       info.lastFrost) +
        row('Growing season',   info.growingSeason) +
        row('Thrives here',     info.plants) +
      '</div>' +
    '</article>'
  );
}

/**
 * Returns full-page HTML for a city detail view.
 * Looks up city by slug (e.g. "richmond-va", "new-brunswick-nj").
 * @param {string} slug  lowercase-hyphenated "name-state"
 * @returns {string}
 */
function makeCityDetailHTML(slug) {
  var city = null;
  for (var i = 0; i < FALL_LINE_CITIES.length; i++) {
    var c = FALL_LINE_CITIES[i];
    if ((c.name + '-' + c.state).toLowerCase().replace(/\s+/g, '-') === slug) {
      city = c;
      break;
    }
  }
  if (!city) return '';
  var regionLabel = REGION_LABELS[city.region] || city.region;
  var zoneColor   = getZoneColor(city.zone);
  var row = function (label, value) {
    return (
      '<div class="detail-fact">' +
        '<span class="detail-fact-label">' + label + '</span>' +
        '<span class="detail-fact-value">' + value + '</span>' +
      '</div>'
    );
  };
  var REGION_COLORS = { piedmont: '#c88232', coastal: '#4682dc', blueRidge: '#4a7c59', valleyRidge: '#9b7aad' };
  var accentColor = REGION_COLORS[city.region] || '#888888';
  return (
    '<article class="detail-page">' +
      '<div class="detail-region-header" style="border-left:4px solid ' + accentColor + ';padding-left:12px;margin-bottom:0.75rem">' +
        '<h2 class="detail-title" style="margin-bottom:0.25rem">' + city.name + ', ' + city.state + '</h2>' +
        '<p class="detail-river" style="margin:0">' + city.river + '</p>' +
      '</div>' +
      '<p class="detail-description">' + city.note + '</p>' +
      '<div class="detail-facts">' +
        row('Ecoregion', '<span class="region-tag ' + city.region + '">' + regionLabel + '</span>') +
        row('Soil',      city.soil) +
        row('Zone',      '<span class="zone-badge" style="background:' + zoneColor + ';color:#1a1a2e">Zone ' + city.zone + '</span>') +
      '</div>' +
      makeNativePlantsSection(city.region) +
    '</article>'
  );
}

/**
 * Classifies a lat/lon point as 'coastal', 'piedmont', or 'blueRidge'
 * by comparing its longitude against the nearest fall line point.
 * Used by the search/location detail page.
 * @param {number} lat
 * @param {number} lon
 * @returns {'coastal'|'piedmont'|'blueRidge'}
 */
function classifyLocation(lat, lon) {
  // Find the fall line point with the closest latitude
  var closest = FALL_LINE_COORDS[0];
  var minLatDiff = Math.abs(FALL_LINE_COORDS[0][1] - lat);
  for (var i = 1; i < FALL_LINE_COORDS.length; i++) {
    var diff = Math.abs(FALL_LINE_COORDS[i][1] - lat);
    if (diff < minLatDiff) {
      minLatDiff = diff;
      closest = FALL_LINE_COORDS[i];
    }
  }
  // East of fall line → Coastal Plain
  if (lon > closest[0]) return 'coastal';

  // For latitudes covered by the Blue Ridge / Valley and Ridge (roughly 34.5–39.8°N),
  // use the escarpment arrays to distinguish Blue Ridge from Valley and Ridge from Piedmont.
  if (lat >= 34.5 && lat <= 39.8) {
    // Find the Blue Ridge east escarpment longitude nearest to this latitude
    var eastLon = BLUE_RIDGE_EAST_ESCARPMENT[0][0];
    var minEastDiff = Math.abs(BLUE_RIDGE_EAST_ESCARPMENT[0][1] - lat);
    for (var j = 1; j < BLUE_RIDGE_EAST_ESCARPMENT.length; j++) {
      var ed = Math.abs(BLUE_RIDGE_EAST_ESCARPMENT[j][1] - lat);
      if (ed < minEastDiff) { minEastDiff = ed; eastLon = BLUE_RIDGE_EAST_ESCARPMENT[j][0]; }
    }
    // Find the Blue Ridge west escarpment longitude nearest to this latitude
    var westLon = BLUE_RIDGE_WEST_ESCARPMENT[0][0];
    var minWestDiff = Math.abs(BLUE_RIDGE_WEST_ESCARPMENT[0][1] - lat);
    for (var k = 1; k < BLUE_RIDGE_WEST_ESCARPMENT.length; k++) {
      var wd = Math.abs(BLUE_RIDGE_WEST_ESCARPMENT[k][1] - lat);
      if (wd < minWestDiff) { minWestDiff = wd; westLon = BLUE_RIDGE_WEST_ESCARPMENT[k][0]; }
    }
    if (lon < westLon) return 'valleyRidge';   // west of Blue Ridge western face
    if (lon < eastLon) return 'blueRidge';     // between east and west escarpments
  }

  // Otherwise → Piedmont (covers both mid-Atlantic and New England uplands)
  return 'piedmont';
}

/**
 * Returns full-page HTML for a location report (search / GPS result).
 * Includes approximate ecoregion, soil, and native plants for the location.
 * @param {number} lat
 * @param {number} lon
 * @returns {string}
 */
function makeLocationReport(lat, lon) {
  var region = classifyLocation(lat, lon);
  var geojsonMap = { piedmont: PIEDMONT_GEOJSON, coastal: COASTAL_PLAIN_GEOJSON, blueRidge: BLUE_RIDGE_GEOJSON, valleyRidge: VALLEY_RIDGE_GEOJSON };
  var geojson = geojsonMap[region];
  var props   = geojson.properties;

  // Find nearest city by haversine distance
  var nearest  = FALL_LINE_CITIES[0];
  var minDistKm = haversineKm([lon, lat], [nearest.lon, nearest.lat]);
  for (var i = 1; i < FALL_LINE_CITIES.length; i++) {
    var c = FALL_LINE_CITIES[i];
    var d = haversineKm([lon, lat], [c.lon, c.lat]);
    if (d < minDistKm) { minDistKm = d; nearest = c; }
  }
  var nearestText = nearest.name + ', ' + nearest.state + ' (' + Math.round(minDistKm) + '\u00a0km)';

  var REGION_COLORS = { piedmont: '#c88232', coastal: '#4682dc', blueRidge: '#4a7c59', valleyRidge: '#9b7aad' };
  var accentColor = REGION_COLORS[region] || '#888888';

  return (
    '<article class="detail-page">' +
      '<h2 class="detail-title">Location Report</h2>' +
      '<p class="detail-coords">' +
        lat.toFixed(4) + '\u00b0N\u2002\u00b7\u2002' + Math.abs(lon).toFixed(4) + '\u00b0W' +
      '</p>' +
      '<div class="detail-region-header" style="border-left:4px solid ' + accentColor + ';padding-left:12px;margin-bottom:0.75rem">' +
        '<h3 class="detail-region-name" style="margin:0">' + props.name + '</h3>' +
      '</div>' +
      '<p class="detail-description">' + props.description + '</p>' +
      '<div class="detail-facts">' +
        '<div class="detail-fact">' +
          '<span class="detail-fact-label">Nearest city</span>' +
          '<span class="detail-fact-value">' + nearestText + '</span>' +
        '</div>' +
      '</div>' +
      makeNativePlantsSection(region) +
      makeSoilSection(region) +
      '<p class="detail-note">Enable the Hardiness Zone layer on the map for precise zone information at this location.</p>' +
    '</article>'
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
  // ── Appalachian Valley & Blue Ridge cities ──────────────────────
  {
    name:   'Charlottesville',
    state:  'VA',
    lat:     38.029,
    lon:    -78.477,
    river:  'Rivanna River',
    region: 'piedmont',
    soil:   'Cecil clay loam (Piedmont Ultisol)',
    zone:   '7a',
    note:   'University of Virginia and Monticello sit at the Piedmont\'s western edge, just below the Blue Ridge escarpment — Thomas Jefferson farmed these crystalline clay soils.',
  },
  {
    name:   'Staunton',
    state:  'VA',
    lat:     38.149,
    lon:    -79.072,
    river:  'Middle River (South Fork Shenandoah)',
    region: 'blueRidge',
    soil:   'Frederick silt loam (Valley limestone-derived)',
    zone:   '6b',
    note:   'Heart of the Great Appalachian Valley — the Shenandoah. Rich limestone-derived soils support world-class apple orchards and grain farming along the Valley Pike.',
  },
  {
    name:   'Roanoke',
    state:  'VA',
    lat:     37.271,
    lon:    -79.941,
    river:  'Roanoke River',
    region: 'blueRidge',
    soil:   'Berks channery silt loam (shale-derived)',
    zone:   '7a',
    note:   'Star City of the South — the Roanoke River cuts through the Blue Ridge here, creating the Roanoke Narrows, a critical migratory corridor for birds and American shad.',
  },
  {
    name:   'Asheville',
    state:  'NC',
    lat:     35.579,
    lon:    -82.551,
    river:  'French Broad River',
    region: 'blueRidge',
    soil:   'Porters loam (Blue Ridge Inceptisol)',
    zone:   '6b',
    note:   'At the confluence of three rivers in the heart of the Black Mountains. The French Broad is one of the oldest rivers in North America, predating the Appalachian uplift itself.',
  },
  {
    name:   'Greenville',
    state:  'SC',
    lat:     34.852,
    lon:    -82.394,
    river:  'Reedy River',
    region: 'piedmont',
    soil:   'Cecil–Pacolet clay loam (Ultisol)',
    zone:   '7b',
    note:   'At the foot of the Blue Ridge escarpment — one of the most abrupt topographic transitions in the eastern US, dropping 1,000 ft over just 20 miles from Caesar\'s Head State Park.',
  },
  {
    name:   'Chattanooga',
    state:  'TN',
    lat:     35.045,
    lon:    -85.309,
    river:  'Tennessee River',
    region: 'blueRidge',
    soil:   'Fullerton clay loam (Valley and Ridge)',
    zone:   '7b',
    note:   'Where the Tennessee River cuts through Walden Ridge and the Cumberland Plateau — Moccasin Bend National Archaeological District sits within the river\'s dramatic entrenched meander.',
  },
  // ── New England fall zone cities ─────────────────────────────────────────
  {
    name:   'Pawtucket',
    state:  'RI',
    lat:     41.878,
    lon:    -71.383,
    river:  'Blackstone River',
    region: 'piedmont',
    soil:   'Paxton-Montauk stony sandy loam (glacial till)',
    zone:   '6b',
    note:   'Slater Mill (1793) — the first successful water-powered cotton mill in North America, launching the American Industrial Revolution where the Blackstone drops off the New England Upland.',
  },
  {
    name:   'Lowell',
    state:  'MA',
    lat:     42.643,
    lon:    -71.312,
    river:  'Merrimack River',
    region: 'piedmont',
    soil:   'Paxton stony loam (glacial till, dense substratum)',
    zone:   '6a',
    note:   'America\'s first planned industrial city (1826), engineered around the Pawtucket Falls of the Merrimack. At its peak, Lowell\'s mills produced 50,000 miles of cloth per year.',
  },
  {
    name:   'Manchester',
    state:  'NH',
    lat:     43.004,
    lon:    -71.455,
    river:  'Merrimack River',
    region: 'piedmont',
    soil:   'Hermon-Lyman stony sandy loam (thin glacial till over granite)',
    zone:   '6a',
    note:   'Amoskeag Falls powered the Amoskeag Manufacturing Company — once the world\'s largest textile complex, stretching a mile along the Merrimack with 17,000 workers.',
  },
  {
    name:   'Augusta',
    state:  'ME',
    lat:     44.311,
    lon:    -69.781,
    river:  'Kennebec River',
    region: 'piedmont',
    soil:   'Peru-Marlow gravelly loam (glacial till over schist)',
    zone:   '5b',
    note:   'The Kennebec River falls mark the head of tidal navigation and the site of Fort Western (1754) — the oldest surviving wooden fort in the US. Maine\'s capital at the geological fall zone.',
  },
];

/**
 * Returns an HTML string for a fall line city marker popup.
 * @param {{ name: string, state: string, river: string, note: string, soil: string, region: string, zone: string }} city
 * @returns {string}
 */
function makeMarkerPopup(city) {
  var regionLabel  = REGION_LABELS[city.region] || city.region;
  var zoneColor    = getZoneColor(city.zone);
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


/* ─── New England Fall Zone ─────────────────────────────────────
   Separate LineString for the New England mill-city fall zone
   (Augusta ME → Manchester NH → Lowell MA → Pawtucket RI → Waterbury CT).
   Kept separate from FALL_LINE_COORDS so the mid-Atlantic Coastal and
   Piedmont polygons (which close at the current Peekskill terminus) are
   unaffected.  Both lines share the same toggle and style in map.js.
   ────────────────────────────────────────────────────────────── */
const NE_FALL_ZONE_COORDS = [
  [-69.781, 44.311],   // Augusta ME — Kennebec River falls (northern terminus)
  [-71.455, 43.004],   // Manchester NH — Amoskeag Falls (Merrimack River)
  [-71.312, 42.643],   // Lowell MA — Pawtucket Falls (Merrimack River)
  [-71.383, 41.878],   // Pawtucket RI — Blackstone River falls (Slater Mill)
  [-73.050, 41.550],   // Waterbury CT — Naugatuck River falls (bridge to Hudson Valley)
  [-73.920, 41.290],   // Peekskill NY — joins the main fall line
];

const NE_FALL_ZONE_GEOJSON = {
  type: 'Feature',
  properties: {
    name:    'New England Fall Zone',
    section: 'new-england',
  },
  geometry: {
    type:        'LineString',
    coordinates: NE_FALL_ZONE_COORDS,
  },
};


/* ─── Major Appalachian Watershed Rivers ─────────────────────────
   GeoJSON FeatureCollection of 14 major rivers draining the Appalachian
   watershed from the Kennebec (Maine) south to the Savannah (Georgia).
   Coordinates are simplified (~6–10 waypoints per river) for visual
   clarity; not for precise navigation.
   Source: derived from USGS NHD / Natural Earth river data (public domain).
   ────────────────────────────────────────────────────────────── */
const MAJOR_RIVERS_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        slug: 'kennebec', name: 'Kennebec River',
        length_km: 257, states: 'ME',
        source: 'Moosehead Lake, ME', mouth: 'Atlantic Ocean at Popham Beach, ME',
        note: 'The Kennebec was the lifeline of colonial Maine — fur trade, shipbuilding, and ice harvesting defined its banks. The falls at Augusta mark the head of tidal navigation and the geological fall zone.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-69.870, 45.630], [-69.781, 44.311], [-69.760, 43.980], [-69.810, 43.820],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'merrimack', name: 'Merrimack River',
        length_km: 180, states: 'NH, MA',
        source: 'Franklin NH (confluence of Pemigewasset and Winnisquam)', mouth: 'Atlantic Ocean at Newburyport, MA',
        note: 'The Merrimack powered America\'s first industrial cities. Lowell\'s Pawtucket Falls drop 32 feet — enough to drive 40 mills — while Amoskeag Falls at Manchester once ran the world\'s largest textile complex.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-71.540, 43.430], [-71.455, 43.004], [-71.312, 42.643],
        [-71.160, 42.710], [-70.873, 42.810],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'connecticut', name: 'Connecticut River',
        length_km: 655, states: 'NH, VT, MA, CT',
        source: 'Third Connecticut Lake, NH (US-Canada border)', mouth: 'Long Island Sound at Old Saybrook, CT',
        note: 'New England\'s longest river cuts through the Connecticut Valley Lowland — a Mesozoic rift basin filled with sandstone and basalt. The river\'s floodplain produced some of the most fertile farmland in colonial New England.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-71.520, 44.720], [-72.400, 44.050], [-72.650, 43.620],
        [-72.580, 43.050], [-72.530, 42.360], [-72.620, 41.760], [-72.390, 41.280],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'hudson', name: 'Hudson River',
        length_km: 507, states: 'NY, NJ',
        source: 'Lake Tear of the Clouds, Adirondack Mountains NY', mouth: 'Upper New York Bay / Atlantic Ocean',
        note: 'The Hudson was the axis of westward expansion. The Erie Canal (1825) connected it to the Great Lakes, making New York City the commercial capital of North America. The Peekskill Highlands mark the geological fall zone.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-73.780, 44.050], [-73.730, 43.650], [-73.750, 42.650],
        [-73.960, 41.920], [-73.920, 41.290], [-73.970, 40.700],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'delaware', name: 'Delaware River',
        length_km: 579, states: 'NY, NJ, PA, DE',
        source: 'Catskill Mountains NY (East and West Branch confluence at Hancock)', mouth: 'Delaware Bay / Atlantic Ocean',
        note: 'Washington crossed the Delaware on Christmas 1776. The Delaware Water Gap cuts through Kittatinny Ridge — the river predates the Appalachian ridges it flows through, carving its gorge as the mountains rose around it.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-74.860, 41.900], [-75.040, 41.370], [-75.190, 40.970],
        [-74.870, 40.570], [-74.770, 40.220], [-75.100, 40.000],
        [-75.570, 39.620], [-75.490, 39.080],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'susquehanna', name: 'Susquehanna River',
        length_km: 715, states: 'NY, PA, MD',
        source: 'Otsego Lake (Cooperstown NY)', mouth: 'Chesapeake Bay at Havre de Grace, MD',
        note: 'The Susquehanna drains nearly half of the Chesapeake Bay watershed. Its Conowingo Dam (1928) traps millions of tons of sediment that once fed the Bay\'s oyster reefs. The Susquehanna Flats were once the world\'s most productive wild-celery beds.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-75.100, 42.700], [-76.650, 41.600], [-76.010, 40.980],
        [-76.560, 40.430], [-76.080, 39.540],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'potomac', name: 'Potomac River',
        length_km: 652, states: 'WV, MD, VA, DC',
        source: 'Fairfax Stone, WV (Backbone Mountain)', mouth: 'Chesapeake Bay at Point Lookout, MD',
        note: 'Great Falls of the Potomac drop 76 feet in less than a mile — the most dramatic fall line in the eastern US. George Washington\'s Patowmack Canal (1802) attempted to bypass the falls; today the C&O Canal towpath follows the Maryland shore.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-79.290, 39.200], [-78.800, 39.370], [-77.880, 39.390],
        [-77.245, 39.000], [-77.040, 38.870], [-76.710, 38.660], [-76.540, 38.340],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'shenandoah', name: 'Shenandoah River',
        length_km: 286, states: 'VA, WV',
        source: 'South Fork: Augusta County VA; North Fork: Rockingham County VA', mouth: 'Potomac River at Harpers Ferry, WV',
        note: 'The Shenandoah Valley — the Great Appalachian Valley — is underlain by limestone that weathers to the rich, well-drained soils that made it the "breadbasket of the Confederacy." At Harpers Ferry it meets the Potomac in a spectacular water gap.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-78.700, 38.140], [-78.430, 38.540], [-78.110, 38.870], [-77.880, 39.390],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'rappahannock', name: 'Rappahannock River',
        length_km: 273, states: 'VA',
        source: 'Chester Gap, Blue Ridge Mountains VA', mouth: 'Chesapeake Bay (Rappahannock River mouth)',
        note: 'The Rappahannock\'s fall at Fredericksburg was the commercial anchor of colonial Virginia. George Washington\'s childhood home was across the river. The Battle of Fredericksburg (1862) was fought along its banks.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-78.850, 38.280], [-78.200, 38.480], [-77.468, 38.302],
        [-76.900, 38.060], [-76.660, 37.690],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'james', name: 'James River',
        length_km: 560, states: 'VA',
        source: 'Iron Gate VA (confluence of Jackson and Cowpasture Rivers)', mouth: 'Hampton Roads / Chesapeake Bay',
        note: 'The James was the artery of English America — Jamestown (1607) sat at its tidal mouth. Belle Isle rapids at Richmond mark the fall line; the river powered antebellum tobacco mills and today feeds hydroelectric turbines through the same granite gorge.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-79.700, 37.780], [-79.150, 37.290], [-78.650, 37.540],
        [-77.464, 37.527], [-77.220, 37.300], [-76.590, 37.060],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'new-river', name: 'New River',
        length_km: 518, states: 'NC, VA, WV',
        source: 'Watauga County NC (confluence of forks near Boone)', mouth: 'Ohio River at Point Pleasant, WV (as the Kanawha)',
        note: 'One of the oldest rivers in North America — the New River predates the Appalachian Mountains and flows through them rather than around them. It becomes the Kanawha after merging with the Gauley at Gauley Bridge WV, draining into the Ohio.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-81.700, 36.590], [-80.570, 37.310], [-80.420, 37.800],
        [-81.180, 38.090], [-81.840, 38.370], [-82.010, 38.520],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'roanoke', name: 'Roanoke River',
        length_km: 660, states: 'VA, NC',
        source: 'Near Roanoke VA (confluence of Roanoke and Blackwater Rivers)', mouth: 'Albemarle Sound, NC',
        note: 'The Roanoke cuts through the Blue Ridge at the Roanoke Narrows — a critical Atlantic flyway corridor for migratory birds and American shad. Roanoke Rapids NC sits at the fall line where the river drops from the Piedmont to the coastal plain.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-80.060, 37.280], [-79.520, 37.080], [-77.655, 36.462],
        [-77.000, 36.100], [-76.640, 35.900],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'french-broad', name: 'French Broad River',
        length_km: 298, states: 'NC, TN',
        source: 'Transylvania County NC (near Brevard)', mouth: 'Tennessee River at Knoxville, TN (via confluence with Holston)',
        note: 'One of the few rivers that flow northwest through the Blue Ridge — the French Broad predates the mountain uplift. Its unusual name comes from early English settlers who called land beyond the Blue Ridge "French territory." Near Asheville it drains the largest watershed in the Southern Appalachians.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-82.740, 35.200], [-82.551, 35.579], [-82.900, 35.800],
        [-83.040, 35.960], [-83.120, 36.060], [-83.420, 36.020],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'savannah', name: 'Savannah River',
        length_km: 505, states: 'GA, SC',
        source: 'NE Georgia (confluence of Tugaloo and Seneca Rivers at Lake Hartwell)', mouth: 'Atlantic Ocean at Savannah, GA',
        note: 'The Savannah formed the colonial boundary between British Georgia and the Carolinas. Augusta GA was founded in 1736 by James Oglethorpe at the fall line — the furthest inland point accessible by flatboat from the coast. The river still marks the GA-SC state line.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-83.100, 34.870], [-82.490, 34.250], [-82.020, 33.470],
        [-81.300, 32.720], [-81.020, 32.080],
      ]},
    },
  ],
};

/**
 * Returns full-page detail HTML for a river.
 * @param {string} slug  e.g. "james", "french-broad"
 * @returns {string}
 */
function makeRiverDetailHTML(slug) {
  var river = null;
  for (var i = 0; i < MAJOR_RIVERS_GEOJSON.features.length; i++) {
    if (MAJOR_RIVERS_GEOJSON.features[i].properties.slug === slug) {
      river = MAJOR_RIVERS_GEOJSON.features[i].properties;
      break;
    }
  }
  if (!river) return '';
  var row = function (label, value) {
    return (
      '<div class="detail-fact">' +
        '<span class="detail-fact-label">' + label + '</span>' +
        '<span class="detail-fact-value">' + value + '</span>' +
      '</div>'
    );
  };
  return (
    '<article class="detail-page">' +
      '<div class="detail-region-header" style="border-left:4px solid #4a9eff;padding-left:12px;margin-bottom:0.75rem">' +
        '<h2 class="detail-title" style="margin-bottom:0">' + river.name + '</h2>' +
      '</div>' +
      '<p class="detail-description">' + river.note + '</p>' +
      '<div class="detail-facts">' +
        row('Length',     '~' + river.length_km + ' km') +
        row('States',     river.states) +
        row('Source',     river.source) +
        row('Mouth',      river.mouth) +
      '</div>' +
    '</article>'
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
  BLUE_RIDGE_GEOJSON,
  VALLEY_RIDGE_GEOJSON,
  NE_UPLAND_GEOJSON,
  NE_COASTAL_GEOJSON,
  BLUE_RIDGE_EAST_ESCARPMENT,
  BLUE_RIDGE_WEST_ESCARPMENT,
  STYLES,
  BBOX: { NORTH: BBOX_NORTH, SOUTH: BBOX_SOUTH, EAST: BBOX_EAST, WEST: BBOX_WEST },
  NATIVE_PLANTS,
  makeNativePlantsSection,
  SOIL_TYPES,
  makeSoilSection,
  makeRegionPopup,
  makeFallLinePopup,
  makeRegionDetailHTML,
  makeFallLineDetailHTML,
  makeZoneDetailHTML,
  makeCityDetailHTML,
  classifyLocation,
  makeLocationReport,
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
  NE_FALL_ZONE_GEOJSON,
  MAJOR_RIVERS_GEOJSON,
  makeRiverDetailHTML,
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
