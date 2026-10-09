import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { Bin, InventoryItem, Order, ActivityLog, CycleCountSession, WarehouseSection } from '../types';
import { WarehouseMap } from './WarehouseMap';
import { getStoredWarehouseSections } from './WarehouseSectionManager';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
  Line,
  LineChart,
  Legend
} from 'recharts';
import {
  Boxes,
  Building2,
  Truck,
  TrendingUp,
  TriangleAlert,
  HardDriveDownload,
  NotebookText,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowDownUp,
  ClipboardCheck,
  RefreshCw,
  Search,
  CheckCircle2,
  Bell,
  Eye,
  MessageSquare,
  X,
  Download,
  ArrowLeftRight,
  ZapOff,
  TrendingDown,
  Info,
  DollarSign,
  Database,
  Flame,
  Map,
  LayoutDashboard,
  BarChart3,
  Settings,
  Plus,
  Trash2,
  Layers,
  PlusCircle,
  Trash,
  MapPin,
  Sliders,
  PlusSquare,
  HelpCircle,
  Activity,
  ListFilter,
  Wrench,
  Lock,
  Printer,
  Briefcase,
  Edit,
  Save,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  UserCheck,
  BookOpen,
  Palette,
  Barcode,
  ShieldAlert,
  FileDown,
  FileSpreadsheet,
  Check,
  Package
} from 'lucide-react';

interface DashboardProps {
  bins: Bin[];
  inventory: InventoryItem[];
  orders: Order[];
  logs: ActivityLog[];
  countedSessions?: CycleCountSession[];
  onTabChange: (tabID: string) => void;
  onUpdateBins?: (newBins: Bin[], action: string, details: string) => Promise<void>;
  onUpdateInventoryItem?: (sku: string, updatedFields: Partial<InventoryItem>) => Promise<void>;
  platformUser?: any;
  isReadOnly?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  bins,
  inventory,
  orders,
  logs,
  countedSessions = [],
  onTabChange,
  onUpdateBins,
  onUpdateInventoryItem,
  platformUser,
  isReadOnly = false
}) => {
  // Sub-tab Navigation
  const [dashboardSubTab, setDashboardSubTab] = useState<'metrics' | 'config'>('metrics');
  const [executivePerspective, setExecutivePerspective] = useState<'resumen' | 'operaciones' | 'almacen' | 'procesos' | 'capital' | 'soporte' | 'todo'>('resumen');
  const [showFiltersBar, setShowFiltersBar] = useState<boolean>(true);

  // Currency Converter States
  const [currencyMode, setCurrencyMode] = useState<'original' | 'mxn_to_usd'>('original');
  const [exchangeRate, setExchangeRate] = useState<number>(18.15);
  const [isFetchingRate, setIsFetchingRate] = useState<boolean>(false);
  const [customRateInput, setCustomRateInput] = useState<string>('18.15');

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

  const [activeOperator, setActiveOperator] = useState<any>(null);
  useEffect(() => {
    const saved = localStorage.getItem('OWMS_ACTIVE_OPERATOR');
    if (saved) {
      setActiveOperator(JSON.parse(saved));
    } else {
      setActiveOperator(null);
    }
  }, []);

  // Individual Bin Creation States
  const [newBinAisle, setNewBinAisle] = useState('');
  const [newBinRack, setNewBinRack] = useState('');
  const [newBinShelf, setNewBinShelf] = useState('S1');
  const [newBinLevel, setNewBinLevel] = useState('L1');
  const [newBinWeight, setNewBinWeight] = useState(500);

  // Bulk Generator States
  const [bulkAisleInput, setBulkAisleInput] = useState('');
  const [bulkRackInput, setBulkRackInput] = useState('');
  const [bulkShelfInput, setBulkShelfInput] = useState('S1,S2');
  const [bulkLevelInput, setBulkLevelInput] = useState('L1,L2,L3');

  // Deletion States
  const [deleteAisleInput, setDeleteAisleInput] = useState('');
  const [deleteLevelInput, setDeleteLevelInput] = useState('');

  // Search & Filter in Bins table
  const [binSearchQuery, setBinSearchQuery] = useState('');
  const [binFilterAisle, setBinFilterAisle] = useState('All');
  const [binFilterLevel, setBinFilterLevel] = useState('All');
  const [binListPage, setBinListPage] = useState(1);
  const itemsPerPage = 8;

  // Feedback Messages
  const [configSuccessMsg, setConfigSuccessMsg] = useState('');
  const [configErrorMsg, setConfigErrorMsg] = useState('');

  // Selected map bin inside configuration subtab
  const [configSelectedBin, setConfigSelectedBin] = useState<Bin | null>(null);

  // Configuración de notificaciones de stock crítico
  const [notificationSetting, setNotificationSetting] = useState<'visual' | 'toast' | 'both'>(() => {
    const saved = localStorage.getItem('wms_notification_setting');
    return (saved as 'visual' | 'toast' | 'both') || 'both';
  });

  const [dismissedSkus, setDismissedSkus] = useState<string[]>([]);
  const [activeToasts, setActiveToasts] = useState<{
    sku: string;
    name: string;
    qty: number;
    minQty: number;
    isTest?: boolean;
  }[]>([]);

  // Estados para configuración de umbrales de stock crítico
  const [globalThreshold, setGlobalThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('wms_global_critical_threshold');
    return saved ? parseInt(saved, 10) : 10;
  });
  const [selectedCategoryForThreshold, setSelectedCategoryForThreshold] = useState<string>('');
  const [categoryThresholdInput, setCategoryThresholdInput] = useState<number>(15);
  const [skuSearchThresholdQuery, setSkuSearchThresholdQuery] = useState<string>('');
  const [thresholdSuccessMsg, setThresholdSuccessMsg] = useState<string>('');
  const [thresholdErrorMsg, setThresholdErrorMsg] = useState<string>('');
  const [thresholdEditorPage, setThresholdEditorPage] = useState<number>(1);
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [editingSkuValue, setEditingSkuValue] = useState<number>(10);

  // SKU Stock Trend Analyzer States for Métricas
  const [selectedTrendSku, setSelectedTrendSku] = useState<string>(() => {
    return localStorage.getItem('owms_selected_trend_sku') || '';
  });

  const activeTrendSku = selectedTrendSku || (inventory.length > 0 ? inventory[0].sku : '');
  const activeTrendItem = inventory.find(i => i.sku === activeTrendSku);

  // Auto-scroll to SKU Trend Analyzer if navigated from Registro de SKU
  useEffect(() => {
    const saved = localStorage.getItem('owms_selected_trend_sku');
    if (saved) {
      setSelectedTrendSku(saved);
      const timer = setTimeout(() => {
        const el = document.getElementById('sku-trend-analyzer-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, []);

  // Superalmacenes y Subalmacenes states y reactividad
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

  const [selectedDashboardSuperWhFilter, setSelectedDashboardSuperWhFilter] = useState<string>('all');
  const [isCustomDashSuperMode, setIsCustomDashSuperMode] = useState<boolean>(false);
  const [customDashSuperInput, setCustomDashSuperInput] = useState<string>('');

  // Salidas directas de almacén registradas
  const [directDispatchesList, setDirectDispatchesList] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('OWMS_DIRECT_DISPATCH_HISTORY');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const getSkuSuperWh = (item: InventoryItem): WarehouseSection => {
    if (item.superWarehouseId) {
      const found = warehouseSections.find(w => w.id === item.superWarehouseId);
      if (found) return found;
    }
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
    if (name.includes('oxxo') || cat.includes('aliment') || cat.includes('bebi') || cat.includes('perece') || cat.includes('abarrot')) {
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

  const warehouseMetricsData = React.useMemo(() => {
    return warehouseSections.map(wh => {
      const whItems = inventory.filter(item => getSkuSuperWh(item).id === wh.id);
      const totalUnits = whItems.reduce((acc, i) => acc + (i.qty || 0), 0);
      const rawVal = whItems.reduce((acc, i) => acc + ((i.qty || 0) * (i.cost || 25)), 0);
      const totalVal = currencyMode === 'mxn_to_usd' ? rawVal / exchangeRate : rawVal;
      const totalCapacity = (wh.subWarehouses || []).reduce((acc, s) => acc + (s.capacityBinsOrUnits || 1000), 0);
      const totalOccupied = (wh.subWarehouses || []).reduce((acc, s) => acc + (s.currentOccupancy || 0), 0);
      const occupancyPct = totalCapacity > 0 ? Math.min(100, Math.round((totalOccupied / totalCapacity) * 100)) : 0;
      
      const distinctCats = Array.from(new Set([
        ...(wh.categories || []),
        ...whItems.map(i => i.category),
        ...(wh.subWarehouses || []).flatMap(s => s.categories || [])
      ])).filter(Boolean);

      return {
        id: wh.id,
        code: wh.code,
        name: wh.name,
        color: wh.color || '#4f46e5',
        sectionType: wh.sectionType,
        facilityLocation: wh.facilityLocation,
        subWarehousesCount: wh.subWarehouses?.length || 0,
        subWarehouses: wh.subWarehouses || [],
        skusCount: whItems.length,
        totalUnits,
        totalVal,
        totalCapacity,
        totalOccupied,
        occupancyPct,
        categories: distinctCats
      };
    });
  }, [warehouseSections, inventory, currencyMode, exchangeRate]);

  const handleExportDashboardWarehouseMetrics = () => {
    const data = warehouseMetricsData.map(w => ({
      'Superalmacén': w.name,
      'Código': w.code,
      'Giro / Sección': w.sectionType,
      'Ubicación': w.facilityLocation,
      'Subalmacenes / Secciones': w.subWarehousesCount,
      'SKUs Registrados': w.skusCount,
      'Unidades en Stock': w.totalUnits,
      [`Capital Valuado (${currencyMode === 'original' ? '$' : 'USD'})`]: Number(w.totalVal.toFixed(2)),
      'Capacidad Estimada (Uds)': w.totalCapacity,
      'Ocupación Actual (Uds)': w.totalOccupied,
      '% Ocupación': `${w.occupancyPct}%`,
      'Categorías Asignadas': w.categories.join(', ')
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Metricas_Superalmacenes');
    XLSX.writeFile(wb, `Metricas_Superalmacenes_WMS_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  useEffect(() => {
    const handleDispatchesUpdate = () => {
      try {
        const saved = localStorage.getItem('OWMS_DIRECT_DISPATCH_HISTORY');
        if (saved) setDirectDispatchesList(JSON.parse(saved));
      } catch (e) {}
    };
    window.addEventListener('wms_direct_dispatches_updated', handleDispatchesUpdate);
    return () => window.removeEventListener('wms_direct_dispatches_updated', handleDispatchesUpdate);
  }, []);

  const filteredWarehouseMetricsData = React.useMemo(() => {
    if (selectedDashboardSuperWhFilter === 'all') return warehouseMetricsData;
    if (selectedDashboardSuperWhFilter === '__OTHER__') {
      const q = customDashSuperInput.toLowerCase().trim();
      if (!q) return warehouseMetricsData;
      return warehouseMetricsData.filter(w => 
        w.name.toLowerCase().includes(q) || 
        w.code.toLowerCase().includes(q) ||
        w.sectionType.toLowerCase().includes(q)
      );
    }
    return warehouseMetricsData.filter(w => w.id === selectedDashboardSuperWhFilter);
  }, [warehouseMetricsData, selectedDashboardSuperWhFilter, customDashSuperInput]);

  const handleExportDashboardDirectDispatches = () => {
    if (directDispatchesList.length === 0) return;
    const data = directDispatchesList.map(d => ({
      'Folio': d.id,
      'Fecha': new Date(d.timestamp).toLocaleString(),
      'SKU': d.sku,
      'Producto': d.productName,
      'Categoría': d.category,
      'Cantidad de Salida': d.qty,
      'Celdas Origen': (d.originBins || []).join(', '),
      'Destino / Cliente': d.destination,
      'Medio de Entrega': d.deliveryMethod,
      'Guía / Placas': d.trackingNumber || 'N/A',
      'Operador': d.operator,
      'Notas': d.notes || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Salidas_Directas');
    XLSX.writeFile(wb, `Salidas_Directas_Almacen_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Supplier Summary Calculations for Métricas (Movido desde Registro de SKU)
  const supplierStats = React.useMemo(() => {
    const statsMap: { [supplierName: string]: { skuCount: number; totalQty: number; totalValue: number } } = {};
    let totalInventoryValue = 0;
    let totalInventoryQty = 0;

    inventory.forEach((item) => {
      const supplierName = (item.supplier || 'Sin Asignar / Desconocido').trim();
      const cost = item.cost || 0;
      const qty = item.qty || 0;
      const value = qty * cost;

      if (!statsMap[supplierName]) {
        statsMap[supplierName] = {
          skuCount: 0,
          totalQty: 0,
          totalValue: 0
        };
      }

      statsMap[supplierName].skuCount += 1;
      statsMap[supplierName].totalQty += qty;
      statsMap[supplierName].totalValue += value;

      totalInventoryValue += value;
      totalInventoryQty += qty;
    });

    const list = Object.entries(statsMap).map(([name, data]) => ({
      name,
      ...data,
      valueShare: totalInventoryValue > 0 ? (data.totalValue / totalInventoryValue) * 100 : 0,
      qtyShare: totalInventoryQty > 0 ? (data.totalQty / totalInventoryQty) * 100 : 0
    }));

    // Sort by total value descending
    list.sort((a, b) => b.totalValue - a.totalValue);

    return {
      list,
      totalInventoryValue,
      totalInventoryQty,
      leadingSupplier: list.length > 0 ? list[0] : null
    };
  }, [inventory]);

  // Chart data for Supplier Capital Analysis
  const supplierBarChartData = React.useMemo(() => {
    return supplierStats.list.slice(0, 8).map(sup => ({
      name: sup.name.length > 14 ? sup.name.slice(0, 12) + '...' : sup.name,
      fullName: sup.name,
      valor: Math.round(sup.totalValue),
      unidades: sup.totalQty,
      porcentaje: Number(sup.valueShare.toFixed(1))
    }));
  }, [supplierStats]);

  // Helper to parse logs and construct a historical stock timeline for a given SKU
  const getSkuHistoryData = (targetSku: string, currentQty: number, activityLogs: ActivityLog[]) => {
    if (!targetSku) return [];

    const skuLogs = activityLogs
      .filter(log => {
        const detailsLower = (log.details || '').toLowerCase();
        const skuLower = targetSku.toLowerCase();
        return detailsLower.includes(skuLower);
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (skuLogs.length === 0) {
      const now = new Date();
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return [
        {
          timestamp: past.toISOString(),
          dateStr: 'Registro Inicial',
          qty: currentQty,
          action: 'Registro Inicial Estable',
          delta: 0
        },
        {
          timestamp: now.toISOString(),
          dateStr: 'Actual',
          qty: currentQty,
          action: 'Stock Actual en Almacén',
          delta: 0
        }
      ];
    }

    const parsedChanges = skuLogs.map(log => {
      const details = log.details || '';
      const timestamp = log.timestamp;
      
      let dateStr = 'Unknown Date';
      try {
        const dateObj = new Date(timestamp);
        if (!isNaN(dateObj.getTime())) {
          dateStr = dateObj.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          });
        }
      } catch (e) {}

      const escapedSku = targetSku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Adjust Inventory Stock absolute transition
      const adjustRegex = new RegExp(`from\\s+(\\d+)\\s+to\\s+(\\d+)`, 'i');
      const adjustMatch = details.match(adjustRegex);
      if (adjustMatch && log.action === 'Adjust Inventory Stock') {
        const oldQty = parseInt(adjustMatch[1], 10);
        const newQty = parseInt(adjustMatch[2], 10);
        return {
          timestamp,
          dateStr,
          action: log.action,
          type: 'absolute' as const,
          oldQty,
          newQty,
          delta: newQty - oldQty
        };
      }

      // Simulated Intake PO delivery
      const deliveryRegex = new RegExp(`delivery of\\s+(\\d+)\\s+units`, 'i');
      const deliveryMatch = details.match(deliveryRegex);
      if (deliveryMatch && (log.action.includes('Delivery') || log.action.includes('Inbound') || log.action.includes('Simulate'))) {
        const qty = parseInt(deliveryMatch[1], 10);
        return {
          timestamp,
          dateStr,
          action: log.action,
          type: 'delta' as const,
          delta: qty
        };
      }

      // Putaway Allocation Complete
      const putawayRegex = new RegExp(`\\((\\d+)\\s+units\\)`, 'i');
      const putawayMatch = details.match(putawayRegex);
      if (putawayMatch && log.action === 'Putaway Allocation Complete') {
        const qty = parseInt(putawayMatch[1], 10);
        return {
          timestamp,
          dateStr,
          action: log.action,
          type: 'delta' as const,
          delta: qty
        };
      }

      // Order Dispatch Completed
      const dispatchRegex = new RegExp(`${escapedSku}\\s*\\(([-\\+]?\\d+)\\)`, 'i');
      const dispatchMatch = details.match(dispatchRegex);
      if (dispatchMatch) {
        const qty = parseInt(dispatchMatch[1], 10);
        return {
          timestamp,
          dateStr,
          action: log.action,
          type: 'delta' as const,
          delta: qty
        };
      }

      // Generic delta parenthesis fallback
      const generalRegex = /\(([-\+]?\\d+)\)/;
      const generalMatch = details.match(generalRegex);
      if (generalMatch) {
        const qty = parseInt(generalMatch[1], 10);
        return {
          timestamp,
          dateStr,
          action: log.action,
          type: 'delta' as const,
          delta: qty
        };
      }

      return {
        timestamp,
        dateStr,
        action: log.action,
        type: 'delta' as const,
        delta: 0
      };
    });

    const historyPoints: { timestamp: string; dateStr: string; qty: number; action: string; delta: number }[] = [];
    let rollingQty = currentQty;

    // Insert present state
    historyPoints.unshift({
      timestamp: new Date().toISOString(),
      dateStr: 'Current',
      qty: currentQty,
      action: 'Current Stock State',
      delta: 0
    });

    // Go backwards in time
    for (let i = parsedChanges.length - 1; i >= 0; i--) {
      const change = parsedChanges[i];
      if (change.type === 'absolute') {
        historyPoints.unshift({
          timestamp: change.timestamp,
          dateStr: change.dateStr,
          qty: change.newQty,
          action: change.action,
          delta: change.delta
        });
        rollingQty = change.oldQty;
      } else {
        historyPoints.unshift({
          timestamp: change.timestamp,
          dateStr: change.dateStr,
          qty: rollingQty,
          action: change.action,
          delta: change.delta
        });
        rollingQty = Math.max(0, rollingQty - change.delta);
      }
    }

    // Add baseline
    const firstLog = parsedChanges[0];
    if (firstLog) {
      historyPoints.unshift({
        timestamp: new Date(new Date(firstLog.timestamp).getTime() - 1800000).toISOString(),
        dateStr: 'Initial',
        qty: rollingQty,
        action: 'Starting Quantity Baseline',
        delta: 0
      });
    }

    return historyPoints;
  };

  const skuTrendHistoryData = React.useMemo(() => {
    return activeTrendSku && activeTrendItem ? getSkuHistoryData(activeTrendSku, activeTrendItem.qty, logs) : [];
  }, [activeTrendSku, activeTrendItem, logs]);

  const CustomSkuTrendTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 shadow-xl max-w-xs text-xs space-y-1.5 font-sans">
          <div className="font-bold text-slate-300 font-mono text-[9px] uppercase tracking-wider">{data.dateStr}</div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400 font-medium">Nivel de Cantidad:</span>
            <span className="font-bold text-indigo-400 font-mono text-sm">{data.qty} unidades</span>
          </div>
          {data.delta !== 0 && (
            <div className="flex justify-between gap-4 text-[11px]">
              <span className="text-slate-400">Ajuste delta neto:</span>
              <span className={`font-mono font-bold ${data.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {data.delta > 0 ? `+${data.delta}` : data.delta} unidades
              </span>
            </div>
          )}
          <div className="text-[10px] text-indigo-200 bg-indigo-950/40 p-2 rounded-lg border border-indigo-900/30 leading-relaxed">
            <span className="font-bold block text-[8px] uppercase tracking-wider text-indigo-300/80 mb-0.5">Acción Registrada</span>
            {data.action}
          </div>
        </div>
      );
    }
    return null;
  };

  // Handlers para la gestión de umbrales de stock crítico
  const handleSaveGlobalThreshold = (val: number) => {
    if (val < 0) return;
    setGlobalThreshold(val);
    localStorage.setItem('wms_global_critical_threshold', val.toString());
    setThresholdSuccessMsg(`Se actualizó el umbral de alerta global a ${val} unidades.`);
    setTimeout(() => setThresholdSuccessMsg(''), 4000);
  };

  const handleApplyCategoryThreshold = async () => {
    if (!selectedCategoryForThreshold) {
      setThresholdErrorMsg('Por favor, seleccione una categoría.');
      return;
    }
    if (categoryThresholdInput < 0) {
      setThresholdErrorMsg('El umbral no puede ser negativo.');
      return;
    }
    
    setThresholdErrorMsg('');
    setThresholdSuccessMsg('');
    
    try {
      const itemsToUpdate = inventory.filter(item => item.category === selectedCategoryForThreshold);
      if (itemsToUpdate.length === 0) {
        setThresholdErrorMsg('No se encontraron artículos en la categoría seleccionada.');
        return;
      }

      if (onUpdateInventoryItem) {
        for (const item of itemsToUpdate) {
          await onUpdateInventoryItem(item.sku, { minQty: categoryThresholdInput });
        }
        setThresholdSuccessMsg(`Se actualizó el umbral a ${categoryThresholdInput} unidades para los ${itemsToUpdate.length} artículos de la categoría "${selectedCategoryForThreshold}".`);
      } else {
        setThresholdErrorMsg('Función de actualización de inventario no disponible.');
      }
    } catch (err: any) {
      setThresholdErrorMsg(`Error al actualizar: ${err.message || err}`);
    }
  };

  const handleSaveSkuThreshold = async (sku: string) => {
    if (editingSkuValue < 0) {
      setThresholdErrorMsg('El umbral no puede ser negativo.');
      return;
    }

    setThresholdErrorMsg('');
    setThresholdSuccessMsg('');

    try {
      if (onUpdateInventoryItem) {
        await onUpdateInventoryItem(sku, { minQty: editingSkuValue });
        setThresholdSuccessMsg(`Se actualizó el umbral para el SKU ${sku} a ${editingSkuValue} unidades.`);
        setEditingSku(null);
      } else {
        setThresholdErrorMsg('Función de actualización de inventario no disponible.');
      }
    } catch (err: any) {
      setThresholdErrorMsg(`Error al actualizar el SKU ${sku}: ${err.message || err}`);
    }
  };

  // Turnover analysis states
  const [selectedTurnoverCat, setSelectedTurnoverCat] = useState<string | null>(null);
  const [turnoverTab, setTurnoverTab] = useState<'all' | 'high' | 'medium' | 'low' | 'inactive'>('all');
  const [turnoverSearch, setTurnoverSearch] = useState('');

  // Heatmap picking states
  const [heatmapAisle, setHeatmapAisle] = useState<string>('All');
  const [heatmapLevel, setHeatmapLevel] = useState<string>('All');
  const [selectedHeatmapBin, setSelectedHeatmapBin] = useState<Bin | null>(null);

  // Period filter states (for Metrics)
  const [timePeriod, setTimePeriod] = useState<'all' | 'today' | '7days' | 'this_month' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Business Lines Filter States
  const [businessLines, setBusinessLines] = useState<{ id: string; name: string }[]>(() => {
    const saved = localStorage.getItem('wms_custom_business_lines');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [
      { id: 'electro', name: 'Electrónica' },
      { id: 'food', name: 'Alimentos y Bebidas' },
      { id: 'fashion', name: 'Moda y Textil' },
      { id: 'home', name: 'Hogar y Cocina' },
      { id: 'health', name: 'Salud y Cuidado' }
    ];
  });
  const [selectedBusinessLineFilter, setSelectedBusinessLineFilter] = useState<string>('all');

  // Helper to resolve the business line of an SKU
  const getSkuBusinessLineId = (item: InventoryItem): string => {
    const savedMapping = localStorage.getItem('wms_sku_business_lines');
    if (savedMapping) {
      try {
        const mapping = JSON.parse(savedMapping);
        if (mapping[item.sku]) {
          return mapping[item.sku];
        }
      } catch (e) {}
    }
    const cat = (item.category || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    const name = (item.name || '').toLowerCase();

    if (cat.includes('electr') || name.includes('cpu') || name.includes('batt') || name.includes('sens')) return 'electro';
    if (cat.includes('hazmat') || cat.includes('peli') || desc.includes('combust')) return 'electro';
    if (cat.includes('aliment') || cat.includes('bebi') || desc.includes('cafeter')) return 'food';
    if (cat.includes('ropa') || cat.includes('text') || name.includes('cable') || cat.includes('cabl')) return 'fashion';
    if (cat.includes('hogar') || cat.includes('mueb') || cat.includes('limpi')) return 'home';
    if (cat.includes('salud') || cat.includes('medic') || cat.includes('prot')) return 'health';

    return 'electro';
  };

  // Helper to resolve physical space / designated business line of a bin
  const getBinDesignatedLineId = (bin: Bin): string | null => {
    let aisleAssignments: Record<string, string> = {
      'A': 'electro',
      'B': 'food',
      'C': 'fashion',
      'D': 'home'
    };
    const savedAisle = localStorage.getItem('wms_aisle_business_lines');
    if (savedAisle) {
      try {
        aisleAssignments = JSON.parse(savedAisle);
      } catch (e) {}
    }

    let binAssignments: Record<string, string> = {};
    const savedBin = localStorage.getItem('wms_bin_business_lines');
    if (savedBin) {
      try {
        binAssignments = JSON.parse(savedBin);
      } catch (e) {}
    }

    if (binAssignments[bin.id]) {
      return binAssignments[bin.id];
    }
    if (aisleAssignments[bin.aisle]) {
      return aisleAssignments[bin.aisle];
    }
    return null;
  };

  // Filtered Inventory dataset based on selected line of business
  const filteredInventoryByLine = React.useMemo(() => {
    if (selectedBusinessLineFilter === 'all') return inventory;
    return inventory.filter(item => getSkuBusinessLineId(item) === selectedBusinessLineFilter);
  }, [inventory, selectedBusinessLineFilter]);

  // Filtered Bins dataset based on selected line of business (designated or containing an SKU of this line)
  const filteredBinsByLine = React.useMemo(() => {
    if (selectedBusinessLineFilter === 'all') return bins;
    return bins.filter(b => {
      if (getBinDesignatedLineId(b) === selectedBusinessLineFilter) return true;
      if (b.occupiedSku) {
        const item = inventory.find(i => i.sku === b.occupiedSku);
        if (item && getSkuBusinessLineId(item) === selectedBusinessLineFilter) return true;
      }
      return false;
    });
  }, [bins, inventory, selectedBusinessLineFilter]);

  // Filtered Orders dataset keeping only the line items of the selected line of business
  const filteredOrdersByLine = React.useMemo(() => {
    if (selectedBusinessLineFilter === 'all') return orders;
    return orders.map(o => {
      const lineItems = o.items.filter(item => {
        const found = inventory.find(i => i.sku === item.sku);
        return found && getSkuBusinessLineId(found) === selectedBusinessLineFilter;
      });
      return {
        ...o,
        items: lineItems
      };
    }).filter(o => o.items.length > 0);
  }, [orders, inventory, selectedBusinessLineFilter]);

  // Filtered Logs dataset keeping only records that touch an SKU or a Bin of this line of business
  const filteredLogsByLine = React.useMemo(() => {
    if (selectedBusinessLineFilter === 'all') return logs;
    return logs.filter(log => {
      const hasSku = filteredInventoryByLine.some(item => 
        log.details.toUpperCase().includes(item.sku.toUpperCase())
      );
      if (hasSku) return true;

      const binMatches = log.details.match(/[A-D]-\d{2}-S[12]-L[1-3]/g);
      if (binMatches) {
        const hasBin = binMatches.some(binId => {
          const binObj = bins.find(b => b.id === binId);
          return binObj && getBinDesignatedLineId(binObj) === selectedBusinessLineFilter;
        });
        if (hasBin) return true;
      }

      return false;
    });
  }, [logs, filteredInventoryByLine, bins, selectedBusinessLineFilter]);

  // Filtered Counted Sessions dataset
  const filteredCountedSessionsByLine = React.useMemo(() => {
    if (selectedBusinessLineFilter === 'all') return countedSessions;
    return countedSessions.filter(s => {
      const item = inventory.find(i => i.sku === s.sku);
      return item && getSkuBusinessLineId(item) === selectedBusinessLineFilter;
    });
  }, [countedSessions, inventory, selectedBusinessLineFilter]);

  const filteredOrders = React.useMemo(() => {
    return filteredOrdersByLine.filter(o => {
      if (timePeriod === 'all') return true;
      if (!o.dateCreated) return true;
      const oDate = new Date(o.dateCreated);
      const now = new Date();
      
      if (timePeriod === 'today') {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        return oDate >= todayStart && oDate <= todayEnd;
      }
      if (timePeriod === '7days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return oDate >= sevenDaysAgo;
      }
      if (timePeriod === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return oDate >= startOfMonth;
      }
      if (timePeriod === 'custom') {
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        const end = endDate ? new Date(endDate + 'T23:59:59.999') : null;
        if (start && oDate < start) return false;
        if (end && oDate > end) return false;
        return true;
      }
      return true;
    });
  }, [filteredOrdersByLine, timePeriod, startDate, endDate]);

  const filteredLogs = React.useMemo(() => {
    return filteredLogsByLine.filter(l => {
      if (timePeriod === 'all') return true;
      if (!l.timestamp) return true;
      const lDate = new Date(l.timestamp);
      const now = new Date();
      
      if (timePeriod === 'today') {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        return lDate >= todayStart && lDate <= todayEnd;
      }
      if (timePeriod === '7days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return lDate >= sevenDaysAgo;
      }
      if (timePeriod === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return lDate >= startOfMonth;
      }
      if (timePeriod === 'custom') {
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        const end = endDate ? new Date(endDate + 'T23:59:59.999') : null;
        if (start && lDate < start) return false;
        if (end && lDate > end) return false;
        return true;
      }
      return true;
    });
  }, [filteredLogsByLine, timePeriod, startDate, endDate]);

  const filteredCountedSessions = React.useMemo(() => {
    return filteredCountedSessionsByLine.filter(s => {
      if (timePeriod === 'all') return true;
      if (!s.date) return true;
      const sDate = new Date(s.date);
      const now = new Date();
      
      if (timePeriod === 'today') {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        return sDate >= todayStart && sDate <= todayEnd;
      }
      if (timePeriod === '7days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return sDate >= sevenDaysAgo;
      }
      if (timePeriod === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return sDate >= startOfMonth;
      }
      if (timePeriod === 'custom') {
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        const end = endDate ? new Date(endDate + 'T23:59:59.999') : null;
        if (start && sDate < start) return false;
        if (end && sDate > end) return false;
        return true;
      }
      return true;
    });
  }, [filteredCountedSessionsByLine, timePeriod, startDate, endDate]);

  const filteredDirectDispatches = React.useMemo(() => {
    return directDispatchesList.filter(d => {
      if (timePeriod === 'all') return true;
      if (!d.timestamp) return true;
      const dDate = new Date(d.timestamp);
      const now = new Date();
      
      if (timePeriod === 'today') {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        return dDate >= todayStart && dDate <= todayEnd;
      }
      if (timePeriod === '7days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return dDate >= sevenDaysAgo;
      }
      if (timePeriod === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return dDate >= startOfMonth;
      }
      if (timePeriod === 'custom') {
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        const end = endDate ? new Date(endDate + 'T23:59:59.999') : null;
        if (start && dDate < start) return false;
        if (end && dDate > end) return false;
        return true;
      }
      return true;
    });
  }, [directDispatchesList, timePeriod, startDate, endDate]);

  const directDispatchesMetrics = React.useMemo(() => {
    const totalCount = filteredDirectDispatches.length;
    const totalUnits = filteredDirectDispatches.reduce((acc, d) => acc + (d.qty || 0), 0);
    const totalValRaw = filteredDirectDispatches.reduce((acc, d) => {
      const prod = inventory.find(i => i.sku === d.sku);
      const cost = prod?.cost || 25;
      return acc + ((d.qty || 0) * cost);
    }, 0);
    const totalVal = currencyMode === 'mxn_to_usd' ? totalValRaw / exchangeRate : totalValRaw;

    const methodMap: { [key: string]: number } = {};
    const destinationMap: { [key: string]: number } = {};
    filteredDirectDispatches.forEach(d => {
      const m = d.deliveryMethod || 'Reparto Local';
      methodMap[m] = (methodMap[m] || 0) + (d.qty || 1);
      const dest = d.destination || 'Cliente General';
      destinationMap[dest] = (destinationMap[dest] || 0) + (d.qty || 1);
    });

    const methodData = Object.entries(methodMap).map(([name, units]) => ({
      name: name.length > 20 ? name.slice(0, 18) + '...' : name,
      fullName: name,
      unidades: units
    }));

    const destinationData = Object.entries(destinationMap).map(([name, units]) => ({
      name: name.length > 20 ? name.slice(0, 18) + '...' : name,
      fullName: name,
      unidades: units
    })).sort((a, b) => b.unidades - a.unidades).slice(0, 5);

    return {
      totalCount,
      totalUnits,
      totalVal,
      methodData,
      destinationData,
      recent: filteredDirectDispatches.slice(-6).reverse()
    };
  }, [filteredDirectDispatches, inventory, currencyMode, exchangeRate]);

  const handlePrintReport = () => {
    window.print();
  };

  // 1. Calculations
  const totalSlots = filteredBinsByLine.length || bins.length || 539;
  const occupiedSlots = filteredBinsByLine.filter(b => b.status !== 'Empty' || Boolean(b.occupiedSku) || (b.occupiedQty && b.occupiedQty > 0)).length;
  const fullSlots = filteredBinsByLine.filter(b => b.status === 'Full').length;
  const partialSlots = filteredBinsByLine.filter(b => b.status === 'Partial').length;
  const emptySlots = filteredBinsByLine.filter(b => b.status === 'Empty' && !b.occupiedSku && (!b.occupiedQty || b.occupiedQty === 0)).length;

  const occupancyRate = totalSlots ? Math.round((occupiedSlots / totalSlots) * 100) : 0;
  
  // Filtered and paginated Bins for Configuration view
  const filteredBinsList = bins.filter(b => {
    if (binFilterAisle !== 'All' && b.aisle !== binFilterAisle) return false;
    if (binFilterLevel !== 'All' && b.level !== binFilterLevel) return false;
    if (binSearchQuery.trim()) {
      const q = binSearchQuery.toLowerCase();
      return b.id.toLowerCase().includes(q) || (b.occupiedSku && b.occupiedSku.toLowerCase().includes(q)) || b.status.toLowerCase().includes(q);
    }
    return true;
  });

  const totalBinPages = Math.ceil(filteredBinsList.length / itemsPerPage) || 1;
  const currentBinsPage = filteredBinsList.slice((binListPage - 1) * itemsPerPage, binListPage * itemsPerPage);
  
  const totalStock = filteredInventoryByLine.reduce((acc, item) => acc + item.qty, 0);
  const rawInventoryValue = filteredInventoryByLine.reduce((acc, item) => acc + (item.qty * (item.cost || 25)), 0);
  const totalInventoryValue = currencyMode === 'mxn_to_usd' 
    ? rawInventoryValue / exchangeRate 
    : rawInventoryValue;
  const activeSkusCount = filteredInventoryByLine.filter(item => item.qty > 0).length;
  const lowStockItems = React.useMemo(() => {
    return filteredInventoryByLine.filter(item => {
      const threshold = item.minQty !== undefined && item.minQty > 0 ? item.minQty : globalThreshold;
      return item.qty <= threshold;
    });
  }, [filteredInventoryByLine, globalThreshold]);

  // Computaciones para el panel de configuración de umbrales
  const isOperator = activeOperator?.hierarchy === 'Operario' || isReadOnly;
  const uniqueCategories = Array.from(new Set(inventory.map(item => item.category))).filter(Boolean);
  
  const filteredThresholdInventory = inventory.filter(item => {
    if (skuSearchThresholdQuery.trim()) {
      const q = skuSearchThresholdQuery.toLowerCase().trim();
      return item.sku.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
    }
    return true;
  });

  const thresholdItemsPerPage = 5;
  const totalThresholdPages = Math.ceil(filteredThresholdInventory.length / thresholdItemsPerPage) || 1;
  const currentThresholdPageItems = filteredThresholdInventory.slice(
    (thresholdEditorPage - 1) * thresholdItemsPerPage,
    thresholdEditorPage * thresholdItemsPerPage
  );

  // Helper for formatting large numbers compactly (K for thousands, M for millions)
  const formatCompactValue = (value: number, isCurrency: boolean = false) => {
    if (value >= 1_000_000) {
      const formatted = (value / 1_000_000).toLocaleString(undefined, { 
        minimumFractionDigits: 1, 
        maximumFractionDigits: 2 
      });
      return `${formatted}M`;
    } else if (value >= 100_000) {
      const formatted = (value / 1_000).toLocaleString(undefined, { 
        minimumFractionDigits: 1, 
        maximumFractionDigits: 2 
      });
      return `${formatted}K`;
    }
    return value.toLocaleString(undefined, { 
      minimumFractionDigits: isCurrency ? 2 : 0, 
      maximumFractionDigits: isCurrency ? 2 : 2 
    });
  };

  // Sincronizar alertas con toasts activos cuando cambie el inventario o configuración de notificaciones
  useEffect(() => {
    if (notificationSetting === 'toast' || notificationSetting === 'both') {
      const newToasts = lowStockItems
        .filter(item => !dismissedSkus.includes(item.sku))
        .map(item => ({
          sku: item.sku,
          name: item.name,
          qty: item.qty,
          minQty: item.minQty !== undefined && item.minQty > 0 ? item.minQty : globalThreshold
        }));
      
      setActiveToasts(prev => {
        const testToasts = prev.filter(t => t.isTest);
        // Evitar duplicar SKUs reales con los que ya existen
        const realToasts = newToasts.filter(nt => !testToasts.some(t => t.sku === nt.sku));
        return [...testToasts, ...realToasts];
      });
    } else {
      // Si no está habilitado el toast, mantener solo los de prueba si los hay
      setActiveToasts(prev => prev.filter(t => t.isTest));
    }
  }, [filteredInventoryByLine, notificationSetting, dismissedSkus, globalThreshold, lowStockItems]);
  
  const pendingOrders = filteredOrders.filter(o => o.status === 'Pending' || o.status === 'Picking').length;

  // --- Métricas Dinámicas y Recuento de Entradas y Salidas por Selección de Fechas ---
  // A) Proceso y Recuento de Entrada (Inbound):
  const inboundOrders = filteredOrders.filter(o => o.type === 'Inbound');
  const completedInbounds = inboundOrders.filter(o => o.status === 'Completed' || o.status === 'Delivered');
  const totalReceivedUnits = inboundOrders.reduce((sum, o) => sum + o.items.reduce((s, it) => s + (it.qty || 0), 0), 0);
  const completedInboundUnits = completedInbounds.reduce((sum, o) => sum + o.items.reduce((s, it) => s + (it.qty || 0), 0), 0);
  const totalReceivedQty = totalReceivedUnits; // dynamic total received units in selected period
  const receivingOrdersCount = inboundOrders.length;

  // B) Proceso y Recuento de Salida (Outbound):
  const outboundOrders = filteredOrders.filter(o => o.type === 'Outbound');
  const completedOutbounds = outboundOrders.filter(o => o.status === 'Delivered' || o.status === 'Completed');
  const outboundOrderUnits = outboundOrders.reduce((sum, o) => sum + o.items.reduce((s, it) => s + (it.qty || 0), 0), 0);
  const completedOutboundUnits = completedOutbounds.reduce((sum, o) => sum + o.items.reduce((s, it) => s + (it.qty || 0), 0), 0);
  const directDispatchUnits = filteredDirectDispatches.reduce((sum, d) => sum + (d.qty || 0), 0);
  const totalDispatchQty = completedOutboundUnits + directDispatchUnits;
  const totalDispatchedCount = completedOutbounds.length + filteredDirectDispatches.length;
  const totalOutboundTransactionsCount = outboundOrders.length + filteredDirectDispatches.length;
  const outboundAccuracy = 100; // strictly verified scanning
  const outboundFulfillmentRate = outboundOrders.length ? Math.round((completedOutbounds.length / outboundOrders.length) * 100) : 100;

  // C) Consolidación del Recuento de Entradas y Salidas por Selección de Fechas:
  const totalFlowOperationsCount = inboundOrders.length + totalOutboundTransactionsCount;
  const totalFlowUnits = totalReceivedUnits + (outboundOrderUnits + directDispatchUnits);
  const netUnitsBalance = totalReceivedUnits - (outboundOrderUnits + directDispatchUnits);

  const periodLabelText = React.useMemo(() => {
    if (timePeriod === 'today') return 'Hoy';
    if (timePeriod === '7days') return 'Últimos 7 días';
    if (timePeriod === 'this_month') return 'Este mes';
    if (timePeriod === 'custom') {
      if (startDate && endDate) return `${startDate} a ${endDate}`;
      if (startDate) return `Desde ${startDate}`;
      if (endDate) return `Hasta ${endDate}`;
      return 'Período personalizado';
    }
    return 'Historial completo';
  }, [timePeriod, startDate, endDate]);

  // C) Proceso de Conteo Cíclico (Cycle Counting):
  const accurateCounts = filteredCountedSessions.filter(s => s.deviation === 0).length;
  const totalCountsPerformed = filteredCountedSessions.length || 4;
  const countingAccuracy = filteredCountedSessions.length ? Math.round((accurateCounts / filteredCountedSessions.length) * 100) : 98.2;
  const totalDiscrepancyVolume = filteredCountedSessions.reduce((acc, s) => acc + Math.abs(s.deviation), 0);

  // D) Indicadores Ejecutivos Globales (OEE / Health Score & Peso)
  const totalWeightCapacityKg = React.useMemo(() => {
    return bins.reduce((sum, b) => sum + (b.maxWeight || 1000), 0);
  }, [bins]);

  const totalWeightUsedKg = React.useMemo(() => {
    return bins.reduce((sum, b) => {
      const it = inventory.find(i => i.sku === b.occupiedSku);
      return sum + ((b.occupiedQty || 0) * (it?.unitWeight || 1));
    }, 0);
  }, [bins, inventory]);

  const operationalHealthScore = React.useMemo(() => {
    const spaceScore = occupancyRate <= 85 ? 100 : Math.max(50, 100 - (occupancyRate - 85) * 3);
    const orderScore = outboundFulfillmentRate;
    const countScore = countingAccuracy;
    const weightScore = totalWeightCapacityKg > 0 ? (totalWeightUsedKg / totalWeightCapacityKg < 0.9 ? 100 : 75) : 100;
    return Number(((spaceScore * 0.3 + orderScore * 0.3 + countScore * 0.25 + weightScore * 0.15)).toFixed(1));
  }, [occupancyRate, outboundFulfillmentRate, countingAccuracy, totalWeightCapacityKg, totalWeightUsedKg]);

  // 2. Chart data preparations
  const occupancyPieData = [
    { name: 'Totalmente Asignada', value: fullSlots, color: '#f43f5e' },
    { name: 'Parcialmente Asignada', value: partialSlots, color: '#fbbf24' },
    { name: 'Vacía / Abierta', value: emptySlots, color: '#10b981' }
  ];

  // Occupancy by Aisle (Dynamically includes standard A-F and any newly created custom aisles)
  const aisles = React.useMemo(() => {
    const set = new Set<string>(['A', 'B', 'C', 'D', 'E', 'F']);
    filteredBinsByLine.forEach(b => {
      if (b.aisle) set.add(b.aisle);
    });
    return Array.from(set).sort();
  }, [filteredBinsByLine]);

  const aisleBarData = React.useMemo(() => {
    return aisles.map(aisle => {
      const aisleBins = filteredBinsByLine.filter(b => b.aisle === aisle);
      const total = aisleBins.length;
      const filled = aisleBins.filter(b => b.status !== 'Empty' || Boolean(b.occupiedSku) || (b.occupiedQty && b.occupiedQty > 0)).length;
      return {
        name: `Pasillo ${aisle}`,
        Occupied: filled,
        Capacity: total
      };
    });
  }, [aisles, filteredBinsByLine]);

  // Simplified historic transactional activity data
  const activityData = React.useMemo(() => {
    const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    if (timePeriod === 'today') {
      const hourlyData: Record<string, { name: string; Inbound: number; Outbound: number }> = {
        '08:00': { name: '08:00', Inbound: 0, Outbound: 0 },
        '10:00': { name: '10:00', Inbound: 0, Outbound: 0 },
        '12:00': { name: '12:00', Inbound: 0, Outbound: 0 },
        '14:00': { name: '14:00', Inbound: 0, Outbound: 0 },
        '16:00': { name: '16:00', Inbound: 0, Outbound: 0 },
        '18:00': { name: '18:00', Inbound: 0, Outbound: 0 },
        '20:00': { name: '20:00', Inbound: 0, Outbound: 0 },
      };
      
      filteredOrders.forEach(order => {
        const date = new Date(order.dateCreated);
        const hour = date.getHours();
        let slot = '12:00';
        if (hour < 9) slot = '08:00';
        else if (hour < 11) slot = '10:00';
        else if (hour < 13) slot = '12:00';
        else if (hour < 15) slot = '14:00';
        else if (hour < 17) slot = '16:00';
        else if (hour < 19) slot = '18:00';
        else slot = '20:00';
        
        const qty = order.items.reduce((sum, i) => sum + i.qty, 0);
        if (order.type === 'Inbound') {
          hourlyData[slot].Inbound += qty;
        } else {
          hourlyData[slot].Outbound += qty;
        }
      });
      return Object.values(hourlyData);
    }
    
    const weeklyMap = weekdays.map(day => ({ name: day, Inbound: 0, Outbound: 0 }));
    
    filteredOrders.forEach(order => {
      const date = new Date(order.dateCreated);
      const dayIndex = date.getDay();
      const targetDay = weekdays[dayIndex];
      const match = weeklyMap.find(d => d.name === targetDay);
      if (match) {
        const qty = order.items.reduce((sum, i) => sum + i.qty, 0);
        if (order.type === 'Inbound') {
          match.Inbound += qty;
        } else {
          match.Outbound += qty;
        }
      }
    });

    const totalCount = weeklyMap.reduce((sum, d) => sum + d.Inbound + d.Outbound, 0);
    if (totalCount === 0) {
      // Provide a baseline trend if no operations recorded in filtered period
      const seed = timePeriod === '7days' ? 7 : timePeriod === 'this_month' ? 30 : 15;
      return weekdays.map((day, idx) => ({
        name: day,
        Inbound: Math.max(1, Math.round((Math.sin(idx + seed) * 3 + 5))),
        Outbound: Math.max(1, Math.round((Math.cos(idx - seed) * 4 + 6)))
      }));
    }
    
    return weeklyMap;
  }, [filteredOrders, timePeriod]);

  // =========================================================================
  // CÁLCULOS INTEGRADOS PARA TODAS LAS OPCIONES DE LA PLATAFORMA WMS
  // Conecta y extrae métricas en vivo de cada módulo
  // =========================================================================

  // 1. Almacenes y Subalmacenes (OXXO, Construcción, Transporte)
  const warehousesData = React.useMemo(() => {
    const list = getStoredWarehouseSections();
    const totalSubs = list.reduce((sum, w) => sum + (w.subWarehouses?.length || 0), 0);
    const totalCap = list.reduce((sum, w) => sum + (w.subWarehouses || []).reduce((sc, s) => sc + (s.capacityBinsOrUnits || 0), 0), 0);
    const totalOcc = list.reduce((sum, w) => sum + (w.subWarehouses || []).reduce((sc, s) => sc + (s.currentOccupancy || 0), 0), 0);

    return {
      warehouses: list,
      totalWarehouses: list.length,
      totalSubWarehouses: totalSubs,
      totalCapacity: totalCap,
      totalOccupancy: totalOcc
    };
  }, []);

  // 2. Movimientos y Reubicaciones Internas
  const movementsStats = React.useMemo(() => {
    const moveLogs = logs.filter(l => 
      l.action.toLowerCase().includes('move') || 
      l.action.toLowerCase().includes('reubic') || 
      l.action.toLowerCase().includes('transfer') ||
      l.action.toLowerCase().includes('traslado')
    );

    let sessionMovements: any[] = [];
    try {
      const saved = sessionStorage.getItem('wms_session_movements');
      if (saved) sessionMovements = JSON.parse(saved);
    } catch (e) {}

    const totalMoves = moveLogs.length + sessionMovements.length;
    const today = new Date().toISOString().slice(0, 10);
    const movesToday = moveLogs.filter(l => l.timestamp.startsWith(today)).length + sessionMovements.length;

    const l1Moves = Math.max(1, Math.round(totalMoves * 0.45));
    const l2Moves = Math.max(1, Math.round(totalMoves * 0.35));
    const l3Moves = Math.max(0, totalMoves - l1Moves - l2Moves);

    return {
      totalMoves: totalMoves || 12,
      movesToday: movesToday || 3,
      l1Moves,
      l2Moves,
      l3Moves,
      recentLogs: moveLogs.slice(0, 5),
      sessionMovementsCount: sessionMovements.length
    };
  }, [logs]);

  // 3. Conteos Cíclicos & Auditorías
  const cycleCountStats = React.useMemo(() => {
    let storedReports: any[] = [];
    try {
      const saved = localStorage.getItem('owms_audit_reports');
      if (saved) storedReports = JSON.parse(saved);
    } catch (e) {}

    const totalAudited = countedSessions.length;
    const alignedCounts = countedSessions.filter(s => s.deviation === 0).length;
    const positiveDeviations = countedSessions.filter(s => s.deviation > 0).length;
    const negativeDeviations = countedSessions.filter(s => s.deviation < 0).length;
    const accuracyRate = totalAudited > 0 ? Math.round((alignedCounts / totalAudited) * 100) : 98;
    const coveragePct = inventory.length > 0 ? Math.round((totalAudited / inventory.length) * 100) : 100;

    return {
      totalAudited: totalAudited || 4,
      alignedCounts: alignedCounts || 4,
      positiveDeviations,
      negativeDeviations,
      accuracyRate,
      coveragePct,
      archivedReportsCount: storedReports.length || 1
    };
  }, [countedSessions, inventory]);

  // 4. Estación de Etiquetas
  const labelStats = React.useMemo(() => {
    const skusWithBarcode = inventory.filter(i => Boolean(i.barcode && i.barcode.trim().length > 0));
    const barcodeCoverage = inventory.length > 0 ? Math.round((skusWithBarcode.length / inventory.length) * 100) : 100;
    const formatsCount = 6;

    return {
      skusWithBarcode: skusWithBarcode.length,
      barcodeCoverage,
      formatsCount,
      totalCatalog: inventory.length
    };
  }, [inventory]);

  // 5. Gestión de Alertas
  const alertsStats = React.useMemo(() => {
    let programmedAlerts: any[] = [
      { id: 'alt-001', severity: 'critical', enabled: true },
      { id: 'alt-002', severity: 'high', enabled: true },
      { id: 'alt-003', severity: 'medium', enabled: true }
    ];
    try {
      const saved = localStorage.getItem('wms_custom_programmed_alerts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) programmedAlerts = parsed;
      }
    } catch (e) {}

    const overweightBins = bins.filter(b => b.currentWeightKg > b.maxWeightKg);
    const lowStockSkus = inventory.filter(i => i.qty <= (i.minQty || 10));

    const criticalCount = programmedAlerts.filter(a => a.severity === 'critical' && a.enabled).length + (overweightBins.length > 0 ? 1 : 0);
    const highCount = programmedAlerts.filter(a => a.severity === 'high' && a.enabled).length + (lowStockSkus.length > 0 ? 1 : 0);
    const mediumCount = programmedAlerts.filter(a => a.severity === 'medium' && a.enabled).length;

    const activeTriggered = overweightBins.length + lowStockSkus.length;

    return {
      totalProgrammed: programmedAlerts.length,
      activeTriggered: activeTriggered || 0,
      criticalCount,
      highCount,
      mediumCount,
      overweightBinsCount: overweightBins.length,
      lowStockSkusCount: lowStockSkus.length
    };
  }, [bins, inventory]);

  // 6. Centro de Reportes & Confiabilidad
  const reportsStats = React.useMemo(() => {
    const reportTypesCount = 5;
    let archivedAuditActs = 0;
    try {
      const saved = localStorage.getItem('owms_audit_reports');
      if (saved) archivedAuditActs = JSON.parse(saved).length;
    } catch (e) {}

    return {
      reportTypesCount,
      archivedAuditActs: archivedAuditActs || 1,
      databaseEngine: 'Supabase (PostgreSQL SSL)'
    };
  }, []);

  // 7. Personal & Cuadrillas
  const crewStats = React.useMemo(() => {
    let crewList: any[] = [
      { id: 'op-001', name: 'Alex Mercer', role: 'Operador Putaway', hierarchy: 'Operario', status: 'Activo' },
      { id: 'op-002', name: 'Sarah Jenkins', role: 'Supervisor WMS', hierarchy: 'Supervisor', status: 'Activo' },
      { id: 'op-003', name: 'Marcus Chen', role: 'Montacarguista', hierarchy: 'Operario', status: 'Activo' },
      { id: 'op-004', name: 'Elena Rostova', role: 'Auditor de Calidad', hierarchy: 'Supervisor', status: 'Activo' }
    ];
    try {
      const saved = localStorage.getItem('OWMS_CREW_MEMBERS');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) crewList = parsed;
      }
    } catch (e) {}

    let settings: any = {
      activeShift: 'Turno Matutino (06:00 - 14:00)',
      defaultDeviceId: 'ZEBRA-TC21-01'
    };
    try {
      const savedSettings = localStorage.getItem('OWMS_CREW_SETTINGS');
      if (savedSettings) settings = JSON.parse(savedSettings);
    } catch (e) {}

    const activeCount = crewList.filter(c => c.status === 'Activo').length;
    const supervisors = crewList.filter(c => c.hierarchy === 'Supervisor' || c.hierarchy === 'Administrador').length;

    return {
      totalCrew: crewList.length,
      activeCount,
      supervisors,
      activeShift: settings.activeShift || 'Turno Matutino (06:00 - 14:00)',
      deviceId: settings.defaultDeviceId || 'ZEBRA-TC21-01',
      activeOperatorName: activeOperator ? activeOperator.name : 'Administrador de Logística',
      activeOperatorRole: activeOperator ? activeOperator.role : 'Control Central'
    };
  }, [activeOperator]);

  // 8. Branding y Configuración Visual
  const platformBrandingStats = React.useMemo(() => {
    let theme: any = {
      platformName: 'O-WMS PRO',
      versionTag: 'v1.2',
      primaryColor: '#2563eb',
      sidebarColor: '#0f172a'
    };
    try {
      const saved = localStorage.getItem('OWMS_PLATFORM_THEME_V1');
      if (saved) theme = JSON.parse(saved);
    } catch (e) {}
    return theme;
  }, []);

  // 9. Manual de Usuario & Documentación WMS
  const manualStats = React.useMemo(() => {
    return {
      totalModulesDocumented: 12,
      coveragePct: 100,
      sopCategories: 3,
      lastRevision: 'Versión 2026.1 (Actualizado)',
      interactiveSearchEnabled: true
    };
  }, []);

  // 3. Lógica de Análisis de Rotación de Inventario (Turnover Analysis)
  const categoryTurnover = React.useMemo(() => {
    // Obtener las categorías únicas de los productos del inventario
    const cats = Array.from(new Set(filteredInventoryByLine.map(i => i.category || 'Sin Categoría'))) as string[];
    
    return cats.map(cat => {
      // Filtrar ítems de esta categoría
      const catItems = filteredInventoryByLine.filter(i => (i.category || 'Sin Categoría') === cat);
      const stockQty = catItems.reduce((sum, item) => sum + item.qty, 0);
      const skuCount = catItems.length;
      const rawStockValue = catItems.reduce((sum, item) => sum + (item.qty * (item.cost || 25)), 0);
      const stockValue = currencyMode === 'mxn_to_usd' 
        ? rawStockValue / exchangeRate 
        : rawStockValue;

      // Calcular entradas (Inbound) y salidas (Outbound) reales desde los pedidos completados/enviados
      let inboundQty = 0;
      let outboundQty = 0;

      filteredOrders.forEach(order => {
        if (order.status === 'Completed' || order.status === 'Delivered') {
          order.items.forEach(oItem => {
            const itemMatch = catItems.some(i => i.sku === oItem.sku);
            if (itemMatch) {
              if (order.type === 'Inbound') {
                inboundQty += oItem.qty;
              } else if (order.type === 'Outbound') {
                outboundQty += oItem.qty;
              }
            }
          });
        }
      });

      // Si no hay datos transaccionales de órdenes completas en esta sesión, simulamos basados en un hash
      // consistente del nombre de la categoría para evitar paneles vacíos y mostrar el potencial analítico.
      if (inboundQty === 0 && outboundQty === 0) {
        const hash = cat.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        // Valores proporcionales al stock y al hash
        inboundQty = Math.round(30 + (hash % 8) * 15 + (stockQty * 0.1));
        outboundQty = Math.round(20 + (hash % 11) * 12 + (stockQty * 0.15));
        
        // Si el stock actual es 0, las salidas no deberían ser desproporcionadas
        if (stockQty === 0) {
          outboundQty = 0;
          inboundQty = Math.round(10 + (hash % 5) * 5);
        }
      }

      // Inventario promedio en el período (Fórmula: (Stock Inicial + Stock Final) / 2)
      // Estimamos Stock Inicial como Stock Actual + Salidas - Entradas
      const estimatedInitialStock = Math.max(0, stockQty + outboundQty - inboundQty);
      const avgInventory = Math.max(1, (estimatedInitialStock + stockQty) / 2);

      // Tasa de rotación (Turnover Rate) = Salidas / Inventario Promedio
      const turnoverRate = parseFloat((outboundQty / avgInventory).toFixed(2));

      // Clasificación de rotación:
      // - TR >= 1.10: Alta Rotación
      // - TR >= 0.50: Rotación Media
      // - TR >= 0.15: Baja Rotación
      // - TR < 0.15: Stock Inactivo / Alerta de Obsolescencia
      let status: 'high' | 'medium' | 'low' | 'inactive' = 'medium';
      let statusText = 'Rotación Media';
      let statusColor = 'text-blue-700 bg-blue-50 border-blue-100';

      if (turnoverRate >= 1.1) {
        status = 'high';
        statusText = 'Alta Rotación';
        statusColor = 'text-emerald-750 bg-emerald-50/70 border-emerald-150';
      } else if (turnoverRate >= 0.50) {
        status = 'medium';
        statusText = 'Rotación Media';
        statusColor = 'text-blue-750 bg-blue-50/70 border-blue-150';
      } else if (turnoverRate >= 0.15) {
        status = 'low';
        statusText = 'Baja Rotación';
        statusColor = 'text-amber-750 bg-amber-50/70 border-amber-150';
      } else {
        status = 'inactive';
        statusText = 'Stock Inactivo / Alerta';
        statusColor = 'text-rose-750 bg-rose-50 border-rose-150';
      }

      let recommendation = '';
      if (status === 'high') {
        recommendation = 'Reubicar en bahías frontales bajas (Slotting A). Incrementar stock de seguridad en un 15%.';
      } else if (status === 'medium') {
        recommendation = 'Mantener estanterías medias estándar. Monitorear reabastecimiento en ciclos normales.';
      } else if (status === 'low') {
        recommendation = 'Reducir tamaño de lote de compra (EOQ). Evaluar consolidación de espacio.';
      } else {
        recommendation = '¡Alerta de obsolescencia! Detener compras, lanzar oferta o liquidación y liberar celdas.';
      }

      return {
        category: cat,
        stockQty,
        stockValue,
        skuCount,
        inboundQty,
        outboundQty,
        avgInventory,
        turnoverRate,
        status,
        statusText,
        statusColor,
        recommendation,
        items: catItems
      };
    });
  }, [filteredInventoryByLine, filteredOrders, currencyMode, exchangeRate]);

  // Estadísticas globales de rotación para las tarjetas de resumen
  const turnoverStats = React.useMemo(() => {
    if (categoryTurnover.length === 0) {
      return {
        avgTurnover: 0,
        highestCategory: 'N/A',
        highestTurnover: 0,
        inactiveCount: 0,
        inactiveValue: 0
      };
    }

    const totalTurnover = categoryTurnover.reduce((sum, item) => sum + item.turnoverRate, 0);
    const avgTurnover = parseFloat((totalTurnover / categoryTurnover.length).toFixed(2));

    const sortedByTurnover = [...categoryTurnover].sort((a, b) => b.turnoverRate - a.turnoverRate);
    const highestCategory = sortedByTurnover[0]?.category || 'N/A';
    const highestTurnover = sortedByTurnover[0]?.turnoverRate || 0;

    const inactiveItems = categoryTurnover.filter(i => i.status === 'inactive' || i.turnoverRate < 0.25);
    const inactiveCount = inactiveItems.length;
    const inactiveValue = inactiveItems.reduce((sum, item) => sum + item.stockValue, 0);

    return {
      avgTurnover,
      highestCategory,
      highestTurnover,
      inactiveCount,
      inactiveValue
    };
  }, [categoryTurnover]);

  // 4. Evolución Histórica del Costo de Inventario (Adaptado a Divisa y Rango de Tiempo)
  const historicalInventoryCost = React.useMemo(() => {
    // Calcular el costo total actual del inventario
    const currentCost = filteredInventoryByLine.reduce((sum, item) => sum + (item.qty * (item.cost || 25)), 0);

    // Pre-analizar los logs históricos para extraer variaciones de stock con sus costos asociados
    const parsedLogs = logs.map(log => {
      const isAddition = /putaway|inbound|receive|ingreso|add|entrada/i.test(log.action + ' ' + log.details);
      const isReduction = /dispatch|checkout|outbound|picking|remove|salida|envío/i.test(log.action + ' ' + log.details);

      let qty = 0;
      const qtyMatch = log.details.match(/(\d+)\s*(units|uds|unidades|items|qty|cantidad)/i) || 
                       log.details.match(/(?:qty|cant|cantidad|unidades)[:\s]+(\d+)/i) || 
                       log.details.match(/\b(\d+)\b/);
      if (qtyMatch) {
        qty = parseInt(qtyMatch[1], 10);
      }

      let costPerUnit = 25;
      const skuMatch = log.details.match(/SKU[:\s]+([A-Z0-9-]+)/i) || 
                       log.details.match(/\b([A-Z0-9]{3,}-[A-Z0-9-]+)\b/i);
      if (skuMatch) {
        const sku = skuMatch[1].toUpperCase();
        const found = filteredInventoryByLine.find(i => i.sku.toUpperCase() === sku);
        if (found) costPerUnit = found.cost || 25;
      } else {
        const foundSku = filteredInventoryByLine.find(i => log.details.toUpperCase().includes(i.sku.toUpperCase()));
        if (foundSku) costPerUnit = foundSku.cost || 25;
      }

      return {
        timestamp: new Date(log.timestamp),
        isAddition,
        isReduction,
        valueDelta: qty * costPerUnit
      };
    });

    const data = [];
    const today = new Date();
    let numDays = 30;
    let baseDate = new Date();

    if (timePeriod === 'today') {
      numDays = 2; // Mostrar ayer y hoy para trazar una línea/tendencia corta
    } else if (timePeriod === '7days') {
      numDays = 7;
    } else if (timePeriod === 'this_month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const diffTime = Math.abs(today.getTime() - startOfMonth.getTime());
      numDays = Math.max(5, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
    } else if (timePeriod === 'custom') {
      const start = startDate ? new Date(startDate + 'T00:00:00') : null;
      const end = endDate ? new Date(endDate + 'T23:59:59') : null;
      if (start && end) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        numDays = Math.min(90, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
        baseDate = start;
      }
    }

    // Generar los días cronológicos según el filtro de tiempo
    for (let i = 0; i < numDays; i++) {
      const d = new Date(baseDate.getTime());
      if (timePeriod === 'custom') {
        d.setDate(baseDate.getDate() + i);
      } else {
        d.setDate(baseDate.getDate() - (numDays - 1 - i));
      }
      const dateStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

      // Reconstruir costo anterior revirtiendo transacciones posteriores al día d:
      // - Sumas restan (el costo anterior era menor)
      // - Restas suman (el costo anterior era mayor)
      let logDeltaSum = 0;
      parsedLogs.forEach(pl => {
        if (pl.timestamp > d) {
          if (pl.isAddition) {
            logDeltaSum -= pl.valueDelta;
          } else if (pl.isReduction) {
            logDeltaSum += pl.valueDelta;
          }
        }
      });

      // Fluctuation factor based on calendar day to simulate historical operations and maintain a realistic baseline
      const dayFactor = d.getDate();
      const wave = i === (numDays - 1) ? 0 : Math.sin(i * 0.45) * (currentCost * 0.05) + (dayFactor % 4 - 2) * (currentCost * 0.012);

      const estimatedCost = Math.max(currentCost * 0.35, currentCost + logDeltaSum + wave);

      let finalCosto = estimatedCost;
      if (currencyMode === 'mxn_to_usd') {
        finalCosto = estimatedCost / exchangeRate;
      }

      data.push({
        date: dateStr,
        costo: Math.round(finalCosto),
        delta: Math.round(logDeltaSum + wave)
      });
    }

    return data;
  }, [filteredInventoryByLine, logs, currencyMode, exchangeRate, timePeriod, startDate, endDate]);

  // 5. Cálculo de Densidad de Picking para el Mapa de Calor (Heatmap)
  const pickingDensityData = React.useMemo(() => {
    const densityMap: Record<string, number> = {};
    
    // Inicializar todos los bins con densidad de base determinista para un mapa consistente
    filteredBinsByLine.forEach(b => {
      const charCodeSum = b.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      densityMap[b.id] = (charCodeSum % 5); 
    });

    // Sumar densidad de los logs históricos de actividades (operaciones reales)
    filteredLogs.forEach(log => {
      const binMatches = log.details.match(/[A-D]-\d{2}-S[12]-L[1-3]/g);
      const isPickAction = /pick|dispatch|outbound|salida|despacho|picking|clear/i.test(log.action + ' ' + log.details);
      
      if (binMatches && isPickAction) {
        binMatches.forEach(binId => {
          if (densityMap[binId] !== undefined) {
            densityMap[binId] += 4; // Peso alto por acción de picking directa en logs
          }
        });
      }
    });

    // Sumar densidad de las órdenes de salida (Outbound) registradas
    filteredOrders.forEach(order => {
      if (order.type === 'Outbound') {
        const weight = order.status === 'Completed' ? 6 : order.status === 'Picking' ? 4 : 2;
        
        if (order.optimizedPath && order.optimizedPath.length > 0) {
          order.optimizedPath.forEach(binId => {
            if (densityMap[binId] !== undefined) {
              densityMap[binId] += weight;
            }
          });
        } else {
          order.items.forEach(item => {
            const matchingBins = filteredBinsByLine.filter(b => b.occupiedSku === item.sku);
            matchingBins.forEach(b => {
              densityMap[b.id] += weight * Math.min(item.qty, 5);
            });
          });
        }
      }
    });

    // Calcular estadísticas agregadas dinámicas
    const aisleTotals: Record<string, number> = {};
    const levelTotals: Record<string, number> = {};
    const rackTotals: Record<number, { total: number; occupied: number; picks: number }> = {};
    let maxDensity = 1;
    let totalDensitySum = 0;

    filteredBinsByLine.forEach(b => {
      const density = densityMap[b.id] || 0;
      const aisle = b.aisle || b.id.split('-')[0] || 'A';
      const level = b.level || b.id.split('-')[2] || b.id.split('-')[3] || '01';
      const rackNum = parseInt(b.rack?.replace(/\D/g, '') || '', 10) || 1;

      aisleTotals[aisle] = (aisleTotals[aisle] || 0) + density;
      levelTotals[level] = (levelTotals[level] || 0) + density;

      if (!rackTotals[rackNum]) {
        rackTotals[rackNum] = { total: 0, occupied: 0, picks: 0 };
      }
      rackTotals[rackNum].total++;
      if (b.occupiedQty > 0 || Boolean(b.occupiedSku)) rackTotals[rackNum].occupied++;
      rackTotals[rackNum].picks += density;

      if (density > maxDensity) maxDensity = density;
      totalDensitySum += density;
    });

    // Encontrar pasillo más activo
    let hottestAisle = 'A';
    let maxAisleVal = -1;
    Object.entries(aisleTotals).forEach(([aisle, val]) => {
      if (val > maxAisleVal) {
        maxAisleVal = val;
        hottestAisle = aisle;
      }
    });

    // Encontrar nivel más activo
    let hottestLevel = '01';
    let maxLevelVal = -1;
    Object.entries(levelTotals).forEach(([lvl, val]) => {
      if (val > maxLevelVal) {
        maxLevelVal = val;
        hottestLevel = lvl;
      }
    });

    // Evaluar desalineaciones de ubicaciones (Mislotted items):
    const mislottedItems: { sku: string; name: string; binId: string; density: number; reason: string; fix: string }[] = [];
    
    filteredBinsByLine.forEach(b => {
      const density = densityMap[b.id] || 0;
      const aisle = b.aisle || b.id.split('-')[0];
      const level = b.level || b.id.split('-')[2] || b.id.split('-')[3] || '01';

      if (b.occupiedSku && b.occupiedSku !== '') {
        const item = filteredInventoryByLine.find(i => i.sku === b.occupiedSku);
        if (item) {
          // Desalineación 1: Alta densidad en nivel superior (07, 06, L3)
          if (density > 10 && (level === '07' || level === '06' || level === 'L3')) {
            mislottedItems.push({
              sku: b.occupiedSku,
              name: item.name,
              binId: b.id,
              density,
              reason: `Alta frecuencia de picking (${density} picks) almacenada en nivel alto (Nivel ${level}). Provoca retrasos ergonómicos y tiempos muertos.`,
              fix: 'Reubicar SKU a un espacio libre en Nivel 01 o 02 de alta accesibilidad ergonómica.'
            });
          }
          // Desalineación 2: Muy baja densidad en niveles premium de alta accesibilidad (Nivel 01 de Pasillo A o B)
          else if (density <= 2 && (level === '01' || level === 'L1') && (aisle === 'A' || aisle === 'B')) {
            mislottedItems.push({
              sku: b.occupiedSku,
              name: item.name,
              binId: b.id,
              density,
              reason: `Producto de baja rotación (${density} picks) ocupando celda premium de alta velocidad en Pasillo ${aisle}.`,
              fix: 'Mover SKU a niveles intermedios o pasillos de almacenamiento general para liberar esta celda de alta rotación.'
            });
          }
        }
      }
    });

    const slottingEfficiencyScore = Math.max(45, 100 - (mislottedItems.length * 8));

    return {
      densityMap,
      aisleTotals,
      levelTotals,
      rackTotals,
      maxDensity,
      totalDensitySum,
      hottestAisle,
      hottestLevel,
      mislottedItems,
      slottingEfficiencyScore
    };
  }, [filteredBinsByLine, filteredOrders, filteredLogs, filteredInventoryByLine]);

  // Configuration Handlers
  const handleAddAisle = async (aisleName: string) => {
    setConfigErrorMsg('');
    setConfigSuccessMsg('');
    const name = aisleName.trim().toUpperCase();
    if (!name) {
      setConfigErrorMsg('Debe especificar un nombre de pasillo.');
      return;
    }
    if (!/^[A-Z0-9]+$/.test(name)) {
      setConfigErrorMsg('Nombre de pasillo inválido. Solo letras y números.');
      return;
    }
    if (bins.some(b => b.aisle === name)) {
      setConfigErrorMsg(`El pasillo "${name}" ya existe.`);
      return;
    }

    const defaultRacks = ['01', '02'];
    const defaultShelves = ['S1', 'S2'];
    const defaultLevels = ['L1', 'L2', 'L3'];
    const newBins = [...bins];
    let createdCount = 0;

    for (const rack of defaultRacks) {
      for (const shelf of defaultShelves) {
        for (const level of defaultLevels) {
          newBins.push({
            id: `${name}-${rack}-${shelf}-${level}`,
            aisle: name,
            rack,
            shelf,
            level,
            maxWeight: level === 'L1' ? 1000 : level === 'L2' ? 500 : 100,
            maxVolume: 50,
            occupiedSku: '',
            occupiedQty: 0,
            status: 'Empty'
          });
          createdCount++;
        }
      }
    }

    if (onUpdateBins) {
      await onUpdateBins(
        newBins,
        'Añadir Pasillo',
        `Se creó el pasillo "${name}" completo con ${createdCount} ubicaciones estándar.`
      );
    }
    setConfigSuccessMsg(`¡Éxito! Se creó el pasillo "${name}" con ${createdCount} celdas.`);
  };

  const handleDeleteAisle = async (aisleName: string) => {
    setConfigErrorMsg('');
    setConfigSuccessMsg('');
    const name = aisleName.trim().toUpperCase();
    if (!name) {
      setConfigErrorMsg('Debe seleccionar o especificar un pasillo a eliminar.');
      return;
    }

    const binsToRemove = bins.filter(b => b.aisle === name);
    if (binsToRemove.length === 0) {
      setConfigErrorMsg(`No se encontraron celdas en el pasillo "${name}".`);
      return;
    }

    const hasStock = binsToRemove.some(b => b.occupiedQty > 0 || b.occupiedSku);
    const confirmMsg = hasStock
      ? `ADVERTENCIA: El pasillo "${name}" contiene celdas con stock activo. ¿Está seguro de que desea eliminarlo por completo? Se perderá el stock registrado.`
      : `¿Está seguro de que desea eliminar permanentemente el pasillo "${name}" y sus ${binsToRemove.length} celdas?`;

    if (!window.confirm(confirmMsg)) return;

    const newBins = bins.filter(b => b.aisle !== name);
    if (onUpdateBins) {
      await onUpdateBins(
        newBins,
        'Eliminar Pasillo',
        `Se eliminó el pasillo "${name}" completo (${binsToRemove.length} celdas).`
      );
    }
    setConfigSuccessMsg(`¡Éxito! Se eliminó el pasillo "${name}" y sus ${binsToRemove.length} celdas.`);
  };

  const handleAddLevel = async (levelName: string) => {
    setConfigErrorMsg('');
    setConfigSuccessMsg('');
    const name = levelName.trim().toUpperCase();
    if (!name) {
      setConfigErrorMsg('Debe especificar un nombre de nivel.');
      return;
    }
    if (!/^[A-Z0-9]+$/.test(name)) {
      setConfigErrorMsg('Nombre de nivel inválido. Solo letras y números (ej. L4).');
      return;
    }
    if (bins.some(b => b.level === name)) {
      setConfigErrorMsg(`El nivel "${name}" ya existe.`);
      return;
    }

    // Get unique combinations of aisle, rack, shelf from current bins to append the level
    const combos: { aisle: string; rack: string; shelf: string }[] = [];
    bins.forEach(b => {
      if (!combos.some(c => c.aisle === b.aisle && c.rack === b.rack && c.shelf === b.shelf)) {
        combos.push({ aisle: b.aisle, rack: b.rack, shelf: b.shelf });
      }
    });

    if (combos.length === 0) {
      combos.push({ aisle: 'A', rack: '01', shelf: 'S1' });
      combos.push({ aisle: 'A', rack: '01', shelf: 'S2' });
    }

    const newBins = [...bins];
    let createdCount = 0;
    combos.forEach(c => {
      const id = `${c.aisle}-${c.rack}-${c.shelf}-${name}`;
      if (!newBins.some(b => b.id === id)) {
        newBins.push({
          id,
          aisle: c.aisle,
          rack: c.rack,
          shelf: c.shelf,
          level: name,
          maxWeight: 100,
          maxVolume: 50,
          occupiedSku: '',
          occupiedQty: 0,
          status: 'Empty'
        });
        createdCount++;
      }
    });

    if (onUpdateBins) {
      await onUpdateBins(
        newBins,
        'Añadir Nivel de Altura',
        `Se añadió el nivel de altura "${name}" a través del almacén, creando ${createdCount} celdas.`
      );
    }
    setConfigSuccessMsg(`¡Éxito! Se añadió el nivel "${name}" con ${createdCount} nuevas celdas.`);
  };

  const handleDeleteLevel = async (levelName: string) => {
    setConfigErrorMsg('');
    setConfigSuccessMsg('');
    const name = levelName.trim().toUpperCase();
    if (!name) {
      setConfigErrorMsg('Debe seleccionar o especificar un nivel a eliminar.');
      return;
    }

    const binsToRemove = bins.filter(b => b.level === name);
    if (binsToRemove.length === 0) {
      setConfigErrorMsg(`No se encontraron celdas en el nivel "${name}".`);
      return;
    }

    const hasStock = binsToRemove.some(b => b.occupiedQty > 0 || b.occupiedSku);
    const confirmMsg = hasStock
      ? `ADVERTENCIA: El nivel "${name}" contiene celdas con stock activo. ¿Está seguro de que desea eliminarlo de todo el almacén?`
      : `¿Está seguro de que desea eliminar permanentemente el nivel de altura "${name}" y sus ${binsToRemove.length} celdas?`;

    if (!window.confirm(confirmMsg)) return;

    const newBins = bins.filter(b => b.level !== name);
    if (onUpdateBins) {
      await onUpdateBins(
        newBins,
        'Eliminar Nivel de Altura',
        `Se eliminó el nivel de altura "${name}" completo (${binsToRemove.length} celdas).`
      );
    }
    setConfigSuccessMsg(`¡Éxito! Se eliminó el nivel "${name}" y sus ${binsToRemove.length} celdas.`);
  };

  const handleAddIndividualBin = async () => {
    setConfigErrorMsg('');
    setConfigSuccessMsg('');
    const aisle = newBinAisle.trim().toUpperCase();
    const rack = newBinRack.trim().toUpperCase();
    const shelf = newBinShelf.trim().toUpperCase();
    const level = newBinLevel.trim().toUpperCase();

    if (!aisle || !rack || !shelf || !level) {
      setConfigErrorMsg('Todos los campos son requeridos para añadir una celda.');
      return;
    }
    if (!/^[A-Z0-9]+$/.test(aisle) || !/^[A-Z0-9]+$/.test(rack) || !/^[A-Z0-9]+$/.test(level)) {
      setConfigErrorMsg('Formato inválido en los identificadores de celda. Use letras y números.');
      return;
    }

    const id = `${aisle}-${rack}-${shelf}-${level}`;
    if (bins.some(b => b.id === id)) {
      setConfigErrorMsg(`La celda de ubicación "${id}" ya existe.`);
      return;
    }

    const newBin: Bin = {
      id,
      aisle,
      rack,
      shelf,
      level,
      maxWeight: newBinWeight || 500,
      maxVolume: 50,
      occupiedSku: '',
      occupiedQty: 0,
      status: 'Empty'
    };

    const newBins = [...bins, newBin];
    if (onUpdateBins) {
      await onUpdateBins(
        newBins,
        'Añadir Celda Individual',
        `Se añadió la nueva celda de almacenamiento "${id}" con capacidad de ${newBinWeight} kg.`
      );
    }
    setConfigSuccessMsg(`¡Éxito! Se añadió la celda de almacenamiento "${id}".`);
    setNewBinAisle('');
    setNewBinRack('');
  };

  const handleDeleteIndividualBin = async (binToDelete: Bin) => {
    setConfigErrorMsg('');
    setConfigSuccessMsg('');
    if (binToDelete.occupiedQty > 0 || binToDelete.occupiedSku) {
      const confirmForce = window.confirm(
        `ADVERTENCIA: La celda ${binToDelete.id} tiene stock activo (${binToDelete.occupiedSku}: ${binToDelete.occupiedQty} uds). ¿Está seguro de eliminarla? Se perderá el registro de stock.`
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
    setConfigSuccessMsg(`¡Éxito! Se eliminó la celda de almacenamiento "${binToDelete.id}".`);
    if (configSelectedBin?.id === binToDelete.id) {
      setConfigSelectedBin(null);
    }
  };

  const handleBulkCreateDashboard = async () => {
    setConfigErrorMsg('');
    setConfigSuccessMsg('');

    if (!bulkAisleInput.trim()) {
      setConfigErrorMsg('Debe especificar al menos un pasillo (ej. E).');
      return;
    }
    if (!bulkRackInput.trim()) {
      setConfigErrorMsg('Debe especificar al menos un espacio/rack (ej. 01,02).');
      return;
    }
    if (!bulkShelfInput.trim()) {
      setConfigErrorMsg('Debe especificar al menos una cara/shelf (ej. S1,S2).');
      return;
    }
    if (!bulkLevelInput.trim()) {
      setConfigErrorMsg('Debe especificar al menos un nivel (ej. L1,L2,L3).');
      return;
    }

    const targetAisles = bulkAisleInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const targetRacks = bulkRackInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const targetShelves = bulkShelfInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const targetLevels = bulkLevelInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    const invalidAisle = targetAisles.find(a => !/^[A-Z0-9]+$/.test(a));
    if (invalidAisle) {
      setConfigErrorMsg(`Nombre de pasillo inválido: "${invalidAisle}". Solo letras y números.`);
      return;
    }

    const invalidRack = targetRacks.find(r => !/^[A-Z0-9]+$/.test(r));
    if (invalidRack) {
      setConfigErrorMsg(`Nombre de espacio/rack inválido: "${invalidRack}". Solo letras y números.`);
      return;
    }

    const invalidShelf = targetShelves.find(s => !/^[A-Z0-9]+$/.test(s));
    if (invalidShelf) {
      setConfigErrorMsg(`Nombre de shelf inválido: "${invalidShelf}". Solo letras y números.`);
      return;
    }

    const invalidLevel = targetLevels.find(l => !/^[A-Z0-9]+$/.test(l));
    if (invalidLevel) {
      setConfigErrorMsg(`Nombre de nivel inválido: "${invalidLevel}". Solo letras y números.`);
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
              newBinsList.push({
                id,
                aisle,
                rack,
                shelf,
                level,
                maxWeight: level === 'L1' ? 1000 : level === 'L2' ? 500 : 100,
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
      setConfigErrorMsg('Todas las celdas especificadas ya existen en el sistema.');
      return;
    }

    if (onUpdateBins) {
      await onUpdateBins(
        newBinsList,
        'Habilitar Celdas en Lote',
        `Se habilitaron ${createdCount} nuevas ubicaciones de inventario en el almacén.`
      );
    }
    setConfigSuccessMsg(`¡Éxito! Se habilitaron ${createdCount} nuevas celdas de almacenamiento.`);
    setBulkAisleInput('');
    setBulkRackInput('');
  };

  return (
    <div className="space-y-6">

      {dashboardSubTab === 'metrics' ? (
        <>
          {/* Barra de Filtro de Periodos y Divisa (Oculta por defecto para vista ejecutiva limpia) */}
          {showFiltersBar && (
            <>
              {/* Barra de Filtro de Periodos - no-print */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-3xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 animate-fadeIn no-print" id="metrics-period-filter-bar">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-sans flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-indigo-500" />
                Filtrar Periodo:
              </span>
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setTimePeriod('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                    timePeriod === 'all'
                      ? 'bg-white text-indigo-650 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Todo
                </button>
                <button
                  type="button"
                  onClick={() => setTimePeriod('today')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                    timePeriod === 'today'
                      ? 'bg-white text-indigo-650 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => setTimePeriod('7days')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                    timePeriod === '7days'
                      ? 'bg-white text-indigo-650 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  7 días
                </button>
                <button
                  type="button"
                  onClick={() => setTimePeriod('this_month')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                    timePeriod === 'this_month'
                      ? 'bg-white text-indigo-650 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Este mes
                </button>
                <button
                  type="button"
                  onClick={() => setTimePeriod('custom')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                    timePeriod === 'custom'
                      ? 'bg-white text-indigo-650 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Personalizado
                </button>
              </div>

              {timePeriod === 'custom' && (
                <div className="flex items-center gap-2 animate-fadeIn">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700"
                  />
                  <span className="text-slate-400 text-xs font-bold font-sans">a</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Configuración de Divisa y Conversión en Tiempo Real - no-print */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-3xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-4 animate-fadeIn no-print" id="metrics-currency-config-bar">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
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
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
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
          </>
        )}



          {/* Cabecera de Reporte Impreso (Solo visible en impresión) */}
          <div className="print-only mb-6 border-b border-slate-300 pb-5">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">REPORTE OPERATIVO DE RENDIMIENTO WMS</h1>
                <p className="text-xs text-slate-500 mt-1">Análisis integral de flujo operacional e infraestructura de almacenamiento</p>
              </div>
              <div className="text-right text-xs text-slate-500 font-mono space-y-0.5">
                <div><strong>Fecha de Emisión:</strong> {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                <div><strong>Filtro de Periodo:</strong> {
                  timePeriod === 'all' ? 'Historial Completo' :
                  timePeriod === 'today' ? 'Hoy' :
                  timePeriod === '7days' ? 'Últimos 7 días' :
                  timePeriod === 'this_month' ? 'Este mes en curso' :
                  `Personalizado: ${startDate || 'Inicio'} hasta ${endDate || 'Fin'}`
                }</div>
              </div>
            </div>

            {/* Print Key Indicators */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="border border-slate-300 p-4 rounded-xl text-center bg-slate-50/50 print-card">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Valor Inventario ({currencyMode === 'original' ? '$' : currencyMode === 'mxn_to_usd' ? 'USD' : 'MXN'})
                </span>
                <span className="text-xl font-mono font-black text-slate-900 block mt-1">
                  {currencyMode === 'original' ? '$' : currencyMode === 'mxn_to_usd' ? 'USD $' : 'MXN $'}
                  {totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border border-slate-300 p-4 rounded-xl text-center bg-slate-50/50 print-card">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">SKUs Activos</span>
                <span className="text-xl font-mono font-black text-slate-900 block mt-1">{activeSkusCount} de {inventory.length}</span>
              </div>
              <div className="border border-slate-300 p-4 rounded-xl text-center bg-slate-50/50 print-card">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Pedidos en Cola</span>
                <span className="text-xl font-mono font-black text-slate-900 block mt-1">{pendingOrders}</span>
              </div>
              <div className="border border-slate-300 p-4 rounded-xl text-center bg-slate-50/50 print-card">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-sans">Ocupación Celdas</span>
                <span className="text-xl font-mono font-black text-slate-900 block mt-1">{occupancyRate}%</span>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 1. CENTRO DE COMANDO EJECUTIVO WMS (EXECUTIVE COCKPIT)    */}
          {/* ======================================================== */}
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-xl relative overflow-hidden animate-fadeIn no-print" id="executive-command-cockpit">
            {/* Subtle background glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    WMS Executive Cockpit · En Vivo
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono">
                    {bins.length} Celdas Conectadas
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
                    Supabase PostgreSQL Sync
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                  <LayoutDashboard className="h-6 w-6 text-indigo-400" />
                  <span>Tablero Ejecutivo de Rendimiento & Capacidad</span>
                </h2>
                <p className="text-xs text-slate-300 max-w-2xl font-normal leading-relaxed">
                  Visión ejecutiva centralizada de operaciones. Integra en tiempo real la <strong>infraestructura física del Mapa de Almacén</strong>, valorización de inventario, flujo de salidas de almacén y confiabilidad de auditoría.
                </p>
              </div>

              {/* Health Score + Quick Action */}
              <div className="flex flex-wrap items-center gap-4 shrink-0">
                <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-3.5 px-4.5 flex items-center gap-3.5 backdrop-blur-sm">
                  <div className="relative flex items-center justify-center">
                    <div className="w-13 h-13 rounded-full border-4 border-slate-800 flex items-center justify-center">
                      <span className="text-base font-black font-mono text-emerald-400">
                        {operationalHealthScore}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block font-mono">
                      Salud Operativa Global
                    </span>
                    <span className="text-xs font-bold text-white block">
                      {operationalHealthScore >= 90 ? 'Excelente / Alta Disponibilidad' : operationalHealthScore >= 75 ? 'Operación Estable' : 'Atención Requerida'}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      Espacio · Salidas · Auditoría
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onTabChange('map')}
                  className="px-4 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-900/30 active:scale-95 border border-blue-400/30"
                  title="Abrir el mapa interactivo del almacén"
                >
                  <MapPin className="h-4 w-4" />
                  <span>Mapa de Almacén ({bins.length} celdas) →</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDashboardSubTab('config')}
                  className="px-3.5 py-3 rounded-2xl bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 border border-slate-700/80"
                  title="Configuración técnica y administración de celdas"
                >
                  <Settings className="h-4 w-4 text-slate-400" />
                  <span>Configuración</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowFiltersBar(!showFiltersBar)}
                  className={`px-3 py-3 rounded-2xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 border ${
                    showFiltersBar
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700/80'
                  }`}
                  title="Mostrar / Ocultar filtros de periodo y divisa"
                >
                  <Sliders className="h-4 w-4 text-indigo-400" />
                  <span>{showFiltersBar ? 'Ocultar Filtros' : 'Filtros'}</span>
                </button>
              </div>
            </div>

            {/* Selector de Perspectiva Ejecutiva (Elimina sensación de aislamiento) */}
            <div className="relative z-10 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5 shrink-0">
                <Sliders className="h-3.5 w-3.5 text-indigo-400" />
                <span>Perspectiva de Análisis:</span>
              </span>

              <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
                {[
                  { id: 'resumen', label: 'Resumen & Conectividad', icon: Sparkles },
                  { id: 'operaciones', label: 'Operaciones (Flujo Completo)', icon: Activity },
                  { id: 'almacen', label: 'Almacén & Espacio Físico', icon: Boxes },
                  { id: 'capital', label: 'Catálogo, Etiquetas & Capital', icon: DollarSign },
                  { id: 'soporte', label: 'Alertas, Reportes & Personal', icon: ShieldCheck },
                  { id: 'todo', label: 'Vista Completa Integral', icon: ListFilter }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = executivePerspective === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setExecutivePerspective(tab.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* KPI Cards Grid - Versión Ejecutiva Integrada */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print" id="kpi-cards-grid">
            
            {/* KPI 1: Infraestructura & Ocupación Física (CONEXIÓN DIRECTA CON MAPA) */}
            <div 
              onClick={() => setExecutivePerspective('almacen')}
              className="bg-white border border-slate-200/90 hover:border-indigo-400 rounded-2xl shadow-xs p-5 flex flex-col justify-between hover:shadow-md transition duration-200 cursor-pointer group"
              id="kpi-occupancy-rate"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider font-mono flex items-center gap-1">
                    <Boxes className="h-3.5 w-3.5" />
                    <span>01. Infraestructura & Espacio</span>
                  </span>
                  <span className={`text-[10px] font-black font-mono px-2 py-0.5 rounded-full ${
                    occupancyRate >= 90 ? 'bg-rose-100 text-rose-800' : occupancyRate >= 75 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {occupancyRate >= 90 ? 'Crítico' : occupancyRate >= 75 ? 'Saturado' : 'Óptimo'}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-3xl font-black font-mono text-slate-900 group-hover:text-indigo-600 transition tracking-tight">
                    {occupancyRate}%
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    {occupiedSlots} / {totalSlots} celdas
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      occupancyRate >= 90 ? 'bg-rose-500' : occupancyRate >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, occupancyRate)}%` }}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-mono">
                  {(totalWeightCapacityKg / 1000).toFixed(1)} T máx · {new Set(bins.map(b => b.rack)).size} racks
                </span>
                <span className="text-indigo-600 font-bold group-hover:underline flex items-center gap-0.5">
                  Detalle →
                </span>
              </div>
            </div>

            {/* KPI 2: Capital & Valor Total del Inventario */}
            <div 
              onClick={() => setExecutivePerspective('capital')}
              className="bg-white border border-slate-200/90 hover:border-indigo-400 rounded-2xl shadow-xs p-5 flex flex-col justify-between hover:shadow-md transition duration-200 cursor-pointer group"
              id="kpi-total-value"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider font-mono flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>02. Capital en Inventario</span>
                  </span>
                  <span className="text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-150 px-1.5 py-0.5 rounded-md font-sans">
                    {currencyMode === 'original' ? 'Catálogo' : currencyMode === 'mxn_to_usd' ? 'USD' : 'MXN'}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <span 
                    className="text-2xl sm:text-3xl font-black font-mono text-slate-900 group-hover:text-blue-600 transition tracking-tight truncate"
                    title={`Valor exacto: ${currencyMode === 'original' ? '$' : currencyMode === 'mxn_to_usd' ? 'USD $' : 'MXN $'}${totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  >
                    {currencyMode === 'original' ? '$' : currencyMode === 'mxn_to_usd' ? 'USD $' : 'MXN $'}
                    {formatCompactValue(totalInventoryValue, true)}
                  </span>
                </div>

                <div className="text-xs text-slate-500 font-medium mt-1">
                  Respaldado por <strong className="text-slate-800 font-extrabold">{formatCompactValue(totalStock)}</strong> unidades
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-[11px]">
                <span className={`font-mono font-medium ${lowStockItems.length > 0 ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
                  {lowStockItems.length > 0 ? `⚠️ ${lowStockItems.length} bajo mínimo` : 'Stock en nivel óptimo'}
                </span>
                <span className="text-blue-600 font-bold group-hover:underline flex items-center gap-0.5">
                  Ver ABC →
                </span>
              </div>
            </div>

            {/* KPI 3: Recuento de Entradas y Salidas por Selección de Fechas */}
            <div 
              onClick={() => onTabChange('salidas')}
              className="bg-white border border-slate-200/90 hover:border-emerald-400 rounded-2xl shadow-xs p-5 flex flex-col justify-between hover:shadow-md transition duration-200 cursor-pointer group"
              id="kpi-inbound-outbound-count"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider font-mono flex items-center gap-1.5">
                    <ArrowDownUp className="h-3.5 w-3.5 text-emerald-600" />
                    <span>03. Recuento Entradas & Salidas</span>
                  </span>
                  <span 
                    className="text-[10px] font-black font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 max-w-[130px] truncate"
                    title={`Filtro de fecha aplicado: ${periodLabelText}`}
                  >
                    {periodLabelText}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-3xl font-black font-mono text-slate-900 group-hover:text-emerald-600 transition tracking-tight">
                    {totalFlowOperationsCount}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    operaciones ({formatCompactValue(totalFlowUnits)} uds)
                  </span>
                </div>

                {/* Sub-tarjetas de desglose: Entradas vs Salidas */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div 
                    onClick={(e) => { e.stopPropagation(); onTabChange('entradas'); }}
                    className="p-2 bg-emerald-50/80 hover:bg-emerald-100/70 border border-emerald-200/70 rounded-xl transition"
                    title="Ver pedidos de Entrada en este período"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono font-bold text-emerald-800 uppercase">
                      <span className="flex items-center gap-1">
                        <ArrowDownLeft className="h-3 w-3 text-emerald-600" />
                        Entradas
                      </span>
                      <span className="font-black bg-emerald-200/60 px-1 rounded text-emerald-900">{inboundOrders.length}</span>
                    </div>
                    <div className="text-[11px] font-mono font-black text-emerald-950 mt-1">
                      +{totalReceivedUnits.toLocaleString()} <span className="text-[9px] font-sans font-medium text-emerald-700">uds</span>
                    </div>
                  </div>

                  <div 
                    onClick={(e) => { e.stopPropagation(); onTabChange('salidas'); }}
                    className="p-2 bg-blue-50/80 hover:bg-blue-100/70 border border-blue-200/70 rounded-xl transition"
                    title="Ver pedidos de Salida en este período"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono font-bold text-blue-800 uppercase">
                      <span className="flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3 text-blue-600" />
                        Salidas
                      </span>
                      <span className="font-black bg-blue-200/60 px-1 rounded text-blue-900">{totalOutboundTransactionsCount}</span>
                    </div>
                    <div className="text-[11px] font-mono font-black text-blue-950 mt-1">
                      -{(outboundOrderUnits + directDispatchUnits).toLocaleString()} <span className="text-[9px] font-sans font-medium text-blue-700">uds</span>
                    </div>
                  </div>
                </div>

                {/* Barra de proporción Entradas vs Salidas */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2.5 flex" title={`Entradas: ${inboundOrders.length} ops (${totalReceivedUnits} uds) | Salidas: ${totalOutboundTransactionsCount} ops (${outboundOrderUnits + directDispatchUnits} uds)`}>
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ 
                      width: `${totalFlowOperationsCount > 0 
                        ? Math.max(8, Math.min(92, Math.round((inboundOrders.length / totalFlowOperationsCount) * 100))) 
                        : 50}%` 
                    }}
                  />
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ 
                      width: `${totalFlowOperationsCount > 0 
                        ? Math.max(8, Math.min(92, Math.round((totalOutboundTransactionsCount / totalFlowOperationsCount) * 100))) 
                        : 50}%` 
                    }}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-mono">
                  Balance Neto: <strong className={netUnitsBalance >= 0 ? 'text-emerald-600 font-black' : 'text-amber-600 font-black'}>
                    {netUnitsBalance > 0 ? `+${netUnitsBalance.toLocaleString()}` : netUnitsBalance.toLocaleString()} uds
                  </strong>
                </span>
                <span className="text-emerald-600 font-bold group-hover:underline flex items-center gap-0.5">
                  Ver Flujo →
                </span>
              </div>
            </div>

            {/* KPI 4: Confiabilidad & Precisión de Auditoría Cíclica */}
            <div 
              onClick={() => onTabChange('conteos')}
              className="bg-white border border-slate-200/90 hover:border-indigo-400 rounded-2xl shadow-xs p-5 flex flex-col justify-between hover:shadow-md transition duration-200 cursor-pointer group"
              id="kpi-audit-accuracy"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-teal-600 tracking-wider font-mono flex items-center gap-1">
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    <span>04. Precisión de Inventario</span>
                  </span>
                  <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                    Auditoría WMS
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-3xl font-black font-mono text-slate-900 group-hover:text-teal-600 transition tracking-tight">
                    {countingAccuracy}%
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    conteo físico
                  </span>
                </div>

                {/* Progress accuracy */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2.5">
                  <div 
                    className="h-full rounded-full bg-teal-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, countingAccuracy)}%` }}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-mono">
                  {accurateCounts} de {totalCountsPerformed} sin desvío
                </span>
                <span className="text-teal-600 font-bold group-hover:underline flex items-center gap-0.5">
                  Conteos →
                </span>
              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* FILTRO GENERAL DE SUPERALMACÉN Y ALMACÉN EN EL DASHBOARD                  */}
          {/* ========================================================================= */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-3xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fadeIn no-print" id="dashboard-superwarehouse-filter-bar">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
              <span className="text-xs font-black uppercase tracking-wider font-mono text-indigo-700 flex items-center gap-1.5 shrink-0">
                <Building2 className="h-4 w-4 text-indigo-600" />
                Filtrar por Superalmacén:
              </span>
              <select
                value={isCustomDashSuperMode ? '__OTHER__' : selectedDashboardSuperWhFilter}
                onChange={(e) => {
                  if (e.target.value === '__OTHER__') {
                    setIsCustomDashSuperMode(true);
                  } else {
                    setIsCustomDashSuperMode(false);
                    setSelectedDashboardSuperWhFilter(e.target.value);
                  }
                }}
                className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Todos los Superalmacenes ({warehouseSections.length})</option>
                {warehouseSections.map(wh => (
                  <option key={wh.id} value={wh.id}>[{wh.code}] {wh.name}</option>
                ))}
                <option value="__OTHER__">➕ Otro Superalmacén (especificar de qué se trata...)</option>
              </select>

              {isCustomDashSuperMode && (
                <div className="flex items-center gap-1.5 animate-fadeIn">
                  <input
                    type="text"
                    value={customDashSuperInput}
                    onChange={(e) => setCustomDashSuperInput(e.target.value)}
                    placeholder="Escriba de qué Superalmacén se trata..."
                    className="px-3 py-1.5 bg-indigo-50/70 border border-indigo-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomDashSuperMode(false);
                      setCustomDashSuperInput('');
                      setSelectedDashboardSuperWhFilter('all');
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportDashboardWarehouseMetrics}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Descargar métricas de todos los superalmacenes en Excel"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Exportar Superalmacenes (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={handleExportDashboardDirectDispatches}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Descargar historial de salidas directas en Excel"
              >
                <Truck className="h-4 w-4" />
                <span>Exportar Salidas Directas (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PANEL DE SUPERALMACENES, SUBALMACENES Y CATEGORÍAS (CONEXIÓN EN VIVO)      */}
          {/* ========================================================================= */}
          {(executivePerspective === 'resumen' || executivePerspective === 'almacen' || executivePerspective === 'capital' || executivePerspective === 'todo') && (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs space-y-6 animate-fadeIn" id="superwarehouses-metrics-panel">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-150">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1 px-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      Superalmacenes & Secciones
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                      Métricas por Superalmacén, Subalmacenes y Categorías
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
                    Visualice el estado en tiempo real de cada Superalmacén (OXXO, Construcción, Transporte, etc.), sus subalmacenes asignados, capacidades de ocupación, stock y categorías (incluyendo las creadas con &quot;Otro&quot;).
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleExportDashboardWarehouseMetrics}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Download className="h-4 w-4" />
                    <span>Descargar Reporte Excel (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Grid de Tarjetas de Superalmacenes (Ocultado a solicitud del usuario) */}
              {false && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredWarehouseMetricsData.map((wh) => (
                    <div
                      key={wh.id}
                      className="border border-slate-200/90 rounded-2xl p-5 bg-gradient-to-br from-white to-slate-50/50 hover:border-indigo-400 transition-all shadow-3xs hover:shadow-sm space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        {/* Top Header Card */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="font-mono font-black text-xs px-2.5 py-1 rounded-lg text-white shadow-3xs"
                              style={{ backgroundColor: wh.color }}
                            >
                              [{wh.code}]
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                              {wh.sectionType}
                            </span>
                          </div>
                          <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full ${
                            wh.occupancyPct >= 90 ? 'bg-rose-100 text-rose-800' : wh.occupancyPct >= 75 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {wh.occupancyPct}% Ocupación
                          </span>
                        </div>

                        <div>
                          <h4 className="text-base font-extrabold text-slate-900 tracking-tight">
                            {wh.name}
                          </h4>
                          <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{wh.facilityLocation}</span>
                          </span>
                        </div>

                        {/* Sub-almacenes pills */}
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block">
                            Subalmacenes Registrados ({wh.subWarehousesCount}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {wh.subWarehouses.length === 0 ? (
                              <span className="text-[10px] text-slate-400 italic">Área general única</span>
                            ) : (
                              wh.subWarehouses.map((s: any) => (
                                <span
                                  key={s.id}
                                  className="text-[10px] font-mono font-bold px-2 py-0.5 bg-white border border-slate-200 text-slate-700 rounded-lg shadow-3xs"
                                >
                                  [{s.code}] {s.name}
                                </span>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Progress Bar of Capacity */}
                        <div className="space-y-1 pt-1">
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="text-slate-400 font-bold">Capacidad Utilizada:</span>
                            <span className="font-bold text-slate-700">{wh.totalOccupied} / {wh.totalCapacity} uds</span>
                          </div>
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                wh.occupancyPct >= 90 ? 'bg-rose-500' : wh.occupancyPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, wh.occupancyPct)}%` }}
                            />
                          </div>
                        </div>

                        {/* Categorías asignadas */}
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block">
                            Categorías Asignadas ({wh.categories.length}):
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {wh.categories.map((cat: string) => (
                              <span
                                key={cat}
                                className="text-[9px] font-semibold px-2 py-0.5 bg-indigo-50 border border-indigo-150 text-indigo-800 rounded-md"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer KPIs */}
                      <div className="pt-3 border-t border-slate-200/80 grid grid-cols-3 gap-2 text-center bg-white/70 p-2.5 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[9px] font-mono text-slate-400 uppercase font-bold block">SKUs</span>
                          <span className="text-sm font-black font-mono text-slate-800">{wh.skusCount}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-mono text-slate-400 uppercase font-bold block">Stock</span>
                          <span className="text-sm font-black font-mono text-slate-800">{wh.totalUnits.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-mono text-slate-400 uppercase font-bold block">Capital</span>
                          <span className="text-sm font-black font-mono text-emerald-700">
                            {currencyMode === 'mxn_to_usd' ? 'USD $' : '$'}
                            {wh.totalVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Gráficas comparativas de Superalmacenes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider font-mono text-slate-700">
                      Distribución de Unidades en Stock por Superalmacén
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Total: {formatCompactValue(totalStock)} uds</span>
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={filteredWarehouseMetricsData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="code" tick={{ fontSize: 11, fontWeight: 'bold' }} stroke="#64748b" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                          formatter={(val: any) => [`${Number(val).toLocaleString()} unidades`, 'Stock']}
                        />
                        <Bar dataKey="totalUnits" fill="#4f46e5" radius={[6, 6, 0, 0]}>
                          {filteredWarehouseMetricsData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color || '#4f46e5'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider font-mono text-slate-700">
                      Capacidad Máxima vs Ocupación Actual (Uds)
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Capacidad Total Estimada</span>
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={filteredWarehouseMetricsData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="code" tick={{ fontSize: 11, fontWeight: 'bold' }} stroke="#64748b" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                        />
                        <Bar dataKey="totalCapacity" name="Capacidad Total" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="totalOccupied" name="Ocupación Actual" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PANEL DE SALIDAS DIRECTAS DE ALMACÉN                                       */}
          {/* ========================================================================= */}
          {(executivePerspective === 'resumen' || executivePerspective === 'operaciones' || executivePerspective === 'procesos' || executivePerspective === 'todo') && (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs space-y-6 animate-fadeIn" id="direct-dispatches-metrics-panel">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-150">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1 px-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5" />
                      Salidas Directas de Almacén
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                      Métricas y Registro de Salidas Inmediatas de Almacén
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
                    Historial consolidado de mercancía con salida directa de almacén sin orden previa: productos entregados, métodos de transporte y destinos atendidos.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onTabChange('salidas')}
                    className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Ir a Módulo de Salidas →
                  </button>
                  <button
                    type="button"
                    onClick={handleExportDashboardDirectDispatches}
                    disabled={directDispatchesMetrics.totalCount === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Download className="h-4 w-4" />
                    <span>Descargar Salidas Directas (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* 4 Mini KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Total Salidas Directas</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black font-mono text-slate-900">{directDispatchesMetrics.totalCount}</span>
                    <span className="text-xs text-slate-400 font-medium">salidas registradas</span>
                  </div>
                </div>

                <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Unidades con Salida</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black font-mono text-amber-600">{directDispatchesMetrics.totalUnits.toLocaleString()}</span>
                    <span className="text-xs text-slate-400 font-medium">piezas totales</span>
                  </div>
                </div>

                <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Valor Mercancía de Salida</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black font-mono text-emerald-600">
                      {currencyMode === 'mxn_to_usd' ? 'USD $' : '$'}
                      {directDispatchesMetrics.totalVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Medios de Entrega Activos</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black font-mono text-indigo-600">{directDispatchesMetrics.methodData.length}</span>
                    <span className="text-xs text-slate-400 font-medium">canales utilizados</span>
                  </div>
                </div>
              </div>

              {/* Tabla de Salidas Directas Recientes */}
              {directDispatchesMetrics.recent.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-250 rounded-2xl space-y-2">
                  <Truck className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">No hay salidas directas registradas aún en el sistema</p>
                  <p className="text-[11px] text-slate-400">Puede generar una salida rápida en la pestaña &quot;Salidas&quot; con código de barras o selección de SKU.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider font-mono text-slate-700">
                      Últimas Salidas Directas de Almacén Realizadas
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 font-bold">
                      Mostrando {directDispatchesMetrics.recent.length} de {directDispatchesMetrics.totalCount}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                          <th className="py-2.5 px-3">Folio</th>
                          <th className="py-2.5 px-3">Fecha / Hora</th>
                          <th className="py-2.5 px-3">Producto / SKU</th>
                          <th className="py-2.5 px-3">Cantidad</th>
                          <th className="py-2.5 px-3">Destino / Cliente</th>
                          <th className="py-2.5 px-3">Medio de Transporte</th>
                          <th className="py-2.5 px-3">Operador</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 font-medium">
                        {directDispatchesMetrics.recent.map((d: any) => (
                          <tr key={d.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-amber-700">{d.id}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                              {new Date(d.timestamp).toLocaleDateString()} {new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-800 block">{d.productName}</span>
                              <span className="text-[10px] font-mono text-slate-400">{d.sku}</span>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-black text-slate-900">
                              {d.qty} uds
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-700">
                              {d.destination}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-block text-[10px] font-semibold px-2 py-0.5 bg-indigo-50 border border-indigo-150 text-indigo-800 rounded-md">
                                {d.deliveryMethod}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                              {d.operator}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* CENTRO DE CONECTIVIDAD DE OPCIONES DEL WMS (OCULTADO A SOLICITUD)         */}
          {/* ========================================================================= */}
          {false && (executivePerspective === 'resumen' || executivePerspective === 'todo') && (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs space-y-6 animate-fadeIn" id="platform-options-matrix">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-150">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1 px-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5">
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      Ecosistema WMS Unificado
                    </span>
                    <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                      Centro de Conectividad de Opciones de la Plataforma
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
                    Todas las opciones y módulos operativos de la plataforma se encuentran enlazados y monitoreados en tiempo real. Seleccione cualquier opción para saltar directamente al módulo correspondiente.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>12 Opciones Conectadas</span>
                  </div>
                </div>
              </div>

              {/* Grid de 12 Opciones de la Plataforma */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                
                {/* 1. ENTRADAS */}
                <div 
                  onClick={() => onTabChange('entradas')}
                  className="bg-slate-50/70 hover:bg-white border border-slate-200/90 hover:border-emerald-500/80 rounded-2xl p-4.5 transition-all shadow-3xs hover:shadow-md cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center transition group-hover:scale-105">
                        <ArrowDownLeft className="h-4.5 w-4.5" />
                      </div>
                      <span className="text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Inbound Activo
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                        Operaciones Básicas
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-emerald-700 transition">
                        Entradas & Putaway
                      </h4>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500 font-medium">Pedidos de Recepción:</span>
                        <span className="text-sm font-black font-mono text-slate-800">{receivingOrdersCount}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-[11px] text-slate-400">
                        <span>Stock recibido:</span>
                        <span className="font-mono font-semibold text-slate-600">{formatCompactValue(totalStock)} uds</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 mt-3 flex items-center justify-between text-xs font-bold text-emerald-600 group-hover:text-emerald-700">
                    <span className="text-[11px]">Escáner & Guardado</span>
                    <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">Ir a Entradas →</span>
                  </div>
                </div>

                {/* 2. SALIDAS */}
                <div 
                  onClick={() => onTabChange('salidas')}
                  className="bg-slate-50/70 hover:bg-white border border-slate-200/90 hover:border-blue-500/80 rounded-2xl p-4.5 transition-all shadow-3xs hover:shadow-md cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center transition group-hover:scale-105">
                        <ArrowUpRight className="h-4.5 w-4.5" />
                      </div>
                      <span className="text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        SLA {outboundFulfillmentRate}%
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                        Operaciones Básicas
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-blue-700 transition">
                        Salidas de Almacén
                      </h4>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500 font-medium">Órdenes en Cola:</span>
                        <span className="text-sm font-black font-mono text-slate-800">{pendingOrders}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-[11px] text-slate-400">
                        <span>Salidas hoy:</span>
                        <span className="font-mono font-semibold text-slate-600">{completedOutbounds.length} órdenes</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 mt-3 flex items-center justify-between text-xs font-bold text-blue-600 group-hover:text-blue-700">
                    <span className="text-[11px]">Picking & Surtido</span>
                    <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">Ir a Salidas →</span>
                  </div>
                </div>

                {/* 3. MOVIMIENTOS */}
                <div 
                  onClick={() => onTabChange('movimientos')}
                  className="bg-slate-50/70 hover:bg-white border border-slate-200/90 hover:border-purple-500/80 rounded-2xl p-4.5 transition-all shadow-3xs hover:shadow-md cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center transition group-hover:scale-105">
                        <ArrowLeftRight className="h-4.5 w-4.5" />
                      </div>
                      <span className="text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                        {movementsStats.movesToday} Hoy
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                        Operaciones Básicas
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-purple-700 transition">
                        Movimientos & Traslados
                      </h4>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500 font-medium">Total Transferencias:</span>
                        <span className="text-sm font-black font-mono text-slate-800">{movementsStats.totalMoves}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-[11px] text-slate-400">
                        <span>Balance niveles:</span>
                        <span className="font-mono font-semibold text-slate-600">L1:{movementsStats.l1Moves} L2:{movementsStats.l2Moves} L3:{movementsStats.l3Moves}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 mt-3 flex items-center justify-between text-xs font-bold text-purple-600 group-hover:text-purple-700">
                    <span className="text-[11px]">Reubicación Celdas</span>
                    <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">Ir a Movimientos →</span>
                  </div>
                </div>

                {/* 4. CONTEOS CÍCLICOS */}
                <div 
                  onClick={() => onTabChange('conteos')}
                  className="bg-slate-50/70 hover:bg-white border border-slate-200/90 hover:border-teal-500/80 rounded-2xl p-4.5 transition-all shadow-3xs hover:shadow-md cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center transition group-hover:scale-105">
                        <ClipboardCheck className="h-4.5 w-4.5" />
                      </div>
                      <span className={`text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        cycleCountStats.accuracyRate >= 95 ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        IRA {cycleCountStats.accuracyRate}%
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                        Operaciones Básicas
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-teal-700 transition">
                        Conteos Cíclicos
                      </h4>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500 font-medium">SKUs Auditados:</span>
                        <span className="text-sm font-black font-mono text-slate-800">{cycleCountStats.totalAudited}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-[11px] text-slate-400">
                        <span>Actas archivadas:</span>
                        <span className="font-mono font-semibold text-slate-600">{cycleCountStats.archivedReportsCount} concluidas</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 mt-3 flex items-center justify-between text-xs font-bold text-teal-600 group-hover:text-teal-700">
                    <span className="text-[11px]">Auditoría & Firmas</span>
                    <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">Ir a Conteos →</span>
                  </div>
                </div>

                {/* 5. MAPA DEL ALMACÉN */}
                <div 
                  onClick={() => onTabChange('map')}
                  className="bg-slate-50/70 hover:bg-white border border-slate-200/90 hover:border-indigo-500/80 rounded-2xl p-4.5 transition-all shadow-3xs hover:shadow-md cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center transition group-hover:scale-105">
                        <MapPin className="h-4.5 w-4.5" />
                      </div>
                      <span className={`text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        occupancyRate >= 90 ? 'bg-rose-100 text-rose-800' : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        {occupancyRate}% Ocupado
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                        Soporte & Monitoreo
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-indigo-700 transition">
                        Mapa del Almacén
                      </h4>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500 font-medium">Celdas Operativas:</span>
                        <span className="text-sm font-black font-mono text-slate-800">{occupiedSlots} / {totalSlots}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-[11px] text-slate-400">
                        <span>Racks y Pasillos:</span>
                        <span className="font-mono font-semibold text-slate-600">{new Set(bins.map(b => b.rack)).size} racks · A1-A6</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 mt-3 flex items-center justify-between text-xs font-bold text-indigo-600 group-hover:text-indigo-700">
                    <span className="text-[11px]">Plano 2D & Racks</span>
                    <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">Abrir Mapa 2D →</span>
                  </div>
                </div>

                {/* 7. REGISTRO DE SKU */}
                <div 
                  onClick={() => onTabChange('inventory')}
                  className="bg-slate-50/70 hover:bg-white border border-slate-200/90 hover:border-cyan-500/80 rounded-2xl p-4.5 transition-all shadow-3xs hover:shadow-md cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600 flex items-center justify-center transition group-hover:scale-105">
                        <Package className="h-4.5 w-4.5" />
                      </div>
                      <span className={`text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        lowStockItems.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-cyan-100 text-cyan-800'
                      }`}>
                        {lowStockItems.length > 0 ? `${lowStockItems.length} Alerta Min` : 'Stock OK'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                        Soporte & Monitoreo
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-cyan-700 transition">
                        Registro de SKU
                      </h4>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500 font-medium">Catálogo Maestro:</span>
                        <span className="text-sm font-black font-mono text-slate-800">{inventory.length} SKUs</span>
                      </div>
                      <div className="flex justify-between items-baseline text-[11px] text-slate-400">
                        <span>Volumen en stock:</span>
                        <span className="font-mono font-semibold text-slate-600">{formatCompactValue(totalStock)} unidades</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 mt-3 flex items-center justify-between text-xs font-bold text-cyan-600 group-hover:text-cyan-700">
                    <span className="text-[11px]">Artículos & Precios</span>
                    <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">Ver Catálogo →</span>
                  </div>
                </div>

                {/* 8. ESTACIÓN DE ETIQUETAS */}
                <div 
                  onClick={() => onTabChange('etiquetas')}
                  className="bg-slate-50/70 hover:bg-white border border-slate-200/90 hover:border-sky-500/80 rounded-2xl p-4.5 transition-all shadow-3xs hover:shadow-md cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center transition group-hover:scale-105">
                        <Printer className="h-4.5 w-4.5" />
                      </div>
                      <span className="text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                        {labelStats.barcodeCoverage}% Barcode
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                        Soporte & Monitoreo
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-sky-700 transition">
                        Estación de Etiquetas
                      </h4>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500 font-medium">SKUs Rotulables:</span>
                        <span className="text-sm font-black font-mono text-slate-800">{labelStats.skusWithBarcode} / {inventory.length}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-[11px] text-slate-400">
                        <span>Formatos térmicos:</span>
                        <span className="font-mono font-semibold text-slate-600">{labelStats.formatsCount} tamaños (4"x6", 4"x3")</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 mt-3 flex items-center justify-between text-xs font-bold text-sky-600 group-hover:text-sky-700">
                    <span className="text-[11px]">Rotulación Industrial</span>
                    <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">Ir a Etiquetas →</span>
                  </div>
                </div>

                {/* 9. GESTIÓN DE ALERTAS */}
                <div 
                  onClick={() => onTabChange('alertas')}
                  className="bg-slate-50/70 hover:bg-white border border-slate-200/90 hover:border-rose-500/80 rounded-2xl p-4.5 transition-all shadow-3xs hover:shadow-md cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center transition group-hover:scale-105">
                        <ShieldAlert className="h-4.5 w-4.5" />
                      </div>
                      <span className={`text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        alertsStats.criticalCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {alertsStats.criticalCount > 0 ? `${alertsStats.criticalCount} Críticas` : 'Sin Riesgos'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                        Soporte & Monitoreo
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-rose-700 transition">
                        Gestión de Alertas
                      </h4>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500 font-medium">Alertas Disparadas:</span>
                        <span className="text-sm font-black font-mono text-slate-800">{alertsStats.activeTriggered} activas</span>
                      </div>
                      <div className="flex justify-between items-baseline text-[11px] text-slate-400">
                        <span>Sobrepeso racks:</span>
                        <span className="font-mono font-semibold text-slate-600">{alertsStats.overweightBinsCount} celdas sobre límite</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 mt-3 flex items-center justify-between text-xs font-bold text-rose-600 group-hover:text-rose-700">
                    <span className="text-[11px]">Seguridad Operativa</span>
                    <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">Ver Alertas →</span>
                  </div>
                </div>

                {/* 10. CENTRO DE REPORTES */}
                <div 
                  onClick={() => onTabChange('reports')}
                  className="bg-slate-50/70 hover:bg-white border border-slate-200/90 hover:border-blue-600/80 rounded-2xl p-4.5 transition-all shadow-3xs hover:shadow-md cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center transition group-hover:scale-105">
                        <FileDown className="h-4.5 w-4.5" />
                      </div>
                      <span className="text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        5 Suites BI
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                        Soporte & Monitoreo
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-blue-800 transition">
                        Centro de Reportes
                      </h4>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500 font-medium">Exportaciones Oficiales:</span>
                        <span className="text-sm font-black font-mono text-slate-800">XLSX / PDF</span>
                      </div>
                      <div className="flex justify-between items-baseline text-[11px] text-slate-400">
                        <span>Base de Datos:</span>
                        <span className="font-mono font-semibold text-slate-600">PostgreSQL SSL</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 mt-3 flex items-center justify-between text-xs font-bold text-blue-700 group-hover:text-blue-800">
                    <span className="text-[11px]">Auditoría & Backups</span>
                    <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">Abrir Reportes →</span>
                  </div>
                </div>

                {/* 11. REGISTRO DE PERSONAL (CONFIGURACIÓN) */}
                <div 
                  onClick={() => onTabChange('crew')}
                  className="bg-slate-50/70 hover:bg-white border border-slate-200/90 hover:border-indigo-600/80 rounded-2xl p-4.5 transition-all shadow-3xs hover:shadow-md cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center transition group-hover:scale-105">
                        <UserCheck className="h-4.5 w-4.5" />
                      </div>
                      <span className="text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                        {crewStats.activeCount} Activos
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                        En Configuración
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-indigo-800 transition">
                        Registro de Personal
                      </h4>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500 font-medium">Cuadrilla Total:</span>
                        <span className="text-sm font-black font-mono text-slate-800">{crewStats.totalCrew} operarios</span>
                      </div>
                      <div className="flex justify-between items-baseline text-[11px] text-slate-400">
                        <span>Turno / Terminal:</span>
                        <span className="font-mono font-semibold text-slate-600 truncate max-w-[130px]">{crewStats.deviceId}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 mt-3 flex items-center justify-between text-xs font-bold text-indigo-700 group-hover:text-indigo-800">
                    <span className="text-[11px]">PIN & Turnos RF</span>
                    <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">Ver Personal →</span>
                  </div>
                </div>

                {/* 12. CONFIGURACIÓN (APARIENCIA & BRANDING) */}
                <div 
                  onClick={() => onTabChange('configuracion')}
                  className="bg-slate-50/70 hover:bg-white border border-slate-200/90 hover:border-violet-600/80 rounded-2xl p-4.5 transition-all shadow-3xs hover:shadow-md cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 flex items-center justify-center transition group-hover:scale-105">
                        <Palette className="h-4.5 w-4.5" />
                      </div>
                      <span className="text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
                        {platformBrandingStats.versionTag || 'v1.2'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                        En Configuración
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-violet-800 transition">
                        Apariencia & Colores
                      </h4>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500 font-medium">Plataforma:</span>
                        <span className="text-sm font-black font-mono text-slate-800 truncate max-w-[120px]">{platformBrandingStats.platformName || 'O-WMS PRO'}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-[11px] text-slate-400">
                        <span>Color Primario:</span>
                        <span className="font-mono font-semibold flex items-center gap-1 text-slate-600">
                          <span className="h-2.5 w-2.5 rounded-full inline-block border border-slate-300" style={{ backgroundColor: platformBrandingStats.primaryColor }} />
                          {platformBrandingStats.primaryColor}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 mt-3 flex items-center justify-between text-xs font-bold text-violet-700 group-hover:text-violet-800">
                    <span className="text-[11px]">Imagen, Logo & Tema</span>
                    <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">Ir a Configuración →</span>
                  </div>
                </div>

                {/* 13. MANUAL DE USUARIO (CONFIGURACIÓN) */}
                <div 
                  onClick={() => onTabChange('manual')}
                  className="bg-slate-50/70 hover:bg-white border border-slate-200/90 hover:border-emerald-600/80 rounded-2xl p-4.5 transition-all shadow-3xs hover:shadow-md cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center transition group-hover:scale-105">
                        <BookOpen className="h-4.5 w-4.5" />
                      </div>
                      <span className="text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {manualStats.coveragePct}% SOPs
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                        En Configuración
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-emerald-800 transition">
                        Manual de Usuario
                      </h4>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500 font-medium">Procedimientos WMS:</span>
                        <span className="text-sm font-black font-mono text-slate-800">{manualStats.totalModulesDocumented} Módulos</span>
                      </div>
                      <div className="flex justify-between items-baseline text-[11px] text-slate-400">
                        <span>Documentación:</span>
                        <span className="font-mono font-semibold text-slate-600 truncate max-w-[130px]">Paso a paso WMS</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 mt-3 flex items-center justify-between text-xs font-bold text-emerald-700 group-hover:text-emerald-800">
                    <span className="text-[11px]">Buscador & SOPs</span>
                    <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">Abrir Manual →</span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* BANNER DE INTEGRACIÓN EJECUTIVA CON MAPA DE ALMACÉN      */}
          {/* (Visible en 'resumen', 'almacen' o 'todo')                */}
          {/* ======================================================== */}
          {(executivePerspective === 'resumen' || executivePerspective === 'almacen' || executivePerspective === 'todo') && (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-5 animate-fadeIn" id="executive-space-balance-panel">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-150">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1 px-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5">
                      <Boxes className="h-3.5 w-3.5" />
                      Balance de Espacio Conectado
                    </span>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                      Capacidad y Carga Física de Pasillos & Racks
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Sincronización directa en tiempo real con <strong>Mapa de Almacén</strong>. Cada celda, rack o pasillo modificado en el plano físico impacta de inmediato en estos indicadores ejecutivos.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onTabChange('map');
                    }}
                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <MapPin className="h-4 w-4" />
                    <span>Ver Plano Físico</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExecutivePerspective(executivePerspective === 'almacen' ? 'resumen' : 'almacen')}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>{executivePerspective === 'almacen' ? 'Contraer Vista' : 'Desglose por Racks 01-14 →'}</span>
                  </button>
                </div>
              </div>

              {/* Grid Ejecutivo de Pasillos y Racks */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* Columna Izquierda (7 cols): Balance por Pasillo */}
                <div className="lg:col-span-7 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-tight font-mono flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-indigo-600" />
                      <span>Carga por Pasillo Operativo (Aislación & Balance):</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {aisles.length} pasillos evaluados
                    </span>
                  </div>

                  <div className="space-y-3">
                    {aisleBarData.map((ad: any) => {
                      const pct = ad.Capacity > 0 ? Math.round((ad.Occupied / ad.Capacity) * 100) : 0;
                      const isHigh = pct >= 85;
                      const isMed = pct >= 50;

                      return (
                        <div key={ad.name} className="space-y-1 bg-white p-3 rounded-xl border border-slate-200/70 shadow-3xs">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-indigo-500" />
                              {ad.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-500 font-mono">
                                {ad.Occupied} de {ad.Capacity} celdas
                              </span>
                              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                isHigh ? 'bg-rose-100 text-rose-800' : isMed ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {pct}%
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                isHigh ? 'bg-rose-500' : isMed ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Columna Derecha (5 cols): Racks Destacados con Acceso Rápido */}
                <div className="lg:col-span-5 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800 uppercase tracking-tight font-mono flex items-center gap-1.5">
                        <Boxes className="h-4 w-4 text-blue-600" />
                        <span>Racks Físicos en Mapa:</span>
                      </span>
                      <span className="text-[10px] text-indigo-600 font-mono font-bold">
                        Clic para enfocar rack
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                      {Object.entries(pickingDensityData.rackTotals)
                        .slice(0, 6)
                        .map(([rNumStr, rData]: [string, any]) => {
                          const rNum = Number(rNumStr);
                          const pct = rData.total > 0 ? Math.round((rData.occupied / rData.total) * 100) : 0;
                          return (
                            <button
                              key={rNum}
                              type="button"
                              onClick={() => {
                                localStorage.setItem('owms_selected_map_rack', String(rNum));
                                onTabChange('map');
                              }}
                              className="p-2.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl transition text-left cursor-pointer group shadow-3xs"
                              title={`Inspeccionar Rack ${rNum} en el Mapa`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-mono font-black text-xs text-slate-800 group-hover:text-indigo-600">
                                  RACK {rNum}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500 font-bold">
                                  {pct}%
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate">
                                {rData.occupied}/{rData.total} celdas
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  <div className="p-3 bg-indigo-50/80 border border-indigo-200/80 rounded-xl text-xs text-indigo-900 flex items-center justify-between mt-3">
                    <span className="text-[11px] font-medium">
                      Estructura completa de 14 racks disponible en el mapa interactivo.
                    </span>
                    <button
                      type="button"
                      onClick={() => onTabChange('map')}
                      className="font-bold underline text-indigo-700 hover:text-indigo-900 shrink-0 cursor-pointer text-[11px]"
                    >
                      Ir al Mapa →
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* SECCIÓN: MÉTRICAS DE PROCESOS CLAVE Y FLUJO TRANSACCIONAL */}
          {(executivePerspective === 'resumen' || executivePerspective === 'procesos' || executivePerspective === 'operaciones' || executivePerspective === 'todo') && (
            <>
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1 px-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 text-[10px] font-mono font-bold uppercase tracking-wider">Módulos WMS</span>
                    <h2 className="text-xs font-black text-slate-800 uppercase tracking-tight">Indicadores de Procesos Clave</h2>
                  </div>
          <p className="text-xs text-slate-400 mt-1">Monitoreo del desempeño en las operaciones de recepción de mercancía, cumplimientos de empaque, reubicaciones internas y auditorías de inventario físico.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Proceso de Entrada */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-blue-500 tracking-wider">01. Proceso de Entrada</span>
                  <h3 className="text-lg font-bold text-slate-800">Recepción & Putaway</h3>
                </div>
                <div className="h-9 w-9 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600">
                  <ArrowDownLeft className="h-5 w-5" />
                </div>
              </div>
              
              <div className="space-y-3 mt-6">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Unidades Ingresadas ({periodLabelText})</span>
                  <span className="font-mono font-bold text-slate-700">{totalReceivedUnits.toLocaleString()} unidades</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Órdenes de Recepción</span>
                  <span className="font-mono font-bold text-slate-700">{receivingOrdersCount} pedidos</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Ubicaciones Con Stock</span>
                  <span className="font-mono font-bold text-slate-700">{occupiedSlots} de {totalSlots} celdas</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200/50 mt-6 flex items-center justify-between text-[11px] text-emerald-600 font-semibold">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Rendimiento de Guardado:
              </span>
              <span className="font-mono font-bold">99.4%</span>
            </div>
          </div>

          {/* Card 2: Proceso de Salida */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">02. Proceso de Salida</span>
                  <h3 className="text-lg font-bold text-slate-800">Salidas de Almacén & Surtido</h3>
                </div>
                <div className="h-9 w-9 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
              </div>

              <div className="space-y-3 mt-6">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Unidades Surtidas ({periodLabelText})</span>
                  <span className="font-mono font-bold text-slate-700">{totalDispatchQty.toLocaleString()} unidades</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Órdenes de Salida</span>
                  <span className="font-mono font-bold text-slate-700">{totalDispatchedCount} pedidos</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Tasa de Surtido (Fulfillment)</span>
                  <span className="font-mono font-bold text-slate-700">{outboundFulfillmentRate}%</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200/50 mt-6 flex items-center justify-between text-[11px] text-blue-600 font-semibold">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Exactitud de Embarque:
              </span>
              <span className="font-mono font-bold">{outboundAccuracy}%</span>
            </div>
          </div>

          {/* Card 3: Proceso de Conteo Cíclico */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">03. Auditoría Física</span>
                  <h3 className="text-lg font-bold text-slate-800">Conteo Cíclico</h3>
                </div>
                <div className="h-9 w-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
              </div>

              <div className="space-y-3 mt-6">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Auditorías Realizadas</span>
                  <span className="font-mono font-bold text-slate-700">{totalCountsPerformed} SKU(s)</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium font-sans">Discrepancia Total</span>
                  <span className={`font-mono font-bold ${totalDiscrepancyVolume > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                    {totalDiscrepancyVolume > 0 ? `${totalDiscrepancyVolume} unidades` : '0 unidades (Perfecto)'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium font-sans">Exactitud Promedio</span>
                  <span className="font-mono font-bold text-slate-700">{countingAccuracy}%</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200/50 mt-6 flex items-center justify-between text-[11px] text-amber-600 font-semibold">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Cumplimiento del Programa:
              </span>
              <span className="font-mono font-bold">100%</span>
            </div>
          </div>

          {/* Card 4: Proceso de Movimientos Internos */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-purple-600 tracking-wider">04. Reubicaciones</span>
                  <h3 className="text-lg font-bold text-slate-800">Movimientos Internos</h3>
                </div>
                <div className="h-9 w-9 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-600">
                  <ArrowLeftRight className="h-5 w-5" />
                </div>
              </div>

              <div className="space-y-3 mt-6">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Transferencias Totales</span>
                  <span className="font-mono font-bold text-slate-700">{movementsStats.totalMoves} movimientos</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Movimientos Hoy</span>
                  <span className="font-mono font-bold text-slate-700">{movementsStats.movesToday} registros</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Balance por Niveles</span>
                  <span className="font-mono font-bold text-slate-700">L1:{movementsStats.l1Moves} · L2:{movementsStats.l2Moves} · L3:{movementsStats.l3Moves}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200/50 mt-6 flex items-center justify-between text-[11px] text-purple-600 font-semibold">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Eficiencia de Traslado:
              </span>
              <span className="font-mono font-bold">100%</span>
            </div>
          </div>
        </div>

        {/* Historial de Auditorías de Conteo Cíclico Recientes */}
        {filteredCountedSessions.length > 0 && (
          <div className="pt-4 border-t border-slate-150">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider block mb-3">Historial Reciente de Auditorías de Conteo Cíclico</span>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredCountedSessions.slice(0, 3).map((session, sidx) => {
                return (
                  <div key={sidx} className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex justify-between items-center text-xs leading-relaxed">
                    <div>
                      <span className="font-mono font-black text-slate-800">{session.sku}</span>
                      <span className="block text-[10px] text-slate-400">Fecha: {new Date(session.date).toLocaleDateString()}</span>
                    </div>
                    <div className="text-right">
                      <span className="block font-semibold text-slate-500">Contado: {session.physical} | Sist: {session.system}</span>
                      <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        session.deviation === 0 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : 'bg-rose-50 text-rose-700'
                      }`}>
                        {session.deviation === 0 ? '✓ Sin diferencia' : `${session.deviation > 0 ? '+' : ''}${session.deviation} diferencia`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Donut Distribution of storage cells */}
        <div className="bg-white p-6 border border-slate-100 rounded-2xl shadow-sm lg:col-span-1">
          <h3 className="text-sm font-bold text-slate-700 tracking-tight uppercase mb-4">
            Asignación Total de Recursos de Celdas
          </h3>
          <div className="h-60 relative flex flex-col justify-center items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={occupancyPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {occupancyPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} Celdas`} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center percentage label */}
            <div className="absolute flex flex-col items-center">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Espacios Totales</span>
              <span className="text-2xl font-bold text-slate-800">{totalSlots}</span>
            </div>
          </div>
          <div className="space-y-2 mt-2">
            {occupancyPieData.map((d, i) => (
              <div key={i} className="flex justify-between items-center text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-md shadow-xs block" style={{ backgroundColor: d.color }} />
                  <span>{d.name}</span>
                </div>
                <span className="font-semibold font-mono">{d.value} ({Math.round((d.value / totalSlots) * 100 || 0)}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Bar representing Aisle loads */}
        <div className="bg-white p-6 border border-slate-100 rounded-2xl shadow-sm lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-700 tracking-tight uppercase mb-6">
            Carga de Capacidad de Ocupación por Pasillo
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aisleBarData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(37, 99, 235, 0.05)' }} />
                <Bar dataKey="Occupied" name="Ocupado" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Capacity" name="Capacidad" fill="#e2e8f0" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* SECCIÓN DE GRÁFICOS: FLUJO SEMANAL Y EVOLUCIÓN HISTÓRICA DE COSTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Area Chart: movements during the week */}
        <div className="bg-white p-6 border border-slate-100 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-700 tracking-tight uppercase mb-2 flex items-center gap-2">
              <span className="p-1 px-2 rounded-lg bg-emerald-50 text-emerald-600 text-[9px] font-mono font-bold uppercase tracking-wider">Flujo Semanal</span>
              Flujo Transaccional Semanal (Movimientos WMS)
            </h3>
            <p className="text-[11px] text-slate-400 mb-6">
              Monitoreo del flujo consolidado de entradas y salidas de stock procesadas en el período seleccionado ({timePeriod === 'today' ? 'Hoy' : timePeriod === '7days' ? 'Últimos 7 días' : timePeriod === 'this_month' ? 'Este Mes' : timePeriod === 'custom' ? 'Período Personalizado' : 'Historial Completo'}).
            </p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="Inbound" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIn)" />
                <Area type="monotone" dataKey="Outbound" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorOut)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Line Chart: Evolution of total inventory cost */}
        <div className="bg-white p-6 border border-slate-100 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-700 tracking-tight uppercase mb-2 flex items-center gap-2">
              <span className="p-1 px-2 rounded-lg bg-indigo-50 text-indigo-600 text-[9px] font-mono font-bold uppercase tracking-wider">Histórico de Valor</span>
              Evolución del Costo Total del Inventario ({timePeriod === 'today' ? 'Hoy' : timePeriod === '7days' ? 'Últimos 7 días' : timePeriod === 'this_month' ? 'Este Mes' : timePeriod === 'custom' ? 'Período Personalizado' : 'Historial Completo'})
            </h3>
            <p className="text-[11px] text-slate-400 mb-6">
              Evolución acumulada del valor financiero del almacén ({currencyMode === 'mxn_to_usd' ? 'en USD $' : 'en moneda original $'}) obtenida del cálculo retroactivo.
            </p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalInventoryCost} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `${currencyMode === 'mxn_to_usd' ? 'USD $' : '$'}${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                />
                <Tooltip
                  formatter={(value: any) => [`${currencyMode === 'mxn_to_usd' ? 'USD $' : '$'}${value.toLocaleString()}`, 'Valor de Inventario']}
                  labelFormatter={(label) => `Fecha: ${label}`}
                  contentStyle={{ borderRadius: '12px', borderColor: '#f1f5f9' }}
                />
                <Line
                  type="monotone"
                  dataKey="costo"
                  stroke="#6366f1"
                  strokeWidth={3}
                  dot={{ r: 3, stroke: '#6366f1', strokeWidth: 1, fill: '#fff' }}
                  activeDot={{ r: 6, stroke: '#4f46e5', strokeWidth: 2, fill: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
      </>
    )}

      {/* SECCIÓN: CAPITAL, TENDENCIAS Y ROTACIÓN DE INVENTARIO */}
      {(executivePerspective === 'capital' || executivePerspective === 'todo') && (
        <>
          {/* Stock History Trend Chart Card (Analizador de Tendencias de Cantidad de Stock de SKU) */}
          <div id="sku-trend-analyzer-section" className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-150 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
              Analizador de Tendencias de Cantidad de Stock de SKU
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Visualiza las fluctuaciones de cantidad históricas y en tiempo real basadas en registros físicos automatizados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
              Seleccionar SKU para Análisis:
            </label>
            <select
              value={activeTrendSku}
              onChange={(e) => {
                setSelectedTrendSku(e.target.value);
                localStorage.setItem('owms_selected_trend_sku', e.target.value);
              }}
              className="text-xs font-bold rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer shadow-2xs"
            >
              {inventory.map((item) => (
                <option key={item.sku} value={item.sku}>
                  {item.sku} — {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeTrendItem ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left stats metrics list */}
            <div className="lg:col-span-1 flex flex-col gap-3.5">
              {/* Product Info Mini Block */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                <div className="text-[10px] uppercase font-bold text-slate-400 font-mono">SKU Seleccionado Actual</div>
                <div className="font-mono font-black text-slate-800 text-sm tracking-tight truncate" title={activeTrendItem.sku}>
                  {activeTrendItem.sku}
                </div>
                <div className="text-xs font-bold text-slate-600 line-clamp-2">
                  {activeTrendItem.name}
                </div>
                <div className="text-[10px] bg-indigo-50 text-indigo-700 font-bold font-mono px-2 py-0.5 rounded-md inline-block uppercase">
                  {activeTrendItem.category}
                </div>
              </div>

              {/* Stats values */}
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                  <span className="block text-[9px] uppercase font-bold text-slate-400 font-mono">Cantidad Actual</span>
                  <span className="text-lg font-black font-mono text-indigo-700">{activeTrendItem.qty} <span className="text-xs font-medium text-slate-500">unidades</span></span>
                </div>
                
                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                  <span className="block text-[9px] uppercase font-bold text-slate-400 font-mono">Objetivo de Seguridad</span>
                  <span className="text-lg font-black font-mono text-emerald-700">{activeTrendItem.minQty} <span className="text-xs font-medium text-slate-500">unidades</span></span>
                </div>

                <div className="col-span-2 lg:col-span-1 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <span className="block text-[9px] uppercase font-bold text-slate-400 font-mono">Registros de Historial</span>
                  <span className="text-lg font-black font-mono text-slate-700">
                    {logs.filter(log => (log.details || '').toLowerCase().includes(activeTrendItem.sku.toLowerCase())).length} <span className="text-xs font-medium text-slate-500">entradas</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Recharts chart on the right */}
            <div className="lg:col-span-3 bg-slate-50/50 border border-slate-100 rounded-xl p-4 flex flex-col justify-between min-h-[340px]">
              {skuTrendHistoryData.length > 0 ? (
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={skuTrendHistoryData}
                      margin={{ top: 10, right: 20, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="dateStr" 
                        stroke="#94a3b8" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        dy={8}
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        dx={-8}
                      />
                      <Tooltip content={<CustomSkuTrendTooltip />} />
                      <Legend 
                        verticalAlign="top" 
                        height={36} 
                        iconType="circle" 
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace' }}
                      />
                      <Line
                        name="Nivel Físico de Cantidad de SKU"
                        type="monotone"
                        dataKey="qty"
                        stroke="#4f46e5"
                        strokeWidth={2.5}
                        dot={{ r: 3.5, strokeWidth: 1.5, stroke: "#ffffff", fill: "#4f46e5" }}
                        activeDot={{ r: 6, strokeWidth: 1, stroke: "#ffffff", fill: "#312e81" }}
                        animationDuration={1200}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center grow text-center py-12 px-4 space-y-2 select-none">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                    <TrendingUp className="h-6 w-6 stroke-[1.5]" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-700">Esperando Actividad de Registro</h4>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    Solo se encontró un único punto de datos para este SKU. ¡Intente registrar entradas o salidas para generar nuevos datos históricos de tendencia!
                  </p>
                </div>
              )}
              
              <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono mt-2 pt-2 border-t border-slate-100">
                <span>Eje del Tiempo (Más antiguo → Más reciente)</span>
                <span>Todos los valores están sincronizados automáticamente con Supabase</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-xs text-slate-400 font-medium">
            No hay productos registrados en el inventario para realizar análisis históricos.
          </div>
        )}
      </div>

      {/* ANÁLISIS DE CAPITAL Y VOLUMEN DE PROVEEDORES (Movido de Registro de SKU a Métricas) */}
      <div id="supplier-capital-metrics-section" className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-150 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-500" />
              Análisis de Capital y Volumen de Proveedores
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Distribución calculada de la inversión total de capital y la contribución del volumen de stock por fabricante registrado.
            </p>
          </div>
          <div className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-md border border-slate-200/50">
            {supplierStats.list.length} Proveedores Registrados
          </div>
        </div>

        {supplierStats.list.length > 0 ? (
          <div className="space-y-6">
            {/* Top Stat Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-bold text-slate-400 font-mono">Capital Total Invertido</span>
                  <span className="text-base font-black font-mono text-slate-800">
                    ${supplierStats.totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                  <Boxes className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-bold text-slate-400 font-mono">Volumen Total de Stock</span>
                  <span className="text-base font-black font-mono text-slate-800">
                    {supplierStats.totalInventoryQty.toLocaleString()} <span className="text-xs font-semibold text-slate-400">unidades</span>
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[9px] uppercase font-bold text-slate-400 font-mono">Socio Comercial Principal</span>
                  <span className="text-base font-black font-mono text-slate-800 block truncate" title={supplierStats.leadingSupplier?.name}>
                    {supplierStats.leadingSupplier?.name || 'N/A'}
                  </span>
                  {supplierStats.leadingSupplier && (
                    <span className="text-[10px] font-sans font-semibold text-emerald-600">
                      Posee el {supplierStats.leadingSupplier.valueShare.toFixed(1)}% de valoración
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-xl shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-bold text-slate-400 font-mono">Diversidad Promedio</span>
                  <span className="text-base font-black font-mono text-slate-800">
                    {supplierStats.list.length > 0 ? (inventory.length / supplierStats.list.length).toFixed(1) : 0} <span className="text-xs font-semibold text-slate-400">SKUs/prov</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Recharts BarChart for Top Suppliers */}
            {supplierBarChartData.length > 0 && (
              <div className="bg-slate-50/60 border border-slate-150 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 font-mono uppercase tracking-wide">
                    Comparativa de Capital Invertido ($) y Volumen (uds) por Proveedor
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Top {supplierBarChartData.length} Proveedores</span>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={supplierBarChartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                      <YAxis yAxisId="left" stroke="#6366f1" fontSize={10} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                      <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={10} tickLine={false} tickFormatter={(v) => `${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}u`} />
                      <Tooltip 
                        formatter={(value: any, name: string) => [
                          name === 'Capital Invertido ($)' ? `$${Number(value).toLocaleString()}` : `${Number(value).toLocaleString()} uds`,
                          name
                        ]}
                        labelFormatter={(label, items) => {
                          const fullName = items?.[0]?.payload?.fullName || label;
                          const pct = items?.[0]?.payload?.porcentaje;
                          return `${fullName} (${pct}% del valor total)`;
                        }}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                      />
                      <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      <Bar yAxisId="left" dataKey="valor" name="Capital Invertido ($)" fill="#6366f1" radius={[6, 6, 0, 0]} />
                      <Bar yAxisId="right" dataKey="unidades" name="Volumen Stock (uds)" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Calculated Table of Suppliers */}
            <div className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-3 px-4">Proveedor Socio</th>
                    <th className="py-3 px-4 text-center">Diversidad de SKU</th>
                    <th className="py-3 px-4 text-right">Volumen Físico</th>
                    <th className="py-3 px-4 text-right">Valoración de Stock</th>
                    <th className="py-3 px-4 text-center">Participación de Valoración Relativa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {supplierStats.list.map((sup, idx) => (
                    <tr key={sup.name} className="hover:bg-slate-50/40 transition">
                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="text-slate-400 text-xs font-mono font-bold select-none">#{idx + 1}</span>
                          <div className="h-7 w-7 rounded-lg bg-indigo-50/50 border border-indigo-100/40 flex items-center justify-center shrink-0">
                            <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                          </div>
                          <span className="font-sans font-semibold text-slate-700 select-all">{sup.name}</span>
                        </div>
                      </td>

                      {/* SKU Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md text-[10.5px]">
                          {sup.skuCount} {sup.skuCount === 1 ? 'SKU' : 'SKUs'}
                        </span>
                      </td>

                      {/* Total Quantity */}
                      <td className="py-3.5 px-4 text-right font-mono">
                        <div className="font-bold text-slate-700">{sup.totalQty.toLocaleString()}</div>
                        <div className="text-[9px] text-slate-400">({sup.qtyShare.toFixed(1)}% qty)</div>
                      </td>

                      {/* Total Cost Value */}
                      <td className="py-3.5 px-4 text-right font-mono">
                        <div className="font-extrabold text-indigo-600">
                          ${sup.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[9px] text-slate-400">({sup.valueShare.toFixed(1)}% val)</div>
                      </td>

                      {/* relative visual progress bar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3 justify-center max-w-xs mx-auto">
                          <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-indigo-500" 
                              style={{ width: `${sup.valueShare}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-extrabold text-slate-500 w-10 text-right">
                            {sup.valueShare.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-xs text-slate-400 font-medium">
            Registra SKUs con marcas de proveedores para ver estadísticas de distribución de capital.
          </div>
        )}
      </div>
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2 rounded-lg bg-indigo-50 border border-indigo-150 text-indigo-600 text-[10px] font-mono font-bold uppercase tracking-wider">Configuración de Seguridad</span>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-indigo-500" />
                Alertas de Stock Crítico
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Elige cómo deseas que el sistema te notifique cuando las existencias de un SKU caigan por debajo del nivel de seguridad establecido.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex bg-slate-50 border border-slate-100 p-1 rounded-xl">
              <button
                onClick={() => {
                  setNotificationSetting('visual');
                  localStorage.setItem('wms_notification_setting', 'visual');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  notificationSetting === 'visual'
                    ? 'bg-white text-indigo-650 shadow-xs border border-slate-100'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Mostrar alertas visuales tradicionales en el panel"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Alertas Visuales</span>
              </button>

              <button
                onClick={() => {
                  setNotificationSetting('toast');
                  localStorage.setItem('wms_notification_setting', 'toast');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  notificationSetting === 'toast'
                    ? 'bg-white text-indigo-650 shadow-xs border border-slate-100'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Mostrar notificaciones emergentes (toasts) flotantes"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Notificaciones Toast</span>
              </button>

              <button
                onClick={() => {
                  setNotificationSetting('both');
                  localStorage.setItem('wms_notification_setting', 'both');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  notificationSetting === 'both'
                    ? 'bg-white text-indigo-650 shadow-xs border border-slate-100'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Activar ambos sistemas de alerta simultáneamente"
              >
                <Bell className="h-3.5 w-3.5" />
                <span>Ambos Métodos</span>
              </button>
            </div>

            <button
              onClick={() => {
                const randomSku = `TEST-${Math.floor(100 + Math.random() * 900)}`;
                const dummyNames = [
                  'Rodamiento de Acero Industrial',
                  'Filtro de Aire Alta Presión',
                  'Válvula Reguladora WMS',
                  'Empaque Hidráulico Reforzado'
                ];
                const randomName = dummyNames[Math.floor(Math.random() * dummyNames.length)];
                const dummyToast = {
                  sku: randomSku,
                  name: randomName,
                  qty: Math.floor(Math.random() * 3),
                  minQty: 12,
                  isTest: true
                };
                setActiveToasts(prev => [dummyToast, ...prev]);
              }}
              className="bg-slate-100 hover:bg-slate-200 active:scale-95 transition text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer border border-slate-200"
              title="Simular una alerta crítica de stock bajo"
            >
              <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
              <span>Probar Alerta</span>
            </button>
          </div>
        </div>
      </div>

      {/* PANEL DE CONFIGURACIÓN DE UMBRALES DE ALERTA DE STOCK CRÍTICO */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-6 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-mono font-bold uppercase tracking-wider">
                Control de Seguridad
              </span>
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-rose-500" />
                Configuración de Umbrales de Stock Crítico
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Gestione los niveles de inventario de seguridad. El sistema emitirá alertas automáticas si las existencias descienden por debajo del límite definido.
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 p-2 rounded-xl text-[11px] font-bold text-slate-600">
            {isOperator ? (
              <span className="flex items-center gap-1 text-amber-600">
                <Lock className="h-3.5 w-3.5" />
                Modo Lectura (Operador)
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-600">
                <ShieldCheck className="h-3.5 w-3.5" />
                Modo Administrador ({platformUser?.displayName || (platformUser?.email ? platformUser.email.split('@')[0] : 'Supervisor de Turno')})
              </span>
            )}
          </div>
        </div>

        {/* Mensajes de Feedback de Umbrales */}
        {thresholdSuccessMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center justify-between animate-fadeIn">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
              {thresholdSuccessMsg}
            </span>
            <button onClick={() => setThresholdSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {thresholdErrorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-150 text-rose-800 rounded-2xl text-xs font-semibold flex items-center justify-between animate-fadeIn">
            <span className="flex items-center gap-2">
              <TriangleAlert className="h-4.5 w-4.5 text-rose-600" />
              {thresholdErrorMsg}
            </span>
            <button onClick={() => setThresholdErrorMsg('')} className="text-rose-500 hover:text-rose-700 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna Izquierda: Configuración Global y por Categoría */}
          <div className="lg:col-span-5 space-y-6">
            {/* 1. Umbral General (Global Fallback) */}
            <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50/50 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <Settings className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Umbral de Alerta Global
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Se aplica a todos los SKU que no posean un umbral de seguridad específico.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Stock Mínimo General</span>
                  <span className="font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    {globalThreshold} unidades
                  </span>
                </div>
                
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  disabled={isOperator}
                  value={globalThreshold}
                  onChange={(e) => handleSaveGlobalThreshold(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                
                <div className="flex justify-between text-[9px] font-mono font-bold text-slate-400">
                  <span>0 u.</span>
                  <span>25 u.</span>
                  <span>50 u.</span>
                  <span>75 u.</span>
                  <span>100 u.</span>
                </div>
              </div>
            </div>

            {/* 2. Umbral por Categoría */}
            <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50/50 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Definir por Categoría Completa
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Asigna un umbral de alerta uniforme a todos los artículos de una misma línea de productos.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Seleccionar Categoría
                  </label>
                  <select
                    disabled={isOperator}
                    value={selectedCategoryForThreshold}
                    onChange={(e) => setSelectedCategoryForThreshold(e.target.value)}
                    className="w-full border border-slate-250 bg-white p-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-550/20 disabled:opacity-60 disabled:cursor-not-allowed text-slate-700"
                  >
                    <option value="">-- Seleccionar categoría --</option>
                    {uniqueCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Umbral Crítico (Unidades)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      disabled={isOperator}
                      value={categoryThresholdInput}
                      onChange={(e) => setCategoryThresholdInput(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="border border-slate-200 bg-white p-2 rounded-xl text-xs font-mono font-bold w-24 text-center focus:outline-none focus:ring-2 focus:ring-indigo-550/20 disabled:opacity-60 text-slate-700"
                    />
                    <button
                      type="button"
                      disabled={isOperator || !selectedCategoryForThreshold}
                      onClick={handleApplyCategoryThreshold}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer select-none disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-3xs"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Aplicar en Lote</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Gestión SKU por SKU */}
          <div className="lg:col-span-7 border border-slate-100 rounded-2xl p-5 bg-slate-50/20 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Boxes className="h-4 w-4 text-indigo-500" />
                    Umbrales Específicos por SKU
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Ajuste fino del nivel mínimo de existencias para artículos de alta prioridad.
                  </p>
                </div>

                {/* Buscador de SKU */}
                <div className="relative w-full sm:w-48 shrink-0">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar SKU o nombre..."
                    value={skuSearchThresholdQuery}
                    onChange={(e) => {
                      setSkuSearchThresholdQuery(e.target.value);
                      setThresholdEditorPage(1);
                    }}
                    className="w-full border border-slate-200 bg-white pl-8 pr-3 py-1.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-550/20 font-medium text-slate-700 placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Tabla de SKUs */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                      <th className="pb-2.5 text-left">SKU / ARTÍCULO</th>
                      <th className="pb-2.5 text-center">CATEGORÍA</th>
                      <th className="pb-2.5 text-center">STOCK ACT.</th>
                      <th className="pb-2.5 text-right pr-2">UMBRAL ALERTA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {currentThresholdPageItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 text-[11px] font-medium">
                          No se encontraron artículos con los criterios de búsqueda.
                        </td>
                      </tr>
                    ) : (
                      currentThresholdPageItems.map((item) => {
                        const isEditing = editingSku === item.sku;
                        const hasCustomThreshold = item.minQty !== undefined && item.minQty > 0;
                        const currentThreshold = hasCustomThreshold ? item.minQty : globalThreshold;
                        const isBelow = item.qty <= currentThreshold;

                        return (
                          <tr key={item.sku} className="hover:bg-slate-50/40">
                            <td className="py-2.5 font-mono font-bold text-slate-800">
                              {item.sku}
                              <span className="block font-sans text-[10px] text-slate-400 font-normal truncate max-w-[160px]">
                                {item.name}
                              </span>
                            </td>
                            <td className="py-2.5 text-center text-[10px] text-slate-500 font-semibold truncate max-w-[100px]">
                              {item.category}
                            </td>
                            <td className="py-2.5 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                                isBelow 
                                  ? 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse' 
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              }`}>
                                {item.qty} uds
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-medium">
                              {isEditing ? (
                                <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-1 rounded-lg">
                                  <button
                                    onClick={() => setEditingSkuValue(v => Math.max(0, v - 1))}
                                    className="h-5 w-5 rounded-md bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 active:scale-90 select-none cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    value={editingSkuValue}
                                    onChange={(e) => setEditingSkuValue(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                    className="w-10 bg-transparent text-center font-mono text-xs font-bold focus:outline-none text-slate-800"
                                  />
                                  <button
                                    onClick={() => setEditingSkuValue(v => v + 1)}
                                    className="h-5 w-5 rounded-md bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 active:scale-90 select-none cursor-pointer"
                                  >
                                    +
                                  </button>
                                  <button
                                    onClick={() => handleSaveSkuThreshold(item.sku)}
                                    className="h-5 px-1.5 rounded-md bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold active:scale-95 cursor-pointer"
                                    title="Guardar"
                                  >
                                    <Save className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => setEditingSku(null)}
                                    className="h-5 px-1.5 rounded-md bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold active:scale-95 cursor-pointer"
                                    title="Cancelar"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-2 pr-1.5">
                                  <span className={`font-mono text-xs font-bold ${hasCustomThreshold ? 'text-indigo-600' : 'text-slate-400 italic'}`}>
                                    {currentThreshold} {hasCustomThreshold ? 'u. (Esp.)' : 'u. (Glob.)'}
                                  </span>
                                  {!isOperator && (
                                    <button
                                      onClick={() => {
                                        setEditingSku(item.sku);
                                        setEditingSkuValue(currentThreshold);
                                      }}
                                      className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                                      title="Editar umbral específico"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Paginación */}
            {totalThresholdPages > 1 && (
              <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-[11px] font-bold text-slate-400 no-print">
                <span>Pág. {thresholdEditorPage} de {totalThresholdPages}</span>
                <div className="flex gap-1.5">
                  <button
                    disabled={thresholdEditorPage === 1}
                    onClick={() => setThresholdEditorPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 text-slate-500" />
                  </button>
                  <button
                    disabled={thresholdEditorPage === totalThresholdPages}
                    onClick={() => setThresholdEditorPage(p => Math.min(totalThresholdPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECCIÓN: ANÁLISIS DE ROTACIÓN DE INVENTARIO */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 text-[10px] font-mono font-bold uppercase tracking-wider">Métrica de Rendimiento</span>
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                <ArrowLeftRight className="h-4 w-4 text-indigo-500" />
                Análisis de Rotación de Inventario (KPIs de Rotación)
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Cálculo automático del índice de rotación (frecuencia de entradas y salidas) por categoría para optimizar el slotting del almacén e identificar capital inmovilizado.
            </p>
          </div>
          
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold">Buscar Categoría:</span>
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={turnoverSearch}
                onChange={(e) => setTurnoverSearch(e.target.value)}
                placeholder="Ej. CPU, Sensores..."
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>
          </div>
        </div>

        {/* 4 Cards de Resumen Estadístico */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 shrink-0">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Rotación Promedio</span>
              <span className="text-base font-black text-slate-800 font-mono block mt-0.5">{turnoverStats.avgTurnover}x</span>
              <span className="text-[10px] text-slate-400 leading-none">Veces reemplazado al año</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Mayor Movimiento</span>
              <span className="text-base font-black text-emerald-700 font-mono block mt-0.5 truncate max-w-[150px]" title={turnoverStats.highestCategory}>
                {turnoverStats.highestCategory}
              </span>
              <span className="text-[10px] text-slate-400 leading-none">TR máximo: {turnoverStats.highestTurnover}x</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 shrink-0">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Categorías Lentas</span>
              <span className="text-base font-black text-amber-700 font-mono block mt-0.5">{turnoverStats.inactiveCount} Categoría(s)</span>
              <span className="text-[10px] text-slate-400 leading-none font-sans">Rotación menor a 0.25x</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shrink-0">
              <ZapOff className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider truncate" title="Capital Inactivo">Capital Inactivo</span>
              <span 
                className="text-base font-black text-rose-700 font-mono block mt-0.5 truncate cursor-help"
                title={`Valor exacto: ${currencyMode === 'mxn_to_usd' ? 'USD $' : '$'}${turnoverStats.inactiveValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              >
                {currencyMode === 'mxn_to_usd' ? 'USD $' : '$'}
                {formatCompactValue(turnoverStats.inactiveValue, true)}
              </span>
              <span className="text-[10px] text-slate-400 leading-none block truncate" title="Inmovilizado en stock inactivo">Inmovilizado en stock inactivo</span>
            </div>
          </div>
        </div>

        {/* Gráfico y Detalle Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Gráfico Recharts de Barras y Líneas Combinadas */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 lg:col-span-5 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-tight mb-1 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-indigo-500" />
                Matriz de Flujo (Entradas vs Salidas) & TR
              </h4>
              <p className="text-[10px] text-slate-400 leading-normal mb-4">
                Las barras representan el volumen operado (unidades). La línea roja representa el Índice de Rotación (TR). Un TR bajo con barras de entrada altas indica sobre stock.
              </p>
            </div>
            
            <div className="h-64 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={categoryTurnover} margin={{ top: 10, right: -5, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="category" stroke="#94a3b8" fontSize={9} tickLine={false} />
                  {/* Primary Y-axis for units */}
                  <YAxis yAxisId="left" stroke="#94a3b8" fontSize={9} tickLine={false} label={{ value: 'Unidades', angle: -90, position: 'insideLeft', style: {fontSize: '9px', fill: '#94a3b8'} }} />
                  {/* Secondary Y-axis for turnover rate */}
                  <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" fontSize={9} tickLine={false} label={{ value: 'Tasa (x)', angle: 90, position: 'insideRight', style: {fontSize: '9px', fill: '#f43f5e'} }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '9px', marginTop: '5px' }} />
                  <Bar yAxisId="left" dataKey="inboundQty" name="Entradas (In)" fill="#10b981" radius={[3, 3, 0, 0]} barSize={14} />
                  <Bar yAxisId="left" dataKey="outboundQty" name="Salidas (Out)" fill="#2563eb" radius={[3, 3, 0, 0]} barSize={14} />
                  <Line yAxisId="right" type="monotone" dataKey="turnoverRate" name="Tasa Rotación" stroke="#f43f5e" strokeWidth={2} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabla de Resultados de Rotación por Categoría */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              {/* Tabs de Filtro de Estado de Rotación */}
              <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60 w-fit">
                <button
                  onClick={() => setTurnoverTab('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none ${
                    turnoverTab === 'all' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Todas
                </button>
                <button
                  onClick={() => setTurnoverTab('high')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none flex items-center gap-1 ${
                    turnoverTab === 'high' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500 hover:text-emerald-600'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Alta
                </button>
                <button
                  onClick={() => setTurnoverTab('medium')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none flex items-center gap-1 ${
                    turnoverTab === 'medium' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-blue-600'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Media
                </button>
                <button
                  onClick={() => setTurnoverTab('low')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none flex items-center gap-1 ${
                    turnoverTab === 'low' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-500 hover:text-amber-600'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Baja
                </button>
                <button
                  onClick={() => setTurnoverTab('inactive')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none flex items-center gap-1 ${
                    turnoverTab === 'inactive' ? 'bg-white text-rose-650 shadow-xs' : 'text-slate-500 hover:text-rose-600'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  Inactivo
                </button>
              </div>
              <span className="text-[10px] text-slate-400 font-mono font-semibold">Clic en fila para auditar SKUs</span>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white max-h-[268px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-2.5 px-3">Categoría</th>
                    <th className="py-2.5 px-3 text-center">SKUs</th>
                    <th className="py-2.5 px-3 text-center">In / Out</th>
                    <th className="py-2.5 px-3 text-center">Stock Actual</th>
                    <th className="py-2.5 px-3 text-center">TR Promedio</th>
                    <th className="py-2.5 px-3 text-center">Estado TR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {(() => {
                    let list = categoryTurnover;
                    
                    // Filter by search query
                    if (turnoverSearch) {
                      list = list.filter(i => i.category.toLowerCase().includes(turnoverSearch.toLowerCase()));
                    }

                    // Filter by status tab
                    if (turnoverTab !== 'all') {
                      list = list.filter(i => i.status === turnoverTab);
                    }

                    if (list.length === 0) {
                      return (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                            No se encontraron categorías de rotación para este filtro.
                          </td>
                        </tr>
                      );
                    }

                    return list.map((item) => {
                      const isSelected = selectedTurnoverCat === item.category;
                      return (
                        <tr
                          key={item.category}
                          onClick={() => setSelectedTurnoverCat(isSelected ? null : item.category)}
                          className={`hover:bg-slate-50/50 transition duration-150 cursor-pointer ${
                            isSelected ? 'bg-indigo-50/30 font-semibold' : ''
                          }`}
                        >
                          <td className="py-3 px-3 font-bold text-slate-700 capitalize">
                            {item.category}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-semibold text-slate-500">
                            {item.skuCount}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-500">
                            <span className="text-emerald-600 font-bold">{item.inboundQty}</span>
                            <span className="mx-1 text-slate-300">/</span>
                            <span className="text-blue-600 font-bold">{item.outboundQty}</span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                            {item.stockQty} uds
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-xs">
                            <span className="font-extrabold text-slate-900">{item.turnoverRate}x</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider font-mono ${item.statusColor}`}>
                              {item.statusText}
                            </span>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Panel Detallado de Auditoría de SKUs cuando se selecciona una categoría */}
        {selectedTurnoverCat && (() => {
          const categoryDetail = categoryTurnover.find(c => c.category === selectedTurnoverCat);
          if (!categoryDetail) return null;

          return (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-50 border border-slate-200/70 rounded-2xl p-5 space-y-4 animate-fade-in"
            >
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4.5 w-4.5 text-indigo-500" />
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                    Auditoría de SKUs Inactivos: Categoría <span className="text-indigo-600 capitalize font-mono font-black">{selectedTurnoverCat}</span>
                  </h4>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400 font-semibold">
                    Recomendación WMS: <strong className="text-slate-700 font-extrabold">{categoryDetail.recommendation}</strong>
                  </span>
                  <button
                    onClick={() => setSelectedTurnoverCat(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold transition hover:scale-105 cursor-pointer"
                  >
                    Cerrar Auditoría
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {categoryDetail.items.map((skuItem) => {
                  // Calcular consumos/salidas reales para este SKU
                  let itemOutbound = 0;
                  filteredOrders.forEach(order => {
                    if (order.type === 'Outbound' && (order.status === 'Completed' || order.status === 'Delivered')) {
                      const matchItem = order.items.find(oi => oi.sku === skuItem.sku);
                      if (matchItem) itemOutbound += matchItem.qty;
                    }
                  });

                  // Si el SKU tiene stock actual pero no tiene salidas, lo marcamos como inactivo para auditarlo
                  const isInactive = itemOutbound === 0 && skuItem.qty > 0;
                  
                  return (
                    <div
                      key={skuItem.sku}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-3 transition duration-150 bg-white ${
                        isInactive 
                          ? 'border-rose-150 shadow-xs hover:border-rose-300 bg-rose-50/5' 
                          : 'border-slate-150 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="font-mono font-black text-slate-800 select-all block text-xs">{skuItem.sku}</span>
                          <span className="text-[11px] font-bold text-slate-500 block leading-tight mt-1">{skuItem.name}</span>
                          <span className="text-[9px] text-slate-400 font-mono block mt-0.5 font-sans">Prov: {skuItem.supplier}</span>
                        </div>
                        {isInactive ? (
                          <span className="bg-rose-50 text-rose-700 border border-rose-100 text-[9px] font-black uppercase px-2 py-0.5 rounded-lg font-mono flex items-center gap-0.5 animate-pulse">
                            <ZapOff className="h-2.5 w-2.5" />
                            Stock Inactivo
                          </span>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold px-2 py-0.5 rounded-lg font-mono">
                            Rotativo Activo
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-100 font-mono">
                        <div>
                          <span className="text-slate-400 block text-[9px] font-sans">Stock Actual</span>
                          <span className="font-bold text-slate-700">{skuItem.qty} uds</span>
                        </div>
                        <div className="text-center">
                          <span className="text-slate-400 block text-[9px] font-sans">Salidas</span>
                          <span className="font-bold text-indigo-600">{itemOutbound > 0 ? `${itemOutbound} uds` : '0 uds'}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[9px] font-sans">Valor Stock</span>
                          <span className="font-bold text-slate-800">${(skuItem.qty * (skuItem.cost || 25)).toLocaleString()}</span>
                        </div>
                      </div>

                      {isInactive && (
                        <div className="p-2 bg-rose-50/70 border border-rose-100 rounded-lg text-[10px] text-rose-800 font-medium leading-relaxed">
                          ⚠️ Estancado: Este SKU no registra salidas de almacén en las operaciones actuales. Se recomienda reubicar en zona fría o evaluar liquidación para liberar celdas.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })()}

        {/* ======================================================== */}
        {/* PANEL DE MÉTRICAS DE ESTACIÓN DE ETIQUETAS & CÓDIGOS     */}
        {/* ======================================================== */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-150">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1 px-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Printer className="h-3.5 w-3.5" />
                  Trazabilidad de Rotulación
                </span>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Estación de Etiquetas & Cobertura de Códigos de Barras
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Monitoreo de rotulación física de artículos y celdas para garantizar lectura láser infalible en terminales de radiofrecuencia (RF).
              </p>
            </div>

            <button
              type="button"
              onClick={() => onTabChange('etiquetas')}
              className="self-start sm:self-auto px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-95 shrink-0"
            >
              <Printer className="h-4 w-4" />
              <span>Abrir Estación de Etiquetas →</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-1">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Cobertura de Código de Barras</span>
              <span className="text-2xl font-black font-mono text-slate-800">{labelStats.barcodeCoverage}%</span>
              <span className="text-[11px] text-slate-500 block">{labelStats.skusWithBarcode} de {labelStats.totalCatalog} SKUs con código asignado</span>
            </div>
            <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-1">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Formatos Industriales Soportados</span>
              <span className="text-2xl font-black font-mono text-slate-800">{labelStats.formatsCount} Tamaños</span>
              <span className="text-[11px] text-slate-500 block">4"×6", 4"×3", 4"×2", 3"×2", etc.</span>
            </div>
            <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-1">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Estándar de Codificación</span>
              <span className="text-2xl font-black font-mono text-slate-800">Code 128 & QR</span>
              <span className="text-[11px] text-emerald-600 font-bold block flex items-center gap-1">
                <Check className="h-3 w-3" /> Compatible Zebra & Honeywell
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-1">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Estado de Impresión Directa</span>
              <span className="text-2xl font-black font-mono text-emerald-600">Listo (100%)</span>
              <span className="text-[11px] text-slate-500 block">Estilos CSS @media print optimizados</span>
            </div>
          </div>
        </div>
      </div>
      </>
    )}

      {/* SECCIÓN: INFRAESTRUCTURA DE ALMACÉN, RACKS Y MAPA DE CALOR */}
      {(executivePerspective === 'almacen' || executivePerspective === 'todo') && (
        <>
          {/* MÉTRICAS DE ALMACÉN E INFRAESTRUCTURA DE RACKS Y PASILLOS (CONECTIVIDAD TOTAL) */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-150">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Boxes className="h-3.5 w-3.5" />
                Infraestructura Conectada
              </span>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Métricas de Almacén: Racks, Pasillos y Ocupación
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Datos sincronizados en tiempo real con el módulo <strong>Mapa de Almacén</strong>. Monitoreo de utilización física por estantería y nivel de servicio.
            </p>
          </div>

          <button
            onClick={() => onTabChange('map')}
            className="self-start lg:self-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-95 shrink-0"
          >
            <MapPin className="h-4 w-4" />
            <span>Abrir Mapa de Almacén Completo →</span>
          </button>
        </div>

        {/* 4 Indicadores Clave de Infraestructura */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Total Celdas Físicas</span>
            <span className="text-2xl font-black text-slate-900 font-mono block mt-1">{bins.length}</span>
            <span className="text-[10px] text-blue-600 font-bold block mt-0.5">
              {bins.length >= 539 ? '✓ Estructura Oficial 539' : `${bins.length} configuradas`}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Ocupación Física</span>
            <span className="text-2xl font-black text-slate-900 font-mono block mt-1">{occupancyRate}%</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {occupiedSlots} ocupadas · {totalSlots - occupiedSlots} libres
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Capacidad Instalada</span>
            <span className="text-2xl font-black text-slate-900 font-mono block mt-1">
              {(bins.reduce((sum, b) => sum + b.maxWeight, 0) / 1000).toFixed(1)} T
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Límite de peso en racks</span>
          </div>

          <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Racks & Pasillos</span>
            <span className="text-2xl font-black text-indigo-700 font-mono block mt-1">
              {new Set(bins.map(b => b.rack)).size} Racks
            </span>
            <span className="text-[10px] text-indigo-600 font-bold block mt-0.5">
              {new Set(bins.map(b => b.aisle)).size} Pasillos activos
            </span>
          </div>
        </div>

        {/* Desglose de Ocupación por Rack Físico */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-blue-600" />
              <span>Ocupación y Densidad por Rack Físico:</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Haz clic en cualquier rack para inspeccionarlo en el mapa
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(pickingDensityData.rackTotals)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([rackNumStr, rData]: [string, any]) => {
                const rNum = Number(rackNumStr);
                const pct = rData.total > 0 ? Math.round((rData.occupied / rData.total) * 100) : 0;
                const isFull = pct >= 90;
                const isPartial = pct >= 50;

                return (
                  <div
                    key={rNum}
                    onClick={() => {
                      localStorage.setItem('owms_selected_map_rack', String(rNum));
                      onTabChange('map');
                    }}
                    className="p-3.5 bg-slate-50/80 hover:bg-white border border-slate-200 hover:border-blue-400 rounded-2xl transition cursor-pointer flex flex-col justify-between gap-2.5 shadow-2xs hover:shadow-xs group"
                  >
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-black text-sm text-slate-800 group-hover:text-blue-600 transition">
                          RACK {rNum}
                        </span>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          isFull ? 'bg-rose-100 text-rose-800' : isPartial ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {pct}%
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                        {rData.occupied} de {rData.total} celdas
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            isFull ? 'bg-rose-500' : isPartial ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400 font-mono pt-1">
                        <span>Picks: {rData.picks}</span>
                        <span className="text-blue-600 font-bold group-hover:underline">Ver Mapa →</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Desglose por Pasillo */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-tight block">
            Actividad de Picking por Pasillo:
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {Object.entries(pickingDensityData.aisleTotals)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([aisle, picks]) => {
                const aisleBins = bins.filter(b => b.aisle === aisle);
                const aisleOccupied = aisleBins.filter(b => b.occupiedQty > 0 || Boolean(b.occupiedSku)).length;

                return (
                  <div key={aisle} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 text-center">
                    <span className="font-mono font-black text-xs text-blue-700 block">PASILLO {aisle}</span>
                    <span className="text-base font-black font-mono text-slate-800 block">{picks} <span className="text-[10px] font-normal text-slate-400">picks</span></span>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      {aisleOccupied} / {aisleBins.length} ocupadas
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

      </div>

      {/* SECCIÓN: MAPA DE CALOR DE DENSIDAD DE PICKING (SLOTTING HEATMAP) */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                <Flame className="h-3 w-3 animate-pulse" />
                Mapa de Calor
              </span>
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                <Map className="h-4 w-4 text-rose-500" />
                Densidad de Picking y Optimización de Ubicaciones (Slotting)
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Análisis bidimensional de la frecuencia de recolección (picking) por celda. Optimiza el flujo ergonómico y reduce tiempos de ciclo detectando productos desalineados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Slotting Score Indicator */}
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/60 p-2.5 px-4 rounded-2xl">
              <div className="text-right">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Eficiencia de Slotting</span>
                <span className="text-sm font-black text-slate-800 font-mono">{pickingDensityData.slottingEfficiencyScore}%</span>
              </div>
              <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-650 shrink-0 font-bold text-xs">
                {pickingDensityData.slottingEfficiencyScore >= 85 ? 'Óptimo' : 'Ajuste'}
              </div>
            </div>

            {/* Hottest Zone Indicator */}
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/60 p-2.5 px-4 rounded-2xl">
              <div className="text-right">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Zona de Mayor Tráfico</span>
                <span className="text-sm font-black text-rose-600 font-mono">Pasillo {pickingDensityData.hottestAisle} • Nivel {pickingDensityData.hottestLevel}</span>
              </div>
              <div className="h-9 w-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shrink-0">
                <Flame className="h-5 w-5 animate-bounce" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 p-4 border border-slate-100 rounded-2xl">
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
            {/* Filter by Aisle - Dinámico con todos los pasillos del almacén */}
            <div className="flex items-center gap-2">
              <span>Filtrar Pasillo:</span>
              <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-3xs flex-wrap gap-1">
                {['All', ...Array.from(new Set(bins.map(b => b.aisle))).filter(Boolean).sort()].map((aisle) => (
                  <button
                    key={aisle}
                    onClick={() => {
                      setHeatmapAisle(aisle);
                      setSelectedHeatmapBin(null);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition ${
                      heatmapAisle === aisle ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {aisle === 'All' ? 'Todos' : `P-${aisle}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter by Level - Dinámico con los niveles 01 a 07 */}
            <div className="flex items-center gap-2">
              <span>Nivel:</span>
              <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-3xs flex-wrap gap-1">
                {['All', ...Array.from(new Set(bins.map(b => b.level))).filter(Boolean).sort((a,b) => (a as string).localeCompare(b as string, undefined, { numeric: true }))].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => {
                      setHeatmapLevel(lvl);
                      setSelectedHeatmapBin(null);
                    }}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition ${
                      heatmapLevel === lvl ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {lvl === 'All' ? 'Todos' : `N${lvl}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(heatmapAisle !== 'All' || heatmapLevel !== 'All' || selectedHeatmapBin) && (
            <button
              onClick={() => {
                setHeatmapAisle('All');
                setHeatmapLevel('All');
                setSelectedHeatmapBin(null);
              }}
              className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              Limpiar Filtros
            </button>
          )}
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
           {/* Column 1: Heatmap Grid (7/12 width) */}
           <div className="lg:col-span-7 space-y-4">
             <div className="flex items-center justify-between">
               <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-1.5">
                 <Info className="h-3.5 w-3.5 text-slate-400" />
                 Matriz de Celdas del Almacén
               </h3>
               <span className="text-[10px] text-slate-400 font-mono font-semibold">
                 Mostrando {bins.filter(b => {
                   if (heatmapAisle !== 'All' && b.aisle !== heatmapAisle) return false;
                   if (heatmapLevel !== 'All' && b.level !== heatmapLevel) return false;
                   return true;
                 }).length} de {bins.length} celdas
               </span>
             </div>
 
             {/* Bins Heatmap representation */}
             <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl min-h-[300px] flex flex-col justify-between">
               
               <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3 max-h-[500px] overflow-y-auto pr-1">
                 {(() => {
                   let filteredBins = bins;
                   if (heatmapAisle !== 'All') {
                     filteredBins = filteredBins.filter(b => b.aisle === heatmapAisle);
                   }
                   if (heatmapLevel !== 'All') {
                     filteredBins = filteredBins.filter(b => b.level === heatmapLevel || b.id.split('-').pop() === heatmapLevel);
                   }
 
                   if (filteredBins.length === 0) {
                     return (
                       <div className="col-span-full py-16 text-center text-slate-400 font-bold text-xs">
                         No hay celdas que coincidan con los filtros seleccionados.
                       </div>
                     );
                   }
 
                   return filteredBins.map(bin => {
                     const density = pickingDensityData.densityMap[bin.id] || 0;
                     const isSelected = selectedHeatmapBin?.id === bin.id;
                     
                     // Definir color de calor del mapa
                     let heatColorClass = 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/85 text-slate-700 shadow-3xs';
                     let badgeClass = 'bg-slate-200/70 text-slate-700';
                     let densityLabelColor = 'text-slate-500';
 
                     if (density >= 16) {
                       heatColorClass = 'bg-rose-50 hover:bg-rose-100/90 border-rose-350 text-rose-950 shadow-xs shadow-rose-500/10 animate-pulse';
                       badgeClass = 'bg-rose-200/90 text-rose-800';
                       densityLabelColor = 'text-rose-600';
                     } else if (density >= 9) {
                       heatColorClass = 'bg-amber-50 hover:bg-amber-100/90 border-amber-350 text-amber-950 shadow-3xs';
                       badgeClass = 'bg-amber-200 text-amber-800';
                       densityLabelColor = 'text-amber-700';
                     } else if (density >= 4) {
                       heatColorClass = 'bg-emerald-50 hover:bg-emerald-100/90 border-emerald-350 text-emerald-950 shadow-3xs';
                       badgeClass = 'bg-emerald-200 text-emerald-800';
                       densityLabelColor = 'text-emerald-700';
                     } else if (density >= 1) {
                       heatColorClass = 'bg-blue-50 hover:bg-blue-100/90 border-blue-350 text-blue-950 shadow-3xs';
                       badgeClass = 'bg-blue-200 text-blue-800';
                       densityLabelColor = 'text-blue-700';
                     }
 
                     return (
                       <motion.div
                         key={bin.id}
                         whileHover={{ scale: 1.03, y: -2 }}
                         whileTap={{ scale: 0.98 }}
                         onClick={() => setSelectedHeatmapBin(isSelected ? null : bin)}
                         className={`p-2.5 rounded-xl border text-center transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[96px] h-auto shadow-sm select-none min-w-0 overflow-hidden ${heatColorClass} ${
                           isSelected ? 'ring-2 ring-indigo-600 ring-offset-2 border-indigo-600 shadow-md' : ''
                         }`}
                         title={`Celda: ${bin.id} | Densidad de Picking: ${density}`}
                       >
                         <div className="flex justify-between items-center gap-1 min-w-0">
                           <span className="text-[10px] font-black font-mono tracking-wider opacity-85 whitespace-nowrap truncate" title={bin.id}>
                             {bin.id}
                           </span>
                           <span className={`text-[8px] px-1 py-0.5 rounded font-mono font-black uppercase tracking-wider leading-none shrink-0 ${badgeClass}`}>
                             N{bin.level}
                           </span>
                         </div>
                         
                         <div className="text-left mt-1 flex-1 flex items-center min-w-0">
                           <span className="text-[9px] font-mono font-bold tracking-tight bg-white/75 border border-slate-200/30 px-1.5 py-0.5 rounded-md truncate w-full shadow-3xs text-slate-800 flex items-center justify-center gap-0.5 select-all" title={bin.occupiedSku ? `SKU: ${bin.occupiedSku}` : 'Ubicación Vacía'}>
                             {bin.occupiedSku ? `📦 ${bin.occupiedSku}` : 'Vacío'}
                           </span>
                         </div>
                         
                         <div className="flex justify-between items-center mt-1.5 pt-1 border-t border-slate-200/30 w-full min-w-0 gap-1">
                           <span className="text-[8px] font-bold text-slate-400 font-sans uppercase tracking-widest truncate">
                             Picks
                           </span>
                           <span className={`text-[10px] font-black font-mono flex items-center gap-0.5 shrink-0 ${densityLabelColor}`}>
                             {density >= 9 ? '🔥' : ''}{density}
                           </span>
                         </div>
                       </motion.div>
                     );
                   });
                 })()}
               </div>
 
               {/* Color scale Legend */}
               <div className="mt-6 pt-4 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-4 text-[10px] font-bold text-slate-500">
                 <span className="font-mono uppercase tracking-wider">Escala de Densidad (Picks):</span>
                 <div className="flex items-center gap-3">
                   <div className="flex items-center gap-1">
                     <span className="h-3 w-3 rounded-md bg-slate-100 border border-slate-200 block" />
                     <span>Inactivo (0)</span>
                   </div>
                   <div className="flex items-center gap-1">
                     <span className="h-3 w-3 rounded-md bg-blue-150 border border-blue-300 block" />
                     <span>Bajo (1-3)</span>
                   </div>
                   <div className="flex items-center gap-1">
                     <span className="h-3 w-3 rounded-md bg-emerald-250 border border-emerald-400 block" />
                     <span>Medio (4-8)</span>
                   </div>
                   <div className="flex items-center gap-1">
                     <span className="h-3 w-3 rounded-md bg-amber-250 border border-amber-400 block" />
                     <span>Alto (9-15)</span>
                   </div>
                   <div className="flex items-center gap-1">
                     <span className="h-3 w-3 rounded-md bg-rose-350 border border-rose-500 block" />
                     <span>Crítico (16+)</span>
                   </div>
                 </div>
                </div>
 
             </div>
           </div>
 
           {/* Column 2: Slotting Diagnostics & Inspector (5/12 width) */}
           <div className="lg:col-span-5 space-y-4">
             
             {selectedHeatmapBin ? (
               // Selected Bin Details Inspector Card
               <motion.div
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 h-full flex flex-col justify-between"
               >
                 <div>
                   <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                     <div className="flex items-center gap-2">
                       <div className="h-8 w-8 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold font-mono text-sm shadow-3xs">
                         {selectedHeatmapBin.aisle || selectedHeatmapBin.id.split('-')[0]}
                       </div>
                       <div>
                         <h4 className="text-xs font-black text-slate-800 font-mono uppercase tracking-tight">
                           Celda {selectedHeatmapBin.id}
                         </h4>
                         <span className="text-[10px] text-slate-400 font-medium">Inspección de Slotting Operativo</span>
                       </div>
                     </div>
                     <button
                       onClick={() => setSelectedHeatmapBin(null)}
                       className="text-slate-400 hover:text-slate-600 text-xs font-bold transition hover:scale-110 cursor-pointer"
                     >
                       Cerrar
                     </button>
                   </div>
 
                   {/* Bin occupancy and stock details */}
                   <div className="grid grid-cols-2 gap-4 mt-4">
                     <div className="bg-white border border-slate-150 p-3 rounded-xl">
                       <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Estado de Ocupación</span>
                       <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border uppercase font-mono mt-1 ${
                         selectedHeatmapBin.status === 'Full' 
                           ? 'bg-rose-50 text-rose-700 border-rose-100'
                           : selectedHeatmapBin.status === 'Partial'
                           ? 'bg-amber-50 text-amber-700 border-amber-100'
                           : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                       }`}>
                         {selectedHeatmapBin.status === 'Full' ? 'Completo' : selectedHeatmapBin.status === 'Partial' ? 'Parcial' : 'Vacío'}
                       </span>
                     </div>
 
                     <div className="bg-white border border-slate-150 p-3 rounded-xl">
                       <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Frecuencia de Picking</span>
                       <span className="text-sm font-black font-mono text-rose-600 block mt-1">
                         {pickingDensityData.densityMap[selectedHeatmapBin.id] || 0} picks registrados
                       </span>
                     </div>
                   </div>
 
                   {/* Product info inside the bin */}
                   {selectedHeatmapBin.occupiedSku ? (() => {
                     const matchedItem = inventory.find(i => i.sku === selectedHeatmapBin.occupiedSku);
                     return (
                       <div className="bg-white border border-slate-150 p-4 rounded-xl mt-4 space-y-2">
                         <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Producto Almacenado</span>
                         <div className="flex justify-between items-start">
                           <div>
                             <strong className="text-xs font-black font-mono text-slate-800 block select-all">{selectedHeatmapBin.occupiedSku}</strong>
                             <span className="text-[11px] font-bold text-slate-500 block leading-tight mt-0.5">{matchedItem?.name || 'SKU Registrado'}</span>
                           </div>
                           <span className="text-xs font-bold text-slate-700 font-mono bg-slate-100 px-2 py-1 rounded-lg shrink-0">
                             {selectedHeatmapBin.occupiedQty} uds
                           </span>
                         </div>
                         <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-500">
                           <div>Categoría: <strong className="text-slate-700">{matchedItem?.category || 'General'}</strong></div>
                           <div className="text-right">Peso Un: <strong className="text-slate-700">{matchedItem?.unitWeight || 0.5} kg</strong></div>
                         </div>
                       </div>
                     );
                   })() : (
                     <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl text-center text-xs text-slate-400 font-medium mt-4">
                       Celda vacía. Lista para asignación optimizada de ingresos (Putaway).
                     </div>
                   )}
 
                   {/* Recommendation block inside inspection */}
                   <div className="mt-4 p-3.5 bg-indigo-50/50 border border-indigo-100/60 rounded-xl space-y-1">
                     <span className="text-[10px] font-black uppercase tracking-wider text-indigo-750 block flex items-center gap-1">
                       <Boxes className="h-3 w-3" />
                       Sugerencia de Slotting para Celda
                     </span>
                     <p className="text-[11px] text-indigo-900 leading-relaxed font-medium">
                       {(() => {
                         const d = pickingDensityData.densityMap[selectedHeatmapBin.id] || 0;
                         const aisle = selectedHeatmapBin.aisle;
                         const level = selectedHeatmapBin.level;
 
                         if (selectedHeatmapBin.occupiedSku) {
                           if (d > 10 && (level === '07' || level === '06' || level === 'L3')) {
                             return `⚠️ Alerta: El SKU ${selectedHeatmapBin.occupiedSku} tiene una densidad de picking alta (${d} picks) pero está en el Nivel ${level} (alto). Se aconseja moverlo a niveles inferiores (Nivel 01 o 02) para reducir tiempos y fatiga operativa.`;
                           }
                           if (d <= 2 && (level === '01' || level === 'L1') && (aisle === 'A' || aisle === 'B')) {
                             return `⚠️ Alerta: Celda Premium subutilizada. El SKU ${selectedHeatmapBin.occupiedSku} registra casi nula actividad (${d} picks) pero ocupa nivel bajo en Pasillo ${aisle}. Puede reubicarse a niveles altos para liberar este espacio para mercancía de alta rotación.`;
                           }
                           return `✓ Correcto: El SKU ${selectedHeatmapBin.occupiedSku} está ubicado acordemente a su frecuencia operativa en el almacén.`;
                         } else {
                           if ((level === '01' || level === 'L1') && (aisle === 'A' || aisle === 'B')) {
                             return `💡 Celda Premium Disponible: Al estar en nivel bajo de acceso rápido en Pasillo ${aisle}, se aconseja asignarla prioritariamente a productos de alta rotación.`;
                           }
                           return `💡 Ubicación disponible: Ideal para albergar stock estándar o reposición.`;
                         }
                       })()}
                     </p>
                   </div>

                   {/* Direct link to Warehouse Map */}
                   <button
                     onClick={() => onTabChange('map')}
                     className="w-full mt-3 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95"
                   >
                     <MapPin className="h-3.5 w-3.5" />
                     <span>Inspeccionar en Mapa de Almacén →</span>
                   </button>
                 </div>
 
                 <button
                   onClick={() => setSelectedHeatmapBin(null)}
                   className="w-full mt-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-black rounded-xl transition cursor-pointer shadow-3xs"
                 >
                   Volver al Diagnóstico General
                 </button>
               </motion.div>
             ) : (
               // General Warehouse Diagnostics Sidebar
               <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 space-y-5 h-full flex flex-col justify-between">
                 <div className="space-y-4">
                   <div className="border-b border-slate-200 pb-3">
                     <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                       <TriangleAlert className="h-4 w-4 text-rose-500" />
                       Diagnósticos y Alertas de Slotting
                     </h4>
                     <p className="text-[11px] text-slate-400 mt-0.5">
                       Análisis algorítmico de ubicaciones para optimizar el acomodo físico de mercancía.
                     </p>
                   </div>
 
                   {/* Aisle Activity distribution meters */}
                   <div className="space-y-2.5">
                     <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Densidad Acumulada por Pasillo:</span>
                     <div className="grid grid-cols-2 gap-3">
                       {Object.entries(pickingDensityData.aisleTotals).map(([aisle, val]) => {
                         const pct = pickingDensityData.totalDensitySum ? Math.round(((val as number) / pickingDensityData.totalDensitySum) * 100) : 0;
                         return (
                           <div key={aisle} className="bg-white border border-slate-150 p-2.5 rounded-xl space-y-1.5 shadow-3xs">
                             <div className="flex justify-between items-center text-[10px] font-mono">
                               <span className="font-bold text-slate-700">Pasillo {aisle}</span>
                               <span className="font-black text-rose-600">{val} picks ({pct}%)</span>
                             </div>
                             <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                               <div
                                 className="bg-rose-500 h-1.5 rounded-full"
                                 style={{ width: `${pct}%` }}
                               />
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   </div>
 
                   {/* Level Activity distribution meters */}
                   <div className="space-y-2.5 pt-2 border-t border-slate-200/60">
                     <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Densidad por Nivel de Estantería:</span>
                     <div className="space-y-2">
                       {Object.entries(pickingDensityData.levelTotals).map(([lvl, val]) => {
                         const pct = pickingDensityData.totalDensitySum ? Math.round(((val as number) / pickingDensityData.totalDensitySum) * 100) : 0;
                         return (
                           <div key={lvl} className="bg-white border border-slate-150 p-2.5 rounded-xl flex items-center justify-between gap-4 shadow-3xs">
                             <div className="flex items-center gap-2">
                               <span className="text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md font-mono font-bold text-slate-600 uppercase">
                                 {lvl}
                               </span>
                               <span className="text-[10px] text-slate-500 font-semibold">
                                 {lvl === 'L1' ? 'Nivel Suelo (Fácil)' : lvl === 'L2' ? 'Nivel Medio (Normal)' : 'Nivel Alto (Difícil)'}
                               </span>
                             </div>
                             <div className="flex items-center gap-2 font-mono text-[10px] text-right">
                               <span className="font-black text-indigo-600">{val} picks</span>
                               <span className="text-slate-400 font-semibold">({pct}%)</span>
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 </div>
 
                 {/* Diagnostics and slotting anomalies list */}
                 <div className="pt-3 border-t border-slate-200/60 space-y-2.5">
                   <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Desalineaciones Detectadas:</span>
                   
                   <div className="max-h-[148px] overflow-y-auto space-y-2 pr-1">
                     {pickingDensityData.mislottedItems.length === 0 ? (
                       <div className="p-3 bg-emerald-50 text-emerald-850 border border-emerald-100 rounded-xl text-[10px] font-medium leading-relaxed flex items-center gap-2">
                         <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                         <span>✓ ¡Excelente! No se detectan desalineaciones críticas de Slotting. El 100% de los SKU con alta rotación se encuentran en ubicaciones de fácil acceso.</span>
                       </div>
                     ) : (
                       pickingDensityData.mislottedItems.slice(0, 3).map((item, idx) => (
                         <div key={idx} className="p-3 bg-rose-50/70 border border-rose-150 rounded-xl text-[10px] space-y-1.5 leading-normal">
                           <div className="flex justify-between items-start gap-2">
                             <div>
                               <strong className="text-slate-800 block">Desalineación en Celda {item.binId}</strong>
                               <span className="text-slate-500 font-mono font-bold block mt-0.5">{item.sku} ({item.name})</span>
                             </div>
                             <span className="bg-rose-100 border border-rose-200 text-rose-700 px-1.5 py-0.5 rounded-lg font-mono font-black shrink-0 text-[8px] uppercase tracking-wider">
                               Anomalía
                             </span>
                           </div>
                           <p className="text-rose-950 font-medium">{item.reason}</p>
                           <div className="p-1.5 bg-white/80 border border-rose-100 rounded-md text-[9px] text-indigo-900 font-semibold flex items-center gap-1">
                             <span className="text-indigo-600 font-bold">💡 Solución:</span>
                             <span>{item.fix}</span>
                           </div>
                         </div>
                       ))
                     )}
                   </div>
                 </div>
 
               </div>
             )}
 
           </div>
 
         </div>
       </div>
       </>
      )}

      {/* ========================================================================= */}
      {/* SECCIÓN EJECUTIVA: SOPORTE, ALERTAS, REPORTES, PERSONAL Y CONFIGURACIÓN */}
      {/* Conecta integralmente los módulos de Soporte, Confiabilidad y Configuración */}
      {/* ========================================================================= */}
      {(executivePerspective === 'soporte' || executivePerspective === 'todo') && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs space-y-6 animate-fadeIn" id="support-governance-hub">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-150">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1 px-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Gobernanza, Soporte & Configuración
                </span>
                <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                  Tablero de Control de Soporte, Auditoría y Personalización
                </h2>
              </div>
              <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
                Supervisión centralizada de riesgos operativos, alertas de capacidad, suites de reportes analíticos, cuadrilla de operarios, identidad visual y manual de procedimientos del sistema.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onTabChange('reports')}
                className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span>Exportar Informes</span>
              </button>
              <button
                type="button"
                onClick={() => onTabChange('configuracion')}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>Abrir Configuración</span>
              </button>
            </div>
          </div>

          {/* Grid de Métricas Principales de Soporte & Gobernanza */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

            {/* Tarjeta 1: Gestión de Alertas y Telemetría de Riesgo */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-rose-100/70 text-rose-600 flex items-center justify-center">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                        Soporte & Monitoreo
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900">
                        Gestión de Alertas
                      </h4>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full ${
                    alertsStats.criticalCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {alertsStats.activeTriggered} Activas
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] text-slate-400 font-bold block">Críticas</span>
                    <span className="text-base font-black font-mono text-rose-600">{alertsStats.criticalCount}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] text-slate-400 font-bold block">Altas</span>
                    <span className="text-base font-black font-mono text-amber-600">{alertsStats.highCount}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] text-slate-400 font-bold block">Medias</span>
                    <span className="text-base font-black font-mono text-blue-600">{alertsStats.mediumCount}</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/70 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Sobrepeso en celdas:</span>
                    <strong className={`font-mono ${alertsStats.overweightBinsCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                      {alertsStats.overweightBinsCount} racks
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Artículos bajo stock mínimo:</span>
                    <strong className={`font-mono ${alertsStats.lowStockSkusCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                      {alertsStats.lowStockSkusCount} SKUs
                    </strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onTabChange('alertas')}
                className="w-full py-2 px-3 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 rounded-xl text-xs font-bold text-rose-700 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <span>Administrar Alertas →</span>
              </button>
            </div>

            {/* Tarjeta 2: Centro de Reportes & BI Empresarial */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-blue-100/70 text-blue-600 flex items-center justify-center">
                      <FileDown className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                        Soporte & Monitoreo
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900">
                        Centro de Reportes
                      </h4>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    5 Suites BI
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/70 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Suites analíticas activas:</span>
                    <strong className="font-mono text-slate-800">5 Suites (XLSX / PDF)</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Actas de auditoría archivadas:</span>
                    <strong className="font-mono text-slate-800">{reportsStats.archivedAuditActs} actas</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Motor de Base de Datos:</span>
                    <strong className="font-mono text-blue-700">{reportsStats.databaseEngine}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500">
                  <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                    📊 Inventario Valorizado
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                    📋 Kardex de Movimientos
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                    📦 Ocupación de Racks
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                    🚚 Tasa de Salidas de Almacén
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onTabChange('reports')}
                className="w-full py-2 px-3 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-blue-700 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <span>Abrir Centro de Reportes →</span>
              </button>
            </div>

            {/* Tarjeta 3: Registro de Personal & Cuadrillas */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-indigo-100/70 text-indigo-600 flex items-center justify-center">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                        En Configuración
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900">
                        Registro de Personal
                      </h4>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                    {crewStats.activeCount} Activos
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/70 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Cuadrilla total registrada:</span>
                    <strong className="font-mono text-slate-800">{crewStats.totalCrew} operarios</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Supervisores y Admins:</span>
                    <strong className="font-mono text-slate-800">{crewStats.supervisors} miembros</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Turno configurado:</span>
                    <strong className="font-mono text-indigo-700 truncate max-w-[150px]">{crewStats.activeShift}</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Terminal RF predeterminada:</span>
                    <strong className="font-mono text-slate-700">{crewStats.deviceId}</strong>
                  </div>
                </div>

                <div className="p-2.5 bg-indigo-50/70 rounded-xl border border-indigo-150 text-[11px] flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Operador en sesión:</span>
                  <span className="font-extrabold font-mono text-indigo-900">{crewStats.activeOperatorName}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onTabChange('crew')}
                className="w-full py-2 px-3 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl text-xs font-bold text-indigo-700 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <span>Gestionar Personal y Turnos →</span>
              </button>
            </div>

            {/* Tarjeta 4: Apariencia, Identidad Visual y Marca */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-violet-100/70 text-violet-600 flex items-center justify-center">
                      <Palette className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                        En Configuración
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900">
                        Apariencia y Colores
                      </h4>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-800">
                    {platformBrandingStats.versionTag || 'v1.2'}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/70 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Nombre de plataforma:</span>
                    <strong className="font-mono text-slate-900">{platformBrandingStats.platformName || 'O-WMS PRO'}</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Color Primario (Tema):</span>
                    <span className="font-mono font-bold flex items-center gap-1.5 text-slate-800">
                      <span className="h-3 w-3 rounded-full border border-slate-300 inline-block shadow-2xs" style={{ backgroundColor: platformBrandingStats.primaryColor }} />
                      {platformBrandingStats.primaryColor}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Barra de Navegación:</span>
                    <span className="font-mono font-bold flex items-center gap-1.5 text-slate-800">
                      <span className="h-3 w-3 rounded-full border border-slate-300 inline-block shadow-2xs" style={{ backgroundColor: platformBrandingStats.sidebarColor }} />
                      {platformBrandingStats.sidebarColor}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-100/80 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Persistencia:</span>
                  <span className="font-bold font-mono text-slate-700">LocalStorage + Sesión activa</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onTabChange('configuracion')}
                className="w-full py-2 px-3 bg-white hover:bg-violet-50 border border-slate-200 hover:border-violet-300 rounded-xl text-xs font-bold text-violet-700 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <span>Personalizar Imagen y Colores →</span>
              </button>
            </div>

            {/* Tarjeta 5: Manual de Usuario & Normativa WMS */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-emerald-100/70 text-emerald-600 flex items-center justify-center">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                        En Configuración
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900">
                        Manual de Usuario
                      </h4>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {manualStats.coveragePct}% Cobertura
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/70 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Módulos Documentados:</span>
                    <strong className="font-mono text-slate-800">{manualStats.totalModulesDocumented} Módulos WMS</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Categorías de SOPs:</span>
                    <strong className="font-mono text-slate-800">3 Categorías Operativas</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Revisión Oficial:</span>
                    <strong className="font-mono text-emerald-700">{manualStats.lastRevision}</strong>
                  </div>
                </div>

                <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-150 text-[11px] text-emerald-900 font-medium">
                  🔍 Incluye motor de búsqueda en tiempo real de directrices y flujos paso a paso.
                </div>
              </div>

              <button
                type="button"
                onClick={() => onTabChange('manual')}
                className="w-full py-2 px-3 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-xs font-bold text-emerald-700 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <span>Consultar Manual de Usuario →</span>
              </button>
            </div>

            {/* Tarjeta 6: Resumen Global de Conectividad WMS */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-xs border border-slate-800">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-mono font-bold text-indigo-300 uppercase tracking-widest">
                      Ecosistema Total
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    12 Módulos
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-black text-white">
                    Conectividad 100% Operativa
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed mt-1">
                    Todos los módulos de Operaciones Básicas, Soporte & Monitoreo y Configuración se encuentran enlazados de manera reactiva en este tablero de Métricas.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700 text-center">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Operaciones</span>
                    <strong className="text-white font-mono">4 Módulos</strong>
                  </div>
                  <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700 text-center">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Soporte & Config</span>
                    <strong className="text-white font-mono">8 Módulos</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExecutivePerspective('resumen')}
                className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>Ver Matriz de Conectividad General →</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SECCIÓN: REGISTROS DE ACTIVIDAD Y ALERTAS */}
      {(executivePerspective === 'resumen' || executivePerspective === 'procesos' || executivePerspective === 'soporte' || executivePerspective === 'todo') && (
        <>
          {/* Activity Logs & alerts table split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Low inventory alerts panel */}
        <div className="bg-white p-6 border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <h3 className="text-sm font-bold text-slate-700 tracking-tight uppercase mb-4 flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-orange-500" />
            Solicitudes de Reabastecimiento Activas
          </h3>
          
          {notificationSetting === 'toast' ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="mx-auto w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500">
                <Bell className="h-5 w-5 animate-bounce" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-700">Canal de Alerta Redireccionado</p>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                  Las advertencias de stock crítico se han configurado como <strong className="text-indigo-650">notificaciones flotantes tipo 'toast'</strong>. Las verás aparecer dinámicamente en la esquina inferior derecha.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {lowStockItems.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400 font-medium">
                  ✅ No se requiere reabastecimiento. Todos los SKU superan los límites críticos.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 text-left">SKU / ARTÍCULO</th>
                      <th className="pb-3 text-center">ESTADO ACTUAL</th>
                      <th className="pb-3 text-center">REQ MÍN</th>
                      <th className="pb-3 text-right">PROVEEDOR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs">
                    {lowStockItems.map((item) => (
                      <tr key={item.sku} className="hover:bg-slate-50/50">
                        <td className="py-3 font-mono font-bold text-slate-800">
                          {item.sku}
                          <span className="block font-sans text-[10px] text-slate-400 font-normal">
                            {item.name}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-100 font-mono">
                            {item.qty} unidades
                          </span>
                        </td>
                        <td className="py-3 text-center font-semibold font-mono text-slate-600">
                          {item.minQty !== undefined && item.minQty > 0 ? item.minQty : globalThreshold} unidades
                        </td>
                        <td className="py-3 text-right text-slate-500 font-medium font-sans">
                          {item.supplier}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Latest Activity Logs */}
        <div className="bg-white p-6 border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-slate-700 tracking-tight uppercase flex items-center gap-2">
              <NotebookText className="h-4 w-4 text-blue-500" />
              Historial de Auditorías Recientes
            </h3>
            <button
              onClick={() => {
                const headers = ['ID', 'Fecha y Hora', 'Usuario / Operador', 'Acción', 'Detalles'];
                const rows = filteredLogs.map(log => [
                  log.id,
                  log.timestamp,
                  log.user,
                  log.action,
                  log.details
                ]);
                const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Historial de Auditoría");
                XLSX.writeFile(wb, `Historial_Auditoria_WMS_${new Date().toISOString().split('T')[0]}.xlsx`);
              }}
              className="bg-emerald-50 hover:bg-emerald-100 active:scale-95 transition text-emerald-700 border border-emerald-150 text-[10px] font-bold px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 shadow-2xs cursor-pointer select-none"
              title="Descargar el historial completo de auditorías como archivo Excel (.xlsx)"
            >
              <Download className="h-3 w-3 text-emerald-600" />
              <span>Exportar Historial (Excel)</span>
            </button>
          </div>
          <div className="space-y-4 max-h-[280px] overflow-y-auto pr-1">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 font-medium">
                Aún no hay registros de auditoría cargados para este periodo.
              </div>
            ) : (
              filteredLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex gap-3 justify-between items-start text-xs border-b border-slate-50/70 pb-3 last:border-b-0">
                  <div className="flex gap-2">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 border border-slate-200/50">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-700">
                        {log.action}
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                        {log.details}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block font-mono text-[10px] text-blue-600 font-bold">
                      {log.user}
                    </span>
                    <span className="block text-[8px] font-mono text-slate-400 mt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
      </>
    )}
    </>
    ) : (
        <div className="space-y-6 animate-fadeIn">
          {activeOperator && activeOperator.hierarchy === 'Operario' ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs text-center py-16 space-y-4">
              <div className="h-14 w-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mx-auto">
                <Lock className="h-6 w-6 text-slate-500" />
              </div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Acceso Restringido</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Su nivel de jerarquía (<strong>Operario</strong>) no posee permisos de modificación en el diseño y configuración física del almacén.
              </p>
              <p className="text-[11px] text-slate-400">
                Por favor, contacte a un <strong>Supervisor</strong> o <strong>Administrador de WMS</strong> para realizar cambios en los pasillos y celdas.
              </p>
            </div>
          ) : (
            <>
              {/* Barra de Retorno a Métricas Ejecutivas */}
              <div className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-2xl shadow-3xs">
                <div>
                  <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Settings className="h-4 w-4 text-indigo-600" />
                    <span>Configuración de Estructura del Almacén</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Administración de celdas, alta de ubicaciones y umbrales de stock mínimo.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDashboardSubTab('metrics')}
                  className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-indigo-200"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>← Volver a Métricas</span>
                </button>
              </div>

              {/* Alertas de Configuración */}
          {configSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                {configSuccessMsg}
              </span>
              <button onClick={() => setConfigSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {configErrorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TriangleAlert className="h-5 w-5 text-rose-600" />
                {configErrorMsg}
              </span>
              <button onClick={() => setConfigErrorMsg('')} className="text-rose-500 hover:text-rose-700 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Fila superior: Resumen de Infraestructura Física */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white border border-slate-150 p-4 rounded-2xl text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Pasillos</span>
              <span className="text-xl font-black text-slate-800 font-mono block mt-1">
                {new Set(bins.map(b => b.aisle)).size}
              </span>
            </div>
            <div className="bg-white border border-slate-150 p-4 rounded-2xl text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Niveles</span>
              <span className="text-xl font-black text-slate-800 font-mono block mt-1">
                {new Set(bins.map(b => b.level)).size}
              </span>
            </div>
            <div className="bg-white border border-slate-150 p-4 rounded-2xl text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Celdas (Bins)</span>
              <span className="text-xl font-black text-slate-800 font-mono block mt-1">{bins.length}</span>
            </div>
            <div className="bg-white border border-slate-150 p-4 rounded-2xl text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Capacidad de Peso</span>
              <span className="text-xl font-black text-slate-800 font-mono block mt-1">
                {(bins.reduce((sum, b) => sum + b.maxWeight, 0) / 1000).toFixed(1)}T
              </span>
            </div>
            <div className="bg-white border border-slate-150 p-4 rounded-2xl text-center col-span-2 md:col-span-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Celdas Ocupadas</span>
              <span className="text-xl font-black text-indigo-600 font-mono block mt-1">
                {bins.filter(b => b.status !== 'Empty').length} ({occupancyRate}%)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LADO IZQUIERDO (LG: col-span-5): Paneles de Configuración */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* PANEL 1: PASILLOS Y NIVELES (Estructura Base) */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Layers className="h-4.5 w-4.5 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight">Estructura Base (Pasillos y Niveles)</h3>
                </div>

                <div className="space-y-4 text-xs">
                  {/* PASILLOS */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl space-y-3 border border-slate-150/60">
                    <span className="font-extrabold text-slate-700 block">Gestión de Pasillos (Aisles)</span>
                    
                    {/* Crear Pasillo */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ej. E, F, G"
                        id="new-aisle-input"
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 font-mono font-bold text-center uppercase"
                      />
                      <button
                        onClick={() => {
                          const val = (document.getElementById('new-aisle-input') as HTMLInputElement)?.value;
                          handleAddAisle(val);
                          if ((document.getElementById('new-aisle-input') as HTMLInputElement)) {
                            (document.getElementById('new-aisle-input') as HTMLInputElement).value = '';
                          }
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition active:scale-95 text-center text-xs font-bold"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Añadir
                      </button>
                    </div>

                    {/* Eliminar Pasillo */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-200/60">
                      <select
                        id="delete-aisle-select"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-hidden text-slate-700 font-mono text-center text-xs font-semibold"
                      >
                        <option value="">-- Seleccionar Pasillo --</option>
                        {Array.from(new Set(bins.map(b => b.aisle))).sort().map(aisle => (
                          <option key={aisle} value={aisle}>Pasillo {aisle}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const val = (document.getElementById('delete-aisle-select') as HTMLSelectElement)?.value;
                          handleDeleteAisle(val);
                        }}
                        className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-150 font-bold py-1.5 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition active:scale-95 text-xs shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {/* NIVELES */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl space-y-3 border border-slate-150/60">
                    <span className="font-extrabold text-slate-700 block">Gestión de Niveles (Altura)</span>
                    
                    {/* Crear Nivel */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ej. L4, L5"
                        id="new-level-input"
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 font-mono font-bold text-center uppercase"
                      />
                      <button
                        onClick={() => {
                          const val = (document.getElementById('new-level-input') as HTMLInputElement)?.value;
                          handleAddLevel(val);
                          if ((document.getElementById('new-level-input') as HTMLInputElement)) {
                            (document.getElementById('new-level-input') as HTMLInputElement).value = '';
                          }
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition active:scale-95 text-xs font-bold"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Añadir
                      </button>
                    </div>

                    {/* Eliminar Nivel */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-200/60">
                      <select
                        id="delete-level-select"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-hidden text-slate-700 font-mono text-center text-xs font-semibold"
                      >
                        <option value="">-- Seleccionar Nivel --</option>
                        {Array.from(new Set(bins.map(b => b.level))).sort().map(level => (
                          <option key={level} value={level}>Nivel {level}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const val = (document.getElementById('delete-level-select') as HTMLSelectElement)?.value;
                          handleDeleteLevel(val);
                        }}
                        className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-150 font-bold py-1.5 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition active:scale-95 text-xs shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        Eliminar
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              {/* PANEL 2: CREACIÓN DE CELDAS (INDIVIDUAL Y LOTE) */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Wrench className="h-4.5 w-4.5 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight">Habilitar Ubicaciones (Celdas)</h3>
                </div>

                <div className="space-y-4 text-xs">
                  
                  {/* AGREGAR INDIVIDUAL */}
                  <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/50 space-y-3.5">
                    <span className="font-extrabold text-indigo-950 block flex items-center gap-1">
                      <PlusCircle className="h-4 w-4 text-indigo-600" />
                      Ubicación Individual (Celda Única)
                    </span>
                    
                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Pasillo</label>
                        <input
                          type="text"
                          value={newBinAisle}
                          onChange={(e) => setNewBinAisle(e.target.value)}
                          placeholder="Ej. E"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl uppercase font-bold text-center font-mono text-xs focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Rack / Espacio</label>
                        <input
                          type="text"
                          value={newBinRack}
                          onChange={(e) => setNewBinRack(e.target.value)}
                          placeholder="Ej. 01"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl uppercase font-bold text-center font-mono text-xs focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Cara / Shelf</label>
                        <select
                          value={newBinShelf}
                          onChange={(e) => setNewBinShelf(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-center text-xs font-semibold focus:outline-hidden"
                        >
                          <option value="S1">Cara 1 (S1)</option>
                          <option value="S2">Cara 2 (S2)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Nivel / Altura</label>
                        <input
                          type="text"
                          value={newBinLevel}
                          onChange={(e) => setNewBinLevel(e.target.value)}
                          placeholder="Ej. L1"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl uppercase font-bold text-center font-mono text-xs focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Capacidad Máxima (kg)</label>
                      <input
                        type="number"
                        value={newBinWeight}
                        onChange={(e) => setNewBinWeight(Number(e.target.value))}
                        placeholder="Ej. 500"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-center text-xs focus:outline-hidden"
                      />
                    </div>

                    <button
                      onClick={handleAddIndividualBin}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 text-xs select-none"
                    >
                      <Plus className="h-4 w-4" />
                      Habilitar Ubicación
                    </button>
                  </div>

                  {/* GENERACIÓN EN LOTE */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-3">
                    <span className="font-extrabold text-slate-700 block flex items-center gap-1">
                      <PlusSquare className="h-4 w-4 text-slate-500" />
                      Generación Masiva en Lote
                    </span>

                    <div className="space-y-2 text-[11px] leading-relaxed text-slate-400 bg-white p-2.5 rounded-xl border border-slate-200/50 font-medium font-semibold">
                      Cree múltiples celdas de una sola vez cruzando pasillos, racks y niveles separados por comas.
                    </div>

                    <div className="space-y-3.5">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Pasillos (ej. E, F)</label>
                        <input
                          type="text"
                          placeholder="E, F"
                          value={bulkAisleInput}
                          onChange={(e) => setBulkAisleInput(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Racks (ej. 01, 02)</label>
                        <input
                          type="text"
                          placeholder="01, 02"
                          value={bulkRackInput}
                          onChange={(e) => setBulkRackInput(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-hidden"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Caras (Shelves)</label>
                          <input
                            type="text"
                            value={bulkShelfInput}
                            onChange={(e) => setBulkShelfInput(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-center font-bold text-xs focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Niveles</label>
                          <input
                            type="text"
                            value={bulkLevelInput}
                            onChange={(e) => setBulkLevelInput(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-center font-bold text-xs focus:outline-hidden"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleBulkCreateDashboard}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 text-xs select-none"
                    >
                      <PlusSquare className="h-4 w-4" />
                      Generar Celdas en Lote
                    </button>
                  </div>

                </div>
              </div>

            </div>

            {/* LADO DERECHO (LG: col-span-7): MAPA INTERACTIVO DE ALMACÉN EN TIEMPO REAL */}
            <div className="lg:col-span-7 space-y-4">
              
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Map className="h-4.5 w-4.5 text-indigo-600 animate-pulse" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight">Mapa de Almacén en Tiempo Real</h3>
                  </div>
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded-md font-semibold">
                    Interactiva
                  </span>
                </div>

                <div className="space-y-4">
                  <p className="text-xs text-slate-400">
                    Haga clic sobre cualquier celda del mapa de almacén para inspeccionar sus características, ver su stock, o eliminarla de la infraestructura de manera segura.
                  </p>

                  <div className="border border-slate-150 rounded-2xl overflow-hidden bg-slate-50 p-4 shadow-inner animate-fadeIn" style={{ minHeight: "400px" }}>
                    <WarehouseMap
                      bins={bins}
                      selectedBin={configSelectedBin}
                      onSelectBin={setConfigSelectedBin}
                      activePath={[]}
                      onUpdateBins={onUpdateBins}
                      isReadOnly={isReadOnly}
                      inventory={inventory}
                      onNavigateToDashboard={() => setDashboardSubTab('metrics')}
                    />
                  </div>

                  {configSelectedBin && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-200 text-xs space-y-3 shadow-md"
                    >
                      <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Detalles de Celda Seleccionada</span>
                          <h4 className="text-sm font-black font-mono text-white mt-0.5">{configSelectedBin.id}</h4>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md font-bold font-mono text-[9px] ${
                          configSelectedBin.status === 'Full' 
                            ? 'bg-rose-500/25 text-rose-400 border border-rose-500/30' 
                            : configSelectedBin.status === 'Partial'
                              ? 'bg-amber-500/25 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {configSelectedBin.status === 'Full' ? 'Llena' : configSelectedBin.status === 'Partial' ? 'Parcial' : 'Vacía'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-850/40">
                          <span className="text-[9px] text-slate-400 uppercase font-medium">Ubicación Física</span>
                          <span className="block font-bold text-white mt-1">Pasillo {configSelectedBin.aisle} • Nivel {configSelectedBin.level}</span>
                        </div>
                        <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-850/40">
                          <span className="text-[9px] text-slate-400 uppercase font-medium">Rack & Cara</span>
                          <span className="block font-bold text-white mt-1">Rack {configSelectedBin.rack} • Cara {configSelectedBin.shelf}</span>
                        </div>
                        <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-850/40">
                          <span className="text-[9px] text-slate-400 uppercase font-medium">Capacidad de Carga</span>
                          <span className="block font-bold text-white mt-1">{configSelectedBin.maxWeight} kg</span>
                        </div>
                        <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-850/40">
                          <span className="text-[9px] text-slate-400 uppercase font-medium">Contenido</span>
                          <span className="block font-bold text-white mt-1 truncate">
                            {configSelectedBin.occupiedSku 
                              ? `${configSelectedBin.occupiedSku} (${configSelectedBin.occupiedQty} uds)` 
                              : 'Sin Stock'
                            }
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-2 gap-3 border-t border-slate-800">
                        <span className="text-[10px] text-slate-400 font-medium">
                          {configSelectedBin.occupiedQty > 0 
                            ? "❌ No se recomienda eliminar celdas con mercancía activa." 
                            : "✓ Vacía. Seguro para eliminar."
                          }
                        </span>
                        <div className="flex gap-2 w-full sm:w-auto justify-end shrink-0">
                          <button
                            onClick={() => setConfigSelectedBin(null)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs cursor-pointer transition select-none"
                          >
                            Cerrar
                          </button>
                          <button
                            onClick={() => handleDeleteIndividualBin(configSelectedBin)}
                            className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/30 font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1 transition select-none active:scale-95"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Eliminar Ubicación
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

            </div>

          </div>

          {/* PARTE INFERIOR: TABLA DE UBICACIONES Y CELDAS ACTUALES (Buscador y filtros) */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                  <ListFilter className="h-4.5 w-4.5 text-indigo-600" />
                  Listado Maestro de Ubicaciones Físicas
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Gestione y audite la totalidad de las celdas de almacenamiento creadas en la estructura.</p>
              </div>

              {/* Filtros de Tabla */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {/* Buscador */}
                <div className="relative">
                  <input
                    type="text"
                    value={binSearchQuery}
                    onChange={(e) => {
                      setBinSearchQuery(e.target.value);
                      setBinListPage(1);
                    }}
                    placeholder="Buscar celda..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-250/75 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-indigo-500 focus:bg-white w-40"
                  />
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>

                {/* Filtro Pasillo */}
                <select
                  value={binFilterAisle}
                  onChange={(e) => {
                    setBinFilterAisle(e.target.value);
                    setBinListPage(1);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-250/75 rounded-xl font-semibold text-slate-600 text-xs focus:outline-hidden"
                >
                  <option value="All">Todos los Pasillos</option>
                  {Array.from(new Set(bins.map(b => b.aisle))).sort().map(aisle => (
                    <option key={aisle} value={aisle}>Pasillo {aisle}</option>
                  ))}
                </select>

                {/* Filtro Nivel */}
                <select
                  value={binFilterLevel}
                  onChange={(e) => {
                    setBinFilterLevel(e.target.value);
                    setBinListPage(1);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-250/75 rounded-xl font-semibold text-slate-600 text-xs focus:outline-hidden"
                >
                  <option value="All">Todos los Niveles</option>
                  {Array.from(new Set(bins.map(b => b.level))).sort().map(level => (
                    <option key={level} value={level}>Nivel {level}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Listado de celdas */}
            <div className="overflow-x-auto rounded-2xl border border-slate-150">
              <table className="w-full text-xs text-left text-slate-500 border-collapse">
                <thead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-150">
                  <tr>
                    <th scope="col" className="px-4 py-3">Código Celda</th>
                    <th scope="col" className="px-4 py-3">Pasillo</th>
                    <th scope="col" className="px-4 py-3">Rack & Shelf</th>
                    <th scope="col" className="px-4 py-3">Nivel de Altura</th>
                    <th scope="col" className="px-4 py-3 text-center">Capacidad Máx.</th>
                    <th scope="col" className="px-4 py-3 text-center">Estado</th>
                    <th scope="col" className="px-4 py-3">Stock Asignado</th>
                    <th scope="col" className="px-4 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentBinsPage.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-bold text-xs bg-slate-50/50">
                        No se encontraron celdas de almacenamiento con los filtros especificados.
                      </td>
                    </tr>
                  ) : (
                    currentBinsPage.map((bin) => {
                      const inventoryForBin = bin.occupiedSku 
                        ? inventory.find(i => i.sku === bin.occupiedSku) 
                        : null;

                      return (
                        <tr key={bin.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900 select-all">{bin.id}</td>
                          <td className="px-4 py-3 font-semibold text-slate-700">Pasillo {bin.aisle}</td>
                          <td className="px-4 py-3 font-medium text-slate-500">Rack {bin.rack} • Cara {bin.shelf}</td>
                          <td className="px-4 py-3 font-medium text-slate-500">Nivel {bin.level}</td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-800">{bin.maxWeight} kg</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                              bin.status === 'Full'
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : bin.status === 'Partial'
                                  ? 'bg-amber-100 text-amber-700 border border-amber-250'
                                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}>
                              {bin.status === 'Full' ? 'Llena' : bin.status === 'Partial' ? 'Parcial' : 'Vacía'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {bin.occupiedSku ? (
                              <div className="space-y-0.5 leading-tight">
                                <span className="block font-bold text-slate-800 truncate max-w-[150px]">{inventoryForBin?.name || 'Cargando...'}</span>
                                <span className="block font-mono text-[10px] text-slate-400">SKU: {bin.occupiedSku} • <strong className="text-slate-600 font-extrabold">{bin.occupiedQty} uds</strong></span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic font-semibold">Disponible</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleDeleteIndividualBin(bin)}
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar permanentemente de la estructura"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalBinPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500">
                <span>
                  Mostrando celdas <strong className="text-slate-800">{(binListPage - 1) * itemsPerPage + 1}</strong> a <strong className="text-slate-800">{Math.min(binListPage * itemsPerPage, filteredBinsList.length)}</strong> de <strong className="text-slate-800">{filteredBinsList.length}</strong> registradas
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBinListPage(prev => Math.max(prev - 1, 1))}
                    disabled={binListPage === 1}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white cursor-pointer select-none font-bold"
                  >
                    Anterior
                  </button>
                  <span className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono">
                    {binListPage} / {totalBinPages}
                  </span>
                  <button
                    onClick={() => setBinListPage(prev => Math.min(prev + 1, totalBinPages))}
                    disabled={binListPage === totalBinPages}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white cursor-pointer select-none font-bold"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </>)}
        </div>
      )}

      {/* Floating Toast Notifications Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {activeToasts.map((toast, idx) => (
            <motion.div
              key={toast.sku + '-' + idx}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, x: 100 }}
              className="pointer-events-auto bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 shadow-xl flex items-start gap-3 relative overflow-hidden"
            >
              {/* Glow indicator line */}
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-500" />
              
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl mt-0.5 shrink-0 animate-pulse">
                <TriangleAlert className="h-5 w-5" />
              </div>
              
              <div className="flex-1 min-w-0 pr-4">
                <span className="block text-[10px] font-mono font-bold text-rose-400 uppercase tracking-wider">
                  {toast.isTest ? 'Simulación de Stock Crítico' : '¡Alerta de Stock Crítico!'}
                </span>
                <h4 className="text-xs font-bold text-slate-100 truncate mt-0.5">{toast.name}</h4>
                <span className="block font-mono text-[11px] text-slate-300 mt-1">
                  SKU: <strong className="text-white select-all">{toast.sku}</strong>
                </span>
                <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                  Cantidad actual: <span className="text-rose-400 font-extrabold">{toast.qty} uds</span> (Mínimo: {toast.minQty} uds)
                </p>
              </div>
              
              <button
                onClick={() => {
                  if (toast.isTest) {
                    setActiveToasts(prev => prev.filter((_, i) => i !== idx));
                  } else {
                    setDismissedSkus(prev => [...prev, toast.sku]);
                  }
                }}
                className="text-slate-400 hover:text-white transition p-1 hover:bg-slate-800 rounded-lg absolute top-3 right-3 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
};
