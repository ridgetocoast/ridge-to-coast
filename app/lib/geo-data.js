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
const BBOX_NORTH =  47.500;   // northern Maine / Presque Isle
const BBOX_SOUTH =  24.000;   // Florida Keys
const BBOX_EAST  = -66.500;   // Quoddy Head ME — easternmost US point
const BBOX_WEST  = -92.000;   // western Mississippi / New Orleans area

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
  [-76.900, 41.500],  // Kittatinny Ridge PA — Blue Ridge front at Delaware Water Gap
  [-77.100, 40.700],  // South Mountain PA / Cumberland Valley PA
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
  [-79.200, 41.400],  // Allegheny Front PA / Clearfield County PA
  [-79.000, 40.600],  // Allegheny Front / Blair County PA
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
  [-80.486, 32.352],  // SC coast — southern limit of original corridor
  [-80.700, 32.100],  // Savannah GA / Tybee Island
  [-81.200, 31.200],  // Brunswick GA / Golden Isles
  [-81.400, 30.720],  // Cumberland Island GA / GA–FL state line
  [-81.500, 30.100],  // Jacksonville FL — joins GULF_COASTAL NE corner
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
      ...EAST_COAST_COORDS,         // north→south along outer Atlantic coast (now ends at Jacksonville FL)
      [-82.500, 30.600],            // SE Georgia interior / Satilla River drainage
      [-84.000, 31.500],            // SW Georgia / Alapaha River area
      [-84.700, 32.200],            // SW Georgia / Albany GA area → joins fall line near Columbus GA
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
      [REGION_WEST, 41.500],                           // west edge: up to escarpment north end
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
      // Close ring back to NW corner (must match BLUE_RIDGE_WEST_ESCARPMENT[0])
      BLUE_RIDGE_WEST_ESCARPMENT[0],
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
      // NE corner — must match BLUE_RIDGE_WEST_ESCARPMENT[0] for a seamless Blue Ridge join
      [-79.200, 41.400],   // Allegheny Front PA (= BLUE_RIDGE_WEST_ESCARPMENT[0])
      // Eastern boundary: Blue Ridge western escarpment north → south
      // ends at [-85.000, 34.700] (Cohutta Wilderness, NW Georgia)
      ...BLUE_RIDGE_WEST_ESCARPMENT,
      // Southern boundary: NW Georgia foothills → Alabama/Tennessee Appalachian front
      [-85.800, 35.000],   // NW Alabama — Lookout Mountain / Sand Mountain western escarpment
      [-86.000, 35.800],   // NE Alabama / NW Tennessee — Cumberland Plateau western edge
      // Western boundary: up through KY and eastern OH to Lake Erie
      [-85.500, 36.600],   // TN/KY border — Cumberland Plateau western escarpment
      [-84.000, 37.500],   // Eastern Kentucky — Appalachian Plateau western escarpment
      [-84.800, 38.800],   // Northern Kentucky / Cincinnati OH area (Bluegrass region)
      [-83.000, 39.200],   // SW Ohio / Chillicothe (Appalachian Plateau western edge)
      [-82.000, 40.000],   // SE Ohio / Athens OH (Appalachian Plateau)
      [-80.700, 42.300],   // NW PA / Lake Erie shore (Erie PA — Great Lakes coast)
      // Close ring: Lake Erie back to NE corner at Allegheny Front PA
      [-79.200, 41.400],
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
    region: 'neUpland',
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
      // West boundary: Hudson Valley / Taconic / Green Mountain divide
      [-74.500, 41.900],   // Catskill Mountains / mid-Hudson Valley
      [-74.200, 42.700],   // Catskill Mountains north / Greene County NY
      [-73.900, 43.300],   // Southern Adirondacks foothills / Saratoga Springs area
      [-73.600, 44.000],   // Lake Champlain south — Burlington VT area
      [-73.200, 44.900],   // Vermont interior — south of Quebec border
      [-72.000, 45.000],   // NH / Quebec border at the 45th parallel
      [-70.500, 46.500],   // Central Maine / Aroostook County
      [-67.200, 47.000],   // NE Maine — north terminus
      // East boundary: NE fall zone south from Maine to Peekskill
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
    region: 'neCoastal',
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
      [-67.000, 47.000],   // NE Maine / Quoddy Head — northernmost US Atlantic coast
      [-67.500, 44.800],   // Maine coast / Eastport / Passamaquoddy Bay
      [-70.200, 43.700],   // New Hampshire seacoast / Portsmouth area
      [-70.900, 42.600],   // Massachusetts coast / Plymouth area
      // Cape Cod — extends east to ~70°W before turning south
      [-70.000, 41.700],   // Cape Cod outer elbow / Chatham MA
      [-69.900, 41.550],   // Monomoy Point / Cape Cod south tip
      [-71.000, 41.500],   // Rhode Island coast / Newport area
      [-72.300, 41.200],   // Connecticut coast / New Haven area
      // Long Island — swing south to include the island then back up to Peekskill
      [-72.000, 41.000],   // Eastern Long Island / Montauk Point area
      [-71.900, 40.650],   // Long Island south shore / eastern mid-island
      [-73.100, 40.500],   // Long Island south shore / Fire Island / Babylon
      [-74.000, 40.580],   // Long Island west end / Brooklyn area
      [-74.000, 40.750],   // NY Harbor / Staten Island area
      [-73.920, 41.290],   // Close ring at Peekskill
    ]],
  },
};

/* ─── Great Lakes Basin ──────────────────────────────────────
   The Great Lakes drainage basin within the contiguous US —
   Wisconsin, Michigan, northern Illinois/Indiana/Ohio, and
   western New York. Bounded by the Mississippi River (west),
   the US–Canada border (north), the Appalachian Plateau
   western escarpment (east), and the southern limit of
   Wisconsin glaciation (south, ~41–42°N).
   ────────────────────────────────────────────────────────────── */
const GREAT_LAKES_GEOJSON = {
  type: 'Feature',
  properties: {
    region:      'greatLakes',
    name:        'Great Lakes Basin',
    states:      'WI, MI, IL (N), IN (N), OH (N), PA (NW), NY (W)',
    climate:     'Humid continental — cold winters, lake-effect snow, short growing seasons',
    description:
      'One of the world\'s largest freshwater systems — Lake Superior, Michigan, Huron, ' +
      'Erie, and Ontario hold 21 % of the Earth\'s surface fresh water. The basin\'s ' +
      'calcareous glacial drift produces fertile Alfisols that underpin the Great Lakes ' +
      'agricultural belt, while the lakes themselves moderate temperature extremes and ' +
      'generate legendary lake-effect snowbelts on eastern and southern shores.',
    area_sq_mi:  94250,
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      // SW corner: Mississippi River at Prairie du Chien WI
      [-91.200, 43.000],   // Prairie du Chien WI — Mississippi River
      // NW: up WI/MN border to Lake Superior
      [-92.000, 46.500],   // NW Wisconsin — Bayfield County approach to Lake Superior
      // Lake Superior US south shore: WI through MI Upper Peninsula
      [-90.500, 46.900],   // Ashland WI — Chequamegon Bay, Lake Superior south shore
      [-84.800, 46.500],   // Sault Ste. Marie MI — eastern Lake Superior
      // Michigan Upper Peninsula east end → Mackinac Straits
      [-84.300, 45.800],   // Mackinac City MI — Straits of Mackinac
      // Michigan Lower Peninsula: Lake Huron west coast south to Detroit
      [-82.500, 44.000],   // Alcona Co. MI — mid Lake Huron shore
      [-82.700, 42.600],   // Detroit MI — Lake St. Clair / Detroit River
      // Lake Erie south shore: Toledo area to Buffalo NY
      [-82.700, 41.700],   // Toledo OH — western Lake Erie
      [-80.500, 42.200],   // Cleveland OH — Lake Erie south shore
      [-79.000, 42.900],   // Buffalo NY — Lake Erie east end / Niagara Falls
      // Lake Ontario south shore: Niagara to Watertown NY
      [-76.200, 43.400],   // Rochester NY — Lake Ontario south shore
      [-75.500, 43.700],   // Watertown NY — Lake Ontario eastern end
      // Eastern terminus: southern Adirondack foothills
      [-74.200, 43.500],   // Glens Falls NY — southern Adirondack foothills
      // South through western NY to join valleyRidge at Allegheny Front PA
      [-77.000, 42.000],   // Corning NY — Southern Tier
      [-79.200, 41.400],   // Kane PA — Allegheny Front (= valleyRidge NE corner, seamless join)
      // Southern boundary: inland through OH, IN, IL (limit of Great Lakes drainage)
      [-83.500, 41.200],   // Findlay OH — Maumee / Lake Erie watershed southern limit
      [-84.500, 41.500],   // Fort Wayne IN — Maumee River headwaters
      [-86.000, 41.400],   // Logansport IN — Tippecanoe River basin
      [-87.500, 41.500],   // Chicago IL — southern tip of Lake Michigan
      // SW: along WI/IL border back to Mississippi River
      [-89.500, 42.500],   // Rockford IL area / SW Wisconsin
      [-91.200, 43.000],   // Close ring at Prairie du Chien
    ]],
  },
};

/* ─── Interior Lowlands / Ohio Valley ────────────────────────
   The Ohio–Tennessee–Cumberland river drainage west of the
   Appalachian Plateau — central and western Ohio, Indiana,
   Illinois east of the Mississippi, Kentucky, and central
   Tennessee. Fills the gap between the valleyRidge (east),
   gulfCoastal (south), and greatLakes (north) regions.
   ────────────────────────────────────────────────────────────── */
const INTERIOR_LOWLANDS_GEOJSON = {
  type: 'Feature',
  properties: {
    region:      'interiorLowlands',
    name:        'Interior Lowlands / Ohio Valley',
    states:      'OH (W), IN, IL (E), KY, TN (central)',
    climate:     'Humid continental — warm summers, cold winters; Ohio River tempers extremes',
    description:
      'The great interior heartland drained by the Ohio, Tennessee, and Cumberland ' +
      'rivers — some of the most fertile soils in North America. Deep Alfisols and ' +
      'Mollisols derived from calcareous glacial drift and loess blanket a landscape ' +
      'that transitions from the Bluegrass horse country and Nashville Basin limestone ' +
      'bowls in the south to the flat till-plain corn and soybean belt in the north.',
    area_sq_mi:  165000,
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      // NW corner: Prairie du Chien WI — same as greatLakes SW, Mississippi River
      [-91.200, 43.000],   // Prairie du Chien WI — Mississippi River (= greatLakes SW)
      // W boundary: down the Mississippi River
      [-91.500, 40.500],   // Quincy IL area — Mississippi River
      [-89.000, 37.000],   // Cairo IL — Ohio / Mississippi confluence area
      [-88.000, 35.000],   // Kentucky / Tennessee — connects to gulfCoastal north boundary
      // SE: follow gulfCoastal northern boundary east
      [-86.000, 35.800],   // Huntsville AL / NW Tennessee (= valleyRidge south)
      [-85.800, 35.000],   // NW Alabama escarpment (= valleyRidge / gulfCoastal junction)
      // E boundary: valleyRidge western edge north through KY, OH
      [-85.500, 36.600],   // TN/KY border — Cumberland Plateau western edge (= valleyRidge)
      [-84.000, 37.500],   // Somerset KY — Appalachian Plateau western escarpment (= valleyRidge)
      [-84.800, 38.800],   // Covington KY / Cincinnati OH (= valleyRidge western boundary)
      [-83.000, 39.200],   // Portsmouth OH — Appalachian Plateau western edge (= valleyRidge)
      [-82.000, 40.000],   // Chillicothe OH area (= valleyRidge western boundary)
      // NE: shared boundary with greatLakes southern limit
      [-83.500, 41.200],   // Findlay OH — (= greatLakes southern limit)
      [-84.500, 41.500],   // Fort Wayne IN (= greatLakes)
      [-86.000, 41.400],   // Logansport IN (= greatLakes)
      [-87.500, 41.500],   // Chicago IL (= greatLakes SW)
      [-89.500, 42.500],   // SW Wisconsin (= greatLakes western boundary)
      [-91.200, 43.000],   // Close ring at Prairie du Chien
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
  gulfCoastal: {
    fillColor:   '#4682DC',   // Same coastal blue — Gulf is a continuation of Atlantic Coastal Plain
    fillOpacity: 0.18,
    color:       '#4682DC',
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
  gulfCoastalOutline: {
    fillOpacity: 0,
    fillColor:   '#4682DC',
    color:       '#4682DC',
    weight:      2,
    opacity:     0.65,
    interactive: true,
  },
  neUpland: {
    fillColor:   '#4a9a8a',   // Muted teal — glaciated northern forest
    fillOpacity: 0.18,
    color:       '#4a9a8a',
    weight:      0,
    interactive: true,
  },
  neCoastal: {
    fillColor:   '#6baed6',   // Soft coastal blue — distinctly lighter than Atlantic coastal
    fillOpacity: 0.18,
    color:       '#6baed6',
    weight:      0,
    interactive: true,
  },
  greatLakes: {
    fillColor:   '#4a7ab5',   // Steel blue — Great Lakes water character
    fillOpacity: 0.18,
    color:       '#4a7ab5',
    weight:      0,
    interactive: true,
  },
  interiorLowlands: {
    fillColor:   '#8a7d4a',   // Muted amber-brown — agricultural heartland
    fillOpacity: 0.18,
    color:       '#8a7d4a',
    weight:      0,
    interactive: true,
  },
  neUplandOutline: {
    fillOpacity: 0,
    fillColor:   '#4a9a8a',
    color:       '#4a9a8a',
    weight:      2,
    opacity:     0.65,
    interactive: true,
  },
  neCoastalOutline: {
    fillOpacity: 0,
    fillColor:   '#6baed6',
    color:       '#6baed6',
    weight:      2,
    opacity:     0.65,
    interactive: true,
  },
  greatLakesOutline: {
    fillOpacity: 0,
    fillColor:   '#4a7ab5',
    color:       '#4a7ab5',
    weight:      2,
    opacity:     0.65,
    interactive: true,
  },
  interiorLowlandsOutline: {
    fillOpacity: 0,
    fillColor:   '#8a7d4a',
    color:       '#8a7d4a',
    weight:      2,
    opacity:     0.65,
    interactive: true,
  },
  // Rivers: invisible lines but wide hit area — tooltip + click still work;
  // the CARTO basemap already renders river lines so the overlay stays hidden.
  rivers: {
    color:       'transparent',
    opacity:     0,
    weight:      12,
    fillOpacity: 0,
    interactive: true,
  },
  riversHover: {
    weight:  12,
    opacity: 0,
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
    {
      name:  'American Beautyberry',
      latin: 'Callicarpa americana',
      type:  'shrub',
      note:  'Vivid magenta berries in fall clusters; thrives in Piedmont clay and woodland edges; strong wildlife value for songbirds.',
    },
    {
      name:  'Mayapple',
      latin: 'Podophyllum peltatum',
      type:  'perennial',
      note:  'Woodland floor groundcover; large umbrella-like leaves carpet Piedmont mesic slopes; lemon-yellow fruit edible when fully ripe.',
    },
    {
      name:  'Wild Ginger',
      latin: 'Asarum canadense',
      type:  'perennial',
      note:  'Low-growing groundcover for heavy clay; ginger-scented rhizomes; reddish-brown spring flowers hidden at the leaf base.',
    },
    {
      name:  'Cinnamon Fern',
      latin: 'Osmundastrum cinnamomeum',
      type:  'fern',
      note:  'Large shuttlecock fern of moist Piedmont bottomlands; distinctive cinnamon-brown fertile fronds emerge in spring.',
    },
    {
      name:  'Trumpet Honeysuckle',
      latin: 'Lonicera sempervirens',
      type:  'vine',
      note:  'Native alternative to invasive Japanese honeysuckle; scarlet tubular flowers attract hummingbirds and clearwing moths.',
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
    {
      name:  'Inkberry',
      latin: 'Ilex glabra',
      type:  'shrub',
      note:  'Evergreen native holly of coastal plain wetlands; glossy black berries persist through winter and feed over 20 bird species.',
    },
    {
      name:  'Wax Myrtle',
      latin: 'Morella cerifera',
      type:  'shrub',
      note:  'Salt-tolerant evergreen shrub of coastal edges and pocosins; aromatic waxy berries were used to make bayberry candles.',
    },
    {
      name:  'Swamp Milkweed',
      latin: 'Asclepias incarnata',
      type:  'perennial',
      note:  'Essential monarch butterfly host plant; thrives in wet sandy Coastal Plain soils and tidal marsh edges; pink flower clusters.',
    },
    {
      name:  'Blue-eyed Grass',
      latin: 'Sisyrinchium angustifolium',
      type:  'perennial',
      note:  'Delicate grass-like perennial of sandy Coastal Plain meadows; small blue-violet flowers with a yellow center in spring.',
    },
    {
      name:  'Royal Fern',
      latin: 'Osmunda regalis',
      type:  'fern',
      note:  'Large fern of coastal plain wetlands and pocosins; distinctive fertile pinnae resemble flowering plumes at the frond tips.',
    },
    {
      name:  'Virginia Creeper',
      latin: 'Parthenocissus quinquefolia',
      type:  'vine',
      note:  'Five-leaflet native vine with brilliant scarlet fall color; small dark berries are a critical food source for migratory birds.',
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
    {
      name:  'Tulip Poplar',
      latin: 'Liriodendron tulipifera',
      type:  'tree',
      note:  'Tallest eastern hardwood; grows fastest in the rich mesic soils of fall line ravines; tulip-shaped yellow-green flowers in May.',
    },
    {
      name:  'American Beech',
      latin: 'Fagus grandifolia',
      type:  'tree',
      note:  'Signature tree of undisturbed fall line slopes; smooth silver-gray bark; beechnuts are a critical mast crop for bears, turkeys, and deer.',
    },
    {
      name:  'Black Birch',
      latin: 'Betula lenta',
      type:  'tree',
      note:  'Rocky fall line slopes and gorges; wintergreen-scented twigs; a pioneer on disturbed shale outcrops along the crystalline-sediment boundary.',
    },
    {
      name:  'Jack-in-the-Pulpit',
      latin: 'Arisaema triphyllum',
      type:  'perennial',
      note:  'Shaded fall line coves and streambanks; hooded spathe protects tiny flowers; clusters of brilliant red berries persist into fall.',
    },
    {
      name:  'River Oats',
      latin: 'Chasmanthium latifolium',
      type:  'grass',
      note:  'Graceful shade-tolerant grass of fall line stream corridors; flat dangling spikelets rattle in the wind through winter.',
    },
    {
      name:  'Cross Vine',
      latin: 'Bignonia capreolata',
      type:  'vine',
      note:  'Bold orange-red trumpet flowers in spring; semi-evergreen; clings to fall line tree trunks and rocky outcrops with adhesive tendrils.',
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
    {
      name:  'Yellow Buckeye',
      latin: 'Aesculus flava',
      type:  'tree',
      note:  'Dominant tree of rich Blue Ridge cove forests; large compound leaves and yellow flower spikes; glossy buckeye nuts ripen in September.',
    },
    {
      name:  'Turk\'s Cap Lily',
      latin: 'Lilium superbum',
      type:  'perennial',
      note:  'Spectacular mountain lily reaching 6–8 ft; recurved orange-red petals with purple spots; grows in wet mountain meadows and seeps.',
    },
    {
      name:  'Mountain Oat Grass',
      latin: 'Danthonia compressa',
      type:  'grass',
      note:  'Characteristic grass of high-elevation rocky balds and mountain meadows; flat leaf blades; one of few grasses tolerant of spruce-fir zone conditions.',
    },
    {
      name:  'Maidenhair Fern',
      latin: 'Adiantum pedatum',
      type:  'fern',
      note:  'Delicate fan-shaped fronds on glossy black stems; indicator of undisturbed rich cove forest soils; grows in dense colonies along mountain streams.',
    },
    {
      name:  'American Wisteria',
      latin: 'Wisteria frutescens',
      type:  'vine',
      note:  'Native wisteria — not invasive; fragrant blue-purple flower clusters in spring; grows along Blue Ridge waterways and forest edges.',
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
    {
      name:  'Wild Bergamot',
      latin: 'Monarda fistulosa',
      type:  'perennial',
      note:  'Lavender flower heads attract bumblebees and hummingbirds; thrives on calcareous soils and limestone glades of the Great Valley; aromatic oregano-like foliage.',
    },
    {
      name:  'Buttonbush',
      latin: 'Cephalanthus occidentalis',
      type:  'shrub',
      note:  'Distinctive spherical white flower heads like lacrosse balls; dominant shrub of Valley & Ridge stream margins and flooded limestone flats.',
    },
    {
      name:  'Wild Azalea',
      latin: 'Rhododendron canescens',
      type:  'shrub',
      note:  'Fragrant pink flowers before the leaves emerge in early spring; lights up limestone-influenced bottomland forests throughout the Appalachian Valley.',
    },
    {
      name:  'Big Bluestem',
      latin: 'Andropogon gerardii',
      type:  'grass',
      note:  'Tallgrass prairie icon reaching 6–8 ft; dominant on Valley & Ridge limestone glades and calcareous cedar prairies; three-pronged seedhead called turkey-foot.',
    },
    {
      name:  'Ostrich Fern',
      latin: 'Matteuccia struthiopteris',
      type:  'fern',
      note:  'Vase-shaped fern of Valley & Ridge alluvial bottomlands; edible fiddleheads in spring; tolerates seasonal flooding on limestone river terraces.',
    },
    {
      name:  'Groundnut',
      latin: 'Apios americana',
      type:  'vine',
      note:  'Tuberous nitrogen-fixing vine of streambanks and bottomland thickets; fragrant maroon-pink flowers; edible tubers were a staple food for Indigenous peoples.',
    },
  ],
  gulfCoastal: [
    {
      name:  'Live Oak',
      latin: 'Quercus virginiana',
      type:  'tree',
      note:  'Iconic spreading evergreen oak of the Gulf and South Atlantic coasts; salt-tolerant, hurricane-resistant, and extraordinarily long-lived',
    },
    {
      name:  'Longleaf Pine',
      latin: 'Pinus palustris',
      type:  'tree',
      note:  'Keystone of the Gulf Coastal Plain savanna; once covered 90 million acres, now reduced to 3%; fire-dependent ecosystem supports hundreds of rare species',
    },
    {
      name:  'Bald Cypress',
      latin: 'Taxodium distichum',
      type:  'tree',
      note:  'Dominant tree of Gulf Coast swamps and bayous; knees emerge from saturated soils; can live over 1,000 years in undisturbed bottomlands',
    },
    {
      name:  'Saw Palmetto',
      latin: 'Serenoa repens',
      type:  'shrub',
      note:  'Defining ground cover of Florida scrub and coastal pine flatwoods; extremely fire-tolerant with a root crown that survives repeated burns',
    },
    {
      name:  'Southern Magnolia',
      latin: 'Magnolia grandiflora',
      type:  'tree',
      note:  'Signature broadleaf evergreen of the Gulf South; large fragrant white flowers; thrives in the warm, humid subtropical climate',
    },
    {
      name:  'Purple Pitcher Plant',
      latin: 'Sarracenia purpurea',
      type:  'perennial',
      note:  'Carnivorous bog plant of Gulf Coast pitcher plant prairies; traps insects in rain-filled pitchers; indicator of undisturbed acidic wetlands',
    },
    {
      name:  'Yaupon Holly',
      latin: 'Ilex vomitoria',
      type:  'shrub',
      note:  'The only caffeinated plant native to North America; salt-tolerant evergreen shrub of Gulf Coast scrub and maritime forests; red berries for birds.',
    },
    {
      name:  'Cardinal Flower',
      latin: 'Lobelia cardinalis',
      type:  'perennial',
      note:  'Brilliant scarlet spikes are the quintessential hummingbird plant; thrives in Gulf coastal wetlands, bayou margins, and moist pine savannas.',
    },
    {
      name:  'Black-eyed Susan',
      latin: 'Rudbeckia hirta',
      type:  'perennial',
      note:  'Tough short-lived perennial of Gulf Coastal Plain pine savannas and roadsides; golden-yellow daisy with dark cone; self-seeds reliably in sandy soils.',
    },
    {
      name:  'Gulf Muhly',
      latin: 'Muhlenbergia capillaris',
      type:  'grass',
      note:  'Clouds of rosy-pink flower plumes in October define Gulf Coast grasslands and longleaf pine savannas; extremely drought-tolerant once established.',
    },
    {
      name:  'Netted Chain Fern',
      latin: 'Woodwardia areolata',
      type:  'fern',
      note:  'Distinctive chain-like spore pattern on fertile fronds; indicator of undisturbed Gulf Coast boggy flatwoods, seepage bogs, and pitcher plant prairies.',
    },
    {
      name:  'Trumpet Creeper',
      latin: 'Campsis radicans',
      type:  'vine',
      note:  'Vigorous native vine of Gulf South fence rows and forest edges; large orange-red trumpet flowers are a major hummingbird nectar source all summer.',
    },
  ],
  neUpland: [
    { name: 'Sugar Maple',         latin: 'Acer saccharum',             type: 'tree',      note: 'Iconic New England canopy tree; thin acidic glacial soils produce the intense fall color and concentrated sap for maple syrup production.' },
    { name: 'Yellow Birch',        latin: 'Betula alleghaniensis',      type: 'tree',      note: 'Characteristic upland tree of rocky glaciated slopes; wintergreen-scented bark; the primary hardwood of the northern hardwood forest.' },
    { name: 'Eastern White Pine',  latin: 'Pinus strobus',              type: 'tree',      note: 'Dominant conifer of the NE upland — grows on thin glacial till where hardwoods struggle; its mast timbers built the Royal Navy and the colonial fishing fleet.' },
    { name: 'White Trillium',      latin: 'Trillium grandiflorum',      type: 'perennial', note: 'Spring ephemeral of rich glacial till mesic forests; requires undisturbed soil with deep leaf litter; indicator of old-growth or long-recovering forest.' },
    { name: 'Bunchberry',          latin: 'Cornus canadensis',          type: 'perennial', note: 'Low groundcover on acidic rocky soils and under conifers; tiny white flowers and bright red berry clusters; related to flowering dogwood but only 6 inches tall.' },
    { name: 'Blue Cohosh',         latin: 'Caulophyllum thalictroides', type: 'perennial', note: 'Rich cove and mesic glacial till forest floor; blue-black berries and bluish-green foliage; indicator of calcareous influence in otherwise acidic upland soils.' },
    { name: 'Lowbush Blueberry',   latin: 'Vaccinium angustifolium',    type: 'shrub',     note: 'Native to acidic rocky barrens and thin glacial soils; fire-adapted — crown-sprouts prolifically after burn; the foundation of Maine\'s wild blueberry industry.' },
    { name: 'Mountain Laurel',     latin: 'Kalmia latifolia',           type: 'shrub',     note: 'Broad-leaved evergreen of rocky acidic upland slopes; showy pink-white flower clusters in June; state flower of CT and PA; extremely drought-tolerant once established.' },
    { name: 'Pennsylvania Sedge',  latin: 'Carex pensylvanica',         type: 'grass',     note: 'Fine-textured groundcover sedge of dry acid oak-pine woodland; forms dense mats under thin glacial soils; excellent lawn alternative in shaded acidic sites.' },
    { name: 'Christmas Fern',      latin: 'Polystichum acrostichoides', type: 'fern',      note: 'Evergreen fern of rocky upland slopes and ledge outcrops; one of the most common ferns of the NE upland; persists through snow cover providing winter wildlife cover.' },
    { name: 'Climbing Bittersweet', latin: 'Celastrus scandens',        type: 'vine',      note: 'Native alternative to invasive Oriental bittersweet; orange-red berried capsules in fall; critical food source for migratory thrushes and waxwings on fall foliage routes.' },
  ],
  neCoastal: [
    { name: 'Pitch Pine',          latin: 'Pinus rigida',               type: 'tree',      note: 'Fire-adapted pine of the coastal barrens — the only eastern pine that sprouts from the trunk after fire; dominates the sandy glacial outwash plains of Cape Cod, Long Island, and the Pine Barrens of NJ.' },
    { name: 'Black Cherry',        latin: 'Prunus serotina',            type: 'tree',      note: 'Fast-growing woodland edge tree of coastal sandy soils; aromatic bark; small black cherries are the single most important wildlife fruit in the Northeast.' },
    { name: 'American Holly',      latin: 'Ilex opaca',                 type: 'tree',      note: 'Broadleaf evergreen of coastal plain and maritime forest; red berries persist through winter providing late-season food for cedar waxwings and hermit thrushes.' },
    { name: 'Seaside Goldenrod',   latin: 'Solidago sempervirens',      type: 'perennial', note: 'Salt-tolerant perennial of dunes, salt marshes, and coastal roadsides; late-season nectar source for monarch butterflies on their southward migration.' },
    { name: 'Sea Lavender',        latin: 'Limonium carolinianum',      type: 'perennial', note: 'Lavender-purple flower spikes of tidal salt marshes; blooms August–September; dried flower heads persist through winter; indicator of high marsh zones.' },
    { name: 'Wild Columbine',      latin: 'Aquilegia canadensis',       type: 'perennial', note: 'Red-and-yellow pendulous flowers on rocky coastal outcrops and thin sandy soils; primary spring nectar source for ruby-throated hummingbirds arriving from Central America.' },
    { name: 'Bayberry',            latin: 'Morella caroliniensis',      type: 'shrub',     note: 'Aromatic waxy berries are the original candle wax of the colonial era; salt-spray tolerant; nitrogen-fixing; critical stopover food for yellow-rumped warblers in fall migration.' },
    { name: 'Highbush Blueberry',  latin: 'Vaccinium corymbosum',       type: 'shrub',     note: 'Native to coastal bogs and sandy acid soils; parent of all commercial blueberry cultivars; larval host for over 200 butterfly and moth species.' },
    { name: 'American Beach Grass', latin: 'Ammophila breviligulata',   type: 'grass',     note: 'Primary dune-building grass of the Atlantic coast; horizontal rhizomes stabilize shifting sand by growing upward as burial increases; essential to Cape Cod, Long Island, and barrier island dune ecosystems.' },
    { name: 'Sensitive Fern',      latin: 'Onoclea sensibilis',         type: 'fern',      note: 'Common fern of coastal wetland margins, freshwater swales, and inter-dune swales behind barrier beaches; first fronds to wilt at frost (hence the name); beaded fertile fronds persist as wildlife cover.' },
    { name: 'Groundnut',           latin: 'Apios americana',            type: 'vine',      note: 'Nitrogen-fixing legume vine of coastal thickets and wetland edges; edible starchy tubers were a major food source for Wampanoag and Narragansett peoples and the Pilgrims\' first winter.' },
  ],
  greatLakes: [
    { name: 'Bur Oak',             latin: 'Quercus macrocarpa',         type: 'tree',      note: 'Fire-resistant savanna oak of the Great Lakes transition zone; massive corky bark and deep taproot; anchor species of the oak openings ecosystem along Lake Erie and southern Lake Michigan shorelines.' },
    { name: 'Paper Birch',         latin: 'Betula papyrifera',          type: 'tree',      note: 'Iconic white-barked birch of the boreal-temperate transition; colonizes post-disturbance openings around Lake Superior; bark used for canoe construction by Ojibwe and other Great Lakes nations for millennia.' },
    { name: 'Tamarack',            latin: 'Larix laricina',             type: 'tree',      note: 'The only deciduous conifer of the Great Lakes basin; brilliant gold in October before needle-drop; grows in cold sphagnum bogs and wetlands from Lake Superior south to Indiana; indicator of high water table.' },
    { name: 'Prairie Blazing Star', latin: 'Liatris pycnostachya',      type: 'perennial', note: 'Magenta spikes of the tallgrass prairie openings along Lake Michigan; blooms top-to-bottom unlike most plants; critical monarch butterfly nectar source on the fall migration corridor along the lake.' },
    { name: 'Wild Bergamot',       latin: 'Monarda fistulosa',          type: 'perennial', note: 'Aromatic perennial of dry prairie and savanna openings around the Great Lakes; lavender flower heads attract a diversity of native bees including specialist mining bees; the original North American culinary herb.' },
    { name: 'Jack-in-the-Pulpit',  latin: 'Arisaema triphyllum',        type: 'perennial', note: 'Fascinating spring wildflower of moist lakeside and riparian forests; the hooded spathe shelters the spadix; bright red berries in fall toxic to most animals but eaten by wood thrushes.' },
    { name: 'Buttonbush',          latin: 'Cephalanthus occidentalis',  type: 'shrub',     note: 'Spherical white flower heads of lakeshores and wetland margins; critical nectar plant; woody structure provides year-round nesting and roosting habitat for songbirds and waterfowl.' },
    { name: 'Nannyberry',          latin: 'Viburnum lentago',           type: 'shrub',     note: 'Tall native viburnum of wetland edges and stream banks around the Great Lakes; clusters of blue-black berries in fall are heavily utilized by migrating cedar waxwings and American robins.' },
    { name: 'Big Bluestem',        latin: 'Andropogon gerardii',        type: 'grass',     note: 'The signature grass of the tallgrass prairie — reaches 8 feet in deep Great Lakes basin soils; its three-pronged seed head gives it the name "turkey foot"; foundation species of the prairie-forest mosaic.' },
    { name: 'Ostrich Fern',        latin: 'Matteuccia struthiopteris',  type: 'fern',      note: 'Spectacular vase-shaped fern of lakeside floodplains and rich bottomlands; edible fiddleheads harvested in spring; spreads by underground stolons to form large colonies in moist Great Lakes riparian corridors.' },
    { name: 'Wild Grape',          latin: 'Vitis riparia',              type: 'vine',      note: 'Riverbank grape of Great Lakes shorelines and stream corridors; extremely cold-hardy to zone 2; parent species of many cold-climate wine grape cultivars; berries feed over 100 bird species in fall migration.' },
  ],
  interiorLowlands: [
    { name: 'Tulip Poplar',        latin: 'Liriodendron tulipifera',    type: 'tree',      note: 'Fastest-growing eastern hardwood; the tallest tree of the Ohio Valley bottomlands reaching 150 feet; orange-and-green tulip-shaped flowers in May; pioneer species on rich alluvial Interior Lowlands soils.' },
    { name: 'Sycamore',            latin: 'Platanus occidentalis',      type: 'tree',      note: 'Massive streamside giant of the Ohio River and its tributaries; the white-barked upper canopy is visible from miles away; once sustained the largest contiguous deciduous forest in the world across the Interior Lowlands.' },
    { name: 'Shagbark Hickory',    latin: 'Carya ovata',                type: 'tree',      note: 'Shaggy-barked mast producer of the Interior Lowlands till plains; deep roots break glacial subsoil; the heaviest and hardest-hitting of all Appalachian hardwoods; critical winter food for fox squirrels.' },
    { name: 'Pale Purple Coneflower', latin: 'Echinacea pallida',       type: 'perennial', note: 'Long-petaled coneflower of the tallgrass prairie remnants of Indiana, Illinois, and Kentucky; blooms drooping petals contrast with the orange central cone; deep taproot — survives drought and fire.' },
    { name: 'Wild Blue Phlox',     latin: 'Phlox divaricata',           type: 'perennial', note: 'Carpet-forming spring wildflower of the Interior Plateau river corridors; fragrant blue-lavender blooms in April–May; spreads by stolons in rich limestone-derived mesic soils of the Bluegrass and Nashville Basin.' },
    { name: 'Cup Plant',           latin: 'Silphium perfoliatum',       type: 'perennial', note: 'Towering prairie perennial — paired leaves form cups that hold rainwater for insects and birds; reaches 8 feet in deep Interior Lowlands soils; a landmark plant of the Illinois and Indiana tallgrass prairie remnants.' },
    { name: 'Spicebush',           latin: 'Lindera benzoin',            type: 'shrub',     note: 'Aromatic understory shrub of the Interior Plateau river corridors; earliest woodland shrub to flower in spring; red berries ripen in fall and are the primary food source for migrating wood thrushes along the Ohio Valley.' },
    { name: 'Elderberry',          latin: 'Sambucus canadensis',        type: 'shrub',     note: 'Fast-growing shrub of disturbed alluvial soils along the Ohio River and its tributaries; heavy fruit clusters in August; supports over 40 bird species; flowers and berries have centuries of culinary and medicinal use.' },
    { name: 'Prairie Dropseed',    latin: 'Sporobolus heterolepis',     type: 'grass',     note: 'Fine-textured bunchgrass of the Interior Lowlands prairie remnants; fragrant coriander-scented seeds ripen in fall; extremely long-lived (100+ years) in undisturbed prairie; indicator of intact glaciated prairie soils.' },
    { name: 'Maidenhair Fern',     latin: 'Adiantum pedatum',           type: 'fern',      note: 'Delicate fan-shaped fern of rich cove forests and limestone hollow floors of the Interior Plateau; requires calcium-rich soils — a reliable indicator of the phosphatic limestone geology underlying the Bluegrass and Nashville Basin.' },
    { name: 'Trumpet Vine',        latin: 'Campsis radicans',           type: 'vine',      note: 'Vigorous native vine of the Interior Lowlands floodplains; large orange-red trumpet flowers June–September are a critical hummingbird nectar source; self-clinging on brick and stone; can top 40 feet on mature riparian trees.' },
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
  gulfCoastal: {
    series:     'Lakeland–Blanton–Ocilla (Entisols / Ultisols)',
    texture:    'Fine sand to sandy loam (deep, highly permeable)',
    pH:         '4.5–6.0 (strongly to moderately acidic)',
    drainage:   'Excessively drained on uplands; poorly to very poorly drained in flatwoods and swamps; hardpan (spodic) layer common 24–48 in. below surface',
    amendments: 'Heavy organic matter needed to retain moisture and nutrients in sandy profiles; raised beds recommended for vegetables; avoid waterlogging in flatwoods; sulfur rarely needed — soils already acidic',
  },
  neUpland: {
    series:     'Paxton–Montauk–Charlton (Inceptisols / Spodosols from glacial till)',
    texture:    'Stony sandy loam to gravelly loam (thin, rocky profiles from glacial scour)',
    pH:         '4.5–5.5 (strongly acidic; granite and gneiss parent material)',
    drainage:   'Excessively drained on bedrock outcrops; perched water tables in glacial kettles and low-lying depressions; frost-heave common above 1000 ft',
    amendments: 'Ericaceous compost for acid-loving shrubs; deep organic mulch critical to retain moisture in thin soils; sulfur rarely needed — already acidic; avoid alkaline lime without a soil test',
  },
  neCoastal: {
    series:     'Plymouth–Carver–Deerfield (Entisols / Spodosols from glacial outwash)',
    texture:    'Fine sand to coarse sand (glacial outwash plains — essentially beach sand inland)',
    pH:         '4.0–5.5 (very acidic; heavy leaching from sandy parent material)',
    drainage:   'Excessively drained on outwash plains; perched bogs in low swales; water table very close to surface in coastal lowlands',
    amendments: 'Massive organic matter additions critical — sand holds almost no nutrients or moisture; raised beds strongly recommended; slow-release organic fertilizers; great for blueberries and cranberries with no pH adjustment needed',
  },
  greatLakes: {
    series:     'Poygan–Hochheim–Kewaunee (Alfisols / Mollisols from calcareous glacial till)',
    texture:    'Silty clay loam to sandy loam (glacial drift rich in limestone and dolomite)',
    pH:         '6.5–7.8 (near-neutral to mildly alkaline; calcareous till parent material)',
    drainage:   'Well to moderately drained on till plains; seasonally wet in glacial lake plains near shorelines; abundant tile drainage in agricultural areas',
    amendments: 'Generally fertile with minimal amendment needed; iron and manganese deficiency possible at high pH; lime rarely needed; excellent for vegetable production; watch for compaction in heavy clay till near lake shores',
  },
  interiorLowlands: {
    series:     'Miami–Crosby–Cincinnati (Alfisols from calcareous till; Mollisols in prairie zones)',
    texture:    'Silt loam to silty clay loam (some of the deepest, most fertile soils in North America)',
    pH:         '6.0–7.5 (near-neutral; limestone-influenced; prairie Mollisols slightly more acidic)',
    drainage:   'Variable — well drained on ridge tops; poorly drained in glaciated till plains; extensive tile drainage installed historically; rich Ohio River bottomlands seasonally flooded',
    amendments: 'Historically among the most productive soils on Earth; phosphorus and potassium often adequate; organic matter additions improve drainage in heavy clay subsoils; nitrogen is the primary limiting nutrient in row-crop agriculture',
  },
};

/* ─── Invasive species by ecoregion ─────────────────────────────
   Key invasive plants to watch for — listed for gardener awareness
   so they can avoid purchasing and help remove them. Each entry:
     name   — common name
     latin  — binomial (genus species)
     type   — 'tree' | 'shrub' | 'perennial' | 'grass' | 'vine'
     threat — 'high' | 'medium'
     note   — brief impact description
   ────────────────────────────────────────────────────────────── */
const INVASIVE_SPECIES = {
  coastal: [
    { name: 'Kudzu',           latin: 'Pueraria montana',       type: 'vine',      threat: 'high',   note: 'Smothers entire forest edges at up to 1 ft/day in summer; kills trees by blocking sunlight and adding ice-load weight.' },
    { name: 'Japanese Honeysuckle', latin: 'Lonicera japonica', type: 'vine',      threat: 'high',   note: 'Evergreen vine that outcompetes native understory shrubs; sweet fragrance masks aggressive spread through woodland edges and roadsides.' },
    { name: 'Common Reed',     latin: 'Phragmites australis',   type: 'grass',     threat: 'high',   note: 'Non-native genotype displaces native cordgrass and cattail in tidal marshes; tall dense stands eliminate habitat for marsh birds and diamondback terrapins.' },
    { name: 'Chinese Privet',  latin: 'Ligustrum sinense',      type: 'shrub',     threat: 'high',   note: 'Dense thickets in riparian corridors; outcompetes native shrubs; berries spread by birds; nearly impossible to eradicate without repeated cutting and herbicide treatment.' },
  ],
  piedmont: [
    { name: 'Tree of Heaven',  latin: 'Ailanthus altissima',    type: 'tree',      threat: 'high',   note: 'Allelopathic — roots release chemicals that kill nearby plants; hosts spotted lanternfly; one tree produces up to 350,000 wind-dispersed seeds per year.' },
    { name: 'Kudzu',           latin: 'Pueraria montana',       type: 'vine',      threat: 'high',   note: 'Smothers entire forest edges at up to 1 ft/day in summer; kills trees by blocking sunlight and adding ice-load weight.' },
    { name: 'Japanese Honeysuckle', latin: 'Lonicera japonica', type: 'vine',      threat: 'high',   note: 'Evergreen vine that outcompetes native understory shrubs; sweet fragrance masks aggressive spread through woodland edges and roadsides.' },
    { name: 'Chinese Wisteria', latin: 'Wisteria sinensis',     type: 'vine',      threat: 'medium', note: 'Woody vine that girdles and kills mature trees; sold widely in nurseries despite invasive status; native American wisteria (W. frutescens) is the correct substitute.' },
  ],
  ecotone: [
    { name: 'Kudzu',           latin: 'Pueraria montana',       type: 'vine',      threat: 'high',   note: 'Smothers entire forest edges at up to 1 ft/day in summer; kills trees by blocking sunlight and adding ice-load weight.' },
    { name: 'Japanese Honeysuckle', latin: 'Lonicera japonica', type: 'vine',      threat: 'high',   note: 'Evergreen vine that outcompetes native understory shrubs; sweet fragrance masks aggressive spread through woodland edges and roadsides.' },
    { name: 'Chinese Privet',  latin: 'Ligustrum sinense',      type: 'shrub',     threat: 'high',   note: 'Dense thickets in riparian corridors; outcompetes native shrubs; berries spread by birds; nearly impossible to eradicate without repeated cutting and herbicide treatment.' },
    { name: 'Tree of Heaven',  latin: 'Ailanthus altissima',    type: 'tree',      threat: 'high',   note: 'Allelopathic — roots release chemicals that kill nearby plants; hosts spotted lanternfly; one tree produces up to 350,000 wind-dispersed seeds per year.' },
  ],
  blueRidge: [
    { name: 'Tree of Heaven',  latin: 'Ailanthus altissima',    type: 'tree',      threat: 'high',   note: 'Advancing upslope along road corridors through the Blue Ridge; allelopathic; primary host of the spotted lanternfly now spreading through Appalachian orchards and vineyards.' },
    { name: 'Japanese Honeysuckle', latin: 'Lonicera japonica', type: 'vine',      threat: 'high',   note: 'Smothers native wildflowers and shrub layer in forest openings and roadside edges; evergreen growth gives it a head start on native deciduous shrubs each spring.' },
    { name: 'Autumn Olive',    latin: 'Elaeagnus umbellata',    type: 'shrub',     threat: 'high',   note: 'Nitrogen-fixing shrub that alters soil chemistry, enabling its own spread; over 80 bird species eat the berries, distributing seeds widely across mountain gaps and balds.' },
    { name: 'Multiflora Rose', latin: 'Rosa multiflora',        type: 'shrub',     threat: 'high',   note: 'Forms impenetrable thickets on mountain meadows and forest edges; each plant produces up to 500,000 seeds per year spread by birds; thorny enough to exclude livestock and humans.' },
  ],
  valleyRidge: [
    { name: 'Autumn Olive',    latin: 'Elaeagnus umbellata',    type: 'shrub',     threat: 'high',   note: 'Nitrogen-fixing shrub that alters soil chemistry, enabling its own spread; over 80 bird species eat the berries, distributing seeds widely across mountain gaps and balds.' },
    { name: 'Multiflora Rose', latin: 'Rosa multiflora',        type: 'shrub',     threat: 'high',   note: 'Forms impenetrable thickets on mountain meadows and forest edges; each plant produces up to 500,000 seeds per year spread by birds; thorny enough to exclude livestock and humans.' },
    { name: 'Japanese Honeysuckle', latin: 'Lonicera japonica', type: 'vine',      threat: 'high',   note: 'Smothers native wildflowers and shrub layer in forest openings and roadside edges; evergreen growth gives it a head start on native deciduous shrubs each spring.' },
    { name: 'Tree of Heaven',  latin: 'Ailanthus altissima',    type: 'tree',      threat: 'high',   note: 'Advancing through the Great Appalachian Valley road network; allelopathic; primary host of the spotted lanternfly devastating Pennsylvania, Virginia, and West Virginia orchards.' },
  ],
  gulfCoastal: [
    { name: 'Kudzu',           latin: 'Pueraria montana',       type: 'vine',      threat: 'high',   note: 'The Gulf South is ground zero for kudzu — introduced in 1876 at the Philadelphia Centennial Exposition and distributed by the USDA through the 1950s; now covers over 7 million acres of the South.' },
    { name: 'Cogon Grass',     latin: 'Imperata cylindrica',    type: 'grass',     threat: 'high',   note: 'Listed among the world\'s 10 worst invasive weeds; spreads by sharp rhizomes that penetrate through mulch; highly flammable and burns hotter than native grass — alters natural fire regimes in longleaf pine savannas.' },
    { name: 'Water Hyacinth',  latin: 'Eichhornia crassipes',   type: 'perennial', threat: 'high',   note: 'Floating mats double in size every two weeks, blocking sunlight and depleting oxygen from Gulf coast waterways; considered one of the most problematic aquatic invasives in the world.' },
    { name: 'Chinese Tallow',  latin: 'Triadica sebifera',      type: 'tree',      threat: 'high',   note: 'Rapidly converting Gulf Coast prairies and marshes into monoculture forest; birds disperse seeds widely; changes soil chemistry; extremely difficult to remove once established in coastal soils.' },
  ],
  neUpland: [
    { name: 'Japanese Barberry', latin: 'Berberis thunbergii',  type: 'shrub',     threat: 'high',   note: 'Creates tick habitat in dense understory thickets; studies show barberry patches have 12× higher tick density and 120× higher Lyme disease risk than native vegetation; still widely sold in nurseries.' },
    { name: 'Oriental Bittersweet', latin: 'Celastrus orbiculatus', type: 'vine',  threat: 'high',   note: 'Girdles and topples mature trees throughout the New England Upland; spreads rapidly along forest edges; easily confused with native bittersweet (C. scandens) — look for berries along the full stem, not just the tips.' },
    { name: 'Burning Bush',    latin: 'Euonymus alatus',        type: 'shrub',     threat: 'medium', note: 'Brilliant red fall color has made it ubiquitous in New England landscapes; birds distribute seeds into forest edges and stream corridors; native alternatives include native blueberries or itea.' },
    { name: 'Garlic Mustard',  latin: 'Alliaria petiolata',     type: 'perennial', threat: 'high',   note: 'Allelopathic root exudates disrupt the mycorrhizal networks that forest trees depend on; invades deep forest understory unlike most invasives; hand-pull before seed set (April–May) and bag carefully.' },
  ],
  neCoastal: [
    { name: 'Common Reed',     latin: 'Phragmites australis',   type: 'grass',     threat: 'high',   note: 'Non-native genotype has displaced native cordgrass throughout New England salt marshes and coastal wetlands; tall monocultures eliminate nesting habitat for seaside sparrows and salt marsh sparrows.' },
    { name: 'Japanese Knotweed', latin: 'Fallopia japonica',    type: 'perennial', threat: 'high',   note: 'Rhizomes penetrate concrete and foundations; extremely difficult to eradicate — regrows from 0.7g root fragments; forms dense monocultures along New England coastal stream corridors and disturbed sites.' },
    { name: 'Beach Rose',      latin: 'Rosa rugosa',            type: 'shrub',     threat: 'medium', note: 'Native to coastal Asia, widely planted for dune stabilization; now invades native beach plum and cranberry communities on Cape Cod, Long Island, and throughout the New England coast.' },
    { name: 'Japanese Barberry', latin: 'Berberis thunbergii',  type: 'shrub',     threat: 'high',   note: 'Creates tick habitat in dense understory thickets; studies show barberry patches have 12× higher tick density and 120× higher Lyme disease risk than native vegetation; still widely sold in nurseries.' },
  ],
  greatLakes: [
    { name: 'Common Buckthorn', latin: 'Rhamnus cathartica',    type: 'shrub',     threat: 'high',   note: 'Leafs out early and drops leaves late, shading out native understory plants for weeks longer than native shrubs; berries cause diarrhea in birds, accelerating seed dispersal; nearly impossible to eradicate without sustained effort.' },
    { name: 'Garlic Mustard',  latin: 'Alliaria petiolata',     type: 'perennial', threat: 'high',   note: 'The most aggressive invasive of Great Lakes forests; allelopathic root exudates disrupt mycorrhizal networks that oaks and maples depend on for nutrient uptake; pull before seed set in May.' },
    { name: 'Purple Loosestrife', latin: 'Lythrum salicaria',   type: 'perennial', threat: 'high',   note: 'Dense stands have replaced native cattail and bulrush in Great Lakes wetlands; one plant produces 2.7 million seeds per year; eliminated critical nesting habitat for yellow-headed blackbirds and black terns.' },
    { name: 'Phragmites',      latin: 'Phragmites australis',   type: 'grass',     threat: 'high',   note: 'Non-native genotype has become the dominant plant in many Great Lakes coastal wetlands; monocultures eliminate waterfowl nesting, fish spawning habitat, and the open water that migratory shorebirds require.' },
  ],
  interiorLowlands: [
    { name: 'Callery Pear',    latin: 'Pyrus calleryana',       type: 'tree',      threat: 'high',   note: 'The most rapidly spreading invasive tree in the interior lowlands; escapes cultivation through cross-pollination between varieties; sharp thorns make natural areas impenetrable; forms dense thickets on roadsides and former agricultural fields.' },
    { name: 'Bush Honeysuckle', latin: 'Lonicera maackii',      type: 'shrub',     threat: 'high',   note: 'Leafs out weeks earlier than native shrubs, creating a near-total shade canopy in Ohio Valley forest understories; eliminates spring ephemeral wildflowers; has invaded virtually every woodland in Kentucky, Ohio, and Indiana.' },
    { name: 'Garlic Mustard',  latin: 'Alliaria petiolata',     type: 'perennial', threat: 'high',   note: 'Advancing rapidly through Interior Lowlands forests; allelopathic exudates disrupt the mycorrhizal networks that oaks, maples, and hickories depend on; pull before seed set in April–May.' },
    { name: 'Multiflora Rose', latin: 'Rosa multiflora',        type: 'shrub',     threat: 'high',   note: 'Originally planted by USDA as "living fences" in the 1930s–1950s; now dominates disturbed fields, roadsides, and floodplains throughout the Interior Lowlands; each plant produces up to 500,000 seeds per year.' },
  ],
};

/**
 * Returns an HTML string listing invasive species warnings for a given ecoregion.
 * @param {string} region
 * @returns {string}  HTML fragment — empty string if region not found
 */
function makeInvasivesSection(region) {
  const invasives = INVASIVE_SPECIES[region];
  if (!invasives || invasives.length === 0) return '';
  const threatBadge = function (t) {
    var color = t === 'high' ? '#c0392b' : '#e67e22';
    return '<span class="invasive-threat" style="background:' + color + ';color:#fff;font-size:0.65rem;padding:1px 5px;border-radius:3px;margin-left:4px;vertical-align:middle">' + t.toUpperCase() + '</span>';
  };
  return (
    '<div class="invasive-section">' +
      '<h4 class="invasive-section-header">Invasive species — watch &amp; remove</h4>' +
      '<ul class="invasive-list">' +
        invasives.map(function (sp) {
          return (
            '<li>' +
              '<span class="invasive-name">' + sp.name + '</span>' +
              ' <em class="invasive-latin">' + sp.latin + '</em>' +
              threatBadge(sp.threat) +
              '<span class="invasive-note">' + sp.note + '</span>' +
            '</li>'
          );
        }).join('') +
      '</ul>' +
    '</div>'
  );
}

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
      makeInvasivesSection(props.region) +
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
  coastal:          'Coastal Plain (Tidewater)',
  gulfCoastal:      'Gulf Coastal Plain',
  piedmont:         'Piedmont',
  blueRidge:        'Blue Ridge / Appalachian Mountains',
  valleyRidge:      'Valley and Ridge / Great Appalachian Valley',
  ecotone:          'Fall Line Ecotone',
  neUpland:         'New England Upland',
  neCoastal:        'New England Coastal Lowland',
  greatLakes:       'Great Lakes Basin',
  interiorLowlands: 'Interior Lowlands / Ohio Valley',
};

/**
 * Returns full-page HTML for a region detail view.
 * @param {'piedmont'|'coastal'|'blueRidge'} region
 * @returns {string}
 */
function makeRegionDetailHTML(region) {
  var geojsonMap = {
    piedmont:         PIEDMONT_GEOJSON,
    coastal:          COASTAL_PLAIN_GEOJSON,
    blueRidge:        BLUE_RIDGE_GEOJSON,
    valleyRidge:      VALLEY_RIDGE_GEOJSON,
    gulfCoastal:      GULF_COASTAL_GEOJSON,
    neUpland:         NE_UPLAND_GEOJSON,
    neCoastal:        NE_COASTAL_GEOJSON,
    greatLakes:       GREAT_LAKES_GEOJSON,
    interiorLowlands: INTERIOR_LOWLANDS_GEOJSON,
  };
  var geojson = geojsonMap[region];
  if (!geojson) return '';
  var props = geojson.properties;
  var REGION_COLORS = {
    piedmont:         '#c88232',
    coastal:          '#4682dc',
    gulfCoastal:      '#4682dc',
    blueRidge:        '#4a7c59',
    valleyRidge:      '#9b7aad',
    neUpland:         '#4a9a8a',
    neCoastal:        '#6baed6',
    greatLakes:       '#4a7ab5',
    interiorLowlands: '#8a7d4a',
  };
  var color = REGION_COLORS[region] || '#888888';
  return (
    '<article class="detail-page">' +
      '<div class="detail-region-header" style="border-left:4px solid ' + color + ';padding-left:12px;margin-bottom:0.75rem">' +
        '<h2 class="detail-title" style="margin-bottom:0">' + props.name + '</h2>' +
      '</div>' +
      '<p class="detail-description">' + props.description + '</p>' +
      makeNativePlantsSection(region) +
      makeSoilSection(region) +
      makeInvasivesSection(region) +
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

const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH_LABELS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/**
 * Returns an HTML string showing the monthly planting calendar for a given hardiness zone.
 * @param {string} zone  e.g. "7b"
 * @returns {string}  HTML fragment — empty string if zone not found
 */
function makeCalendarSection(zone) {
  var data = PLANTING_CALENDAR[zone];
  if (!data) return '';
  var rows = MONTHS.map(function (mon, i) {
    var m     = data[mon] || { startIndoors: [], directSow: [], transplant: [] };
    var label = MONTH_LABELS[i].slice(0, 3);
    var parts = [];
    if (m.startIndoors && m.startIndoors.length)
      parts.push('<span class="cal-label cal-label--indoor">Indoor:</span> ' + m.startIndoors.join(', '));
    if (m.directSow && m.directSow.length)
      parts.push('<span class="cal-label cal-label--sow">Sow:</span> ' + m.directSow.join(', '));
    if (m.transplant && m.transplant.length)
      parts.push('<span class="cal-label cal-label--transplant">Out:</span> ' + m.transplant.join(', '));
    var body = parts.length
      ? parts.map(function (p) { return '<div class="cal-row">' + p + '</div>'; }).join('')
      : '<div class="cal-row cal-row--idle">—</div>';
    return (
      '<div class="cal-month">' +
        '<span class="cal-month-name">' + label + '</span>' +
        '<div class="cal-month-body">' + body + '</div>' +
      '</div>'
    );
  }).join('');
  return (
    '<div class="calendar-section">' +
      '<h4 class="calendar-section-header">Monthly planting calendar</h4>' +
      '<div class="calendar-months">' + rows + '</div>' +
    '</div>'
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
      makeCalendarSection(zone) +
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
  for (var i = 0; i < CORRIDOR_CITIES.length; i++) {
    var c = CORRIDOR_CITIES[i];
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
  var REGION_COLORS = { piedmont: '#c88232', coastal: '#4682dc', gulfCoastal: '#4682dc', blueRidge: '#4a7c59', valleyRidge: '#9b7aad' };
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
  // Mississippi Embayment: western TN and KY — Gulf Coastal Plain sediments
  // extend north along the Mississippi River valley to ~37°N
  if (lon < -88.0 && lat < 37.5) return 'gulfCoastal';

  // Gulf Coastal Plain: south of the main fall line corridor and within the
  // Gulf/Florida footprint (lat < 32.5°N and lon < -80°W, or deep Florida)
  if (lat < 32.5 && (lon < -80.0 || lat < 28.0)) return 'gulfCoastal';

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

  // For latitudes covered by the Blue Ridge / Valley and Ridge (roughly 34.5–41.5°N),
  // use the escarpment arrays to distinguish Blue Ridge from Valley and Ridge from Piedmont.
  if (lat >= 34.5 && lat <= 41.5) {
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
  var geojsonMap = { piedmont: PIEDMONT_GEOJSON, coastal: COASTAL_PLAIN_GEOJSON, blueRidge: BLUE_RIDGE_GEOJSON, valleyRidge: VALLEY_RIDGE_GEOJSON, gulfCoastal: GULF_COASTAL_GEOJSON };
  var geojson = geojsonMap[region];
  var props   = geojson.properties;

  // Find nearest city by haversine distance
  var nearest  = CORRIDOR_CITIES[0];
  var minDistKm = haversineKm([lon, lat], [nearest.lon, nearest.lat]);
  for (var i = 1; i < CORRIDOR_CITIES.length; i++) {
    var c = CORRIDOR_CITIES[i];
    var d = haversineKm([lon, lat], [c.lon, c.lat]);
    if (d < minDistKm) { minDistKm = d; nearest = c; }
  }
  var nearestText = nearest.name + ', ' + nearest.state + ' (' + Math.round(minDistKm) + '\u00a0km)';
  var nearestZone = nearest.zone || 'unknown';
  var zoneInfo    = getZoneInfo(nearestZone);
  var zoneLabel   = zoneInfo ? zoneInfo.label : ('Zone\u00a0' + nearestZone);
  var zoneSummary = zoneInfo ? zoneInfo.avgLowF + '\u00b0F\u00a0avg\u00a0min\u00b7' + zoneInfo.frostFree + '\u00a0frost-free\u00a0days' : '';

  var REGION_COLORS = { piedmont: '#c88232', coastal: '#4682dc', gulfCoastal: '#4682dc', blueRidge: '#4a7c59', valleyRidge: '#9b7aad' };
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
        '<div class="detail-fact">' +
          '<span class="detail-fact-label">Hardiness zone</span>' +
          '<span class="detail-fact-value">' +
            '<strong>Zone\u00a0' + nearestZone + '</strong>' +
            (zoneSummary ? '\u2002<small class="detail-fact-meta">' + zoneSummary + '</small>' : '') +
            '<br><small class="detail-fact-meta">Approximate \u2014 based on nearest city. Enable the zone layer for map-wide precision.</small>' +
          '</span>' +
        '</div>' +
      '</div>' +
      makeNativePlantsSection(region) +
      makeSoilSection(region) +
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
  '3b': '#d0eeff', '4a': '#c2e4fa', '4b': '#a8d6f5',
  '5a': '#afd2e8', '5b': '#90bedd',
  '6a': '#72a9d2', '6b': '#5595c8',
  '7a': '#7ec87a', '7b': '#5aaf56',
  '8a': '#f5d63c', '8b': '#f5a800',
  '9a': '#f07800', '9b': '#e05000',
  '10a': '#c80000', '10b': '#a00000', '11a': '#780000',
};

const HARDINESS_ZONE_INFO = {
  '3b': {
    tempRange:     '-35°F to -30°F (-37°C to -34°C)',
    description:   'Very cold continental climate. Extreme winters characteristic of northern Maine and interior uplands.',
    firstFrost:    'mid-September',
    lastFrost:     'late May',
    growingSeason: '~100 days',
    plants:        'white spruce, balsam fir, paper birch, mountain ash, cold-hardy blueberries',
  },
  '4a': {
    tempRange:     '-30°F to -25°F (-34°C to -32°C)',
    description:   'Cold continental climate. Northern Maine uplands and highest Appalachian ridges.',
    firstFrost:    'late September',
    lastFrost:     'mid-May',
    growingSeason: '~120 days',
    plants:        'crabapple, lilac, highbush blueberry, native serviceberry, sugar maple',
  },
  '4b': {
    tempRange:     '-25°F to -20°F (-32°C to -29°C)',
    description:   'Cold continental climate. Northern Maine and upper New England highlands.',
    firstFrost:    'early October',
    lastFrost:     'early May',
    growingSeason: '~140 days',
    plants:        'crabapple, forsythia, highbush blueberry, serviceberry, yellow birch',
  },
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
  '9b': {
    tempRange:     '25°F to 30°F (-4°C to -1°C)',
    description:   'Subtropical. Central and northern Florida, Gulf Coast — frost is brief and rare.',
    firstFrost:    'occasional frost December–January',
    lastFrost:     'January (rare)',
    growingSeason: '~330 days',
    plants:        'citrus (marginal), royal palm, bougainvillea, bird of paradise, fishtail palm',
  },
  '10a': {
    tempRange:     '30°F to 35°F (-1°C to 2°C)',
    description:   'Tropical-transitional. South Florida — freezing temperatures are very rare; subtropical plants thrive year-round.',
    firstFrost:    'frost very rare',
    lastFrost:     'frost very rare',
    growingSeason: '365 days',
    plants:        'mango, avocado, queen palm, frangipani, ginger, hibiscus, citrus',
  },
  '10b': {
    tempRange:     '35°F to 40°F (2°C to 4°C)',
    description:   'Tropical. Coastal south Florida — essentially frost-free; true tropical species thrive.',
    firstFrost:    'frost essentially absent',
    lastFrost:     'frost essentially absent',
    growingSeason: '365 days',
    plants:        'mango, coconut palm, papaya, carambola, lychee, tropical orchids',
  },
  '11a': {
    tempRange:     '40°F to 45°F (4°C to 7°C)',
    description:   'Tropical. Florida Keys and extreme south Florida tip — no frost; year-round tropical growing conditions.',
    firstFrost:    'frost absent',
    lastFrost:     'frost absent',
    growingSeason: '365 days',
    plants:        'coconut palm, sea grape, red mangrove, torch ginger, tropical hardwoods',
  },
};

/* ─── Seasonal planting calendar by USDA hardiness zone ────────
   12 months × 14 zones (3b–10a).
   Each month has three arrays:
     startIndoors — start seeds under lights / in cold frame
     directSow    — direct sow outside
     transplant   — transplant seedlings out
   ────────────────────────────────────────────────────────────── */
const PLANTING_CALENDAR = {
  '3b': {
    jan: {
      startIndoors: ['Onions', 'Leeks', 'Microgreens'],
      directSow: [],
      transplant: []
    },
    feb: {
      startIndoors: ['Onions', 'Leeks', 'Celery', 'Microgreens'],
      directSow: [],
      transplant: []
    },
    mar: {
      startIndoors: ['Onions', 'Celery', 'Microgreens'],
      directSow: [],
      transplant: []
    },
    apr: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant', 'Broccoli', 'Cabbage'],
      directSow: [],
      transplant: []
    },
    may: {
      startIndoors: ['Tomatoes', 'Peppers'],
      directSow: ['Spinach', 'Peas', 'Radishes'],
      transplant: ['Onions', 'Broccoli', 'Cabbage', 'Celery']
    },
    jun: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Squash', 'Cucumbers', 'Beets', 'Carrots', 'Lettuce'],
      transplant: ['Tomatoes', 'Peppers', 'Eggplant']
    },
    jul: {
      startIndoors: [],
      directSow: ['Beans', 'Beets', 'Turnips', 'Radishes'],
      transplant: []
    },
    aug: {
      startIndoors: ['Kale', 'Spinach'],
      directSow: ['Spinach', 'Lettuce', 'Radishes'],
      transplant: []
    },
    sep: {
      startIndoors: [],
      directSow: ['Garlic'],
      transplant: []
    },
    oct: {
      startIndoors: [],
      directSow: ['Garlic'],
      transplant: []
    },
    nov: {
      startIndoors: ['Microgreens'],
      directSow: [],
      transplant: []
    },
    dec: {
      startIndoors: ['Microgreens', 'Onions'],
      directSow: [],
      transplant: []
    }
  },
  '4a': {
    jan: {
      startIndoors: ['Onions', 'Leeks', 'Microgreens'],
      directSow: [],
      transplant: []
    },
    feb: {
      startIndoors: ['Onions', 'Leeks', 'Celery', 'Microgreens'],
      directSow: [],
      transplant: []
    },
    mar: {
      startIndoors: ['Onions', 'Celery', 'Broccoli', 'Cabbage'],
      directSow: [],
      transplant: []
    },
    apr: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant'],
      directSow: ['Spinach', 'Peas', 'Radishes', 'Lettuce'],
      transplant: ['Onions', 'Broccoli', 'Cabbage']
    },
    may: {
      startIndoors: [],
      directSow: ['Spinach', 'Peas', 'Beets', 'Carrots'],
      transplant: ['Onions', 'Celery', 'Broccoli', 'Cabbage']
    },
    jun: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Squash', 'Cucumbers', 'Beets', 'Carrots'],
      transplant: ['Tomatoes', 'Peppers', 'Eggplant']
    },
    jul: {
      startIndoors: [],
      directSow: ['Beans', 'Beets', 'Turnips', 'Radishes'],
      transplant: []
    },
    aug: {
      startIndoors: ['Broccoli', 'Kale'],
      directSow: ['Spinach', 'Lettuce', 'Radishes'],
      transplant: []
    },
    sep: {
      startIndoors: [],
      directSow: ['Spinach', 'Radishes'],
      transplant: []
    },
    oct: {
      startIndoors: [],
      directSow: ['Garlic'],
      transplant: []
    },
    nov: {
      startIndoors: ['Microgreens'],
      directSow: [],
      transplant: []
    },
    dec: {
      startIndoors: ['Microgreens', 'Onions'],
      directSow: [],
      transplant: []
    }
  },
  '4b': {
    jan: {
      startIndoors: ['Onions', 'Leeks', 'Microgreens'],
      directSow: [],
      transplant: []
    },
    feb: {
      startIndoors: ['Onions', 'Leeks', 'Celery'],
      directSow: [],
      transplant: []
    },
    mar: {
      startIndoors: ['Tomatoes', 'Peppers', 'Broccoli', 'Cabbage'],
      directSow: [],
      transplant: ['Onions']
    },
    apr: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant'],
      directSow: ['Spinach', 'Peas', 'Lettuce', 'Radishes'],
      transplant: ['Broccoli', 'Cabbage', 'Onions', 'Celery']
    },
    may: {
      startIndoors: [],
      directSow: ['Spinach', 'Peas', 'Beets', 'Carrots'],
      transplant: ['Tomatoes', 'Peppers', 'Eggplant']
    },
    jun: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Squash', 'Cucumbers', 'Zucchini'],
      transplant: ['Tomatoes', 'Peppers']
    },
    jul: {
      startIndoors: [],
      directSow: ['Beans', 'Beets', 'Turnips', 'Radishes'],
      transplant: []
    },
    aug: {
      startIndoors: ['Broccoli', 'Kale'],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Peas'],
      transplant: []
    },
    sep: {
      startIndoors: [],
      directSow: ['Spinach', 'Radishes', 'Kale'],
      transplant: ['Broccoli']
    },
    oct: {
      startIndoors: [],
      directSow: ['Garlic', 'Spinach'],
      transplant: []
    },
    nov: {
      startIndoors: ['Microgreens'],
      directSow: ['Garlic'],
      transplant: []
    },
    dec: {
      startIndoors: ['Microgreens', 'Onions'],
      directSow: [],
      transplant: []
    }
  },
  '5a': {
    jan: {
      startIndoors: ['Onions', 'Leeks', 'Microgreens'],
      directSow: [],
      transplant: []
    },
    feb: {
      startIndoors: ['Onions', 'Leeks', 'Celery', 'Broccoli'],
      directSow: [],
      transplant: []
    },
    mar: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant', 'Broccoli', 'Cabbage'],
      directSow: ['Spinach', 'Peas'],
      transplant: ['Onions']
    },
    apr: {
      startIndoors: ['Squash', 'Cucumbers', 'Melons'],
      directSow: ['Spinach', 'Peas', 'Lettuce', 'Radishes', 'Beets', 'Carrots'],
      transplant: ['Broccoli', 'Cabbage', 'Onions', 'Celery']
    },
    may: {
      startIndoors: [],
      directSow: ['Peas', 'Beets', 'Carrots', 'Radishes'],
      transplant: ['Tomatoes', 'Peppers', 'Eggplant', 'Squash', 'Cucumbers']
    },
    jun: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Squash', 'Cucumbers', 'Zucchini'],
      transplant: ['Tomatoes', 'Peppers', 'Melons']
    },
    jul: {
      startIndoors: ['Broccoli', 'Cabbage'],
      directSow: ['Beans', 'Beets', 'Carrots', 'Turnips'],
      transplant: []
    },
    aug: {
      startIndoors: [],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Peas', 'Kale'],
      transplant: ['Broccoli', 'Cabbage']
    },
    sep: {
      startIndoors: [],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Kale'],
      transplant: []
    },
    oct: {
      startIndoors: [],
      directSow: ['Garlic', 'Spinach'],
      transplant: []
    },
    nov: {
      startIndoors: ['Microgreens'],
      directSow: ['Garlic'],
      transplant: []
    },
    dec: {
      startIndoors: ['Microgreens', 'Onions', 'Leeks'],
      directSow: [],
      transplant: []
    }
  },
  '5b': {
    jan: {
      startIndoors: ['Onions', 'Leeks', 'Microgreens'],
      directSow: [],
      transplant: []
    },
    feb: {
      startIndoors: ['Onions', 'Leeks', 'Celery', 'Broccoli', 'Cabbage'],
      directSow: [],
      transplant: []
    },
    mar: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant'],
      directSow: ['Spinach', 'Peas', 'Radishes'],
      transplant: ['Onions', 'Broccoli', 'Cabbage']
    },
    apr: {
      startIndoors: ['Squash', 'Cucumbers', 'Melons'],
      directSow: ['Spinach', 'Peas', 'Lettuce', 'Radishes', 'Beets', 'Carrots'],
      transplant: ['Onions', 'Celery', 'Broccoli', 'Cabbage']
    },
    may: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Squash', 'Cucumbers', 'Zucchini', 'Beets'],
      transplant: ['Tomatoes', 'Peppers', 'Eggplant', 'Melons']
    },
    jun: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Squash', 'Cucumbers'],
      transplant: ['Tomatoes', 'Peppers', 'Squash', 'Cucumbers']
    },
    jul: {
      startIndoors: ['Broccoli', 'Cabbage', 'Kale'],
      directSow: ['Beans', 'Beets', 'Carrots', 'Turnips'],
      transplant: []
    },
    aug: {
      startIndoors: [],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Kale', 'Peas'],
      transplant: ['Broccoli', 'Cabbage']
    },
    sep: {
      startIndoors: [],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Arugula'],
      transplant: ['Kale']
    },
    oct: {
      startIndoors: [],
      directSow: ['Spinach', 'Garlic'],
      transplant: []
    },
    nov: {
      startIndoors: ['Microgreens'],
      directSow: ['Garlic'],
      transplant: []
    },
    dec: {
      startIndoors: ['Microgreens', 'Onions', 'Leeks'],
      directSow: [],
      transplant: []
    }
  },
  '6a': {
    jan: {
      startIndoors: ['Onions', 'Leeks', 'Microgreens'],
      directSow: [],
      transplant: []
    },
    feb: {
      startIndoors: ['Onions', 'Leeks', 'Celery', 'Broccoli', 'Cabbage'],
      directSow: ['Spinach', 'Peas'],
      transplant: []
    },
    mar: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant'],
      directSow: ['Spinach', 'Peas', 'Lettuce', 'Radishes', 'Kale'],
      transplant: ['Onions', 'Broccoli', 'Cabbage']
    },
    apr: {
      startIndoors: ['Squash', 'Cucumbers', 'Melons', 'Basil'],
      directSow: ['Peas', 'Beets', 'Carrots', 'Lettuce', 'Radishes', 'Chard'],
      transplant: ['Onions', 'Celery', 'Broccoli', 'Cabbage', 'Kale']
    },
    may: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Squash', 'Cucumbers', 'Zucchini'],
      transplant: ['Tomatoes', 'Peppers', 'Eggplant', 'Melons', 'Squash']
    },
    jun: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Cucumbers', 'Beets'],
      transplant: ['Tomatoes', 'Peppers', 'Basil']
    },
    jul: {
      startIndoors: ['Broccoli', 'Cabbage', 'Kale'],
      directSow: ['Beans', 'Beets', 'Carrots', 'Turnips'],
      transplant: []
    },
    aug: {
      startIndoors: [],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Kale', 'Peas', 'Arugula'],
      transplant: ['Broccoli', 'Cabbage']
    },
    sep: {
      startIndoors: [],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Arugula', 'Chard'],
      transplant: ['Kale', 'Broccoli']
    },
    oct: {
      startIndoors: [],
      directSow: ['Spinach', 'Garlic', 'Kale'],
      transplant: []
    },
    nov: {
      startIndoors: ['Microgreens'],
      directSow: ['Garlic', 'Spinach'],
      transplant: []
    },
    dec: {
      startIndoors: ['Microgreens', 'Onions', 'Leeks'],
      directSow: [],
      transplant: []
    }
  },
  '6b': {
    jan: {
      startIndoors: ['Onions', 'Leeks', 'Microgreens'],
      directSow: [],
      transplant: []
    },
    feb: {
      startIndoors: ['Onions', 'Leeks', 'Celery', 'Broccoli', 'Cabbage', 'Tomatoes'],
      directSow: ['Spinach', 'Peas'],
      transplant: []
    },
    mar: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant'],
      directSow: ['Spinach', 'Peas', 'Lettuce', 'Radishes', 'Kale', 'Chard'],
      transplant: ['Onions', 'Broccoli', 'Cabbage']
    },
    apr: {
      startIndoors: ['Squash', 'Cucumbers', 'Melons', 'Basil'],
      directSow: ['Peas', 'Beets', 'Carrots', 'Lettuce', 'Radishes', 'Spinach'],
      transplant: ['Onions', 'Celery', 'Broccoli', 'Cabbage', 'Kale', 'Tomatoes']
    },
    may: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Squash', 'Cucumbers', 'Zucchini'],
      transplant: ['Tomatoes', 'Peppers', 'Eggplant', 'Melons', 'Squash']
    },
    jun: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Cucumbers', 'Beets', 'Sweet Potatoes'],
      transplant: ['Tomatoes', 'Peppers', 'Basil', 'Cucumbers']
    },
    jul: {
      startIndoors: ['Broccoli', 'Cabbage', 'Kale'],
      directSow: ['Beans', 'Beets', 'Carrots', 'Turnips'],
      transplant: []
    },
    aug: {
      startIndoors: [],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Kale', 'Peas', 'Arugula'],
      transplant: ['Broccoli', 'Cabbage']
    },
    sep: {
      startIndoors: [],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Arugula', 'Chard', 'Carrots'],
      transplant: ['Kale', 'Broccoli', 'Cabbage']
    },
    oct: {
      startIndoors: [],
      directSow: ['Spinach', 'Garlic', 'Kale', 'Radishes'],
      transplant: []
    },
    nov: {
      startIndoors: ['Microgreens'],
      directSow: ['Garlic', 'Spinach', 'Kale'],
      transplant: []
    },
    dec: {
      startIndoors: ['Microgreens', 'Onions', 'Leeks'],
      directSow: [],
      transplant: []
    }
  },
  '7a': {
    jan: {
      startIndoors: ['Onions', 'Leeks', 'Microgreens'],
      directSow: ['Spinach', 'Kale'],
      transplant: []
    },
    feb: {
      startIndoors: ['Onions', 'Leeks', 'Celery', 'Tomatoes', 'Broccoli'],
      directSow: ['Spinach', 'Peas', 'Lettuce', 'Kale', 'Radishes'],
      transplant: []
    },
    mar: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant', 'Squash'],
      directSow: ['Spinach', 'Peas', 'Lettuce', 'Radishes', 'Beets', 'Carrots', 'Chard'],
      transplant: ['Onions', 'Broccoli', 'Cabbage', 'Kale']
    },
    apr: {
      startIndoors: ['Squash', 'Cucumbers', 'Melons', 'Basil'],
      directSow: ['Peas', 'Beets', 'Carrots', 'Lettuce', 'Beans'],
      transplant: ['Onions', 'Celery', 'Broccoli', 'Cabbage', 'Tomatoes', 'Peppers']
    },
    may: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Squash', 'Cucumbers', 'Zucchini', 'Sweet Potatoes'],
      transplant: ['Tomatoes', 'Peppers', 'Eggplant', 'Melons', 'Squash', 'Cucumbers']
    },
    jun: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Cucumbers', 'Beets', 'Sweet Potatoes'],
      transplant: ['Melons', 'Sweet Potatoes']
    },
    jul: {
      startIndoors: ['Broccoli', 'Cabbage', 'Kale'],
      directSow: ['Beans', 'Beets', 'Carrots', 'Turnips'],
      transplant: []
    },
    aug: {
      startIndoors: [],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Kale', 'Peas', 'Arugula'],
      transplant: ['Broccoli', 'Cabbage', 'Kale']
    },
    sep: {
      startIndoors: [],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Arugula', 'Chard', 'Carrots', 'Turnips'],
      transplant: ['Broccoli', 'Cabbage']
    },
    oct: {
      startIndoors: [],
      directSow: ['Spinach', 'Garlic', 'Kale', 'Radishes', 'Lettuce'],
      transplant: ['Kale']
    },
    nov: {
      startIndoors: ['Onions', 'Leeks', 'Microgreens'],
      directSow: ['Garlic', 'Spinach', 'Kale'],
      transplant: []
    },
    dec: {
      startIndoors: ['Microgreens', 'Onions', 'Leeks'],
      directSow: ['Spinach'],
      transplant: []
    }
  },
  '7b': {
    jan: {
      startIndoors: ['Onions', 'Leeks', 'Microgreens', 'Tomatoes'],
      directSow: ['Spinach', 'Kale', 'Peas', 'Lettuce'],
      transplant: []
    },
    feb: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant', 'Celery', 'Broccoli'],
      directSow: ['Spinach', 'Peas', 'Lettuce', 'Radishes', 'Kale', 'Chard'],
      transplant: ['Onions', 'Broccoli', 'Cabbage']
    },
    mar: {
      startIndoors: ['Tomatoes', 'Peppers', 'Squash', 'Cucumbers', 'Melons'],
      directSow: ['Peas', 'Beets', 'Carrots', 'Lettuce', 'Radishes', 'Spinach'],
      transplant: ['Onions', 'Celery', 'Broccoli', 'Cabbage', 'Kale']
    },
    apr: {
      startIndoors: [],
      directSow: ['Beans', 'Beets', 'Carrots', 'Corn', 'Sweet Potatoes'],
      transplant: ['Tomatoes', 'Peppers', 'Eggplant', 'Squash', 'Cucumbers', 'Melons']
    },
    may: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Squash', 'Cucumbers', 'Zucchini', 'Sweet Potatoes'],
      transplant: ['Tomatoes', 'Peppers', 'Eggplant', 'Sweet Potatoes']
    },
    jun: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Cucumbers', 'Beets'],
      transplant: ['Sweet Potatoes']
    },
    jul: {
      startIndoors: ['Broccoli', 'Cabbage', 'Kale'],
      directSow: ['Beans', 'Beets', 'Carrots'],
      transplant: []
    },
    aug: {
      startIndoors: [],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Kale', 'Peas', 'Arugula', 'Chard'],
      transplant: ['Broccoli', 'Cabbage', 'Kale']
    },
    sep: {
      startIndoors: [],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Arugula', 'Chard', 'Carrots', 'Turnips', 'Beets'],
      transplant: ['Broccoli', 'Cabbage']
    },
    oct: {
      startIndoors: [],
      directSow: ['Spinach', 'Garlic', 'Kale', 'Radishes', 'Lettuce', 'Peas'],
      transplant: ['Kale', 'Broccoli']
    },
    nov: {
      startIndoors: ['Onions', 'Leeks', 'Microgreens'],
      directSow: ['Garlic', 'Spinach', 'Kale', 'Lettuce'],
      transplant: []
    },
    dec: {
      startIndoors: ['Microgreens', 'Onions'],
      directSow: ['Spinach', 'Kale'],
      transplant: []
    }
  },
  '8a': {
    jan: {
      startIndoors: ['Tomatoes', 'Peppers', 'Onions', 'Leeks', 'Microgreens'],
      directSow: ['Spinach', 'Kale', 'Peas', 'Lettuce', 'Radishes'],
      transplant: []
    },
    feb: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant', 'Celery', 'Broccoli'],
      directSow: ['Spinach', 'Peas', 'Lettuce', 'Radishes', 'Kale', 'Beets', 'Carrots'],
      transplant: ['Onions', 'Broccoli', 'Cabbage', 'Kale']
    },
    mar: {
      startIndoors: ['Squash', 'Cucumbers', 'Melons', 'Sweet Potatoes'],
      directSow: ['Peas', 'Beets', 'Carrots', 'Lettuce', 'Radishes', 'Chard'],
      transplant: ['Onions', 'Celery', 'Broccoli', 'Cabbage', 'Tomatoes', 'Peppers']
    },
    apr: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Squash', 'Cucumbers', 'Sweet Potatoes'],
      transplant: ['Tomatoes', 'Peppers', 'Eggplant', 'Squash', 'Cucumbers', 'Melons']
    },
    may: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Squash', 'Cucumbers', 'Zucchini', 'Sweet Potatoes'],
      transplant: ['Tomatoes', 'Peppers', 'Melons', 'Sweet Potatoes']
    },
    jun: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Sweet Potatoes'],
      transplant: ['Sweet Potatoes']
    },
    jul: {
      startIndoors: ['Broccoli', 'Cabbage', 'Kale'],
      directSow: ['Beans', 'Beets', 'Carrots'],
      transplant: []
    },
    aug: {
      startIndoors: [],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Kale', 'Peas', 'Arugula', 'Chard'],
      transplant: ['Broccoli', 'Cabbage']
    },
    sep: {
      startIndoors: [],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Arugula', 'Chard', 'Carrots', 'Turnips', 'Beets'],
      transplant: ['Broccoli', 'Cabbage', 'Kale']
    },
    oct: {
      startIndoors: ['Onions', 'Leeks'],
      directSow: ['Spinach', 'Garlic', 'Kale', 'Lettuce', 'Peas', 'Radishes'],
      transplant: ['Broccoli', 'Kale']
    },
    nov: {
      startIndoors: ['Onions', 'Leeks', 'Microgreens'],
      directSow: ['Garlic', 'Spinach', 'Kale', 'Lettuce', 'Radishes'],
      transplant: []
    },
    dec: {
      startIndoors: ['Microgreens', 'Onions', 'Tomatoes'],
      directSow: ['Spinach', 'Kale', 'Peas'],
      transplant: []
    }
  },
  '8b': {
    jan: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant', 'Onions', 'Leeks'],
      directSow: ['Spinach', 'Kale', 'Peas', 'Lettuce', 'Radishes', 'Beets'],
      transplant: []
    },
    feb: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant', 'Squash', 'Celery'],
      directSow: ['Spinach', 'Peas', 'Lettuce', 'Radishes', 'Kale', 'Carrots', 'Beets'],
      transplant: ['Onions', 'Broccoli', 'Cabbage', 'Kale']
    },
    mar: {
      startIndoors: ['Squash', 'Cucumbers', 'Melons', 'Basil'],
      directSow: ['Peas', 'Beets', 'Carrots', 'Lettuce', 'Chard', 'Beans'],
      transplant: ['Onions', 'Celery', 'Broccoli', 'Cabbage', 'Tomatoes', 'Peppers']
    },
    apr: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Squash', 'Cucumbers', 'Sweet Potatoes'],
      transplant: ['Tomatoes', 'Peppers', 'Eggplant', 'Squash', 'Cucumbers', 'Melons']
    },
    may: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Squash', 'Cucumbers', 'Okra', 'Sweet Potatoes'],
      transplant: ['Tomatoes', 'Peppers', 'Melons', 'Sweet Potatoes', 'Okra']
    },
    jun: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Okra', 'Sweet Potatoes'],
      transplant: ['Sweet Potatoes']
    },
    jul: {
      startIndoors: ['Broccoli', 'Cabbage', 'Kale'],
      directSow: ['Beans', 'Beets', 'Carrots', 'Okra'],
      transplant: []
    },
    aug: {
      startIndoors: [],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Kale', 'Peas', 'Arugula', 'Chard'],
      transplant: ['Broccoli', 'Cabbage', 'Kale']
    },
    sep: {
      startIndoors: [],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Arugula', 'Chard', 'Carrots', 'Turnips', 'Beets'],
      transplant: ['Broccoli', 'Cabbage']
    },
    oct: {
      startIndoors: ['Onions', 'Leeks', 'Tomatoes'],
      directSow: ['Spinach', 'Garlic', 'Kale', 'Lettuce', 'Peas', 'Radishes'],
      transplant: ['Broccoli', 'Kale', 'Cabbage']
    },
    nov: {
      startIndoors: ['Onions', 'Leeks', 'Microgreens'],
      directSow: ['Garlic', 'Spinach', 'Kale', 'Lettuce', 'Peas', 'Radishes'],
      transplant: []
    },
    dec: {
      startIndoors: ['Microgreens', 'Onions', 'Tomatoes', 'Peppers'],
      directSow: ['Spinach', 'Kale', 'Peas', 'Lettuce'],
      transplant: []
    }
  },
  '9a': {
    jan: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant', 'Onions'],
      directSow: ['Spinach', 'Kale', 'Peas', 'Lettuce', 'Radishes', 'Beets', 'Carrots'],
      transplant: ['Broccoli', 'Cabbage', 'Kale']
    },
    feb: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant', 'Squash', 'Melons'],
      directSow: ['Spinach', 'Peas', 'Lettuce', 'Radishes', 'Beets', 'Carrots', 'Chard'],
      transplant: ['Onions', 'Broccoli', 'Cabbage', 'Kale', 'Tomatoes', 'Peppers']
    },
    mar: {
      startIndoors: ['Squash', 'Cucumbers', 'Melons', 'Basil', 'Okra'],
      directSow: ['Beets', 'Carrots', 'Chard', 'Beans'],
      transplant: ['Tomatoes', 'Peppers', 'Eggplant', 'Squash', 'Melons']
    },
    apr: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Squash', 'Cucumbers', 'Sweet Potatoes', 'Okra'],
      transplant: ['Squash', 'Cucumbers', 'Melons', 'Basil', 'Okra']
    },
    may: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Okra', 'Sweet Potatoes'],
      transplant: ['Sweet Potatoes', 'Okra']
    },
    jun: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Okra'],
      transplant: []
    },
    jul: {
      startIndoors: ['Broccoli', 'Cabbage', 'Kale'],
      directSow: ['Beans', 'Carrots'],
      transplant: []
    },
    aug: {
      startIndoors: [],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Kale', 'Arugula', 'Chard', 'Beets'],
      transplant: ['Broccoli', 'Cabbage', 'Kale']
    },
    sep: {
      startIndoors: ['Onions', 'Leeks'],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Arugula', 'Chard', 'Carrots', 'Beets', 'Peas'],
      transplant: ['Broccoli', 'Cabbage']
    },
    oct: {
      startIndoors: ['Tomatoes', 'Peppers', 'Onions'],
      directSow: ['Spinach', 'Garlic', 'Kale', 'Lettuce', 'Peas', 'Radishes', 'Carrots'],
      transplant: ['Broccoli', 'Kale', 'Cabbage', 'Onions']
    },
    nov: {
      startIndoors: ['Tomatoes', 'Peppers', 'Onions', 'Leeks'],
      directSow: ['Garlic', 'Spinach', 'Kale', 'Lettuce', 'Peas', 'Radishes', 'Beets'],
      transplant: ['Kale']
    },
    dec: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant', 'Onions'],
      directSow: ['Spinach', 'Kale', 'Peas', 'Lettuce', 'Radishes', 'Carrots'],
      transplant: []
    }
  },
  '9b': {
    jan: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant', 'Onions'],
      directSow: ['Spinach', 'Kale', 'Peas', 'Lettuce', 'Radishes', 'Beets', 'Carrots', 'Chard'],
      transplant: ['Broccoli', 'Cabbage', 'Kale']
    },
    feb: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant', 'Squash', 'Melons', 'Basil'],
      directSow: ['Spinach', 'Peas', 'Lettuce', 'Beets', 'Carrots', 'Chard', 'Radishes'],
      transplant: ['Onions', 'Broccoli', 'Cabbage', 'Kale', 'Tomatoes', 'Peppers']
    },
    mar: {
      startIndoors: ['Squash', 'Cucumbers', 'Melons', 'Okra'],
      directSow: ['Beans', 'Beets', 'Carrots', 'Chard', 'Corn'],
      transplant: ['Tomatoes', 'Peppers', 'Eggplant', 'Squash', 'Melons', 'Basil']
    },
    apr: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Squash', 'Cucumbers', 'Sweet Potatoes', 'Okra'],
      transplant: ['Squash', 'Cucumbers', 'Melons', 'Okra']
    },
    may: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Okra', 'Sweet Potatoes'],
      transplant: ['Sweet Potatoes', 'Okra']
    },
    jun: {
      startIndoors: [],
      directSow: ['Okra', 'Sweet Potatoes'],
      transplant: []
    },
    jul: {
      startIndoors: ['Broccoli', 'Cabbage', 'Kale'],
      directSow: ['Beans'],
      transplant: []
    },
    aug: {
      startIndoors: [],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Kale', 'Arugula', 'Chard', 'Beets'],
      transplant: ['Broccoli', 'Cabbage', 'Kale']
    },
    sep: {
      startIndoors: ['Onions', 'Leeks', 'Tomatoes'],
      directSow: ['Spinach', 'Lettuce', 'Radishes', 'Arugula', 'Chard', 'Carrots', 'Beets', 'Peas'],
      transplant: ['Broccoli', 'Cabbage']
    },
    oct: {
      startIndoors: ['Tomatoes', 'Peppers', 'Onions'],
      directSow: ['Spinach', 'Garlic', 'Kale', 'Lettuce', 'Peas', 'Radishes', 'Carrots'],
      transplant: ['Onions', 'Broccoli', 'Kale', 'Cabbage']
    },
    nov: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant', 'Onions', 'Leeks'],
      directSow: ['Garlic', 'Spinach', 'Kale', 'Lettuce', 'Peas', 'Radishes', 'Beets'],
      transplant: ['Kale', 'Broccoli']
    },
    dec: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant', 'Onions'],
      directSow: ['Spinach', 'Kale', 'Peas', 'Lettuce', 'Radishes', 'Carrots'],
      transplant: ['Kale']
    }
  },
  '10a': {
    jan: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant', 'Basil'],
      directSow: ['Spinach', 'Kale', 'Peas', 'Lettuce', 'Radishes', 'Beets', 'Carrots', 'Chard'],
      transplant: ['Broccoli', 'Cabbage', 'Kale', 'Onions']
    },
    feb: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant', 'Squash', 'Melons', 'Basil'],
      directSow: ['Spinach', 'Peas', 'Lettuce', 'Beets', 'Carrots', 'Chard', 'Radishes'],
      transplant: ['Broccoli', 'Cabbage', 'Kale', 'Tomatoes', 'Peppers', 'Onions']
    },
    mar: {
      startIndoors: ['Squash', 'Cucumbers', 'Melons', 'Okra'],
      directSow: ['Beans', 'Beets', 'Carrots', 'Chard', 'Corn'],
      transplant: ['Tomatoes', 'Peppers', 'Eggplant', 'Squash', 'Melons', 'Basil']
    },
    apr: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Squash', 'Cucumbers', 'Sweet Potatoes', 'Okra'],
      transplant: ['Squash', 'Cucumbers', 'Melons', 'Okra', 'Sweet Potatoes']
    },
    may: {
      startIndoors: [],
      directSow: ['Beans', 'Corn', 'Okra', 'Sweet Potatoes'],
      transplant: ['Sweet Potatoes', 'Okra']
    },
    jun: {
      startIndoors: [],
      directSow: ['Okra', 'Sweet Potatoes', 'Beans'],
      transplant: ['Okra', 'Sweet Potatoes']
    },
    jul: {
      startIndoors: ['Broccoli', 'Cabbage', 'Kale', 'Tomatoes'],
      directSow: ['Beans', 'Okra'],
      transplant: []
    },
    aug: {
      startIndoors: ['Tomatoes', 'Peppers', 'Broccoli', 'Cabbage'],
      directSow: ['Beans', 'Corn'],
      transplant: ['Kale']
    },
    sep: {
      startIndoors: ['Tomatoes', 'Peppers', 'Onions', 'Leeks'],
      directSow: ['Spinach', 'Lettuce', 'Arugula', 'Chard', 'Carrots', 'Beets', 'Radishes'],
      transplant: ['Broccoli', 'Cabbage', 'Kale', 'Tomatoes']
    },
    oct: {
      startIndoors: ['Tomatoes', 'Peppers', 'Onions'],
      directSow: ['Spinach', 'Garlic', 'Kale', 'Lettuce', 'Peas', 'Radishes', 'Carrots'],
      transplant: ['Onions', 'Broccoli', 'Kale', 'Cabbage', 'Tomatoes', 'Peppers']
    },
    nov: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant', 'Onions'],
      directSow: ['Garlic', 'Spinach', 'Kale', 'Lettuce', 'Peas', 'Radishes', 'Beets', 'Carrots'],
      transplant: ['Kale', 'Broccoli', 'Cabbage']
    },
    dec: {
      startIndoors: ['Tomatoes', 'Peppers', 'Eggplant', 'Onions'],
      directSow: ['Spinach', 'Kale', 'Peas', 'Lettuce', 'Radishes', 'Carrots', 'Chard'],
      transplant: ['Onions', 'Kale']
    }
  }
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
const CORRIDOR_CITIES = [
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
  // ── Additional fall line & coastal corridor cities ───────────────────────
  {
    name:   'Harrisburg',
    state:  'PA',
    lat:     40.273,
    lon:    -76.884,
    river:  'Susquehanna River',
    region: 'piedmont',
    soil:   'Hagerstown silt loam (limestone valley-derived)',
    zone:   '6b',
    note:   'Pennsylvania\'s capital at the great Susquehanna water gap through the Appalachian ridges — the Susquehanna Canal (1828) followed this corridor west into the Cumberland Valley.',
  },
  {
    name:   'Frederick',
    state:  'MD',
    lat:     39.414,
    lon:    -77.411,
    river:  'Monocacy River',
    region: 'piedmont',
    soil:   'Hagerstown silt loam (Great Valley limestone)',
    zone:   '7a',
    note:   'Where the Monocacy Valley meets the Piedmont at the foot of Catoctin Mountain — a key crossroads on the National Road and the Cumberland Valley corridor, strategically contested in the Civil War.',
  },
  {
    name:   'Morgantown',
    state:  'WV',
    lat:     39.629,
    lon:    -79.956,
    river:  'Monongahela River',
    region: 'valleyRidge',
    soil:   'Ernest-Gilpin channery silt loam (shale/sandstone Plateau)',
    zone:   '6a',
    note:   'West Virginia University\'s hill city at the confluence of the Cheat and Monongahela rivers — perched on the Allegheny Front where the plateau breaks away toward Pittsburgh.',
  },
  {
    name:   'Knoxville',
    state:  'TN',
    lat:     35.961,
    lon:    -83.921,
    river:  'Tennessee River',
    region: 'valleyRidge',
    soil:   'Fullerton-Waynesboro clay loam (Valley and Ridge Ultisol)',
    zone:   '7a',
    note:   'Gateway to the Great Smoky Mountains at the confluence of the Holston and French Broad rivers — TVA\'s Norris Dam (1936) just upstream transformed the Tennessee from a flood-prone torrent to a navigable reservoir system.',
  },
  {
    name:   'Hartford',
    state:  'CT',
    lat:     41.763,
    lon:    -72.685,
    river:  'Connecticut River',
    region: 'piedmont',
    soil:   'Paxton stony loam (glacial till, dense substratum)',
    zone:   '6b',
    note:   'Connecticut\'s capital straddles the Connecticut River valley where the Park River (now buried underground) once marked the fall line between the New England Upland and the coastal lowlands.',
  },
  {
    name:   'Providence',
    state:  'RI',
    lat:     41.824,
    lon:    -71.413,
    river:  'Providence River',
    region: 'coastal',
    soil:   'Urban fill over Coastal Plain sandy loam',
    zone:   '6b',
    note:   'Founded 1636 by Roger Williams at the head of Narragansett Bay — the Moshassuck and Woonasquatucket rivers drop from the New England Upland to tidewater here, making Providence New England\'s oldest industrial port.',
  },
  {
    name:   'Portland',
    state:  'ME',
    lat:     43.661,
    lon:    -70.255,
    river:  'Fore River',
    region: 'coastal',
    soil:   'Buxton-Hartland silt loam (marine sediment over glacial till)',
    zone:   '6a',
    note:   'Maine\'s largest city on Casco Bay — the Presumscot River falls powered early saw and grist mills; birthplace of Henry Wadsworth Longfellow and New England\'s dominant Atlantic fishing and lumber port through the 19th century.',
  },
  {
    name:   'Savannah',
    state:  'GA',
    lat:     32.080,
    lon:    -81.100,
    river:  'Savannah River',
    region: 'coastal',
    soil:   'Tifton loamy sand (Coastal Plain Ultisol)',
    zone:   '8b',
    note:   'James Oglethorpe\'s 1733 colony at the mouth of the Savannah River — Georgia\'s founding city; the famous grid of 22 parklike squares was engineered for both civic beauty and military defense on the coastal plain bluff.',
  },
  {
    name:   'Mobile',
    state:  'AL',
    lat:     30.694,
    lon:    -88.040,
    river:  'Mobile River',
    region: 'gulfCoastal',
    soil:   'Malbis loamy sand (Coastal Plain alluvial)',
    zone:   '8b',
    note:   'Capital of French Louisiana (1702–1720) at the head of Mobile Bay — the Mobile-Tensaw delta is one of the most biodiverse river deltas in North America, draining nearly all of the Tennessee and Cumberland river systems.',
  },
  // ── Great Lakes Basin cities ──────────────────────────────────────────────
  {
    name:   'Chicago',
    state:  'IL',
    lat:     41.881,
    lon:    -87.627,
    river:  'Chicago River',
    region: 'greatLakes',
    soil:   'Varna-Drummer silt loam (glacial lake plain)',
    zone:   '6a',
    note:   'Founded at the one-mile Chicago Portage between the Great Lakes and Mississippi drainages — the only place on Earth where two continental watersheds nearly touch at grade. The Illinois & Michigan Canal (1848) connected the Atlantic seaboard to the Gulf of Mexico interior.',
  },
  {
    name:   'Milwaukee',
    state:  'WI',
    lat:     43.044,
    lon:    -87.910,
    river:  'Milwaukee River',
    region: 'greatLakes',
    soil:   'Kewaunee clay loam (calcareous glacial till)',
    zone:   '5b',
    note:   'Where the Milwaukee, Menomonee, and Kinnickinnic rivers converge at Lake Michigan — the world\'s leading wheat market in the 1860s; beer brewing thrived on the lake\'s cold water, regional barley, and the calcareous till soils that grew premium hops.',
  },
  {
    name:   'Detroit',
    state:  'MI',
    lat:     42.331,
    lon:    -83.046,
    river:  'Detroit River',
    region: 'greatLakes',
    soil:   'Lambton silty clay loam (glacial lake-laid sediments)',
    zone:   '6a',
    note:   'Founded 1701 by Antoine Cadillac at the narrows of the Detroit River — the strategic passage between Lake Erie and Lake Huron. Still one of the most navigated waterways in North America, carrying more cargo tonnage than the Panama and Suez Canals combined.',
  },
  {
    name:   'Cleveland',
    state:  'OH',
    lat:     41.499,
    lon:    -81.694,
    river:  'Cuyahoga River',
    region: 'greatLakes',
    soil:   'Mahoning silty clay loam (glacial Lake Erie sediment)',
    zone:   '6a',
    note:   'At the mouth of the Cuyahoga — "The Crooked River." The Ohio & Erie Canal (1832) made Cleveland one of the fastest-growing antebellum cities; the Cuyahoga\'s notorious 1969 fire directly catalyzed the Clean Water Act of 1972.',
  },
  {
    name:   'Toledo',
    state:  'OH',
    lat:     41.664,
    lon:    -83.555,
    river:  'Maumee River',
    region: 'greatLakes',
    soil:   'Hoytville silty clay (ancient Lake Erie lakebed)',
    zone:   '6a',
    note:   'The Maumee River drains the largest watershed emptying into the Great Lakes — its phosphorus-rich agricultural runoff is the primary driver of Lake Erie\'s recurring harmful algal blooms. The Battle of Fallen Timbers (1794) was fought just south of the city.',
  },
  {
    name:   'Green Bay',
    state:  'WI',
    lat:     44.519,
    lon:    -88.020,
    river:  'Fox River',
    region: 'greatLakes',
    soil:   'Poygan clay (calcareous glacial lake plain)',
    zone:   '5a',
    note:   'The Fox River connects Green Bay to the Wisconsin River via a one-mile portage at Portage WI — the main French fur trade route linking the Great Lakes to the Mississippi for over 150 years. The bay\'s heavy lake clay soils support the most productive dairy land in Wisconsin.',
  },
  {
    name:   'Ann Arbor',
    state:  'MI',
    lat:     42.281,
    lon:    -83.748,
    river:  'Huron River',
    region: 'greatLakes',
    soil:   'Conover loam (calcareous glacial till, Huron River watershed)',
    zone:   '6a',
    note:   'University of Michigan (1837) relocated here from Detroit along the Huron River valley — one of Michigan\'s earliest mill towns. The Ann Arbor Railroad was one of the first to use car ferry service across Lake Michigan to connect the Great Lakes rail network.',
  },
  {
    name:   'Buffalo',
    state:  'NY',
    lat:     42.886,
    lon:    -78.879,
    river:  'Niagara River',
    region: 'greatLakes',
    soil:   'Dunkirk silty clay loam (Lake Erie lake-laid sediment)',
    zone:   '6a',
    note:   'At the eastern end of Lake Erie where the Niagara River drops 326 feet over Niagara Falls into Lake Ontario. The Erie Canal (1825) made Buffalo the western terminus of the canal system — the city grew from 200 people to 100,000 in a single generation.',
  },
  {
    name:   'Marquette',
    state:  'MI',
    lat:     46.543,
    lon:    -87.395,
    river:  'Carp River',
    region: 'greatLakes',
    soil:   'Rubicon loamy sand (Spodosol — iron-pan over sandy outwash)',
    zone:   '5a',
    note:   'Iron ore capital of the Upper Peninsula — the Marquette Iron Range (discovered 1844) supplied the steel for America\'s industrial revolution, shipped via the Soo Locks to Pittsburgh\'s furnaces. Annual snowfall exceeds 150 inches from Lake Superior lake-effect storms.',
  },
  // ── Interior Lowlands / Ohio Valley cities ───────────────────────────────
  {
    name:   'Columbus',
    state:  'OH',
    lat:     39.961,
    lon:    -82.998,
    river:  'Scioto River',
    region: 'interiorLowlands',
    soil:   'Crosby silt loam (poorly drained calcareous glacial till)',
    zone:   '6a',
    note:   'Laid out as Ohio\'s state capital in 1812 at the geographic center of the state on the National Road corridor. The Scioto River valley\'s deep till-plain soils once supported migratory passenger pigeon flocks so dense they darkened the sky for hours.',
  },
  {
    name:   'Indianapolis',
    state:  'IN',
    lat:     39.768,
    lon:    -86.158,
    river:  'White River',
    region: 'interiorLowlands',
    soil:   'Miami silt loam (calcareous glacial till — Tipton Till Plain)',
    zone:   '6a',
    note:   'Platted 1821 at the White River forks at Indiana\'s geographic center — designed as a planned capital city on the National Road. Near the southern terminus of the Shelbyville moraine: to the north, flat glaciated till; to the south, the unglaciated knobstone escarpment.',
  },
  {
    name:   'Louisville',
    state:  'KY',
    lat:     38.252,
    lon:    -85.759,
    river:  'Ohio River',
    region: 'interiorLowlands',
    soil:   'Wheeling silty clay loam (Ohio River alluvial terrace)',
    zone:   '6b',
    note:   'The Falls of the Ohio — a 26-foot Devonian limestone ledge extending 2.5 miles across the river — forced all river traffic to portage and made Louisville the gateway to the western frontier. The limestone shelf is the largest exposed Devonian coral reef bed in the world.',
  },
  {
    name:   'Nashville',
    state:  'TN',
    lat:     36.165,
    lon:    -86.784,
    river:  'Cumberland River',
    region: 'interiorLowlands',
    soil:   'Maury silt loam (phosphatic Ordovician limestone — Nashville Basin)',
    zone:   '7a',
    note:   'The Nashville Basin is a natural amphitheater of phosphate-rich limestone that produces the thickest bluegrass and the finest thoroughbred horses in America. The same limestone geology that grows the grass and builds the bones of champion horses also filters the spring water used in Tennessee whiskey production.',
  },
  {
    name:   'Cincinnati',
    state:  'OH',
    lat:     39.103,
    lon:    -84.512,
    river:  'Ohio River',
    region: 'interiorLowlands',
    soil:   'Rossmoyne silt loam (glacial outwash terrace, pre-Illinoian)',
    zone:   '6b',
    note:   'Where the Ohio River bends in a dramatic horseshoe — the "Queen City" was the largest city west of the Appalachians in 1850. Fountain Square sits above the confluence of the Little Miami and Great Miami rivers; the river terrace\'s deep alluvial soils made Cincinnati the pork-packing capital of pre–Civil War America.',
  },
  {
    name:   'Lexington',
    state:  'KY',
    lat:     38.040,
    lon:    -84.503,
    river:  'Kentucky River',
    region: 'interiorLowlands',
    soil:   'Maury silt loam (Bluegrass phosphatic limestone)',
    zone:   '6b',
    note:   'Heart of the Bluegrass — Ordovician phosphatic limestone weathers into dark calcium-rich soils that grow the densest bluegrass in North America and produce horses with unusually dense bones. Keeneland\'s racecourse sits directly on this bedrock; the phosphorus that feeds the grass literally builds the bones of champion thoroughbreds.',
  },
  {
    name:   'Springfield',
    state:  'IL',
    lat:     39.781,
    lon:    -89.650,
    river:  'Sangamon River',
    region: 'interiorLowlands',
    soil:   'Muscatine silt loam (Mollisol — loess over glacial till, prairie origin)',
    zone:   '6a',
    note:   'Abraham Lincoln\'s home from 1837 until his 1861 departure for Washington. The Sangamon county soils bear some of the thickest loess deposits in North America — blown from Mississippi River glacial outwash during the last deglaciation, creating what became the most productive corn and soybean land on Earth.',
  },
  {
    name:   'Evansville',
    state:  'IN',
    lat:     37.971,
    lon:    -87.571,
    river:  'Ohio River',
    region: 'interiorLowlands',
    soil:   'Wheeling silt loam (Ohio River alluvial bottomland)',
    zone:   '6b',
    note:   'At the great southward bend of the Ohio in southwestern Indiana — the last glacial terminus draws a sharp line here between the flat Tipton Till Plain to the north and the unglaciated Knobstone escarpment to the south. Lincoln\'s boyhood home at Pigeon Creek was 25 miles northeast.',
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


/* ─── Gulf Coastal Plain ─────────────────────────────────────────
   Southern continuation of the Atlantic Coastal Plain wrapping around
   the base of the Appalachians and extending through Florida.
   Reuses region key 'coastal' so existing coastal plant and soil data
   applies; no new swatch or CSS needed.
   ────────────────────────────────────────────────────────────── */
const GULF_COASTAL_GEOJSON = {
  type: 'Feature',
  properties: {
    region:      'gulfCoastal',
    name:        'Gulf Coastal Plain',
    description: 'The southern continuation of the Atlantic Coastal Plain, wrapping ' +
      'around the base of the Appalachians and extending through Florida. Flat ' +
      'Tertiary sands and limestone, subtropical climate, longleaf pine savannas, ' +
      'cypress swamps, and mangrove coasts define the ecology from the Apalachicola ' +
      'River to the Florida Keys.',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      // Northern boundary: AL/MS fall line → Mississippi Embayment north
      [-85.000, 32.500],  // NW Georgia — connects to Coastal Plain boundary
      [-86.500, 32.500],  // Northern Alabama fall line (unchanged)
      [-88.000, 32.500],  // Eastern Mississippi fall line
      [-88.500, 33.500],  // North-central Mississippi
      [-89.500, 34.000],  // NW Mississippi — approaching Memphis
      [-90.300, 35.200],  // Memphis TN / Mississippi River — embayment limit
      [-89.800, 35.500],  // N Mississippi embayment — cap just north of Memphis
      [-88.500, 35.200],  // Western Tennessee — Tennessee River valley
      [-88.300, 35.000],  // Western Tennessee fall zone / Tennessee River
      [-89.200, 31.000],  // Western Mississippi / Gulf coast approach
      // Gulf coast and Florida (unchanged):
      [-89.500, 30.100],  // Pascagoula MS / Gulf coast
      [-88.000, 30.300],  // Mobile Bay AL
      [-84.900, 29.700],  // Tallahassee FL / Apalachicola
      [-82.500, 27.500],  // Central FL west coast — Charlotte Harbor / Sarasota area
      [-80.600, 28.400],  // Central FL east coast — Cape Canaveral / Brevard County
      [-81.500, 30.100],  // Jacksonville FL / St. Johns River
      [-83.000, 30.400],  // Okefenokee Swamp / Waycross GA
      [-84.500, 31.000],  // Southern Georgia / Thomasville area
      [-85.000, 32.500],  // close ring
    ]],
  },
};


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
  GREAT_LAKES_GEOJSON,
  INTERIOR_LOWLANDS_GEOJSON,
  GULF_COASTAL_GEOJSON,
  REGION_LABELS,
  BLUE_RIDGE_EAST_ESCARPMENT,
  BLUE_RIDGE_WEST_ESCARPMENT,
  STYLES,
  BBOX: { NORTH: BBOX_NORTH, SOUTH: BBOX_SOUTH, EAST: BBOX_EAST, WEST: BBOX_WEST },
  NATIVE_PLANTS,
  makeNativePlantsSection,
  SOIL_TYPES,
  makeSoilSection,
  INVASIVE_SPECIES,
  makeInvasivesSection,
  PLANTING_CALENDAR,
  makeCalendarSection,
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
  CORRIDOR_CITIES,
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
