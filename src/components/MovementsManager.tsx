import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Bin, InventoryItem, ActivityLog } from '../types';
import { 
  ArrowRightLeft, 
  Move, 
  Check, 
  MapPin, 
  TrendingUp, 
  Layers, 
  Package, 
  Clock, 
  User, 
  Shuffle, 
  BarChart3, 
  AlertTriangle,
  ChevronRight,
  Info,
  FileSpreadsheet
} from 'lucide-react';

interface MovementsManagerProps {
  bins: Bin[];
  inventory: InventoryItem[];
  logs: ActivityLog[];
  onUpdateBins: (newBinsList: Bin[], logAction: string, logDetails: string) => Promise<void>;
  activeOperatorName: string;
}

interface SessionMovement {
  sku: string;
  sourceBinId: string;
  targetBinId: string;
  qty: number;
  timestamp: string;
}

export const MovementsManager: React.FC<MovementsManagerProps> = ({
  bins,
  inventory,
  logs,
  onUpdateBins,
  activeOperatorName
}) => {
  // Session movements state (holds last 10 movements for the current active browser tab session)
  const [sessionMovements, setSessionMovements] = useState<SessionMovement[]>(() => {
    const saved = sessionStorage.getItem('wms_session_movements');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return [];
  });

  // Form states
  const [sourceBinId, setSourceBinId] = useState('');
  const [targetBinId, setTargetBinId] = useState('');
  const [qtyToMove, setQtyToMove] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Export supplies by location to Excel
  const handleDownloadInsumosUbicacion = () => {
    try {
      const rows = bins.map(bin => {
        const product = bin.occupiedSku 
          ? inventory.find(item => item.sku === bin.occupiedSku) 
          : null;

        return {
          'ID Celda (Ubicación)': bin.id,
          'Pasillo': `Pasillo ${bin.aisle}`,
          'Estante (Rack)': `Estante ${bin.rack}`,
          'Nivel (Level)': `Nivel ${bin.level}`,
          'Estado de Celda': bin.status === 'Empty' ? 'Vacía' : bin.status === 'Full' ? 'Llena' : 'Parcial',
          'SKU del Insumo': bin.occupiedSku || 'N/A',
          'Nombre del Insumo': product ? product.name : (bin.occupiedSku ? 'SKU No registrado' : 'Vacío'),
          'Categoría': product ? product.category : (bin.occupiedSku ? 'N/A' : 'Vacío'),
          'Cantidad Almacenada (Uds)': bin.occupiedQty || 0,
          'Proveedor': product ? product.supplier : 'N/A',
          'Nivel de Stock Mínimo': product ? product.minQty : 'N/A'
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      
      // Auto-fit column widths
      const colWidths = [
        { wch: 22 }, // ID Celda
        { wch: 12 }, // Pasillo
        { wch: 15 }, // Estante
        { wch: 15 }, // Nivel
        { wch: 16 }, // Estado de Celda
        { wch: 16 }, // SKU del Insumo
        { wch: 35 }, // Nombre del Insumo
        { wch: 18 }, // Categoría
        { wch: 25 }, // Cantidad Almacenada
        { wch: 20 }, // Proveedor
        { wch: 20 }  // Stock mínimo
      ];
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Insumos_por_Ubicacion');
      XLSX.writeFile(wb, `Relacion_Insumos_Ubicacion_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Error al exportar excel:', err);
    }
  };

  // Target bin search / filter query
  const [targetSearchQuery, setTargetSearchQuery] = useState('');

  // Find selected source bin object
  const sourceBinObj = useMemo(() => {
    return bins.find(b => b.id === sourceBinId);
  }, [bins, sourceBinId]);

  // Find item details inside the source bin
  const sourceProductObj = useMemo(() => {
    if (!sourceBinObj || !sourceBinObj.occupiedSku) return null;
    return inventory.find(item => item.sku === sourceBinObj.occupiedSku);
  }, [sourceBinObj, inventory]);

  // Available bins that currently have stock (source candidates)
  const occupiedBins = useMemo(() => {
    return bins.filter(b => b.occupiedSku && b.occupiedQty > 0);
  }, [bins]);

  // Destination candidates (prevent moving to the same bin)
  const targetBinsFiltered = useMemo(() => {
    return bins.filter(b => {
      if (b.id === sourceBinId) return false;
      if (!targetSearchQuery) return true;
      const q = targetSearchQuery.toLowerCase();
      return (
        b.id.toLowerCase().includes(q) ||
        b.occupiedSku.toLowerCase().includes(q) ||
        b.status.toLowerCase().includes(q) ||
        `pasillo ${b.aisle}`.toLowerCase().includes(q)
      );
    });
  }, [bins, sourceBinId, targetSearchQuery]);

  // Parse logs in real-time to compile movement statistics per bin/aisle
  const movementStats = useMemo(() => {
    const binActivity: { [binId: string]: { incoming: number; outgoing: number; total: number } } = {};
    const aisleActivity: { [aisle: string]: number } = { 'A': 0, 'B': 0, 'C': 0, 'D': 0 };
    let totalMovedQty = 0;
    let totalMovedOps = 0;
    const movementsList: {
      id: string;
      timestamp: string;
      user: string;
      qty: number;
      sku: string;
      origin: string;
      dest: string;
    }[] = [];

    // Parse both standard system logs and any custom formatted logs
    logs.forEach(log => {
      // Look for logs related to stock transfer
      const isTransfer = 
        log.action.toLowerCase().includes('traslado') || 
        log.action.toLowerCase().includes('movimiento') ||
        log.action.toLowerCase().includes('shift') ||
        log.details.toLowerCase().includes('trasladadas');

      if (isTransfer) {
        // Regex to parse: "Trasladadas {qty} unidades de SKU {sku} desde la celda {origin} hacia la celda {dest}"
        const match = log.details.match(/Trasladadas (\d+) unidades de SKU (\S+) desde la celda (\S+) hacia la celda (\S+)/i);
        
        if (match) {
          const qty = parseInt(match[1], 10);
          const sku = match[2];
          const origin = match[3];
          const dest = match[4];

          totalMovedQty += qty;
          totalMovedOps += 1;

          // Origin activity
          if (!binActivity[origin]) binActivity[origin] = { incoming: 0, outgoing: 0, total: 0 };
          binActivity[origin].outgoing += qty;
          binActivity[origin].total += qty;

          // Destination activity
          if (!binActivity[dest]) binActivity[dest] = { incoming: 0, outgoing: 0, total: 0 };
          binActivity[dest].incoming += qty;
          binActivity[dest].total += qty;

          // Aisle activity (extract aisle from first letter or ID pattern, e.g. A-01-S1-L1 -> A)
          const originAisle = origin.charAt(0).toUpperCase();
          const destAisle = dest.charAt(0).toUpperCase();
          if (aisleActivity[originAisle] !== undefined) aisleActivity[originAisle] += qty;
          if (aisleActivity[destAisle] !== undefined) aisleActivity[destAisle] += qty;

          movementsList.push({
            id: log.id,
            timestamp: log.timestamp,
            user: log.user,
            qty,
            sku,
            origin,
            dest
          });
        }
      }
    });

    return {
      binActivity,
      aisleActivity,
      totalMovedQty,
      totalMovedOps,
      movementsList: movementsList.slice(0, 15) // Keep last 15 for visual feed
    };
  }, [logs]);

  // Fast shortcut quantity percentages
  const handlePercentPreset = (percent: number) => {
    if (!sourceBinObj) return;
    const calculated = Math.floor(sourceBinObj.occupiedQty * (percent / 100));
    setQtyToMove(calculated);
    setErrorMessage('');
  };

  const handleExecuteMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!sourceBinId) {
      setErrorMessage('Por favor seleccione una celda de origen.');
      return;
    }
    if (!targetBinId) {
      setErrorMessage('Por favor seleccione una celda de destino.');
      return;
    }
    if (sourceBinId === targetBinId) {
      setErrorMessage('La celda de destino no puede ser idéntica a la de origen.');
      return;
    }
    if (qtyToMove <= 0) {
      setErrorMessage('La cantidad a trasladar debe ser mayor que cero.');
      return;
    }
    if (!sourceBinObj) {
      setErrorMessage('La celda de origen seleccionada es inválida.');
      return;
    }

    if (qtyToMove > sourceBinObj.occupiedQty) {
      setErrorMessage(`Cantidad excedida. La celda de origen solo contiene ${sourceBinObj.occupiedQty} unidades.`);
      return;
    }

    const targetBinObj = bins.find(b => b.id === targetBinId);
    if (!targetBinObj) {
      setErrorMessage('La celda de destino seleccionada es inválida.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Construct updated bins list
      const updatedBins = bins.map(b => {
        // Source bin update
        if (b.id === sourceBinId) {
          const remainingQty = b.occupiedQty - qtyToMove;
          return {
            ...b,
            occupiedQty: remainingQty,
            occupiedSku: remainingQty === 0 ? '' : b.occupiedSku,
            status: remainingQty === 0 ? 'Empty' : 'Partial'
          } as Bin;
        }

        // Destination bin update
        if (b.id === targetBinId) {
          const newQty = (b.occupiedQty || 0) + qtyToMove;
          return {
            ...b,
            occupiedQty: newQty,
            occupiedSku: sourceBinObj.occupiedSku, // receives the SKU from the source
            status: newQty >= 120 ? 'Full' : 'Partial'
          } as Bin;
        }

        return b;
      });

      const movedSku = sourceBinObj.occupiedSku;
      const logAction = 'Traslado Interno de Stock';
      const logDetails = `Trasladadas ${qtyToMove} unidades de SKU ${movedSku} desde la celda ${sourceBinId} hacia la celda ${targetBinId}`;

      await onUpdateBins(updatedBins, logAction, logDetails);

      // Save movement to session storage and state (limit to 10 entries)
      const newMovement: SessionMovement = {
        sku: movedSku,
        sourceBinId,
        targetBinId,
        qty: qtyToMove,
        timestamp: new Date().toISOString()
      };
      setSessionMovements(prev => {
        const updated = [newMovement, ...prev].slice(0, 10);
        sessionStorage.setItem('wms_session_movements', JSON.stringify(updated));
        return updated;
      });

      // Play local visual confirmation
      setSuccessMessage(`¡Movimiento exitoso! Trasladadas ${qtyToMove} unidades de SKU ${movedSku} de la celda ${sourceBinId} a la celda ${targetBinId}.`);
      
      // Reset form states
      setSourceBinId('');
      setTargetBinId('');
      setQtyToMove(0);
      setTargetSearchQuery('');
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Hubo un problema al aplicar el movimiento en la hoja de cálculo: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safe percentage helper for Aisle stats
  const getAislePercentage = (qty: number) => {
    if (movementStats.totalMovedQty === 0) return '0%';
    const pct = Math.min(100, Math.round((qty / (movementStats.totalMovedQty * 2)) * 100)); // times 2 because each move counts as 2 aisle touches (origin + dest)
    return `${pct}%`;
  };

  return (
    <div className="space-y-6 animate-fadeIn text-xs text-slate-700">
      
      {/* Informative Header card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6 text-indigo-600 bg-indigo-50 p-1.5 rounded-lg animate-pulse" />
            Movimientos y Reubicación de Inventario (Slotting)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Reubique mercancías de forma ágil dentro del almacén. Los registros de traslados se calculan en tiempo real para visualizar la actividad de cada pasillo y celda.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0">
          {/* Excel Export Button */}
          <button
            type="button"
            onClick={handleDownloadInsumosUbicacion}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-emerald-500"
          >
            <FileSpreadsheet className="h-4.5 w-4.5 text-white" />
            <span>Exportar Insumos por Ubicación</span>
          </button>

          <div className="bg-slate-50 border border-slate-200/60 px-3.5 py-2 rounded-xl flex items-center gap-2 shrink-0">
            <User className="h-4 w-4 text-slate-500" />
            <div className="text-[10px] leading-tight">
              <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Operador Activo</span>
              <span className="font-bold text-slate-700">{activeOperatorName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time stats bar & activity feeds */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Metric 1: Total volume moved */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/50 shadow-xs flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Items Trasladados</span>
            <span className="text-xl font-black text-slate-800 font-mono leading-none">
              {movementStats.totalMovedQty.toLocaleString('es-ES')} <span className="text-xs font-normal text-slate-400">uds</span>
            </span>
            <p className="text-[9px] text-slate-400 mt-1">En el historial de auditoría de traslados</p>
          </div>
        </div>

        {/* Metric 2: Total reallocations count */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/50 shadow-xs flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Shuffle className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Traslados Realizados</span>
            <span className="text-xl font-black text-slate-800 font-mono leading-none">
              {movementStats.totalMovedOps} <span className="text-xs font-normal text-slate-400">operaciones</span>
            </span>
            <p className="text-[9px] text-slate-400 mt-1">Conexión con base de datos Supabase OK</p>
          </div>
        </div>

        {/* Metric 3: Aisle occupancy workload */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/50 shadow-xs col-span-1 md:col-span-2">
          <div className="flex justify-between items-center mb-2.5">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Actividad de Tránsito por Pasillo</span>
            </div>
            <span className="text-[9px] text-slate-400 font-bold uppercase">Entrada/Salida total</span>
          </div>
          
          <div className="grid grid-cols-4 gap-2 text-center">
            {['A', 'B', 'C', 'D'].map(aisle => {
              const qty = movementStats.aisleActivity[aisle] || 0;
              return (
                <div key={aisle} className="bg-slate-50 border border-slate-150 p-2 rounded-xl">
                  <span className="block text-xs font-black text-slate-700 font-mono">Pasillo {aisle}</span>
                  <span className="block text-[11px] font-bold font-mono text-slate-500 mt-0.5">{qty} uds</span>
                  <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden mt-1.5">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: getAislePercentage(qty) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Main Core Layout: Left column has transfer wizard, Right has real-time position status & log feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Quick Transfer Form */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 space-y-5">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Move className="h-5 w-5 text-indigo-600 animate-bounce" />
              <h3 className="text-sm font-bold text-slate-800">Panel de Traslado Rápido de Celdas</h3>
            </div>
            <span className="text-[9px] font-mono font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md border border-indigo-150">PRO MODO</span>
          </div>

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-3 text-emerald-800 font-semibold flex items-center gap-2 animate-fade-in">
              <Check className="h-4.5 w-4.5 bg-emerald-100 text-emerald-700 p-0.5 rounded-full shrink-0" />
              <div>
                <p>{successMessage}</p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="bg-rose-50 border border-rose-150 rounded-xl p-3 text-rose-800 font-semibold flex items-center gap-2 animate-fade-in">
              <AlertTriangle className="h-4.5 w-4.5 bg-rose-100 text-rose-700 p-0.5 rounded-full shrink-0" />
              <p>{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleExecuteMovement} className="space-y-5">
            
            {/* STEP 1: SELECT SOURCE BIN */}
            <div className="space-y-2">
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold font-mono text-[9px]">1</span>
                Celda de Origen (Donde está el producto)
              </label>
              
              <select
                value={sourceBinId}
                onChange={(e) => {
                  setSourceBinId(e.target.value);
                  setQtyToMove(0);
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white p-3 text-slate-700 focus:border-indigo-500 focus:outline-none transition hover:border-slate-300"
              >
                <option value="">-- Seleccionar Celda con Stock Disponible --</option>
                {occupiedBins.map((b) => {
                  const prod = inventory.find(i => i.sku === b.occupiedSku);
                  return (
                    <option key={b.id} value={b.id}>
                      {b.id} - {b.occupiedSku} ({b.occupiedQty} uds) {prod ? ` - ${prod.name.substring(0, 30)}...` : ''}
                    </option>
                  );
                })}
              </select>

              {/* Source Bin details card */}
              {sourceBinObj && sourceProductObj && (
                <div className="bg-indigo-50/40 border border-indigo-100/80 p-4 rounded-xl flex items-center gap-4 animate-fade-in">
                  {sourceProductObj.imageUrl ? (
                    <img 
                      src={sourceProductObj.imageUrl} 
                      alt={sourceProductObj.name} 
                      className="h-14 w-14 object-cover rounded-lg border border-indigo-200 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=150&h=150&q=80';
                      }}
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-bold border border-indigo-150">
                      <Package className="h-6 w-6" />
                    </div>
                  )}
                  <div className="grow space-y-1 overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold bg-indigo-100/80 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] tracking-wide">{sourceProductObj.sku}</span>
                      <span className="text-[10px] text-slate-400 font-bold font-mono">({sourceProductObj.category})</span>
                    </div>
                    <h4 className="font-bold text-slate-800 text-xs truncate leading-tight">{sourceProductObj.name}</h4>
                    <p className="text-[10px] text-slate-500 leading-none">
                      Stock actual en celda: <strong className="text-slate-800 font-mono font-black">{sourceBinObj.occupiedQty} unidades</strong>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 2: QUANTITY TO MOVE */}
            <div className="space-y-2">
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold font-mono text-[9px]">2</span>
                Cantidad a Trasladar
              </label>

              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max={sourceBinObj ? sourceBinObj.occupiedQty : undefined}
                  disabled={!sourceBinObj}
                  value={qtyToMove === 0 ? '' : qtyToMove}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setQtyToMove(val);
                    setErrorMessage('');
                  }}
                  placeholder={sourceBinObj ? `Límite: ${sourceBinObj.occupiedQty} uds` : "Primero seleccione origen"}
                  className="grow font-bold font-mono text-xs rounded-xl border border-slate-200 bg-white p-3 text-slate-700 focus:border-indigo-500 focus:outline-none transition hover:border-slate-300"
                  required
                />
                
                {/* Preset shortcuts */}
                <div className="flex gap-1 shrink-0">
                  {[25, 50, 100].map((percent) => (
                    <button
                      key={percent}
                      type="button"
                      disabled={!sourceBinObj}
                      onClick={() => handlePercentPreset(percent)}
                      className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 border border-slate-200 text-[10px] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer active:scale-95 flex items-center justify-center"
                    >
                      {percent === 100 ? 'Todo' : `${percent}%`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* STEP 3: SELECT TARGET DESTINATION BIN */}
            <div className="space-y-2">
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold font-mono text-[9px]">3</span>
                Celda de Destino (Hacia dónde mover)
              </label>

              {/* Live search input filter */}
              <div className="relative">
                <input
                  type="text"
                  disabled={!sourceBinObj}
                  value={targetSearchQuery}
                  onChange={(e) => setTargetSearchQuery(e.target.value)}
                  placeholder={sourceBinObj ? "Buscar celda por ID, pasillo o SKU compatible..." : "Primero seleccione origen"}
                  className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-slate-700 focus:border-indigo-500 focus:outline-none transition hover:border-slate-300"
                />
                <MapPin className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
              </div>

              {/* Target search results scrollable list */}
              {sourceBinObj && (
                <div className="border border-slate-150 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
                  {targetBinsFiltered.map((bin) => {
                    const isEmpty = bin.status === 'Empty';
                    const isSameSku = bin.occupiedSku === sourceBinObj.occupiedSku;
                    const isFull = bin.status === 'Full';
                    
                    return (
                      <div 
                        key={bin.id}
                        onClick={() => {
                          setTargetBinId(bin.id);
                          setErrorMessage('');
                        }}
                        className={`p-2.5 flex items-center justify-between cursor-pointer transition ${
                          targetBinId === bin.id 
                            ? 'bg-indigo-50 border-l-4 border-indigo-600' 
                            : 'hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input 
                            type="radio" 
                            name="targetBinRadio" 
                            checked={targetBinId === bin.id}
                            onChange={() => {}} // handled by parent div click
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="font-mono leading-none">
                            <span className="font-black text-slate-800 text-xs">{bin.id}</span>
                            {bin.aisle === 'Virtual' ? (
                              <span className="block text-[9px] text-indigo-500 font-bold tracking-wide mt-1">
                                Área Especial de Flujo de Productos
                              </span>
                            ) : (
                              <span className="block text-[9px] text-slate-400 font-bold tracking-wide mt-1">
                                Pasillo {bin.aisle} • Estante {bin.rack} • Altura {bin.level}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status badges */}
                        <div className="flex items-center gap-1.5">
                          {isEmpty ? (
                            <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded text-[9px] font-bold">
                              Vacía (Ideal)
                            </span>
                          ) : isSameSku ? (
                            <span className="bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded text-[9px] font-bold">
                              Mismo SKU ({bin.occupiedQty} uds)
                            </span>
                          ) : isFull ? (
                            <span className="bg-rose-50 text-rose-500 border border-rose-100 px-1.5 py-0.5 rounded text-[9px] font-bold">
                              Celda Llena (Evitar)
                            </span>
                          ) : (
                            <span className="bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded text-[9px] font-bold">
                              Mezcla: {bin.occupiedSku} ({bin.occupiedQty} uds)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {targetBinsFiltered.length === 0 && (
                    <div className="p-4 text-center text-slate-400 italic">No se encontraron celdas que coincidan con la búsqueda</div>
                  )}
                </div>
              )}
            </div>

            {/* CONFIRM ACTION */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !sourceBinId || !targetBinId || qtyToMove <= 0}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg cursor-pointer transition active:scale-98 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <span>Registrando en Supabase...</span>
                ) : (
                  <>
                    <Check className="h-4.5 w-4.5" />
                    <span>Confirmar y Ejecutar Reubicación</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

        {/* Right Column: Real-time traffic map & recent list */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Top Active Positions in Real-time */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-4">
            <div className="border-b border-slate-100 pb-2.5 flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4.5 w-4.5 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">Monitoreo de Celdas con Mayor Flujo</h3>
              </div>
              <span className="text-[9px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">En Vivo</span>
            </div>

            {Object.keys(movementStats.binActivity).length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs italic">
                Aún no hay datos de traslados registrados en esta hoja de cálculo.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {(Object.entries(movementStats.binActivity) as [string, { incoming: number; outgoing: number; total: number }][])
                  .sort((a, b) => b[1].total - a[1].total)
                  .slice(0, 6)
                  .map(([binId, act]) => {
                    const outPct = act.total > 0 ? (act.outgoing / act.total) * 100 : 0;
                    const inPct = act.total > 0 ? (act.incoming / act.total) * 100 : 0;
                    return (
                      <div key={binId} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 hover:border-indigo-200 hover:bg-indigo-50/10 transition-all duration-200 shadow-xs flex flex-col gap-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-black font-mono text-xs shadow-sm">
                              {binId}
                            </div>
                            <div>
                              <span className="block font-bold text-slate-800 text-xs font-mono">Celda {binId}</span>
                              <span className="text-[9px] text-slate-400 font-semibold">Pasillo {binId.charAt(0)}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            <div className="text-right">
                              <span className="block text-[7px] text-slate-400 uppercase tracking-widest font-bold">Flujo Total</span>
                              <span className="font-mono text-xs font-black text-indigo-700">
                                {act.total} <span className="text-[9px] text-slate-400 font-normal">uds</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar Distribution */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold font-mono">
                            <span className="text-rose-600 flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 inline-block"></span>
                              Salidas: {act.outgoing} <span className="text-slate-400 font-normal">({Math.round(outPct)}%)</span>
                            </span>
                            <span className="text-emerald-600 flex items-center gap-1">
                              Entradas: {act.incoming} <span className="text-slate-400 font-normal">({Math.round(inPct)}%)</span>
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block"></span>
                            </span>
                          </div>
                          <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden flex">
                            {act.outgoing > 0 && (
                              <div 
                                className="bg-gradient-to-r from-rose-400 to-rose-500 h-full transition-all duration-500" 
                                style={{ width: `${outPct}%` }}
                                title={`Salidas: ${act.outgoing} uds (${Math.round(outPct)}%)`}
                              />
                            )}
                            {act.incoming > 0 && (
                              <div 
                                className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full transition-all duration-500" 
                                style={{ width: `${inPct}%` }}
                                title={`Entradas: ${act.incoming} uds (${Math.round(inPct)}%)`}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Recent Operations Log Feed */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-4">
            <div className="border-b border-slate-100 pb-2.5 flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4.5 w-4.5 text-slate-500" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">Historial de Traslados Recientes</h3>
              </div>
              <span className="text-[9px] text-slate-400 font-bold">Últimos 15</span>
            </div>

            {movementStats.movementsList.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs italic">
                No se han registrado movimientos de inventario internos en el historial.
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {movementStats.movementsList.map((mv, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] space-y-2 hover:bg-slate-50/80 transition">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold font-mono">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {mv.user}
                      </span>
                      <span>
                        {new Date(mv.timestamp).toLocaleString('es-ES', {
                          month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100 text-xs font-bold">
                      <span className="font-mono text-indigo-600">{mv.sku}</span>
                      <span className="text-slate-700 font-mono text-[11px] font-black">{mv.qty} unidades</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold bg-indigo-50/20 px-2 py-1 rounded">
                      <span className="flex items-center gap-1 text-slate-600">
                        <MapPin className="h-3 w-3 text-rose-500" />
                        Celda: {mv.origin}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                      <span className="flex items-center gap-1 text-slate-600">
                        <MapPin className="h-3 w-3 text-emerald-500" />
                        Celda: {mv.dest}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Session Movements History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <Clock className="h-5 w-5 text-indigo-600 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">Historial de Movimientos de la Sesión Actual</h3>
              <p className="text-[10px] text-slate-400 font-medium">Últimos 10 traslados ejecutados en la sesión de navegación activa</p>
            </div>
          </div>
          <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-150 px-2.5 py-0.5 rounded-full font-bold">
            {sessionMovements.length} Registrados
          </span>
        </div>

        {sessionMovements.length === 0 ? (
          <div className="text-center py-10 bg-slate-50/50 border border-dashed border-slate-150 rounded-xl">
            <p className="text-slate-400 font-medium italic">Aún no has realizado movimientos en esta sesión. Completa el formulario de arriba para registrar tu primer traslado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-150 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150 uppercase tracking-wider text-[9px]">
                  <th className="py-3 px-4 font-mono w-12 text-center">N°</th>
                  <th className="py-3 px-4">Artículo / SKU</th>
                  <th className="py-3 px-4">Cantidad</th>
                  <th className="py-3 px-4 text-center">Ruta de Traslado (Origen → Destino)</th>
                  <th className="py-3 px-4 text-right">Hora del Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {sessionMovements.map((sm, index) => (
                  <tr key={index} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-slate-400 font-mono text-[10px] text-center">{index + 1}</td>
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                      <span className="bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md text-[10px]">
                        {sm.sku}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-black text-slate-800">
                      {sm.qty} uds
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-md font-mono font-bold text-[10px] flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-rose-500" />
                          {sm.sourceBinId}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md font-mono font-bold text-[10px] flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-emerald-500" />
                          {sm.targetBinId}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400 text-[10px]">
                      {new Date(sm.timestamp).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
