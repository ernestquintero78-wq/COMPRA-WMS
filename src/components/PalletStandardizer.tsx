import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { Layers, Plus, ShieldAlert, Barcode, Printer, Weight, Maximize2, Trash2 } from 'lucide-react';

export interface PalletStandard {
  id: string;
  name: string;
  assignedSku: string;
  unitsPerPallet: number;
  widthCm: number;
  lengthCm: number;
  heightCm: number;
  tareWeightKg: number;
  maxLoadKg: number;
  material: 'Madera' | 'Plástico' | 'Acero' | 'Cartón';
}

interface PalletStandardizerProps {
  inventory: InventoryItem[];
}

export const PalletStandardizer: React.FC<PalletStandardizerProps> = ({ inventory }) => {
  const [palletList, setPalletList] = useState<PalletStandard[]>([
    {
      id: 'PLT-STD-001',
      name: 'Tarima Estándar Americana ROB-CPU',
      assignedSku: 'ROB-CPU-i7',
      unitsPerPallet: 20,
      widthCm: 100,
      lengthCm: 120,
      heightCm: 140,
      tareWeightKg: 25,
      maxLoadKg: 1200,
      material: 'Madera'
    },
    {
      id: 'PLT-STD-002',
      name: 'Eurotarima Plástica BATT-LIPO',
      assignedSku: 'BATT-LIPO-SM',
      unitsPerPallet: 50,
      widthCm: 80,
      lengthCm: 120,
      heightCm: 110,
      tareWeightKg: 18,
      maxLoadKg: 1000,
      material: 'Plástico'
    },
    {
      id: 'PLT-STD-003',
      name: 'Tarima Industrial de Acero SENS',
      assignedSku: 'SENS-PROX-24',
      unitsPerPallet: 100,
      widthCm: 100,
      lengthCm: 120,
      heightCm: 120,
      tareWeightKg: 35,
      maxLoadKg: 1800,
      material: 'Acero'
    }
  ]);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [assignedSku, setAssignedSku] = useState('');
  const [unitsPerPallet, setUnitsPerPallet] = useState<number>(50);
  const [widthCm, setWidthCm] = useState<number>(100);
  const [lengthCm, setLengthCm] = useState<number>(120);
  const [heightCm, setHeightCm] = useState<number>(120);
  const [tareWeightKg, setTareWeightKg] = useState<number>(20);
  const [maxLoadKg, setMaxLoadKg] = useState<number>(1200);
  const [material, setMaterial] = useState<'Madera' | 'Plástico' | 'Acero' | 'Cartón'>('Madera');

  const [notification, setNotification] = useState<'registered' | 'deleted' | null>(null);

  // Print simulator
  const [printingPallet, setPrintingPallet] = useState<PalletStandard | null>(null);

  const handleCreatePallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newPallet: PalletStandard = {
      id: `PLT-STD-${Math.floor(100 + Math.random() * 900)}`,
      name: name.trim(),
      assignedSku,
      unitsPerPallet,
      widthCm,
      lengthCm,
      heightCm,
      tareWeightKg,
      maxLoadKg,
      material
    };

    setPalletList([newPallet, ...palletList]);
    setShowForm(false);
    setNotification('registered');
    setTimeout(() => setNotification(null), 4000);

    // Reset fields
    setName('');
    setAssignedSku('');
    setUnitsPerPallet(50);
    setWidthCm(100);
    setLengthCm(120);
    setHeightCm(120);
    setTareWeightKg(20);
    setMaxLoadKg(1200);
    setMaterial('Madera');
  };

  const handleDeletePallet = (id: string) => {
    setPalletList(palletList.filter(p => p.id !== id));
    setNotification('deleted');
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="space-y-6">
      
      {/* Banner de Bienvenida */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-md border border-slate-700/50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                <Layers className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-extrabold tracking-widest uppercase font-mono text-slate-300">
                Estandarización de Tarimas (Pallets)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Defina las dimensiones, peso bruto, capacidad técnica y estandarización del producto por tarima para la carga automatizada y movimientos de picking.
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer shadow transition"
          >
            <Plus className="h-4 w-4" />
            {showForm ? 'Cerrar Registro' : 'Dar de Alta Tarima'}
          </button>
        </div>
      </div>

      {notification && (
        <div className={`p-4 rounded-xl border text-xs font-bold leading-relaxed ${
          notification === 'registered' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          {notification === 'registered' ? '✓ ¡Nueva tarima estandarizada con éxito en la base de datos de ingeniería!' : '⚠ Tarima de referencia eliminada del catálogo.'}
        </div>
      )}

      {/* Formulario de Alta */}
      {showForm && (
        <form onSubmit={handleCreatePallet} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold font-mono text-slate-700 uppercase">Nueva Ficha Técnica de Tarima</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Defina medidas de cubicación y peso límite de seguridad.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Nombre Estándar / Identificador</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tarima Euro ROB-i7 Reforzada"
                className="w-full text-xs rounded-lg border border-slate-200 p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Material de Fabricación</label>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value as any)}
                className="w-full text-xs rounded-lg border border-slate-200 p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none bg-white"
              >
                <option value="Madera">Madera (Tradicional)</option>
                <option value="Plástico">Plástico (Higiénico)</option>
                <option value="Acero">Acero (Carga Pesada)</option>
                <option value="Cartón">Cartón (Carga Ligera)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">SKU de Material Asignado</label>
              <select
                value={assignedSku}
                onChange={(e) => setAssignedSku(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 p-2.5 text-slate-700 focus:border-blue-500 focus:outline-none bg-white font-mono"
                required
              >
                <option value="">-- Seleccionar SKU --</option>
                {inventory.map(item => (
                  <option key={item.sku} value={item.sku}>
                    {item.sku} - {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Unidades por Tarima (Capacidad)</label>
              <input
                type="number"
                min="1"
                value={unitsPerPallet}
                onChange={(e) => setUnitsPerPallet(Number(e.target.value))}
                className="w-full text-xs font-semibold rounded-lg border border-slate-200 p-2.5 text-slate-700 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Peso Vacío de Tarima (Tare - kg)</label>
              <input
                type="number"
                min="1"
                value={tareWeightKg}
                onChange={(e) => setTareWeightKg(Number(e.target.value))}
                className="w-full text-xs font-semibold rounded-lg border border-slate-200 p-2.5 text-slate-700 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Carga Máxima Permitida (kg) </label>
              <input
                type="number"
                min="1"
                value={maxLoadKg}
                onChange={(e) => setMaxLoadKg(Number(e.target.value))}
                className="w-full text-xs font-semibold rounded-lg border border-slate-200 p-2.5 text-slate-700 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Altura Standard Armada (cm)</label>
              <input
                type="number"
                min="1"
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="w-full text-xs font-semibold rounded-lg border border-slate-200 p-2.5 text-slate-700 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Ancho Base (cm)</label>
              <input
                type="number"
                min="1"
                value={widthCm}
                onChange={(e) => setWidthCm(Number(e.target.value))}
                className="w-full text-xs rounded-lg border border-slate-200 p-2.5 text-slate-700 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Largo Base (cm)</label>
              <input
                type="number"
                min="1"
                value={lengthCm}
                onChange={(e) => setLengthCm(Number(e.target.value))}
                className="w-full text-xs rounded-lg border border-slate-200 p-2.5 text-slate-700 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs uppercase tracking-wider cursor-pointer"
            >
              Registrar Estándar de Tarima
            </button>
          </div>
        </form>
      )}

      {/* Grid de Fichas Técnicas Activas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {palletList.map((pallet) => {
          const product = inventory.find(i => i.sku === pallet.assignedSku);
          const activeInventoryQty = product?.qty || 0;
          const estimatedPalletsNeeded = activeInventoryQty > 0 
            ? Math.ceil(activeInventoryQty / pallet.unitsPerPallet) 
            : 0;
            
          const weightOfFilledPalletKg = pallet.tareWeightKg + (product ? (product.unitWeight * pallet.unitsPerPallet) : 0);

          return (
            <div key={pallet.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[9px] font-mono font-bold text-slate-500">
                    {pallet.id}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                    pallet.material === 'Madera' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                    pallet.material === 'Plástico' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                    pallet.material === 'Acero' ? 'bg-slate-100 border-slate-300 text-slate-800' :
                    'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    {pallet.material}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xs font-extrabold text-slate-800 leading-snug">{pallet.name}</h3>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-black text-indigo-700">
                      {pallet.assignedSku}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold truncate leading-none">
                      {product?.name || 'Inbound Material'}
                    </span>
                  </div>
                </div>

                {/* Technical Specifications */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-[10px]">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block uppercase font-bold text-[8px]">Dimensiones</span>
                    <span className="font-mono text-slate-700 font-bold block mt-0.5">
                      {pallet.lengthCm}x{pallet.widthCm}x{pallet.heightCm} cm
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block uppercase font-bold text-[8px]">Unidades p/Tarima</span>
                    <span className="font-mono text-slate-700 font-bold block mt-0.5">
                      {pallet.unitsPerPallet} unds
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block uppercase font-bold text-[8px]">Peso Vacío (Tare)</span>
                    <span className="font-mono text-slate-700 font-bold block mt-0.5">
                      {pallet.tareWeightKg} kg
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block uppercase font-bold text-[8px]">Carga Máxima</span>
                    <span className="font-mono text-slate-700 font-bold block mt-0.5">
                      {pallet.maxLoadKg} kg
                    </span>
                  </div>
                </div>

                {/* Calculations based on current stock */}
                <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50 text-[11px] leading-relaxed space-y-1 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-500">Stock actual:</span>
                    <span className="font-mono font-bold text-slate-700">{activeInventoryQty} unidades</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-500">Tarimas requeridas:</span>
                    <span className="font-mono font-black text-indigo-700 underline">{estimatedPalletsNeeded} tarimas</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-500">Peso Tarima Armada:</span>
                    <span className="font-mono font-bold text-slate-700">{weightOfFilledPalletKg.toFixed(1)} kg</span>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => setPrintingPallet(pallet)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold py-2 rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  <Printer className="h-3 w-3" />
                  Imprimir Ticket
                </button>
                <button
                  onClick={() => handleDeletePallet(pallet.id)}
                  className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 p-2 rounded-lg transition"
                  title="Eliminar estándar de tarima"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL SIMULADOR VERIFICADOR DE IMPRESIÓN */}
      {printingPallet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center text-slate-800">
              <span className="text-xs font-mono font-extrabold uppercase tracking-wide">Impresora Industrial Zebra WMS</span>
              <button onClick={() => setPrintingPallet(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            {/* Render Sticker */}
            <div className="border-4 border-dashed border-slate-300 p-4 rounded-2xl bg-white text-slate-900 space-y-4 font-mono select-none">
              <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                <div>
                  <span className="text-[10px] font-black tracking-widest block">OPERATIONS TAG</span>
                  <span className="text-[8px] text-slate-500 font-bold block mt-0.5">STD TARIMA ID: {printingPallet.id}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-black border border-slate-800 px-1 py-0.5 rounded">
                    {printingPallet.material.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-center">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">MATERIAL ESTÁNDAR</span>
                <span className="text-xs font-black tracking-tight block">{printingPallet.name}</span>
                <span className="text-base font-black px-2 bg-slate-100 block py-1 border border-slate-300 rounded font-mono tracking-widest mt-1">
                  {printingPallet.assignedSku}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[9px] border-t border-b border-slate-800 py-2">
                <div>
                  <span className="text-slate-400 block text-[7px] font-bold">CANTIDAD ESTÁNDAR</span>
                  <strong className="text-[11px] block">{printingPallet.unitsPerPallet} UNIDADES</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[7px] font-bold">DIMENSIONES MAX</span>
                  <strong className="text-[11px] block">
                    {printingPallet.widthCm}x{printingPallet.lengthCm}x{printingPallet.heightCm} cm
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[7px] font-bold">PESO VACÍO</span>
                  <strong className="text-[11px] block">{printingPallet.tareWeightKg} KG</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[7px] font-bold">LÍMITE CARGA</span>
                  <strong className="text-[11px] block">{printingPallet.maxLoadKg} KG</strong>
                </div>
              </div>

              {/* Simulated barcode */}
              <div className="text-center space-y-1 flex flex-col items-center">
                <div className="space-y-0.5 tracking-tightest leading-none font-sans text-slate-800 scale-y-150 py-1 select-none">
                  |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
                </div>
                <span className="text-[9px] tracking-[6px] font-bold text-center block mt-1.5 pl-1.5">
                  *{printingPallet.id}*
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                window.print();
                setPrintingPallet(null);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider block text-center"
            >
              Confirmar & Mandar a Imprimir
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
