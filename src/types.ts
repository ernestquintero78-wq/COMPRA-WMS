export interface Bin {
  id: string;         // e.g., "A-01-S1-L1" (Aisle-Rack-Shelf-Level)
  aisle: string;      // "A", "B", "C", "D"
  rack: string;       // "01", "02", "03"
  shelf: string;      // "S1", "S2"
  level: string;      // "L1", "L2", "L3"
  maxWeight: number;  // in kg
  maxVolume: number;  // in m3
  occupiedSku: string; // SKU or empty
  occupiedQty: number; // Qty of items
  status: 'Empty' | 'Partial' | 'Full';
}

export interface InventoryItem {
  sku: string;
  name: string;
  description: string;
  category: string;
  qty: number;
  minQty: number;
  expirationDate: string;
  unitWidth: number; // cm
  unitHeight: number; // cm
  unitLength: number; // cm
  unitWeight: number; // kg
  supplier: string;
  cost?: number; // Cost of the item
  barcode?: string; // Barcode corresponding to the item
  imageUrl?: string; // Optional product image URL
  superWarehouseId?: string; // ID of Superalmacén (e.g., 'wh-oxxo', 'wh-const', 'wh-trans')
  superWarehouseName?: string; // e.g., 'Almacén OXXO'
  warehouseId?: string; // ID of Almacén / Subalmacén (e.g., 'sub-oxxo-01')
  warehouseName?: string; // e.g., 'OXXO - Perecederos y Cámara Fría'
}

export interface OrderItem {
  sku: string;
  qty: number;
}

export interface Order {
  id: string;
  type: 'Inbound' | 'Outbound';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Pending' | 'Picking' | 'Completed' | 'Canceled';
  dateCreated: string;
  items: OrderItem[];
  assignedTo: string;
  optimizedPath?: string[]; // Bin IDs in visit order
  shipmentDate?: string;     // Date shipped
  carrier?: string;          // Shipping carrier
  trackingNumber?: string;   // Carrier tracking code
  destination?: string;      // Destination or customer
  deliveryMethod?: string;   // Delivery / dispatch method
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export interface CycleCountSession {
  sku: string;
  date: string;
  physical: number;
  system: number;
  deviation: number;
  responsible?: string;
  batchId?: string;
  notes?: string;
}

export interface ConcludedAuditReport {
  id: string;
  folio: string;
  date: string;
  responsible: string;
  responsibleRole: string;
  supervisor: string;
  location: string;
  totalItems: number;
  accurateItems: number;
  discrepantItems: number;
  accuracyRate: number;
  totalPhysicalQty: number;
  totalSystemQty: number;
  netDeviation: number;
  notes?: string;
  timestamp: string;
  items: {
    sku: string;
    name: string;
    category: string;
    location: string;
    system: number;
    physical: number;
    deviation: number;
    cost?: number;
  }[];
}

export interface PlatformTheme {
  logoUrl?: string;
  logoType: 'image' | 'preset';
  presetIcon: 'boxes' | 'truck' | 'package' | 'warehouse' | 'shield' | 'database';
  platformName: string;
  versionTag: string;
  primaryColor: string;
  sidebarColor: string;
  canvasBg: 'slate' | 'gray' | 'zinc' | 'dark';
}

export interface SubWarehouse {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  description?: string;
  storageType: string;
  capacityBinsOrUnits?: number;
  currentOccupancy?: number;
  locationArea?: string;
  responsibleOperator?: string;
  status: 'Activo' | 'Mantenimiento' | 'Inactivo';
  categories?: string[]; // Categories assigned to this subwarehouse
  createdAt: string;
}

export interface WarehouseSection {
  id: string;
  code: string;
  name: string;
  sectionType: string;
  description?: string;
  facilityLocation: string;
  managerName?: string;
  contactEmail?: string;
  contactPhone?: string;
  color: string;
  categories?: string[]; // Categories assigned to this superwarehouse
  subWarehouses: SubWarehouse[];
  status: 'Activo' | 'Inactivo';
  createdAt: string;
}
