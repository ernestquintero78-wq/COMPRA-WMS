import React, { useState } from 'react';
import { Bin, InventoryItem } from '../types';
import { Workflow, Boxes, Loader2, ArrowRightLeft, ShieldAlert, Check } from 'lucide-react';

interface PutawayOptimizerProps {
  bins: Bin[];
  inventory: InventoryItem[];
  onCommitPutaway: (assignments: { sku: string; qty: number; binId: string }[]) => Promise<void>;
}

interface AIResponse {
  assignments: {
    sku: string;
    qty: number;
    binId: string;
    reason: string;
  }[];
  unassigned?: { sku: string; qty: number }[];
  logisticalReasoning: string;
  error?: string;
}

export const PutawayOptimizer: React.FC<PutawayOptimizerProps> = ({
  bins,
  inventory,
  onCommitPutaway
}) => {
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState<number>(10);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [aiPlan, setAiPlan] = useState<AIResponse | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAISuggest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku) {
      setErrorMsg('Por favor, seleccione o ingrese un SKU válido');
      return;
    }
    if (quantity <= 0) {
      setErrorMsg('La cantidad debe ser mayor que 0');
      return;
    }

    setIsOptimizing(true);
    setAiPlan(null);
    setErrorMsg('');

    // Simulate standard deterministic delay to feel calculated and premium
    await new Promise(resolve => setTimeout(resolve, 400));

    try {
      const selectedItem = inventory.find(i => i.sku === sku);
      const unitWeight = selectedItem?.unitWeight || 1.0;
      const category = selectedItem?.category || 'General';

      // Candidates
      const candidates = bins.filter(
        b => b.status === 'Empty' || (b.status === 'Partial' && b.occupiedSku === sku)
      );

      if (candidates.length === 0) {
        throw new Error('No hay celdas libres o compatibles con este SKU en el almacén.');
      }

      // Rank candidates using rule-based slotting heuristics
      const scoredCandidates = candidates.map(b => {
        let score = 0;
        
        // 1. Consolidation
        if (b.status === 'Partial' && b.occupiedSku === sku) {
          score += 100;
        }

        // 2. Weight safety: Heavy items preferred on Level 1 (L1)
        const totalWeight = unitWeight * quantity;
        const isHeavy = totalWeight > 50;
        if (isHeavy) {
          if (b.level === 'L1') score += 50;
          else if (b.level === 'L2') score += 20;
          else if (b.level === 'L3') score -= 30;
        } else {
          if (b.level === 'L3') score += 30;
          else if (b.level === 'L2') score += 10;
        }

        // 3. Proximity to outbound (Aisle A/B preferred over C/D)
        if (b.aisle === 'A') score += 15;
        else if (b.aisle === 'B') score += 10;
        else if (b.aisle === 'C') score += 5;

        return { bin: b, score };
      });

      // Sort by score desc
      scoredCandidates.sort((a, b) => b.score - a.score);
      const bestBin = scoredCandidates[0].bin;

      let reasoningText = '';
      if (bestBin.status === 'Partial') {
        reasoningText = `Consolidación óptima en la celda parcial existente (${bestBin.id}) para evitar fragmentar y optimizar la densidad del almacén.`;
      } else if (unitWeight * quantity > 50) {
        reasoningText = `Asignación de seguridad estructural en nivel bajo (${bestBin.level}) debido al alto peso acumulado (${(unitWeight * quantity).toFixed(1)} kg).`;
      } else {
        reasoningText = `Asignación óptima en la celda libre ${bestBin.id} (Pasillo ${bestBin.aisle}) según criterios heurísticos estándar de cercanía.`;
      }

      const planData: AIResponse = {
        assignments: [{
          sku,
          qty: quantity,
          binId: bestBin.id,
          reason: reasoningText
        }],
        logisticalReasoning: `El motor de slotting heurístico determinó que la celda ${bestBin.id} es el destino idóneo para las ${quantity} unidades de ${sku}. La asignación prioriza la seguridad estructural (considerando el peso unitario de ${unitWeight} kg) y la consolidación de inventario para minimizar la fragmentación de espacio en los pasillos.`
      };

      setAiPlan(planData);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Ocurrió un error al calcular la ubicación óptima.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleCommit = async () => {
    if (!aiPlan) return;
    try {
      await onCommitPutaway(aiPlan.assignments);
      setAiPlan(null);
      setSku('');
      setQuantity(10);
      setShowConfirmModal(false);
    } catch (error: any) {
      setErrorMsg('Fallo al confirmar las tareas de almacenamiento: ' + error.message);
      setShowConfirmModal(false);
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
      
      {/* Header */}
      <div className="border-b border-slate-50 pb-4 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Boxes className="h-5 w-5 text-blue-500" />
          Optimizador Heurístico de Almacenamiento O-WMS
        </h2>
        <p className="text-xs text-slate-400">
          Utiliza un algoritmo heurístico de slotting avanzado para ubicar los productos recibidos de forma segura y eficiente cerca de los pasillos de recolección ideales.
        </p>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-rose-600 text-xs font-semibold mb-4 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Putaway Receiving Intake Form */}
      <form onSubmit={handleAISuggest} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-8">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Seleccionar SKU de Entrada
          </label>
          <select
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">-- Seleccionar SKU de Stock --</option>
            {inventory.map((item) => (
              <option key={item.sku} value={item.sku}>
                {item.sku} ({item.name})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Cantidad Asignada
          </label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={isOptimizing}
            className={`w-full text-xs font-bold uppercase tracking-wider py-2.5 rounded-lg text-white shadow-sm flex items-center justify-center gap-2 transition ${
              isOptimizing 
                ? 'bg-slate-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
            }`}
          >
            {isOptimizing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculando Ubicación Óptima...
              </>
            ) : (
              <>
                <Workflow className="h-4 w-4" />
                Calcular Ubicación Óptima
              </>
            )}
          </button>
        </div>
      </form>

      {/* Heuristic Generated Putaway Plan */}
      {aiPlan && (
        <div className="bg-blue-50/40 rounded-2xl border border-blue-100 p-6 space-y-6 animate-fade-in">
          <div className="flex items-center justify-between border-b border-blue-100/50 pb-3">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Workflow className="h-4.5 w-4.5 text-blue-500" />
              Protocolo de Ubicación de Celdas Propuesto
            </h3>
            <span className="text-[9px] font-bold font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md uppercase">
              Generado por el Motor O-WMS
            </span>
          </div>

          <div className="space-y-3">
            {aiPlan.assignments.map((assignment, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-100 rounded-xl p-4 flex flex-col sm:flex-row items-stretch justify-between gap-4 shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <span className="h-7 w-7 rounded-lg bg-blue-600/10 text-blue-600 font-bold font-mono text-center flex items-center justify-center text-xs">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold font-mono text-xs text-slate-800">{assignment.sku}</span>
                      <ArrowRightLeft className="h-3 w-3 text-slate-400" />
                      <span className="font-bold font-mono text-xs text-blue-600">Celda: {assignment.binId}</span>
                    </div>
                    <p className="text-slate-500 text-xs mt-1 font-medium">{assignment.reason}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end font-mono font-bold text-slate-800 text-xs border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  Asignación: {assignment.qty} unidades
                </div>
              </div>
            ))}
          </div>

          {aiPlan.logisticalReasoning && (
            <div className="bg-white/80 rounded-xl border border-slate-100 p-4">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono block mb-1">
                Razonamiento Logístico del Motor
              </span>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {aiPlan.logisticalReasoning}
              </p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setShowConfirmModal(true)}
              className="bg-blue-600 hover:bg-blue-700 active:scale-98 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow"
            >
              <Check className="h-4 w-4" />
              Aplicar Ubicaciones a Supabase
            </button>
          </div>
        </div>
      )}

      {/* Confirmation warning modal for mutating database operations */}
      {showConfirmModal && aiPlan && (
        <div className="fixed inset-0 bg-slate-950/45 flex items-center justify-center z-50 p-4 font-sans select-none">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 animate-scale-up">
            <div className="flex items-center gap-2 text-amber-500 mb-4">
              <ShieldAlert className="h-6 w-6" />
              <h4 className="font-bold text-slate-800 text-base leading-none">
                ¿Confirmar Transacción de Almacenamiento?
              </h4>
            </div>

            <p className="text-slate-600 text-xs leading-relaxed mb-6">
              Está autorizando la escritura directa de cambios en su Base de Datos de Almacén en Supabase.
              Esto actualizará <span className="font-semibold text-slate-900">{aiPlan.assignments.length} celdas</span> en su tabla de <span className="font-mono bg-slate-100 px-1 rounded font-bold">Celdas (Bins)</span>, y aumentará las cantidades de stock en su tabla de <span className="font-mono bg-slate-100 px-1 rounded font-bold">Inventario</span>.
            </p>

            <div className="space-y-2 mb-6">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider block">
                Cambios Pendientes:
              </span>
              {aiPlan.assignments.map((el, i) => (
                <div key={i} className="flex justify-between text-xs font-mono border-b border-slate-50 pb-1.5 text-slate-700">
                  <span>Celda {el.binId} ← {el.sku}</span>
                  <span className="font-bold">+{el.qty} unidades</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-xs font-bold uppercase"
              >
                Cancelar
              </button>
              <button
                onClick={handleCommit}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider"
              >
                Confirmar Escritura Directa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
