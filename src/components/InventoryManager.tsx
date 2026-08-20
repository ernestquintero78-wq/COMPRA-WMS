import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { InventoryItem, ActivityLog, Order } from '../types';
import { Package, Plus, Trash2, ShieldAlert, Check, Search, Filter, Printer, QrCode, Download, Sliders, X, LayoutGrid, List, Image as ImageIcon, TrendingUp, Building2, DollarSign, Boxes, FileSpreadsheet } from 'lucide-react';
import QRCode from 'qrcode';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

const LOGISTICS_PLACEHOLDERS = [
  {
    id: 'sensors',
    name: 'Sensores y Circuitos de Precisión',
    category: 'Sensores',
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80',
    description: 'Semiconductores de alta precisión, controladores electrónicos y placas de sensores.'
  },
  {
    id: 'hazmat',
    name: 'Materiales Peligrosos y Celdas de Batería',
    category: 'Materiales Peligrosos',
    url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=400&q=80',
    description: 'Módulos de batería de litio combustibles, químicos peligrosos y componentes de seguridad.'
  },
  {
    id: 'cables',
    name: 'Cables y Carretes Industriales',
    category: 'Cables',
    url: 'https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?auto=format&fit=crop&w=400&q=80',
    description: 'Redes de cableado, carretes eléctricos de alta resistencia y arneses de conexión.'
  },
  {
    id: 'apparel',
    name: 'Prendas y Ropa de Protección',
    category: 'Ropa',
    url: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=400&q=80',
    description: 'Materiales textiles especializados, inventario de uniformes y prendas de vestir.'
  },
  {
    id: 'electronics',
    name: 'Electrónica y Repuestos de Componentes',
    category: 'Electrónica',
    url: 'https://images.unsplash.com/photo-1517059224940-d4af9eec41b7?auto=format&fit=crop&w=400&q=80',
    description: 'Microprocesadores, módulos tecnológicos frágiles y herramientas de diagnóstico.'
  },
  {
    id: 'logistics',
    name: 'Embalaje de Carga Estándar',
    category: 'Carga General',
    url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80',
    description: 'Cajas de cartón corrugado resistentes, palés de carga y stock de almacenamiento.'
  }
];

interface InventoryProps {
  inventory: InventoryItem[];
  onAddInventory: (item: InventoryItem) => Promise<void>;
  onDeleteInventory: (sku: string) => Promise<void>;
  onUpdateInventoryQty?: (sku: string, newQty: number) => Promise<void>;
  onUpdateInventoryItem?: (sku: string, updatedFields: Partial<InventoryItem>) => Promise<void>;
  logs?: ActivityLog[];
  orders?: Order[];
  isReadOnly?: boolean;
}

export const InventoryManager: React.FC<InventoryProps> = ({
  inventory,
  onAddInventory,
  onDeleteInventory,
  onUpdateInventoryQty,
  onUpdateInventoryItem,
  logs = [],
  orders = [],
  isReadOnly = false
}) => {
  const [showForm, setShowForm] = useState(false);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [securityCategories, setSecurityCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('wms_security_categories');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return [
      'Electrónicos (Frágil)',
      'Material Peligroso / Baterías (Combustible)',
      'Sensores (Calibración de Precisión)',
      'Cables (Granel General)',
      'Ropa / Textil (No Peligroso)'
    ];
  });
  const [category, setCategory] = useState(() => {
    try {
      const saved = localStorage.getItem('wms_security_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed[0];
        }
      }
    } catch (e) {}
    return 'Electrónicos (Frágil)';
  });
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  useEffect(() => {
    localStorage.setItem('wms_security_categories', JSON.stringify(securityCategories));
  }, [securityCategories]);

  const [businessLines, setBusinessLines] = useState<{ id: string; name: string }[]>(() => {
    const saved = localStorage.getItem('wms_custom_business_lines');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [
      { id: 'electro', name: 'Electrónica' },
      { id: 'food', name: 'Alimentos y Bebidas' },
      { id: 'fashion', name: 'Moda y Textil' },
      { id: 'home', name: 'Hogar y Cocina' },
      { id: 'health', name: 'Salud y Cuidado' }
    ];
  });
  const [selectedBusinessLine, setSelectedBusinessLine] = useState('electro');

  const [minQty, setMinQty] = useState(20);
  const [expiry, setExpiry] = useState('');
  const [width, setWidth] = useState(30);
  const [height, setHeight] = useState(20);
  const [length, setLength] = useState(20);
  const [weight, setWeight] = useState(5.0);
  const [supplier, setSupplier] = useState('');
  const [cost, setCost] = useState<number>(45.0);
  const [initialQty, setInitialQty] = useState<number>(0);
  const [barcode, setBarcode] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [viewMode, setViewMode] = useState<'table' | 'grid' | 'predictions' | 'abc'>('grid');

  // Category customization states
  const [hiddenCategories, setHiddenCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('wms_hidden_categories');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [categoryFilterLimit, setCategoryFilterLimit] = useState<number>(() => {
    const saved = localStorage.getItem('wms_category_filter_limit');
    return saved ? Number(saved) : 8; // Default to 8
  });

  const [showFilterConfig, setShowFilterConfig] = useState(false);
  const [isCategoryListExpanded, setIsCategoryListExpanded] = useState(false);

  useEffect(() => {
    localStorage.setItem('wms_hidden_categories', JSON.stringify(hiddenCategories));
  }, [hiddenCategories]);

  useEffect(() => {
    localStorage.setItem('wms_category_filter_limit', String(categoryFilterLimit));
  }, [categoryFilterLimit]);

  useEffect(() => {
    if (categoryFilter !== 'Todas' && hiddenCategories.includes(categoryFilter)) {
      setCategoryFilter('Todas');
    }
  }, [hiddenCategories, categoryFilter]);

  // SKU History & Trend states
  const [selectedHistorySku, setSelectedHistorySku] = useState<string>('');
  const trendSectionRef = useRef<HTMLDivElement>(null);

  // Confirmation modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [skuToDelete, setSkuToDelete] = useState('');
  const [printSku, setPrintSku] = useState<string | null>(null);
  const [printCopies, setPrintCopies] = useState<number>(5);

  // Report and Printable states
  const [showPrintReport, setShowPrintReport] = useState(false);
  const [reportNotes, setReportNotes] = useState('Official Quarterly Stock Valuation Audit');

  // Placeholder Image Assign states
  const [assigningImageSku, setAssigningImageSku] = useState<string | null>(null);
  const [customPlaceholderUrl, setCustomPlaceholderUrl] = useState('');

  // QR Code generator states
  const [selectedQrSku, setSelectedQrSku] = useState<string | null>(null);
  const [qrValueType, setQrValueType] = useState<'sku' | 'barcode'>('sku');
  const [qrColor, setQrColor] = useState<string>('#0f172a'); // default slate-900
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrSize, setQrSize] = useState<number>(180);

  // Inline editing states
  const [inlineEditSku, setInlineEditSku] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState<number>(0);

  // ABC Classification Tool states
  const [abcCategoryTab, setAbcCategoryTab] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [abcSortKey, setAbcSortKey] = useState<'score' | 'demand' | 'stock' | 'cost'>('score');
  const [selectedAbcSku, setSelectedAbcSku] = useState<string | null>(null);
  const [isSimulatingAbcOptimization, setIsSimulatingAbcOptimization] = useState(false);
  const [optimizationSuccessMsg, setOptimizationSuccessMsg] = useState<string | null>(null);

  // Lógica de predicción de reabastecimiento basada en movimientos y órdenes
  const predictions = React.useMemo(() => {
    const now = new Date('2026-06-29T10:21:43-07:00');
    
    return inventory.map(item => {
      // 1. Órdenes Outbound completadas para consumo real
      const outboundOrders = orders.filter(
        o => o.status === 'Completed' && o.type === 'Outbound'
      );
      
      let totalOutboundConsumed = 0;
      const consumptionDates: Date[] = [];
      
      outboundOrders.forEach(o => {
        const oItem = o.items.find(oi => oi.sku === item.sku);
        if (oItem) {
          totalOutboundConsumed += oItem.qty;
          const orderDate = o.shipmentDate ? new Date(o.shipmentDate) : new Date(o.dateCreated);
          consumptionDates.push(orderDate);
        }
      });

      // 2. Reducciones manuales en los logs de actividad
      let totalManualDeductions = 0;
      logs.forEach(log => {
        if (log.action === 'Adjust Inventory Stock' || log.action === 'Manual stock level adjustment') {
          const match = log.details.match(/SKU\s+(\S+)\s+from\s+(\d+)\s+to\s+(\d+)/i);
          if (match) {
            const logSku = match[1];
            const oldQty = parseInt(match[2], 10);
            const newQty = parseInt(match[3], 10);
            if (logSku === item.sku && newQty < oldQty) {
              totalManualDeductions += (oldQty - newQty);
              consumptionDates.push(new Date(log.timestamp));
            }
          }
        }
      });

      const totalConsumed = totalOutboundConsumed + totalManualDeductions;
      
      // Cálculo del lapso de tiempo analizado
      let daysSpan = 1;
      if (consumptionDates.length > 0) {
        const sortedDates = [...consumptionDates].sort((a, b) => a.getTime() - b.getTime());
        const earliest = sortedDates[0];
        const diffMs = now.getTime() - earliest.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        daysSpan = Math.max(1, diffDays);
      } else {
        daysSpan = 15; // Lapso por defecto si no hay registros
      }

      // Cálculo de tasa de consumo diaria
      let dailyRate = 0;
      let isCalculated = false;
      
      if (totalConsumed > 0) {
        dailyRate = totalConsumed / daysSpan;
        isCalculated = true;
      } else {
        // Generador nominal para SKUs sin historial para visualización inteligente
        const hash = item.sku.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        dailyRate = 0.2 + (hash % 6) * 0.15; // 0.2 a 0.95 unidades por día
      }

      dailyRate = Math.max(0.05, dailyRate);

      const currentQty = item.qty;
      const targetMinQty = item.minQty || 0;
      
      let daysToCritical = 0;
      let suggestedDateStr = '';
      let status: 'critical' | 'warning' | 'healthy' = 'healthy';
      let statusText = '';

      if (currentQty <= targetMinQty) {
        daysToCritical = 0;
        status = 'critical';
        statusText = 'Inmediato (Debajo del mínimo)';
        suggestedDateStr = 'INMEDIATO';
      } else {
        daysToCritical = (currentQty - targetMinQty) / dailyRate;
        const suggestedDate = new Date(now.getTime() + daysToCritical * 24 * 60 * 60 * 1000);
        
        if (daysToCritical < 3) {
          status = 'critical';
          statusText = `Crítico (< ${Math.ceil(daysToCritical)} días)`;
        } else if (daysToCritical < 10) {
          status = 'warning';
          statusText = `Atención (~${Math.ceil(daysToCritical)} días)`;
        } else {
          status = 'healthy';
          statusText = `Estable (~${Math.ceil(daysToCritical)} días)`;
        }

        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
        suggestedDateStr = suggestedDate.toLocaleDateString('es-ES', options);
      }

      return {
        sku: item.sku,
        name: item.name,
        category: item.category,
        qty: item.qty,
        minQty: targetMinQty,
        dailyRate,
        totalConsumed,
        isCalculated,
        daysToCritical,
        suggestedDateStr,
        status,
        statusText,
        supplier: item.supplier,
        imageUrl: item.imageUrl
      };
    });
  }, [inventory, orders, logs]);

  // ABC Analysis Computation based on Outbound Frequency and Total Value
  const abcAnalysis = React.useMemo(() => {
    const itemsWithStats = inventory.map(item => {
      const pred = predictions.find(p => p.sku === item.sku);
      const totalConsumed = pred ? pred.totalConsumed : 0;
      const dailyRate = pred ? pred.dailyRate : 0.05;
      
      const costValue = item.cost || 25;
      const stockValue = item.qty * costValue;
      const demandValue = totalConsumed * costValue;
      
      // Composite score: weights outbounds movement frequency/value (70%) and stock value (30%)
      const compositeScore = (demandValue * 0.75) + (stockValue * 0.25) + (dailyRate * 50);

      return {
        ...item,
        totalConsumed,
        dailyRate,
        stockValue,
        demandValue,
        compositeScore,
      };
    });

    // Sort items by compositeScore descending
    const sortedByImportance = [...itemsWithStats].sort((a, b) => b.compositeScore - a.compositeScore);
    
    // Compute total score sum
    const totalScoreSum = sortedByImportance.reduce((sum, item) => sum + item.compositeScore, 0);

    let runningSum = 0;
    return sortedByImportance.map((item, index) => {
      runningSum += item.compositeScore;
      const cumulativePercentage = totalScoreSum > 0 
        ? (runningSum / totalScoreSum) * 100 
        : ((index + 1) / sortedByImportance.length) * 100;
      
      let categoryLetter: 'A' | 'B' | 'C' = 'C';
      let locationRecommendation = '';
      let storageZone = '';

      if (cumulativePercentage <= 70 || index === 0) { // Top 70% of cumulative value contribution
        categoryLetter = 'A';
        locationRecommendation = 'Nivel Inferior (Bahías 1-3) - Acceso Inmediato';
        storageZone = 'Zona A: Alta Rotación / Cerca de Muelles';
      } else if (cumulativePercentage <= 92 || index === 1) { // Next 22%
        categoryLetter = 'B';
        locationRecommendation = 'Nivel Medio (Bahías 4-6) - Estantería Central';
        storageZone = 'Zona B: Rotación Media / Estanterías Centrales';
      } else { // Bottom 8%
        categoryLetter = 'C';
        locationRecommendation = 'Nivel Superior (Bahías 7-9) o Zona Posterior';
        storageZone = 'Zona C: Baja Rotación / Racks de Alturas o Fondo';
      }

      return {
        ...item,
        categoryLetter,
        locationRecommendation,
        storageZone,
        cumulativePercentage,
      };
    });
  }, [inventory, predictions]);

  const handleRunAbcOptimization = () => {
    setIsSimulatingAbcOptimization(true);
    setOptimizationSuccessMsg(null);
    setTimeout(() => {
      setIsSimulatingAbcOptimization(false);
      const categoryACount = abcAnalysis.filter(i => i.categoryLetter === 'A').length;
      setOptimizationSuccessMsg(
        `Optimización de Ranuras (Slotting) finalizada con éxito. Se han diseñado asignaciones específicas para las bahías frontales del almacén. Los ${categoryACount} SKUs de tipo 'A' (Alta Rotación) han sido ubicados en estanterías bajas cerca del muelle de despacho para reducir la fatiga operativa y agilizar el picking en un 22%.`
      );
    }, 1800);
  };

  const abcStats = React.useMemo(() => {
    const totalItems = abcAnalysis.length;
    const totalStockValue = abcAnalysis.reduce((sum, item) => sum + item.stockValue, 0);

    const aItems = abcAnalysis.filter(i => i.categoryLetter === 'A');
    const bItems = abcAnalysis.filter(i => i.categoryLetter === 'B');
    const cItems = abcAnalysis.filter(i => i.categoryLetter === 'C');

    const aStockValue = aItems.reduce((sum, item) => sum + item.stockValue, 0);
    const bStockValue = bItems.reduce((sum, item) => sum + item.stockValue, 0);
    const cStockValue = cItems.reduce((sum, item) => sum + item.stockValue, 0);

    return {
      totalItems,
      totalStockValue,
      aCount: aItems.length,
      bCount: bItems.length,
      cCount: cItems.length,
      aValuePercent: totalStockValue > 0 ? (aStockValue / totalStockValue) * 100 : 0,
      bValuePercent: totalStockValue > 0 ? (bStockValue / totalStockValue) * 100 : 0,
      cValuePercent: totalStockValue > 0 ? (cStockValue / totalStockValue) * 100 : 0,
      aItems,
      bItems,
      cItems,
    };
  }, [abcAnalysis]);

  const handleSaveInlineQty = async (skuStr: string) => {
    if (inlineEditValue < 0) {
      alert("Inventory quantity cannot be negative.");
      return;
    }
    try {
      if (onUpdateInventoryQty) {
        await onUpdateInventoryQty(skuStr, inlineEditValue);
      }
      setInlineEditSku(null);
    } catch (err) {
      console.error('Error saving inline inventory qty:', err);
      alert('Error updating stock level. Please try again.');
    }
  };

  // QR Generation Effect
  useEffect(() => {
    if (!selectedQrSku) return;
    const item = inventory.find(i => i.sku === selectedQrSku);
    if (!item) return;

    const textToEncode = qrValueType === 'sku' ? item.sku : (item.barcode || '7501020304012');

    QRCode.toDataURL(textToEncode, {
      width: qrSize,
      margin: 1,
      color: {
        dark: qrColor,
        light: '#ffffff'
      }
    })
    .then(url => {
      setQrDataUrl(url);
    })
    .catch(err => {
      console.error('Error generating QR code:', err);
    });
  }, [selectedQrSku, qrValueType, qrColor, qrSize, inventory]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku) return;

    // Check duplicate SKU
    if (inventory.some(i => i.sku.toLowerCase() === sku.toLowerCase())) {
      alert("Error: SKU already registered on WMS inventory index!");
      return;
    }

    const newItem: InventoryItem = {
      sku: sku.toUpperCase().trim(),
      name,
      description,
      category,
      qty: initialQty,
      minQty,
      expirationDate: expiry,
      unitWidth: width,
      unitHeight: height,
      unitLength: length,
      unitWeight: weight,
      supplier,
      cost,
      barcode: barcode.trim() || `750${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      imageUrl: imageUrl.trim()
    };

    try {
      await onAddInventory(newItem);
      // Save associated business line to localStorage
      const savedMapping = localStorage.getItem('wms_sku_business_lines') || '{}';
      try {
        const mapping = JSON.parse(savedMapping);
        mapping[newItem.sku] = selectedBusinessLine;
        localStorage.setItem('wms_sku_business_lines', JSON.stringify(mapping));
      } catch (e) {}

      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setSku('');
    setName('');
    setDescription('');
    setCategory(securityCategories[0] || 'Electrónicos (Frágil)');
    setMinQty(20);
    setExpiry('');
    setWidth(30);
    setHeight(20);
    setLength(20);
    setWeight(5.0);
    setSupplier('');
    setCost(45.0);
    setInitialQty(0);
    setBarcode('');
    setImageUrl('');
  };

  const triggerDeleteSku = (skuStr: string) => {
    setSkuToDelete(skuStr);
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!skuToDelete) return;
    try {
      await onDeleteInventory(skuToDelete);
      setShowConfirmModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportExcel = (itemsToExport: InventoryItem[] = filteredProducts) => {
    // Define columns
    const headers = [
      'SKU',
      'Nombre',
      'Código de Barras',
      'Categoría',
      'Stock Actual',
      'Umbral Stock Mínimo',
      'Costo Unitario',
      'Peso Unitario (kg)',
      'Dimensiones (AnxAlxLa cm)',
      'Proveedor',
      'Fecha Expiración',
      'Descripción'
    ];

    // Map data to rows
    const rows = itemsToExport.map(item => [
      item.sku,
      item.name,
      item.barcode || '',
      item.category,
      item.qty,
      item.minQty,
      item.cost !== undefined ? item.cost : '',
      item.unitWeight,
      `${item.unitWidth}x${item.unitHeight}x${item.unitLength}`,
      item.supplier || '',
      item.expirationDate || '',
      item.description || ''
    ]);

    // Create Excel worksheet and workbook
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario de Almacén");

    // Write file to download Excel .xlsx
    XLSX.writeFile(wb, `Reporte_Inventario_WMS_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Filter items safely and in real-time
  const filteredProducts = inventory.filter(item => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      (item.sku || '').toLowerCase().includes(q) || 
      (item.name || '').toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q) ||
      (item.barcode || '').toLowerCase().includes(q);
    const matchesCategory = categoryFilter === 'Todas' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const allAvailableCategories = Array.from(new Set([...securityCategories, ...inventory.map(i => i.category)]));
  const categories = ['Todas', ...allAvailableCategories.filter(cat => !hiddenCategories.includes(cat))];

  // Helper to parse logs and construct a historical stock timeline for a given SKU
  const getSkuHistoryData = (targetSku: string, currentQty: number, activityLogs: ActivityLog[]) => {
    if (!targetSku) return [];

    const skuLogs = activityLogs
      .filter(log => {
        const detailsLower = (log.details || '').toLowerCase();
        const skuLower = targetSku.toLowerCase();
        return detailsLower.includes(skuLower);
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (skuLogs.length === 0) {
      return [
        {
          timestamp: new Date().toISOString(),
          dateStr: 'Current',
          qty: currentQty,
          action: 'Current Stock',
          delta: 0
        }
      ];
    }

    const parsedChanges = skuLogs.map(log => {
      const details = log.details || '';
      const timestamp = log.timestamp;
      
      let dateStr = 'Unknown Date';
      try {
        const dateObj = new Date(timestamp);
        if (!isNaN(dateObj.getTime())) {
          dateStr = dateObj.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          });
        }
      } catch (e) {}

      const escapedSku = targetSku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Adjust Inventory Stock absolute transition
      const adjustRegex = new RegExp(`from\\s+(\\d+)\\s+to\\s+(\\d+)`, 'i');
      const adjustMatch = details.match(adjustRegex);
      if (adjustMatch && log.action === 'Adjust Inventory Stock') {
        const oldQty = parseInt(adjustMatch[1], 10);
        const newQty = parseInt(adjustMatch[2], 10);
        return {
          timestamp,
          dateStr,
          action: log.action,
          type: 'absolute' as const,
          oldQty,
          newQty,
          delta: newQty - oldQty
        };
      }

      // Simulated Intake PO delivery
      const deliveryRegex = new RegExp(`delivery of\\s+(\\d+)\\s+units`, 'i');
      const deliveryMatch = details.match(deliveryRegex);
      if (deliveryMatch && (log.action.includes('Delivery') || log.action.includes('Inbound') || log.action.includes('Simulate'))) {
        const qty = parseInt(deliveryMatch[1], 10);
        return {
          timestamp,
          dateStr,
          action: log.action,
          type: 'delta' as const,
          delta: qty
        };
      }

      // Putaway Allocation Complete
      const putawayRegex = new RegExp(`\\((\\d+)\\s+units\\)`, 'i');
      const putawayMatch = details.match(putawayRegex);
      if (putawayMatch && log.action === 'Putaway Allocation Complete') {
        const qty = parseInt(putawayMatch[1], 10);
        return {
          timestamp,
          dateStr,
          action: log.action,
          type: 'delta' as const,
          delta: qty
        };
      }

      // Order Dispatch Completed
      const dispatchRegex = new RegExp(`${escapedSku}\\s*\\(([-\\+]?\\d+)\\)`, 'i');
      const dispatchMatch = details.match(dispatchRegex);
      if (dispatchMatch) {
        const qty = parseInt(dispatchMatch[1], 10);
        return {
          timestamp,
          dateStr,
          action: log.action,
          type: 'delta' as const,
          delta: qty
        };
      }

      // Generic delta parenthesis fallback
      const generalRegex = /\(([-\+]?\\d+)\)/;
      const generalMatch = details.match(generalRegex);
      if (generalMatch) {
        const qty = parseInt(generalMatch[1], 10);
        return {
          timestamp,
          dateStr,
          action: log.action,
          type: 'delta' as const,
          delta: qty
        };
      }

      return {
        timestamp,
        dateStr,
        action: log.action,
        type: 'delta' as const,
        delta: 0
      };
    });

    const historyPoints: { timestamp: string; dateStr: string; qty: number; action: string; delta: number }[] = [];
    let rollingQty = currentQty;

    // Insert present state
    historyPoints.unshift({
      timestamp: new Date().toISOString(),
      dateStr: 'Current',
      qty: currentQty,
      action: 'Current Stock State',
      delta: 0
    });

    // Go backwards in time
    for (let i = parsedChanges.length - 1; i >= 0; i--) {
      const change = parsedChanges[i];
      if (change.type === 'absolute') {
        historyPoints.unshift({
          timestamp: change.timestamp,
          dateStr: change.dateStr,
          qty: change.newQty,
          action: change.action,
          delta: change.delta
        });
        rollingQty = change.oldQty;
      } else {
        historyPoints.unshift({
          timestamp: change.timestamp,
          dateStr: change.dateStr,
          qty: rollingQty,
          action: change.action,
          delta: change.delta
        });
        rollingQty = Math.max(0, rollingQty - change.delta);
      }
    }

    // Add baseline
    const firstLog = parsedChanges[0];
    if (firstLog) {
      historyPoints.unshift({
        timestamp: new Date(new Date(firstLog.timestamp).getTime() - 1800000).toISOString(),
        dateStr: 'Initial',
        qty: rollingQty,
        action: 'Starting Quantity Baseline',
        delta: 0
      });
    }

    return historyPoints;
  };

  // Supplier Summary Calculations
  const supplierStats = React.useMemo(() => {
    const statsMap: { [supplierName: string]: { skuCount: number; totalQty: number; totalValue: number } } = {};
    let totalInventoryValue = 0;
    let totalInventoryQty = 0;

    inventory.forEach((item) => {
      const supplierName = (item.supplier || 'Unassigned / Unknown').trim();
      const cost = item.cost || 0;
      const qty = item.qty || 0;
      const value = qty * cost;

      if (!statsMap[supplierName]) {
        statsMap[supplierName] = {
          skuCount: 0,
          totalQty: 0,
          totalValue: 0
        };
      }

      statsMap[supplierName].skuCount += 1;
      statsMap[supplierName].totalQty += qty;
      statsMap[supplierName].totalValue += value;

      totalInventoryValue += value;
      totalInventoryQty += qty;
    });

    const list = Object.entries(statsMap).map(([name, data]) => ({
      name,
      ...data,
      valueShare: totalInventoryValue > 0 ? (data.totalValue / totalInventoryValue) * 100 : 0,
      qtyShare: totalInventoryQty > 0 ? (data.totalQty / totalInventoryQty) * 100 : 0
    }));

    // Sort by total value descending
    list.sort((a, b) => b.totalValue - a.totalValue);

    return {
      list,
      totalInventoryValue,
      totalInventoryQty,
      leadingSupplier: list.length > 0 ? list[0] : null
    };
  }, [inventory]);

  const activeSku = selectedHistorySku || (inventory.length > 0 ? inventory[0].sku : '');
  const activeItem = inventory.find(i => i.sku === activeSku);
  const historyData = activeSku && activeItem ? getSkuHistoryData(activeSku, activeItem.qty, logs) : [];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 shadow-xl max-w-xs text-xs space-y-1.5 font-sans">
          <div className="font-bold text-slate-300 font-mono text-[9px] uppercase tracking-wider">{data.dateStr}</div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400 font-medium">Nivel de Cantidad:</span>
            <span className="font-bold text-indigo-400 font-mono text-sm">{data.qty} unidades</span>
          </div>
          {data.delta !== 0 && (
            <div className="flex justify-between gap-4 text-[11px]">
              <span className="text-slate-400">Ajuste delta neto:</span>
              <span className={`font-mono font-bold ${data.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {data.delta > 0 ? `+${data.delta}` : data.delta} unidades
              </span>
            </div>
          )}
          <div className="text-[10px] text-indigo-200 bg-indigo-950/40 p-2 rounded-lg border border-indigo-900/30 leading-relaxed">
            <span className="font-bold block text-[8px] uppercase tracking-wider text-indigo-300/80 mb-0.5">Acción Registrada</span>
            {data.action}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-slate-100 rounded-2xl shadow-xs p-5 gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
            <Package className="h-5 w-5 text-blue-500" />
            Registro de SKU de Productos
          </h2>
          <p className="text-xs text-slate-400">
            Enumera los SKU registrados, propiedades físicas, volúmenes de almacenamiento y parámetros de umbral de reabastecimiento.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleExportExcel()}
            className="bg-emerald-650 hover:bg-emerald-700 text-white border border-emerald-750 px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-sm cursor-pointer transition-all duration-150 active:scale-98"
          >
            <FileSpreadsheet className="h-4.5 w-4.5 text-emerald-100" />
            Exportar Reporte a Excel
          </button>
          {!showForm && !isReadOnly && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700 active:scale-98 transition text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow"
            >
              <Plus className="h-4.5 w-4.5" />
              Agregar SKU de Almacenamiento
            </button>
          )}
        </div>
      </div>

      {/* Stock History Trend Chart Card */}
      <div 
        ref={trendSectionRef}
        className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-150 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
              Analizador de Tendencias de Cantidad de Stock de SKU
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Visualiza las fluctuaciones de cantidad históricas y en tiempo real basadas en registros físicos automatizados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Seleccionar SKU para Análisis:</label>
            <select
              value={activeSku}
              onChange={(e) => setSelectedHistorySku(e.target.value)}
              className="text-xs font-bold rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-750 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {inventory.map((item) => (
                <option key={item.sku} value={item.sku}>
                  {item.sku} — {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeItem ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left stats metrics list */}
            <div className="lg:col-span-1 flex flex-col gap-3.5">
              {/* Product Info Mini Block */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                <div className="text-[10px] uppercase font-bold text-slate-400 font-mono">SKU Seleccionado Actual</div>
                <div className="font-mono font-black text-slate-800 text-sm tracking-tight truncate" title={activeItem.sku}>
                  {activeItem.sku}
                </div>
                <div className="text-xs font-bold text-slate-600 line-clamp-2">
                  {activeItem.name}
                </div>
                <div className="text-[10px] bg-indigo-50 text-indigo-700 font-bold font-mono px-2 py-0.5 rounded-md inline-block uppercase">
                  {activeItem.category}
                </div>
              </div>

              {/* Stats values */}
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                  <span className="block text-[9px] uppercase font-bold text-slate-400 font-mono">Cantidad Actual</span>
                  <span className="text-lg font-black font-mono text-indigo-700">{activeItem.qty} <span className="text-xs font-medium text-slate-500">unidades</span></span>
                </div>
                
                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                  <span className="block text-[9px] uppercase font-bold text-slate-400 font-mono">Objetivo de Seguridad</span>
                  <span className="text-lg font-black font-mono text-emerald-700">{activeItem.minQty} <span className="text-xs font-medium text-slate-500">unidades</span></span>
                </div>

                <div className="col-span-2 lg:col-span-1 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <span className="block text-[9px] uppercase font-bold text-slate-400 font-mono">Registros de Historial</span>
                  <span className="text-lg font-black font-mono text-slate-700">
                    {logs.filter(log => (log.details || '').toLowerCase().includes(activeItem.sku.toLowerCase())).length} <span className="text-xs font-medium text-slate-500">entradas</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Recharts chart on the right */}
            <div className="lg:col-span-3 bg-slate-50/50 border border-slate-100 rounded-xl p-4 flex flex-col justify-between min-h-[340px]">
              {historyData.length > 0 ? (
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={historyData}
                      margin={{ top: 10, right: 20, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="dateStr" 
                        stroke="#94a3b8" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        dy={8}
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        dx={-8}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend 
                        verticalAlign="top" 
                        height={36} 
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace' }}
                      />
                      <Line
                        name="Nivel Físico de Cantidad de SKU"
                        type="monotone"
                        dataKey="qty"
                        stroke="#4f46e5"
                        strokeWidth={2.5}
                        dot={{ r: 3.5, strokeWidth: 1.5, stroke: "#ffffff", fill: "#4f46e5" }}
                        activeDot={{ r: 6, strokeWidth: 1, stroke: "#ffffff", fill: "#312e81" }}
                        animationDuration={1200}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center grow text-center py-12 px-4 space-y-2 select-none">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                    <TrendingUp className="h-6 w-6 stroke-[1.5]" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-700">Esperando Actividad de Registro</h4>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    Solo se encontró un único punto de datos para este SKU. ¡Intente ajustar el nivel de stock o simular algunas órdenes de entrada para generar nuevos datos históricos de tendencia!
                  </p>
                </div>
              )}
              
              <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono mt-2 pt-2 border-t border-slate-100">
                <span>Eje del Tiempo (Más antiguo → Más reciente)</span>
                <span>Todos los valores están sincronizados automáticamente con Supabase</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-xs text-slate-400 font-medium">
            No hay productos registrados en el inventario para realizar análisis históricos.
          </div>
        )}
      </div>

      {/* Tablero de Capital de Proveedores y Participación de Volumen */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-150 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-500" />
              Análisis de Capital y Volumen de Proveedores
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Distribución calculada de la inversión total de capital y la contribución del volumen de stock por fabricante registrado.
            </p>
          </div>
          <div className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-md border border-slate-200/50">
            {supplierStats.list.length} Proveedores Registrados
          </div>
        </div>

        {supplierStats.list.length > 0 ? (
          <div className="space-y-6">
            {/* Top Stat Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-bold text-slate-400 font-mono">Capital Total Invertido</span>
                  <span className="text-base font-black font-mono text-slate-800">
                    ${supplierStats.totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                  <Boxes className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-bold text-slate-400 font-mono">Volumen Total de Stock</span>
                  <span className="text-base font-black font-mono text-slate-800">
                    {supplierStats.totalInventoryQty.toLocaleString()} <span className="text-xs font-semibold text-slate-400">unidades</span>
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[9px] uppercase font-bold text-slate-400 font-mono">Socio Comercial Principal</span>
                  <span className="text-base font-black font-mono text-slate-800 block truncate" title={supplierStats.leadingSupplier?.name}>
                    {supplierStats.leadingSupplier?.name || 'N/A'}
                  </span>
                  {supplierStats.leadingSupplier && (
                    <span className="text-[10px] font-sans font-semibold text-emerald-600">
                      Posee el {supplierStats.leadingSupplier.valueShare.toFixed(1)}% de participación de valoración
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Calculated Table of Suppliers */}
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-3 px-4">Proveedor Socio</th>
                    <th className="py-3 px-4 text-center">Diversidad de SKU</th>
                    <th className="py-3 px-4 text-right">Volumen Físico</th>
                    <th className="py-3 px-4 text-right">Valoración de Stock</th>
                    <th className="py-3 px-4 text-center">Participación de Valoración Relativa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {supplierStats.list.map((sup, idx) => (
                    <tr key={sup.name} className="hover:bg-slate-50/40 transition">
                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="text-slate-400 text-xs font-mono font-bold select-none">#{idx + 1}</span>
                          <div className="h-7 w-7 rounded-lg bg-indigo-50/50 border border-indigo-100/40 flex items-center justify-center shrink-0">
                            <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                          </div>
                          <span className="font-sans font-semibold text-slate-700 select-all">{sup.name}</span>
                        </div>
                      </td>

                      {/* SKU Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md text-[10.5px]">
                          {sup.skuCount} {sup.skuCount === 1 ? 'SKU' : 'SKUs'}
                        </span>
                      </td>

                      {/* Total Quantity */}
                      <td className="py-3.5 px-4 text-right font-mono">
                        <div className="font-bold text-slate-700">{sup.totalQty.toLocaleString()}</div>
                        <div className="text-[9px] text-slate-400">({sup.qtyShare.toFixed(1)}% qty)</div>
                      </td>

                      {/* Total Cost Value */}
                      <td className="py-3.5 px-4 text-right font-mono">
                        <div className="font-extrabold text-indigo-600">
                          ${sup.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[9px] text-slate-400">({sup.valueShare.toFixed(1)}% val)</div>
                      </td>

                      {/* relative visual progress bar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3 justify-center max-w-xs mx-auto">
                          <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-indigo-500" 
                              style={{ width: `${sup.valueShare}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-extrabold text-slate-500 w-10 text-right">
                            {sup.valueShare.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-xs text-slate-400 font-medium animate-pulse">
            Registra SKUs con marcas de proveedores para ver estadísticas de distribución de capital.
          </div>
        )}
      </div>

      {/* Formulario de registro de SKU */}
      {showForm && (
        <form onSubmit={handleRegister} className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-5 animate-fade-in text-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600 animate-pulse" />
              <span className="font-bold text-slate-800 text-sm">Registro de Nuevo Artículo de Stock</span>
            </div>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded-full transition">
              ✕ Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Fila 1: SKU, Código de Barras y Nombre */}
            <div className="col-span-12 md:col-span-4">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Código SKU (Único)</label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="ej. CPU-RYZEN-59"
                className="w-full text-xs font-mono font-bold rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none transition hover:border-slate-300"
                required
              />
            </div>

            <div className="col-span-12 md:col-span-4">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Código de Barras (EAN-13)</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="ej. 7501020304012"
                  className="grow text-xs font-mono font-bold rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none transition hover:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setBarcode(`750${Math.floor(1000000000 + Math.random() * 9000000000)}`)}
                  className="bg-slate-100 hover:bg-slate-200 hover:text-slate-800 text-[10px] font-bold px-3 rounded-lg border border-slate-200 text-slate-600 shrink-0 cursor-pointer transition active:scale-95"
                  title="Generar código de barras aleatorio"
                >
                  Generar
                </button>
              </div>
            </div>

            <div className="col-span-12 md:col-span-4">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Nombre del Artículo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ej. AMD Ryzen Series 9 Pro"
                className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none transition hover:border-slate-300"
                required
              />
            </div>

            {/* Fila 2: Categoría, Línea de Negocio, Umbral de Reorden y Fecha de Expiración */}
            <div className="col-span-12 md:col-span-3">
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Categoría de Seguridad</label>
                <button
                  type="button"
                  onClick={() => setShowCategoryManager(!showCategoryManager)}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer transition"
                >
                  {showCategoryManager ? '✕ Ocultar' : '⚙️ Editar'}
                </button>
              </div>

              {showCategoryManager && (
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2 mb-2 animate-fade-in absolute z-50 shadow-lg max-w-xs">
                  <span className="block text-[9px] font-bold uppercase text-slate-400">Categorías de Seguridad Actuales:</span>
                  <div className="flex flex-wrap gap-1 bg-white p-2 rounded-lg border border-slate-100 max-h-24 overflow-y-auto">
                    {securityCategories.map((cat) => (
                      <div key={cat} className="inline-flex items-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-slate-200 transition">
                        <span>{cat}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = securityCategories.filter(c => c !== cat);
                            setSecurityCategories(updated);
                            if (category === cat) {
                              setCategory(updated[0] || '');
                            }
                          }}
                          className="text-red-500 hover:text-red-700 font-bold ml-1 cursor-pointer"
                          title="Eliminar esta categoría"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {securityCategories.length === 0 && (
                      <span className="text-[10px] text-slate-400 italic">No hay categorías cargadas</span>
                    )}
                  </div>
                  
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      placeholder="Nueva categoría..."
                      className="grow text-[11px] font-semibold border border-slate-200 bg-white px-2 py-1 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = newCategoryInput.trim();
                        if (trimmed) {
                          if (!securityCategories.includes(trimmed)) {
                            setSecurityCategories([...securityCategories, trimmed]);
                            setCategory(trimmed);
                            setNewCategoryInput('');
                          }
                        }
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-3 py-1 rounded-lg shadow-xs transition cursor-pointer"
                    >
                      Añadir
                    </button>
                  </div>
                </div>
              )}

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none text-left cursor-pointer transition hover:border-slate-300"
              >
                {securityCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="col-span-12 md:col-span-3">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Línea de Negocio</label>
              <select
                value={selectedBusinessLine}
                onChange={(e) => setSelectedBusinessLine(e.target.value)}
                className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none text-left cursor-pointer transition hover:border-slate-300"
              >
                {businessLines.map((line) => (
                  <option key={line.id} value={line.id}>{line.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-12 md:col-span-3">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Umbral de Reorden (Mínimo)</label>
              <input
                type="number"
                min="1"
                value={minQty}
                onChange={(e) => setMinQty(Number(e.target.value))}
                className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none transition hover:border-slate-300"
                required
              />
            </div>

            <div className="col-span-12 md:col-span-3">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Fecha de Expiración (Opcional)</label>
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none transition hover:border-slate-300"
              />
            </div>

            {/* Fila 3: Especificaciones Físicas (Peso, Ancho, Alto, Largo) */}
            <div className="col-span-12 md:col-span-3">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Peso Unitario (kg)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full text-xs font-bold font-mono rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none transition hover:border-slate-300"
                required
              />
            </div>

            <div className="col-span-12 md:col-span-3">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Ancho (cm)</label>
              <input
                type="number"
                min="1"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full text-xs font-mono border border-slate-200 bg-white p-2.5 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 transition hover:border-slate-300"
                required
              />
            </div>

            <div className="col-span-12 md:col-span-3">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Alto (cm)</label>
              <input
                type="number"
                min="1"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full text-xs font-mono border border-slate-200 bg-white p-2.5 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 transition hover:border-slate-300"
                required
              />
            </div>

            <div className="col-span-12 md:col-span-3">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Largo (cm)</label>
              <input
                type="number"
                min="1"
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="w-full text-xs font-mono border border-slate-200 bg-white p-2.5 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 transition hover:border-slate-300"
                required
              />
            </div>

            {/* Fila 4: Comercial, Proveedor, Stock Inicial, Costo */}
            <div className="col-span-12 md:col-span-4">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Proveedor / Vendedor</label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Marca o socio logístico de suministro"
                className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none transition hover:border-slate-300"
              />
            </div>

            <div className="col-span-12 md:col-span-4">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Stock Inicial</label>
              <input
                type="number"
                min="0"
                value={initialQty}
                onChange={(e) => setInitialQty(Number(e.target.value))}
                className="w-full text-xs font-bold font-mono rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none transition hover:border-slate-300"
                required
              />
            </div>

            <div className="col-span-12 md:col-span-4">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Costo Unitario ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
                className="w-full text-xs font-bold font-mono rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none transition hover:border-slate-300"
                required
              />
            </div>

            {/* Fila 5: Descripción Breve e Imagen */}
            <div className="col-span-12 md:col-span-6 flex flex-col">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Descripción Breve</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Resumen breve de la funcionalidad o instrucciones de almacenamiento"
                rows={4}
                className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none resize-none transition hover:border-slate-300 grow"
              />
            </div>

            <div className="col-span-12 md:col-span-6 flex flex-col justify-between">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">URL de la Imagen de Miniatura del Producto</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="ej. https://images.unsplash.com/photo-... o URL de marcador de posición"
                    className="grow text-xs rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none font-mono transition hover:border-slate-300"
                  />
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const query = name ? name.trim() : sku ? sku.trim() : category;
                        const categoryLower = category.toLowerCase();
                        let selectedUrl = '';
                        if (categoryLower.includes('electr') || categoryLower.includes('electron')) {
                          selectedUrl = 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=150&h=150&q=80';
                        } else if (categoryLower.includes('peligro') || categoryLower.includes('hazmat') || categoryLower.includes('combust')) {
                          selectedUrl = 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&w=150&h=150&q=80';
                        } else if (categoryLower.includes('sensor') || categoryLower.includes('calib')) {
                          selectedUrl = 'https://images.unsplash.com/photo-1555664424-778a1e5e1b48?auto=format&fit=crop&w=150&h=150&q=80';
                        } else if (categoryLower.includes('cable') || categoryLower.includes('granel')) {
                          selectedUrl = 'https://images.unsplash.com/photo-1551703599-6b3dbb57c24e?auto=format&fit=crop&w=150&h=150&q=80';
                        } else if (categoryLower.includes('ropa') || categoryLower.includes('textil') || categoryLower.includes('apparel')) {
                          selectedUrl = 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=150&h=150&q=80';
                        } else {
                          selectedUrl = `https://picsum.photos/seed/${encodeURIComponent(query)}/150/150`;
                        }
                        setImageUrl(selectedUrl);
                      }}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold px-2.5 py-2 rounded-lg transition flex items-center gap-1 cursor-pointer active:scale-95"
                      title="Auto-generar URL de imagen basada en el nombre y categoría"
                    >
                      <span>✨ Auto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const seed = sku ? sku.trim().toUpperCase() : 'WMS';
                        setImageUrl(`https://picsum.photos/seed/${encodeURIComponent(seed)}/150/150`);
                      }}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-2 rounded-lg transition flex items-center gap-1 cursor-pointer active:scale-95"
                      title="Generar marcador de posición geométrico aleatorio directo"
                    >
                      <span>🎲 Semilla</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-2.5 rounded-xl shrink-0 mt-3">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Vista previa"
                    referrerPolicy="no-referrer"
                    className="h-11 w-11 object-cover rounded-lg border border-slate-200"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=150&h=150&q=80';
                    }}
                  />
                ) : (
                  <div className="h-11 w-11 rounded-lg border border-dashed border-slate-300 bg-slate-100 flex items-center justify-center text-slate-400">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-600">Vista Previa de Miniatura</span>
                  <span className="text-[9px] font-mono text-slate-400 truncate max-w-[200px] md:max-w-[300px]">
                    {imageUrl || 'Sin imagen cargada'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg cursor-pointer active:scale-98 transition flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>Registrar y Verificar Índice SKU</span>
            </button>
          </div>
        </form>
      )}

      {/* Grid Filtering options */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="grow relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar SKU, nombres, dimensiones..."
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50/20 pl-9 pr-16 py-2.5 text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
            <div className="absolute right-2 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  title="Limpiar búsqueda"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md border border-slate-200/55 select-none">
                {filteredProducts.length}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Dropdown Selector - highly useful for small screens */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-indigo-500" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs font-semibold rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    Category: {c}
                  </option>
                ))}
              </select>
            </div>

            {/* View Mode Toggle Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-bold transition shadow-2xs focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 shrink-0">
              {viewMode === 'grid' && <LayoutGrid className="h-4 w-4 text-indigo-500 shrink-0" />}
              {viewMode === 'table' && <List className="h-4 w-4 text-indigo-500 shrink-0" />}
              {viewMode === 'predictions' && <TrendingUp className="h-4 w-4 text-indigo-500 shrink-0" />}
              {viewMode === 'abc' && <Sliders className="h-4 w-4 text-amber-500 shrink-0" />}
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'table' | 'grid' | 'predictions' | 'abc')}
                className="text-xs font-bold text-slate-700 bg-transparent border-none focus:ring-0 focus:outline-none cursor-pointer pl-0.5 pr-2"
                title="Seleccionar el tipo de vista del inventario"
              >
                <option value="grid">Vista: Tarjetas</option>
                <option value="table">Vista: Tabla</option>
                <option value="predictions">Vista: Predicciones</option>
                <option value="abc">Vista: Clasificación ABC</option>
              </select>
            </div>

            <button
              onClick={() => handleExportExcel()}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-750 px-3.5 py-2 rounded-lg text-xs font-extrabold transition shadow-sm cursor-pointer active:scale-95 duration-150"
              title="Descargar la lista de stock actual filtrada como un archivo Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-100" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Dynamic Category Interactive Chips */}
        <div className="border-t border-slate-100/80 pt-3.5 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Filtro Rápido de Categorías</span>
              <span className="text-[10px] text-slate-400 font-medium">({categories.length - 1} activas)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowFilterConfig(!showFilterConfig)}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md border border-slate-200 transition cursor-pointer"
            >
              <Sliders className="h-3 w-3 text-slate-500" />
              <span>⚙️ {showFilterConfig ? 'Ocultar Ajustes' : 'Personalizar Vista'}</span>
            </button>
          </div>

          {/* Configuration Panel */}
          {showFilterConfig && (
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-xs space-y-3 animate-fade-in">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-700">Filtro Rápido: Mostrar / Ocultar Categorías</span>
                <span className="text-[10px] text-slate-400 font-medium">Marca para mostrar, desmarca para ocultar</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1.5 bg-white border border-slate-200 rounded-lg">
                {allAvailableCategories.map(cat => {
                  const isHidden = hiddenCategories.includes(cat);
                  return (
                    <label key={cat} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer transition">
                      <input 
                        type="checkbox"
                        checked={!isHidden}
                        onChange={() => {
                          if (isHidden) {
                            setHiddenCategories(hiddenCategories.filter(h => h !== cat));
                          } else {
                            setHiddenCategories([...hiddenCategories, cat]);
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span className="text-slate-700 font-medium truncate" title={cat}>{cat}</span>
                    </label>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Límite de chips visibles:</span>
                  <input 
                    type="number"
                    min={1}
                    max={50}
                    value={categoryFilterLimit}
                    onChange={(e) => setCategoryFilterLimit(Math.max(1, Number(e.target.value)))}
                    className="w-16 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[11px] text-slate-400 font-medium">(Colapsa el exceso bajo "Ver más")</span>
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setHiddenCategories([])}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded text-[10px] uppercase transition cursor-pointer"
                  >
                    Mostrar Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setHiddenCategories([...allAvailableCategories])}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded text-[10px] uppercase transition cursor-pointer"
                  >
                    Ocultar Todas
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Chips list */}
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
            {(isCategoryListExpanded ? categories : categories.slice(0, categoryFilterLimit)).map((c) => {
              const count = c === 'Todas' 
                ? inventory.length 
                : inventory.filter(item => item.category === c).length;
              const isActive = categoryFilter === c;
              
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoryFilter(c)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer select-none active:scale-95 border ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-350'
                  }`}
                >
                  <span>{c}</span>
                  <span className={`inline-flex items-center justify-center rounded-full text-[9px] px-1.5 py-0.5 font-bold font-mono ${
                    isActive 
                      ? 'bg-indigo-500 text-indigo-50' 
                      : 'bg-slate-200/60 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}

            {categories.length > categoryFilterLimit && (
              <button
                type="button"
                onClick={() => setIsCategoryListExpanded(!isCategoryListExpanded)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer select-none active:scale-95 border bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200"
              >
                <span>{isCategoryListExpanded ? 'Mostrar menos ▴' : `Ver más (+${categories.length - categoryFilterLimit}) ▾`}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main product sku catalogue */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 overflow-hidden">
        <div className="overflow-x-auto">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400 font-medium">
              No product SKUs found matching query search parameters.
            </div>
          ) : viewMode === 'table' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  <th className="pb-3 text-left">SKU CODE / BRAND DETAILS</th>
                  <th className="pb-3 text-center">CÓDIGO DE BARRAS</th>
                  <th className="pb-3 text-center">SAFETY CATEGORY</th>
                  <th className="pb-3 text-center">UNIT COST</th>
                  <th className="pb-3 text-center">CURRENT WAREHOUSE STOCK</th>
                  <th className="pb-3 text-center">PHYSICAL LOAD PRESETS</th>
                  <th className="pb-3 text-center">SAFETY MARGINS</th>
                  <th className="pb-3 text-right">OPERATIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {filteredProducts.map((item) => {
                  const isReplenishing = item.qty <= item.minQty;
                  const isLowStock = item.qty < (item.minQty || 0);
                  const isOutOfStock = item.qty === 0;
                  return (
                    <tr key={item.sku} className={`hover:bg-slate-50/50 transition-colors ${
                      isOutOfStock 
                        ? 'bg-rose-50/10' 
                        : isLowStock 
                        ? 'bg-amber-50/10' 
                        : ''
                    }`}>
                      
                      {/* SKU / Details */}
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setAssigningImageSku(item.sku)}
                            className="h-10 w-10 rounded-lg bg-slate-50 border border-slate-150 flex items-center justify-center overflow-hidden shrink-0 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100 transition cursor-pointer"
                            title="Click to assign placeholder or change image"
                          >
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=150&h=150&q=80';
                                }}
                              />
                            ) : (
                              <div className="relative group/thumb flex items-center justify-center w-full h-full">
                                <ImageIcon className="h-4 w-4 text-slate-300 stroke-[1.5] group-hover/thumb:text-indigo-500 transition" />
                                <span className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover/thumb:opacity-100 transition flex items-center justify-center text-[8px] font-bold text-indigo-650">
                                  +
                                </span>
                              </div>
                            )}
                          </button>
                          <div>
                            <span className="font-mono font-black text-slate-800 text-xs select-all block">
                              {item.sku}
                            </span>
                            <span className="block font-sans text-xs text-slate-600 font-bold mt-0.5">
                              {item.name}
                            </span>
                            <span className="block font-sans text-[10px] text-slate-400 font-normal mt-0.5 max-w-sm overflow-hidden text-ellipsis line-clamp-1">
                              {item.description || 'No description listed'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Barcode Display */}
                      <td className="py-4 text-center">
                        <span className="font-mono tracking-widest text-[11px] text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded block max-w-[140px] mx-auto text-center" title="Codebar Index">
                          |||| {item.barcode || 'NO_BARCODE'}
                        </span>
                      </td>

                      {/* Safety Category */}
                      <td className="py-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                          item.category === 'Hazmat' ? 'bg-amber-50 border-amber-200 text-amber-700 font-semibold' :
                          item.category === 'Electronics' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                          'bg-slate-50 border-slate-200 text-slate-600'
                        }`}>
                          {item.category}
                        </span>
                      </td>

                      {/* Unit Cost */}
                      <td className="py-4 text-center font-mono font-bold text-slate-700">
                        ${(item.cost || 0).toFixed(2)}
                      </td>

                      {/* Current Warehouse Stock */}
                      <td className="py-4 text-center">
                        {inlineEditSku === item.sku ? (
                          <div className="flex flex-col items-center gap-1.5 p-1.5 bg-indigo-50/70 rounded-xl border border-indigo-200 animate-fade-in max-w-[145px] mx-auto shadow-xs">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setInlineEditValue(prev => Math.max(0, prev - 1))}
                                className="w-5 h-5 rounded bg-white border border-slate-250 text-slate-700 hover:bg-slate-50 flex items-center justify-center font-bold text-xs cursor-pointer active:scale-90 select-none"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={inlineEditValue}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  setInlineEditValue(isNaN(val) ? 0 : Math.max(0, val));
                                }}
                                className="w-14 text-center text-xs font-bold font-mono bg-white border border-slate-250 rounded px-1 py-0.5 focus:outline-none focus:border-indigo-500"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveInlineQty(item.sku);
                                  } else if (e.key === 'Escape') {
                                    setInlineEditSku(null);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => setInlineEditValue(prev => prev + 1)}
                                className="w-5 h-5 rounded bg-white border border-slate-250 text-slate-700 hover:bg-slate-50 flex items-center justify-center font-bold text-xs cursor-pointer active:scale-90 select-none"
                              >
                                +
                              </button>
                            </div>

                            <div className="flex gap-2 text-[9px] w-full px-1 justify-between text-slate-500 font-mono font-bold select-none">
                              <button
                                type="button"
                                onClick={() => setInlineEditValue(prev => Math.max(0, prev - 10))}
                                className="hover:text-indigo-600 transition"
                              >
                                -10
                              </button>
                              <button
                                type="button"
                                onClick={() => setInlineEditValue(prev => prev + 10)}
                                className="hover:text-indigo-600 transition"
                              >
                                +10
                              </button>
                            </div>

                            <div className="flex items-center justify-between gap-1 border-t border-indigo-100 pt-1.5 w-full">
                              <button
                                type="button"
                                onClick={() => setInlineEditSku(null)}
                                className="px-1.5 py-0.5 rounded text-[8px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveInlineQty(item.sku)}
                                className="px-1.5 py-0.5 rounded text-[8px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer flex items-center gap-0.5"
                              >
                                <Check className="h-2.5 w-2.5" />
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group flex flex-col items-center">
                            <div className="flex items-center gap-1.5 justify-center">
                              <span 
                                onClick={() => {
                                  setInlineEditSku(item.sku);
                                  setInlineEditValue(item.qty);
                                }}
                                className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold font-mono tracking-wide cursor-pointer hover:ring-2 hover:ring-indigo-300 transition-all ${
                                  isReplenishing 
                                    ? 'bg-rose-50 text-rose-600 border border-rose-100 font-bold animate-pulse' 
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                }`}
                                title="Click to edit quantity inline"
                              >
                                {item.qty} units
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setInlineEditSku(item.sku);
                                  setInlineEditValue(item.qty);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 cursor-pointer"
                                title="Edit count inline"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                              </button>
                            </div>
                            {isReplenishing && (
                              <span className="block text-[8px] text-rose-500 font-extrabold font-sans uppercase mt-1 tracking-wider">
                                Replenishment lock
                              </span>
                            )}
                            {!isReadOnly && (
                              <div className="flex items-center justify-center gap-1 mt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const amtStr = prompt(`Subtract stock from ${item.sku}. Enter amount:`, "10");
                                    if (amtStr !== null) {
                                      const val = parseInt(amtStr, 10);
                                      if (!isNaN(val) && val > 0) {
                                        if (item.qty - val < 0) {
                                          alert("Inventory quantity cannot be negative.");
                                        } else {
                                          onUpdateInventoryQty?.(item.sku, item.qty - val);
                                        }
                                      }
                                    }
                                  }}
                                  className="bg-slate-100 hover:bg-rose-100 text-rose-700 border border-slate-200 hover:border-rose-300 text-[9px] font-bold px-1.5 py-0.5 rounded transition uppercase tracking-wider"
                                >
                                  - Stock
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const amtStr = prompt(`Add stock to ${item.sku}. Enter amount:`, "10");
                                    if (amtStr !== null) {
                                      const val = parseInt(amtStr, 10);
                                      if (!isNaN(val) && val > 0) {
                                        onUpdateInventoryQty?.(item.sku, item.qty + val);
                                      }
                                    }
                                  }}
                                  className="bg-slate-100 hover:bg-emerald-100 text-emerald-700 border border-slate-200 hover:border-emerald-300 text-[9px] font-bold px-1.5 py-0.5 rounded transition uppercase tracking-wider"
                                >
                                  + Stock
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Dimensions Height / Weight */}
                      <td className="py-4 text-center font-mono text-[10px] text-slate-500">
                        <div className="font-semibold text-slate-700">{item.unitWeight} kg</div>
                        <div className="text-[9px] mt-0.5">{item.unitWidth}x{item.unitHeight}x{item.unitLength} cm</div>
                      </td>

                      {/* Replenishment threshold margins */}
                      <td className="py-4 text-center font-mono text-[10px] text-slate-500">
                        <div>Min limit: <strong className="text-slate-600">{item.minQty}</strong></div>
                        {isOutOfStock ? (
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[8px] font-extrabold uppercase tracking-wider animate-pulse">
                            Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[8px] font-extrabold uppercase tracking-wider animate-pulse">
                            Low Stock
                          </span>
                        ) : null}
                        {item.expirationDate && (
                          <div className="text-[9px] text-amber-600 font-sans font-semibold mt-0.5">
                            ⏳ Exp: {new Date(item.expirationDate).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Delete command column */}
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedHistorySku(item.sku);
                              trendSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className={`transition p-1.5 rounded-lg ${
                              activeSku === item.sku 
                                ? 'text-indigo-600 bg-indigo-50 font-bold' 
                                : 'text-slate-300 hover:text-indigo-600 hover:bg-indigo-50'
                            }`}
                            title="Analyze SKU Stock Level Trend History"
                          >
                            <TrendingUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedQrSku(item.sku);
                              setQrValueType('sku');
                            }}
                            className="text-slate-300 hover:text-indigo-600 transition p-1.5 rounded-lg hover:bg-indigo-50"
                            title="Generar Código QR de SKU"
                          >
                            <QrCode className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setAssigningImageSku(item.sku)}
                            className={`transition p-1.5 rounded-lg ${
                              item.imageUrl
                                ? 'text-slate-300 hover:text-emerald-600 hover:bg-emerald-50'
                                : 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 animate-pulse'
                            }`}
                            title={item.imageUrl ? "Update SKU Image" : "Assign Placeholder Image"}
                          >
                            <ImageIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setPrintSku(item.sku);
                              setPrintCopies(5);
                            }}
                            className="text-slate-300 hover:text-blue-600 transition p-1.5 rounded-lg hover:bg-blue-50"
                            title="Imprimir Etiquetas de Material"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          {!isReadOnly && (
                            <button
                              onClick={() => triggerDeleteSku(item.sku)}
                              className="text-slate-300 hover:text-rose-600 transition p-1.5 rounded-lg hover:bg-rose-50"
                              title="Delete SKU Index Link"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 py-2">
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((item) => {
                  const isReplenishing = item.qty <= item.minQty;
                  const isLowStock = item.qty < (item.minQty || 0);
                  const isOutOfStock = item.qty === 0;
                  
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -15 }}
                      transition={{ 
                        type: 'spring', 
                        stiffness: 300, 
                        damping: 25,
                        opacity: { duration: 0.2 }
                      }}
                      key={item.sku}
                      className={`group bg-white rounded-xl border transition-shadow duration-200 overflow-hidden hover:shadow-md flex flex-col ${
                        isOutOfStock
                          ? 'border-rose-200 bg-rose-50/5'
                          : isLowStock
                          ? 'border-amber-200 bg-amber-50/5'
                          : 'border-slate-100'
                      }`}
                    >
                    {/* Image Header with Badge */}
                    <div className="relative h-44 bg-slate-50 border-b border-slate-100 flex items-center justify-center overflow-hidden">
                      {item.imageUrl ? (
                        <>
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-305"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=150&h=150&q=80';
                            }}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setAssigningImageSku(item.sku);
                            }}
                            className="absolute bottom-2.5 right-2.5 bg-white/90 hover:bg-white text-slate-700 hover:text-indigo-600 shadow-xs p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 opacity-0 group-hover:opacity-100 cursor-pointer border border-slate-200/50 z-10"
                            title="Change Image / Assign Placeholder"
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAssigningImageSku(item.sku)}
                          className="flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50/20 w-full h-full gap-2 transition cursor-pointer group/placeholder select-none"
                          title="Haga clic para asignar una imagen de marcador logística estándar"
                        >
                          <div className="p-2.5 bg-white rounded-full border border-slate-200 shadow-2xs group-hover/placeholder:scale-110 transition duration-200 group-hover/placeholder:border-indigo-300">
                            <ImageIcon className="h-5 w-5 text-slate-400 group-hover/placeholder:text-indigo-500" />
                          </div>
                          <div className="text-center space-y-0.5">
                            <span className="block text-[10px] font-bold font-mono uppercase tracking-wider text-slate-400 group-hover/placeholder:text-indigo-600">Sin Foto Vinculada</span>
                            <span className="block text-[9px] text-slate-400/80 font-semibold group-hover/placeholder:text-indigo-500 underline decoration-indigo-200">Asignar Marcador</span>
                          </div>
                        </button>
                      )}
                      
                      {/* Category Pill */}
                      <span className="absolute top-2.5 left-2.5 bg-slate-900/85 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider select-none">
                        {item.category}
                      </span>

                      {/* Stock Level Badge */}
                      <span className={`absolute top-2.5 right-2.5 text-[9px] font-bold px-2 py-0.5 rounded-md border shadow-xs select-none ${
                        isOutOfStock
                          ? 'bg-rose-500 text-white border-rose-500'
                          : isLowStock
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {isOutOfStock ? 'OUT OF STOCK' : isLowStock ? 'LOW STOCK ALERT' : 'IN STOCK'}
                      </span>
                    </div>

                    {/* Card Content */}
                    <div className="p-4 flex-grow flex flex-col justify-between">
                      <div>
                        {/* SKU Tag & Cost */}
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-mono font-bold text-slate-400 tracking-wider">
                            {item.sku}
                          </span>
                          {item.cost !== undefined && (
                            <span className="text-xs font-bold text-slate-600 font-mono">
                              ${item.cost.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* Title & Description */}
                        <h3 className="text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition">
                          {item.name}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-1 mb-2 line-clamp-2 leading-relaxed">
                          {item.description || 'No descriptive summary provided.'}
                        </p>

                        {/* Low Stock Highlight Badge */}
                        {(isLowStock || isOutOfStock) && (
                          <div className={`mb-4 px-2.5 py-2 rounded-xl text-[10.5px] font-bold flex items-center gap-2 border shadow-xs select-none ${
                            isOutOfStock 
                              ? 'bg-rose-50/80 border-rose-200/60 text-rose-800' 
                              : 'bg-amber-50/80 border-amber-200/60 text-amber-800'
                          }`}>
                            <div className="relative flex h-2 w-2 shrink-0">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                isOutOfStock ? 'bg-rose-500' : 'bg-amber-500'
                              }`}></span>
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                                isOutOfStock ? 'bg-rose-600' : 'bg-amber-600'
                              }`}></span>
                            </div>
                            <div className="flex-1 leading-tight text-left">
                              <span className="block uppercase tracking-wider text-[9px] font-extrabold">
                                {isOutOfStock ? 'CRITICAL OUT OF STOCK' : 'LOW STOCK WARNING'}
                              </span>
                              <span className="font-normal text-[9.5px] text-slate-500 block mt-0.5">
                                Stock ({item.qty}) is below safety threshold ({item.minQty}).
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Warehouse Metadata */}
                      <div className="space-y-3 pt-3 border-t border-slate-100/60">
                        {/* Dynamic Inline Stock Adjuster */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Qty in Stock:</span>
                          
                          {inlineEditSku === item.sku ? (
                            <div className="flex flex-col items-center gap-1.5 p-1.5 bg-indigo-50/75 rounded-xl border border-indigo-200 w-full animate-fade-in shadow-xs">
                              <div className="flex items-center gap-1 w-full justify-center">
                                <button
                                  type="button"
                                  onClick={() => setInlineEditValue(prev => Math.max(0, prev - 1))}
                                  className="w-5 h-5 rounded bg-white border border-slate-250 text-slate-750 hover:bg-slate-50 flex items-center justify-center font-bold text-xs cursor-pointer active:scale-90 select-none"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  value={inlineEditValue}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    setInlineEditValue(isNaN(val) ? 0 : Math.max(0, val));
                                  }}
                                  className="w-14 text-center text-xs font-bold font-mono bg-white border border-slate-250 rounded px-1 py-0.5 focus:outline-none focus:border-indigo-500"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSaveInlineQty(item.sku);
                                    } else if (e.key === 'Escape') {
                                      setInlineEditSku(null);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => setInlineEditValue(prev => prev + 1)}
                                  className="w-5 h-5 rounded bg-white border border-slate-250 text-slate-750 hover:bg-slate-50 flex items-center justify-center font-bold text-xs cursor-pointer active:scale-90 select-none"
                                >
                                  +
                                </button>
                              </div>

                              <div className="flex gap-2 text-[9px] w-full px-1 justify-between text-slate-500 font-mono font-bold select-none">
                                <button
                                  type="button"
                                  onClick={() => setInlineEditValue(prev => Math.max(0, prev - 10))}
                                  className="hover:text-indigo-600 transition"
                                >
                                  -10
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInlineEditValue(prev => prev + 10)}
                                  className="hover:text-indigo-600 transition"
                                >
                                  +10
                                </button>
                              </div>

                              <div className="flex items-center justify-between gap-1 border-t border-indigo-100 pt-1.5 w-full">
                                <button
                                  type="button"
                                  onClick={() => setInlineEditSku(null)}
                                  className="px-1.5 py-0.5 rounded text-[8px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveInlineQty(item.sku)}
                                  className="px-1.5 py-0.5 rounded text-[8px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer flex items-center gap-0.5"
                                >
                                  <Check className="h-2.5 w-2.5" />
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <div
                                onClick={() => {
                                  if (isReadOnly) return;
                                  setInlineEditSku(item.sku);
                                  setInlineEditValue(item.qty);
                                }}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold font-mono ${isReadOnly ? '' : 'cursor-pointer'} select-none transition ${
                                  isOutOfStock
                                    ? 'bg-rose-100 text-rose-750 hover:bg-rose-200'
                                    : isLowStock
                                    ? 'bg-amber-100 text-amber-750 hover:bg-amber-200'
                                    : 'bg-indigo-50 text-indigo-750 hover:bg-indigo-100'
                                }`}
                                title={isReadOnly ? "Cantidad de stock" : "Click to quickly edit quantity count inline"}
                              >
                                <span>{item.qty}</span>
                                <span className="text-[9px] opacity-70">units</span>
                                {!isReadOnly && <Sliders className="h-2.5 w-2.5 opacity-60 ml-0.5" />}
                              </div>
                              
                              {!isReadOnly && (
                                <>
                                  <button
                                    onClick={() => {
                                      const amtStr = prompt(`Subtract stock from ${item.sku}. Enter amount:`, "10");
                                      if (amtStr !== null) {
                                        const val = parseInt(amtStr, 10);
                                        if (!isNaN(val) && val > 0) {
                                          if (item.qty - val < 0) {
                                            alert("Inventory quantity cannot be negative.");
                                          } else {
                                            onUpdateInventoryQty?.(item.sku, item.qty - val);
                                          }
                                        }
                                      }
                                    }}
                                    className="bg-slate-100 hover:bg-rose-100 text-rose-700 border border-slate-200 hover:border-rose-300 text-[9px] font-bold px-1.5 py-0.5 rounded transition"
                                    title="Decrease stock"
                                  >
                                    -
                                  </button>
                                  <button
                                    onClick={() => {
                                      const amtStr = prompt(`Add stock to ${item.sku}. Enter amount:`, "10");
                                      if (amtStr !== null) {
                                        const val = parseInt(amtStr, 10);
                                        if (!isNaN(val) && val > 0) {
                                          onUpdateInventoryQty?.(item.sku, item.qty + val);
                                        }
                                      }
                                    }}
                                    className="bg-slate-100 hover:bg-emerald-100 text-emerald-700 border border-slate-200 hover:border-emerald-300 text-[9px] font-bold px-1.5 py-0.5 rounded transition"
                                    title="Increase stock"
                                  >
                                    +
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Safety margins visual progress */}
                        <div className="w-full">
                          <div className="flex justify-between text-[9px] text-slate-400 mb-1 font-mono">
                            <span>Min margin: {item.minQty}</span>
                            <span>{Math.round((item.qty / (item.minQty || 1)) * 100)}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                item.qty === 0 ? 'bg-rose-500 w-0' :
                                isReplenishing ? 'bg-amber-500' : 'bg-emerald-500'
                              }`} 
                              style={{ width: `${Math.min(100, (item.qty / (item.minQty || 1)) * 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Specs Grid */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <div className="col-span-2 flex justify-between">
                            <span className="text-slate-400 font-medium">Código de Barras:</span>
                            <span className="font-mono font-bold text-slate-700">{item.barcode || 'N/A'}</span>
                          </div>
                          <div className="col-span-2 flex justify-between">
                            <span className="text-slate-400 font-medium">Dimensiones:</span>
                            <span className="font-mono font-bold text-slate-700">
                              {item.unitWidth}×{item.unitHeight}×{item.unitLength} cm
                            </span>
                          </div>
                          <div className="flex justify-between col-span-2">
                            <span className="text-slate-400 font-medium">Peso:</span>
                            <span className="font-mono font-bold text-slate-700">{item.unitWeight} kg</span>
                          </div>
                          {item.supplier && (
                            <div className="col-span-2 border-t border-slate-150 pt-1.5 mt-1">
                              <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider mb-0.5">Marca del Proveedor</span>
                              <span className="font-bold text-slate-700 block line-clamp-1">{item.supplier}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions Panel Footer */}
                    <div className="bg-slate-50/80 border-t border-slate-100 px-4 py-2.5 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedQrSku(item.sku)}
                          className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 font-bold px-2 py-1 rounded text-[10px] transition cursor-pointer flex items-center gap-1"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          <span>Labels QR</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedHistorySku(item.sku);
                            trendSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className={`font-bold px-2 py-1 rounded text-[10px] transition cursor-pointer flex items-center gap-1 ${
                            activeSku === item.sku 
                              ? 'text-indigo-700 bg-indigo-100/60 border border-indigo-200' 
                              : 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50/80'
                          }`}
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span>View Trend</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setPrintSku(item.sku);
                            setPrintCopies(5);
                          }}
                          className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition"
                          title="Print Shipping Labels"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        {!isReadOnly && (
                          <button
                            onClick={() => triggerDeleteSku(item.sku)}
                            className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition"
                            title="Delete SKU Index Link"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : viewMode === 'predictions' ? (
            <div className="space-y-6 py-2">
              {/* Tarjetas de Resumen Predictivo */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">SKUs Analizados</span>
                    <span className="text-xl font-black font-mono text-slate-800">{predictions.length}</span>
                  </div>
                </div>
                
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                    <ShieldAlert className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">Críticos (Inmediato)</span>
                    <span className="text-xl font-black font-mono text-rose-600">
                      {predictions.filter(p => p.status === 'critical').length}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                    <Sliders className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">En Advertencia</span>
                    <span className="text-xl font-black font-mono text-amber-600">
                      {predictions.filter(p => p.status === 'warning').length}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                    <Check className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">Estables / Seguros</span>
                    <span className="text-xl font-black font-mono text-emerald-600">
                      {predictions.filter(p => p.status === 'healthy').length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Panel Informativo */}
              <div className="bg-indigo-50/50 border border-indigo-100/60 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider font-mono">¿Cómo funciona este modelo predictivo?</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed max-w-3xl">
                    Nuestra fórmula estima el consumo diario analizando órdenes <strong className="text-indigo-800">Outbound completadas</strong> y deducciones en el <strong className="text-indigo-800">historial de logs</strong>. Si un artículo carece de historial, se calcula una estimación nominal basada en su código SKU. Al restar el stock actual del nivel crítico, determinamos con precisión matemática la fecha de agotamiento antes de rebasar tus límites de seguridad.
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
                  <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase tracking-wider">Análisis en Tiempo Real Activo</span>
                </div>
              </div>

              {/* Listado Interactivo */}
              <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                        <th className="py-3.5 px-4">SKU / Producto</th>
                        <th className="py-3.5 px-4 text-center">Stock / Mínimo</th>
                        <th className="py-3.5 px-4 text-center">Consumo Total</th>
                        <th className="py-3.5 px-4 text-center">Tasa Diaria</th>
                        <th className="py-3.5 px-4 text-center">Fórmula Utilizada</th>
                        <th className="py-3.5 px-4 text-center">Reabastecimiento Sugerido</th>
                        <th className="py-3.5 px-4 text-center">Urgencia</th>
                        <th className="py-3.5 px-4 text-right">Acciones de Reabastecimiento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {predictions.map((p) => {
                        const ratio = Math.min(100, (p.qty / (p.minQty || 1)) * 100);
                        return (
                          <tr key={p.sku} className={`hover:bg-slate-50/40 transition-colors ${
                            p.status === 'critical' ? 'bg-rose-50/15' : p.status === 'warning' ? 'bg-amber-50/15' : ''
                          }`}>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded bg-slate-50 border border-slate-150 flex items-center justify-center overflow-hidden shrink-0">
                                  {p.imageUrl ? (
                                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                                  ) : (
                                    <Package className="h-4.5 w-4.5 text-slate-400" />
                                  )}
                                </div>
                                <div>
                                  <span className="font-mono font-black text-slate-800 text-xs select-all block leading-none">{p.sku}</span>
                                  <span className="font-sans text-[11px] text-slate-500 font-bold block mt-1 leading-none">{p.name}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex flex-col items-center">
                                <span className="font-mono font-bold text-slate-700">
                                  {p.qty} <span className="text-slate-400 font-normal">/ {p.minQty} ud</span>
                                </span>
                                <div className="w-16 bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all ${
                                      p.qty === 0 ? 'bg-rose-500 w-0' :
                                      p.qty <= p.minQty ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`} 
                                    style={{ width: `${ratio}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-650">
                              {p.totalConsumed} uds
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono font-bold text-indigo-600">
                              {p.dailyRate.toFixed(2)} <span className="text-[9.5px] font-normal text-slate-400">/ día</span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {p.isCalculated ? (
                                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-wider">
                                  Historial Real
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 font-bold px-2.5 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-wider" title="Estimación nominal basada en identificador SKU">
                                  Nominal Sugerido
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center font-bold">
                              <span className={`font-mono text-xs ${
                                p.status === 'critical' ? 'text-rose-600 font-black' : p.status === 'warning' ? 'text-amber-600' : 'text-slate-800'
                              }`}>{p.suggestedDateStr}</span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {p.status === 'critical' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-100 text-rose-800 uppercase tracking-wider font-mono animate-pulse">
                                  Crítico
                                </span>
                              ) : p.status === 'warning' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-100 text-amber-800 uppercase tracking-wider font-mono">
                                  Próximo
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 uppercase tracking-wider font-mono">
                                  Saludable
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={async () => {
                                  const amountStr = prompt(`Registrar pedido de reabastecimiento para ${p.sku}. Ingrese cantidad a sumar al stock:`, "50");
                                  if (amountStr !== null) {
                                    const val = parseInt(amountStr, 10);
                                    if (!isNaN(val) && val > 0) {
                                      await onUpdateInventoryQty?.(p.sku, p.qty + val);
                                    }
                                  }
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition text-white text-[10px] font-bold px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 shadow-2xs cursor-pointer select-none"
                              >
                                <Plus className="h-3 w-3" />
                                <span>Reabastecer</span>
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
          ) : (
            <div className="space-y-6 py-2">
              {/* ABC Analysis Explanatory Panel & Simulator */}
              <div className="bg-slate-50 border border-slate-150 rounded-2xl p-6">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                  <div className="space-y-2 max-w-2xl">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                      <Sliders className="h-4.5 w-4.5 text-amber-500" />
                      Optimizador de Ranurado de Almacén (Slotting) mediante Análisis ABC
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Esta herramienta clasifica automáticamente los SKUs según la regla de Pareto (80/20) combinando la 
                      <strong> frecuencia de salida (demanda)</strong> y su <strong>valor de stock</strong>. Úsela para reorganizar 
                      físicamente las ubicaciones de estanterías, reduciendo recorridos de picking e incrementando la productividad.
                    </p>
                  </div>

                  <div className="shrink-0">
                    <button
                      onClick={handleRunAbcOptimization}
                      disabled={isSimulatingAbcOptimization}
                      className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition text-white text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-sm cursor-pointer select-none"
                    >
                      {isSimulatingAbcOptimization ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/45 border-t-white" />
                          <span>Simulando Ranurado...</span>
                        </>
                      ) : (
                        <>
                          <Boxes className="h-4 w-4 text-indigo-200" />
                          <span>Optimizar Ubicaciones</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {isSimulatingAbcOptimization && (
                  <div className="mt-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-indigo-600 animate-ping" />
                      <span className="text-xs text-indigo-700 font-bold">
                        Calculando matriz de distancias y reorganizando la asignación de racks basada en la tasa de consumo de SKUs...
                      </span>
                    </div>
                  </div>
                )}

                {optimizationSuccessMsg && (
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-800 text-xs font-semibold leading-relaxed flex items-start gap-2.5 animate-fade-in">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-extrabold text-emerald-900 mb-0.5">¡Reorganización Exitosa de Ranuras!</p>
                      <p>{optimizationSuccessMsg}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ABC Categories Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Zona A */}
                <div className="bg-gradient-to-br from-indigo-50/40 to-indigo-50/10 border border-indigo-100 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest block font-mono">Clase A</span>
                      <h4 className="text-sm font-black text-indigo-950 uppercase leading-none">Alta Rotación</h4>
                    </div>
                    <span className="text-xs font-black font-mono bg-indigo-100 text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-lg">
                      {abcStats.aCount} SKUs
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-medium">Contribución de Valor:</span>
                      <span className="font-bold text-indigo-700 font-mono">{abcStats.aValuePercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-full" style={{ width: `${abcStats.aValuePercent}%` }} />
                    </div>
                  </div>

                  <div className="border-t border-indigo-100/50 pt-3.5 space-y-1.5 text-[11px]">
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px] font-mono">Estrategia de Ubicación</span>
                    <p className="text-indigo-950 font-extrabold">Nivel Inferior (Bahías 1-3) - Acceso Inmediato</p>
                    <p className="text-slate-500 leading-relaxed">
                      Colocar al nivel del suelo y cerca de las puertas de despacho para reducir la fatiga en el picking diario.
                    </p>
                  </div>
                </div>

                {/* Zona B */}
                <div className="bg-gradient-to-br from-amber-50/40 to-amber-50/10 border border-amber-100 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest block font-mono">Clase B</span>
                      <h4 className="text-sm font-black text-amber-950 uppercase leading-none">Rotación Media</h4>
                    </div>
                    <span className="text-xs font-black font-mono bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg">
                      {abcStats.bCount} SKUs
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-medium">Contribución de Valor:</span>
                      <span className="font-bold text-amber-700 font-mono">{abcStats.bValuePercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full" style={{ width: `${abcStats.bValuePercent}%` }} />
                    </div>
                  </div>

                  <div className="border-t border-amber-100/50 pt-3.5 space-y-1.5 text-[11px]">
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px] font-mono">Estrategia de Ubicación</span>
                    <p className="text-amber-950 font-extrabold">Nivel Medio (Bahías 4-6) - Estantería Central</p>
                    <p className="text-slate-500 leading-relaxed">
                      Ubicar a la altura de la cintura o estanterías medias. Requiere un esfuerzo medio de movilización.
                    </p>
                  </div>
                </div>

                {/* Zona C */}
                <div className="bg-gradient-to-br from-slate-100/40 to-slate-100/10 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">Clase C</span>
                      <h4 className="text-sm font-black text-slate-950 uppercase leading-none">Baja Rotación</h4>
                    </div>
                    <span className="text-xs font-black font-mono bg-slate-200 text-slate-800 border border-slate-200/60 px-2.5 py-1 rounded-lg">
                      {abcStats.cCount} SKUs
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-medium">Contribución de Valor:</span>
                      <span className="font-bold text-slate-700 font-mono">{abcStats.cValuePercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-slate-400 h-full" style={{ width: `${abcStats.cValuePercent}%` }} />
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3.5 space-y-1.5 text-[11px]">
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px] font-mono">Estrategia de Ubicación</span>
                    <p className="text-slate-950 font-extrabold">Nivel Superior (Bahías 7-9) o Zona Profunda</p>
                    <p className="text-slate-500 leading-relaxed">
                      Ubicar en estantes superiores o al fondo del almacén. Libera las zonas accesibles para productos críticos.
                    </p>
                  </div>
                </div>
              </div>

              {/* SKU List and Filters */}
              <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/40">
                  {/* Category filter tabs */}
                  <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60 w-fit">
                    <button
                      onClick={() => setAbcCategoryTab('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                        abcCategoryTab === 'all' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Todos ({abcStats.totalItems})
                    </button>
                    <button
                      onClick={() => setAbcCategoryTab('A')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none flex items-center gap-1.5 ${
                        abcCategoryTab === 'A' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-indigo-600'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                      Clase A ({abcStats.aCount})
                    </button>
                    <button
                      onClick={() => setAbcCategoryTab('B')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none flex items-center gap-1.5 ${
                        abcCategoryTab === 'B' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-amber-600'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Clase B ({abcStats.bCount})
                    </button>
                    <button
                      onClick={() => setAbcCategoryTab('C')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none flex items-center gap-1.5 ${
                        abcCategoryTab === 'C' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-600'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      Clase C ({abcStats.cCount})
                    </button>
                  </div>

                  {/* Sort filters */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold shrink-0">
                    <span>Ordenar por:</span>
                    <select
                      value={abcSortKey}
                      onChange={(e) => setAbcSortKey(e.target.value as any)}
                      className="border border-slate-200 rounded-lg p-1.5 text-xs bg-white text-slate-700 focus:outline-none focus:border-indigo-500 font-bold"
                    >
                      <option value="score">Puntuación ABC</option>
                      <option value="demand">Frecuencia de Salidas</option>
                      <option value="stock">Valor de Stock</option>
                      <option value="cost">Costo de Unidad</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                        <th className="py-3 px-4">SKU / Producto</th>
                        <th className="py-3 px-4 text-center">Clasificación</th>
                        <th className="py-3 px-4 text-center">Costo Unitario</th>
                        <th className="py-3 px-4 text-center">Frecuencia / Demanda</th>
                        <th className="py-3 px-4 text-center">Stock Actual</th>
                        <th className="py-3 px-4 text-center">Valor de Stock</th>
                        <th className="py-3 px-4 text-center">Puntaje de Importancia</th>
                        <th className="py-3 px-4 text-left">Recomendación de Slotting</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs">
                      {(() => {
                        let list = abcAnalysis;
                        if (abcCategoryTab === 'A') list = list.filter(i => i.categoryLetter === 'A');
                        if (abcCategoryTab === 'B') list = list.filter(i => i.categoryLetter === 'B');
                        if (abcCategoryTab === 'C') list = list.filter(i => i.categoryLetter === 'C');

                        // Sort list
                        list = [...list].sort((a, b) => {
                          if (abcSortKey === 'score') return b.compositeScore - a.compositeScore;
                          if (abcSortKey === 'demand') return b.totalConsumed - a.totalConsumed;
                          if (abcSortKey === 'stock') return b.stockValue - a.stockValue;
                          if (abcSortKey === 'cost') return (b.cost || 0) - (a.cost || 0);
                          return 0;
                        });

                        if (list.length === 0) {
                          return (
                            <tr>
                              <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                                No hay SKUs para esta categoría en este momento.
                              </td>
                            </tr>
                          );
                        }

                        return list.map((item) => {
                          const percentageOfTotal = abcStats.totalStockValue > 0 ? (item.stockValue / abcStats.totalStockValue) * 100 : 0;
                          return (
                            <tr
                              key={item.sku}
                              className={`hover:bg-slate-50/40 transition-colors cursor-pointer ${
                                selectedAbcSku === item.sku ? 'bg-indigo-50/30' : ''
                              }`}
                              onClick={() => setSelectedAbcSku(selectedAbcSku === item.sku ? null : item.sku)}
                            >
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded bg-slate-50 border border-slate-150 flex items-center justify-center overflow-hidden shrink-0">
                                    {item.imageUrl ? (
                                      <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                                    ) : (
                                      <Package className="h-4.5 w-4.5 text-slate-400" />
                                    )}
                                  </div>
                                  <div>
                                    <span className="font-mono font-black text-slate-800 select-all block leading-none">{item.sku}</span>
                                    <span className="font-sans text-[11px] text-slate-500 font-bold block mt-1 leading-none">{item.name}</span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 text-center">
                                {item.categoryLetter === 'A' ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wider font-mono">
                                    Categoría A
                                  </span>
                                ) : item.categoryLetter === 'B' ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider font-mono">
                                    Categoría B
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider font-mono">
                                    Categoría C
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-600">
                                ${item.cost?.toFixed(2) || '25.00'}
                              </td>

                              <td className="py-3.5 px-4 text-center font-mono font-bold text-indigo-600">
                                {item.totalConsumed} uds
                              </td>

                              <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                                {item.qty} uds
                              </td>

                              <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-850">
                                <div>${item.stockValue.toFixed(2)}</div>
                                <div className="text-[9px] text-slate-400 font-normal">({percentageOfTotal.toFixed(1)}% del valor)</div>
                              </td>

                              <td className="py-3.5 px-4 text-center font-mono text-xs">
                                <span className="font-black text-slate-800">{item.compositeScore.toFixed(1)}</span>
                              </td>

                              <td className="py-3.5 px-4 text-left">
                                <div className="space-y-1">
                                  <span className="font-bold text-slate-800 block">{item.locationRecommendation}</span>
                                  <span className="text-[10px] text-slate-400 font-mono block">{item.storageZone}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Detailed slotting drawer/card when a SKU row is clicked */}
              {selectedAbcSku && (() => {
                const item = abcAnalysis.find(i => i.sku === selectedAbcSku);
                if (!item) return null;
                return (
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-6 animate-fade-in space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2">
                        <Boxes className="h-5 w-5 text-indigo-600" />
                        <h4 className="font-black text-slate-800 text-sm">
                          Análisis de Ranurado Detallado: <span className="font-mono text-indigo-600">{item.sku}</span>
                        </h4>
                      </div>
                      <button
                        onClick={() => setSelectedAbcSku(null)}
                        className="text-slate-400 hover:text-slate-650 text-xs font-bold"
                      >
                        Cerrar detalle
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">SKU & Producto</span>
                        <p className="font-extrabold text-slate-800">{item.name}</p>
                        <p className="text-slate-500 font-mono text-[10px]">Categoría WMS: {item.category}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Clasificación ABC</span>
                        <p className="font-extrabold text-slate-800">
                          Clase {item.categoryLetter} — {
                            item.categoryLetter === 'A' ? 'Alta Prioridad (70% superior)' :
                            item.categoryLetter === 'B' ? 'Prioridad Media (22% intermedio)' : 'Baja Prioridad (8% inferior)'
                          }
                        </p>
                        <p className="text-slate-500 font-mono text-[10px]">Porcentaje Acumulado: {item.cumulativePercentage.toFixed(1)}%</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Ubicación Recomendada</span>
                        <p className="font-extrabold text-indigo-600">{item.locationRecommendation}</p>
                        <p className="text-slate-500 text-[10px]">{item.storageZone}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Indicador de Rotación</span>
                        <p className="font-extrabold text-slate-800">{item.totalConsumed} unidades despachadas</p>
                        <p className="text-slate-500 text-[10px]">Tasa de salida promedio: {item.dailyRate.toFixed(2)} unidades/día</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Database Mutation confirmation popup for deleting SKU */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/45 flex items-center justify-center z-50 p-4 font-sans select-none animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 animate-scale-up">
            <div className="flex items-center gap-2 text-rose-500 mb-4">
              <ShieldAlert className="h-6 w-6" />
              <h4 className="font-bold text-slate-800 text-base leading-none">
                Delete permanent SKU index?
              </h4>
            </div>

            <p className="text-slate-600 text-xs leading-relaxed mb-6">
              You are authorizing direct deletion of SKU <span className="font-mono bg-slate-100 font-black px-1 py-0.5 text-slate-900 rounded">{skuToDelete}</span> on your Supabase Database.
              This will completely remove the row from your <span className="font-mono bg-slate-100 px-1 rounded font-bold">Inventory</span> database table. All stock allocation records linked will be cleared.
              This transaction is historical and irreversible.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-xs font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK LABEL PRINT MODAL FOR INDIVIDUAL SKU RECIEPT */}
      {printSku && (() => {
        const product = inventory.find(i => i.sku === printSku);
        if (!product) return null;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none animate-fade-in">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xl max-w-sm w-full p-6 space-y-4">
              <div className="border-b border-slate-100 pb-2.5 flex justify-between items-center text-slate-700">
                <span className="text-xs font-mono font-black uppercase">Imprimir Etiquetas (Barcode Station)</span>
                <button onClick={() => setPrintSku(null)} className="text-slate-400 font-extrabold hover:text-slate-650">✕</button>
              </div>

              {/* Tag sticker detail page preview */}
              <div className="border-4 border-dashed border-slate-300 p-4 bg-white text-slate-900 space-y-3 font-mono">
                <div className="flex justify-between items-start border-b border-slate-900 pb-1.5 leading-none">
                  <div>
                    <span className="text-[10px] font-black uppercase leading-none block">INBOUND STICKER</span>
                    <span className="text-[7px] text-slate-400 font-bold block mt-1">PRODUCT SKU: {product.sku}</span>
                  </div>
                  <span className="text-[8px] font-black border border-slate-900 px-1 py-0.5 rounded uppercase">
                    WMS PASS
                  </span>
                </div>

                <div className="text-center space-y-1">
                  <span className="text-[7px] text-slate-400 font-bold block uppercase tracking-wide">DESCRIPCIÓN DE MATERIAL</span>
                  <span className="text-xs font-black truncate block text-slate-800 leading-none">{product.name}</span>
                  <span className="text-base font-black px-1.5 bg-slate-50 block py-1 border border-slate-200 rounded tracking-widest mt-1">
                    {product.barcode || '7501020304012'}
                  </span>
                </div>

                <div className="text-[9px] grid grid-cols-2 gap-1.5 border-t border-b border-slate-900 py-1.5 font-mono leading-relaxed">
                  <div>
                    <span className="text-slate-400 block text-[6px] font-bold">CATEGORÍA</span>
                    <strong className="block truncate">{product.category}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[6px] font-bold">PESO UNIT.</span>
                    <strong className="block">{product.unitWeight} kg</strong>
                  </div>
                </div>

                <div className="text-center flex flex-col items-center">
                  <div className="text-slate-850 leading-none space-y-0.5 font-sans scale-y-150 py-1">
                    |||||||||||||||||||||||||||||||||||||||||||||||||
                  </div>
                  <span className="text-[9px] tracking-[6px] font-bold text-center block mt-1.5 pl-1.5">
                    *{product.barcode}*
                  </span>
                </div>
              </div>

              {/* Config copies */}
              <div className="space-y-1.5 text-xs">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Número de Copias a Generar</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={printCopies}
                  onChange={(e) => setPrintCopies(Number(e.target.value))}
                  className="w-full font-mono font-bold text-slate-700 bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-center focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => {
                    window.print();
                    setPrintSku(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir ({printCopies})
                </button>
                <button
                  onClick={() => setPrintSku(null)}
                  className="bg-slate-150 text-slate-605 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider block text-center"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* QR CODE GENERATOR MODAL */}
      {selectedQrSku && (() => {
        const product = inventory.find(i => i.sku === selectedQrSku);
        if (!product) return null;

        const qrValue = qrValueType === 'sku' ? product.sku : (product.barcode || '7501020304012');

        const handleDownloadQr = () => {
          if (!qrDataUrl) return;
          const link = document.createElement('a');
          link.href = qrDataUrl;
          link.download = `QR-${product.sku}-${qrValueType}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

        const handlePrintQr = () => {
          const printWindow = window.open('', '_blank');
          if (!printWindow) {
            alert('Por favor, permita ventanas emergentes para imprimir la etiqueta.');
            return;
          }
          printWindow.document.write(`
            <html>
              <head>
                <title>Imprimir QR - ${product.sku}</title>
                <style>
                  body {
                    font-family: monospace;
                    text-align: center;
                    padding: 20px;
                    margin: 0;
                  }
                  .label-card {
                    border: 2px dashed #000;
                    padding: 15px;
                    display: inline-block;
                    max-width: 250px;
                  }
                  .title {
                    font-size: 14px;
                    font-weight: bold;
                    margin-bottom: 5px;
                    text-transform: uppercase;
                  }
                  .sku {
                    font-size: 16px;
                    font-weight: 900;
                    margin-bottom: 10px;
                  }
                  .qr-img {
                    width: 150px;
                    height: 150px;
                    margin: 10px 0;
                  }
                  .footer {
                    font-size: 10px;
                    color: #555;
                  }
                </style>
              </head>
              <body>
                <div class="label-card">
                  <div class="title">WMS QR PASS</div>
                  <div class="sku">${product.sku}</div>
                  <img class="qr-img" src="${qrDataUrl}" />
                  <div><strong>${qrValueType.toUpperCase()}: ${qrValue}</strong></div>
                  <p class="footer">${product.name}</p>
                </div>
                <script {referrerpolicy="no-referrer"}>
                  window.onload = function() {
                    window.print();
                    window.close();
                  }
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
        };

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none animate-fade-in">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-sm w-full p-6 space-y-5">
              
              {/* Header */}
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center text-slate-850">
                <div className="flex items-center gap-1.5 text-indigo-600">
                  <QrCode className="h-5 w-5" />
                  <span className="text-xs font-extrabold uppercase font-mono tracking-wide">Generar QR</span>
                </div>
                <button 
                  onClick={() => setSelectedQrSku(null)} 
                  className="text-slate-400 font-extrabold hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Informative info */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-[10px] text-indigo-800 leading-relaxed space-y-1">
                <span className="font-bold uppercase block tracking-wider">💡 Escaneo Directo:</span>
                <p>
                  Escanee este código QR en la pestaña <strong>Barcode Terminal</strong> para realizar entradas, salidas o conteos de forma inmediata.
                </p>
              </div>

              {/* Configuration Controls */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 space-y-3.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-extrabold text-slate-500 uppercase tracking-wide text-[9px]">Dato a Codificar</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setQrValueType('sku')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition uppercase ${
                        qrValueType === 'sku' 
                          ? 'bg-indigo-600 text-white shadow-xs' 
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      SKU Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrValueType('barcode')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition uppercase ${
                        qrValueType === 'barcode' 
                          ? 'bg-indigo-600 text-white shadow-xs' 
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Barcode
                    </button>
                  </div>
                </div>

                {/* Color and Density Customizers */}
                <div className="grid grid-cols-2 gap-4 text-xs pt-1.5 border-t border-slate-200/50">
                  <div className="space-y-1">
                    <span className="font-extrabold text-slate-400 uppercase tracking-wide text-[9px] block">Color del Código</span>
                    <select
                      value={qrColor}
                      onChange={(e) => setQrColor(e.target.value)}
                      className="w-full text-[11px] p-2 bg-white rounded-lg border border-slate-200 text-slate-700 font-medium"
                    >
                      <option value="#0f172a">Slate Black</option>
                      <option value="#1e3a8a">Navy Blue</option>
                      <option value="#064e3b">Emerald Green</option>
                      <option value="#7c2d12">Rust Orange</option>
                      <option value="#881337">Crimson Red</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <span className="font-extrabold text-slate-400 uppercase tracking-wide text-[9px] block">Tamaño QR</span>
                    <select
                      value={qrSize}
                      onChange={(e) => setQrSize(Number(e.target.value))}
                      className="w-full text-[11px] p-2 bg-white rounded-lg border border-slate-200 text-slate-700 font-medium"
                    >
                      <option value={140}>Compacto (140px)</option>
                      <option value={180}>Estándar (180px)</option>
                      <option value={240}>Grande (240px)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Tag Sticker Interactive Preview Panel */}
              <div className="border-4 border-dashed border-slate-300 rounded-2xl p-4 bg-white text-slate-900 space-y-4 font-mono select-text relative">
                
                {/* Header details */}
                <div className="flex justify-between items-start border-b border-slate-900 pb-2 leading-none">
                  <div>
                    <span className="text-[10px] font-black uppercase leading-none block tracking-tight">WMS QR PASSPORT</span>
                    <span className="text-[8px] text-slate-400 font-bold block mt-1">PRODUCT SKU: {product.sku}</span>
                  </div>
                  <span className="text-[8px] font-black border border-slate-900 px-1 py-0.5 rounded uppercase leading-none">
                    PASS
                  </span>
                </div>

                {/* Main QR Code container with beautiful micro-shadow */}
                <div className="flex flex-col items-center justify-center py-2 space-y-1 bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                  {qrDataUrl ? (
                    <img 
                      src={qrDataUrl} 
                      alt={`QR Code for ${qrValue}`} 
                      className="rounded-lg border border-slate-200 p-1.5 bg-white shadow-md animate-fade-in"
                      style={{ width: `${qrSize - 40}px`, height: `${qrSize - 40}px` }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-32 h-32 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                      Generando QR...
                    </div>
                  )}
                  
                  <span className="text-[9px] tracking-widest font-black uppercase text-slate-500 mt-2">
                    {qrValueType === 'sku' ? 'CÓDIGO DE SKU' : 'CÓDIGO DE BARRAS'}
                  </span>
                  <span className="text-xs font-black text-slate-800 tracking-wider">
                    {qrValue}
                  </span>
                </div>

                {/* Product Metadata Footer */}
                <div className="text-[9px] grid grid-cols-2 gap-1.5 border-t border-slate-900 pt-2.5 leading-relaxed font-mono">
                  <div>
                    <span className="text-slate-400 block text-[6px] font-bold">DESCRIPCIÓN</span>
                    <strong className="block truncate max-w-[120px] text-slate-800">{product.name}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[6px] font-bold text-right">CATEGORÍA / PESO</span>
                    <strong className="block text-slate-800">{product.category} | {product.unitWeight} kg</strong>
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2.5 pt-1.5">
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition shadow hover:shadow-md text-center"
                  title="Guardar imagen QR como PNG en descargas"
                >
                  <Download className="h-3.5 w-3.5" />
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={handlePrintQr}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition shadow hover:shadow-md col-span-2"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir Etiqueta
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* PROFESSIONAL PRINTABLE INVENTORY REPORT MODAL OVERLAY REMOVED */}
      {false && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex flex-col justify-start items-center z-50 p-4 overflow-y-auto font-sans animate-fade-in no-print">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              /* Hide all page content by default */
              body * {
                visibility: hidden !important;
                background: none !important;
              }
              /* Show ONLY our printable report area */
              #printable-report-area, #printable-report-area * {
                visibility: visible !important;
              }
              #printable-report-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 1.2cm !important;
                border: none !important;
                box-shadow: none !important;
                background-color: white !important;
                color: black !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print {
                display: none !important;
              }
            }
            @page {
              size: letter portrait;
              margin: 0;
            }
          ` }} />

          {/* Report Toolbar Control Box */}
          <div className="bg-slate-800 text-white rounded-2xl shadow-xl w-full max-w-4xl p-5 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-700">
            <div className="space-y-1 text-left">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Printer className="h-4.5 w-4.5 text-indigo-400" />
                <span>Vista Previa de Reporte de Impresión Profesional</span>
              </h3>
              <p className="text-[10.5px] text-slate-400">
                Configure los metadatos del encabezado del reporte y active el cuadro de diálogo de impresión del sistema o guarde en PDF local.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col text-left">
                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1">Subtítulo de Reporte / Notas</label>
                <input
                  type="text"
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="ej. Auditoría de Stock Q2"
                  className="bg-slate-700/80 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-indigo-400 w-44 md:w-56"
                />
              </div>

              <div className="flex items-center gap-2 mt-auto">
                <button
                  onClick={() => handleExportExcel(filteredProducts)}
                  className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer"
                  title="Descargar esta vista filtrada de insumos como un archivo Excel .xlsx"
                >
                  <Download className="h-3.5 w-3.5" />
                  Descargar Excel
                </button>
                <button
                  onClick={() => window.print()}
                  className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir Ahora
                </button>
                <button
                  onClick={() => setShowPrintReport(false)}
                  className="bg-slate-700 hover:bg-slate-600 active:scale-95 transition text-slate-200 text-xs font-bold px-4 py-2 rounded-xl border border-slate-600 cursor-pointer"
                >
                  ✕ Cerrar Vista Previa
                </button>
              </div>
            </div>
          </div>

          {/* Letter / A4 Styled Live Document Sheet Preview */}
          <div 
            id="printable-report-area"
            className="bg-white text-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl p-8 md:p-12 border border-slate-150 overflow-y-auto max-h-[80vh] text-left relative flex flex-col justify-between"
          >
            <div>
              {/* Report Header Logo & Branding */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded bg-slate-950 flex items-center justify-center">
                      <Package className="h-4.5 w-4.5 text-white" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-wider font-mono text-slate-900">
                      Registro Central de Almacenamiento WMS
                    </span>
                  </div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase mt-2">
                    REPORTE DE AUDITORÍA DE INVENTARIO FÍSICO
                  </h1>
                  <p className="text-xs font-medium text-indigo-700 mt-1 uppercase tracking-wider font-mono">
                    {reportNotes || 'Exportación Oficial del Libro de Inventario'}
                  </p>
                </div>

                <div className="text-right font-mono text-[10px] text-slate-500 space-y-1">
                  <div><strong>Fecha Generada:</strong> 2026-06-29 09:41 AM</div>
                  <div><strong>Auditor de Sistema:</strong> ernest.quintero78@gmail.com</div>
                  <div><strong>Versión de Plataforma:</strong> Motor Ledger v2.4</div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold bg-slate-50 border border-slate-200 px-2 py-0.5 rounded inline-block mt-1">
                    Reporte Confidencial
                  </div>
                </div>
              </div>

              {/* Active Filter Criteria Subhead */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-6 grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] text-slate-600 font-mono">
                <div>
                  <span className="font-bold text-slate-400 block uppercase text-[8px] tracking-wider">Alcance de Categoría</span>
                  <span className="text-slate-800 font-bold text-xs">{categoryFilter === 'All' ? 'Completo (Todas las Categorías)' : categoryFilter}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 block uppercase text-[8px] tracking-wider">Restricciones de Términos de Búsqueda</span>
                  <span className="text-slate-800 font-bold text-xs">"{searchQuery || 'Sin restricciones / Todos los términos'}"</span>
                </div>
              </div>

              {/* Quick Summary Statistical KPIs Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="block text-[8px] uppercase font-bold text-slate-400 font-mono tracking-wider">Diversidad de SKUs Filtrados</span>
                  <span className="text-lg font-black font-mono text-slate-800">
                    {filteredProducts.length} <span className="text-[10px] font-normal text-slate-400">SKUs</span>
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="block text-[8px] uppercase font-bold text-slate-400 font-mono tracking-wider">Cantidad de Stock Acumulado</span>
                  <span className="text-lg font-black font-mono text-slate-800">
                    {filteredProducts.reduce((acc, item) => acc + (item.qty || 0), 0).toLocaleString()} <span className="text-[10px] font-normal text-slate-400">Unidades</span>
                  </span>
                </div>

                <div className="p-3.5 bg-indigo-50/50 border border-indigo-150 rounded-xl">
                  <span className="block text-[8px] uppercase font-bold text-indigo-400 font-mono tracking-wider">Valor de Capital Total</span>
                  <span className="text-lg font-black font-mono text-indigo-700">
                    ${filteredProducts.reduce((acc, item) => acc + ((item.qty || 0) * (item.cost || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-3.5 bg-amber-50/50 border border-amber-150 rounded-xl">
                  <span className="block text-[8px] uppercase font-bold text-amber-500 font-mono tracking-wider">Alertas de Stock Bajo / Seguridad</span>
                  <span className={`text-lg font-black font-mono ${filteredProducts.filter(item => item.qty < (item.minQty || 0)).length > 0 ? 'text-amber-700 animate-pulse' : 'text-slate-800'}`}>
                    {filteredProducts.filter(item => item.qty < (item.minQty || 0)).length} <span className="text-[10px] font-normal text-slate-400">artículos</span>
                  </span>
                </div>
              </div>

              {/* Table of products */}
              <div className="border border-slate-250 rounded-xl overflow-hidden mb-8">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-250 text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      <th className="py-2.5 px-3 border-r border-slate-250">Código SKU</th>
                      <th className="py-2.5 px-3 border-r border-slate-250">Nombre del Producto y Detalles</th>
                      <th className="py-2.5 px-3 border-r border-slate-250">Categoría</th>
                      <th className="py-2.5 px-3 border-r border-slate-250">Proveedor</th>
                      <th className="py-2.5 px-3 border-r border-slate-250 text-right">Costo Unitario</th>
                      <th className="py-2.5 px-3 border-r border-slate-250 text-right">Cant.</th>
                      <th className="py-2.5 px-3 border-r border-slate-250 text-right">Valuación</th>
                      <th className="py-2.5 px-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px] font-sans">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((item) => {
                        const isLowStock = item.qty < (item.minQty || 0);
                        const isOutOfStock = item.qty === 0;
                        const valuation = (item.qty || 0) * (item.cost || 0);

                        return (
                          <tr key={item.sku} className="hover:bg-slate-50/30">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 border-r border-slate-200">{item.sku}</td>
                            <td className="py-2.5 px-3 border-r border-slate-200">
                              <div className="font-bold text-slate-800">{item.name}</div>
                              {item.description && (
                                <div className="text-[9.5px] text-slate-500 line-clamp-1 italic mt-0.5">
                                  {item.description}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 border-r border-slate-200">{item.category}</td>
                            <td className="py-2.5 px-3 text-slate-600 border-r border-slate-200 truncate max-w-[120px]" title={item.supplier}>
                              {item.supplier || 'Sin asignar'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono border-r border-slate-200 text-slate-700">
                              ${(item.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono border-r border-slate-200 font-bold text-slate-850">
                              {item.qty}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-750 border-r border-slate-200">
                              ${valuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold">
                              {isOutOfStock ? (
                                <span className="text-rose-600 text-[8.5px] bg-rose-50 border border-rose-200/50 px-1.5 py-0.5 rounded-md font-mono tracking-wider">AGOTADO</span>
                              ) : isLowStock ? (
                                <span className="text-amber-600 text-[8.5px] bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 rounded-md font-mono tracking-wider">BAJO</span>
                              ) : (
                                <span className="text-emerald-650 text-[8.5px] bg-emerald-50 border border-emerald-200/50 px-1.5 py-0.5 rounded-md font-mono tracking-wider">OK</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 font-medium font-sans">
                          Ningún artículo de stock coincide con las condiciones de filtrado actuales.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Verification Signature Block at Bottom */}
            <div className="border-t border-slate-200 pt-8 mt-12 grid grid-cols-2 gap-8 text-[11px] font-sans">
              <div>
                <span className="block text-[8px] uppercase font-bold text-slate-400 font-mono tracking-wider">Preparado Por</span>
                <div className="mt-8 border-b border-slate-400 h-6"></div>
                <div className="mt-2 text-slate-500 flex justify-between">
                  <span>Auditor de Inventario Autorizado</span>
                  <span>Fecha: 2026-06-29</span>
                </div>
              </div>
              <div>
                <span className="block text-[8px] uppercase font-bold text-slate-400 font-mono tracking-wider">Verificación de Supervisor Autorizado</span>
                <div className="mt-8 border-b border-slate-400 h-6"></div>
                <div className="mt-2 text-slate-500 flex justify-between">
                  <span>Firma del Supervisor de Almacén</span>
                  <span>Fecha: _______________</span>
                </div>
              </div>
            </div>

            {/* Confidential footer declaration */}
            <div className="mt-8 pt-4 border-t border-slate-100 text-[9px] text-slate-400 text-center font-mono">
              DOCUMENTO CONFIDENCIAL • PARA USO OPERATIVO INTERNO • GENERADO AUTOMÁTICAMENTE POR LA PLATAFORMA DE REGISTRO CENTRAL WMS
            </div>

          </div>
        </div>
      )}

      {/* PLACEHOLDER IMAGE ASSIGNMENT MODAL */}
      {assigningImageSku && (() => {
        const product = inventory.find(i => i.sku === assigningImageSku);
        if (!product) return null;

        const handleSelectUrl = async (url: string) => {
          if (onUpdateInventoryItem) {
            await onUpdateInventoryItem(product.sku, { imageUrl: url });
          }
          setAssigningImageSku(null);
          setCustomPlaceholderUrl('');
        };

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none animate-fade-in no-print">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-2xl w-full p-6 space-y-5 animate-scale-up text-left">
              
              {/* Header */}
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center text-slate-700">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <ImageIcon className="h-4.5 w-4.5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Asignar Marcador de Logística</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Vincule rápidamente una imagen para validación de SKU de stock y reconocimiento de artículos.</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setAssigningImageSku(null);
                    setCustomPlaceholderUrl('');
                  }} 
                  className="text-slate-400 hover:text-slate-600 font-extrabold h-8 w-8 rounded-lg hover:bg-slate-50 flex items-center justify-center transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Product Info Block */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex items-center justify-between gap-4 text-xs">
                <div>
                  <span className="block text-[9px] uppercase font-bold text-slate-400 font-mono">SKU de Destino Actual</span>
                  <span className="font-mono font-bold text-slate-800 text-xs bg-slate-150 px-1.5 py-0.5 rounded">{product.sku}</span>
                  <span className="font-semibold text-slate-700 ml-2">{product.name}</span>
                </div>
                <div className="text-right">
                  <span className="block text-[9px] uppercase font-bold text-slate-400 font-mono">Categoría</span>
                  <span className="bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-mono">
                    {product.category}
                  </span>
                </div>
              </div>

              {/* Grid of logistics placeholder images */}
              <div className="space-y-2.5">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Seleccione una ilustración de categoría de logística estándar</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                  {LOGISTICS_PLACEHOLDERS.map((placeholder) => {
                    const isMatchedCategory = product.category?.toLowerCase() === placeholder.category?.toLowerCase();
                    return (
                      <button
                        key={placeholder.id}
                        type="button"
                        onClick={() => handleSelectUrl(placeholder.url)}
                        className={`group text-left border rounded-xl overflow-hidden hover:shadow-md transition duration-200 flex items-stretch gap-3 cursor-pointer bg-white relative ${
                          isMatchedCategory 
                            ? 'border-indigo-400 bg-indigo-50/10 ring-1 ring-indigo-400' 
                            : 'border-slate-150 hover:border-indigo-200'
                        }`}
                      >
                        {/* Image preview thumbnail */}
                        <div className="w-20 shrink-0 bg-slate-100 relative overflow-hidden">
                          <img 
                            src={placeholder.url} 
                            alt={placeholder.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>

                        {/* Details content */}
                        <div className="p-2.5 flex-1 flex flex-col justify-between min-w-0 pr-6">
                          <div>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-slate-800 text-[11px] truncate block leading-tight">{placeholder.name}</span>
                              {isMatchedCategory && (
                                <span className="bg-indigo-650 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider font-mono shrink-0 scale-90">
                                  Sugerido
                                </span>
                              )}
                            </div>
                            <span className="block text-[9.5px] text-slate-400 leading-snug font-normal line-clamp-2 mt-0.5">
                              {placeholder.description}
                            </span>
                          </div>
                          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider font-bold">Categoría: {placeholder.category}</span>
                        </div>

                        {/* Quick Selection Arrow or Check Indicator */}
                        <span className={`absolute right-2 top-1/2 -translate-y-1/2 font-bold text-xs ${isMatchedCategory ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-500'}`}>
                          {isMatchedCategory ? '✓' : '→'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Image URL input section */}
              <div className="border-t border-slate-100 pt-4 space-y-2.5">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">O ingrese una URL de foto de alta resolución personalizada</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={customPlaceholderUrl}
                    onChange={(e) => setCustomPlaceholderUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 focus:bg-white flex-1 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customPlaceholderUrl.trim()) {
                        handleSelectUrl(customPlaceholderUrl.trim());
                      }
                    }}
                    disabled={!customPlaceholderUrl.trim()}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                      customPlaceholderUrl.trim() 
                        ? 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer' 
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Aplicar URL
                  </button>
                </div>
                {product.imageUrl && (
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] text-slate-400 font-medium">Currently has an image linked.</span>
                    <button
                      type="button"
                      onClick={() => handleSelectUrl('')}
                      className="text-[10px] text-rose-500 hover:text-rose-600 font-bold hover:underline"
                    >
                      Remove Linked Image
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};
