import React, { useState, useRef, ChangeEvent } from 'react';
import { 
  Palette, 
  Image as ImageIcon, 
  Upload, 
  RefreshCw, 
  Check, 
  Save, 
  RotateCcw, 
  Boxes, 
  Truck, 
  Package, 
  Building2, 
  Shield, 
  Database, 
  Eye, 
  Sliders,
  Sparkles,
  Link as LinkIcon,
  X
} from 'lucide-react';
import { PlatformTheme } from '../types';

interface PlatformSettingsProps {
  theme: PlatformTheme;
  onUpdateTheme: (newTheme: PlatformTheme) => void;
  onResetTheme: () => void;
}

export const DEFAULT_THEME_VALUES: PlatformTheme = {
  logoUrl: '',
  logoType: 'preset',
  presetIcon: 'boxes',
  platformName: 'O-WMS PRO',
  versionTag: 'v1.2',
  primaryColor: '#2563eb', // Royal Blue
  sidebarColor: '#0f172a', // Midnight Slate-900
  canvasBg: 'slate'
};

const COLOR_PRESETS = [
  { id: 'blue', name: 'Azul Real Corporativo', hex: '#2563eb', desc: 'Estándar empresarial WMS' },
  { id: 'indigo', name: 'Índigo High-Tech', hex: '#4f46e5', desc: 'Moderno y tecnológico' },
  { id: 'emerald', name: 'Verde Esmeralda Logístico', hex: '#059669', desc: 'Cadena de suministro y eficiencia' },
  { id: 'violet', name: 'Violeta Eléctrico', hex: '#7c3aed', desc: 'Vanguardista y audaz' },
  { id: 'amber', name: 'Ámbar Industrial', hex: '#d97706', desc: 'Seguridad y dinamismo de andén' },
  { id: 'cyan', name: 'Turquesa / Cyan Nórdico', hex: '#0891b2', desc: 'Precisión y claridad' },
  { id: 'rose', name: 'Rojo Carmesí / Flame', hex: '#e11d48', desc: 'Alta prioridad y energía' },
  { id: 'slate', name: 'Grafito Titanio', hex: '#334155', desc: 'Sobrio y minimalista' },
];

const SIDEBAR_PRESETS = [
  { id: 'slate', name: 'Azul Marino Profundo', hex: '#0f172a', desc: 'Slate 900 (Estándar)' },
  { id: 'charcoal', name: 'Carbón Puro', hex: '#18181b', desc: 'Zinc 900 neutro' },
  { id: 'cobalt', name: 'Noche Cobalto', hex: '#0b192c', desc: 'Azul muy oscuro' },
  { id: 'forest', name: 'Verde Abisal', hex: '#051f18', desc: 'Verde esmeralda oscuro' },
  { id: 'imperial', name: 'Púrpura Imperial', hex: '#1a102f', desc: 'Violeta nocturno' },
  { id: 'graphite', name: 'Pizarra Mate', hex: '#1e293b', desc: 'Slate 800 contrastado' },
];

const PRESET_ICONS = [
  { id: 'boxes', label: 'Cajas WMS', icon: Boxes },
  { id: 'truck', label: 'Flota Envíos', icon: Truck },
  { id: 'package', label: 'Paquetería', icon: Package },
  { id: 'warehouse', label: 'Racks Almacén', icon: Building2 },
  { id: 'shield', label: 'Seguridad', icon: Shield },
  { id: 'database', label: 'Base de Datos', icon: Database },
];

export const PlatformSettings: React.FC<PlatformSettingsProps> = ({
  theme,
  onUpdateTheme,
  onResetTheme
}) => {
  // Local form state
  const [formData, setFormData] = useState<PlatformTheme>({ ...theme });
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [urlInput, setUrlInput] = useState<string>(theme.logoUrl || '');
  const [showUrlField, setShowUrlField] = useState<boolean>(Boolean(theme.logoUrl && !theme.logoUrl.startsWith('data:')));
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle image file upload (convert to Base64 data URL)
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Por favor seleccione una imagen menor a 2MB para un rendimiento óptimo.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const updated: PlatformTheme = {
          ...formData,
          logoUrl: result,
          logoType: 'image'
        };
        setFormData(updated);
        onUpdateTheme(updated);
        triggerSuccessToast();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyUrl = () => {
    if (urlInput.trim()) {
      const updated: PlatformTheme = {
        ...formData,
        logoUrl: urlInput.trim(),
        logoType: 'image'
      };
      setFormData(updated);
      onUpdateTheme(updated);
      triggerSuccessToast();
    }
  };

  const handleSelectPresetIcon = (iconId: any) => {
    const updated: PlatformTheme = {
      ...formData,
      logoType: 'preset',
      presetIcon: iconId,
      logoUrl: ''
    };
    setFormData(updated);
    setUrlInput('');
    onUpdateTheme(updated);
    triggerSuccessToast();
  };

  const handleRemoveImage = () => {
    const updated: PlatformTheme = {
      ...formData,
      logoType: 'preset',
      logoUrl: '',
      presetIcon: 'boxes'
    };
    setFormData(updated);
    setUrlInput('');
    onUpdateTheme(updated);
    triggerSuccessToast();
  };

  const handleSelectPrimaryColor = (hex: string) => {
    const updated: PlatformTheme = {
      ...formData,
      primaryColor: hex
    };
    setFormData(updated);
    onUpdateTheme(updated);
    triggerSuccessToast();
  };

  const handleSelectSidebarColor = (hex: string) => {
    const updated: PlatformTheme = {
      ...formData,
      sidebarColor: hex
    };
    setFormData(updated);
    onUpdateTheme(updated);
    triggerSuccessToast();
  };

  const handleSaveAll = () => {
    onUpdateTheme(formData);
    triggerSuccessToast();
  };

  const handleResetToDefault = () => {
    setFormData({ ...DEFAULT_THEME_VALUES });
    setUrlInput('');
    onResetTheme();
    triggerSuccessToast();
  };

  const triggerSuccessToast = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  // Render chosen icon or image
  const renderPreviewLogo = () => {
    if (formData.logoType === 'image' && formData.logoUrl) {
      return (
        <img 
          src={formData.logoUrl} 
          alt="Logo de la plataforma" 
          className="h-full w-full object-contain rounded-xl"
        />
      );
    }
    const PresetIconComponent = PRESET_ICONS.find(p => p.id === formData.presetIcon)?.icon || Boxes;
    return <PresetIconComponent className="h-6 w-6 text-white" />;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fadeIn">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 text-white p-6 sm:p-7 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div 
                className="h-8 w-8 rounded-xl flex items-center justify-center text-white shadow-md transition-colors"
                style={{ backgroundColor: formData.primaryColor }}
              >
                <Palette className="h-4.5 w-4.5" />
              </div>
              <span className="text-xs font-black tracking-widest uppercase font-mono text-slate-300">
                PERSONALIZACIÓN VISUAL & BRANDING WMS
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Configuración de Apariencia: Imagen y Colores
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Personalice la identidad visual de la plataforma cambiando el logotipo o imagen corporativa, el nombre del sistema y la paleta de colores del encabezado y la barra de navegación lateral.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end shrink-0">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              title="Restablecer logotipo y colores predeterminados"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Restablecer</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              className="px-4 py-2 text-white rounded-xl text-xs font-black shadow-lg transition flex items-center gap-2 cursor-pointer"
              style={{ backgroundColor: formData.primaryColor }}
            >
              <Save className="h-4 w-4" />
              <span>Guardar y Aplicar</span>
            </button>
          </div>
        </div>

        {/* Live Feedback Toast */}
        {saveSuccess && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>¡Cambios de imagen y colores guardados y aplicados reactivamente en toda la plataforma!</span>
          </div>
        )}
      </div>

      {/* Interactive Mockup Live Preview */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-slate-600" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider font-mono">
              Previsualización en Tiempo Real del Encabezado & Menú Lateral
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Vista previa interactiva
          </span>
        </div>

        {/* Mini Preview Frame */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-slate-100">
          {/* Header Preview */}
          <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="h-10 w-10 rounded-xl flex items-center justify-center p-1 shadow-xs transition-colors shrink-0"
                style={{ backgroundColor: formData.primaryColor }}
              >
                {renderPreviewLogo()}
              </div>
              <div>
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-extrabold text-slate-900 tracking-tight text-sm">
                    {formData.platformName || 'O-WMS PRO'}
                  </span>
                  <span 
                    className="text-[9px] font-bold font-mono px-1 py-0.5 rounded border"
                    style={{ 
                      borderColor: formData.primaryColor,
                      color: formData.primaryColor,
                      backgroundColor: `${formData.primaryColor}15`
                    }}
                  >
                    {formData.versionTag || 'v1.2'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
                  Conectado: Admin de Logística
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span 
                className="text-[10px] text-white font-bold px-2.5 py-1 rounded-lg"
                style={{ backgroundColor: formData.primaryColor }}
              >
                Módulo Activo
              </span>
            </div>
          </div>

          {/* Mini Sidebar & Content Mockup */}
          <div className="flex h-24">
            <div 
              className="w-48 p-3 flex flex-col justify-between text-[11px] transition-colors"
              style={{ backgroundColor: formData.sidebarColor }}
            >
              <div className="space-y-1">
                <span className="text-[8px] font-mono uppercase text-slate-400 block font-bold tracking-wider">
                  Menú Lateral
                </span>
                <div 
                  className="px-2 py-1 rounded text-white font-bold text-[10px] flex items-center gap-1.5 shadow-xs"
                  style={{ backgroundColor: formData.primaryColor }}
                >
                  <Boxes className="h-3 w-3" />
                  <span>Entradas (Activo)</span>
                </div>
                <div className="px-2 py-0.5 rounded text-slate-400 text-[10px]">
                  <span>Salidas</span>
                </div>
              </div>
              <span className="text-[8px] text-slate-500 font-mono">
                {formData.sidebarColor}
              </span>
            </div>

            <div className="flex-1 p-3 bg-slate-50/70 flex items-center justify-center">
              <span className="text-xs text-slate-400 font-medium">
                Área de trabajo del almacén con fondo adaptativo
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECCIÓN 1: CAMBIAR LA IMAGEN / LOGO DE LA PLATAFORMA
         ========================================================================= */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
              <ImageIcon className="h-4.5 w-4.5 text-blue-600" />
              1. Imagen y Logotipo de la Plataforma
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cargue una imagen corporativa propia (PNG, JPG, SVG) o elija un icono distintivo predefinido para el encabezado.
            </p>
          </div>

          {formData.logoUrl && (
            <button
              type="button"
              onClick={handleRemoveImage}
              className="text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer w-fit"
            >
              <X className="h-3.5 w-3.5" />
              <span>Quitar Imagen Personalizada</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Col 1: Vista Previa del Logo Actual y Carga de Archivo */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 font-mono block">
                Logotipo Actual
              </span>
              
              <div className="flex justify-center">
                <div 
                  className="h-20 w-20 rounded-2xl flex items-center justify-center p-2 shadow-md border-2 border-white transition-colors"
                  style={{ backgroundColor: formData.primaryColor }}
                >
                  {renderPreviewLogo()}
                </div>
              </div>

              <div className="pt-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Upload className="h-4 w-4 text-blue-600" />
                  <span>Subir Imagen desde el Equipo</span>
                </button>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Formatos recomendados: PNG o SVG transparente (máx. 2MB)
                </span>
              </div>
            </div>

            {/* Alternativa: URL de Imagen */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowUrlField(!showUrlField)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
              >
                <LinkIcon className="h-3.5 w-3.5 text-slate-500" />
                <span>{showUrlField ? 'Ocultar ingreso por URL' : 'O vincular imagen mediante URL'}</span>
              </button>

              {showUrlField && (
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://ejemplo.com/logo.png"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Aplicar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Col 2: Iconos Corporativos Predefinidos & Textos de Marca */}
          <div className="lg:col-span-8 space-y-5">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">
                O seleccione un icono temático de almacén predefinido:
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PRESET_ICONS.map((p) => {
                  const Icon = p.icon;
                  const isSelected = formData.logoType === 'preset' && formData.presetIcon === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPresetIcon(p.id)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-3 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                      }`}
                    >
                      <div 
                        className="h-9 w-9 rounded-lg flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: formData.primaryColor }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 text-xs block truncate">{p.label}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {isSelected ? '✓ Seleccionado' : 'Hacer clic'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Configuración del Título y Subtítulo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block font-mono">
                  Nombre de la Plataforma
                </label>
                <input
                  type="text"
                  placeholder="ej. O-WMS PRO o Mi Empresa"
                  value={formData.platformName}
                  onChange={(e) => {
                    const updated = { ...formData, platformName: e.target.value };
                    setFormData(updated);
                    onUpdateTheme(updated);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block font-mono">
                  Etiqueta de Versión / Sucursal
                </label>
                <input
                  type="text"
                  placeholder="ej. v1.2 o Planta Central"
                  value={formData.versionTag}
                  onChange={(e) => {
                    const updated = { ...formData, versionTag: e.target.value };
                    setFormData(updated);
                    onUpdateTheme(updated);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* =========================================================================
          SECCIÓN 2: CAMBIAR LOS COLORES DE LA PLATAFORMA
         ========================================================================= */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
            <Palette className="h-4.5 w-4.5 text-indigo-600" />
            2. Paleta de Colores de la Plataforma
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Seleccione el color de acento principal para botones y destaques, y el tema de fondo de la barra de navegación lateral.
          </p>
        </div>

        {/* 2.1 Color Primario / Acento */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <label className="text-xs font-bold text-slate-800 block">
                Color Primario de Acento & Botones
              </label>
              <span className="text-[11px] text-slate-400 block">
                Afecta botones principales, indicadores activos del menú, gráficos y resaltados.
              </span>
            </div>

            {/* Selector de color HEX nativo */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-fit">
              <span className="text-[10px] font-mono text-slate-500 font-bold uppercase pl-1">Personalizado:</span>
              <input
                type="color"
                value={formData.primaryColor}
                onChange={(e) => handleSelectPrimaryColor(e.target.value)}
                className="h-7 w-7 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                title="Seleccionar color personalizado"
              />
              <span className="font-mono text-xs font-bold text-slate-800 pr-1">
                {formData.primaryColor}
              </span>
            </div>
          </div>

          {/* Grid de Paletas Predefinidas para Color Primario */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {COLOR_PRESETS.map((color) => {
              const isSelected = formData.primaryColor.toLowerCase() === color.hex.toLowerCase();
              return (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => handleSelectPrimaryColor(color.hex)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? 'border-slate-900 bg-slate-50 shadow-sm ring-2 ring-slate-900/10'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                  }`}
                >
                  <div 
                    className="h-8 w-8 rounded-lg shrink-0 shadow-xs flex items-center justify-center text-white"
                    style={{ backgroundColor: color.hex }}
                  >
                    {isSelected && <Check className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-800 text-xs block truncate">{color.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">{color.hex}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2.2 Color de Fondo de la Barra Lateral */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <label className="text-xs font-bold text-slate-800 block">
                Tema de la Barra de Navegación Lateral (Sidebar)
              </label>
              <span className="text-[11px] text-slate-400 block">
                Modifique el fondo y contraste de la barra izquierda de opciones.
              </span>
            </div>

            {/* Selector de color HEX nativo para sidebar */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-fit">
              <span className="text-[10px] font-mono text-slate-500 font-bold uppercase pl-1">Fondo Barra:</span>
              <input
                type="color"
                value={formData.sidebarColor}
                onChange={(e) => handleSelectSidebarColor(e.target.value)}
                className="h-7 w-7 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                title="Seleccionar color de barra personalizado"
              />
              <span className="font-mono text-xs font-bold text-slate-800 pr-1">
                {formData.sidebarColor}
              </span>
            </div>
          </div>

          {/* Grid de Paletas Predefinidas para Barra Lateral */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SIDEBAR_PRESETS.map((sb) => {
              const isSelected = formData.sidebarColor.toLowerCase() === sb.hex.toLowerCase();
              return (
                <button
                  key={sb.id}
                  type="button"
                  onClick={() => handleSelectSidebarColor(sb.hex)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? 'border-slate-900 bg-slate-50 shadow-sm ring-2 ring-slate-900/10'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                  }`}
                >
                  <div 
                    className="h-8 w-8 rounded-lg shrink-0 shadow-xs flex items-center justify-center text-white border border-white/20"
                    style={{ backgroundColor: sb.hex }}
                  >
                    {isSelected && <Check className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-800 text-xs block truncate">{sb.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">{sb.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2.3 Fondo del Lienzo de la Plataforma */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div>
            <label className="text-xs font-bold text-slate-800 block">
              Fondo del Espacio de Trabajo (Canvas Background)
            </label>
            <span className="text-[11px] text-slate-400 block">
              Tonalidad base del área principal detrás de los módulos y tarjetas.
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'slate', name: 'Gris Suave WMS', desc: 'Slate-50 (#f8fafc)', bgClass: 'bg-slate-50' },
              { id: 'gray', name: 'Gris Neutro Frío', desc: 'Gray-100 (#f3f4f6)', bgClass: 'bg-gray-100' },
              { id: 'zinc', name: 'Zinc Moderno', desc: 'Zinc-50 (#fafafa)', bgClass: 'bg-zinc-50' },
              { id: 'dark', name: 'Contraste Oscuro', desc: 'Slate-900 (#0f172a)', bgClass: 'bg-slate-900' },
            ].map((cv) => {
              const isSelected = formData.canvasBg === cv.id;
              return (
                <button
                  key={cv.id}
                  type="button"
                  onClick={() => {
                    const updated: PlatformTheme = { ...formData, canvasBg: cv.id as any };
                    setFormData(updated);
                    onUpdateTheme(updated);
                    triggerSuccessToast();
                  }}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? 'border-slate-900 bg-slate-50 shadow-sm ring-2 ring-slate-900/10'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`h-8 w-8 rounded-lg shrink-0 border border-slate-300 shadow-2xs ${cv.bgClass} flex items-center justify-center`}>
                    {isSelected && <Check className={`h-4 w-4 ${cv.id === 'dark' ? 'text-white' : 'text-slate-900'}`} />}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-800 text-xs block truncate">{cv.name}</span>
                    <span className="text-[10px] text-slate-400 block truncate">{cv.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Floating Save Actions at bottom */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span>Los cambios se guardan localmente y persisten entre sesiones de navegación.</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Restablecer Original
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-5 py-2 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-2 cursor-pointer"
            style={{ backgroundColor: formData.primaryColor }}
          >
            <Save className="h-4 w-4" />
            <span>Guardar Configuración</span>
          </button>
        </div>
      </div>

    </div>
  );
};
