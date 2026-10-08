import React, { useState, useEffect } from 'react';
import { Order, InventoryItem, Bin } from '../types';
import { OperatorProfile } from './CrewManager';
import { 
  Trello, Plus, Calendar, User, ArrowRight, ArrowLeft, Trash2, CheckCircle2, 
  Layers, Hammer, PackageCheck, AlertCircle, ShoppingBag, Clock, PlusCircle
} from 'lucide-react';

export interface KanbanTask {
  id: string;
  title: string;
  orderId?: string;
  stage: 'entry' | 'picking' | 'exit';
  assignedOperatorId: string;
  assignedOperatorName: string;
  dueDate: string;
  clientName: string;
  products: { sku: string; qty: number }[];
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  notes: string;
  createdAt: string;
}

interface KanbanBoardProps {
  orders: Order[];
  inventory: InventoryItem[];
  bins: Bin[];
  onCompleteOrder?: (orderId: string, shipmentDate?: string, carrier?: string, trackingNumber?: string) => Promise<void>;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ 
  orders, 
  inventory, 
  bins,
  onCompleteOrder 
}) => {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [crew, setCrew] = useState<OperatorProfile[]>([]);

  // Form toggles & fields
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [clientName, setClientName] = useState('');
  const [assignedOperatorId, setAssignedOperatorId] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [notes, setNotes] = useState('');
  const [taskProducts, setTaskProducts] = useState<{ sku: string; qty: number }[]>([{ sku: '', qty: 5 }]);

  // Load crew and tasks
  useEffect(() => {
    // Crew loading
    const savedCrew = localStorage.getItem('OWMS_CREW_MEMBERS');
    if (savedCrew) {
      setCrew(JSON.parse(savedCrew));
    }

    // Tasks loading or initial setup
    const savedTasks = localStorage.getItem('OWMS_KANBAN_TASKS');
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    } else {
      // Seed initial tasks based on existing active Orders if any, or generate creative default demo data
      const defaultTasks: KanbanTask[] = [
        {
          id: 'TSK-101',
          title: 'Surtido de Componentes Electrónicos',
          orderId: 'ORD-OUT-342A',
          stage: 'entry',
          assignedOperatorId: 'OP-101',
          assignedOperatorName: 'Alex Mercer',
          dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          clientName: 'Robótica de México S.A.',
          products: [{ sku: 'ROB-CPU-i7', qty: 4 }, { sku: 'SENS-PROX-24', qty: 10 }],
          priority: 'High',
          notes: 'Frágil, requiere empaque acolchado para transporte terrestre.',
          createdAt: new Date().toISOString()
        },
        {
          id: 'TSK-102',
          title: 'Surtido de baterías de alto rendimiento',
          orderId: 'ORD-OUT-119B',
          stage: 'picking',
          assignedOperatorId: 'OP-102',
          assignedOperatorName: 'María Delgado',
          dueDate: new Date(Date.now() + 172800000).toISOString().split('T')[0],
          clientName: 'Baterías y Litio Monterrey',
          products: [{ sku: 'BATT-LIPO-SM', qty: 25 }],
          priority: 'Critical',
          notes: 'Verificar sellado de seguridad en contenedor de seguridad estándar.',
          createdAt: new Date().toISOString()
        },
        {
          id: 'TSK-103',
          title: 'Recepción y Despacho Sensores Térmicos',
          orderId: 'ORD-OUT-992C',
          stage: 'exit',
          assignedOperatorId: 'OP-103',
          assignedOperatorName: 'Héctor Gómez',
          dueDate: new Date(Date.now() - 43200000).toISOString().split('T')[0],
          clientName: 'Sistemas Industriales del Norte',
          products: [{ sku: 'SENS-PROX-24', qty: 15 }],
          priority: 'Medium',
          notes: 'Enviar por FedEx Priority.',
          createdAt: new Date().toISOString()
        }
      ];
      setTasks(defaultTasks);
      localStorage.setItem('OWMS_KANBAN_TASKS', JSON.stringify(defaultTasks));
    }
  }, [orders]);

  // Sync back crew anytime localstorage updates (e.g. if tabs are switched)
  useEffect(() => {
    const handleStorageChange = () => {
      const savedCrew = localStorage.getItem('OWMS_CREW_MEMBERS');
      if (savedCrew) setCrew(JSON.parse(savedCrew));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const saveTasksList = (updatedTasks: KanbanTask[]) => {
    setTasks(updatedTasks);
    localStorage.setItem('OWMS_KANBAN_TASKS', JSON.stringify(updatedTasks));
  };

  // Create new task handler
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validProducts = taskProducts.filter(p => p.sku !== '');
    if (validProducts.length === 0) {
      alert('Error: Debe agregar por lo menos un producto para registrar la tarea de picking/salida.');
      return;
    }

    const matchedOp = crew.find(o => o.id === assignedOperatorId);
    const opName = matchedOp ? matchedOp.name : 'Administrador Logística';

    const newTask: KanbanTask = {
      id: `TSK-${Math.floor(200 + Math.random() * 800)}`,
      title: taskTitle.trim() || `Picking de Salida - ${clientName}`,
      orderId: selectedOrderId || undefined,
      stage: 'entry', // starts at entry/inbound pipeline stage
      assignedOperatorId: assignedOperatorId || 'admin',
      assignedOperatorName: opName,
      dueDate,
      clientName: clientName.trim() || 'Veneer Cliente Genérico',
      products: validProducts,
      priority,
      notes: notes.trim(),
      createdAt: new Date().toISOString()
    };

    const nextTasks = [newTask, ...tasks];
    saveTasksList(nextTasks);

    // Reset fields
    setTaskTitle('');
    setSelectedOrderId('');
    setClientName('');
    setAssignedOperatorId('');
    setNotes('');
    setPriority('Medium');
    setTaskProducts([{ sku: '', qty: 5 }]);
    setShowCreateForm(false);
  };

  const handleAddTaskProductRow = () => {
    setTaskProducts([...taskProducts, { sku: '', qty: 5 }]);
  };

  const handleUpdateTaskProductRow = (idx: number, field: 'sku' | 'qty', val: any) => {
    const updated = [...taskProducts];
    updated[idx] = { ...updated[idx], [field]: val };
    setTaskProducts(updated);
  };

  const handleRemoveTaskProductRow = (idx: number) => {
    setTaskProducts(taskProducts.filter((_, i) => i !== idx));
  };

  // Move task step
  const handleTransitionTask = (taskId: string, direction: 'forward' | 'backward') => {
    const updated = tasks.map(t => {
      if (t.id === taskId) {
        let nextStage: 'entry' | 'picking' | 'exit' = t.stage;
        if (direction === 'forward') {
          if (t.stage === 'entry') nextStage = 'picking';
          else if (t.stage === 'picking') nextStage = 'exit';
        } else {
          if (t.stage === 'exit') nextStage = 'picking';
          else if (t.stage === 'picking') nextStage = 'entry';
        }
        return { ...t, stage: nextStage };
      }
      return t;
    });
    saveTasksList(updated);
  };

  // Fast auto-setup task from an existing outbound order
  const handleLoadOrderTemplate = (orderId: string) => {
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;

    setSelectedOrderId(ord.id);
    setClientName(ord.assignedTo || 'Cliente Externo');
    setTaskTitle(`Procesar Surtido Fiel - ${ord.id}`);
    
    // Convert order items to task layout
    const formatted = ord.items.map(itm => ({ sku: itm.sku, qty: itm.qty }));
    setTaskProducts(formatted);
  };

  const handleDeleteTask = (taskId: string) => {
    if (confirm('¿Está seguro de eliminar esta tarea de la planeación Kanban?')) {
      const filtered = tasks.filter(t => t.id !== taskId);
      saveTasksList(filtered);
    }
  };

  // Filters for board
  const entryTasks = tasks.filter(t => t.stage === 'entry');
  const pickingTasks = tasks.filter(t => t.stage === 'picking');
  const exitTasks = tasks.filter(t => t.stage === 'exit');

  // Calculate percentages
  const totalCount = tasks.length;
  const entryPercentage = totalCount > 0 ? Math.round((entryTasks.length / totalCount) * 100) : 0;
  const pickingPercentage = totalCount > 0 ? Math.round((pickingTasks.length / totalCount) * 100) : 0;
  const exitPercentage = totalCount > 0 ? Math.round((exitTasks.length / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      
      {/* Banner Principal */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-md border border-slate-700/50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                <Trello className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-extrabold tracking-widest uppercase font-mono text-slate-300">
                Flujo de Trabajo Logístico & Kanban
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Monitoree en tiempo real las fases operativas de cada orden. Gestione la asignación de tareas de picking para el cumplimiento en las rampas de salida.
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer shadow transition"
          >
            <Plus className="h-4 w-4" />
            {showCreateForm ? 'Cerrar Gestor' : 'Establecer Tarea de Salida'}
          </button>
        </div>
      </div>

      {/* METRICAS DE PROGRESO DE KANBAN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Por Recibir / Entrada</span>
            <h4 className="text-2xl font-extrabold text-slate-800">{entryTasks.length} <span className="text-xs text-slate-400 font-normal">tareas</span></h4>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-slate-500">{entryPercentage}%</span>
            <div className="w-16 h-2 bg-slate-200 rounded-full mt-1 overflow-hidden">
              <div className="bg-amber-500 h-full" style={{ width: `${entryPercentage}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Surtido Activo / Picking</span>
            <h4 className="text-2xl font-extrabold text-slate-800">{pickingTasks.length} <span className="text-xs text-slate-400 font-normal">tareas</span></h4>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-slate-500">{pickingPercentage}%</span>
            <div className="w-16 h-2 bg-slate-200 rounded-full mt-1 overflow-hidden">
              <div className="bg-blue-500 h-full" style={{ width: `${pickingPercentage}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Fase de Despacho / Salida</span>
            <h4 className="text-2xl font-extrabold text-slate-800">{exitTasks.length} <span className="text-xs text-slate-400 font-normal">tareas</span></h4>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-slate-500">{exitPercentage}%</span>
            <div className="w-16 h-2 bg-slate-200 rounded-full mt-1 overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: `${exitPercentage}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* REGISTRO / FORMULARIO CREATIVO DE NUEVAS TAREAS PARA SECCIÓN SALIDA */}
      {showCreateForm && (
        <form onSubmit={handleCreateTask} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-start">
            <div>
              <h3 className="text-xs font-extrabold font-mono text-slate-700 uppercase">Establecer Nueva Ficha de Trabajo (Fulfillment Exit)</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Asigne responsabilidades, fije fechas límites e indique materiales de picking requeridos.</p>
            </div>
            
            {/* Auto loaders from standard Orders templates */}
            {orders.filter(o => o.status === 'Pending' && o.type === 'Outbound').length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-slate-400 font-bold uppercase font-mono">Pedir Templatizar:</span>
                <select 
                  onChange={(e) => handleLoadOrderTemplate(e.target.value)}
                  className="p-1 text-[9px] rounded border border-slate-200 font-mono"
                >
                  <option value="">-- Cargar Pedidos Outbound --</option>
                  {orders.filter(o => o.status === 'Pending' && o.type === 'Outbound').map(o => (
                    <option key={o.id} value={o.id}>{o.id} ({o.assignedTo})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-extrabold text-slate-400 mb-1.5 tracking-wider">Título de la Tarea</label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Ej: Conteo y Picking Pallet ROB-i7"
                className="w-full text-xs rounded-lg border border-slate-200 p-2.5 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-extrabold text-slate-400 mb-1.5 tracking-wider">Cliente de Destino</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej: Robótica de Morelia S.A."
                className="w-full text-xs rounded-lg border border-slate-200 p-2.5 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-extrabold text-slate-400 mb-1.5 tracking-wider">Operador Responsable (Asignado)</label>
              <select
                value={assignedOperatorId}
                onChange={(e) => setAssignedOperatorId(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 p-2.5 bg-white text-slate-700"
                required
              >
                <option value="">-- Seleccione Operador --</option>
                {crew.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name} [{member.role}]
                  </option>
                ))}
                {crew.length === 0 && (
                  <option value="admin">Administrador Logística (Default)</option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-[10px] uppercase font-extrabold text-slate-400 mb-1.5 tracking-wider">Fecha Límite ("Para Cuándo")</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 p-2.5 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-extrabold text-slate-400 mb-1.5 tracking-wider">ID de Orden Ligada (Opcional)</label>
              <input
                type="text"
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                placeholder="Ej: ORD-OUT-1029"
                className="w-full text-xs font-mono rounded-lg border border-slate-200 p-2.5 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-extrabold text-slate-400 mb-1.5 tracking-wider">Prioridad Ejecutiva</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full text-xs rounded-lg border border-slate-200 p-2.5 bg-white text-slate-700"
              >
                <option value="Low">Baja prioridad (Low)</option>
                <option value="Medium">Prioridad Media (Medium)</option>
                <option value="High">Alta prioridad (High)</option>
                <option value="Critical">Urgente / Crítica (Critical)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-extrabold text-slate-400 mb-1.5 tracking-wider">Observaciones Técnicas / Notas de Bodega</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas aclaratorias sobre empaque, lote, rampas, transportistas..."
              rows={2}
              className="w-full text-xs rounded-lg border border-slate-200 p-2.5 focus:border-blue-500"
            ></textarea>
          </div>

          {/* ASIGNADOR DE MATERIALES / SKUS (WHAT PRODUCTS) */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-150">
              <span className="text-[10px] font-extrabold font-mono text-slate-600 uppercase">Productos Requeridos para Selección (Items)</span>
              <button
                type="button"
                onClick={handleAddTaskProductRow}
                className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-bold"
              >
                <PlusCircle className="h-3 w-3" /> Agregar SKU
              </button>
            </div>

            <div className="space-y-2">
              {taskProducts.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <div className="flex-1">
                    <select
                      value={row.sku}
                      onChange={(e) => handleUpdateTaskProductRow(idx, 'sku', e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 font-mono bg-white text-slate-700"
                      required
                    >
                      <option value="">-- Seleccione SKU stock --</option>
                      {inventory.map(item => (
                        <option key={item.sku} value={item.sku}>
                          {item.sku} - {item.name} (Stock: {item.qty})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-28 text-center shrink-0">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={row.qty}
                      onChange={(e) => handleUpdateTaskProductRow(idx, 'qty', Number(e.target.value))}
                      className="w-full text-xs font-mono font-bold p-2 rounded-lg border border-slate-200 text-center"
                      required
                    />
                  </div>
                  {taskProducts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTaskProductRow(idx)}
                      className="text-rose-500 hover:text-rose-700 p-2"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs uppercase tracking-wider shadow active:scale-98 cursor-pointer"
            >
              Registrar & Desplegar en Kanban
            </button>
          </div>
        </form>
      )}

      {/* TABLERO KANBAN DE TRES COLUMNAS (ENTRY -> PICKING -> EXIT) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA 1: ENTRADA (Inbound / Entry) */}
        <div className="bg-slate-100/60 p-4 rounded-2xl border border-slate-200/50 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
              <span className="text-xs font-extrabold font-mono tracking-wider text-slate-700 uppercase">1. ENTRADA (Entry)</span>
            </div>
            <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-slate-500 font-mono font-bold">
              {entryTasks.length} Tareas
            </span>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {entryTasks.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-slate-200 bg-white rounded-xl">
                <span>No hay tareas pendientes en Entrada.</span>
              </div>
            ) : (
              entryTasks.map(task => (
                <KanbanCard 
                  key={task.id} 
                  task={task} 
                  onMove={handleTransitionTask} 
                  onDelete={handleDeleteTask}
                />
              ))
            )}
          </div>
        </div>

        {/* COLUMNA 2: PICKING (Surtido / Ruta) */}
        <div className="bg-slate-100/60 p-4 rounded-2xl border border-slate-200/50 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              <span className="text-xs font-extrabold font-mono tracking-wider text-slate-700 uppercase">2. SURTIDO (Picking)</span>
            </div>
            <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-slate-500 font-mono font-bold">
              {pickingTasks.length} Tareas
            </span>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {pickingTasks.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-slate-200 bg-white rounded-xl">
                <span>No hay tareas activas en Picking.</span>
              </div>
            ) : (
              pickingTasks.map(task => (
                <KanbanCard 
                  key={task.id} 
                  task={task} 
                  onMove={handleTransitionTask} 
                  onDelete={handleDeleteTask}
                />
              ))
            )}
          </div>
        </div>

        {/* COLUMNA 3: SALIDA (Exit / Ready to Ship) */}
        <div className="bg-slate-100/60 p-4 rounded-2xl border border-slate-200/50 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-xs font-extrabold font-mono tracking-wider text-slate-700 uppercase">3. SALIDA (Exit)</span>
            </div>
            <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-slate-500 font-mono font-bold">
              {exitTasks.length} Tareas
            </span>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {exitTasks.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-slate-200 bg-white rounded-xl">
                <span>No hay tareas completadas en Salida.</span>
              </div>
            ) : (
              exitTasks.map(task => (
                <KanbanCard 
                  key={task.id} 
                  task={task} 
                  onMove={handleTransitionTask} 
                  onDelete={handleDeleteTask}
                />
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

// CHILD CARD COMPONENT FOR ELEGANT MODULATION
interface KanbanCardProps {
  task: KanbanTask;
  onMove: (id: string, direction: 'forward' | 'backward') => void;
  onDelete: (id: string) => void;
}

const KanbanCard: React.FC<KanbanCardProps> = ({ task, onMove, onDelete }) => {
  const isOverdue = new Date(task.dueDate) < new Date() && task.stage !== 'exit';

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-350 hover:shadow-xs transition space-y-3 text-xs select-none">
      
      {/* Target status / badge */}
      <div className="flex justify-between items-start gap-2">
        <span className="text-[9px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-black">
          {task.id}
        </span>
        <div className="flex items-center gap-1">
          {isOverdue && (
            <span className="bg-rose-50 text-rose-600 border border-rose-100 text-[8px] font-extrabold px-1.5 rounded animate-pulse uppercase">
              RETRASADO
            </span>
          )}
          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
            task.priority === 'Critical' ? 'bg-rose-50 border-rose-200 text-rose-700 font-black' :
            task.priority === 'High' ? 'bg-amber-50 border-amber-200 text-amber-700' :
            task.priority === 'Medium' ? 'bg-blue-50 border-blue-200 text-blue-700' :
            'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            {task.priority === 'Critical' ? 'Crítica' : task.priority === 'High' ? 'Alta' : task.priority === 'Medium' ? 'Media' : 'Baja'}
          </span>
        </div>
      </div>

      <div className="space-y-0.5">
        <h5 className="font-extrabold text-slate-800 leading-snug">{task.title}</h5>
        <span className="text-[10px] text-slate-400 font-semibold block">Cliente: {task.clientName}</span>
      </div>

      {/* Product breakdown list inside Kanban card */}
      <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg space-y-1">
        <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block">Materiales Surtidos:</span>
        {task.products.map((p, idx) => (
          <div key={idx} className="flex justify-between text-[10px] font-mono leading-none">
            <span className="text-slate-600 truncate max-w-[120px] font-semibold">{p.sku}</span>
            <span className="text-slate-800 font-bold">{p.qty}u</span>
          </div>
        ))}
      </div>

      {/* Operator assign detail */}
      <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex flex-col gap-1 font-semibold leading-relaxed">
        <div className="flex items-center gap-1">
          <User className="h-3 w-3 text-slate-400" />
          <span>Responsable: <span className="font-bold text-slate-700">{task.assignedOperatorName}</span></span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-slate-400" />
          <span>Para: <span className="font-bold text-slate-700">{task.dueDate}</span></span>
        </div>
        {task.notes && (
          <p className="text-[9px] text-slate-400 font-normal italic mt-1 line-clamp-1">
             ✏ {task.notes}
          </p>
        )}
      </div>

      {/* Action controls (Move, delete, etc) */}
      <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
        
        {/* Left move */}
        {task.stage !== 'entry' ? (
          <button 
            type="button"
            onClick={() => onMove(task.id, 'backward')}
            className="flex items-center text-[10px] text-slate-500 hover:text-slate-800 font-bold gap-0.5 transition cursor-pointer"
          >
            <ArrowLeft className="h-3 w-3" />
            Atrás
          </button>
        ) : <div />}

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          className="text-slate-350 hover:text-rose-600 transition p-1"
          title="Eliminar tarea permanente"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        {/* Right move */}
        {task.stage !== 'exit' ? (
          <button
            type="button"
            onClick={() => onMove(task.id, 'forward')}
            className="flex items-center text-[10px] text-blue-600 hover:text-blue-800 font-black gap-0.5 transition cursor-pointer"
          >
            Siguiente
            <ArrowRight className="h-3 w-3" />
          </button>
        ) : (
          <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-black">
            <CheckCircle2 className="h-3 h-3 text-emerald-500" />
            Surtido
          </span>
        )}

      </div>

    </div>
  );
};
