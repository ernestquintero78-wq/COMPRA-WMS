import { supabase } from './lib/supabaseClient';
import { Bin, InventoryItem, Order, ActivityLog } from './types';

const env = (import.meta as any).env || {};
const isSupabaseConfigured = env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY && !env.VITE_SUPABASE_URL.includes('placeholder');

let forceLocalFallback = !isSupabaseConfigured;

// Helper template generators
export const getTemplateBins = () => {
  const templateBins: any[] = [];
  const aisles = ['A', 'B', 'C', 'D'];
  const racks = ['01', '02'];
  const shelves = ['S1', 'S2'];
  const levels = ['L1', 'L2', 'L3'];

  for (const aisle of aisles) {
    for (const rack of racks) {
      for (const shelf of shelves) {
        for (const level of levels) {
          const id = `${aisle}-${rack}-${shelf}-${level}`;
          let maxW = 500;
          if (level === 'L3') maxW = 100;
          if (level === 'L1') maxW = 1000;

          let sku = '';
          let qty = 0;
          let status = 'Empty';

          if (aisle === 'A' && rack === '01' && shelf === 'S1' && level === 'L1') {
            sku = 'ROB-CPU-i7';
            qty = 40;
            status = 'Partial';
          } else if (aisle === 'A' && rack === '01' && shelf === 'S1' && level === 'L2') {
            sku = 'BATT-LIPO-SM';
            qty = 150;
            status = 'Full';
          } else if (aisle === 'B' && rack === '02' && shelf === 'S2' && level === 'L1') {
            sku = 'SENS-PROX-24';
            qty = 80;
            status = 'Partial';
          }

          templateBins.push({
            id,
            aisle,
            rack,
            shelf,
            level,
            max_weight: maxW,
            max_volume: 50,
            occupied_sku: sku || null,
            occupied_qty: qty,
            status
          });
        }
      }
    }
  }
  return templateBins;
};

export const getTemplateInventory = () => [
  {
    sku: 'ROB-CPU-i7',
    name: 'Industrial Controller i7',
    description: 'Heavy-duty processing module for CNC & robotic units',
    category: 'Electronics',
    qty: 40,
    min_qty: 10,
    expiration_date: '2030-12-31',
    unit_width: 30,
    unit_height: 10,
    unit_length: 20,
    unit_weight: 4.5,
    supplier: 'Texas Dynamics',
    cost: 350.50,
    barcode: '7501020304012',
    image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=150&h=150&q=80'
  },
  {
    sku: 'BATT-LIPO-SM',
    name: 'LiPo Battery Pack 12V',
    description: 'High capacity lithium polymer cells for smart power systems',
    category: 'Hazmat',
    qty: 150,
    min_qty: 50,
    expiration_date: '2028-06-30',
    unit_width: 15,
    unit_height: 5,
    unit_length: 8,
    unit_weight: 0.8,
    supplier: 'AmpGen Power Solutions',
    cost: 45.00,
    barcode: '7501020304029',
    image_url: 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&w=150&h=150&q=80'
  },
  {
    sku: 'SENS-PROX-24',
    name: 'Laser Range Sensor 24V',
    description: 'ToF proximity measuring optic with laser feedback',
    category: 'Sensors',
    qty: 80,
    min_qty: 25,
    expiration_date: '2031-01-01',
    unit_width: 5,
    unit_height: 5,
    unit_length: 12,
    unit_weight: 0.2,
    supplier: 'OpticVibe Tech',
    cost: 89.90,
    barcode: '7501020304036',
    image_url: 'https://images.unsplash.com/photo-1555664424-778a1e5e1b48?auto=format&fit=crop&w=150&h=150&q=80'
  },
  {
    sku: 'CAB-ARM-HF',
    name: 'Armored Heavy Field Cable',
    description: 'Shielded high-throughput physical trunk cabler',
    category: 'Cables',
    qty: 0,
    min_qty: 15,
    expiration_date: null,
    unit_width: 60,
    unit_height: 60,
    unit_length: 20,
    unit_weight: 15.0,
    supplier: 'KabelWerk AG',
    cost: 120.00,
    barcode: '7501020304043',
    image_url: 'https://images.unsplash.com/photo-1551703599-6b3dbb57c24e?auto=format&fit=crop&w=150&h=150&q=80'
  }
];

export const getTemplateOrders = () => [
  {
    id: 'SO-2026-001',
    type: 'Outbound',
    priority: 'High',
    status: 'Pending',
    date_created: '2026-06-16T10:30:00Z',
    items: [{ sku: 'ROB-CPU-i7', qty: 5 }, { sku: 'SENS-PROX-24', qty: 2 }],
    assigned_to: 'Alex Mercer',
    optimized_path: [],
    shipment_date: null,
    carrier: null,
    tracking_number: null
  },
  {
    id: 'PO-2026-002',
    type: 'Inbound',
    priority: 'Medium',
    status: 'Pending',
    date_created: '2026-06-16T11:15:00Z',
    items: [{ sku: 'CAB-ARM-HF', qty: 10 }],
    assigned_to: 'Unassigned',
    optimized_path: [],
    shipment_date: null,
    carrier: null,
    tracking_number: null
  }
];

export const getTemplateLogs = () => [
  {
    id: 'LOG-0001',
    timestamp: '2026-06-16T12:00:00Z',
    user: 'System',
    action: 'Initialize Database',
    details: 'Warehouse Database established with 48 automated slots and initial inventory list.'
  }
];

// Helper to seed initial data if tables are empty (using Supabase if configured, otherwise localStorage)
export const initializeSupabaseDatabase = async (): Promise<void> => {
  if (forceLocalFallback) {
    console.log('Using offline local storage fallback. Skipping Supabase initialization.');
    return;
  }

  try {
    // 1. Check Bins
    const { data: existingBins, error: binsError } = await supabase
      .from('bins')
      .select('id')
      .limit(1);

    if (binsError) {
      console.warn('Supabase check bins failed, switching to local fallback:', binsError.message);
      forceLocalFallback = true;
      return;
    }

    if (!existingBins || existingBins.length === 0) {
      console.log('Seeding initial bins to Supabase...');
      const { error: seedBinsErr } = await supabase.from('bins').insert(getTemplateBins());
      if (seedBinsErr) console.error('Error seeding bins:', seedBinsErr);
    }

    // 2. Check Inventory
    const { data: existingInventory, error: invError } = await supabase
      .from('inventory')
      .select('sku')
      .limit(1);

    if (invError) {
      console.warn('Supabase check inventory failed, switching to local fallback:', invError.message);
      forceLocalFallback = true;
      return;
    }

    if (!existingInventory || existingInventory.length === 0) {
      console.log('Seeding initial inventory to Supabase...');
      const { error: seedInvErr } = await supabase.from('inventory').insert(getTemplateInventory());
      if (seedInvErr) console.error('Error seeding inventory:', seedInvErr);
    }

    // 3. Check Orders
    const { data: existingOrders, error: ordError } = await supabase
      .from('orders')
      .select('id')
      .limit(1);

    if (ordError) {
      console.warn('Supabase check orders failed, switching to local fallback:', ordError.message);
      forceLocalFallback = true;
      return;
    }

    if (!existingOrders || existingOrders.length === 0) {
      console.log('Seeding initial orders to Supabase...');
      const { error: seedOrdErr } = await supabase.from('orders').insert(getTemplateOrders());
      if (seedOrdErr) console.error('Error seeding orders:', seedOrdErr);
    }

    // 4. Check Logs
    const { data: existingLogs, error: logError } = await supabase
      .from('logs')
      .select('id')
      .limit(1);

    if (logError) {
      console.warn('Supabase check logs failed, switching to local fallback:', logError.message);
      forceLocalFallback = true;
      return;
    }

    if (!existingLogs || existingLogs.length === 0) {
      console.log('Seeding initial logs to Supabase...');
      const { error: seedLogsErr } = await supabase.from('logs').insert(getTemplateLogs());
      if (seedLogsErr) console.error('Error seeding logs:', seedLogsErr);
    }

  } catch (err) {
    console.warn('Failed to initialize Supabase, switching to local fallback:', err);
    forceLocalFallback = true;
  }
};

// Local storage getter wrappers
const getLocalBinsList = (): any[] => {
  const saved = localStorage.getItem('wms_local_bins');
  if (saved) {
    try { return JSON.parse(saved); } catch { }
  }
  const defaults = getTemplateBins();
  localStorage.setItem('wms_local_bins', JSON.stringify(defaults));
  return defaults;
};

const getLocalInventoryList = (): any[] => {
  const saved = localStorage.getItem('wms_local_inventory');
  if (saved) {
    try { return JSON.parse(saved); } catch { }
  }
  const defaults = getTemplateInventory();
  localStorage.setItem('wms_local_inventory', JSON.stringify(defaults));
  return defaults;
};

const getLocalOrdersList = (): any[] => {
  const saved = localStorage.getItem('wms_local_orders');
  if (saved) {
    try { return JSON.parse(saved); } catch { }
  }
  const defaults = getTemplateOrders();
  localStorage.setItem('wms_local_orders', JSON.stringify(defaults));
  return defaults;
};

const getLocalLogsList = (): any[] => {
  const saved = localStorage.getItem('wms_local_logs');
  if (saved) {
    try { return JSON.parse(saved); } catch { }
  }
  const defaults = getTemplateLogs();
  localStorage.setItem('wms_local_logs', JSON.stringify(defaults));
  return defaults;
};

// Fetch all WMS records (with full localStorage offline fallback)
export const fetchWMSData = async () => {
  await initializeSupabaseDatabase();

  if (forceLocalFallback) {
    console.log('WMS fetchWMSData using local storage fallback');
    const localBins = getLocalBinsList();
    const localInv = getLocalInventoryList();
    const localOrd = getLocalOrdersList();
    const localLogs = getLocalLogsList();

    const bins: Bin[] = localBins.map((row: any) => ({
      id: row.id,
      aisle: row.aisle,
      rack: row.rack,
      shelf: row.shelf,
      level: row.level,
      maxWeight: Number(row.max_weight || 0),
      maxVolume: Number(row.max_volume || 0),
      occupiedSku: row.occupied_sku || '',
      occupiedQty: Number(row.occupied_qty || 0),
      status: row.status as any
    }));

    const inventory: InventoryItem[] = localInv.map((row: any) => ({
      sku: row.sku,
      name: row.name,
      description: row.description || '',
      category: row.category,
      qty: Number(row.qty || 0),
      minQty: Number(row.min_qty || 0),
      expirationDate: row.expiration_date || '',
      unitWidth: Number(row.unit_width || 0),
      unitHeight: Number(row.unit_height || 0),
      unitLength: Number(row.unit_length || 0),
      unitWeight: Number(row.unit_weight || 0),
      supplier: row.supplier || '',
      cost: Number(row.cost || 0),
      barcode: row.barcode || '',
      imageUrl: row.image_url || ''
    }));

    const orders: Order[] = localOrd.map((row: any) => {
      let itemsArr = [];
      if (typeof row.items === 'string') {
        try { itemsArr = JSON.parse(row.items); } catch { itemsArr = []; }
      } else if (Array.isArray(row.items)) {
        itemsArr = row.items;
      }

      let pathArr = [];
      if (typeof row.optimized_path === 'string') {
        try { pathArr = JSON.parse(row.optimized_path); } catch { pathArr = []; }
      } else if (Array.isArray(row.optimized_path)) {
        pathArr = row.optimized_path;
      }

      return {
        id: row.id,
        type: row.type as any,
        priority: row.priority as any,
        status: row.status as any,
        dateCreated: row.date_created,
        items: itemsArr,
        assignedTo: row.assigned_to || '',
        optimizedPath: pathArr,
        shipmentDate: row.shipment_date || '',
        carrier: row.carrier || '',
        trackingNumber: row.tracking_number || ''
      };
    });

    const logs: ActivityLog[] = localLogs.map((row: any) => ({
      id: row.id,
      timestamp: row.timestamp,
      user: row.user,
      action: row.action,
      details: row.details
    }));

    return { bins, inventory, orders, logs };
  }

  try {
    const [binsResult, inventoryResult, ordersResult, logsResult] = await Promise.all([
      supabase.from('bins').select('*').order('id', { ascending: true }),
      supabase.from('inventory').select('*').order('sku', { ascending: true }),
      supabase.from('orders').select('*').order('date_created', { ascending: false }),
      supabase.from('logs').select('*').order('timestamp', { ascending: false })
    ]);

    if (binsResult.error || inventoryResult.error || ordersResult.error || logsResult.error) {
      throw new Error('Supabase error detected in batch fetch');
    }

    const bins: Bin[] = (binsResult.data || []).map((row: any) => ({
      id: row.id,
      aisle: row.aisle,
      rack: row.rack,
      shelf: row.shelf,
      level: row.level,
      maxWeight: Number(row.max_weight || 0),
      maxVolume: Number(row.max_volume || 0),
      occupiedSku: row.occupied_sku || '',
      occupiedQty: Number(row.occupied_qty || 0),
      status: row.status as any
    }));

    const inventory: InventoryItem[] = (inventoryResult.data || []).map((row: any) => ({
      sku: row.sku,
      name: row.name,
      description: row.description || '',
      category: row.category,
      qty: Number(row.qty || 0),
      minQty: Number(row.min_qty || 0),
      expirationDate: row.expiration_date || '',
      unitWidth: Number(row.unit_width || 0),
      unitHeight: Number(row.unit_height || 0),
      unitLength: Number(row.unit_length || 0),
      unitWeight: Number(row.unit_weight || 0),
      supplier: row.supplier || '',
      cost: Number(row.cost || 0),
      barcode: row.barcode || '',
      imageUrl: row.image_url || ''
    }));

    const orders: Order[] = (ordersResult.data || []).map((row: any) => {
      let itemsArr = [];
      if (typeof row.items === 'string') {
        try { itemsArr = JSON.parse(row.items); } catch { itemsArr = []; }
      } else if (Array.isArray(row.items)) {
        itemsArr = row.items;
      }

      let pathArr = [];
      if (typeof row.optimized_path === 'string') {
        try { pathArr = JSON.parse(row.optimized_path); } catch { pathArr = []; }
      } else if (Array.isArray(row.optimized_path)) {
        pathArr = row.optimized_path;
      }

      return {
        id: row.id,
        type: row.type as any,
        priority: row.priority as any,
        status: row.status as any,
        dateCreated: row.date_created,
        items: itemsArr,
        assignedTo: row.assigned_to || '',
        optimizedPath: pathArr,
        shipmentDate: row.shipment_date || '',
        carrier: row.carrier || '',
        trackingNumber: row.tracking_number || ''
      };
    });

    const logs: ActivityLog[] = (logsResult.data || []).map((row: any) => ({
      id: row.id,
      timestamp: row.timestamp,
      user: row.user,
      action: row.action,
      details: row.details
    }));

    return { bins, inventory, orders, logs };

  } catch (err) {
    console.warn('Failed to fetch from Supabase, returning local storage fallback instead:', err);
    forceLocalFallback = true;
    return fetchWMSData(); // retry using local fallback
  }
};

// Bulk Upsert functions
export const saveWMSSupabaseData = async (
  type: 'Bins' | 'Inventory' | 'Orders' | 'Logs',
  rows: any[]
): Promise<void> => {
  if (type === 'Bins') {
    const binsToUpsert = rows.map(b => ({
      id: b[0],
      aisle: b[1],
      rack: b[2],
      shelf: b[3],
      level: b[4],
      max_weight: Number(b[5]),
      max_volume: Number(b[6]),
      occupied_sku: b[7] || null,
      occupied_qty: Number(b[8]),
      status: b[9]
    }));

    if (forceLocalFallback) {
      localStorage.setItem('wms_local_bins', JSON.stringify(binsToUpsert));
      return;
    }

    try {
      const { error } = await supabase.from('bins').upsert(binsToUpsert, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    } catch (err) {
      console.warn('Supabase save bins failed, writing locally instead:', err);
      localStorage.setItem('wms_local_bins', JSON.stringify(binsToUpsert));
    }

  } else if (type === 'Inventory') {
    const invToUpsert = rows.map(i => ({
      sku: i[0],
      name: i[1],
      description: i[2] || null,
      category: i[3],
      qty: Number(i[4]),
      min_qty: Number(i[5]),
      expiration_date: i[6] || null,
      unit_width: Number(i[7]),
      unit_height: Number(i[8]),
      unit_length: Number(i[9]),
      unit_weight: Number(i[10]),
      supplier: i[11] || null,
      cost: Number(i[12]),
      barcode: i[13] || null,
      image_url: i[14] || null
    }));

    if (forceLocalFallback) {
      localStorage.setItem('wms_local_inventory', JSON.stringify(invToUpsert));
      return;
    }

    try {
      const { error } = await supabase.from('inventory').upsert(invToUpsert, { onConflict: 'sku' });
      if (error) throw new Error(error.message);
    } catch (err) {
      console.warn('Supabase save inventory failed, writing locally instead:', err);
      localStorage.setItem('wms_local_inventory', JSON.stringify(invToUpsert));
    }

  } else if (type === 'Orders') {
    const ordToUpsert = rows.map(o => {
      let parsedItems = [];
      try { parsedItems = typeof o[5] === 'string' ? JSON.parse(o[5]) : o[5]; } catch { parsedItems = []; }

      let parsedPath = [];
      try { parsedPath = typeof o[7] === 'string' ? JSON.parse(o[7]) : o[7]; } catch { parsedPath = []; }

      return {
        id: o[0],
        type: o[1],
        priority: o[2],
        status: o[3],
        date_created: o[4],
        items: parsedItems,
        assigned_to: o[6] || null,
        optimized_path: parsedPath,
        shipment_date: o[8] || null,
        carrier: o[9] || null,
        tracking_number: o[10] || null
      };
    });

    if (forceLocalFallback) {
      localStorage.setItem('wms_local_orders', JSON.stringify(ordToUpsert));
      return;
    }

    try {
      const { error } = await supabase.from('orders').upsert(ordToUpsert, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    } catch (err) {
      console.warn('Supabase save orders failed, writing locally instead:', err);
      localStorage.setItem('wms_local_orders', JSON.stringify(ordToUpsert));
    }

  } else if (type === 'Logs') {
    const logsToUpsert = rows.map(l => ({
      id: l[0],
      timestamp: l[1],
      user: l[2],
      action: l[3],
      details: l[4]
    }));

    if (forceLocalFallback) {
      localStorage.setItem('wms_local_logs', JSON.stringify(logsToUpsert));
      return;
    }

    try {
      const { error } = await supabase.from('logs').upsert(logsToUpsert, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    } catch (err) {
      console.warn('Supabase save logs failed, writing locally instead:', err);
      localStorage.setItem('wms_local_logs', JSON.stringify(logsToUpsert));
    }
  }
};

// Write a log directly
export const appendActivityLog = async (
  user: string,
  action: string,
  details: string
): Promise<boolean> => {
  const timestamp = new Date().toISOString();
  const id = `LOG-${Math.floor(Date.now() / 1000)}-${Math.floor(Math.random() * 1000)}`;

  if (forceLocalFallback) {
    const localLogs = getLocalLogsList();
    localLogs.unshift({ id, timestamp, user, action, details });
    localStorage.setItem('wms_local_logs', JSON.stringify(localLogs.slice(0, 500)));
    return true;
  }

  try {
    const { error } = await supabase.from('logs').insert({
      id,
      timestamp,
      user,
      action,
      details
    });

    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    console.warn('Supabase append log failed, logging locally instead:', err);
    const localLogs = getLocalLogsList();
    localLogs.unshift({ id, timestamp, user, action, details });
    localStorage.setItem('wms_local_logs', JSON.stringify(localLogs.slice(0, 500)));
    return true;
  }
};
