import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bell, 
  Plus, 
  Trash2, 
  Edit3, 
  AlertTriangle, 
  CheckCircle, 
  Search, 
  Filter, 
  Info, 
  Save, 
  X, 
  Database, 
  Calendar,
  AlertCircle,
  TrendingDown,
  ToggleLeft,
  ToggleRight,
  ShieldAlert
} from 'lucide-react';
import { Bin, InventoryItem } from '../types';

interface ProgrammedAlert {
  id: string;
  title: string;
  type: 'stock_level' | 'bin_weight' | 'bin_volume' | 'expiration' | 'custom';
  targetSku: string; // "all" or specific SKU
  targetBin: string; // "all" or specific Bin ID
  thresholdValue: number; // numeric value for threshold
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  customMessage: string;
  dateCreated: string;
}

interface AlertsManagerProps {
  inventory: InventoryItem[];
  bins: Bin[];
}

export function AlertsManager({ inventory, bins }: AlertsManagerProps) {
  const [alerts, setAlerts] = useState<ProgrammedAlert[]>(() => {
    const saved = localStorage.getItem('wms_custom_programmed_alerts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error("Error parsing saved custom alerts:", e);
      }
    }
    // Seed initial programmed alerts
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

  // Save alerts to localStorage
  useEffect(() => {
    localStorage.setItem('wms_custom_programmed_alerts', JSON.stringify(alerts));
  }, [alerts]);

  // Form state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [type, setType] = useState<ProgrammedAlert['type']>('stock_level');
  const [targetSku, setTargetSku] = useState<string>('all');
  const [targetBin, setTargetBin] = useState<string>('all');
  const [thresholdValue, setThresholdValue] = useState<number>(10);
  const [severity, setSeverity] = useState<ProgrammedAlert['severity']>('medium');
  const [enabled, setEnabled] = useState<boolean>(true);
  const [customMessage, setCustomMessage] = useState<string>('');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  // Success / Error messages
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const triggerMsg = (text: string, isError: boolean = false) => {
    setMsg({ text, isError });
    setTimeout(() => setMsg(null), 4000);
  };

  // Helper to calculate weight of a bin
  const getBinWeight = (bin: Bin): number => {
    if (!bin.occupiedSku || bin.occupiedQty <= 0) return 0;
    const item = inventory.find(i => i.sku === bin.occupiedSku);
    return Number((bin.occupiedQty * (item?.unitWeight || 0.5)).toFixed(2));
  };

  // Helper to calculate volume percentage of a bin
  const getBinVolumePercent = (bin: Bin): number => {
    if (!bin.occupiedSku || bin.occupiedQty <= 0) return 0;
    const item = inventory.find(i => i.sku === bin.occupiedSku);
    if (!item) return 0;
    const unitVol = (item.unitWidth * item.unitHeight * item.unitLength) / 1000000; // in m3
    const totalVol = unitVol * bin.occupiedQty;
    const maxVol = bin.maxVolume || 2.4;
    return Math.round((totalVol / maxVol) * 100);
  };

  // Helper to check expiration days
  const getDaysToExpiration = (dateStr: string): number => {
    if (!dateStr) return 9999;
    const expDate = new Date(dateStr);
    const today = new Date();
    const diffTime = expDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Check which alerts are currently TRIGGERED in real-time
  const triggeredAlerts = useMemo(() => {
    const results: { alertId: string; triggerDetails: string; severity: string; targetName: string }[] = [];

    alerts.forEach(alert => {
      if (!alert.enabled) return;

      if (alert.type === 'stock_level') {
        if (alert.targetSku === 'all') {
          // Check all products
          inventory.forEach(item => {
            if (item.qty <= alert.thresholdValue) {
              results.push({
                alertId: alert.id,
                severity: alert.severity,
                targetName: `SKU: ${item.sku} (${item.name})`,
                triggerDetails: `Stock actual: ${item.qty} unidades (Límite programado: <= ${alert.thresholdValue})`
              });
            }
          });
        } else {
          // Check specific product
          const item = inventory.find(i => i.sku === alert.targetSku);
          if (item && item.qty <= alert.thresholdValue) {
            results.push({
              alertId: alert.id,
              severity: alert.severity,
              targetName: `SKU: ${item.sku} (${item.name})`,
              triggerDetails: `Stock actual: ${item.qty} unidades (Límite programado: <= ${alert.thresholdValue})`
            });
          }
        }
      }

      else if (alert.type === 'bin_weight') {
        if (alert.targetBin === 'all') {
          // Check all bins
          bins.forEach(bin => {
            const weight = getBinWeight(bin);
            if (weight >= alert.thresholdValue) {
              results.push({
                alertId: alert.id,
                severity: alert.severity,
                targetName: `Ubicación: ${bin.id}`,
                triggerDetails: `Peso actual: ${weight} kg (Límite programado: >= ${alert.thresholdValue} kg) - Contiene ${bin.occupiedQty} uds de ${bin.occupiedSku || 'N/A'}`
              });
            }
          });
        } else {
          // Check specific bin
          const bin = bins.find(b => b.id === alert.targetBin);
          if (bin) {
            const weight = getBinWeight(bin);
            if (weight >= alert.thresholdValue) {
              results.push({
                alertId: alert.id,
                severity: alert.severity,
                targetName: `Ubicación: ${bin.id}`,
                triggerDetails: `Peso actual: ${weight} kg (Límite programado: >= ${alert.thresholdValue} kg)`
              });
            }
          }
        }
      }

      else if (alert.type === 'bin_volume') {
        if (alert.targetBin === 'all') {
          bins.forEach(bin => {
            const volPct = getBinVolumePercent(bin);
            if (volPct >= alert.thresholdValue) {
              results.push({
                alertId: alert.id,
                severity: alert.severity,
                targetName: `Ubicación: ${bin.id}`,
                triggerDetails: `Saturación de volumen: ${volPct}% (Límite programado: >= ${alert.thresholdValue}%)`
              });
            }
          });
        } else {
          const bin = bins.find(b => b.id === alert.targetBin);
          if (bin) {
            const volPct = getBinVolumePercent(bin);
            if (volPct >= alert.thresholdValue) {
              results.push({
                alertId: alert.id,
                severity: alert.severity,
                targetName: `Ubicación: ${bin.id}`,
                triggerDetails: `Saturación de volumen: ${volPct}% (Límite programado: >= ${alert.thresholdValue}%)`
              });
            }
          }
        }
      }

      else if (alert.type === 'expiration') {
        if (alert.targetSku === 'all') {
          inventory.forEach(item => {
            if (item.expirationDate) {
              const days = getDaysToExpiration(item.expirationDate);
              if (days <= alert.thresholdValue && days >= -30) {
                results.push({
                  alertId: alert.id,
                  severity: alert.severity,
                  targetName: `Expiración SKU: ${item.sku}`,
                  triggerDetails: days < 0 
                    ? `¡Expiró hace ${Math.abs(days)} días! (Fecha de expiración: ${item.expirationDate})` 
                    : `Expira en ${days} días (Fecha de expiración: ${item.expirationDate}, Alerta: <= ${alert.thresholdValue} días)`
                });
              }
            }
          });
        } else {
          const item = inventory.find(i => i.sku === alert.targetSku);
          if (item && item.expirationDate) {
            const days = getDaysToExpiration(item.expirationDate);
            if (days <= alert.thresholdValue && days >= -30) {
              results.push({
                alertId: alert.id,
                severity: alert.severity,
                targetName: `Expiración SKU: ${item.sku}`,
                triggerDetails: days < 0 
                  ? `¡Expiró hace ${Math.abs(days)} días! (${item.expirationDate})` 
                  : `Expira en ${days} días (${item.expirationDate}, Alerta: <= ${alert.thresholdValue} días)`
              });
            }
          }
        }
      }

      else if (alert.type === 'custom') {
        results.push({
          alertId: alert.id,
          severity: alert.severity,
          targetName: 'Alerta General Programada',
          triggerDetails: alert.customMessage || 'Alerta personalizada activa de forma permanente.'
        });
      }
    });

    return results;
  }, [alerts, inventory, bins]);

  // Handle saving new or edited alert
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      triggerMsg('El título de la alerta es obligatorio.', true);
      return;
    }

    if (isEditing && editingId) {
      setAlerts(prev => prev.map(a => {
        if (a.id === editingId) {
          return {
            ...a,
            title: title.trim(),
            type,
            targetSku: type === 'stock_level' || type === 'expiration' ? targetSku : 'all',
            targetBin: type === 'bin_weight' || type === 'bin_volume' ? targetBin : 'all',
            thresholdValue,
            severity,
            enabled,
            customMessage: customMessage.trim()
          };
        }
        return a;
      }));
      triggerMsg('La alerta ha sido actualizada exitosamente.');
    } else {
      const newAlert: ProgrammedAlert = {
        id: `alt-${Math.floor(1000 + Math.random() * 9000)}`,
        title: title.trim(),
        type,
        targetSku: type === 'stock_level' || type === 'expiration' ? targetSku : 'all',
        targetBin: type === 'bin_weight' || type === 'bin_volume' ? targetBin : 'all',
        thresholdValue,
        severity,
        enabled,
        customMessage: customMessage.trim(),
        dateCreated: new Date().toISOString().slice(0, 10)
      };
      setAlerts(prev => [newAlert, ...prev]);
      triggerMsg('Nueva alerta programada y registrada en el sistema.');
    }

    resetForm();
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setTitle('');
    setType('stock_level');
    setTargetSku('all');
    setTargetBin('all');
    setThresholdValue(10);
    setSeverity('medium');
    setEnabled(true);
    setCustomMessage('');
  };

  const startEdit = (alert: ProgrammedAlert) => {
    setIsEditing(true);
    setEditingId(alert.id);
    setTitle(alert.title);
    setType(alert.type);
    setTargetSku(alert.targetSku);
    setTargetBin(alert.targetBin);
    setThresholdValue(alert.thresholdValue);
    setSeverity(alert.severity);
    setEnabled(alert.enabled);
    setCustomMessage(alert.customMessage);
    // Scroll to form or switch view
    document.getElementById('alerts-form-container')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar permanentemente esta alerta programada?')) {
      setAlerts(prev => prev.filter(a => a.id !== id));
      triggerMsg('Alerta programada eliminada.');
    }
  };

  const toggleAlertEnabled = (id: string) => {
    setAlerts(prev => prev.map(a => {
      if (a.id === id) {
        const nextState = !a.enabled;
        triggerMsg(nextState ? 'Alerta habilitada correctamente.' : 'Alerta desactivada temporalmente.');
        return { ...a, enabled: nextState };
      }
      return a;
    }));
  };

  // Filter alerts list
  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      const matchesSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            a.customMessage.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || a.type === filterType;
      const matchesSeverity = filterSeverity === 'all' || a.severity === filterSeverity;
      return matchesSearch && matchesType && matchesSeverity;
    });
  }, [alerts, searchTerm, filterType, filterSeverity]);

  return (
    <div className="space-y-6" id="alerts-manager-root">
      
      {/* Header and overview */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm" id="alerts-header">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-400/20 rounded-full text-xs font-bold text-indigo-300">
              <ShieldAlert className="h-3.5 w-3.5 text-indigo-400" />
              Soporte y Monitoreo Logístico
            </div>
            <h1 className="text-2xl md:text-3xl font-black font-sans tracking-tight">
              Gestor de Alertas Operativas
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Programe, edite o elimine las condiciones de seguridad y alertas operativas de su almacén. 
              El motor evalúa en tiempo real los niveles mínimos de stock, la resistencia de las estanterías (peso) y la caducidad de materiales peligrosos.
            </p>
          </div>
          
          <div className="flex gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50 self-start md:self-auto shrink-0">
            <div className="text-center px-3">
              <span className="block text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">Configuradas</span>
              <span className="text-2xl font-black font-mono text-indigo-400">{alerts.length}</span>
            </div>
            <div className="w-[1px] bg-slate-700" />
            <div className="text-center px-3">
              <span className="block text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">Disparadas Hoy</span>
              <span className={`text-2xl font-black font-mono ${triggeredAlerts.length > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                {triggeredAlerts.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {msg && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-fadeIn text-xs font-bold ${
          msg.isError 
            ? 'bg-rose-50 border-rose-200 text-rose-800' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {msg.isError ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle className="h-4 w-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Main Grid: Form and Live Monitors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Form to create/edit alerts */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-6 shadow-3xs space-y-5 flex flex-col justify-between" id="alerts-form-container">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-500" />
                {isEditing ? 'Editar Alerta Programada' : 'Programar Nueva Alerta'}
              </h2>
              {isEditing && (
                <button 
                  onClick={resetForm}
                  className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition"
                  title="Cancelar edición"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Título */}
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
                  Nombre descriptivo de Alerta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Stock Bajo Termostatos"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-500 text-slate-800"
                />
              </div>

              {/* Tipo de Alerta */}
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
                  Tipo de Condición / Algoritmo
                </label>
                <select
                  value={type}
                  onChange={(e) => {
                    const nextType = e.target.value as ProgrammedAlert['type'];
                    setType(nextType);
                    // Adjust default thresholds based on type
                    if (nextType === 'stock_level') setThresholdValue(15);
                    else if (nextType === 'bin_weight') setThresholdValue(150);
                    else if (nextType === 'bin_volume') setThresholdValue(85);
                    else if (nextType === 'expiration') setThresholdValue(30);
                  }}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-500 text-slate-800 bg-white"
                >
                  <option value="stock_level">Nivel de Stock Mínimo (SKU)</option>
                  <option value="bin_weight">Resistencia de Estructura (Peso kg)</option>
                  <option value="bin_volume">Capacidad de Celda (% Volumen)</option>
                  <option value="expiration">Vencimiento del Lote (Días)</option>
                  <option value="custom">Notificación Informativa / Manual</option>
                </select>
              </div>

              {/* Condicional para SKU / Producto */}
              {(type === 'stock_level' || type === 'expiration') && (
                <div className="space-y-1 animate-fadeIn">
                  <label className="block text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
                    SKU Seleccionado
                  </label>
                  <select
                    value={targetSku}
                    onChange={(e) => setTargetSku(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-500 text-slate-800 bg-white"
                  >
                    <option value="all">Todos los Productos (Filtro Global)</option>
                    {inventory.map(item => (
                      <option key={item.sku} value={item.sku}>{item.sku} - {item.name.slice(0,25)}...</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Condicional para Bin / Celda */}
              {(type === 'bin_weight' || type === 'bin_volume') && (
                <div className="space-y-1 animate-fadeIn">
                  <label className="block text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
                    Celda / Ubicación
                  </label>
                  <select
                    value={targetBin}
                    onChange={(e) => setTargetBin(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-500 text-slate-800 bg-white"
                  >
                    <option value="all">Todas las Celdas (Pasillos A-D)</option>
                    {bins.map(bin => (
                      <option key={bin.id} value={bin.id}>
                        {bin.id} ({bin.occupiedSku ? `Ocupada: ${bin.occupiedSku}` : 'Vacía'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Threshold (Umbral numérico) */}
              {type !== 'custom' && (
                <div className="space-y-1 animate-fadeIn">
                  <label className="block text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
                    {type === 'stock_level' && 'Límite de Stock Mínimo (Unidades)'}
                    {type === 'bin_weight' && 'Límite de Carga Crítica (kg)'}
                    {type === 'bin_volume' && 'Saturación de Celda (% Límite)'}
                    {type === 'expiration' && 'Alerta de Caducidad (Días antes)'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      required
                      value={thresholdValue}
                      onChange={(e) => setThresholdValue(Number(e.target.value))}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-500 text-slate-800 pr-12"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">
                      {type === 'stock_level' && 'uds'}
                      {type === 'bin_weight' && 'kg'}
                      {type === 'bin_volume' && '%'}
                      {type === 'expiration' && 'días'}
                    </span>
                  </div>
                </div>
              )}

              {/* Severidad */}
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
                  Nivel de Criticidad (Severidad)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: 'low', label: 'Baja', color: 'border-slate-200 text-slate-700 bg-slate-50 active:bg-slate-100 hover:border-slate-300' },
                    { val: 'medium', label: 'Media', color: 'border-blue-100 text-blue-700 bg-blue-50/50 hover:border-blue-200' },
                    { val: 'high', label: 'Alta', color: 'border-amber-100 text-amber-700 bg-amber-50/50 hover:border-amber-200' },
                    { val: 'critical', label: 'Crítica', color: 'border-rose-100 text-rose-700 bg-rose-50/50 hover:border-rose-200' }
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setSeverity(opt.val as any)}
                      className={`py-2 px-1 text-[10px] rounded-xl font-bold border transition text-center cursor-pointer ${
                        severity === opt.val 
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs' 
                          : opt.color
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mensaje Personalizado */}
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
                  Instrucción / Acción Recomendada para el Operador
                </label>
                <textarea
                  placeholder="Ej: Iniciar inmediatamente solicitud de compra o trasladar mercancía a bahías bajas."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800 resize-none"
                />
              </div>

              {/* Habilitada toggle */}
              <div className="flex items-center justify-between py-2 bg-slate-50 px-3 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-700">Estado de la Alerta:</span>
                <button
                  type="button"
                  onClick={() => setEnabled(!enabled)}
                  className="text-slate-600 hover:text-indigo-600 focus:outline-none transition"
                >
                  {enabled ? (
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <span className="text-[10px] font-black uppercase font-mono">Activa</span>
                      <ToggleRight className="h-6 w-6 text-emerald-500" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span className="text-[10px] font-black uppercase font-mono">Desactivada</span>
                      <ToggleLeft className="h-6 w-6 text-slate-300" />
                    </div>
                  )}
                </button>
              </div>

              {/* Submit and clean */}
              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  {isEditing ? 'Guardar Cambios' : 'Programar Alerta'}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50 p-4 rounded-2xl flex gap-3 items-start">
            <Info className="h-4.5 w-4.5 text-indigo-500 shrink-0 mt-0.5" />
            <div className="text-[10px] text-slate-500 leading-relaxed font-medium">
              <span className="font-bold text-slate-700 block mb-0.5">Límites Dinámicos:</span>
              Las alertas se ejecutan en tiempo real. Al realizar órdenes Outbound o reubicar inventario, las alertas se actualizan inmediatamente en base a la información del sistema.
            </div>
          </div>
        </div>

        {/* Right Columns: Alerts lists & active fires */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active fires panel (Live warnings currently triggering) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-3xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight font-sans">
                  Monitoreo de Alertas Disparadas (En Tiempo Real)
                </h2>
              </div>
              <span className="text-[10px] font-mono font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md uppercase">
                {triggeredAlerts.length} Firing
              </span>
            </div>

            {triggeredAlerts.length === 0 ? (
              <div className="py-8 text-center bg-emerald-50/30 border border-dashed border-emerald-200/60 rounded-2xl flex flex-col items-center justify-center gap-2">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
                <span className="text-xs font-extrabold text-slate-700">¡Almacén Seguro y Alineado!</span>
                <p className="text-[10px] text-slate-400 max-w-sm">
                  Ninguna de las condiciones de alerta programadas se encuentra rebasada actualmente en la base de datos de inventarios y celdas.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-72 overflow-y-auto pr-1">
                {triggeredAlerts.map((trigger, idx) => {
                  const origAlert = alerts.find(a => a.id === trigger.alertId);
                  const isCritical = trigger.severity === 'critical' || trigger.severity === 'high';
                  return (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-2xl border flex flex-col justify-between transition-all shadow-3xs ${
                        trigger.severity === 'critical'
                          ? 'bg-rose-50/50 border-rose-200 text-rose-950'
                          : trigger.severity === 'high'
                            ? 'bg-amber-50/50 border-amber-200 text-amber-950'
                            : 'bg-blue-50/40 border-blue-200 text-blue-950'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[10px] font-extrabold font-mono tracking-wider uppercase flex items-center gap-1">
                            <AlertCircle className={`h-3.5 w-3.5 ${
                              trigger.severity === 'critical' ? 'text-rose-500' : trigger.severity === 'high' ? 'text-amber-500' : 'text-blue-500'
                            }`} />
                            {origAlert ? origAlert.title : 'Alerta Programada'}
                          </span>
                          <span className={`text-[8px] uppercase font-black px-1.5 py-0.5 rounded-md font-mono border ${
                            trigger.severity === 'critical'
                              ? 'bg-rose-100 border-rose-200 text-rose-700'
                              : trigger.severity === 'high'
                                ? 'bg-amber-100 border-amber-200 text-amber-700'
                                : 'bg-blue-100 border-blue-200 text-blue-700'
                          }`}>
                            {trigger.severity}
                          </span>
                        </div>
                        
                        <p className="text-xs font-black text-slate-800">{trigger.targetName}</p>
                        <p className="text-[10px] text-slate-600 font-semibold mt-1 font-mono">{trigger.triggerDetails}</p>
                      </div>

                      {origAlert?.customMessage && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200/50 text-[9px] text-slate-500 font-bold leading-relaxed">
                          💡 Acción: {origAlert.customMessage}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* List of configured alerts */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-3xs space-y-4">
            
            {/* Filter and search bar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight font-sans">
                Alertas Programadas en el Sistema
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar alertas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-500 text-slate-700"
                  />
                </div>

                {/* Filter type */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none"
                >
                  <option value="all">Tipos</option>
                  <option value="stock_level">Mínimo Stock</option>
                  <option value="bin_weight">Resistencia Peso</option>
                  <option value="bin_volume">Capacidad Vol</option>
                  <option value="expiration">Expiración</option>
                  <option value="custom">Informativas</option>
                </select>

                {/* Filter severity */}
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none"
                >
                  <option value="all">Severidad</option>
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </div>
            </div>

            {filteredAlerts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-medium text-xs">
                No se encontraron alertas programadas que coincidan con los filtros seleccionados.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAlerts.map(alert => (
                  <div 
                    key={alert.id}
                    className={`p-4 border rounded-2xl transition flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${
                      alert.enabled 
                        ? 'border-slate-200 hover:border-slate-300 bg-white' 
                        : 'border-slate-100 bg-slate-50/50 opacity-70'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black text-slate-900">{alert.title}</span>
                        <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded-md uppercase border ${
                          alert.severity === 'critical'
                            ? 'bg-rose-50 border-rose-100 text-rose-600'
                            : alert.severity === 'high'
                              ? 'bg-amber-50 border-amber-100 text-amber-600'
                              : alert.severity === 'medium'
                                ? 'bg-blue-50 border-blue-100 text-blue-600'
                                : 'bg-slate-50 border-slate-100 text-slate-600'
                        }`}>
                          {alert.severity}
                        </span>
                        
                        <span className="text-[8px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold uppercase">
                          {alert.type === 'stock_level' && 'Mínimo Stock'}
                          {alert.type === 'bin_weight' && 'Límite Peso'}
                          {alert.type === 'bin_volume' && 'Saturación Vol'}
                          {alert.type === 'expiration' && 'Vencimiento'}
                          {alert.type === 'custom' && 'Personalizada'}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-500 font-semibold space-y-0.5 font-sans">
                        <div>
                          <strong>Filtro de Objetivo:</strong>{' '}
                          {alert.type === 'stock_level' || alert.type === 'expiration' ? (
                            <span>SKU: {alert.targetSku === 'all' ? 'Cualquier producto' : alert.targetSku}</span>
                          ) : alert.type === 'bin_weight' || alert.type === 'bin_volume' ? (
                            <span>Celda: {alert.targetBin === 'all' ? 'Cualquier celda' : alert.targetBin}</span>
                          ) : (
                            <span>Mensaje Informativo Permanente</span>
                          )}
                        </div>
                        {alert.type !== 'custom' && (
                          <div>
                            <strong>Valor Límite:</strong> {alert.thresholdValue}{' '}
                            {alert.type === 'stock_level' && 'unidades'}
                            {alert.type === 'bin_weight' && 'kg'}
                            {alert.type === 'bin_volume' && '%'}
                            {alert.type === 'expiration' && 'días'}
                          </div>
                        )}
                        {alert.customMessage && (
                          <div className="text-[9px] text-slate-400 italic mt-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                            "{alert.customMessage}"
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto shrink-0 border-t md:border-t-0 pt-2.5 md:pt-0 w-full md:w-auto justify-end">
                      {/* Toggle status */}
                      <button
                        onClick={() => toggleAlertEnabled(alert.id)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition"
                        title={alert.enabled ? 'Desactivar alerta' : 'Activar alerta'}
                      >
                        {alert.enabled ? (
                          <ToggleRight className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-slate-300" />
                        )}
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => startEdit(alert)}
                        className="p-1.5 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-lg transition"
                        title="Editar parámetros"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(alert.id)}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                        title="Eliminar permanentemente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
