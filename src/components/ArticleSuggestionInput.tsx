import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Bin, InventoryItem } from '../types';
import { 
  Search, 
  Package, 
  MapPin, 
  X, 
  Check, 
  Boxes, 
  ChevronRight, 
  Scan, 
  Camera, 
  Barcode, 
  Sparkles, 
  Volume2, 
  Radio, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export interface ArticleSuggestionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectProduct: (product: InventoryItem, binId?: string) => void;
  inventory: InventoryItem[];
  bins?: Bin[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  themeColor?: 'blue' | 'amber' | 'indigo' | 'emerald';
  label?: string;
  helperText?: string;
  showBinsDetail?: boolean;
  showDirectBinSelection?: boolean;
  filterOnlyWithStock?: boolean;
  allowBinScanning?: boolean;
  required?: boolean;
  id?: string;
}

// Pleasant scanner confirmation chime via Web Audio API
export const playScannerSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1850, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    // Audio context not allowed or blocked by user gesture policy
  }
};

export const ArticleSuggestionInput: React.FC<ArticleSuggestionInputProps> = ({
  value,
  onChange,
  onSelectProduct,
  inventory,
  bins = [],
  placeholder = 'Escriba la descripción del artículo o escanee el código de barras...',
  className = '',
  inputClassName = '',
  disabled = false,
  autoFocus = false,
  themeColor = 'blue',
  label,
  helperText,
  showBinsDetail = true,
  showDirectBinSelection = false,
  filterOnlyWithStock = false,
  allowBinScanning = true,
  required = false,
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerFeedback, setScannerFeedback] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter matching suggestions based on description, name, SKU, or barcode
  const suggestions = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (!q) {
      const base = filterOnlyWithStock ? inventory.filter(i => (i.qty || 0) > 0) : inventory;
      return base.slice(0, 6);
    }

    const tokens = q.split(/\s+/).filter(Boolean);

    return inventory.filter(item => {
      if (filterOnlyWithStock && (item.qty || 0) <= 0) return false;

      const name = (item.name || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const sku = (item.sku || '').toLowerCase();
      const barcode = (item.barcode || '').toLowerCase();
      const cat = (item.category || '').toLowerCase();
      const combined = `${name} ${desc} ${sku} ${barcode} ${cat}`;

      return tokens.every(token => combined.includes(token));
    }).slice(0, 10);
  }, [value, inventory, filterOnlyWithStock]);

  const handleSelect = (product: InventoryItem, binId?: string) => {
    playScannerSound();
    onSelectProduct(product, binId);
    setIsOpen(false);
    setHighlightedIndex(-1);
    setShowScannerModal(false);
    stopCamera();
  };

  // Keyboard navigation & Barcode Scanner submission handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();

      // If user navigated with arrow keys to a specific suggestion:
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        handleSelect(suggestions[highlightedIndex]);
        return;
      }

      const cleanVal = (value || '').trim().toLowerCase();
      if (!cleanVal) return;

      // 1. Direct match on Barcode or SKU
      const directMatch = inventory.find(i => 
        (i.barcode && i.barcode.toLowerCase() === cleanVal) ||
        i.sku.toLowerCase() === cleanVal
      );
      if (directMatch) {
        handleSelect(directMatch);
        return;
      }

      // 2. Direct match on Bin ID (e.g. Scanned cell barcode "A-01-S1-L1")
      if (allowBinScanning) {
        const matchedBin = bins.find(b => b.id.toLowerCase() === cleanVal);
        if (matchedBin && matchedBin.occupiedSku) {
          const prodInBin = inventory.find(i => i.sku === matchedBin.occupiedSku);
          if (prodInBin) {
            handleSelect(prodInBin, matchedBin.id);
            return;
          }
        }
      }

      // 3. Exact match on Item Name
      const exactNameMatch = inventory.find(i => i.name.toLowerCase() === cleanVal);
      if (exactNameMatch) {
        handleSelect(exactNameMatch);
        return;
      }

      // 4. Default to top suggestion if available
      if (suggestions.length > 0) {
        handleSelect(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  // Fast auto-identification for barcode scanners typing full barcodes (length >= 6)
  useEffect(() => {
    const clean = (value || '').trim().toLowerCase();
    if (clean.length >= 6) {
      // Check for exact barcode match
      const exactBarcode = inventory.find(i => i.barcode && i.barcode.toLowerCase() === clean);
      if (exactBarcode) {
        // If exact barcode matches completely, keep suggestion visible or allow fast select
      }
    }
  }, [value, inventory]);

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('La cámara no está soportada o permitida en este entorno.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Check if native BarcodeDetector API is supported
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e']
        });

        const detectInterval = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const detectedBarcodes = await barcodeDetector.detect(videoRef.current);
            if (detectedBarcodes && detectedBarcodes.length > 0) {
              const scannedCode = detectedBarcodes[0].rawValue;
              clearInterval(detectInterval);
              handleScannedCode(scannedCode);
            }
          } catch (e) {
            // Keep scanning
          }
        }, 300);

        return () => clearInterval(detectInterval);
      }
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      setCameraError(err.message || 'No se pudo acceder a la cámara. Puede utilizar el lector USB o la simulación de escaneo.');
      setIsCameraActive(false);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
    setCameraError(null);
  };

  // Process a scanned barcode string
  const handleScannedCode = (scannedCode: string) => {
    const clean = scannedCode.trim().toLowerCase();
    if (!clean) return;

    // Check Barcode or SKU
    const match = inventory.find(i => 
      (i.barcode && i.barcode.toLowerCase() === clean) ||
      i.sku.toLowerCase() === clean
    );

    if (match) {
      setScannerFeedback(`✓ Escaneado: ${match.name} (${match.sku})`);
      setTimeout(() => {
        handleSelect(match);
      }, 350);
      return;
    }

    // Check Bin ID
    if (allowBinScanning) {
      const binMatch = bins.find(b => b.id.toLowerCase() === clean);
      if (binMatch && binMatch.occupiedSku) {
        const prodInBin = inventory.find(i => i.sku === binMatch.occupiedSku);
        if (prodInBin) {
          setScannerFeedback(`✓ Celda detectada: ${binMatch.id} (${prodInBin.name})`);
          setTimeout(() => {
            handleSelect(prodInBin, binMatch.id);
          }, 350);
          return;
        }
      }
    }

    // Item name match
    const nameMatch = inventory.find(i => i.name.toLowerCase().includes(clean));
    if (nameMatch) {
      setScannerFeedback(`✓ Encontrado: ${nameMatch.name}`);
      setTimeout(() => {
        handleSelect(nameMatch);
      }, 350);
      return;
    }

    setScannerFeedback(`⚠️ Código "${scannedCode}" sin coincidencia directa en catálogo.`);
  };

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Theme styling helpers
  const themeStyles = {
    blue: {
      focusRing: 'focus:border-blue-500 focus:ring-2 focus:ring-blue-150',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      hoverBg: 'hover:bg-blue-50/70',
      activeBg: 'bg-blue-50',
      textAccent: 'text-blue-600',
      iconColor: 'text-blue-500',
      scannerBtn: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200',
      scannerModalHeader: 'bg-blue-600 text-white'
    },
    amber: {
      focusRing: 'focus:border-amber-500 focus:ring-2 focus:ring-amber-150',
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      hoverBg: 'hover:bg-amber-50/70',
      activeBg: 'bg-amber-50',
      textAccent: 'text-amber-600',
      iconColor: 'text-amber-500',
      scannerBtn: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200',
      scannerModalHeader: 'bg-amber-600 text-white'
    },
    indigo: {
      focusRing: 'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-150',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      hoverBg: 'hover:bg-indigo-50/70',
      activeBg: 'bg-indigo-50',
      textAccent: 'text-indigo-600',
      iconColor: 'text-indigo-500',
      scannerBtn: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200',
      scannerModalHeader: 'bg-indigo-600 text-white'
    },
    emerald: {
      focusRing: 'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-150',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      hoverBg: 'hover:bg-emerald-50/70',
      activeBg: 'bg-emerald-50',
      textAccent: 'text-emerald-600',
      iconColor: 'text-emerald-500',
      scannerBtn: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200',
      scannerModalHeader: 'bg-emerald-600 text-white'
    }
  }[themeColor];

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {label && (
        <label 
          htmlFor={id} 
          className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider flex items-center justify-between"
        >
          <span className="flex items-center gap-1.5">
            <span>{label}</span>
          </span>
          <span className="text-[9px] font-bold text-slate-400 font-mono flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Escribir o Escanear
          </span>
        </label>
      )}

      <div className="relative flex items-center">
        {/* Left Indicator Icon */}
        <div className="absolute left-3.5 flex items-center gap-1 pointer-events-none">
          <Scan className={`h-4 w-4 ${themeStyles.iconColor} shrink-0`} />
        </div>
        
        {/* Primary Input */}
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          required={required}
          className={`w-full pl-10 pr-24 py-3 text-xs font-semibold border border-slate-250 rounded-xl bg-white text-slate-800 placeholder-slate-400 transition shadow-2xs outline-none ${themeStyles.focusRing} ${inputClassName}`}
        />

        {/* Right Controls: Clear and Camera/Scanner Button */}
        <div className="absolute right-2 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
                setHighlightedIndex(-1);
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition cursor-pointer"
              title="Borrar texto"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Quick Scanner Modal Launcher */}
          <button
            type="button"
            onClick={() => {
              setShowScannerModal(true);
              setScannerFeedback(null);
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-3xs ${themeStyles.scannerBtn}`}
            title="Abrir lector de escaneo / cámara / simulación de código de barras"
          >
            <Camera className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Escanear</span>
          </button>
        </div>
      </div>

      {helperText && (
        <p className="text-[10px] text-slate-400 mt-1 leading-normal flex items-center justify-between">
          <span>{helperText}</span>
          <span className="text-[9px] font-mono text-slate-400 shrink-0">
            Pistola USB / Bluetooth lista
          </span>
        </p>
      )}

      {/* FLOATING SUGGESTIONS DROPDOWN */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 max-h-80 overflow-y-auto p-1.5 space-y-1 animate-fadeIn">
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Search className="h-3 w-3 text-slate-400" />
              <span>
                {suggestions.length > 0
                  ? `${suggestions.length} coincidencia${suggestions.length > 1 ? 's' : ''}`
                  : 'Sin coincidencias en catálogo'}
              </span>
            </span>
            <span className="text-[9px] text-slate-400">
              Escanee con lector o elija con ↑ ↓ + Enter
            </span>
          </div>

          {suggestions.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 space-y-1.5">
              <Package className="h-6 w-6 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-600">No se encontró ningún artículo</p>
              <p className="text-[10px] text-slate-400">
                Puede escribir la descripción o presionar el botón <strong>&quot;Escanear&quot;</strong> para leer el código de barras.
              </p>
            </div>
          ) : (
            suggestions.map((item, index) => {
              const isHighlighted = index === highlightedIndex;
              const itemBins = bins.filter(b => b.occupiedSku === item.sku && (b.occupiedQty || 0) > 0);

              return (
                <div
                  key={item.sku}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`p-2.5 rounded-xl transition cursor-pointer text-left border ${
                    isHighlighted 
                      ? `${themeStyles.activeBg} border-slate-250` 
                      : `border-transparent ${themeStyles.hoverBg}`
                  }`}
                  onClick={() => handleSelect(item)}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-10 w-10 rounded-lg object-cover border border-slate-200 shrink-0 mt-0.5"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=150&h=150&q=80';
                          }}
                        />
                      ) : (
                        <div className={`h-10 w-10 rounded-lg ${themeStyles.badge} border flex items-center justify-center shrink-0 mt-0.5`}>
                          <Package className="h-5 w-5" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-black text-xs text-slate-900 truncate">
                            {item.name}
                          </span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                            {item.sku}
                          </span>
                          {item.barcode && (
                            <span className="text-[9px] font-mono text-slate-500 bg-slate-50 px-1 rounded border border-slate-150 shrink-0 flex items-center gap-1">
                              <Barcode className="h-2.5 w-2.5 text-slate-400" />
                              {item.barcode}
                            </span>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 leading-snug">
                            {item.description}
                          </p>
                        )}

                        {/* Location and Category badges */}
                        <div className="flex items-center gap-2 mt-1 flex-wrap text-[10px]">
                          <span className="text-slate-400 font-medium">
                            {item.category}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className={`font-mono font-bold ${item.qty > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {item.qty} uds catálogo
                          </span>

                          {showBinsDetail && itemBins.length > 0 && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-blue-700 font-mono font-semibold flex items-center gap-0.5">
                                <MapPin className="h-3 w-3" />
                                {itemBins.map(b => `${b.id} (${b.occupiedQty}u)`).join(', ')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        (item.qty || 0) > 0 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {(item.qty || 0) > 0 ? 'Disponible' : 'Sin stock'}
                      </span>
                      <span className={`text-[10px] font-bold ${themeStyles.textAccent} flex items-center gap-0.5`}>
                        <span>Seleccionar</span>
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>

                  {/* Direct Bin selection buttons for movements */}
                  {showDirectBinSelection && itemBins.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-150/70 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider font-mono flex items-center gap-1">
                        <Boxes className="h-3 w-3 text-indigo-500" />
                        Celdas específicas:
                      </span>
                      {itemBins.map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(item, b.id);
                          }}
                          className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-mono font-bold text-[10px] transition cursor-pointer active:scale-95 flex items-center gap-1"
                          title={`Seleccionar directamente la celda ${b.id}`}
                        >
                          <span>{b.id}</span>
                          <span className="text-indigo-900 font-black">({b.occupiedQty}u)</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCANNER MODAL: CÁMARA EN VIVO / PISTOLA USB / SIMULACIÓN DE ESCANEO         */}
      {/* ========================================================================= */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden space-y-0">
            {/* Modal Header */}
            <div className={`p-4 sm:p-5 flex items-center justify-between ${themeStyles.scannerModalHeader}`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Scan className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight text-white uppercase font-mono">
                    Lector de Códigos de Barras
                  </h3>
                  <p className="text-[11px] text-white/80">
                    Escaneo óptico por cámara, pistola USB o lectura simulada
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setShowScannerModal(false);
                }}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="Cerrar escáner"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Feedback Alert if scan registered */}
              {scannerFeedback && (
                <div className="p-3 bg-slate-900 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-2 animate-fadeIn">
                  <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{scannerFeedback}</span>
                </div>
              )}

              {/* Status Bar */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-emerald-600 animate-pulse" />
                  <span className="font-bold">Lector de Pistola USB / Bluetooth Activo</span>
                </div>
                <span className="text-[10px] font-mono bg-emerald-200/60 text-emerald-950 px-2 py-0.5 rounded font-black">
                  ONLINE
                </span>
              </div>

              {/* Camera Feed or Camera Button */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-950 text-white relative">
                {isCameraActive ? (
                  <div className="relative aspect-video flex items-center justify-center overflow-hidden">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {/* Laser scanning crosshair animation */}
                    <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse"></div>
                    <div className="absolute inset-8 border-2 border-emerald-400/50 rounded-xl pointer-events-none flex items-center justify-center">
                      <span className="text-[10px] font-mono bg-slate-900/80 text-emerald-300 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Enfoque el código de barras
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={stopCamera}
                      className="absolute bottom-2.5 right-2.5 text-[10px] bg-slate-900/80 hover:bg-slate-900 text-white px-2.5 py-1 rounded-lg border border-slate-700 transition cursor-pointer"
                    >
                      Pausar Cámara
                    </button>
                  </div>
                ) : (
                  <div className="p-6 text-center space-y-3">
                    <div className="h-12 w-12 rounded-2xl bg-white/10 mx-auto flex items-center justify-center text-slate-300">
                      <Camera className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-200">
                        Escáner con Cámara del Dispositivo
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs mx-auto">
                        Utilice la cámara web o del móvil para leer códigos EAN-13, SKU o códigos de celdas físicas.
                      </p>
                    </div>
                    {cameraError && (
                      <div className="text-[11px] text-amber-300 bg-amber-950/50 border border-amber-800 p-2 rounded-lg text-left">
                        {cameraError}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer inline-flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Camera className="h-4 w-4" />
                      <span>Activar Cámara de Escaneo</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Barcode Simulator for Testing / Instant Click */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider font-mono flex items-center gap-1">
                    <Barcode className="h-3.5 w-3.5 text-slate-600" />
                    <span>Códigos de Barra Rápidos para Escanear con 1-Clic:</span>
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {inventory.length} artículos disponibles
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-50 border border-slate-200 rounded-xl">
                  {inventory.map((item) => (
                    <button
                      key={item.sku}
                      type="button"
                      onClick={() => {
                        handleScannedCode(item.barcode || item.sku);
                      }}
                      className="p-2 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg text-left transition cursor-pointer group shadow-3xs flex items-center justify-between"
                      title={`Simular escaneo de ${item.name} (${item.barcode || item.sku})`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-mono font-bold text-xs text-slate-800 block truncate group-hover:text-indigo-600">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400">
                          <span>{item.sku}</span>
                          {item.barcode && (
                            <>
                              <span>•</span>
                              <span className="text-slate-600 font-bold">{item.barcode}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-slate-100 group-hover:bg-indigo-100 text-slate-600 group-hover:text-indigo-700 px-1.5 py-0.5 rounded shrink-0">
                        Escanear →
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Bin Barcodes for Movimientos if enabled */}
              {allowBinScanning && bins.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-slate-150">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider font-mono flex items-center gap-1">
                    <Boxes className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Celdas Físicas para Escaneo Directo (QR / Código de Bahía):</span>
                  </span>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {bins.filter(b => b.occupiedSku && b.occupiedQty > 0).slice(0, 6).map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleScannedCode(b.id)}
                        className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg text-xs font-mono font-bold text-slate-700 shrink-0 transition cursor-pointer"
                        title={`Escanear código de celda ${b.id}`}
                      >
                        {b.id} ({b.occupiedQty}u)
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-150 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Volume2 className="h-3.5 w-3.5 text-slate-400" />
                Emite pitido sonoro automático al validar lectura
              </span>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setShowScannerModal(false);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
