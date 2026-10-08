import React, { useState, useEffect } from 'react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { 
  FileDown, 
  Printer, 
  FileSpreadsheet, 
  Package, 
  TrendingUp, 
  Layers, 
  Trash2, 
  Clock, 
  Download, 
  Eye, 
  Clipboard, 
  CheckCircle2, 
  AlertTriangle,
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Sliders,
  History,
  FileText,
  ArrowLeftRight,
  RefreshCw,
  Briefcase,
  Database,
  ShieldCheck,
  Building2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Bin, InventoryItem, Order, ActivityLog, CycleCountSession, WarehouseSection } from '../types';
import { getStoredWarehouseSections } from './WarehouseSectionManager';

interface ReportsCenterProps {
  inventory: InventoryItem[];
  orders: Order[];
  bins: Bin[];
  logs: ActivityLog[];
  countedSessions?: CycleCountSession[];
}

type ActiveReportType = 'performance' | 'inventory' | 'audit_logs' | 'orders_flow' | 'full_backup';

function oklchToRgbOrHsl(oklchStr: string): string {
  const match = oklchStr.match(/oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)/i);
  if (!match) {
    return 'rgb(100, 116, 139)';
  }
  const l = match[1];
  const c = parseFloat(match[2]);
  const h = parseFloat(match[3]);
  const a = match[4];

  let lNum = l.endsWith('%') ? parseFloat(l) / 100 : parseFloat(l);
  if (lNum > 1) lNum = lNum / 100;

  const sPercent = Math.min(100, Math.round(c * 400));
  const lPercent = Math.round(lNum * 100);

  if (a !== undefined) {
    return `hsla(${Math.round(h)}, ${sPercent}%, ${lPercent}%, ${a})`;
  } else {
    return `hsl(${Math.round(h)}, ${sPercent}%, ${lPercent}%)`;
  }
}

function replaceOklchWithHsl(cssText: string): string {
  return cssText.replace(/oklch\([^)]+\)/gi, (match) => {
    try {
      return oklchToRgbOrHsl(match);
    } catch (e) {
      return 'rgb(100, 116, 139)';
    }
  });
}

export default function ReportsCenter({ 
  inventory, 
  orders, 
  bins, 
  logs, 
  countedSessions = [] 
}: ReportsCenterProps) {
  const [selectedReport, setSelectedReport] = useState<ActiveReportType>('performance');
  const [customNotes, setCustomNotes] = useState('');
  const [backupSuccessMsg, setBackupSuccessMsg] = useState('');

  // Currency Converter States
  const [currencyMode, setCurrencyMode] = useState<'original' | 'mxn_to_usd'>('original');
  const [exchangeRate, setExchangeRate] = useState<number>(18.15);
  const [isFetchingRate, setIsFetchingRate] = useState<boolean>(false);
  const [customRateInput, setCustomRateInput] = useState<string>('18.15');

  // Threshold & Business Lines states
  const [globalThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('wms_global_critical_threshold');
    return saved ? parseInt(saved, 10) : 10;
  });

  const [warehouseSections, setWarehouseSections] = useState<WarehouseSection[]>(() => {
    return getStoredWarehouseSections();
  });

  useEffect(() => {
    const handleUpdate = () => {
      setWarehouseSections(getStoredWarehouseSections());
    };
    window.addEventListener('wms_warehouses_updated', handleUpdate);
    return () => window.removeEventListener('wms_warehouses_updated', handleUpdate);
  }, []);

  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('all');

  // Helper to resolve the warehouse section of an SKU
  const getSkuWarehouseSection = (item: InventoryItem): WarehouseSection => {
    const savedMapping = localStorage.getItem('wms_sku_warehouse_sections');
    if (savedMapping) {
      try {
        const mapping = JSON.parse(savedMapping);
        if (mapping[item.sku]) {
          const found = warehouseSections.find(w => w.id === mapping[item.sku]);
          if (found) return found;
        }
      } catch (e) {}
    }
    const cat = (item.category || '').toLowerCase();
    const name = (item.name || '').toLowerCase();

    // Match keywords to default sections
    if (name.includes('oxxo') || cat.includes('aliment') || cat.includes('bebi') || cat.includes('perece')) {
      const oxxoWh = warehouseSections.find(w => w.code === 'OXXO' || w.id === 'wh-oxxo');
      if (oxxoWh) return oxxoWh;
    }
    if (name.includes('construc') || name.includes('cemento') || name.includes('varilla') || cat.includes('obra')) {
      const constWh = warehouseSections.find(w => w.code === 'CONST' || w.id === 'wh-const');
      if (constWh) return constWh;
    }
    if (name.includes('transporte') || name.includes('llanta') || name.includes('filtro') || cat.includes('flota')) {
      const transWh = warehouseSections.find(w => w.code === 'TRANS' || w.id === 'wh-trans');
      if (transWh) return transWh;
    }

    return warehouseSections[0] || {
      id: 'wh-general',
      code: 'GEN',
      name: 'Almacén General',
      sectionType: 'General',
      facilityLocation: 'Nave Central',
      color: '#3b82f6',
      status: 'Activo',
      createdAt: '',
      subWarehouses: []
    };
  };

  // Filtered datasets based on selected warehouse section
  const filteredInventoryByLine = React.useMemo(() => {
    if (selectedWarehouseFilter === 'all') return inventory;
    return inventory.filter(item => getSkuWarehouseSection(item).id === selectedWarehouseFilter);
  }, [inventory, selectedWarehouseFilter, warehouseSections]);

  const filteredBinsByLine = React.useMemo(() => {
    if (selectedWarehouseFilter === 'all') return bins;
    return bins.filter(b => {
      if (b.occupiedSku) {
        const item = inventory.find(i => i.sku === b.occupiedSku);
        if (item && getSkuWarehouseSection(item).id === selectedWarehouseFilter) return true;
      }
      return true;
    });
  }, [bins, inventory, selectedWarehouseFilter, warehouseSections]);

  const filteredOrdersByLine = React.useMemo(() => {
    if (selectedWarehouseFilter === 'all') return orders;
    return orders.map(o => {
      const lineItems = o.items.filter(item => {
        const found = inventory.find(i => i.sku === item.sku);
        return found && getSkuWarehouseSection(found).id === selectedWarehouseFilter;
      });
      return {
        ...o,
        items: lineItems
      };
    }).filter(o => o.items.length > 0);
  }, [orders, inventory, selectedWarehouseFilter, warehouseSections]);

  const filteredLogsByLine = React.useMemo(() => {
    if (selectedWarehouseFilter === 'all') return logs;
    return logs.filter(log => {
      const hasSku = filteredInventoryByLine.some(item => 
        log.details.toUpperCase().includes(item.sku.toUpperCase())
      );
      return hasSku;
    });
  }, [logs, filteredInventoryByLine, selectedWarehouseFilter]);

  useEffect(() => {
    const fetchRate = async () => {
      setIsFetchingRate(true);
      try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await response.json();
        if (data && data.rates && data.rates.MXN) {
          const rate = Number(data.rates.MXN.toFixed(4));
          setExchangeRate(rate);
          setCustomRateInput(rate.toString());
        }
      } catch (error) {
        console.error('Error fetching exchange rate, using fallback:', error);
      } finally {
        setIsFetchingRate(false);
      }
    };
    fetchRate();
  }, []);

  const handleCustomRateChange = (val: string) => {
    setCustomRateInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setExchangeRate(num);
    }
  };

  // Calculations for Reports preview & KPIs
  const rawInventoryValue = filteredInventoryByLine.reduce((sum, item) => sum + ((item.qty || 0) * (item.cost || 25)), 0);
  const totalInventoryValue = currencyMode === 'mxn_to_usd' 
    ? rawInventoryValue / exchangeRate 
    : rawInventoryValue;

  const getCurrencySymbol = () => {
    if (currencyMode === 'mxn_to_usd') return 'USD $';
    return '$';
  };

  const getCurrencySuffix = () => {
    if (currencyMode === 'mxn_to_usd') return ' dólares (USD)';
    return ' dólares';
  };

  const convertItemCost = (cost: number) => {
    if (currencyMode === 'mxn_to_usd') return cost / exchangeRate;
    return cost;
  };

  const totalUnits = filteredInventoryByLine.reduce((sum, item) => sum + (item.qty || 0), 0);
  const activeSKUsCount = filteredInventoryByLine.filter(item => item.qty > 0).length;
  const lowStockCount = filteredInventoryByLine.filter(item => {
    const threshold = item.minQty !== undefined && item.minQty > 0 ? item.minQty : globalThreshold;
    return item.qty <= threshold;
  }).length;

  const totalBins = filteredBinsByLine.length;
  const occupiedBins = filteredBinsByLine.filter(b => b.status !== 'Empty').length;
  const occupancyRate = totalBins > 0 ? Math.round((occupiedBins / totalBins) * 100) : 0;

  const completedOrders = filteredOrdersByLine.filter(o => o.status === 'Completed').length;
  const pendingOrders = filteredOrdersByLine.filter(o => o.status === 'Pending').length;
  const totalOrdersCount = filteredOrdersByLine.length;

  // Export functions
  const handleExportPerformance = () => {
    const data = [
      { 'Métrica / Indicador': 'Capital en Stock (Moneda Original)', 'Valor': rawInventoryValue, 'Unidad': 'USD / Moneda' },
      { 'Métrica / Indicador': `Capital en Stock (Convertido)`, 'Valor': totalInventoryValue, 'Unidad': currencyMode === 'mxn_to_usd' ? 'USD' : '$' },
      { 'Métrica / Indicador': 'Total Unidades en Almacén', 'Valor': totalUnits, 'Unidad': 'Unidades' },
      { 'Métrica / Indicador': 'SKUs Activos (Con Stock > 0)', 'Valor': activeSKUsCount, 'Unidad': 'SKUs' },
      { 'Métrica / Indicador': 'SKUs en Alerta de Stock Mínimo', 'Valor': lowStockCount, 'Unidad': 'SKUs' },
      { 'Métrica / Indicador': 'Total Celdas de Almacenamiento', 'Valor': totalBins, 'Unidad': 'Celdas' },
      { 'Métrica / Indicador': 'Celdas Ocupadas', 'Valor': occupiedBins, 'Unidad': 'Celdas' },
      { 'Métrica / Indicador': 'Porcentaje de Ocupación', 'Valor': occupancyRate, 'Unidad': '%' },
      { 'Métrica / Indicador': 'Órdenes Totales Registradas', 'Valor': totalOrdersCount, 'Unidad': 'Órdenes' },
      { 'Métrica / Indicador': 'Órdenes Completadas', 'Valor': completedOrders, 'Unidad': 'Órdenes' },
      { 'Métrica / Indicador': 'Órdenes Pendientes', 'Valor': pendingOrders, 'Unidad': 'Órdenes' },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Metricas_Rendimiento');
    XLSX.writeFile(wb, `Reporte_Metricas_WMS_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportInventory = () => {
    const ws = XLSX.utils.json_to_sheet(
      filteredInventoryByLine.map(item => ({
        'SKU': item.sku,
        'Nombre': item.name,
        'Descripción': item.description,
        'Categoría': item.category,
        'Cantidad Actual': item.qty,
        'Stock Mínimo (Límite)': item.minQty !== undefined && item.minQty > 0 ? item.minQty : globalThreshold,
        'Almacén / Sección': getSkuWarehouseSection(item).name,
        [`Costo Unitario (${currencyMode === 'original' ? '$' : currencyMode === 'mxn_to_usd' ? 'USD $' : 'MXN $'})`]: Number(convertItemCost(item.cost || 0).toFixed(2)),
        [`Valor de Inventario (${currencyMode === 'original' ? '$' : currencyMode === 'mxn_to_usd' ? 'USD $' : 'MXN $'})`]: Number(((item.qty || 0) * convertItemCost(item.cost || 0)).toFixed(2)),
        'Proveedor': item.supplier,
        'Fecha Expiración': item.expirationDate || 'Sin expirar'
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Catálogo_Inventario');
    XLSX.writeFile(wb, `Reporte_Existencias_WMS_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportLogs = () => {
    const ws = XLSX.utils.json_to_sheet(
      filteredLogsByLine.map(log => ({
        'ID': log.id,
        'Fecha y Hora': log.timestamp,
        'Usuario / Operario': log.user,
        'Acción Realizada': log.action,
        'Detalles de Operación': log.details
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registro_Actividad');
    XLSX.writeFile(wb, `Reporte_Auditoria_WMS_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportOrders = () => {
    const ws = XLSX.utils.json_to_sheet(
      filteredOrdersByLine.map(order => ({
        'ID Pedido': order.id,
        'Tipo Flujo': order.type === 'Inbound' ? 'Ingreso (Inbound)' : 'Despacho (Outbound)',
        'Prioridad': order.priority,
        'Estado Actual': order.status,
        'Fecha de Registro': order.dateCreated,
        'Responsable': order.assignedTo || 'No asignado',
        'Detalle de Items': order.items.map(i => `${i.sku} (Cant: ${i.qty})`).join(' | '),
        'Total Unidades': order.items.reduce((sum, i) => sum + i.qty, 0)
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Flujo_Ordenes');
    XLSX.writeFile(wb, `Reporte_Pedidos_WMS_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Full Database Backup Export function (Multi-Sheet Excel)
  const handleExportFullBackup = () => {
    const wb = XLSX.utils.book_new();
    const currentDate = new Date().toISOString().slice(0, 10);
    const currentTime = new Date().toLocaleTimeString();

    // 1. Sheet: Executive Summary / General Metadata
    const summaryData = [
      { 'Propiedad / Métrica': 'Sistema WMS', 'Valor / Detalle': 'O-WMS PRO Warehouse Management System' },
      { 'Propiedad / Métrica': 'Tipo de Archivo', 'Valor / Detalle': 'Respaldo General Completo (Full System Backup)' },
      { 'Propiedad / Métrica': 'Fecha de Emisión', 'Valor / Detalle': currentDate },
      { 'Propiedad / Métrica': 'Hora de Generación', 'Valor / Detalle': currentTime },
      { 'Propiedad / Métrica': 'Almacén / Sección Filtrado', 'Valor / Detalle': selectedWarehouseFilter === 'all' ? 'Todos los Almacenes' : (warehouseSections.find(w => w.id === selectedWarehouseFilter)?.name || selectedWarehouseFilter) },
      { 'Propiedad / Métrica': 'Modo de Divisa', 'Valor / Detalle': currencyMode === 'original' ? 'Moneda Original ($)' : `Convertido (1 USD = ${exchangeRate} MXN)` },
      { 'Propiedad / Métrica': 'Capital Total en Stock', 'Valor / Detalle': `${getCurrencySymbol()}${totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      { 'Propiedad / Métrica': 'Total de Unidades Almacenadas', 'Valor / Detalle': totalUnits },
      { 'Propiedad / Métrica': 'Total de SKUs Registrados', 'Valor / Detalle': filteredInventoryByLine.length },
      { 'Propiedad / Métrica': 'SKUs con Stock Activo (>0)', 'Valor / Detalle': activeSKUsCount },
      { 'Propiedad / Métrica': 'SKUs en Alerta de Stock Mínimo', 'Valor / Detalle': lowStockCount },
      { 'Propiedad / Métrica': 'Celdas Físicas Totales', 'Valor / Detalle': totalBins },
      { 'Propiedad / Métrica': 'Celdas Ocupadas', 'Valor / Detalle': occupiedBins },
      { 'Propiedad / Métrica': 'Porcentaje de Ocupación', 'Valor / Detalle': `${occupancyRate}%` },
      { 'Propiedad / Métrica': 'Total de Pedidos Registrados', 'Valor / Detalle': totalOrdersCount },
      { 'Propiedad / Métrica': 'Pedidos Completados', 'Valor / Detalle': completedOrders },
      { 'Propiedad / Métrica': 'Pedidos Pendientes', 'Valor / Detalle': pendingOrders },
      { 'Propiedad / Métrica': 'Registros de Auditoría (Logs)', 'Valor / Detalle': filteredLogsByLine.length },
      { 'Propiedad / Métrica': 'Sesiones de Conteo Cíclico', 'Valor / Detalle': countedSessions.length },
      { 'Propiedad / Métrica': 'Comentarios / Notas', 'Valor / Detalle': customNotes || 'Respaldo de seguridad generado desde el Centro de Reportes WMS.' }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen_General');

    // 2. Sheet: Full Inventory Catalog
    const inventoryData = filteredInventoryByLine.map(item => ({
      'SKU': item.sku,
      'Nombre del Producto': item.name,
      'Descripción': item.description,
      'Categoría': item.category,
      'Almacén / Sección': getSkuWarehouseSection(item).name,
      'Cantidad en Stock': item.qty,
      'Stock Mínimo': item.minQty !== undefined && item.minQty > 0 ? item.minQty : globalThreshold,
      'Estado Stock': item.qty <= (item.minQty !== undefined && item.minQty > 0 ? item.minQty : globalThreshold) ? 'BAJO (ALERTA)' : 'ÓPTIMO',
      [`Costo Unitario (${getCurrencySymbol()})`]: Number(convertItemCost(item.cost || 0).toFixed(2)),
      [`Valuación Total (${getCurrencySymbol()})`]: Number(((item.qty || 0) * convertItemCost(item.cost || 0)).toFixed(2)),
      'Proveedor': item.supplier,
      'Fecha Vencimiento': item.expirationDate || 'Sin caducidad',
      'Código de Barras': item.barcode || item.sku,
      'Peso Unitario (kg)': item.unitWeight || 0.5,
      'Dimensiones (L x W x H cm)': `${item.unitLength || 0} x ${item.unitWidth || 0} x ${item.unitHeight || 0}`
    }));
    const wsInventory = XLSX.utils.json_to_sheet(inventoryData);
    XLSX.utils.book_append_sheet(wb, wsInventory, 'Inventario');

    // 3. Sheet: Warehouse Bins & Physical Layout
    const binsData = filteredBinsByLine.map(bin => {
      const occupiedItem = bin.occupiedSku ? inventory.find(i => i.sku === bin.occupiedSku) : null;
      return {
        'ID Celda': bin.id,
        'Pasillo (Aisle)': bin.aisle,
        'Rack': bin.rack,
        'Estante (Shelf)': bin.shelf,
        'Nivel (Level)': bin.level,
        'Estado': bin.status === 'Empty' ? 'Vacío' : bin.status === 'Partial' ? 'Parcial' : 'Lleno',
        'SKU Almacenado': bin.occupiedSku || '(Vacío)',
        'Nombre Producto': occupiedItem ? occupiedItem.name : '',
        'Cantidad en Celda': bin.occupiedQty,
        'Peso Máximo (kg)': bin.maxWeight,
        'Volumen Máximo (m3)': bin.maxVolume,
        'Almacén Asignado': bin.occupiedSku ? getSkuWarehouseSection(inventory.find(i => i.sku === bin.occupiedSku) || ({} as any)).name : 'General'
      };
    });
    const wsBins = XLSX.utils.json_to_sheet(binsData);
    XLSX.utils.book_append_sheet(wb, wsBins, 'Ubicaciones_Celdas');

    // 4. Sheet: Orders and Shipments Flow
    const ordersData = filteredOrdersByLine.map(order => ({
      'ID Pedido': order.id,
      'Tipo de Pedido': order.type === 'Inbound' ? 'Ingreso (Inbound)' : 'Despacho (Outbound)',
      'Prioridad': order.priority,
      'Estado': order.status,
      'Fecha Registro': order.dateCreated,
      'Responsable Asignado': order.assignedTo || 'No asignado',
      'Transportista': order.carrier || 'No asignado',
      'Número Rastreo': order.trackingNumber || '',
      'Fecha Despacho': order.shipmentDate || '',
      'Total Unidades': order.items.reduce((sum, i) => sum + i.qty, 0),
      'Detalle Artículos': order.items.map(i => `${i.sku} (Cant: ${i.qty})`).join('; ')
    }));
    const wsOrders = XLSX.utils.json_to_sheet(ordersData);
    XLSX.utils.book_append_sheet(wb, wsOrders, 'Pedidos_Transacciones');

    // 5. Sheet: Audit Logs and Operational Traceability
    const logsData = filteredLogsByLine.map(log => ({
      'ID Log': log.id,
      'Fecha y Hora': log.timestamp,
      'Usuario / Operario': log.user,
      'Acción Registrada': log.action,
      'Detalle Operación': log.details
    }));
    const wsLogs = XLSX.utils.json_to_sheet(logsData);
    XLSX.utils.book_append_sheet(wb, wsLogs, 'Historial_Auditoria');

    // 6. Sheet: Cycle Count Sessions (if available)
    if (countedSessions && countedSessions.length > 0) {
      const cycleData = countedSessions.map(session => ({
        'SKU': session.sku,
        'Fecha Conteo': session.date,
        'Conteo Físico': session.physical,
        'Stock Sistema': session.system,
        'Desviación': session.deviation,
        'Diagnóstico': session.deviation === 0 ? 'Conforme (Exacto)' : session.deviation > 0 ? `Sobrante (+${session.deviation})` : `Faltante (${session.deviation})`
      }));
      const wsCycle = XLSX.utils.json_to_sheet(cycleData);
      XLSX.utils.book_append_sheet(wb, wsCycle, 'Conteos_Ciclicos');
    }

    const fileName = `Respaldo_Completo_WMS_${currentDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
    setBackupSuccessMsg(`Respaldo descargado exitosamente: "${fileName}" con todas las hojas operativas del WMS.`);
    setTimeout(() => setBackupSuccessMsg(''), 6000);
  };



  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title & Description Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileDown className="h-6 w-6 text-indigo-600 bg-indigo-50 p-1 rounded-lg" />
            Consolidado y Descarga de Reportes
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Herramienta centralizada para descargar hojas de cálculo de existencias, auditorías, rendimiento, respaldos completos y flujo de pedidos en formato Excel (.xlsx).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportFullBackup}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            title="Descargar una copia de seguridad integral en Excel (.xlsx) con todas las hojas del WMS"
          >
            <Database className="h-4 w-4" />
            <span>Descargar Respaldo en Excel</span>
          </button>
          <div className="text-[10px] font-mono text-slate-400 bg-slate-50 px-3 py-2 border border-slate-200 rounded-xl">
            Operador: Administrador | Acceso General
          </div>
        </div>
      </div>

      {/* Success Notification for Backup / Exports */}
      {backupSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-250 text-emerald-900 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs animate-fadeIn no-print">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
            <span>{backupSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setBackupSuccessMsg('')}
            className="text-emerald-700 hover:text-emerald-950 text-sm font-bold p-1 rounded hover:bg-emerald-100/80 transition"
          >
            ✕
          </button>
        </div>
      )}

      {/* Barra de Filtros y Configuración (Almacén / Sección + Divisa) - no-print */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-3xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 animate-fadeIn no-print" id="reports-filter-config-bar">
        
        {/* Filtro de Almacén / Sección */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-sans flex items-center gap-1.5 shrink-0">
            <Building2 className="h-4 w-4 text-indigo-500" />
            Almacén / Sección:
          </span>
          <select
            id="reports-warehouse-filter"
            value={selectedWarehouseFilter}
            onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">Todos los Almacenes ({warehouseSections.length})</option>
            {warehouseSections.map(wh => (
              <option key={wh.id} value={wh.id}>[{wh.code}] {wh.name}</option>
            ))}
          </select>
        </div>

        {/* Separador vertical en pantallas grandes */}
        <div className="hidden lg:block h-6 w-[1px] bg-slate-200" />

        {/* Configuración de Divisa */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 w-full lg:w-auto">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-sans flex items-center gap-1.5 shrink-0">
              <ArrowLeftRight className="h-4 w-4 text-emerald-500" />
              Conversión de Divisa:
            </span>
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setCurrencyMode('original')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                  currencyMode === 'original'
                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-100'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Moneda Original ($)
              </button>
              <button
                type="button"
                onClick={() => setCurrencyMode('mxn_to_usd')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                  currencyMode === 'mxn_to_usd'
                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-100'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Peso a Dólar (MXN ➔ USD)
              </button>
            </div>
          </div>

          {currencyMode !== 'original' && (
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto lg:justify-end">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
                <span className="text-slate-400 font-bold font-sans">T.C. del Día:</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono font-bold text-slate-700">1 USD =</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={customRateInput}
                    onChange={(e) => handleCustomRateChange(e.target.value)}
                    className="w-16 px-1.5 py-0.5 border border-slate-200 rounded-md font-mono font-bold text-center bg-white focus:outline-none focus:border-indigo-500 text-slate-700 text-xs"
                    title="Haz clic para personalizar el Tipo de Cambio del día"
                  />
                  <span className="font-mono font-bold text-slate-700">MXN</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {isFetchingRate ? (
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold animate-pulse">
                    <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />
                    Consultando API...
                  </div>
                ) : (
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping" />
                    Tipo de cambio obtenido hoy
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>



      {/* Grid: Selector of Reports & Preview Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        {/* Left Side: Report types choice */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-mono">Reportes Disponibles</h3>
            
            <div className="space-y-3">
              {/* Report 1: Performance */}
              <button
                onClick={() => setSelectedReport('performance')}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                  selectedReport === 'performance' 
                    ? 'bg-indigo-50/50 border-indigo-200 ring-2 ring-indigo-500/10' 
                    : 'border-slate-150 hover:bg-slate-50/70 hover:border-slate-250'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${selectedReport === 'performance' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-slate-900 text-xs block">1. Reporte Operativo y Métricas</span>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                    Eficiencia global, ocupación física de celdas, estadísticas de despacho y estado del inventario.
                  </p>
                </div>
              </button>

              {/* Report 2: Inventory Catalog */}
              <button
                onClick={() => setSelectedReport('inventory')}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                  selectedReport === 'inventory' 
                    ? 'bg-indigo-50/50 border-indigo-200 ring-2 ring-indigo-500/10' 
                    : 'border-slate-150 hover:bg-slate-50/70 hover:border-slate-250'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${selectedReport === 'inventory' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <Package className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-slate-900 text-xs block">2. Existencias y Valoración de Inventario</span>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                    Catálogo de SKU, cantidades físicas, valuación del capital financiero, nivel mínimo de reorden y proveedores.
                  </p>
                </div>
              </button>

              {/* Report 3: Audit Logs */}
              <button
                onClick={() => setSelectedReport('audit_logs')}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                  selectedReport === 'audit_logs' 
                    ? 'bg-indigo-50/50 border-indigo-200 ring-2 ring-indigo-500/10' 
                    : 'border-slate-150 hover:bg-slate-50/70 hover:border-slate-250'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${selectedReport === 'audit_logs' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <History className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-slate-900 text-xs block">3. Auditoría e Historial de Operaciones</span>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                    Trazabilidad de movimientos físicos de stock, ingresos, picking, despacho y auditorías físicas completadas.
                  </p>
                </div>
              </button>

              {/* Report 4: Orders Flow */}
              <button
                onClick={() => setSelectedReport('orders_flow')}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                  selectedReport === 'orders_flow' 
                    ? 'bg-indigo-50/50 border-indigo-200 ring-2 ring-indigo-500/10' 
                    : 'border-slate-150 hover:bg-slate-50/70 hover:border-slate-250'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${selectedReport === 'orders_flow' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <Sliders className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-slate-900 text-xs block">4. Flujo de Pedidos (Inbound / Outbound)</span>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                    Consolidado de órdenes de compra y venta, tasas de despacho, prioridades operativas y transportistas.
                  </p>
                </div>
              </button>

              {/* Report 5: Full System Backup (Multi-Sheet Excel) */}
              <button
                onClick={() => setSelectedReport('full_backup')}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                  selectedReport === 'full_backup' 
                    ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20' 
                    : 'border-slate-150 hover:bg-emerald-50/30 hover:border-emerald-250'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${selectedReport === 'full_backup' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                  <Database className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs block">5. Respaldo Completo del Sistema</span>
                    <span className="text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded uppercase">
                      Multi-Hoja
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                    Copia de seguridad integral en Excel (.xlsx) con 6 pestañas: resumen, inventario, celdas, pedidos, auditoría y conteos.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Preview & Controls */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between h-full min-h-[420px]">
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="text-[11px] font-extrabold text-indigo-600 font-mono uppercase tracking-wider">
                  Vista Previa del Archivo & Acciones
                </span>
                <span className="text-xs text-emerald-600 font-extrabold font-mono uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                  Excel (.xlsx)
                </span>
              </div>

              {selectedReport === 'performance' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-extrabold text-slate-800">Reporte Operativo y Métricas de Rendimiento WMS</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Este documento genera un desglose impreso oficial del estado actual del almacén. Contiene:
                  </p>
                  <ul className="text-xs text-slate-600 space-y-2 list-disc pl-5 font-semibold">
                    <li>Métricas clave de Valuación Financiera del Capital en stock.</li>
                    <li>Porcentaje detallado de Ocupación Física de las celdas de almacenamiento.</li>
                    <li>Nivel de preparación de Pedidos y Auditorías de conteo cíclico.</li>
                    <li>Resumen de flujo operacional de Entrada y Salida.</li>
                  </ul>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between gap-4 mt-2">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Indicadores Actuales</span>
                      <span className="text-xs font-bold text-slate-700 block">
                        Capital en Stock: <strong className="text-slate-900">{getCurrencySymbol()}{totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> | Ocupación: <strong className="text-slate-900">{occupancyRate}%</strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {selectedReport === 'inventory' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-extrabold text-slate-800">Catálogo General de Existencias y Valuación Financiera</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Extrae la totalidad del inventario registrado en el sistema con su correspondiente valuación monetaria basada en costos unitarios.
                  </p>
                  <ul className="text-xs text-slate-600 space-y-2 list-disc pl-5 font-semibold">
                    <li>Código SKU, Nombre del Producto y Proveedor responsable.</li>
                    <li>Stock físico disponible y nivel crítico de reposición (MinQty).</li>
                    <li>Precio de costo unitario y valuación total por producto.</li>
                    <li>Ubicación física en celdas asignadas.</li>
                  </ul>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between gap-4 mt-2">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Volumen Consolidado</span>
                      <span className="text-xs font-bold text-slate-700 block">
                        SKUs Totales: <strong className="text-slate-900">{filteredInventoryByLine.length}</strong> | Unidades en Stock: <strong className="text-slate-900">{totalUnits.toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {selectedReport === 'audit_logs' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-extrabold text-slate-800">Historial Completo de Operaciones y Auditoría</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Registro sistemático y ordenado cronológicamente con la firma digital de los operadores para auditoría fiscal o interna.
                  </p>
                  <ul className="text-xs text-slate-600 space-y-2 list-disc pl-5 font-semibold">
                    <li>ID Único de Log e indicación de marca de tiempo exacta.</li>
                    <li>Operador de WMS responsable de la acción.</li>
                    <li>Tipo de evento (Ingreso, Picking, Ajuste de Inventario, Alta de SKU).</li>
                    <li>Detalles de ubicaciones afectadas e identificación de celdas.</li>
                  </ul>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between gap-4 mt-2">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Logs de Operación</span>
                      <span className="text-xs font-bold text-slate-700 block">
                        Registros Totales: <strong className="text-slate-900">{filteredLogsByLine.length}</strong> entradas de logs
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {selectedReport === 'orders_flow' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-extrabold text-slate-800">Libro General de Pedidos y Entregas</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Concentrado global de todas las transacciones de mercadería del almacén en sus dos variantes: Compras (Inbound) y Despachos de Venta (Outbound).
                  </p>
                  <ul className="text-xs text-slate-600 space-y-2 list-disc pl-5 font-semibold">
                    <li>ID de Orden, Tipo y fecha de registro original.</li>
                    <li>Nivel de Prioridad en bodega (Low, Medium, High, Critical).</li>
                    <li>Estado de Fulfillment (Completado, Pendiente, Picking).</li>
                    <li>Detalles de transportistas, guías de despacho y productos asociados.</li>
                  </ul>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between gap-4 mt-2">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Pedidos en Sistema</span>
                      <span className="text-xs font-bold text-slate-700 block">
                        Órdenes Registradas: <strong className="text-slate-900">{totalOrdersCount}</strong> | Completadas: <strong className="text-emerald-600">{completedOrders}</strong> | Pendientes: <strong className="text-amber-600">{pendingOrders}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {selectedReport === 'full_backup' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                      <Database className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-800">Respaldo Integral de Base de Datos WMS</h4>
                      <span className="text-[10px] font-mono text-emerald-600 font-bold">Libro de Excel (.xlsx) con 6 Hojas Completas</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    Este proceso extrae y consolida en un único archivo Excel todas las entidades de la base de datos de almacenamiento, ideal para copias de seguridad de auditoría fiscal, resguardo ante contingencias o análisis externo.
                  </p>

                  {/* 6 Sheets Summary Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-mono">
                          <FileText className="h-3.5 w-3.5 text-indigo-500" />
                          1. Resumen_General
                        </span>
                        <span className="text-[9px] bg-slate-200/70 text-slate-600 font-bold px-1.5 py-0.5 rounded font-mono">19 KPIs</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">Metadatos, valuación monetaria, ocupación y configuración.</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-mono">
                          <Package className="h-3.5 w-3.5 text-blue-500" />
                          2. Inventario
                        </span>
                        <span className="text-[9px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded font-mono">{filteredInventoryByLine.length} SKUs</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">Catálogo maestro, existencias, precios de costo y vencimientos.</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-mono">
                          <Layers className="h-3.5 w-3.5 text-amber-500" />
                          3. Ubicaciones_Celdas
                        </span>
                        <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded font-mono">{filteredBinsByLine.length} celdas</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">Estructura física, pasillos, estantes, capacidad y SKU alojado.</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-mono">
                          <Sliders className="h-3.5 w-3.5 text-emerald-500" />
                          4. Pedidos_Transacciones
                        </span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded font-mono">{filteredOrdersByLine.length} órdenes</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">Inbound y Outbound, estado, transportistas y desglose de items.</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-mono">
                          <History className="h-3.5 w-3.5 text-purple-500" />
                          5. Historial_Auditoria
                        </span>
                        <span className="text-[9px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded font-mono">{filteredLogsByLine.length} logs</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">Trazabilidad de eventos, marcas temporales y operarios.</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-mono">
                          <CheckCircle2 className="h-3.5 w-3.5 text-teal-500" />
                          6. Conteos_Ciclicos
                        </span>
                        <span className="text-[9px] bg-teal-100 text-teal-700 font-bold px-1.5 py-0.5 rounded font-mono">{countedSessions.length} conteos</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">Sesiones de conteo físico, stock en sistema y desviaciones.</p>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-semibold text-emerald-900 mt-1">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Archivo respaldado: <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-emerald-200">Respaldo_Completo_WMS_{new Date().toISOString().slice(0, 10)}.xlsx</code>
                    </span>
                  </div>
                </div>
              )}

              {/* Custom Report Notes */}
              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block font-sans">Notas o Comentarios del Reporte (Opcional)</label>
                <input
                  type="text"
                  placeholder="ej. Reporte oficial para reunión de fin de mes, auditoría de stock Q2"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs text-slate-700 font-semibold"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-100 mt-6">
              <button
                type="button"
                onClick={() => {
                  if (selectedReport === 'performance') handleExportPerformance();
                  else if (selectedReport === 'inventory') handleExportInventory();
                  else if (selectedReport === 'audit_logs') handleExportLogs();
                  else if (selectedReport === 'orders_flow') handleExportOrders();
                  else if (selectedReport === 'full_backup') handleExportFullBackup();
                }}
                className={`flex-1 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                  selectedReport === 'full_backup'
                    ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-500/20'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {selectedReport === 'full_backup' ? (
                  <>
                    <Database className="h-4.5 w-4.5" />
                    Descargar Respaldo Completo en Excel (.xlsx)
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4.5 w-4.5" />
                    Descargar Excel (.xlsx)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL PRINT PREVIEW OVERLAY REMOVED */}
      {false && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex flex-col justify-start items-center z-50 p-4 overflow-y-auto font-sans animate-fadeIn no-print">
          {/* Print Style Definitions */}
          <style>{`
            @media print {
              /* Show ONLY our printable report area */
              #printable-report-center-area, #printable-report-center-area * {
                visibility: visible !important;
              }
              #printable-report-center-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0px !important;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
                color: black !important;
              }
              .no-print {
                display: none !important;
              }
              body {
                background-color: #fff;
                color: #000;
              }
              @page {
                size: letter;
                margin: 1.5cm;
              }
            }
          `}</style>

          {/* Floating Actions inside preview popup removed */}
          <div className="w-full max-w-4xl bg-slate-800 text-white p-3 rounded-t-2xl shadow-xl flex justify-between items-center no-print">
            <span className="text-xs font-black uppercase tracking-widest pl-3 flex items-center gap-2 font-mono text-indigo-300">
              Vista Previa
            </span>
          </div>

          {/* Letter / A4 Styled Live Document Sheet Preview */}
          <div 
            id="printable-report-center-area"
            className="bg-white text-slate-900 w-full max-w-4xl rounded-b-2xl shadow-2xl p-8 md:p-12 border border-slate-150 overflow-y-auto max-h-[80vh] text-left relative flex flex-col justify-between"
          >
            <div>
              {/* Report Header Logo & Branding */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded bg-slate-950 flex items-center justify-center">
                      <FileDown className="h-4.5 w-4.5 text-white" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-wider font-mono text-slate-900">
                      SISTEMA DE ADMINISTRACIÓN DE ALMACENES WMS
                    </span>
                  </div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase mt-2">
                    {selectedReport === 'performance' && 'REPORTE OPERATIVO Y MÉTRICAS DE RENDIMIENTO'}
                    {selectedReport === 'inventory' && 'REPORTE DE VALORACIÓN Y EXISTENCIAS EN INVENTARIO'}
                    {selectedReport === 'audit_logs' && 'REPORTE DE HISTORIAL DE AUDITORÍA Y REGISTROS'}
                    {selectedReport === 'orders_flow' && 'REPORTE CONSOLIDADO DE PEDIDOS Y FLUJO'}
                  </h1>
                  <p className="text-xs font-medium text-indigo-700 mt-1 uppercase tracking-wider font-mono">
                    {customNotes || 'Documentación Oficial Generada desde Consola Administrativa'}
                  </p>
                </div>

                <div className="text-right font-mono text-[10px] text-slate-500 space-y-1">
                  <div><strong>Fecha de Emisión:</strong> {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  <div><strong>Usuario Auditor:</strong> ernest.quintero78@gmail.com</div>
                  <div><strong>Tipo de Archivo:</strong> WMS_PDF_REPORT</div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold bg-slate-50 border border-slate-200 px-2 py-0.5 rounded inline-block mt-1">
                    Uso Confidencial
                  </div>
                </div>
              </div>

              {/* Active Filter Criteria Subhead */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-6 grid grid-cols-2 gap-3 text-[10px] text-slate-600 font-mono">
                <div>
                  <span className="font-bold text-slate-400 block uppercase text-[8px] tracking-wider">Origen de Datos</span>
                  <span className="text-slate-800 font-bold text-xs">Base de Datos en Tiempo Real (WMS Supabase)</span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 block uppercase text-[8px] tracking-wider">Estado de Validación</span>
                  <span className="text-emerald-600 font-bold text-xs">✓ Verificado y Consistente</span>
                </div>
              </div>

              {/* REPORT TYPE 1: PERFORMANCE REPORT */}
              {selectedReport === 'performance' && (
                <div className="space-y-6">
                  {/* Performance KPIs Row */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-3.5 border border-slate-300 rounded-xl bg-slate-50/50 print-card text-center">
                      <span className="block text-[8px] uppercase font-bold text-slate-400 font-mono tracking-wider">Valor total de Inventario</span>
                      <span className="text-lg font-black font-mono text-slate-900 mt-1 block">{getCurrencySymbol()}{totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="p-3.5 border border-slate-300 rounded-xl bg-slate-50/50 print-card text-center">
                      <span className="block text-[8px] uppercase font-bold text-slate-400 font-mono tracking-wider">Ocupación Física</span>
                      <span className="text-lg font-black font-mono text-slate-900 mt-1 block">{occupancyRate}%</span>
                    </div>
                    <div className="p-3.5 border border-slate-300 rounded-xl bg-slate-50/50 print-card text-center">
                      <span className="block text-[8px] uppercase font-bold text-slate-400 font-mono tracking-wider">SKUs Activos</span>
                      <span className="text-lg font-black font-mono text-slate-900 mt-1 block">{activeSKUsCount} de {filteredInventoryByLine.length}</span>
                    </div>
                    <div className="p-3.5 border border-slate-300 rounded-xl bg-slate-50/50 print-card text-center">
                      <span className="block text-[8px] uppercase font-bold text-slate-400 font-mono tracking-wider">Alertas Críticas</span>
                      <span className="text-lg font-black font-mono text-rose-600 mt-1 block">{lowStockCount} SKUs</span>
                    </div>
                  </div>

                  {/* Operational breakdown */}
                  <div className="space-y-3 pt-4">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono border-b border-slate-200 pb-2">Resumen General de Operaciones</h3>
                    <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                      El almacén se encuentra operando actualmente con una tasa de ocupación del <strong className="text-slate-900">{occupancyRate}%</strong>, 
                      repartido en un total de <strong className="text-slate-900">{occupiedBins} celdas ocupadas</strong> de <strong className="text-slate-900">{totalBins}</strong> ubicaciones físicas disponibles. 
                      La valuación de capital almacenado alcanza los <strong className="text-indigo-700">{getCurrencySymbol()}{totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>{getCurrencySuffix()}.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block font-mono">Movimientos Históricos (Logs)</span>
                        <div className="text-xs space-y-1 text-slate-700 font-semibold">
                          <div>• Entradas / Putaway: <span className="font-bold">{filteredLogsByLine.filter(l => /putaway|inbound|receive|ingreso|add/i.test(l.action + ' ' + l.details)).length}</span></div>
                          <div>• Salidas / Picking: <span className="font-bold">{filteredLogsByLine.filter(l => /pick|dispatch|outbound|picking|remove/i.test(l.action + ' ' + l.details)).length}</span></div>
                          <div>• Ajustes de Stock: <span className="font-bold">{filteredLogsByLine.filter(l => /adjust|count|conteo/i.test(l.action + ' ' + l.details)).length}</span></div>
                        </div>
                      </div>
                      <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block font-mono">Tasa de Fulfillment de Pedidos</span>
                        <div className="text-xs space-y-1 text-slate-700 font-semibold">
                          <div>• Pedidos Totales: <span className="font-bold">{totalOrdersCount}</span></div>
                          <div>• Completados con éxito: <span className="font-bold text-emerald-600">{completedOrders}</span></div>
                          <div>• Pendientes en Cola: <span className="font-bold text-amber-600">{pendingOrders}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* REPORT TYPE 2: INVENTORY STOCK */}
              {selectedReport === 'inventory' && (
                <div className="space-y-6">
                  {/* Summary row */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl print-card text-center">
                      <span className="block text-[8px] uppercase font-bold text-slate-400 font-mono tracking-wider">Unidades Totales</span>
                      <span className="text-base font-black font-mono text-slate-900 mt-1 block">{totalUnits.toLocaleString()}</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl print-card text-center">
                      <span className="block text-[8px] uppercase font-bold text-slate-400 font-mono tracking-wider">Valor Monetario Total</span>
                      <span className="text-base font-black font-mono text-indigo-700 mt-1 block">{getCurrencySymbol()}{totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl print-card text-center">
                      <span className="block text-[8px] uppercase font-bold text-slate-400 font-mono tracking-wider">SKUs en Alerta</span>
                      <span className="text-base font-black font-mono text-amber-700 mt-1 block">{lowStockCount} artículos</span>
                    </div>
                  </div>

                  {/* Inventory Table */}
                  <div className="border border-slate-250 rounded-xl overflow-hidden mt-4">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-250 text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                          <th className="py-2.5 px-3 border-r border-slate-250">Código SKU</th>
                          <th className="py-2.5 px-3 border-r border-slate-250">Nombre del Producto</th>
                          <th className="py-2.5 px-3 border-r border-slate-250">Categoría</th>
                          <th className="py-2.5 px-3 border-r border-slate-250 text-right">Cant.</th>
                          <th className="py-2.5 px-3 border-r border-slate-250 text-right">Costo U.</th>
                          <th className="py-2.5 px-3 border-r border-slate-250 text-right">Valuación</th>
                          <th className="py-2.5 px-3 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-[10px] font-sans">
                        {filteredInventoryByLine.slice(0, 15).map((item) => {
                          const threshold = item.minQty !== undefined && item.minQty > 0 ? item.minQty : globalThreshold;
                          const isLow = item.qty <= threshold;
                          const itemCost = convertItemCost(item.cost || 25);
                          const val = (item.qty || 0) * itemCost;
                          return (
                            <tr key={item.sku} className="hover:bg-slate-50/20">
                              <td className="py-2 px-3 font-mono font-bold text-slate-900 border-r border-slate-200">{item.sku}</td>
                              <td className="py-2 px-3 border-r border-slate-200 font-medium">{item.name}</td>
                              <td className="py-2 px-3 border-r border-slate-200 text-slate-500">{item.category}</td>
                              <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-bold">{item.qty}</td>
                              <td className="py-2 px-3 border-r border-slate-200 text-right font-mono">{getCurrencySymbol()}{itemCost.toFixed(2)}</td>
                              <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-extrabold text-slate-900">{getCurrencySymbol()}{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="py-2 px-3 text-center font-mono font-bold">
                                {isLow ? (
                                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[9px]">BAJO</span>
                                ) : (
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[9px]">ÓPTIMO</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {filteredInventoryByLine.length > 15 && (
                          <tr>
                            <td colSpan={7} className="py-3 px-3 text-center text-slate-400 font-mono text-[9px] font-bold bg-slate-50/50">
                              ... y otros {filteredInventoryByLine.length - 15} SKUs adicionales de almacenamiento. Exportar a Excel para ver el listado completo.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* REPORT TYPE 3: AUDIT LOGS */}
              {selectedReport === 'audit_logs' && (
                <div className="space-y-6">
                  {/* Logs Table */}
                  <div className="border border-slate-250 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-250 text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                          <th className="py-2.5 px-3 border-r border-slate-250">ID Log</th>
                          <th className="py-2.5 px-3 border-r border-slate-250">Fecha y Hora</th>
                          <th className="py-2.5 px-3 border-r border-slate-250">Operario WMS</th>
                          <th className="py-2.5 px-3 border-r border-slate-250">Acción Realizada</th>
                          <th className="py-2.5 px-3">Detalle Técnico</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-[10px] font-sans">
                        {filteredLogsByLine.slice(0, 18).map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/20">
                            <td className="py-2 px-3 font-mono font-bold text-slate-900 border-r border-slate-200">{log.id}</td>
                            <td className="py-2 px-3 border-r border-slate-200 font-mono text-slate-500">{log.timestamp}</td>
                            <td className="py-2 px-3 border-r border-slate-200 font-bold">{log.user}</td>
                            <td className="py-2 px-3 border-r border-slate-200 font-mono text-indigo-700 font-bold">{log.action}</td>
                            <td className="py-2 px-3 font-semibold text-slate-600">{log.details}</td>
                          </tr>
                        ))}
                        {filteredLogsByLine.length > 18 && (
                          <tr>
                            <td colSpan={5} className="py-3 px-3 text-center text-slate-400 font-mono text-[9px] font-bold bg-slate-50/50">
                              ... y otros {filteredLogsByLine.length - 18} registros de auditoría de logs históricos.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* REPORT TYPE 4: ORDERS FLOW */}
              {selectedReport === 'orders_flow' && (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl print-card text-center">
                      <span className="block text-[8px] uppercase font-bold text-slate-400 font-mono tracking-wider">Órdenes de Entrada (Inbound)</span>
                      <span className="text-base font-black font-mono text-slate-900 mt-1 block">{filteredOrdersByLine.filter(o => o.type === 'Inbound').length}</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl print-card text-center">
                      <span className="block text-[8px] uppercase font-bold text-slate-400 font-mono tracking-wider">Órdenes de Salida (Outbound)</span>
                      <span className="text-base font-black font-mono text-slate-900 mt-1 block">{filteredOrdersByLine.filter(o => o.type === 'Outbound').length}</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl print-card text-center">
                      <span className="block text-[8px] uppercase font-bold text-slate-400 font-mono tracking-wider">Tasa de Entrega</span>
                      <span className="text-base font-black font-mono text-emerald-600 mt-1 block">{Math.round((completedOrders / (totalOrdersCount || 1)) * 100)}%</span>
                    </div>
                  </div>

                  {/* Orders Table */}
                  <div className="border border-slate-250 rounded-xl overflow-hidden mt-4">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-250 text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                          <th className="py-2.5 px-3 border-r border-slate-250">ID Pedido</th>
                          <th className="py-2.5 px-3 border-r border-slate-250">Tipo</th>
                          <th className="py-2.5 px-3 border-r border-slate-250">Prioridad</th>
                          <th className="py-2.5 px-3 border-r border-slate-250">Estado</th>
                          <th className="py-2.5 px-3 border-r border-slate-250">Fecha Creación</th>
                          <th className="py-2.5 px-3 border-r border-slate-250">Asignado a</th>
                          <th className="py-2.5 px-3 text-right">Items</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-[10px] font-sans">
                        {filteredOrdersByLine.slice(0, 15).map((order) => {
                          const itemsSum = order.items.reduce((sum, i) => sum + i.qty, 0);
                          return (
                            <tr key={order.id} className="hover:bg-slate-50/20">
                              <td className="py-2 px-3 font-mono font-bold text-slate-900 border-r border-slate-200">{order.id}</td>
                              <td className="py-2 px-3 border-r border-slate-200 font-mono font-bold text-slate-700">
                                {order.type === 'Inbound' ? (
                                  <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">Ingreso</span>
                                ) : (
                                  <span className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">Salida</span>
                                )}
                              </td>
                              <td className="py-2 px-3 border-r border-slate-200 font-mono">{order.priority}</td>
                              <td className="py-2 px-3 border-r border-slate-200 font-bold font-mono">
                                {order.status === 'Completed' ? (
                                  <span className="text-emerald-600">Completa</span>
                                ) : order.status === 'Picking' ? (
                                  <span className="text-blue-600">Picking</span>
                                ) : (
                                  <span className="text-amber-600">Pendiente</span>
                                )}
                              </td>
                              <td className="py-2 px-3 border-r border-slate-200 font-mono text-slate-400">{order.dateCreated.slice(0, 10)}</td>
                              <td className="py-2 px-3 border-r border-slate-200 font-medium">{order.assignedTo || 'Sin Asignar'}</td>
                              <td className="py-2 px-3 text-right font-mono font-extrabold text-slate-900">{itemsSum} uds</td>
                            </tr>
                          );
                        })}
                        {filteredOrdersByLine.length > 15 && (
                          <tr>
                            <td colSpan={7} className="py-3 px-3 text-center text-slate-400 font-mono text-[9px] font-bold bg-slate-50/50">
                              ... y otros {filteredOrdersByLine.length - 15} pedidos de despacho.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer / Verification stamp */}
            <div className="flex justify-between items-center border-t border-slate-200 pt-6 mt-8 text-[9px] text-slate-400 font-mono">
              <div>
                <strong>Firma Responsable:</strong> ____________________________
              </div>
              <div className="text-right">
                Sistema WMS Ledger Engine v2.4 | Copia Controlada para Auditoría
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
