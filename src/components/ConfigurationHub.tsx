import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Palette, 
  UserCheck, 
  BookOpen, 
  Sparkles,
  Sliders,
  Building2
} from 'lucide-react';
import { PlatformTheme } from '../types';
import { PlatformSettings } from './PlatformSettings';
import { CrewManager, OperatorProfile } from './CrewManager';
import { UserManual } from './UserManual';
import { WarehouseSectionManager } from './WarehouseSectionManager';

interface ConfigurationHubProps {
  theme: PlatformTheme;
  onUpdateTheme: (newTheme: PlatformTheme) => void;
  onResetTheme: () => void;
  activeOperator: OperatorProfile | null;
  onSelectOperator: (profile: OperatorProfile | null) => void;
  platformUser?: any;
  initialSection?: 'appearance' | 'crew' | 'manual' | 'warehouses';
  onNavigateToTab?: (tab: string) => void;
}

export const ConfigurationHub: React.FC<ConfigurationHubProps> = ({
  theme,
  onUpdateTheme,
  onResetTheme,
  activeOperator,
  onSelectOperator,
  platformUser,
  initialSection = 'appearance',
  onNavigateToTab
}) => {
  const [activeSection, setActiveSection] = useState<'appearance' | 'crew' | 'manual' | 'warehouses'>(initialSection);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  const navigationItems = [
    {
      id: 'warehouses' as const,
      label: 'Almacenes y Subalmacenes',
      shortLabel: 'Almacenes y Secciones',
      description: 'Dar de alta almacenes (OXXO, Construcción, Transporte) y subalmacenes especializados',
      icon: Building2,
      badge: 'Secciones'
    },
    {
      id: 'appearance' as const,
      label: 'Apariencia y Colores',
      shortLabel: 'Imagen y Colores',
      description: 'Cambiar imagen/logo de la plataforma y colores del sistema',
      icon: Palette,
      badge: 'Branding'
    },
    {
      id: 'crew' as const,
      label: 'Registro de Personal',
      shortLabel: 'Personal y Accesos',
      description: 'Operadores, credenciales PIN, turnos de trabajo y posiciones',
      icon: UserCheck,
      badge: activeOperator ? '1 Activo' : undefined
    },
    {
      id: 'manual' as const,
      label: 'Manual de Usuario',
      shortLabel: 'Guías y Manual WMS',
      description: 'Instrucciones operativas paso a paso, búsqueda y directrices',
      icon: BookOpen,
      badge: 'Guía'
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      
      {/* Top Header Card for Configuration Module */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-250/70 shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div 
                className="h-8 w-8 rounded-xl flex items-center justify-center text-white shadow-xs transition-colors"
                style={{ backgroundColor: theme.primaryColor }}
              >
                <Settings className="h-4.5 w-4.5" />
              </div>
              <span className="text-[10px] font-black tracking-widest uppercase font-mono text-slate-400">
                Módulo Central de Administración
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Configuración del Sistema
            </h1>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              De alta almacenes para secciones operativas (OXXO, Construcción, Transporte) y subalmacenes, personalice la imagen corporativa y colores de la plataforma, administre el personal operativo y consulte el manual WMS.
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto bg-slate-50 p-2 rounded-xl border border-slate-250/60 shrink-0 text-xs">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Sección:</span>
            <span 
              className="font-bold px-2 py-0.5 rounded-lg text-white font-mono text-xs"
              style={{ backgroundColor: theme.primaryColor }}
            >
              {navigationItems.find(i => i.id === activeSection)?.shortLabel}
            </span>
          </div>
        </div>

        {/* Configuration Sub-tabs Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-5">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                style={{
                  borderColor: isActive ? theme.primaryColor : undefined,
                  backgroundColor: isActive ? `${theme.primaryColor}08` : undefined
                }}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between select-none ${
                  isActive
                    ? 'border-2 shadow-xs'
                    : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div 
                      className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                        isActive ? 'text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                      style={{ backgroundColor: isActive ? theme.primaryColor : undefined }}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <span className={`text-xs font-bold block ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                        {item.label}
                      </span>
                      <span className="text-[10px] text-slate-400 block line-clamp-1 mt-0.5">
                        {item.description}
                      </span>
                    </div>
                  </div>

                  {item.badge && (
                    <span 
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                        isActive 
                          ? 'border-transparent text-white' 
                          : 'border-slate-200 text-slate-500 bg-slate-50'
                      }`}
                      style={{ backgroundColor: isActive ? theme.primaryColor : undefined }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>

                {/* Active indicator bar */}
                <div className="mt-2.5 pt-2 border-t border-slate-100/70 flex items-center justify-between text-[10px]">
                  <span className={`font-semibold ${isActive ? 'text-slate-800' : 'text-slate-400'}`}>
                    {isActive ? '● Módulo Seleccionado' : 'Haga clic para abrir'}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">
                    {item.shortLabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Render Active Section Content */}
      <div className="transition-all">
        {activeSection === 'warehouses' && (
          <WarehouseSectionManager
            platformTheme={theme}
            onNavigateToTab={onNavigateToTab}
          />
        )}

        {activeSection === 'appearance' && (
          <PlatformSettings
            theme={theme}
            onUpdateTheme={onUpdateTheme}
            onResetTheme={onResetTheme}
          />
        )}

        {activeSection === 'crew' && (
          <CrewManager
            activeOperator={activeOperator}
            onSelectOperator={onSelectOperator}
            platformUser={platformUser}
            onNavigateToAppearance={() => setActiveSection('appearance')}
            onNavigateToManual={() => setActiveSection('manual')}
          />
        )}

        {activeSection === 'manual' && (
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
            <UserManual />
          </div>
        )}
      </div>

    </div>
  );
};
