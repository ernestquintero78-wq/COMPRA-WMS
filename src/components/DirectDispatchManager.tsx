import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { InventoryItem, Bin, Order } from '../types';
import { 
  ArrowUpRight, 
  Scan, 
  Search, 
  Truck, 
  MapPin, 
  Package, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  FileDown, 
  Store, 
  Building2, 
  Clock, 
  Boxes, 
  Plus, 
  Minus, 
  RotateCcw, 
  X, 
  Layers, 
  Check, 
  ShieldCheck, 
  Navigation, 
  Compass, 
  Sparkles,
  ClipboardList
} from 'lucide-react';

export interface DirectDispatchRecord {
  id: string;
  timestamp: string;
  sku: string;
  productName: string;
  category: string;
  qty: number;
  originBins: string[];
  destination: string;
  deliveryMethod: string;
  trackingNumber?: string;
  notes?: string;
  operator: string;
  totalEstimatedWeightKg?: number;
}

interface DirectDispatchManagerProps {
  inventory: InventoryItem[];
  bins: Bin[];
  orders: Order[];
  onDirectDispatch: (dispatchData: {
    sku: string;
    qty: number;
    destination: string;
    deliveryMethod: string;
    trackingNumber?: string;
    notes?: string;
  }) => Promise<{ orderId: string; deductedBins: string[] } | null>;
  onCompleteOrder?: (orderId: string) => Promise<void>;
  activeOperator?: any;
  platformTheme?: any;
  onNavigateToTab?: (tab: string) => void;
}

export const DirectDispatchManager: React.FC<DirectDispatchManagerProps> = ({
  inventory,
  bins,
  orders,
  onDirectDispatch,
  onCompleteOrder,
  activeOperator,
  platformTheme,
  onNavigateToTab
}) => {
  // Sub-tabs in Salidas module
  const [activeView, setActiveView] = useState<'express' | 'history' | 'orders'>('express');

  // Input states for Express Dispatch
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedSku, setSelectedSku] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [destination, setDestination] = useState<string>('');
  const [deliveryMethod, setDeliveryMethod] = useState<string>('Reparto Local (Unidad Propia)');
  const [customDeliveryMethodText, setCustomDeliveryMethodText] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Search & Catalog modal state
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');

  // Processing & Confirmation Ticket Modal
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [lastDispatchRecord, setLastDispatchRecord] = useState<DirectDispatchRecord | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);

  // History of dispatches (persisted in localStorage)
  const [dispatchHistory, setDispatchHistory] = useState<DirectDispatchRecord[]>(() => {
    try {
      const saved = localStorage.getItem('OWMS_DIRECT_DISPATCH_HISTORY');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('OWMS_DIRECT_DISPATCH_HISTORY', JSON.stringify(dispatchHistory));
      window.dispatchEvent(new Event('wms_direct_dispatches_updated'));
    } catch (e) {}
  }, [dispatchHistory]);

  // Quick destination presets
  const destinationPresets = [
    'Tienda OXXO (Cadena Comercial)',
    'Obra / Construcción (Sitio Activo)',
    'Base de Transporte / Taller Flota',
    'Cliente Mostrador',
    'Sucursal Norte',
    'Centro de Distribución',
    'Envío a Domicilio',
    'Ruta Local Express',
    'Otro (especificar...)'
  ];

  // Delivery methods options
  const deliveryOptions = [
    {
      id: 'Reparto Local (Unidad Propia)',
      label: 'Reparto Local',
      desc: 'Camioneta WMS / Ruta de reparto de la empresa',
      icon: Truck,
      badge: 'Unidad Propia'
    },
    {
      id: 'Paquetería Externa (FedEx / DHL / Estafeta)',
      label: 'Paquetería Externa',
      desc: 'Servicio de courier con guía de rastreo',
      icon: Package,
      badge: 'Courier / Guía'
    },
    {
      id: 'Entrega en Mostrador (Recoge Cliente)',
      label: 'Entrega en Mostrador',
      desc: 'Retiro presencial del cliente en almacén',
      icon: Store,
      badge: 'Pick-up Almacén'
    },
    {
      id: 'Transporte de Carga / Flete Consolidado',
      label: 'Transporte Pesado',
      desc: 'Flete industrial, plataforma o tarima completa',
      icon: Building2,
      badge: 'Flete Pesado'
    },
    {
      id: 'Mensajería Express / Moto',
      label: 'Mensajería Urgente',
      desc: 'Envío prioritario express en el día',
      icon: Navigation,
      badge: 'Express'
    },
    {
      id: '__OTHER__',
      label: 'Otro Medio de Entrega',
      desc: 'Especifique medio de transporte personalizado',
      icon: Sparkles,
      badge: 'Personalizado'
    }
  ];

  // Find currently selected product
  const selectedProduct = useMemo(() => {
    if (!selectedSku) return null;
    return inventory.find(i => i.sku === selectedSku) || null;
  }, [selectedSku, inventory]);

  // Find physical bin locations where the selected product is stored
  const productBins = useMemo(() => {
    if (!selectedSku) return [];
    return bins.filter(b => b.occupiedSku === selectedSku && b.occupiedQty > 0);
  }, [selectedSku, bins]);

  // Calculate actual total available stock
  const availableStock = useMemo(() => {
    if (!selectedProduct) return 0;
    // Prefer catalog qty or sum of bins
    const binsTotal = productBins.reduce((sum, b) => sum + b.occupiedQty, 0);
    return Math.max(selectedProduct.qty, binsTotal);
  }, [selectedProduct, productBins]);

  // Filtered inventory for catalog selector
  const filteredCatalog = useMemo(() => {
    return inventory.filter(item => {
      const q = catalogSearch.toLowerCase().trim();
      const matchQuery = !q || 
        item.sku.toLowerCase().includes(q) || 
        item.name.toLowerCase().includes(q) ||
        (item.barcode && item.barcode.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q));

      const matchCategory = selectedCategoryFilter === 'ALL' || item.category === selectedCategoryFilter;
      return matchQuery && matchCategory;
    });
  }, [inventory, catalogSearch, selectedCategoryFilter]);

  // Unique categories
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach(i => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [inventory]);

  // Handle barcode / SKU scanning
  const handleScanOrSubmitCode = (code: string) => {
    const clean = code.trim().toLowerCase();
    if (!clean) return;

    // Search by SKU or barcode
    const match = inventory.find(i => 
      i.sku.toLowerCase() === clean || 
      (i.barcode && i.barcode.toLowerCase() === clean)
    );

    if (match) {
      setSelectedSku(match.sku);
      setBarcodeInput('');
      setFeedback({
        type: 'ok',
        text: `Producto identificado: ${match.name} (SKU: ${match.sku}). Stock: ${match.qty} uds.`
      });
      // Set default quantity if 0
      if (quantity <= 0) setQuantity(1);
    } else {
      setFeedback({
        type: 'err',
        text: `No se encontró ningún producto con el código o SKU "${code}".`
      });
    }
  };

  // Select item from catalog modal
  const handleSelectFromCatalog = (sku: string) => {
    const item = inventory.find(i => i.sku === sku);
    if (!item) return;
    setSelectedSku(sku);
    setIsCatalogOpen(false);
    setFeedback({
      type: 'ok',
      text: `Seleccionado: ${item.name} (${item.sku})`
    });
    if (quantity <= 0) setQuantity(1);
  };

  // Adjust quantity with boundaries
  const handleAdjustQuantity = (delta: number) => {
    const max = availableStock > 0 ? availableStock : 9999;
    setQuantity(prev => {
      const next = prev + delta;
      return Math.max(1, Math.min(next, max));
    });
  };

  // Set quantity directly
  const handleSetQuantity = (val: number) => {
    const max = availableStock > 0 ? availableStock : 9999;
    setQuantity(Math.max(1, Math.min(val, max)));
  };

  // Execute Dispatch
  const handleProcessDispatch = async () => {
    if (!selectedProduct) {
      setFeedback({ type: 'err', text: 'Por favor, seleccione o escanee primero un producto para registrar la salida.' });
      return;
    }

    if (quantity <= 0) {
      setFeedback({ type: 'err', text: 'La cantidad para la salida debe ser mayor a 0.' });
      return;
    }

    if (quantity > availableStock) {
      setFeedback({ 
        type: 'err', 
        text: `Stock insuficiente. Solo hay ${availableStock} unidades disponibles de "${selectedProduct.name}".` 
      });
      return;
    }

    if (!destination.trim()) {
      setFeedback({ type: 'err', text: 'Indique el destino, cliente o sucursal de entrega.' });
      return;
    }

    if (!deliveryMethod.trim()) {
      setFeedback({ type: 'err', text: 'Seleccione el medio de entrega.' });
      return;
    }

    try {
      setIsProcessing(true);
      setFeedback(null);

      const effectiveDeliveryMethod = deliveryMethod === '__OTHER__'
        ? (customDeliveryMethodText.trim() ? `Otro: ${customDeliveryMethodText.trim()}` : 'Otro (Personalizado)')
        : deliveryMethod;

      const result = await onDirectDispatch({
        sku: selectedProduct.sku,
        qty: quantity,
        destination: destination.trim(),
        deliveryMethod: effectiveDeliveryMethod,
        trackingNumber: trackingNumber.trim() || undefined,
        notes: notes.trim() || undefined
      });

      if (result) {
        // Collect origin bins
        const usedBins = result.deductedBins && result.deductedBins.length > 0
          ? result.deductedBins
          : productBins.map(b => b.id).slice(0, 3);

        const newRecord: DirectDispatchRecord = {
          id: result.orderId,
          timestamp: new Date().toISOString(),
          sku: selectedProduct.sku,
          productName: selectedProduct.name,
          category: selectedProduct.category || 'Almacenamiento General',
          qty: quantity,
          originBins: usedBins,
          destination: destination.trim(),
          deliveryMethod: effectiveDeliveryMethod,
          trackingNumber: trackingNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          operator: activeOperator ? activeOperator.name : 'Administrador de Logística',
          totalEstimatedWeightKg: (selectedProduct.unitWeight || 1) * quantity
        };

        // Update local history
        setDispatchHistory(prev => [newRecord, ...prev]);
        setLastDispatchRecord(newRecord);
        setShowTicketModal(true);

        // Reset form
        setSelectedSku('');
        setQuantity(1);
        setDestination('');
        setCustomDeliveryMethodText('');
        setTrackingNumber('');
        setNotes('');
        setBarcodeInput('');

        setFeedback({
          type: 'ok',
          text: `¡Salida de almacén registrada con éxito! Folio generado: ${newRecord.id}`
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'err',
        text: `Error al procesar la salida de almacén: ${err?.message || 'Error del sistema'}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Export history to Excel
  const handleExportHistoryToExcel = () => {
    if (dispatchHistory.length === 0) return;

    const headers = [
      'Folio de Salida',
      'Fecha y Hora',
      'SKU',
      'Producto',
      'Categoría',
      'Cantidad de Salida',
      'Celdas de Extracción',
      'Destino / Cliente',
      'Medio de Entrega',
      'Guía / Tracking',
      'Operador',
      'Notas'
    ];

    const rows = dispatchHistory.map(d => [
      d.id,
      new Date(d.timestamp).toLocaleString(),
      d.sku,
      d.productName,
      d.category,
      d.qty,
      d.originBins.join(', '),
      d.destination,
      d.deliveryMethod,
      d.trackingNumber || 'N/A',
      d.operator,
      d.notes || ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Salidas_Directas');
    XLSX.writeFile(wb, `Salidas_Almacen_WMS_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Filter legacy / pending orders
  const pendingOrdersList = useMemo(() => {
    return orders.filter(o => o.type === 'Outbound' && o.status !== 'Completed');
  }, [orders]);

  return (
    <div className="space-y-6 animate-fadeIn" id="direct-dispatch-manager">
      
      {/* Header Bar */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5" />
              Outbound Express
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Módulo de Salidas Directas de Almacén
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
            Registre salidas de mercancía de forma inmediata sin crear órdenes previas: seleccione o escanee el producto, indique el destino y el medio de entrega.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0 select-none">
          <button
            type="button"
            onClick={() => setActiveView('express')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeView === 'express'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>Salida Directa</span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveView('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeView === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-blue-600" />
            <span>Historial ({dispatchHistory.length})</span>
          </button>

          {pendingOrdersList.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveView('orders')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeView === 'orders'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5 text-indigo-600" />
              <span>Pedidos en Cola ({pendingOrdersList.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Feedback notification */}
      {feedback && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs animate-fadeIn ${
          feedback.type === 'ok'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2.5">
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 1: SALIDA DIRECTA RÁPIDA (MAIN WORKFLOW)                             */}
      {/* ========================================================================= */}
      {activeView === 'express' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* COLUMNA IZQUIERDA: FORMULARIO DE 3 PASOS (8 de 12 columnas) */}
          <div className="lg:col-span-8 space-y-6">

            {/* PASO 1: SELECCIONAR PRODUCTO O ESCANEARLO */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-150">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-amber-500 text-white font-mono font-black text-sm flex items-center justify-center shadow-xs">
                    1
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                      Seleccionar Producto o Escanearlo
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Pistola escáner, código de barras o selección desde el catálogo
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCatalogOpen(true)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs"
                >
                  <Search className="h-3.5 w-3.5 text-slate-500" />
                  <span>Buscar en Catálogo</span>
                </button>
              </div>

              {/* Input de Escaneo Rápido */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Escanear Código de Barras o Ingresar SKU:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Scan className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => {
                        setBarcodeInput(e.target.value);
                        // Fast detection if exact match
                        if (e.target.value.trim().length >= 3) {
                          const m = inventory.find(i => 
                            i.sku.toLowerCase() === e.target.value.trim().toLowerCase() ||
                            (i.barcode && i.barcode.toLowerCase() === e.target.value.trim().toLowerCase())
                          );
                          if (m) setSelectedSku(m.sku);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleScanOrSubmitCode(barcodeInput);
                        }
                      }}
                      placeholder="Escanee con pistola o teclee SKU (ej. SKU-001)..."
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-250 rounded-2xl text-xs font-mono font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleScanOrSubmitCode(barcodeInput)}
                    className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <span>Identificar</span>
                  </button>
                </div>
              </div>

              {/* FICHA DEL PRODUCTO SELECCIONADO */}
              {selectedProduct ? (
                <div className="bg-gradient-to-r from-amber-50/60 to-orange-50/40 border border-amber-200/90 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-11 w-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                        <Package className="h-6 w-6" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-extrabold bg-white px-2 py-0.5 rounded-md border border-amber-300 text-amber-900">
                            {selectedProduct.sku}
                          </span>
                          {selectedProduct.barcode && (
                            <span className="text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                              EAN: {selectedProduct.barcode}
                            </span>
                          )}
                          <span className="text-[10px] font-medium text-slate-500">
                            {selectedProduct.category}
                          </span>
                        </div>
                        <h4 className="text-base font-black text-slate-900 leading-tight">
                          {selectedProduct.name}
                        </h4>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSku('');
                        setQuantity(1);
                      }}
                      className="self-start sm:self-auto text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-xl border border-rose-200 shadow-3xs"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Cambiar Producto</span>
                    </button>
                  </div>

                  {/* Stock y Celdas de Almacenamiento */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-amber-200/70 text-xs">
                    <div className="bg-white p-3 rounded-xl border border-amber-200/60 space-y-1">
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                        Disponibilidad en Almacén
                      </span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xl font-black font-mono text-slate-900">
                          {availableStock}
                        </span>
                        <span className="text-xs font-bold text-emerald-600">
                          unidades en inventario
                        </span>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-amber-200/60 space-y-1">
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-amber-500" />
                        <span>Ubicación Física (Picking)</span>
                      </span>
                      <div className="font-mono text-xs font-bold text-slate-800 truncate">
                        {productBins.length > 0 ? (
                          productBins.map(b => `${b.id} (${b.occupiedQty} uds)`).join(', ')
                        ) : (
                          <span className="text-amber-700">Stock general de catálogo</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Selector de Cantidad */}
                  <div className="bg-white p-4 rounded-2xl border border-amber-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        Cantidad para Salida:
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-slate-500">
                        Quedarán: <strong className="text-slate-800 font-bold">{Math.max(0, availableStock - quantity)}</strong> uds
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
                        <button
                          type="button"
                          onClick={() => handleAdjustQuantity(-1)}
                          disabled={quantity <= 1}
                          className="px-3.5 py-2 hover:bg-slate-200 text-slate-700 disabled:opacity-40 cursor-pointer transition font-bold"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={availableStock}
                          value={quantity}
                          onChange={(e) => handleSetQuantity(parseInt(e.target.value) || 1)}
                          className="w-16 text-center font-mono font-black text-base text-slate-900 py-1.5 bg-transparent focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleAdjustQuantity(1)}
                          disabled={quantity >= availableStock}
                          className="px-3.5 py-2 hover:bg-slate-200 text-slate-700 disabled:opacity-40 cursor-pointer transition font-bold"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Botones de Cantidad Rápida */}
                      <div className="flex flex-wrap gap-1.5">
                        {[1, 5, 10, 20].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => handleSetQuantity(n)}
                            disabled={n > availableStock}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer disabled:opacity-30 ${
                              quantity === n
                                ? 'bg-amber-600 text-white shadow-2xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            +{n}
                          </button>
                        ))}
                        {availableStock > 0 && (
                          <button
                            type="button"
                            onClick={() => handleSetQuantity(availableStock)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                              quantity === availableStock
                                ? 'bg-amber-600 text-white shadow-2xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            Máx ({availableStock})
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                /* Empty state hint */
                <div 
                  onClick={() => setIsCatalogOpen(true)}
                  className="p-6 border-2 border-dashed border-slate-250 hover:border-amber-400 rounded-2xl text-center space-y-2 cursor-pointer transition bg-slate-50/50 hover:bg-amber-50/20 group"
                >
                  <Package className="h-8 w-8 text-slate-300 group-hover:text-amber-500 mx-auto transition" />
                  <p className="text-xs font-bold text-slate-600 group-hover:text-amber-700">
                    Haga clic aquí para seleccionar un producto del catálogo o escanee el código de barras arriba
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {inventory.length} artículos disponibles en catálogo maestro
                  </p>
                </div>
              )}
            </div>

            {/* PASO 2: PONER DESTINO */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-150">
                <div className="h-8 w-8 rounded-xl bg-blue-600 text-white font-mono font-black text-sm flex items-center justify-center shadow-xs">
                  2
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                    Poner Destino
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Indique a qué cliente, tienda, sucursal o dirección se envía la mercancía
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    id="direct-dispatch-destination-input"
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Ej. Sucursal Norte, Cliente Farmacias Central, Mostrador Almacén..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-250 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>

                {/* Chips de Sugerencia Rápida */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                    Destinos Frecuentes (Clic para rellenar o personalizar):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {destinationPresets.map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          if (preset.includes('Otro')) {
                            setDestination('');
                            const input = document.getElementById('direct-dispatch-destination-input') as HTMLInputElement | null;
                            if (input) {
                              input.focus();
                              input.placeholder = '✏️ Escriba aquí de qué se trata el destino personalizado...';
                            }
                          } else {
                            setDestination(preset);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer border ${
                          destination === preset
                            ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* PASO 3: MEDIO DE ENTREGA */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-150">
                <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white font-mono font-black text-sm flex items-center justify-center shadow-xs">
                  3
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                    Medio de Entrega
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Seleccione el método de transporte y detalles de traslado
                  </p>
                </div>
              </div>

              {/* Selector de Métodos de Transporte */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {deliveryOptions.map(opt => {
                  const Icon = opt.icon;
                  const isSelected = deliveryMethod === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setDeliveryMethod(opt.id)}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-2 ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-400 text-indigo-950 shadow-2xs ring-1 ring-indigo-400'
                          : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200'
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          isSelected ? 'bg-indigo-200/80 text-indigo-900' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {opt.badge}
                        </span>
                      </div>

                      <div>
                        <h5 className="text-xs font-bold leading-tight">
                          {opt.label}
                        </h5>
                        <p className="text-[10px] text-slate-400 leading-snug mt-0.5">
                          {opt.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input interactivo si se selecciona 'Otro Medio de Entrega' */}
              {deliveryMethod === '__OTHER__' && (
                <div className="p-3 bg-indigo-50/90 border-2 border-indigo-300 rounded-2xl space-y-1.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-black uppercase text-indigo-900 tracking-wider">
                      ✏️ ¿De qué se trata el medio de entrega? (especifique):
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod('Reparto Local (Unidad Propia)')}
                      className="text-[10px] text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                    >
                      ✕ Cancelar
                    </button>
                  </div>
                  <input
                    type="text"
                    value={customDeliveryMethodText}
                    onChange={(e) => setCustomDeliveryMethodText(e.target.value)}
                    placeholder="Ej. Transporte de personal, Flete tercerizado, Taxi de carga..."
                    className="w-full px-3.5 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              )}

              {/* Campos opcionales: Guía y Notas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Número de Guía / Placas (Opcional):
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Ej. FEDEX-98765432 o Placas ABC-123..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-mono font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Instrucciones / Notas (Opcional):
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej. Entregar en rampa 2, material frágil..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

            </div>

          </div>

          {/* COLUMNA DERECHA: RESUMEN Y ACCIÓN DE SALIDA DE ALMACÉN INMEDIATA (4 de 12 columnas) */}
          <div className="lg:col-span-4 space-y-6">

            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-5 sticky top-6">
              
              <div className="flex items-center gap-2 pb-3 border-b border-slate-150">
                <span className="p-1 px-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-mono font-black uppercase">
                  Resumen de Salida
                </span>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Confirmación Inmediata
                </h3>
              </div>

              {/* Detalle en vivo */}
              <div className="space-y-3 text-xs">
                
                {/* Producto */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                    Producto para Salida:
                  </span>
                  {selectedProduct ? (
                    <div>
                      <strong className="text-slate-900 block font-bold">
                        {selectedProduct.name}
                      </strong>
                      <span className="font-mono text-[11px] text-amber-700 font-extrabold">
                        {selectedProduct.sku}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">Ningún producto seleccionado</span>
                  )}
                </div>

                {/* Cantidad */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400">
                    Cantidad:
                  </span>
                  <span className="text-base font-black font-mono text-slate-900">
                    {selectedProduct ? `${quantity} uds` : '0 uds'}
                  </span>
                </div>

                {/* Destino */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                    Destino / Receptor:
                  </span>
                  <span className="font-bold text-slate-900 block truncate">
                    {destination.trim() || <span className="text-slate-400 italic font-normal">Sin especificar</span>}
                  </span>
                </div>

                {/* Transporte */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                    Medio de Entrega:
                  </span>
                  <span className="font-bold text-slate-900 block truncate">
                    {deliveryMethod}
                  </span>
                </div>

                {/* Operador responsable */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400">
                    Operador en Turno:
                  </span>
                  <span className="font-mono text-xs font-extrabold text-slate-800">
                    {activeOperator ? activeOperator.name : 'Administrador de Logística'}
                  </span>
                </div>

              </div>

              {/* BOTÓN PRINCIPAL: PROCESAR SALIDA INMEDIATA */}
              <button
                type="button"
                onClick={handleProcessDispatch}
                disabled={isProcessing || !selectedProduct || !destination.trim() || quantity <= 0}
                className="w-full py-4 px-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-40 text-white rounded-2xl text-sm font-black transition flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-md disabled:cursor-not-allowed active:scale-98"
              >
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  <span>PROCESAR SALIDA INMEDIATA</span>
                </div>
                <span className="text-[10px] font-medium text-amber-100">
                  Descuenta stock y celdas sin requerir orden previa
                </span>
              </button>

              {/* Guía rápida */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-150 text-[11px] text-amber-900 space-y-1">
                <span className="font-bold block flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
                  <span>Flujo Directo WMS:</span>
                </span>
                <p className="leading-relaxed">
                  Al pulsar el botón, el stock se descuenta automáticamente en tiempo real tanto en el catálogo como en las celdas físicas del almacén, quedando registrado en los tableros de Métricas.
                </p>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: HISTORIAL DE SALIDAS REALIZADAS                                  */}
      {/* ========================================================================= */}
      {activeView === 'history' && (
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-150">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Historial de Salidas Directas de Almacén
              </h3>
              <p className="text-xs text-slate-400">
                Registro de todas las salidas y remisiones completadas de forma directa
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportHistoryToExcel}
                disabled={dispatchHistory.length === 0}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <FileDown className="h-3.5 w-3.5 text-emerald-600" />
                <span>Exportar a Excel</span>
              </button>
            </div>
          </div>

          {dispatchHistory.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Clock className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">Aún no hay salidas registradas hoy</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Realice su primera salida directa desde la pestaña "Salida Directa" para visualizar el historial aquí.
              </p>
              <button
                type="button"
                onClick={() => setActiveView('express')}
                className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Hacer Salida Directa →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 text-left">Folio / Fecha</th>
                    <th className="pb-3 text-left">Producto / SKU</th>
                    <th className="pb-3 text-center">Cant.</th>
                    <th className="pb-3 text-left">Celdas de Picking</th>
                    <th className="pb-3 text-left">Destino</th>
                    <th className="pb-3 text-left">Medio de Entrega</th>
                    <th className="pb-3 text-left">Operador</th>
                    <th className="pb-3 text-right">Comprobante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dispatchHistory.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 font-mono">
                        <strong className="text-slate-900 block font-bold">{rec.id}</strong>
                        <span className="text-[10px] text-slate-400">
                          {new Date(rec.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </td>

                      <td className="py-3">
                        <strong className="text-slate-800 block">{rec.productName}</strong>
                        <span className="font-mono text-[10px] text-amber-700 font-bold">{rec.sku}</span>
                      </td>

                      <td className="py-3 text-center font-mono font-black text-slate-900">
                        {rec.qty} uds
                      </td>

                      <td className="py-3 font-mono text-[11px] text-slate-600">
                        {rec.originBins && rec.originBins.length > 0 ? (
                          rec.originBins.join(', ')
                        ) : (
                          'Inventario General'
                        )}
                      </td>

                      <td className="py-3 font-bold text-slate-800">
                        {rec.destination}
                      </td>

                      <td className="py-3 text-slate-600">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-semibold">
                          {rec.deliveryMethod}
                        </span>
                        {rec.trackingNumber && (
                          <span className="block font-mono text-[9px] text-slate-400 mt-0.5">
                            Guía: {rec.trackingNumber}
                          </span>
                        )}
                      </td>

                      <td className="py-3 font-mono text-[11px] text-slate-600">
                        {rec.operator}
                      </td>

                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setLastDispatchRecord(rec);
                            setShowTicketModal(true);
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ml-auto cursor-pointer shadow-3xs"
                        >
                          <Printer className="h-3 w-3 text-slate-500" />
                          <span>Ver Vale</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 3: PEDIDOS EN COLA TRADICIONALES (SI EXISTEN)                       */}
      {/* ========================================================================= */}
      {activeView === 'orders' && (
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-150">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Pedidos Programados en Cola
              </h3>
              <p className="text-xs text-slate-400">
                Órdenes pendientes de salida de almacén ({pendingOrdersList.length} pedidos)
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveView('express')}
              className="px-3.5 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
            >
              ← Volver a Salida Directa
            </button>
          </div>

          <div className="space-y-3">
            {pendingOrdersList.map(order => (
              <div
                key={order.id}
                className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                      {order.id}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {order.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      Creado: {new Date(order.dateCreated).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-xs text-slate-700">
                    Artículos:{' '}
                    {order.items.map(it => `${it.sku} (${it.qty} uds)`).join(', ')}
                  </div>
                </div>

                {onCompleteOrder && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onCompleteOrder(order.id);
                      setFeedback({ type: 'ok', text: `Salida del pedido ${order.id} registrada con éxito.` });
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    Registrar Salida →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CATÁLOGO DE PRODUCTOS PARA SELECCIONAR                             */}
      {/* ========================================================================= */}
      {isCatalogOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-scaleIn">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-150 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Seleccionar Producto del Catálogo
                </h3>
                <p className="text-xs text-slate-400">
                  Haga clic sobre cualquier artículo para seleccionarlo para la salida
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCatalogOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-150 space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Buscar por SKU, nombre, código de barras o categoría..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-250 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  autoFocus
                />
              </div>

              {/* Categorías */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition shrink-0 cursor-pointer ${
                    selectedCategoryFilter === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Todas ({inventory.length})
                </button>
                {categoriesList.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition shrink-0 cursor-pointer ${
                      selectedCategoryFilter === cat
                        ? 'bg-amber-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* List of Products */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1 divide-y divide-slate-100">
              {filteredCatalog.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No se encontraron productos coincidentes.
                </div>
              ) : (
                filteredCatalog.map(item => {
                  const itemBins = bins.filter(b => b.occupiedSku === item.sku && b.occupiedQty > 0);
                  const isOutOfStock = item.qty <= 0;
                  return (
                    <div
                      key={item.sku}
                      onClick={() => !isOutOfStock && handleSelectFromCatalog(item.sku)}
                      className={`p-3 rounded-2xl transition flex items-center justify-between gap-3 ${
                        isOutOfStock
                          ? 'opacity-40 cursor-not-allowed bg-slate-50'
                          : 'hover:bg-amber-50/60 cursor-pointer group'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded">
                            {item.sku}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {item.category}
                          </span>
                        </div>
                        <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-amber-800">
                          {item.name}
                        </h4>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {itemBins.length > 0 ? (
                            `En celdas: ${itemBins.map(b => b.id).join(', ')}`
                          ) : (
                            'Inventario General'
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-sm font-black font-mono block ${
                          isOutOfStock ? 'text-rose-600' : 'text-slate-900'
                        }`}>
                          {item.qty} uds
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {isOutOfStock ? 'Agotado' : 'Disponible'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCatalogOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VALE / COMPROBANTE DE SALIDA DIGITAL (LISTO PARA IMPRIMIR)        */}
      {/* ========================================================================= */}
      {showTicketModal && lastDispatchRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-scaleIn">
            
            {/* Header del Ticket */}
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-5 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold opacity-80">
                  Comprobante Oficial WMS
                </span>
                <h3 className="text-base font-black">
                  Vale de Salida de Almacén
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTicketModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Cuerpo del Ticket */}
            <div className="p-6 space-y-4 text-xs" id="printable-dispatch-ticket">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-900 font-bold">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>¡Salida completada exitosamente! El stock ha sido descontado.</span>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block">Folio de Salida:</span>
                  <strong className="text-sm font-mono font-black text-slate-900">{lastDispatchRecord.id}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block">Fecha y Hora:</span>
                  <span className="font-mono font-bold text-slate-700">
                    {new Date(lastDispatchRecord.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-2 border-t border-b border-slate-150 py-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500 font-medium">Producto:</span>
                  <strong className="text-slate-900 text-right">{lastDispatchRecord.productName}</strong>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500 font-medium">SKU:</span>
                  <span className="font-mono font-extrabold text-amber-800">{lastDispatchRecord.sku}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500 font-medium">Cantidad de Salida:</span>
                  <span className="font-mono font-black text-base text-slate-900">{lastDispatchRecord.qty} unidades</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500 font-medium">Celdas de Extracción:</span>
                  <span className="font-mono font-semibold text-slate-700 text-right">
                    {lastDispatchRecord.originBins.join(', ') || 'Inventario General'}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500 font-medium">Destino / Cliente:</span>
                  <strong className="text-slate-900 text-right">{lastDispatchRecord.destination}</strong>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500 font-medium">Medio de Entrega:</span>
                  <span className="font-bold text-slate-800 text-right">{lastDispatchRecord.deliveryMethod}</span>
                </div>
                {lastDispatchRecord.trackingNumber && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500 font-medium">Guía / Referencia:</span>
                    <span className="font-mono text-slate-700">{lastDispatchRecord.trackingNumber}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500 font-medium">Operador Responsable:</span>
                  <span className="font-mono font-bold text-slate-800">{lastDispatchRecord.operator}</span>
                </div>
              </div>

              <div className="text-[10px] text-center text-slate-400">
                Documento de control interno generado automáticamente por O-WMS PRO.
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="p-4 bg-slate-50 border-t border-slate-150 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <Printer className="h-4 w-4 text-slate-500" />
                <span>Imprimir Vale</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTicketModal(false)}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Realizar Otra Salida →
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
