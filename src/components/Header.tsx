import React from 'react';
import { 
  RefreshCw, 
  Download, 
  FileSpreadsheet, 
  Printer, 
  Calendar,
  Sparkles,
  ExternalLink,
  Layers,
  Globe
} from 'lucide-react';
import { CHRONOLOGICAL_MONTHS } from '../utils/analyticsEngine';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  onSync: () => void;
  isSyncing: boolean;
  lastSyncTime: string;
  webStoreProductCount?: number;
  onExportExcel: () => void;
  onOpenReportModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  selectedMonth,
  setSelectedMonth,
  onSync,
  isSyncing,
  lastSyncTime,
  webStoreProductCount,
  onExportExcel,
  onOpenReportModal
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Resumen Ejecutivo', shortLabel: 'Resumen', icon: '📊' },
    { id: 'productos', label: 'Análisis de Productos', shortLabel: 'Productos', icon: '🏆' },
    { id: 'recompra', label: 'Radar de Recompra', shortLabel: 'Recompra', icon: '🎯' },
    { id: 'recomendaciones', label: 'Promociones & Combos', shortLabel: 'Promos', icon: '🚀' },
    { id: 'comparativa', label: 'Comparativa Períodos', shortLabel: 'Comparativa', icon: '📈' },
    { id: 'simulador', label: 'Simulador de Precios', shortLabel: 'Simulador', icon: '💡' },
    { id: 'stock', label: 'Stock & Próx. Compra', shortLabel: 'Stock & Compra', icon: '📦' },
    { id: 'clientes', label: 'Clientes & Cobranzas', shortLabel: 'Clientes', icon: '👥' },
    { id: 'ventas', label: 'Libro de Ventas', shortLabel: 'Ventas', icon: '📋' },
  ];

  return (
    <header className="bg-[#0f4b25] text-white shadow-xl sticky top-0 z-50 transition-all border-b-4 border-[#e68628]">
      {/* Top Banner */}
      <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Brand Identity */}
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#0f4b25] flex items-center justify-center shadow-lg border-2 border-[#e68628] overflow-hidden select-none transform hover:rotate-6 transition-transform">
              <img 
                src="/logo.webp" 
                alt="Yerbazo Logo" 
                className="w-full h-full object-contain p-0.5" 
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-black font-display tracking-tight text-[#ece7d7] uppercase">
                  YERBAZO
                </h1>
                <span className="bg-[#e68628] text-stone-900 font-bold text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full shadow-sm">
                  Intelligence 2.0
                </span>
              </div>
              <p className="text-xs text-[#ece7d7]/80 font-medium">
                Control Comercial, Rentabilidad & Recomendador Estratégico
              </p>
            </div>
          </div>

          {/* Controls: Month filter, Live Sync & Exports */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Month Filter Selector */}
            <div className="flex items-center bg-[#0a341a] px-3 py-1.5 rounded-xl border border-[#ece7d7]/20 shadow-inner">
              <Calendar className="w-4 h-4 text-[#e68628] mr-2" />
              <span className="text-xs text-[#ece7d7]/70 mr-1.5 font-medium hidden sm:inline">Período:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-sm font-semibold text-[#ece7d7] focus:outline-none cursor-pointer pr-2"
              >
                <option value="TODOS" className="bg-[#0a341a] text-white">Todos los Meses (Histórico)</option>
                {CHRONOLOGICAL_MONTHS.slice(1).reverse().map((m) => (
                  <option key={m} value={m} className="bg-[#0a341a] text-white">
                    Mes: {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Live Sync with Google Sheets */}
            <button
              onClick={onSync}
              disabled={isSyncing}
              title="Sincronizar datos en tiempo real desde Google Sheets"
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
                isSyncing
                  ? 'bg-amber-600/80 cursor-wait text-white'
                  : 'bg-[#ece7d7] text-[#0f4b25] hover:bg-white hover:text-stone-900'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-white' : 'text-[#0f4b25]'}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Sheets'}</span>
            </button>

            {/* Sync Timestamp indicator */}
            <div className="hidden lg:flex items-center text-[11px] text-[#ece7d7]/75 bg-[#0a341a]/60 px-2.5 py-1.5 rounded-lg border border-white/5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
              <span>Sync: {lastSyncTime}</span>
            </div>

            {/* Executive Report Button */}
            <button
              onClick={onOpenReportModal}
              title="Generar reporte ejecutivo imprimible o PDF"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#e68628] hover:bg-[#cc721b] text-white text-xs font-bold shadow-md transition-colors active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reporte</span>
            </button>

            {/* Export Excel Button */}
            <button
              onClick={onExportExcel}
              title="Exportar base completa a formato Excel (.xlsx)"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-semibold border border-white/20 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
              <span className="hidden md:inline">Excel</span>
            </button>

            {/* Google Sheets Link */}
            <a
              href="https://docs.google.com/spreadsheets/d/15hjl5YFZqSFRGuh1IEv7zHDRXrQPPfvRU8dijVOmWPY/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir hoja de cálculo de Google Sheets oficial"
              className="p-1.5 text-[#ece7d7]/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Live Web Store Link */}
            <a
              href="https://yerbazo.com.ar/"
              target="_blank"
              rel="noopener noreferrer"
              title={`Abrir tienda online oficial yerbazo.com.ar (${webStoreProductCount ?? 23} productos conectados)`}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#0a341a] hover:bg-[#134826] text-[#ece7d7] text-xs font-bold border border-[#e68628]/60 shadow-sm transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <Globe className="w-3.5 h-3.5 text-[#e68628]" />
              <span className="hidden sm:inline">yerbazo.com.ar</span>
              <ExternalLink className="w-3 h-3 text-[#ece7d7]/60" />
            </a>

          </div>
        </div>
      </div>

      {/* Navigation Sub-bar */}
      <nav aria-label="Navegación principal" className="bg-[#0a341a] px-2 sm:px-4 lg:px-6 border-t border-white/10 w-full shadow-inner">
        <div className="w-full grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1 sm:gap-1.5 py-1.5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`w-full flex items-center justify-center space-x-1 sm:space-x-1.5 px-1 sm:px-1.5 xl:px-2 py-2 rounded-xl text-[11px] lg:text-xs 2xl:text-sm font-semibold tracking-tight transition-all duration-150 cursor-pointer select-none text-center ${
                  isActive
                    ? 'bg-[#ece7d7] text-[#0f4b25] shadow-md font-bold'
                    : 'text-[#ece7d7]/75 hover:text-white hover:bg-white/10'
                }`}
              >
                <span className="shrink-0 text-sm leading-none">{tab.icon}</span>
                <span className="hidden 2xl:inline truncate">{tab.label}</span>
                <span className="2xl:hidden truncate">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
};
