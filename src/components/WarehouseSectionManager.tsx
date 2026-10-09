import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Building2, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  FileSpreadsheet, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight, 
  MapPin, 
  UserCheck, 
  Boxes, 
  FolderPlus, 
  Store, 
  Hammer, 
  Truck, 
  Package, 
  X, 
  Save, 
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { WarehouseSection, SubWarehouse, PlatformTheme } from '../types';

export const DEFAULT_WAREHOUSE_SECTIONS: WarehouseSection[] = [
  {
    id: 'wh-oxxo',
    code: 'OXXO',
    name: 'Almacén OXXO (Tiendas de Conveniencia)',
    sectionType: 'Comercial / Tiendas',
    description: 'Centro de distribución y abastecimiento para cadena de tiendas OXXO. Manejo de abarrotes, bebidas, refrigerados y productos de alta rotación.',
    facilityLocation: 'Nave Central - Módulo Comercial A',
    managerName: 'Lic. Roberto Valenzuela',
    contactEmail: 'cedis.oxxo@wms-logistics.com',
    contactPhone: '+52 (81) 8320-4000',
    color: '#e11d48', // Crimson red
    status: 'Activo',
    createdAt: new Date().toISOString(),
    categories: [
      'Abarrotes y Secos',
      'Bebidas y Refrescos',
      'Perecederos y Refrigerados',
      'Lácteos y Quesos',
      'Botanas y Dulces',
      'Cafetería y Panadería',
      'Promocionales POP'
    ],
    subWarehouses: [
      {
        id: 'sub-oxxo-01',
        warehouseId: 'wh-oxxo',
        code: 'OXX-ABAR',
        name: 'OXXO - Abarrotes y Alimentos Secos',
        description: 'Almacenamiento de abarrotes empaquetados, botanas, galletas y latería en racks selectivos.',
        storageType: 'Racks Estándar',
        capacityBinsOrUnits: 1500,
        currentOccupancy: 850,
        locationArea: 'Pasillos A01 al A04 - Racks de alta rotación',
        responsibleOperator: 'Héctor Mendoza',
        status: 'Activo',
        categories: ['Abarrotes y Secos', 'Botanas y Dulces', 'Cafetería y Panadería'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'sub-oxxo-02',
        warehouseId: 'wh-oxxo',
        code: 'OXX-REFR',
        name: 'OXXO - Perecederos y Cámara Fría',
        description: 'Cámara frigorífica climatizada para lácteos, embutidos y alimentos refrigerados (2°C a 6°C).',
        storageType: 'Cámara Refrigerada',
        capacityBinsOrUnits: 600,
        currentOccupancy: 420,
        locationArea: 'Cámara Fría B - Puerta Hermética 2',
        responsibleOperator: 'Ing. Sandra Domínguez',
        status: 'Activo',
        categories: ['Perecederos y Refrigerados', 'Lácteos y Quesos'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'sub-oxxo-03',
        warehouseId: 'wh-oxxo',
        code: 'OXX-BEB',
        name: 'OXXO - Bebidas, Aguas y Refrescos',
        description: 'Área de tarimas completas para paletizado de refrescos, jugos, cerveza y garrafones.',
        storageType: 'Tarimas / Pallet Floor',
        capacityBinsOrUnits: 2000,
        currentOccupancy: 1400,
        locationArea: 'Andén 3 y 4 - Piso Paletizado',
        responsibleOperator: 'Mauricio Garza',
        status: 'Activo',
        categories: ['Bebidas y Refrescos', 'Aguas y Jugos'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'sub-oxxo-04',
        warehouseId: 'wh-oxxo',
        code: 'OXX-PROM',
        name: 'OXXO - Promocionales y Exhibidores',
        description: 'Material POP, exhibidores de temporada y material comercial para tiendas.',
        storageType: 'Góndolas / Picking Ligero',
        capacityBinsOrUnits: 400,
        currentOccupancy: 180,
        locationArea: 'Entrepiso Mezzanine - Módulo Frontal',
        responsibleOperator: 'Lorena Cantú',
        status: 'Activo',
        categories: ['Promocionales POP'],
        createdAt: new Date().toISOString()
      }
    ]
  },
  {
    id: 'wh-const',
    code: 'CONST',
    name: 'Almacén para Construcción y Obras',
    sectionType: 'Construcción / Obra',
    description: 'Gestión y resguardo de materiales de obra pesada, cemento, varilla, herramientas industriales, acabados y ferretería estructural.',
    facilityLocation: 'Patio Industrial y Nave Sur - Módulo B',
    managerName: 'Ing. Jorge Cárdenas',
    contactEmail: 'obras.construccion@wms-logistics.com',
    contactPhone: '+52 (55) 5488-9100',
    color: '#d97706', // Amber / Construction orange
    status: 'Activo',
    createdAt: new Date().toISOString(),
    categories: [
      'Material Pesado y Cemento',
      'Aceros, Varilla y Perfiles',
      'Herramientas y Equipo',
      'Material Eléctrico y Plomería',
      'Ferretería y Tornillería',
      'Pinturas e Impermeabilizantes'
    ],
    subWarehouses: [
      {
        id: 'sub-cst-01',
        warehouseId: 'wh-const',
        code: 'CST-PES',
        name: 'Construcción - Material Pesado y Cemento',
        description: 'Sacos de cemento, mortero, cal, grava ensacada y agregados en tarimas de alto tonelaje.',
        storageType: 'Patio / Material Pesado',
        capacityBinsOrUnits: 3000,
        currentOccupancy: 2100,
        locationArea: 'Patio Exterior Pavimentado - Bahías P1 a P6',
        responsibleOperator: 'Don Ramiro Sánchez',
        status: 'Activo',
        categories: ['Material Pesado y Cemento'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'sub-cst-02',
        warehouseId: 'wh-const',
        code: 'CST-ACER',
        name: 'Construcción - Aceros, Varilla y Perfiles',
        description: 'Varilla corrugada en atados, vigas IPR, malla electrosoldada y alambre recocido.',
        storageType: 'Patio / Material Pesado',
        capacityBinsOrUnits: 1800,
        currentOccupancy: 980,
        locationArea: 'Patio Techado de Aceros - Grúa Viajera 1',
        responsibleOperator: 'Eulalio Martínez',
        status: 'Activo',
        categories: ['Aceros, Varilla y Perfiles'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'sub-cst-03',
        warehouseId: 'wh-const',
        code: 'CST-HERR',
        name: 'Construcción - Herramientas y Equipos de Poder',
        description: 'Revolvedoras, rotomartillos, andamios, cortadoras de disco y equipo de seguridad con resguardo en jaula.',
        storageType: 'Jaula de Alta Seguridad',
        capacityBinsOrUnits: 500,
        currentOccupancy: 310,
        locationArea: 'Jaula Blindada - Nave Sur Módulo 3',
        responsibleOperator: 'Guillermo Paz',
        status: 'Activo',
        categories: ['Herramientas y Equipo', 'Ferretería y Tornillería'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'sub-cst-04',
        warehouseId: 'wh-const',
        code: 'CST-ELEC',
        name: 'Construcción - Material Eléctrico y Plomería',
        description: 'Tubería PVC/CPVC, cableado de cobre, conexiones, válvulas y tableros de distribución.',
        storageType: 'Racks Estándar',
        capacityBinsOrUnits: 950,
        currentOccupancy: 560,
        locationArea: 'Nave Sur - Pasillo E01 a E04',
        responsibleOperator: 'Carlos Vaca',
        status: 'Activo',
        categories: ['Material Eléctrico y Plomería', 'Pinturas e Impermeabilizantes'],
        createdAt: new Date().toISOString()
      }
    ]
  },
  {
    id: 'wh-trans',
    code: 'TRANS',
    name: 'Almacén para Transporte y Flota',
    sectionType: 'Transporte / Flota',
    description: 'Respaldo logístico, refacciones para tractocamiones, neumáticos, lubricantes y consumibles para la flota de transporte pesado y ligero.',
    facilityLocation: 'Taller Central de Flota - Módulo C',
    managerName: 'Ing. Fernando Treviño',
    contactEmail: 'flota.transporte@wms-logistics.com',
    contactPhone: '+52 (33) 3810-7200',
    color: '#0284c7', // Sky / Logistics blue
    status: 'Activo',
    createdAt: new Date().toISOString(),
    categories: [
      'Refacciones y Autopartes',
      'Neumáticos y Llantas',
      'Lubricantes y Fluidos',
      'Filtros Diésel y Aire',
      'Sistema de Frenos',
      'Baterías y Eléctrico Flota',
      'Herramientas de Taller'
    ],
    subWarehouses: [
      {
        id: 'sub-trn-01',
        warehouseId: 'wh-trans',
        code: 'TRN-REF',
        name: 'Transporte - Refacciones y Filtros para Unidades',
        description: 'Filtros de diésel, aire y aceite, balatas, bandas, suspensiones y sensores para tractos y vans.',
        storageType: 'Racks Estándar',
        capacityBinsOrUnits: 1200,
        currentOccupancy: 740,
        locationArea: 'Taller Flota - Racks T1 a T3',
        responsibleOperator: 'Mario Escobedo',
        status: 'Activo',
        categories: ['Refacciones y Autopartes', 'Filtros Diésel y Aire', 'Sistema de Frenos'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'sub-trn-02',
        warehouseId: 'wh-trans',
        code: 'TRN-LLAN',
        name: 'Transporte - Neumáticos y Llantas de Carga',
        description: 'Llantas radiales 22.5 y 24.5 para tractocamión, remolques y camionetas de reparto local.',
        storageType: 'Tarimas / Pallet Floor',
        capacityBinsOrUnits: 800,
        currentOccupancy: 450,
        locationArea: 'Bodega de Neumáticos - Bahía 4',
        responsibleOperator: 'Arturo Ibarra',
        status: 'Activo',
        categories: ['Neumáticos y Llantas'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'sub-trn-03',
        warehouseId: 'wh-trans',
        code: 'TRN-LUB',
        name: 'Transporte - Lubricantes, Aceites y Fluidos',
        description: 'Tambores y cubetas de aceite para motor 15W-40, anticongelante, líquido de frenos y grasas.',
        storageType: 'Zona de Maniobras',
        capacityBinsOrUnits: 450,
        currentOccupancy: 290,
        locationArea: 'Cuarto de Fluidos - Dique Contención',
        responsibleOperator: 'David Salgado',
        status: 'Activo',
        categories: ['Lubricantes y Fluidos', 'Baterías y Eléctrico Flota'],
        createdAt: new Date().toISOString()
      }
    ]
  }
];

export const STORAGE_TYPES = [
  'Racks Estándar',
  'Tarimas / Pallet Floor',
  'Cámara Refrigerada',
  'Jaula de Alta Seguridad',
  'Patio / Material Pesado',
  'Zona de Maniobras',
  'Góndolas / Picking Ligero'
] as const;

export const SECTION_TYPES = [
  'Comercial / Tiendas',
  'Construcción / Obra',
  'Transporte / Flota',
  'Industrial / Manufactura',
  'General / Multiusos',
  'Especializado'
] as const;

export const PRESET_COLORS = [
  '#e11d48', // Red / Crimson (OXXO)
  '#d97706', // Amber (Construcción)
  '#0284c7', // Sky Blue (Transporte)
  '#10b981', // Emerald Green
  '#8b5cf6', // Purple
  '#0d9488', // Teal
  '#f97316', // Orange
  '#4f46e5', // Indigo
  '#475569'  // Slate
];

// Helper to get stored warehouses with reactive sync
export function getStoredWarehouseSections(): WarehouseSection[] {
  try {
    const raw = localStorage.getItem('wms_warehouse_sections_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Error reading warehouses from localStorage', e);
  }
  return DEFAULT_WAREHOUSE_SECTIONS;
}

// Helper to retrieve associated categories for a specific superwarehouse and subwarehouse
export function getCategoriesForWarehouse(warehouseId?: string, subWarehouseId?: string): string[] {
  const warehouses = getStoredWarehouseSections();
  if (!warehouseId || warehouseId === 'ALL') {
    const all = new Set<string>();
    warehouses.forEach(w => {
      (w.categories || []).forEach(c => all.add(c));
      (w.subWarehouses || []).forEach(s => (s.categories || []).forEach(c => all.add(c)));
    });
    return Array.from(all);
  }

  const wh = warehouses.find(w => w.id === warehouseId);
  if (!wh) return [];

  const sub = subWarehouseId && subWarehouseId !== 'ALL'
    ? wh.subWarehouses?.find(s => s.id === subWarehouseId)
    : null;

  const result = new Set<string>();
  if (sub && sub.categories && sub.categories.length > 0) {
    sub.categories.forEach(c => result.add(c));
  }
  if (wh.categories && wh.categories.length > 0) {
    wh.categories.forEach(c => result.add(c));
  }

  // Fallback defaults if empty
  if (result.size === 0) {
    const code = (wh.code || '').toUpperCase();
    if (code.includes('OXXO')) return ['Abarrotes y Secos', 'Bebidas y Refrescos', 'Perecederos y Refrigerados', 'Lácteos y Quesos', 'Botanas y Dulces'];
    if (code.includes('CONST')) return ['Material Pesado y Cemento', 'Aceros, Varilla y Perfiles', 'Herramientas y Equipo', 'Material Eléctrico y Plomería'];
    if (code.includes('TRANS')) return ['Refacciones y Autopartes', 'Neumáticos y Llantas', 'Lubricantes y Fluidos', 'Filtros Diésel y Aire'];
    return ['General', 'Almacenamiento Estándar'];
  }

  return Array.from(result);
}

interface WarehouseSectionManagerProps {
  platformTheme: PlatformTheme;
  onNavigateToTab?: (tab: string) => void;
}

export const WarehouseSectionManager: React.FC<WarehouseSectionManagerProps> = ({
  platformTheme,
  onNavigateToTab
}) => {
  // Main data state
  const [warehouses, setWarehouses] = useState<WarehouseSection[]>(() => {
    return getStoredWarehouseSections();
  });

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [expandedWarehouseIds, setExpandedWarehouseIds] = useState<string[]>(() => {
    return ['wh-oxxo', 'wh-const', 'wh-trans'];
  });

  // Modal states: Warehouse (Alta / Editar)
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseSection | null>(null);
  const [whName, setWhName] = useState('');
  const [whCode, setWhCode] = useState('');
  const [whSectionType, setWhSectionType] = useState('Comercial / Tiendas');
  const [whFacilityLocation, setWhFacilityLocation] = useState('');
  const [whManagerName, setWhManagerName] = useState('');
  const [whContactEmail, setWhContactEmail] = useState('');
  const [whContactPhone, setWhContactPhone] = useState('');
  const [whDescription, setWhDescription] = useState('');
  const [whColor, setWhColor] = useState('#e11d48');
  const [whStatus, setWhStatus] = useState<'Activo' | 'Inactivo'>('Activo');
  const [whCategories, setWhCategories] = useState<string[]>([]);
  const [newWhCatInput, setNewWhCatInput] = useState('');
  const [isCustomSectionType, setIsCustomSectionType] = useState(false);
  const [customSectionTypeInput, setCustomSectionTypeInput] = useState('');

  // Modal states: SubWarehouse (Alta / Editar)
  const [isSubWarehouseModalOpen, setIsSubWarehouseModalOpen] = useState(false);
  const [editingSubWarehouse, setEditingSubWarehouse] = useState<SubWarehouse | null>(null);
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>('');
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [subStorageType, setSubStorageType] = useState('Racks Estándar');
  const [isCustomStorageType, setIsCustomStorageType] = useState(false);
  const [customStorageTypeInput, setCustomStorageTypeInput] = useState('');
  const [subCapacity, setSubCapacity] = useState<number>(1000);
  const [subOccupancy, setSubOccupancy] = useState<number>(0);
  const [subLocationArea, setSubLocationArea] = useState('');
  const [subResponsible, setSubResponsible] = useState('');
  const [subDescription, setSubDescription] = useState('');
  const [subStatus, setSubStatus] = useState<'Activo' | 'Mantenimiento' | 'Inactivo'>('Activo');
  const [subCategories, setSubCategories] = useState<string[]>([]);
  const [newSubCatInput, setNewSubCatInput] = useState('');

  // Feedback notifications
  const [alertBanner, setAlertBanner] = useState<{ type: 'ok' | 'err'; message: string } | null>(null);

  // Sync to localStorage
  const saveWarehouses = (updated: WarehouseSection[]) => {
    setWarehouses(updated);
    try {
      localStorage.setItem('wms_warehouse_sections_v2', JSON.stringify(updated));
      window.dispatchEvent(new Event('wms_warehouses_updated'));
    } catch (e) {
      console.error('Error saving warehouse sections:', e);
    }
  };

  // Toggle card expansion
  const toggleExpand = (id: string) => {
    setExpandedWarehouseIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Computed summary metrics
  const totalWarehouses = warehouses.length;
  const totalSubWarehouses = useMemo(() => {
    return warehouses.reduce((sum, w) => sum + (w.subWarehouses?.length || 0), 0);
  }, [warehouses]);

  const activeSubWarehouses = useMemo(() => {
    return warehouses.reduce((sum, w) => {
      const active = (w.subWarehouses || []).filter(s => s.status === 'Activo').length;
      return sum + active;
    }, 0);
  }, [warehouses]);

  const totalCapacityEstimated = useMemo(() => {
    return warehouses.reduce((sum, w) => {
      const cap = (w.subWarehouses || []).reduce((sCap, sub) => sCap + (sub.capacityBinsOrUnits || 0), 0);
      return sum + cap;
    }, 0);
  }, [warehouses]);

  // Filtered warehouses
  const filteredWarehouses = useMemo(() => {
    return warehouses.filter(w => {
      // Filter by section type
      if (sectionFilter !== 'ALL' && w.sectionType !== sectionFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = w.name.toLowerCase().includes(q);
        const matchCode = w.code.toLowerCase().includes(q);
        const matchLocation = w.facilityLocation.toLowerCase().includes(q);
        const matchManager = (w.managerName || '').toLowerCase().includes(q);
        const matchSub = (w.subWarehouses || []).some(sub => 
          sub.name.toLowerCase().includes(q) || 
          sub.code.toLowerCase().includes(q) ||
          (sub.locationArea || '').toLowerCase().includes(q) ||
          (sub.responsibleOperator || '').toLowerCase().includes(q)
        );
        return matchName || matchCode || matchLocation || matchManager || matchSub;
      }
      return true;
    });
  }, [warehouses, sectionFilter, searchQuery]);

  // Open modal for new Warehouse
  const handleOpenNewWarehouse = () => {
    setEditingWarehouse(null);
    setWhName('');
    setWhCode('');
    setWhSectionType('Comercial / Tiendas');
    setWhFacilityLocation('');
    setWhManagerName('');
    setWhContactEmail('');
    setWhContactPhone('');
    setWhDescription('');
    setWhColor('#e11d48');
    setWhStatus('Activo');
    setWhCategories(['General']);
    setNewWhCatInput('');
    setIsWarehouseModalOpen(true);
  };

  // Open modal for editing Warehouse
  const handleOpenEditWarehouse = (w: WarehouseSection) => {
    setEditingWarehouse(w);
    setWhName(w.name);
    setWhCode(w.code);
    setWhSectionType(w.sectionType);
    setWhFacilityLocation(w.facilityLocation);
    setWhManagerName(w.managerName || '');
    setWhContactEmail(w.contactEmail || '');
    setWhContactPhone(w.contactPhone || '');
    setWhDescription(w.description || '');
    setWhColor(w.color || '#e11d48');
    setWhStatus(w.status);
    setWhCategories(w.categories || []);
    setNewWhCatInput('');
    setIsWarehouseModalOpen(true);
  };

  // Save Warehouse (create or update)
  const handleSaveWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName.trim() || !whCode.trim() || !whFacilityLocation.trim()) {
      setAlertBanner({ type: 'err', message: 'Por favor complete el nombre, código y ubicación del almacén.' });
      return;
    }

    const cleanCode = whCode.trim().toUpperCase();

    if (editingWarehouse) {
      // Update
      const updated = warehouses.map(w => {
        if (w.id === editingWarehouse.id) {
          return {
            ...w,
            name: whName.trim(),
            code: cleanCode,
            sectionType: whSectionType,
            facilityLocation: whFacilityLocation.trim(),
            managerName: whManagerName.trim(),
            contactEmail: whContactEmail.trim(),
            contactPhone: whContactPhone.trim(),
            description: whDescription.trim(),
            color: whColor,
            status: whStatus,
            categories: whCategories
          };
        }
        return w;
      });
      saveWarehouses(updated);
      setAlertBanner({ type: 'ok', message: `Almacén "${whName}" actualizado exitosamente.` });
    } else {
      // Create new
      const newWh: WarehouseSection = {
        id: `wh-${Date.now()}`,
        code: cleanCode,
        name: whName.trim(),
        sectionType: whSectionType,
        facilityLocation: whFacilityLocation.trim(),
        managerName: whManagerName.trim(),
        contactEmail: whContactEmail.trim(),
        contactPhone: whContactPhone.trim(),
        description: whDescription.trim(),
        color: whColor,
        status: whStatus,
        createdAt: new Date().toISOString(),
        categories: whCategories,
        subWarehouses: []
      };
      saveWarehouses([...warehouses, newWh]);
      setExpandedWarehouseIds(prev => [...prev, newWh.id]);
      setAlertBanner({ type: 'ok', message: `Almacén "${whName}" dado de alta exitosamente.` });
    }

    setIsWarehouseModalOpen(false);
  };

  // Delete Warehouse
  const handleDeleteWarehouse = (warehouseId: string) => {
    const target = warehouses.find(w => w.id === warehouseId);
    if (!target) return;
    
    const countSubs = target.subWarehouses?.length || 0;
    const confirmMessage = countSubs > 0
      ? `¿Está seguro de eliminar el almacén "${target.name}"? Contiene ${countSubs} subalmacén(es) dados de alta.`
      : `¿Está seguro de eliminar el almacén "${target.name}"?`;

    if (window.confirm(confirmMessage)) {
      const updated = warehouses.filter(w => w.id !== warehouseId);
      saveWarehouses(updated);
      setAlertBanner({ type: 'ok', message: `Almacén "${target.name}" eliminado correctamente.` });
    }
  };

  // Open modal for new SubWarehouse
  const handleOpenNewSubWarehouse = (warehouseId: string) => {
    setEditingSubWarehouse(null);
    setTargetWarehouseId(warehouseId);
    setSubName('');
    setSubCode('');
    setSubStorageType('Racks Estándar');
    setSubCapacity(1000);
    setSubOccupancy(0);
    setSubLocationArea('');
    setSubResponsible('');
    setSubDescription('');
    setSubStatus('Activo');
    setSubCategories([]);
    setNewSubCatInput('');
    setIsSubWarehouseModalOpen(true);
  };

  // Open modal for editing SubWarehouse
  const handleOpenEditSubWarehouse = (sub: SubWarehouse) => {
    setEditingSubWarehouse(sub);
    setTargetWarehouseId(sub.warehouseId);
    setSubName(sub.name);
    setSubCode(sub.code);
    setSubStorageType(sub.storageType);
    setSubCapacity(sub.capacityBinsOrUnits || 1000);
    setSubOccupancy(sub.currentOccupancy || 0);
    setSubLocationArea(sub.locationArea || '');
    setSubResponsible(sub.responsibleOperator || '');
    setSubDescription(sub.description || '');
    setSubStatus(sub.status);
    setSubCategories(sub.categories || []);
    setNewSubCatInput('');
    setIsSubWarehouseModalOpen(true);
  };

  // Save SubWarehouse
  const handleSaveSubWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim() || !subCode.trim() || !targetWarehouseId) {
      setAlertBanner({ type: 'err', message: 'Por favor complete el nombre, código y almacén padre del subalmacén.' });
      return;
    }

    const cleanCode = subCode.trim().toUpperCase();

    const updated = warehouses.map(w => {
      if (w.id === targetWarehouseId) {
        let subs = [...(w.subWarehouses || [])];
        if (editingSubWarehouse) {
          // Update existing
          subs = subs.map(s => {
            if (s.id === editingSubWarehouse.id) {
              return {
                ...s,
                name: subName.trim(),
                code: cleanCode,
                storageType: subStorageType,
                capacityBinsOrUnits: Number(subCapacity) || 0,
                currentOccupancy: Number(subOccupancy) || 0,
                locationArea: subLocationArea.trim(),
                responsibleOperator: subResponsible.trim(),
                description: subDescription.trim(),
                status: subStatus,
                categories: subCategories
              };
            }
            return s;
          });
        } else {
          // Add new
          const newSub: SubWarehouse = {
            id: `sub-${Date.now()}`,
            warehouseId: targetWarehouseId,
            code: cleanCode,
            name: subName.trim(),
            storageType: subStorageType,
            capacityBinsOrUnits: Number(subCapacity) || 0,
            currentOccupancy: Number(subOccupancy) || 0,
            locationArea: subLocationArea.trim(),
            responsibleOperator: subResponsible.trim(),
            description: subDescription.trim(),
            status: subStatus,
            categories: subCategories,
            createdAt: new Date().toISOString()
          };
          subs.push(newSub);
        }
        return { ...w, subWarehouses: subs };
      }
      return w;
    });

    saveWarehouses(updated);
    setIsSubWarehouseModalOpen(false);
    setAlertBanner({ 
      type: 'ok', 
      message: editingSubWarehouse 
        ? `Subalmacén "${subName}" actualizado correctamente.` 
        : `Subalmacén "${subName}" dado de alta exitosamente.` 
    });
  };

  // Delete SubWarehouse
  const handleDeleteSubWarehouse = (warehouseId: string, subWarehouseId: string) => {
    const parentWh = warehouses.find(w => w.id === warehouseId);
    const targetSub = parentWh?.subWarehouses?.find(s => s.id === subWarehouseId);
    if (!targetSub) return;

    if (window.confirm(`¿Está seguro de eliminar el subalmacén "${targetSub.name}" (${targetSub.code})?`)) {
      const updated = warehouses.map(w => {
        if (w.id === warehouseId) {
          return {
            ...w,
            subWarehouses: (w.subWarehouses || []).filter(s => s.id !== subWarehouseId)
          };
        }
        return w;
      });
      saveWarehouses(updated);
      setAlertBanner({ type: 'ok', message: `Subalmacén "${targetSub.name}" eliminado correctamente.` });
    }
  };

  // Reset to default sample warehouses
  const handleResetDefaults = () => {
    if (window.confirm('¿Desea restablecer los almacenes estándar predefinidos (OXXO, Construcción y Transporte)? Esto restaurará los 3 almacenes y sus 11 subalmacenes oficiales.')) {
      saveWarehouses(DEFAULT_WAREHOUSE_SECTIONS);
      setAlertBanner({ type: 'ok', message: 'Almacenes y subalmacenes restablecidos a los valores estándar de fábrica (OXXO, Construcción, Transporte).' });
    }
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Almacenes Principales
      const whData = warehouses.map(w => ({
        'ID': w.id,
        'Código': w.code,
        'Nombre del Almacén': w.name,
        'Tipo de Sección': w.sectionType,
        'Ubicación Física': w.facilityLocation,
        'Responsable / Encargado': w.managerName || 'No asignado',
        'Email Contacto': w.contactEmail || '',
        'Teléfono': w.contactPhone || '',
        'Total Subalmacenes': w.subWarehouses?.length || 0,
        'Capacidad Total Estimada': (w.subWarehouses || []).reduce((s, sub) => s + (sub.capacityBinsOrUnits || 0), 0),
        'Estado': w.status,
        'Descripción': w.description || ''
      }));
      const wsWh = XLSX.utils.json_to_sheet(whData);
      XLSX.utils.book_append_sheet(wb, wsWh, 'Almacenes_Secciones');

      // Sheet 2: Subalmacenes Detallados
      const subData: any[] = [];
      warehouses.forEach(w => {
        (w.subWarehouses || []).forEach(sub => {
          subData.push({
            'Almacén Padre': w.name,
            'Código Almacén Padre': w.code,
            'Tipo Sección': w.sectionType,
            'ID Subalmacén': sub.id,
            'Código Subalmacén': sub.code,
            'Nombre Subalmacén': sub.name,
            'Tipo de Almacenamiento': sub.storageType,
            'Ubicación / Pasillos': sub.locationArea || '',
            'Capacidad (Uds / Posiciones)': sub.capacityBinsOrUnits || 0,
            'Ocupación Actual': sub.currentOccupancy || 0,
            '% Ocupación': sub.capacityBinsOrUnits ? `${Math.round(((sub.currentOccupancy || 0) / sub.capacityBinsOrUnits) * 100)}%` : '0%',
            'Operador Responsable': sub.responsibleOperator || '',
            'Estado': sub.status,
            'Descripción / Notas': sub.description || ''
          });
        });
      });
      const wsSub = XLSX.utils.json_to_sheet(subData);
      XLSX.utils.book_append_sheet(wb, wsSub, 'Subalmacenes');

      XLSX.writeFile(wb, `Estructura_Almacenes_Subalmacenes_${new Date().toISOString().slice(0, 10)}.xlsx`);
      setAlertBanner({ type: 'ok', message: 'Estructura de almacenes exportada exitosamente a Excel (.xlsx).' });
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      setAlertBanner({ type: 'err', message: 'Hubo un error al generar el archivo Excel.' });
    }
  };

  // Helper icon for section type
  const renderSectionIcon = (sectionType: string, color: string) => {
    if (sectionType.includes('Tienda') || sectionType.includes('Comercial') || sectionType.includes('OXXO')) {
      return <Store className="h-5 w-5" style={{ color }} />;
    }
    if (sectionType.includes('Construcción') || sectionType.includes('Obra')) {
      return <Hammer className="h-5 w-5" style={{ color }} />;
    }
    if (sectionType.includes('Transporte') || sectionType.includes('Flota')) {
      return <Truck className="h-5 w-5" style={{ color }} />;
    }
    return <Building2 className="h-5 w-5" style={{ color }} />;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Feedback Banner */}
      {alertBanner && (
        <div 
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold animate-fadeIn ${
            alertBanner.type === 'ok' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-250' 
              : 'bg-rose-50 text-rose-900 border-rose-250'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {alertBanner.type === 'ok' ? (
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0" />
            )}
            <span>{alertBanner.message}</span>
          </div>
          <button 
            onClick={() => setAlertBanner(null)}
            className="p-1 hover:bg-black/5 rounded-lg text-slate-500 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-250/70 shadow-xs">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div 
                className="h-8 w-8 rounded-xl flex items-center justify-center text-white shadow-xs"
                style={{ backgroundColor: platformTheme.primaryColor }}
              >
                <Building2 className="h-4.5 w-4.5" />
              </div>
              <span className="text-[10px] font-black tracking-widest uppercase font-mono text-slate-400">
                Estructura Organizacional WMS
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Gestión de Almacenes y Subalmacenes
            </h1>
            <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
              De alta y configure diferentes almacenes para secciones operativas (por ejemplo: <strong className="text-slate-700">OXXO</strong> para comercial, <strong className="text-slate-700">Construcción</strong> para materiales de obra, o <strong className="text-slate-700">Transporte</strong> para flota y refacciones), y administre sus subalmacenes especializados.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto shrink-0">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-250 rounded-xl text-xs font-bold transition cursor-pointer"
              title="Exportar estructura completa a archivo Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Exportar Excel</span>
            </button>

            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              title="Restablecer almacenes de ejemplo estándar (OXXO, Construcción, Transporte)"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Ejemplos Estándar</span>
            </button>

            <button
              onClick={handleOpenNewWarehouse}
              style={{ backgroundColor: platformTheme.primaryColor }}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-xl text-xs font-bold shadow-xs hover:opacity-90 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ Alta de Almacén</span>
            </button>
          </div>
        </div>

        {/* Telemetry KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-5">
          <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400">
                Almacenes Registrados
              </span>
              <Building2 className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800 font-mono">{totalWarehouses}</span>
              <span className="text-[10px] font-medium text-slate-500">Secciones</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400">
                Subalmacenes Totales
              </span>
              <Layers className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-indigo-600 font-mono">{totalSubWarehouses}</span>
              <span className="text-[10px] font-medium text-slate-500">Zonas / Áreas</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400">
                Subalmacenes Activos
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600 font-mono">{activeSubWarehouses}</span>
              <span className="text-[10px] font-medium text-emerald-700 font-mono">100% Operativos</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400">
                Capacidad Consolidada
              </span>
              <Boxes className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-600 font-mono">{totalCapacityEstimated.toLocaleString()}</span>
              <span className="text-[10px] font-medium text-slate-500">Posiciones</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-96">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, código (OXXO, CONST), ubicación o responsable..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-[10px] font-bold uppercase font-mono text-slate-400 shrink-0">Filtrar Sección:</span>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full md:w-auto px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Todas las Secciones ({totalWarehouses})</option>
              {SECTION_TYPES.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Warehouses and SubWarehouses List */}
      <div className="space-y-4">
        {filteredWarehouses.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
            <Building2 className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-700">No se encontraron almacenes con los filtros actuales</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Puede limpiar los términos de búsqueda o dar de alta un nuevo almacén para la sección que requiera (ej. OXXO, Construcción o Transporte).
            </p>
            <button
              onClick={handleOpenNewWarehouse}
              style={{ backgroundColor: platformTheme.primaryColor }}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Dar de Alta Nuevo Almacén</span>
            </button>
          </div>
        ) : (
          filteredWarehouses.map((wh) => {
            const isExpanded = expandedWarehouseIds.includes(wh.id);
            const subCount = wh.subWarehouses?.length || 0;
            const whCapacity = (wh.subWarehouses || []).reduce((sum, s) => sum + (s.capacityBinsOrUnits || 0), 0);
            const whOccupancy = (wh.subWarehouses || []).reduce((sum, s) => sum + (s.currentOccupancy || 0), 0);
            const occupancyPct = whCapacity > 0 ? Math.round((whOccupancy / whCapacity) * 100) : 0;

            return (
              <div 
                key={wh.id}
                className="bg-white rounded-2xl border border-slate-250/80 shadow-xs overflow-hidden transition-all"
              >
                {/* Warehouse Header Bar */}
                <div 
                  className="p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100"
                  style={{ borderLeftWidth: '5px', borderLeftColor: wh.color || platformTheme.primaryColor }}
                >
                  <div className="flex items-start gap-3.5">
                    <button
                      onClick={() => toggleExpand(wh.id)}
                      className="mt-0.5 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                      title={isExpanded ? 'Colapsar subalmacenes' : 'Ver subalmacenes'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    <div 
                      className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
                      style={{ backgroundColor: `${wh.color}15` }}
                    >
                      {renderSectionIcon(wh.sectionType, wh.color)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span 
                          className="px-2 py-0.5 rounded-md font-mono text-[10px] font-black uppercase text-white tracking-wider"
                          style={{ backgroundColor: wh.color }}
                        >
                          {wh.code}
                        </span>
                        <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                          {wh.name}
                        </h2>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase">
                          {wh.sectionType}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          wh.status === 'Activo' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {wh.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1 text-slate-600 font-medium">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span>{wh.facilityLocation}</span>
                        </div>
                        {wh.managerName && (
                          <div className="flex items-center gap-1 text-slate-600">
                            <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                            <span>Responsable: <strong className="text-slate-700">{wh.managerName}</strong></span>
                          </div>
                        )}
                        {wh.contactPhone && (
                          <span className="text-[11px] font-mono text-slate-400">
                            Tel: {wh.contactPhone}
                          </span>
                        )}
                      </div>

                      {wh.description && (
                        <p className="text-xs text-slate-500 pt-0.5 line-clamp-2 max-w-3xl">
                          {wh.description}
                        </p>
                      )}

                      {wh.categories && wh.categories.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[9.5px] uppercase font-bold text-slate-400 font-mono tracking-wider">
                            Categorías del Superalmacén:
                          </span>
                          {wh.categories.map(c => (
                            <span 
                              key={c}
                              className="px-2 py-0.5 rounded-md text-[9.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Header Stats & Actions */}
                  <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <div className="flex items-center gap-3 pr-2 border-r border-slate-200">
                      <div className="text-right">
                        <span className="block text-[10px] uppercase font-mono font-bold text-slate-400">Subalmacenes</span>
                        <span className="text-sm font-black text-slate-800 font-mono">{subCount} dados de alta</span>
                      </div>
                      <div className="text-right hidden sm:block">
                        <span className="block text-[10px] uppercase font-mono font-bold text-slate-400">Capacidad Total</span>
                        <span className="text-sm font-black text-slate-800 font-mono">{whCapacity.toLocaleString()} pos.</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenNewSubWarehouse(wh.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition cursor-pointer"
                        title="Dar de alta un nuevo subalmacén para este almacén"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>+ Alta Subalmacén</span>
                      </button>

                      <button
                        onClick={() => handleOpenEditWarehouse(wh)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                        title="Editar información del almacén"
                      >
                        <Edit className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteWarehouse(wh.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Eliminar este almacén"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sub-warehouses Accordion Panel */}
                {isExpanded && (
                  <div className="p-5 bg-slate-50/70 border-t border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-slate-500" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 font-mono">
                          Subalmacenes Dados de Alta en {wh.name} ({subCount})
                        </h3>
                      </div>

                      <button
                        onClick={() => handleOpenNewSubWarehouse(wh.id)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Agregar Subalmacén a {wh.code}</span>
                      </button>
                    </div>

                    {subCount === 0 ? (
                      <div className="bg-white p-6 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
                        <Layers className="h-7 w-7 text-slate-300 mx-auto" />
                        <p className="text-xs font-bold text-slate-600">
                          Aún no hay subalmacenes dados de alta en este almacén.
                        </p>
                        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                          De alta subalmacenes para separar áreas como seco, frío, materiales pesados o jaulas de resguardo.
                        </p>
                        <button
                          onClick={() => handleOpenNewSubWarehouse(wh.id)}
                          className="mt-1 inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Dar de Alta Primer Subalmacén</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3.5">
                        {wh.subWarehouses.map((sub) => {
                          const occPercent = sub.capacityBinsOrUnits 
                            ? Math.round(((sub.currentOccupancy || 0) / sub.capacityBinsOrUnits) * 100) 
                            : 0;

                          return (
                            <div 
                              key={sub.id}
                              className="bg-white p-4 rounded-xl border border-slate-250/90 shadow-2xs hover:shadow-xs transition space-y-3 relative group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span 
                                      className="px-2 py-0.5 rounded font-mono text-[9px] font-black uppercase text-white"
                                      style={{ backgroundColor: wh.color }}
                                    >
                                      {sub.code}
                                    </span>
                                    <h4 className="text-xs font-black text-slate-900">
                                      {sub.name}
                                    </h4>
                                  </div>
                                  <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold">
                                    {sub.storageType}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                                    sub.status === 'Activo' 
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}>
                                    {sub.status}
                                  </span>

                                  <button
                                    onClick={() => handleOpenEditSubWarehouse(sub)}
                                    className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition cursor-pointer"
                                    title="Editar subalmacén"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>

                                  <button
                                    onClick={() => handleDeleteSubWarehouse(wh.id, sub.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                    title="Eliminar subalmacén"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>

                              {sub.description && (
                                <p className="text-[11px] text-slate-500 line-clamp-2">
                                  {sub.description}
                                </p>
                              )}

                              <div className="space-y-1.5 pt-1 border-t border-slate-100 text-[11px]">
                                <div className="flex items-center justify-between text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3 text-slate-400" />
                                    {sub.locationArea || 'Área general'}
                                  </span>
                                  {sub.responsibleOperator && (
                                    <span className="font-medium text-slate-700">
                                      Resp: {sub.responsibleOperator}
                                    </span>
                                  )}
                                </div>

                                {/* Capacity Bar */}
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] font-mono">
                                    <span className="text-slate-400">Ocupación / Capacidad:</span>
                                    <span className="font-bold text-slate-700">
                                      {sub.currentOccupancy || 0} / {sub.capacityBinsOrUnits || 0} ({occPercent}%)
                                    </span>
                                  </div>
                                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full rounded-full transition-all"
                                      style={{ 
                                        width: `${Math.min(occPercent, 100)}%`,
                                        backgroundColor: occPercent > 85 ? '#e11d48' : wh.color || '#3b82f6'
                                      }}
                                    />
                                  </div>
                                </div>

                                {sub.categories && sub.categories.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-100">
                                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">
                                      Categorías:
                                    </span>
                                    {sub.categories.map(c => (
                                      <span key={c} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-150">
                                        {c}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: ALTA / EDICIÓN DE ALMACÉN */}
      {isWarehouseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-250 shadow-2xl w-full max-w-xl overflow-hidden animate-scaleUp">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div 
                  className="h-8 w-8 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: whColor }}
                >
                  <Building2 className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingWarehouse ? 'Editar Almacén Principal' : 'Alta de Nuevo Almacén (Sección)'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configure una sección como OXXO, Construcción, Transporte u otra unidad operativa.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsWarehouseModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                    Nombre del Almacén *
                  </label>
                  <input
                    type="text"
                    required
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                    placeholder="Ej. Almacén OXXO, Almacén Construcción..."
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                    Código / Siglas *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={whCode}
                    onChange={(e) => setWhCode(e.target.value.toUpperCase())}
                    placeholder="Ej. OXXO, CONST, TRANS..."
                    className="w-full text-xs font-mono font-bold uppercase rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                    Giro / Tipo de Sección *
                  </label>
                  <select
                    value={isCustomSectionType ? '__OTHER__' : whSectionType}
                    onChange={(e) => {
                      if (e.target.value === '__OTHER__') {
                        setIsCustomSectionType(true);
                      } else {
                        setIsCustomSectionType(false);
                        setWhSectionType(e.target.value);
                      }
                    }}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-blue-500 focus:outline-none"
                  >
                    {SECTION_TYPES.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                    <option value="__OTHER__">➕ Otro Giro / Sección (especificar de qué se trata...)</option>
                  </select>

                  {isCustomSectionType && (
                    <div className="mt-1.5 p-2 bg-indigo-50 border border-indigo-200 rounded-lg space-y-1 animate-fadeIn">
                      <span className="text-[9.5px] font-bold text-indigo-900 block font-mono">
                        ✏️ ¿De qué se trata el nuevo Giro / Sección?
                      </span>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={customSectionTypeInput}
                          onChange={(e) => {
                            setCustomSectionTypeInput(e.target.value);
                            if (e.target.value.trim()) {
                              setWhSectionType(e.target.value.trim());
                            }
                          }}
                          placeholder="Escriba aquí de qué se trata..."
                          className="grow text-xs font-bold p-1 bg-white border border-indigo-300 rounded text-slate-800 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (customSectionTypeInput.trim()) {
                              setWhSectionType(customSectionTypeInput.trim());
                              setIsCustomSectionType(false);
                            }
                          }}
                          className="px-2 py-1 bg-indigo-600 text-white font-bold text-[10px] rounded cursor-pointer"
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                    Estado Operativo
                  </label>
                  <select
                    value={whStatus}
                    onChange={(e) => setWhStatus(e.target.value as any)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Activo">Activo (En Operación)</option>
                    <option value="Inactivo">Inactivo / Pausado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                  Ubicación Física / Nave / Patio *
                </label>
                <input
                  type="text"
                  required
                  value={whFacilityLocation}
                  onChange={(e) => setWhFacilityLocation(e.target.value)}
                  placeholder="Ej. Nave Central Módulo 1, Parque Industrial Norte, Patio Exterior..."
                  className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                    Responsable / Gerente
                  </label>
                  <input
                    type="text"
                    value={whManagerName}
                    onChange={(e) => setWhManagerName(e.target.value)}
                    placeholder="Ej. Ing. Roberto Sánchez"
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                    Teléfono / Contacto
                  </label>
                  <input
                    type="text"
                    value={whContactPhone}
                    onChange={(e) => setWhContactPhone(e.target.value)}
                    placeholder="Ej. +52 (81) 8123-4567"
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                  Color Distintivo del Almacén
                </label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setWhColor(color)}
                      className={`h-7 w-7 rounded-lg transition-transform cursor-pointer ${
                        whColor === color ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={whColor}
                    onChange={(e) => setWhColor(e.target.value)}
                    className="h-7 w-9 p-0 rounded border cursor-pointer ml-2"
                    title="Color personalizado"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                  Descripción Operativa y Normas
                </label>
                <textarea
                  rows={2}
                  value={whDescription}
                  onChange={(e) => setWhDescription(e.target.value)}
                  placeholder="Detalle el tipo de carga, especificaciones de seguridad o clientes atendidos..."
                  className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Categorías asignadas al Superalmacén */}
              <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                    Categorías Asociadas al Superalmacén
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">({whCategories.length} asignadas)</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Estas categorías estarán disponibles directamente al dar de alta un SKU en este Superalmacén.
                </p>
                <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 bg-white rounded-lg border border-slate-200 max-h-28 overflow-y-auto">
                  {whCategories.map(cat => (
                    <span key={cat} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-250">
                      <span>{cat}</span>
                      <button
                        type="button"
                        onClick={() => setWhCategories(whCategories.filter(c => c !== cat))}
                        className="text-rose-500 hover:text-rose-700 font-black cursor-pointer text-xs"
                        title="Quitar categoría"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {whCategories.length === 0 && (
                    <span className="text-xs text-slate-400 italic py-1">Sin categorías específicas registradas</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newWhCatInput}
                    onChange={(e) => setNewWhCatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const t = newWhCatInput.trim();
                        if (t && !whCategories.includes(t)) {
                          setWhCategories([...whCategories, t]);
                          setNewWhCatInput('');
                        }
                      }
                    }}
                    placeholder="Escriba una categoría y presione Enter..."
                    className="grow text-xs font-semibold rounded-xl border border-slate-300 p-2 text-slate-800 bg-white focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const t = newWhCatInput.trim();
                      if (t && !whCategories.includes(t)) {
                        setWhCategories([...whCategories, t]);
                        setNewWhCatInput('');
                      }
                    }}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                  >
                    + Añadir
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsWarehouseModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: whColor }}
                  className="px-5 py-2 text-white rounded-xl text-xs font-bold shadow-xs hover:opacity-90 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  <span>{editingWarehouse ? 'Guardar Cambios' : 'Dar de Alta Almacén'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ALTA / EDICIÓN DE SUBALMACÉN */}
      {isSubWarehouseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-250 shadow-2xl w-full max-w-xl overflow-hidden animate-scaleUp">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                  <Layers className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingSubWarehouse ? 'Editar Subalmacén' : 'Alta de Nuevo Subalmacén'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Asigne una subsección operativa al almacén seleccionado (ej. Perecederos OXXO, Cemento Construcción, Refacciones Transporte).
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsSubWarehouseModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubWarehouse} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                  Almacén Padre Asociado *
                </label>
                <select
                  required
                  value={targetWarehouseId}
                  onChange={(e) => setTargetWarehouseId(e.target.value)}
                  className="w-full text-xs font-bold rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Seleccione un almacén...</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      [{w.code}] {w.name} ({w.sectionType})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                    Nombre del Subalmacén *
                  </label>
                  <input
                    type="text"
                    required
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    placeholder="Ej. OXXO - Refrigerados, Construcción - Cemento..."
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                    Código de Subalmacén *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={subCode}
                    onChange={(e) => setSubCode(e.target.value.toUpperCase())}
                    placeholder="Ej. OXX-REFR, CST-PES, TRN-REF..."
                    className="w-full text-xs font-mono font-bold uppercase rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                    Tipo de Almacenamiento *
                  </label>
                  <select
                    value={isCustomStorageType ? '__OTHER__' : subStorageType}
                    onChange={(e) => {
                      if (e.target.value === '__OTHER__') {
                        setIsCustomStorageType(true);
                      } else {
                        setIsCustomStorageType(false);
                        setSubStorageType(e.target.value);
                      }
                    }}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  >
                    {STORAGE_TYPES.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                    <option value="__OTHER__">➕ Otro Tipo de Almacenamiento (especificar de qué se trata...)</option>
                  </select>

                  {isCustomStorageType && (
                    <div className="mt-1.5 p-2 bg-indigo-50 border border-indigo-200 rounded-lg space-y-1 animate-fadeIn">
                      <span className="text-[9.5px] font-bold text-indigo-900 block font-mono">
                        ✏️ ¿De qué se trata el nuevo Tipo de Almacenamiento?
                      </span>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={customStorageTypeInput}
                          onChange={(e) => {
                            setCustomStorageTypeInput(e.target.value);
                            if (e.target.value.trim()) {
                              setSubStorageType(e.target.value.trim());
                            }
                          }}
                          placeholder="Escriba aquí de qué se trata..."
                          className="grow text-xs font-bold p-1 bg-white border border-indigo-300 rounded text-slate-800 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (customStorageTypeInput.trim()) {
                              setSubStorageType(customStorageTypeInput.trim());
                              setIsCustomStorageType(false);
                            }
                          }}
                          className="px-2 py-1 bg-indigo-600 text-white font-bold text-[10px] rounded cursor-pointer"
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                    Estado Operativo
                  </label>
                  <select
                    value={subStatus}
                    onChange={(e) => setSubStatus(e.target.value as any)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Activo">Activo (Operativo)</option>
                    <option value="Mantenimiento">En Mantenimiento</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                    Ubicación / Pasillos Asignados
                  </label>
                  <input
                    type="text"
                    value={subLocationArea}
                    onChange={(e) => setSubLocationArea(e.target.value)}
                    placeholder="Ej. Pasillos A01-A04, Patio Exterior Bahía 2..."
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                    Operador / Responsable
                  </label>
                  <input
                    type="text"
                    value={subResponsible}
                    onChange={(e) => setSubResponsible(e.target.value)}
                    placeholder="Ej. Carlos Mendoza"
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                    Capacidad Estimada (Posiciones / Uds)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={subCapacity}
                    onChange={(e) => setSubCapacity(Number(e.target.value))}
                    className="w-full text-xs font-mono font-bold rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                    Ocupación Actual (Uds / Tarimas)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={subOccupancy}
                    onChange={(e) => setSubOccupancy(Number(e.target.value))}
                    className="w-full text-xs font-mono font-bold rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                  Descripción y Notas de Seguridad
                </label>
                <textarea
                  rows={2}
                  value={subDescription}
                  onChange={(e) => setSubDescription(e.target.value)}
                  placeholder="Detalles sobre temperatura, cuidados especiales, acceso restringido..."
                  className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Categorías asignadas al Subalmacén */}
              <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                    Categorías Específicas de este Subalmacén
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">({subCategories.length} asignadas)</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Categorías puntuales para productos almacenados en esta zona (ej. Lácteos, Varilla, Aceites).
                </p>
                <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 bg-white rounded-lg border border-slate-200 max-h-28 overflow-y-auto">
                  {subCategories.map(cat => (
                    <span key={cat} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                      <span>{cat}</span>
                      <button
                        type="button"
                        onClick={() => setSubCategories(subCategories.filter(c => c !== cat))}
                        className="text-rose-500 hover:text-rose-700 font-black cursor-pointer text-xs"
                        title="Quitar categoría"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {subCategories.length === 0 && (
                    <span className="text-xs text-slate-400 italic py-1">Heredará las categorías del Superalmacén</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubCatInput}
                    onChange={(e) => setNewSubCatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const t = newSubCatInput.trim();
                        if (t && !subCategories.includes(t)) {
                          setSubCategories([...subCategories, t]);
                          setNewSubCatInput('');
                        }
                      }
                    }}
                    placeholder="Categoría para este subalmacén..."
                    className="grow text-xs font-semibold rounded-xl border border-slate-300 p-2 text-slate-800 bg-white focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const t = newSubCatInput.trim();
                      if (t && !subCategories.includes(t)) {
                        setSubCategories([...subCategories, t]);
                        setNewSubCatInput('');
                      }
                    }}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                  >
                    + Añadir
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsSubWarehouseModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  <span>{editingSubWarehouse ? 'Guardar Cambios' : 'Dar de Alta Subalmacén'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
