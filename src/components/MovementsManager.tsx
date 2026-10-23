import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Bin, InventoryItem, ActivityLog, Order } from '../types';
import { 
  ArrowRightLeft, 
  Move, 
  Check, 
  MapPin, 
  TrendingUp, 
  Package, 
  Clock, 
  User, 
  Shuffle, 
  BarChart3, 
  AlertTriangle,
  ChevronRight,
  FileSpreadsheet,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Wrench,
  Truck,
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  NotebookText,
  Boxes
} from 'lucide-react';
import { ArticleSuggestionInput } from './ArticleSuggestionInput';

interface MovementsManagerProps {
  bins: Bin[];
  inventory: InventoryItem[];
  orders?: Order[];
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

export interface UnifiedMovement {
  id: string;
  timestamp: string;
  type: 'entrada' | 'salida' | 'prestamo' | 'traslado_interno';
  typeLabel: string;
  sku: string;
  productName: string;
  category: string;
  qty: number;
  origin: string;
  destination: string;
  recipientOrCustomer: string;
  operator: string;
  folioOrRef: string;
  notes?: string;
  loanStatus?: 'active' | 'returned';
}

export const MovementsManager: React.FC<MovementsManagerProps> = ({
  bins,
  inventory,
  orders = [],
  logs,
  onUpdateBins,
  activeOperatorName
}) => {
  // Active navigation sub-tab
  // 'all' = Bitácora Completa, 'entradas' = Entradas, 'salidas' = Salidas y Préstamos, 'traslados' = Movimientos Internos, 'form' = Formulario de Traslado
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'entradas' | 'salidas' | 'traslados' | 'form'>('all');

  // Search & Filter states for the Bitácora
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'entrada' | 'salida' | 'prestamo' | 'traslado_interno'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');

  // Dispatches from local storage
  const [directDispatches, setDirectDispatches] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('OWMS_DIRECT_DISPATCH_HISTORY');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  // Reload dispatches on window storage event
  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = localStorage.getItem('OWMS_DIRECT_DISPATCH_HISTORY');
        if (saved) setDirectDispatches(JSON.parse(saved));
      } catch (e) {}
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('owms_dispatch_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('owms_dispatch_updated', handleSync);
    };
  }, []);

  // Session movements state (holds last transfers for current session)
  const [sessionMovements, setSessionMovements] = useState<SessionMovement[]>(() => {
    const saved = sessionStorage.getItem('wms_session_movements');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  // Form states for Inter-bin Transfer
  const [sourceBinId, setSourceBinId] = useState('');
  const [targetBinId, setTargetBinId] = useState('');
  const [qtyToMove, setQtyToMove] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [articleSearchQuery, setArticleSearchQuery] = useState('');
  const [targetSearchQuery, setTargetSearchQuery] = useState('');

  // -------------------------------------------------------------
  // COMPILE UNIFIED MOVEMENTS LIST (Entradas, Salidas, Préstamos, Traslados)
  // -------------------------------------------------------------
  const unifiedMovements = useMemo<UnifiedMovement[]>(() => {
    const list: UnifiedMovement[] = [];
    const seenIds = new Set<string>();

    // 1. Direct Dispatches & Tool Loans (Salidas y Préstamos)
    directDispatches.forEach((d: any) => {
      const id = d.id || `DSP-${d.timestamp}`;
      if (seenIds.has(id)) return;
      seenIds.add(id);

      const isLoan = d.dispatchType === 'loan';
      const itemProd = inventory.find(i => i.sku === d.sku);

      list.push({
        id,
        timestamp: d.timestamp || new Date().toISOString(),
        type: isLoan ? 'prestamo' : 'salida',
        typeLabel: isLoan 
          ? 'Préstamo de Herramienta' 
          : (d.dispatchTypeLabel || 'Salida Definitiva'),
        sku: d.sku,
        productName: d.productName || (itemProd ? itemProd.name : 'Material de Almacén'),
        category: d.category || (itemProd ? itemProd.category : 'General'),
        qty: Number(d.qty) || 1,
        origin: Array.isArray(d.originBins) && d.originBins.length > 0 
          ? d.originBins.join(', ') 
          : 'Almacén Central',
        destination: d.destination || (d.borrowerName ? `Taller / Personal: ${d.borrowerName}` : 'Salida / Destino Final'),
        recipientOrCustomer: d.borrowerName || d.destination || 'Personal / Cliente',
        operator: d.operator || 'Operador de Almacén',
        folioOrRef: d.id,
        notes: d.notes || (isLoan ? `Vence: ${d.expectedReturnDate || 'Sin fecha'}` : d.deliveryMethod),
        loanStatus: d.loanStatus
      });
    });

    // 2. Orders (Entradas / Inbound & Salidas / Outbound)
    orders.forEach((ord: Order) => {
      const isEntrada = ord.type === 'Inbound';
      const orderDate = ord.shipmentDate || ord.dateCreated || new Date().toISOString();

      if (Array.isArray(ord.items) && ord.items.length > 0) {
        ord.items.forEach((item, itemIdx) => {
          const itemKey = `${ord.id}-${item.sku}-${itemIdx}`;
          if (seenIds.has(itemKey)) return;
          seenIds.add(itemKey);

          const itemProd = inventory.find(i => i.sku === item.sku);

          list.push({
            id: itemKey,
            timestamp: orderDate,
            type: isEntrada ? 'entrada' : 'salida',
            typeLabel: isEntrada ? 'Entrada / Recepción de Mercancía' : 'Salida de Pedido / Embarque',
            sku: item.sku,
            productName: itemProd ? itemProd.name : `Artículo ${item.sku}`,
            category: itemProd ? itemProd.category : 'Suministros',
            qty: Number(item.qty) || 1,
            origin: isEntrada 
              ? (itemProd?.supplier || 'Proveedor / Embarque') 
              : (ord.optimizedPath && ord.optimizedPath.length > 0 ? ord.optimizedPath.join(', ') : 'Almacén Central'),
            destination: isEntrada 
              ? 'Almacén Central (Área de Recepción)' 
              : (ord.destination || 'Cliente / Obra Solicitante'),
            recipientOrCustomer: isEntrada 
              ? (itemProd?.supplier || 'Área de Recepción WMS') 
              : (ord.destination || 'Cliente Final'),
            operator: ord.assignedTo || 'Operador de Logística',
            folioOrRef: ord.id,
            notes: ord.deliveryMethod || ord.carrier ? `Transporte: ${ord.carrier || ord.deliveryMethod} (${ord.status})` : `Estado: ${ord.status}`
          });
        });
      }
    });

    // 3. System Activity Logs (Internal Transfers & Putaway Receptions)
    logs.forEach((log: ActivityLog) => {
      // Internal transfers: "Trasladadas {qty} unidades de SKU {sku} desde la celda {origin} hacia la celda {dest}"
      const transferMatch = log.details.match(/Trasladadas\s+(\d+)\s+unidades\s+de\s+SKU\s+(\S+)\s+desde\s+la\s+celda\s+(\S+)\s+hacia\s+la\s+celda\s+(\S+)/i);
      if (transferMatch) {
        const id = `LOG-TRA-${log.id}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          const qty = parseInt(transferMatch[1], 10);
          const sku = transferMatch[2];
          const originBin = transferMatch[3];
          const destBin = transferMatch[4];
          const itemProd = inventory.find(i => i.sku === sku);

          list.push({
            id,
            timestamp: log.timestamp,
            type: 'traslado_interno',
            typeLabel: 'Reubicación Interna (Slotting)',
            sku,
            productName: itemProd ? itemProd.name : `Artículo ${sku}`,
            category: itemProd ? itemProd.category : 'Inventario Interno',
            qty,
            origin: `Celda ${originBin}`,
            destination: `Celda ${destBin}`,
            recipientOrCustomer: `Ubicación Destino ${destBin}`,
            operator: log.user || 'Operador de Almacén',
            folioOrRef: log.id,
            notes: `Movimiento de optimización de espacio entre celdas`
          });
        }
      }

      // Putaway receptions: "Ubicadas {qty} unidades de SKU {sku} en la celda {bin}"
      const putawayMatch = log.details.match(/Ubicadas\s+(\d+)\s+unidades\s+de\s+SKU\s+(\S+)\s+en\s+la\s+celda\s+(\S+)/i);
      if (putawayMatch) {
        const id = `LOG-PUT-${log.id}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          const qty = parseInt(putawayMatch[1], 10);
          const sku = putawayMatch[2];
          const targetBin = putawayMatch[3];
          const itemProd = inventory.find(i => i.sku === sku);

          list.push({
            id,
            timestamp: log.timestamp,
            type: 'entrada',
            typeLabel: 'Guardado Optimizado (Putaway)',
            sku,
            productName: itemProd ? itemProd.name : `Artículo ${sku}`,
            category: itemProd ? itemProd.category : 'Suministros',
            qty,
            origin: 'Muelle de Recepción Inbound',
            destination: `Celda Asignada ${targetBin}`,
            recipientOrCustomer: `Celda de Almacenamiento ${targetBin}`,
            operator: log.user || 'Operario de Recepción',
            folioOrRef: log.id,
            notes: `Guardado en estante correspondiente`
          });
        }
      }
    });

    // 4. Session Movements (current browser tab operations)
    sessionMovements.forEach((sm, idx) => {
      const id = `SES-MOV-${sm.timestamp}-${idx}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        const itemProd = inventory.find(i => i.sku === sm.sku);
        list.push({
          id,
          timestamp: sm.timestamp,
          type: 'traslado_interno',
          typeLabel: 'Reubicación In-Situ',
          sku: sm.sku,
          productName: itemProd ? itemProd.name : `Artículo ${sm.sku}`,
          category: itemProd ? itemProd.category : 'Inventario Interno',
          qty: sm.qty,
          origin: `Celda ${sm.sourceBinId}`,
          destination: `Celda ${sm.targetBinId}`,
          recipientOrCustomer: `Ubicación ${sm.targetBinId}`,
          operator: activeOperatorName,
          folioOrRef: `SES-${idx + 1}`,
          notes: 'Ejecutado en la sesión activa'
        });
      }
    });

    // Sort newest to oldest
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [directDispatches, orders, logs, sessionMovements, inventory, activeOperatorName]);

  // Unique categories for filtering
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    unifiedMovements.forEach(m => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set).sort();
  }, [unifiedMovements]);

  // Filtered movements based on tab, search term, category and time
  const filteredMovements = useMemo(() => {
    return unifiedMovements.filter(m => {
      // 1. Sub-tab filter
      if (activeSubTab === 'entradas' && m.type !== 'entrada') return false;
      if (activeSubTab === 'salidas' && m.type !== 'salida' && m.type !== 'prestamo') return false;
      if (activeSubTab === 'traslados' && m.type !== 'traslado_interno') return false;

      // 2. Type dropdown filter
      if (typeFilter !== 'ALL' && m.type !== typeFilter) return false;

      // 3. Category filter
      if (selectedCategoryFilter !== 'ALL' && m.category !== selectedCategoryFilter) return false;

      // 4. Time filter
      if (timeFilter !== 'all') {
        const itemTime = new Date(m.timestamp).getTime();
        const now = Date.now();
        if (timeFilter === 'today') {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          if (itemTime < startOfToday.getTime()) return false;
        } else if (timeFilter === '7days') {
          if (now - itemTime > 7 * 24 * 60 * 60 * 1000) return false;
        } else if (timeFilter === '30days') {
          if (now - itemTime > 30 * 24 * 60 * 60 * 1000) return false;
        }
      }

      // 5. Search text (SKU, product name, operator, destination, recipient, folio)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesSku = m.sku.toLowerCase().includes(query);
        const matchesName = m.productName.toLowerCase().includes(query);
        const matchesOperator = m.operator.toLowerCase().includes(query);
        const matchesDestination = m.destination.toLowerCase().includes(query);
        const matchesRecipient = m.recipientOrCustomer.toLowerCase().includes(query);
        const matchesOrigin = m.origin.toLowerCase().includes(query);
        const matchesFolio = m.folioOrRef.toLowerCase().includes(query);
        const matchesCategory = m.category.toLowerCase().includes(query);

        if (!matchesSku && !matchesName && !matchesOperator && !matchesDestination && !matchesRecipient && !matchesOrigin && !matchesFolio && !matchesCategory) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedMovements, activeSubTab, typeFilter, selectedCategoryFilter, timeFilter, searchTerm]);

  // Overall KPI statistics
  const stats = useMemo(() => {
    let totalEntradasCount = 0;
    let totalEntradasUnits = 0;
    let totalSalidasCount = 0;
    let totalSalidasUnits = 0;
    let totalPrestamosCount = 0;
    let totalTrasladosCount = 0;
    let totalTrasladosUnits = 0;

    unifiedMovements.forEach(m => {
      if (m.type === 'entrada') {
        totalEntradasCount++;
        totalEntradasUnits += m.qty;
      } else if (m.type === 'salida') {
        totalSalidasCount++;
        totalSalidasUnits += m.qty;
      } else if (m.type === 'prestamo') {
        totalPrestamosCount++;
        totalSalidasUnits += m.qty;
      } else if (m.type === 'traslado_interno') {
        totalTrasladosCount++;
        totalTrasladosUnits += m.qty;
      }
    });

    return {
      totalMovements: unifiedMovements.length,
      totalEntradasCount,
      totalEntradasUnits,
      totalSalidasCount,
      totalPrestamosCount,
      totalSalidasUnits,
      totalTrasladosCount,
      totalTrasladosUnits
    };
  }, [unifiedMovements]);

  // -------------------------------------------------------------
  // EXPORT TO EXCEL
  // -------------------------------------------------------------
  const handleExportBitacoraExcel = () => {
    try {
      const rows = filteredMovements.map(m => ({
        'Folio / Referencia': m.folioOrRef,
        'Fecha y Hora': new Date(m.timestamp).toLocaleString('es-ES'),
        'Tipo de Movimiento': m.typeLabel,
        'SKU': m.sku,
        'Qué se envió / recibió (Material)': m.productName,
        'Categoría': m.category,
        'Cantidad (Uds)': m.qty,
        'Origen (De dónde)': m.origin,
        'A quién / A dónde se envió (Destino)': m.destination,
        'Destinatario / Prestatario': m.recipientOrCustomer,
        'Quién lo hizo (Operador)': m.operator,
        'Detalles / Estado': m.loanStatus ? (m.loanStatus === 'returned' ? 'Devuelto' : 'Préstamo Activo') : (m.notes || 'Completado')
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 18 }, // Folio
        { wch: 20 }, // Fecha
        { wch: 26 }, // Tipo
        { wch: 15 }, // SKU
        { wch: 36 }, // Material
        { wch: 18 }, // Categoría
        { wch: 14 }, // Cantidad
        { wch: 24 }, // Origen
        { wch: 32 }, // Destino
        { wch: 28 }, // Destinatario
        { wch: 26 }, // Operador
        { wch: 25 }  // Notas
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Bitacora_Movimientos');
      XLSX.writeFile(wb, `Bitacora_Movimientos_Almacen_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Error al exportar bitácora a excel:', err);
    }
  };

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
      ws['!cols'] = [
        { wch: 22 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 16 },
        { wch: 16 }, { wch: 35 }, { wch: 18 }, { wch: 25 }, { wch: 20 }, { wch: 20 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Insumos_por_Ubicacion');
      XLSX.writeFile(wb, `Relacion_Insumos_Ubicacion_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Error al exportar excel:', err);
    }
  };

  // -------------------------------------------------------------
  // FORM HELPERS FOR INTER-BIN MOVEMENTS
  // -------------------------------------------------------------
  const sourceBinObj = useMemo(() => bins.find(b => b.id === sourceBinId), [bins, sourceBinId]);
  const sourceProductObj = useMemo(() => {
    if (!sourceBinObj || !sourceBinObj.occupiedSku) return null;
    return inventory.find(item => item.sku === sourceBinObj.occupiedSku);
  }, [sourceBinObj, inventory]);

  const occupiedBins = useMemo(() => bins.filter(b => b.occupiedSku && b.occupiedQty > 0), [bins]);

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
    if (!qtyToMove || qtyToMove <= 0) {
      setErrorMessage('La cantidad a trasladar debe ser mayor que 0.');
      return;
    }

    const src = bins.find(b => b.id === sourceBinId);
    const tgt = bins.find(b => b.id === targetBinId);

    if (!src || !src.occupiedSku || src.occupiedQty <= 0) {
      setErrorMessage('La celda de origen no posee existencias disponibles.');
      return;
    }
    if (qtyToMove > src.occupiedQty) {
      setErrorMessage(`No puede mover más de ${src.occupiedQty} unidades (existencia actual).`);
      return;
    }

    if (tgt && tgt.occupiedSku && tgt.occupiedSku !== src.occupiedSku && tgt.occupiedQty > 0) {
      setErrorMessage(`La celda destino ${tgt.id} ya contiene un SKU distinto (${tgt.occupiedSku}). En WMS estándar una celda no puede mezclar SKUs diferentes.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const movingSku = src.occupiedSku;
      const newSourceQty = src.occupiedQty - qtyToMove;
      const newTargetQty = (tgt?.occupiedQty || 0) + qtyToMove;

      const updatedBins = bins.map(b => {
        if (b.id === sourceBinId) {
          return {
            ...b,
            occupiedQty: newSourceQty,
            occupiedSku: newSourceQty === 0 ? '' : b.occupiedSku,
            status: (newSourceQty === 0 ? 'Empty' : 'Partial') as 'Empty' | 'Partial' | 'Full'
          };
        }
        if (b.id === targetBinId) {
          return {
            ...b,
            occupiedSku: movingSku,
            occupiedQty: newTargetQty,
            status: 'Partial' as 'Empty' | 'Partial' | 'Full'
          };
        }
        return b;
      });

      const logAction = 'Traslado Interno';
      const logDetails = `Trasladadas ${qtyToMove} unidades de SKU ${movingSku} desde la celda ${sourceBinId} hacia la celda ${targetBinId}. Operador: ${activeOperatorName}.`;

      await onUpdateBins(updatedBins, logAction, logDetails);

      const newSessionRecord: SessionMovement = {
        sku: movingSku,
        sourceBinId,
        targetBinId,
        qty: qtyToMove,
        timestamp: new Date().toISOString()
      };

      const updatedSessionList = [newSessionRecord, ...sessionMovements.slice(0, 9)];
      setSessionMovements(updatedSessionList);
      try {
        sessionStorage.setItem('wms_session_movements', JSON.stringify(updatedSessionList));
      } catch (err) {}

      setSuccessMessage(`¡Traslado exitoso! ${qtyToMove} unidades de SKU ${movingSku} reubicadas de ${sourceBinId} a ${targetBinId}.`);
      setQtyToMove(0);
      setSourceBinId('');
      setTargetBinId('');
      setArticleSearchQuery('');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Ocurrió un error al ejecutar el traslado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <NotebookText className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                Bitácora de Movimientos de Almacén
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Registro integral y trazabilidad en vivo de entradas, salidas, préstamos y movimientos internos dentro del almacén.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <button
            type="button"
            onClick={handleExportBitacoraExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95 border border-emerald-500"
            title="Descargar toda la bitácora con origen, destino, material y operador a archivo Excel"
          >
            <FileSpreadsheet className="h-4 w-4 text-white" />
            <span>Exportar Bitácora a Excel</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadInsumosUbicacion}
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2.5 px-3.5 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer border border-slate-700"
            title="Exportar inventario desglosado por celda"
          >
            <Boxes className="h-4 w-4 text-slate-300" />
            <span>Insumos por Ubicación</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Entradas */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/50 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <ArrowDownLeft className="h-6 w-6" />
          </div>
          <div className="overflow-hidden">
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Entradas (Recepción)</span>
            <span className="text-xl font-black text-slate-800 font-mono leading-none">
              {stats.totalEntradasUnits.toLocaleString('es-ES')} <span className="text-xs font-normal text-slate-400">uds</span>
            </span>
            <p className="text-[10px] text-emerald-600 font-medium mt-1">{stats.totalEntradasCount} recepciones</p>
          </div>
        </div>

        {/* Metric 2: Salidas & Despachos */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/50 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <ArrowUpRight className="h-6 w-6" />
          </div>
          <div className="overflow-hidden">
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Salidas Definitivas</span>
            <span className="text-xl font-black text-slate-800 font-mono leading-none">
              {stats.totalSalidasUnits.toLocaleString('es-ES')} <span className="text-xs font-normal text-slate-400">uds</span>
            </span>
            <p className="text-[10px] text-blue-600 font-medium mt-1">{stats.totalSalidasCount} despachos</p>
          </div>
        </div>

        {/* Metric 3: Préstamos a Personal */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/50 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Wrench className="h-6 w-6" />
          </div>
          <div className="overflow-hidden">
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Préstamos Personal</span>
            <span className="text-xl font-black text-slate-800 font-mono leading-none">
              {stats.totalPrestamosCount} <span className="text-xs font-normal text-slate-400">vales</span>
            </span>
            <p className="text-[10px] text-amber-600 font-medium mt-1">Herramientas asignadas</p>
          </div>
        </div>

        {/* Metric 4: Movimientos Internos */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/50 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <ArrowRightLeft className="h-6 w-6" />
          </div>
          <div className="overflow-hidden">
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Movimientos Internos</span>
            <span className="text-xl font-black text-slate-800 font-mono leading-none">
              {stats.totalTrasladosUnits.toLocaleString('es-ES')} <span className="text-xs font-normal text-slate-400">uds</span>
            </span>
            <p className="text-[10px] text-indigo-600 font-medium mt-1">{stats.totalTrasladosCount} reubicaciones</p>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs p-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <NotebookText className="h-3.5 w-3.5" />
            <span>Todos los Movimientos ({unifiedMovements.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('entradas')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'entradas'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ArrowDownLeft className="h-3.5 w-3.5" />
            <span>Entradas ({stats.totalEntradasCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('salidas')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'salidas'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>Salidas & Préstamos ({stats.totalSalidasCount + stats.totalPrestamosCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('traslados')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'traslados'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            <span>Movimientos Internos ({stats.totalTrasladosCount})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setActiveSubTab(activeSubTab === 'form' ? 'all' : 'form')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
            activeSubTab === 'form'
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
              : 'bg-white hover:bg-indigo-50/50 border-indigo-200 text-indigo-600'
          }`}
        >
          <Move className="h-3.5 w-3.5 text-indigo-600" />
          <span>{activeSubTab === 'form' ? '← Volver a la Bitácora' : '+ Realizar Traslado entre Celdas'}</span>
        </button>
      </div>

      {/* RENDER VIEW: Formulario de Traslado entre Celdas */}
      {activeSubTab === 'form' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Transfer Form */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Move className="h-5 w-5 text-indigo-600 animate-bounce" />
                <h3 className="text-sm font-bold text-slate-800">Panel de Reubicación Física de Celdas (Slotting)</h3>
              </div>
              <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md border border-indigo-150">WMS INTERNO</span>
            </div>

            {successMessage && (
              <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-3 text-emerald-800 font-semibold flex items-center gap-2 animate-fade-in">
                <Check className="h-4.5 w-4.5 bg-emerald-100 text-emerald-700 p-0.5 rounded-full shrink-0" />
                <p className="text-xs">{successMessage}</p>
              </div>
            )}

            {errorMessage && (
              <div className="bg-rose-50 border border-rose-150 rounded-xl p-3 text-rose-800 font-semibold flex items-center gap-2 animate-fade-in">
                <AlertTriangle className="h-4.5 w-4.5 bg-rose-100 text-rose-700 p-0.5 rounded-full shrink-0" />
                <p className="text-xs">{errorMessage}</p>
              </div>
            )}

            <form onSubmit={handleExecuteMovement} className="space-y-5">
              {/* STEP 1: SELECT SOURCE BIN / MATERIAL */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                    <span className="h-4 w-4 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold font-mono text-[9px]">1</span>
                    Artículo & Celda de Origen
                  </label>
                  <span className="text-[10px] text-indigo-600 font-mono font-bold">
                    Búsqueda por descripción o selección directa
                  </span>
                </div>

                <ArticleSuggestionInput
                  value={articleSearchQuery}
                  onChange={(val) => setArticleSearchQuery(val)}
                  onSelectProduct={(item, binId) => {
                    const matchingBins = bins.filter(b => b.occupiedSku === item.sku && (b.occupiedQty || 0) > 0);
                    const selectedTargetBin = binId || (matchingBins[0] ? matchingBins[0].id : '');
                    setSourceBinId(selectedTargetBin);
                    setArticleSearchQuery(`${item.name} (${item.sku})`);
                    setQtyToMove(0);
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  inventory={inventory}
                  bins={bins}
                  themeColor="indigo"
                  filterOnlyWithStock={true}
                  showBinsDetail={true}
                  showDirectBinSelection={true}
                  allowBinScanning={true}
                  label="Identificar Material o Celda de Origen:"
                  placeholder="Escriba la descripción del insumo o escanee código de barras / celda..."
                  helperText="Escriba el nombre del material para ver sugerencias automáticas con celda y stock."
                />

                <div className="space-y-1 pt-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                    O seleccione la celda directamente del listado con existencias:
                  </span>
                  <select
                    value={sourceBinId}
                    onChange={(e) => {
                      const selectedBin = e.target.value;
                      setSourceBinId(selectedBin);
                      const binItem = bins.find(b => b.id === selectedBin);
                      if (binItem && binItem.occupiedSku) {
                        const prod = inventory.find(i => i.sku === binItem.occupiedSku);
                        if (prod) setArticleSearchQuery(`${prod.name} (${prod.sku})`);
                      } else {
                        setArticleSearchQuery('');
                      }
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
                </div>

                {sourceBinObj && sourceProductObj && (
                  <div className="bg-indigo-50/40 border border-indigo-100/80 p-4 rounded-xl flex items-center gap-4 animate-fade-in">
                    <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-bold border border-indigo-150">
                      <Package className="h-6 w-6" />
                    </div>
                    <div className="grow space-y-1 overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold bg-indigo-100/80 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] tracking-wide">{sourceProductObj.sku}</span>
                        <span className="text-[10px] text-slate-400 font-bold font-mono">({sourceProductObj.category})</span>
                      </div>
                      <h4 className="font-bold text-slate-800 text-xs truncate leading-tight">{sourceProductObj.name}</h4>
                      <p className="text-[10px] text-slate-500 leading-none">
                        Stock en celda {sourceBinObj.id}: <strong className="text-slate-800 font-mono font-black">{sourceBinObj.occupiedQty} unidades</strong>
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
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max={sourceBinObj?.occupiedQty || 1}
                    value={qtyToMove || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setQtyToMove(isNaN(val) ? 0 : val);
                      setErrorMessage('');
                    }}
                    placeholder="0"
                    disabled={!sourceBinId}
                    className="w-32 font-mono font-bold text-lg rounded-xl border border-slate-200 p-2.5 text-center text-slate-800 focus:border-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-300"
                  />
                  <span className="text-xs text-slate-400 font-semibold font-mono">unidades</span>

                  {sourceBinObj && sourceBinObj.occupiedQty > 0 && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        type="button"
                        onClick={() => handlePercentPreset(25)}
                        className="text-[10px] font-bold px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition"
                      >
                        25%
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePercentPreset(50)}
                        className="text-[10px] font-bold px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePercentPreset(100)}
                        className="text-[10px] font-bold px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition"
                      >
                        Todo (100%)
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 3: TARGET BIN */}
              <div className="space-y-2">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                  <span className="h-4 w-4 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold font-mono text-[9px]">3</span>
                  Celda de Destino
                </label>

                <input
                  type="text"
                  placeholder="Filtrar celdas disponibles (ej: B-01 o Pasillo B)..."
                  value={targetSearchQuery}
                  onChange={(e) => setTargetSearchQuery(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 text-slate-700 mb-2 focus:border-indigo-500 focus:outline-none"
                />

                <select
                  value={targetBinId}
                  onChange={(e) => setTargetBinId(e.target.value)}
                  disabled={!sourceBinId}
                  className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white p-3 text-slate-700 focus:border-indigo-500 focus:outline-none transition hover:border-slate-300 disabled:bg-slate-50 disabled:text-slate-300"
                >
                  <option value="">-- Seleccionar Celda Receptora --</option>
                  {targetBinsFiltered.map((b) => {
                    const isSameSku = b.occupiedSku === sourceBinObj?.occupiedSku;
                    const isEmpty = b.status === 'Empty';
                    return (
                      <option 
                        key={b.id} 
                        value={b.id}
                        disabled={!isEmpty && !isSameSku}
                      >
                        {b.id} ({b.status === 'Empty' ? 'Vacía' : `Contiene: ${b.occupiedSku} - ${b.occupiedQty} uds`})
                        {!isEmpty && !isSameSku ? ' [Incompatible - Otro SKU]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Action Submit */}
              <button
                type="submit"
                disabled={isSubmitting || !sourceBinId || !targetBinId || qtyToMove <= 0}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRightLeft className="h-4.5 w-4.5" />
                <span>{isSubmitting ? 'Registrando en Supabase...' : 'Confirmar y Ejecutar Reubicación'}</span>
              </button>
            </form>
          </div>

          {/* Right Column: Session movements info */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Clock className="h-4.5 w-4.5 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                Movimientos Realizados en Esta Sesión
              </h3>
            </div>

            {sessionMovements.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs italic">
                Aún no has ejecutado traslados en esta sesión. Los traslados se sincronizan en la bitácora automáticamente.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {sessionMovements.map((sm, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-xs space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                      <span className="font-bold text-indigo-600">{sm.sku}</span>
                      <span>{new Date(sm.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center justify-between font-bold text-slate-700">
                      <span className="text-xs font-black">{sm.qty} uds</span>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                        <span className="bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-100">{sm.sourceBinId}</span>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100">{sm.targetBinId}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* RENDER VIEW: Bitácora de Movimientos Table & Search */
        <div className="space-y-4">
          {/* Filters and Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por SKU, material, operador, destino o a quién se le envió..."
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none transition text-slate-700"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick dropdown filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:border-indigo-500 focus:outline-none"
              >
                <option value="ALL">Todos los Tipos</option>
                <option value="entrada">🟢 Entradas (Recepción)</option>
                <option value="salida">🔵 Salidas Definitivas</option>
                <option value="prestamo">🟠 Préstamos a Personal</option>
                <option value="traslado_interno">🟣 Movimientos Internos</option>
              </select>

              {/* Category Filter */}
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:border-indigo-500 focus:outline-none"
              >
                <option value="ALL">Todas las Categorías</option>
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Time Filter */}
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as any)}
                className="text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">Todo el Historial</option>
                <option value="today">Solo Hoy</option>
                <option value="7days">Últimos 7 Días</option>
                <option value="30days">Últimos 30 Días</option>
              </select>
            </div>
          </div>

          {/* Results count indicator */}
          <div className="flex items-center justify-between text-xs px-2 text-slate-500">
            <span>
              Mostrando <strong className="text-slate-800 font-mono font-bold">{filteredMovements.length}</strong> movimientos registrados
              {searchTerm && <span> con el criterio "<strong className="text-indigo-600">{searchTerm}</strong>"</span>}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Operador actual: <strong className="text-slate-700">{activeOperatorName}</strong>
            </span>
          </div>

          {/* Movements Table */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-3.5 px-4">Fecha y Hora</th>
                    <th className="py-3.5 px-3">Tipo de Operación</th>
                    <th className="py-3.5 px-4">Qué se envió / recibió (Material)</th>
                    <th className="py-3.5 px-3 text-center">Cantidad</th>
                    <th className="py-3.5 px-4">Origen</th>
                    <th className="py-3.5 px-4">A quién / A qué se le envió (Destino)</th>
                    <th className="py-3.5 px-4">Quién lo hizo (Operador)</th>
                    <th className="py-3.5 px-3 text-right">Folio / Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 italic">
                        <NotebookText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                        No se encontraron registros de movimientos con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((m) => {
                      // Formatting badge by type
                      let typeBadge = (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700">
                          {m.typeLabel}
                        </span>
                      );

                      if (m.type === 'entrada') {
                        typeBadge = (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <ArrowDownLeft className="h-3 w-3 text-emerald-600" />
                            Entrada
                          </span>
                        );
                      } else if (m.type === 'salida') {
                        typeBadge = (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                            <ArrowUpRight className="h-3 w-3 text-blue-600" />
                            Salida Definitiva
                          </span>
                        );
                      } else if (m.type === 'prestamo') {
                        typeBadge = (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                            <Wrench className="h-3 w-3 text-amber-600" />
                            Préstamo Herramienta
                          </span>
                        );
                      } else if (m.type === 'traslado_interno') {
                        typeBadge = (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                            <ArrowRightLeft className="h-3 w-3 text-indigo-600" />
                            Reubicación Interna
                          </span>
                        );
                      }

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* 1. Fecha y Hora */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            <div className="font-semibold text-slate-800">
                              {new Date(m.timestamp).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(m.timestamp).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </td>

                          {/* 2. Tipo */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {typeBadge}
                          </td>

                          {/* 3. Qué se le envió (Material) */}
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="flex items-start gap-2">
                              <span className="font-mono font-bold text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                                {m.sku}
                              </span>
                              <div className="overflow-hidden">
                                <span className="font-bold text-slate-800 block truncate text-xs" title={m.productName}>
                                  {m.productName}
                                </span>
                                <span className="text-[10px] text-slate-400 block">
                                  {m.category}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 4. Cantidad */}
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                              {m.qty} <span className="text-[9px] font-normal text-slate-500">uds</span>
                            </span>
                          </td>

                          {/* 5. Origen */}
                          <td className="py-3.5 px-4 max-w-[180px]">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 truncate" title={m.origin}>
                              <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                              <span className="truncate">{m.origin}</span>
                            </div>
                          </td>

                          {/* 6. A quién / A qué se le envió (Destino) */}
                          <td className="py-3.5 px-4 max-w-[220px]">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 truncate" title={m.destination}>
                                {m.type === 'prestamo' ? (
                                  <User className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                ) : m.type === 'traslado_interno' ? (
                                  <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                ) : (
                                  <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                )}
                                <span className="truncate">{m.destination}</span>
                              </div>
                              {m.recipientOrCustomer && m.recipientOrCustomer !== m.destination && (
                                <span className="text-[10px] text-slate-400 block truncate">
                                  Prestatario/Receptor: {m.recipientOrCustomer}
                                </span>
                              )}
                              {m.loanStatus && (
                                <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                                  m.loanStatus === 'returned'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {m.loanStatus === 'returned' ? '✓ Devuelto al almacén' : 'En préstamo activo'}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 7. Quién lo hizo (Operador) */}
                          <td className="py-3.5 px-4 max-w-[180px]">
                            <div className="flex items-center gap-1.5 text-xs text-slate-700">
                              <div className="h-6 w-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-[10px] shrink-0 font-mono">
                                {m.operator.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold truncate" title={m.operator}>
                                {m.operator}
                              </span>
                            </div>
                          </td>

                          {/* 8. Folio / Referencia */}
                          <td className="py-3.5 px-3 text-right font-mono text-[10px] text-slate-400 whitespace-nowrap">
                            <span className="bg-slate-50 border border-slate-200 px-2 py-1 rounded font-bold text-slate-600">
                              #{m.folioOrRef.length > 12 ? m.folioOrRef.slice(0, 12) : m.folioOrRef}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
