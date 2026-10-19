import React, { useState } from 'react';
import { 
  RefreshCw, 
  FileSpreadsheet, 
  Printer, 
  Calendar,
  ExternalLink,
  Globe,
  LayoutGrid,
  X,
  PlusCircle
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
  pendingDeliveriesCount?: number;
  unpaidOrdersCount?: number;
  onQuickNewOrder?: () => void;
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
  pendingDeliveriesCount = 0,
  unpaidOrdersCount = 0,
  onQuickNewOrder,
  onExportExcel,
  onOpenReportModal
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const totalPendingAlerts = pendingDeliveriesCount + unpaidOrdersCount;

  const tabs = [
    { id: 'pedidos', label: 'Pedidos & Carga', shortLabel: 'Pedidos', icon: '⚡', badge: totalPendingAlerts },
    { id: 'dashboard', label: 'Resumen Ejecutivo', shortLabel: 'Resumen', icon: '📊' },
    { id: 'productos', label: 'Análisis de Productos', shortLabel: 'Productos', icon: '🏆' },
    { id: 'recompra', label: 'Radar de Recompra', shortLabel: 'Recompra', icon: '🎯' },
    { id: 'recomendaciones', label: 'Promociones & Combos', shortLabel: 'Promos', icon: '🚀' },
    { id: 'comparativa', label: 'Comparativa Períodos', shortLabel: 'Comparativa', icon: '📈' },
    { id: 'simulador', label: 'Simulador de Precios', shortLabel: 'Simulador', icon: '💡' },
    { id: 'stock', label: 'Stock & Próx. Compra', shortLabel: 'Stock', icon: '📦' },
    { id: 'clientes', label: 'Clientes & Cobranzas', shortLabel: 'Clientes', icon: '👥' },
    { id: 'ventas', label: 'Libro de Ventas', shortLabel: 'Ventas', icon: '📋' },
  ];

  const currentTabObj = tabs.find(t => t.id === activeTab) || tabs[0];

  return (
    <header className="bg-[#0f4b25] text-white shadow-lg sticky top-0 z-50 transition-all border-b-2 md:border-b-4 border-[#e68628]">
      {/* Top Banner: Ultra-compact single line on mobile (< md), full rich layout on desktop (md+) */}
      <div className="w-full max-w-[1800px] mx-auto px-2.5 sm:px-6 lg:px-8 py-1.5 md:py-3.5">
        
        {/* MOBILE TOP BAR (< md): Fits in a single 40px row */}
        <div className="flex md:hidden items-center justify-between gap-1.5">
          {/* Left: Compact Logo + Brand */}
          <button
            type="button"
            onClick={() => setActiveTab('pedidos')}
            className="flex items-center space-x-2 text-left shrink-0 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-[#0f4b25] flex items-center justify-center border border-[#e68628] overflow-hidden shrink-0">
              <img src="/logo.webp" alt="Yerbazo" className="w-full h-full object-contain p-0.5" />
            </div>
            <div>
              <div className="flex items-center space-x-1">
                <span className="text-base font-black font-display tracking-tight text-[#ece7d7] leading-none">
                  YERBAZO
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title={`Sincronizado: ${lastSyncTime}`} />
              </div>
              <span className="text-[10px] text-[#e68628] font-extrabold block leading-tight truncate max-w-[110px]">
                {currentTabObj.icon} {currentTabObj.shortLabel}
              </span>
            </div>
          </button>

          {/* Right: Inline Month Selector + Sync Icon + Sections/Tools Grid Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Compact Month Filter */}
            <div className="flex items-center bg-[#0a341a] px-2 py-1 rounded-lg border border-[#ece7d7]/20">
              <Calendar className="w-3 h-3 text-[#e68628] mr-1 shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                aria-label="Seleccionar período"
                className="bg-transparent text-[11px] font-bold text-[#ece7d7] focus:outline-none cursor-pointer max-w-[88px] truncate"
              >
                <option value="TODOS" className="bg-[#0a341a] text-white">Histórico</option>
                {CHRONOLOGICAL_MONTHS.slice(1).reverse().map((m) => (
                  <option key={m} value={m} className="bg-[#0a341a] text-white">
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Compact Sync Icon Button */}
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing}
              title="Sincronizar ahora con Google Sheets"
              className={`p-1.5 rounded-lg transition-all active:scale-95 cursor-pointer ${
                isSyncing
                  ? 'bg-amber-600 text-white'
                  : 'bg-[#ece7d7] text-[#0f4b25]'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>

            {/* Open All Sections & Tools Drawer */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer border ${
                mobileMenuOpen
                  ? 'bg-[#e68628] text-stone-950 border-white'
                  : 'bg-[#0a341a] text-[#ece7d7] border-[#e68628]/60'
              }`}
            >
              {mobileMenuOpen ? <X className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5 text-[#e68628]" />}
              <span>Menú</span>
            </button>
          </div>
        </div>

        {/* DESKTOP TOP BAR (md+): Full Rich Header */}
        <div className="hidden md:flex md:flex-row md:items-center md:justify-between gap-4">
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
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick New Order Button */}
            {onQuickNewOrder && (
              <button
                onClick={onQuickNewOrder}
                title="Cargar un nuevo pedido en Yerbazo"
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#e68628] hover:bg-[#cc721b] text-stone-950 text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <span>➕ Cargar Pedido</span>
              </button>
            )}

            {/* Month Filter Selector */}
            <div className="flex items-center bg-[#0a341a] px-3 py-1.5 rounded-xl border border-[#ece7d7]/20 shadow-inner">
              <Calendar className="w-4 h-4 text-[#e68628] mr-2" />
              <span className="text-xs text-[#ece7d7]/70 mr-1.5 font-medium hidden lg:inline">Período:</span>
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
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer ${
                isSyncing
                  ? 'bg-amber-600/80 cursor-wait text-white'
                  : 'bg-[#ece7d7] text-[#0f4b25] hover:bg-white hover:text-stone-900'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-white' : 'text-[#0f4b25]'}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Sheets'}</span>
            </button>

            {/* Sync Timestamp indicator */}
            <div className="hidden xl:flex items-center text-[11px] text-[#ece7d7]/75 bg-[#0a341a]/60 px-2.5 py-1.5 rounded-lg border border-white/5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
              <span>Sync: {lastSyncTime}</span>
            </div>

            {/* Executive Report Button */}
            <button
              onClick={onOpenReportModal}
              title="Generar reporte ejecutivo imprimible o PDF"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold shadow-sm transition-colors active:scale-95 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#e68628]" />
              <span>Reporte</span>
            </button>

            {/* Export Excel Button */}
            <button
              onClick={onExportExcel}
              title="Exportar base completa a formato Excel (.xlsx)"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-semibold border border-white/20 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
              <span>Excel</span>
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
              className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#0a341a] hover:bg-[#134826] text-[#ece7d7] text-xs font-bold border border-[#e68628]/60 shadow-sm transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <Globe className="w-3.5 h-3.5 text-[#e68628]" />
              <span>yerbazo.com.ar</span>
              <ExternalLink className="w-3 h-3 text-[#ece7d7]/60" />
            </a>
          </div>
        </div>
      </div>

      {/* MOBILE EXPANDABLE QUICK-JUMP MENU (All 10 Sections + Tools in 1 view without scrolling) */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0a341a] border-t border-white/15 px-3 py-3 space-y-3 shadow-2xl">
          <div className="flex items-center justify-between text-[11px] text-[#ece7d7]/70 font-bold px-1">
            <span>IR A CUALQUIER SECCIÓN (10 MÓDULOS)</span>
            <span className="text-emerald-400 font-mono">Sync: {lastSyncTime}</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const hasBadge = typeof tab.badge === 'number' && tab.badge > 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileMenuOpen(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#ece7d7] text-[#0f4b25] font-black shadow-sm'
                      : 'bg-white/5 text-[#ece7d7] hover:bg-white/10 border border-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-sm shrink-0">{tab.icon}</span>
                    <span className="truncate">{tab.shortLabel}</span>
                  </div>
                  {hasBadge && (
                    <span className="bg-[#e68628] text-stone-950 text-[10px] font-black px-1.5 py-0.2 rounded-full shrink-0">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Mobile Quick Actions Row */}
          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-white/10">
            {onQuickNewOrder && (
              <button
                type="button"
                onClick={() => {
                  onQuickNewOrder();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-center space-x-1 py-2 px-2 rounded-xl bg-[#e68628] text-stone-950 text-[11px] font-black cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                <span>+ Pedido</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onOpenReportModal();
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center space-x-1 py-2 px-2 rounded-xl bg-white/10 text-white text-[11px] font-bold cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#e68628] shrink-0" />
              <span>Reporte PDF</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onExportExcel();
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center space-x-1 py-2 px-2 rounded-xl bg-emerald-800 text-white text-[11px] font-bold cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>Bajar Excel</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 text-[11px]">
            <a
              href="https://docs.google.com/spreadsheets/d/15hjl5YFZqSFRGuh1IEv7zHDRXrQPPfvRU8dijVOmWPY/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-emerald-300 font-bold hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Abrir "Copia de Yerbazo.ba" en Google Sheets</span>
            </a>
            <a
              href="https://yerbazo.com.ar/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-[#ece7d7]/80 font-bold hover:underline"
            >
              <Globe className="w-3 h-3 text-[#e68628]" />
              <span>yerbazo.com.ar</span>
            </a>
          </div>
        </div>
      )}

      {/* Navigation Sub-bar: Ultra-slim on mobile (py-1), 10-col grid on desktop */}
      <nav aria-label="Navegación principal" className="bg-[#0a341a] px-2 sm:px-4 lg:px-6 border-t border-white/10 w-full shadow-inner overflow-x-auto no-scrollbar">
        <div className="w-full flex lg:grid lg:grid-cols-10 gap-1 sm:gap-1.5 py-1 md:py-1.5 min-w-max lg:min-w-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const hasBadge = typeof tab.badge === 'number' && tab.badge > 0;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMobileMenuOpen(false);
                }}
                title={tab.label}
                className={`flex items-center justify-center space-x-1 sm:space-x-1.5 px-2.5 lg:px-1.5 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[11px] lg:text-xs font-semibold tracking-tight transition-all duration-150 cursor-pointer select-none text-center shrink-0 ${
                  isActive
                    ? 'bg-[#ece7d7] text-[#0f4b25] shadow-sm font-extrabold'
                    : tab.id === 'pedidos'
                    ? 'bg-[#e68628]/20 text-[#ece7d7] border border-[#e68628]/50 hover:bg-[#e68628]/30 font-bold'
                    : 'text-[#ece7d7]/75 hover:text-white hover:bg-white/10'
                }`}
              >
                <span className="shrink-0 text-xs md:text-sm leading-none">{tab.icon}</span>
                <span className="hidden 2xl:inline truncate">{tab.label}</span>
                <span className="2xl:hidden truncate">{tab.shortLabel}</span>
                {hasBadge && (
                  <span className="bg-[#e68628] text-stone-950 text-[10px] font-black px-1.5 py-0.2 rounded-full leading-tight">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
};

