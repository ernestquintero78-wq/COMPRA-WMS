import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { Printer, Barcode, Grid, Eye, Check, RefreshCw, Layers } from 'lucide-react';

interface LabelStationProps {
  inventory: InventoryItem[];
}

type LabelSize = '4x6' | '4x3' | '3x2' | '2x1';

const sizeConfigs = {
  '4x6': {
    name: '4" x 6" (Envío / Tarima Grande)',
    widthClass: 'w-full max-w-[340px]',
    heightClass: 'min-h-[480px]',
    paddingClass: 'p-6',
    titleSize: 'text-xs',
    skuSize: 'text-[11px]',
    descSize: 'text-sm',
    descMinHeight: 'min-h-[2.5rem]',
    barcodeHeight: 'h-16',
    gridCols: 'grid-cols-2 gap-3',
    gridTextSize: 'text-[10px]',
    gridLabelSize: 'text-[8px]',
    footerBarcodeGap: 'gap-[2.5px]',
    barcodeTextSize: 'text-[10px]',
    showSecondaryInfo: true,
  },
  '4x3': {
    name: '4" x 3" (Estándar de Almacén)',
    widthClass: 'w-full max-w-[340px]',
    heightClass: 'min-h-[340px]',
    paddingClass: 'p-5',
    titleSize: 'text-[10px]',
    skuSize: 'text-[8px]',
    descSize: 'text-xs',
    descMinHeight: 'min-h-[2rem]',
    barcodeHeight: 'h-10',
    gridCols: 'grid-cols-2 gap-2',
    gridTextSize: 'text-[9px]',
    gridLabelSize: 'text-[7px]',
    footerBarcodeGap: 'gap-[2px]',
    barcodeTextSize: 'text-[9px]',
    showSecondaryInfo: true,
  },
  '3x2': {
    name: '3" x 2" (Mediana)',
    widthClass: 'w-full max-w-[280px]',
    heightClass: 'min-h-[240px]',
    paddingClass: 'p-3.5',
    titleSize: 'text-[9px]',
    skuSize: 'text-[7px]',
    descSize: 'text-[11px]',
    descMinHeight: 'min-h-[1.5rem]',
    barcodeHeight: 'h-8',
    gridCols: 'grid-cols-2 gap-1.5',
    gridTextSize: 'text-[8px]',
    gridLabelSize: 'text-[6px]',
    footerBarcodeGap: 'gap-[1.5px]',
    barcodeTextSize: 'text-[8px]',
    showSecondaryInfo: true,
  },
  '2x1': {
    name: '2" x 1" (Mini de Alta Densidad)',
    widthClass: 'w-full max-w-[220px]',
    heightClass: 'min-h-[140px]',
    paddingClass: 'p-2',
    titleSize: 'text-[8px]',
    skuSize: 'text-[6px]',
    descSize: 'text-[9px]',
    descMinHeight: 'min-h-0',
    barcodeHeight: 'h-6',
    gridCols: 'grid-cols-2 gap-1',
    gridTextSize: 'text-[7px]',
    gridLabelSize: 'text-[5px]',
    footerBarcodeGap: 'gap-[1px]',
    barcodeTextSize: 'text-[7px]',
    showSecondaryInfo: false, // hide lot, weight, etc to avoid overflow
  }
};

export const LabelStation: React.FC<LabelStationProps> = ({ inventory }) => {
  const [selectedSku, setSelectedSku] = useState(inventory[0]?.sku || '');
  const [copies, setCopies] = useState<number>(10);
  const [labelType, setLabelType] = useState<'product' | 'pallet'>('product');
  const [labelSize, setLabelSize] = useState<LabelSize>('4x3');
  const [lotNumber, setLotNumber] = useState<string>(() => `LOT-${Math.floor(1000 + Math.random() * 9000)}`);
  const [printTarget, setPrintTarget] = useState<'label' | 'sheet'>('label');
  
  // Simulated stats
  const [isSimulatingPrint, setIsSimulatingPrint] = useState(false);
  const [completedPrintMsg, setCompletedPrintMsg] = useState(false);

  // Sync selected SKU if props inventory changes or when mounted
  useEffect(() => {
    if (inventory.length > 0 && !selectedSku) {
      setSelectedSku(inventory[0].sku);
    }
  }, [inventory, selectedSku]);

  const product = inventory.find(i => i.sku === selectedSku);
  const currentSizeConfig = sizeConfigs[labelSize];

  const handleTriggerPrint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    setIsSimulatingPrint(true);
    setCompletedPrintMsg(false);

    // Prompt actual native dialog or simulate printing
    setTimeout(() => {
      setIsSimulatingPrint(false);
      setCompletedPrintMsg(true);
      window.print();
      setTimeout(() => setCompletedPrintMsg(false), 5000);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      
      {/* Banner Principal */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-md border border-slate-700/50 no-print">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
                <Printer className="h-4 w-4 animate-bounce" />
              </div>
              <h2 className="text-sm font-extrabold tracking-widest uppercase font-mono text-slate-300">
                Estación Central de Impresión de Etiquetas
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Imprima calcomanías industriales de código de barras para entradas nuevas. Etiquete productos sueltos o cargamentos consolidados en tarimas de almacenamiento.
            </p>
          </div>
          <span className="text-[10px] font-mono tracking-widest uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-xl">
            Zebra Térmica Nativa
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Lado Izquierdo: Configuración del Trabajo de Impresión */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 no-print">
          <div className="border-b border-slate-100 pb-3">
            <span className="text-xs font-bold font-mono uppercase text-slate-700 block">Orden de Trabajo de Impresión</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Defina SKU, lote y cantidad de etiquetas a generar.</p>
          </div>

          <form onSubmit={handleTriggerPrint} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Seleccionar SKU de Material</label>
              <select
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white font-mono font-bold focus:border-blue-500 cursor-pointer"
                required
              >
                <option value="">-- Seleccione Material --</option>
                {inventory.map(item => (
                  <option key={item.sku} value={item.sku}>
                    {item.sku} - {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Tipo de Etiqueta Requerida</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLabelType('product')}
                  className={`py-2 px-3 border rounded-lg font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                    labelType === 'product'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Barcode className="h-4 w-4" />
                  Producto Individual
                </button>
                <button
                  type="button"
                  onClick={() => setLabelType('pallet')}
                  className={`py-2 px-3 border rounded-lg font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                    labelType === 'pallet'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Grid className="h-4 w-4" />
                  Tarima Completa
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Modo de Impresión Final</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPrintTarget('label')}
                  className={`py-2 px-3 border rounded-lg font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                    printTarget === 'label'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 border-2'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Barcode className="h-4 w-4" />
                  Sticker Único
                </button>
                <button
                  type="button"
                  onClick={() => setPrintTarget('sheet')}
                  className={`py-2 px-3 border rounded-lg font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                    printTarget === 'sheet'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 border-2'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Grid className="h-4 w-4" />
                  Pliego Completo
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                {printTarget === 'label'
                  ? 'Se mandará a imprimir un único sticker limpio en alta definición.'
                  : `Se imprimirá un pliego de distribución continuo con ${copies} copias.`}
              </p>
            </div>

            {/* Selector de Formato de Etiqueta */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Formato / Tamaño del Sticker</label>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as LabelSize)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white font-bold focus:border-blue-500 cursor-pointer"
                required
              >
                {Object.entries(sizeConfigs).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Número de Copias/Stickers</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={copies}
                  onChange={(e) => setCopies(Number(e.target.value))}
                  className="w-full p-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-700 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Referencia de Lote (Batch)</label>
                <input
                  type="text"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  placeholder="e.g. LOT-4521"
                  className="w-full p-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-700 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {completedPrintMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-semibold leading-relaxed">
                ✓ ¡Orden mandada a imprimir! Verifique su cola de impresión local o PDF generado.
              </div>
            )}

            <button
              type="submit"
              disabled={isSimulatingPrint || !product}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider shadow flex items-center justify-center gap-2 cursor-pointer transition"
            >
              {isSimulatingPrint ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Generando Formato Imprimible...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4" />
                  Imprimir Cola de Etiquetas
                </>
              )}
            </button>
          </form>

        </div>

        {/* Lado Derecho: Preview de Etiqueta & Hoja de Impresión */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 space-y-4 print:border-none print:shadow-none print:bg-transparent print:p-0">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center text-slate-700 no-print">
            <div>
              <span className="text-xs font-bold font-mono uppercase block">Vista Previa del Sticker</span>
              <p className="text-[10px] text-slate-400 mt-0.5">Demostración térmica de alta definición lista para pegado físico.</p>
            </div>
            <div className="flex gap-2 text-[10px] font-mono">
              <span className="bg-slate-100 text-slate-600 border border-slate-250 px-2.5 py-1 rounded uppercase font-bold">
                Formato Seleccionado: {labelSize === '4x6' ? '4" x 6"' : labelSize === '4x3' ? '4" x 3"' : labelSize === '3x2' ? '3" x 2"' : '2" x 1"'}
              </span>
            </div>
          </div>

          {product ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-1 print:gap-0">
              
              {/* Tarjeta 1: Sticker Individual con Auto-Scaling */}
              <div className={`flex justify-center items-start w-full overflow-hidden ${printTarget !== 'label' ? 'no-print' : 'print:w-full print:flex print:justify-center'}`}>
                <div className={`border-4 border-dashed border-slate-300/80 rounded-2xl bg-white text-slate-900 font-mono select-none shadow-xs transition-all duration-300 ${currentSizeConfig.widthClass} ${currentSizeConfig.heightClass} ${currentSizeConfig.paddingClass} flex flex-col justify-between overflow-hidden`}>
                  <div className="space-y-4 flex flex-col justify-between h-full w-full">
                    
                    {/* Encabezado */}
                    <div className="flex justify-between items-start border-b border-slate-950 pb-2 leading-none">
                      <div className="min-w-0">
                        <span className={`font-black block uppercase font-mono ${currentSizeConfig.titleSize} truncate`}>
                          {labelSize === '2x1' ? 'WMS MINI' : 'ETIQUETA WMS INDUSTRIAL'}
                        </span>
                        <span className={`${currentSizeConfig.skuSize} text-slate-500 font-bold block mt-1 tracking-wider truncate`}>
                          SKU: {product.sku}
                        </span>
                      </div>
                      <span className="font-extrabold bg-slate-100 border border-slate-300 px-1 py-0.5 rounded leading-none text-[8px] uppercase shrink-0">
                        {labelType === 'product' ? 'PROD' : 'PLET'}
                      </span>
                    </div>

                    {/* Descripción y Barcode textual */}
                    <div className="space-y-1.5 text-center min-w-0">
                      <span className={`${labelSize === '2x1' ? 'text-[6px]' : 'text-[8px]'} text-slate-400 font-black block uppercase tracking-wide`}>
                        DESCRIPCIÓN DE MERCANCÍA
                      </span>
                      <span className={`${currentSizeConfig.descSize} font-black line-clamp-2 break-words text-slate-800 leading-tight block ${currentSizeConfig.descMinHeight}`}>
                        {product.name}
                      </span>
                      <span className={`${currentSizeConfig.gridTextSize} font-black px-1.5 bg-slate-100 block py-1 border border-slate-300 rounded tracking-widest font-mono select-all mt-1 break-all`}>
                        {product.barcode || '7501020304012'}
                      </span>
                    </div>

                    {/* Grid metadata */}
                    {currentSizeConfig.showSecondaryInfo ? (
                      <div className={`grid ${currentSizeConfig.gridCols} border-t border-b border-slate-800 py-2 font-mono`}>
                        <div className="min-w-0">
                          <span className={`text-slate-400 block ${currentSizeConfig.gridLabelSize} font-bold`}>FECHA IMPRESIÓN</span>
                          <strong className={`block leading-none mt-0.5 ${currentSizeConfig.gridTextSize} truncate`}>{new Date().toLocaleDateString()}</strong>
                        </div>
                        <div className="min-w-0">
                          <span className={`text-slate-400 block ${currentSizeConfig.gridLabelSize} font-bold`}>ID LOTE (BATCH)</span>
                          <strong className={`block leading-none mt-0.5 ${currentSizeConfig.gridTextSize} truncate`}>{lotNumber}</strong>
                        </div>
                        <div className="min-w-0">
                          <span className={`text-slate-400 block ${currentSizeConfig.gridLabelSize} font-bold`}>CATEGORÍA SEG.</span>
                          <strong className={`block leading-none mt-0.5 ${currentSizeConfig.gridTextSize} truncate`}>{product.category || 'GENERAL'}</strong>
                        </div>
                        <div className="min-w-0">
                          <span className={`text-slate-400 block ${currentSizeConfig.gridLabelSize} font-bold`}>PESO UNIDAD</span>
                          <strong className={`block leading-none mt-0.5 ${currentSizeConfig.gridTextSize} truncate`}>{product.unitWeight} kgs</strong>
                        </div>
                      </div>
                    ) : (
                      // Super compact representation for 2x1 to prevent overflow
                      <div className="flex justify-between items-center text-[8px] py-1 border-t border-b border-slate-300 font-mono w-full px-0.5">
                        <span className="truncate mr-1">Lote: <strong>{lotNumber}</strong></span>
                        <span className="shrink-0">Peso: <strong>{product.unitWeight}kg</strong></span>
                      </div>
                    )}

                    {/* Código de barras simulado proporcional */}
                    <div className="text-center space-y-1 flex flex-col items-center justify-center pt-2">
                      <div className={`w-full flex items-center justify-center ${currentSizeConfig.footerBarcodeGap} ${currentSizeConfig.barcodeHeight} overflow-hidden py-1 bg-white select-none`}>
                        {[2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3, 1, 2, 1, 1, 4, 2, 1, 3, 1, 2, 1, 3, 2].map((width, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-900 h-full shrink-0"
                            style={{ width: `${Math.max(1, width * (labelSize === '2x1' ? 0.6 : labelSize === '3x2' ? 0.8 : 1))}px` }}
                          />
                        ))}
                      </div>
                      <span className={`${currentSizeConfig.barcodeTextSize} tracking-[4px] font-bold text-center block mt-1 pl-1 font-mono break-all`}>
                        *{product.barcode || product.sku}*
                      </span>
                    </div>

                  </div>
                </div>
              </div>

              {/* Tarjeta 2: Hoja Completa de impresión (Representación visual) */}
              <div className={`bg-slate-50 border border-slate-150 p-4 rounded-2xl flex flex-col justify-between text-xs space-y-4 print:bg-white print:border-none print:p-0 ${printTarget !== 'sheet' ? 'no-print' : 'print:w-full'}`}>
                <div className="space-y-2 no-print">
                  <h4 className="font-extrabold text-slate-800 uppercase flex items-center gap-1.5 leading-none">
                    <Grid className="h-4 w-4 text-blue-500" />
                    Pliego de Impresión Soportado
                  </h4>
                  <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                    Preparado para imprimir <strong>{copies} copias</strong> continuas de formato <span className="font-bold text-blue-600">{labelSize}</span>. Diseñado mediante hojas transfer térmicas adaptables a hojas carta o rollos Zebra de bobina continua.
                  </p>
                </div>

                {/* Grid adaptado al tamaño de la etiqueta */}
                <div className={`grid ${labelSize === '2x1' ? 'grid-cols-5' : labelSize === '3x2' ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5 bg-white p-3 border border-slate-150 rounded-xl select-none print:border-none print:p-0`}>
                  {Array.from({ length: Math.min(labelSize === '2x1' ? 10 : labelSize === '3x2' ? 8 : 6, copies) }).map((_, idx) => (
                    <div key={idx} className="border border-slate-200 p-1 rounded bg-slate-50 text-center flex flex-col justify-between h-14 overflow-hidden print:bg-white">
                      <span className="font-mono text-[7px] font-bold text-slate-500 leading-none block truncate">{product.sku}</span>
                      <div className="w-full flex items-center justify-center gap-[1px] h-3 overflow-hidden">
                        {[1, 2, 1, 3, 1, 2, 1, 2, 1].map((width, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-900 h-full shrink-0"
                            style={{ width: `${width}px` }}
                          />
                        ))}
                      </div>
                      <span className="text-[5px] text-slate-400 font-mono font-bold leading-none block">Copia #{idx+1}</span>
                    </div>
                  ))}
                  {copies > (labelSize === '2x1' ? 10 : labelSize === '3x2' ? 8 : 6) && (
                    <div className="border border-dashed border-slate-200 p-1.5 rounded flex items-center justify-center text-slate-400 font-bold font-mono text-[9px] h-14 no-print">
                      +{copies - (labelSize === '2x1' ? 10 : labelSize === '3x2' ? 8 : 6)} más
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-400 bg-slate-100 p-2.5 rounded-lg border border-slate-150 font-semibold text-center leading-relaxed no-print">
                  💡 <strong>Truco Técnico:</strong> Presionar "Imprimir" enviará la señal CSS `@media print` al navegador, adaptada automáticamente para centrar el pliego de {labelSize} perfectamente.
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-16">
              <span className="text-slate-400">Por favor, cree o sincronice stock para poder visualizar stickers de códigos de barras.</span>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
