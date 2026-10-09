import React, { useState, useEffect, FormEvent } from 'react';
import {
  fetchWMSData,
  saveWMSSupabaseData,
  appendActivityLog
} from './supabaseService';
import { Bin, InventoryItem, Order, ActivityLog, CycleCountSession, ConcludedAuditReport, PlatformTheme } from './types';
import { WarehouseMap } from './components/WarehouseMap';
import { Dashboard } from './components/Dashboard';
import { PutawayOptimizer } from './components/PutawayOptimizer';
import { DirectDispatchManager } from './components/DirectDispatchManager';
import { InventoryManager } from './components/InventoryManager';
import { BarcodeConsole } from './components/BarcodeConsole';
import { CrewManager, OperatorProfile } from './components/CrewManager';
import { LabelStation } from './components/LabelStation';
import ReportsCenter from './components/ReportsCenter';
import { MovementsManager } from './components/MovementsManager';
import { UserManual } from './components/UserManual';
import { AlertsManager } from './components/AlertsManager';
import { Login } from './components/Login';
import { CycleCountReportModal } from './components/CycleCountReportModal';
import { PlatformSettings, DEFAULT_THEME_VALUES } from './components/PlatformSettings';
import { ConfigurationHub } from './components/ConfigurationHub';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
  Boxes,
  Briefcase,
  Truck,
  Package,
  TrendingUp,
  MapPin,
  Database,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  NotebookText,
  Workflow,
  ShieldAlert,
  Barcode,
  UserCheck,
  Printer,
  Compass,
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardCheck,
  FileCheck,
  FileDown,
  Move,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  Undo2,
  ChevronDown,
  ChevronUp,
  X,
  Bell,
  PanelLeft,
  PanelLeftClose,
  ChevronLeft,
  ChevronRight,
  Settings,
  Building2,
  Shield,
  Palette
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any>(() => {
    const saved = sessionStorage.getItem('OWMS_SESSION_USER');
    return saved ? JSON.parse(saved) : null;
  });

  // State to show/hide the sidebar options bar
  const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('owms_sidebar_visible');
    return saved !== null ? saved === 'true' : true;
  });

  // Platform visual theme & branding state (image & colors)
  const [platformTheme, setPlatformTheme] = useState<PlatformTheme>(() => {
    const saved = localStorage.getItem('OWMS_PLATFORM_THEME');
    if (saved) {
      try {
        return { ...DEFAULT_THEME_VALUES, ...JSON.parse(saved) };
      } catch (e) {
        return DEFAULT_THEME_VALUES;
      }
    }
    return DEFAULT_THEME_VALUES;
  });

  const handleUpdatePlatformTheme = (newTheme: PlatformTheme) => {
    setPlatformTheme(newTheme);
    localStorage.setItem('OWMS_PLATFORM_THEME', JSON.stringify(newTheme));
    setStatusMsg('Apariencia de la plataforma actualizada con éxito.');
    setTimeout(() => setStatusMsg(''), 4000);
  };

  const handleResetPlatformTheme = () => {
    setPlatformTheme(DEFAULT_THEME_VALUES);
    localStorage.setItem('OWMS_PLATFORM_THEME', JSON.stringify(DEFAULT_THEME_VALUES));
    setStatusMsg('Se restablecieron la imagen y colores originales de la plataforma.');
    setTimeout(() => setStatusMsg(''), 4000);
  };

  const toggleSidebar = () => {
    setIsSidebarVisible(prev => {
      const next = !prev;
      localStorage.setItem('owms_sidebar_visible', String(next));
      return next;
    });
  };

  const getPlatformRole = (currentUser: any) => {
    if (!currentUser) return 'Operador';
    const email = currentUser.email?.toLowerCase().trim();
    if (
      email === 'it.escalanegocios@gmail.com' ||
      email === 'ernest.quintero78@gmail.com' ||
      email === 'ernest.quintero78@gmail.'
    ) {
      return 'Administrador General';
    }
    if (email === 'supervisor@owms.com') {
      return 'Supervisor de Turno';
    }
    return 'Operador';
  };

  const platformRole = getPlatformRole(user);
  const isReadOnly = platformRole === 'Operador';

  const [needsAuth, setNeedsAuth] = useState(false);

  const handlePlatformLogin = (userData: { email: string; displayName: string }) => {
    setUser(userData);
    sessionStorage.setItem('OWMS_SESSION_USER', JSON.stringify(userData));
    setStatusMsg(`Bienvenido al sistema, ${userData.displayName}.`);
  };

  // WMS system state datasets
  const [bins, setBins] = useState<Bin[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [countedSessions, setCountedSessions] = useState<CycleCountSession[]>([
    { sku: 'ROB-CPU-i7', date: new Date(Date.now() - 3600000 * 2).toISOString(), physical: 40, system: 40, deviation: 0 },
    { sku: 'BATT-LIPO-SM', date: new Date(Date.now() - 12 * 3600000).toISOString(), physical: 148, system: 150, deviation: -2 },
    { sku: 'SENS-PROX-24', date: new Date(Date.now() - 24 * 3600000).toISOString(), physical: 80, system: 80, deviation: 0 },
  ]);
  const [activeSessionSkus, setActiveSessionSkus] = useState<string[]>(['ROB-CPU-i7', 'BATT-LIPO-SM', 'SENS-PROX-24']);
  const [selectedBarcodeForCount, setSelectedBarcodeForCount] = useState<string>('');

  const [isLoadingData, setIsLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);
  const [activePickingPath, setActivePickingPath] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState('');

  // Custom states for dismissing/resolving live operational notifications
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>(() => {
    const saved = localStorage.getItem('wms_dismissed_alerts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error("Error parsing saved dismissed alerts:", e);
      }
    }
    return [];
  });
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const [quickStockVal, setQuickStockVal] = useState<number>(0);
  const [quickExpDate, setQuickExpDate] = useState<string>('');

  // Controls visibility of the system operational alerts panel (defaults to false / hidden per user request)
  const [showAlertsPanel, setShowAlertsPanel] = useState<boolean>(() => {
    const saved = localStorage.getItem('wms_show_alerts_panel');
    return saved === 'true'; // Defaults to false (hidden)
  });

  const handleToggleAlertsPanel = (visible: boolean) => {
    setShowAlertsPanel(visible);
    localStorage.setItem('wms_show_alerts_panel', String(visible));
  };

  const handleDismissAllVisibleAlerts = (alertIds: string[]) => {
    const next = Array.from(new Set([...dismissedAlerts, ...alertIds]));
    setDismissedAlerts(next);
    localStorage.setItem('wms_dismissed_alerts', JSON.stringify(next));
    setStatusMsg(`Se han ocultado ${alertIds.length} alertas.`);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const [customProgrammedAlerts, setCustomProgrammedAlerts] = useState<any[]>(() => {
    const saved = localStorage.getItem('wms_custom_programmed_alerts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error("Error parsing saved custom alerts:", e);
      }
    }
    // Seed initial custom alerts
    return [
      {
        id: 'alt-001',
        title: 'Stock Crítico de Controladores CPU',
        type: 'stock_level',
        targetSku: 'ROB-CPU-i7',
        targetBin: 'all',
        thresholdValue: 50,
        severity: 'critical',
        enabled: true,
        customMessage: 'El stock de controladores de alta prioridad ha caído por debajo del margen de seguridad.',
        dateCreated: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString().slice(0, 10)
      },
      {
        id: 'alt-002',
        title: 'Alerta de Peso Máximo en Estantería',
        type: 'bin_weight',
        targetSku: 'all',
        targetBin: 'all',
        thresholdValue: 120, // kg
        severity: 'high',
        enabled: true,
        customMessage: 'Riesgo de sobrepeso en celdas de almacenamiento del nivel alto.',
        dateCreated: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().slice(0, 10)
      },
      {
        id: 'alt-003',
        title: 'Vencimiento de Baterías LiPo',
        type: 'expiration',
        targetSku: 'BATT-LIPO-SM',
        targetBin: 'all',
        thresholdValue: 45, // days
        severity: 'medium',
        enabled: true,
        customMessage: 'Revisar fecha de caducidad del lote de baterías químicas antes de la degradación.',
        dateCreated: new Date().toISOString().slice(0, 10)
      }
    ];
  });

  // Sub-tabs for simplified operations
  const [entradasSubTab, setEntradasSubTab] = useState<'scan' | 'optimizer'>('scan');
  const [conteosSubTab, setConteosSubTab] = useState<'scan' | 'history' | 'report'>('scan');
  const [showCycleCountReportModal, setShowCycleCountReportModal] = useState<boolean>(false);

  // Active checked-in warehouse operator state
  const [activeOperator, setActiveOperator] = useState<OperatorProfile | null>(() => {
    const saved = localStorage.getItem('OWMS_ACTIVE_OPERATOR');
    return saved ? JSON.parse(saved) : null;
  });

  const handleSelectOperator = (profile: OperatorProfile | null) => {
    setActiveOperator(profile);
    if (profile) {
      localStorage.setItem('OWMS_ACTIVE_OPERATOR', JSON.stringify(profile));
    } else {
      localStorage.removeItem('OWMS_ACTIVE_OPERATOR');
    }
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('OWMS_SESSION_USER');
    handleSelectOperator(null);
    setStatusMsg('Sesión cerrada correctamente.');
  };

  // 1. Fetch dataset from Supabase on mount
  useEffect(() => {
    loadWarehouseData();
  }, []);

  const loadWarehouseData = async () => {
    setIsLoadingData(true);
    setStatusMsg('');
    try {
      const data = await fetchWMSData();
      
      // Ensure the three virtual areas are part of the bins
      let loadedBins = [...data.bins];
      const specialAreas = [
        { id: "Area de Entrada", name: "Área de Entrada" },
        { id: "Area de Salida", name: "Área de Salida" },
        { id: "Area de Picking", name: "Área de Picking" }
      ];
      let needsSave = false;
      specialAreas.forEach(area => {
        if (!loadedBins.some(b => b.id === area.id)) {
          loadedBins.push({
            id: area.id,
            aisle: 'Virtual',
            rack: '',
            shelf: '',
            level: '',
            maxWeight: 10000,
            maxVolume: 1000,
            occupiedSku: '',
            occupiedQty: 0,
            status: 'Empty'
          });
          needsSave = true;
        }
      });

      setBins(loadedBins);
      
      // Ensure recently registered SKU appears as the first option
      const lastRegisteredSku = localStorage.getItem('wms_last_registered_sku');
      let finalInventory = data.inventory;
      if (lastRegisteredSku) {
        const foundIdx = finalInventory.findIndex(i => i.sku.toUpperCase() === lastRegisteredSku.toUpperCase());
        if (foundIdx > 0) {
          const item = finalInventory[foundIdx];
          finalInventory = [item, ...finalInventory.filter((_, idx) => idx !== foundIdx)];
        }
      }
      setInventory(finalInventory);
      setOrders(data.orders);
      setLogs(data.logs);

      if (needsSave) {
        await syncAllToGoogleSheetNow(loadedBins, data.inventory, data.orders);
      }

      // If there's a pending Outbound picking run with optimizedPath, set it on map visually by default!
      const activePickRun = data.orders.find(o => o.status === 'Picking' && o.optimizedPath && o.optimizedPath.length > 0);
      if (activePickRun) {
        setActivePickingPath(activePickRun.optimizedPath || []);
      } else {
        const pendingWithOptimized = data.orders.find(o => o.status === 'Pending' && o.optimizedPath && o.optimizedPath.length > 0);
        if (pendingWithOptimized) {
          setActivePickingPath(pendingWithOptimized.optimizedPath || []);
        } else {
          setActivePickingPath([]);
        }
      }
    } catch (err: any) {
      console.error(err);
      setStatusMsg('Error de conexión con Supabase. Por favor, verifica las credenciales en tu archivo .env o panel de Secretos.');
    } finally {
      setIsLoadingData(false);
    }
  };

  const syncAllToSupabaseNow = async (
    newBinsList: Bin[],
    newInventoryList: InventoryItem[],
    newOrdersList: Order[]
  ) => {
    const binRows = newBinsList.map(b => [
      b.id, b.aisle, b.rack, b.shelf, b.level,
      b.maxWeight, b.maxVolume, b.occupiedSku, b.occupiedQty, b.status
    ]);

    const inventoryRows = newInventoryList.map(i => [
      i.sku, i.name, i.description, i.category,
      i.qty, i.minQty, i.expirationDate,
      i.unitWidth, i.unitHeight, i.unitLength, i.unitWeight, i.supplier,
      i.cost || 0,
      i.barcode || '',
      i.imageUrl || '',
      i.superWarehouseId || '',
      i.superWarehouseName || '',
      i.warehouseId || '',
      i.warehouseName || ''
    ]);

    const orderRows = newOrdersList.map(o => [
      o.id, o.type, o.priority, o.status, o.dateCreated,
      JSON.stringify(o.items), o.assignedTo, JSON.stringify(o.optimizedPath || []),
      o.shipmentDate || '', o.carrier || '', o.trackingNumber || ''
    ]);

    try {
      await saveWMSSupabaseData('Bins', binRows);
      await saveWMSSupabaseData('Inventory', inventoryRows);
      await saveWMSSupabaseData('Orders', orderRows);
    } catch (err: any) {
      console.error(err);
      setStatusMsg('Error al sincronizar con Supabase: ' + err.message);
    }
  };

  const syncAllToGoogleSheetNow = syncAllToSupabaseNow;

  // Putaway confirmation apply
  const handleCommitPutaway = async (assignments: { sku: string; qty: number; binId: string }[]) => {
    const updatedBins = [...bins];
    const updatedInventory = [...inventory];

    const logDetails: string[] = [];

    // Perform updates to bins and inventory state
    assignments.forEach(task => {
      const binIdx = updatedBins.findIndex(b => b.id === task.binId);
      if (binIdx !== -1) {
        const binObj = updatedBins[binIdx];
        binObj.occupiedSku = task.sku;
        binObj.occupiedQty = (binObj.occupiedQty || 0) + task.qty;
        binObj.status = binObj.occupiedQty >= 120 ? 'Full' : 'Partial';
      }

      const invIdx = updatedInventory.findIndex(i => i.sku === task.sku);
      if (invIdx !== -1) {
        updatedInventory[invIdx].qty += task.qty;
      }

      logDetails.push(`Slot allocation to Cell ${task.binId} of SKU: ${task.sku} (${task.qty} units)`);
    });

    setBins(updatedBins);
    setInventory(updatedInventory);

    // Write-out transactions to sheet & audit log ledger
    await syncAllToGoogleSheetNow(updatedBins, updatedInventory, orders);
    await appendActivityLog(
      activeOperator ? `${activeOperator.name} (${activeOperator.role})` : (user?.displayName || 'Logistics Admin'),
      'Putaway Allocation Complete',
      logDetails.join(', ')
    );

    await loadWarehouseData();
  };

  // General Barcode Console / Scanner Updates
  const handleBarcodeConsoleSync = async (
    newBins: Bin[],
    newInventory: InventoryItem[],
    newOrders: Order[],
    logAction: string,
    logDetails: string
  ) => {
    setBins(newBins);
    setInventory(newInventory);
    setOrders(newOrders);

    await syncAllToGoogleSheetNow(newBins, newInventory, newOrders);
    await appendActivityLog(
      activeOperator ? `${activeOperator.name} (${activeOperator.role})` : (user?.displayName || 'Logistics Admin'),
      logAction,
      logDetails
    );
    await loadWarehouseData();
  };

  const handleUpdateBins = async (
    newBinsList: Bin[],
    logAction: string,
    logDetails: string
  ) => {
    setBins(newBinsList);
    try {
      await syncAllToGoogleSheetNow(newBinsList, inventory, orders);
      await appendActivityLog(
        activeOperator ? `${activeOperator.name} (${activeOperator.role})` : (user?.displayName || 'Logistics Admin'),
        logAction,
        logDetails
      );
      await loadWarehouseData();
    } catch (err) {
      console.error("Error updating warehouse layout on Supabase:", err);
    }
  };

  const handleCountCycleSession = (sku: string, physical: number, system: number) => {
    const deviation = physical - system;
    const newSession: CycleCountSession = {
      sku,
      date: new Date().toISOString(),
      physical,
      system,
      deviation
    };
    setCountedSessions(prev => [newSession, ...prev]);
    setActiveSessionSkus(prev => {
      if (!prev.includes(sku)) {
        return [...prev, sku];
      }
      return prev;
    });
  };

  const handleResetActiveSession = () => {
    setActiveSessionSkus([]);
    setStatusMsg('Nueva sesión de conteo cíclico iniciada.');
    setTimeout(() => setStatusMsg(''), 4000);
  };

  const handleConcludeAuditSession = async (report?: ConcludedAuditReport) => {
    const folio = report?.folio || `AUD-CC-${new Date().getFullYear()}`;
    setStatusMsg(`Auditoría de conteo cíclico concluida con éxito (Folio: ${folio}). Acta archivada y lista para firma.`);
    setTimeout(() => setStatusMsg(''), 6000);
    try {
      await appendActivityLog(
        activeOperator ? `${activeOperator.name} (${activeOperator.role})` : (user?.displayName || 'Logistics Admin'),
        'Concluir Auditoría y Conteo Cíclico',
        `Folio: ${folio}. Responsable: ${report?.responsible || activeOperator?.name || 'Alex Mercer'}, Fecha: ${report?.date || new Date().toLocaleDateString()}. SKUs: ${report?.totalItems || activeSessionSkus.length}, Exactitud: ${report?.accuracyRate || 100}%, Desvío neto: ${report?.netDeviation || 0} uds.`
      );
    } catch (e) {
      console.error('Error logging audit completion', e);
    }
  };

  // Add order callback
  const handleCreateOrder = async (newOrder: Partial<Order>) => {
    const fullOrder: Order = {
      id: newOrder.id || '',
      type: newOrder.type || 'Outbound',
      priority: newOrder.priority || 'Medium',
      status: 'Pending',
      dateCreated: newOrder.dateCreated || new Date().toISOString(),
      items: newOrder.items || [],
      assignedTo: newOrder.assignedTo || 'Unassigned',
      optimizedPath: []
    };

    const updatedOrders = [fullOrder, ...orders];
    setOrders(updatedOrders);

    await syncAllToGoogleSheetNow(bins, inventory, updatedOrders);
    await appendActivityLog(
      activeOperator ? `${activeOperator.name} (${activeOperator.role})` : (user?.displayName || 'Logistics Admin'),
      'Create WMS Order Node',
      `Registered ${fullOrder.type} order ${fullOrder.id} with items: ${JSON.stringify(fullOrder.items)}`
    );

    await loadWarehouseData();
  };

  // Set picking optimized path for an Outbound order
  const handleOptimizeOrderPath = async (orderId: string, path: string[]) => {
    const updatedOrders = orders.map(o => {
      if (o.id === orderId) {
        return { ...o, optimizedPath: path, status: 'Picking' as const };
      }
      return o;
    });

    setOrders(updatedOrders);
    setActivePickingPath(path);

    await syncAllToGoogleSheetNow(bins, inventory, updatedOrders);
    await appendActivityLog(
      activeOperator ? `${activeOperator.name} (${activeOperator.role})` : (user?.displayName || 'Logistics Admin'),
      'Shortest Pick Route Calculated',
      `Calculated serpentine optimal travel path for Order ${orderId}: [${path.join(' → ')}]`
    );

    await loadWarehouseData();
    setActiveTab('map'); // auto jump to map visual picker to inspect!
  };

  // Complete Order & Deduct Stocks
  const handleCompleteOrder = async (orderId: string) => {
    const orderObj = orders.find(o => o.id === orderId);
    if (!orderObj) return;

    const updatedOrders = orders.map(o => {
      if (o.id === orderId) {
        return { ...o, status: 'Completed' as const };
      }
      return o;
    });

    const updatedBins = [...bins];
    const updatedInventory = [...inventory];

    const logDetails: string[] = [];

    // Deduct stock levels in inventory and bins
    orderObj.items.forEach(ordItem => {
      // 1. Subtract mainline stock catalog
      const invIdx = updatedInventory.findIndex(i => i.sku === ordItem.sku);
      if (invIdx !== -1) {
        updatedInventory[invIdx].qty = Math.max(0, updatedInventory[invIdx].qty - ordItem.qty);
      }

      // 2. Subtract from active storage cells (FIFO / greedy consumption)
      let pendingDeduct = ordItem.qty;
      const matchingStockBins = updatedBins.filter(b => b.occupiedSku === ordItem.sku && b.occupiedQty > 0);
      
      for (const storageBin of matchingStockBins) {
        if (pendingDeduct <= 0) break;
        const consumeAmount = Math.min(pendingDeduct, storageBin.occupiedQty);
        storageBin.occupiedQty -= consumeAmount;
        pendingDeduct -= consumeAmount;

        if (storageBin.occupiedQty <= 0) {
          storageBin.occupiedSku = '';
          storageBin.status = 'Empty';
        } else {
          storageBin.status = 'Partial';
        }

        logDetails.push(`Deducted ${consumeAmount} of SKU ${ordItem.sku} from Cell ${storageBin.id}`);
      }
    });

    setOrders(updatedOrders);
    setBins(updatedBins);
    setInventory(updatedInventory);
    setActivePickingPath([]);

    await syncAllToGoogleSheetNow(updatedBins, updatedInventory, updatedOrders);
    await appendActivityLog(
      activeOperator ? `${activeOperator.name} (${activeOperator.role})` : (user?.displayName || 'Logistics Admin'),
      'Mark Order Dispatch Completed',
      `Cleared Order ${orderId}. Stock inventory adjustments applied: ${logDetails.join(', ')}`
    );

    await loadWarehouseData();
  };

  // Direct Outbound Dispatch (Sin necesidad de crear orden previa)
  const handleDirectDispatch = async (dispatchData: {
    sku: string;
    qty: number;
    destination: string;
    deliveryMethod: string;
    trackingNumber?: string;
    notes?: string;
  }): Promise<{ orderId: string; deductedBins: string[] } | null> => {
    const item = inventory.find(i => i.sku === dispatchData.sku);
    if (!item) return null;

    const orderId = `OUT-${Math.floor(Date.now() / 1000).toString().slice(-6)}`;
    const newOrder: Order = {
      id: orderId,
      type: 'Outbound',
      priority: 'High',
      status: 'Completed',
      dateCreated: new Date().toISOString(),
      shipmentDate: new Date().toISOString(),
      items: [{ sku: dispatchData.sku, qty: dispatchData.qty }],
      assignedTo: activeOperator ? activeOperator.name : (user?.displayName || 'Operador WMS'),
      carrier: dispatchData.deliveryMethod,
      destination: dispatchData.destination,
      trackingNumber: dispatchData.trackingNumber || ''
    };

    const updatedInventory = [...inventory];
    const invIdx = updatedInventory.findIndex(i => i.sku === dispatchData.sku);
    if (invIdx !== -1) {
      updatedInventory[invIdx].qty = Math.max(0, updatedInventory[invIdx].qty - dispatchData.qty);
    }

    const updatedBins = [...bins];
    const deductedBins: string[] = [];
    let pendingDeduct = dispatchData.qty;
    const matchingStockBins = updatedBins.filter(b => b.occupiedSku === dispatchData.sku && b.occupiedQty > 0);

    for (const storageBin of matchingStockBins) {
      if (pendingDeduct <= 0) break;
      const consumeAmount = Math.min(pendingDeduct, storageBin.occupiedQty);
      storageBin.occupiedQty -= consumeAmount;
      pendingDeduct -= consumeAmount;
      deductedBins.push(`${storageBin.id} (${consumeAmount} uds)`);

      if (storageBin.occupiedQty <= 0) {
        storageBin.occupiedSku = '';
        storageBin.status = 'Empty';
      } else {
        storageBin.status = 'Partial';
      }
    }

    const updatedOrders = [newOrder, ...orders];

    setOrders(updatedOrders);
    setBins(updatedBins);
    setInventory(updatedInventory);

    await syncAllToGoogleSheetNow(updatedBins, updatedInventory, updatedOrders);
    await appendActivityLog(
      activeOperator ? `${activeOperator.name} (${activeOperator.role})` : (user?.displayName || 'Logistics Admin'),
      'Salida Directa de Almacén',
      `Salida de almacén de ${dispatchData.qty} uds de ${item.name} (${dispatchData.sku}) hacia "${dispatchData.destination}" vía "${dispatchData.deliveryMethod}". Celdas afectadas: ${deductedBins.join(', ') || 'Inventario General'}`
    );

    await loadWarehouseData();

    return { orderId, deductedBins };
  };

  // Calculate real-time active system alerts
  const getActiveAlerts = () => {
    const alerts: { 
      id: string; 
      type: 'stock' | 'order' | 'custom_stock' | 'custom_weight' | 'custom_volume' | 'custom_expiration' | 'custom_manual'; 
      sku?: string;
      currentQty?: number;
      minQty?: number;
      orderId?: string;
      binId?: string;
      alertId?: string;
      days?: number;
      title: string; 
      desc: string; 
      priority: 'High' | 'Warning' 
    }[] = [];

    // 1. Check low stock threshold against Supabase custom configs
    inventory.forEach(item => {
      if (item.qty < item.minQty) {
        alerts.push({
          id: `STOCK-${item.sku}`,
          type: 'stock',
          sku: item.sku,
          currentQty: item.qty,
          minQty: item.minQty,
          title: `Bajo Stock: SKU ${item.sku}`,
          desc: `El stock actual de ${item.qty} unidades está por debajo del umbral mínimo de seguridad de ${item.minQty} unidades predefinido en Supabase.`,
          priority: item.qty === 0 ? 'High' : 'Warning'
        });
      }
    });

    // 2. Check orders pending for > 24 hours
    orders.forEach(order => {
      if (order.status === 'Pending') {
        const createdDate = new Date(order.dateCreated);
        const now = new Date();
        const diffMs = now.getTime() - createdDate.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours > 24) {
          alerts.push({
            id: `ORDER-DELAY-${order.id}`,
            type: 'order',
            orderId: order.id,
            title: `Pedido Demorado > 24h: ${order.id}`,
            desc: `Este pedido ${order.type} asignado a ${order.assignedTo} lleva ${Math.floor(diffHours)} horas sin procesarse desde el ${createdDate.toLocaleDateString()}. Envíalo urgentemente.`,
            priority: order.priority === 'High' || order.priority === 'Critical' ? 'High' : 'Warning'
          });
        }
      }
    });

    // 3. Evaluate custom programmed alerts
    customProgrammedAlerts.forEach(alert => {
      if (!alert.enabled) return;

      if (alert.type === 'stock_level') {
        if (alert.targetSku === 'all') {
          inventory.forEach(item => {
            if (item.qty <= alert.thresholdValue) {
              alerts.push({
                id: `CUSTOM-STOCK-${alert.id}-${item.sku}`,
                type: 'custom_stock',
                sku: item.sku,
                currentQty: item.qty,
                minQty: alert.thresholdValue,
                title: `${alert.title}: SKU ${item.sku}`,
                desc: `${alert.customMessage || 'Alerta de nivel de stock disparada.'} (Stock actual: ${item.qty} uds <= Umbral de ${alert.thresholdValue} uds)`,
                priority: alert.severity === 'critical' || alert.severity === 'high' ? 'High' : 'Warning'
              });
            }
          });
        } else {
          const item = inventory.find(i => i.sku === alert.targetSku);
          if (item && item.qty <= alert.thresholdValue) {
            alerts.push({
              id: `CUSTOM-STOCK-${alert.id}-${item.sku}`,
              type: 'custom_stock',
              sku: item.sku,
              currentQty: item.qty,
              minQty: alert.thresholdValue,
              title: `${alert.title}`,
              desc: `${alert.customMessage || 'Alerta de nivel de stock disparada.'} (Stock actual: ${item.qty} uds <= Umbral de ${alert.thresholdValue} uds)`,
              priority: alert.severity === 'critical' || alert.severity === 'high' ? 'High' : 'Warning'
            });
          }
        }
      }

      else if (alert.type === 'bin_weight') {
        const getBinWeight = (bin: Bin): number => {
          if (!bin.occupiedSku || bin.occupiedQty <= 0) return 0;
          const item = inventory.find(i => i.sku === bin.occupiedSku);
          return Number((bin.occupiedQty * (item?.unitWeight || 0.5)).toFixed(2));
        };

        if (alert.targetBin === 'all') {
          bins.forEach(bin => {
            const weight = getBinWeight(bin);
            if (weight >= alert.thresholdValue) {
              alerts.push({
                id: `CUSTOM-WEIGHT-${alert.id}-${bin.id}`,
                type: 'custom_weight',
                binId: bin.id,
                sku: bin.occupiedSku,
                currentQty: bin.occupiedQty,
                title: `${alert.title}: Celda ${bin.id}`,
                desc: `${alert.customMessage || 'Riesgo de peso elevado.'} (Peso actual: ${weight} kg >= Límite de ${alert.thresholdValue} kg)`,
                priority: alert.severity === 'critical' || alert.severity === 'high' ? 'High' : 'Warning'
              });
            }
          });
        } else {
          const bin = bins.find(b => b.id === alert.targetBin);
          if (bin) {
            const weight = getBinWeight(bin);
            if (weight >= alert.thresholdValue) {
              alerts.push({
                id: `CUSTOM-WEIGHT-${alert.id}-${bin.id}`,
                type: 'custom_weight',
                binId: bin.id,
                sku: bin.occupiedSku,
                currentQty: bin.occupiedQty,
                title: `${alert.title}`,
                desc: `${alert.customMessage || 'Riesgo de peso elevado.'} (Peso actual: ${weight} kg >= Límite de ${alert.thresholdValue} kg)`,
                priority: alert.severity === 'critical' || alert.severity === 'high' ? 'High' : 'Warning'
              });
            }
          }
        }
      }

      else if (alert.type === 'bin_volume') {
        const getBinVolumePercent = (bin: Bin): number => {
          if (!bin.occupiedSku || bin.occupiedQty <= 0) return 0;
          const item = inventory.find(i => i.sku === bin.occupiedSku);
          if (!item) return 0;
          const unitVol = (item.unitWidth * item.unitHeight * item.unitLength) / 1000000; // in m3
          const totalVol = unitVol * bin.occupiedQty;
          const maxVol = bin.maxVolume || 2.4;
          return Math.round((totalVol / maxVol) * 100);
        };

        if (alert.targetBin === 'all') {
          bins.forEach(bin => {
            const volPct = getBinVolumePercent(bin);
            if (volPct >= alert.thresholdValue) {
              alerts.push({
                id: `CUSTOM-VOLUME-${alert.id}-${bin.id}`,
                type: 'custom_volume',
                binId: bin.id,
                sku: bin.occupiedSku,
                currentQty: bin.occupiedQty,
                title: `${alert.title}: Celda ${bin.id}`,
                desc: `${alert.customMessage || 'Saturación de volumen detectada.'} (Saturación: ${volPct}% >= Límite de ${alert.thresholdValue}%)`,
                priority: alert.severity === 'critical' || alert.severity === 'high' ? 'High' : 'Warning'
              });
            }
          });
        } else {
          const bin = bins.find(b => b.id === alert.targetBin);
          if (bin) {
            const volPct = getBinVolumePercent(bin);
            if (volPct >= alert.thresholdValue) {
              alerts.push({
                id: `CUSTOM-VOLUME-${alert.id}-${bin.id}`,
                type: 'custom_volume',
                binId: bin.id,
                sku: bin.occupiedSku,
                currentQty: bin.occupiedQty,
                title: `${alert.title}`,
                desc: `${alert.customMessage || 'Saturación de volumen detectada.'} (Saturación: ${volPct}% >= Límite de ${alert.thresholdValue}%)`,
                priority: alert.severity === 'critical' || alert.severity === 'high' ? 'High' : 'Warning'
              });
            }
          }
        }
      }

      else if (alert.type === 'expiration') {
        const getDaysToExpiration = (dateStr: string): number => {
          if (!dateStr) return 9999;
          const expDate = new Date(dateStr);
          const today = new Date();
          const diffTime = expDate.getTime() - today.getTime();
          return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        };

        if (alert.targetSku === 'all') {
          inventory.forEach(item => {
            if (item.expirationDate) {
              const days = getDaysToExpiration(item.expirationDate);
              if (days <= alert.thresholdValue && days >= -30) {
                alerts.push({
                  id: `CUSTOM-EXPIRATION-${alert.id}-${item.sku}`,
                  type: 'custom_expiration',
                  sku: item.sku,
                  days: days,
                  title: `${alert.title}: SKU ${item.sku}`,
                  desc: `${alert.customMessage || 'Riesgo de caducidad inminente.'} (Expira en ${days} días <= Umbral de ${alert.thresholdValue} días)`,
                  priority: alert.severity === 'critical' || alert.severity === 'high' ? 'High' : 'Warning'
                });
              }
            }
          });
        } else {
          const item = inventory.find(i => i.sku === alert.targetSku);
          if (item && item.expirationDate) {
            const days = getDaysToExpiration(item.expirationDate);
            if (days <= alert.thresholdValue && days >= -30) {
              alerts.push({
                id: `CUSTOM-EXPIRATION-${alert.id}-${item.sku}`,
                type: 'custom_expiration',
                sku: item.sku,
                days: days,
                title: `${alert.title}`,
                desc: `${alert.customMessage || 'Riesgo de caducidad inminente.'} (Expira en ${days} días <= Umbral de ${alert.thresholdValue} días)`,
                priority: alert.severity === 'critical' || alert.severity === 'high' ? 'High' : 'Warning'
              });
            }
          }
        }
      }

      else if (alert.type === 'custom') {
        alerts.push({
          id: `CUSTOM-MANUAL-${alert.id}`,
          type: 'custom_manual',
          alertId: alert.id,
          title: `${alert.title}`,
          desc: alert.customMessage || 'Alerta personalizada activa de forma permanente.',
          priority: alert.severity === 'critical' || alert.severity === 'high' ? 'High' : 'Warning'
        });
      }
    });

    return alerts;
  };

  // Add SKU index card
  const handleAddInventory = async (item: InventoryItem) => {
    // Put newly registered SKU at the top as the first option
    const updatedInventory = [item, ...inventory.filter(i => i.sku.toUpperCase() !== item.sku.toUpperCase())];
    setInventory(updatedInventory);

    // Save as last registered SKU so it remains first in tables, selectors and forms
    localStorage.setItem('wms_last_registered_sku', item.sku);

    await syncAllToGoogleSheetNow(bins, updatedInventory, orders);
    await appendActivityLog(
      user?.displayName || 'Logistics Admin',
      'Register Storage SKU',
      `Registered standard SKU code: ${item.sku} (${item.name}) supplier: ${item.supplier}`
    );

    await loadWarehouseData();
  };

  // Delete SKU index card
  const handleDeleteInventory = async (sku: string) => {
    const updatedInventory = inventory.filter(i => i.sku !== sku);
    setInventory(updatedInventory);

    await syncAllToGoogleSheetNow(bins, updatedInventory, orders);
    await appendActivityLog(
      user?.displayName || 'Logistics Admin',
      'Delete Registered SKU Index',
      `Permanently removed stock product SKU registration code: ${sku}`
    );

    await loadWarehouseData();
  };

  // Update inventory qty callback
  const handleUpdateInventoryQty = async (sku: string, newQty: number) => {
    const oldItem = inventory.find(i => i.sku === sku);
    const oldQty = oldItem ? oldItem.qty : 0;

    const updatedInventory = inventory.map(item => {
      if (item.sku === sku) {
        return { ...item, qty: newQty };
      }
      return item;
    });
    setInventory(updatedInventory);

    await syncAllToGoogleSheetNow(bins, updatedInventory, orders);
    await appendActivityLog(
      user?.displayName || 'Logistics Admin',
      'Adjust Inventory Stock',
      `Manually adjusted stock level of SKU ${sku} from ${oldQty} to ${newQty} units.`
    );

    await loadWarehouseData();
  };

  // Update generic inventory item attributes (e.g. placeholder images)
  const handleUpdateInventoryItem = async (sku: string, updatedFields: Partial<InventoryItem>) => {
    const oldItem = inventory.find(i => i.sku === sku);
    if (!oldItem) return;

    const updatedInventory = inventory.map(item => {
      if (item.sku === sku) {
        return { ...item, ...updatedFields };
      }
      return item;
    });
    setInventory(updatedInventory);

    await syncAllToGoogleSheetNow(bins, updatedInventory, orders);
    await appendActivityLog(
      user?.displayName || 'Logistics Admin',
      'Update SKU Metadata',
      `Updated metadata attributes for SKU ${sku}: ${Object.keys(updatedFields).join(', ')}.`
    );

    await loadWarehouseData();
  };

  // Trigger Random Simulation PO delivery to showcase Supabase reactive syncing
  const triggerSimInboundDelivery = async () => {
    if (inventory.length === 0) return;
    const randomItem = inventory[Math.floor(Math.random() * inventory.length)];
    const qty = Math.floor(Math.random() * 50) + 10;
    
    // Find empty bin
    const vacantBin = bins.find(b => b.status === 'Empty');
    if (!vacantBin) {
      alert("Warehouse is fully utilized! Clear out slot capacity through outbound shipments before simulation.");
      return;
    }

    setStatusMsg('Running automated delivery sim...');

    try {
      const updatedBins = bins.map(b => {
        if (b.id === vacantBin.id) {
          return { ...b, occupiedSku: randomItem.sku, occupiedQty: qty, status: 'Partial' as const };
        }
        return b;
      });

      const updatedInventory = inventory.map(i => {
        if (i.sku === randomItem.sku) {
          return { ...i, qty: i.qty + qty };
        }
        return i;
      });

      setBins(updatedBins);
      setInventory(updatedInventory);

      await syncAllToSupabaseNow(updatedBins, updatedInventory, orders);
      await appendActivityLog(
        'Simulation Automaton',
        'Simulate Delivery Task Complete',
        `Automated intake PO delivery of ${qty} units of SKU ${randomItem.sku} received inside vacant Cell ${vacantBin.id}`
      );

      await loadWarehouseData();
      setStatusMsg('Automated delivery simulation completed! Bins updated and written to Supabase.');
    } catch (err: any) {
      console.error(err);
      setStatusMsg('Simulation failed: ' + err.message);
    }
  };

  // Render core connected application viewport
  if (!user) {
    return <Login onLogin={handlePlatformLogin} />;
  }

  const canvasBgClass = 
    platformTheme.canvasBg === 'gray' 
      ? 'bg-gray-100' 
      : platformTheme.canvasBg === 'zinc' 
        ? 'bg-zinc-100' 
        : platformTheme.canvasBg === 'dark' 
          ? 'bg-slate-900 text-slate-100' 
          : 'bg-slate-50';

  return (
    <div className={`min-h-screen ${canvasBgClass} flex flex-col font-sans selection:bg-blue-600 selection:text-white antialiased`}>
      
      {/* Top operational menu header bar */}
      <header className="bg-white border-b border-slate-200/50 sticky top-0 z-30 px-6 py-3 flex items-center justify-between shadow-xs select-none">
        <div className="flex items-center gap-3">
          {/* Botón para Ocultar / Mostrar Barra de Opciones Lateral */}
          <button
            onClick={toggleSidebar}
            style={{
              backgroundColor: !isSidebarVisible ? platformTheme.primaryColor : undefined,
              borderColor: !isSidebarVisible ? platformTheme.primaryColor : undefined
            }}
            className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-center ${
              isSidebarVisible
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                : 'text-white shadow-sm'
            }`}
            title={isSidebarVisible ? "Ocultar barra de opciones lateral" : "Mostrar barra de opciones lateral"}
            aria-label={isSidebarVisible ? "Ocultar barra de opciones lateral" : "Mostrar barra de opciones lateral"}
          >
            {isSidebarVisible ? (
              <PanelLeftClose className="h-4.5 w-4.5" />
            ) : (
              <PanelLeft className="h-4.5 w-4.5" />
            )}
          </button>

          <div 
            className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow overflow-hidden transition-colors"
            style={{ backgroundColor: platformTheme.primaryColor }}
          >
            {platformTheme.logoType === 'image' && platformTheme.logoUrl ? (
              <img 
                src={platformTheme.logoUrl} 
                alt={platformTheme.platformName} 
                className="h-full w-full object-contain p-0.5" 
              />
            ) : (
              (() => {
                const iconMap: Record<string, any> = {
                  boxes: Boxes,
                  truck: Truck,
                  package: Package,
                  warehouse: Building2,
                  shield: Shield,
                  database: Database,
                };
                const IconComp = iconMap[platformTheme.presetIcon] || Boxes;
                return <IconComp className="h-5.5 w-5.5" />;
              })()
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-sans leading-none">
              <span className="font-extrabold text-slate-800 tracking-tight text-sm">
                {platformTheme.platformName || 'O-WMS PRO'}
              </span>
              <span 
                className="text-[9px] font-bold font-mono px-1 py-0.5 rounded border"
                style={{ 
                  borderColor: platformTheme.primaryColor,
                  color: platformTheme.primaryColor,
                  backgroundColor: `${platformTheme.primaryColor}15`
                }}
              >
                {platformTheme.versionTag || 'v1.2'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 tracking-wide font-medium mt-1">
              Conectado: {user?.displayName || 'Admin de Logística'}
            </p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2.5 text-xs font-semibold uppercase leading-none">
          {/* Quick toggle for operational alerts */}
          {(() => {
            const allSystemAlerts = getActiveAlerts();
            const visibleCount = allSystemAlerts.filter(a => !dismissedAlerts.includes(a.id)).length;
            if (allSystemAlerts.length === 0) return null;
            return (
              <button
                onClick={() => handleToggleAlertsPanel(!showAlertsPanel)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] tracking-wider transition cursor-pointer ${
                  showAlertsPanel
                    ? 'bg-rose-50 border-rose-250 text-rose-700 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs'
                }`}
                title={showAlertsPanel ? "Ocultar panel de alertas de seguridad" : "Mostrar panel de alertas de seguridad"}
              >
                <Bell className="h-3.5 w-3.5 text-rose-500" />
                <span className="hidden sm:inline">Alertas</span>
                <span className="bg-rose-100 text-rose-800 px-1 py-0.2 rounded font-mono font-bold text-[9px]">
                  {visibleCount}
                </span>
                {showAlertsPanel ? (
                  <ChevronUp className="h-3 w-3 text-slate-400" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                )}
              </button>
            );
          })()}
          
          {/* Quick sync reload indicator status */}
          <button
            onClick={loadWarehouseData}
            disabled={isLoadingData}
            className="flex items-center gap-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-50 bg-white border border-slate-200 px-3 py-2 rounded-lg py-1.5 transition text-[10px] tracking-wider"
          >
            {isLoadingData ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Recargar Respaldo
          </button>

          {/* Secure Logout trigger */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 hover:bg-rose-50 border border-transparent hover:border-rose-100 text-slate-500 hover:text-rose-600 px-3 py-2 rounded-lg transition text-[10px] tracking-wider pl-2"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar Sesión
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row relative">
        
        {/* Navigation Sidebar Panel Controls */}
        {isSidebarVisible ? (
          <aside 
            style={{ backgroundColor: platformTheme.sidebarColor }}
            className="w-full md:w-64 border-r border-slate-800/80 text-slate-300 p-5 shrink-0 flex flex-col justify-between gap-6 relative select-none animate-fade-in transition-all"
          >
            <div className="space-y-6">
              
              {/* Sidebar Header with Collapse Button */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest">
                  Menú de Opciones
                </span>
                <button
                  onClick={toggleSidebar}
                  className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer flex items-center gap-1.5 text-[10px] font-semibold"
                  title="Ocultar barra de opciones lateral"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Ocultar</span>
                </button>
              </div>

              {/* Category 1: Operaciones Básicas */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-widest block pl-3">
                  Operaciones Básicas
                </span>
                
                <div className="space-y-1">
                  {[
                    { id: 'entradas', label: 'Entradas', icon: ArrowDownLeft },
                    { id: 'salidas', label: 'Salidas', icon: ArrowUpRight },
                    { id: 'movimientos', label: 'Movimientos', icon: Move },
                    { id: 'conteos', label: 'Conteos Cíclicos', icon: ClipboardCheck },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                          backgroundColor: isActive ? platformTheme.primaryColor : undefined,
                          boxShadow: isActive ? `0 4px 14px ${platformTheme.primaryColor}35` : undefined
                        }}
                        className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold leading-none flex items-center gap-2.5 transition cursor-pointer ${
                          isActive 
                            ? 'text-white' 
                            : 'hover:bg-slate-800/80 hover:text-slate-100'
                        }`}
                      >
                        <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category 2: Herramientas y Soporte */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-widest block pl-3">
                  Soporte y Monitoreo
                </span>
                
                <div className="space-y-1">
                  {[
                    { id: 'dashboard', label: 'Métricas', icon: TrendingUp },
                    { id: 'map', label: 'Mapa del Almacén', icon: MapPin },
                    { id: 'inventory', label: 'Registro de SKU', icon: Package },
                    { id: 'etiquetas', label: 'Estación de Etiquetas', icon: Printer },
                    { id: 'alertas', label: 'Gestión de Alertas', icon: ShieldAlert },
                    { id: 'reports', label: 'Centro de Reportes', icon: FileDown },
                    { id: 'configuracion', label: 'Configuración', icon: Settings },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                          backgroundColor: isActive ? platformTheme.primaryColor : undefined,
                          borderColor: isActive ? platformTheme.primaryColor : undefined,
                          boxShadow: isActive ? `0 2px 8px ${platformTheme.primaryColor}30` : undefined
                        }}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-semibold leading-none flex items-center gap-2.5 transition cursor-pointer ${
                          isActive 
                            ? 'text-white shadow-xs' 
                            : 'hover:bg-slate-800/50 hover:text-slate-100 text-slate-400'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Database coordinate references / Supabase Sync Status card */}
            <div className="space-y-3 border-t border-slate-800/60 pt-4">
              <div className="bg-blue-500/15 text-blue-400 p-3.5 rounded-xl text-xs flex flex-col gap-1 border border-blue-500/10">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold tracking-wider text-[10px] uppercase font-mono">BASE DE DATOS SQL</span>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                </div>
                <p className="opacity-80 text-[10px] font-medium leading-relaxed">Motor: Supabase (PostgreSQL)</p>
                <div className="text-[10px] text-blue-300 font-mono tracking-tighter truncate block mt-1">
                  Conexión segura SSL activa
                </div>
              </div>
            </div>
          </aside>
        ) : (
          /* Subtle floating tab docked on left screen edge to quickly reopen sidebar */
          <button
            onClick={toggleSidebar}
            style={{ backgroundColor: platformTheme.sidebarColor }}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-40 hover:opacity-95 text-slate-300 hover:text-white px-2 py-4 rounded-r-2xl shadow-xl border-y border-r border-slate-700 transition-all flex flex-col items-center gap-1.5 cursor-pointer group"
            title="Mostrar barra de opciones lateral"
            aria-label="Mostrar barra de opciones lateral"
          >
            <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            <span className="text-[9px] font-bold font-mono [writing-mode:vertical-lr] tracking-widest uppercase">
              Menú
            </span>
          </button>
        )}

        {/* Content Viewport Frame */}
        <main className="flex-1 p-6 md:p-8 space-y-6 max-w-full">
          
          {/* Quick status bar when sidebar is hidden */}
          {!isSidebarVisible && (
            <div className="flex items-center justify-between bg-white border border-slate-200/80 px-4 py-2 rounded-xl shadow-2xs text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSidebar}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold transition cursor-pointer"
                  title="Mostrar barra de opciones lateral"
                >
                  <PanelLeft className="h-3.5 w-3.5" />
                  <span>Mostrar Barra de Opciones</span>
                </button>
                <span className="text-slate-300 font-light">|</span>
                <span className="text-slate-500 font-medium">Sección activa:</span>
                <span className="font-bold text-slate-800 capitalize font-mono">
                  {activeTab === 'configuracion' || activeTab === 'crew' || activeTab === 'manual' ? 'Configuración' : activeTab}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 hidden sm:inline font-mono">
                Presione [Mostrar Barra] para cambiar de módulo
              </span>
            </div>
          )}
          
          {statusMsg && (
            <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between ${
              statusMsg.includes('failed') || statusMsg.includes('falló')
                ? 'bg-rose-50 border-rose-100 text-rose-600 shadow-xs'
                : 'bg-blue-50 border-blue-100 text-blue-700 shadow-xs'
            }`}>
              <span>{statusMsg}</span>
              <button onClick={() => setStatusMsg('')} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
          )}

          {/* Active WMS System Guards & Operational Alerts notifications */}
          {(() => {
            const allSystemAlerts = getActiveAlerts();
            const visibleSystemAlerts = allSystemAlerts.filter(a => !dismissedAlerts.includes(a.id));
            const dismissedCount = allSystemAlerts.length - visibleSystemAlerts.length;

            if (allSystemAlerts.length === 0) return null;

            if (visibleSystemAlerts.length === 0) {
              if (!showAlertsPanel) return null;
              return (
                <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-emerald-800 font-mono">
                      TODAS LAS ALERTAS OPERATIVAS ({allSystemAlerts.length}) HAN SIDO RESUELTAS O DESCARTADAS
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setDismissedAlerts([]);
                        localStorage.removeItem('wms_dismissed_alerts');
                      }}
                      className="text-xs font-bold font-mono text-emerald-700 hover:text-emerald-900 bg-white hover:bg-emerald-100/50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <Undo2 className="h-3.5 w-3.5" /> Reactivar todas
                    </button>
                    <button
                      onClick={() => handleToggleAlertsPanel(false)}
                      className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-emerald-100/60 transition cursor-pointer"
                      title="Ocultar aviso"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            }

            if (!showAlertsPanel) {
              return null;
            }

            return (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                    </span>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                      Alertas de Seguridad Activas del WMS ({visibleSystemAlerts.length})
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleDismissAllVisibleAlerts(visibleSystemAlerts.map(a => a.id))}
                      className="text-[10px] font-mono font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                      title="Ocultar todas las alertas de este panel"
                    >
                      <EyeOff className="h-3 w-3" /> Ocultar todas las alertas
                    </button>
                    <button
                      onClick={() => handleToggleAlertsPanel(false)}
                      className="text-[10px] font-mono font-bold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-250 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                      title="Ocultar este panel"
                    >
                      <ChevronUp className="h-3 w-3" /> Ocultar panel
                    </button>
                    {dismissedCount > 0 && (
                      <button
                        onClick={() => {
                          setDismissedAlerts([]);
                          localStorage.removeItem('wms_dismissed_alerts');
                        }}
                        className="text-[10px] font-mono font-bold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Undo2 className="h-3 w-3" /> Restaurar {dismissedCount} ocultas
                      </button>
                    )}
                    <span className="text-[9px] font-mono font-bold bg-rose-50 text-rose-600 border border-rose-150 px-2 py-0.5 rounded uppercase">
                      Telemetría reactiva en vivo
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {visibleSystemAlerts.map(alert => (
                    <div
                      key={alert.id}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 transition-all duration-150 ${
                        alert.priority === 'High'
                          ? 'bg-rose-50/50 border-rose-250 text-rose-950 shadow-xs'
                          : 'bg-amber-50/40 border-amber-250 text-amber-950 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <ShieldAlert className={`h-5 w-5 shrink-0 mt-0.5 ${
                          alert.priority === 'High' ? 'text-rose-600' : 'text-amber-600'
                        }`} />
                        <div className="space-y-1 flex-1">
                          <span className="font-extrabold block text-xs leading-none text-slate-900">
                            {alert.title}
                          </span>
                          <p className="text-[10px] text-slate-600 leading-relaxed font-semibold">
                            {alert.desc}
                          </p>
                        </div>
                      </div>

                      {/* Resolution controls */}
                      {resolvingAlertId === alert.id ? (
                        alert.type === 'stock' ? (
                          <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                            <span className="text-[10px] font-bold text-slate-700 block">
                              Abastecer Stock para SKU <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">{alert.sku}</code>
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <input
                                  type="number"
                                  value={quickStockVal}
                                  onChange={(e) => setQuickStockVal(Math.max(0, parseInt(e.target.value) || 0))}
                                  className="w-full pl-3 pr-14 py-1.5 bg-slate-50 border border-slate-250 rounded-lg text-xs font-bold font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="absolute right-2 top-2 text-[8px] font-bold text-slate-400 uppercase font-mono">Uds</span>
                              </div>
                              <button
                                onClick={async () => {
                                  if (alert.sku) {
                                    await handleUpdateInventoryQty(alert.sku, quickStockVal);
                                    setResolvingAlertId(null);
                                    setStatusMsg(`Stock de SKU ${alert.sku} actualizado a ${quickStockVal} unidades.`);
                                  }
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold font-mono shadow-sm transition-all shrink-0"
                              >
                                Guardar
                              </button>
                            </div>
                            
                            <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-slate-100">
                              <div className="flex gap-1">
                                <button
                                  onClick={() => setQuickStockVal((alert.minQty || 15))}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[9px] font-mono font-bold"
                                >
                                  Mínimo ({alert.minQty || 15})
                                </button>
                                <button
                                  onClick={() => setQuickStockVal(prev => prev + 25)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[9px] font-mono font-bold"
                                >
                                  +25
                                </button>
                                <button
                                  onClick={() => setQuickStockVal(prev => prev + 100)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[9px] font-mono font-bold"
                                >
                                  +100
                                </button>
                              </div>
                              <button
                                onClick={() => setResolvingAlertId(null)}
                                className="text-slate-500 hover:text-slate-700 text-[9px] font-mono font-bold"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                            <span className="text-[10px] font-bold text-slate-700 block">
                              ¿Desea registrar la salida del pedido <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">{alert.orderId}</code> inmediatamente?
                            </span>
                            <p className="text-[9px] text-slate-400 font-semibold leading-normal">
                              Esta acción cambiará el estado del pedido a "Completed" y deducirá los artículos del inventario de forma automática.
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={async () => {
                                  if (alert.orderId) {
                                    await handleCompleteOrder(alert.orderId);
                                    setResolvingAlertId(null);
                                    setStatusMsg(`Salida del pedido ${alert.orderId} registrada con éxito.`);
                                  }
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold font-mono shadow-sm transition-all"
                              >
                                Sí, Confirmar Salida
                              </button>
                              <button
                                onClick={() => setResolvingAlertId(null)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1 rounded-lg text-xs font-bold font-mono transition-all"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100/50">
                          <button
                            onClick={() => {
                              setResolvingAlertId(alert.id);
                              if (alert.type === 'stock') {
                                setQuickStockVal(alert.minQty || 15);
                              }
                            }}
                            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-250 px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all flex items-center gap-1 shadow-2xs"
                          >
                            <Check className="h-3 w-3 text-emerald-500" /> Resolver
                          </button>
                          <button
                            onClick={() => {
                              const next = [...dismissedAlerts, alert.id];
                              setDismissedAlerts(next);
                              localStorage.setItem('wms_dismissed_alerts', JSON.stringify(next));
                            }}
                            className="bg-transparent hover:bg-slate-100 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition-all flex items-center gap-1 ml-auto"
                          >
                            <EyeOff className="h-3 w-3" /> Ocultar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {activeTab === 'dashboard' && (
            <Dashboard
              bins={bins}
              inventory={inventory}
              orders={orders}
              logs={logs}
              countedSessions={countedSessions}
              onTabChange={setActiveTab}
              onUpdateBins={handleUpdateBins}
              onUpdateInventoryItem={handleUpdateInventoryItem}
              platformUser={user}
              isReadOnly={isReadOnly}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsCenter
              bins={bins}
              inventory={inventory}
              orders={orders}
              logs={logs}
              countedSessions={countedSessions}
            />
          )}

          {activeTab === 'entradas' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <ArrowDownLeft className="h-6 w-6 text-blue-600 bg-blue-50 p-1 rounded-lg" />
                    Operación de Entradas (Inbound)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Gestione la recepción de mercancías, escaneo de códigos de barra y optimización de guardado (Putaway).
                  </p>
                </div>
                
                {/* Sub-navigation pill selector */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 select-none">
                  <button
                    onClick={() => setEntradasSubTab('scan')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      entradasSubTab === 'scan'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Escáner de Recepción
                  </button>
                  <button
                    onClick={() => setEntradasSubTab('optimizer')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      entradasSubTab === 'optimizer'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Guardado Optimizado
                  </button>
                </div>
              </div>

              {entradasSubTab === 'scan' ? (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50/50 border border-blue-150 rounded-2xl text-xs text-blue-800 flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
                    <p className="font-semibold">
                      <strong>Escaneo de Recepción de Materiales:</strong> Escanee códigos de barras para verificar registro inmediato, consultar en qué posición física se encuentra o a qué celda debe ir (Putaway sugerido).
                    </p>
                  </div>
                  <BarcodeConsole
                    bins={bins}
                    inventory={inventory}
                    orders={orders}
                    onFullSync={handleBarcodeConsoleSync}
                    onLogCountSession={handleCountCycleSession}
                    initialModule="entrada"
                    hideModuleSelector={true}
                    hideHeader={true}
                    onAddInventory={handleAddInventory}
                    onNavigateToInventory={() => setActiveTab('inventory')}
                  />
                </div>
              ) : (
                <PutawayOptimizer
                  bins={bins}
                  inventory={inventory}
                  onCommitPutaway={handleCommitPutaway}
                />
              )}
            </div>
          )}

          {activeTab === 'salidas' && (
            <DirectDispatchManager
              inventory={inventory}
              bins={bins}
              orders={orders}
              onDirectDispatch={handleDirectDispatch}
              onCompleteOrder={handleCompleteOrder}
              activeOperator={activeOperator}
              platformTheme={platformTheme}
              onNavigateToTab={setActiveTab}
            />
          )}

          {activeTab === 'conteos' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <ClipboardCheck className="h-6 w-6 text-emerald-600 bg-emerald-50 p-1 rounded-lg" />
                    Conteos Cíclicos (Inventory Audit)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Auditoría de precisión del inventario físico comparado en tiempo real con las métricas del sistema.
                  </p>
                </div>
                
                {/* Actions & Sub-navigation */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowCycleCountReportModal(true)}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
                    title="Imprimir acta oficial de conteo con desglose de diferencias y sección de firmas"
                  >
                    <Printer className="h-4 w-4 text-emerald-400" />
                    <span>Imprimir Reporte y Firmas</span>
                  </button>

                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 select-none">
                    <button
                      onClick={() => setConteosSubTab('scan')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        conteosSubTab === 'scan'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Efectuar Conteo
                    </button>
                    <button
                      onClick={() => setConteosSubTab('history')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        conteosSubTab === 'history'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Historial
                    </button>
                    <button
                      onClick={() => {
                        setConteosSubTab('report');
                        setShowCycleCountReportModal(true);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        conteosSubTab === 'report'
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
                      Reporte Oficial
                    </button>
                  </div>
                </div>
              </div>

              {(() => {
                const percentage = inventory.length > 0 ? Math.round((activeSessionSkus.length / inventory.length) * 100) : 0;
                return conteosSubTab === 'scan' ? (
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Left Column (Main Scanner Terminal) */}
                    <div className="xl:col-span-2 space-y-4">
                      <div className="p-4 bg-emerald-50/50 border border-emerald-150 rounded-2xl text-xs text-emerald-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                          <p className="font-semibold">
                            <strong>Auditoría de Stock en Vivo:</strong> Escanee el código de barras o haga clic en un SKU de la lista de avance lateral para cargarlo y auditarlo.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCycleCountReportModal(true)}
                          className="text-[11px] font-bold bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg transition shrink-0 cursor-pointer flex items-center gap-1.5"
                        >
                          <Printer className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Reporte ({activeSessionSkus.length})</span>
                        </button>
                      </div>
                      <BarcodeConsole
                        bins={bins}
                        inventory={inventory}
                        orders={orders}
                        onFullSync={handleBarcodeConsoleSync}
                        onLogCountSession={handleCountCycleSession}
                        initialModule="conteo"
                        hideModuleSelector={true}
                        hideHeader={true}
                        selectedBarcode={selectedBarcodeForCount}
                        onAddInventory={handleAddInventory}
                        onNavigateToInventory={() => setActiveTab('inventory')}
                      />
                    </div>

                    {/* Right Column (Cycle Count Session Progress & Donut Chart) */}
                    <div className="space-y-6">
                      {/* Session Progress Card */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-5">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                          <div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider font-mono">
                              Sesión de Conteo Activa
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">Avance de auditoría cíclica de SKUs</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setShowCycleCountReportModal(true)}
                              className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0 shadow-xs"
                              title="Concluir el conteo y generar el reporte para firma"
                            >
                              <Printer className="h-3 w-3 text-emerald-200" />
                              <span>Concluir</span>
                            </button>
                            <button
                              onClick={handleResetActiveSession}
                              className="text-[10px] bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 font-extrabold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0"
                              title="Reiniciar ejercicio de conteo para comenzar una nueva sesión"
                            >
                              Reiniciar
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-5 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                          {/* Donut Chart */}
                          <div className="relative flex items-center justify-center h-24 w-24 shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    { name: 'Auditados', value: activeSessionSkus.length || 0 },
                                    { name: 'Pendientes', value: Math.max(0, inventory.length - activeSessionSkus.length) || (inventory.length === 0 ? 1 : 0) }
                                  ]}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={28}
                                  outerRadius={38}
                                  startAngle={90}
                                  endAngle={-270}
                                  paddingAngle={activeSessionSkus.length > 0 && activeSessionSkus.length < inventory.length ? 3 : 0}
                                  dataKey="value"
                                >
                                  <Cell fill="#10b981" stroke="#ffffff" strokeWidth={1} />
                                  <Cell fill="#f1f5f9" stroke="#cbd5e1" strokeWidth={1} />
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute flex flex-col items-center justify-center text-center">
                              <span className="text-lg font-black text-slate-800 font-mono leading-none">
                                {percentage}%
                              </span>
                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                Avance
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex justify-between text-xs font-semibold text-slate-600">
                              <span>Auditados:</span>
                              <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                {activeSessionSkus.length} SKUs
                              </span>
                            </div>
                            <div className="flex justify-between text-xs font-semibold text-slate-600">
                              <span>Pendientes:</span>
                              <span className="font-mono font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                {Math.max(0, inventory.length - activeSessionSkus.length)} SKUs
                              </span>
                            </div>
                            <div className="flex justify-between text-xs font-semibold text-slate-600 border-t border-slate-100 pt-1.5 mt-1">
                              <span>Total Catálogo:</span>
                              <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                {inventory.length} SKUs
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Banner to Conclude and Print Report */}
                        <button
                          type="button"
                          onClick={() => setShowCycleCountReportModal(true)}
                          className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs border border-slate-800"
                        >
                          <FileCheck className="h-4 w-4 text-emerald-400" />
                          <span>Concluir Conteo y Generar Acta ({activeSessionSkus.length} SKUs)</span>
                        </button>

                        {/* Search and SKU list */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">
                              Estatus de SKUs
                            </span>
                            <span className="text-[9px] text-slate-400 italic">Clic para auditar</span>
                          </div>
                          
                          <div className="border border-slate-200/60 rounded-xl divide-y divide-slate-100 overflow-y-auto max-h-[280px] bg-white">
                            {inventory.map(item => {
                              const isCounted = activeSessionSkus.includes(item.sku);
                              return (
                                <button
                                  key={item.sku}
                                  type="button"
                                  onClick={() => setSelectedBarcodeForCount(item.barcode || item.sku)}
                                  className={`w-full text-left p-3 flex items-center justify-between hover:bg-slate-50/80 transition cursor-pointer select-none ${
                                    selectedBarcodeForCount === (item.barcode || item.sku) ? 'bg-indigo-50/40 border-l-2 border-indigo-500' : ''
                                  }`}
                                >
                                  <div className="min-w-0 flex-1 pr-2">
                                    <span className="font-mono font-bold text-[11px] text-slate-800 block truncate">
                                      {item.sku}
                                    </span>
                                    <span className="text-[9px] text-slate-500 block truncate leading-none mt-0.5 font-medium">
                                      {item.name}
                                    </span>
                                  </div>
                                  <div className="shrink-0 flex items-center gap-1.5">
                                    <span className="text-[9px] font-mono text-slate-400 font-semibold bg-slate-50 border border-slate-200/40 px-1.5 py-0.5 rounded">
                                      {item.qty}u
                                    </span>
                                    {isCounted ? (
                                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                                        <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Listo
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded shrink-0">
                                        Pendiente
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex flex-wrap justify-between items-center border-b border-slate-100 pb-3 gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                          Sesiones de Conteo Cíclico y Ajustes Realizados
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Historial inmutable de auditorías y discrepancias detectadas</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCycleCountReportModal(true)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Printer className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Imprimir Acta de Auditoría</span>
                        </button>
                      </div>
                    </div>
                    
                    {countedSessions.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        No se han registrado discrepancias ni sesiones de conteo cíclico en este período.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                              <th className="pb-3 pt-1">SKU Producto</th>
                              <th className="pb-3 pt-1">Fecha de Auditoría</th>
                              <th className="pb-3 pt-1 text-right">Físico</th>
                              <th className="pb-3 pt-1 text-right">Sistema</th>
                              <th className="pb-3 pt-1 text-right">Desviación</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {countedSessions.map((session, idx) => {
                              return (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="py-3 font-mono font-bold text-slate-900">{session.sku}</td>
                                  <td className="py-3 text-slate-400">
                                    {new Date(session.date).toLocaleString('es-ES', {
                                      year: 'numeric', month: '2-digit', day: '2-digit',
                                      hour: '2-digit', minute: '2-digit'
                                    })}
                                  </td>
                                  <td className="py-3 text-right font-mono font-semibold">{session.physical} uds</td>
                                  <td className="py-3 text-right font-mono text-slate-400">{session.system} uds</td>
                                  <td className="py-3 text-right font-mono">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      session.deviation === 0
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                        : session.deviation > 0
                                          ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                          : 'bg-rose-50 text-rose-600 border border-rose-100'
                                    }`}>
                                      {session.deviation === 0 
                                        ? 'Alineado (✓)' 
                                        : `${session.deviation > 0 ? '+' : ''}${session.deviation} uds`
                                      }
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Cycle Count Report Modal */}
              <CycleCountReportModal
                isOpen={showCycleCountReportModal || conteosSubTab === 'report'}
                onClose={() => {
                  setShowCycleCountReportModal(false);
                  if (conteosSubTab === 'report') {
                    setConteosSubTab('scan');
                  }
                }}
                inventory={inventory}
                bins={bins}
                countedSessions={countedSessions}
                activeSessionSkus={activeSessionSkus}
                activeOperator={activeOperator}
                onConcludeAndArchive={handleConcludeAuditSession}
              />
            </div>
          )}

          {activeTab === 'movimientos' && (
            <MovementsManager
              bins={bins}
              inventory={inventory}
              logs={logs}
              onUpdateBins={handleUpdateBins}
              activeOperatorName={activeOperator ? `${activeOperator.name} (${activeOperator.role})` : 'Administrador de Logística'}
            />
          )}

          {activeTab === 'etiquetas' && (
            <LabelStation
              inventory={inventory}
            />
          )}

          {activeTab === 'map' && (
            <WarehouseMap
              bins={bins}
              selectedBin={selectedBin}
              onSelectBin={setSelectedBin}
              activePath={activePickingPath}
              onUpdateBins={handleUpdateBins}
              isReadOnly={isReadOnly}
              userRole={platformRole}
              inventory={inventory}
              onNavigateToDashboard={() => setActiveTab('dashboard')}
            />
          )}

           {activeTab === 'inventory' && (
            <InventoryManager
              inventory={inventory}
              onAddInventory={handleAddInventory}
              onDeleteInventory={handleDeleteInventory}
              onUpdateInventoryQty={handleUpdateInventoryQty}
              onUpdateInventoryItem={handleUpdateInventoryItem}
              logs={logs}
              orders={orders}
              isReadOnly={isReadOnly}
              onNavigateToMetrics={(sku) => {
                if (sku) localStorage.setItem('owms_selected_trend_sku', sku);
                setActiveTab('dashboard');
              }}
            />
          )}

          {activeTab === 'alertas' && (
            <AlertsManager
              inventory={inventory}
              bins={bins}
            />
          )}

          {(activeTab === 'configuracion' || activeTab === 'crew' || activeTab === 'manual' || activeTab === 'warehouses') && (
            <ConfigurationHub
              theme={platformTheme}
              onUpdateTheme={handleUpdatePlatformTheme}
              onResetTheme={handleResetPlatformTheme}
              activeOperator={activeOperator}
              onSelectOperator={handleSelectOperator}
              platformUser={user}
              initialSection={activeTab === 'crew' ? 'crew' : activeTab === 'manual' ? 'manual' : activeTab === 'warehouses' ? 'warehouses' : 'warehouses'}
              onNavigateToTab={setActiveTab}
            />
          )}

        </main>
      </div>
    </div>
  );
}
