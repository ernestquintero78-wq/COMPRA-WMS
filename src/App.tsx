import React, { useState, useEffect, FormEvent } from 'react';
import {
  fetchWMSData,
  saveWMSSupabaseData,
  appendActivityLog
} from './supabaseService';
import { Bin, InventoryItem, Order, ActivityLog, CycleCountSession } from './types';
import { WarehouseMap } from './components/WarehouseMap';
import { Dashboard } from './components/Dashboard';
import { PutawayOptimizer } from './components/PutawayOptimizer';
import { OrdersManager } from './components/OrdersManager';
import { InventoryManager } from './components/InventoryManager';
import { BarcodeConsole } from './components/BarcodeConsole';
import { PickingConsole } from './components/PickingConsole';
import { PalletStandardizer } from './components/PalletStandardizer';
import { CrewManager, OperatorProfile } from './components/CrewManager';
import { LabelStation } from './components/LabelStation';
import { KanbanBoard } from './components/KanbanBoard';
import ReportsCenter from './components/ReportsCenter';
import { MovementsManager } from './components/MovementsManager';
import { UserManual } from './components/UserManual';
import { AlertsManager } from './components/AlertsManager';
import { Login } from './components/Login';
import { BusinessLinesManager } from './components/BusinessLinesManager';
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
  Layers,
  UserCheck,
  Printer,
  Compass,
  Trello,
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardCheck,
  FileDown,
  Move,
  BookOpen,
  Check,
  EyeOff,
  Undo2
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any>(() => {
    const saved = sessionStorage.getItem('OWMS_SESSION_USER');
    return saved ? JSON.parse(saved) : null;
  });

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
  const [salidasSubTab, setSalidasSubTab] = useState<'orders' | 'scan'>('orders');
  const [conteosSubTab, setConteosSubTab] = useState<'scan' | 'history'>('scan');
  const [pickPackSubTab, setPickPackSubTab] = useState<'picking' | 'kanban'>('picking');

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
      setInventory(data.inventory);
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
      i.imageUrl || ''
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
    const updatedInventory = [...inventory, item];
    setInventory(updatedInventory);

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-blue-600 selection:text-white antialiased">
      
      {/* Top operational menu header bar */}
      <header className="bg-white border-b border-slate-200/50 sticky top-0 z-30 px-6 py-3 flex items-center justify-between shadow-xs select-none">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow shadow-blue-600/10">
            <Boxes className="h-5.5 w-5.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-sans leading-none">
              <span className="font-extrabold text-slate-800 tracking-tight text-sm">O-WMS PRO</span>
              <span className="text-[9px] font-bold font-mono bg-blue-50 border border-blue-200 px-1 py-0.5 rounded text-blue-600">v1.2</span>
            </div>
            <p className="text-[10px] text-slate-400 tracking-wide font-medium mt-1">
              Conectado: {user?.displayName || 'Admin de Logística'}
            </p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-4 text-xs font-semibold uppercase leading-none">
          
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

      <div className="flex-1 flex flex-col md:flex-row">
        
        {/* Navigation Sidebar Panel Controls */}
        <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 text-slate-300 p-5 shrink-0 flex flex-col justify-between gap-6 relative select-none">
          <div className="space-y-6">
            
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
                  { id: 'pick_pack', label: 'Pick and Pack', icon: Trello },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold leading-none flex items-center gap-2.5 transition cursor-pointer ${
                        isActive 
                          ? 'bg-blue-600 text-white shadow shadow-blue-600/10' 
                          : 'hover:bg-slate-800 hover:text-slate-100'
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
                  { id: 'reports', label: 'Centro de Reportes', icon: FileDown },
                  { id: 'negocios', label: 'Líneas de Negocio', icon: Briefcase },
                  { id: 'map', label: 'Mapa del Almacén', icon: MapPin },
                  { id: 'crew', label: 'Registro de Personal', icon: UserCheck },
                  { id: 'inventory', label: 'Registro de SKU', icon: Package },
                  { id: 'etiquetas', label: 'Estación de Etiquetas', icon: Printer },
                  { id: 'tarimas', label: 'Fichas de Tarimas', icon: Layers },
                  { id: 'alertas', label: 'Gestión de Alertas', icon: ShieldAlert },
                  { id: 'manual', label: 'Manual de Usuario', icon: BookOpen },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-semibold leading-none flex items-center gap-2.5 transition cursor-pointer ${
                        isActive 
                          ? 'bg-slate-800 text-white border border-slate-700/50' 
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

        {/* Content Viewport Frame */}
        <main className="flex-1 p-6 md:p-8 space-y-6 max-w-full">
          
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
              return (
                <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-emerald-800 font-mono">
                      TODAS LAS ALERTAS OPERATIVAS ({allSystemAlerts.length}) HAN SIDO RESUELTAS O DESCARTADAS
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setDismissedAlerts([]);
                      localStorage.removeItem('wms_dismissed_alerts');
                    }}
                    className="text-xs font-bold font-mono text-emerald-700 hover:text-emerald-900 bg-white hover:bg-emerald-100/50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Reactivar todas
                  </button>
                </div>
              );
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
                  <div className="flex items-center gap-2">
                    {dismissedCount > 0 && (
                      <button
                        onClick={() => {
                          setDismissedAlerts([]);
                          localStorage.removeItem('wms_dismissed_alerts');
                        }}
                        className="text-[10px] font-mono font-bold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all"
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
                              ¿Desea despachar el pedido <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">{alert.orderId}</code> inmediatamente?
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
                                    setStatusMsg(`Pedido ${alert.orderId} despachado con éxito.`);
                                  }
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold font-mono shadow-sm transition-all"
                              >
                                Sí, Despachar
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
                      <strong>Escaneo de Recepción de Materiales:</strong> Escanee códigos de barras de productos entrantes para asignarlos directamente a celdas libres o recomendadas.
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
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <ArrowUpRight className="h-6 w-6 text-amber-600 bg-amber-50 p-1 rounded-lg" />
                    Operación de Salidas (Outbound)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Consulte pedidos de despacho pendientes y realice la validación de salida de mercancía por escáner.
                  </p>
                </div>
                
                {/* Sub-navigation pill selector */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 select-none">
                  <button
                    onClick={() => setSalidasSubTab('orders')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      salidasSubTab === 'orders'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Cola de Pedidos
                  </button>
                  <button
                    onClick={() => setSalidasSubTab('scan')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      salidasSubTab === 'scan'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Despacho por Escáner
                  </button>
                </div>
              </div>

              {salidasSubTab === 'orders' ? (
                <OrdersManager
                  orders={orders}
                  inventory={inventory}
                  bins={bins}
                  onCreateOrder={handleCreateOrder}
                  onOptimizeOrderPath={handleOptimizeOrderPath}
                  onCompleteOrder={handleCompleteOrder}
                />
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50/50 border border-amber-150 rounded-2xl text-xs text-amber-800 flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                    <p className="font-semibold">
                      <strong>Validación e Identificación de Salidas:</strong> Confirme las unidades a despachar escaneando el código del artículo y asociándolo a la orden activa correspondiente.
                    </p>
                  </div>
                  <BarcodeConsole
                    bins={bins}
                    inventory={inventory}
                    orders={orders}
                    onFullSync={handleBarcodeConsoleSync}
                    onLogCountSession={handleCountCycleSession}
                    initialModule="salida"
                    hideModuleSelector={true}
                    hideHeader={true}
                  />
                </div>
              )}
            </div>
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
                
                {/* Sub-navigation pill selector */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 select-none">
                  <button
                    onClick={() => setConteosSubTab('scan')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      conteosSubTab === 'scan'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Efectuar Conteo
                  </button>
                  <button
                    onClick={() => setConteosSubTab('history')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      conteosSubTab === 'history'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Historial de Desviaciones
                  </button>
                </div>
              </div>

              {(() => {
                const percentage = inventory.length > 0 ? Math.round((activeSessionSkus.length / inventory.length) * 100) : 0;
                return conteosSubTab === 'scan' ? (
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Left Column (Main Scanner Terminal) */}
                    <div className="xl:col-span-2 space-y-4">
                      <div className="p-4 bg-emerald-50/50 border border-emerald-150 rounded-2xl text-xs text-emerald-800 flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                        <p className="font-semibold">
                          <strong>Auditoría de Stock en Vivo:</strong> Escanee el código de barras o haga clic en un SKU de la lista de avance lateral para cargarlo y auditarlo.
                        </p>
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
                          <button
                            onClick={handleResetActiveSession}
                            className="text-[10px] bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 font-extrabold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0"
                            title="Reiniciar ejercicio de conteo para comenzar una nueva sesión"
                          >
                            Reiniciar Sesión
                          </button>
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
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                        Sesiones de Conteo Cíclico y Ajustes Realizados
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400">Orden Cronológico</span>
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
            </div>
          )}

          {activeTab === 'pick_pack' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <Trello className="h-6 w-6 text-purple-600 bg-purple-50 p-1 rounded-lg" />
                    Pick and Pack (Surtido y Empaque)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Optimice las rutas físicas para recolectar productos en el almacén y gestione el empaque de pedidos finalizados.
                  </p>
                </div>
                
                {/* Sub-navigation pill selector */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 select-none">
                  <button
                    onClick={() => setPickPackSubTab('picking')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      pickPackSubTab === 'picking'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Ruta de Picking
                  </button>
                  <button
                    onClick={() => setPickPackSubTab('kanban')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      pickPackSubTab === 'kanban'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tablero de Empaque
                  </button>
                </div>
              </div>

              {pickPackSubTab === 'picking' ? (
                <PickingConsole
                  bins={bins}
                  inventory={inventory}
                  orders={orders}
                  activeOperatorName={activeOperator ? activeOperator.name : 'Administrador'}
                  onFullSync={handleBarcodeConsoleSync}
                />
              ) : (
                <KanbanBoard
                  orders={orders}
                  inventory={inventory}
                  bins={bins}
                  onCompleteOrder={handleCompleteOrder}
                />
              )}
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

          {activeTab === 'tarimas' && (
            <PalletStandardizer
              inventory={inventory}
            />
          )}

          {activeTab === 'crew' && (
            <CrewManager
              activeOperator={activeOperator}
              onSelectOperator={handleSelectOperator}
              platformUser={user}
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
            />
          )}

          {activeTab === 'negocios' && (
            <BusinessLinesManager
              bins={bins}
              inventory={inventory}
              onUpdateInventoryItem={handleUpdateInventoryItem}
              onAddInventory={handleAddInventory}
              onUpdateBins={handleUpdateBins}
            />
          )}

          {activeTab === 'alertas' && (
            <AlertsManager
              inventory={inventory}
              bins={bins}
            />
          )}

          {activeTab === 'manual' && (
            <UserManual />
          )}

        </main>
      </div>
    </div>
  );
}
