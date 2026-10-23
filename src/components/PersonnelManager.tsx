import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Briefcase, 
  Building2, 
  Phone, 
  BadgeCheck, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Wrench, 
  X, 
  Edit3, 
  Trash2, 
  FileDown, 
  Printer, 
  ArrowUpRight, 
  ShieldCheck, 
  Calendar, 
  Check, 
  Sparkles,
  RotateCcw,
  UserCheck,
  ChevronRight,
  HardHat,
  Tag,
  List,
  LayoutGrid
} from 'lucide-react';
import { BorrowerPersonnel } from '../types';

interface DirectDispatchRecord {
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
  deliveryMethod?: string;
  notes?: string;
  operator?: string;
}

interface PersonnelManagerProps {
  onNavigateToTab?: (tab: string) => void;
  activeOperator?: any;
  platformTheme?: any;
  onReturnLoan?: (recordId: string, sku: string, qty: number, targetBinId?: string, returnOperator?: string) => Promise<boolean>;
}

const INITIAL_BORROWERS: BorrowerPersonnel[] = [
  {
    id: 'BOR-01',
    name: 'Carlos Martínez Méndez',
    role: 'Técnico de Mantenimiento',
    department: 'Mantenimiento Industrial',
    employeeNumber: 'EMP-1021',
    phone: '55 4192 8831',
    company: 'Interno (Planta Principal)',
    status: 'active',
    notes: 'Autorizado para equipo neumático y herramienta eléctrica de alto impacto.',
    source: 'database',
    createdAt: '2026-01-15T08:00:00.000Z'
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
    notes: 'Responsable de cuadrilla civil y resguardos temporales en obra.',
    source: 'database',
    createdAt: '2026-01-20T09:30:00.000Z'
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
    notes: 'Herramientas de diagnóstico automotriz y prensas hidráulicas.',
    source: 'database',
    createdAt: '2026-02-01T10:15:00.000Z'
  },
  {
    id: 'BOR-04',
    name: 'Javier Gómez Peña',
    role: 'Instalador Eléctrico',
    department: 'Contratista Externo',
    employeeNumber: 'CONTR-551',
    phone: '55 6712 0049',
    company: 'Electromecánica del Centro S.A.',
    status: 'active',
    notes: 'Contratista temporal. Requiere vale firmado con supervisor para herramientas especiales.',
    source: 'database',
    createdAt: '2026-02-10T11:00:00.000Z'
  },
  {
    id: 'BOR-05',
    name: 'Miguel Ángel Torres',
    role: 'Técnico Electromecánico',
    department: 'Línea de Producción',
    employeeNumber: 'EMP-1120',
    phone: '55 2291 4455',
    company: 'Interno (Planta Principal)',
    status: 'active',
    notes: 'Calibradores y multímetros certificados.',
    source: 'database',
    createdAt: '2026-02-15T14:20:00.000Z'
  },
  {
    id: 'BOR-06',
    name: 'Eduardo Valdés Ramos',
    role: 'Soldador Especialista',
    department: 'Estructuras y Patios',
    employeeNumber: 'EMP-1135',
    phone: '55 8812 7733',
    company: 'Interno (Planta Principal)',
    status: 'active',
    notes: 'Equipo de corte por plasma y caretas electrónicas.',
    source: 'database',
    createdAt: '2026-02-18T16:45:00.000Z'
  }
];

export const PersonnelManager: React.FC<PersonnelManagerProps> = ({
  onNavigateToTab,
  activeOperator,
  platformTheme,
  onReturnLoan
}) => {
  // Personnel list state
  const [personnelList, setPersonnelList] = useState<BorrowerPersonnel[]>(() => {
    try {
      const saved = localStorage.getItem('OWMS_BORROWERS_DATABASE');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Normalize to BorrowerPersonnel
          return parsed.map((p: any, idx: number) => ({
            id: p.id || `BOR-${String(idx + 1).padStart(2, '0')}`,
            name: p.name || 'Sin Nombre',
            role: p.role || 'Técnico / Colaborador',
            department: p.department || 'Planta',
            phone: p.phone || '',
            employeeNumber: p.employeeNumber || `EMP-${1000 + idx}`,
            company: p.company || 'Interno',
            status: p.status || 'active',
            notes: p.notes || '',
            source: p.source || 'database',
            createdAt: p.createdAt || new Date().toISOString()
          }));
        }
      }
    } catch (e) {}
    return INITIAL_BORROWERS;
  });

  // Dispatches history state (to detect active loans)
  const [dispatches, setDispatches] = useState<DirectDispatchRecord[]>(() => {
    try {
      const saved = localStorage.getItem('OWMS_DIRECT_DISPATCH_HISTORY');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  // Sync with storage events
  useEffect(() => {
    const handleSync = () => {
      try {
        const savedBor = localStorage.getItem('OWMS_BORROWERS_DATABASE');
        if (savedBor) {
          const parsed = JSON.parse(savedBor);
          if (Array.isArray(parsed)) {
            setPersonnelList(parsed.map((p: any, idx: number) => ({
              id: p.id || `BOR-${String(idx + 1).padStart(2, '0')}`,
              name: p.name || 'Sin Nombre',
              role: p.role || 'Técnico / Colaborador',
              department: p.department || 'Planta',
              phone: p.phone || '',
              employeeNumber: p.employeeNumber || `EMP-${1000 + idx}`,
              company: p.company || 'Interno',
              status: p.status || 'active',
              notes: p.notes || '',
              source: p.source || 'database',
              createdAt: p.createdAt || new Date().toISOString()
            })));
          }
        }

        const savedDisp = localStorage.getItem('OWMS_DIRECT_DISPATCH_HISTORY');
        if (savedDisp) setDispatches(JSON.parse(savedDisp));
      } catch (e) {}
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('owms_borrowers_updated', handleSync);
    window.addEventListener('wms_direct_dispatches_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('owms_borrowers_updated', handleSync);
      window.removeEventListener('wms_direct_dispatches_updated', handleSync);
    };
  }, []);

  // Save personnel list to storage & notify other components
  const savePersonnelList = (updated: BorrowerPersonnel[]) => {
    setPersonnelList(updated);
    try {
      localStorage.setItem('OWMS_BORROWERS_DATABASE', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('owms_borrowers_updated'));
      window.dispatchEvent(new CustomEvent('wms_direct_dispatches_updated'));
    } catch (e) {}
  };

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE_LOANS' | 'NO_LOANS' | 'OVERDUE' | 'INACTIVE'>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');

  // Modal State for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<BorrowerPersonnel | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formEmployeeNumber, setFormEmployeeNumber] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCompany, setFormCompany] = useState('Interno (Planta Principal)');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [successFeedback, setSuccessFeedback] = useState('');

  // Modal State for Viewing Loan Details
  const [viewingLoansPerson, setViewingLoansPerson] = useState<BorrowerPersonnel | null>(null);

  // Print view state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Quick suggestions for role and department
  const roleSuggestions = [
    'Técnico de Mantenimiento',
    'Mecánico de Flota',
    'Supervisor de Obra',
    'Instalador Eléctrico',
    'Soldador Especialista',
    'Operador de Maquinaria',
    'Técnico Electromecánico',
    'Contratista Externo'
  ];

  const departmentSuggestions = [
    'Mantenimiento Industrial',
    'Taller Central',
    'Construcción y Patios',
    'Línea de Producción',
    'Estructuras y Patios',
    'Instalaciones Eléctricas',
    'Logística & Transporte'
  ];

  // Map of active loans by borrower name (case-insensitive)
  const activeLoansByBorrower = useMemo(() => {
    const map = new Map<string, DirectDispatchRecord[]>();
    dispatches.forEach(d => {
      if (d.dispatchType === 'loan' && d.borrowerName && d.loanStatus !== 'returned') {
        const key = d.borrowerName.trim().toLowerCase();
        const existing = map.get(key) || [];
        existing.push(d);
        map.set(key, existing);
      }
    });
    return map;
  }, [dispatches]);

  // Today string for overdue checking
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalRegistered = personnelList.length;
    let activePersonsCount = personnelList.filter(p => p.status === 'active').length;
    let personsWithLoans = 0;
    let totalToolsOnLoan = 0;
    let overdueLoansCount = 0;

    personnelList.forEach(p => {
      const loans = activeLoansByBorrower.get(p.name.trim().toLowerCase()) || [];
      if (loans.length > 0) {
        personsWithLoans += 1;
        loans.forEach(l => {
          totalToolsOnLoan += (l.qty || 1);
          if (l.expectedReturnDate && l.expectedReturnDate < todayStr) {
            overdueLoansCount += 1;
          }
        });
      }
    });

    return {
      totalRegistered,
      activePersonsCount,
      personsWithLoans,
      totalToolsOnLoan,
      overdueLoansCount
    };
  }, [personnelList, activeLoansByBorrower, todayStr]);

  // Distinct Departments
  const distinctDepartments = useMemo(() => {
    const set = new Set<string>();
    personnelList.forEach(p => {
      if (p.department && p.department.trim()) set.add(p.department.trim());
    });
    return Array.from(set).sort();
  }, [personnelList]);

  // Filtered personnel
  const filteredPersonnel = useMemo(() => {
    return personnelList.filter(person => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || (
        person.name.toLowerCase().includes(q) ||
        person.role.toLowerCase().includes(q) ||
        (person.department || '').toLowerCase().includes(q) ||
        (person.employeeNumber || '').toLowerCase().includes(q) ||
        (person.phone || '').toLowerCase().includes(q)
      );

      const matchesDept = departmentFilter === 'ALL' || person.department === departmentFilter;

      const loans = activeLoansByBorrower.get(person.name.trim().toLowerCase()) || [];
      const hasActiveLoans = loans.length > 0;
      const hasOverdue = loans.some(l => l.expectedReturnDate && l.expectedReturnDate < todayStr);

      let matchesStatus = true;
      if (statusFilter === 'ACTIVE_LOANS') matchesStatus = hasActiveLoans;
      else if (statusFilter === 'NO_LOANS') matchesStatus = !hasActiveLoans && person.status === 'active';
      else if (statusFilter === 'OVERDUE') matchesStatus = hasOverdue;
      else if (statusFilter === 'INACTIVE') matchesStatus = person.status === 'inactive';

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [personnelList, searchQuery, departmentFilter, statusFilter, activeLoansByBorrower, todayStr]);

  // Open modal for new registration
  const handleOpenCreateModal = () => {
    setEditingPerson(null);
    setFormName('');
    setFormRole('Técnico de Mantenimiento');
    setFormDepartment('Mantenimiento Industrial');
    setFormEmployeeNumber(`EMP-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormPhone('');
    setFormCompany('Interno (Planta Principal)');
    setFormStatus('active');
    setFormNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEditModal = (person: BorrowerPersonnel) => {
    setEditingPerson(person);
    setFormName(person.name);
    setFormRole(person.role);
    setFormDepartment(person.department || '');
    setFormEmployeeNumber(person.employeeNumber || '');
    setFormPhone(person.phone || '');
    setFormCompany(person.company || 'Interno (Planta Principal)');
    setFormStatus(person.status || 'active');
    setFormNotes(person.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  // Save form (create or edit)
  const handleSavePerson = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName) {
      setFormError('Por favor ingrese el nombre completo del colaborador.');
      return;
    }
    if (!formRole.trim()) {
      setFormError('Por favor especifique el puesto o especialidad.');
      return;
    }
    if (!formDepartment.trim()) {
      setFormError('Por favor indique el departamento o cuadrilla.');
      return;
    }

    // Check duplicate name
    const isDuplicate = personnelList.some(p => 
      p.name.toLowerCase() === cleanName.toLowerCase() && 
      (!editingPerson || p.id !== editingPerson.id)
    );
    if (isDuplicate) {
      setFormError(`Ya existe un colaborador registrado con el nombre "${cleanName}".`);
      return;
    }

    if (editingPerson) {
      // Edit existing
      const updated = personnelList.map(p => {
        if (p.id === editingPerson.id) {
          return {
            ...p,
            name: cleanName,
            role: formRole.trim(),
            department: formDepartment.trim(),
            employeeNumber: formEmployeeNumber.trim() || undefined,
            phone: formPhone.trim() || undefined,
            company: formCompany.trim() || undefined,
            status: formStatus,
            notes: formNotes.trim() || undefined,
            updatedAt: new Date().toISOString()
          };
        }
        return p;
      });
      savePersonnelList(updated);
      setSuccessFeedback(`Colaborador "${cleanName}" actualizado con éxito.`);
    } else {
      // Create new
      const newPerson: BorrowerPersonnel = {
        id: `BOR-${Date.now().toString().slice(-4)}`,
        name: cleanName,
        role: formRole.trim(),
        department: formDepartment.trim(),
        employeeNumber: formEmployeeNumber.trim() || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
        phone: formPhone.trim() || undefined,
        company: formCompany.trim() || 'Interno (Planta Principal)',
        status: formStatus,
        notes: formNotes.trim() || undefined,
        source: 'database',
        createdAt: new Date().toISOString()
      };
      savePersonnelList([newPerson, ...personnelList]);
      setSuccessFeedback(`¡Colaborador "${cleanName}" dado de alta con éxito! Ahora está disponible para préstamos de almacén.`);
    }

    setIsModalOpen(false);
    setTimeout(() => setSuccessFeedback(''), 4000);
  };

  // Toggle active / inactive status
  const handleToggleStatus = (person: BorrowerPersonnel) => {
    const newStatus = person.status === 'active' ? 'inactive' : 'active';
    const updated = personnelList.map(p => p.id === person.id ? { ...p, status: newStatus } : p);
    savePersonnelList(updated);
  };

  // Delete person
  const handleDeletePerson = (person: BorrowerPersonnel) => {
    const loans = activeLoansByBorrower.get(person.name.trim().toLowerCase()) || [];
    if (loans.length > 0) {
      alert(`No se puede eliminar a "${person.name}" porque tiene ${loans.length} herramienta(s) pendiente(s) de devolución. Registre la devolución primero.`);
      return;
    }
    if (confirm(`¿Está seguro de eliminar a "${person.name}" del padrón de personal autorizado para préstamos?`)) {
      const updated = personnelList.filter(p => p.id !== person.id);
      savePersonnelList(updated);
      setSuccessFeedback(`"${person.name}" fue eliminado del padrón.`);
      setTimeout(() => setSuccessFeedback(''), 3000);
    }
  };

  // Return a loan directly from modal
  const handleReturnLoanFromModal = async (recordId: string) => {
    const rec = dispatches.find(d => d.id === recordId);
    if (onReturnLoan && rec) {
      await onReturnLoan(rec.id, rec.sku, rec.qty || 1, rec.originBins?.[0], activeOperator?.name);
    }
    const updated = dispatches.map(d => {
      if (d.id === recordId) {
        return {
          ...d,
          loanStatus: 'returned' as const,
          returnTimestamp: new Date().toISOString(),
          returnOperator: activeOperator ? activeOperator.name : 'Operador WMS'
        };
      }
      return d;
    });
    setDispatches(updated);
    try {
      localStorage.setItem('OWMS_DIRECT_DISPATCH_HISTORY', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('wms_direct_dispatches_updated'));
      window.dispatchEvent(new CustomEvent('owms_dispatch_updated'));
      window.dispatchEvent(new CustomEvent('wms_inventory_updated'));
      window.dispatchEvent(new CustomEvent('owms_borrowers_updated'));
    } catch (e) {}
    setSuccessFeedback('¡Devolución de herramienta registrada con éxito! El inventario y las celdas se han reintegrado.');
    setTimeout(() => setSuccessFeedback(''), 3500);
  };

  // Export personnel to Excel
  const handleExportToExcel = () => {
    const data = filteredPersonnel.map((p, idx) => {
      const loans = activeLoansByBorrower.get(p.name.trim().toLowerCase()) || [];
      const hasOverdue = loans.some(l => l.expectedReturnDate && l.expectedReturnDate < todayStr);
      return {
        'No.': idx + 1,
        'Folio / ID': p.id,
        'No. Empleado': p.employeeNumber || 'N/A',
        'Nombre del Colaborador': p.name,
        'Puesto / Especialidad': p.role,
        'Departamento / Cuadrilla': p.department,
        'Teléfono / Contacto': p.phone || 'N/A',
        'Empresa': p.company || 'Interno',
        'Estado': p.status === 'active' ? 'Activo' : 'Inactivo',
        'Herramientas en Préstamo': loans.length,
        'Estatus Préstamos': loans.length === 0 ? 'Sin Préstamos' : hasOverdue ? 'CON PRÉSTAMOS VENCIDOS' : 'En Regla',
        'Notas': p.notes || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Personal Prestatario');
    XLSX.writeFile(workbook, `WMS_Padron_Personal_Prestatario_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* HEADER PRINCIPAL */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Módulo de Soporte · Control de Prestatarios
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                {personnelList.length} Registrados
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Users className="h-6 w-6 text-indigo-400" />
              <span>Directorio de Personal & Prestatarios de Almacén</span>
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl font-normal leading-relaxed">
              Alta y administración del personal técnico autorizado para recibir herramientas, materiales y maquinaria en resguardo o préstamo. Control de devoluciones e historial por colaborador.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-900/30 active:scale-95 border border-indigo-400/30"
            >
              <UserPlus className="h-4 w-4" />
              <span>+ Dar de Alta Personal</span>
            </button>

            <button
              type="button"
              onClick={handleExportToExcel}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-700/80 active:scale-95"
              title="Descargar padrón en formato Excel"
            >
              <FileDown className="h-4 w-4 text-emerald-400" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-700/80 active:scale-95"
              title="Vista para imprimir padrón oficial"
            >
              <Printer className="h-4 w-4 text-blue-400" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {successFeedback && (
        <div className="p-3.5 bg-emerald-50 border-2 border-emerald-300 text-emerald-900 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successFeedback}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setSuccessFeedback('')}
            className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* TARJETAS DE INDICADORES (METRIC CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-3xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">
              Total Personal Registrado
            </span>
            <div className="text-2xl font-black font-mono text-slate-900">
              {metrics.totalRegistered}
            </div>
            <span className="text-[10px] text-emerald-600 font-bold block">
              {metrics.activePersonsCount} Activos para Préstamos
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-3xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">
              Personal con Préstamos Activos
            </span>
            <div className="text-2xl font-black font-mono text-blue-600">
              {metrics.personsWithLoans}
            </div>
            <span className="text-[10px] text-slate-500 font-bold block">
              Técnicos con material en resguardo
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-3xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">
              Herramientas Fuera de Almacén
            </span>
            <div className="text-2xl font-black font-mono text-slate-900">
              {metrics.totalToolsOnLoan} <span className="text-xs font-normal text-slate-500">uds</span>
            </div>
            <span className="text-[10px] text-blue-600 font-bold block">
              En taller, cuadrilla u obra
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Wrench className="h-5 w-5" />
          </div>
        </div>

        <div className={`border rounded-2xl p-4 shadow-3xs flex items-center justify-between ${
          metrics.overdueLoansCount > 0 
            ? 'bg-rose-50/50 border-rose-200' 
            : 'bg-white border-slate-200/90'
        }`}>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider font-mono text-slate-400">
              Préstamos Vencidos
            </span>
            <div className={`text-2xl font-black font-mono ${metrics.overdueLoansCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {metrics.overdueLoansCount}
            </div>
            <span className={`text-[10px] font-bold block ${metrics.overdueLoansCount > 0 ? 'text-rose-700' : 'text-emerald-600'}`}>
              {metrics.overdueLoansCount > 0 ? 'Requieren devolución inmediata' : 'Al día / En tiempo'}
            </span>
          </div>
          <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${
            metrics.overdueLoansCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* CONTENEDOR DE BÚSQUEDA Y FILTROS */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-3xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Buscador */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar personal por nombre, puesto, cuadrilla, no. de empleado o teléfono..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Selector de Departamento */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 font-mono uppercase shrink-0 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <span>Depto:</span>
            </span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">Todos los Departamentos ({distinctDepartments.length})</option>
              {distinctDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Pestañas de estado rápido */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <span className="text-[10px] font-bold font-mono text-slate-400 uppercase mr-1">
            Filtro de Estado:
          </span>
          {[
            { id: 'ALL', label: `Todos (${personnelList.length})` },
            { id: 'ACTIVE_LOANS', label: `Con Préstamos Activos (${metrics.personsWithLoans})` },
            { id: 'NO_LOANS', label: `Disponibles (${personnelList.length - metrics.personsWithLoans})` },
            { id: 'OVERDUE', label: `Con Préstamos Vencidos (${metrics.overdueLoansCount})` },
            { id: 'INACTIVE', label: `Inactivos (${personnelList.filter(p => p.status === 'inactive').length})` }
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* LISTA / GRID DE PERSONAL */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 font-medium px-1">
          <span>Mostrando <strong>{filteredPersonnel.length}</strong> de <strong>{personnelList.length}</strong> colaboradores registrados</span>
          
          <div className="flex items-center gap-2">
            {/* View Mode Toggle: Listado vs Tarjetas */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Vista en Listado / Tabla"
              >
                <List className="h-3.5 w-3.5" />
                <span>Listado</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Vista en Tarjetas"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Tarjetas</span>
              </button>
            </div>

            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('salidas')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer ml-1"
              >
                <span>Ir a Salidas y Préstamos</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {filteredPersonnel.length === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              No se encontraron colaboradores con los criterios seleccionados
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Intente con otro término de búsqueda o registre a un nuevo colaborador en el botón superior.
            </p>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <UserPlus className="h-4 w-4" />
              <span>Dar de Alta Nuevo Colaborador</span>
            </button>
          </div>
        ) : viewMode === 'list' ? (
          /* VISTA EN LISTADO / TABLA */
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-3xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500 font-mono">
                    <th className="py-3.5 pl-4 pr-3">Colaborador / Técnico</th>
                    <th className="py-3.5 px-3">Puesto / Especialidad</th>
                    <th className="py-3.5 px-3">Departamento / Cuadrilla</th>
                    <th className="py-3.5 px-3">Teléfono / Contacto</th>
                    <th className="py-3.5 px-3 text-center">Estado</th>
                    <th className="py-3.5 px-3">Herramientas en Préstamo</th>
                    <th className="py-3.5 pr-4 pl-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredPersonnel.map((person) => {
                    const loans = activeLoansByBorrower.get(person.name.trim().toLowerCase()) || [];
                    const hasActiveLoans = loans.length > 0;
                    const hasOverdue = loans.some(l => l.expectedReturnDate && l.expectedReturnDate < todayStr);

                    return (
                      <tr 
                        key={person.id} 
                        className={`transition hover:bg-slate-50/80 ${
                          hasOverdue 
                            ? 'bg-rose-50/20' 
                            : hasActiveLoans 
                              ? 'bg-blue-50/15' 
                              : ''
                        }`}
                      >
                        {/* Colaborador */}
                        <td className="py-3.5 pl-4 pr-3">
                          <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 font-mono font-bold text-xs ${
                              person.status === 'inactive'
                                ? 'bg-slate-100 text-slate-400'
                                : hasOverdue
                                  ? 'bg-rose-100 text-rose-700'
                                  : hasActiveLoans
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-indigo-100 text-indigo-700'
                            }`}>
                              {person.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate">
                                {person.name}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-mono">
                                <span className="bg-slate-100 px-1.5 py-0.2 rounded font-bold text-slate-500">
                                  {person.employeeNumber || person.id}
                                </span>
                                {person.company && (
                                  <span className="truncate max-w-[140px] text-slate-400">
                                    • {person.company}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Puesto */}
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{person.role}</span>
                          </div>
                        </td>

                        {/* Departamento */}
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
                            <Building2 className="h-3 w-3 text-slate-400" />
                            <span>{person.department || 'Sin área asignada'}</span>
                          </span>
                        </td>

                        {/* Teléfono */}
                        <td className="py-3.5 px-3">
                          {person.phone ? (
                            <a 
                              href={`tel:${person.phone}`}
                              className="font-mono text-[11px] font-semibold text-slate-700 hover:text-indigo-600 flex items-center gap-1.5"
                            >
                              <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>{person.phone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">—</span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="py-3.5 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            person.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${person.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            <span>{person.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                          </span>
                        </td>

                        {/* Herramientas en Préstamo */}
                        <td className="py-3.5 px-3">
                          {hasActiveLoans ? (
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                hasOverdue
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}>
                                <Wrench className="h-3 w-3" />
                                <span>{loans.length} {loans.length === 1 ? 'herramienta' : 'herramientas'}</span>
                                {hasOverdue && <span className="text-[9px] font-black uppercase text-rose-700">· ¡Vencido!</span>}
                              </span>

                              <button
                                type="button"
                                onClick={() => setViewingLoansPerson(person)}
                                className="px-2 py-1 text-[10px] font-bold font-mono text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 rounded-md cursor-pointer border border-indigo-200 transition"
                              >
                                Ver Detalle
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span>Disponible</span>
                            </span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 pr-4 pl-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {person.status === 'active' && onNavigateToTab && (
                              <button
                                type="button"
                                onClick={() => onNavigateToTab('salidas')}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer flex items-center gap-1"
                                title="Prestar herramienta a este técnico"
                              >
                                <span>+ Prestar</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(person)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Editar datos del colaborador"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleStatus(person)}
                              className="px-2 py-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer text-[10px] font-bold font-mono border border-transparent hover:border-slate-200"
                              title={person.status === 'active' ? 'Pausar Técnico' : 'Reactivar Técnico'}
                            >
                              {person.status === 'active' ? 'Pausar' : 'Reactivar'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeletePerson(person)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Eliminar registro"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* VISTA EN TARJETAS */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPersonnel.map((person) => {
              const loans = activeLoansByBorrower.get(person.name.trim().toLowerCase()) || [];
              const hasActiveLoans = loans.length > 0;
              const hasOverdue = loans.some(l => l.expectedReturnDate && l.expectedReturnDate < todayStr);

              return (
                <div
                  key={person.id}
                  className={`bg-white rounded-2xl border transition duration-200 p-4.5 flex flex-col justify-between shadow-3xs hover:shadow-md ${
                    hasOverdue 
                      ? 'border-rose-300 ring-1 ring-rose-200' 
                      : hasActiveLoans 
                        ? 'border-blue-300' 
                        : 'border-slate-200/90'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header de la tarjeta */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 font-mono font-bold text-sm ${
                          person.status === 'inactive'
                            ? 'bg-slate-100 text-slate-400'
                            : hasOverdue
                              ? 'bg-rose-100 text-rose-700'
                              : hasActiveLoans
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-slate-900 truncate" title={person.name}>
                            {person.name}
                          </h4>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                              {person.employeeNumber || person.id}
                            </span>
                            <span className={`inline-block h-2 w-2 rounded-full ${person.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`} title={person.status === 'active' ? 'Activo' : 'Inactivo'} />
                          </div>
                        </div>
                      </div>

                      {/* Botón Editar */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(person)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                        title="Editar datos del colaborador"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Puesto y Departamento */}
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{person.role}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-semibold text-slate-500 text-[11px]">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{person.department || 'Sin área asignada'}</span>
                      </div>
                      {person.phone && (
                        <div className="flex items-center gap-1.5 font-mono text-slate-600 text-[11px]">
                          <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{person.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Empresa / Notas */}
                    {person.company && (
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        Empresa: {person.company}
                      </div>
                    )}
                  </div>

                  {/* Estado de Préstamos Activos & Acciones */}
                  <div className="pt-3 mt-3 border-t border-slate-100 space-y-2.5">
                    {hasActiveLoans ? (
                      <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                        hasOverdue 
                          ? 'bg-rose-50 border-rose-200 text-rose-900' 
                          : 'bg-blue-50 border-blue-200 text-blue-900'
                      }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Wrench className={`h-4 w-4 shrink-0 ${hasOverdue ? 'text-rose-600' : 'text-blue-600'}`} />
                          <div className="text-[11px] font-bold leading-tight truncate">
                            <span>{loans.length} {loans.length === 1 ? 'herramienta' : 'herramientas'} en préstamo</span>
                            {hasOverdue && (
                              <span className="block text-[9px] font-mono text-rose-700 font-black uppercase">
                                ¡Préstamo Vencido!
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setViewingLoansPerson(person)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition cursor-pointer shrink-0 ${
                            hasOverdue
                              ? 'bg-rose-600 hover:bg-rose-700 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          Ver Detalle
                        </button>
                      </div>
                    ) : (
                      <div className="p-2 bg-emerald-50/60 border border-emerald-200/60 rounded-xl text-emerald-800 text-[11px] font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Sin préstamos activos (Disponible)</span>
                        </span>
                        {person.status === 'active' && onNavigateToTab && (
                          <button
                            type="button"
                            onClick={() => onNavigateToTab('salidas')}
                            className="text-[10px] text-indigo-700 hover:text-indigo-900 font-mono font-bold cursor-pointer underline"
                            title="Prestar herramienta a este técnico"
                          >
                            + Prestar
                          </button>
                        )}
                      </div>
                    )}

                    {/* Footer con acciones */}
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(person)}
                        className={`text-[10px] font-bold font-mono transition cursor-pointer ${
                          person.status === 'active'
                            ? 'text-slate-400 hover:text-slate-600'
                            : 'text-emerald-600 hover:text-emerald-700'
                        }`}
                      >
                        {person.status === 'active' ? 'Pausar Técnico' : 'Reactivar'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePerson(person)}
                        className="text-[10px] font-bold text-slate-400 hover:text-rose-600 transition cursor-pointer flex items-center gap-1"
                        title="Eliminar registro"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL PARA DAR DE ALTA O EDITAR PERSONAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {editingPerson ? 'Editar Datos de Colaborador' : 'Dar de Alta Nuevo Colaborador'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Personal autorizado para préstamos de herramientas en almacén
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSavePerson} className="space-y-3.5">
              {/* Nombre Completo */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Nombre Completo del Colaborador <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej. Roberto Sánchez Méndez..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Puesto / Especialidad con Sugerencias */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Puesto / Oficio / Especialidad <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  placeholder="Ej. Técnico de Mantenimiento..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <span className="text-[9px] font-mono text-slate-400 self-center">Sugerir:</span>
                  {roleSuggestions.slice(0, 4).map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setFormRole(role)}
                      className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 transition cursor-pointer"
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Departamento / Cuadrilla con Sugerencias */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Departamento / Área / Cuadrilla <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  placeholder="Ej. Mantenimiento Industrial, Taller Central..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <span className="text-[9px] font-mono text-slate-400 self-center">Sugerir:</span>
                  {departmentSuggestions.slice(0, 4).map(dept => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setFormDepartment(dept)}
                      className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 transition cursor-pointer"
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fila: No. de Empleado y Teléfono */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    No. Empleado / Gafete (Opcional):
                  </label>
                  <input
                    type="text"
                    value={formEmployeeNumber}
                    onChange={(e) => setFormEmployeeNumber(e.target.value)}
                    placeholder="Ej. EMP-4091..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Teléfono / Celular (Opcional):
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="Ej. 55 1234 5678..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Empresa / Tipo de Colaborador */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Empresa / Adscripción:
                  </label>
                  <input
                    type="text"
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    placeholder="Ej. Interno (Planta), Contratista..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Estado en Almacén:
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="active">Activo (Habilitado para Préstamos)</option>
                    <option value="inactive">Inactivo (Suspendido temporalmente)</option>
                  </select>
                </div>
              </div>

              {/* Notas u observaciones */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Notas / Observaciones de Seguridad (Opcional):
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ej. Autorizado para herramienta pesada, cuadrilla 2..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {editingPerson ? 'Guardar Cambios' : 'Dar de Alta Colaborador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA VER DETALLE DE PRÉSTAMOS ACTIVOS DE UN COLABORADOR */}
      {viewingLoansPerson && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Herramientas y Materiales en Préstamo
                  </h3>
                  <p className="text-xs text-slate-500">
                    Colaborador: <strong className="text-blue-900">{viewingLoansPerson.name}</strong> • {viewingLoansPerson.role} ({viewingLoansPerson.department})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingLoansPerson(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Listado de préstamos */}
            <div className="space-y-3">
              {(() => {
                const loans = activeLoansByBorrower.get(viewingLoansPerson.name.trim().toLowerCase()) || [];
                if (loans.length === 0) {
                  return (
                    <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl">
                      Este colaborador no tiene ninguna herramienta pendiente de devolver.
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {loans.map(loan => {
                      const isOverdue = loan.expectedReturnDate && loan.expectedReturnDate < todayStr;
                      return (
                        <div key={loan.id} className="p-3.5 bg-white hover:bg-slate-50/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                Folio: {loan.id}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500">
                                SKU: {loan.sku}
                              </span>
                            </div>
                            <h5 className="text-xs font-bold text-slate-900 truncate">
                              {loan.productName}
                            </h5>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                              <span>Cantidad: <strong className="text-slate-800">{loan.qty} uds</strong></span>
                              <span>Fecha Entrega: {new Date(loan.timestamp).toLocaleDateString()}</span>
                              {loan.expectedReturnDate && (
                                <span className={`font-bold ${isOverdue ? 'text-rose-600' : 'text-blue-700'}`}>
                                  Devolución: {loan.expectedReturnDate} {isOverdue && '(¡VENCIDO!)'}
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleReturnLoanFromModal(loan.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Registrar Devolución</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                Al registrar la devolución, el material regresa a inventario disponible.
              </span>
              <button
                type="button"
                onClick={() => setViewingLoansPerson(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE IMPRESIÓN DEL PADRÓN */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8 print:p-0 print:border-none print:shadow-none">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 no-print">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Printer className="h-4 w-4 text-indigo-600" />
                <span>Vista Previa de Padrón Oficial de Personal Autorizado</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Imprimir Ahora</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Documento Impreso */}
            <div className="p-6 bg-white space-y-4 text-slate-900">
              <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-end">
                <div>
                  <h1 className="text-lg font-black tracking-tight text-slate-950 uppercase">
                    WMS Sistema de Almacén · Padrón de Personal Autorizado
                  </h1>
                  <p className="text-xs text-slate-600">
                    Catálogo de Colaboradores Habilitados para Préstamos y Resguardos de Herramientas
                  </p>
                </div>
                <div className="text-right text-xs font-mono">
                  <div>Fecha Emisión: {new Date().toLocaleDateString()}</div>
                  <div>Total Registrados: {filteredPersonnel.length}</div>
                </div>
              </div>

              <table className="w-full text-xs text-left border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px]">
                    <th className="border border-slate-300 p-2 text-center">#</th>
                    <th className="border border-slate-300 p-2">Nombre Completo</th>
                    <th className="border border-slate-300 p-2">Puesto</th>
                    <th className="border border-slate-300 p-2">Departamento</th>
                    <th className="border border-slate-300 p-2">No. Empleado</th>
                    <th className="border border-slate-300 p-2 text-center">Préstamos Activos</th>
                    <th className="border border-slate-300 p-2 text-center">Firma de Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPersonnel.map((p, idx) => {
                    const loans = activeLoansByBorrower.get(p.name.trim().toLowerCase()) || [];
                    return (
                      <tr key={p.id} className="border-b border-slate-200">
                        <td className="border border-slate-300 p-2 text-center font-mono">{idx + 1}</td>
                        <td className="border border-slate-300 p-2 font-bold">{p.name}</td>
                        <td className="border border-slate-300 p-2">{p.role}</td>
                        <td className="border border-slate-300 p-2">{p.department}</td>
                        <td className="border border-slate-300 p-2 font-mono">{p.employeeNumber || '—'}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono font-bold">
                          {loans.length > 0 ? `${loans.length} uds` : '0'}
                        </td>
                        <td className="border border-slate-300 p-2 text-center w-36">
                          <div className="h-6 border-b border-dashed border-slate-400 mt-2"></div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Bloque de firmas formales */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
                <div>
                  <div className="border-t border-slate-400 pt-2 font-bold">
                    {activeOperator ? activeOperator.name : 'Administrador de Almacén'}
                  </div>
                  <div className="text-[10px] text-slate-500">Jefe de Almacén y Logística</div>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-2 font-bold">
                    Supervisión de Operaciones y Seguridad
                  </div>
                  <div className="text-[10px] text-slate-500">Control de Activos y Herramientas</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
