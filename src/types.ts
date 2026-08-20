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
}
