import React, { useState, useEffect } from 'react';
import { Bin, InventoryItem, ActivityLog } from '../types';
import {
  Briefcase,
  Layers,
  TrendingUp,
  Package,
  Plus,
  Trash2,
  Check,
  Building2,
  DollarSign,
  Boxes,
  MapPin,
  AlertTriangle,
  Info,
  ChevronRight,
  Filter,
  BarChart3,
  RefreshCw,
  Archive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BusinessLinesManagerProps {
  bins: Bin[];
  inventory: InventoryItem[];
  onUpdateInventoryItem?: (sku: string, updatedFields: Partial<InventoryItem>) => Promise<void>;
  onAddInventory?: (item: InventoryItem) => Promise<void>;
  onUpdateBins?: (newBins: Bin[], action: string, details: string) => Promise<void>;
}

export function BusinessLinesManager({
  bins,
  inventory,
  onUpdateInventoryItem,
  onAddInventory,
  onUpdateBins
}: BusinessLinesManagerProps) {
  // 1. Load or initialize customized Lines of Business
  const [businessLines, setBusinessLines] = useState<{ id: string; name: string; color: string; desc: string }[]>(() => {
    const saved = localStorage.getItem('wms_custom_business_lines');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      { id: 'electro', name: 'Electrónica', color: 'bg-blue-500 text-blue-500 border-blue-500 text-blue-600', desc: 'Componentes, microcontroladores y repuestos de precisión' },
      { id: 'food', name: 'Alimentos y Bebidas', color: 'bg-emerald-500 text-emerald-500 border-emerald-500 text-emerald-600', desc: 'Insumos de cafetería, alimentos empaquetados y bebidas' },
      { id: 'fashion', name: 'Moda y Textil', color: 'bg-indigo-500 text-indigo-500 border-indigo-500 text-indigo-600', desc: 'Ropa de seguridad, uniformes corporativos y equipo textil' },
      { id: 'home', name: 'Hogar y Cocina', color: 'bg-amber-500 text-amber-500 border-amber-500 text-amber-600', desc: 'Mobiliario menor, decoración de oficinas e insumos de limpieza' },
      { id: 'health', name: 'Salud y Cuidado', color: 'bg-rose-500 text-rose-500 border-rose-500 text-rose-600', desc: 'Material médico de primeros auxilios y artículos de protección personal' }
    ];
  });

  // 2. Load or initialize physical space assignments (Aisles)
  const [aisleAssignments, setAisleAssignments] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('wms_aisle_business_lines');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    // Default assignments
    return {
      'A': 'electro',
      'B': 'food',
      'C': 'fashion',
      'D': 'home'
    };
  });

  // 3. Load or initialize individual Bin assignments overrides
  const [binAssignments, setBinAssignments] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('wms_bin_business_lines');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  // Save state helpers
  useEffect(() => {
    localStorage.setItem('wms_custom_business_lines', JSON.stringify(businessLines));
  }, [businessLines]);

  useEffect(() => {
    localStorage.setItem('wms_aisle_business_lines', JSON.stringify(aisleAssignments));
  }, [aisleAssignments]);

  useEffect(() => {
    localStorage.setItem('wms_bin_business_lines', JSON.stringify(binAssignments));
  }, [binAssignments]);

  // State for adding new Business Line
  const [newLineName, setNewLineName] = useState('');
  const [newLineDesc, setNewLineDesc] = useState('');
  const [newLineColor, setNewLineColor] = useState('bg-teal-500 text-teal-500 border-teal-500 text-teal-600');
  const [showAddLineForm, setShowAddLineForm] = useState(false);

  // SKU Management state
  const [selectedLineId, setSelectedLineId] = useState<string>('electro');
  const [isRegisteringSku, setIsRegisteringSku] = useState(false);
  const [newSkuCode, setNewSkuCode] = useState('');
  const [newSkuName, setNewSkuName] = useState('');
  const [newSkuDesc, setNewSkuDesc] = useState('');
  const [newSkuCost, setNewSkuCost] = useState(10);
  const [newSkuMinQty, setNewSkuMinQty] = useState(10);
  const [newSkuCategory, setNewSkuCategory] = useState('General');
  const [newSkuSupplier, setNewSkuSupplier] = useState('');
  const [newSkuInitialQty, setNewSkuInitialQty] = useState(0);

  // States for Space Designation
  const [activeAisleToDesignate, setActiveAisleToDesignate] = useState<string>('A');
  const [activeLineToDesignate, setActiveLineToDesignate] = useState<string>('electro');
  const [activeBinToDesignate, setActiveBinToDesignate] = useState<string>('');

  // Notifications or messages
  const [feedbackMsg, setFeedbackMsg] = useState({ text: '', type: 'success' });

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg({ text: '', type: 'success' }), 4000);
  };

  // Color options
  const colorOptions = [
    { value: 'bg-blue-500 text-blue-500 border-blue-500 text-blue-600', label: 'Azul' },
    { value: 'bg-emerald-500 text-emerald-500 border-emerald-500 text-emerald-600', label: 'Esmeralda' },
    { value: 'bg-indigo-500 text-indigo-500 border-indigo-500 text-indigo-600', label: 'Índigo' },
    { value: 'bg-amber-500 text-amber-500 border-amber-500 text-amber-600', label: 'Ámbar' },
    { value: 'bg-rose-500 text-rose-500 border-rose-500 text-rose-600', label: 'Rosa' },
    { value: 'bg-teal-500 text-teal-500 border-teal-500 text-teal-600', label: 'Menta' },
    { value: 'bg-violet-500 text-violet-500 border-violet-500 text-violet-600', label: 'Violeta' },
    { value: 'bg-cyan-500 text-cyan-500 border-cyan-500 text-cyan-600', label: 'Cian' }
  ];

  // Map aisle codes
  const uniqueAisles = Array.from(new Set(bins.map(b => b.aisle))).filter(Boolean).sort();

  // Helper to get the designated line for any Bin
  const getBinDesignatedLine = (bin: Bin): { id: string; name: string; color: string } | null => {
    // 1. Check individual override
    if (binAssignments[bin.id]) {
      const line = businessLines.find(l => l.id === binAssignments[bin.id]);
      if (line) return line;
    }
    // 2. Check aisle assignment
    if (aisleAssignments[bin.aisle]) {
      const line = businessLines.find(l => l.id === aisleAssignments[bin.aisle]);
      if (line) return line;
    }
    return null;
  };

  // Helper to get Business Line of an SKU
  const getSkuBusinessLineId = (item: InventoryItem): string => {
    // Check if the business line mapping exists in localStorage
    const savedMapping = localStorage.getItem('wms_sku_business_lines');
    if (savedMapping) {
      try {
        const mapping = JSON.parse(savedMapping);
        if (mapping[item.sku]) {
          return mapping[item.sku];
        }
      } catch (e) {}
    }
    // Default fallback by category keywords if not explicitly mapped
    const cat = (item.category || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    const name = (item.name || '').toLowerCase();

    if (cat.includes('electr') || name.includes('cpu') || name.includes('batt') || name.includes('sens')) return 'electro';
    if (cat.includes('hazmat') || cat.includes('peli') || desc.includes('combust')) return 'electro';
    if (cat.includes('aliment') || cat.includes('bebi') || desc.includes('cafeter')) return 'food';
    if (cat.includes('ropa') || cat.includes('text') || name.includes('cable') || cat.includes('cabl')) return 'fashion';
    if (cat.includes('hogar') || cat.includes('mueb') || cat.includes('limpi')) return 'home';
    if (cat.includes('salud') || cat.includes('medic') || cat.includes('prot')) return 'health';

    return 'electro'; // Fallback
  };

  // Explicitly associate a business line with an SKU
  const setSkuBusinessLine = (sku: string, lineId: string) => {
    const savedMapping = localStorage.getItem('wms_sku_business_lines') || '{}';
    try {
      const mapping = JSON.parse(savedMapping);
      mapping[sku] = lineId;
      localStorage.setItem('wms_sku_business_lines', JSON.stringify(mapping));
    } catch (e) {}
  };

  // Handle adding new business line
  const handleAddLine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLineName.trim()) return;

    const newId = 'line_' + Date.now();
    const newLine = {
      id: newId,
      name: newLineName.trim(),
      color: newLineColor,
      desc: newLineDesc.trim() || 'Sin descripción adicional'
    };

    setBusinessLines([...businessLines, newLine]);
    setNewLineName('');
    setNewLineDesc('');
    setShowAddLineForm(false);
    showFeedback(`Línea de negocio "${newLine.name}" creada con éxito.`);
  };

  // Handle deleting business line
  const handleDeleteLine = (lineId: string) => {
    if (businessLines.length <= 1) {
      showFeedback('Debe existir al menos una línea de negocio en el sistema.', 'error');
      return;
    }
    const lineToDelete = businessLines.find(l => l.id === lineId);
    if (!lineToDelete) return;

    if (window.confirm(`¿Seguro que desea eliminar la línea de negocio "${lineToDelete.name}"? Los SKUs asociados volverán a su clasificación general.`)) {
      setBusinessLines(businessLines.filter(l => l.id !== lineId));
      if (selectedLineId === lineId) {
        setSelectedLineId(businessLines.find(l => l.id !== lineId)?.id || '');
      }
      showFeedback(`Línea "${lineToDelete.name}" eliminada.`);
    }
  };

  // Set physical space designation (Aisle)
  const handleAssignAisle = () => {
    const updated = { ...aisleAssignments, [activeAisleToDesignate]: activeLineToDesignate };
    setAisleAssignments(updated);
    const lineObj = businessLines.find(l => l.id === activeLineToDesignate);
    showFeedback(`Pasillo ${activeAisleToDesignate} designado para "${lineObj?.name || activeLineToDesignate}"`);
  };

  // Clear specific bin override
  const handleClearBinOverride = (binId: string) => {
    const updated = { ...binAssignments };
    delete updated[binId];
    setBinAssignments(updated);
    showFeedback(`Se restableció la designación por pasillo para la celda ${binId}`);
  };

  // Set individual bin designation
  const handleAssignBin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBinToDesignate.trim()) return;

    const binId = activeBinToDesignate.toUpperCase().trim();
    const binExists = bins.some(b => b.id === binId);
    if (!binExists) {
      showFeedback(`La celda "${binId}" no existe en la topología física del almacén.`, 'error');
      return;
    }

    const updated = { ...binAssignments, [binId]: activeLineToDesignate };
    setBinAssignments(updated);
    const lineObj = businessLines.find(l => l.id === activeLineToDesignate);
    showFeedback(`Celda individual ${binId} designada exclusivamente para "${lineObj?.name}"`);
    setActiveBinToDesignate('');
  };

  // SKU registration directly within this Line of Business tab
  const handleRegisterSkuInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkuCode.trim() || !newSkuName.trim()) {
      showFeedback('Por favor, rellene el código SKU y el nombre.', 'error');
      return;
    }

    const uppercaseSku = newSkuCode.toUpperCase().trim();
    if (inventory.some(i => i.sku === uppercaseSku)) {
      showFeedback(`El SKU "${uppercaseSku}" ya se encuentra registrado.`, 'error');
      return;
    }

    const newItem: InventoryItem = {
      sku: uppercaseSku,
      name: newSkuName.trim(),
      description: newSkuDesc.trim() || `Insumo de ${businessLines.find(l => l.id === selectedLineId)?.name}`,
      category: newSkuCategory,
      qty: newSkuInitialQty,
      minQty: newSkuMinQty,
      expirationDate: '',
      unitWidth: 20,
      unitHeight: 15,
      unitLength: 15,
      unitWeight: 1,
      supplier: newSkuSupplier.trim() || 'Proveedor General',
      cost: newSkuCost,
      barcode: `750${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=150&h=150&q=80'
    };

    try {
      if (onAddInventory) {
        await onAddInventory(newItem);
        // Explicitly map business line
        setSkuBusinessLine(uppercaseSku, selectedLineId);
        
        setIsRegisteringSku(false);
        setNewSkuCode('');
        setNewSkuName('');
        setNewSkuDesc('');
        setNewSkuCost(10);
        setNewSkuInitialQty(0);
        showFeedback(`SKU ${uppercaseSku} registrado con éxito en la línea de negocio.`);
      } else {
        showFeedback('Error del WMS: Función de guardado no enlazada.', 'error');
      }
    } catch (err: any) {
      showFeedback(`Error al registrar: ${err.message}`, 'error');
    }
  };

  // Re-map an existing SKU to another business line
  const handleMoveSkuLine = (sku: string, targetLineId: string) => {
    setSkuBusinessLine(sku, targetLineId);
    // Trigger virtual update to component to force re-render
    const matchingItem = inventory.find(i => i.sku === sku);
    if (matchingItem && onUpdateInventoryItem) {
      onUpdateInventoryItem(sku, {}); // Just trigger refetch/sync
    }
    showFeedback(`SKU ${sku} transferido de línea de negocio.`);
  };

  // CRITICAL METRICS CALCULATIONS PER LINE
  const getLineMetrics = (lineId: string) => {
    // 1. Get all SKUs belonging to this line
    const lineSkus = inventory.filter(item => getSkuBusinessLineId(item) === lineId);
    
    // 2. Calculate Inventory Value (Valor de Inventario)
    const totalValue = lineSkus.reduce((sum, item) => sum + ((item.cost || 0) * (item.qty || 0)), 0);
    
    // 3. Total units of stock
    const totalStockQty = lineSkus.reduce((sum, item) => sum + (item.qty || 0), 0);

    // 4. Bins designated for this line
    const designatedBins = bins.filter(b => {
      const designation = getBinDesignatedLine(b);
      return designation?.id === lineId;
    });

    const totalDesignatedSlots = designatedBins.length;

    // 5. Occupied designated slots (Disposición de Insumos)
    const occupiedBins = designatedBins.filter(b => b.occupiedQty > 0);
    const occupiedSlots = occupiedBins.length;
    const freeSlots = totalDesignatedSlots - occupiedSlots;
    const utilizationRate = totalDesignatedSlots > 0 ? Math.round((occupiedSlots / totalDesignatedSlots) * 100) : 0;

    // 6. Alert low stock count
    const lowStockItemsCount = lineSkus.filter(item => item.qty <= (item.minQty || 0)).length;

    return {
      skus: lineSkus,
      totalValue,
      totalStockQty,
      totalDesignatedSlots,
      occupiedSlots,
      freeSlots,
      utilizationRate,
      lowStockItemsCount,
      designatedBins
    };
  };

  // Selected line metrics
  const activeMetrics = getLineMetrics(selectedLineId);
  const selectedLineObj = businessLines.find(l => l.id === selectedLineId);

  // Get visual representation of all lines for the main summary dashboard
  const summaryData = businessLines.map(line => {
    const metrics = getLineMetrics(line.id);
    return {
      line,
      ...metrics
    };
  });

  return (
    <div className="space-y-6">
      
      {/* Upper Status Notifications */}
      <AnimatePresence>
        {feedbackMsg.text && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-xl text-xs font-bold shadow-md flex items-center gap-2.5 ${
              feedbackMsg.type === 'error'
                ? 'bg-rose-50 border border-rose-100 text-rose-600'
                : 'bg-emerald-50 border border-emerald-100 text-emerald-600'
            }`}
          >
            <Check className="h-4 w-4" />
            <span>{feedbackMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Intro Header */}
      <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-blue-600" />
              Gestión Integral por Líneas de Negocio
            </h1>
            <p className="text-xs text-slate-400">
              Asigna de forma estratégica espacios físicos, almacena y analiza insumos segmentados por cada unidad comercial de la compañía.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowAddLineForm(!showAddLineForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 cursor-pointer shadow-md shadow-blue-600/10 transition flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nueva Línea de Negocio
            </button>
          </div>
        </div>

        {/* Dynamic add line form */}
        <AnimatePresence>
          {showAddLineForm && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleAddLine}
              className="mt-6 p-4 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-4 overflow-hidden text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                <span className="font-bold text-slate-700">Crear Nueva Línea de Negocio</span>
                <button type="button" onClick={() => setShowAddLineForm(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Nombre de la Línea</label>
                  <input
                    type="text"
                    required
                    value={newLineName}
                    onChange={(e) => setNewLineName(e.target.value)}
                    placeholder="ej. Alimentos y Bebidas"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Color Identificador</label>
                  <select
                    value={newLineColor}
                    onChange={(e) => setNewLineColor(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer"
                  >
                    {colorOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Descripción Breve</label>
                  <input
                    type="text"
                    value={newLineDesc}
                    onChange={(e) => setNewLineDesc(e.target.value)}
                    placeholder="ej. Insumos perecederos y cadena de frío"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-xl font-bold cursor-pointer transition"
                >
                  Registrar Línea
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* DASHBOARD: Global lines performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {summaryData.map(({ line, totalValue, totalStockQty, utilizationRate, totalDesignatedSlots }) => (
          <div
            key={line.id}
            onClick={() => setSelectedLineId(line.id)}
            className={`p-5 rounded-2xl border cursor-pointer transition duration-250 select-none ${
              selectedLineId === line.id
                ? 'bg-white border-blue-500 shadow-lg shadow-blue-500/5 ring-2 ring-blue-500/10'
                : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700 truncate">{line.name}</span>
              <div className={`w-3 h-3 rounded-full ${line.color.split(' ')[0]}`}></div>
            </div>
            
            <div className="space-y-2">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Valor Inventario</span>
                <span className="text-sm font-black text-slate-800">
                  ${totalValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-slate-50 pt-2 text-[10px] font-semibold text-slate-500">
                <div>
                  <span className="block text-slate-400 text-[9px]">Stock</span>
                  <span className="text-slate-700">{totalStockQty} u.</span>
                </div>
                <div>
                  <span className="block text-slate-400 text-[9px]">Ubicaciones</span>
                  <span className="text-slate-700">{totalDesignatedSlots} celdas</span>
                </div>
              </div>

              {/* Progress bar of space utilization */}
              <div className="space-y-1 pt-1.5 border-t border-slate-50">
                <div className="flex justify-between text-[9px] font-bold text-slate-400">
                  <span>Ocupación de Espacio</span>
                  <span className="text-slate-700">{utilizationRate}%</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${line.color.split(' ')[0]} transition-all duration-500`}
                    style={{ width: `${Math.min(100, utilizationRate)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* TWO PANEL WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Designation of Physical Spaces (7 cols) */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          
          <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="h-4.5 w-4.5 text-blue-500" />
                  Designación Geográfica de Espacios Físicos
                </h3>
                <p className="text-[11px] text-slate-400">
                  Reserva y designa pasillos enteros o celdas individuales para garantizar que los productos de cada línea se almacenen juntos.
                </p>
              </div>
            </div>

            {/* Quick configuration forms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
              
              {/* Form 1: Assign Aisle */}
              <div className="space-y-3">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Designación por Pasillo Entero</span>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 mb-1">Seleccionar Pasillo</label>
                      <select
                        value={activeAisleToDesignate}
                        onChange={(e) => setActiveAisleToDesignate(e.target.value)}
                        className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold"
                      >
                        {uniqueAisles.map(a => (
                          <option key={a} value={a}>Pasillo {a}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 mb-1">Línea de Negocio</label>
                      <select
                        value={activeLineToDesignate}
                        onChange={(e) => setActiveLineToDesignate(e.target.value)}
                        className="w-full p-2 border border-slate-200 bg-white rounded-lg text-slate-700"
                      >
                        {businessLines.map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAssignAisle}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition"
                  >
                    Asignar Todo el Pasillo
                  </button>
                </div>
              </div>

              {/* Form 2: Assign Individual Slot */}
              <form onSubmit={handleAssignBin} className="space-y-3">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Designar Celda Individual</span>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 mb-1">Celda ID (ej. A-01-S1-L1)</label>
                      <input
                        type="text"
                        required
                        value={activeBinToDesignate}
                        onChange={(e) => setActiveBinToDesignate(e.target.value)}
                        placeholder="A-01-S1-L1"
                        className="w-full p-2 border border-slate-200 bg-white rounded-lg uppercase font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 mb-1">Línea de Negocio</label>
                      <select
                        value={activeLineToDesignate}
                        onChange={(e) => setActiveLineToDesignate(e.target.value)}
                        className="w-full p-2 border border-slate-200 bg-white rounded-lg text-slate-700"
                      >
                        {businessLines.map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer transition"
                  >
                    Asignar Celda Única
                  </button>
                </div>
              </form>
            </div>

            {/* PHYSICAL GEOGRAPHY VIEW OF WAREHOUSE MAP (MINIATURIZED & COLOR-CODED) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Topología Física del Almacén Segregada</span>
                <div className="flex flex-wrap gap-2">
                  {businessLines.map(l => (
                    <div key={l.id} className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500">
                      <span className={`w-2.5 h-2.5 rounded-xs ${l.color.split(' ')[0]}`}></span>
                      <span>{l.name}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500">
                    <span className="w-2.5 h-2.5 rounded-xs bg-slate-100 border border-slate-200"></span>
                    <span>Sin Asignar</span>
                  </div>
                </div>
              </div>

              {/* Simulated Warehouse Grid of Bins */}
              <div className="border border-slate-100 bg-slate-50/50 p-5 rounded-2xl">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {uniqueAisles.map(aisle => {
                    const aisleBins = bins.filter(b => b.aisle === aisle);
                    // Determine what's the primary line of this aisle
                    const lineId = aisleAssignments[aisle];
                    const lineObj = businessLines.find(l => l.id === lineId);

                    return (
                      <div key={aisle} className="bg-white border border-slate-200/60 rounded-xl p-3 space-y-3 shadow-xs">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-1.5">
                          <span className="font-bold text-slate-800 text-xs font-mono">PASILLO {aisle}</span>
                          {lineObj && (
                            <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-md ${lineObj.color.split(' ').slice(1).join(' ')}`}>
                              {lineObj.name}
                            </span>
                          )}
                        </div>

                        {/* Slots of this aisle */}
                        <div className="grid grid-cols-3 gap-1">
                          {aisleBins.map(bin => {
                            const designatedLine = getBinDesignatedLine(bin);
                            const isOverridden = !!binAssignments[bin.id];
                            
                            // Determine visual color of the cell
                            let cellBg = 'bg-slate-50 border-slate-200 text-slate-400';
                            if (designatedLine) {
                              cellBg = `${designatedLine.color.split(' ')[0]} text-white border-transparent`;
                            }

                            return (
                              <div
                                key={bin.id}
                                title={`Celda: ${bin.id}\nLínea designada: ${designatedLine?.name || 'Ninguna'}\nContenido: ${bin.occupiedSku || 'Vacía'} (${bin.occupiedQty} u.)\n${isOverridden ? 'Tiene designación personalizada de celda' : ''}`}
                                className={`h-8 rounded-md flex flex-col items-center justify-center text-[8px] font-mono font-bold border transition duration-150 hover:scale-105 cursor-pointer relative ${cellBg}`}
                              >
                                <span>{bin.id.split('-').slice(2).join('')}</span>
                                {bin.occupiedQty > 0 && (
                                  <span className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100/50 rounded-xl flex gap-2 text-[10px] text-blue-700 leading-relaxed font-medium">
                <Info className="h-4.5 w-4.5 text-blue-500 shrink-0" />
                <p>
                  <strong>Tip de Almacenamiento:</strong> El optimizador heurístico de celdas dará prioridad absoluta a almacenar SKUs en las ubicaciones designadas para su respectiva línea de negocio, evitando la contaminación cruzada y agilizando las rutas de picking por operador.
                </p>
              </div>
            </div>

          </div>

          {/* Sub-Panel: Listing current designations overrides */}
          {Object.keys(binAssignments).length > 0 && (
            <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm text-xs space-y-3 animate-fade-in">
              <span className="font-bold text-slate-700 block">Designaciones Personalizadas de Celdas Únicas ({Object.keys(binAssignments).length})</span>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {Object.entries(binAssignments).map(([binId, lineId]) => {
                  const line = businessLines.find(l => l.id === lineId);
                  return (
                    <div key={binId} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span className="font-bold font-mono text-slate-700">{binId}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${line?.color.split(' ').slice(1).join(' ') || 'bg-slate-100 text-slate-600'}`}>
                          {line?.name || 'Clasificación General'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleClearBinOverride(binId)}
                        className="text-[10px] font-extrabold text-red-500 hover:text-red-700 hover:underline cursor-pointer transition"
                      >
                        Restablecer
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: SKU Registration and List per Business Line (5 cols) */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          
          <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Package className="h-4.5 w-4.5 text-blue-500" />
                  Registro de Insumos / SKUs
                </h3>
                <p className="text-[11px] text-slate-400">
                  Control de catálogo de artículos asociados a la línea de negocio seleccionada.
                </p>
              </div>
            </div>

            {/* Quick dropdown for selected line */}
            <div className="space-y-2">
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Unidad de Negocio bajo Inspección</label>
              <select
                value={selectedLineId}
                onChange={(e) => setSelectedLineId(e.target.value)}
                className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-white p-3 text-slate-700 focus:border-blue-500 focus:outline-none cursor-pointer transition hover:border-slate-300"
              >
                {businessLines.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({getLineMetrics(l.id).skus.length} SKUs)</option>
                ))}
              </select>
            </div>

            {/* Visual Description box of active line */}
            {selectedLineObj && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-slate-700">{selectedLineObj.name}</span>
                  <button
                    onClick={() => handleDeleteLine(selectedLineObj.id)}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 cursor-pointer transition"
                    title="Eliminar esta línea de negocio"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Eliminar Línea</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed italic">{selectedLineObj.desc}</p>
                
                {/* Specific statistics */}
                <div className="grid grid-cols-2 gap-3 pt-2 text-[10px] font-semibold">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                    <span className="block text-slate-400 text-[9px]">Valor Total Stock</span>
                    <span className="text-slate-800 font-bold">
                      ${activeMetrics.totalValue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                    <span className="block text-slate-400 text-[9px]">Disposición</span>
                    <span className="text-slate-800 font-bold">{activeMetrics.occupiedSlots} / {activeMetrics.totalDesignatedSlots} Celdas</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Sku Inline registration toggle */}
            {!isRegisteringSku ? (
              <button
                onClick={() => setIsRegisteringSku(true)}
                className="w-full py-2.5 border border-dashed border-blue-300 bg-blue-50/20 hover:bg-blue-50/50 text-blue-600 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Registrar SKU en {selectedLineObj?.name}
              </button>
            ) : (
              <form onSubmit={handleRegisterSkuInline} className="p-4 bg-blue-50/30 border border-blue-100 rounded-2xl text-xs space-y-3.5 animate-fade-in">
                <div className="flex items-center justify-between border-b border-blue-100/50 pb-2">
                  <span className="font-bold text-blue-700">Añadir SKU a {selectedLineObj?.name}</span>
                  <button type="button" onClick={() => setIsRegisteringSku(false)} className="text-slate-400 hover:text-slate-600">✕ Ocultar</button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Código SKU (Único)</label>
                    <input
                      type="text"
                      required
                      value={newSkuCode}
                      onChange={(e) => setNewSkuCode(e.target.value)}
                      placeholder="ej. SEG-CHAL-M1"
                      className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold font-mono text-xs uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Nombre Artículo</label>
                    <input
                      type="text"
                      required
                      value={newSkuName}
                      onChange={(e) => setNewSkuName(e.target.value)}
                      placeholder="Chaleco de Seguridad Reflectivo"
                      className="w-full p-2 border border-slate-200 bg-white rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Costo ($)</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={newSkuCost}
                      onChange={(e) => setNewSkuCost(Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 bg-white rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Stock Inicial</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={newSkuInitialQty}
                      onChange={(e) => setNewSkuInitialQty(Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 bg-white rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Mínimo Stock</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newSkuMinQty}
                      onChange={(e) => setNewSkuMinQty(Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 bg-white rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Proveedor</label>
                    <input
                      type="text"
                      value={newSkuSupplier}
                      onChange={(e) => setNewSkuSupplier(e.target.value)}
                      placeholder="Textiles Seguros S.A."
                      className="w-full p-2 border border-slate-200 bg-white rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Cat. Seguridad</label>
                    <select
                      value={newSkuCategory}
                      onChange={(e) => setNewSkuCategory(e.target.value)}
                      className="w-full p-2 border border-slate-200 bg-white rounded-lg text-xs"
                    >
                      <option value="Electrónicos (Frágil)">Electrónicos (Frágil)</option>
                      <option value="Material Peligroso">Material Peligroso</option>
                      <option value="General">Insumo General</option>
                      <option value="Ropa / Textil">Ropa / Textil</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">Descripción</label>
                  <input
                    type="text"
                    value={newSkuDesc}
                    onChange={(e) => setNewSkuDesc(e.target.value)}
                    placeholder="ej. Talla mediana, con tiras reflejantes grado vial"
                    className="w-full p-2 border border-slate-200 bg-white rounded-lg text-xs"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsRegisteringSku(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition"
                  >
                    Guardar SKU
                  </button>
                </div>
              </form>
            )}

            {/* List of registered SKUs under the active Line */}
            <div className="space-y-3.5">
              <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Catálogo de Artículos y Suministros ({activeMetrics.skus.length})</span>
              
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {activeMetrics.skus.map((item) => {
                  const isLowStock = item.qty <= (item.minQty || 0);
                  
                  return (
                    <div key={item.sku} className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-100 rounded-xl space-y-2 transition">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-black font-mono text-slate-700 block">{item.sku}</span>
                          <span className="text-[11px] font-bold text-slate-800 leading-tight block mt-0.5">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-slate-800 block">{item.qty} u.</span>
                          {isLowStock ? (
                            <span className="text-[9px] font-extrabold bg-rose-50 border border-rose-100 text-rose-600 px-1.5 py-0.5 rounded mt-1 inline-flex items-center gap-0.5">
                              <AlertTriangle className="h-2.5 w-2.5" /> Reorden
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-slate-400">Stock Óptimo</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100/50 pt-2 text-[10px] text-slate-400 font-medium">
                        <span>Costo Unitario: <strong className="text-slate-600">${item.cost || 0}</strong></span>
                        <span>Mínimo: <strong className="text-slate-600">{item.minQty} u.</strong></span>
                      </div>

                      {/* Line of business re-assigner */}
                      <div className="border-t border-slate-100/50 pt-2 flex items-center justify-between text-[9px]">
                        <span className="font-bold text-slate-400">Reclasificar:</span>
                        <div className="flex flex-wrap gap-1">
                          {businessLines.filter(l => l.id !== selectedLineId).map(l => (
                            <button
                              key={l.id}
                              onClick={() => handleMoveSkuLine(item.sku, l.id)}
                              className="px-1.5 py-0.5 bg-white hover:bg-slate-200 border border-slate-200 rounded text-slate-500 hover:text-slate-800 transition text-[9px] font-semibold cursor-pointer"
                            >
                              A {l.name.split(' ')[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {activeMetrics.skus.length === 0 && (
                  <div className="text-center py-8 text-slate-400 italic text-[11px]">
                    <Archive className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <span>No hay insumos registrados en esta línea de negocio.</span>
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
