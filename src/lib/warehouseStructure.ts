import { Bin } from '../types';

export interface StandardLocationMeta {
  id: string; // e.g., "A-01-01"
  aisle: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  rackNum: number; // 1 to 6
  rackName: string; // "Rack 1" to "Rack 6"
  face: 'Derecha' | 'Izquierda';
  faceKey: string; // e.g. "R1-D", "R2-I"
  faceTitle: string; // e.g. "Rack 1 - Cara Derecha"
  section: number; // 1 to 7
  space: string; // "01" to "14"
  spaceNum: number; // 1 to 14
  aisleSide: 'Izquierda' | 'Derecha';
  level: string; // "01" to "07"
  levelNum: number; // 1 to 7
  isBottomLevel: boolean;
  isTopLevel: boolean;
}

export const WAREHOUSE_CONSTANTS = {
  TOTAL_RACKS: 6,
  TOTAL_FACES: 11,
  TOTAL_AISLES: 6,
  AISLES: ['A', 'B', 'C', 'D', 'E', 'F'] as const,
  SECTIONS_PER_FACE: 7,
  LEVELS_PER_SECTION: 7,
  TOTAL_LOCATIONS: 539,
  RACK_CONFIG: [
    { rackNum: 1, faces: ['Derecha'] as const },
    { rackNum: 2, faces: ['Izquierda', 'Derecha'] as const },
    { rackNum: 3, faces: ['Izquierda', 'Derecha'] as const },
    { rackNum: 4, faces: ['Izquierda', 'Derecha'] as const },
    { rackNum: 5, faces: ['Izquierda', 'Derecha'] as const },
    { rackNum: 6, faces: ['Izquierda', 'Derecha'] as const },
  ],
};

/**
 * Generates the definitive, exact 539 standard warehouse locations
 * adhering strictly to the specifications:
 * - 6 racks, 11 faces, aisles A-F.
 * - Format: PASILLO-ESPACIO-NIVEL (e.g. A-01-01)
 * - Nivel 01 = bottom, Nivel 07 = top
 * - Physical sections 1..7 -> Odd spaces 01..13 (left), Even spaces 02..14 (right)
 */
export function generateAllStandardLocations(): StandardLocationMeta[] {
  const list: StandardLocationMeta[] = [];

  for (const config of WAREHOUSE_CONSTANTS.RACK_CONFIG) {
    const { rackNum, faces } = config;

    for (const face of faces) {
      let aisle: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
      let isOdd: boolean;

      if (rackNum === 1 && face === 'Derecha') {
        aisle = 'A';
        isOdd = true; // Left side of aisle A
      } else if (rackNum === 2 && face === 'Izquierda') {
        aisle = 'A';
        isOdd = false; // Right side of aisle A
      } else if (rackNum === 2 && face === 'Derecha') {
        aisle = 'B';
        isOdd = true; // Left side of aisle B
      } else if (rackNum === 3 && face === 'Izquierda') {
        aisle = 'B';
        isOdd = false; // Right side of aisle B
      } else if (rackNum === 3 && face === 'Derecha') {
        aisle = 'C';
        isOdd = true; // Left side of aisle C
      } else if (rackNum === 4 && face === 'Izquierda') {
        aisle = 'C';
        isOdd = false; // Right side of aisle C
      } else if (rackNum === 4 && face === 'Derecha') {
        aisle = 'D';
        isOdd = true; // Left side of aisle D
      } else if (rackNum === 5 && face === 'Izquierda') {
        aisle = 'D';
        isOdd = false; // Right side of aisle D
      } else if (rackNum === 5 && face === 'Derecha') {
        aisle = 'E';
        isOdd = true; // Left side of aisle E
      } else if (rackNum === 6 && face === 'Izquierda') {
        aisle = 'E';
        isOdd = false; // Right side of aisle E
      } else if (rackNum === 6 && face === 'Derecha') {
        aisle = 'F';
        isOdd = true; // Left side of aisle F (exterior access, machinery adjacent)
      } else {
        continue;
      }

      const faceKey = `R${rackNum}-${face === 'Derecha' ? 'D' : 'I'}`;
      const faceTitle = `Rack ${rackNum} - Cara ${face}`;
      const aisleSide: 'Izquierda' | 'Derecha' = isOdd ? 'Izquierda' : 'Derecha';

      for (let s = 1; s <= WAREHOUSE_CONSTANTS.SECTIONS_PER_FACE; s++) {
        const spaceNum = isOdd ? 2 * s - 1 : 2 * s;
        const spaceStr = String(spaceNum).padStart(2, '0');

        for (let lvl = 1; lvl <= WAREHOUSE_CONSTANTS.LEVELS_PER_SECTION; lvl++) {
          const lvlStr = String(lvl).padStart(2, '0');
          const id = `${aisle}-${spaceStr}-${lvlStr}`;

          list.push({
            id,
            aisle,
            rackNum,
            rackName: `Rack ${rackNum}`,
            face,
            faceKey,
            faceTitle,
            section: s,
            space: spaceStr,
            spaceNum,
            aisleSide,
            level: lvlStr,
            levelNum: lvl,
            isBottomLevel: lvl === 1,
            isTopLevel: lvl === 7,
          });
        }
      }
    }
  }

  return list;
}

// Precomputed map of all 539 standard locations by ID for O(1) instant lookup
export const STANDARD_LOCATIONS_BY_ID = new Map<string, StandardLocationMeta>(
  generateAllStandardLocations().map(loc => [loc.id, loc])
);

/**
 * Parses any location ID into its canonical warehouse metadata,
 * supporting the official PASILLO-ESPACIO-NIVEL nomenclature and custom racks.
 */
export function parseLocationId(id: string, existingBin?: Bin): StandardLocationMeta | null {
  if (!id) return null;
  const canonical = STANDARD_LOCATIONS_BY_ID.get(id.trim().toUpperCase());
  if (canonical && !existingBin) return canonical;

  // Regex parse for standard format AISLE-SPACE-LEVEL (supports letters A-Z, spaces and levels)
  const match = id.trim().toUpperCase().match(/^([A-Z0-9]+)-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const aisle = match[1] as any;
  const spaceNum = parseInt(match[2], 10);
  const levelNum = parseInt(match[3], 10);

  if (spaceNum < 1 || levelNum < 1) return null;

  const isOdd = spaceNum % 2 === 1;
  const section = isOdd ? Math.ceil(spaceNum / 2) : spaceNum / 2;
  
  let face: 'Derecha' | 'Izquierda' = isOdd ? 'Derecha' : 'Izquierda';
  if (existingBin?.shelf?.includes('Izquierda')) face = 'Izquierda';
  else if (existingBin?.shelf?.includes('Derecha')) face = 'Derecha';

  let rackNum = 1;
  if (existingBin?.rack) {
    const parsedR = parseInt(existingBin.rack.replace(/\D/g, ''), 10);
    if (!isNaN(parsedR) && parsedR > 0) rackNum = parsedR;
  } else {
    if (aisle === 'A') rackNum = isOdd ? 1 : 2;
    else if (aisle === 'B') rackNum = isOdd ? 2 : 3;
    else if (aisle === 'C') rackNum = isOdd ? 3 : 4;
    else if (aisle === 'D') rackNum = isOdd ? 4 : 5;
    else if (aisle === 'E') rackNum = isOdd ? 5 : 6;
    else if (aisle === 'F') rackNum = 6;
  }

  const spaceStr = String(spaceNum).padStart(2, '0');
  const lvlStr = String(levelNum).padStart(2, '0');

  return {
    id: `${aisle}-${spaceStr}-${lvlStr}`,
    aisle,
    rackNum,
    rackName: `Rack ${rackNum}`,
    face,
    faceKey: `R${rackNum}-${face === 'Derecha' ? 'D' : 'I'}`,
    faceTitle: `Rack ${rackNum} - Cara ${face}`,
    section,
    space: spaceStr,
    spaceNum,
    aisleSide: isOdd ? 'Izquierda' : 'Derecha',
    level: lvlStr,
    levelNum,
    isBottomLevel: levelNum === 1,
    isTopLevel: levelNum === 7,
  };
}

/**
 * Creates a default Bin object for a standard location metadata
 */
export function createDefaultBinFromMeta(meta: StandardLocationMeta): Bin {
  // Safe default capacity: higher weight limit for bottom level L01 (1000kg), standard for others (500kg)
  const maxW = meta.levelNum === 1 ? 1000 : meta.levelNum === 7 ? 250 : 500;

  return {
    id: meta.id,
    aisle: meta.aisle,
    rack: String(meta.rackNum),
    shelf: `Cara ${meta.face}`,
    level: meta.level,
    maxWeight: maxW,
    maxVolume: 50,
    occupiedSku: '',
    occupiedQty: 0,
    status: 'Empty',
  };
}

export interface WarehouseStatistics {
  totalTarget: number; // 539
  existingTotal: number;
  standardExistingCount: number;
  standardMissingCount: number;
  standardOccupiedCount: number;
  standardEmptyCount: number;
  nonStandardCount: number;
  nonStandardOccupiedCount: number;
  overallOccupancyPercent: number;
  totalOccupiedCount: number;
  totalEmptyCount: number;
  totalOccupancyPercent: number;
  totalWeightCapacityKg: number;
  uniqueSkusCount: number;
  totalItemsQuantity: number;
  rackStats: Record<number, {
    total: number;
    target: number;
    occupied: number;
    empty: number;
    occupancyPercent: number;
    faces: Record<string, { total: number; occupied: number; empty: number; occupancyPercent: number }>;
  }>;
  aisleStats: Record<string, {
    total: number;
    target: number;
    occupied: number;
    empty: number;
    occupancyPercent: number;
  }>;
  levelStats: Record<string, {
    total: number;
    occupied: number;
    empty: number;
    occupancyPercent: number;
    zone: 'baja' | 'media' | 'alta';
    label: string;
  }>;
}

/**
 * Computes deep inventory and structural statistics for the warehouse
 */
export function computeWarehouseStatistics(bins: Bin[]): WarehouseStatistics {
  const binsMap = new Map<string, Bin>(bins.map(b => [b.id, b]));
  const allStandard = generateAllStandardLocations();

  let standardExistingCount = 0;
  let standardOccupiedCount = 0;
  let standardEmptyCount = 0;

  // Track unique SKUs and total quantity in warehouse
  const skusSet = new Set<string>();
  let totalItemsQuantity = 0;
  let totalWeightCapacityKg = 0;

  // Initialize rack stats for standard racks
  const rackStats: WarehouseStatistics['rackStats'] = {};
  for (let r = 1; r <= 6; r++) {
    rackStats[r] = {
      total: 0,
      target: r === 1 ? 49 : 98,
      occupied: 0,
      empty: 0,
      occupancyPercent: 0,
      faces: r === 1
        ? { Derecha: { total: 0, occupied: 0, empty: 0, occupancyPercent: 0 } }
        : { 
            Izquierda: { total: 0, occupied: 0, empty: 0, occupancyPercent: 0 }, 
            Derecha: { total: 0, occupied: 0, empty: 0, occupancyPercent: 0 } 
          },
    };
  }

  // Initialize aisle stats for standard aisles
  const aisleStats: WarehouseStatistics['aisleStats'] = {};
  for (const a of WAREHOUSE_CONSTANTS.AISLES) {
    aisleStats[a] = {
      total: 0,
      target: a === 'F' ? 49 : 98,
      occupied: 0,
      empty: 0,
      occupancyPercent: 0,
    };
  }

  // Initialize level stats for standard levels
  const levelStats: WarehouseStatistics['levelStats'] = {};
  for (let l = 1; l <= 7; l++) {
    const lvlKey = l < 10 ? `0${l}` : `${l}`;
    const zone: 'baja' | 'media' | 'alta' = l <= 2 ? 'baja' : l <= 5 ? 'media' : 'alta';
    const label = l <= 2 ? 'Nivel Bajo (Acceso Rápido / Suelo)' : l <= 5 ? 'Nivel Medio (Estándar)' : 'Nivel Alto (Reserva / Montacargas)';
    levelStats[lvlKey] = {
      total: 0,
      occupied: 0,
      empty: 0,
      occupancyPercent: 0,
      zone,
      label
    };
  }

  allStandard.forEach(meta => {
    const existing = binsMap.get(meta.id);
    if (existing) {
      standardExistingCount++;
      const isOccupied = existing.status !== 'Empty' || Boolean(existing.occupiedSku) || (existing.occupiedQty > 0);
      if (isOccupied) standardOccupiedCount++;
      else standardEmptyCount++;

      // Update rack stats
      const r = rackStats[meta.rackNum];
      if (r) {
        r.total++;
        if (isOccupied) r.occupied++;
        else r.empty++;
        if (r.faces[meta.face]) {
          r.faces[meta.face].total++;
          if (isOccupied) r.faces[meta.face].occupied++;
          else r.faces[meta.face].empty++;
        }
      }

      // Update aisle stats
      const a = aisleStats[meta.aisle];
      if (a) {
        a.total++;
        if (isOccupied) a.occupied++;
        else a.empty++;
      }
    }
  });

  const standardMissingCount = WAREHOUSE_CONSTANTS.TOTAL_LOCATIONS - standardExistingCount;

  // Process all bins (standard and custom/additional racks & spaces)
  let totalOccupiedCount = 0;
  let nonStandardCount = 0;
  let nonStandardOccupiedCount = 0;

  bins.forEach(b => {
    const isOccupied = b.status !== 'Empty' || Boolean(b.occupiedSku) || (b.occupiedQty > 0);
    if (isOccupied) totalOccupiedCount++;
    totalWeightCapacityKg += (b.maxWeight || 0);

    if (b.occupiedSku) {
      skusSet.add(b.occupiedSku);
      totalItemsQuantity += (b.occupiedQty || 0);
    }

    const isStd = STANDARD_LOCATIONS_BY_ID.has(b.id);
    if (!isStd) {
      nonStandardCount++;
      if (isOccupied) nonStandardOccupiedCount++;

      // Dynamically add or update custom racks
      const parsedR = parseInt(b.rack?.replace(/\D/g, '') || '', 10);
      if (!isNaN(parsedR) && parsedR > 0) {
        if (!rackStats[parsedR]) {
          rackStats[parsedR] = {
            total: 0,
            target: 0,
            occupied: 0,
            empty: 0,
            occupancyPercent: 0,
            faces: {}
          };
        }
        const rObj = rackStats[parsedR];
        rObj.total++;
        if (isOccupied) rObj.occupied++;
        else rObj.empty++;

        const faceKey = b.shelf?.includes('Izquierda') ? 'Izquierda' : 'Derecha';
        if (!rObj.faces[faceKey]) {
          rObj.faces[faceKey] = { total: 0, occupied: 0, empty: 0, occupancyPercent: 0 };
        }
        rObj.faces[faceKey].total++;
        if (isOccupied) rObj.faces[faceKey].occupied++;
        else rObj.faces[faceKey].empty++;
      }

      // Dynamically add or update custom aisles
      if (b.aisle) {
        if (!aisleStats[b.aisle]) {
          aisleStats[b.aisle] = {
            total: 0,
            target: 0,
            occupied: 0,
            empty: 0,
            occupancyPercent: 0,
          };
        }
        const aObj = aisleStats[b.aisle];
        aObj.total++;
        if (isOccupied) aObj.occupied++;
        else aObj.empty++;
      }
    }

    // Process Level statistics for every bin
    const lvlKey = b.level || (b.id.match(/-(\d{2})$/)?.[1]) || '01';
    if (!levelStats[lvlKey]) {
      const numLvl = parseInt(lvlKey.replace(/\D/g, ''), 10) || 1;
      const zone: 'baja' | 'media' | 'alta' = numLvl <= 2 ? 'baja' : numLvl <= 5 ? 'media' : 'alta';
      levelStats[lvlKey] = {
        total: 0,
        occupied: 0,
        empty: 0,
        occupancyPercent: 0,
        zone,
        label: `Nivel ${lvlKey}`
      };
    }
    levelStats[lvlKey].total++;
    if (isOccupied) levelStats[lvlKey].occupied++;
    else levelStats[lvlKey].empty++;
  });

  // Calculate percentages
  Object.values(rackStats).forEach(r => {
    r.occupancyPercent = r.total > 0 ? Math.round((r.occupied / r.total) * 100) : 0;
    Object.values(r.faces).forEach(f => {
      f.occupancyPercent = f.total > 0 ? Math.round((f.occupied / f.total) * 100) : 0;
    });
  });

  Object.values(aisleStats).forEach(a => {
    a.occupancyPercent = a.total > 0 ? Math.round((a.occupied / a.total) * 100) : 0;
  });

  Object.values(levelStats).forEach(l => {
    l.occupancyPercent = l.total > 0 ? Math.round((l.occupied / l.total) * 100) : 0;
  });

  const totalEmptyCount = Math.max(0, bins.length - totalOccupiedCount);
  const totalOccupancyPercent = bins.length > 0 ? Math.round((totalOccupiedCount / bins.length) * 100) : 0;

  const overallOccupancyPercent = standardExistingCount > 0
    ? Math.round((standardOccupiedCount / standardExistingCount) * 100)
    : 0;

  return {
    totalTarget: WAREHOUSE_CONSTANTS.TOTAL_LOCATIONS,
    existingTotal: bins.length,
    standardExistingCount,
    standardMissingCount,
    standardOccupiedCount,
    standardEmptyCount,
    nonStandardCount,
    nonStandardOccupiedCount,
    overallOccupancyPercent,
    totalOccupiedCount,
    totalEmptyCount,
    totalOccupancyPercent,
    totalWeightCapacityKg,
    uniqueSkusCount: skusSet.size,
    totalItemsQuantity,
    rackStats,
    aisleStats,
    levelStats,
  };
}
