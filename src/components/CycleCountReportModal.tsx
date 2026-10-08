import React, { useState, useMemo, useEffect } from 'react';
import { 
  Printer, 
  X, 
  FileCheck, 
  Calendar, 
  User, 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Save, 
  ClipboardList, 
  ShieldCheck, 
  FileSpreadsheet,
  RotateCcw
} from 'lucide-react';
import { Bin, InventoryItem, CycleCountSession, ConcludedAuditReport } from '../types';
import { OperatorProfile } from './CrewManager';

interface CycleCountReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  bins: Bin[];
  countedSessions: CycleCountSession[];
  activeSessionSkus: string[];
  activeOperator: OperatorProfile | null;
  onConcludeAndArchive?: (report: ConcludedAuditReport) => void;
}

export const CycleCountReportModal: React.FC<CycleCountReportModalProps> = ({
  isOpen,
  onClose,
  inventory,
  bins,
  countedSessions,
  activeSessionSkus,
  activeOperator,
  onConcludeAndArchive
}) => {
  // 1. Audit Exercise Config State
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentTimeStr = useMemo(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }, []);

  const [exerciseDate, setExerciseDate] = useState<string>(todayStr);
  const [exerciseTime, setExerciseTime] = useState<string>(currentTimeStr);
  
  // Available crew members
  const [crewMembers, setCrewMembers] = useState<OperatorProfile[]>([]);
  useEffect(() => {
    const saved = localStorage.getItem('OWMS_CREW_MEMBERS');
    if (saved) {
      try {
        setCrewMembers(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing crew members', e);
      }
    }
  }, []);

  // Responsible person state
  const defaultResponsible = activeOperator?.name || 'Alex Mercer';
  const defaultRole = activeOperator?.role || 'Auditor de Control de Inventarios';
  const [responsibleName, setResponsibleName] = useState<string>(defaultResponsible);
  const [responsibleRole, setResponsibleRole] = useState<string>(defaultRole);
  const [supervisorName, setSupervisorName] = useState<string>('Ing. Sarah Jenkins');
  const [warehouseLocation, setWarehouseLocation] = useState<string>('Almacén Central WMS - Zona de Racks');
  const [auditFolio, setAuditFolio] = useState<string>(() => {
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    return `AUD-CC-${new Date().getFullYear()}-${randomHex}`;
  });
  const [auditNotes, setAuditNotes] = useState<string>(
    'Conteo de verificación física de existencias en racks y ubicaciones asignadas. Ejercicio concluido conforme a la directiva de calidad y control de mermas.'
  );

  // Scope filter: 'active' (only currently audited in this session) vs 'all' (all recorded sessions)
  const [dataScope, setDataScope] = useState<'active' | 'all'>('active');
  const [archivedSuccess, setArchivedSuccess] = useState<boolean>(false);

  // If active operator changes, pre-fill
  useEffect(() => {
    if (activeOperator) {
      setResponsibleName(activeOperator.name);
      setResponsibleRole(activeOperator.role);
    }
  }, [activeOperator]);

  // Map of SKU to Bin location
  const skuLocationMap = useMemo(() => {
    const map = new Map<string, string>();
    bins.forEach(bin => {
      if (bin.occupiedSku) {
        const prev = map.get(bin.occupiedSku);
        if (prev) {
          map.set(bin.occupiedSku, `${prev}, ${bin.id}`);
        } else {
          map.set(bin.occupiedSku, bin.id);
        }
      }
    });
    return map;
  }, [bins]);

  // Inventory lookup map
  const invMap = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    inventory.forEach(item => map.set(item.sku, item));
    return map;
  }, [inventory]);

  // Sessions to include
  const filteredSessions = useMemo(() => {
    if (dataScope === 'active') {
      // Pick sessions for activeSessionSkus
      if (activeSessionSkus.length > 0) {
        // Map active SKUs to their most recent session or fallback
        const result: CycleCountSession[] = [];
        activeSessionSkus.forEach(sku => {
          const found = countedSessions.find(s => s.sku === sku);
          if (found) {
            result.push(found);
          } else {
            const item = invMap.get(sku);
            const sys = item ? item.qty : 0;
            result.push({
              sku,
              date: new Date().toISOString(),
              physical: sys,
              system: sys,
              deviation: 0
            });
          }
        });
        return result;
      }
      return countedSessions;
    }
    return countedSessions;
  }, [dataScope, activeSessionSkus, countedSessions, invMap]);

  // Detailed report items
  const reportItems = useMemo(() => {
    return filteredSessions.map(session => {
      const item = invMap.get(session.sku);
      const name = item ? item.name : 'Material Desconocido';
      const category = item ? item.category : 'General';
      const location = skuLocationMap.get(session.sku) || 'Zona Rack Asignada';
      const cost = item?.cost || 0;
      const deviationVal = session.deviation * cost;

      return {
        sku: session.sku,
        name,
        category,
        location,
        system: session.system,
        physical: session.physical,
        deviation: session.deviation,
        cost,
        deviationVal,
        status: session.deviation === 0 
          ? 'CONFORME' 
          : session.deviation > 0 
            ? 'SOBRANTE (+)' 
            : 'FALTANTE (-)'
      };
    });
  }, [filteredSessions, invMap, skuLocationMap]);

  // Summary Metrics
  const summary = useMemo(() => {
    const totalCounted = reportItems.length;
    const accurateCount = reportItems.filter(i => i.deviation === 0).length;
    const discrepancyCount = totalCounted - accurateCount;
    const accuracyRate = totalCounted > 0 ? ((accurateCount / totalCounted) * 100).toFixed(1) : '100.0';
    
    const totalPhysical = reportItems.reduce((acc, i) => acc + i.physical, 0);
    const totalSystem = reportItems.reduce((acc, i) => acc + i.system, 0);
    const netDeviation = totalPhysical - totalSystem;
    const absoluteDeviation = reportItems.reduce((acc, i) => acc + Math.abs(i.deviation), 0);
    const totalFinancialImpact = reportItems.reduce((acc, i) => acc + i.deviationVal, 0);

    const positiveDiscrepancies = reportItems.filter(i => i.deviation > 0).length;
    const negativeDiscrepancies = reportItems.filter(i => i.deviation < 0).length;

    return {
      totalCounted,
      accurateCount,
      discrepancyCount,
      accuracyRate,
      totalPhysical,
      totalSystem,
      netDeviation,
      absoluteDeviation,
      totalFinancialImpact,
      positiveDiscrepancies,
      negativeDiscrepancies
    };
  }, [reportItems]);

  const handlePrint = () => {
    window.print();
  };

  const handleArchive = () => {
    const newReport: ConcludedAuditReport = {
      id: `report-${Date.now()}`,
      folio: auditFolio,
      date: exerciseDate,
      responsible: responsibleName,
      responsibleRole,
      supervisor: supervisorName,
      location: warehouseLocation,
      totalItems: summary.totalCounted,
      accurateItems: summary.accurateCount,
      discrepantItems: summary.discrepancyCount,
      accuracyRate: parseFloat(summary.accuracyRate),
      totalPhysicalQty: summary.totalPhysical,
      totalSystemQty: summary.totalSystem,
      netDeviation: summary.netDeviation,
      notes: auditNotes,
      timestamp: new Date().toISOString(),
      items: reportItems.map(i => ({
        sku: i.sku,
        name: i.name,
        category: i.category,
        location: i.location,
        system: i.system,
        physical: i.physical,
        deviation: i.deviation,
        cost: i.cost
      }))
    };

    // Save in localStorage
    const saved = localStorage.getItem('OWMS_CONCLUDED_AUDITS');
    let list: ConcludedAuditReport[] = [];
    if (saved) {
      try {
        list = JSON.parse(saved);
      } catch (e) {
        list = [];
      }
    }
    list.unshift(newReport);
    localStorage.setItem('OWMS_CONCLUDED_AUDITS', JSON.stringify(list));

    if (onConcludeAndArchive) {
      onConcludeAndArchive(newReport);
    }

    setArchivedSuccess(true);
    setTimeout(() => setArchivedSuccess(false), 5000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs overflow-y-auto flex justify-center items-start p-2 sm:p-4 md:p-6 print:p-0 print:bg-white print:overflow-visible">
      {/* Dynamic Print CSS to guarantee clean single/multi-page letter print */}
      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 1.2cm;
          }
          body * {
            visibility: hidden;
          }
          #printable-cycle-count-report, #printable-cycle-count-report * {
            visibility: visible;
          }
          #printable-cycle-count-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card-border {
            border: 1px solid #1e293b !important;
          }
          .page-break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden print:border-none print:shadow-none print:max-w-none print:rounded-none">
        
        {/* Top Floating Control Bar (Hidden during print) */}
        <div className="no-print bg-slate-900 text-white p-4 sm:p-5 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30">
              <FileCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                Generador de Reporte y Acta de Conteo Cíclico
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Listo para Firma
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Seleccione la fecha del ejercicio y responsable para imprimir el acta formal con el desglose de diferencias.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={handleArchive}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              title="Guardar acta en el historial de auditorías concluidas"
            >
              <Save className="h-4 w-4 text-emerald-400" />
              <span>{archivedSuccess ? '¡Archivado!' : 'Concluir y Archivar'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir Reporte (Ctrl+P)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Configuration Panel for Date, Responsible, Scope (Hidden during print) */}
        <div className="no-print bg-slate-50 border-b border-slate-200 p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. Fecha del Ejercicio */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                Fecha del Ejercicio
              </label>
              <input
                type="date"
                value={exerciseDate}
                onChange={(e) => setExerciseDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-slate-400">Hora:</span>
                <input
                  type="time"
                  value={exerciseTime}
                  onChange={(e) => setExerciseTime(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2 py-0.5 text-[11px] font-mono text-slate-700"
                />
              </div>
            </div>

            {/* 2. Responsable del Conteo */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-emerald-600" />
                Responsable del Conteo
              </label>
              <div className="space-y-1">
                {crewMembers.length > 0 ? (
                  <select
                    value={responsibleName}
                    onChange={(e) => {
                      const sel = e.target.value;
                      setResponsibleName(sel);
                      const found = crewMembers.find(c => c.name === sel);
                      if (found) {
                        setResponsibleRole(found.role);
                      }
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {crewMembers.map(member => (
                      <option key={member.id} value={member.name}>
                        {member.name} ({member.role})
                      </option>
                    ))}
                    <option value="Otro / Manual">-- Ingresar Manualmente --</option>
                  </select>
                ) : null}
                <input
                  type="text"
                  placeholder="Nombre y Apellidos del Responsable"
                  value={responsibleName}
                  onChange={(e) => setResponsibleName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* 3. Cargo / Rol del Responsable */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                Cargo / Rol de Auditoría
              </label>
              <input
                type="text"
                placeholder="ej. Auditor de Calidad WMS"
                value={responsibleRole}
                onChange={(e) => setResponsibleRole(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="pt-0.5">
                <input
                  type="text"
                  placeholder="Supervisor que Valida"
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-[11px] text-slate-600"
                  title="Supervisor o Jefe de Almacén que firma como segundo validador"
                />
              </div>
            </div>

            {/* 4. Alcance y Folio */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-600" />
                Alcance y Folio
              </label>
              <div className="flex bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setDataScope('active')}
                  className={`flex-1 py-1 rounded transition text-center cursor-pointer ${
                    dataScope === 'active' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sesión Concluida ({activeSessionSkus.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDataScope('all')}
                  className={`flex-1 py-1 rounded transition text-center cursor-pointer ${
                    dataScope === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos ({countedSessions.length})
                </button>
              </div>
              <input
                type="text"
                value={auditFolio}
                onChange={(e) => setAuditFolio(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1 text-[11px] font-mono text-slate-700"
                title="Número de Folio / Dictamen"
              />
            </div>

          </div>

          {archivedSuccess && (
            <div className="mt-3 p-2.5 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                ¡Acta de Conteo Cíclico registrada y archivada exitosamente con el Folio {auditFolio}! Lista para firma física.
              </span>
            </div>
          )}
        </div>

        {/* =========================================================================
            PRINTABLE REPORT DOCUMENT (OPTIMIZED FOR PHYSICAL PRINTING & PDF EXPORT)
           ========================================================================= */}
        <div 
          id="printable-cycle-count-report" 
          className="p-6 sm:p-10 bg-white text-slate-900 font-sans print:p-0 print:m-0"
        >
          {/* Header Banner */}
          <div className="border-b-2 border-slate-900 pb-5 mb-6">
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-sm font-mono">
                    WMS
                  </div>
                  <span className="text-xs font-black tracking-widest text-slate-500 uppercase font-mono">
                    OWMS LEDGER LOGISTICS ENGINE | AUDIT DEPT.
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                  Acta Oficial de Conteo Cíclico y Auditoría de Inventario
                </h1>
                <p className="text-xs text-slate-600 font-medium">
                  Informe de conciliación física vs. sistema de existencias y dictamen de diferencias operativas.
                </p>
              </div>

              {/* Status and Folio badge */}
              <div className="text-right shrink-0">
                <div className="inline-block bg-slate-900 text-white font-mono font-bold text-xs px-3 py-1 rounded">
                  FOLIO: {auditFolio}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                  EMISIÓN: {new Date().toLocaleString('es-ES')}
                </div>
                <div className="mt-1">
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Ejercicio Concluido
                  </span>
                </div>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-200 text-xs">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block font-mono">
                  Fecha del Ejercicio
                </span>
                <span className="font-bold text-slate-900 font-mono text-xs">
                  {exerciseDate} ({exerciseTime} hrs)
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block font-mono">
                  Responsable del Conteo
                </span>
                <span className="font-bold text-slate-900 block truncate text-xs" title={responsibleName}>
                  {responsibleName}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {responsibleRole}
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block font-mono">
                  Supervisor Validador
                </span>
                <span className="font-bold text-slate-900 block truncate text-xs">
                  {supervisorName}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Control de Stock WMS
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block font-mono">
                  Área / Ubicación
                </span>
                <span className="font-bold text-slate-900 block truncate text-xs">
                  {warehouseLocation}
                </span>
              </div>
            </div>
          </div>

          {/* Executive Summary & Discrepancy Statistics Strip */}
          <div className="mb-6 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5 font-mono">
              <TrendingUp className="h-4 w-4 text-slate-700" />
              1. Resumen Ejecutivo de Exactitud y Variaciones
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Metric 1 */}
              <div className="border border-slate-300 rounded p-3 bg-white">
                <span className="text-[10px] font-bold text-slate-500 uppercase block font-mono">
                  Materiales Contados
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    {summary.totalCounted}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">SKUs</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  100% de la muestra prevista
                </span>
              </div>

              {/* Metric 2: Accuracy */}
              <div className="border border-slate-300 rounded p-3 bg-white">
                <span className="text-[10px] font-bold text-slate-500 uppercase block font-mono">
                  Índice de Exactitud (IRA)
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-emerald-600 font-mono">
                    {summary.accuracyRate}%
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {summary.accurateCount} de {summary.totalCounted} sin diferencias
                </span>
              </div>

              {/* Metric 3: Conformes */}
              <div className="border border-slate-300 rounded p-3 bg-white">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block font-mono">
                  Materiales Conformes
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-emerald-600 font-mono">
                    {summary.accurateCount}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">SKUs</span>
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Físico coincide 100% con Sistema
                </span>
              </div>

              {/* Metric 4: Discrepancias */}
              <div className={`border rounded p-3 bg-white ${
                summary.discrepancyCount > 0 ? 'border-amber-400 bg-amber-50/20' : 'border-slate-300'
              }`}>
                <span className="text-[10px] font-bold text-amber-700 uppercase block font-mono">
                  Materiales con Desvío
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className={`text-2xl font-black font-mono ${
                    summary.discrepancyCount > 0 ? 'text-amber-600' : 'text-slate-800'
                  }`}>
                    {summary.discrepancyCount}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">SKUs</span>
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {summary.positiveDiscrepancies} Sobrantes | {summary.negativeDiscrepancies} Faltantes
                </span>
              </div>
            </div>

            {/* Units Comparison Banner */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded flex flex-wrap justify-between items-center text-xs gap-3 font-mono">
              <div>
                <span className="text-slate-500 font-sans text-[11px]">Unidades Teóricas (Sistema):</span>{' '}
                <strong className="text-slate-800 font-bold">{summary.totalSystem.toLocaleString()} uds</strong>
              </div>
              <div className="text-slate-300">|</div>
              <div>
                <span className="text-slate-500 font-sans text-[11px]">Unidades Físicas (Conteo):</span>{' '}
                <strong className="text-slate-800 font-bold">{summary.totalPhysical.toLocaleString()} uds</strong>
              </div>
              <div className="text-slate-300">|</div>
              <div>
                <span className="text-slate-500 font-sans text-[11px]">Diferencia Neta:</span>{' '}
                <span className={`font-black ${
                  summary.netDeviation === 0 
                    ? 'text-emerald-700' 
                    : summary.netDeviation > 0 
                      ? 'text-blue-700' 
                      : 'text-rose-700'
                }`}>
                  {summary.netDeviation > 0 ? `+${summary.netDeviation}` : summary.netDeviation} uds
                </span>
              </div>
              <div className="text-slate-300">|</div>
              <div>
                <span className="text-slate-500 font-sans text-[11px]">Desvío Absoluto:</span>{' '}
                <strong className="text-slate-800 font-bold">{summary.absoluteDeviation} uds</strong>
              </div>
            </div>
          </div>

          {/* Detailed Materials & Differences Table */}
          <div className="mb-6 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5 font-mono">
                <ClipboardList className="h-4 w-4 text-slate-700" />
                2. Detalle de Materiales Contados y Variaciones Registradas
              </h3>
              <span className="text-[10px] font-mono text-slate-500">
                Mostrando {reportItems.length} materiales auditados
              </span>
            </div>

            <div className="border border-slate-300 rounded overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-black uppercase text-[9px] tracking-wider font-mono">
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3">Código SKU</th>
                    <th className="py-2.5 px-3">Descripción del Material</th>
                    <th className="py-2.5 px-3">Ubicación</th>
                    <th className="py-2.5 px-3 text-right">Sistema</th>
                    <th className="py-2.5 px-3 text-right">Físico</th>
                    <th className="py-2.5 px-3 text-right">Diferencia</th>
                    <th className="py-2.5 px-3 text-center">Dictamen</th>
                    <th className="py-2.5 px-3 text-right">Costo U.</th>
                    <th className="py-2.5 px-3 text-right">Impacto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                  {reportItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400 italic">
                        No hay materiales auditados seleccionados para este reporte.
                      </td>
                    </tr>
                  ) : (
                    reportItems.map((item, idx) => {
                      const isAccurate = item.deviation === 0;
                      return (
                        <tr 
                          key={idx} 
                          className={`page-break-inside-avoid ${
                            !isAccurate ? 'bg-amber-50/30' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-mono text-[10px] text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-black text-slate-900 text-xs">
                            {item.sku}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800 block leading-tight text-xs">
                              {item.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              Cat: {item.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                            {item.location}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500 font-semibold">
                            {item.system} uds
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {item.physical} uds
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {isAccurate ? (
                              <span className="text-emerald-700">0</span>
                            ) : (
                              <span className={item.deviation > 0 ? 'text-blue-700' : 'text-rose-700'}>
                                {item.deviation > 0 ? `+${item.deviation}` : item.deviation} uds
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider font-mono ${
                              isAccurate
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : item.deviation > 0
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500 text-[11px]">
                            ${item.cost.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-xs">
                            {item.deviationVal === 0 ? (
                              <span className="text-slate-400">$0.00</span>
                            ) : (
                              <span className={item.deviationVal > 0 ? 'text-blue-700' : 'text-rose-700'}>
                                {item.deviationVal > 0 ? `+$${item.deviationVal.toFixed(2)}` : `-$${Math.abs(item.deviationVal).toFixed(2)}`}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 font-mono text-xs">
                    <td colSpan={4} className="py-2.5 px-3 text-right uppercase tracking-wider">
                      Totales Consolidados:
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {summary.totalSystem} uds
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {summary.totalPhysical} uds
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={summary.netDeviation === 0 ? 'text-emerald-700' : summary.netDeviation > 0 ? 'text-blue-700' : 'text-rose-700'}>
                        {summary.netDeviation > 0 ? `+${summary.netDeviation}` : summary.netDeviation} uds
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-[10px]">
                      {summary.discrepancyCount === 0 ? 'TODO OK' : `${summary.discrepancyCount} DESVÍOS`}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[10px] text-slate-500">
                      Balance:
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {summary.totalFinancialImpact === 0 ? (
                        '$0.00'
                      ) : (
                        <span className={summary.totalFinancialImpact > 0 ? 'text-blue-700' : 'text-rose-700'}>
                          ${summary.totalFinancialImpact.toFixed(2)}
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Observations and Legal Signatures Section (Always kept together) */}
          <div className="page-break-inside-avoid space-y-6 pt-2">
            
            {/* Notes & Observations Box */}
            <div className="border border-slate-300 rounded p-3 bg-slate-50/50">
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block font-mono mb-1">
                3. Observaciones y Dictamen Operativo del Ejercicio
              </span>
              <p className="text-xs text-slate-700 leading-relaxed italic">
                "{auditNotes}"
              </p>
              <div className="text-[10px] text-slate-500 mt-2 font-mono">
                Dictamen: Las variaciones detectadas han sido registradas para el protocolo de ajuste físico y autorización de conciliación contable de acuerdo a las políticas internas de almacén.
              </div>
            </div>

            {/* Formal Signature Blocks */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest block font-mono">
                  4. Conformidad, Dictamen y Firmas de Validación
                </span>
                <span className="text-[9px] text-slate-500 font-mono">
                  Documento Válido para Auditoría Interna / Fiscal
                </span>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-4 text-center">
                
                {/* Signature 1: Responsible */}
                <div className="flex flex-col justify-between items-center h-32 border-t-2 border-slate-900 pt-2">
                  <div className="w-full">
                    <span className="text-xs font-black text-slate-900 uppercase block tracking-tight">
                      {responsibleName}
                    </span>
                    <span className="text-[10px] text-slate-600 block leading-tight">
                      {responsibleRole}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                      Responsable del Conteo Físico
                    </span>
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider border-t border-dashed border-slate-300 w-full pt-1">
                    Firma del Responsable
                  </div>
                </div>

                {/* Signature 2: Supervisor */}
                <div className="flex flex-col justify-between items-center h-32 border-t-2 border-slate-900 pt-2">
                  <div className="w-full">
                    <span className="text-xs font-black text-slate-900 uppercase block tracking-tight">
                      {supervisorName}
                    </span>
                    <span className="text-[10px] text-slate-600 block leading-tight">
                      Supervisor de Control de Stock
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                      Verificación y Validación WMS
                    </span>
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider border-t border-dashed border-slate-300 w-full pt-1">
                    Firma del Supervisor
                  </div>
                </div>

                {/* Signature 3: Management */}
                <div className="flex flex-col justify-between items-center h-32 border-t-2 border-slate-900 pt-2">
                  <div className="w-full">
                    <span className="text-xs font-black text-slate-900 uppercase block tracking-tight">
                      Dirección de Operaciones
                    </span>
                    <span className="text-[10px] text-slate-600 block leading-tight">
                      Jefatura de Logística y Cadena
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                      Autorización de Conciliación
                    </span>
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider border-t border-dashed border-slate-300 w-full pt-1">
                    Firma y Sello de Gerencia
                  </div>
                </div>

              </div>
            </div>

            {/* Official Footer Note */}
            <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-[9px] font-mono text-slate-400">
              <div>
                OWMS LEDGER ENGINE v2.4 | CERTIFICACIÓN INMUTABLE DE AUDITORÍA FÍSICA | FOLIO: {auditFolio}
              </div>
              <div>
                Página 1 de 1 • Copia Oficial de Auditoría
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
