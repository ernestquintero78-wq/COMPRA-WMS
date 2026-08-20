import React, { useState } from 'react';
import { Bin, InventoryItem, Order } from '../types';
import { 
  Compass, MapPin, Check, Plus, AlertTriangle, Scan, ShieldCheck, 
  Printer, ArrowRight, Play, CheckCircle, PackageCheck, ClipboardCheck
} from 'lucide-react';

interface PickingConsoleProps {
  bins: Bin[];
  inventory: InventoryItem[];
  orders: Order[];
  activeOperatorName: string;
  onFullSync: (
    newBins: Bin[],
    newInventory: InventoryItem[],
    newOrders: Order[],
    logAction: string,
    logDetails: string
  ) => Promise<void>;
}

export const PickingConsole: React.FC<PickingConsoleProps> = ({
  bins,
  inventory,
  orders,
  activeOperatorName,
  onFullSync
}) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // Picking journey states
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [pickedItemsLog, setPickedItemsLog] = useState<{ [sku: string]: number }>({});
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [scannedQty, setScannedQty] = useState<number>(0);
  
  // Feedback MSG
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [journeyCompleted, setJourneyCompleted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Label print modal of pack-slip
  const [printPackSlip, setPrintPackSlip] = useState<boolean>(false);

  // Filter outbound orders that are pending or in picking
  const pickableOrders = orders.filter(o => o.type === 'Outbound' && (o.status === 'Pending' || o.status === 'Picking'));

  // Calculate standard serpentine route: Aisle -> Rack -> Shelf -> Level
  const buildOptimizedPickingSteps = (order: Order) => {
    const steps: { sku: string; qty: number; binId: string }[] = [];
    
    order.items.forEach(itm => {
      // Find where this SKU is sitting
      const allocatedBins = bins.filter(b => b.occupiedSku === itm.sku && (b.occupiedQty || 0) > 0);
      
      let allocatedQty = 0;
      allocatedBins.forEach(b => {
        if (allocatedQty < itm.qty) {
          const qtyToPickFromThisBin = Math.min(b.occupiedQty, itm.qty - allocatedQty);
          steps.push({
            sku: itm.sku,
            qty: qtyToPickFromThisBin,
            binId: b.id
          });
          allocatedQty += qtyToPickFromThisBin;
        }
      });

      // If no allocated bin but we need to pick it, add a fallback receiving bin
      if (allocatedQty < itm.qty) {
        steps.push({
          sku: itm.sku,
          qty: itm.qty - allocatedQty,
          binId: 'A-01-1A' // Fallback
        });
      }
    });

    // Serpentine Sort Picker Path
    return steps.sort((a, b) => {
      const aParts = a.binId.split('-');
      const bParts = b.binId.split('-');
      
      const aisle = aParts[0].localeCompare(bParts[0]);
      if (aisle !== 0) return aisle;

      const rack = aParts[1].localeCompare(bParts[1]);
      if (rack !== 0) return rack;

      const shelf = aParts[2].localeCompare(bParts[2]);
      if (shelf !== 0) return shelf;

      return aParts[3].localeCompare(bParts[3]);
    });
  };

  const handleStartPicking = (order: Order) => {
    setSelectedOrder(order);
    setCurrentStepIdx(0);
    setPickedItemsLog({});
    setScannedBarcode('');
    setScannedQty(0);
    setFeedback(null);
    setJourneyCompleted(false);
  };

  const handleVerifyStepScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const steps = buildOptimizedPickingSteps(selectedOrder);
    const activeStep = steps[currentStepIdx];
    if (!activeStep) return;

    // Verify barcode matches the SKU
    const product = inventory.find(i => i.sku === activeStep.sku);
    const isBarcodeMatch = product && (product.barcode === scannedBarcode.trim() || product.sku === scannedBarcode.toUpperCase().trim());

    if (!isBarcodeMatch) {
      setFeedback({
        type: 'err',
        text: `Error de Lectura: Código "${scannedBarcode}" no coincide con el material ${activeStep.sku} requerido.`
      });
      return;
    }

    if (scannedQty !== activeStep.qty) {
      setFeedback({
        type: 'err',
        text: `Discrepancia de Picking: Se solicitan ${activeStep.qty} unidades, se ingresaron ${scannedQty}. Favor de ingresar la cantidad correcta.`
      });
      return;
    }

    // Success pick step!
    const nextPickedLog = {
      ...pickedItemsLog,
      [activeStep.sku]: (pickedItemsLog[activeStep.sku] || 0) + scannedQty
    };
    setPickedItemsLog(nextPickedLog);
    
    setFeedback({
      type: 'ok',
      text: `✓ Paso validado: Extraídas ${scannedQty} unidades de SKU ${activeStep.sku} de la celda ${activeStep.binId}.`
    });

    setScannedBarcode('');
    setScannedQty(0);

    // Continue to next or complete
    if (currentStepIdx + 1 < steps.length) {
      setTimeout(() => {
        setCurrentStepIdx(prev => prev + 1);
        setFeedback(null);
      }, 1500);
    } else {
      setTimeout(() => {
        setJourneyCompleted(true);
        setFeedback(null);
      }, 1500);
    }
  };

  const handleSyncCompletedPickToWms = async () => {
    if (!selectedOrder) return;
    setIsSyncing(true);

    try {
      const steps = buildOptimizedPickingSteps(selectedOrder);

      // Deduct picked quantities from matched bins
      const updatedBins = bins.map(b => {
        const binPickStep = steps.find(s => s.binId === b.id);
        if (binPickStep && b.occupiedSku === binPickStep.sku) {
          const nextQty = Math.max(0, b.occupiedQty - binPickStep.qty);
          return {
            ...b,
            occupiedQty: nextQty,
            occupiedSku: nextQty === 0 ? '' : b.occupiedSku,
            status: nextQty === 0 ? 'Empty' as const : 'Partial' as const
          };
        }
        return b;
      });

      // Deduct total picked quantity from main inventory catalog
      const updatedInventory = inventory.map(inv => {
        const skuTotalPicked = steps
          .filter(s => s.sku === inv.sku)
          .reduce((sum, item) => sum + item.qty, 0);

        if (skuTotalPicked > 0) {
          return {
            ...inv,
            qty: Math.max(0, inv.qty - skuTotalPicked)
          };
        }
        return inv;
      });

      // Update Order Status to "Delivered" and generate simulated tracking
      const trackingNumber = `TRK-PICK-${Math.floor(10000000 + Math.random() * 90000000)}`;
      const updatedOrders = orders.map(o => {
        if (o.id === selectedOrder.id) {
          return {
            ...o,
            status: 'Delivered' as const,
            shipmentDate: new Date().toISOString().split('T')[0],
            carrier: 'WMS Express Delivery',
            trackingNumber
          };
        }
        return o;
      });

      await onFullSync(
        updatedBins,
        updatedInventory,
        updatedOrders,
        'Picking Completado y Surtido',
        `Pedido ${selectedOrder.id} fue surtido mediante recorrido óptimo por el selector ${activeOperatorName}. Unidades descontadas del almacén.`
      );

      // Trigger Print Slips Modal
      setPrintPackSlip(true);
    } catch (err: any) {
      alert(`Error decodificando sync de Picking: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Banner Principal */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-md border border-slate-700/50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-400">
                <Compass className="h-4 w-4 animate-spin-slow" />
              </div>
              <h2 className="text-sm font-extrabold tracking-widest uppercase font-mono text-slate-300">
                Módulo Guiado de Picking & Surtido
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Habilite la ruta óptima en serpentina combinando aisles y niveles. Extraiga con verificación por escáner de barras para evitar errores de embarque.
            </p>
          </div>
          <span className="text-[10px] font-mono tracking-widest uppercase bg-rose-400/10 text-rose-400 border border-rose-400/20 px-2.5 py-1 rounded-xl">
            Serpentine Optimized
          </span>
        </div>
      </div>

      {/* Grid: Selector de Orden vs Panel del Recorrido Activo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Lado izquierdo: Listado de Órdenes Pendientes para Picking */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <span className="text-xs font-bold font-mono uppercase text-slate-700 block">Pedidos Outbound de Salida</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Pendientes de surtido óptimo en estanterías</span>
          </div>

          {pickableOrders.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <PackageCheck className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-400 font-bold block">No hay órdenes de salida pendientes de surtido.</p>
              <p className="text-[10px] text-slate-400 max-w-xs mx-auto">Cree nuevos pedidos Outbound desde el Módulo de Órdenes para gatillar el picking.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pickableOrders.map((ord) => {
                const isSelected = selectedOrder?.id === ord.id;
                return (
                  <div 
                    key={ord.id} 
                    className={`border p-4 rounded-xl space-y-3 transition ${
                      isSelected ? 'border-rose-400 bg-rose-50/10' : 'border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-start text-xs">
                      <div>
                        <span className="font-mono font-black text-slate-800">{ord.id}</span>
                        <span className="block text-[10px] text-slate-400 mt-1 font-semibold">Cliente: {ord.assignedTo}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-black border ${
                        ord.priority === 'High' || ord.priority === 'Critical'
                          ? 'bg-rose-50 border-rose-200 text-rose-600'
                          : 'bg-amber-50 border-amber-200 text-amber-600'
                      }`}>
                        {ord.priority}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] space-y-1">
                      <span className="text-slate-400 uppercase font-black tracking-tight block">Items Requeridos:</span>
                      {ord.items.map(it => {
                        const invData = inventory.find(i => i.sku === it.sku);
                        return (
                          <div key={it.sku} className="flex justify-between font-mono font-bold">
                            <span className="text-slate-700">{it.sku}</span>
                            <span className="text-slate-500">{it.qty} unidades</span>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => handleStartPicking(ord)}
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Surtir con Ruta Óptima
                    </button>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Lado derecho: Terminal del picking guiado paso a paso */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 space-y-4">
          
          {selectedOrder ? (() => {
            const steps = buildOptimizedPickingSteps(selectedOrder);
            const activeStep = steps[currentStepIdx];
            const activeProduct = inventory.find(i => i.sku === activeStep?.sku);

            return (
              <div className="space-y-6">
                
                {/* Indicador de viaje */}
                <div className="flex justify-between items-center bg-slate-50 border border-slate-150 p-4 rounded-xl font-mono text-xs">
                  <div>
                    <span className="text-slate-400 uppercase block font-bold text-[8px]">Orden de Salida</span>
                    <strong className="text-slate-800 text-sm">{selectedOrder.id}</strong>
                  </div>
                  <div className="text-center">
                    <span className="text-slate-400 uppercase block font-bold text-[8px]">OPERADOR ACTIVO</span>
                    <strong className="text-blue-600 font-bold">{activeOperatorName}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 uppercase block font-bold text-[8px]">Avance de Ruta</span>
                    <strong className="text-rose-600 text-sm">Paso {journeyCompleted ? steps.length : currentStepIdx + 1} de {steps.length}</strong>
                  </div>
                </div>

                {/* Timeline visual de paradas en el pasillo (Aisles) */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider block">Secuencia Optimizada de Paradas (Celdas)</span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {steps.map((st, sidx) => {
                      const isPast = sidx < currentStepIdx;
                      const isCurrent = sidx === currentStepIdx && !journeyCompleted;
                      return (
                        <div key={sidx} className="flex items-center gap-1 shrink-0">
                          <div className={`p-2.5 rounded-xl border flex flex-col items-center ${
                            isPast 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                              : isCurrent 
                              ? 'bg-rose-600 border-rose-500 text-white shadow' 
                              : 'bg-slate-50 border-slate-200 text-slate-500'
                          }`}>
                            <span className="text-[10px] font-mono font-black tracking-tighter uppercase whitespace-nowrap leading-none">
                              {st.binId}
                            </span>
                            <span className="text-[8px] font-bold mt-1 uppercase whitespace-nowrap leading-none opacity-80">
                              {st.sku} ({st.qty}u)
                            </span>
                          </div>
                          {sidx + 1 < steps.length && (
                            <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {!journeyCompleted ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    
                    {/* Tarjeta de guiado de ubicación/celda */}
                    <div className="bg-rose-50/30 border border-rose-100 rounded-2xl p-5 text-center flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <MapPin className="h-8 w-8 text-rose-600 mx-auto animate-bounce" />
                        <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider font-mono">UBICACIÓN DESTINO</span>
                        <h4 className="text-3xl font-black text-slate-800 tracking-wider font-mono bg-white inline-block px-4 py-1.5 border border-slate-200 rounded-xl">
                          {activeStep?.binId}
                        </h4>
                      </div>

                      <div className="space-y-1 font-mono text-xs text-slate-600">
                        <span className="text-slate-400 uppercase font-bold text-[8px] block">Extraer Material</span>
                        <strong className="text-sm font-black text-slate-800 block">{activeStep?.sku}</strong>
                        <p className="text-[11px] text-slate-400 uppercase leading-none font-sans font-bold">{activeProduct?.name}</p>
                      </div>

                      <div className="p-3 bg-white border border-rose-100 rounded-xl font-semibold text-xs flex justify-between items-center text-slate-700">
                        <span>Cantidad a Extraer:</span>
                        <span className="font-mono text-base font-black text-rose-600">{activeStep?.qty} unidades</span>
                      </div>
                    </div>

                    {/* Formulario de Escáneo / Confirmación */}
                    <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                      <div className="border-b border-slate-100 pb-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider block">Verificación de Código</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Escanee o copie el código de barras (EAN-13) para certificar extracción.</p>
                      </div>

                      {feedback && (
                        <div className={`p-3 rounded-xl border flex gap-1.5 text-[11px] font-semibold leading-relaxed ${
                          feedback.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}>
                          {feedback.type === 'ok' ? (
                            <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0 mt-0.5" />
                          )}
                          <div>
                            {feedback.text}
                          </div>
                        </div>
                      )}

                      <form onSubmit={handleVerifyStepScan} className="space-y-4">
                        <div>
                          <label className="block text-[8px] uppercase font-bold text-slate-400 mb-1 tracking-wider">Código de Barras Soportado / EAN-13</label>
                          <div className="relative flex items-center">
                            <Scan className="absolute left-3.5 h-4 w-4 text-slate-400" />
                            <input
                              type="text"
                              value={scannedBarcode}
                              onChange={(e) => setScannedBarcode(e.target.value)}
                              placeholder="Ej: 7501020304012 o ROB-CPU-i7"
                              className="w-full pl-9 pr-3 py-2 px-2.5 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-rose-500 bg-white"
                              required
                            />
                          </div>
                          <span className="text-[9px] text-slate-400 font-mono block mt-1 tracking-tight">EAN de Referencia: {activeProduct?.barcode}</span>
                        </div>

                        <div>
                          <label className="block text-[8px] uppercase font-bold text-slate-400 mb-1 tracking-wider">Cantidad Surtida Extraída</label>
                          <input
                            type="number"
                            min="1"
                            value={scannedQty || ''}
                            onChange={(e) => setScannedQty(Number(e.target.value))}
                            placeholder={`Ingresar ${activeStep?.qty} u`}
                            className="w-full p-2 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-rose-500 bg-white"
                            required
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider shadow flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Scan className="h-4 w-4" />
                          Verificar & Registrar Extracción
                        </button>
                      </form>
                    </div>

                  </div>
                ) : (
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-6 text-center space-y-6">
                    <div className="h-16 w-16 bg-emerald-100 border border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle className="h-10 w-10 animate-bounce" />
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-lg font-black text-slate-800">¡Recorrido de Picking Completado!</h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                        Se han validado con éxito todos los productos en sus ubicaciones físicas de estantería. El stock ya puede ser deducido permanentemente del almacén.
                      </p>
                    </div>

                    <div className="pt-4 flex justify-center gap-3">
                      <button
                        onClick={handleSyncCompletedPickToWms}
                        disabled={isSyncing}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3 px-6 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 transition"
                      >
                        {isSyncing ? 'Guardando en Supabase...' : 'Efectuar Despacho & Sync Supabase'}
                      </button>
                      <button
                        onClick={() => setSelectedOrder(null)}
                        className="bg-white border border-slate-200 text-slate-500 font-bold py-3 px-6 rounded-xl text-xs uppercase tracking-wider hover:text-slate-700 transition"
                      >
                        Salir de Recorrido
                      </button>
                    </div>
                  </div>
                )}

              </div>
            );
          })() : (
            <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
              <Compass className="h-12 w-12 text-slate-300 mx-auto animate-pulse" />
              <p className="text-xs text-slate-500 font-bold block bg-slate-100 inline-block px-3 py-1 rounded border border-slate-200">Terminal de Picking Desconectada</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                Seleccione un pedido de salida Outbound en la barra lateral izquierda y presione <strong>"Surtir con Ruta Óptima"</strong> para inicializar las indicaciones guiadas y mapeo en bodega.
              </p>
            </div>
          )}

        </div>

      </div>

      {/* PACK SLIP PRINTOUT MODAL STICKER */}
      {printPackSlip && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="border-b border-slate-150 pb-2.5 flex justify-between items-center text-slate-800">
              <span className="text-xs font-mono font-black uppercase">Hoja de Empaque (Pack-slip label)</span>
              <button 
                onClick={() => {
                  setPrintPackSlip(false);
                  setSelectedOrder(null);
                }} 
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Sticker Area */}
            <div className="border-4 border-dashed border-slate-300/80 p-5 bg-white text-slate-900 space-y-4 font-mono select-none">
              <div className="flex justify-between items-start border-b border-slate-950 pb-2">
                <div>
                  <h3 className="text-xs font-black tracking-widest leading-none">WMS PACK-SLIP CERTIFICATE</h3>
                  <span className="text-[9px] text-slate-500 font-semibold block mt-1.5 uppercase">ID de Surtido: {selectedOrder.id}</span>
                </div>
                <span className="text-[9px] font-black border border-slate-900 px-1.5 py-0.5 rounded">
                  PASSED
                </span>
              </div>

              <div className="space-y-1.5">
                <span className="text-[9px] text-slate-400 block font-bold leading-none uppercase">CLIENTE / CONSIGNATARIO</span>
                <span className="text-xs font-black text-slate-800 block leading-tight">{selectedOrder.assignedTo}</span>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1 pb-1 border-b border-slate-100">
                  <span className="font-semibold">EMBARCADO POR:</span>
                  <span className="font-bold text-slate-600">{activeOperatorName}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] text-slate-400 font-bold block uppercase pb-1 leading-none">MATERIALES SELECCIONADOS</span>
                <div className="bg-slate-50 p-2.5 border border-slate-150 rounded-lg space-y-1.5">
                  {selectedOrder.items.map(item => (
                    <div key={item.sku} className="flex justify-between text-[10px]">
                      <span className="font-bold text-slate-800">{item.sku}</span>
                      <span className="text-slate-500">{item.qty} UNIDADES</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Barcode area */}
              <div className="pt-2 text-center flex flex-col items-center">
                <div className="text-slate-800 font-sans scale-y-150 leading-none select-none tracking-tight">
                  ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
                </div>
                <span className="text-[10px] tracking-[5px] font-black block mt-2 text-center pl-1.5 uppercase">
                  *{selectedOrder.id}*
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir Hoja
              </button>
              <button
                onClick={() => {
                  setPrintPackSlip(false);
                  setSelectedOrder(null);
                }}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider block text-center"
              >
                Terminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
