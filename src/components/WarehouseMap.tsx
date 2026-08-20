import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bin } from '../types';
import { MapPin, Info, Check, ShieldAlert, Settings, Plus, Trash2, Layers, PlusCircle } from 'lucide-react';

interface WarehouseMapProps {
  bins: Bin[];
  onSelectBin: (bin: Bin | null) => void;
  selectedBin: Bin | null;
  activePath?: string[]; // Bin IDs in order of visit
  onUpdateBins?: (newBins: Bin[], action: string, details: string) => Promise<void>;
}

export const WarehouseMap: React.FC<WarehouseMapProps> = ({
  bins,
  onSelectBin,
  selectedBin,
  activePath = [],
  onUpdateBins
}) => {
  const [hoveredBin, setHoveredBin] = useState<Bin | null>(null);

  // States for warehouse configuration panel
  const [showConfig, setShowConfig] = useState(false);
  const [bulkAisles, setBulkAisles] = useState('');
  const [bulkRacks, setBulkRacks] = useState('');
  const [bulkShelves, setBulkShelves] = useState('S1,S2');
  const [bulkLevels, setBulkLevels] = useState('L1,L2,L3');
  const [deleteAisle, setDeleteAisle] = useState('');
  const [deleteRack, setDeleteRack] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Dynamically compute aisles, racks, shelves, and levels from existing bins
  const specialAreaIds = ['Area de Entrada', 'Area de Salida', 'Area de Picking'];
  const aisles = Array.from(new Set(bins.filter(b => !specialAreaIds.includes(b.id)).map(b => b.aisle))).sort();
  const racks = Array.from(new Set(bins.filter(b => !specialAreaIds.includes(b.id)).map(b => b.rack))).sort();
  const shelves = Array.from(new Set(bins.filter(b => !specialAreaIds.includes(b.id)).map(b => b.shelf))).sort();
  const levels = Array.from(new Set(bins.filter(b => !specialAreaIds.includes(b.id)).map(b => b.level))).sort((a, b) => (a as string).localeCompare(b as string, undefined, { numeric: true }));

  // Map aisle/rack/shelf physical coordinates for pick-path visualization
  const getBinCoords = (binId: string): { x: number; y: number } | null => {
    if (binId === 'Area de Entrada') return { x: 65, y: 175 };
    
    const totalWidth = 320 + aisles.length * 160;
    if (binId === 'Area de Picking') return { x: totalWidth - 65, y: 120 };
    if (binId === 'Area de Salida') return { x: totalWidth - 65, y: 235 };

    const parts = binId.split('-');
    if (parts.length < 3) return null;
    const aisle = parts[0];
    const rack = parts[1];
    const shelf = parts[2];

    const aisleIdx = aisles.indexOf(aisle);
    const rackIdx = racks.indexOf(rack);

    if (aisleIdx === -1 || rackIdx === -1) return null;

    // Shift standard aisles to the right by 50px to make room for Entrada
    const baseX = 170 + aisleIdx * 160;
    const baseY = 90 + rackIdx * 140;

    // Adjust for shelf
    const shelfOffset = shelf === 'S1' ? -25 : 25;
    
    return {
      x: baseX + shelfOffset,
      y: baseY + 50
    };
  };

  // Build SVG path data for optimized picking path
  const getPathD = (): string => {
    if (activePath.length < 2) return '';
    let d = '';
    activePath.forEach((binId, idx) => {
      const coord = getBinCoords(binId);
      if (coord) {
        if (idx === 0) d += `M ${coord.x} ${coord.y}`;
        else d += ` L ${coord.x} ${coord.y}`;
      }
    });
    return d;
  };

  // Bulk location generator
  const handleBulkGenerate = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!bulkAisles.trim()) {
      setErrorMsg('Debe especificar al menos un pasillo (ej. E).');
      return;
    }
    if (!bulkRacks.trim()) {
      setErrorMsg('Debe especificar al menos un espacio/rack (ej. 01,02).');
      return;
    }
    if (!bulkShelves.trim()) {
      setErrorMsg('Debe especificar al menos una cara/shelf (ej. S1,S2).');
      return;
    }
    if (!bulkLevels.trim()) {
      setErrorMsg('Debe especificar al menos un nivel (ej. L1,L2,L3).');
      return;
    }

    const targetAisles = bulkAisles.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const targetRacks = bulkRacks.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const targetShelves = bulkShelves.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const targetLevels = bulkLevels.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    const invalidAisle = targetAisles.find(a => !/^[A-Z0-9]+$/.test(a));
    if (invalidAisle) {
      setErrorMsg(`Nombre de pasillo inválido: "${invalidAisle}". Solo se permiten letras y números.`);
      return;
    }

    const invalidRack = targetRacks.find(r => !/^[A-Z0-9]+$/.test(r));
    if (invalidRack) {
      setErrorMsg(`Nombre de espacio/rack inválido: "${invalidRack}". Solo se permiten letras y números.`);
      return;
    }

    const invalidShelf = targetShelves.find(s => !/^[A-Z0-9]+$/.test(s));
    if (invalidShelf) {
      setErrorMsg(`Nombre de cara/shelf inválido: "${invalidShelf}". Solo se permiten letras y números.`);
      return;
    }

    const invalidLevel = targetLevels.find(l => !/^[A-Z0-9]+$/.test(l));
    if (invalidLevel) {
      setErrorMsg(`Nombre de nivel inválido: "${invalidLevel}". Solo se permiten letras y números.`);
      return;
    }

    const newBinsList = [...bins];
    let createdCount = 0;

    for (const aisle of targetAisles) {
      for (const rack of targetRacks) {
        for (const shelf of targetShelves) {
          for (const level of targetLevels) {
            const id = `${aisle}-${rack}-${shelf}-${level}`;
            if (!newBinsList.some(b => b.id === id)) {
              let maxW = 500;
              if (level === 'L3') maxW = 100;
              if (level === 'L1') maxW = 1000;

              newBinsList.push({
                id,
                aisle,
                rack,
                shelf,
                level,
                maxWeight: maxW,
                maxVolume: 50,
                occupiedSku: '',
                occupiedQty: 0,
                status: 'Empty'
              });
              createdCount++;
            }
          }
        }
      }
    }

    if (createdCount === 0) {
      setErrorMsg('Todas las celdas especificadas ya existen en el sistema.');
      return;
    }

    if (onUpdateBins) {
      await onUpdateBins(
        newBinsList,
        'Habilitar Celdas en Lote',
        `Se habilitaron ${createdCount} nuevas ubicaciones de inventario en el almacén.`
      );
    }
    setSuccessMsg(`¡Éxito! Se habilitaron ${createdCount} nuevas celdas de almacenamiento.`);
    setBulkAisles('');
    setBulkRacks('');
  };

  // Delete single bin
  const handleDeleteBin = async (binToDelete: Bin) => {
    if (binToDelete.occupiedQty > 0 || binToDelete.occupiedSku) {
      const confirmForce = window.confirm(
        `ADVERTENCIA: La celda ${binToDelete.id} tiene stock activo (${binToDelete.occupiedSku}: ${binToDelete.occupiedQty} unidades). ¿Está seguro de que desea eliminarla? Se perderá el registro de stock de esta celda.`
      );
      if (!confirmForce) return;
    } else {
      const confirmDel = window.confirm(`¿Está seguro de que desea eliminar permanentemente la ubicación ${binToDelete.id}?`);
      if (!confirmDel) return;
    }

    const newBinsList = bins.filter(b => b.id !== binToDelete.id);
    if (onUpdateBins) {
      await onUpdateBins(
        newBinsList,
        'Eliminar Ubicación',
        `Se eliminó permanentemente la celda de almacenamiento ${binToDelete.id}.`
      );
    }
    onSelectBin(null);
  };

  // Delete entire sector (aisle or rack or combinations)
  const handleDeleteSector = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!deleteAisle && !deleteRack) {
      setErrorMsg('Debe especificar un pasillo o espacio/rack a eliminar.');
      return;
    }

    let filterFn = (b: Bin) => true;
    let sectorDesc = '';

    if (deleteAisle && deleteRack) {
      filterFn = (b: Bin) => b.aisle === deleteAisle.toUpperCase() && b.rack === deleteRack;
      sectorDesc = `Pasillo ${deleteAisle.toUpperCase()} - Espacio/Rack ${deleteRack}`;
    } else if (deleteAisle) {
      filterFn = (b: Bin) => b.aisle === deleteAisle.toUpperCase();
      sectorDesc = `Pasillo ${deleteAisle.toUpperCase()} Completo`;
    } else if (deleteRack) {
      filterFn = (b: Bin) => b.rack === deleteRack;
      sectorDesc = `Espacio/Rack ${deleteRack} Completo`;
    }

    const binsToRemove = bins.filter(filterFn);
    if (binsToRemove.length === 0) {
      setErrorMsg('No se encontraron celdas de almacenamiento en el sector especificado.');
      return;
    }

    const hasOccupied = binsToRemove.some(b => b.occupiedQty > 0 || b.occupiedSku);
    const confirmMsg = hasOccupied 
      ? `ADVERTENCIA: El sector "${sectorDesc}" contiene celdas con stock activo. ¿Está seguro de eliminar permanentemente estas ${binsToRemove.length} ubicaciones? Se perderán los registros de stock asociados.`
      : `¿Está seguro de eliminar permanentemente todas las celdas (${binsToRemove.length}) en el sector "${sectorDesc}"?`;

    if (!window.confirm(confirmMsg)) return;

    const newBinsList = bins.filter(b => !binsToRemove.includes(b));
    if (onUpdateBins) {
      await onUpdateBins(
        newBinsList,
        'Eliminar Sector de Almacén',
        `Se eliminaron permanentemente todas las celdas (${binsToRemove.length}) del sector: ${sectorDesc}.`
      );
    }

    setSuccessMsg(`Se eliminaron permanentemente ${binsToRemove.length} celdas de almacenamiento.`);
    setDeleteAisle('');
    setDeleteRack('');
    onSelectBin(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Full': return 'bg-rose-500 border-rose-600';
      case 'Partial': return 'bg-amber-400 border-amber-500';
      case 'Empty':
      default: return 'bg-emerald-500 border-emerald-600';
    }
  };

  const getStatusLightColor = (status: string) => {
    switch (status) {
      case 'Full': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Partial': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Empty':
      default: return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-50 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-500" />
            Mapa de Operación Visual y Diseño
          </h2>
          <p className="text-xs text-slate-400">
            Mapa de celdas en tiempo real. Haga clic en cualquier celda para inspeccionar, o use el botón para diseñar el almacén.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          {/* Status Legend */}
          <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-emerald-500 border border-emerald-600 shadow-xs" />
              <span>Vacío / Libre</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-amber-400 border border-amber-500 shadow-xs" />
              <span>Parcial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose-500 border border-rose-600 shadow-xs" />
              <span>Asignado</span>
            </div>
          </div>

          {/* Config Trigger */}
          <button
            onClick={() => {
              setShowConfig(!showConfig);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer select-none border ${
              showConfig
                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 active:scale-95'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 active:scale-95'
            }`}
          >
            <Settings className={`h-4 w-4 ${showConfig ? 'animate-spin' : ''}`} />
            <span>{showConfig ? 'Ocultar Panel' : 'Configurar Almacén (Layout)'}</span>
          </button>
        </div>
      </div>

      {/* Dynamic Configuration Panel */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-5 bg-slate-50 rounded-2xl border border-slate-200 text-slate-700 overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-4 border-b border-slate-200/60 pb-2">
              <Layers className="h-4.5 w-4.5 text-indigo-500" />
              <h3 className="font-bold text-slate-800 text-sm">Configuración de Pasillos, Espacios y Niveles</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Box 1: Enable / Create Locations */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                    <PlusCircle className="h-4 w-4 text-emerald-500" />
                    Habilitar Celdas en Lote
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Ingrese los identificadores que desea crear (separados por comas para múltiples). El sistema generará todas las combinaciones que no existan aún.
                  </p>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="flex flex-col">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pasillo(s) (ej. E, F)</label>
                      <input
                        type="text"
                        placeholder="E"
                        value={bulkAisles}
                        onChange={(e) => setBulkAisles(e.target.value)}
                        className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Espacio/Rack(s) (ej. 01,02)</label>
                      <input
                        type="text"
                        placeholder="01, 02"
                        value={bulkRacks}
                        onChange={(e) => setBulkRacks(e.target.value)}
                        className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="flex flex-col">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cara/Shelf(s)</label>
                      <input
                        type="text"
                        placeholder="S1,S2"
                        value={bulkShelves}
                        onChange={(e) => setBulkShelves(e.target.value)}
                        className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nivel(es) (ej. L1,L2,L3)</label>
                      <input
                        type="text"
                        placeholder="L1,L2,L3"
                        value={bulkLevels}
                        onChange={(e) => setBulkLevels(e.target.value)}
                        className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBulkGenerate}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all text-white font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer mt-3"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Habilitar Ubicaciones
                </button>
              </div>

              {/* Box 2: Disable / Remove entire sector */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3.5">
                <div className="space-y-3.5">
                  <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                    <Trash2 className="h-4 w-4 text-rose-500" />
                    Eliminar Sector Completo
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Remueve permanentemente todas las celdas asociadas a un pasillo o a un espacio/rack completo. No se permite si están ocupadas a menos que confirme la acción.
                  </p>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="flex flex-col">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pasillo a Eliminar</label>
                      <input
                        type="text"
                        placeholder="ej. D"
                        value={deleteAisle}
                        onChange={(e) => setDeleteAisle(e.target.value)}
                        className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rack a Eliminar</label>
                      <input
                        type="text"
                        placeholder="ej. 02"
                        value={deleteRack}
                        onChange={(e) => setDeleteRack(e.target.value)}
                        className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDeleteSector}
                  className="w-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 active:scale-[0.98] transition-all font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer mt-3"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar Sector de Almacén
                </button>
              </div>
            </div>

            {/* Error / Success Feedback banner */}
            {(errorMsg || successMsg) && (
              <div className="mt-4">
                {errorMsg && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3.5 py-2.5">
                    <ShieldAlert className="h-4.5 w-4.5 text-rose-500 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                {successMsg && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-150 rounded-xl px-3.5 py-2.5">
                    <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full overflow-x-auto pb-2 scrollbar-thin">
        <div 
          className="relative aspect-[4/2.5] bg-slate-50/50 rounded-xl border border-slate-100 p-4 font-sans select-none"
          style={{ minWidth: `${Math.max(920, 320 + aisles.length * 160)}px` }}
        >
          
          {/* Layout Shipping / Receiving labels at the bottom */}
          {aisles.length > 0 && (
            <div className="absolute inset-x-0 bottom-3 flex justify-between px-32 text-[10px] font-mono tracking-wider text-slate-400 font-semibold uppercase">
              <div className="flex items-center gap-1 bg-white px-2 py-1 border border-slate-100 shadow-xs rounded-md">
                📥 Muelle de Entrada / Putaway
              </div>
              <div className="flex items-center gap-1 bg-white px-2 py-1 border border-slate-100 shadow-xs rounded-md">
                📤 Empaque y Despacho
              </div>
            </div>
          )}

          {/* Draw Picking Route Overlay on SVG */}
          {aisles.length > 0 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#6366f1" />
                </marker>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Active picking route line */}
              {activePath.length >= 2 && (
                <motion.path
                  d={getPathD()}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="3.5"
                  strokeDasharray="6 4"
                  markerEnd="url(#arrow)"
                  filter="url(#glow)"
                  initial={{ strokeDashoffset: 100 }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
                />
              )}

              {/* Render numbered order markers in-path */}
              {activePath.map((binId, idx) => {
                const coord = getBinCoords(binId);
                if (!coord) return null;
                return (
                  <g key={`marker-${binId}-${idx}`}>
                    <circle cx={coord.x} cy={coord.y} r="12" fill="#4f46e5" stroke="#ffffff" strokeWidth="2" shadow="sm" />
                    <text x={coord.x} y={coord.y + 3.5} fill="#ffffff" fontSize="9px" fontWeight="bold" textAnchor="middle">
                      {idx + 1}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {/* Floor layout matrix */}
          {bins.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
              <Layers className="h-10 w-10 text-slate-300 mb-2 animate-pulse" />
              <p className="text-xs font-bold">No hay ubicaciones configuradas</p>
              <p className="text-[10px] text-slate-400 text-center max-w-sm mt-1">
                Haga clic en el botón "Configurar Almacén (Layout)" arriba para habilitar pasillos, espacios y niveles.
              </p>
            </div>
          ) : (() => {
            const areaEntrada = bins.find(b => b.id === 'Area de Entrada') || {
              id: 'Area de Entrada', aisle: 'Virtual', rack: '', shelf: '', level: '', maxWeight: 10000, maxVolume: 1000, occupiedSku: '', occupiedQty: 0, status: 'Empty' as const
            };
            const areaSalida = bins.find(b => b.id === 'Area de Salida') || {
              id: 'Area de Salida', aisle: 'Virtual', rack: '', shelf: '', level: '', maxWeight: 10000, maxVolume: 1000, occupiedSku: '', occupiedQty: 0, status: 'Empty' as const
            };
            const areaPicking = bins.find(b => b.id === 'Area de Picking') || {
              id: 'Area de Picking', aisle: 'Virtual', rack: '', shelf: '', level: '', maxWeight: 10000, maxVolume: 1000, occupiedSku: '', occupiedQty: 0, status: 'Empty' as const
            };

            return (
              <div className="relative w-full h-full">
                
                {/* 1. AREA DE ENTRADA (Left Sidebar) */}
                <div className="absolute left-[15px] top-[80px] w-[100px] flex flex-col items-center">
                  <div className="text-[9px] font-bold tracking-wider font-mono px-2 py-0.5 rounded-md bg-rose-50 border border-rose-100 text-rose-600 mb-2 uppercase text-center w-full shadow-2xs">
                    📥 Entrada
                  </div>
                  <div
                    className={`relative w-full h-[180px] rounded-xl cursor-pointer flex flex-col justify-center items-center border border-dashed text-center p-2 transition-all duration-150 ${
                      areaEntrada.occupiedQty > 0 
                        ? 'bg-rose-50/50 border-rose-300 text-rose-900 hover:bg-rose-50' 
                        : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100/50 hover:border-slate-300'
                    } ${
                      selectedBin?.id === 'Area de Entrada' 
                        ? 'ring-2 ring-indigo-500 ring-offset-2 border-indigo-500 scale-102 shadow-sm' 
                        : ''
                    }`}
                    onClick={() => onSelectBin(areaEntrada)}
                    onMouseEnter={() => setHoveredBin(areaEntrada)}
                    onMouseLeave={() => setHoveredBin(null)}
                  >
                    <span className="text-[10px] font-extrabold block leading-tight text-slate-800 text-center truncate w-full px-1">Área de Entrada</span>
                    <span className="text-[8px] text-slate-400 font-medium block mt-0.5 font-mono text-center truncate w-full px-1">{areaEntrada.id}</span>
                    {areaEntrada.occupiedSku ? (
                      <div className="mt-2 bg-white/90 shadow-2xs p-1.5 rounded-lg border border-rose-100 w-full text-left leading-tight">
                        <span className="block text-[7px] font-mono font-bold text-slate-400">SKU</span>
                        <span className="block font-bold text-[9px] text-rose-700 truncate" title={areaEntrada.occupiedSku}>{areaEntrada.occupiedSku}</span>
                        <span className="block font-black text-rose-950 text-[10px] mt-0.5">{areaEntrada.occupiedQty} uds</span>
                      </div>
                    ) : (
                      <span className="text-[8px] text-slate-400 italic mt-4">Disponible</span>
                    )}
                  </div>
                </div>

                {/* 2. STANDARD AISLES (Centered Space) */}
                <div className="flex justify-around items-center pl-32 pr-32 h-full w-full">
                  {aisles.map((aisle) => (
                    <div key={aisle} className="flex flex-col items-center">
                      {/* Aisle label */}
                      <div className="text-[11px] font-bold tracking-wider font-mono px-2 py-0.5 rounded-sm bg-slate-200/60 border border-slate-300/40 text-slate-600 mb-3">
                        Pasillo {aisle}
                      </div>

                      {/* Racks Stack */}
                      <div className="flex flex-col gap-10">
                        {racks.map((rack) => (
                          <div key={rack} className="flex gap-4">
                            
                            {/* Shelving Double Face (Left S1, Right S2) */}
                            {shelves.map((shelf) => {
                              // Get levels inside this shelf (L1, L2, L3)
                              const shelfBinIds = levels.map(level => `${aisle}-${rack}-${shelf}-${level}`);
                              const shelfBins = bins.filter(b => shelfBinIds.includes(b.id));

                              return (
                                <div key={shelf} className="flex flex-col items-center bg-white p-1 rounded-lg border border-slate-200/70 shadow-xs w-16">
                                  <span className="text-[8px] font-bold font-mono text-slate-400 mb-1">
                                    {shelf}
                                  </span>

                                  {/* Levels Stack (L3 top, L2 mid, L1 bottom) */}
                                  <div className="flex flex-col-reverse gap-1.5 w-full">
                                    {levels.map((level) => {
                                      const binId = `${aisle}-${rack}-${shelf}-${level}`;
                                      const bin = bins.find(b => b.id === binId) || {
                                        id: binId,
                                        aisle,
                                        rack,
                                        shelf,
                                        level,
                                        maxWeight: 500,
                                        maxVolume: 50,
                                        occupiedSku: '',
                                        occupiedQty: 0,
                                        status: 'Empty' as const
                                      };

                                      const indexInPath = activePath.indexOf(binId);
                                      const isSelected = selectedBin?.id === binId;
                                      
                                      return (
                                        <div
                                          key={level}
                                          className={`relative hover:scale-105 active:scale-95 transition-all duration-150 h-8 rounded-md cursor-pointer flex flex-col justify-center items-center border border-dashed text-[8px] font-bold leading-none ${getStatusColor(bin.status)} ${
                                            isSelected 
                                              ? 'ring-2 ring-blue-500 ring-offset-1 scale-102 border-blue-600' 
                                              : 'border-white/25'
                                          }`}
                                          onClick={() => onSelectBin(bin)}
                                          onMouseEnter={() => setHoveredBin(bin)}
                                          onMouseLeave={() => setHoveredBin(null)}
                                        >
                                          {/* Container for level and SKU */}
                                          <div className="flex flex-col items-center justify-center w-full px-0.5 overflow-hidden">
                                            <span className="text-white text-[7px] font-medium tracking-tight truncate w-full text-center">
                                              {level}
                                            </span>
                                            {bin.occupiedSku && (
                                              <span className="bg-white/20 px-0.5 rounded-[2px] text-[5px] text-white overflow-hidden max-w-[95%] whitespace-nowrap block mt-0.5 truncate text-center">
                                                {bin.occupiedSku.substring(0, 4)}
                                              </span>
                                            )}
                                          </div>

                                          {/* Path order overlay badge if active and not marked by svg coordinate */}
                                          {indexInPath !== -1 && (
                                            <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 border border-white text-[7px] text-white shadow-sm font-bold z-10">
                                              {indexInPath + 1}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}

                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 3. AREA DE PICKING & AREA DE SALIDA (Right Sidebars) */}
                <div className="absolute right-[15px] top-[70px] w-[100px] flex flex-col gap-6">
                  {/* Area de Picking */}
                  <div className="flex flex-col items-center">
                    <div className="text-[9px] font-bold tracking-wider font-mono px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-600 mb-1.5 uppercase text-center w-full shadow-2xs">
                      📦 Picking
                    </div>
                    <div
                      className={`relative w-full h-[100px] rounded-xl cursor-pointer flex flex-col justify-center items-center border border-dashed text-center p-2 transition-all duration-150 ${
                        areaPicking.occupiedQty > 0 
                          ? 'bg-indigo-50/50 border-indigo-300 text-indigo-900 hover:bg-indigo-50' 
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100/50 hover:border-slate-300'
                      } ${
                        selectedBin?.id === 'Area de Picking' 
                          ? 'ring-2 ring-indigo-500 ring-offset-2 border-indigo-500 scale-102 shadow-sm' 
                          : ''
                      }`}
                      onClick={() => onSelectBin(areaPicking)}
                      onMouseEnter={() => setHoveredBin(areaPicking)}
                      onMouseLeave={() => setHoveredBin(null)}
                    >
                      <span className="text-[10px] font-extrabold block leading-tight text-slate-800 text-center truncate w-full px-1">Picking</span>
                      <span className="text-[8px] text-slate-400 font-medium block mt-0.5 font-mono text-center truncate w-full px-1">{areaPicking.id}</span>
                      {areaPicking.occupiedSku ? (
                        <div className="mt-1 bg-white/90 shadow-2xs p-1 rounded-lg border border-indigo-100 w-full text-left leading-tight">
                          <span className="block text-[6px] font-mono font-bold text-slate-400">SKU</span>
                          <span className="block font-bold text-[8px] text-indigo-700 truncate" title={areaPicking.occupiedSku}>{areaPicking.occupiedSku}</span>
                          <span className="block font-black text-indigo-950 text-[9px] mt-0.5">{areaPicking.occupiedQty} uds</span>
                        </div>
                      ) : (
                        <span className="text-[8px] text-slate-400 italic mt-2">Disponible</span>
                      )}
                    </div>
                  </div>

                  {/* Area de Salida */}
                  <div className="flex flex-col items-center">
                    <div className="text-[9px] font-bold tracking-wider font-mono px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-600 mb-1.5 uppercase text-center w-full shadow-2xs">
                      📤 Salida
                    </div>
                    <div
                      className={`relative w-full h-[100px] rounded-xl cursor-pointer flex flex-col justify-center items-center border border-dashed text-center p-2 transition-all duration-150 ${
                        areaSalida.occupiedQty > 0 
                          ? 'bg-emerald-50/50 border-emerald-300 text-emerald-900 hover:bg-emerald-50' 
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100/50 hover:border-slate-300'
                      } ${
                        selectedBin?.id === 'Area de Salida' 
                          ? 'ring-2 ring-indigo-500 ring-offset-2 border-indigo-500 scale-102 shadow-sm' 
                          : ''
                      }`}
                      onClick={() => onSelectBin(areaSalida)}
                      onMouseEnter={() => setHoveredBin(areaSalida)}
                      onMouseLeave={() => setHoveredBin(null)}
                    >
                      <span className="text-[10px] font-extrabold block leading-tight text-slate-800 text-center truncate w-full px-1">Despacho</span>
                      <span className="text-[8px] text-slate-400 font-medium block mt-0.5 font-mono text-center truncate w-full px-1">{areaSalida.id}</span>
                      {areaSalida.occupiedSku ? (
                        <div className="mt-1 bg-white/90 shadow-2xs p-1 rounded-lg border border-emerald-100 w-full text-left leading-tight">
                          <span className="block text-[6px] font-mono font-bold text-slate-400">SKU</span>
                          <span className="block font-bold text-[8px] text-emerald-700 truncate" title={areaSalida.occupiedSku}>{areaSalida.occupiedSku}</span>
                          <span className="block font-black text-emerald-950 text-[9px] mt-0.5">{areaSalida.occupiedQty} uds</span>
                        </div>
                      ) : (
                        <span className="text-[8px] text-slate-400 italic mt-2">Disponible</span>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            );
          })()}

          {/* Hover Information Overlay Popup */}
          <AnimatePresence>
            {hoveredBin && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute pointer-events-none top-2 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-xl shadow-md p-3 max-w-sm flex items-start gap-2.5 text-xs text-left"
              >
                <Info className="h-4.5 w-4.5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold font-mono tracking-wider flex items-center gap-1.5 select-all">
                    Celda ID: {hoveredBin.id}
                    <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold uppercase tracking-wider ${
                      hoveredBin.status === 'Empty' ? 'bg-emerald-500/20 text-emerald-300' :
                      hoveredBin.status === 'Partial' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {hoveredBin.status}
                    </span>
                  </div>
                  {hoveredBin.occupiedSku ? (
                    <div className="mt-1 font-mono text-slate-300 text-[10px]">
                      <div className="font-semibold text-white">SKU: {hoveredBin.occupiedSku}</div>
                      <div>Cantidad: {hoveredBin.occupiedQty} unidades</div>
                    </div>
                  ) : (
                    <div className="mt-1 text-slate-400 text-[10px]">Celda disponible</div>
                  )}
                  <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-[9px] text-slate-400 flex justify-between gap-4">
                    <span>Peso Máx: {hoveredBin.maxWeight} kg</span>
                    <span>Volumen: {hoveredBin.maxVolume} m³</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      {/* Selected Slot Detailed Panel */}
      <AnimatePresence>
        {selectedBin && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-5 items-stretch justify-between relative overflow-hidden"
          >
            <button
              onClick={() => onSelectBin(null)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 rounded-lg p-1 text-xs"
            >
              Cerrar ✕
            </button>

            <div className="flex gap-3">
              <div className={`p-3 rounded-lg shrink-0 flex items-center justify-center ${getStatusLightColor(selectedBin.status)} border h-12 w-12 font-mono font-bold text-center`}>
                {selectedBin.level}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5 font-mono text-base">
                  Nodo de Celda: {selectedBin.id}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Pasillo {selectedBin.aisle} • Rack/Espacio {selectedBin.rack} • Cara Doble S{selectedBin.shelf.replace('S', '')} • Elevación {selectedBin.level}
                </p>
                
                <div className="flex gap-4 mt-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">SKU ASIGNADO</span>
                    <span className="font-mono font-semibold text-slate-700">
                      {selectedBin.occupiedSku || '— VACÍO —'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">CANTIDAD</span>
                    <span className="font-mono font-semibold text-slate-700">
                      {selectedBin.occupiedQty || '0'} unidades
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">LÍMITE DE PESO</span>
                    <span className="font-mono font-semibold text-slate-700">
                      {selectedBin.maxWeight} kg máx.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end justify-end gap-2 shrink-0 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-slate-200/60 md:pl-6 leading-none">
              <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1 hidden md:block">
                Restricciones de Celda
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 text-xs py-0.5">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Compatible con carga pesada ({selectedBin.maxWeight}kg)</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 text-xs py-0.5 mb-2.5">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Esquema estándar de categorización</span>
              </div>
              
              <button
                onClick={() => handleDeleteBin(selectedBin)}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 hover:border-rose-300 rounded-lg px-2.5 py-1 text-[10px] font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 w-fit"
                title="Eliminar permanentemente esta celda de ubicación del almacén"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                <span>Eliminar Ubicación</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
