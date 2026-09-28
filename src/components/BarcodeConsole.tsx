import React, { useState, useEffect, useMemo } from 'react';
import { Bin, InventoryItem, Order } from '../types';
import { 
  Scan, 
  HelpCircle, 
  Check, 
  AlertTriangle, 
  ShieldCheck, 
  RefreshCw, 
  Barcode, 
  MapPin, 
  Sparkles, 
  ArrowRight, 
  Package, 
  Layers, 
  Plus, 
  X, 
  Info, 
  ExternalLink, 
  Boxes, 
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  FolderPlus,
  Compass,
  Tag
} from 'lucide-react';

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
  onNavigateToInventory?: () => void;
  onAddInventory?: (item: InventoryItem) => Promise<void>;
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
  selectedBarcode,
  onNavigateToInventory,
  onAddInventory
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
  const [sourcePickBinId, setSourcePickBinId] = useState('');
  const [qtyToProcess, setQtyToProcess] = useState<number>(10);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  
  // Cycle count specific
  const [physicalCount, setPhysicalCount] = useState<number>(0);

  // Operation status message tracking
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Quick Register Modal state
  const [showQuickRegisterModal, setShowQuickRegisterModal] = useState(false);
  const [quickSku, setQuickSku] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickBarcode, setQuickBarcode] = useState('');
  const [quickCategory, setQuickCategory] = useState('Almacenamiento General');
  const [quickWeight, setQuickWeight] = useState<number>(1);
  const [quickMinQty, setQuickMinQty] = useState<number>(10);
  const [quickSupplier, setQuickSupplier] = useState('');
  const [isSavingQuickSku, setIsSavingQuickSku] = useState(false);

  // Helper to lookup barcode or SKU with robust string cleaning
  const findProductByBarcode = (code: string) => {
    if (!code) return null;
    const clean = code.trim().replace(/[\r\n]/g, '').toLowerCase();
    if (!clean) return null;
    return inventory.find(i => {
      const bClean = (i.barcode || '').trim().replace(/[\r\n]/g, '').toLowerCase();
      const sClean = (i.sku || '').trim().replace(/[\r\n]/g, '').toLowerCase();
      return bClean === clean || sClean === clean;
    });
  };

  // Clean current scanned input
  const cleanInputCode = scannedBarcode.trim().replace(/[\r\n]/g, '');

  // Producto detectado en tiempo real
  const scannedProduct = useMemo(() => {
    if (!cleanInputCode) return null;
    return findProductByBarcode(cleanInputCode);
  }, [cleanInputCode, inventory]);

  // Estado de escaneo desconocido ("No se tiene registro")
  const isUnknownProduct = Boolean(cleanInputCode.length >= 3 && !scannedProduct);

  // Celdas en almacén que actualmente contienen este producto (¿En qué posición está?)
  const currentBinsWithProduct = useMemo(() => {
    if (!scannedProduct) return [];
    return bins.filter(b => b.occupiedSku === scannedProduct.sku && (b.occupiedQty || 0) > 0);
  }, [scannedProduct, bins]);

  // Total de unidades físicas actualmente en estanterías
  const totalPhysicalQtyInBins = useMemo(() => {
    return currentBinsWithProduct.reduce((sum, b) => sum + (b.occupiedQty || 0), 0);
  }, [currentBinsWithProduct]);

  // SUGERENCIA DE POSICIÓN PARA ENTRADAS (¿Dónde debe de ir? / Putaway Sugerido)
  const inboundSuggestion = useMemo(() => {
    if (!scannedProduct) return null;

    // 1. Prioridad 1: Consolidación en celda existente con espacio libre (< 100 uds)
    const partialBin = currentBinsWithProduct.find(b => b.status === 'Partial' || (b.occupiedQty || 0) < 100);
    if (partialBin) {
      return {
        bin: partialBin,
        badge: 'Consolidación de Stock Existente',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        reason: `Esta celda ya contiene ${partialBin.occupiedQty} unidades de ${scannedProduct.sku} y tiene capacidad disponible. Se sugiere consolidar aquí para evitar fragmentación.`
      };
    }

    // 2. Prioridad 2: Celda vacía en el mismo pasillo donde ya hay stock de este SKU
    if (currentBinsWithProduct.length > 0) {
      const existingAisle = currentBinsWithProduct[0].aisle;
      const sameAisleEmptyBin = bins.find(b => (b.status === 'Empty' || !b.occupiedSku) && b.aisle === existingAisle);
      if (sameAisleEmptyBin) {
        return {
          bin: sameAisleEmptyBin,
          badge: `Mismo Pasillo (${existingAisle})`,
          badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
          reason: `Celda vacía en el Pasillo ${existingAisle} para concentrar y mantener agrupados los artículos del mismo SKU.`
        };
      }
    }

    // 3. Prioridad 3: Ergonomía de peso (pesados > 15kg en Nivel L1 suelo)
    const isHeavy = (scannedProduct.unitWeight || 1) >= 15;
    if (isHeavy) {
      const heavyBin = bins.find(b => (b.status === 'Empty' || !b.occupiedSku) && b.level === 'L1');
      if (heavyBin) {
        return {
          bin: heavyBin,
          badge: 'Ergonomía Nivel 1 (Carga Pesada)',
          badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
          reason: `Artículo pesado (${scannedProduct.unitWeight} kg/ud). Se sugiere ubicar en nivel L1 (suelo) en Pasillo ${heavyBin.aisle}, Rack ${heavyBin.rack} para manipulación segura.`
        };
      }
    }

    // 4. Prioridad 4: Zonificación logística por categoría
    const cat = (scannedProduct.category || '').toLowerCase();
    let preferredAisle = 'A';
    if (cat.includes('peligro') || cat.includes('hazmat') || cat.includes('bater') || cat.includes('quím')) {
      preferredAisle = 'B';
    } else if (cat.includes('cable') || cat.includes('pesad') || cat.includes('granel') || cat.includes('materia')) {
      preferredAisle = 'C';
    } else if (cat.includes('ropa') || cat.includes('textil') || cat.includes('empaque') || cat.includes('caja')) {
      preferredAisle = 'D';
    }

    const categoryBin = bins.find(b => (b.status === 'Empty' || !b.occupiedSku) && b.aisle === preferredAisle);
    if (categoryBin) {
      return {
        bin: categoryBin,
        badge: `Zona Pasillo ${preferredAisle}`,
        badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        reason: `Ubicación recomendada para la categoría "${scannedProduct.category}" en Pasillo ${preferredAisle} (Rack ${categoryBin.rack}, Nivel ${categoryBin.level}).`
      };
    }

    // 5. Fallback: Cualquier celda vacía con nivel ergonómico bajo (L1 o L2)
    const emptyBinL1 = bins.find(b => (b.status === 'Empty' || !b.occupiedSku) && (b.level === 'L1' || b.level === 'L2'));
    const anyEmpty = emptyBinL1 || bins.find(b => b.status === 'Empty' || !b.occupiedSku);
    if (anyEmpty) {
      return {
        bin: anyEmpty,
        badge: 'Espacio Libre Inmediato',
        badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
        reason: `Celda vacía con acceso rápido en Pasillo ${anyEmpty.aisle}, Rack ${anyEmpty.rack}, Nivel ${anyEmpty.level}.`
      };
    }

    return null;
  }, [scannedProduct, currentBinsWithProduct, bins]);

  // SUGERENCIA DE POSICIÓN PARA SALIDAS (¿De qué celda debe salir? / Picking Sugerido)
  const outboundSuggestion = useMemo(() => {
    if (!scannedProduct) return null;

    if (currentBinsWithProduct.length === 0) {
      return {
        bin: null,
        badge: 'Sin Stock en Estantería',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
        reason: `El producto "${scannedProduct.name}" está registrado en catálogo, pero actualmente no tiene unidades asignadas en ninguna celda física del almacén.`
      };
    }

    // Estrategia de compactación y ergonomía:
    // Ordenar: primero celdas con menor cantidad para vaciar celdas parciales, luego nivel ergonómico bajo
    const sorted = [...currentBinsWithProduct].sort((a, b) => {
      if (a.occupiedQty !== b.occupiedQty) {
        return a.occupiedQty - b.occupiedQty;
      }
      return a.level.localeCompare(b.level);
    });

    const bestPick = sorted[0];
    return {
      bin: bestPick,
      badge: 'Posición Óptima de Extracción (Picking)',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      reason: `Se sugiere extraer de la Celda ${bestPick.id} (Pasillo ${bestPick.aisle}, Rack ${bestPick.rack}, Nivel ${bestPick.level}). Tiene ${bestPick.occupiedQty} unidades disponibles y permite desocupar celdas parciales.`
    };
  }, [scannedProduct, currentBinsWithProduct]);

  // Órdenes pendientes que requieren el SKU escaneado (en Salidas)
  const pendingOutboundOrders = useMemo(() => {
    return orders.filter(o => o.type === 'Outbound' && (o.status === 'Pending' || o.status === 'Picking'));
  }, [orders]);

  const matchingPendingOrders = useMemo(() => {
    if (!scannedProduct) return [];
    return pendingOutboundOrders.filter(o => o.items.some(it => it.sku === scannedProduct.sku));
  }, [scannedProduct, pendingOutboundOrders]);

  // Auto-seleccionar celda sugerida en Entradas si está vacía
  useEffect(() => {
    if (activeModule === 'entrada' && inboundSuggestion?.bin && !targetBinId) {
      setTargetBinId(inboundSuggestion.bin.id);
    }
  }, [inboundSuggestion, activeModule, targetBinId]);

  // Auto-sugerir celda de extracción en Salidas
  useEffect(() => {
    if (activeModule === 'salida' && outboundSuggestion?.bin && !sourcePickBinId) {
      setSourcePickBinId(outboundSuggestion.bin.id);
    }
  }, [outboundSuggestion, activeModule, sourcePickBinId]);

  const showFeedback = (text: string, type: 'ok' | 'err' = 'ok') => {
    setFeedbackMsg({ type, text });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 8000);
  };

  // Abrir modal de alta rápida
  const handleOpenQuickRegister = () => {
    const code = cleanInputCode || '';
    setQuickBarcode(code);
    const suffix = code.replace(/\D/g, '').slice(-5) || Math.floor(1000 + Math.random() * 9000).toString();
    setQuickSku(`SKU-${suffix}`);
    setQuickName('');
    setQuickCategory('Almacenamiento General');
    setQuickWeight(1);
    setQuickMinQty(10);
    setQuickSupplier('');
    setShowQuickRegisterModal(true);
  };

  // Guardar nuevo SKU desde alta rápida
  const handleSaveQuickSku = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSku.trim() || !quickName.trim()) {
      showFeedback('El código SKU y el nombre del producto son requeridos.', 'err');
      return;
    }
    setIsSavingQuickSku(true);
    try {
      const newItem: InventoryItem = {
        sku: quickSku.trim().toUpperCase(),
        name: quickName.trim(),
        description: `Artículo ${quickName.trim()} registrado vía consola de escaneo`,
        barcode: quickBarcode.trim(),
        category: quickCategory,
        unitWeight: Number(quickWeight) || 1,
        qty: 0,
        minQty: Number(quickMinQty) || 10,
        expirationDate: '',
        unitWidth: 20,
        unitHeight: 20,
        unitLength: 20,
        supplier: quickSupplier.trim() || 'Proveedor Local',
        cost: 0
      };

      if (onAddInventory) {
        await onAddInventory(newItem);
      }

      setShowQuickRegisterModal(false);
      setScannedBarcode(newItem.barcode || newItem.sku);
      showFeedback(`✓ SKU ${newItem.sku} dado de alta con éxito en el catálogo. Ya cuenta con registro en el sistema.`);
    } catch (err: any) {
      showFeedback(`Error al registrar SKU: ${err.message}`, 'err');
    } finally {
      setIsSavingQuickSku(false);
    }
  };

  // 1. Proceso de Entrada (Inbound Putaway via Barcode)
  const handleInboundScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedBarcode.trim()) {
      showFeedback('Por favor, ingrese o escanee un código de barras de material.', 'err');
      return;
    }

    const prod = findProductByBarcode(scannedBarcode);
    if (!prod) {
      showFeedback(`⚠️ SIN REGISTRO: No se tiene registro del código escaneado "${scannedBarcode}". Debe registrar el SKU en el catálogo antes de ingresar mercancía.`, 'err');
      return;
    }

    if (!targetBinId.trim()) {
      showFeedback('Por favor, especifique o acepte la celda de destino recomendada.', 'err');
      return;
    }

    const targetBin = bins.find(b => b.id === targetBinId.trim().toUpperCase());
    if (!targetBin) {
      showFeedback(`La celda de destino "${targetBinId}" no existe en el mapa del almacén.`, 'err');
      return;
    }

    if (targetBin.occupiedSku && targetBin.occupiedSku !== prod.sku) {
      showFeedback(`La celda "${targetBinId}" ya está ocupada por otro SKU (${targetBin.occupiedSku}).`, 'err');
      return;
    }

    setIsProcessing(true);
    try {
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
        `Entrada de ${qtyToProcess} unidades de ${prod.sku} (${prod.name}) acomodadas en celda ${targetBin.id} vía Lectura de Escáner.`
      );

      showFeedback(`✓ ENTRADA EXITOSA: Se ingresaron ${qtyToProcess} unidades de ${prod.name} en celda ${targetBin.id}. Posición y stock sincronizados.`);
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
    if (!scannedBarcode.trim()) {
      showFeedback('Escanee el código de barras del producto a despachar.', 'err');
      return;
    }

    const scannedProductFound = findProductByBarcode(scannedBarcode);
    if (!scannedProductFound) {
      showFeedback(`⚠️ SIN REGISTRO: No se tiene registro del código escaneado "${scannedBarcode}". No se puede despachar un artículo inexistente en el catálogo.`, 'err');
      return;
    }

    if (!selectedOrderId) {
      showFeedback('Seleccione una orden de salida activa para despachar el material escaneado.', 'err');
      return;
    }

    const order = orders.find(o => o.id === selectedOrderId);
    if (!order) {
      showFeedback('La orden seleccionada no es válida.', 'err');
      return;
    }

    // Verify if item belongs to order
    const orderItem = order.items.find(item => item.sku === scannedProductFound.sku);
    if (!orderItem) {
      showFeedback(`Error de Verificación: El SKU ${scannedProductFound.sku} no forma parte de la Orden ${order.id}.`, 'err');
      return;
    }

    // Check inventory stock availability
    if (scannedProductFound.qty < orderItem.qty) {
      showFeedback(`Error de Stock: Stock insuficiente en almacén (${scannedProductFound.qty} unidades) para despachar las ${orderItem.qty} unidades solicitadas.`, 'err');
      return;
    }

    setIsProcessing(true);
    try {
      let qtyRemainingToDeduct = orderItem.qty;
      
      // If a specific source bin was chosen (or recommended), deduct from it first
      const preferredBinId = sourcePickBinId;

      const updatedBins = bins.map(b => {
        if (b.occupiedSku === scannedProductFound.sku && qtyRemainingToDeduct > 0) {
          // If preferred bin exists, handle it
          if (preferredBinId && b.id === preferredBinId) {
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
        }
        return b;
      }).map(b => {
        // Handle remainder from any other bin holding this SKU
        if (b.occupiedSku === scannedProductFound.sku && qtyRemainingToDeduct > 0) {
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

      const updatedInventory = inventory.map(i => {
        if (i.sku === scannedProductFound.sku) {
          return { ...i, qty: Math.max(0, i.qty - orderItem.qty) };
        }
        return i;
      });

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
        'Despacho Validado por Escáner',
        `Orden ${order.id} despachada tras lectura y validación de ${orderItem.qty} unidades de ${scannedProductFound.sku}. Guía: ${trackingNo}`
      );

      showFeedback(`✓ SALIDA EXITOSA: Despacho completado para la Orden ${order.id}. Se extrajeron y validaron ${orderItem.qty} unidades de ${scannedProductFound.name}.`);
      setScannedBarcode('');
      setSelectedOrderId('');
      setSourcePickBinId('');
    } catch (err: any) {
      showFeedback(`Error al procesar salida: ${err.message}`, 'err');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Proceso de Conteo Cíclico
  const handleCycleCountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedBarcode.trim()) {
      showFeedback('Escanee un código de barras o SKU a auditar.', 'err');
      return;
    }

    const prod = findProductByBarcode(scannedBarcode);
    if (!prod) {
      showFeedback(`⚠️ SIN REGISTRO: No se tiene registro del código escaneado "${scannedBarcode}". El producto no existe en el catálogo central.`, 'err');
      return;
    }

    const systemQty = prod.qty;
    const diff = physicalCount - systemQty;

    onLogCountSession(prod.sku, physicalCount, systemQty);

    if (diff === 0) {
      showFeedback(`✓ CONTEO PERFECTO: Conteo físico de ${prod.sku} coincide al 100% con el sistema (${systemQty} unidades).`, 'ok');
    } else {
      showFeedback(`⚠️ DISCREPANCIA DETECTADA: Físico: ${physicalCount} vs Sistema: ${systemQty}. Diferencia: ${diff > 0 ? '+' : ''}${diff} unidades.`, 'err');
    }

    setScannedBarcode('');
    setPhysicalCount(0);
  };

  return (
    <div className="space-y-6">
      
      {/* Module Title Banner */}
      {!hideHeader && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-md border border-slate-700/50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
                  <Barcode className="h-4 w-4 animate-pulse" />
                </div>
                <h2 className="text-sm font-extrabold tracking-widest uppercase font-mono text-slate-300">
                  Consola Escáner de Códigos de Barras
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Lectura y validación de producto por código de barras, comprobación inmediata de registro y recomendación de posición física (dónde está o a qué celda debe ir).
              </p>
            </div>
            <span className="text-[10px] font-mono tracking-widest uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-xl">
              Lector en Vivo
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
            📥 Recepción y Entradas
          </button>
          <button
            onClick={() => { setActiveModule('salida'); setFeedbackMsg(null); }}
            className={`py-3 px-4 rounded-xl border font-bold text-xs uppercase cursor-pointer tracking-wider transition ${
              activeModule === 'salida'
                ? 'bg-amber-600 text-white border-amber-500 shadow'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            📤 Despacho y Salidas
          </button>
          <button
            onClick={() => { setActiveModule('conteo'); setFeedbackMsg(null); }}
            className={`py-3 px-4 rounded-xl border font-bold text-xs uppercase cursor-pointer tracking-wider transition ${
              activeModule === 'conteo'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            🔄 Conteo Cíclico
          </button>
        </div>
      )}

      {/* Operational Module Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Scanner Input Area (8 Cols) */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold font-mono uppercase text-slate-700 flex items-center gap-2">
              <Scan className="h-4 w-4 text-blue-600" />
              <span>
                {activeModule === 'entrada' && 'Operación de Entrada (Receiving & Putaway)'}
                {activeModule === 'salida' && 'Operación de Salida (Picking & Despacho)'}
                {activeModule === 'conteo' && 'Auditoría de Conteo Cíclico (Cyclic Auditing)'}
              </span>
            </span>
            <div className="flex items-center gap-1.5 text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 rounded-lg font-mono uppercase font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Lector de Código Activo
            </div>
          </div>

          {/* Feedback response msg */}
          {feedbackMsg && (
            <div className={`p-4 rounded-2xl border flex items-start gap-2.5 text-xs font-semibold animate-fadeIn ${
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

          {/* ======================================================== */}
          {/* FORMULARIO 1: ENTRADAS (INBOUND RECEIVING & PUTAWAY)     */}
          {/* ======================================================== */}
          {activeModule === 'entrada' && (
            <form onSubmit={handleInboundScanSubmit} className="space-y-4">
              
              <div className="bg-blue-50/60 rounded-2xl p-3.5 border border-blue-150 text-[11px] text-blue-900 leading-relaxed flex items-start gap-2.5">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Operación de Entradas:</strong> Escanee el código de barras del producto. Si no tiene registro, la plataforma lo advertirá al instante y le permitirá darlo de alta. Si ya tiene registro, <strong>le indicará en qué posición se encuentra actualmente y a qué celda debe ir</strong> (Putaway sugerido).
                </div>
              </div>

              {/* Input de Escaneo y Selector de Celda */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                    Escaneo del Código de Barras (EAN-13 / SKU)
                  </label>
                  <div className="relative flex items-center">
                    <Scan className="absolute left-3.5 h-4 w-4 text-blue-600" />
                    <input
                      type="text"
                      value={scannedBarcode}
                      onChange={(e) => setScannedBarcode(e.target.value)}
                      placeholder="Escanee o ingrese código EAN-13 / SKU"
                      className="w-full pl-10 pr-9 py-3 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-white shadow-2xs"
                      required
                      autoFocus
                    />
                    {scannedBarcode && (
                      <button
                        type="button"
                        onClick={() => setScannedBarcode('')}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
                        title="Limpiar código"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Celda de Destino en Almacén (Bin ID)
                    </label>
                    {inboundSuggestion?.bin && (
                      <span className="text-[9px] font-bold text-blue-600 flex items-center gap-1 font-mono">
                        <Sparkles className="h-3 w-3" />
                        <span>Sugerida: {inboundSuggestion.bin.id}</span>
                      </span>
                    )}
                  </div>
                  <select
                    value={targetBinId}
                    onChange={(e) => setTargetBinId(e.target.value)}
                    className="w-full p-3 text-xs font-mono border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-white text-slate-800 font-bold shadow-2xs cursor-pointer"
                    required
                  >
                    <option value="">-- Seleccionar Ubicación --</option>
                    {inboundSuggestion?.bin && (
                      <option value={inboundSuggestion.bin.id} className="font-extrabold text-blue-700 bg-blue-50">
                        ⭐ [RECOMENDADA] {inboundSuggestion.bin.id} — {inboundSuggestion.badge}
                      </option>
                    )}
                    {bins.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.id} (Pasillo {b.aisle}, Nivel {b.level}) {b.occupiedSku ? `[Ocupado: ${b.occupiedSku} - ${b.occupiedQty}u]` : '[Libre/Vacío]'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ======================================================== */}
              {/* ALERTA EN ENTRADAS: PRODUCTO SIN REGISTRO                */}
              {/* ======================================================== */}
              {isUnknownProduct && (
                <div className="bg-amber-50/95 border-2 border-amber-400 rounded-2xl p-4.5 text-amber-950 space-y-3 animate-fadeIn shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-amber-200 text-amber-950 text-[9.5px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full border border-amber-300">
                          ⚠️ Sin Registro
                        </span>
                        <h4 className="text-xs font-black uppercase font-mono text-amber-950">
                          Producto No Registrado en el Sistema
                        </h4>
                      </div>
                      <p className="text-xs text-amber-950 mt-1.5 leading-relaxed">
                        <strong>No se tiene registro del producto escaneado:</strong> Código <strong className="font-mono bg-white px-2 py-0.5 rounded border border-amber-300 text-slate-900">{scannedBarcode}</strong>.
                      </p>
                      <p className="text-[11px] text-amber-900/90 mt-1 leading-normal">
                        Este código no coincide con ningún SKU ni código de barras EAN-13 en la base de datos de inventario. Para ubicar y almacenar este material, primero debe darlo de alta en el catálogo.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-amber-200">
                    <button
                      type="button"
                      onClick={() => setScannedBarcode('')}
                      className="text-xs font-bold text-amber-900 hover:text-amber-950 bg-white hover:bg-amber-100/50 border border-amber-300 px-3.5 py-2 rounded-xl transition cursor-pointer"
                    >
                      Limpiar Escaneo
                    </button>
                    {onNavigateToInventory && (
                      <button
                        type="button"
                        onClick={onNavigateToInventory}
                        className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Ver Catálogo</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleOpenQuickRegister}
                      className="text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 active:scale-98 px-4 py-2 rounded-xl transition shadow-xs cursor-pointer flex items-center gap-2"
                    >
                      <FolderPlus className="h-4 w-4" />
                      <span>Dar de Alta SKU con este Código</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* FICHA DE PRODUCTO EN ENTRADAS CON POSICIÓN ACTUAL Y      */}
              {/* SUGERENCIA DE A DÓNDE DEBE IR (PUTAWAY)                  */}
              {/* ======================================================== */}
              {scannedProduct && (
                <div className="space-y-3.5 animate-fadeIn">
                  
                  {/* Tarjeta de Identificación del Producto */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {scannedProduct.imageUrl ? (
                        <img
                          src={scannedProduct.imageUrl}
                          alt={scannedProduct.name}
                          className="h-16 w-16 object-cover rounded-xl border border-slate-300 bg-white shrink-0 shadow-2xs"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-xl border border-slate-300 bg-white flex items-center justify-center text-slate-400 shrink-0">
                          <Package className="h-7 w-7" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                            {scannedProduct.sku}
                          </span>
                          <span className="text-[9.5px] font-mono font-bold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded">
                            EAN: {scannedProduct.barcode || 'N/A'}
                          </span>
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            <span>Registrado en Catálogo</span>
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-slate-900 mt-1 leading-tight truncate">
                          {scannedProduct.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[10.5px] text-slate-500 mt-1">
                          <span>Categoría: <strong>{scannedProduct.category}</strong></span>
                          <span>•</span>
                          <span>Peso Unitario: <strong>{scannedProduct.unitWeight} kg</strong></span>
                          <span>•</span>
                          <span>Proveedor: <strong>{scannedProduct.supplier || 'N/A'}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block font-mono">Stock en Almacén</span>
                      <span className="text-lg font-black font-mono text-slate-900 block leading-tight">
                        {scannedProduct.qty} <span className="text-xs font-normal text-slate-500">uds</span>
                      </span>
                      <span className="text-[9.5px] font-bold text-emerald-600 block mt-0.5">
                        {totalPhysicalQtyInBins} uds ubicadas en {currentBinsWithProduct.length} {currentBinsWithProduct.length === 1 ? 'celda' : 'celdas'}
                      </span>
                    </div>
                  </div>

                  {/* 1. ¿EN QUÉ POSICIÓN ESTÁ ACTUALMENTE? */}
                  <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-slate-600" />
                        <span>¿En qué posición está actualmente?:</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {currentBinsWithProduct.length} {currentBinsWithProduct.length === 1 ? 'ubicación encontrada' : 'ubicaciones encontradas'}
                      </span>
                    </div>

                    {currentBinsWithProduct.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                        {currentBinsWithProduct.map(b => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setTargetBinId(b.id)}
                            className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                              targetBinId === b.id
                                ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300'
                                : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                            }`}
                          >
                            <div>
                              <span className="font-mono font-black text-xs text-slate-900 block">
                                Celda {b.id}
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                Pasillo {b.aisle} • Rack {b.rack} • Nivel {b.level}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-800 px-2 py-1 rounded-lg">
                              {b.occupiedQty} uds
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white p-3 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs flex items-center gap-2">
                        <Info className="h-4 w-4 text-slate-400 shrink-0" />
                        <span>Actualmente no tiene unidades ubicadas en ninguna celda física (0 unidades en estantería). Debe asignarse a una nueva celda libre.</span>
                      </div>
                    )}
                  </div>

                  {/* 2. ¿A QUÉ POSICIÓN DEBE IR? (PUTAWAY SUGERIDO) */}
                  <div className="bg-gradient-to-r from-blue-50 via-indigo-50/70 to-blue-50 border-2 border-blue-200 rounded-2xl p-4.5 space-y-3 shadow-xs">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-black uppercase tracking-wider text-blue-950">
                              Posición Sugerida de Almacenamiento (¿Dónde debe ir?)
                            </span>
                            {inboundSuggestion && (
                              <span className={`text-[9.5px] font-bold font-mono px-2.5 py-0.5 rounded-full border ${inboundSuggestion.badgeColor}`}>
                                {inboundSuggestion.badge}
                              </span>
                            )}
                          </div>

                          {inboundSuggestion?.bin ? (
                            <div className="mt-1.5">
                              <p className="text-xs text-slate-900 font-semibold leading-relaxed">
                                Se sugiere ubicar en la celda: <strong className="font-mono text-blue-700 bg-white px-2 py-0.5 rounded-md border border-blue-200 text-sm">{inboundSuggestion.bin.id}</strong>
                                <span className="text-slate-600 font-normal ml-2">
                                  (Pasillo {inboundSuggestion.bin.aisle}, Rack {inboundSuggestion.bin.rack}, Nivel {inboundSuggestion.bin.level})
                                </span>
                              </p>
                              <p className="text-[11px] text-slate-600 mt-1">
                                {inboundSuggestion.reason}
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-700 mt-1">
                              No hay celdas libres disponibles en este momento. Verifique la capacidad en el mapa.
                            </p>
                          )}
                        </div>
                      </div>

                      {inboundSuggestion?.bin && (
                        <button
                          type="button"
                          onClick={() => setTargetBinId(inboundSuggestion.bin.id)}
                          className={`shrink-0 text-xs font-extrabold px-4 py-2.5 rounded-xl border transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                            targetBinId === inboundSuggestion.bin.id
                              ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-300'
                              : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-100/50'
                          }`}
                        >
                          <Check className="h-4 w-4" />
                          <span>{targetBinId === inboundSuggestion.bin.id ? 'Posición Asignada' : 'Asignar Posición Sugerida'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                  Cantidad de Unidades a Ingresar
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={qtyToProcess}
                  onChange={(e) => setQtyToProcess(Number(e.target.value))}
                  className="w-full p-3 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-white shadow-2xs"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-2xl text-xs uppercase tracking-wider shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Procesando Entrada y Ubicación...</span>
                  </>
                ) : (
                  <>
                    <ArrowDownLeft className="h-4 w-4" />
                    <span>Confirmar Entrada y Ubicar en Celda</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ======================================================== */}
          {/* FORMULARIO 2: SALIDAS (OUTBOUND PICKING & DISPATCH)      */}
          {/* ======================================================== */}
          {activeModule === 'salida' && (
            <form onSubmit={handleOutboundScanSubmit} className="space-y-4">
              
              <div className="bg-amber-50/60 rounded-2xl p-3.5 border border-amber-150 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2.5">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Operación de Salidas:</strong> Escanee el código de barras del producto a despachar. Si no tiene registro, la plataforma lo indicará claramente. Si está registrado, <strong>le mostrará en qué posición está físicamente y de qué celda se sugiere extraer</strong> para agilizar el picking.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                    Escaneo Código de Barras de Material a Despachar
                  </label>
                  <div className="relative flex items-center">
                    <Scan className="absolute left-3.5 h-4 w-4 text-amber-600" />
                    <input
                      type="text"
                      value={scannedBarcode}
                      onChange={(e) => setScannedBarcode(e.target.value)}
                      placeholder="Escanee código EAN-13 o SKU"
                      className="w-full pl-10 pr-9 py-3 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-amber-500 focus:outline-none bg-white shadow-2xs"
                      required
                      autoFocus
                    />
                    {scannedBarcode && (
                      <button
                        type="button"
                        onClick={() => setScannedBarcode('')}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                    Seleccionar Orden de Salida Solicitada
                  </label>
                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="w-full p-3 text-xs font-mono border border-slate-200 rounded-xl focus:border-amber-500 focus:outline-none bg-white text-slate-800 font-bold shadow-2xs cursor-pointer"
                    required
                  >
                    <option value="">-- Seleccionar Orden Activa --</option>
                    {pendingOutboundOrders.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.id} - {o.assignedTo} ({o.items.length} artículos requeridos)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ======================================================== */}
              {/* ALERTA EN SALIDAS: PRODUCTO SIN REGISTRO                 */}
              {/* ======================================================== */}
              {isUnknownProduct && (
                <div className="bg-amber-50/95 border-2 border-amber-400 rounded-2xl p-4.5 text-amber-950 space-y-3 animate-fadeIn shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-amber-200 text-amber-950 text-[9.5px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full border border-amber-300">
                          ⚠️ Sin Registro
                        </span>
                        <h4 className="text-xs font-black uppercase font-mono text-amber-950">
                          Producto No Registrado en el Sistema
                        </h4>
                      </div>
                      <p className="text-xs text-amber-950 mt-1.5 leading-relaxed">
                        <strong>No se tiene registro del código escaneado:</strong> <strong className="font-mono bg-white px-2 py-0.5 rounded border border-amber-300 text-slate-900">{scannedBarcode}</strong>.
                      </p>
                      <p className="text-[11px] text-amber-900/90 mt-1">
                        No se puede procesar ni validar una salida para un material que no existe en el catálogo central de inventario. Verifique la etiqueta física del producto o coteje con la orden correspondiente.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-amber-200">
                    <button
                      type="button"
                      onClick={() => setScannedBarcode('')}
                      className="text-xs font-bold text-amber-900 hover:text-amber-950 bg-white border border-amber-300 px-3.5 py-2 rounded-xl transition cursor-pointer"
                    >
                      Limpiar Escaneo
                    </button>
                    {onNavigateToInventory && (
                      <button
                        type="button"
                        onClick={onNavigateToInventory}
                        className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Consultar Catálogo</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* FICHA DE PRODUCTO EN SALIDAS CON POSICIONES Y SUGERENCIA */}
              {/* ======================================================== */}
              {scannedProduct && (
                <div className="space-y-3.5 animate-fadeIn">
                  
                  {/* Ficha de producto */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {scannedProduct.imageUrl ? (
                        <img
                          src={scannedProduct.imageUrl}
                          alt={scannedProduct.name}
                          className="h-16 w-16 object-cover rounded-xl border border-slate-300 bg-white shrink-0 shadow-2xs"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-xl border border-slate-300 bg-white flex items-center justify-center text-slate-400 shrink-0">
                          <Package className="h-7 w-7" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            {scannedProduct.sku}
                          </span>
                          <span className="text-[9.5px] font-mono font-bold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded">
                            EAN: {scannedProduct.barcode || 'N/A'}
                          </span>
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            <span>Registrado en Catálogo</span>
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-slate-900 mt-1 leading-tight truncate">
                          {scannedProduct.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[10.5px] text-slate-500 mt-1">
                          <span>Categoría: <strong>{scannedProduct.category}</strong></span>
                          <span>•</span>
                          <span>Stock Total en Catálogo: <strong>{scannedProduct.qty} uds</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block font-mono">Disponibilidad en Celdas</span>
                      <span className="text-lg font-black font-mono text-slate-900 block leading-tight">
                        {totalPhysicalQtyInBins} <span className="text-xs font-normal text-slate-500">uds ubicadas</span>
                      </span>
                      <span className="text-[9.5px] font-bold text-amber-600 block mt-0.5">
                        {currentBinsWithProduct.length} {currentBinsWithProduct.length === 1 ? 'celda física' : 'celdas físicas'}
                      </span>
                    </div>
                  </div>

                  {/* Sugerencia de Orden si no se ha seleccionado ninguna */}
                  {!selectedOrderId && matchingPendingOrders.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <Tag className="h-4 w-4 text-amber-700 shrink-0" />
                        <div>
                          <span className="font-bold text-amber-950 block">
                            Orden sugerida para este producto:
                          </span>
                          <span className="text-amber-800 text-[11px]">
                            La Orden <strong>{matchingPendingOrders[0].id}</strong> ({matchingPendingOrders[0].assignedTo}) requiere {matchingPendingOrders[0].items.find(i => i.sku === scannedProduct.sku)?.qty} uds de este SKU.
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedOrderId(matchingPendingOrders[0].id)}
                        className="text-xs font-extrabold bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-xl transition cursor-pointer shrink-0"
                      >
                        Asignar Orden {matchingPendingOrders[0].id}
                      </button>
                    </div>
                  )}

                  {/* 1. ¿EN QUÉ POSICIÓN ESTÁ FÍSICAMENTE? */}
                  <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                        <Boxes className="h-4 w-4 text-amber-600" />
                        <span>¿En qué posición está físicamente ubicado?:</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {currentBinsWithProduct.length} {currentBinsWithProduct.length === 1 ? 'celda activa' : 'celdas activas'}
                      </span>
                    </div>

                    {currentBinsWithProduct.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                        {currentBinsWithProduct.map(b => {
                          const isOptimal = outboundSuggestion?.bin?.id === b.id;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => setSourcePickBinId(b.id)}
                              className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                                sourcePickBinId === b.id
                                  ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300'
                                  : isOptimal
                                    ? 'bg-emerald-50/60 border-emerald-300'
                                    : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-slate-50'
                              }`}
                            >
                              <div>
                                <span className="font-mono font-black text-xs text-slate-900 block flex items-center gap-1">
                                  {isOptimal && <span className="text-emerald-600 text-[10px]">⭐</span>}
                                  Celda {b.id}
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                  Pasillo {b.aisle} • Nivel {b.level}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono font-bold bg-white text-slate-800 border border-slate-200 px-2 py-1 rounded-lg">
                                {b.occupiedQty} uds
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                        <span>Sin unidades en estanterías físicas (0 uds ubicadas). No se puede realizar picking desde celdas.</span>
                      </div>
                    )}
                  </div>

                  {/* 2. ¿DE QUÉ POSICIÓN DEBE SALIR? (PICKING SUGERIDO) */}
                  <div className="bg-gradient-to-r from-amber-50 via-orange-50/70 to-amber-50 border-2 border-amber-200 rounded-2xl p-4.5 space-y-3 shadow-xs">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-black uppercase tracking-wider text-amber-950">
                              Posición Sugerida de Extracción (¿De cuál debe salir?)
                            </span>
                            {outboundSuggestion && (
                              <span className={`text-[9.5px] font-bold font-mono px-2.5 py-0.5 rounded-full border ${outboundSuggestion.badgeColor}`}>
                                {outboundSuggestion.badge}
                              </span>
                            )}
                          </div>

                          {outboundSuggestion?.bin ? (
                            <div className="mt-1.5">
                              <p className="text-xs text-slate-900 font-semibold leading-relaxed">
                                Se sugiere extraer de la celda: <strong className="font-mono text-amber-800 bg-white px-2 py-0.5 rounded-md border border-amber-300 text-sm">{outboundSuggestion.bin.id}</strong>
                                <span className="text-slate-600 font-normal ml-2">
                                  (Pasillo {outboundSuggestion.bin.aisle}, Rack {outboundSuggestion.bin.rack}, Nivel {outboundSuggestion.bin.level})
                                </span>
                              </p>
                              <p className="text-[11px] text-slate-600 mt-1">
                                {outboundSuggestion.reason}
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-700 mt-1">
                              {outboundSuggestion?.reason}
                            </p>
                          )}
                        </div>
                      </div>

                      {outboundSuggestion?.bin && (
                        <button
                          type="button"
                          onClick={() => setSourcePickBinId(outboundSuggestion.bin.id)}
                          className={`shrink-0 text-xs font-extrabold px-4 py-2.5 rounded-xl border transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                            sourcePickBinId === outboundSuggestion.bin.id
                              ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300'
                              : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-100/50'
                          }`}
                        >
                          <Check className="h-4 w-4" />
                          <span>{sourcePickBinId === outboundSuggestion.bin.id ? 'Celda Seleccionada' : 'Seleccionar Celda'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* Detalle de orden seleccionada */}
              {selectedOrderId && (() => {
                const orderObj = orders.find(o => o.id === selectedOrderId);
                if (!orderObj) return null;
                return (
                  <div className="p-4 border border-slate-200 bg-slate-50 rounded-2xl text-xs space-y-2">
                    <span className="block font-bold text-slate-700 uppercase font-mono tracking-wider text-[10px]">
                      Materiales requeridos en Orden {orderObj.id}:
                    </span>
                    <div className="space-y-1.5 bg-white p-3 border border-slate-150 rounded-xl">
                      {orderObj.items.map(item => {
                        const invItem = inventory.find(i => i.sku === item.sku);
                        const isMatched = scannedProduct?.sku === item.sku;
                        return (
                          <div 
                            key={item.sku} 
                            className={`flex justify-between items-center font-mono py-2 px-2.5 rounded-lg text-[11px] transition ${
                              isMatched ? 'bg-amber-50 border border-amber-300 text-amber-950 font-bold' : 'border-b border-slate-100 last:border-b-0'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {isMatched ? (
                                <Check className="h-4 w-4 text-amber-600 shrink-0" />
                              ) : (
                                <span className="h-2 w-2 rounded-full bg-slate-300 shrink-0"></span>
                              )}
                              <span>{item.sku} ({invItem?.name || 'Mercancía'})</span>
                            </span>
                            <span>Requerido: <strong>{item.qty} uds</strong> | EAN: <strong>{invItem?.barcode || 'N/A'}</strong></span>
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
                className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-2xl text-xs uppercase tracking-wider shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Validando Código y Despachando...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="h-4 w-4" />
                    <span>Escanear y Validar Despacho de Salida</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ======================================================== */}
          {/* FORMULARIO 3: CONTEO CÍCLICO                             */}
          {/* ======================================================== */}
          {activeModule === 'conteo' && (
            <form onSubmit={handleCycleCountSubmit} className="space-y-4">
              <div className="bg-emerald-50/60 rounded-2xl p-3.5 border border-emerald-150 text-[11px] text-emerald-900 leading-relaxed flex items-start gap-2.5">
                <Info className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Auditoría de Conteo Cíclico:</strong> Escanee el código de barras o SKU del material para auditar existencias físicas. La consola comparará en vivo las cantidades y registrará cualquier desviación.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                    Código de Barras/SKU Escaneado
                  </label>
                  <div className="relative flex items-center">
                    <Scan className="absolute left-3.5 h-4 w-4 text-emerald-600" />
                    <input
                      type="text"
                      value={scannedBarcode}
                      onChange={(e) => setScannedBarcode(e.target.value)}
                      placeholder="Escanee EAN-13 o SKU de material"
                      className="w-full pl-10 pr-9 py-3 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none bg-white shadow-2xs"
                      required
                    />
                    {scannedBarcode && (
                      <button
                        type="button"
                        onClick={() => setScannedBarcode('')}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                    Cantidad Física Contada en Almacén
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={physicalCount}
                    onChange={(e) => setPhysicalCount(Number(e.target.value))}
                    className="w-full p-2.5 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none bg-white shadow-2xs"
                    required
                  />
                </div>
              </div>

              {/* ALERTA SIN REGISTRO EN CONTEO */}
              {isUnknownProduct && (
                <div className="bg-amber-50/95 border-2 border-amber-400 rounded-2xl p-4 text-amber-950 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>⚠️ <strong>Sin Registro:</strong> No se tiene registro del código escaneado: <strong className="font-mono">{scannedBarcode}</strong>.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenQuickRegister}
                    className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-xl transition cursor-pointer"
                  >
                    Dar de Alta
                  </button>
                </div>
              )}

              {/* FICHA EN CONTEO */}
              {scannedProduct && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs flex justify-between items-center">
                  <div>
                    <span className="font-mono font-black text-emerald-700">{scannedProduct.sku}</span> — {scannedProduct.name}
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Ubicado en: {currentBinsWithProduct.map(b => `${b.id} (${b.occupiedQty}u)`).join(', ') || 'Sin celdas asignadas'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 uppercase font-mono block">En Sistema</span>
                    <span className="font-mono font-black text-slate-800 text-sm">{scannedProduct.qty} uds</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-2xl text-xs uppercase tracking-wider shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
              >
                <Barcode className="h-4 w-4" />
                <span>Registrar Conteo de Auditoría</span>
              </button>
            </form>
          )}

        </div>

        {/* Right Side: Quick Reference Catalog & Test Codes (4 Cols) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          
          <div className="border-b border-slate-150 pb-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-black font-mono uppercase text-slate-800 block">
                Directorio de Códigos
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Haga clic en cualquier código para probar la detección
              </span>
            </div>
          </div>

          {/* Botón para probar código sin registro */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2">
            <span className="text-[10px] font-bold text-amber-900 block">
              🧪 Prueba de Validación Sin Registro:
            </span>
            <button
              type="button"
              onClick={() => setScannedBarcode('7509999999999')}
              className="w-full text-[11px] font-mono font-bold bg-white text-amber-900 border border-amber-300 hover:bg-amber-100/50 p-2 rounded-xl transition cursor-pointer flex items-center justify-between shadow-2xs"
            >
              <span>Escanear Código Inexistente</span>
              <span className="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-black">Probar Alerta</span>
            </button>
          </div>

          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {inventory.map(item => {
              const isCurrentlyScanned = scannedProduct?.sku === item.sku;
              const itemBins = bins.filter(b => b.occupiedSku === item.sku && (b.occupiedQty || 0) > 0);
              
              return (
                <div
                  key={item.sku}
                  onClick={() => setScannedBarcode(item.barcode || item.sku)}
                  className={`group border p-3 rounded-2xl transition cursor-pointer ${
                    isCurrentlyScanned
                      ? 'border-blue-500 bg-blue-50/40 shadow-xs ring-1 ring-blue-400'
                      : 'border-slate-150 hover:border-blue-300 hover:bg-slate-50/80'
                  }`}
                  title="Haga clic para escanear este código"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-slate-900 font-black text-xs block truncate">{item.sku}</span>
                      <span className="font-sans text-slate-600 text-[10.5px] block leading-tight mt-0.5 font-medium truncate">{item.name}</span>
                    </div>
                    <span className="text-[9px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold shrink-0">
                      {item.qty}u
                    </span>
                  </div>

                  {/* Celdas donde está */}
                  <div className="mt-2 text-[9.5px] font-mono text-slate-500 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {itemBins.length > 0
                        ? `Celda: ${itemBins.map(b => b.id).join(', ')}`
                        : 'Sin ubicación en celda'}
                    </span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400 text-[9px] uppercase font-bold">Código EAN</span>
                    <span className="text-blue-700 font-extrabold tracking-wider bg-slate-50 group-hover:bg-white px-2 py-0.5 rounded border border-slate-200">
                      |||| {item.barcode || item.sku}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>

      {/* ======================================================== */}
      {/* MODAL DE ALTA RÁPIDA DE SKU DESDE EL ESCÁNER             */}
      {/* ======================================================== */}
      {showQuickRegisterModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <FolderPlus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Alta Rápida de SKU en Inventario
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Registre el producto para habilitar su recepción y sugerencia de ubicación
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickRegisterModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickSku} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                    Código de Barras (EAN)
                  </label>
                  <input
                    type="text"
                    value={quickBarcode}
                    onChange={(e) => setQuickBarcode(e.target.value)}
                    className="w-full p-2.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                    Código SKU
                  </label>
                  <input
                    type="text"
                    value={quickSku}
                    onChange={(e) => setQuickSku(e.target.value)}
                    placeholder="e.g. SKU-1001"
                    className="w-full p-2.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Nombre del Producto / Insumo
                </label>
                <input
                  type="text"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="e.g. Batería Ion-Litio 24V"
                  className="w-full p-2.5 text-xs font-sans font-bold bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                    Categoría
                  </label>
                  <select
                    value={quickCategory}
                    onChange={(e) => setQuickCategory(e.target.value)}
                    className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none font-medium cursor-pointer"
                  >
                    <option value="Almacenamiento General">Almacenamiento General</option>
                    <option value="Electrónicos (Frágil)">Electrónicos (Frágil)</option>
                    <option value="Químicos / Hazmat">Químicos / Hazmat</option>
                    <option value="Materia Prima Pesada">Materia Prima Pesada</option>
                    <option value="Cajas y Empaque">Cajas y Empaque</option>
                    <option value="Textiles y Ropa">Textiles y Ropa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                    Peso Unitario (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={quickWeight}
                    onChange={(e) => setQuickWeight(Number(e.target.value))}
                    className="w-full p-2.5 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                    Stock Mínimo
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quickMinQty}
                    onChange={(e) => setQuickMinQty(Number(e.target.value))}
                    className="w-full p-2.5 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                    Proveedor
                  </label>
                  <input
                    type="text"
                    value={quickSupplier}
                    onChange={(e) => setQuickSupplier(e.target.value)}
                    placeholder="e.g. Logística Central"
                    className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuickRegisterModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuickSku}
                  className="px-5 py-2.5 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingQuickSku ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Guardando SKU...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Guardar y Ubicar Producto</span>
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
