import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  ExternalWarehouse, 
  ExternalInventoryItem, 
  ExternalTransaction, 
  InventoryItem, 
  Bin,
  PlatformTheme 
} from '../types';
import { ArticleSuggestionInput } from './ArticleSuggestionInput';
import { 
  Building2, 
  Package, 
  ArrowDownLeft, 
  ArrowUpRight, 
  FileText, 
  Printer, 
  Download, 
  Plus, 
  Search, 
  MapPin, 
  User, 
  Phone, 
  Mail, 
  Truck, 
  AlertTriangle, 
  CheckCircle2, 
  Boxes, 
  Calendar, 
  Clock, 
  DollarSign, 
  Filter, 
  RefreshCw,
  X,
  FileSpreadsheet,
  ChevronRight,
  ShieldCheck,
  Store,
  Layers,
  Edit2,
  Trash2,
  Check,
  ArrowRightLeft
} from 'lucide-react';

interface ExternalWarehouseManagerProps {
  inventory: InventoryItem[];
  bins: Bin[];
  activeOperatorName: string;
  platformTheme: PlatformTheme;
  onCentralExternalTransfer?: (transferData: {
    type: 'to_external' | 'from_external';
    sku: string;
    qty: number;
    warehouseName: string;
    referenceDoc?: string;
  }) => Promise<void>;
}

const INITIAL_EXTERNAL_WAREHOUSES: ExternalWarehouse[] = [
  {
    id: 'wh-ext-01',
    code: 'EXT-01',
    name: 'Almacén Satélite Norte - Tultitlán',
    address: 'Av. Industrial No. 402, Parque Industrial San Mateo',
    city: 'Tultitlán, Estado de México',
    type: 'Satélite',
    manager: 'Roberto Sánchez Méndez',
    phone: '+52 55 5871 9020',
    email: 'rsanchez@almacen-tultitlan.com',
    status: 'Activo',
    notes: 'Punto de cross-docking y distribución regional hacia la zona metropolitana norte.',
    createdAt: '2026-01-15'
  },
  {
    id: 'wh-ext-02',
    code: 'EXT-02',
    name: 'Bodega Logística 3PL - Monterrey',
    address: 'Carretera Miguel Alemán Km 18.5, Módulo D-4',
    city: 'Apodaca, Nuevo León',
    type: '3PL / Tercero',
    manager: 'Laura Patricia Garza',
    phone: '+52 81 8390 4410',
    email: 'lgarza@logistica3pl-mty.com',
    status: 'Activo',
    notes: 'Operador logístico tercerizado para materiales pesados y baterías industriales.',
    createdAt: '2026-02-01'
  },
  {
    id: 'wh-ext-03',
    code: 'EXT-03',
    name: 'Depósito de Obra / Proyecto Bajío',
    address: 'Blvd. Aeropuerto 1200, Parque San José',
    city: 'Silao, Guanajuato',
    type: 'Obra / Proyecto',
    manager: 'Ing. Carlos Villarreal',
    phone: '+52 472 722 3100',
    email: 'cvillarreal@proyectobajio.mx',
    status: 'Activo',
    notes: 'Depósito en sitio temporal para suministro de sensores y controladores de ensamble.',
    createdAt: '2026-02-20'
  }
];

const INITIAL_EXTERNAL_INVENTORY: ExternalInventoryItem[] = [
  {
    id: 'einv-01',
    warehouseId: 'wh-ext-01',
    sku: 'ROB-CPU-i7',
    name: 'Industrial Controller i7',
    description: 'Heavy-duty processing module for CNC & robotic units',
    category: 'Electronics',
    qty: 24,
    minQty: 8,
    unitWeight: 4.5,
    cost: 350.50,
    locationInWarehouse: 'Rack A1 - Tarima 04',
    barcode: '7501020304012',
    updatedAt: '2026-04-10'
  },
  {
    id: 'einv-02',
    warehouseId: 'wh-ext-01',
    sku: 'SENS-PROX-24',
    name: 'Inductive Proximity Sensor 24V',
    description: 'Stainless steel cylindrical M12 sensing unit',
    category: 'Electronics',
    qty: 65,
    minQty: 15,
    unitWeight: 0.15,
    cost: 45.00,
    locationInWarehouse: 'Estante B2 - Gaveta 12',
    barcode: '7501020304036',
    updatedAt: '2026-04-12'
  },
  {
    id: 'einv-03',
    warehouseId: 'wh-ext-02',
    sku: 'BATT-LIPO-SM',
    name: 'LiPo Battery Pack 12V',
    description: 'High capacity lithium polymer cells for smart power systems',
    category: 'Hazmat',
    qty: 90,
    minQty: 25,
    unitWeight: 0.8,
    cost: 78.00,
    locationInWarehouse: 'Cámara Antifuego Zona Hazmat',
    barcode: '7501020304029',
    updatedAt: '2026-04-14'
  },
  {
    id: 'einv-04',
    warehouseId: 'wh-ext-02',
    sku: 'CAB-IND-SHLD',
    name: 'Shielded Control Cable 100m',
    description: 'Flexible multi-core copper wire with foil shield',
    category: 'Cables & Wiring',
    qty: 35,
    minQty: 10,
    unitWeight: 3.2,
    cost: 95.00,
    locationInWarehouse: 'Bahía C1 - Carretes',
    barcode: '7501020304043',
    updatedAt: '2026-04-11'
  },
  {
    id: 'einv-05',
    warehouseId: 'wh-ext-03',
    sku: 'ROB-CPU-i7',
    name: 'Industrial Controller i7',
    description: 'Heavy-duty processing module for CNC & robotic units',
    category: 'Electronics',
    qty: 12,
    minQty: 5,
    unitWeight: 4.5,
    cost: 350.50,
    locationInWarehouse: 'Caseta Obra - Estante 1',
    barcode: '7501020304012',
    updatedAt: '2026-04-15'
  }
];

const INITIAL_EXTERNAL_TRANSACTIONS: ExternalTransaction[] = [
  {
    id: 'EXT-IN-1001',
    warehouseId: 'wh-ext-01',
    type: 'Entrada',
    sku: 'ROB-CPU-i7',
    productName: 'Industrial Controller i7',
    qty: 24,
    sourceOrDestination: 'Almacén Central (Traspaso)',
    carrierOrDelivery: 'Camión Unidad Propia WMS #04',
    referenceDoc: 'TRASPASO-TRK-9801',
    notes: 'Recepción completa para abasto semanal regional.',
    operator: 'Roberto Sánchez Méndez',
    timestamp: '2026-04-10T10:30:00.000Z'
  },
  {
    id: 'EXT-IN-1002',
    warehouseId: 'wh-ext-02',
    type: 'Entrada',
    sku: 'BATT-LIPO-SM',
    productName: 'LiPo Battery Pack 12V',
    qty: 100,
    sourceOrDestination: 'Proveedor AmpGen Power Solutions',
    carrierOrDelivery: 'Flete Consolidado Castores',
    referenceDoc: 'FAC-AMP-2026-88',
    notes: 'Entrega directa de proveedor en almacén 3PL.',
    operator: 'Laura Patricia Garza',
    timestamp: '2026-04-11T14:15:00.000Z'
  },
  {
    id: 'EXT-OUT-2001',
    warehouseId: 'wh-ext-02',
    type: 'Salida',
    sku: 'BATT-LIPO-SM',
    productName: 'LiPo Battery Pack 12V',
    qty: 10,
    sourceOrDestination: 'Cliente Automotriz San Nicolás',
    carrierOrDelivery: 'Reparto Express MTY',
    referenceDoc: 'REM-OUT-4401',
    notes: 'Salida de emergencia para línea de producción.',
    operator: 'Laura Patricia Garza',
    timestamp: '2026-04-14T09:45:00.000Z'
  }
];

export function getStoredExternalWarehouses(): ExternalWarehouse[] {
  try {
    const saved = localStorage.getItem('OWMS_EXTERNAL_WAREHOUSES');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return INITIAL_EXTERNAL_WAREHOUSES;
}

export function getStoredExternalTransactions(): ExternalTransaction[] {
  try {
    const saved = localStorage.getItem('OWMS_EXTERNAL_TRANSACTIONS');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return INITIAL_EXTERNAL_TRANSACTIONS;
}

export function getStoredExternalInventory(): ExternalInventoryItem[] {
  try {
    const saved = localStorage.getItem('OWMS_EXTERNAL_INVENTORY');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return INITIAL_EXTERNAL_INVENTORY;
}

export const ExternalWarehouseManager: React.FC<ExternalWarehouseManagerProps> = ({
  inventory,
  bins,
  activeOperatorName,
  platformTheme,
  onCentralExternalTransfer
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'almacenes' | 'inventario' | 'entradas' | 'salidas' | 'movimientos' | 'reportes'>('inventario');

  // Warehouses state
  const [warehouses, setWarehouses] = useState<ExternalWarehouse[]>(() => {
    try {
      const saved = localStorage.getItem('OWMS_EXTERNAL_WAREHOUSES');
      return saved ? JSON.parse(saved) : INITIAL_EXTERNAL_WAREHOUSES;
    } catch (e) {
      return INITIAL_EXTERNAL_WAREHOUSES;
    }
  });

  // Inventory in external warehouses
  const [extInventory, setExtInventory] = useState<ExternalInventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('OWMS_EXTERNAL_INVENTORY');
      return saved ? JSON.parse(saved) : INITIAL_EXTERNAL_INVENTORY;
    } catch (e) {
      return INITIAL_EXTERNAL_INVENTORY;
    }
  });

  // Movement transactions
  const [transactions, setTransactions] = useState<ExternalTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('OWMS_EXTERNAL_TRANSACTIONS');
      return saved ? JSON.parse(saved) : INITIAL_EXTERNAL_TRANSACTIONS;
    } catch (e) {
      return INITIAL_EXTERNAL_TRANSACTIONS;
    }
  });

  // Selected warehouse filter ('all' or id)
  const [selectedWhFilter, setSelectedWhFilter] = useState<string>('all');
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');

  // Persist state
  useEffect(() => {
    try {
      localStorage.setItem('OWMS_EXTERNAL_WAREHOUSES', JSON.stringify(warehouses));
      window.dispatchEvent(new CustomEvent('wms_external_warehouses_updated'));
    } catch (e) {}
  }, [warehouses]);

  useEffect(() => {
    try {
      localStorage.setItem('OWMS_EXTERNAL_INVENTORY', JSON.stringify(extInventory));
      window.dispatchEvent(new CustomEvent('wms_external_inventory_updated'));
    } catch (e) {}
  }, [extInventory]);

  useEffect(() => {
    try {
      localStorage.setItem('OWMS_EXTERNAL_TRANSACTIONS', JSON.stringify(transactions));
      window.dispatchEvent(new CustomEvent('wms_external_transactions_updated'));
    } catch (e) {}
  }, [transactions]);

  // Form states for New Warehouse Modal
  const [showNewWhModal, setShowNewWhModal] = useState(false);
  const [newWhCode, setNewWhCode] = useState('');
  const [newWhName, setNewWhName] = useState('');
  const [newWhAddress, setNewWhAddress] = useState('');
  const [newWhCity, setNewWhCity] = useState('');
  const [newWhType, setNewWhType] = useState<ExternalWarehouse['type']>('Satélite');
  const [newWhManager, setNewWhManager] = useState('');
  const [newWhPhone, setNewWhPhone] = useState('');
  const [newWhEmail, setNewWhEmail] = useState('');
  const [newWhNotes, setNewWhNotes] = useState('');

  // Form states for Edit / Rename Warehouse Modal
  const [editingWarehouse, setEditingWarehouse] = useState<ExternalWarehouse | null>(null);
  const [editWhCode, setEditWhCode] = useState('');
  const [editWhName, setEditWhName] = useState('');
  const [editWhAddress, setEditWhAddress] = useState('');
  const [editWhCity, setEditWhCity] = useState('');
  const [editWhType, setEditWhType] = useState<ExternalWarehouse['type']>('Satélite');
  const [editWhManager, setEditWhManager] = useState('');
  const [editWhPhone, setEditWhPhone] = useState('');
  const [editWhEmail, setEditWhEmail] = useState('');
  const [editWhNotes, setEditWhNotes] = useState('');
  const [editWhStatus, setEditWhStatus] = useState<'Activo' | 'Inactivo'>('Activo');

  // Operational toast banner
  const [toastFeedback, setToastFeedback] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastFeedback(msg);
    setTimeout(() => {
      setToastFeedback(null);
    }, 4500);
  };

  // Form states for Entradas (Inbound)
  const [inboundWhId, setInboundWhId] = useState<string>(() => warehouses[0]?.id || '');
  const [inboundSkuQuery, setInboundSkuQuery] = useState('');
  const [inboundSelectedProduct, setInboundSelectedProduct] = useState<InventoryItem | null>(null);
  const [inboundQty, setInboundQty] = useState<number>(10);
  const [inboundSource, setInboundSource] = useState('Almacén Central (Traspaso)');
  const [inboundCarrier, setInboundCarrier] = useState('');
  const [inboundRefDoc, setInboundRefDoc] = useState('');
  const [inboundLocation, setInboundLocation] = useState('Zona A - Estante 1');
  const [inboundNotes, setInboundNotes] = useState('');
  const [inboundFeedback, setInboundFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Form states for Salidas (Outbound)
  const [outboundWhId, setOutboundWhId] = useState<string>(() => warehouses[0]?.id || '');
  const [outboundSkuQuery, setOutboundSkuQuery] = useState('');
  const [outboundSelectedProduct, setOutboundSelectedProduct] = useState<ExternalInventoryItem | null>(null);
  const [outboundQty, setOutboundQty] = useState<number>(1);
  const [outboundDestination, setOutboundDestination] = useState('Cliente / Obra');
  const [outboundCarrier, setOutboundCarrier] = useState('');
  const [outboundRefDoc, setOutboundRefDoc] = useState('');
  const [outboundNotes, setOutboundNotes] = useState('');
  const [outboundFeedback, setOutboundFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Print Report modal states
  const [reportModalType, setReportModalType] = useState<'inventory' | 'transactions' | 'voucher' | null>(null);
  const [selectedVoucherTx, setSelectedVoucherTx] = useState<ExternalTransaction | null>(null);

  // Filtered inventory
  const filteredInventory = useMemo(() => {
    return extInventory.filter(item => {
      const matchWh = selectedWhFilter === 'all' || item.warehouseId === selectedWhFilter;
      if (!matchWh) return false;

      if (!inventorySearchQuery.trim()) return true;
      const q = inventorySearchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q) ||
        (item.locationInWarehouse && item.locationInWarehouse.toLowerCase().includes(q))
      );
    });
  }, [extInventory, selectedWhFilter, inventorySearchQuery]);

  // Aggregate stats
  const totalUnitsInExt = useMemo(() => {
    return extInventory.reduce((sum, item) => sum + (item.qty || 0), 0);
  }, [extInventory]);

  const totalValueInExt = useMemo(() => {
    return extInventory.reduce((sum, item) => sum + ((item.qty || 0) * (item.cost || 0)), 0);
  }, [extInventory]);

  const totalSKUsInExt = useMemo(() => {
    return new Set(extInventory.map(i => i.sku)).size;
  }, [extInventory]);

  // Available inventory in the warehouse selected for Salidas
  const availableItemsForOutbound = useMemo(() => {
    return extInventory.filter(item => item.warehouseId === outboundWhId && item.qty > 0);
  }, [extInventory, outboundWhId]);

  // Switch context handler
  const handleSelectWarehouseContext = (whId: string) => {
    setSelectedWhFilter(whId);
    if (whId !== 'all') {
      setInboundWhId(whId);
      setOutboundWhId(whId);
      const targetWh = warehouses.find(w => w.id === whId);
      if (targetWh) {
        showToast(`✓ Contexto cambiado: Ahora operando en [${targetWh.code}] ${targetWh.name}`);
      }
    } else {
      showToast('✓ Vista cambiada: Modo consolidado de todos los almacenes');
    }
  };

  // Create new warehouse handler
  const handleCreateWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhName.trim() || !newWhCode.trim()) return;

    const newId = `wh-ext-${Date.now()}`;
    const newWh: ExternalWarehouse = {
      id: newId,
      code: newWhCode.trim().toUpperCase(),
      name: newWhName.trim(),
      address: newWhAddress.trim() || 'Dirección sin especificar',
      city: newWhCity.trim() || 'Ciudad',
      type: newWhType,
      manager: newWhManager.trim() || activeOperatorName,
      phone: newWhPhone.trim() || '',
      email: newWhEmail.trim() || '',
      status: 'Activo',
      notes: newWhNotes.trim(),
      createdAt: new Date().toISOString().split('T')[0]
    };

    setWarehouses(prev => [...prev, newWh]);
    setSelectedWhFilter(newId);
    setInboundWhId(newId);
    setOutboundWhId(newId);
    setShowNewWhModal(false);
    showToast(`✓ Almacén "${newWh.name}" [${newWh.code}] registrado y seleccionado.`);

    // Reset
    setNewWhCode('');
    setNewWhName('');
    setNewWhAddress('');
    setNewWhCity('');
    setNewWhManager('');
    setNewWhPhone('');
    setNewWhEmail('');
    setNewWhNotes('');
  };

  // Start editing a warehouse
  const startEditingWarehouse = (wh: ExternalWarehouse) => {
    setEditingWarehouse(wh);
    setEditWhCode(wh.code);
    setEditWhName(wh.name);
    setEditWhType(wh.type);
    setEditWhAddress(wh.address);
    setEditWhCity(wh.city);
    setEditWhManager(wh.manager);
    setEditWhPhone(wh.phone);
    setEditWhEmail(wh.email);
    setEditWhNotes(wh.notes || '');
    setEditWhStatus(wh.status);
  };

  // Save edited warehouse (rename / update info)
  const handleUpdateWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse || !editWhName.trim() || !editWhCode.trim()) return;

    const updatedCode = editWhCode.trim().toUpperCase();
    const updatedName = editWhName.trim();

    setWarehouses(prev => prev.map(w => {
      if (w.id === editingWarehouse.id) {
        return {
          ...w,
          code: updatedCode,
          name: updatedName,
          type: editWhType,
          address: editWhAddress.trim() || w.address,
          city: editWhCity.trim() || w.city,
          manager: editWhManager.trim() || w.manager,
          phone: editWhPhone.trim(),
          email: editWhEmail.trim(),
          notes: editWhNotes.trim(),
          status: editWhStatus
        };
      }
      return w;
    }));

    showToast(`✓ Almacén actualizado: [${updatedCode}] ${updatedName}`);
    setEditingWarehouse(null);
  };

  // Delete warehouse
  const handleDeleteWarehouse = (whId: string) => {
    const wh = warehouses.find(w => w.id === whId);
    if (!wh) return;

    if (warehouses.length <= 1) {
      alert('Debe conservar al menos un almacén externo registrado en el sistema.');
      return;
    }

    const hasStock = extInventory.some(i => i.warehouseId === whId && (i.qty || 0) > 0);
    const confirmMsg = hasStock
      ? `El almacén "${wh.name}" [${wh.code}] tiene existencias activas en el inventario. ¿Confirma que desea eliminar este almacén del sistema?`
      : `¿Confirma que desea eliminar el almacén "${wh.name}" [${wh.code}]?`;

    if (window.confirm(confirmMsg)) {
      const remaining = warehouses.filter(w => w.id !== whId);
      setWarehouses(remaining);
      if (selectedWhFilter === whId) {
        setSelectedWhFilter(remaining[0]?.id || 'all');
      }
      if (inboundWhId === whId) {
        setInboundWhId(remaining[0]?.id || '');
      }
      if (outboundWhId === whId) {
        setOutboundWhId(remaining[0]?.id || '');
      }
      showToast(`Almacén "${wh.name}" eliminado del catálogo.`);
    }
  };

  // Submit Inbound (Entrada)
  const handleProcessInbound = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inboundWhId) {
      setInboundFeedback({ type: 'err', text: 'Por favor seleccione el almacén externo destino.' });
      return;
    }
    if (!inboundSelectedProduct) {
      setInboundFeedback({ type: 'err', text: 'Por favor seleccione o escanee el artículo que ingresa.' });
      return;
    }
    if (inboundQty <= 0) {
      setInboundFeedback({ type: 'err', text: 'La cantidad a ingresar debe ser mayor a 0.' });
      return;
    }

    const wh = warehouses.find(w => w.id === inboundWhId);
    const folio = `EXT-IN-${Math.floor(1000 + Math.random() * 9000)}`;

    // 1. Update or create inventory in this external warehouse
    setExtInventory(prev => {
      const existingIdx = prev.findIndex(item => item.warehouseId === inboundWhId && item.sku === inboundSelectedProduct.sku);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          qty: updated[existingIdx].qty + inboundQty,
          locationInWarehouse: inboundLocation || updated[existingIdx].locationInWarehouse,
          updatedAt: new Date().toISOString().split('T')[0]
        };
        return updated;
      } else {
        const newItem: ExternalInventoryItem = {
          id: `einv-${Date.now()}`,
          warehouseId: inboundWhId,
          sku: inboundSelectedProduct.sku,
          name: inboundSelectedProduct.name,
          description: inboundSelectedProduct.description || '',
          category: inboundSelectedProduct.category || 'General',
          qty: inboundQty,
          minQty: inboundSelectedProduct.minQty || 10,
          unitWeight: inboundSelectedProduct.unitWeight,
          cost: inboundSelectedProduct.cost || 50,
          locationInWarehouse: inboundLocation || 'Ubicación General',
          barcode: inboundSelectedProduct.barcode,
          updatedAt: new Date().toISOString().split('T')[0]
        };
        return [...prev, newItem];
      }
    });

    // 2. Record transaction
    const newTx: ExternalTransaction = {
      id: folio,
      warehouseId: inboundWhId,
      type: 'Entrada',
      sku: inboundSelectedProduct.sku,
      productName: inboundSelectedProduct.name,
      qty: inboundQty,
      sourceOrDestination: inboundSource || 'Proveedor Externo',
      carrierOrDelivery: inboundCarrier,
      referenceDoc: inboundRefDoc || folio,
      notes: inboundNotes,
      operator: activeOperatorName,
      timestamp: new Date().toISOString()
    };
    setTransactions(prev => [newTx, ...prev]);

    // Cross-module sync: if coming from Central, deduct from Central inventory and bins
    if (inboundSource.toLowerCase().includes('central') && onCentralExternalTransfer) {
      onCentralExternalTransfer({
        type: 'to_external',
        sku: inboundSelectedProduct.sku,
        qty: inboundQty,
        warehouseName: wh?.name || 'Almacén Externo',
        referenceDoc: folio
      });
    }

    setInboundFeedback({
      type: 'ok',
      text: `✓ Entrada registrada exitosamente (Folio: ${folio}). Se agregaron ${inboundQty} unidades de ${inboundSelectedProduct.name} al almacén "${wh?.name}". ${inboundSource.toLowerCase().includes('central') ? 'Inventario y celdas del Almacén Central actualizados.' : ''}`
    });

    // Reset input fields
    setInboundQty(10);
    setInboundSkuQuery('');
    setInboundSelectedProduct(null);
    setInboundRefDoc('');
    setInboundNotes('');
  };

  // Submit Outbound (Salida)
  const handleProcessOutbound = (e: React.FormEvent) => {
    e.preventDefault();
    if (!outboundWhId) {
      setOutboundFeedback({ type: 'err', text: 'Por favor seleccione el almacén externo de origen.' });
      return;
    }
    if (!outboundSelectedProduct) {
      setOutboundFeedback({ type: 'err', text: 'Por favor seleccione el producto a egresar.' });
      return;
    }
    if (outboundQty <= 0) {
      setOutboundFeedback({ type: 'err', text: 'La cantidad debe ser mayor a 0.' });
      return;
    }
    if (outboundQty > outboundSelectedProduct.qty) {
      setOutboundFeedback({ 
        type: 'err', 
        text: `Stock insuficiente: El almacén solo cuenta con ${outboundSelectedProduct.qty} unidades disponibles.` 
      });
      return;
    }

    const wh = warehouses.find(w => w.id === outboundWhId);
    const folio = `EXT-OUT-${Math.floor(2000 + Math.random() * 8000)}`;

    // 1. Deduct stock in external warehouse
    setExtInventory(prev => {
      return prev.map(item => {
        if (item.id === outboundSelectedProduct.id) {
          return {
            ...item,
            qty: Math.max(0, item.qty - outboundQty),
            updatedAt: new Date().toISOString().split('T')[0]
          };
        }
        return item;
      });
    });

    // 2. Record transaction
    const newTx: ExternalTransaction = {
      id: folio,
      warehouseId: outboundWhId,
      type: 'Salida',
      sku: outboundSelectedProduct.sku,
      productName: outboundSelectedProduct.name,
      qty: outboundQty,
      sourceOrDestination: outboundDestination || 'Cliente / Obra',
      carrierOrDelivery: outboundCarrier,
      referenceDoc: outboundRefDoc || folio,
      notes: outboundNotes,
      operator: activeOperatorName,
      timestamp: new Date().toISOString()
    };
    setTransactions(prev => [newTx, ...prev]);

    // Cross-module sync: if transferring to Central, add to Central inventory and bins
    if (outboundDestination.toLowerCase().includes('central') && onCentralExternalTransfer) {
      onCentralExternalTransfer({
        type: 'from_external',
        sku: outboundSelectedProduct.sku,
        qty: outboundQty,
        warehouseName: wh?.name || 'Almacén Externo',
        referenceDoc: folio
      });
    }

    setOutboundFeedback({
      type: 'ok',
      text: `✓ Salida registrada exitosamente (Folio: ${folio}). Se egresaron ${outboundQty} unidades de ${outboundSelectedProduct.name} del almacén "${wh?.name}". ${outboundDestination.toLowerCase().includes('central') ? 'Inventario y celdas del Almacén Central incrementados.' : ''}`
    });

    // Reset
    setOutboundQty(1);
    setOutboundSkuQuery('');
    setOutboundSelectedProduct(null);
    setOutboundRefDoc('');
    setOutboundNotes('');
  };

  // Export inventory to Excel
  const handleExportInventoryExcel = () => {
    try {
      const data = filteredInventory.map(item => {
        const wh = warehouses.find(w => w.id === item.warehouseId);
        return {
          'Código Almacén': wh?.code || '',
          'Almacén Externo': wh?.name || '',
          'Tipo de Almacén': wh?.type || '',
          'SKU': item.sku,
          'Nombre del Artículo': item.name,
          'Descripción': item.description,
          'Categoría': item.category,
          'Ubicación Interna': item.locationInWarehouse || 'N/A',
          'Cantidad en Stock': item.qty,
          'Stock Mínimo': item.minQty,
          'Estatus Stock': item.qty <= item.minQty ? 'BAJO MÍNIMO' : 'ÓPTIMO',
          'Costo Unitario ($)': item.cost || 0,
          'Valor Total ($)': ((item.qty || 0) * (item.cost || 0)).toFixed(2),
          'Código de Barras': item.barcode || 'N/A',
          'Última Actualización': item.updatedAt
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventario_Almacenes_Externos');
      XLSX.writeFile(wb, `Inventario_Almacenes_Externos_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
      console.error(e);
    }
  };

  // Export transactions to Excel
  const handleExportTransactionsExcel = () => {
    try {
      const data = transactions.map(t => {
        const wh = warehouses.find(w => w.id === t.warehouseId);
        return {
          'Folio': t.id,
          'Fecha / Hora': new Date(t.timestamp).toLocaleString(),
          'Tipo Operación': t.type,
          'Almacén Externo': wh?.name || '',
          'Código Almacén': wh?.code || '',
          'SKU': t.sku,
          'Artículo': t.productName,
          'Cantidad': t.qty,
          'Origen / Destino': t.sourceOrDestination,
          'Transporte / Guía': t.carrierOrDelivery || 'N/A',
          'Documento Ref': t.referenceDoc || 'N/A',
          'Operador': t.operator,
          'Notas': t.notes || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Movimientos_Almacenes_Ext');
      XLSX.writeFile(wb, `Movimientos_Almacenes_Externos_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn text-xs text-slate-700">
      
      {/* Toast Feedback Notification */}
      {toastFeedback && (
        <div className="bg-teal-900 text-teal-100 px-4 py-3 rounded-2xl flex items-center justify-between shadow-md border border-teal-700 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4.5 w-4.5 text-teal-300 shrink-0" />
            <span className="text-xs font-bold">{toastFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastFeedback(null)}
            className="text-teal-300 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. BARRA SUPERIOR FIJA: CONMUTADOR Y CAMBIO DE ALMACÉN ACTIVO             */}
      {/* ========================================================================= */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-2 border-teal-500/50 rounded-2xl p-3.5 shadow-md space-y-3 transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Active Warehouse Main Label & Dropdown Selector */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-600 text-white shadow-xs shrink-0 flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase font-mono tracking-wider text-teal-800 flex items-center gap-1.5">
                  <ArrowRightLeft className="h-3.5 w-3.5 text-teal-600" />
                  Cambiar Almacén Activo:
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Almacén Operativo"></span>
                <span className="text-[9px] font-mono font-bold bg-teal-50 text-teal-800 border border-teal-200 px-1.5 py-0.2 rounded">
                  {warehouses.length} {warehouses.length === 1 ? 'almacén' : 'almacenes'}
                </span>
              </div>

              {/* Main Selector Dropdown */}
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <select
                  value={selectedWhFilter}
                  onChange={(e) => handleSelectWarehouseContext(e.target.value)}
                  className="py-1.5 px-3 bg-teal-50/40 hover:bg-white border-2 border-teal-500 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400 cursor-pointer shadow-3xs"
                  aria-label="Seleccionar Almacén Activo"
                >
                  <option value="all">📦 Todos los Almacenes Externos (Consolidado)</option>
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>
                      🏢 [{wh.code}] {wh.name} — ({wh.city})
                    </option>
                  ))}
                </select>

                {selectedWhFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => {
                      const cur = warehouses.find(w => w.id === selectedWhFilter);
                      if (cur) startEditingWarehouse(cur);
                    }}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                    title="Renombrar este almacén"
                  >
                    <Edit2 className="h-3 w-3 text-slate-500" />
                    <span>Renombrar Almacén</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats & New Warehouse action */}
          <div className="flex items-center gap-2.5 shrink-0">
            {selectedWhFilter !== 'all' && (() => {
              const activeWh = warehouses.find(w => w.id === selectedWhFilter);
              if (!activeWh) return null;
              const whItems = extInventory.filter(i => i.warehouseId === activeWh.id);
              const whUnits = whItems.reduce((acc, i) => acc + i.qty, 0);
              const whValue = whItems.reduce((acc, i) => acc + (i.qty * (i.cost || 0)), 0);

              return (
                <div className="hidden sm:flex items-center gap-2.5 font-mono text-[11px] bg-teal-50/80 px-3 py-1.5 rounded-xl border border-teal-200 text-teal-950 shadow-3xs">
                  <span>Stock: <strong>{whUnits} piezas</strong></span>
                  <span className="text-teal-300">•</span>
                  <span>SKUs: <strong>{whItems.length}</strong></span>
                  <span className="text-teal-300">•</span>
                  <span className="text-emerald-800 font-black">${whValue.toLocaleString()}</span>
                </div>
              );
            })()}

            <button
              type="button"
              onClick={() => setReportModalType('inventory')}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs active:scale-95 shrink-0"
              title="Generar formato oficial imprimible del inventario actual"
            >
              <Printer className="h-4 w-4 text-teal-400" />
              <span className="hidden sm:inline">Imprimir Inventario</span>
              <span className="sm:hidden">Imprimir</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNewWhModal(true)}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs active:scale-95 shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Alta Almacén</span>
            </button>
          </div>
        </div>

        {/* Horizontal Quick-Switch Buttons / Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1.5 border-t border-slate-100">
          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 shrink-0 mr-1 flex items-center gap-1">
            <ArrowRightLeft className="h-3 w-3 text-teal-600" />
            Acceso Rápido:
          </span>

          {/* All warehouses chip */}
          <button
            type="button"
            onClick={() => handleSelectWarehouseContext('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              selectedWhFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Boxes className="h-3 w-3" />
            <span>Todos (Consolidado)</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-mono font-black ${
              selectedWhFilter === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-600'
            }`}>
              {totalUnitsInExt}
            </span>
          </button>

          {/* Warehouse chips */}
          {warehouses.map(wh => {
            const isSelected = selectedWhFilter === wh.id;
            const whUnits = extInventory
              .filter(i => i.warehouseId === wh.id)
              .reduce((sum, i) => sum + i.qty, 0);

            return (
              <div
                key={wh.id}
                className={`flex items-center rounded-xl transition shrink-0 border ${
                  isSelected
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectWarehouseContext(wh.id)}
                  className="px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title={`Cambiar al almacén: ${wh.name}`}
                >
                  <Building2 className={`h-3 w-3 ${isSelected ? 'text-teal-200' : 'text-slate-400'}`} />
                  <span className="font-mono text-[10px] font-black opacity-90">[{wh.code}]</span>
                  <span className="max-w-[150px] truncate">{wh.name}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-mono font-black ${
                    isSelected ? 'bg-teal-700 text-teal-100' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {whUnits}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditingWarehouse(wh);
                  }}
                  className={`p-1.5 mr-0.5 rounded-lg transition cursor-pointer ${
                    isSelected ? 'hover:bg-teal-700 text-teal-200' : 'hover:bg-slate-100 text-slate-400'
                  }`}
                  title={`Renombrar ${wh.name}`}
                >
                  <Edit2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CABECERA DESCRIPTIVA DEL MÓDULO                                        */}
      {/* ========================================================================= */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5" />
              Operaciones Básicas
            </span>
            <span className="text-slate-400 font-mono text-xs">•</span>
            <span className="text-xs font-bold text-slate-500 font-mono">Gestión Satélite & 3PL</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <Building2 className="h-6 w-6 text-teal-600 bg-teal-50 p-1.5 rounded-xl border border-teal-200" />
            <span>Almacén Externo & Patios Remotos</span>
          </h2>

          <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Administre almacenes satélites, patios remotos, bodegas de terceros (3PL) y depósitos de obra de forma ágil: controle existencias, registre entradas y salidas directas, e imprima reportes oficiales.
          </p>
        </div>

        {/* Quick action controls & operator badge */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              setReportModalType('inventory');
            }}
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
            title="Generar formato oficial de inventario imprimible con firmas"
          >
            <Printer className="h-4 w-4 text-teal-400" />
            <span>Imprimir Inventario</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNewWhModal(true)}
            className="px-3.5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo Almacén</span>
          </button>

          <div className="bg-slate-50 border border-slate-200/70 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <User className="h-4 w-4 text-slate-400" />
            <div className="text-[10px] leading-tight">
              <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Operador</span>
              <span className="font-bold text-slate-800">{activeOperatorName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TARJETAS RESUMEN DE MÉTRICAS RÁPIDAS                                       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-3xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Almacenes Registrados</span>
            <Building2 className="h-4 w-4 text-teal-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-900">{warehouses.length}</span>
            <span className="text-[10px] text-teal-600 font-bold font-mono">ubicaciones activas</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-3xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Total Unidades en Stock</span>
            <Package className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-blue-600">{totalUnitsInExt.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 font-mono">piezas físicas</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-3xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Catálogo de SKUs</span>
            <Boxes className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-indigo-600">{totalSKUsInExt}</span>
            <span className="text-[10px] text-slate-400 font-mono">artículos distintos</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-3xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Movimientos Realizados</span>
            <RefreshCw className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-amber-600">{transactions.length}</span>
            <span className="text-[10px] text-slate-400 font-mono">entradas / salidas</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BARRA DE NAVEGACIÓN SECUNDARIA DEL MÓDULO                                 */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-1">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'inventario', label: 'Inventarios en Almacenes', icon: Package, badge: extInventory.length },
            { id: 'entradas', label: 'Registrar Entrada', icon: ArrowDownLeft, badge: null },
            { id: 'salidas', label: 'Registrar Salida', icon: ArrowUpRight, badge: null },
            { id: 'almacenes', label: 'Directorio de Almacenes', icon: Building2, badge: warehouses.length },
            { id: 'movimientos', label: 'Bitácora de Movimientos', icon: Clock, badge: transactions.length },
            { id: 'reportes', label: 'Centro de Reportes & Firmas', icon: Printer, badge: null }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== null && (
                  <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-mono font-black ${
                    isActive ? 'bg-teal-700 text-teal-100' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Global Warehouse selector filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold uppercase text-slate-400 flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Almacén Activo:
          </span>
          <select
            value={selectedWhFilter}
            onChange={(e) => handleSelectWarehouseContext(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-teal-500 cursor-pointer shadow-3xs"
          >
            <option value="all">Todos los Almacenes Externos ({warehouses.length})</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>[{wh.code}] {wh.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: INVENTARIOS                                                        */}
      {/* ========================================================================= */}
      {activeTab === 'inventario' && (
        <div className="space-y-4">
          {/* Filter and actions bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-3xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={inventorySearchQuery}
                onChange={(e) => setInventorySearchQuery(e.target.value)}
                placeholder="Buscar por descripción, nombre, SKU, ubicación o categoría..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-teal-500"
              />
              {inventorySearchQuery && (
                <button
                  type="button"
                  onClick={() => setInventorySearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportInventoryExcel}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-3xs cursor-pointer"
                title="Descargar catálogo de existencias en Excel (.xlsx)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Exportar Excel</span>
              </button>

              <button
                type="button"
                onClick={() => setReportModalType('inventory')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-3xs cursor-pointer"
                title="Generar formato oficial de inventario para imprimir"
              >
                <Printer className="h-3.5 w-3.5 text-teal-400" />
                <span>Imprimir Inventario</span>
              </button>
            </div>
          </div>

          {/* Table of Inventory Items */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-3.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider font-mono text-slate-700 flex items-center gap-2">
                <Boxes className="h-4 w-4 text-teal-600" />
                <span>Existencias en Almacenes Externos ({filteredInventory.length} registros)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Valor estimado: ${filteredInventory.reduce((acc, i) => acc + (i.qty * (i.cost || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {filteredInventory.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <Package className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">No hay artículos registrados para este filtro</p>
                <p className="text-[11px] text-slate-400">
                  Puede registrar una entrada para asignar existencias a este almacén externo.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-2.5 px-3">Almacén</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Descripción / Artículo</th>
                      <th className="py-2.5 px-3">Categoría</th>
                      <th className="py-2.5 px-3">Ubicación Interna</th>
                      <th className="py-2.5 px-3 text-right">Stock Actual</th>
                      <th className="py-2.5 px-3 text-right">Mínimo</th>
                      <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                      <th className="py-2.5 px-3 text-right">Valor Total</th>
                      <th className="py-2.5 px-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {filteredInventory.map((item) => {
                      const wh = warehouses.find(w => w.id === item.warehouseId);
                      const isLowStock = item.qty <= item.minQty;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-black text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded text-[10px]">
                              {wh?.code}
                            </span>
                            <span className="block text-[10px] text-slate-500 truncate max-w-[140px]" title={wh?.name}>
                              {wh?.name}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                            {item.sku}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-800 block">{item.name}</span>
                            {item.description && (
                              <span className="text-[10px] text-slate-400 block line-clamp-1">{item.description}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-medium">
                            {item.category}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              {item.locationInWarehouse || 'N/A'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-sm">
                            <span className={isLowStock ? 'text-amber-600' : 'text-slate-900'}>
                              {item.qty.toLocaleString()}
                            </span>
                            {isLowStock && (
                              <span className="block text-[9px] text-amber-600 font-bold uppercase tracking-tight">
                                ⚠️ Bajo mínimo
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                            {item.minQty}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            ${(item.cost || 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            ${((item.qty || 0) * (item.cost || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setOutboundWhId(item.warehouseId);
                                  setOutboundSelectedProduct(item);
                                  setOutboundSkuQuery(`${item.name} (${item.sku})`);
                                  setActiveTab('salidas');
                                }}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[10px] rounded-lg transition border border-amber-200"
                                title="Dar salida a este producto"
                              >
                                Salida
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setInboundWhId(item.warehouseId);
                                  const mainItem = inventory.find(i => i.sku === item.sku);
                                  if (mainItem) {
                                    setInboundSelectedProduct(mainItem);
                                    setInboundSkuQuery(`${mainItem.name} (${mainItem.sku})`);
                                  }
                                  setActiveTab('entradas');
                                }}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[10px] rounded-lg transition border border-blue-200"
                                title="Ingresar más stock de este producto"
                              >
                                Entrada
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: REGISTRAR ENTRADAS A ALMACÉN EXTERNO                               */}
      {/* ========================================================================= */}
      {activeTab === 'entradas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <ArrowDownLeft className="h-5 w-5 text-blue-600 bg-blue-50 p-1 rounded-lg border border-blue-200" />
                  <span>Recepción y Entrada a Almacén Externo</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Registre ingresos de material a bodegas satélites, patios remotos o depósitos de obra.
                </p>
              </div>
            </div>

            {inboundFeedback && (
              <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-start gap-2.5 ${
                inboundFeedback.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {inboundFeedback.type === 'ok' ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />}
                <div className="leading-relaxed">{inboundFeedback.text}</div>
              </div>
            )}

            <form onSubmit={handleProcessInbound} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Almacén Destino */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                    Almacén Externo Receptor:
                  </label>
                  <select
                    value={inboundWhId}
                    onChange={(e) => setInboundWhId(e.target.value)}
                    className="w-full p-3 text-xs font-bold border border-slate-250 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
                    required
                  >
                    {warehouses.map(wh => (
                      <option key={wh.id} value={wh.id}>[{wh.code}] {wh.name} ({wh.city})</option>
                    ))}
                  </select>
                </div>

                {/* 2. Origen / Proveedor */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                    Origen / Proveedor / Remitente:
                  </label>
                  <input
                    type="text"
                    value={inboundSource}
                    onChange={(e) => setInboundSource(e.target.value)}
                    placeholder="Ej. Almacén Central WMS, Proveedor Siemens, Traspaso..."
                    className="w-full p-3 text-xs font-semibold border border-slate-250 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                    required
                  />
                </div>
              </div>

              {/* 3. Artículo (Descripción o Escaneo) */}
              <div>
                <ArticleSuggestionInput
                  value={inboundSkuQuery}
                  onChange={(val) => {
                    setInboundSkuQuery(val);
                    // Match directly if valid
                    const exact = inventory.find(i => 
                      i.sku.toLowerCase() === val.trim().toLowerCase() ||
                      (i.barcode && i.barcode.toLowerCase() === val.trim().toLowerCase())
                    );
                    if (exact) setInboundSelectedProduct(exact);
                  }}
                  onSelectProduct={(prod) => {
                    setInboundSelectedProduct(prod);
                    setInboundSkuQuery(`${prod.name} (${prod.sku})`);
                  }}
                  inventory={inventory}
                  bins={bins}
                  themeColor="blue"
                  label="Artículo a Ingresar (Descripción, Nombre, SKU o Código):"
                  placeholder="Escriba la descripción del producto o escanee el código de barras..."
                  helperText="Puede teclear la descripción para autocompletar o usar el lector de código de barras."
                  required
                />
              </div>

              {/* Ficha rápida del producto seleccionado */}
              {inboundSelectedProduct && (
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between text-xs animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl text-blue-700">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-mono font-bold text-blue-900 block">{inboundSelectedProduct.name}</span>
                      <span className="text-[10px] text-blue-700 font-mono">
                        SKU: {inboundSelectedProduct.sku} • {inboundSelectedProduct.category}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-blue-200/70 text-blue-950 font-mono font-black px-2 py-0.5 rounded">
                    Catálogo Central
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 4. Cantidad */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                    Cantidad a Ingresar (Unidades):
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={inboundQty}
                    onChange={(e) => setInboundQty(Number(e.target.value))}
                    className="w-full p-3 text-xs font-mono font-bold border border-slate-250 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                    required
                  />
                </div>

                {/* 5. Ubicación Interna en Almacén Externo */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                    Ubicación Interna (Bahía / Estante):
                  </label>
                  <input
                    type="text"
                    value={inboundLocation}
                    onChange={(e) => setInboundLocation(e.target.value)}
                    placeholder="Ej. Bahía 1, Patio B, Estante A..."
                    className="w-full p-3 text-xs font-mono border border-slate-250 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                </div>

                {/* 6. Documento de Referencia */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                    Factura / Remisión / Traspaso:
                  </label>
                  <input
                    type="text"
                    value={inboundRefDoc}
                    onChange={(e) => setInboundRefDoc(e.target.value)}
                    placeholder="Ej. TRASPASO-8802, FAC-119"
                    className="w-full p-3 text-xs font-mono border border-slate-250 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                    Transporte / Chofer / Placas:
                  </label>
                  <input
                    type="text"
                    value={inboundCarrier}
                    onChange={(e) => setInboundCarrier(e.target.value)}
                    placeholder="Ej. Camioneta #04, Chofer: Juan Pérez..."
                    className="w-full p-3 text-xs border border-slate-250 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                    Observaciones / Notas:
                  </label>
                  <input
                    type="text"
                    value={inboundNotes}
                    onChange={(e) => setInboundNotes(e.target.value)}
                    placeholder="Condición del material, sellos de seguridad..."
                    className="w-full p-3 text-xs border border-slate-250 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <ArrowDownLeft className="h-4 w-4" />
                  <span>Registrar Entrada a Almacén Externo</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right helper summary */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3">
              <span className="text-[10px] font-black uppercase text-slate-400 font-mono tracking-wider block">
                Almacén Seleccionado
              </span>
              {(() => {
                const wh = warehouses.find(w => w.id === inboundWhId);
                if (!wh) return null;
                const itemsCount = extInventory.filter(i => i.warehouseId === wh.id).length;
                const unitsCount = extInventory.filter(i => i.warehouseId === wh.id).reduce((sum, i) => sum + i.qty, 0);

                return (
                  <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-3xs">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">{wh.name}</span>
                      <span className="text-[10px] text-teal-700 font-bold font-mono">Código: [{wh.code}] • Tipo: {wh.type}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 space-y-1 border-t border-slate-100 pt-2">
                      <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-slate-400" /> {wh.address}, {wh.city}</p>
                      <p className="flex items-center gap-1.5"><User className="h-3 w-3 text-slate-400" /> Responsable: {wh.manager}</p>
                      <p className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-slate-400" /> {wh.phone || 'Sin teléfono'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-center font-mono">
                      <div className="p-2 bg-slate-50 rounded-xl">
                        <span className="text-[9px] text-slate-400 block uppercase">SKUs</span>
                        <span className="text-base font-black text-slate-800">{itemsCount}</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-xl">
                        <span className="text-[9px] text-slate-400 block uppercase">Unidades</span>
                        <span className="text-base font-black text-teal-700">{unitsCount}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: REGISTRAR SALIDAS DE ALMACÉN EXTERNO                               */}
      {/* ========================================================================= */}
      {activeTab === 'salidas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <ArrowUpRight className="h-5 w-5 text-amber-600 bg-amber-50 p-1 rounded-lg border border-amber-200" />
                  <span>Egresos y Salidas de Almacén Externo</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Procese salidas de material hacia clientes, obras en sitio o traslados entre bodegas.
                </p>
              </div>
            </div>

            {outboundFeedback && (
              <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-start gap-2.5 ${
                outboundFeedback.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {outboundFeedback.type === 'ok' ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />}
                <div className="leading-relaxed">{outboundFeedback.text}</div>
              </div>
            )}

            <form onSubmit={handleProcessOutbound} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Almacén Origen */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                    Almacén Externo de Origen:
                  </label>
                  <select
                    value={outboundWhId}
                    onChange={(e) => {
                      setOutboundWhId(e.target.value);
                      setOutboundSelectedProduct(null);
                      setOutboundSkuQuery('');
                    }}
                    className="w-full p-3 text-xs font-bold border border-slate-250 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs cursor-pointer"
                    required
                  >
                    {warehouses.map(wh => (
                      <option key={wh.id} value={wh.id}>[{wh.code}] {wh.name}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Destino */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                    Destino / Cliente / Sucursal / Obra:
                  </label>
                  <input
                    type="text"
                    value={outboundDestination}
                    onChange={(e) => setOutboundDestination(e.target.value)}
                    placeholder="Ej. Obra Torre Norte, Cliente Automotriz, Sucursal..."
                    className="w-full p-3 text-xs font-semibold border border-slate-250 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
                    required
                  />
                </div>
              </div>

              {/* 3. Selector de artículo disponible en ese almacén */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                  Seleccionar Artículo con Existencias en este Almacén:
                </label>

                {availableItemsForOutbound.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                    ⚠️ Este almacén externo no cuenta con stock disponible actualmente. Primero registre una entrada.
                  </div>
                ) : (
                  <select
                    value={outboundSelectedProduct?.id || ''}
                    onChange={(e) => {
                      const item = availableItemsForOutbound.find(i => i.id === e.target.value);
                      if (item) {
                        setOutboundSelectedProduct(item);
                        setOutboundSkuQuery(`${item.name} (${item.sku})`);
                        setOutboundQty(1);
                      } else {
                        setOutboundSelectedProduct(null);
                      }
                    }}
                    className="w-full p-3 text-xs font-bold border border-slate-250 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs cursor-pointer"
                    required
                  >
                    <option value="">-- Seleccionar de los {availableItemsForOutbound.length} artículos en stock --</option>
                    {availableItemsForOutbound.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} [{item.sku}] — {item.qty} uds disponibles ({item.locationInWarehouse || 'S/U'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Ficha rápida de stock disponible */}
              {outboundSelectedProduct && (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between text-xs animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-xl text-amber-700">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-mono font-bold text-amber-950 block">{outboundSelectedProduct.name}</span>
                      <span className="text-[10px] text-amber-800 font-mono">
                        Ubicación: {outboundSelectedProduct.locationInWarehouse || 'Zona General'} • SKU: {outboundSelectedProduct.sku}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase font-bold text-amber-800 block">Stock Disponible</span>
                    <span className="text-lg font-black font-mono text-amber-950">{outboundSelectedProduct.qty} uds</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 4. Cantidad a egresar */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                    Cantidad a Egresar:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={outboundSelectedProduct ? outboundSelectedProduct.qty : undefined}
                    value={outboundQty}
                    onChange={(e) => setOutboundQty(Number(e.target.value))}
                    disabled={!outboundSelectedProduct}
                    className="w-full p-3 text-xs font-mono font-bold border border-slate-250 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
                    required
                  />
                </div>

                {/* 5. Transporte */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                    Transporte / Guía / Paquetería:
                  </label>
                  <input
                    type="text"
                    value={outboundCarrier}
                    onChange={(e) => setOutboundCarrier(e.target.value)}
                    placeholder="Ej. FedEx Priority, Camioneta #02..."
                    className="w-full p-3 text-xs border border-slate-250 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
                  />
                </div>

                {/* 6. Documento / Folio de Salida */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                    Folio de Remisión / Pedido:
                  </label>
                  <input
                    type="text"
                    value={outboundRefDoc}
                    onChange={(e) => setOutboundRefDoc(e.target.value)}
                    placeholder="Ej. REM-2026-90, PED-881"
                    className="w-full p-3 text-xs font-mono border border-slate-250 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                  Notas / Motivo de Salida:
                </label>
                <input
                  type="text"
                  value={outboundNotes}
                  onChange={(e) => setOutboundNotes(e.target.value)}
                  placeholder="Instrucciones especiales para entrega o detalles de cliente..."
                  className="w-full p-3 text-xs border border-slate-250 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!outboundSelectedProduct || availableItemsForOutbound.length === 0}
                  className="w-full py-3.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  <span>Procesar Salida de Almacén Externo</span>
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3">
              <span className="text-[10px] font-black uppercase text-slate-400 font-mono tracking-wider block">
                Últimas Salidas Realizadas
              </span>
              <div className="space-y-2">
                {transactions.filter(t => t.type === 'Salida').slice(0, 5).map(tx => (
                  <div key={tx.id} className="p-3 bg-white rounded-xl border border-slate-200 shadow-3xs space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono font-bold text-amber-700">{tx.id}</span>
                      <span className="text-slate-400 font-mono">{new Date(tx.timestamp).toLocaleDateString()}</span>
                    </div>
                    <span className="font-bold text-slate-800 block text-xs truncate">{tx.productName}</span>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Destino: {tx.sourceOrDestination}</span>
                      <span className="font-mono font-black text-amber-900">-{tx.qty} uds</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DIRECTORIO DE ALMACENES EXTERNOS                                   */}
      {/* ========================================================================= */}
      {activeTab === 'almacenes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase font-mono">
              Sedes Satélites & Almacenes Tercerizados ({warehouses.length})
            </h3>
            <button
              type="button"
              onClick={() => setShowNewWhModal(true)}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Alta de Almacén Externo</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {warehouses.map(wh => {
              const isSelected = selectedWhFilter === wh.id;
              const whItems = extInventory.filter(i => i.warehouseId === wh.id);
              const whUnits = whItems.reduce((acc, i) => acc + i.qty, 0);
              const whValue = whItems.reduce((acc, i) => acc + (i.qty * (i.cost || 0)), 0);

              return (
                <div 
                  key={wh.id} 
                  className={`bg-white rounded-2xl p-5 shadow-xs transition-all space-y-4 flex flex-col justify-between border ${
                    isSelected 
                      ? 'border-teal-500 ring-2 ring-teal-400/20 shadow-sm' 
                      : 'border-slate-200/90 hover:border-teal-300'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-xs bg-teal-600 text-white px-2 py-0.5 rounded-lg shadow-3xs">
                          [{wh.code}]
                        </span>
                        {isSelected && (
                          <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-300 flex items-center gap-1">
                            <Check className="h-2.5 w-2.5" />
                            ACTIVO
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {wh.type}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm leading-snug">{wh.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-1 flex items-start gap-1 leading-relaxed">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>{wh.address}, {wh.city}</span>
                      </p>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                      <p className="flex items-center gap-1.5"><User className="h-3 w-3 text-slate-400" /> {wh.manager}</p>
                      {wh.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-slate-400" /> {wh.phone}</p>}
                      {wh.email && <p className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3 text-slate-400" /> {wh.email}</p>}
                    </div>

                    {wh.notes && (
                      <p className="text-[10px] text-slate-400 italic line-clamp-2">
                        &quot;{wh.notes}&quot;
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-mono uppercase">Existencias</span>
                        <span className="font-mono font-black text-xs text-slate-900">{whUnits} uds ({whItems.length} SKUs)</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 block font-mono uppercase">Capital</span>
                        <span className="font-mono font-bold text-xs text-emerald-700">${whValue.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Acciones de conmutación, renombrar y eliminar */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectWarehouseContext(wh.id);
                          setActiveTab('inventario');
                        }}
                        className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs ${
                          isSelected
                            ? 'bg-teal-700 text-white'
                            : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Almacén Activo</span>
                          </>
                        ) : (
                          <>
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                            <span>Operar Aquí</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => startEditingWarehouse(wh)}
                        className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        title="Renombrar o actualizar este almacén"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                        <span>Renombrar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleSelectWarehouseContext(wh.id);
                          setReportModalType('inventory');
                        }}
                        className="py-2 px-2.5 bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-transparent hover:border-teal-200"
                        title={`Imprimir inventario oficial de ${wh.name}`}
                      >
                        <Printer className="h-3.5 w-3.5 text-teal-600" />
                        <span className="hidden sm:inline">Imprimir</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteWarehouse(wh.id)}
                        className="p-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-xl transition cursor-pointer"
                        title="Eliminar almacén de la lista"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: BITÁCORA DE MOVIMIENTOS                                            */}
      {/* ========================================================================= */}
      {activeTab === 'movimientos' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-3xs">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase font-mono">
                Historial de Operaciones en Almacenes Externos
              </h3>
              <p className="text-[11px] text-slate-500">
                Auditoría transaccional de todas las entradas y salidas registradas.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportTransactionsExcel}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-3xs cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Exportar Excel</span>
              </button>
              <button
                type="button"
                onClick={() => setReportModalType('transactions')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-3xs cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 text-teal-400" />
                <span>Imprimir Bitácora</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-2.5 px-3">Folio</th>
                    <th className="py-2.5 px-3">Fecha / Hora</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Almacén</th>
                    <th className="py-2.5 px-3">Artículo / SKU</th>
                    <th className="py-2.5 px-3 text-right">Cantidad</th>
                    <th className="py-2.5 px-3">Origen / Destino</th>
                    <th className="py-2.5 px-3">Documento Ref.</th>
                    <th className="py-2.5 px-3">Operador</th>
                    <th className="py-2.5 px-3 text-center">Vale Oficial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {transactions.map(tx => {
                    const wh = warehouses.find(w => w.id === tx.warehouseId);
                    const isInbound = tx.type === 'Entrada';
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 font-mono font-black text-slate-900">
                          {tx.id}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                          {new Date(tx.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-black uppercase flex items-center gap-1 w-max ${
                            isInbound 
                              ? 'bg-blue-50 text-blue-800 border border-blue-200' 
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {isInbound ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">
                          [{wh?.code}] {wh?.name}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-800 block">{tx.productName}</span>
                          <span className="font-mono text-[10px] text-slate-400">{tx.sku}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-sm">
                          <span className={isInbound ? 'text-blue-700' : 'text-amber-700'}>
                            {isInbound ? `+${tx.qty}` : `-${tx.qty}`} uds
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {tx.sourceOrDestination}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                          {tx.referenceDoc || 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-500">
                          {tx.operator}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedVoucherTx(tx);
                              setReportModalType('voucher');
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[10px] rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="h-3 w-3 text-slate-500" />
                            <span>Imprimir</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: CENTRO DE REPORTES PARA IMPRESIÓN                                   */}
      {/* ========================================================================= */}
      {activeTab === 'reportes' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-2">
            <h3 className="text-base font-black text-slate-900 tracking-tight uppercase font-mono flex items-center gap-2">
              <Printer className="h-5 w-5 text-teal-600" />
              <span>Formatos Oficiales Imprimibles para Almacenes Externos</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
              Seleccione el formato oficial que desea generar para imprimir o guardar en PDF. Todos los reportes cuentan con membrete institucional, balance exacto de existencias y bloques de firma de responsabilidad.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Report 1 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-teal-400 transition">
              <div className="space-y-2.5">
                <div className="h-10 w-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
                  <Package className="h-5 w-5" />
                </div>
                <h4 className="font-extrabold text-slate-900 text-sm">Estado General de Inventario</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Acta de existencias físicas por almacén externo: desglose de SKUs, stock actual, stock de seguridad, costo y firma de conformidad del responsable de almacén.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportModalType('inventory')}
                className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
              >
                <Printer className="h-4 w-4" />
                <span>Generar e Imprimir Inventario</span>
              </button>
            </div>

            {/* Report 2 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-400 transition">
              <div className="space-y-2.5">
                <div className="h-10 w-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold">
                  <FileText className="h-5 w-5" />
                </div>
                <h4 className="font-extrabold text-slate-900 text-sm">Bitácora de Entradas y Salidas</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Resumen de movimientos transaccionales de almacenes externos: histórico de recepción de proveedores, egresos a clientes/obras y balance neto.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportModalType('transactions')}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
              >
                <Printer className="h-4 w-4" />
                <span>Generar Bitácora Imprimible</span>
              </button>
            </div>

            {/* Report 3 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-amber-400 transition">
              <div className="space-y-2.5">
                <div className="h-10 w-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold">
                  <Store className="h-5 w-5" />
                </div>
                <h4 className="font-extrabold text-slate-900 text-sm">Vale Oficial de Remisión</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Imprima el comprobante de entrega o vale de salida para acompañar físicamente el traslado en vehículo, con datos del chofer, placas y sello de recepción.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (transactions.length > 0) {
                    setSelectedVoucherTx(transactions[0]);
                    setReportModalType('voucher');
                  }
                }}
                className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir Último Vale Generado</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ALTA DE NUEVO ALMACÉN EXTERNO                                      */}
      {/* ========================================================================= */}
      {showNewWhModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-5 bg-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-teal-100" />
                <h3 className="font-black text-sm uppercase font-mono tracking-wider">
                  Alta de Almacén Externo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewWhModal(false)}
                className="p-1 rounded-lg hover:bg-white/20 transition cursor-pointer"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleCreateWarehouse} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Código / Clave Única:
                  </label>
                  <input
                    type="text"
                    value={newWhCode}
                    onChange={(e) => setNewWhCode(e.target.value)}
                    placeholder="Ej. EXT-04, PAT-QRO"
                    className="w-full p-2.5 text-xs font-mono font-bold border border-slate-250 rounded-xl uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Tipo de Sede:
                  </label>
                  <select
                    value={newWhType}
                    onChange={(e) => setNewWhType(e.target.value as any)}
                    className="w-full p-2.5 text-xs font-bold border border-slate-250 rounded-xl bg-white"
                  >
                    <option value="Satélite">Satélite Regional</option>
                    <option value="3PL / Tercero">3PL / Bodega de Tercero</option>
                    <option value="Depósito Temporal">Depósito Temporal</option>
                    <option value="Obra / Proyecto">Obra / Proyecto en Sitio</option>
                    <option value="Tránsito">Punto de Tránsito</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Nombre Oficial del Almacén:
                </label>
                <input
                  type="text"
                  value={newWhName}
                  onChange={(e) => setNewWhName(e.target.value)}
                  placeholder="Ej. Bodega Satélite Guadalajara Sur"
                  className="w-full p-2.5 text-xs font-bold border border-slate-250 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Dirección Física:
                  </label>
                  <input
                    type="text"
                    value={newWhAddress}
                    onChange={(e) => setNewWhAddress(e.target.value)}
                    placeholder="Calle, Número, Parque Ind."
                    className="w-full p-2.5 text-xs border border-slate-250 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Ciudad / Estado:
                  </label>
                  <input
                    type="text"
                    value={newWhCity}
                    onChange={(e) => setNewWhCity(e.target.value)}
                    placeholder="Ej. Guadalajara, Jal."
                    className="w-full p-2.5 text-xs border border-slate-250 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Responsable / Encargado:
                  </label>
                  <input
                    type="text"
                    value={newWhManager}
                    onChange={(e) => setNewWhManager(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full p-2.5 text-xs border border-slate-250 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Teléfono Contacto:
                  </label>
                  <input
                    type="text"
                    value={newWhPhone}
                    onChange={(e) => setNewWhPhone(e.target.value)}
                    placeholder="+52 ..."
                    className="w-full p-2.5 text-xs border border-slate-250 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Correo Electrónico:
                  </label>
                  <input
                    type="email"
                    value={newWhEmail}
                    onChange={(e) => setNewWhEmail(e.target.value)}
                    placeholder="contacto@..."
                    className="w-full p-2.5 text-xs border border-slate-250 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Notas de Operación:
                </label>
                <textarea
                  value={newWhNotes}
                  onChange={(e) => setNewWhNotes(e.target.value)}
                  placeholder="Detalles de horarios de acceso, capacidad o restricciones..."
                  rows={2}
                  className="w-full p-2.5 text-xs border border-slate-250 rounded-xl"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setShowNewWhModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm"
                >
                  Guardar Almacén
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL PARA RENOMBRAR Y EDITAR ALMACÉN EXTERNO                             */}
      {/* ========================================================================= */}
      {editingWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-5 bg-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-teal-300" />
                <h3 className="font-mono font-bold text-sm uppercase tracking-wider">
                  Renombrar & Modificar Almacén Externo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingWarehouse(null)}
                className="p-1 rounded-lg hover:bg-white/20 transition cursor-pointer"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleUpdateWarehouse} className="p-6 space-y-4">
              <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-teal-900 text-[11px] leading-relaxed">
                Cambie el nombre o actualice la información del almacén. El nuevo nombre se sincronizará inmediatamente en todas las operaciones, reportes impresos y selectores.
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Nombre Oficial del Almacén:
                </label>
                <input
                  type="text"
                  value={editWhName}
                  onChange={(e) => setEditWhName(e.target.value)}
                  placeholder="Ej. Almacén Satélite Norte - Tultitlán"
                  className="w-full p-2.5 text-xs font-bold border-2 border-teal-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-teal-50/20 text-slate-900 shadow-2xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Código / Clave Única:
                  </label>
                  <input
                    type="text"
                    value={editWhCode}
                    onChange={(e) => setEditWhCode(e.target.value)}
                    placeholder="Ej. EXT-01"
                    className="w-full p-2.5 text-xs font-mono font-bold border border-slate-250 rounded-xl uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Tipo de Sede:
                  </label>
                  <select
                    value={editWhType}
                    onChange={(e) => setEditWhType(e.target.value as any)}
                    className="w-full p-2.5 text-xs font-bold border border-slate-250 rounded-xl bg-white"
                  >
                    <option value="Satélite">Satélite Regional</option>
                    <option value="3PL / Tercero">3PL / Bodega de Tercero</option>
                    <option value="Depósito Temporal">Depósito Temporal</option>
                    <option value="Obra / Proyecto">Obra / Proyecto en Sitio</option>
                    <option value="Tránsito">Punto de Tránsito</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Dirección Física:
                  </label>
                  <input
                    type="text"
                    value={editWhAddress}
                    onChange={(e) => setEditWhAddress(e.target.value)}
                    className="w-full p-2.5 text-xs border border-slate-250 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Ciudad / Estado:
                  </label>
                  <input
                    type="text"
                    value={editWhCity}
                    onChange={(e) => setEditWhCity(e.target.value)}
                    className="w-full p-2.5 text-xs border border-slate-250 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Responsable:
                  </label>
                  <input
                    type="text"
                    value={editWhManager}
                    onChange={(e) => setEditWhManager(e.target.value)}
                    className="w-full p-2.5 text-xs border border-slate-250 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Teléfono:
                  </label>
                  <input
                    type="text"
                    value={editWhPhone}
                    onChange={(e) => setEditWhPhone(e.target.value)}
                    className="w-full p-2.5 text-xs border border-slate-250 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Estatus:
                  </label>
                  <select
                    value={editWhStatus}
                    onChange={(e) => setEditWhStatus(e.target.value as any)}
                    className="w-full p-2.5 text-xs font-bold border border-slate-250 rounded-xl bg-white"
                  >
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Notas de Operación:
                </label>
                <textarea
                  value={editWhNotes}
                  onChange={(e) => setEditWhNotes(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 text-xs border border-slate-250 rounded-xl"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setEditingWarehouse(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>Guardar y Renombrar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL UNIVERSAL PARA IMPRESIÓN DE REPORTES OFICIALES                      */}
      {/* ========================================================================= */}
      {reportModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
          {/* Dynamic Print CSS to guarantee clean single/multi-page letter print */}
          <style>{`
            @media print {
              @page {
                size: letter portrait;
                margin: 1.2cm;
              }
              body * {
                visibility: hidden !important;
              }
              #external-warehouse-printable-report,
              #external-warehouse-printable-report * {
                visibility: visible !important;
              }
              #external-warehouse-printable-report {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
                color: black !important;
                overflow: visible !important;
                max-height: none !important;
                display: block !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
            {/* Modal Top Bar (No Print) */}
            <div className="p-3 sm:p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 no-print border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-teal-400" />
                <div>
                  <span className="font-mono font-bold text-xs uppercase tracking-wider text-slate-200 block">
                    {reportModalType === 'inventory' ? 'Impresión de Inventario Oficial' : reportModalType === 'transactions' ? 'Impresión de Bitácora de Movimientos' : 'Impresión de Vale de Traslado'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Formato oficial auditable con membrete y bloques de firma
                  </span>
                </div>
              </div>

              {/* Controls inside preview */}
              <div className="flex flex-wrap items-center gap-2">
                {reportModalType === 'inventory' && (
                  <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2 py-1 rounded-xl">
                    <span className="text-[10px] font-mono text-slate-300 font-bold uppercase">Sede:</span>
                    <select
                      value={selectedWhFilter}
                      onChange={(e) => handleSelectWarehouseContext(e.target.value)}
                      className="bg-transparent text-white font-mono text-xs font-bold focus:outline-none cursor-pointer pr-1"
                    >
                      <option value="all" className="bg-slate-900 text-white">📦 Todos (Consolidado)</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id} className="bg-slate-900 text-white">
                          [{w.code}] {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {reportModalType === 'inventory' && (
                  <button
                    type="button"
                    onClick={handleExportInventoryExcel}
                    className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                    title="Descargar este inventario en Excel (.xlsx)"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span className="hidden sm:inline">Excel (.xlsx)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                >
                  <Printer className="h-4 w-4" />
                  <span>Imprimir / Guardar en PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setReportModalType(null);
                    setSelectedVoucherTx(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer hover:bg-slate-800"
                  title="Cerrar vista previa"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Area */}
            <div className="p-8 sm:p-12 overflow-y-auto bg-white text-slate-800 space-y-6 printable-report" id="external-warehouse-printable-report">
              
              {/* Document Letterhead */}
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-6 w-6 text-slate-900" />
                    <span className="font-black text-lg tracking-tight font-mono uppercase text-slate-900">
                      {platformTheme.platformName || 'OPTIMAL WMS ENTERPRISE'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono">
                    SISTEMA DE GESTIÓN LOGÍSTICA • DIVISIÓN DE ALMACENES EXTERNOS & SATÉLITES
                  </p>
                </div>

                <div className="text-right text-[10px] font-mono space-y-0.5">
                  <p className="font-bold text-slate-900">FECHA DE EMISIÓN: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                  <p className="text-slate-500">EMISOR: {activeOperatorName}</p>
                  <p className="text-slate-500">DOCUMENTO OFICIAL AUDITABLE</p>
                </div>
              </div>

              {/* REPORT 1: INVENTARIO */}
              {reportModalType === 'inventory' && (() => {
                const activeWh = selectedWhFilter !== 'all' ? warehouses.find(w => w.id === selectedWhFilter) : null;
                const totalUnits = filteredInventory.reduce((acc, i) => acc + i.qty, 0);
                const totalValue = filteredInventory.reduce((acc, i) => acc + (i.qty * (i.cost || 0)), 0);

                return (
                  <div className="space-y-6">
                    <div className="text-center space-y-1 border-b border-slate-200 pb-3">
                      <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                        REPORTE OFICIAL DE EXISTENCIAS DE ALMACÉN EXTERNO
                      </h2>
                      <p className="text-xs font-mono text-teal-800 font-bold">
                        {activeWh ? `ALMACÉN: [${activeWh.code}] ${activeWh.name} — ${activeWh.city}` : `CONSOLIDADO GENERAL: TODAS LAS SEDES EXTERNAS (${warehouses.length} ALMACENES)`}
                      </p>
                      {activeWh && (
                        <p className="text-[10px] text-slate-500 font-mono">
                          Dirección: {activeWh.address} • Responsable: {activeWh.manager} {activeWh.phone ? `• Tel: ${activeWh.phone}` : ''}
                        </p>
                      )}
                    </div>

                    {/* Summary KPI badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-slate-50 border border-slate-300 rounded-xl text-center">
                        <span className="block text-[8px] uppercase font-bold text-slate-400 font-mono">Sedes Incluidas</span>
                        <span className="text-sm font-black font-mono text-slate-900 mt-0.5 block">
                          {activeWh ? `[${activeWh.code}]` : `${warehouses.length} Almacenes`}
                        </span>
                      </div>
                      <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl text-center">
                        <span className="block text-[8px] uppercase font-bold text-blue-700 font-mono">Artículos / SKUs</span>
                        <span className="text-sm font-black font-mono text-blue-900 mt-0.5 block">
                          {filteredInventory.length} referencias
                        </span>
                      </div>
                      <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-xl text-center">
                        <span className="block text-[8px] uppercase font-bold text-teal-700 font-mono">Unidades Físicas</span>
                        <span className="text-sm font-black font-mono text-teal-900 mt-0.5 block">
                          {totalUnits.toLocaleString()} piezas
                        </span>
                      </div>
                      <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl text-center">
                        <span className="block text-[8px] uppercase font-bold text-emerald-700 font-mono">Valuación Total</span>
                        <span className="text-sm font-black font-mono text-emerald-900 mt-0.5 block">
                          ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Table of Inventory */}
                    {filteredInventory.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-slate-300 rounded-2xl space-y-2">
                        <Package className="h-8 w-8 text-slate-400 mx-auto" />
                        <p className="text-xs font-bold text-slate-700">No se encontraron artículos registrados en este almacén</p>
                        <p className="text-[10px] text-slate-400">
                          Registre una entrada para asignar existencias a esta sede externa.
                        </p>
                      </div>
                    ) : (
                      <div className="border border-slate-300 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-slate-100 border-b-2 border-slate-900 text-[10px] font-black uppercase text-slate-700 font-mono">
                              <th className="py-2 px-2.5">Almacén</th>
                              <th className="py-2 px-2.5">SKU</th>
                              <th className="py-2 px-2.5">Descripción del Artículo</th>
                              <th className="py-2 px-2.5">Categoría</th>
                              <th className="py-2 px-2.5">Ubicación</th>
                              <th className="py-2 px-2.5 text-right">Existencia</th>
                              <th className="py-2 px-2.5 text-right">Mínimo</th>
                              <th className="py-2 px-2.5 text-right">Costo Unit.</th>
                              <th className="py-2 px-2.5 text-right">Importe Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-sans">
                            {filteredInventory.map(item => {
                              const wh = warehouses.find(w => w.id === item.warehouseId);
                              const itemVal = (item.qty || 0) * (item.cost || 0);
                              return (
                                <tr key={item.id} className="hover:bg-slate-50/50">
                                  <td className="py-2 px-2.5 font-mono font-bold text-slate-900">[{wh?.code}] {wh?.name}</td>
                                  <td className="py-2 px-2.5 font-mono font-bold text-teal-800">{item.sku}</td>
                                  <td className="py-2 px-2.5 font-medium">{item.name}</td>
                                  <td className="py-2 px-2.5 text-[10px] text-slate-500 font-mono">{item.category}</td>
                                  <td className="py-2 px-2.5 font-mono text-[10px] text-slate-600">{item.locationInWarehouse || 'General'}</td>
                                  <td className="py-2 px-2.5 text-right font-mono font-black text-slate-900">{item.qty}</td>
                                  <td className="py-2 px-2.5 text-right font-mono text-slate-500 text-[10px]">{item.minQty}</td>
                                  <td className="py-2 px-2.5 text-right font-mono text-[10px]">${(item.cost || 0).toFixed(2)}</td>
                                  <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-800">${itemVal.toFixed(2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-slate-900 font-mono font-black text-xs bg-slate-50">
                              <td colSpan={5} className="py-2.5 px-3 text-right uppercase tracking-wider">TOTALES OFICIALES:</td>
                              <td className="py-2.5 px-2.5 text-right text-slate-900 font-black">{totalUnits} uds</td>
                              <td colSpan={2}></td>
                              <td className="py-2.5 px-2.5 text-right text-emerald-800 font-black">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* REPORT 2: BITÁCORA DE MOVIMIENTOS */}
              {reportModalType === 'transactions' && (
                <div className="space-y-6">
                  <div className="text-center space-y-1 border-b border-slate-200 pb-4">
                    <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                      BITÁCORA TRANSACCIONAL DE ENTRADAS Y SALIDAS EXTERNAS
                    </h2>
                    <p className="text-xs text-slate-500">
                      Registro de movimientos físicos realizados en las instalaciones externas
                    </p>
                  </div>

                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                      <tr className="border-b-2 border-slate-900 font-black uppercase text-slate-700 font-mono">
                        <th className="py-2">Folio</th>
                        <th className="py-2">Fecha / Hora</th>
                        <th className="py-2">Tipo</th>
                        <th className="py-2">Almacén</th>
                        <th className="py-2">SKU</th>
                        <th className="py-2">Artículo</th>
                        <th className="py-2 text-right">Cantidad</th>
                        <th className="py-2">Origen / Destino</th>
                        <th className="py-2">Operador</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono">
                      {transactions.map(t => {
                        const wh = warehouses.find(w => w.id === t.warehouseId);
                        return (
                          <tr key={t.id}>
                            <td className="py-1.5 font-bold">{t.id}</td>
                            <td className="py-1.5 text-slate-500">{new Date(t.timestamp).toLocaleDateString()}</td>
                            <td className="py-1.5 font-bold">{t.type}</td>
                            <td className="py-1.5 font-sans">[{wh?.code}] {wh?.name}</td>
                            <td className="py-1.5">{t.sku}</td>
                            <td className="py-1.5 font-sans font-bold">{t.productName}</td>
                            <td className="py-1.5 text-right font-black">{t.type === 'Entrada' ? `+${t.qty}` : `-${t.qty}`}</td>
                            <td className="py-1.5 font-sans">{t.sourceOrDestination}</td>
                            <td className="py-1.5 font-sans text-slate-500">{t.operator}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* REPORT 3: VALE INDIVIDUAL DE REMISIÓN */}
              {reportModalType === 'voucher' && selectedVoucherTx && (
                <div className="space-y-6">
                  <div className="border border-slate-300 rounded-2xl p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block">VALE OFICIAL DE TRASLADO / REMISIÓN</span>
                        <h3 className="text-xl font-black text-slate-900 font-mono">FOLIO: {selectedVoucherTx.id}</h3>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-mono font-black uppercase ${
                        selectedVoucherTx.type === 'Entrada' ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'
                      }`}>
                        TIPO: {selectedVoucherTx.type}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                      <div>
                        <p className="text-slate-400 text-[10px]">ALMACÉN EXTERNO:</p>
                        <p className="font-bold text-slate-900">{warehouses.find(w => w.id === selectedVoucherTx.warehouseId)?.name}</p>
                        <p className="text-slate-500 text-[10px]">{warehouses.find(w => w.id === selectedVoucherTx.warehouseId)?.address}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[10px]">{selectedVoucherTx.type === 'Entrada' ? 'ORIGEN / REMITENTE:' : 'DESTINO / RECEPTOR:'}</p>
                        <p className="font-bold text-slate-900">{selectedVoucherTx.sourceOrDestination}</p>
                        <p className="text-slate-500 text-[10px]">TRANSPORTE: {selectedVoucherTx.carrierOrDelivery || 'Sin especificar'}</p>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-[10px] font-mono uppercase">
                          <tr>
                            <th className="p-2.5">SKU</th>
                            <th className="p-2.5">Descripción de Mercancía</th>
                            <th className="p-2.5 text-right">Cantidad Autorizada</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-slate-200">
                            <td className="p-2.5 font-mono font-bold">{selectedVoucherTx.sku}</td>
                            <td className="p-2.5 font-bold">{selectedVoucherTx.productName}</td>
                            <td className="p-2.5 text-right font-mono font-black text-base">{selectedVoucherTx.qty} unidades</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {selectedVoucherTx.notes && (
                      <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <strong>Notas:</strong> {selectedVoucherTx.notes}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Signatures Section for printable documents */}
              <div className="pt-8 grid grid-cols-3 gap-6 text-center text-xs font-mono">
                <div className="space-y-12">
                  <div className="border-b border-slate-400 w-3/4 mx-auto"></div>
                  <div>
                    <p className="font-bold text-slate-900">RESPONSABLE ALMACÉN</p>
                    <p className="text-[10px] text-slate-400">Firma y Sello</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <div className="border-b border-slate-400 w-3/4 mx-auto"></div>
                  <div>
                    <p className="font-bold text-slate-900">OPERADOR / EMISOR</p>
                    <p className="text-[10px] text-slate-400">{activeOperatorName}</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <div className="border-b border-slate-400 w-3/4 mx-auto"></div>
                  <div>
                    <p className="font-bold text-slate-900">RECIBIÓ CONFORME</p>
                    <p className="text-[10px] text-slate-400">Nombre, Firma y Fecha</p>
                  </div>
                </div>
              </div>

              {/* Bottom legal audit notice */}
              <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-[9px] font-mono text-slate-400 gap-2">
                <span>DOCUMENTO OFICIAL AUDITABLE • CONTROL PATRIMONIAL Y EXISTENCIAS FÍSICAS EN RESGUARDO DE ALMACENES EXTERNOS</span>
                <span>OPTIMAL WMS ENTERPRISE • EMITIDO ELECTRÓNICAMENTE</span>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
