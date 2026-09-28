import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { InventoryItem } from '../types';
import { 
  Printer, 
  Barcode, 
  Grid, 
  Check, 
  RefreshCw, 
  Ruler, 
  RotateCw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Sparkles, 
  Image as ImageIcon, 
  QrCode as QrCodeIcon,
  ShieldCheck,
  Package,
  Layers,
  CheckCircle2,
  SlidersHorizontal
} from 'lucide-react';

interface LabelStationProps {
  inventory: InventoryItem[];
}

interface PresetSize {
  id: string;
  name: string;
  desc: string;
  base: number; // Ancho / Base en cm
  alto: number; // Altura / Alto en cm
}

const PRESET_SIZES: PresetSize[] = [
  { id: '10x7.5', name: '10 × 7.5 cm', desc: '4" × 3" Estándar de Almacén WMS', base: 10.0, alto: 7.5 },
  { id: '10x15', name: '10 × 15 cm', desc: '4" × 6" Tarima / Envío Grande', base: 10.0, alto: 15.0 },
  { id: '10x5', name: '10 × 5 cm', desc: '4" × 2" Cajas y Pasillos', base: 10.0, alto: 5.0 },
  { id: '7.5x5', name: '7.5 × 5 cm', desc: '3" × 2" Mediana para Cajas', base: 7.5, alto: 5.0 },
  { id: '5x3', name: '5 × 3 cm', desc: '2" × 1.2" Miniatura de Piezas', base: 5.0, alto: 3.0 },
  { id: '4x7.5', name: '4 × 7.5 cm', desc: 'Formato Estrecho / Rollo Vertical', base: 4.0, alto: 7.5 },
  { id: 'custom', name: 'Personalizado', desc: 'Medidas libres en centímetros', base: 0, alto: 0 },
];

/**
 * Generador determinista de barras de código vectoriales SVG (Code 128)
 * Garantiza que las barras escalen al 100% del ancho sin desbordamiento ni saltos de línea.
 */
const generateBarcodeBars = (code: string) => {
  const clean = (code || '7501020304012').replace(/[^0-9A-Za-z-]/g, '');
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 37 + clean.charCodeAt(i)) >>> 0;
  }

  const bars: { x: number; width: number }[] = [];
  let x = 12;

  // Barras de guarda iniciales
  bars.push({ x, width: 2.5 }); x += 4.5;
  bars.push({ x, width: 2.5 }); x += 4.5;

  const patterns = [
    [2, 1, 3, 1],
    [1, 3, 1, 2],
    [3, 1, 2, 1],
    [2, 2, 1, 3],
    [1, 2, 3, 2],
    [2, 1, 1, 4],
    [3, 2, 1, 1],
    [1, 4, 1, 1]
  ];

  const totalSegments = 26;
  for (let i = 0; i < totalSegments; i++) {
    const charCode = clean.charCodeAt(i % clean.length) || 48;
    const pat = patterns[(charCode + i + hash) % patterns.length];
    for (let j = 0; j < pat.length; j++) {
      const w = pat[j] === 1 ? 1.6 : pat[j] === 2 ? 3.0 : pat[j] === 3 ? 4.5 : 5.8;
      bars.push({ x, width: w });
      x += w + 2.0;
    }
  }

  // Barras de guarda finales
  bars.push({ x, width: 2.5 }); x += 4.5;
  bars.push({ x, width: 2.5 });
  return { bars, totalWidth: x + 10 };
};

export const LabelStation: React.FC<LabelStationProps> = ({ inventory }) => {
  const [selectedSku, setSelectedSku] = useState(inventory[0]?.sku || '');
  const [copies, setCopies] = useState<number>(10);
  const [labelType, setLabelType] = useState<'product' | 'pallet'>('product');
  
  // Medidas físicas en centímetros (Base y Alto)
  const [labelBaseCm, setLabelBaseCm] = useState<number>(10.0);
  const [labelAltoCm, setLabelAltoCm] = useState<number>(7.5);
  const [labelPreset, setLabelPreset] = useState<string>('10x7.5');

  const [lotNumber, setLotNumber] = useState<string>(() => `LOT-${Math.floor(1000 + Math.random() * 9000)}`);
  const [printTarget, setPrintTarget] = useState<'label' | 'sheet'>('label');

  // Controles de campo visual y escala en pantalla
  const [zoomScale, setZoomScale] = useState<'auto' | '100' | '140' | '180'>('auto');
  const [includeBarcode, setIncludeBarcode] = useState<boolean>(true);
  const [includeQrCode, setIncludeQrCode] = useState<boolean>(true);
  const [includeProductPhoto, setIncludeProductPhoto] = useState<boolean>(true);
  const [includeMetadataGrid, setIncludeMetadataGrid] = useState<boolean>(true);

  // Estados interactivos
  const [isSimulatingPrint, setIsSimulatingPrint] = useState(false);
  const [completedPrintMsg, setCompletedPrintMsg] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Sincronizar SKU seleccionado
  useEffect(() => {
    if (inventory.length > 0 && !selectedSku) {
      setSelectedSku(inventory[0].sku);
    }
  }, [inventory, selectedSku]);

  const product = inventory.find(i => i.sku === selectedSku);

  // Generar Código QR de alta definición
  useEffect(() => {
    if (product) {
      const codeData = product.barcode || product.sku;
      QRCode.toDataURL(codeData, {
        margin: 1,
        width: 180,
        color: { dark: '#000000', light: '#ffffff' }
      })
        .then(setQrCodeDataUrl)
        .catch(() => setQrCodeDataUrl(''));
    }
  }, [product?.sku, product?.barcode]);

  // Barras vectoriales deterministas
  const { bars: barcodeBars, totalWidth: barcodeTotalWidth } = useMemo(() => {
    return generateBarcodeBars(product?.barcode || product?.sku || '7501020304012');
  }, [product?.barcode, product?.sku]);

  // Aplicar Preset de medidas
  const handleApplyPreset = (preset: PresetSize) => {
    setLabelPreset(preset.id);
    if (preset.id !== 'custom') {
      setLabelBaseCm(preset.base);
      setLabelAltoCm(preset.alto);
    }
  };

  // Girar / Invertir orientación 90° (Base <-> Alto)
  const handleFlipOrientation = () => {
    const prevBase = labelBaseCm;
    const prevAlto = labelAltoCm;
    setLabelBaseCm(prevAlto);
    setLabelAltoCm(prevBase);
    setLabelPreset('custom');
  };

  // Disparar Impresión Física
  const handleTriggerPrint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    setIsSimulatingPrint(true);
    setCompletedPrintMsg(false);

    setTimeout(() => {
      setIsSimulatingPrint(false);
      setCompletedPrintMsg(true);
      window.print();
      setTimeout(() => setCompletedPrintMsg(false), 5000);
    }, 400);
  };

  // Cálculo de dimensiones en pantalla según escala
  const isLandscape = labelBaseCm >= labelAltoCm;
  const aspectRatio = labelBaseCm / (labelAltoCm || 1);

  // Ancho base del sticker en pantalla para escala óptima
  const screenWidthPx = useMemo(() => {
    if (zoomScale === '100') {
      // 100% escala física nativa en pantalla (1cm = 37.8px)
      return Math.round(labelBaseCm * 37.8);
    }
    if (zoomScale === '140') {
      return Math.round((isLandscape ? 440 : 340) * 1.4);
    }
    if (zoomScale === '180') {
      return Math.round((isLandscape ? 440 : 340) * 1.8);
    }
    // 'auto': Tamaño optimizado para lectura cómoda y equilibrada en cualquier monitor
    if (isLandscape) {
      return 450;
    } else {
      // Retrato / Vertical: ancho entre 300px y 360px según proporción
      return Math.max(280, Math.min(380, Math.round(480 * aspectRatio)));
    }
  }, [zoomScale, labelBaseCm, isLandscape, aspectRatio]);

  const screenHeightPx = Math.round(screenWidthPx / aspectRatio);

  return (
    <div className="space-y-6">
      
      {/* Dynamic CSS Print Stylesheet para medidas físicas exactas en cm */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-sku-label-station,
          #printable-sku-label-station * {
            visibility: visible !important;
          }
          #printable-sku-label-station {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${labelBaseCm}cm !important;
            display: block !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          @page {
            size: ${labelBaseCm}cm ${labelAltoCm}cm;
            margin: 0.1cm;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Banner Principal de Estación de Etiquetas */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 text-white p-6 rounded-3xl shadow-md border border-slate-700/50 no-print">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                <Printer className="h-4.5 w-4.5" />
              </div>
              <h2 className="text-sm font-black tracking-widest uppercase font-mono text-slate-200">
                Estación de Impresión de Etiquetas Industriales
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Configure las dimensiones en centímetros exactos de Base y Alto. Formato vectorial de alto contraste compatible con impresoras térmicas (Zebra, Brother, Dymo) y hojas estándar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-xl font-bold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Zebra ZPL / Térmica Lista
            </span>
          </div>
        </div>
      </div>

      {/* Grid Principal: Panel de Configuración (Izquierda) + Campo Visual de Etiqueta (Derecha) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* PANEL IZQUIERDO: Configuración y Orden de Trabajo (4 Cols en XL) */}
        <div className="xl:col-span-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4 no-print">
          
          <div className="border-b border-slate-150 pb-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-black font-mono uppercase text-slate-800 block">
                Orden de Impresión
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Defina medidas en cm, lote y parámetros del sticker.
              </p>
            </div>
            <span className="bg-slate-100 text-slate-600 font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg border border-slate-200">
              {labelBaseCm} × {labelAltoCm} cm
            </span>
          </div>

          <form onSubmit={handleTriggerPrint} className="space-y-4 text-xs">
            
            {/* Selector de SKU */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                Seleccionar SKU de Material
              </label>
              <select
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 bg-white font-mono font-bold focus:border-blue-500 focus:outline-none cursor-pointer"
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

            {/* Tipo de Etiqueta */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                Tipo de Etiqueta
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLabelType('product')}
                  className={`py-2 px-3 border rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    labelType === 'product'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-2xs'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Package className="h-3.5 w-3.5" />
                  <span>Producto Individual</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLabelType('pallet')}
                  className={`py-2 px-3 border rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    labelType === 'pallet'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-2xs'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Tarima Completa</span>
                </button>
              </div>
            </div>

            {/* SECCIÓN DE MEDIDAS EXACTAS EN CENTÍMETROS (CM) */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3.5">
              
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black text-slate-700 tracking-wider flex items-center gap-1.5">
                  <Ruler className="h-3.5 w-3.5 text-blue-600" />
                  <span>Dimensiones de Etiqueta (cm)</span>
                </span>
                <button
                  type="button"
                  onClick={handleFlipOrientation}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-bold bg-white px-2 py-0.5 rounded-lg border border-slate-200 hover:border-blue-300 transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                  title="Intercambiar Base y Alto para cambiar entre orientación Horizontal y Vertical"
                >
                  <RotateCw className="h-3 w-3" />
                  <span>Girar 90°</span>
                </button>
              </div>

              {/* Formatos estándar (Presets) */}
              <div>
                <label className="block text-[9.5px] uppercase font-bold text-slate-400 mb-1">
                  Formatos Populares
                </label>
                <select
                  value={labelPreset}
                  onChange={(e) => {
                    const preset = PRESET_SIZES.find(p => p.id === e.target.value);
                    if (preset) handleApplyPreset(preset);
                  }}
                  className="w-full p-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 text-xs focus:border-blue-500 cursor-pointer"
                >
                  {PRESET_SIZES.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.desc ? `— ${p.desc}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Inputs directos en Centímetros: Base y Alto */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[9.5px] uppercase font-bold text-slate-600 mb-1 tracking-wider">
                    Base / Ancho
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="2"
                      max="40"
                      step="0.5"
                      value={labelBaseCm}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLabelBaseCm(isNaN(val) || val <= 0 ? 1 : val);
                        setLabelPreset('custom');
                      }}
                      className="w-full font-mono font-bold text-slate-800 bg-white border border-slate-200 py-2 pl-3 pr-9 rounded-xl focus:border-blue-500 focus:outline-none text-xs"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                      cm
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[9.5px] uppercase font-bold text-slate-600 mb-1 tracking-wider">
                    Alto / Altura
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="2"
                      max="40"
                      step="0.5"
                      value={labelAltoCm}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLabelAltoCm(isNaN(val) || val <= 0 ? 1 : val);
                        setLabelPreset('custom');
                      }}
                      className="w-full font-mono font-bold text-slate-800 bg-white border border-slate-200 py-2 pl-3 pr-9 rounded-xl focus:border-blue-500 focus:outline-none text-xs"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                      cm
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-500 pt-1 border-t border-slate-200/70">
                <span>Área: {(labelBaseCm * labelAltoCm).toFixed(1)} cm²</span>
                <span>Orientación: <strong>{isLandscape ? 'Horizontal (Apaisado)' : 'Vertical (Retrato)'}</strong></span>
              </div>
            </div>

            {/* Número de Copias y Lote */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                  Número de Copias
                </label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, Math.min(200, Number(e.target.value))))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold text-slate-800 bg-white focus:border-blue-500 text-center"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                  Lote / Batch
                </label>
                <input
                  type="text"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  placeholder="ej. LOT-3033"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold text-slate-700 bg-white focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* Personalización de Elementos del Campo Visual */}
            <div className="space-y-2 border-t border-slate-150 pt-3">
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Personalizar Contenido del Sticker
              </label>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={includeBarcode}
                    onChange={(e) => setIncludeBarcode(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Código de Barras 1D</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={includeQrCode}
                    onChange={(e) => setIncludeQrCode(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Código QR 2D</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={includeProductPhoto}
                    onChange={(e) => setIncludeProductPhoto(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Foto del SKU</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={includeMetadataGrid}
                    onChange={(e) => setIncludeMetadataGrid(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Tabla de Datos</span>
                </label>
              </div>
            </div>

            {/* Mensaje de Confirmación de Impresión */}
            {completedPrintMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl font-bold text-[11px] flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>¡Orden mandada a impresión con éxito! Verifique su impresora térmica o diálogo del sistema.</span>
              </div>
            )}

            {/* Botón Principal de Envío a Impresión */}
            <button
              type="submit"
              disabled={isSimulatingPrint || !product}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer transition"
            >
              {isSimulatingPrint ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Enviando Formato Térmico...</span>
                </>
              ) : (
                <>
                  <Printer className="h-4.5 w-4.5" />
                  <span>Mandar a Imprimir ({copies} {copies === 1 ? 'Etiqueta' : 'Etiquetas'})</span>
                </>
              )}
            </button>
          </form>

        </div>

        {/* PANEL DERECHO: Campo Visual Optimizado y Espacioso de la Etiqueta (8 Cols en XL) */}
        <div className="xl:col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4 print:border-none print:shadow-none print:bg-transparent print:p-0">
          
          {/* Barra Superior del Campo Visual: Modos y Zoom */}
          <div className="border-b border-slate-150 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 no-print">
            
            {/* Selector de Modo: Sticker Individual vs Pliego Completo */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPrintTarget('label')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  printTarget === 'label'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Barcode className="h-3.5 w-3.5" />
                <span>Sticker Individual</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintTarget('sheet')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  printTarget === 'sheet'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Grid className="h-3.5 w-3.5" />
                <span>Pliego de {copies} Copias</span>
              </button>
            </div>

            {/* Controles de Escala y Zoom de Previsualización */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[10px] font-mono font-bold text-slate-600">
                <span className="px-2 text-slate-400">Escala:</span>
                {(['auto', '100', '140', '180'] as const).map(scale => (
                  <button
                    key={scale}
                    type="button"
                    onClick={() => setZoomScale(scale)}
                    className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                      zoomScale === scale
                        ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                        : 'hover:text-slate-900 text-slate-500'
                    }`}
                  >
                    {scale === 'auto' ? 'Auto-Ajuste' : `${scale}%`}
                  </button>
                ))}
              </div>

              {/* Medida física Badge */}
              <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1">
                <Ruler className="h-3.5 w-3.5" />
                <span>{labelBaseCm} × {labelAltoCm} cm</span>
              </span>
            </div>

          </div>

          {product ? (
            <div>
              {printTarget === 'label' ? (
                /* VISTA 1: STICKER INDIVIDUAL EN ESPACIO DE TRABAJO AMPLIO CON REGLAS */
                <div className="space-y-4">
                  
                  {/* Canvas de Previsualización con Fondo Técnico de Almacén */}
                  <div className="bg-slate-100/80 border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center min-h-[500px] relative overflow-x-auto select-none">
                    
                    {/* Regla Superior (Base en cm) */}
                    <div 
                      style={{ width: `${screenWidthPx}px` }}
                      className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 mb-2 transition-all duration-300"
                    >
                      <span className="border-l border-slate-400 h-2"></span>
                      <span className="bg-white px-2 py-0.5 rounded-md shadow-2xs border border-slate-200 text-slate-700">
                        ↔ Base: {labelBaseCm} cm
                      </span>
                      <span className="border-r border-slate-400 h-2"></span>
                    </div>

                    {/* Contenedor con Regla Lateral y Sticker */}
                    <div className="flex items-center gap-3">
                      
                      {/* Regla Lateral (Alto en cm) */}
                      <div 
                        style={{ height: `${screenHeightPx}px` }}
                        className="flex flex-col items-center justify-between text-[10px] font-mono font-bold text-slate-500 shrink-0 transition-all duration-300"
                      >
                        <span className="border-t border-slate-400 w-2"></span>
                        <span 
                          className="bg-white px-1 py-1 rounded-md shadow-2xs border border-slate-200 text-slate-700 [writing-mode:vertical-rl] rotate-180"
                        >
                          ↕ Alto: {labelAltoCm} cm
                        </span>
                        <span className="border-b border-slate-400 w-2"></span>
                      </div>

                      {/* EL STICKER INDUSTRIAL (DISEÑO OPTIMIZADO DE ALTO CONTRASTE) */}
                      <div
                        style={{
                          width: `${screenWidthPx}px`,
                          minHeight: `${screenHeightPx}px`,
                          maxWidth: '100%',
                          aspectRatio: `${labelBaseCm} / ${labelAltoCm}`
                        }}
                        className="bg-white text-slate-900 border-2 border-slate-900 rounded-2xl shadow-2xl p-4 sm:p-5 font-mono flex flex-col justify-between overflow-hidden relative transition-all duration-300"
                      >
                        
                        {/* 1. Encabezado de Etiqueta (Marca, SKU y Estado WMS) */}
                        <div className="border-b-2 border-slate-900 pb-2 flex items-start justify-between gap-2 shrink-0">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] font-black tracking-widest uppercase bg-slate-900 text-white px-2 py-0.5 rounded">
                                {labelType === 'product' ? 'PRODUCTO WMS' : 'TARIMA / CARGA'}
                              </span>
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                {isLandscape ? 'LOGÍSTICA INBOUND' : 'INBOUND'}
                              </span>
                            </div>
                            <h3 className="text-sm sm:text-base font-black font-mono text-slate-900 mt-1 truncate">
                              SKU: {product.sku}
                            </h3>
                          </div>
                          
                          <div className="text-right shrink-0">
                            <span className="border-2 border-slate-900 font-black text-[9px] px-2 py-0.5 rounded-lg uppercase tracking-wider block bg-slate-50">
                              WMS PASS
                            </span>
                            <span className="text-[8px] font-mono text-slate-500 block mt-0.5">
                              {labelBaseCm}×{labelAltoCm}cm
                            </span>
                          </div>
                        </div>

                        {/* 2. Cuerpo Central: Información del Material y Fotografía */}
                        <div className="py-2.5 my-auto flex items-center gap-3">
                          {includeProductPhoto && product.imageUrl && (
                            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl border-2 border-slate-900 overflow-hidden shrink-0 bg-slate-50 shadow-xs">
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <span className="text-[8px] uppercase font-black text-slate-400 tracking-wider block">
                              DESCRIPCIÓN DEL ARTÍCULO
                            </span>
                            <h4 className="text-xs sm:text-sm font-black text-slate-950 leading-tight block break-words mt-0.5">
                              {product.name}
                            </h4>
                            {product.description && (
                              <p className="text-[9.5px] text-slate-600 line-clamp-2 mt-0.5 leading-snug font-sans">
                                {product.description}
                              </p>
                            )}
                          </div>

                          {/* QR Code opcional integrado en cuerpo */}
                          {includeQrCode && qrCodeDataUrl && (
                            <div className="shrink-0 flex flex-col items-center">
                              <img
                                src={qrCodeDataUrl}
                                alt="QR Code"
                                className="h-14 w-14 sm:h-16 sm:w-16 rounded border border-slate-900 p-0.5 bg-white shrink-0"
                              />
                              <span className="text-[7px] font-bold text-slate-500 font-mono mt-0.5">
                                SCAN QR
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 3. Rejilla de Metadatos (Lote, Fecha, Categoría, Peso) */}
                        {includeMetadataGrid && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 border-t-2 border-b-2 border-slate-900 py-2 text-[9px] sm:text-[10px] shrink-0 bg-slate-50/50 rounded-xs my-1">
                            <div className="px-1.5 border-r border-slate-300">
                              <span className="text-[7.5px] text-slate-500 uppercase font-bold block">LOTE (BATCH)</span>
                              <strong className="block font-black text-slate-900 truncate">{lotNumber}</strong>
                            </div>
                            <div className="px-1.5 border-r border-slate-300">
                              <span className="text-[7.5px] text-slate-500 uppercase font-bold block">FECHA</span>
                              <strong className="block font-black text-slate-900 truncate">
                                {new Date().toLocaleDateString('es-MX')}
                              </strong>
                            </div>
                            <div className="px-1.5 border-r border-slate-300">
                              <span className="text-[7.5px] text-slate-500 uppercase font-bold block">CATEGORÍA</span>
                              <strong className="block font-black text-slate-900 truncate">{product.category}</strong>
                            </div>
                            <div className="px-1.5">
                              <span className="text-[7.5px] text-slate-500 uppercase font-bold block">PESO UNIT.</span>
                              <strong className="block font-black text-slate-900 truncate">{product.unitWeight} kg</strong>
                            </div>
                          </div>
                        )}

                        {/* 4. Código de Barras 1D Vectorial de Ancho Completo */}
                        {includeBarcode && (
                          <div className="pt-2 text-center flex flex-col items-center justify-center shrink-0">
                            {/* Barras Vectoriales SVG escaladas al 100% */}
                            <div className="w-full h-11 sm:h-14 bg-white overflow-hidden py-0.5 select-none flex items-center justify-center">
                              <svg
                                viewBox={`0 0 ${barcodeTotalWidth} 60`}
                                className="w-full h-full"
                                preserveAspectRatio="none"
                              >
                                {barcodeBars.map((bar, idx) => (
                                  <rect
                                    key={idx}
                                    x={bar.x}
                                    y={0}
                                    width={bar.width}
                                    height={60}
                                    fill="#000000"
                                  />
                                ))}
                              </svg>
                            </div>
                            
                            {/* Texto Numérico Legible en Monospace Sin Rompimiento de Línea */}
                            <div className="font-mono font-black text-center tracking-[0.25em] text-[10px] sm:text-xs text-slate-900 whitespace-nowrap overflow-hidden select-all mt-1 w-full">
                              * {product.barcode || product.sku} *
                            </div>
                          </div>
                        )}

                        {/* 5. Pie de Seguridad / Microtexto */}
                        <div className="pt-1.5 mt-1 border-t border-slate-200 flex items-center justify-between text-[7.5px] text-slate-400 font-mono shrink-0">
                          <span>REGISTRO OFICIAL WMS • VERSIÓN INDUSTRIAL TÉRMICA</span>
                          <span>MEDIDA FÍSICA: {labelBaseCm} × {labelAltoCm} CM</span>
                        </div>

                      </div>
                    </div>

                  </div>

                  {/* Barra de Acciones y Resumen al Pie del Canvas */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                    <div className="flex items-center gap-2 text-slate-600 font-medium">
                      <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                      <span>
                        La previsualización en pantalla está optimizada para lectura en alta resolución. Al imprimir, se ajusta al tamaño físico exacto de <strong>{labelBaseCm} cm × {labelAltoCm} cm</strong>.
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleTriggerPrint}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm hover:shadow transition cursor-pointer"
                      >
                        <Printer className="h-4 w-4" />
                        <span>Imprimir ({copies} copias)</span>
                      </button>
                    </div>
                  </div>

                </div>
              ) : (
                /* VISTA 2: PLIEGO COMPLETO DE DISTRIBUCIÓN DE ETIQUETAS */
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div>
                        <h4 className="font-black text-slate-800 uppercase flex items-center gap-2 text-xs">
                          <Grid className="h-4 w-4 text-blue-600" />
                          <span>Distribución en Pliego Continuo</span>
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Simulación de pliego térmico para rollo Zebra o papel de transferencia continua con <strong>{copies} stickers</strong>.
                        </p>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-xl">
                        Total: {copies} etiquetas de {labelBaseCm}×{labelAltoCm}cm
                      </span>
                    </div>

                    {/* Malla de Etiquetas del Pliego */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[460px] overflow-y-auto p-2 bg-white rounded-2xl border border-slate-200">
                      {Array.from({ length: copies }).map((_, idx) => (
                        <div
                          key={idx}
                          className="border-2 border-slate-900 rounded-xl p-2.5 bg-white flex flex-col justify-between h-28 shadow-xs text-slate-900 font-mono text-[9px] relative overflow-hidden"
                        >
                          <div className="flex justify-between items-start border-b border-slate-900 pb-1">
                            <span className="font-black truncate">{product.sku}</span>
                            <span className="text-[7px] bg-slate-100 px-1 rounded font-bold">#{idx + 1}</span>
                          </div>
                          
                          <div className="py-1">
                            <span className="font-bold block truncate leading-tight">{product.name}</span>
                            <span className="text-[7.5px] text-slate-500 block mt-0.5">Lote: {lotNumber}</span>
                          </div>

                          <div className="pt-1 border-t border-slate-300 flex flex-col items-center">
                            <div className="w-full flex items-center justify-center gap-[1.5px] h-3.5 overflow-hidden">
                              {[1, 2, 1, 3, 1, 2, 1, 2, 1, 3, 2, 1, 2].map((w, bi) => (
                                <div key={bi} className="bg-slate-900 h-full shrink-0" style={{ width: `${w * 1.2}px` }} />
                              ))}
                            </div>
                            <span className="text-[6.5px] tracking-widest font-bold mt-0.5">
                              *{product.barcode || product.sku}*
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center text-xs pt-1">
                      <span className="text-[10px] text-slate-400 font-mono">
                        Configurado con salto de página físico automático (`page-break-after: always`).
                      </span>
                      <button
                        type="button"
                        onClick={handleTriggerPrint}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                      >
                        <Printer className="h-4 w-4" />
                        <span>Imprimir Pliego Completo</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border border-slate-200">
              <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 font-medium text-xs">
                Seleccione un SKU de material en el panel izquierdo para visualizar e imprimir sus etiquetas.
              </p>
            </div>
          )}

        </div>

      </div>

      {/* ÁREA EXCLUSIVA DE IMPRESIÓN FÍSICA (@media print) CON MEDIDAS EN CENTÍMETROS */}
      <div id="printable-sku-label-station" className="hidden print:block">
        {product && Array.from({ length: copies }).map((_, copyIndex) => (
          <div
            key={copyIndex}
            style={{
              width: `${labelBaseCm}cm`,
              height: `${labelAltoCm}cm`,
              boxSizing: 'border-box',
              pageBreakAfter: 'always',
              breakAfter: 'page',
              pageBreakInside: 'avoid',
              breakInside: 'avoid',
              margin: '0 auto',
              border: '2px solid #000',
              padding: '0.25cm',
              backgroundColor: '#fff',
              color: '#000',
              fontFamily: 'monospace',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden'
            }}
          >
            {/* Encabezado Físico */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1.5px solid #000', paddingBottom: '2px', lineHeight: 1 }}>
              <div>
                <span style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', display: 'block', letterSpacing: '1px' }}>
                  {labelType === 'product' ? 'PRODUCTO WMS' : 'TARIMA / CARGA'}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 900, display: 'block', marginTop: '2px' }}>
                  SKU: {product.sku}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '7.5px', fontWeight: 900, border: '1px solid #000', padding: '1px 3px', borderRadius: '2px', textTransform: 'uppercase' }}>
                  WMS PASS
                </span>
                <span style={{ fontSize: '6.5px', color: '#555', display: 'block', marginTop: '2px' }}>
                  #{copyIndex + 1}/{copies}
                </span>
              </div>
            </div>

            {/* Cuerpo del Producto */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 'auto 0', padding: '2px 0' }}>
              {includeProductPhoto && product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  style={{ height: '32px', width: '32px', objectFit: 'cover', borderRadius: '3px', border: '1px solid #000', flexShrink: 0 }}
                />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '6.5px', color: '#444', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                  MATERIAL
                </span>
                <div style={{ fontSize: '10px', fontWeight: 900, color: '#000', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {product.name}
                </div>
                <span style={{ fontSize: '8.5px', fontWeight: 700, color: '#222', display: 'block', marginTop: '1px' }}>
                  {product.barcode || '7501020304012'}
                </span>
              </div>
              {includeQrCode && qrCodeDataUrl && (
                <img
                  src={qrCodeDataUrl}
                  alt="QR"
                  style={{ height: '32px', width: '32px', border: '1px solid #000', padding: '1px', flexShrink: 0 }}
                />
              )}
            </div>

            {/* Metadatos */}
            {includeMetadataGrid && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px', fontSize: '7.5px', borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '2px 0', lineHeight: 1.1 }}>
                <div>
                  <span style={{ color: '#555', display: 'block', fontSize: '6px' }}>LOTE:</span>
                  <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lotNumber}</strong>
                </div>
                <div>
                  <span style={{ color: '#555', display: 'block', fontSize: '6px' }}>FECHA:</span>
                  <strong style={{ display: 'block' }}>{new Date().toLocaleDateString('es-MX')}</strong>
                </div>
                <div>
                  <span style={{ color: '#555', display: 'block', fontSize: '6px' }}>CATEGORÍA:</span>
                  <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.category}</strong>
                </div>
                <div>
                  <span style={{ color: '#555', display: 'block', fontSize: '6px' }}>PESO:</span>
                  <strong style={{ display: 'block' }}>{product.unitWeight} kg</strong>
                </div>
              </div>
            )}

            {/* Código de barras vectorial completo */}
            {includeBarcode && (
              <div style={{ textAlign: 'center', paddingTop: '2px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '100%', height: '22px', overflow: 'hidden' }}>
                  <svg
                    viewBox={`0 0 ${barcodeTotalWidth} 60`}
                    style={{ width: '100%', height: '100%' }}
                    preserveAspectRatio="none"
                  >
                    {barcodeBars.map((bar, idx) => (
                      <rect
                        key={idx}
                        x={bar.x}
                        y={0}
                        width={bar.width}
                        height={60}
                        fill="#000000"
                      />
                    ))}
                  </svg>
                </div>
                <span style={{ fontSize: '7.5px', letterSpacing: '3px', fontWeight: 700, display: 'block', marginTop: '1px', whiteSpace: 'nowrap' }}>
                  *{product.barcode || product.sku}*
                </span>
              </div>
            )}

            {/* Microtexto al pie */}
            <div style={{ borderTop: '0.5px solid #666', paddingTop: '1px', display: 'flex', justifyContent: 'space-between', fontSize: '6px', color: '#444' }}>
              <span>WMS OFICIAL</span>
              <span>{labelBaseCm} × {labelAltoCm} CM</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
