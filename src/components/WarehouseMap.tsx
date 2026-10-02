import React, { useState, useMemo } from 'react';
import { Bin, InventoryItem } from '../types';
import { 
  MapPin, 
  Search, 
  Database, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  X,
  Boxes,
  Grid,
  List,
  ShieldCheck,
  Package,
  Plus,
  Trash2,
  Layers,
  ArrowRight,
  BarChart3,
  TrendingUp,
  Gauge,
  PieChart,
  ExternalLink,
  Activity
} from 'lucide-react';
import {
  WAREHOUSE_CONSTANTS,
  StandardLocationMeta,
  generateAllStandardLocations,
  parseLocationId,
  createDefaultBinFromMeta,
  computeWarehouseStatistics
} from '../lib/warehouseStructure';

interface WarehouseMapProps {
  bins: Bin[];
  onSelectBin: (bin: Bin | null) => void;
  selectedBin: Bin | null;
  activePath?: string[];
  onUpdateBins?: (newBins: Bin[], action: string, details: string) => Promise<void>;
  isReadOnly?: boolean;
  userRole?: string;
  inventory?: InventoryItem[];
  onNavigateToDashboard?: () => void;
}

export const WarehouseMap: React.FC<WarehouseMapProps> = ({
  bins,
  onSelectBin,
  selectedBin,
  onUpdateBins,
  isReadOnly = false,
  inventory = [],
  onNavigateToDashboard
}) => {
  // Navigation tabs: 'racks' (default focused grid), 'plano' (simple top-down view), 'lista' (searchable table), 'metricas' (integrated KPIs)
  const [activeTab, setActiveTab] = useState<'racks' | 'plano' | 'lista' | 'metricas'>('racks');

  // Currently inspected Rack and Face
  const [activeRack, setActiveRack] = useState<number>(1);
  const [activeFace, setActiveFace] = useState<'Derecha' | 'Izquierda'>('Derecha');

  // Fast search query
  const [searchQuery, setSearchQuery] = useState('');

  // Sincronizar / Generar Estructura Modal & feedback
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);

  // DAR DE ALTA RACKS / ESPACIOS MODAL STATE
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'rack' | 'space'>('rack');

  // New Rack Form State
  const [newRackNum, setNewRackNum] = useState<number>(7);
  const [newRackAisle, setNewRackAisle] = useState<string>('G');
  const [newRackFaces, setNewRackFaces] = useState<'Doble' | 'Derecha' | 'Izquierda'>('Doble');
  const [newRackSections, setNewRackSections] = useState<number>(7);
  const [newRackLevels, setNewRackLevels] = useState<number>(7);
  const [newRackWeight, setNewRackWeight] = useState<number>(500);

  // New Space Form State
  const [newSpaceAisle, setNewSpaceAisle] = useState<string>('A');
  const [newSpaceRack, setNewSpaceRack] = useState<number>(1);
  const [newSpaceFace, setNewSpaceFace] = useState<'Derecha' | 'Izquierda'>('Derecha');
  const [newSpaceNum, setNewSpaceNum] = useState<number>(15);
  const [newSpaceLevels, setNewSpaceLevels] = useState<'ALL' | 'SINGLE'>('ALL');
  const [newSpaceSingleLevel, setNewSpaceSingleLevel] = useState<number>(1);
  const [newSpaceWeight, setNewSpaceWeight] = useState<number>(500);

  const [addStatusMsg, setAddStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Fast lookup maps
  const binsMap = useMemo(() => new Map<string, Bin>(bins.map(b => [b.id, b])), [bins]);
  const inventoryMap = useMemo(() => new Map<string, InventoryItem>(inventory.map(i => [i.sku, i])), [inventory]);
  const stats = useMemo(() => computeWarehouseStatistics(bins), [bins]);
  const allStandardLocations = useMemo(() => generateAllStandardLocations(), []);

  // Dynamically compute all available racks from both standard rules AND existing bins!
  const availableRacks = useMemo(() => {
    const set = new Set<number>([1, 2, 3, 4, 5, 6]);
    bins.forEach(b => {
      const parsedR = parseInt(b.rack.replace(/\D/g, ''), 10);
      if (!isNaN(parsedR) && parsedR > 0) set.add(parsedR);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [bins]);

  // Suggested next rack number for creation
  const nextRackNum = useMemo(() => {
    const max = Math.max(...availableRacks, 6);
    return max + 1;
  }, [availableRacks]);

  // Dynamically compute faces available for the currently selected activeRack
  const availableFacesForRack = useMemo(() => {
    const facesSet = new Set<'Derecha' | 'Izquierda'>();
    bins.filter(b => {
      const r = parseInt(b.rack.replace(/\D/g, ''), 10);
      return r === activeRack;
    }).forEach(b => {
      if (b.shelf.includes('Izquierda')) facesSet.add('Izquierda');
      if (b.shelf.includes('Derecha')) facesSet.add('Derecha');
    });

    if (facesSet.size === 0) {
      if (activeRack === 1) facesSet.add('Derecha');
      else { facesSet.add('Izquierda'); facesSet.add('Derecha'); }
    }
    return Array.from(facesSet);
  }, [bins, activeRack]);

  // Ensure activeFace is valid for activeRack
  React.useEffect(() => {
    if (!availableFacesForRack.includes(activeFace)) {
      setActiveFace(availableFacesForRack[0] || 'Derecha');
    }
  }, [availableFacesForRack, activeFace]);

  // Support navigation directly from Dashboard metrics into a selected rack
  React.useEffect(() => {
    const targetRack = localStorage.getItem('owms_selected_map_rack');
    if (targetRack) {
      const num = parseInt(targetRack, 10);
      if (!isNaN(num) && availableRacks.includes(num)) {
        setActiveRack(num);
        setActiveTab('racks');
      }
      localStorage.removeItem('owms_selected_map_rack');
    }
  }, [availableRacks]);

  // Helper to get aisle name and parity for the active rack and face
  const activeFaceInfo = useMemo(() => {
    if (activeRack <= 6) {
      let aisle = 'A';
      let isOdd = true;

      if (activeRack === 1 && activeFace === 'Derecha') { aisle = 'A'; isOdd = true; }
      else if (activeRack === 2 && activeFace === 'Izquierda') { aisle = 'A'; isOdd = false; }
      else if (activeRack === 2 && activeFace === 'Derecha') { aisle = 'B'; isOdd = true; }
      else if (activeRack === 3 && activeFace === 'Izquierda') { aisle = 'B'; isOdd = false; }
      else if (activeRack === 3 && activeFace === 'Derecha') { aisle = 'C'; isOdd = true; }
      else if (activeRack === 4 && activeFace === 'Izquierda') { aisle = 'C'; isOdd = false; }
      else if (activeRack === 4 && activeFace === 'Derecha') { aisle = 'D'; isOdd = true; }
      else if (activeRack === 5 && activeFace === 'Izquierda') { aisle = 'D'; isOdd = false; }
      else if (activeRack === 5 && activeFace === 'Derecha') { aisle = 'E'; isOdd = true; }
      else if (activeRack === 6 && activeFace === 'Izquierda') { aisle = 'E'; isOdd = false; }
      else if (activeRack === 6 && activeFace === 'Derecha') { aisle = 'F'; isOdd = true; }

      return {
        aisle,
        isOdd,
        spaces: isOdd ? '01, 03, 05, 07, 09, 11, 13 (Lado Izquierdo)' : '02, 04, 06, 08, 10, 12, 14 (Lado Derecho)',
        isMachinery: aisle === 'F'
      };
    } else {
      // Custom rack > 6
      const rackBins = bins.filter(b => parseInt(b.rack.replace(/\D/g, ''), 10) === activeRack);
      const faceBins = rackBins.filter(b => b.shelf.includes(activeFace));
      const sample = faceBins[0] || rackBins[0];
      const aisle = sample ? sample.aisle : 'G';
      const isOdd = activeFace === 'Derecha';
      return {
        aisle,
        isOdd,
        spaces: isOdd ? 'Espacios Impares (Lado Izquierdo)' : 'Espacios Pares (Lado Derecho)',
        isMachinery: false
      };
    }
  }, [activeRack, activeFace, bins]);

  // Compute sections and levels for current rack and face
  const currentSections = useMemo(() => {
    const rackBins = bins.filter(b => {
      const r = parseInt(b.rack.replace(/\D/g, ''), 10);
      return r === activeRack && b.shelf.includes(activeFace);
    });
    if (rackBins.length === 0) return [1, 2, 3, 4, 5, 6, 7];

    const sectionSet = new Set<number>();
    rackBins.forEach(b => {
      const meta = parseLocationId(b.id, b);
      if (meta?.section) sectionSet.add(meta.section);
    });
    if (sectionSet.size === 0) return [1, 2, 3, 4, 5, 6, 7];
    return Array.from(sectionSet).sort((a, b) => a - b);
  }, [bins, activeRack, activeFace]);

  const currentLevels = useMemo(() => {
    const rackBins = bins.filter(b => {
      const r = parseInt(b.rack.replace(/\D/g, ''), 10);
      return r === activeRack && b.shelf.includes(activeFace);
    });
    if (rackBins.length === 0) return [7, 6, 5, 4, 3, 2, 1];

    const levelSet = new Set<number>();
    rackBins.forEach(b => {
      const meta = parseLocationId(b.id, b);
      if (meta?.levelNum) levelSet.add(meta.levelNum);
    });
    if (levelSet.size === 0) return [7, 6, 5, 4, 3, 2, 1];
    return Array.from(levelSet).sort((a, b) => b - a); // Top to bottom
  }, [bins, activeRack, activeFace]);

  // Filtered locations for list view (includes both standard and custom created bins)
  const filteredList = useMemo(() => {
    const allKnownMap = new Map<string, { id: string; aisle: string; rackName: string; face: string; section: number; space: string; level: string }>();

    // Add all standard locations
    allStandardLocations.forEach(loc => {
      allKnownMap.set(loc.id, {
        id: loc.id,
        aisle: loc.aisle,
        rackName: loc.rackName,
        face: loc.face,
        section: loc.section,
        space: loc.space,
        level: loc.level
      });
    });

    // Add all custom bins from state
    bins.forEach(b => {
      if (!allKnownMap.has(b.id)) {
        const meta = parseLocationId(b.id, b);
        allKnownMap.set(b.id, {
          id: b.id,
          aisle: b.aisle,
          rackName: `Rack ${b.rack}`,
          face: b.shelf.replace('Cara ', ''),
          section: meta?.section || 1,
          space: meta?.space || '01',
          level: b.level
        });
      }
    });

    const items = Array.from(allKnownMap.values());
    if (!searchQuery.trim()) return items;

    const q = searchQuery.trim().toUpperCase();
    return items.filter(loc => {
      const bin = binsMap.get(loc.id);
      return (
        loc.id.includes(q) ||
        loc.aisle === q ||
        loc.rackName.toUpperCase().includes(q) ||
        bin?.occupiedSku?.toUpperCase().includes(q)
      );
    });
  }, [allStandardLocations, bins, searchQuery, binsMap]);

  // Selected bin metadata
  const selectedMeta = useMemo(() => {
    if (!selectedBin) return null;
    return parseLocationId(selectedBin.id, selectedBin);
  }, [selectedBin]);

  const selectedProduct = useMemo(() => {
    if (!selectedBin?.occupiedSku) return null;
    return inventoryMap.get(selectedBin.occupiedSku) || null;
  }, [selectedBin, inventoryMap]);

  // Handle generation of the 539 standard locations
  const handleConfirmGeneration = async () => {
    if (isReadOnly) {
      setGenerateError('Permiso denegado: se requieren privilegios de administración.');
      return;
    }
    if (!onUpdateBins) {
      setGenerateError('Error: no se encontró la función de sincronización de la base de datos.');
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);
    setGenerateSuccess(null);

    try {
      const updatedBinsMap = new Map<string, Bin>();

      // Preserve existing bins with inventory
      bins.forEach(b => updatedBinsMap.set(b.id, { ...b }));

      let newCount = 0;
      let preservedCount = 0;

      allStandardLocations.forEach(meta => {
        if (updatedBinsMap.has(meta.id)) {
          preservedCount++;
        } else {
          updatedBinsMap.set(meta.id, createDefaultBinFromMeta(meta));
          newCount++;
        }
      });

      const finalBinsList = Array.from(updatedBinsMap.values());

      await onUpdateBins(
        finalBinsList,
        'Generar 539 Ubicaciones del Almacén',
        `Estructura configurada con 539 ubicaciones oficiales. Nuevas: ${newCount}, existentes preservadas: ${preservedCount}.`
      );

      setGenerateSuccess(`¡Éxito! Se sincronizaron las ${WAREHOUSE_CONSTANTS.TOTAL_LOCATIONS} ubicaciones estándar (${newCount} nuevas creadas).`);
      setTimeout(() => {
        setShowGenerateModal(false);
        setGenerateSuccess(null);
      }, 1500);

    } catch (err: any) {
      console.error('Error saving locations:', err);
      setGenerateError(`Error al guardar: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // DAR DE ALTA NUEVO RACK O ESPACIOS INDIVIDUALES
  const handleCreateRackOrSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      setAddStatusMsg({ type: 'err', text: 'Permiso denegado: se requieren privilegios de administración.' });
      return;
    }
    if (!onUpdateBins) {
      setAddStatusMsg({ type: 'err', text: 'Error: función de guardado no disponible.' });
      return;
    }

    setIsAdding(true);
    setAddStatusMsg(null);

    try {
      const updatedMap = new Map<string, Bin>(bins.map(b => [b.id, b]));

      if (addMode === 'rack') {
        const rackNumber = Number(newRackNum) || nextRackNum;
        const aisleLetter = newRackAisle.trim().toUpperCase() || 'G';
        const numSections = Math.min(Math.max(Number(newRackSections) || 7, 1), 14);
        const numLevels = Math.min(Math.max(Number(newRackLevels) || 7, 1), 10);
        const weightVal = Number(newRackWeight) || 500;

        const facesToBuild: ('Derecha' | 'Izquierda')[] = 
          newRackFaces === 'Doble' ? ['Izquierda', 'Derecha'] :
          newRackFaces === 'Derecha' ? ['Derecha'] : ['Izquierda'];

        let addedCount = 0;

        for (const face of facesToBuild) {
          const isOdd = face === 'Derecha';
          for (let s = 1; s <= numSections; s++) {
            const spaceNum = isOdd ? (2 * s - 1) : (2 * s);
            const spaceStr = String(spaceNum).padStart(2, '0');

            for (let lvl = 1; lvl <= numLevels; lvl++) {
              const lvlStr = String(lvl).padStart(2, '0');
              const id = `${aisleLetter}-${spaceStr}-${lvlStr}`;

              if (!updatedMap.has(id)) {
                const newBin: Bin = {
                  id,
                  aisle: aisleLetter,
                  rack: String(rackNumber),
                  shelf: `Cara ${face}`,
                  level: lvlStr,
                  maxWeight: lvl === 1 ? 1000 : lvl === numLevels ? 250 : weightVal,
                  maxVolume: 50,
                  occupiedSku: '',
                  occupiedQty: 0,
                  status: 'Empty'
                };
                updatedMap.set(id, newBin);
                addedCount++;
              }
            }
          }
        }

        if (addedCount === 0) {
          throw new Error(`Las celdas para el Rack ${rackNumber} con estos parámetros ya existen en el sistema.`);
        }

        const finalBins = Array.from(updatedMap.values());
        await onUpdateBins(
          finalBins,
          `Alta de Nuevo Rack ${rackNumber}`,
          `Se dio de alta el Rack ${rackNumber} con ${addedCount} ubicaciones en el Pasillo ${aisleLetter} (${facesToBuild.join(' y ')}).`
        );

        setActiveRack(rackNumber);
        setActiveFace(facesToBuild[0]);
        setActiveTab('racks');
        setAddStatusMsg({ type: 'ok', text: `✓ ¡Rack ${rackNumber} creado con éxito! Se habilitaron ${addedCount} nuevas celdas y ya se muestran en el mapa.` });

        setTimeout(() => {
          setShowAddModal(false);
          setAddStatusMsg(null);
        }, 1500);

      } else {
        // Space / Specific cell mode
        const aisleLetter = newSpaceAisle.trim().toUpperCase() || 'A';
        const rackNumber = Number(newSpaceRack) || 1;
        const faceName = newSpaceFace;
        const spaceNumber = Number(newSpaceNum) || 1;
        const spaceStr = String(spaceNumber).padStart(2, '0');
        const weightVal = Number(newSpaceWeight) || 500;

        let addedCount = 0;
        const levelsToCreate = newSpaceLevels === 'ALL' ? [1, 2, 3, 4, 5, 6, 7] : [Number(newSpaceSingleLevel) || 1];

        for (const lvl of levelsToCreate) {
          const lvlStr = String(lvl).padStart(2, '0');
          const id = `${aisleLetter}-${spaceStr}-${lvlStr}`;

          if (!updatedMap.has(id)) {
            const newBin: Bin = {
              id,
              aisle: aisleLetter,
              rack: String(rackNumber),
              shelf: `Cara ${faceName}`,
              level: lvlStr,
              maxWeight: lvl === 1 ? 1000 : lvl === 7 ? 250 : weightVal,
              maxVolume: 50,
              occupiedSku: '',
              occupiedQty: 0,
              status: 'Empty'
            };
            updatedMap.set(id, newBin);
            addedCount++;
          }
        }

        if (addedCount === 0) {
          throw new Error('El espacio especificado ya existe en el sistema.');
        }

        const finalBins = Array.from(updatedMap.values());
        await onUpdateBins(
          finalBins,
          `Alta de Espacio ${aisleLetter}-${spaceStr}`,
          `Se dieron de alta ${addedCount} niveles para el espacio ${aisleLetter}-${spaceStr} en el Rack ${rackNumber}.`
        );

        setActiveRack(rackNumber);
        setActiveFace(faceName);
        setActiveTab('racks');
        const firstCreatedId = `${aisleLetter}-${spaceStr}-${String(levelsToCreate[0]).padStart(2, '0')}`;
        const createdBin = updatedMap.get(firstCreatedId);
        if (createdBin) onSelectBin(createdBin);

        setAddStatusMsg({ type: 'ok', text: `✓ ¡Espacio ${aisleLetter}-${spaceStr} creado con éxito con ${addedCount} ubicación(es)!` });

        setTimeout(() => {
          setShowAddModal(false);
          setAddStatusMsg(null);
        }, 1500);
      }
    } catch (err: any) {
      setAddStatusMsg({ type: 'err', text: err.message || 'Error al crear la infraestructura.' });
    } finally {
      setIsAdding(false);
    }
  };

  // Delete single cell if needed
  const handleDeleteBin = async (binToDelete: Bin) => {
    if (isReadOnly) return;
    if (binToDelete.occupiedQty > 0 || binToDelete.occupiedSku) {
      const confirmForce = window.confirm(
        `ADVERTENCIA: La celda ${binToDelete.id} tiene stock activo (${binToDelete.occupiedSku}: ${binToDelete.occupiedQty} uds). ¿Desea eliminarla? Se perderá el stock asignado a esta celda.`
      );
      if (!confirmForce) return;
    } else {
      if (!window.confirm(`¿Eliminar la ubicación ${binToDelete.id}?`)) return;
    }

    const nextBins = bins.filter(b => b.id !== binToDelete.id);
    if (onUpdateBins) {
      await onUpdateBins(
        nextBins,
        'Eliminar Ubicación',
        `Se eliminó la celda de almacenamiento ${binToDelete.id}.`
      );
    }
    onSelectBin(null);
  };

  return (
    <div className="space-y-4">
      
      {/* 1. HEADER SIMPLE & COMPACTO CON BOTÓN DE ALTA */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              <span>Mapa del Almacén</span>
            </h1>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
              {bins.length} Ubicaciones Totales
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestión y visualización visual de racks, pasillos y celdas de almacenamiento.
          </p>
        </div>

        {/* Action buttons & view switcher */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Navigation view tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setActiveTab('racks')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'racks' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Grid className="h-3.5 w-3.5 text-blue-600" />
              <span>Estanterías</span>
            </button>
            <button
              onClick={() => setActiveTab('plano')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'plano' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Boxes className="h-3.5 w-3.5 text-amber-600" />
              <span>Planta General</span>
            </button>
            <button
              onClick={() => setActiveTab('lista')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'lista' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="h-3.5 w-3.5 text-emerald-600" />
              <span>Listado</span>
            </button>
            <button
              onClick={() => setActiveTab('metricas')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'metricas' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5 text-indigo-600" />
              <span>Métricas</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                stats.totalOccupancyPercent >= 90 ? 'bg-rose-100 text-rose-700' : stats.totalOccupancyPercent >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {stats.totalOccupancyPercent}%
              </span>
            </button>
          </div>

          {/* BOTÓN NUEVO: DAR DE ALTA RACK O ESPACIO */}
          <button
            onClick={() => {
              setAddStatusMsg(null);
              setNewRackNum(nextRackNum);
              const existingAisles: string[] = Array.from(new Set(bins.map(b => String(b.aisle || '')))).filter((a): a is string => Boolean(a));
              const maxCharCode = existingAisles.length > 0 ? Math.max(...existingAisles.map((a: string) => a.charCodeAt(0))) : 70;
              const nextLetter = String.fromCharCode(Math.max(maxCharCode, 70) + 1);
              setNewRackAisle(nextLetter);
              setShowAddModal(true);
            }}
            disabled={isReadOnly}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs active:scale-95"
            title="Agregar un nuevo rack o nuevos espacios físicos al almacén"
          >
            <Plus className="h-4 w-4" />
            <span>Dar de Alta Rack / Espacio</span>
          </button>

          {/* Botón Sincronizar 539 estándar */}
          <button
            onClick={() => {
              setGenerateError(null);
              setGenerateSuccess(null);
              setShowGenerateModal(true);
            }}
            disabled={isReadOnly}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
              stats.standardMissingCount > 0
                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Sincronizar las 539 ubicaciones oficiales"
          >
            <Database className="h-3.5 w-3.5" />
            <span>
              {stats.standardMissingCount > 0 ? `Sincronizar Oficiales (${stats.standardMissingCount} faltan)` : 'Sincronizar 539'}
            </span>
          </button>
        </div>
      </div>

      {/* KPI STRIP DE CONEXIÓN EN TIEMPO REAL CON MÉTRICAS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div 
          onClick={() => setActiveTab('metricas')}
          className={`border p-3 rounded-2xl shadow-2xs cursor-pointer transition group ${
            activeTab === 'metricas' ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-200' : 'bg-white border-slate-200/90 hover:border-indigo-300'
          }`}
          title="Ver métricas completas de ubicaciones"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Celdas Totales</span>
          <span className="text-base font-black font-mono text-slate-900 group-hover:text-indigo-600 transition block mt-0.5">
            {bins.length}
          </span>
          <span className="text-[9px] text-blue-600 font-medium block truncate">
            {stats.standardExistingCount} oficiales {stats.nonStandardCount > 0 ? `+ ${stats.nonStandardCount} extras` : ''}
          </span>
        </div>

        <div 
          onClick={() => setActiveTab('metricas')}
          className={`border p-3 rounded-2xl shadow-2xs cursor-pointer transition group ${
            activeTab === 'metricas' ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-200' : 'bg-white border-slate-200/90 hover:border-indigo-300'
          }`}
          title="Ver desglose de ocupación"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ocupación Física</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-black font-mono text-slate-900 group-hover:text-indigo-600 transition">
              {stats.totalOccupancyPercent}%
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              ({stats.totalOccupiedCount}/{bins.length})
            </span>
          </div>
          <div className="w-full bg-slate-150 h-1.5 rounded-full overflow-hidden mt-1">
            <div 
              className={`h-full rounded-full transition-all ${
                stats.totalOccupancyPercent >= 90 ? 'bg-rose-500' : stats.totalOccupancyPercent >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${stats.totalOccupancyPercent}%` }}
            />
          </div>
        </div>

        <div 
          onClick={() => setActiveTab('metricas')}
          className={`border p-3 rounded-2xl shadow-2xs cursor-pointer transition group ${
            activeTab === 'metricas' ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-200' : 'bg-white border-slate-200/90 hover:border-indigo-300'
          }`}
          title="Celdas disponibles para almacenamiento"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Celdas Libres</span>
          <span className="text-base font-black font-mono text-emerald-600 block mt-0.5">
            {stats.totalEmptyCount}
          </span>
          <span className="text-[9px] text-slate-400 block truncate">Disponibles Putaway</span>
        </div>

        <div 
          onClick={() => setActiveTab('metricas')}
          className={`border p-3 rounded-2xl shadow-2xs cursor-pointer transition group ${
            activeTab === 'metricas' ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-200' : 'bg-white border-slate-200/90 hover:border-indigo-300'
          }`}
          title="Capacidad máxima de peso en racks"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Capacidad de Carga</span>
          <span className="text-base font-black font-mono text-slate-900 group-hover:text-indigo-600 transition block mt-0.5">
            {(stats.totalWeightCapacityKg / 1000).toFixed(1)} T
          </span>
          <span className="text-[9px] text-slate-400 block truncate">Resistencia total</span>
        </div>

        <div 
          onClick={() => setActiveTab('metricas')}
          className={`border p-3 rounded-2xl shadow-2xs cursor-pointer transition group ${
            activeTab === 'metricas' ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-200' : 'bg-white border-slate-200/90 hover:border-indigo-300'
          }`}
          title="Estructura de estanterías y pasillos"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Infraestructura</span>
          <span className="text-base font-black font-mono text-indigo-700 block mt-0.5">
            {availableRacks.length} Racks
          </span>
          <span className="text-[9px] text-indigo-600 font-medium block truncate">
            {new Set(bins.map(b => b.aisle)).size} Pasillos activos
          </span>
        </div>

        <div 
          onClick={() => onNavigateToDashboard ? onNavigateToDashboard() : setActiveTab('metricas')}
          className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200/80 hover:border-indigo-400 p-3 rounded-2xl shadow-2xs cursor-pointer transition group flex flex-col justify-between"
          title="Ver panel completo de análisis operacional WMS"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">Dashboard</span>
              <ExternalLink className="h-3 w-3 text-indigo-600 group-hover:translate-x-0.5 transition" />
            </div>
            <span className="text-xs font-black text-slate-800 block mt-0.5">
              Analítica WMS
            </span>
          </div>
          <span className="text-[9px] text-indigo-600 font-bold group-hover:underline">
            Ver Dashboard →
          </span>
        </div>
      </div>
      {activeTab === 'racks' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Main Shelf Grid (8 cols) */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            
            {/* Top Selector: Step 1 Pick Rack, Step 2 Pick Face */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              {/* Dynamic Rack Selector Buttons */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  1. Seleccione Rack:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {availableRacks.map(r => (
                    <button
                      key={r}
                      onClick={() => {
                        setActiveRack(r);
                        if (r === 1) setActiveFace('Derecha');
                      }}
                      className={`px-3 py-1.5 rounded-lg font-mono font-bold text-xs transition cursor-pointer ${
                        activeRack === r
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      Rack {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Face Selector Buttons */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  2. Cara de Almacenamiento:
                </span>
                <div className="flex items-center gap-1.5">
                  {availableFacesForRack.map(face => (
                    <button
                      key={face}
                      onClick={() => setActiveFace(face)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        activeFace === face
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      Cara {face}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sub-header info banner for the selected face */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="font-mono text-slate-700">
                <strong>Rack {activeRack} • Cara {activeFace}</strong>
                <span className="text-slate-400 mx-2">|</span>
                <span>Pasillo <strong>{activeFaceInfo.aisle}</strong></span>
                <span className="text-slate-400 mx-2">|</span>
                <span className="text-slate-500">{activeFaceInfo.spaces}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Libre</span>
                </span>
                <span className="flex items-center gap-1 text-amber-700">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>Ocupada</span>
                </span>
              </div>
            </div>

            {/* Shelf Elevation Matrix */}
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[620px] space-y-2">
                
                {/* Section Column Headers */}
                <div 
                  className="grid gap-2 text-center text-[10px] font-mono font-bold text-slate-500"
                  style={{ gridTemplateColumns: `80px repeat(${currentSections.length}, minmax(0, 1fr))` }}
                >
                  <div className="text-right pr-2 text-slate-400 self-center">Nivel</div>
                  {currentSections.map(s => {
                    const spaceNum = activeFaceInfo.isOdd ? (2 * s - 1) : (2 * s);
                    const spaceStr = String(spaceNum).padStart(2, '0');
                    return (
                      <div key={s} className="bg-slate-100 py-1.5 px-1 rounded-lg border border-slate-200">
                        <span className="block text-slate-800">Secc {s}</span>
                        <span className="block text-blue-600 text-[9px]">Esp {spaceStr}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Rows from Highest Level down to Level 01 */}
                {currentLevels.map(lvl => {
                  const lvlStr = String(lvl).padStart(2, '0');
                  const isTop = lvl === Math.max(...currentLevels);
                  const isBottom = lvl === 1;

                  return (
                    <div 
                      key={lvl} 
                      className="grid gap-2 items-center"
                      style={{ gridTemplateColumns: `80px repeat(${currentSections.length}, minmax(0, 1fr))` }}
                    >
                      {/* Level Indicator Label */}
                      <div className="text-right pr-2 font-mono text-xs font-bold text-slate-600">
                        <span>N{lvlStr}</span>
                        <span className="text-[9px] font-normal text-slate-400 block">
                          {isTop ? 'Tope' : isBottom ? 'Piso' : ''}
                        </span>
                      </div>

                      {/* Cell Slots */}
                      {currentSections.map(s => {
                        const spaceNum = activeFaceInfo.isOdd ? (2 * s - 1) : (2 * s);
                        const spaceStr = String(spaceNum).padStart(2, '0');
                        const code = `${activeFaceInfo.aisle}-${spaceStr}-${lvlStr}`;

                        const bin = binsMap.get(code);
                        const isSelected = selectedBin?.id === code;
                        const isOccupied = bin && (bin.occupiedQty > 0 || Boolean(bin.occupiedSku));

                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              if (bin) {
                                onSelectBin(bin);
                              } else {
                                const meta = parseLocationId(code);
                                if (meta) onSelectBin(createDefaultBinFromMeta(meta));
                              }
                            }}
                            className={`h-14 p-1 rounded-xl border text-center transition flex flex-col justify-between items-center cursor-pointer select-none active:scale-95 ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300 shadow-md scale-102 z-10'
                                : isOccupied
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-300'
                                  : bin
                                    ? 'bg-emerald-50/70 hover:bg-emerald-100 text-emerald-950 border-emerald-200'
                                    : 'bg-slate-100/60 border-dashed border-slate-300 hover:border-slate-400'
                            }`}
                          >
                            <span className={`font-mono font-black text-[10px] tracking-tight truncate w-full ${
                              isSelected ? 'text-white' : 'text-slate-800'
                            }`}>
                              {code}
                            </span>

                            <div className="w-full truncate">
                              {isOccupied ? (
                                <span className={`text-[8.5px] font-mono font-bold block truncate px-1 rounded ${
                                  isSelected ? 'bg-blue-800 text-blue-100' : 'bg-amber-200/80 text-amber-900'
                                }`}>
                                  {bin.occupiedSku} ({bin.occupiedQty})
                                </span>
                              ) : bin ? (
                                <span className={`text-[8px] font-mono block ${
                                  isSelected ? 'text-blue-200' : 'text-emerald-700 font-medium'
                                }`}>
                                  Libre
                                </span>
                              ) : (
                                <span className="text-[8px] font-mono text-slate-400 italic">
                                  Sin Crear
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 italic text-center">
              Haga clic sobre cualquier celda para consultar su ficha técnica, existencias y capacidad.
            </p>
          </div>

          {/* Right Column: Location Inspector / Details (4 cols) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="font-bold text-xs uppercase text-slate-500 font-mono tracking-wider flex items-center gap-1.5">
                <Package className="h-4 w-4 text-blue-600" />
                <span>Detalle de Ubicación</span>
              </span>
              {selectedBin && (
                <button
                  onClick={() => onSelectBin(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer p-0.5"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {selectedBin && selectedMeta ? (
              <div className="space-y-4">
                {/* Location Code Badge */}
                <div className="bg-slate-900 text-white p-4 rounded-xl text-center">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                    Nomenclatura Oficial
                  </span>
                  <span className="text-2xl font-mono font-black tracking-tight text-white block mt-0.5 select-all">
                    {selectedBin.id}
                  </span>
                  <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedBin.status === 'Empty'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {selectedBin.status === 'Empty' ? 'Celda Libre / Disponible' : `Ocupada: ${selectedBin.occupiedSku}`}
                  </span>
                </div>

                {/* Physical Position Specs */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Pasillo</span>
                    <span className="font-bold text-slate-800">Pasillo {selectedMeta.aisle}</span>
                    <span className="text-[9px] text-slate-500 block">Lado {selectedMeta.aisleSide}</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Rack</span>
                    <span className="font-bold text-slate-800">{selectedMeta.rackName}</span>
                    <span className="text-[9px] text-slate-500 block">Cara {selectedMeta.face}</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Sección Física</span>
                    <span className="font-bold text-slate-800">Sección {selectedMeta.section}</span>
                    <span className="text-[9px] text-slate-500 block">Espacio {selectedMeta.space}</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Nivel Vertical</span>
                    <span className="font-bold text-slate-800">Nivel {selectedMeta.level}</span>
                    <span className="text-[9px] text-slate-500 block">
                      {selectedMeta.isBottomLevel ? 'Inferior (Piso)' : selectedMeta.isTopLevel ? 'Superior (Tope)' : 'Intermedio'}
                    </span>
                  </div>
                </div>

                {/* Real Inventory Status */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <span className="text-[9.5px] uppercase font-bold text-slate-500 tracking-wider block">
                    Inventario en Custodia:
                  </span>

                  {selectedBin.occupiedSku || selectedBin.occupiedQty > 0 ? (
                    <div className="space-y-1.5 bg-white p-3 rounded-lg border border-amber-300">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-amber-900 text-sm">{selectedBin.occupiedSku}</span>
                        <span className="font-mono font-bold text-slate-900 text-xs bg-amber-100 px-2 py-0.5 rounded">
                          {selectedBin.occupiedQty} uds
                        </span>
                      </div>
                      {selectedProduct && (
                        <div>
                          <p className="font-semibold text-slate-800 text-xs leading-tight">{selectedProduct.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Categoría: {selectedProduct.category}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-white rounded-lg border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Ubicación libre y disponible para operaciones de guardado (putaway).</span>
                    </div>
                  )}

                  <div className="pt-2 text-[10px] text-slate-400 flex justify-between">
                    <span>Capacidad máx: {selectedBin.maxWeight} kg</span>
                    <span>Volumen: {selectedBin.maxVolume} m³</span>
                  </div>
                </div>

                {/* Delete button if bin exists in DB */}
                {binsMap.has(selectedBin.id) && !isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleDeleteBin(selectedBin)}
                    className="w-full text-center py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    <span>Eliminar esta Ubicación del Almacén</span>
                  </button>
                )}

              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Grid className="h-8 w-8 mx-auto text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">Seleccione una celda en la cuadrícula</p>
                <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
                  Haga clic en cualquiera de las celdas para inspeccionar su código, pasillo, sección y nivel.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 3. PESTAÑA: PLANTA GENERAL SIMPLIFICADA (Top-Down con todos los Racks) */}
      {activeTab === 'plano' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Distribución General de Racks ({availableRacks.length} Racks en Almacén)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Haga clic sobre cualquier rack para visualizar su cuadrícula de elevación y gestionar celdas.
              </p>
            </div>

            <button
              onClick={() => {
                setAddStatusMsg(null);
                setNewRackNum(nextRackNum);
                setShowAddModal(true);
              }}
              className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-emerald-100"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Agregar Nuevo Rack</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {availableRacks.map(r => {
              const rackBins = bins.filter(b => parseInt(b.rack.replace(/\D/g, ''), 10) === r);
              const occupiedCount = rackBins.filter(b => b.occupiedQty > 0 || Boolean(b.occupiedSku)).length;
              const totalCount = rackBins.length || (r === 1 ? 49 : 98);
              const isSelected = activeRack === r;
              const hasTwoFaces = r !== 1;

              return (
                <div
                  key={r}
                  onClick={() => {
                    setActiveRack(r);
                    setActiveTab('racks');
                  }}
                  className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-500 shadow-xs ring-1 ring-blue-300'
                      : 'bg-slate-50 hover:bg-white border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-sm text-slate-900">RACK {r}</span>
                      <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {totalCount} celdas
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {hasTwoFaces ? 'Doble cara (Izq y Der)' : 'Cara única'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Ocupadas:</span>
                      <span className="font-bold text-slate-800">{occupiedCount}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Libres:</span>
                      <span className="font-bold text-emerald-600">{totalCount - occupiedCount}</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                      <div 
                        className="bg-blue-600 h-full rounded-full" 
                        style={{ width: `${Math.round((occupiedCount / (totalCount || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full text-center py-1.5 rounded-lg bg-white border border-slate-200 text-blue-600 font-bold text-xs hover:bg-blue-50 transition"
                  >
                    Ver Celdas →
                  </button>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-3">
            <span>
              <strong>Pasillo F:</strong> Identifica el acceso exterior a la cara derecha del Rack 6 (junto a maquinaria de apoyo). Contiene 49 celdas únicamente impares.
            </span>
          </div>
        </div>
      )}

      {/* 4. PESTAÑA: LISTADO FILTRABLE */}
      {activeTab === 'lista' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Catálogo de Ubicaciones ({filteredList.length} registros)
              </h3>
              <p className="text-xs text-slate-400">Busque cualquier código o SKU para localizarlo.</p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar código (ej. A-01-01, G-01)..."
                className="w-full pl-9 pr-3 py-1.5 text-xs font-mono border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-slate-50"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[460px]">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead className="bg-slate-50 sticky top-0 text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Pasillo</th>
                  <th className="py-2.5 px-3">Rack</th>
                  <th className="py-2.5 px-3">Cara</th>
                  <th className="py-2.5 px-3">Sección</th>
                  <th className="py-2.5 px-3">Nivel</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.slice(0, 100).map(loc => {
                  const bin = binsMap.get(loc.id);
                  const isOccupied = bin && (bin.occupiedQty > 0 || Boolean(bin.occupiedSku));
                  const rackNum = parseInt(loc.rackName.replace(/\D/g, ''), 10) || 1;

                  return (
                    <tr key={loc.id} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-3 font-black text-slate-900">{loc.id}</td>
                      <td className="py-2 px-3 text-slate-700">Pasillo {loc.aisle}</td>
                      <td className="py-2 px-3 text-slate-700">{loc.rackName}</td>
                      <td className="py-2 px-3 text-slate-600">Cara {loc.face}</td>
                      <td className="py-2 px-3 text-slate-600">Secc {loc.section} (Esp {loc.space})</td>
                      <td className="py-2 px-3 text-slate-600">Nivel {loc.level}</td>
                      <td className="py-2 px-3">
                        {isOccupied ? (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                            {bin.occupiedSku} ({bin.occupiedQty}u)
                          </span>
                        ) : bin ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                            Libre
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No Creada</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => {
                            setActiveRack(rackNum);
                            setActiveFace(loc.face as any);
                            if (bin) onSelectBin(bin);
                            else {
                              const meta = parseLocationId(loc.id);
                              if (meta) onSelectBin(createDefaultBinFromMeta(meta));
                            }
                            setActiveTab('racks');
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded text-[10px] font-bold cursor-pointer"
                        >
                          Ver en Estantería
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredList.length > 100 && (
            <p className="text-[11px] text-slate-400 text-right">
              Mostrando las primeras 100 de {filteredList.length} ubicaciones encontradas.
            </p>
          )}
        </div>
      )}

      {/* 4. PESTAÑA: MÉTRICAS Y ANALÍTICAS CONECTADAS */}
      {activeTab === 'metricas' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Header de Métricas */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600">
                  <BarChart3 className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Métricas de Infraestructura y Ocupación del Almacén
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Información analítica calculada en tiempo real sobre las <strong>{bins.length} celdas</strong> del almacén, integrando la estructura física oficial, racks adicionales e inventario.
              </p>
            </div>

            {onNavigateToDashboard && (
              <button
                onClick={onNavigateToDashboard}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-95 shrink-0"
              >
                <TrendingUp className="h-4 w-4" />
                <span>Abrir Dashboard General WMS</span>
                <ExternalLink className="h-3.5 w-3.5 ml-0.5" />
              </button>
            )}
          </div>

          {/* 4 Macro Tarjetas de Métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-xs space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Capacidad Total Celdas
                </span>
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Grid className="h-4 w-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-slate-900">{bins.length}</span>
                <span className="text-xs font-medium text-slate-500">celdas físicas</span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className="text-slate-500 font-mono">
                  {stats.standardExistingCount} / 539 estándar
                </span>
                {stats.standardMissingCount > 0 ? (
                  <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
                    {stats.standardMissingCount} faltan
                  </span>
                ) : (
                  <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                    ✓ Completa
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-xs space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Tasa de Ocupación
                </span>
                <span className={`p-1.5 rounded-lg ${
                  stats.totalOccupancyPercent >= 90 ? 'bg-rose-50 text-rose-600' : stats.totalOccupancyPercent >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  <PieChart className="h-4 w-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-slate-900">{stats.totalOccupancyPercent}%</span>
                <span className="text-xs font-medium text-slate-500">ocupado</span>
              </div>
              <div className="space-y-1 pt-1">
                <div className="w-full bg-slate-150 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      stats.totalOccupancyPercent >= 90 ? 'bg-rose-500' : stats.totalOccupancyPercent >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${stats.totalOccupancyPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>{stats.totalOccupiedCount} ocupadas</span>
                  <span>{stats.totalEmptyCount} libres</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-xs space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Resistencia de Carga
                </span>
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Layers className="h-4 w-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-slate-900">
                  {(stats.totalWeightCapacityKg / 1000).toFixed(1)}
                </span>
                <span className="text-xs font-medium text-slate-500">Toneladas</span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                <span>Promedio por celda:</span>
                <span className="font-mono font-bold text-slate-700">
                  {Math.round(stats.totalWeightCapacityKg / (bins.length || 1))} kg
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-xs space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Inventario y SKUs
                </span>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <Package className="h-4 w-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-slate-900">{stats.uniqueSkusCount}</span>
                <span className="text-xs font-medium text-slate-500">SKUs distintos</span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                <span>Unidades almacenadas:</span>
                <span className="font-mono font-bold text-emerald-700">
                  {stats.totalItemsQuantity} uds
                </span>
              </div>
            </div>
          </div>

          {/* Sección 1: Desglose por Rack Físico */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Grid className="h-4 w-4 text-blue-600" />
                  <span>Utilización y Carga por Rack Físico ({availableRacks.length} Racks)</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Haga clic en cualquier rack para inspeccionar su cuadrícula de 7 secciones × 7 niveles en el mapa.
                </p>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Racks 1 al 6 estándar {availableRacks.length > 6 ? `+ ${availableRacks.length - 6} dados de alta` : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
              {availableRacks.map(r => {
                const rStats = stats.rackStats[r];
                const total = rStats?.total || 0;
                const occupied = rStats?.occupied || 0;
                const pct = rStats?.occupancyPercent || 0;
                const faces = Object.keys(rStats?.faces || {});

                return (
                  <div
                    key={r}
                    onClick={() => {
                      setActiveRack(r);
                      if (r === 1) setActiveFace('Derecha');
                      setActiveTab('racks');
                    }}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-3 shadow-2xs hover:shadow-md group ${
                      r === activeRack 
                        ? 'bg-blue-50/50 border-blue-400 ring-2 ring-blue-200' 
                        : 'bg-slate-50/70 hover:bg-white border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-black text-sm text-slate-900 group-hover:text-blue-600 transition">
                          RACK {r}
                        </span>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          pct >= 90 ? 'bg-rose-100 text-rose-800' : pct >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {pct}%
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                        {occupied} de {total} celdas
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        {r === 1 ? '1 cara (Derecha)' : `${faces.length} caras (${faces.join(' / ')})`}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 90 ? 'bg-rose-500' : pct >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-bold text-blue-600 group-hover:underline flex items-center justify-between">
                        <span>Inspeccionar</span>
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sección 2: Balance por Pasillo y Ergonomía por Nivel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Pasillos */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-amber-600" />
                    <span>Balance de Carga por Pasillo</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Pasillos A-E entre racks enfrentados; Pasillo F acceso exterior / maquinaria.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {Object.keys(stats.aisleStats).length} Pasillos
                </span>
              </div>

              <div className="space-y-2.5">
                {Object.entries(stats.aisleStats)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([aisle, aStats]: [string, any]) => (
                    <div key={aisle} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                            PASILLO {aisle}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {aisle === 'F' ? 'Maquinaria de apoyo exterior' : 'Estanterías enfrentadas'}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-slate-800 text-[11px]">
                          {aStats.occupied} / {aStats.total} celdas ({aStats.occupancyPercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            aStats.occupancyPercent >= 90 ? 'bg-rose-500' : aStats.occupancyPercent >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${aStats.occupancyPercent}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Ergonomía por Nivel Vertical */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-600" />
                    <span>Distribución Ergonomica por Nivel Vertical</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Nivel 07 (superior) a Nivel 01 (suelo) para optimización de slotting y fatiga.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-slate-400">7 Niveles</span>
              </div>

              <div className="space-y-2">
                {Object.entries(stats.levelStats)
                  .sort(([a], [b]) => Number(b) - Number(a))
                  .map(([lvl, lStats]: [string, any]) => {
                    const isTop = lvl === '07' || lvl === '06';
                    const isMid = lvl === '05' || lvl === '04' || lvl === '03';
                    const isLow = lvl === '02' || lvl === '01';

                    return (
                      <div key={lvl} className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded text-[10px]">
                            L{lvl}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isLow ? 'bg-emerald-100 text-emerald-800' : isMid ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {isLow ? 'Suelo / Acceso Rápido' : isMid ? 'Zona Media Estándar' : 'Zona Alta / Montacargas'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${lStats.occupancyPercent}%` }}
                            />
                          </div>
                          <span className="font-mono text-slate-600 text-[10px]">
                            <strong className="text-slate-900">{lStats.occupied}</strong>/{lStats.total} ({lStats.occupancyPercent}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Sección 3: Inventario Almacenado Conectado */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Package className="h-4 w-4 text-indigo-600" />
                  <span>Existencias Reales Asociadas a Celdas de Almacén</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  SKUs alojados físicamente en las celdas mapeadas.
                </p>
              </div>
              <span className="text-[10px] font-mono text-slate-500 font-bold">
                {bins.filter(b => b.occupiedSku || b.occupiedQty > 0).length} celdas con stock
              </span>
            </div>

            {bins.filter(b => b.occupiedSku || b.occupiedQty > 0).length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                <Boxes className="h-8 w-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700">No hay mercancía asignada en celdas actualmente</p>
                <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                  Las celdas de almacenamiento se llenarán y sus métricas de ocupación se actualizarán automáticamente cuando realice ingresos de mercancía en el módulo de Recepción (Putaway).
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Ubicación</th>
                      <th className="py-2.5 px-3">Pasillo</th>
                      <th className="py-2.5 px-3">Rack & Cara</th>
                      <th className="py-2.5 px-3">SKU Almacenado</th>
                      <th className="py-2.5 px-3">Producto</th>
                      <th className="py-2.5 px-3 text-right">Cantidad</th>
                      <th className="py-2.5 px-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bins
                      .filter(b => b.occupiedSku || b.occupiedQty > 0)
                      .map(b => {
                        const item = inventoryMap.get(b.occupiedSku || '');
                        const parsedR = parseInt(b.rack?.replace(/\D/g, '') || '1', 10);

                        return (
                          <tr key={b.id} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3 font-mono font-black text-slate-900">{b.id}</td>
                            <td className="py-2.5 px-3 text-slate-700 font-semibold">Pasillo {b.aisle}</td>
                            <td className="py-2.5 px-3 text-slate-600">Rack {b.rack} • Cara {b.shelf}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{b.occupiedSku}</td>
                            <td className="py-2.5 px-3 text-slate-700 font-medium">{item?.name || 'Producto Registrado'}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-slate-800">
                              {b.occupiedQty} uds
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => {
                                  setActiveRack(parsedR);
                                  if (b.shelf.includes('Izquierda')) setActiveFace('Izquierda');
                                  else setActiveFace('Derecha');
                                  setActiveTab('racks');
                                  onSelectBin(b);
                                }}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-[10px] font-bold transition cursor-pointer"
                              >
                                Ver Celda →
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. MODAL: DAR DE ALTA RACKS O ESPACIOS NUEVOS */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-xl border border-slate-150 space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-150 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Plus className="h-5 w-5 text-emerald-600" />
                  <span>Dar de Alta en Almacén</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Habilite nuevos racks completos o añada espacios físicos individuales reflejados al instante en el mapa.
                </p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                disabled={isAdding}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mode Selector Tabs: Rack Completo vs Espacio Individual */}
            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setAddMode('rack')}
                className={`flex-1 py-2 rounded-lg transition cursor-pointer text-center ${
                  addMode === 'rack' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🏢 Nuevo Rack Completo
              </button>
              <button
                type="button"
                onClick={() => setAddMode('space')}
                className={`flex-1 py-2 rounded-lg transition cursor-pointer text-center ${
                  addMode === 'space' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📍 Espacio o Celda Específica
              </button>
            </div>

            <form onSubmit={handleCreateRackOrSpace} className="space-y-4">
              
              {/* OPCION A: NUEVO RACK */}
              {addMode === 'rack' && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                        Número de Rack
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={newRackNum}
                        onChange={(e) => setNewRackNum(Number(e.target.value))}
                        className="w-full p-2.5 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-slate-50"
                        required
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Sugerido: Rack {nextRackNum}</span>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                        Letra de Pasillo
                      </label>
                      <input
                        type="text"
                        maxLength={3}
                        value={newRackAisle}
                        onChange={(e) => setNewRackAisle(e.target.value.toUpperCase())}
                        placeholder="ej. G, H"
                        className="w-full p-2.5 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-slate-50 uppercase"
                        required
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Pasillo donde se ubicará</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                      Configuración de Caras
                    </label>
                    <select
                      value={newRackFaces}
                      onChange={(e) => setNewRackFaces(e.target.value as any)}
                      className="w-full p-2.5 text-xs font-semibold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-white"
                    >
                      <option value="Doble">Doble Cara (Izquierda y Derecha) — Recomendado</option>
                      <option value="Derecha">Cara Única (Derecha)</option>
                      <option value="Izquierda">Cara Única (Izquierda)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                        Secciones de Largo
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="14"
                        value={newRackSections}
                        onChange={(e) => setNewRackSections(Number(e.target.value))}
                        className="w-full p-2.5 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-slate-50"
                        required
                      />
                      <span className="text-[10px] text-slate-400 block mt-0.5">Estándar: 7</span>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                        Niveles de Alto
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={newRackLevels}
                        onChange={(e) => setNewRackLevels(Number(e.target.value))}
                        className="w-full p-2.5 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-slate-50"
                        required
                      />
                      <span className="text-[10px] text-slate-400 block mt-0.5">Estándar: 7</span>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                        Capacidad (kg)
                      </label>
                      <input
                        type="number"
                        min="50"
                        max="2000"
                        value={newRackWeight}
                        onChange={(e) => setNewRackWeight(Number(e.target.value))}
                        className="w-full p-2.5 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-slate-50"
                        required
                      />
                      <span className="text-[10px] text-slate-400 block mt-0.5">Por celda</span>
                    </div>
                  </div>

                  {/* Summary preview of generated cells */}
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                    <div>
                      <span className="font-bold block">Resumen de Generación:</span>
                      <span className="text-[11px] text-emerald-800">
                        Se crearán <strong>{(newRackFaces === 'Doble' ? 2 : 1) * newRackSections * newRackLevels}</strong> nuevas ubicaciones en el Pasillo {newRackAisle}.
                      </span>
                    </div>
                    <span className="font-mono text-emerald-700 bg-white px-2 py-1 rounded border border-emerald-200 font-bold text-[10px]">
                      {newRackAisle}-01-01 a ...
                    </span>
                  </div>
                </div>
              )}

              {/* OPCION B: ESPACIO O CELDA ESPECIFICA */}
              {addMode === 'space' && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                        Pasillo
                      </label>
                      <input
                        type="text"
                        maxLength={3}
                        value={newSpaceAisle}
                        onChange={(e) => setNewSpaceAisle(e.target.value.toUpperCase())}
                        placeholder="ej. A"
                        className="w-full p-2.5 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-slate-50 uppercase"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                        Rack Asociado
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={newSpaceRack}
                        onChange={(e) => setNewSpaceRack(Number(e.target.value))}
                        className="w-full p-2.5 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-slate-50"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                        Cara de Rack
                      </label>
                      <select
                        value={newSpaceFace}
                        onChange={(e) => setNewSpaceFace(e.target.value as any)}
                        className="w-full p-2.5 text-xs font-semibold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-white"
                      >
                        <option value="Derecha">Cara Derecha</option>
                        <option value="Izquierda">Cara Izquierda</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                        Número de Espacio
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={newSpaceNum}
                        onChange={(e) => setNewSpaceNum(Number(e.target.value))}
                        placeholder="ej. 15"
                        className="w-full p-2.5 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-slate-50"
                        required
                      />
                      <span className="text-[10px] text-slate-400 block mt-0.5">Dos dígitos (ej. 15)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                        Niveles Verticales
                      </label>
                      <select
                        value={newSpaceLevels}
                        onChange={(e) => setNewSpaceLevels(e.target.value as any)}
                        className="w-full p-2.5 text-xs font-semibold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-white"
                      >
                        <option value="ALL">Todos los Niveles (01 al 07)</option>
                        <option value="SINGLE">Solo Nivel Específico</option>
                      </select>
                    </div>

                    {newSpaceLevels === 'SINGLE' ? (
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                          Nivel a Crear
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={newSpaceSingleLevel}
                          onChange={(e) => setNewSpaceSingleLevel(Number(e.target.value))}
                          className="w-full p-2.5 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-slate-50"
                          required
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                          Capacidad Máxima (kg)
                        </label>
                        <input
                          type="number"
                          min="50"
                          max="2000"
                          value={newSpaceWeight}
                          onChange={(e) => setNewSpaceWeight(Number(e.target.value))}
                          className="w-full p-2.5 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-slate-50"
                        />
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
                    <span>
                      Código generado: <strong className="font-mono text-blue-800">{newSpaceAisle}-{String(newSpaceNum).padStart(2, '0')}-{newSpaceLevels === 'ALL' ? '01..07' : String(newSpaceSingleLevel).padStart(2, '0')}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Status Message */}
              {addStatusMsg && (
                <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  addStatusMsg.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {addStatusMsg.type === 'ok' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  )}
                  <span>{addStatusMsg.text}</span>
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isAdding}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isAdding || isReadOnly}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white cursor-pointer shadow-xs flex items-center gap-2 active:scale-95"
                >
                  {isAdding ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      <span>{addMode === 'rack' ? 'Crear Rack en Almacén' : 'Crear Espacio(s)'}</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* 6. MODAL: SINCRONIZAR LAS 539 UBICACIONES OFICIALES */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-slate-150 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Sincronizar Estructura Oficial (539 Ubicaciones)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Genera o completa las 539 ubicaciones estándar oficiales en la base de datos.
                </p>
              </div>
              <button onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Meta Oficial</span>
                <span className="font-mono font-black text-slate-800 text-sm mt-0.5 block">539 celdas</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Existentes</span>
                <span className="font-mono font-black text-blue-600 text-sm mt-0.5 block">{stats.standardExistingCount}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Faltantes</span>
                <span className="font-mono font-black text-emerald-600 text-sm mt-0.5 block">+{stats.standardMissingCount}</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                Las existencias y asignaciones de stock actuales <strong>se preservan intactas</strong> sin modificaciones.
              </span>
            </div>

            {generateError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{generateError}</span>
              </div>
            )}

            {generateSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{generateSuccess}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                disabled={isGenerating}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmGeneration}
                disabled={isGenerating || isReadOnly}
                className="px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Confirmar y Guardar 539</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
