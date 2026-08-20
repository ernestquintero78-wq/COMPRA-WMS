import React, { useState, useEffect } from 'react';
import { Bin, InventoryItem, Order } from '../types';
import { Scan, HelpCircle, Check, AlertTriangle, ShieldCheck, RefreshCw, Barcode } from 'lucide-react';

interface BarcodeConsoleProps {
  bins: Bin[];
  inventory: InventoryItem[];
  orders: Order[];
  onFullSync: (
    newBins: Bin[],
    newInventory: InventoryItem[],
    newOrders: Order[],
    logAction: string,
    logDetails: string
  ) => Promise<void>;
  onLogCountSession: (sku: string, physical: number, system: number) => void;
  initialModule?: 'entrada' | 'salida' | 'conteo';
  hideModuleSelector?: boolean;
  hideHeader?: boolean;
  selectedBarcode?: string;
}

export const BarcodeConsole: React.FC<BarcodeConsoleProps> = ({
  bins,
  inventory,
  orders,
  onFullSync,
  onLogCountSession,
  initialModule = 'entrada',
  hideModuleSelector = false,
  hideHeader = false,
  selectedBarcode
}) => {
  const [activeModule, setActiveModule] = useState<'entrada' | 'salida' | 'conteo'>(initialModule);
  
  useEffect(() => {
    if (initialModule) {
      setActiveModule(initialModule);
    }
  }, [initialModule]);

  // Terminal inputs
  const [scannedBarcode, setScannedBarcode] = useState('');

  useEffect(() => {
    if (selectedBarcode) {
      setScannedBarcode(selectedBarcode);
    }
  }, [selectedBarcode]);
  const [targetBinId, setTargetBinId] = useState('');
  const [qtyToProcess, setQtyToProcess] = useState<number>(10);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  
  // Cycle count specific
  const [physicalCount, setPhysicalCount] = useState<number>(0);

  // Operation status message tracking
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Helper to lookup barcode
  const findProductByBarcode = (code: string) => {
    return inventory.find(i => i.barcode === code.trim() || i.sku === code.trim().toUpperCase());
  };

  const showFeedback = (text: string, type: 'ok' | 'err' = 'ok') => {
    setFeedbackMsg({ type, text });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 8000);
  };

  // 1. Proceso de Entrada (Inbound Putaway via Barcode)
  const handleInboundScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedBarcode.trim()) {
      showFeedback('Por favor, ingrese o escanee un código de barras de material.', 'err');
      return;
    }
    if (!targetBinId.trim()) {
      showFeedback('Por favor, especifique una celda/ubicación (Bin ID) de destino.', 'err');
      return;
    }

    const prod = findProductByBarcode(scannedBarcode);
    if (!prod) {
      showFeedback(`No se encontró ningún producto con el código de barras/SKU "${scannedBarcode}".`, 'err');
      return;
    }

    const targetBin = bins.find(b => b.id === targetBinId.trim().toUpperCase());
    if (!targetBin) {
      showFeedback(`La celda de destino "${targetBinId}" no existe en el mapa del almacén.`, 'err');
      return;
    }

    if (targetBin.occupiedSku && targetBin.occupiedSku !== prod.sku) {
      showFeedback(`La celda "${targetBinId}" ya está asignada a otro SKU (${targetBin.occupiedSku}).`, 'err');
      return;
    }

    setIsProcessing(true);
    try {
      // Create deep copies
      const updatedBins = bins.map(b => {
        if (b.id === targetBin.id) {
          const newQty = (b.occupiedQty || 0) + qtyToProcess;
          return {
            ...b,
            occupiedSku: prod.sku,
            occupiedQty: newQty,
            status: newQty >= 100 ? 'Full' as const : 'Partial' as const
          };
        }
        return b;
      });

      const updatedInventory = inventory.map(i => {
        if (i.sku === prod.sku) {
          return { ...i, qty: i.qty + qtyToProcess };
        }
        return i;
      });

      await onFullSync(
        updatedBins,
        updatedInventory,
        orders,
        'Entrada por Código de Barras',
        `Entrada de mercancía de ${qtyToProcess} unidades de ${prod.sku} (EAN: ${prod.barcode}) acomodados en celda ${targetBin.id} vía Lectura de Escáner.`
      );

      showFeedback(`ÉXITO: Se ingresaron ${qtyToProcess} unidades de ${prod.name} en celda ${targetBin.id}. Stock actualizado y sincronizado en Supabase.`);
      setScannedBarcode('');
      setTargetBinId('');
    } catch (err: any) {
      showFeedback(`Error al procesar la entrada: ${err.message}`, 'err');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Proceso de Salida (Outbound Ship via scan matching)
  const handleOutboundScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) {
      showFeedback('Seleccione una orden de salida activa para despachar.', 'err');
      return;
    }
    if (!scannedBarcode.trim()) {
      showFeedback('Escanee el código de barras del producto a despachar.', 'err');
      return;
    }

    const order = orders.find(o => o.id === selectedOrderId);
    if (!order) {
      showFeedback('La orden seleccionada no es válida.', 'err');
      return;
    }

    const scannedProduct = findProductByBarcode(scannedBarcode);
    if (!scannedProduct) {
      showFeedback(`Error: El código de barras/SKU "${scannedBarcode}" no está registrado en el inventario.`, 'err');
      return;
    }

    // Verify if item belongs to order
    const orderItem = order.items.find(item => item.sku === scannedProduct.sku);
    if (!orderItem) {
      showFeedback(`Error de Verificación: El SKU ${scannedProduct.sku} no forma parte de la Orden ${order.id}.`, 'err');
      return;
    }

    // Check inventory stock availability
    if (scannedProduct.qty < orderItem.qty) {
      showFeedback(`Error de Stock: Stock insuficiente en almacén (${scannedProduct.qty} unidades) para despachar la cantidad requerida de ${orderItem.qty} unidades.`, 'err');
      return;
    }

    setIsProcessing(true);
    try {
      // Find cells containing scanned product to deduct stock from
      let qtyRemainingToDeduct = orderItem.qty;
      const updatedBins = bins.map(b => {
        if (b.occupiedSku === scannedProduct.sku && qtyRemainingToDeduct > 0) {
          const deduct = Math.min(b.occupiedQty, qtyRemainingToDeduct);
          qtyRemainingToDeduct -= deduct;
          const newQty = b.occupiedQty - deduct;
          return {
            ...b,
            occupiedQty: newQty,
            occupiedSku: newQty === 0 ? '' : b.occupiedSku,
            status: newQty === 0 ? 'Empty' as const : 'Partial' as const
          };
        }
        return b;
      });

      // Deduct from overall inventory
      const updatedInventory = inventory.map(i => {
        if (i.sku === scannedProduct.sku) {
          return { ...i, qty: i.qty - orderItem.qty };
        }
        return i;
      });

      // Complete order
      const trackingNo = `TRK-${Math.floor(10000000 + Math.random() * 90000000)}`;
      const updatedOrders = orders.map(o => {
        if (o.id === order.id) {
          return {
            ...o,
            status: 'Delivered' as const,
            shipmentDate: new Date().toISOString().split('T')[0],
            carrier: 'DHL Express',
            trackingNumber: trackingNo
          };
        }
        return o;
      });

      await onFullSync(
        updatedBins,
        updatedInventory,
        updatedOrders,
        'Salida por Código de Barras',
        `Pedido ${order.id} validado y despachado con código de barras de material. Se descontaron ${orderItem.qty} unidades de SKU ${scannedProduct.sku}. Guía: ${trackingNo}`
      );

      showFeedback(`ÉXITO: Orden ${order.id} despachada y surtida. Guía generada: ${trackingNo}.`);
      setScannedBarcode('');
      setSelectedOrderId('');
    } catch (err: any) {
      showFeedback(`Error al registrar salida: ${err.message}`, 'err');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Proceso de Conteo Cíclico (Cycle Counting Verification)
  const handleCycleCountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedBarcode.trim()) {
      showFeedback('Escanee o ingrese el código de barras/SKU de material en auditoría cíclica.', 'err');
      return;
    }

    const prod = findProductByBarcode(scannedBarcode);
    if (!prod) {
      showFeedback(`El producto con código ${scannedBarcode} no existe. Creelo primero en el catálogo.`, 'err');
      return;
    }

    const systemQty = prod.qty;
    const diff = physicalCount - systemQty;

    // Trigger callback to persist the counting log in parent metrics state
    onLogCountSession(prod.sku, physicalCount, systemQty);

    if (diff === 0) {
      showFeedback(`CONTEO PERFECTO: El conteo físico de ${prod.sku} coincide al 100% con el sistema (${systemQty} unidades). Precisión del 100%.`, 'ok');
    } else {
      showFeedback(`DISCREPANCIA DETECTADA: Físico: ${physicalCount} vs Sistema: ${systemQty}. Diferencia de ${diff > 0 ? '+' : ''}${diff} unidades. Ajuste registrado.`, 'err');
    }

    setScannedBarcode('');
    setPhysicalCount(0);
  };

  // Get active pending outbound orders
  const pendingOutboundOrders = orders.filter(o => o.type === 'Outbound' && o.status === 'Pending');

  return (
    <div className="space-y-6">
      
      {/* Module Title Banner */}
      {!hideHeader && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-md border border-slate-700/50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
                  <Barcode className="h-4 w-4 animate-pulse" />
                </div>
                <h2 className="text-sm font-extrabold tracking-widest uppercase font-mono text-slate-300">
                  Consola Escáner de Códigos de Barra
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Simulador WMS interactivo para procesar entradas, salidas y conteos cíclicos de forma reactiva leyendo el código de barras.
              </p>
            </div>
            <span className="text-[10px] font-mono tracking-widest uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-xl">
              Protocolo de Escáner en Vivo
            </span>
          </div>
        </div>
      )}

      {/* Mode Selector Tabs */}
      {!hideModuleSelector && (
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => { setActiveModule('entrada'); setFeedbackMsg(null); }}
            className={`py-3 px-4 rounded-xl border font-bold text-xs uppercase cursor-pointer tracking-wider transition ${
              activeModule === 'entrada'
                ? 'bg-blue-600 text-white border-blue-500 shadow'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            📥 Proceso de Entrada
          </button>
          <button
            onClick={() => { setActiveModule('salida'); setFeedbackMsg(null); }}
            className={`py-3 px-4 rounded-xl border font-bold text-xs uppercase cursor-pointer tracking-wider transition ${
              activeModule === 'salida'
                ? 'bg-blue-600 text-white border-blue-500 shadow'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            📤 Proceso de Salida
          </button>
          <button
            onClick={() => { setActiveModule('conteo'); setFeedbackMsg(null); }}
            className={`py-3 px-4 rounded-xl border font-bold text-xs uppercase cursor-pointer tracking-wider transition ${
              activeModule === 'conteo'
                ? 'bg-blue-600 text-white border-blue-500 shadow'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            🔄 Conteo Cíclico
          </button>
        </div>
      )}

      {/* Operational Module Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Scanner Input Area */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold font-mono uppercase text-slate-500">
              {activeModule === 'entrada' && 'Formulario de Entrada (Receiving & Putaway)'}
              {activeModule === 'salida' && 'Formulario de Salida (Outbound Dispatch)'}
              {activeModule === 'conteo' && 'Auditoría de Conteo Cíclico (Cyclic Auditing)'}
            </span>
            <div className="flex items-center gap-1.5 text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded font-mono uppercase font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Lector Conectado
            </div>
          </div>

          {/* Feedback response msg */}
          {feedbackMsg && (
            <div className={`p-4 rounded-xl border flex items-start gap-2.5 text-xs font-semibold ${
              feedbackMsg.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {feedbackMsg.type === 'ok' ? (
                <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">
                {feedbackMsg.text}
              </div>
            </div>
          )}

          {/* Form 1: Entrance */}
          {activeModule === 'entrada' && (
            <form onSubmit={handleInboundScanSubmit} className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
                <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                  💡 <strong>Instrucciones:</strong> Escanee o copie el Código de Barras correspondiente de la tabla derecha, defina la ubicación (celda vacía o con el mismo producto), escoja la cantidad de entrada, y confirme el registro para simular la captura física.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Escaneo del Código de Barras (EAN-13)</label>
                  <div className="relative flex items-center">
                    <Scan className="absolute left-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={scannedBarcode}
                      onChange={(e) => setScannedBarcode(e.target.value)}
                      placeholder="Escanee o pegue EAN-13/Código"
                      className="w-full pl-10 pr-3 py-3 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Celda de Destino en Almacén (Bin ID)</label>
                  <select
                    value={targetBinId}
                    onChange={(e) => setTargetBinId(e.target.value)}
                    className="w-full p-3 text-xs font-mono border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-white text-slate-700"
                    required
                  >
                    <option value="">-- Seleccionar Ubicación --</option>
                    {bins.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.id} {b.occupiedSku ? `(${b.occupiedSku} - ${b.occupiedQty}u)` : '(Vacío open)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Cantidad de Unidades a Ingresar</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={qtyToProcess}
                  onChange={(e) => setQtyToProcess(Number(e.target.value))}
                  className="w-full p-2.5 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider shadow flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Procesando Entrada...
                  </>
                ) : (
                  <>
                    <Scan className="h-4 w-4" />
                    Confirmar Entrada y Ubicar Material
                  </>
                )}
              </button>
            </form>
          )}

          {/* Form 2: Exit */}
          {activeModule === 'salida' && (
            <form onSubmit={handleOutboundScanSubmit} className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
                <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                  💡 <strong>Instrucciones:</strong> Seleccione una Orden de salida (Shipment) de la cola de pendientes, verifique qué SKU pide y escanee su código de barras correspondiente para completar el picking y despacho inmediato del material.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Seleccionar Orden Solicitada</label>
                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="w-full p-3 text-xs font-mono border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-white text-slate-700"
                    required
                  >
                    <option value="">-- Seleccionar Orden --</option>
                    {pendingOutboundOrders.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.id} - {o.assignedTo} ({o.items.length} skus)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Escaneo Código de Barras de Material Solicitado</label>
                  <div className="relative flex items-center">
                    <Scan className="absolute left-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={scannedBarcode}
                      onChange={(e) => setScannedBarcode(e.target.value)}
                      placeholder="Escanee/Pegue EAN-13"
                      className="w-full pl-10 pr-3 py-3 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              {selectedOrderId && (() => {
                const orderObj = orders.find(o => o.id === selectedOrderId);
                if (!orderObj) return null;
                return (
                  <div className="p-4 border border-slate-200 bg-slate-50 rounded-xl text-xs space-y-2">
                    <span className="block font-bold text-slate-700 uppercase font-mono tracking-wider text-[10px]">Materiales requeridos en Orden:</span>
                    <div className="space-y-1 bg-white p-2 border border-slate-100 rounded-lg">
                      {orderObj.items.map(item => {
                        const invItem = inventory.find(i => i.sku === item.sku);
                        return (
                          <div key={item.sku} className="flex justify-between font-mono py-1 border-b border-slate-50 last:border-b-0 leading-relaxed text-[11px]">
                            <span className="font-semibold text-slate-800">{item.sku} ({invItem?.name || 'Mercancía entrante'})</span>
                            <span>Requerido: <strong>{item.qty} unidades</strong> | EAN: <strong>{invItem?.barcode || 'N/A'}</strong></span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider shadow flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Validando Código y Despachando...
                  </>
                ) : (
                  <>
                    <Scan className="h-4 w-4" />
                    Escanear y Validar Despacho
                  </>
                )}
              </button>
            </form>
          )}

          {/* Form 3: Cycle Counting */}
          {activeModule === 'conteo' && (
            <form onSubmit={handleCycleCountSubmit} className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
                <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                  💡 <strong>Instrucciones:</strong> El Conteo Cíclico audita físicamente las ubicaciones. Escanee el código de barras de cualquier material en su almacén e introduzca la cantidad real o física contada. La consola calculará de inmediato la precisión e informará cualquier discrepancia.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Código de Barras/SKU Escaneado</label>
                  <div className="relative flex items-center">
                    <Scan className="absolute left-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={scannedBarcode}
                      onChange={(e) => setScannedBarcode(e.target.value)}
                      placeholder="Escanee EAN-13 o SKU de material"
                      className="w-full pl-10 pr-3 py-3 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Cantidad Física Contada en Almacén</label>
                  <input
                    type="number"
                    min="0"
                    value={physicalCount}
                    onChange={(e) => setPhysicalCount(Number(e.target.value))}
                    className="w-full p-2.5 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider shadow flex items-center justify-center gap-2"
              >
                <Barcode className="h-4 w-4" />
                Registrar Conteo de Auditoría
              </button>
            </form>
          )}

        </div>

        {/* Right Side: Quick Reference Catalog */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <span className="text-xs font-bold font-mono uppercase text-slate-700 block">
              Directorio de Códigos de Referencia
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Copie un código de barras para probar la lectura en el simulador
            </span>
          </div>

          <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
            {inventory.map(item => (
              <div
                key={item.sku}
                onClick={() => setScannedBarcode(item.barcode || item.sku)}
                className="group border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 p-3 rounded-xl transition cursor-all-scroll"
                title="Copiar código de barras al lector"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-slate-800 font-extrabold text-[11px] block">{item.sku}</span>
                    <span className="font-sans text-slate-500 text-[10px] block leading-none mt-1 font-semibold">{item.name}</span>
                  </div>
                  <span className="text-[9px] font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase font-bold">
                    Stock: {item.qty}u
                  </span>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-50 text-right">
                  <span className="font-mono text-xs text-blue-600 font-extrabold tracking-widest block bg-slate-50 group-hover:bg-white p-1 rounded border border-slate-150 text-center uppercase">
                    |||| {item.barcode || 'NO_BARCODE'}
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>

    </div>
  );
};
