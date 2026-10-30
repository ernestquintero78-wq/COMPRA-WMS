import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { InventoryItem, Bin, Order, BorrowerPersonnel } from '../types';
import {
  Wrench,
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  MapPin,
  Package,
  Check,
  X,
  Printer,
  FileDown,
  RotateCcw,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  UserPlus,
  User,
  HardHat,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Tag,
  AlertCircle,
  Eye,
  Building2,
  Phone,
  Layers
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
  dispatchType?: 'loan' | 'definitive' | 'other';
  dispatchTypeLabel?: string;
  borrowerName?: string;
  borrowerDepartment?: string;
  expectedReturnDate?: string;
  loanStatus?: 'active' | 'returned';
  returnTimestamp?: string;
  returnOperator?: string;
  returnCondition?: 'good' | 'maintenance' | 'damaged';
  deliveryMethod?: string;
  notes?: string;
  operator: string;
  totalEstimatedWeightKg?: number;
}

interface ToolLoansManagerProps {
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
  onReturnLoan?: (
    recordId: string, 
    sku: string, 
    qty: number, 
    targetBinId?: string, 
    returnOperator?: string,
    condition?: 'good' | 'maintenance' | 'damaged'
  ) => Promise<boolean>;
  activeOperator?: any;
  platformTheme?: any;
  onNavigateToTab?: (tab: string) => void;
  initialSubTab?: 'tracking' | 'loans' | 'returns';
}

const INITIAL_BORROWERS_FALLBACK: BorrowerPersonnel[] = [
  {
    id: 'BOR-01',
    name: 'Carlos Martínez Méndez',
    role: 'Técnico de Mantenimiento',
    department: 'Mantenimiento Industrial',
    employeeNumber: 'EMP-1021',
    phone: '55 4192 8831',
    company: 'Interno (Planta Principal)',
    status: 'active',
    notes: 'Autorizado para equipo neumático y herramienta eléctrica de alto impacto.'
  },
  {
    id: 'BOR-02',
    name: 'Daniel Ochoa Rivera',
    role: 'Supervisor de Obra',
    department: 'Construcción y Patios',
    employeeNumber: 'EMP-1044',
    phone: '55 3821 9902',
    company: 'Interno (Planta Principal)',
    status: 'active',
    notes: 'Responsable de cuadrilla civil y resguardos temporales en obra.'
  },
  {
    id: 'BOR-03',
    name: 'Alejandro Ruiz Solís',
    role: 'Mecánico de Flota',
    department: 'Taller Central',
    employeeNumber: 'EMP-1088',
    phone: '55 9182 3341',
    company: 'Interno (Taller)',
    status: 'active',
    notes: 'Especialista en motores diesel y llaves dinamométricas de precisión.'
  },
  {
    id: 'BOR-04',
    name: 'Javier Gómez Peña',
    role: 'Instalador Eléctrico',
    department: 'Contratista Externo',
    employeeNumber: 'CON-5012',
    phone: '55 6743 1120',
    company: 'Electromecánica Delta S.A.',
    status: 'active',
    notes: 'Contratista con certificación en baja y media tensión.'
  },
  {
    id: 'BOR-05',
    name: 'Miguel Ángel Torres',
    role: 'Técnico Electromecánico',
    department: 'Línea de Producción',
    employeeNumber: 'EMP-1110',
    phone: '55 2341 8976',
    company: 'Interno (Planta)',
    status: 'active',
    notes: 'Mantenimiento preventivo en bandas transportadoras.'
  },
  {
    id: 'BOR-06',
    name: 'Eduardo Valdés Ramos',
    role: 'Soldador Especialista',
    department: 'Estructuras y Patios',
    employeeNumber: 'EMP-1135',
    phone: '55 7820 4419',
    company: 'Interno (Planta)',
    status: 'active',
    notes: 'Resguardo de equipo de corte por plasma y caretas electrónicas.'
  }
];

export const ToolLoansManager: React.FC<ToolLoansManagerProps> = ({
  inventory,
  bins,
  orders,
  onDirectDispatch,
  onReturnLoan,
  activeOperator,
  platformTheme,
  onNavigateToTab,
  initialSubTab = 'tracking'
}) => {
  // Navigation inside this module
  const [activeSubTab, setActiveSubTab] = useState<'tracking' | 'loans' | 'returns'>(initialSubTab);

  // Persistence: Records from OWMS_DIRECT_DISPATCH_HISTORY
  const [loanHistory, setLoanHistory] = useState<DirectDispatchRecord[]>(() => {
    try {
      const saved = localStorage.getItem('OWMS_DIRECT_DISPATCH_HISTORY');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error reading OWMS_DIRECT_DISPATCH_HISTORY:', e);
    }
    return [];
  });

  // Persistence: Personnel list from OWMS_BORROWERS_DATABASE
  const [borrowers, setBorrowers] = useState<BorrowerPersonnel[]>(() => {
    try {
      const saved = localStorage.getItem('OWMS_BORROWERS_DATABASE');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error reading OWMS_BORROWERS_DATABASE:', e);
    }
    return INITIAL_BORROWERS_FALLBACK;
  });

  // Reload history and personnel on custom events
  const loadStoredData = () => {
    try {
      const savedH = localStorage.getItem('OWMS_DIRECT_DISPATCH_HISTORY');
      if (savedH) {
        const parsed = JSON.parse(savedH);
        if (Array.isArray(parsed)) setLoanHistory(parsed);
      }
    } catch (e) {}

    try {
      const savedB = localStorage.getItem('OWMS_BORROWERS_DATABASE');
      if (savedB) {
        const parsed = JSON.parse(savedB);
        if (Array.isArray(parsed) && parsed.length > 0) setBorrowers(parsed);
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadStoredData();
    const handleSync = () => loadStoredData();
    window.addEventListener('wms_direct_dispatches_updated', handleSync);
    window.addEventListener('owms_borrowers_updated', handleSync);
    window.addEventListener('owms_dispatch_updated', handleSync);
    window.addEventListener('wms_inventory_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('wms_direct_dispatches_updated', handleSync);
      window.removeEventListener('owms_borrowers_updated', handleSync);
      window.removeEventListener('owms_dispatch_updated', handleSync);
      window.removeEventListener('wms_inventory_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Computed: Active Loans (Only loan dispatches not returned yet)
  // -------------------------------------------------------------------------
  const activeLoans = useMemo(() => {
    return loanHistory.filter(
      r => r.dispatchType === 'loan' && (r.loanStatus === 'active' || !r.loanStatus)
    );
  }, [loanHistory]);

  const returnedLoans = useMemo(() => {
    return loanHistory.filter(
      r => r.dispatchType === 'loan' && r.loanStatus === 'returned'
    );
  }, [loanHistory]);

  // Group active loans by person/borrower
  const personLoansMap = useMemo(() => {
    const map = new Map<string, DirectDispatchRecord[]>();
    activeLoans.forEach(loan => {
      const name = (loan.borrowerName || loan.destination || 'Sin Asignar').trim();
      const existing = map.get(name) || [];
      existing.push(loan);
      map.set(name, existing);
    });
    return map;
  }, [activeLoans]);

  // Combined list of people (registered in database + anyone who currently has a loan)
  const combinedPeopleList = useMemo(() => {
    const list: {
      id: string;
      name: string;
      role: string;
      department: string;
      employeeNumber?: string;
      phone?: string;
      company?: string;
      activeLoans: DirectDispatchRecord[];
      hasOverdue: boolean;
      hasDueToday: boolean;
      isRegistered: boolean;
    }[] = [];

    const todayStr = new Date().toISOString().slice(0, 10);
    const processedNames = new Set<string>();

    // 1. Process all in borrowers database
    borrowers.forEach(b => {
      processedNames.add(b.name.toLowerCase());
      const personLoans = personLoansMap.get(b.name) || 
        Array.from(personLoansMap.entries()).find(([k]) => k.toLowerCase() === b.name.toLowerCase())?.[1] || [];
      
      const hasOverdue = personLoans.some(l => l.expectedReturnDate && l.expectedReturnDate < todayStr);
      const hasDueToday = personLoans.some(l => l.expectedReturnDate && l.expectedReturnDate === todayStr);

      list.push({
        id: b.id,
        name: b.name,
        role: b.role,
        department: b.department,
        employeeNumber: b.employeeNumber,
        phone: b.phone,
        company: b.company,
        activeLoans: personLoans,
        hasOverdue,
        hasDueToday,
        isRegistered: true
      });
    });

    // 2. Process borrowers from active loans that are not in the database yet
    personLoansMap.forEach((loans, personName) => {
      if (!processedNames.has(personName.toLowerCase())) {
        const hasOverdue = loans.some(l => l.expectedReturnDate && l.expectedReturnDate < todayStr);
        const hasDueToday = loans.some(l => l.expectedReturnDate && l.expectedReturnDate === todayStr);
        list.push({
          id: `TEMP-${personName.replace(/\s+/g, '-').toUpperCase()}`,
          name: personName,
          role: 'Técnico / Colaborador',
          department: loans[0]?.borrowerDepartment || 'Taller / Obra',
          activeLoans: loans,
          hasOverdue,
          hasDueToday,
          isRegistered: false
        });
      }
    });

    return list;
  }, [borrowers, personLoansMap]);

  // Metrics
  const metrics = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    let overdueCount = 0;
    let dueTodayCount = 0;
    let totalToolsQty = 0;

    activeLoans.forEach(l => {
      totalToolsQty += l.qty || 1;
      if (l.expectedReturnDate) {
        if (l.expectedReturnDate < todayStr) overdueCount++;
        else if (l.expectedReturnDate === todayStr) dueTodayCount++;
      }
    });

    const peopleWithTools = combinedPeopleList.filter(p => p.activeLoans.length > 0).length;

    return {
      activeLoansCount: activeLoans.length,
      totalToolsQty,
      peopleWithTools,
      overdueCount,
      dueTodayCount,
      returnedCount: returnedLoans.length
    };
  }, [activeLoans, returnedLoans, combinedPeopleList]);

  // -------------------------------------------------------------------------
  // STATE: Tab 1 - SEGUIMIENTO POR PERSONA
  // -------------------------------------------------------------------------
  const [personSearch, setPersonSearch] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [onlyWithToolsFilter, setOnlyWithToolsFilter] = useState(true);
  const [selectedPersonForDetail, setSelectedPersonForDetail] = useState<string | null>(null);
  const [expandedPersonCards, setExpandedPersonCards] = useState<Record<string, boolean>>({});

  // Unique departments for filter
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    combinedPeopleList.forEach(p => {
      if (p.department) set.add(p.department);
    });
    return Array.from(set);
  }, [combinedPeopleList]);

  const filteredPeople = useMemo(() => {
    return combinedPeopleList.filter(p => {
      if (onlyWithToolsFilter && p.activeLoans.length === 0) return false;
      if (selectedDeptFilter !== 'ALL' && p.department !== selectedDeptFilter) return false;

      const q = personSearch.toLowerCase().trim();
      if (!q) return true;

      const matchPerson = p.name.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q) ||
        (p.employeeNumber && p.employeeNumber.toLowerCase().includes(q));

      // Also match if any tool in their possession matches the query
      const matchTool = p.activeLoans.some(
        l => l.productName.toLowerCase().includes(q) || l.sku.toLowerCase().includes(q)
      );

      return matchPerson || matchTool;
    });
  }, [combinedPeopleList, onlyWithToolsFilter, selectedDeptFilter, personSearch]);

  const toggleExpandPerson = (personName: string) => {
    setExpandedPersonCards(prev => ({
      ...prev,
      [personName]: !prev[personName]
    }));
  };

  // -------------------------------------------------------------------------
  // STATE: Tab 2 - REGISTRO DE PRÉSTAMO (3 Pasos: ¿Qué?, ¿A quién?, ¿Cuándo?)
  // -------------------------------------------------------------------------
  const [selectedSku, setSelectedSku] = useState('');
  const [loanQty, setLoanQty] = useState(1);
  const [toolSearchQuery, setToolSearchQuery] = useState('');
  const [targetPersonOrPlace, setTargetPersonOrPlace] = useState('');
  const [personDepartment, setPersonDepartment] = useState('');
  const [durationPreset, setDurationPreset] = useState<'shift_end' | 'tomorrow' | '3days' | '1week' | 'custom'>('shift_end');
  const [customReturnDate, setCustomReturnDate] = useState('');
  const [loanNotes, setLoanNotes] = useState('');
  const [isProcessingLoan, setIsProcessingLoan] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Selected tool object
  const selectedTool = useMemo(() => {
    if (!selectedSku) return null;
    return inventory.find(i => i.sku === selectedSku) || null;
  }, [selectedSku, inventory]);

  // Physical bins of selected tool
  const selectedToolBins = useMemo(() => {
    if (!selectedSku) return [];
    return bins.filter(b => b.occupiedSku === selectedSku && b.occupiedQty > 0);
  }, [selectedSku, bins]);

  // Catalog filtered for tools
  const toolsCatalog = useMemo(() => {
    const q = toolSearchQuery.toLowerCase().trim();
    return inventory.filter(item => {
      const cat = (item.category || '').toLowerCase();
      const name = item.name.toLowerCase();
      // Match general tool-like or all if search query exists
      const isToolCandidate = cat.includes('herramienta') || cat.includes('tool') ||
        cat.includes('eléctric') || cat.includes('medición') || cat.includes('seguridad') ||
        name.includes('taladro') || name.includes('llave') || name.includes('esmeril') ||
        name.includes('sensor') || name.includes('multímetro') || name.includes('batería') ||
        name.includes('cable') || name.includes('martillo') || name.includes('kit') ||
        name.includes('calibrador');

      if (!q) return isToolCandidate || item.qty > 0;

      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.barcode && item.barcode.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    });
  }, [inventory, toolSearchQuery]);

  // Calculated expected return date
  const calculatedReturnDate = useMemo(() => {
    const d = new Date();
    if (durationPreset === 'shift_end') {
      return d.toISOString().slice(0, 10);
    }
    if (durationPreset === 'tomorrow') {
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    }
    if (durationPreset === '3days') {
      d.setDate(d.getDate() + 3);
      return d.toISOString().slice(0, 10);
    }
    if (durationPreset === '1week') {
      d.setDate(d.getDate() + 7);
      return d.toISOString().slice(0, 10);
    }
    return customReturnDate || d.toISOString().slice(0, 10);
  }, [durationPreset, customReturnDate]);

  const formatFriendlyDate = (dateStr: string) => {
    if (!dateStr) return 'Fin de turno';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('es-MX', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
    }
    return dateStr;
  };

  // Pre-fill loan form for a specific person
  const handlePreFillForPerson = (personName: string, dept?: string) => {
    setTargetPersonOrPlace(personName);
    if (dept) setPersonDepartment(dept);
    setActiveSubTab('loans');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Execute Tool Loan
  const handleExecuteLoan = async () => {
    if (!selectedTool) {
      setActionFeedback({
        type: 'err',
        text: '⚠️ Paso 1: Seleccione qué herramienta se va a prestar.'
      });
      return;
    }

    const recipient = targetPersonOrPlace.trim();
    if (!recipient) {
      setActionFeedback({
        type: 'err',
        text: '⚠️ Paso 2: Indique a qué persona o taller se le entrega la herramienta.'
      });
      return;
    }

    if (loanQty <= 0) {
      setActionFeedback({
        type: 'err',
        text: '⚠️ La cantidad a prestar debe ser al menos 1 unidad.'
      });
      return;
    }

    if (loanQty > selectedTool.qty) {
      setActionFeedback({
        type: 'err',
        text: `⚠️ Stock insuficiente. Solo hay ${selectedTool.qty} unidades disponibles de "${selectedTool.name}".`
      });
      return;
    }

    try {
      setIsProcessingLoan(true);
      setActionFeedback(null);

      const effectiveDestination = recipient;
      const effectiveBorrower = recipient;
      const effectiveDelivery = 'Préstamo de Pañol / En Mano';
      const effectiveNotes = loanNotes.trim()
        ? `Préstamo de herramienta. ${loanNotes.trim()}`
        : 'Préstamo de pañol / resguardo temporal';

      const result = await onDirectDispatch({
        sku: selectedTool.sku,
        qty: loanQty,
        destination: effectiveDestination,
        deliveryMethod: effectiveDelivery,
        notes: effectiveNotes,
        dispatchType: 'loan',
        dispatchTypeLabel: 'Préstamo de Herramienta',
        borrowerName: effectiveBorrower,
        expectedReturnDate: calculatedReturnDate
      });

      if (result) {
        const usedBins = result.deductedBins && result.deductedBins.length > 0
          ? result.deductedBins
          : selectedToolBins.map(b => b.id).slice(0, 2);

        const newRecord: DirectDispatchRecord = {
          id: result.orderId,
          timestamp: new Date().toISOString(),
          sku: selectedTool.sku,
          productName: selectedTool.name,
          category: selectedTool.category || 'Herramientas',
          qty: loanQty,
          originBins: usedBins.length > 0 ? usedBins : ['Pañol Central'],
          destination: effectiveDestination,
          dispatchType: 'loan',
          dispatchTypeLabel: 'Préstamo de Herramienta',
          borrowerName: effectiveBorrower,
          borrowerDepartment: personDepartment.trim() || 'Taller / Obra',
          expectedReturnDate: calculatedReturnDate,
          loanStatus: 'active',
          deliveryMethod: effectiveDelivery,
          notes: effectiveNotes,
          operator: activeOperator ? activeOperator.name : 'Administrador de Almacén',
          totalEstimatedWeightKg: (selectedTool.unitWeight || 1) * loanQty
        };

        const updatedHistory = [newRecord, ...loanHistory];
        setLoanHistory(updatedHistory);
        localStorage.setItem('OWMS_DIRECT_DISPATCH_HISTORY', JSON.stringify(updatedHistory));

        // Auto-save borrower if not in database
        const exists = borrowers.some(b => b.name.toLowerCase() === recipient.toLowerCase());
        if (!exists && recipient.length >= 3) {
          const newBorrower: BorrowerPersonnel = {
            id: `BOR-${Math.floor(1000 + Math.random() * 9000)}`,
            name: recipient,
            role: 'Técnico / Colaborador',
            department: personDepartment.trim() || 'Planta',
            status: 'active',
            source: 'manual',
            createdAt: new Date().toISOString()
          };
          const updatedBorrowers = [newBorrower, ...borrowers];
          setBorrowers(updatedBorrowers);
          localStorage.setItem('OWMS_BORROWERS_DATABASE', JSON.stringify(updatedBorrowers));
          window.dispatchEvent(new CustomEvent('owms_borrowers_updated'));
        }

        // Broadcast changes
        window.dispatchEvent(new CustomEvent('wms_direct_dispatches_updated'));
        window.dispatchEvent(new CustomEvent('owms_dispatch_updated'));
        window.dispatchEvent(new CustomEvent('wms_inventory_updated'));
        window.dispatchEvent(new CustomEvent('wms_movements_updated'));
        window.dispatchEvent(new Event('storage'));

        setActionFeedback({
          type: 'ok',
          text: `✓ ¡Préstamo registrado! ${selectedTool.name} (${loanQty} uds) entregado a ${recipient}. Regresa el ${formatFriendlyDate(calculatedReturnDate)} (Folio: ${result.orderId}).`
        });

        // Reset
        setSelectedSku('');
        setLoanQty(1);
        setLoanNotes('');
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'err',
        text: `Error al registrar el préstamo: ${err?.message || 'Error del sistema'}`
      });
    } finally {
      setIsProcessingLoan(false);
    }
  };

  // -------------------------------------------------------------------------
  // DEVOLUCIÓN: 1-Clic Return & Bulk Return
  // -------------------------------------------------------------------------
  const [returnDeskSearch, setReturnDeskSearch] = useState('');
  const [selectedReturnCondition, setSelectedReturnCondition] = useState<'good' | 'maintenance' | 'damaged'>('good');
  const [viewTicketModalRecord, setViewTicketModalRecord] = useState<DirectDispatchRecord | null>(null);

  const handleReturnItem = async (loanRecord: DirectDispatchRecord) => {
    try {
      const opName = activeOperator ? activeOperator.name : 'Operador de Almacén';
      
      // Call App.tsx return handler if provided
      if (onReturnLoan) {
        await onReturnLoan(
          loanRecord.id,
          loanRecord.sku,
          loanRecord.qty,
          loanRecord.originBins && loanRecord.originBins.length > 0 ? loanRecord.originBins[0] : undefined,
          opName,
          selectedReturnCondition
        );
      } else {
        // Fallback local return
        const updated = loanHistory.map(rec => {
          if (rec.id === loanRecord.id) {
            return {
              ...rec,
              loanStatus: 'returned' as const,
              returnTimestamp: new Date().toISOString(),
              returnOperator: opName,
              returnCondition: selectedReturnCondition
            };
          }
          return rec;
        });
        setLoanHistory(updated);
        localStorage.setItem('OWMS_DIRECT_DISPATCH_HISTORY', JSON.stringify(updated));
      }

      window.dispatchEvent(new CustomEvent('wms_direct_dispatches_updated'));
      window.dispatchEvent(new CustomEvent('owms_dispatch_updated'));
      window.dispatchEvent(new CustomEvent('wms_inventory_updated'));
      window.dispatchEvent(new CustomEvent('wms_movements_updated'));
      window.dispatchEvent(new Event('storage'));

      setActionFeedback({
        type: 'ok',
        text: `✓ Herramienta ${loanRecord.productName} devuelta con éxito por ${loanRecord.borrowerName || loanRecord.destination}. Reintegrada al stock del almacén.`
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'err',
        text: `Error al procesar devolución: ${err?.message || 'Error del sistema'}`
      });
    }
  };

  // Return all tools held by a specific person
  const handleBulkReturnForPerson = async (personName: string, loans: DirectDispatchRecord[]) => {
    if (!loans.length) return;
    try {
      for (const l of loans) {
        await handleReturnItem(l);
      }
      setActionFeedback({
        type: 'ok',
        text: `✓ Se han recibido y devuelto al almacén todas las herramientas (${loans.length} artículos) que tenía en resguardo ${personName}.`
      });
    } catch (e: any) {
      setActionFeedback({
        type: 'err',
        text: `Error al procesar la devolución completa: ${e?.message || 'Error'}`
      });
    }
  };

  // Filtered active loans for the Returns Desk
  const filteredActiveLoans = useMemo(() => {
    const q = returnDeskSearch.toLowerCase().trim();
    if (!q) return activeLoans;

    return activeLoans.filter(l =>
      l.productName.toLowerCase().includes(q) ||
      l.sku.toLowerCase().includes(q) ||
      (l.borrowerName || '').toLowerCase().includes(q) ||
      (l.destination || '').toLowerCase().includes(q) ||
      l.id.toLowerCase().includes(q)
    );
  }, [activeLoans, returnDeskSearch]);

  // Export to Excel
  const handleExportLoansExcel = () => {
    if (activeLoans.length === 0) return;

    const headers = [
      'Folio Préstamo',
      'Fecha Entrega',
      'Persona / Destino',
      'Departamento',
      'SKU',
      'Herramienta / Equipo',
      'Cantidad',
      'Ubicación Origen',
      'Fecha Estimada Retorno',
      'Estado',
      'Operador que Entregó'
    ];

    const todayStr = new Date().toISOString().slice(0, 10);
    const rows = activeLoans.map(l => {
      const isOverdue = l.expectedReturnDate && l.expectedReturnDate < todayStr;
      const isToday = l.expectedReturnDate && l.expectedReturnDate === todayStr;
      const statusLabel = isOverdue ? 'Atrasado' : isToday ? 'Vence Hoy' : 'Al Corriente';

      return [
        l.id,
        new Date(l.timestamp).toLocaleString(),
        l.borrowerName || l.destination,
        l.borrowerDepartment || 'N/A',
        l.sku,
        l.productName,
        l.qty,
        l.originBins.join(', '),
        l.expectedReturnDate || 'Fin de Turno',
        statusLabel,
        l.operator
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Prestamos_Activos');
    XLSX.writeFile(wb, `Seguimiento_Herramientas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="tool-loans-and-returns-module">

      {/* ========================================================================= */}
      {/* CABECERA PRINCIPAL: PRÉSTAMOS, DEVOLUCIONES Y SEGUIMIENTO POR PERSONA      */}
      {/* ========================================================================= */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 px-3 rounded-xl bg-blue-600 text-white text-[11px] font-mono font-black uppercase tracking-wider flex items-center gap-2 shadow-xs">
              <Wrench className="h-4 w-4" />
              <span>Pañol de Herramientas</span>
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Préstamos y Devoluciones de Herramientas
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
            Control integral del pañol: <strong>registro ágil de salidas</strong>, <strong>devoluciones inmediatas</strong> y <strong>seguimiento exacto de qué herramienta tiene cada persona</strong> en tiempo real.
          </p>
        </div>

        {/* Selector de Vistas / Pestañas */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shrink-0 select-none flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('tracking')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'tracking'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Seguimiento por Persona</span>
            {metrics.peopleWithTools > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                activeSubTab === 'tracking' ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-800'
              }`}>
                {metrics.peopleWithTools} personas
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('loans')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'loans'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Wrench className="h-4 w-4" />
            <span>Registrar Préstamo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('returns')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'returns'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <RotateCcw className="h-4 w-4" />
            <span>Devoluciones Rápidas</span>
            {metrics.activeLoansCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                activeSubTab === 'returns' ? 'bg-white text-blue-700' : 'bg-amber-100 text-amber-800'
              }`}>
                {metrics.activeLoansCount} pendientes
              </span>
            )}
          </button>
        </div>
      </div>

      {/* FEEDBACK NOTIFICATION */}
      {actionFeedback && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs animate-fadeIn ${
          actionFeedback.type === 'ok'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2.5">
            {actionFeedback.type === 'ok' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            )}
            <span>{actionFeedback.text}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TARJETAS DE MÉTRICAS GLOBALES DEL PAÑOL                                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Métrica 1: Personas con herramienta */}
        <div 
          onClick={() => { setActiveSubTab('tracking'); setOnlyWithToolsFilter(true); }}
          className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1 cursor-pointer hover:border-blue-400 transition group"
        >
          <span className="text-[10px] font-mono uppercase font-bold text-slate-400 flex items-center gap-1 group-hover:text-blue-600">
            <Users className="h-3.5 w-3.5 text-blue-600" />
            <span>Personal con Equipo</span>
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-slate-900 group-hover:text-blue-600">
              {metrics.peopleWithTools}
            </span>
            <span className="text-[11px] font-bold text-blue-600">colaboradores</span>
          </div>
        </div>

        {/* Métrica 2: Herramientas activas */}
        <div 
          onClick={() => setActiveSubTab('returns')}
          className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1 cursor-pointer hover:border-blue-400 transition group"
        >
          <span className="text-[10px] font-mono uppercase font-bold text-slate-400 flex items-center gap-1 group-hover:text-blue-600">
            <Wrench className="h-3.5 w-3.5 text-blue-600" />
            <span>Herramientas Prestadas</span>
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-slate-900">
              {metrics.totalToolsQty}
            </span>
            <span className="text-[11px] font-bold text-slate-500">en {metrics.activeLoansCount} folios</span>
          </div>
        </div>

        {/* Métrica 3: Vencen Hoy */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-mono uppercase font-bold text-slate-400 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            <span>Vencen Hoy</span>
          </span>
          <div className="flex items-baseline justify-between">
            <span className={`text-2xl font-black font-mono ${metrics.dueTodayCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
              {metrics.dueTodayCount}
            </span>
            <span className="text-[11px] font-bold text-slate-500">por recibir hoy</span>
          </div>
        </div>

        {/* Métrica 4: Préstamos Atrasados */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-mono uppercase font-bold text-slate-400 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
            <span>Préstamos Atrasados</span>
          </span>
          <div className="flex items-baseline justify-between">
            <span className={`text-2xl font-black font-mono ${metrics.overdueCount > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-800'}`}>
              {metrics.overdueCount}
            </span>
            <span className="text-[11px] font-bold text-rose-600">requieren reclamo</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: SEGUIMIENTO POR PERSONA (¿QUÉ HERRAMIENTA TIENE CADA PERSONA?)    */}
      {/* ========================================================================= */}
      {activeSubTab === 'tracking' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Barra de Filtros y Búsqueda */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-150">
              <div className="space-y-0.5">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <span>Seguimiento de Herramientas por Persona</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Consulte exactamente qué herramienta tiene cada colaborador, fechas de retorno y procese devoluciones individuales o grupales.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExportLoansExcel}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title="Descargar reporte en Excel"
                >
                  <FileDown className="h-3.5 w-3.5 text-slate-600" />
                  <span>Exportar Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('loans')}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  <span>+ Prestar Herramienta</span>
                </button>
              </div>
            </div>

            {/* Inputs de Filtro */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Buscador de Persona o Herramienta */}
              <div className="sm:col-span-6 relative">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={personSearch}
                  onChange={(e) => setPersonSearch(e.target.value)}
                  placeholder="Buscar por nombre de persona, puesto o herramienta que tiene..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-250 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Filtro por Departamento */}
              <div className="sm:col-span-3">
                <select
                  value={selectedDeptFilter}
                  onChange={(e) => setSelectedDeptFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-250 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="ALL">Todos los Departamentos</option>
                  {departmentsList.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Toggle: Solo personas con herramientas activas */}
              <div className="sm:col-span-3 flex items-center">
                <button
                  type="button"
                  onClick={() => setOnlyWithToolsFilter(!onlyWithToolsFilter)}
                  className={`w-full py-2.5 px-3 rounded-2xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-2 ${
                    onlyWithToolsFilter
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${onlyWithToolsFilter ? 'bg-blue-600' : 'bg-slate-400'}`}></span>
                  <span>{onlyWithToolsFilter ? 'Solo con herramientas' : 'Ver todo el personal'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* LISTADO / DIRECTORIO DE PERSONAS Y SUS HERRAMIENTAS */}
          {filteredPeople.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">
                {onlyWithToolsFilter 
                  ? '¡Ninguna persona tiene herramientas pendientes de devolución!' 
                  : 'No se encontraron colaboradores con los criterios seleccionados.'}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {onlyWithToolsFilter
                  ? 'Todas las herramientas del inventario se encuentran resguardadas en el almacén.'
                  : 'Intente buscar con otro nombre o limpie los filtros.'}
              </p>
              {onlyWithToolsFilter && (
                <button
                  type="button"
                  onClick={() => setOnlyWithToolsFilter(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer mt-2"
                >
                  Ver todo el directorio de colaboradores
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredPeople.map((person) => {
                const totalToolsInPossession = person.activeLoans.reduce((sum, l) => sum + (l.qty || 1), 0);
                const isExpanded = expandedPersonCards[person.name] ?? (person.activeLoans.length > 0);

                return (
                  <div 
                    key={person.id} 
                    className={`bg-white rounded-3xl border transition-all duration-200 shadow-xs overflow-hidden ${
                      person.hasOverdue
                        ? 'border-rose-300 ring-1 ring-rose-300/50'
                        : person.activeLoans.length > 0
                        ? 'border-blue-200 ring-1 ring-blue-100'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Header de la Tarjeta de la Persona */}
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-50/50 to-white">
                      
                      {/* Avatar y Datos Personales */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 font-mono font-black text-sm shadow-xs ${
                          person.hasOverdue
                            ? 'bg-rose-500 text-white'
                            : person.activeLoans.length > 0
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          {person.name.charAt(0).toUpperCase()}
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                              {person.name}
                            </h4>
                            {person.hasOverdue && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-black bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                                <AlertTriangle className="h-3 w-3 text-rose-600" />
                                <span>Atrasado</span>
                              </span>
                            )}
                            {person.hasDueToday && !person.hasOverdue && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-black bg-amber-100 text-amber-800 border border-amber-200">
                                <Clock className="h-3 w-3 text-amber-600" />
                                <span>Vence Hoy</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                            <span className="font-semibold text-slate-700">{person.role}</span>
                            <span>•</span>
                            <span className="text-blue-700 font-medium">{person.department}</span>
                            {person.employeeNumber && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[10px] text-slate-400">{person.employeeNumber}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Contador de herramientas y Botones de Acción */}
                      <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0 flex-wrap">
                        
                        {/* Badge de Herramientas en su poder */}
                        <div className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-black flex items-center gap-1.5 ${
                          person.activeLoans.length > 0
                            ? 'bg-blue-50 text-blue-900 border-blue-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          <Wrench className="h-3.5 w-3.5 text-blue-600" />
                          <span>
                            {person.activeLoans.length > 0 
                              ? `${totalToolsInPossession} herramienta(s) asignadas` 
                              : 'Sin herramientas asignadas'}
                          </span>
                        </div>

                        {/* Botón: Prestar otra herramienta a esta persona */}
                        <button
                          type="button"
                          onClick={() => handlePreFillForPerson(person.name, person.department)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          title={`Registrar nuevo préstamo para ${person.name}`}
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          <span>+ Prestar</span>
                        </button>

                        {/* Botón: Devolver Todo (si tiene herramientas) */}
                        {person.activeLoans.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleBulkReturnForPerson(person.name, person.activeLoans)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                            title="Recibir y reintegrar todas las herramientas de esta persona"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Devolver Todo ({person.activeLoans.length})</span>
                          </button>
                        )}

                        {/* Toggle Acordeón */}
                        {person.activeLoans.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpandPerson(person.name)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                            title={isExpanded ? 'Ocultar desglose' : 'Ver desglose de herramientas'}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Desglose de Herramientas que tiene esta Persona */}
                    {person.activeLoans.length > 0 && isExpanded && (
                      <div className="p-4 sm:p-5 bg-slate-50/80 border-t border-slate-150 space-y-3">
                        <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                          Herramientas actualmente bajo resguardo de {person.name}:
                        </span>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {person.activeLoans.map((loan) => {
                            const todayStr = new Date().toISOString().slice(0, 10);
                            const isOverdue = loan.expectedReturnDate && loan.expectedReturnDate < todayStr;
                            const isToday = loan.expectedReturnDate && loan.expectedReturnDate === todayStr;

                            return (
                              <div
                                key={loan.id}
                                className={`p-3.5 bg-white rounded-2xl border transition shadow-2xs space-y-3 flex flex-col justify-between ${
                                  isOverdue
                                    ? 'border-rose-300 bg-rose-50/30'
                                    : isToday
                                    ? 'border-amber-300 bg-amber-50/30'
                                    : 'border-slate-200'
                                }`}
                              >
                                <div className="space-y-2">
                                  {/* Encabezado de la herramienta */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2 min-w-0">
                                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                                        isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                                      }`}>
                                        <Wrench className="h-4 w-4" />
                                      </div>
                                      <div className="min-w-0">
                                        <strong className="text-xs font-black text-slate-900 block truncate leading-tight">
                                          {loan.productName}
                                        </strong>
                                        <span className="font-mono text-[10px] text-amber-800 font-bold block">
                                          {loan.sku} • {loan.qty} ud(s)
                                        </span>
                                      </div>
                                    </div>

                                    <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-full shrink-0 ${
                                      isOverdue
                                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                        : isToday
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    }`}>
                                      {isOverdue ? 'Atrasado' : isToday ? 'Vence Hoy' : 'Al Corriente'}
                                    </span>
                                  </div>

                                  {/* Detalles de fechas y ubicación */}
                                  <div className="text-[10px] space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                                    <div className="flex items-center justify-between text-slate-500">
                                      <span>Fecha Préstamo:</span>
                                      <span className="font-mono text-slate-700 font-bold">
                                        {new Date(loan.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-500">Fecha Retorno:</span>
                                      <strong className={`font-mono ${isOverdue ? 'text-rose-700' : 'text-slate-800'}`}>
                                        {formatFriendlyDate(loan.expectedReturnDate || '')}
                                      </strong>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-200">
                                      <span>Celda Origen:</span>
                                      <span className="font-mono text-blue-700 font-bold">
                                        {loan.originBins && loan.originBins.length > 0 ? loan.originBins[0] : 'Pañol Central'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Botón directo de Devolver esta herramienta */}
                                <div className="pt-1 flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleReturnItem(loan)}
                                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>Devolver Esta Herramienta</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setViewTicketModalRecord(loan)}
                                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                                    title="Ver vale de resguardo"
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: REGISTRAR PRÉSTAMO (3 Pasos: ¿Qué?, ¿A quién/dónde?, ¿Cuándo?)     */}
      {/* ========================================================================= */}
      {activeSubTab === 'loans' && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-blue-200/90 shadow-xs space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-150">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-7 w-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                    <Wrench className="h-4 w-4" />
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Ventanilla de Préstamo de Herramienta
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Solo 3 datos esenciales: <strong>lo que se presta</strong>, <strong>a dónde se va / a quién</strong> y <strong>cuándo regresa</strong>.
                </p>
              </div>

              {selectedTool && targetPersonOrPlace && (
                <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Formulario completo para registrar</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* 1. ¿QUÉ SE PRESTA? */}
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
                    {selectedTool && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        <span>Herramienta lista</span>
                      </span>
                    )}
                  </div>

                  {selectedTool ? (
                    /* Tarjeta de la Herramienta Seleccionada */
                    <div className="p-3.5 bg-white border-2 border-amber-400 rounded-2xl shadow-2xs space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                            <Wrench className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              {selectedTool.sku}
                            </span>
                            <h5 className="text-xs sm:text-sm font-black text-slate-900 leading-tight mt-1 truncate">
                              {selectedTool.name}
                            </h5>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSku('');
                            setLoanQty(1);
                          }}
                          className="text-[10px] text-rose-600 hover:text-rose-800 font-bold bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded-lg transition cursor-pointer shrink-0"
                        >
                          Cambiar
                        </button>
                      </div>

                      {/* Stock y Ubicación en celda */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[10px]">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-150">
                          <span className="text-slate-400 font-mono uppercase block">Disponible</span>
                          <strong className="text-xs font-black text-slate-900">{selectedTool.qty} uds</strong>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-150">
                          <span className="text-slate-400 font-mono uppercase block">Ubicación (Celda)</span>
                          <strong className="text-xs font-mono font-bold text-amber-800 truncate block">
                            {selectedToolBins.length > 0 ? selectedToolBins[0].id : 'Almacén Central'}
                          </strong>
                        </div>
                      </div>

                      {/* Contador de Cantidad */}
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
                            onClick={() => setLoanQty(Math.min(selectedTool.qty, loanQty + 1))}
                            disabled={loanQty >= selectedTool.qty}
                            className="px-2.5 py-1 text-slate-700 hover:bg-slate-200 font-bold disabled:opacity-30 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Buscador y Galería de Herramientas */
                    <div className="space-y-2.5">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={toolSearchQuery}
                          onChange={(e) => setToolSearchQuery(e.target.value)}
                          placeholder="Escriba o escanee herramienta (taladro, multímetro...)"
                          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-3xs"
                        />
                      </div>

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
                                setSelectedSku(item.sku);
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

              {/* 2. ¿A DÓNDE SE VA / A QUIÉN? */}
              <div className="space-y-4 p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-7 w-7 rounded-xl bg-blue-600 text-white font-mono font-black text-xs flex items-center justify-center shadow-xs">
                        2
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900">
                        ¿A dónde se va / A quién?
                      </h4>
                    </div>
                    {targetPersonOrPlace && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        <span>Destino definido</span>
                      </span>
                    )}
                  </div>

                  {/* Input Directo de Nombre o Taller */}
                  <div className="space-y-2.5">
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={targetPersonOrPlace}
                        onChange={(e) => setTargetPersonOrPlace(e.target.value)}
                        placeholder="Escriba persona o lugar (ej. Carlos Martínez, Taller...)"
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-3xs"
                      />
                    </div>

                    {/* Chips Rápidos de Técnicos Registrados (1 Clic) */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                        Colaboradores y talleres frecuentes (1 clic para rellenar):
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {borrowers.map(b => {
                          const isSelected = targetPersonOrPlace === b.name;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => {
                                setTargetPersonOrPlace(b.name);
                                setPersonDepartment(b.department || '');
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shadow-3xs border ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-600 font-bold'
                                  : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-800 border-slate-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`}></span>
                              <span>{b.name}</span>
                            </button>
                          );
                        })}
                        {['Taller Mecánico', 'Mantenimiento Industrial', 'Obra Activa', 'Línea de Producción'].map(place => (
                          <button
                            key={place}
                            type="button"
                            onClick={() => {
                              setTargetPersonOrPlace(place);
                              setPersonDepartment(place);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shadow-3xs border ${
                              targetPersonOrPlace === place
                                ? 'bg-blue-600 text-white border-blue-600 font-bold'
                                : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-800 border-slate-200'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
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

              {/* 3. ¿CUÁNDO REGRESA? */}
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
                      onClick={() => setDurationPreset('shift_end')}
                      className={`p-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center gap-0.5 cursor-pointer border ${
                        durationPreset === 'shift_end'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Hoy (Fin de Turno)
                      </span>
                      <span className={`text-[9px] font-mono ${durationPreset === 'shift_end' ? 'text-indigo-200' : 'text-slate-400'}`}>
                        Mismo día
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDurationPreset('tomorrow')}
                      className={`p-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center gap-0.5 cursor-pointer border ${
                        durationPreset === 'tomorrow'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Mañana
                      </span>
                      <span className={`text-[9px] font-mono ${durationPreset === 'tomorrow' ? 'text-indigo-200' : 'text-slate-400'}`}>
                        +24 horas
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDurationPreset('3days')}
                      className={`p-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center gap-0.5 cursor-pointer border ${
                        durationPreset === '3days'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        En 3 Días
                      </span>
                      <span className={`text-[9px] font-mono ${durationPreset === '3days' ? 'text-indigo-200' : 'text-slate-400'}`}>
                        +72 horas
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDurationPreset('1week')}
                      className={`p-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center gap-0.5 cursor-pointer border ${
                        durationPreset === '1week'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        1 Semana
                      </span>
                      <span className={`text-[9px] font-mono ${durationPreset === '1week' ? 'text-indigo-200' : 'text-slate-400'}`}>
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
                      {formatFriendlyDate(calculatedReturnDate)}
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
                onClick={handleExecuteLoan}
                disabled={isProcessingLoan || !selectedTool || !targetPersonOrPlace}
                className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 hover:from-blue-700 hover:to-slate-800 disabled:opacity-40 text-white rounded-2xl text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:cursor-not-allowed active:scale-98"
              >
                <Wrench className="h-5 w-5 text-blue-200" />
                <span>REGISTRAR PRÉSTAMO DE HERRAMIENTA</span>
                {selectedTool && targetPersonOrPlace && (
                  <span className="text-xs font-medium text-blue-200 ml-2 hidden sm:inline">
                    ({selectedTool.name} → {targetPersonOrPlace})
                  </span>
                )}
              </button>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 3: DEVOLUCIONES RÁPIDAS (RECEPCIÓN DIRECTA EN ALMACÉN)              */}
      {/* ========================================================================= */}
      {activeSubTab === 'returns' && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 shadow-xs space-y-5">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-150">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
                    ✓
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Ventanilla de Devoluciones Rápidas ({activeLoans.length} activas)
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Reciba la herramienta del técnico y reintegre el stock al almacén con un solo clic.
                </p>
              </div>

              {activeLoans.length > 0 && (
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={returnDeskSearch}
                    onChange={(e) => setReturnDeskSearch(e.target.value)}
                    placeholder="Buscar por herramienta, técnico o folio..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {/* Condición de Recepción de la Herramienta */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Estado físico de la herramienta al devolver:</span>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedReturnCondition('good')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition border cursor-pointer ${
                    selectedReturnCondition === 'good'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  ✓ Buen Estado / Lista para Usar
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReturnCondition('maintenance')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition border cursor-pointer ${
                    selectedReturnCondition === 'maintenance'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  ⚠️ Requiere Mantenimiento / Limpieza
                </button>
              </div>
            </div>

            {activeLoans.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/70 space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-950">
                  ¡Todas las herramientas están resguardadas en el almacén!
                </h4>
                <p className="text-xs text-emerald-800 max-w-md mx-auto">
                  No hay préstamos activos pendientes en este momento.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 text-left">Folio / Fecha</th>
                      <th className="pb-3 text-left">1. Herramienta Prestada</th>
                      <th className="pb-3 text-left">Ubicación Origen</th>
                      <th className="pb-3 text-left">2. Persona / Destino</th>
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

                          {/* 1. HERRAMIENTA PRESTADA */}
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
                              {loan.originBins && loan.originBins.length > 0 ? loan.originBins.join(', ') : 'Pañol Central'}
                            </span>
                          </td>

                          {/* 2. PERSONA / DESTINO */}
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-lg bg-indigo-100 text-indigo-700 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                                <User className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <strong className="text-slate-900 block font-bold leading-tight">
                                  {loan.borrowerName || loan.destination || 'Taller'}
                                </strong>
                                {loan.borrowerDepartment && (
                                  <span className="text-[10px] text-slate-500 font-medium block">
                                    {loan.borrowerDepartment}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 3. CUÁNDO REGRESA */}
                          <td className="py-3 font-mono text-xs">
                            <strong className="text-slate-800 block">
                              {formatFriendlyDate(loan.expectedReturnDate || '')}
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
                                <span>Al Corriente</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleReturnItem(loan)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                title="Reintegrar herramienta al almacén con 1 solo clic"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Devolver (1 Clic)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setViewTicketModalRecord(loan)}
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

          {/* Historial Reciente de Devoluciones */}
          {returnedLoans.length > 0 && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-150">
                <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-emerald-600" />
                  <span>Historial Reciente de Herramientas Devueltas ({returnedLoans.length})</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">Reintegradas al almacén central</span>
              </div>

              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto text-xs">
                {returnedLoans.slice(0, 10).map((ret) => (
                  <div key={ret.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <strong className="text-slate-900 block truncate">{ret.productName}</strong>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {ret.sku} ({ret.qty} uds) • Devuelto por: <strong>{ret.borrowerName || ret.destination}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono text-[10px] text-slate-400">
                      <span>{ret.returnTimestamp ? new Date(ret.returnTimestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Completado'}</span>
                      {ret.returnOperator && <span className="block text-slate-600">Recibió: {ret.returnOperator}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VALE OFICIAL DE RESGUARDO Y PRÉSTAMO                              */}
      {/* ========================================================================= */}
      {viewTicketModalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-150">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  Vale de Resguardo de Herramienta
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewTicketModalRecord(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Folio:</span>
                <strong className="font-mono text-slate-900">{viewTicketModalRecord.id}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Herramienta:</span>
                <strong className="text-slate-900">{viewTicketModalRecord.productName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">SKU / Cantidad:</span>
                <span className="font-mono font-bold text-amber-800">{viewTicketModalRecord.sku} ({viewTicketModalRecord.qty} uds)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Responsable / Técnico:</span>
                <strong className="text-blue-900">{viewTicketModalRecord.borrowerName || viewTicketModalRecord.destination}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha Estimada Devolución:</span>
                <strong className="font-mono text-slate-900">{viewTicketModalRecord.expectedReturnDate || 'Fin de turno'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Entregó (Almacén):</span>
                <span className="text-slate-700">{viewTicketModalRecord.operator}</span>
              </div>
            </div>

            {/* Firmas */}
            <div className="grid grid-cols-2 gap-4 pt-4 text-center text-[10px] text-slate-500">
              <div className="pt-8 border-t border-slate-300">
                <span>Firma del Responsable (Técnico)</span>
              </div>
              <div className="pt-8 border-t border-slate-300">
                <span>Firma de Entrega (Almacén)</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Imprimir Vale</span>
              </button>
              <button
                type="button"
                onClick={() => setViewTicketModalRecord(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
