import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  RotateCw,
  X, 
  Layers, 
  Check, 
  ShieldCheck, 
  Navigation, 
  Compass, 
  Sparkles,
  ClipboardList,
  Wrench,
  UserCheck,
  UserPlus,
  User,
  Calendar,
  Briefcase,
  HardHat,
  Tag,
  BookOpen,
  ArrowRight,
  ChevronDown
} from 'lucide-react';
import { ArticleSuggestionInput } from './ArticleSuggestionInput';

export interface BorrowerEntry {
  id: string;
  name: string;
  role: string;
  department?: string;
  source: 'crew' | 'database' | 'manual';
}

export interface DirectDispatchRecord {
  id: string;
  timestamp: string;
  sku: string;
  productName: string;
  category: string;
  qty: number;
  originBins: string[];
  destination: string;
  dispatchType?: 'loan' | 'definitive' | 'other';
  dispatchTypeLabel?: string;
  borrowerName?: string;
  borrowerDepartment?: string;
  expectedReturnDate?: string;
  loanStatus?: 'active' | 'returned';
  returnTimestamp?: string;
  returnOperator?: string;
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
    dispatchType?: 'loan' | 'definitive' | 'other';
    dispatchTypeLabel?: string;
    borrowerName?: string;
    expectedReturnDate?: string;
  }) => Promise<{ orderId: string; deductedBins: string[] } | null>;
  onCompleteOrder?: (orderId: string) => Promise<void>;
  onReturnLoan?: (recordId: string, sku: string, qty: number, targetBinId?: string, returnOperator?: string) => Promise<boolean>;
  activeOperator?: any;
  platformTheme?: any;
  onNavigateToTab?: (tab: string) => void;
}

const INITIAL_BORROWERS_DATABASE: BorrowerEntry[] = [
  { id: 'BOR-01', name: 'Carlos Martínez Méndez', role: 'Técnico de Mantenimiento', department: 'Mantenimiento Industrial', source: 'database' },
  { id: 'BOR-02', name: 'Daniel Ochoa Rivera', role: 'Supervisor de Obra', department: 'Construcción y Patios', source: 'database' },
  { id: 'BOR-03', name: 'Alejandro Ruiz Solís', role: 'Mecánico de Flota', department: 'Taller Central', source: 'database' },
  { id: 'BOR-04', name: 'Javier Gómez Peña', role: 'Instalador Eléctrico', department: 'Contratista Externo', source: 'database' },
  { id: 'BOR-05', name: 'Miguel Ángel Torres', role: 'Técnico Electromecánico', department: 'Línea de Producción', source: 'database' },
  { id: 'BOR-06', name: 'Eduardo Valdés Ramos', role: 'Soldador Especialista', department: 'Estructuras y Patios', source: 'database' }
];

function loadBorrowersFromSources(): BorrowerEntry[] {
  const combined: BorrowerEntry[] = [];

  // 1. Crew members from WMS
  try {
    const savedCrew = localStorage.getItem('OWMS_CREW_MEMBERS');
    if (savedCrew) {
      const crew = JSON.parse(savedCrew);
      if (Array.isArray(crew)) {
        crew.forEach((c: any) => {
          if (c.name && c.name.trim()) {
            combined.push({
              id: c.id || `CREW-${combined.length + 1}`,
              name: c.name.trim(),
              role: c.role || 'Operario de Almacén',
              department: c.department || 'Operaciones WMS',
              source: 'crew'
            });
          }
        });
      }
    }
  } catch (e) {}

  // 2. Custom borrowers database
  try {
    const savedDb = localStorage.getItem('OWMS_BORROWERS_DATABASE');
    if (savedDb) {
      const custom = JSON.parse(savedDb);
      if (Array.isArray(custom)) {
        custom.forEach((b: any) => {
          if (b.name && b.name.trim() && !combined.some(existing => existing.name.toLowerCase() === b.name.trim().toLowerCase())) {
            combined.push({
              id: b.id || `BOR-${combined.length + 1}`,
              name: b.name.trim(),
              role: b.role || 'Técnico / Colaborador',
              department: b.department || 'Planta',
              source: 'database'
            });
          }
        });
      }
    } else {
      INITIAL_BORROWERS_DATABASE.forEach(b => {
        if (!combined.some(existing => existing.name.toLowerCase() === b.name.toLowerCase())) {
          combined.push(b);
        }
      });
      localStorage.setItem('OWMS_BORROWERS_DATABASE', JSON.stringify(INITIAL_BORROWERS_DATABASE));
    }
  } catch (e) {}

  return combined;
}

export const DirectDispatchManager: React.FC<DirectDispatchManagerProps> = ({
  inventory,
  bins,
  orders,
  onDirectDispatch,
  onCompleteOrder,
  onReturnLoan,
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

  // Dispatch Modality: 'loan' (Préstamo de herramienta), 'definitive' (Salida definitiva), 'other' (Otra modalidad)
  const [dispatchType, setDispatchType] = useState<'loan' | 'definitive' | 'other'>('definitive');
  const [customDispatchTypeText, setCustomDispatchTypeText] = useState<string>('');

  // Borrower states (for loans)
  const [borrowerSelectionMode, setBorrowerSelectionMode] = useState<'database' | 'manual'>('database');
  const [borrowerName, setBorrowerName] = useState<string>('');
  const [borrowerDepartment, setBorrowerDepartment] = useState<string>('');
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>('');
  const [borrowerFilterText, setBorrowerFilterText] = useState<string>('');
  const [newBorrowerFeedback, setNewBorrowerFeedback] = useState<string>('');
  const [borrowersDb, setBorrowersDb] = useState<BorrowerEntry[]>(() => loadBorrowersFromSources());
  const [isBorrowerSuggestionsOpen, setIsBorrowerSuggestionsOpen] = useState<boolean>(false);
  const borrowerInputContainerRef = useRef<HTMLDivElement>(null);

  // Close borrower suggestions popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (borrowerInputContainerRef.current && !borrowerInputContainerRef.current.contains(e.target as Node)) {
        setIsBorrowerSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered suggestions for autocomplete
  const suggestedBorrowers = useMemo(() => {
    const query = borrowerName.trim().toLowerCase();
    if (!query) {
      // Top 8 common technicians when empty
      return borrowersDb.slice(0, 8);
    }
    return borrowersDb.filter(b => 
      b.name.toLowerCase().includes(query) || 
      b.role.toLowerCase().includes(query) || 
      (b.department || '').toLowerCase().includes(query)
    );
  }, [borrowerName, borrowersDb]);

  // Check if current typed name exactly matches someone in DB
  const matchedBorrowerInDb = useMemo(() => {
    const query = borrowerName.trim().toLowerCase();
    if (!query) return null;
    return borrowersDb.find(b => b.name.toLowerCase() === query) || null;
  }, [borrowerName, borrowersDb]);

  // Handle selecting a borrower from suggestions or chips
  const handleSelectBorrowerSuggestion = (entry: BorrowerEntry) => {
    setBorrowerName(entry.name);
    setBorrowerDepartment(entry.department || entry.role || '');
    setIsBorrowerSuggestionsOpen(false);
    if (!destination.trim() || destination.startsWith('Taller / Resguardo')) {
      setDestination(`Taller / Resguardo (${entry.name})`);
    }
  };

  // Listen to storage changes
  useEffect(() => {
    const handleSyncBorrowers = () => {
      setBorrowersDb(loadBorrowersFromSources());
    };
    window.addEventListener('storage', handleSyncBorrowers);
    window.addEventListener('owms_borrowers_updated', handleSyncBorrowers);
    return () => {
      window.removeEventListener('storage', handleSyncBorrowers);
      window.removeEventListener('owms_borrowers_updated', handleSyncBorrowers);
    };
  }, []);

  const handleSaveNewBorrowerToDb = (nameToSave: string, deptToSave?: string) => {
    const cleanName = nameToSave.trim();
    if (!cleanName) return;
    const exists = borrowersDb.some(b => b.name.toLowerCase() === cleanName.toLowerCase());
    if (exists) {
      setNewBorrowerFeedback('Este técnico ya existe en la base de datos.');
      setTimeout(() => setNewBorrowerFeedback(''), 3000);
      return;
    }
    const newEntry: BorrowerEntry = {
      id: `BOR-${Date.now().toString().slice(-4)}`,
      name: cleanName,
      role: 'Técnico / Prestatario Registrado',
      department: deptToSave?.trim() || 'Taller / Obra',
      source: 'database'
    };
    const updated = [newEntry, ...borrowersDb];
    setBorrowersDb(updated);
    try {
      const customOnly = updated.filter(b => b.source === 'database');
      localStorage.setItem('OWMS_BORROWERS_DATABASE', JSON.stringify(customOnly));
      window.dispatchEvent(new CustomEvent('owms_borrowers_updated'));
    } catch (e) {}
    setNewBorrowerFeedback(`¡"${cleanName}" guardado en la base de datos de prestatarios!`);
    setTimeout(() => setNewBorrowerFeedback(''), 3500);
  };

  const handleReturnLoan = async (recordId: string) => {
    const rec = dispatchHistory.find(d => d.id === recordId);
    if (onReturnLoan && rec) {
      await onReturnLoan(rec.id, rec.sku, rec.qty || 1, rec.originBins?.[0], activeOperator?.name);
    }
    const updated = dispatchHistory.map(r => {
      if (r.id === recordId) {
        return {
          ...r,
          loanStatus: 'returned' as const,
          returnTimestamp: new Date().toISOString(),
          returnOperator: activeOperator ? activeOperator.name : 'Operador WMS'
        };
      }
      return r;
    });
    setDispatchHistory(updated);
    try {
      localStorage.setItem('OWMS_DIRECT_DISPATCH_HISTORY', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('owms_dispatch_updated'));
      window.dispatchEvent(new CustomEvent('wms_direct_dispatches_updated'));
      window.dispatchEvent(new CustomEvent('wms_inventory_updated'));
      window.dispatchEvent(new CustomEvent('owms_borrowers_updated'));
    } catch (e) {}

    setFeedback({
      type: 'ok',
      text: `¡Herramienta registrada como DEVUELTA con éxito! Folio: ${recordId}. Existencias reintegradas al catálogo y celdas.`
    });
  };

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

  // Save history to localStorage and broadcast cross-module sync
  useEffect(() => {
    try {
      localStorage.setItem('OWMS_DIRECT_DISPATCH_HISTORY', JSON.stringify(dispatchHistory));
      window.dispatchEvent(new CustomEvent('wms_direct_dispatches_updated'));
      window.dispatchEvent(new CustomEvent('owms_dispatch_updated'));
      window.dispatchEvent(new CustomEvent('owms_borrowers_updated'));
      window.dispatchEvent(new Event('storage'));
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

  // Handle barcode / SKU / description search
  const handleScanOrSubmitCode = (code: string) => {
    const clean = code.trim().toLowerCase();
    if (!clean) return;

    // Search by SKU, barcode, exact name, or partial description
    const match = inventory.find(i => 
      i.sku.toLowerCase() === clean || 
      (i.barcode && i.barcode.toLowerCase() === clean) ||
      i.name.toLowerCase() === clean
    ) || inventory.find(i =>
      clean.length >= 3 && (i.name.toLowerCase().includes(clean) || (i.description || '').toLowerCase().includes(clean))
    );

    if (match) {
      setSelectedSku(match.sku);
      setBarcodeInput(match.name);
      setFeedback({
        type: 'ok',
        text: `Producto identificado: ${match.name} (SKU: ${match.sku}). Stock: ${match.qty} uds.`
      });
      // Set default quantity if 0
      if (quantity <= 0) setQuantity(1);
    } else {
      setFeedback({
        type: 'err',
        text: `No se encontró ningún producto con el código, descripción o SKU "${code}".`
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

    // Validaciones específicas de modalidad
    if (dispatchType === 'loan' && !borrowerName.trim()) {
      setFeedback({ 
        type: 'err', 
        text: 'Para registrar un préstamo de herramienta, debe indicar o seleccionar a quién se le presta el material.' 
      });
      return;
    }

    if (dispatchType === 'other' && !customDispatchTypeText.trim()) {
      setFeedback({ 
        type: 'err', 
        text: 'Por favor, especifique de qué modalidad se trata la salida.' 
      });
      return;
    }

    const effectiveDestination = destination.trim() 
      || (dispatchType === 'loan' ? (borrowerDepartment ? `Área: ${borrowerDepartment}` : `Taller / Resguardo (${borrowerName.trim()})`) : '');

    if (!effectiveDestination) {
      setFeedback({ type: 'err', text: 'Indique el destino, cliente, área o sucursal de entrega.' });
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

      const dispatchTypeLabel = dispatchType === 'loan'
        ? 'Préstamo de Herramienta'
        : dispatchType === 'other'
        ? (customDispatchTypeText.trim() || 'Otra Modalidad')
        : 'Salida Definitiva';

      const result = await onDirectDispatch({
        sku: selectedProduct.sku,
        qty: quantity,
        destination: effectiveDestination,
        deliveryMethod: effectiveDeliveryMethod,
        trackingNumber: trackingNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        dispatchType,
        dispatchTypeLabel,
        borrowerName: dispatchType === 'loan' ? borrowerName.trim() : undefined,
        expectedReturnDate: dispatchType === 'loan' && expectedReturnDate ? expectedReturnDate : undefined
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
          destination: effectiveDestination,
          dispatchType,
          dispatchTypeLabel,
          borrowerName: dispatchType === 'loan' ? borrowerName.trim() : undefined,
          borrowerDepartment: dispatchType === 'loan' && borrowerDepartment.trim() ? borrowerDepartment.trim() : undefined,
          expectedReturnDate: dispatchType === 'loan' && expectedReturnDate ? expectedReturnDate : undefined,
          loanStatus: dispatchType === 'loan' ? 'active' : undefined,
          deliveryMethod: effectiveDeliveryMethod,
          trackingNumber: trackingNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          operator: activeOperator ? activeOperator.name : 'Administrador de Logística',
          totalEstimatedWeightKg: (selectedProduct.unitWeight || 1) * quantity
        };

        // If it was a loan and borrower was typed, ensure saved in database
        if (dispatchType === 'loan' && borrowerName.trim()) {
          const exists = borrowersDb.some(b => b.name.toLowerCase() === borrowerName.trim().toLowerCase());
          if (!exists) {
            handleSaveNewBorrowerToDb(borrowerName.trim(), borrowerDepartment.trim());
          }
        }

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
        setBorrowerName('');
        setBorrowerDepartment('');
        setExpectedReturnDate('');
        setCustomDispatchTypeText('');

        setFeedback({
          type: 'ok',
          text: `¡${dispatchType === 'loan' ? 'Préstamo de herramienta' : 'Salida de almacén'} registrado con éxito! Folio generado: ${newRecord.id}`
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
      'Modalidad de Salida',
      'Prestatario / Responsable',
      'Departamento / Área',
      'Fecha Estimada Devolución',
      'Estado del Préstamo',
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
      d.dispatchType === 'loan' ? 'Préstamo de Herramienta' : d.dispatchType === 'other' ? (d.dispatchTypeLabel || 'Otra Modalidad') : 'Salida Definitiva',
      d.borrowerName || 'N/A',
      d.borrowerDepartment || 'N/A',
      d.expectedReturnDate || 'N/A',
      d.dispatchType === 'loan' ? (d.loanStatus === 'returned' ? 'Devuelto / Reintegrado' : 'En Préstamo (Activo)') : 'N/A',
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

              {/* Input de Búsqueda y Escaneo con Sugerencias en Vivo */}
              <div className="space-y-2">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <ArticleSuggestionInput
                      value={barcodeInput}
                      onChange={(val) => {
                        setBarcodeInput(val);
                        // Fast exact match
                        if (val.trim().length >= 3) {
                          const m = inventory.find(i => 
                            i.sku.toLowerCase() === val.trim().toLowerCase() ||
                            (i.barcode && i.barcode.toLowerCase() === val.trim().toLowerCase())
                          );
                          if (m) setSelectedSku(m.sku);
                        }
                      }}
                      onSelectProduct={(item) => {
                        setSelectedSku(item.sku);
                        setBarcodeInput(item.name);
                        setFeedback({
                          type: 'ok',
                          text: `✓ Artículo seleccionado: ${item.name} (${item.sku}). Stock: ${item.qty} uds.`
                        });
                        if (quantity <= 0) setQuantity(1);
                      }}
                      inventory={inventory}
                      bins={bins}
                      themeColor="amber"
                      label="Escanear Código de Barras o Escribir Descripción / SKU:"
                      placeholder="Escriba descripción (ej. Sensor, Batería, Controlador...) o escanee EAN / SKU"
                      showBinsDetail={true}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleScanOrSubmitCode(barcodeInput)}
                    className="mb-0.5 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0 active:scale-95"
                    title="Buscar e identificar producto"
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

            {/* PASO 3: MEDIO DE ENTREGA & MODALIDAD DE SALIDA */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-6">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-150">
                <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white font-mono font-black text-sm flex items-center justify-center shadow-xs">
                  3
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                    Medio de Entrega & Modalidad de Salida
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Defina si es un préstamo de herramienta, salida definitiva u otra, y configure el medio de entrega
                  </p>
                </div>
              </div>

              {/* SECCIÓN A: MODALIDAD DE LA SALIDA (PRÉSTAMO / DEFINITIVA / OTRA) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase font-mono tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Tag className="h-4 w-4 text-indigo-600" />
                    <span>¿De qué tipo de salida se trata?</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Selección obligatoria
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {/* Tarjeta 1: Préstamo de Herramienta */}
                  <div
                    onClick={() => {
                      setDispatchType('loan');
                      if (!destination.trim() && borrowerName.trim()) {
                        setDestination(`Taller / Resguardo (${borrowerName.trim()})`);
                      }
                    }}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                      dispatchType === 'loan'
                        ? 'bg-blue-50/80 border-blue-500 text-blue-950 shadow-xs ring-1 ring-blue-400'
                        : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                        dispatchType === 'loan' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-slate-200'
                      }`}>
                        <Wrench className="h-4 w-4" />
                      </div>
                      <span className={`text-[9px] font-mono font-extrabold px-2 py-0.5 rounded-full ${
                        dispatchType === 'loan' ? 'bg-blue-200 text-blue-900' : 'bg-slate-200/80 text-slate-600'
                      }`}>
                        Temporal / Resguardo
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-black leading-tight">
                        Préstamo de Herramienta / Material
                      </h4>
                      <p className="text-[10px] text-slate-500 leading-snug mt-1">
                        Sujeto a devolución obligatoria. Permite asignar el técnico o colaborador responsable.
                      </p>
                    </div>
                  </div>

                  {/* Tarjeta 2: Salida Definitiva */}
                  <div
                    onClick={() => setDispatchType('definitive')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                      dispatchType === 'definitive'
                        ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950 shadow-xs ring-1 ring-emerald-400'
                        : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                        dispatchType === 'definitive' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600 border border-slate-200'
                      }`}>
                        <ArrowUpRight className="h-4 w-4" />
                      </div>
                      <span className={`text-[9px] font-mono font-extrabold px-2 py-0.5 rounded-full ${
                        dispatchType === 'definitive' ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200/80 text-slate-600'
                      }`}>
                        Consumo / Entrega Final
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-black leading-tight">
                        Salida Definitiva
                      </h4>
                      <p className="text-[10px] text-slate-500 leading-snug mt-1">
                        Despacho a cliente, consumo directo en obra o merma sin retorno de material.
                      </p>
                    </div>
                  </div>

                  {/* Tarjeta 3: Otra Modalidad */}
                  <div
                    onClick={() => setDispatchType('other')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                      dispatchType === 'other'
                        ? 'bg-purple-50/80 border-purple-500 text-purple-950 shadow-xs ring-1 ring-purple-400'
                        : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                        dispatchType === 'other' ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 border border-slate-200'
                      }`}>
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <span className={`text-[9px] font-mono font-extrabold px-2 py-0.5 rounded-full ${
                        dispatchType === 'other' ? 'bg-purple-200 text-purple-900' : 'bg-slate-200/80 text-slate-600'
                      }`}>
                        Personalizada
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-black leading-tight">
                        Otra Modalidad
                      </h4>
                      <p className="text-[10px] text-slate-500 leading-snug mt-1">
                        El operario especifica el motivo o naturaleza del movimiento de salida.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PANEL CONDICIONAL: SI SE TRATA DE UN PRÉSTAMO */}
              {dispatchType === 'loan' && (
                <div className="p-4 sm:p-5 bg-gradient-to-br from-blue-50/90 to-indigo-50/60 border-2 border-blue-300 rounded-3xl space-y-4 shadow-3xs animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-blue-200/70">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <UserCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-blue-950">
                          Prestatario / Responsable de la Herramienta
                        </h4>
                        <p className="text-[10px] text-blue-700">
                          Escriba el nombre directamente o elija de las sugerencias automáticas
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono bg-blue-100 text-blue-800 border border-blue-200">
                        <BookOpen className="h-3 w-3 text-blue-600" />
                        <span>Base de datos: {borrowersDb.length} técnicos</span>
                      </span>
                    </div>
                  </div>

                  {/* CAMPO DE AUTOCOMPLETADO Y SUGERENCIAS INTELIGENTES */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Campo Principal: Escribir nombre con Autocompletado */}
                      <div className="sm:col-span-2 relative" ref={borrowerInputContainerRef}>
                        <label className="text-[11px] font-bold text-blue-950 block mb-1">
                          Nombre del Colaborador / Técnico (Escriba o elija sugerencia):
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-blue-500" />
                          </div>
                          <input
                            type="text"
                            value={borrowerName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBorrowerName(val);
                              setIsBorrowerSuggestionsOpen(true);
                              if (!destination.trim() || destination.startsWith('Taller / Resguardo')) {
                                setDestination(val.trim() ? `Taller / Resguardo (${val.trim()})` : '');
                              }
                            }}
                            onFocus={() => setIsBorrowerSuggestionsOpen(true)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                setIsBorrowerSuggestionsOpen(false);
                              }
                            }}
                            placeholder="Escriba el nombre del técnico (ej. Carlos, Juan, Roberto...)"
                            className="w-full pl-9 pr-16 py-2.5 bg-white border-2 border-blue-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-3xs"
                            autoComplete="off"
                          />
                          <div className="absolute inset-y-0 right-0 pr-1.5 flex items-center gap-1">
                            {borrowerName && (
                              <button
                                type="button"
                                onClick={() => {
                                  setBorrowerName('');
                                  setBorrowerDepartment('');
                                  if (destination.startsWith('Taller / Resguardo')) {
                                    setDestination('');
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                                title="Borrar nombre"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setIsBorrowerSuggestionsOpen(!isBorrowerSuggestionsOpen)}
                              className="p-1 text-blue-600 hover:text-blue-800 rounded-lg hover:bg-blue-100 cursor-pointer"
                              title="Ver sugerencias de técnicos"
                            >
                              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isBorrowerSuggestionsOpen ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        </div>

                        {/* DESPLEGABLE FLOTANTE DE SUGERENCIAS */}
                        {isBorrowerSuggestionsOpen && (
                          <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white border-2 border-blue-400 rounded-2xl shadow-xl overflow-hidden animate-fadeIn">
                            <div className="p-2 bg-blue-50/80 border-b border-blue-100 flex items-center justify-between text-[10px] font-bold font-mono text-blue-800">
                              <span>Sugerencias de la Base de Datos ({suggestedBorrowers.length})</span>
                              <span className="text-slate-500 font-normal">Haga clic para autocompletar</span>
                            </div>

                            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                              {suggestedBorrowers.length > 0 ? (
                                suggestedBorrowers.map((b) => {
                                  const isExact = borrowerName.trim().toLowerCase() === b.name.toLowerCase();
                                  return (
                                    <button
                                      key={b.id}
                                      type="button"
                                      onClick={() => handleSelectBorrowerSuggestion(b)}
                                      className={`w-full text-left p-2.5 flex items-center justify-between gap-2 transition cursor-pointer ${
                                        isExact ? 'bg-blue-100/70' : 'hover:bg-blue-50/70'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs font-mono">
                                          {b.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-xs font-bold text-slate-900 truncate">
                                            {b.name}
                                          </div>
                                          <div className="text-[10px] text-slate-500 truncate flex items-center gap-1.5">
                                            <span className="font-medium text-blue-700">{b.role}</span>
                                            {b.department && (
                                              <>
                                                <span>•</span>
                                                <span>{b.department}</span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-white px-2 py-1 rounded-lg border border-blue-200">
                                        <Check className="h-3 w-3" />
                                        <span>Elegir</span>
                                      </div>
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="p-3 text-center text-xs text-slate-500">
                                  No se encontró ningún técnico registrado con ese nombre.
                                </div>
                              )}
                            </div>

                            {/* Opción rápida para guardar el nombre escrito si es nuevo */}
                            {borrowerName.trim().length >= 2 && !matchedBorrowerInDb && (
                              <div className="p-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                                <span className="text-[10px] text-slate-600 truncate">
                                  ¿Técnico no registrado?
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleSaveNewBorrowerToDb(borrowerName, borrowerDepartment)}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold font-mono flex items-center gap-1 cursor-pointer shadow-3xs"
                                >
                                  <UserPlus className="h-3 w-3" />
                                  <span>+ Guardar "{borrowerName.trim()}" en BD</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Campo Secundario: Departamento / Área / Puesto */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Departamento / Puesto (Opcional):
                        </label>
                        <input
                          type="text"
                          value={borrowerDepartment}
                          onChange={(e) => setBorrowerDepartment(e.target.value)}
                          placeholder="Ej. Taller Mecánico, Obra..."
                          className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-3xs"
                        />
                      </div>
                    </div>

                    {/* Chips Rápidos de Técnicos Habituales (1 solo click) */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-[10px] font-mono text-blue-900 font-bold uppercase flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-amber-500" />
                          <span>Sugerencias rápidas (haga clic para seleccionar al instante):</span>
                        </span>
                        {matchedBorrowerInDb && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            <span>Técnico Registrado en BD</span>
                          </span>
                        )}
                        {!matchedBorrowerInDb && borrowerName.trim().length >= 3 && (
                          <button
                            type="button"
                            onClick={() => handleSaveNewBorrowerToDb(borrowerName, borrowerDepartment)}
                            className="text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer"
                          >
                            <UserPlus className="h-3 w-3" />
                            <span>+ Guardar prestatario en BD</span>
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 p-2 bg-white/80 rounded-xl border border-blue-150">
                        {borrowersDb.slice(0, 6).map((b) => {
                          const isSelected = borrowerName.trim().toLowerCase() === b.name.toLowerCase();
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => handleSelectBorrowerSuggestion(b)}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-300'
                                  : 'bg-white hover:bg-blue-50 text-slate-700 border border-slate-200'
                              }`}
                            >
                              <User className={`h-3 w-3 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`} />
                              <span>{b.name}</span>
                              <span className={`text-[9px] font-mono opacity-80 ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                                ({b.role.split(' ')[0]})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {newBorrowerFeedback && (
                      <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-[10px] font-bold flex items-center gap-1.5 animate-fadeIn">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>{newBorrowerFeedback}</span>
                      </div>
                    )}
                  </div>

                  {/* Campo de Fecha Estimada de Devolución */}
                  <div className="pt-2 border-t border-blue-200/80 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <label className="text-[11px] font-bold text-blue-950 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-blue-600" />
                        <span>Fecha Estimada de Devolución de la Herramienta (Opcional):</span>
                      </label>
                      <span className="text-[10px] text-blue-700 font-mono">
                        {expectedReturnDate ? `Programada: ${expectedReturnDate}` : 'Sin fecha fijada (abierta)'}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="date"
                        value={expectedReturnDate}
                        onChange={(e) => setExpectedReturnDate(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-blue-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-3xs"
                      />

                      {/* Quick Date Presets */}
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const today = new Date().toISOString().split('T')[0];
                            setExpectedReturnDate(today);
                          }}
                          className="px-2 py-1 bg-white hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-[9px] font-mono font-bold cursor-pointer"
                        >
                          Hoy (Fin de Turno)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() + 1);
                            setExpectedReturnDate(d.toISOString().split('T')[0]);
                          }}
                          className="px-2 py-1 bg-white hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-[9px] font-mono font-bold cursor-pointer"
                        >
                          Mañana
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() + 3);
                            setExpectedReturnDate(d.toISOString().split('T')[0]);
                          }}
                          className="px-2 py-1 bg-white hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-[9px] font-mono font-bold cursor-pointer"
                        >
                          En 3 días
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() + 7);
                            setExpectedReturnDate(d.toISOString().split('T')[0]);
                          }}
                          className="px-2 py-1 bg-white hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-[9px] font-mono font-bold cursor-pointer"
                        >
                          En 1 semana
                        </button>
                        {expectedReturnDate && (
                          <button
                            type="button"
                            onClick={() => setExpectedReturnDate('')}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[9px] font-mono font-bold cursor-pointer"
                          >
                            ✕ Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 bg-blue-100/60 rounded-xl border border-blue-200 text-[10px] text-blue-900 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-700 shrink-0" />
                    <span>
                      Al procesar, se generará el <strong>Vale Oficial de Préstamo y Resguardo</strong> con espacio para firmas de entrega y recepción.
                    </span>
                  </div>
                </div>
              )}

              {/* PANEL CONDICIONAL: SI SE TRATA DE OTRA MODALIDAD */}
              {dispatchType === 'other' && (
                <div className="p-4 bg-purple-50/90 border-2 border-purple-300 rounded-3xl space-y-2.5 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-700" />
                    <span className="text-xs font-black uppercase font-mono text-purple-950">
                      Especifique la Modalidad de Salida:
                    </span>
                  </div>
                  <input
                    type="text"
                    value={customDispatchTypeText}
                    onChange={(e) => setCustomDispatchTypeText(e.target.value)}
                    placeholder="Ej. Salida por calibración externa, muestra a cliente, demostración técnica, donación, garantía..."
                    className="w-full px-3.5 py-2.5 bg-white border border-purple-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-3xs"
                    required
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {['Calibración y Metrología', 'Muestra a Cliente', 'Demostración Técnica', 'Traslado a Obra', 'Garantía con Proveedor'].map(sug => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setCustomDispatchTypeText(sug)}
                        className="px-2 py-0.5 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-md text-[9px] font-bold cursor-pointer"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* SECCIÓN B: TRANSPORTE Y MEDIO DE ENTREGA */}
              <div className="space-y-3 pt-3 border-t border-slate-150">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase font-mono tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-indigo-600" />
                    <span>Método de Transporte / Entrega</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Logística de traslado
                  </span>
                </div>

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

                {/* Modalidad de Salida */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                    Modalidad de Salida:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-lg ${
                      dispatchType === 'loan'
                        ? 'bg-blue-100 text-blue-900 border border-blue-200'
                        : dispatchType === 'other'
                        ? 'bg-purple-100 text-purple-900 border border-purple-200'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    }`}>
                      {dispatchType === 'loan' ? '🔧 Préstamo de Herramienta' : dispatchType === 'other' ? `🏷️ ${customDispatchTypeText || 'Otra Modalidad'}` : '📦 Salida Definitiva'}
                    </span>
                  </div>
                  {dispatchType === 'loan' && (
                    <div className="text-[11px] text-slate-700 pt-1 border-t border-slate-200 mt-1 space-y-0.5">
                      <span className="text-slate-400 text-[10px] block font-mono">Prestatario Asignado:</span>
                      <strong className="text-blue-900 block font-bold">
                        {borrowerName.trim() || <span className="italic text-slate-400">Por definir</span>}
                      </strong>
                      {borrowerDepartment && <span className="text-slate-500 block text-[10px]">{borrowerDepartment}</span>}
                      {expectedReturnDate && (
                        <span className="text-blue-700 font-mono text-[10px] block font-bold">
                          Retorno: {expectedReturnDate}
                        </span>
                      )}
                    </div>
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
                    {deliveryMethod === '__OTHER__' ? (customDeliveryMethodText || 'Otro') : deliveryMethod}
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
                    <th className="pb-3 text-left">Modalidad</th>
                    <th className="pb-3 text-left">Producto / SKU</th>
                    <th className="pb-3 text-center">Cant.</th>
                    <th className="pb-3 text-left">Celdas de Picking</th>
                    <th className="pb-3 text-left">Destino / Prestatario</th>
                    <th className="pb-3 text-left">Medio de Entrega</th>
                    <th className="pb-3 text-left">Operador / Estado</th>
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
                        {rec.dispatchType === 'loan' ? (
                          <div className="space-y-1">
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[9px] font-mono font-black border border-blue-200 flex items-center gap-1 w-max">
                              <Wrench className="h-2.5 w-2.5 text-blue-700" />
                              <span>Préstamo</span>
                            </span>
                            {rec.loanStatus === 'returned' ? (
                              <span className="inline-block px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                                Devuelto ✓
                              </span>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="inline-block px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[9px] font-bold">
                                  En Préstamo
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleReturnLoan(rec.id)}
                                  className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[8px] font-bold cursor-pointer shadow-3xs"
                                  title="Registrar devolución de la herramienta"
                                >
                                  Devolver
                                </button>
                              </div>
                            )}
                          </div>
                        ) : rec.dispatchType === 'other' ? (
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[9px] font-mono font-bold border border-purple-200">
                            {rec.dispatchTypeLabel || 'Otra'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[9px] font-mono font-bold">
                            Salida Definitiva
                          </span>
                        )}
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

                      <td className="py-3">
                        <div className="font-bold text-slate-800">{rec.destination}</div>
                        {rec.borrowerName && (
                          <div className="text-[10px] text-blue-800 font-mono flex items-center gap-1 mt-0.5">
                            <UserCheck className="h-3 w-3 text-blue-600" />
                            <span>Técnico: {rec.borrowerName}</span>
                          </div>
                        )}
                        {rec.expectedReturnDate && rec.loanStatus !== 'returned' && (
                          <div className="text-[9px] text-slate-400 font-mono">
                            Retorno est.: {rec.expectedReturnDate}
                          </div>
                        )}
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
                        <div>{rec.operator}</div>
                        {rec.returnOperator && (
                          <div className="text-[9px] text-emerald-700 font-bold">
                            Recibió: {rec.returnOperator}
                          </div>
                        )}
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
            <div className={`text-white p-5 flex items-center justify-between ${
              lastDispatchRecord.dispatchType === 'loan'
                ? 'bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900'
                : 'bg-gradient-to-r from-amber-600 to-orange-600'
            }`}>
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold opacity-80 flex items-center gap-1.5">
                  {lastDispatchRecord.dispatchType === 'loan' ? (
                    <>
                      <Wrench className="h-3 w-3 text-blue-300" />
                      <span>Comprobante de Resguardo y Custodia</span>
                    </>
                  ) : (
                    <span>Comprobante Oficial WMS</span>
                  )}
                </span>
                <h3 className="text-base font-black">
                  {lastDispatchRecord.dispatchType === 'loan'
                    ? 'Vale de Préstamo de Herramienta y Material'
                    : 'Vale de Salida de Almacén'}
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
              <div className={`p-3 rounded-2xl flex items-center gap-2.5 font-bold ${
                lastDispatchRecord.dispatchType === 'loan'
                  ? 'bg-blue-50 border border-blue-200 text-blue-900'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              }`}>
                {lastDispatchRecord.dispatchType === 'loan' ? (
                  <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                )}
                <span>
                  {lastDispatchRecord.dispatchType === 'loan'
                    ? '¡Préstamo registrado exitosamente! Material sujeto a devolución obligatoria.'
                    : '¡Salida completada exitosamente! El stock ha sido descontado.'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block">Folio de Movimiento:</span>
                  <strong className="text-sm font-mono font-black text-slate-900">{lastDispatchRecord.id}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block">Fecha y Hora:</span>
                  <span className="font-mono font-bold text-slate-700">
                    {new Date(lastDispatchRecord.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Bloque especial de Préstamo */}
              {lastDispatchRecord.dispatchType === 'loan' && (
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-1.5">
                  <span className="text-[9px] font-mono font-black uppercase text-blue-900 tracking-wider block">
                    📋 Datos del Prestatario / Responsable:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Nombre del Técnico:</span>
                      <strong className="text-slate-900">{lastDispatchRecord.borrowerName || 'No especificado'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Departamento / Área:</span>
                      <span className="text-slate-800 font-medium">{lastDispatchRecord.borrowerDepartment || 'Taller / Obra'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Fecha Programada de Retorno:</span>
                      <span className="font-mono font-bold text-blue-700">
                        {lastDispatchRecord.expectedReturnDate || 'Fin de turno / Abierta'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Estado del Préstamo:</span>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-black ${
                        lastDispatchRecord.loanStatus === 'returned'
                          ? 'bg-emerald-200 text-emerald-900'
                          : 'bg-amber-200 text-amber-900'
                      }`}>
                        {lastDispatchRecord.loanStatus === 'returned' ? 'DEVUELTO' : 'EN PRÉSTAMO ACTIVO'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2 border-t border-b border-slate-150 py-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500 font-medium">Modalidad:</span>
                  <span className="font-bold text-slate-900 text-right">
                    {lastDispatchRecord.dispatchType === 'loan'
                      ? 'Préstamo de Herramienta / Material'
                      : lastDispatchRecord.dispatchType === 'other'
                      ? (lastDispatchRecord.dispatchTypeLabel || 'Otra Modalidad')
                      : 'Salida Definitiva'}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500 font-medium">Producto / Herramienta:</span>
                  <strong className="text-slate-900 text-right">{lastDispatchRecord.productName}</strong>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500 font-medium">Código SKU:</span>
                  <span className="font-mono font-extrabold text-amber-800">{lastDispatchRecord.sku}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500 font-medium">Cantidad:</span>
                  <span className="font-mono font-black text-base text-slate-900">{lastDispatchRecord.qty} unidades</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500 font-medium">Celdas de Extracción:</span>
                  <span className="font-mono font-semibold text-slate-700 text-right">
                    {lastDispatchRecord.originBins.join(', ') || 'Inventario General'}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500 font-medium">Destino / Ubicación:</span>
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
                  <span className="text-slate-500 font-medium">Operador de Almacén:</span>
                  <span className="font-mono font-bold text-slate-800">{lastDispatchRecord.operator}</span>
                </div>
              </div>

              {/* Firmas de Responsabilidad */}
              <div className="grid grid-cols-2 gap-4 pt-3">
                <div className="text-center space-y-1">
                  <div className="h-10 border-b border-dashed border-slate-300"></div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                    Entregó (Almacén WMS)
                  </span>
                  <span className="text-[10px] font-mono text-slate-700">{lastDispatchRecord.operator}</span>
                </div>
                <div className="text-center space-y-1">
                  <div className="h-10 border-b border-dashed border-slate-300"></div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                    {lastDispatchRecord.dispatchType === 'loan'
                      ? 'Recibió en Resguardo (Técnico)'
                      : 'Recibió Conforme'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-700">
                    {lastDispatchRecord.borrowerName || lastDispatchRecord.destination}
                  </span>
                </div>
              </div>

              <div className="text-[9px] text-center text-slate-400 leading-tight">
                {lastDispatchRecord.dispatchType === 'loan'
                  ? 'El colaborador se compromete a salvaguardar el equipo recibido y retornarlo en óptimas condiciones operativas.'
                  : 'Documento de control interno generado automáticamente por O-WMS PRO.'}
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
