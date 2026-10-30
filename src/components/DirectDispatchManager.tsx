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
  ChevronDown,
  Hammer,
  Zap,
  CheckCheck,
  Filter
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
  initialMode?: 'loans' | 'express' | 'history';
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
  onNavigateToTab,
  initialMode
}) => {
  // Sub-tabs in Salidas / Préstamos module: 'loans' (Préstamo de herramientas), 'express' (Salida definitiva), 'history', 'orders'
  const [activeView, setActiveView] = useState<'loans' | 'express' | 'history' | 'orders'>(() => {
    return initialMode || 'loans';
  });

  useEffect(() => {
    if (initialMode) {
      setActiveView(initialMode);
    }
  }, [initialMode]);

  // Dedicated states for Simplified Tool & Equipment Loan Desk
  const [loanTechnician, setLoanTechnician] = useState<string>('');
  const [loanDepartment, setLoanDepartment] = useState<string>('');
  const [loanDestination, setLoanDestination] = useState<string>('');
  const [loanSearchQuery, setLoanSearchQuery] = useState<string>('');
  const [selectedLoanSku, setSelectedLoanSku] = useState<string>('');
  const [loanQty, setLoanQty] = useState<number>(1);
  const [loanDurationPreset, setLoanDurationPreset] = useState<'shift_end' | 'tomorrow' | '3days' | '1week' | 'custom'>('shift_end');
  const [loanCustomDate, setLoanCustomDate] = useState<string>('');
  const [loanNotes, setLoanNotes] = useState<string>('');
  const [loanCategoryFilter, setLoanCategoryFilter] = useState<string>('ALL');
  const [loanFeedback, setLoanFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isLoanProcessing, setIsLoanProcessing] = useState<boolean>(false);
  const [activeLoanSearch, setActiveLoanSearch] = useState<string>('');
  const [isTechDropdownOpen, setIsTechDropdownOpen] = useState<boolean>(false);
  const [showAddTechModal, setShowAddTechModal] = useState<boolean>(false);
  const [newTechForm, setNewTechForm] = useState({ name: '', role: 'Técnico de Mantenimiento', dept: 'Taller / Mantenimiento' });
  const techDropdownContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutsideTech = (e: MouseEvent) => {
      if (techDropdownContainerRef.current && !techDropdownContainerRef.current.contains(e.target as Node)) {
        setIsTechDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideTech);
    return () => document.removeEventListener('mousedown', handleClickOutsideTech);
  }, []);

  // Input states for Express Dispatch
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedSku, setSelectedSku] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [destination, setDestination] = useState<string>('');
  const [deliveryMethod, setDeliveryMethod] = useState<string>('Salida de Almacén');
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

  // Calculations and handlers for Simplified Tool Loan Desk
  const calculatedLoanReturnDate = useMemo(() => {
    const today = new Date();
    if (loanDurationPreset === 'shift_end') {
      return today.toISOString().slice(0, 10);
    }
    if (loanDurationPreset === 'tomorrow') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    }
    if (loanDurationPreset === '3days') {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return d.toISOString().slice(0, 10);
    }
    if (loanDurationPreset === '1week') {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().slice(0, 10);
    }
    return loanCustomDate || today.toISOString().slice(0, 10);
  }, [loanDurationPreset, loanCustomDate]);

  const formatSpanishFriendlyDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const selectedLoanTool = useMemo(() => {
    if (!selectedLoanSku) return null;
    return inventory.find(i => i.sku === selectedLoanSku) || null;
  }, [selectedLoanSku, inventory]);

  const selectedToolBins = useMemo(() => {
    if (!selectedLoanSku) return [];
    return bins.filter(b => b.occupiedSku === selectedLoanSku && b.occupiedQty > 0);
  }, [selectedLoanSku, bins]);

  const activeLoansList = useMemo(() => {
    return dispatchHistory.filter(d => d.dispatchType === 'loan' && d.loanStatus !== 'returned');
  }, [dispatchHistory]);

  const filteredActiveLoans = useMemo(() => {
    const q = activeLoanSearch.trim().toLowerCase();
    if (!q) return activeLoansList;
    return activeLoansList.filter(l => 
      (l.productName || '').toLowerCase().includes(q) ||
      (l.sku || '').toLowerCase().includes(q) ||
      (l.borrowerName || '').toLowerCase().includes(q) ||
      (l.borrowerDepartment || '').toLowerCase().includes(q) ||
      (l.id || '').toLowerCase().includes(q)
    );
  }, [activeLoansList, activeLoanSearch]);

  const overdueLoansCount = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return activeLoansList.filter(l => l.expectedReturnDate && l.expectedReturnDate < todayStr).length;
  }, [activeLoansList]);

  const todayDueLoansCount = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return activeLoansList.filter(l => l.expectedReturnDate === todayStr).length;
  }, [activeLoansList]);

  const techniciansWithActiveLoans = useMemo(() => {
    const set = new Set<string>();
    activeLoansList.forEach(l => {
      if (l.borrowerName) set.add(l.borrowerName);
    });
    return set;
  }, [activeLoansList]);

  // Suggested tools list with category filters and search
  const toolsCatalog = useMemo(() => {
    return inventory.filter(item => {
      if (loanCategoryFilter !== 'ALL') {
        const cat = (item.category || '').toLowerCase();
        const name = item.name.toLowerCase();
        if (loanCategoryFilter === 'TOOLS') {
          const match = cat.includes('herramienta') || cat.includes('tool') || 
            name.includes('taladro') || name.includes('llave') || name.includes('esmeril') || 
            name.includes('cautín') || name.includes('martillo') || name.includes('rotomartillo');
          if (!match) return false;
        }
        if (loanCategoryFilter === 'ELECTRICAL') {
          const match = cat.includes('eléctric') || cat.includes('electr') || cat.includes('hazmat') ||
            name.includes('controller') || name.includes('batería') || name.includes('battery') || name.includes('cpu');
          if (!match) return false;
        }
        if (loanCategoryFilter === 'MEASUREMENT') {
          const match = cat.includes('medición') || cat.includes('sensor') || 
            name.includes('sensor') || name.includes('multímetro') || name.includes('calibrador') || name.includes('vernier');
          if (!match) return false;
        }
        if (loanCategoryFilter === 'SAFETY') {
          const match = cat.includes('seguridad') || cat.includes('cable') || 
            name.includes('cable') || name.includes('escalera') || name.includes('arnés');
          if (!match) return false;
        }
      }

      const q = loanSearchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.barcode && item.barcode.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    });
  }, [inventory, loanCategoryFilter, loanSearchQuery]);

  // Quick loan execution
  const handleExecuteToolLoan = async () => {
    if (!selectedLoanTool) {
      setLoanFeedback({
        type: 'err',
        text: '⚠️ Paso 1: Seleccione qué herramienta o equipo se va a prestar.'
      });
      return;
    }

    const targetWhere = (loanDestination || loanTechnician || '').trim();
    if (!targetWhere) {
      setLoanFeedback({
        type: 'err',
        text: '⚠️ Paso 2: Indique a dónde se va la herramienta o a qué técnico se le entrega.'
      });
      return;
    }

    if (loanQty <= 0) {
      setLoanFeedback({
        type: 'err',
        text: '⚠️ La cantidad a prestar debe ser al menos 1 unidad.'
      });
      return;
    }

    const available = selectedLoanTool.qty;
    if (available <= 0) {
      setLoanFeedback({
        type: 'err',
        text: `⚠️ No hay existencias disponibles de "${selectedLoanTool.name}" en almacén.`
      });
      return;
    }

    if (loanQty > available) {
      setLoanFeedback({
        type: 'err',
        text: `⚠️ Stock insuficiente. Solo hay ${available} unidades de "${selectedLoanTool.name}" disponibles.`
      });
      return;
    }

    try {
      setIsLoanProcessing(true);
      setLoanFeedback(null);

      const effectiveDestination = targetWhere;
      const effectiveBorrower = loanTechnician.trim() || targetWhere;
      const effectiveDelivery = 'Préstamo de Pañol / Entrega en Mano';
      const effectiveNotes = loanNotes.trim()
        ? `Préstamo de Herramienta. ${loanNotes.trim()}`
        : 'Préstamo de Herramienta / Pañol';

      const result = await onDirectDispatch({
        sku: selectedLoanTool.sku,
        qty: loanQty,
        destination: effectiveDestination,
        deliveryMethod: effectiveDelivery,
        notes: effectiveNotes,
        dispatchType: 'loan',
        dispatchTypeLabel: 'Préstamo de Herramienta',
        borrowerName: effectiveBorrower,
        expectedReturnDate: calculatedLoanReturnDate
      });

      if (result) {
        const usedBins = result.deductedBins && result.deductedBins.length > 0
          ? result.deductedBins
          : selectedToolBins.map(b => b.id).slice(0, 2);

        const newRecord: DirectDispatchRecord = {
          id: result.orderId,
          timestamp: new Date().toISOString(),
          sku: selectedLoanTool.sku,
          productName: selectedLoanTool.name,
          category: selectedLoanTool.category || 'Herramientas y Equipos',
          qty: loanQty,
          originBins: usedBins.length > 0 ? usedBins : ['Almacén Central / Pañol'],
          destination: effectiveDestination,
          dispatchType: 'loan',
          dispatchTypeLabel: 'Préstamo de Herramienta',
          borrowerName: effectiveBorrower,
          borrowerDepartment: loanDepartment.trim() || 'Taller / Obra',
          expectedReturnDate: calculatedLoanReturnDate,
          loanStatus: 'active',
          deliveryMethod: effectiveDelivery,
          notes: effectiveNotes,
          operator: activeOperator ? activeOperator.name : 'Administrador de Logística',
          totalEstimatedWeightKg: (selectedLoanTool.unitWeight || 1) * loanQty
        };

        // If technician not yet in borrowersDb, save automatically if it was typed
        if (loanTechnician.trim()) {
          const exists = borrowersDb.some(b => b.name.toLowerCase() === loanTechnician.trim().toLowerCase());
          if (!exists) {
            handleSaveNewBorrowerToDb(loanTechnician.trim(), loanDepartment.trim());
          }
        }

        const updatedHistory = [newRecord, ...dispatchHistory];
        setDispatchHistory(updatedHistory);

        try {
          localStorage.setItem('OWMS_DIRECT_DISPATCH_HISTORY', JSON.stringify(updatedHistory));
          window.dispatchEvent(new CustomEvent('wms_direct_dispatches_updated'));
          window.dispatchEvent(new CustomEvent('owms_dispatch_updated'));
          window.dispatchEvent(new CustomEvent('wms_inventory_updated'));
          window.dispatchEvent(new CustomEvent('wms_movements_updated'));
          window.dispatchEvent(new Event('storage'));
        } catch (e) {}

        setLastDispatchRecord(newRecord);
        setLoanFeedback({
          type: 'ok',
          text: `✓ ¡Préstamo registrado! ${selectedLoanTool.name} (${loanQty} uds) se va a ${effectiveDestination} y regresa el ${formatSpanishFriendlyDate(calculatedLoanReturnDate)} (Folio: ${result.orderId}).`
        });

        // Reset loan selections for next transaction
        setSelectedLoanSku('');
        setLoanQty(1);
        setLoanDestination('');
        setLoanTechnician('');
        setLoanNotes('');
      }
    } catch (err: any) {
      setLoanFeedback({
        type: 'err',
        text: `Error al registrar el préstamo: ${err?.message || 'Error inesperado'}`
      });
    } finally {
      setIsLoanProcessing(false);
    }
  };

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

    try {
      setIsProcessing(true);
      setFeedback(null);

      const effectiveDeliveryMethod = deliveryMethod?.trim() || 'Salida de Almacén';

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
            <span className={`p-1 px-2.5 rounded-lg border text-[10px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5 ${
              activeView === 'loans'
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : activeView === 'express'
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}>
              {activeView === 'loans' ? (
                <>
                  <Wrench className="h-3.5 w-3.5 text-blue-600" />
                  Pañol de Herramientas & Equipos
                </>
              ) : activeView === 'express' ? (
                <>
                  <ArrowUpRight className="h-3.5 w-3.5 text-amber-600" />
                  Salidas Definitivas
                </>
              ) : (
                <>
                  <Clock className="h-3.5 w-3.5 text-slate-600" />
                  Auditoría de Movimientos
                </>
              )}
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {activeView === 'loans'
                ? 'Préstamo Rápido de Herramientas y Equipos'
                : activeView === 'express'
                ? 'Salidas Definitivas de Almacén'
                : 'Historial de Salidas y Devoluciones'}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
            {activeView === 'loans'
              ? 'Préstamo ágil de herramienta a técnicos en 3 simples clics y devolución directa al almacén con un solo botón.'
              : activeView === 'express'
              ? 'Registre salidas de mercancía de forma inmediata sin crear órdenes previas: seleccione o escanee el producto e indique el destino.'
              : 'Consulte remisiones, vales de resguardo, estado de préstamos y descargue reportes en Excel.'}
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shrink-0 select-none flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveView('loans')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeView === 'loans'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Wrench className={`h-4 w-4 ${activeView === 'loans' ? 'text-white' : 'text-blue-600'}`} />
            <span>Préstamo de Herramientas y Equipos</span>
            {activeLoansList.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                activeView === 'loans' ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-800'
              }`}>
                {activeLoansList.length} activas
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveView('express')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeView === 'express'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Package className="h-4 w-4 text-amber-600" />
            <span>Salidas Definitivas</span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveView('history')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeView === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Clock className="h-4 w-4 text-blue-600" />
            <span>Historial & Devoluciones ({dispatchHistory.length})</span>
          </button>

          {pendingOrdersList.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveView('orders')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeView === 'orders'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <ClipboardList className="h-4 w-4 text-indigo-600" />
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
      {/* VISTA 0: PRÉSTAMO RÁPIDO DE HERRAMIENTAS Y EQUIPOS (SIMPLIFIED LOAN DESK)   */}
      {/* ========================================================================= */}
      {activeView === 'loans' && (
        <div className="space-y-6 animate-fadeIn">

          {/* Feedback específico de préstamos */}
          {loanFeedback && (
            <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs animate-fadeIn ${
              loanFeedback.type === 'ok'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}>
              <div className="flex items-center gap-2.5">
                {loanFeedback.type === 'ok' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                )}
                <span>{loanFeedback.text}</span>
              </div>
              <button
                onClick={() => setLoanFeedback(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Tarjetas de Métricas de Préstamos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 flex items-center gap-1">
                <Wrench className="h-3 w-3 text-blue-600" />
                <span>En Préstamo Activo</span>
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black font-mono text-slate-900">
                  {activeLoansList.length}
                </span>
                <span className="text-[11px] font-bold text-blue-600">herramientas</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 flex items-center gap-1">
                <Clock className="h-3 w-3 text-amber-500" />
                <span>Vencen Hoy</span>
              </span>
              <div className="flex items-baseline justify-between">
                <span className={`text-2xl font-black font-mono ${todayDueLoansCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                  {todayDueLoansCount}
                </span>
                <span className="text-[11px] font-bold text-slate-500">por retornar</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-rose-600" />
                <span>Préstamos Atrasados</span>
              </span>
              <div className="flex items-baseline justify-between">
                <span className={`text-2xl font-black font-mono ${overdueLoansCount > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-800'}`}>
                  {overdueLoansCount}
                </span>
                <span className="text-[11px] font-bold text-rose-600">urgentes</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 flex items-center gap-1">
                <UserCheck className="h-3 w-3 text-indigo-600" />
                <span>Técnicos con Equipo</span>
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black font-mono text-slate-900">
                  {techniciansWithActiveLoans.size}
                </span>
                <span className="text-[11px] font-bold text-indigo-600">colaboradores</span>
              </div>
            </div>
          </div>

          {/* FORMULARIO DIRECTO: LO QUE SE PRESTA, A DÓNDE SE VA Y CUÁNDO REGRESA */}
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-blue-200/90 shadow-xs space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-150">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-7 w-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                    <Wrench className="h-4 w-4" />
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Registro de Préstamo de Herramienta
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Solo 3 datos esenciales: <strong>lo que se presta</strong>, <strong>a dónde se va</strong> y <strong>cuándo regresa</strong>.
                </p>
              </div>

              {selectedLoanTool && (loanDestination || loanTechnician) && (
                <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Listo para registrar</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* 1. LO QUE SE PRESTA */}
              <div className="space-y-4 p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-7 w-7 rounded-xl bg-amber-500 text-white font-mono font-black text-xs flex items-center justify-center shadow-xs">
                        1
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900">
                        ¿Qué se presta?
                      </h4>
                    </div>
                    {selectedLoanTool && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        <span>Herramienta lista</span>
                      </span>
                    )}
                  </div>

                  {selectedLoanTool ? (
                    /* Tarjeta de la Herramienta Seleccionada */
                    <div className="p-3.5 bg-white border-2 border-amber-400 rounded-2xl shadow-2xs space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                            <Wrench className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              {selectedLoanTool.sku}
                            </span>
                            <h5 className="text-xs sm:text-sm font-black text-slate-900 leading-tight mt-1">
                              {selectedLoanTool.name}
                            </h5>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLoanSku('');
                            setLoanQty(1);
                          }}
                          className="text-[10px] text-rose-600 hover:text-rose-800 font-bold bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded-lg transition cursor-pointer"
                        >
                          Cambiar
                        </button>
                      </div>

                      {/* Stock y Ubicación en estante */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[10px]">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-150">
                          <span className="text-slate-400 font-mono uppercase block">Disponible en Almacén</span>
                          <strong className="text-xs font-black text-slate-900">{selectedLoanTool.qty} uds</strong>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-150">
                          <span className="text-slate-400 font-mono uppercase block">Ubicación (Picking)</span>
                          <strong className="text-xs font-mono font-bold text-amber-800 truncate block">
                            {selectedToolBins.length > 0 ? selectedToolBins[0].id : 'Almacén Central'}
                          </strong>
                        </div>
                      </div>

                      {/* Stepper de Cantidad */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-bold text-slate-700">Cantidad a prestar:</span>
                        <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
                          <button
                            type="button"
                            onClick={() => setLoanQty(Math.max(1, loanQty - 1))}
                            disabled={loanQty <= 1}
                            className="px-2.5 py-1 text-slate-700 hover:bg-slate-200 font-bold disabled:opacity-30 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="px-3 py-1 font-mono font-black text-xs text-slate-900">
                            {loanQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => setLoanQty(Math.min(selectedLoanTool.qty, loanQty + 1))}
                            disabled={loanQty >= selectedLoanTool.qty}
                            className="px-2.5 py-1 text-slate-700 hover:bg-slate-200 font-bold disabled:opacity-30 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Buscador y Galería Rápida de Herramientas */
                    <div className="space-y-2.5">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={loanSearchQuery}
                          onChange={(e) => setLoanSearchQuery(e.target.value)}
                          placeholder="Escriba o escanee herramienta (taladro, multímetro...)"
                          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-3xs"
                        />
                      </div>

                      {/* Herramientas disponibles para elegir en 1 clic */}
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                          Herramientas disponibles (1 clic para elegir):
                        </span>
                        <div className="grid grid-cols-1 gap-1.5">
                          {toolsCatalog.slice(0, 5).map(item => (
                            <button
                              key={item.sku}
                              type="button"
                              onClick={() => {
                                setSelectedLoanSku(item.sku);
                                setLoanQty(1);
                              }}
                              className="w-full p-2 bg-white hover:bg-amber-50/70 border border-slate-200 hover:border-amber-300 rounded-xl text-left transition flex items-center justify-between gap-2 cursor-pointer shadow-3xs group"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                                  <Wrench className="h-3.5 w-3.5" />
                                </div>
                                <div className="min-w-0 truncate">
                                  <span className="text-xs font-bold text-slate-800 group-hover:text-amber-900 block truncate">
                                    {item.name}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400 block">
                                    {item.sku} • Stock: <strong className="text-slate-700">{item.qty} uds</strong>
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 shrink-0">
                                Elegir
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-200/80">
                  Herramienta o equipo que sale del almacén
                </div>
              </div>

              {/* 2. A DÓNDE SE VA */}
              <div className="space-y-4 p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-7 w-7 rounded-xl bg-blue-600 text-white font-mono font-black text-xs flex items-center justify-center shadow-xs">
                        2
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900">
                        ¿A dónde se va?
                      </h4>
                    </div>
                    {(loanDestination || loanTechnician) && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        <span>Destino definido</span>
                      </span>
                    )}
                  </div>

                  {/* Input Directo de Destino / Quién se la lleva */}
                  <div className="space-y-2.5">
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={loanDestination || loanTechnician}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLoanDestination(val);
                          setLoanTechnician(val);
                        }}
                        placeholder="Escriba destino o persona (ej. Taller, Carlos Martínez...)"
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-3xs"
                      />
                    </div>

                    {/* Chips Rápidos de Destinos y Técnicos Frecuentes (1 Clic) */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                        Destinos y técnicos frecuentes (1 clic para rellenar):
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {[
                          'Taller Mecánico',
                          'Mantenimiento Industrial',
                          'Línea de Producción',
                          'Obra Activa / Patios',
                          'Carlos Martínez',
                          'Daniel Ochoa',
                          'Alejandro Ruiz',
                          'Javier Gómez',
                          'Miguel Ángel Torres',
                          'Eduardo Valdés'
                        ].map(place => (
                          <button
                            key={place}
                            type="button"
                            onClick={() => {
                              setLoanDestination(place);
                              setLoanTechnician(place);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shadow-3xs border ${
                              (loanDestination === place || loanTechnician === place)
                                ? 'bg-blue-600 text-white border-blue-600 font-bold'
                                : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-800 border-slate-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              (loanDestination === place || loanTechnician === place) ? 'bg-white' : 'bg-blue-500'
                            }`}></span>
                            <span>{place}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-200/80">
                  Lugar, área de trabajo o persona responsable del resguardo
                </div>
              </div>

              {/* 3. CUÁNDO REGRESA */}
              <div className="space-y-4 p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-7 w-7 rounded-xl bg-indigo-600 text-white font-mono font-black text-xs flex items-center justify-center shadow-xs">
                        3
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900">
                        ¿Cuándo regresa?
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                      1 Clic
                    </span>
                  </div>

                  {/* Botones de Presets de 1 Clic */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLoanDurationPreset('shift_end')}
                      className={`p-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center gap-0.5 cursor-pointer border ${
                        loanDurationPreset === 'shift_end'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Hoy (Fin de Turno)
                      </span>
                      <span className={`text-[9px] font-mono ${loanDurationPreset === 'shift_end' ? 'text-indigo-200' : 'text-slate-400'}`}>
                        Mismo día
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLoanDurationPreset('tomorrow')}
                      className={`p-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center gap-0.5 cursor-pointer border ${
                        loanDurationPreset === 'tomorrow'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Mañana
                      </span>
                      <span className={`text-[9px] font-mono ${loanDurationPreset === 'tomorrow' ? 'text-indigo-200' : 'text-slate-400'}`}>
                        +24 horas
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLoanDurationPreset('3days')}
                      className={`p-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center gap-0.5 cursor-pointer border ${
                        loanDurationPreset === '3days'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        En 3 Días
                      </span>
                      <span className={`text-[9px] font-mono ${loanDurationPreset === '3days' ? 'text-indigo-200' : 'text-slate-400'}`}>
                        +72 horas
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLoanDurationPreset('1week')}
                      className={`p-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center gap-0.5 cursor-pointer border ${
                        loanDurationPreset === '1week'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        1 Semana
                      </span>
                      <span className={`text-[9px] font-mono ${loanDurationPreset === '1week' ? 'text-indigo-200' : 'text-slate-400'}`}>
                        +7 días
                      </span>
                    </button>
                  </div>

                  {/* Banner amigable con la fecha exacta calculada */}
                  <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1">
                    <span className="text-[10px] font-mono uppercase font-bold text-indigo-700 block">
                      📅 Fecha en que regresa:
                    </span>
                    <span className="text-xs font-black text-indigo-950 block capitalize">
                      {formatSpanishFriendlyDate(calculatedLoanReturnDate)}
                    </span>
                  </div>

                  {/* Nota opcional */}
                  <div>
                    <input
                      type="text"
                      value={loanNotes}
                      onChange={(e) => setLoanNotes(e.target.value)}
                      placeholder="Nota opcional (ej. Reparación de compresor)..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-3xs"
                    />
                  </div>
                </div>

                <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-200/80">
                  Fecha programada para la devolución al almacén
                </div>
              </div>

            </div>

            {/* BOTÓN DE ACCIÓN PRINCIPAL DIRECTO */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleExecuteToolLoan}
                disabled={isLoanProcessing || !selectedLoanTool || !(loanDestination || loanTechnician)}
                className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 hover:from-blue-700 hover:to-slate-800 disabled:opacity-40 text-white rounded-2xl text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:cursor-not-allowed active:scale-98"
              >
                <Wrench className="h-5 w-5 text-blue-200" />
                <span>REGISTRAR PRÉSTAMO DE HERRAMIENTA</span>
                {selectedLoanTool && (loanDestination || loanTechnician) && (
                  <span className="text-xs font-medium text-blue-200 ml-2 hidden sm:inline">
                    ({selectedLoanTool.name} → {loanDestination || loanTechnician})
                  </span>
                )}
              </button>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* TABLERO DE CONTROL: HERRAMIENTAS PRESTADAS Y DEVOLUCIÓN RÁPIDA           */}
          {/* ========================================================================= */}
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-150">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
                    ✓
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Herramientas Prestadas ({activeLoansList.length})
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Visualice <strong>lo que se prestó</strong>, <strong>a dónde se fue</strong> y <strong>cuándo regresa</strong>. Devolución inmediata con 1 solo clic.
                </p>
              </div>

              {activeLoansList.length > 0 && (
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={activeLoanSearch}
                    onChange={(e) => setActiveLoanSearch(e.target.value)}
                    placeholder="Buscar por herramienta o destino..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-250 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {activeLoansList.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/70 space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-950">
                  ¡Todas las herramientas están en resguardo en el almacén!
                </h4>
                <p className="text-xs text-emerald-800 max-w-md mx-auto">
                  No hay préstamos activos pendientes en este momento. Utilice la ventanilla superior para registrar una herramienta que sale del almacén.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 text-left">Folio / Fecha</th>
                      <th className="pb-3 text-left">1. Lo que se prestó</th>
                      <th className="pb-3 text-left">Ubicación Origen</th>
                      <th className="pb-3 text-left">2. A dónde se fue</th>
                      <th className="pb-3 text-left">3. Cuándo regresa</th>
                      <th className="pb-3 text-center">Estado</th>
                      <th className="pb-3 text-right">Acción Devolución</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredActiveLoans.map((loan) => {
                      const todayStr = new Date().toISOString().slice(0, 10);
                      const isOverdue = loan.expectedReturnDate && loan.expectedReturnDate < todayStr;
                      const isTodayDue = loan.expectedReturnDate && loan.expectedReturnDate === todayStr;

                      return (
                        <tr key={loan.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 font-mono">
                            <strong className="text-slate-900 block font-bold">{loan.id}</strong>
                            <span className="text-[10px] text-slate-400">
                              {new Date(loan.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>

                          {/* 1. LO QUE SE PRESTÓ */}
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                                <Wrench className="h-4 w-4" />
                              </div>
                              <div>
                                <strong className="text-slate-900 block font-bold leading-tight">
                                  {loan.productName}
                                </strong>
                                <span className="font-mono text-[10px] text-amber-800 font-bold">
                                  {loan.sku} • <span className="text-slate-700 font-black">{loan.qty} ud(s)</span>
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 font-mono text-xs text-slate-700">
                            <span className="bg-slate-100 px-2 py-1 rounded-md font-bold text-slate-800">
                              {loan.originBins && loan.originBins.length > 0 ? loan.originBins.join(', ') : 'Estante Central'}
                            </span>
                          </td>

                          {/* 2. A DÓNDE SE FUE */}
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-lg bg-indigo-100 text-indigo-700 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                                <MapPin className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <strong className="text-slate-900 block font-bold leading-tight">
                                  {loan.destination || loan.borrowerName || 'Taller'}
                                </strong>
                                {loan.borrowerName && loan.destination !== loan.borrowerName && (
                                  <span className="text-[10px] text-slate-500 font-medium block">
                                    Resp: {loan.borrowerName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 3. CUÁNDO REGRESA */}
                          <td className="py-3 font-mono text-xs">
                            <strong className="text-slate-800 block">
                              {loan.expectedReturnDate || 'Fin de Turno'}
                            </strong>
                            <span className="text-[10px] text-slate-400">
                              Entregó: {loan.operator}
                            </span>
                          </td>

                          <td className="py-3 text-center">
                            {isOverdue ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-black bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                                <AlertTriangle className="h-3 w-3 text-rose-600" />
                                <span>Atrasado</span>
                              </span>
                            ) : isTodayDue ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-black bg-amber-100 text-amber-800 border border-amber-200">
                                <Clock className="h-3 w-3 text-amber-600" />
                                <span>Vence Hoy</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                <span>Vigente</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleReturnLoan(loan.id)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                title="Reintegrar herramienta al almacén con 1 solo clic"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Devolver (1 Clic)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setLastDispatchRecord(loan);
                                  setShowTicketModal(true);
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                                title="Ver vale de resguardo"
                              >
                                <Printer className="h-3.5 w-3.5" />
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

          {/* Mini Modal para Registrar Nuevo Técnico al Vuelo */}
          {showAddTechModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scaleIn">
                <div className="flex items-center justify-between pb-3 border-b border-slate-150">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-blue-600" />
                    <h3 className="text-base font-black text-slate-900">
                      Registrar Nuevo Técnico
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddTechModal(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Nombre Completo del Técnico:
                    </label>
                    <input
                      type="text"
                      value={newTechForm.name}
                      onChange={(e) => setNewTechForm({ ...newTechForm, name: e.target.value })}
                      placeholder="Ej. Roberto Morales Sánchez"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Puesto / Especialidad:
                    </label>
                    <input
                      type="text"
                      value={newTechForm.role}
                      onChange={(e) => setNewTechForm({ ...newTechForm, role: e.target.value })}
                      placeholder="Ej. Mecánico Industrial, Soldador, Electricista..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Departamento o Cuadrilla:
                    </label>
                    <input
                      type="text"
                      value={newTechForm.dept}
                      onChange={(e) => setNewTechForm({ ...newTechForm, dept: e.target.value })}
                      placeholder="Ej. Mantenimiento, Planta 2, Obras..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-150">
                  <button
                    type="button"
                    onClick={() => setShowAddTechModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newTechForm.name.trim()) return;
                      handleSaveNewBorrowerToDb(newTechForm.name.trim(), newTechForm.dept.trim());
                      setLoanTechnician(newTechForm.name.trim());
                      setLoanDepartment(newTechForm.dept.trim() || newTechForm.role.trim());
                      setShowAddTechModal(false);
                      setNewTechForm({ name: '', role: 'Técnico de Mantenimiento', dept: 'Taller / Mantenimiento' });
                    }}
                    disabled={!newTechForm.name.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    Guardar y Seleccionar
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 1: SALIDA DIRECTA RÁPIDA (MAIN WORKFLOW)                             */}
      {/* ========================================================================= */}
      {activeView === 'express' && (
        <div className="space-y-4">
          {/* Banner de acceso directo a Préstamo de Herramientas */}
          <div className="bg-gradient-to-r from-blue-50/90 to-indigo-50/80 border border-blue-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-3xs">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-blue-950 block text-xs sm:text-sm">¿Va a prestar herramienta o equipo a un técnico?</span>
                <span className="text-[11px] text-blue-700">Utilice la nueva ventanilla simplificada: 3 clics para prestar y 1 clic para devolver.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('loans')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs shrink-0 self-end sm:self-auto"
            >
              <span>Ir a Préstamo de Herramientas →</span>
            </button>
          </div>

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

              {/* NOTAS E INSTRUCCIONES DE SALIDA (TRANSPORTE OCULTADO) */}
              <div className="pt-3 border-t border-slate-150">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Instrucciones / Notas del Despacho (Opcional):
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Entregar en rampa 2, material frágil, turno vespertino..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-250 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
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
