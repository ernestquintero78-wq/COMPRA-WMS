import React, { useState } from 'react';
import { Order, InventoryItem, Bin } from '../types';
import { ClipboardList, Plus, Compass, ShieldAlert, Check, Loader2, ArrowRight } from 'lucide-react';

interface OrdersProps {
  orders: Order[];
  inventory: InventoryItem[];
  bins: Bin[];
  onCreateOrder: (order: Partial<Order>) => Promise<void>;
  onOptimizeOrderPath: (orderId: string, path: string[]) => Promise<void>;
  onCompleteOrder: (orderId: string, shipmentDate?: string, carrier?: string, trackingNumber?: string) => Promise<void>;
}

export const OrdersManager: React.FC<OrdersProps> = ({
  orders,
  inventory,
  bins,
  onCreateOrder,
  onOptimizeOrderPath,
  onCompleteOrder
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [orderType, setOrderType] = useState<string>('Outbound');
  const [customOrderType, setCustomOrderType] = useState<string>('');
  const [priority, setPriority] = useState<string>('Medium');
  const [customPriority, setCustomPriority] = useState<string>('');
  const [assignedTo, setAssignedTo] = useState('Alex Mercer');
  const [orderItems, setOrderItems] = useState<{ sku: string; qty: number }[]>([{ sku: '', qty: 5 }]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  // Shipping details state
  const [carrier, setCarrier] = useState('FedEx');
  const [customCarrier, setCustomCarrier] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shipmentDate, setShipmentDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Sorting helper for picking optimization path (Serpentine routing A->B->C->D)
  const calculateOptimizedPath = (items: { sku: string; qty: number }[]): string[] => {
    // Map each sku item to their storage bin locations in the warehouse
    const targetBins: string[] = [];
    
    items.forEach(it => {
      const storedBins = bins.filter(b => b.occupiedSku === it.sku && b.status !== 'Empty');
      storedBins.forEach(b => {
        if (!targetBins.includes(b.id)) {
          targetBins.push(b.id);
        }
      });
    });

    // Serpentine sorting (Standard Pick Path Optimization)
    // Sort primarily by Aisle alphabetically, then Rack sequentially, then Shelf, then Level
    return [...targetBins].sort((a, b) => {
      const aParts = a.split('-');
      const bParts = b.split('-');
      
      // Compare Aisle
      const aisleCompare = aParts[0].localeCompare(bParts[0]);
      if (aisleCompare !== 0) return aisleCompare;
      
      // Compare Rack
      const rackCompare = aParts[1].localeCompare(bParts[1]);
      if (rackCompare !== 0) return rackCompare;

      // Compare Shelf
      const shelfCompare = aParts[2].localeCompare(bParts[2]);
      if (shelfCompare !== 0) return shelfCompare;

      // Compare Level
      return aParts[3].localeCompare(bParts[3]);
    });
  };

  const activeOrders = orders.filter(o => o.status !== 'Completed' && o.status !== 'Canceled');
  const pastOrders = orders.filter(o => o.status === 'Completed' || o.status === 'Canceled');

  const addItemRow = () => {
    setOrderItems([...orderItems, { sku: '', qty: 5 }]);
  };

  const updateItemRow = (idx: number, field: 'sku' | 'qty', val: any) => {
    const updated = [...orderItems];
    updated[idx] = { ...updated[idx], [field]: val };
    setOrderItems(updated);
  };

  const removeItemRow = (idx: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== idx));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const filteredItems = orderItems.filter(item => item.sku !== '');
    if (filteredItems.length === 0) return;

    try {
      setIsBusy(true);
      const effectiveType = orderType === '__OTHER__' ? (customOrderType.trim() || 'Personalizado') : orderType;
      const effectivePriority = priority === '__OTHER__' ? (customPriority.trim() || 'Normal') : priority;
      await onCreateOrder({
        id: `ORD-${typeShortCode(effectiveType)}-${Math.floor(Date.now() / 1000).toString().substring(5)}`,
        type: effectiveType,
        priority: effectivePriority,
        status: 'Pending',
        dateCreated: new Date().toISOString(),
        items: filteredItems,
        assignedTo
      });
      setShowCreateForm(false);
      setOrderItems([{ sku: '', qty: 5 }]);
      setCustomOrderType('');
      setCustomPriority('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsBusy(false);
    }
  };

  const typeShortCode = (type: string) => type === 'Inbound' ? 'IN' : 'OUT';

  const handleOptimizePath = async (order: Order) => {
    const path = calculateOptimizedPath(order.items);
    if (path.length === 0) {
      alert("Nota: ¡La orden seleccionada hace referencia a un SKU que no tiene celdas de stock asignadas!");
      return;
    }
    await onOptimizeOrderPath(order.id, path);
  };

  const triggerCompleteOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setCarrier('FedEx');
    setTrackingNumber('');
    setShipmentDate(new Date().toISOString().split('T')[0]);
    setShowConfirmModal(true);
  };

  const handleConfirmDispatched = async () => {
    if (!selectedOrderId) return;
    try {
      setIsBusy(true);
      const effectiveCarrier = carrier === '__OTHER__' ? (customCarrier.trim() || 'Personalizado') : carrier;
      await onCompleteOrder(selectedOrderId, shipmentDate, effectiveCarrier, trackingNumber);
      setShowConfirmModal(false);
      setCustomCarrier('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header controls */}
      <div className="flex items-center justify-between bg-white border border-slate-100 rounded-2xl shadow-xs p-5">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
            <ClipboardList className="h-5 w-5 text-blue-500" />
            Flujo de Órdenes Operativas
          </h2>
          <p className="text-xs text-slate-400">
            Procese listas de surtido (picking), organice entregas de entrada y salidas de almacén activas.
          </p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-700 active:scale-98 transition text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow"
          >
            <Plus className="h-4.5 w-4.5" />
            Crear Orden de WMS
          </button>
        )}
      </div>

      {/* Order Creation form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-6 animate-fade-in">
          <div className="flex justify-between items-center border-b border-slate-50 pb-3">
            <span className="font-bold text-slate-700 text-sm">Crear Nuevo Nodo de Orden Operativa</span>
            <button type="button" onClick={() => setShowCreateForm(false)} className="text-slate-400 hover:text-slate-600 text-sm">
              ✕ Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Tipo de Orden</label>
              <select
                value={orderType}
                onChange={(e: any) => setOrderType(e.target.value)}
                className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="Outbound">Salida de Almacén (Outbound - Surtido/Salida)</option>
                <option value="Inbound">Entrada (Inbound - Reabastecimiento)</option>
                <option value="__OTHER__">➕ Otro (especificar de qué se trata...)</option>
              </select>
              {orderType === '__OTHER__' && (
                <div className="mt-1.5 p-2 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1 animate-fadeIn">
                  <span className="text-[9px] font-mono font-bold text-blue-900 block">✏️ Especifique el Tipo de Orden:</span>
                  <input
                    type="text"
                    value={customOrderType}
                    onChange={(e) => setCustomOrderType(e.target.value)}
                    placeholder="Ej. Transferencia interna, Devolución de cliente..."
                    className="w-full text-xs font-semibold p-1.5 bg-white border border-blue-300 rounded text-slate-800 focus:outline-none"
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Nivel de Prioridad</label>
              <select
                value={priority}
                onChange={(e: any) => setPriority(e.target.value)}
                className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="Low">Prioridad Baja</option>
                <option value="Medium">Prioridad Media</option>
                <option value="High">Prioridad Alta (Urgente)</option>
                <option value="Critical">Crítica (Emergencia)</option>
                <option value="__OTHER__">➕ Otro (especificar de qué se trata...)</option>
              </select>
              {priority === '__OTHER__' && (
                <div className="mt-1.5 p-2 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1 animate-fadeIn">
                  <span className="text-[9px] font-mono font-bold text-blue-900 block">✏️ Especifique el Nivel de Prioridad:</span>
                  <input
                    type="text"
                    value={customPriority}
                    onChange={(e) => setCustomPriority(e.target.value)}
                    placeholder="Ej. Muestra comercial, Garantía prioritaria..."
                    className="w-full text-xs font-semibold p-1.5 bg-white border border-blue-300 rounded text-slate-800 focus:outline-none"
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Asignar Encargado</label>
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="Nombre del surtidor/operador"
                className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Dynamic Item Rows */}
          <div className="space-y-3">
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Lista de Cantidad de SKUs Ordenados</span>
            {orderItems.map((row, idx) => (
              <div key={idx} className="flex gap-3 items-center">
                <div className="grow">
                  <select
                    value={row.sku}
                    onChange={(e) => updateItemRow(idx, 'sku', e.target.value)}
                    className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none"
                    required
                  >
                    <option value="">-- Seleccionar SKU --</option>
                    {inventory.map((item) => (
                      <option key={item.sku} value={item.sku}>
                        {item.sku} ({item.name} - stock: {item.qty} unidades)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <input
                    type="number"
                    min="1"
                    value={row.qty}
                    onChange={(e) => updateItemRow(idx, 'qty', Number(e.target.value))}
                    className="w-full text-xs font-semibold rounded-lg border border-slate-200 p-2 text-slate-700 focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                {orderItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItemRow(idx)}
                    className="text-rose-500 hover:text-rose-700 text-xs shrink-0 font-bold px-1"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addItemRow}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 pt-1"
            >
              + Agregar otro artículo
            </button>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-50">
            <button
              type="submit"
              disabled={isBusy}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2"
            >
              {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              Procesar Salida de Almacén
            </button>
          </div>
        </form>
      )}

      {/* Operational Active list */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 overflow-hidden">
        <h3 className="text-sm font-bold text-slate-700 tracking-tight uppercase mb-4">
          Cola de Órdenes Activas en Bodega
        </h3>

        {activeOrders.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400 font-medium">
            No hay órdenes activas pendientes de tareas operativas. Haga clic en "Crear Orden de WMS" arriba.
          </div>
        ) : (
          <div className="space-y-4">
            {activeOrders.map((order) => {
              const hasRunOptimization = order.optimizedPath && order.optimizedPath.length > 0;
              return (
                <div
                  key={order.id}
                  className="border border-slate-100 rounded-2xl p-5 hover:shadow-xs transition duration-150 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-extrabold text-slate-800 text-sm select-all">
                        {order.id}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${
                        order.type === 'Inbound' 
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-600' 
                          : 'bg-blue-50 border-blue-100 text-blue-600'
                      }`}>
                        {order.type === 'Inbound' ? 'Entrada' : 'Salida'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${
                        order.priority === 'Critical' ? 'bg-rose-100 border-rose-200 text-rose-700 animate-pulse' :
                        order.priority === 'High' ? 'bg-orange-100 border-orange-200 text-orange-700' :
                        'bg-slate-150 border-slate-200 text-slate-600'
                      }`}>
                        Prioridad {order.priority === 'Critical' ? 'Crítica' : order.priority === 'High' ? 'Alta' : order.priority === 'Medium' ? 'Media' : 'Baja'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 font-medium pr-5">
                      <span>Encargado: <strong className="text-slate-600">{order.assignedTo}</strong></span>
                      <span>Fecha Creación: <strong className="text-slate-600">{new Date(order.dateCreated).toLocaleString()}</strong></span>
                      <span>Estado Operativo: <strong className="text-blue-600 font-bold">{order.status === 'Pending' ? 'Pendiente' : order.status}</strong></span>
                    </div>

                    <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-3 max-w-xl">
                      <span className="block text-[8px] font-bold text-slate-400 uppercase font-mono tracking-wider mb-1.5">Lista de inventario de carga</span>
                      <div className="flex flex-wrap gap-3">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex gap-1 bg-white border border-slate-100 px-2.5 py-1 rounded-md text-xs font-mono font-bold text-slate-700 shadow-xs">
                            <span>{item.sku}</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-blue-600">{item.qty} unidades</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions column */}
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 justify-end">
                    
                    {/* Path optimization only matches Outbound picking tasks */}
                    {order.type === 'Outbound' && (
                      <button
                        onClick={() => handleOptimizePath(order)}
                        className={`px-4 py-2.5 rounded-xl text-xs text-slate-700 font-bold uppercase border tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition ${
                          hasRunOptimization 
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                            : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-98'
                        }`}
                      >
                        <Compass className="h-4.5 w-4.5 text-blue-500" />
                        {hasRunOptimization ? 'Ruta de Surtido Calculada' : 'Optimizar Ruta de Surtido'}
                      </button>
                    )}

                    <button
                      onClick={() => triggerCompleteOrder(order.id)}
                      className="bg-blue-600 hover:bg-blue-700 active:scale-98 transition text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 shadow"
                    >
                      <Check className="h-4.5 w-4.5" />
                      Marcar Completada
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historical Dispatch logs list */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 overflow-hidden">
        <h3 className="text-sm font-bold text-slate-700 tracking-tight uppercase mb-4">
          Archivos de WMS Registrados
        </h3>
        <div className="overflow-x-auto">
          {pastOrders.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400 font-medium">
              Historial de auditoría limpio. No se encontraron órdenes históricas completadas.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 text-left">ID DE ARCHIVO</th>
                  <th className="pb-3 text-left">ESTADO DE OPERACIÓN</th>
                  <th className="pb-3 text-left">OPERADOR ASIGNADO</th>
                  <th className="pb-3 text-right">FECHA Y HORA DE SALIDA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {pastOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50">
                    <td className="py-3 font-mono font-bold text-slate-800">
                      {order.id}
                      <span className={`ml-2 inline-block px-1.5 py-0.5 rounded text-[8px] font-bold ${
                        order.type === 'Inbound' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {order.type === 'Inbound' ? 'Entrada' : 'Salida'}
                      </span>
                    </td>
                    <td className="py-3 text-slate-500 font-medium font-sans">
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                        <Check className="h-3 w-3" />
                        Archivada / Completada
                      </span>
                      {order.carrier && (
                        <span className="block text-[10px] text-slate-450 mt-1 font-semibold">
                          🚚 {order.carrier} - GUÍA: <span className="font-mono font-bold text-slate-700">{order.trackingNumber}</span> ({order.shipmentDate})
                        </span>
                      )}
                    </td>
                    <td className="py-3 font-medium text-slate-600">
                      {order.assignedTo}
                    </td>
                    <td className="py-3 text-right text-slate-400 font-mono">
                      {new Date(order.dateCreated).toLocaleDateString()} {new Date(order.dateCreated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Confirmation warning modal with stock checking and shipment details registration */}
      {showConfirmModal && (() => {
        const order = orders.find(o => o.id === selectedOrderId);
        if (!order) return null;

        // Perform stock availability verification
        const stockVerification = order.items.map(oItem => {
          const invItem = inventory.find(i => i.sku === oItem.sku);
          const currentStock = invItem ? invItem.qty : 0;
          const hasEnough = currentStock >= oItem.qty;
          return {
            sku: oItem.sku,
            name: invItem ? invItem.name : 'Artículo Desconocido',
            requested: oItem.qty,
            available: currentStock,
            hasEnough
          };
        });

        const hasInsufficientStock = stockVerification.some(v => !v.hasEnough);

        return (
          <div className="fixed inset-0 bg-slate-950/45 flex items-center justify-center z-50 p-4 font-sans select-none">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full p-6 animate-scale-up text-xs max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-2 text-blue-500 mb-4 border-b border-slate-50 pb-3">
                <ShieldAlert className="h-5 w-5 text-blue-500" />
                <h4 className="font-bold text-slate-800 text-sm leading-none">
                  Confirmación de Salida de Almacén WMS (Orden: {order.id})
                </h4>
              </div>

              {/* 1. Stock verification panel */}
              <div className="mb-5 space-y-2.5">
                <span className="block font-bold text-slate-700 uppercase tracking-wider text-[10px]">1. Verificación de Disponibilidad de Stock</span>
                <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                  <div className="p-3 space-y-2">
                    {stockVerification.map(v => (
                      <div key={v.sku} className="flex justify-between items-center gap-4 py-1 border-b border-slate-100 last:border-0">
                        <div>
                          <span className="font-mono font-bold text-slate-800 block text-[10px]">{v.sku}</span>
                          <span className="text-slate-500 block text-[9px] font-medium">{v.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] block font-mono">Requerido: <strong>{v.requested}</strong> | Disponible: <strong>{v.available}</strong></span>
                          {v.hasEnough ? (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] bg-emerald-50 border border-emerald-100 text-emerald-600 font-bold mt-0.5">✔ Disponible</span>
                          ) : (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] bg-rose-50 border border-rose-100 text-rose-600 font-bold mt-0.5">✘ Insuficiente</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {hasInsufficientStock && (
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-rose-700 text-[10px] font-semibold leading-relaxed">
                    ⚠️ Error: No hay suficiente stock en el almacén para cumplir con esta salida. Ajuste los niveles de stock o complete recepciones manuales de inventario antes de archivar esta orden.
                  </div>
                )}
              </div>

              {/* 2. Shipping Details Registration */}
              <div className="mb-6 space-y-3">
                <span className="block font-bold text-slate-700 uppercase tracking-wider text-[10px]">2. Registrar Enrutamiento de Envío (Protocolo de Transportista)</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Fecha de Envío</label>
                    <input
                      type="date"
                      value={shipmentDate}
                      onChange={(e) => setShipmentDate(e.target.value)}
                      className="w-full text-[10px] font-mono border border-slate-200 p-2 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Transportista Logístico</label>
                    <select
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      className="w-full text-[10px] font-sans font-semibold border border-slate-200 p-2 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500"
                    >
                      <option value="DHL Express">DHL Express</option>
                      <option value="FedEx">FedEx Internacional</option>
                      <option value="UPS Services">Servicios de UPS</option>
                      <option value="Correos Express">Correos Express</option>
                      <option value="Local Courier">Mensajería Local</option>
                      <option value="__OTHER__">➕ Otro (especificar de qué se trata...)</option>
                    </select>
                    {carrier === '__OTHER__' && (
                      <div className="mt-1 p-1.5 bg-blue-50/70 border border-blue-200 rounded-lg space-y-0.5 animate-fadeIn">
                        <span className="text-[9px] font-mono font-bold text-blue-900 block">✏️ Especifique el Transportista:</span>
                        <input
                          type="text"
                          value={customCarrier}
                          onChange={(e) => setCustomCarrier(e.target.value)}
                          placeholder="Ej. Tres Guerras, Castores, Estafeta..."
                          className="w-full text-[10px] font-sans font-semibold border border-blue-300 p-1.5 rounded text-slate-800 bg-white focus:outline-none"
                          required
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Número de Guía (Tracking)</label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g. TRK-98317762"
                      className="w-full text-[10px] font-mono border border-slate-200 p-2 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-50 pt-4">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-xs font-bold uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (hasInsufficientStock) {
                      alert("Error: Stock insuficiente. No se puede procesar la salida de la orden.");
                      return;
                    }
                    if (!trackingNumber.trim()) {
                      alert("Por favor, proporcione un código de seguimiento del transportista.");
                      return;
                    }
                    await handleConfirmDispatched();
                  }}
                  disabled={hasInsufficientStock || isBusy}
                  className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-white ${
                    hasInsufficientStock || isBusy
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-98 transition shadow'
                  }`}
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Enviar Orden y Descontar Stock
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
