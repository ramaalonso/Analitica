import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingBag, 
  Package, 
  Award, 
  AlertTriangle, 
  Zap, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldAlert,
  Percent,
  Target,
  Flame
} from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import '../utils/chartConfig';
import { 
  MonthlyMetric, 
  ProductPerformance, 
  YerbazoDataset 
} from '../types';

interface DashboardOverviewProps {
  dataset: YerbazoDataset;
  monthlyMetrics: MonthlyMetric[];
  performances: ProductPerformance[];
  selectedMonth: string;
  onNavigateTab: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  dataset,
  monthlyMetrics,
  performances,
  selectedMonth,
  onNavigateTab
}) => {
  // Current period metrics
  const isAllMonths = selectedMonth === 'TODOS';
  
  // Find current metric or aggregate
  let currentFacturado = 0;
  let currentGanancia = 0;
  let currentVentas = 0;
  let currentUnidades = 0;
  let momFacturadoPorc: number | null = null;
  let momFacturadoDiff: number | null = null;
  let momGananciaPorc: number | null = null;
  let momGananciaDiff: number | null = null;

  if (isAllMonths) {
    currentFacturado = monthlyMetrics.reduce((acc, m) => acc + m.facturado, 0);
    currentGanancia = monthlyMetrics.reduce((acc, m) => acc + m.ganancia, 0);
    currentVentas = dataset.ventas.length;
    currentUnidades = performances.reduce((acc, p) => acc + p.unidadesVendidas, 0);
    
    // Compare last closed month vs previous for headline MoM
    const latestClosedMetric = [...monthlyMetrics].reverse().find(m => m.facturado > 0 && m.crecimientoFacturacionMoM != null) || monthlyMetrics.find(m => m.mesKey === 'Septiembre');
    if (latestClosedMetric) {
      momFacturadoPorc = latestClosedMetric.crecimientoFacturacionMoM;
      momFacturadoDiff = latestClosedMetric.diferenciaFacturacionMoM;
      momGananciaPorc = latestClosedMetric.crecimientoGananciaMoM;
      momGananciaDiff = latestClosedMetric.diferenciaGananciaMoM;
    }
  } else {
    const foundMetric = monthlyMetrics.find(m => m.mesKey === selectedMonth);
    if (foundMetric) {
      currentFacturado = foundMetric.facturado;
      currentGanancia = foundMetric.ganancia;
      currentVentas = foundMetric.cantVentas;
      currentUnidades = foundMetric.unidadesVendidas;
      momFacturadoPorc = foundMetric.crecimientoFacturacionMoM;
      momFacturadoDiff = foundMetric.diferenciaFacturacionMoM;
      momGananciaPorc = foundMetric.crecimientoGananciaMoM;
      momGananciaDiff = foundMetric.diferenciaGananciaMoM;
    }
  }

  const margenGeneral = currentFacturado > 0 ? (currentGanancia / currentFacturado) * 100 : 0;
  const ticketPromedio = currentVentas > 0 ? currentFacturado / currentVentas : 0;

  // Monthly Target & Live Pace Projection (New Feature 3)
  const [monthlyTarget, setMonthlyTarget] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('yerbazo_monthly_target');
      return saved ? parseInt(saved, 10) : 1000000;
    } catch {
      return 1000000;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('yerbazo_monthly_target', monthlyTarget.toString());
    } catch {
      // ignore
    }
  }, [monthlyTarget]);

  // Determine active month for target tracking
  const targetMonthKey = selectedMonth === 'TODOS' 
    ? (monthlyMetrics[monthlyMetrics.length - 1]?.mesKey || 'Octubre')
    : selectedMonth;
  
  const targetMetric = monthlyMetrics.find(m => m.mesKey === targetMonthKey) || monthlyMetrics[monthlyMetrics.length - 1];
  const targetFacturado = targetMetric ? targetMetric.facturado : currentFacturado;
  const targetGanancia = targetMetric ? targetMetric.ganancia : currentGanancia;

  // Real calendar and date math
  const monthMap: Record<string, number> = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
    'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
    'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
  };

  const targetMonthNum = monthMap[targetMonthKey.toLowerCase()] || 10;
  const now = new Date();
  const currentMonthNum = now.getMonth() + 1; // 1-12 (10 for October)
  const currentDayOfMonth = now.getDate(); // e.g. 6

  const isCurrentMonth = targetMonthNum === currentMonthNum;
  const isPastMonth = targetMonthNum < currentMonthNum;

  // Days in target month
  const daysInTargetMonth = useMemo(() => {
    const norm = targetMonthKey.toLowerCase();
    if (norm.includes('sep') || norm.includes('nov') || norm.includes('abr') || norm.includes('jun')) return 30;
    if (norm.includes('feb')) return 28;
    return 31;
  }, [targetMonthKey]);

  // Days elapsed in that month
  const daysElapsed = useMemo(() => {
    if (isCurrentMonth) {
      // In the active current month, elapsed days is today's day of the month!
      return Math.min(daysInTargetMonth, Math.max(1, currentDayOfMonth));
    }
    if (isPastMonth) {
      // Past month is fully closed
      return daysInTargetMonth;
    }
    return 0; // Future month
  }, [isCurrentMonth, isPastMonth, daysInTargetMonth, currentDayOfMonth]);

  const daysRemaining = useMemo(() => {
    if (isCurrentMonth) {
      return Math.max(0, daysInTargetMonth - daysElapsed);
    }
    if (isPastMonth) {
      return 0;
    }
    return daysInTargetMonth;
  }, [isCurrentMonth, isPastMonth, daysInTargetMonth, daysElapsed]);

  // Daily Pace & Projection
  const dailyPace = daysElapsed > 0 ? targetFacturado / daysElapsed : 0;
  const projectedMonthRevenue = isPastMonth 
    ? targetFacturado 
    : (dailyPace * daysInTargetMonth);

  const goalProgressPct = Math.min(100, Math.round((targetFacturado / monthlyTarget) * 100));
  const goalGap = Math.max(0, monthlyTarget - targetFacturado);
  const isGoalReached = targetFacturado >= monthlyTarget;

  const requiredDailyPace = (daysRemaining > 0 && goalGap > 0) 
    ? goalGap / daysRemaining 
    : 0;

  const avgPackPrice = 8500; // Canary standard price
  const packsNeeded = Math.ceil(goalGap / avgPackPrice);
  const projectedDiffVsGoal = projectedMonthRevenue - monthlyTarget;

  // Star product
  const bestProduct = performances[0];
  const criticalStockCount = dataset.stock.filter(p => p.restantes <= 4 && p.vendidas > 0).length;

  // Payment methods breakdown
  const paymentMethods: Record<string, number> = {};
  for (const v of dataset.ventas) {
    if (!isAllMonths && v.mes !== selectedMonth) continue;
    let m = v.medioPago.trim().toLowerCase();
    if (m.includes('mercadopago') || m.includes('mp')) m = 'Mercado Pago';
    else if (m.includes('efectivo') || m.includes('eft')) m = 'Efectivo';
    else if (m === '-' || m === '-----' || !m) m = 'No esp.';
    else m = 'Otros / Mixto';
    paymentMethods[m] = (paymentMethods[m] || 0) + 1;
  }

  // Monthly Revenue Chart Data
  const monthlyChartLabels = monthlyMetrics.map(m => m.mesNombre);
  const monthlyRevenueData = monthlyMetrics.map(m => m.facturado);
  const monthlyProfitData = monthlyMetrics.map(m => m.ganancia);

  const evolutionChartData = {
    labels: monthlyChartLabels,
    datasets: [
      {
        label: 'Facturación ($)',
        data: monthlyRevenueData,
        backgroundColor: '#0f4b25',
        borderRadius: 8,
        borderWidth: 0,
        yAxisID: 'y',
      },
      {
        label: 'Ganancia Neta ($)',
        data: monthlyProfitData,
        backgroundColor: '#e68628',
        borderRadius: 8,
        borderWidth: 0,
        yAxisID: 'y',
      }
    ]
  };

  const evolutionChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: { family: 'Plus Jakarta Sans', weight: 'bold' }
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const val = context.raw || 0;
            return ` ${context.dataset.label}: $${val.toLocaleString('es-AR')}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: {
          callback: (value: any) => `$${(value / 1000).toLocaleString('es-AR')}k`
        }
      },
      x: {
        grid: { display: false }
      }
    }
  };

  // Brand sales breakdown chart
  const brandSales: Record<string, number> = {};
  for (const p of performances) {
    if (p.unidadesVendidas > 0) {
      brandSales[p.marca] = (brandSales[p.marca] || 0) + p.unidadesVendidas;
    }
  }

  const sortedBrands = Object.entries(brandSales).sort((a, b) => b[1] - a[1]);
  const brandChartData = {
    labels: sortedBrands.map(b => b[0]),
    datasets: [
      {
        data: sortedBrands.map(b => b[1]),
        backgroundColor: [
          '#0f4b25',
          '#e68628',
          '#186d38',
          '#8fa382',
          '#d4a373',
          '#e9edc9',
          '#ccd5ae'
        ],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  const brandChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          boxWidth: 12,
          font: { size: 11 }
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Strategic Headline & Period Context */}
      <div className="bg-gradient-to-r from-[#0f4b25] via-[#145d2f] to-[#0f4b25] rounded-3xl p-6 sm:p-8 text-[#ece7d7] shadow-xl border border-emerald-900 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-[#e68628]/20 to-transparent pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="bg-[#e68628] text-stone-900 font-extrabold text-[11px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Panel Gerencial
              </span>
              <span className="text-xs text-[#ece7d7]/70">
                {isAllMonths ? 'Período: Histórico Consolidado 2026' : `Período: Mes de ${selectedMonth} 2026`}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">
              {isAllMonths ? 'Diagnóstico General de Negocio Yerbazo' : `Desempeño y Facturación de ${selectedMonth}`}
            </h2>
            <p className="text-sm text-[#ece7d7]/80 max-w-2xl mt-1">
              Monitoreo en tiempo real de facturación, márgenes netos, rotación de paquetes de yerba y alertas de reposición de stock.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigateTab('recomendaciones')}
              className="px-4 py-2.5 rounded-2xl bg-[#e68628] hover:bg-[#cc721b] text-white font-bold text-xs sm:text-sm shadow-lg flex items-center space-x-2 transition-transform active:scale-95"
            >
              <Zap className="w-4 h-4" />
              <span>Ver Promociones Recomendadas</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Facturación */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-stone-200/80 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between relative z-10 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Facturación Total</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-100/70 flex items-center justify-center text-[#0f4b25]">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
              ${currentFacturado.toLocaleString('es-AR')}
            </div>
            
            {/* MoM growth badge */}
            <div className="flex items-center mt-2 text-xs">
              {momFacturadoPorc !== null ? (
                momFacturadoPorc >= 0 ? (
                  <span className="flex items-center font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg mr-2">
                    <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                    +{momFacturadoPorc.toFixed(1)}% vs mes ant.
                  </span>
                ) : (
                  <span className="flex items-center font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg mr-2">
                    <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                    {momFacturadoPorc.toFixed(1)}% vs mes ant.
                  </span>
                )
              ) : (
                <span className="text-stone-400">Total acumulado</span>
              )}
              {momFacturadoDiff !== null && (
                <span className="text-stone-400 font-medium">
                  ({momFacturadoDiff >= 0 ? '+' : ''}${Math.round(momFacturadoDiff).toLocaleString('es-AR')})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Ganancia Neta */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-stone-200/80 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between relative z-10 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Ganancia Realizada</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-100/70 flex items-center justify-center text-[#e68628]">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#0f4b25] tracking-tight">
              ${currentGanancia.toLocaleString('es-AR')}
            </div>
            <div className="flex items-center mt-2 text-xs">
              <span className="font-bold text-[#e68628] bg-amber-50 px-2 py-0.5 rounded-lg mr-2 flex items-center">
                <Percent className="w-3 h-3 mr-0.5" />
                {margenGeneral.toFixed(1)}% margen neto
              </span>
              {momGananciaPorc !== null && (
                <span className={`font-semibold ${momGananciaPorc >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {momGananciaPorc >= 0 ? '+' : ''}{momGananciaPorc.toFixed(1)}% MoM
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Unidades & Pedidos */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-stone-200/80 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-stone-100 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between relative z-10 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Volumen de Ventas</span>
            <div className="w-10 h-10 rounded-2xl bg-stone-200/70 flex items-center justify-center text-stone-800">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
              {currentUnidades} <span className="text-base font-normal text-stone-500">paquetes</span>
            </div>
            <div className="flex items-center mt-2 text-xs text-stone-500 space-x-2">
              <span className="bg-stone-100 px-2 py-0.5 rounded-md font-semibold text-stone-700">
                {currentVentas} transacciones
              </span>
              <span>•</span>
              <span>Ticket prom: <strong>${Math.round(ticketPromedio).toLocaleString('es-AR')}</strong></span>
            </div>
          </div>
        </div>

        {/* Producto Estrella & Alerta Stock */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-stone-200/80 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between relative z-10 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Producto Estrella</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-lg font-black text-[#0f4b25] truncate" title={bestProduct?.nombreOriginal}>
              {bestProduct?.nombreOriginal || 'Baldo Tradicional 1KG'}
            </div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-stone-600 font-semibold">
                {bestProduct?.unidadesVendidas} u. (${bestProduct?.facturacionTotal.toLocaleString('es-AR')})
              </span>
              {criticalStockCount > 0 ? (
                <button
                  onClick={() => onNavigateTab('stock')}
                  className="flex items-center text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-bold hover:bg-amber-100 transition-colors"
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {criticalStockCount} en alerta
                </button>
              ) : (
                <span className="text-emerald-700 flex items-center font-semibold">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Stock óptimo
                </span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* 🎯 Tracker de Metas Mensuales y Proyección de Facturación en Vivo */}
      <div className="bg-gradient-to-br from-stone-900 via-stone-850 to-stone-900 text-white rounded-3xl p-6 sm:p-7 shadow-xl border-2 border-stone-800 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-stone-800">
          <div className="flex items-start space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#e68628] text-stone-950 flex items-center justify-center shrink-0 shadow-lg font-black">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                  Tracker de Metas & Proyección en Vivo
                </span>
                <span className="text-xs text-stone-400 font-medium">
                  Mes de {targetMonthKey} ({isCurrentMonth ? `Día ${daysElapsed} de ${daysInTargetMonth} • Quedan ${daysRemaining} días` : isPastMonth ? `Mes cerrado (${daysInTargetMonth} días)` : `Mes próximo`})
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black font-display text-white mt-1">
                Meta de Facturación: ${monthlyTarget.toLocaleString('es-AR')}
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Llevas facturado <strong className="text-amber-400">${targetFacturado.toLocaleString('es-AR')}</strong> ({goalProgressPct}% alcanzado) con <strong className="text-emerald-400">${targetGanancia.toLocaleString('es-AR')}</strong> de ganancia neta.
              </p>
            </div>
          </div>

          {/* Quick Target Editor */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
            <div className="bg-stone-800/90 border border-stone-700 rounded-2xl p-2 flex items-center space-x-2">
              <span className="text-xs text-stone-400 font-bold px-2">Editar Meta:</span>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">$</span>
                <input
                  type="number"
                  step="50000"
                  min="100000"
                  value={monthlyTarget}
                  onChange={(e) => setMonthlyTarget(Math.max(100000, parseInt(e.target.value, 10) || 100000))}
                  className="w-32 bg-stone-900 text-amber-400 font-black text-sm pl-6 pr-2 py-1.5 rounded-xl border border-stone-700 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Presets */}
            <div className="flex items-center space-x-1.5">
              {[800000, 1000000, 1200000, 1500000].map(amt => (
                <button
                  key={amt}
                  onClick={() => setMonthlyTarget(amt)}
                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                    monthlyTarget === amt 
                      ? 'bg-amber-400 text-stone-950 font-black shadow-sm' 
                      : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                  }`}
                >
                  ${(amt / 1000).toFixed(0)}k
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Progress Bar with Milestone Markers */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-stone-300">
              Progreso actual: <span className="text-amber-400 font-extrabold">{goalProgressPct}%</span>
            </span>
            <span className="text-stone-400">
              {goalGap > 0 ? (
                <span>Faltan <strong className="text-amber-300 font-bold">${goalGap.toLocaleString('es-AR')}</strong> para el objetivo</span>
              ) : (
                <span className="text-emerald-400 font-bold">🎉 ¡Meta 100% superada!</span>
              )}
            </span>
          </div>

          <div className="w-full bg-stone-800 rounded-2xl h-5 p-1 relative overflow-hidden border border-stone-700">
            <div 
              className={`h-full rounded-xl transition-all duration-700 relative ${
                goalProgressPct >= 100 
                  ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-300' 
                  : goalProgressPct >= 75
                  ? 'bg-gradient-to-r from-amber-500 via-[#e68628] to-emerald-400'
                  : 'bg-gradient-to-r from-[#0f4b25] via-emerald-600 to-[#e68628]'
              }`}
              style={{ width: `${Math.min(100, Math.max(4, goalProgressPct))}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* 4 Live Projection KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          <div className="bg-stone-800/80 border border-stone-700/80 rounded-2xl p-4">
            <div className="flex items-center space-x-1.5 text-[11px] font-bold uppercase text-stone-400 tracking-wider">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Ritmo Diario Actual</span>
            </div>
            <div className="text-2xl font-black text-amber-400 font-display mt-1">
              ${Math.round(dailyPace).toLocaleString('es-AR')} <span className="text-xs font-normal text-stone-400">/día</span>
            </div>
            <span className="text-[11px] text-stone-400 mt-1 block">
              {isCurrentMonth ? `Promedio real en ${daysElapsed} días transcurridos` : `Promedio del mes (${daysElapsed} días)`}
            </span>
          </div>

          <div className="bg-stone-800/80 border border-stone-700/80 rounded-2xl p-4">
            <div className="flex items-center space-x-1.5 text-[11px] font-bold uppercase text-stone-400 tracking-wider">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Proyección a Fin de Mes</span>
            </div>
            <div className="text-2xl font-black text-emerald-400 font-display mt-1">
              ${Math.round(projectedMonthRevenue).toLocaleString('es-AR')}
            </div>
            <span className="text-[11px] text-stone-400 mt-1 block">
              {isPastMonth ? (
                <span className="text-stone-400">Cierre final del mes</span>
              ) : projectedDiffVsGoal >= 0 ? (
                <span className="text-emerald-400 font-medium">+{Math.round(projectedDiffVsGoal).toLocaleString('es-AR')} sobre la meta</span>
              ) : (
                <span className="text-rose-400 font-medium">-${Math.abs(Math.round(projectedDiffVsGoal)).toLocaleString('es-AR')} vs objetivo</span>
              )}
            </span>
          </div>

          <div className="bg-stone-800/80 border border-stone-700/80 rounded-2xl p-4">
            <div className="flex items-center space-x-1.5 text-[11px] font-bold uppercase text-stone-400 tracking-wider">
              <Zap className="w-3.5 h-3.5 text-sky-400" />
              <span>Ritmo Requerido</span>
            </div>
            <div className="text-2xl font-black text-sky-400 font-display mt-1">
              {isGoalReached ? (
                <span className="text-emerald-400 text-lg font-bold">¡Meta Cumplida! 🎉</span>
              ) : daysRemaining > 0 ? (
                <>${Math.round(requiredDailyPace).toLocaleString('es-AR')} <span className="text-xs font-normal text-stone-400">/día</span></>
              ) : (
                <span className="text-rose-400 text-lg font-bold">Mes Cerrado</span>
              )}
            </div>
            <span className="text-[11px] text-stone-400 mt-1 block">
              {isGoalReached ? (
                <span className="text-emerald-400 font-medium">Superaste el 100% del objetivo</span>
              ) : daysRemaining > 0 ? (
                `Para los ${daysRemaining} días restantes`
              ) : (
                <span className="text-stone-400 font-medium">Faltaron ${goalGap.toLocaleString('es-AR')} para la meta</span>
              )}
            </span>
          </div>

          <div className="bg-stone-800/80 border border-stone-700/80 rounded-2xl p-4">
            <div className="flex items-center space-x-1.5 text-[11px] font-bold uppercase text-stone-400 tracking-wider">
              <Package className="w-3.5 h-3.5 text-amber-300" />
              <span>Equivalencia en Paquetes</span>
            </div>
            <div className="text-2xl font-black text-white font-display mt-1">
              {isGoalReached ? (
                <span className="text-emerald-400 text-lg font-bold">0 faltantes 🎉</span>
              ) : (
                <>~{packsNeeded} <span className="text-xs font-normal text-stone-400">paquetes</span></>
              )}
            </div>
            <span className="text-[11px] text-stone-400 mt-1 block">
              {isGoalReached ? '¡Objetivo 100% alcanzado!' : 'Ref: Canarias 1KG (~$8.500 c/u)'}
            </span>
          </div>

        </div>
      </div>

      {/* Strategic Insights Cards Banner */}
      <div className="bg-[#ece7d7] rounded-3xl p-6 border-2 border-[#0f4b25]/20 shadow-sm">
        <div className="flex items-center space-x-2.5 mb-4">
          <div className="w-7 h-7 rounded-xl bg-[#0f4b25] text-white flex items-center justify-center font-bold text-sm">
            💡
          </div>
          <h3 className="text-base font-extrabold text-[#0f4b25] font-display">
            Insights Clave y Recomendaciones Automáticas del Negocio
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Facturación MoM */}
          <div className="bg-white/90 backdrop-blur rounded-2xl p-4 border border-stone-300/60 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                  Rendimiento Mensual
                </span>
                <TrendingUp className="w-4 h-4 text-emerald-700" />
              </div>
              <p className="text-xs text-stone-700 leading-relaxed font-medium">
                Septiembre fue el <strong>mes récord de ventas</strong> con <strong>$890.741</strong> facturados y <strong>$116.174</strong> de ganancia, creciendo un <strong>+16.8%</strong> respecto a Agosto.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('comparativa')}
              className="mt-3 text-xs font-bold text-[#0f4b25] hover:text-[#e68628] flex items-center transition-colors"
            >
              <span>Ver comparativa mes a mes</span>
              <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>

          {/* Card 2: Alerta de Reorden Urgente */}
          <div className="bg-white/90 backdrop-blur rounded-2xl p-4 border border-amber-300/60 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md">
                  Alerta de Inventario
                </span>
                <ShieldAlert className="w-4 h-4 text-amber-700" />
              </div>
              <p className="text-xs text-stone-700 leading-relaxed font-medium">
                <strong>Canarias 1KG</strong> (4 u. restantes) y <strong>Baldo 1KG</strong> (11 u. restantes) están en zona de quiebre inminente. Tienen solo <strong>~7 a 12 días de cobertura</strong> al ritmo de venta actual.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('stock')}
              className="mt-3 text-xs font-bold text-[#0f4b25] hover:text-[#e68628] flex items-center transition-colors"
            >
              <span>Ver plan de próxima compra</span>
              <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>

          {/* Card 3: Oportunidad de Margen */}
          <div className="bg-white/90 backdrop-blur rounded-2xl p-4 border border-orange-300/60 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-orange-800 bg-orange-100/70 px-2 py-0.5 rounded-md">
                  Oportunidad de Margen
                </span>
                <Zap className="w-4 h-4 text-[#e68628]" />
              </div>
              <p className="text-xs text-stone-700 leading-relaxed font-medium">
                La línea <strong>Verdecita</strong> y accesorios como <strong>Reposa Mate</strong> tienen márgenes superiores al <strong>39%</strong>. Crear combos con Baldo o Canarias elevará drásticamente tu beneficio neto.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('recomendaciones')}
              className="mt-3 text-xs font-bold text-[#0f4b25] hover:text-[#e68628] flex items-center transition-colors"
            >
              <span>Ver combos sugeridos</span>
              <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>

        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Evolution Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-stone-200/80">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold text-stone-900 font-display">
                Facturación y Ganancias por Mes (2026)
              </h3>
              <p className="text-xs text-stone-500">
                Comparación del volumen de facturación contra la ganancia líquida obtenida
              </p>
            </div>
            <span className="text-xs font-bold text-[#0f4b25] bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100">
              Crecimiento Sostenido
            </span>
          </div>

          <div className="h-72">
            <Bar data={evolutionChartData} options={evolutionChartOptions} />
          </div>
        </div>

        {/* Brand Sales Share Chart (1 col) */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-stone-900 font-display">
                Ventas por Marca
              </h3>
              <span className="text-xs text-stone-400 font-medium">Por volumen</span>
            </div>
            <p className="text-xs text-stone-500 mb-4">
              Participación porcentual de paquetes vendidos de cada sello yerbatero
            </p>

            <div className="h-56 relative flex items-center justify-center">
              <Doughnut data={brandChartData} options={brandChartOptions} />
            </div>
          </div>

          <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
            <span>Baldo y Rei Verde lideran el 60%+</span>
            <button
              onClick={() => onNavigateTab('productos')}
              className="font-bold text-[#0f4b25] hover:underline"
            >
              Ver desglose
            </button>
          </div>
        </div>

      </div>

      {/* Leaderboard: Top 5 Sellers and Top 5 Margin */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Top 5 by Volume & Revenue */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200/80">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0f4b25] flex items-center justify-center font-black">
                🥇
              </div>
              <div>
                <h4 className="font-extrabold text-stone-900 font-display text-base">
                  Top 5 Más Vendidos (Volumen & Facturación)
                </h4>
                <p className="text-xs text-stone-500">Los grandes generadores de volumen de Yerbazo</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('productos')}
              className="text-xs font-bold text-[#0f4b25] hover:underline"
            >
              Ver todos
            </button>
          </div>

          <div className="space-y-3">
            {performances.slice(0, 5).map((p, idx) => (
              <div key={p.producto} className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 hover:bg-stone-100/80 transition-colors">
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-white text-stone-800 font-black text-xs flex items-center justify-center shadow-xs">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-stone-800 truncate" title={p.nombreOriginal}>
                      {p.nombreOriginal}
                    </p>
                    <span className="text-[11px] text-stone-500 font-medium">
                      {p.unidadesVendidas} unidades • Margen: {p.margenPorc.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold text-[#0f4b25]">
                    ${p.facturacionTotal.toLocaleString('es-AR')}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    p.cuadranteBCG === 'Estrella' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                  }`}>
                    {p.cuadranteBCG}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 by Profit Margin % */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200/80">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-[#e68628] flex items-center justify-center font-black">
                💎
              </div>
              <div>
                <h4 className="font-extrabold text-stone-900 font-display text-base">
                  Top 5 Mayor Margen de Ganancia (%)
                </h4>
                <p className="text-xs text-stone-500">Los productos que dejan mayor ganancia por peso vendido</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('productos')}
              className="text-xs font-bold text-[#e68628] hover:underline"
            >
              Ver todos
            </button>
          </div>

          <div className="space-y-3">
            {[...performances].sort((a, b) => b.margenPorc - a.margenPorc).slice(0, 5).map((p, idx) => (
              <div key={p.producto} className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/40 hover:bg-amber-50 transition-colors">
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-white text-amber-800 font-black text-xs flex items-center justify-center shadow-xs">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-stone-800 truncate" title={p.nombreOriginal}>
                      {p.nombreOriginal}
                    </p>
                    <span className="text-[11px] text-stone-500 font-medium">
                      Ganancia por unidad: ${Math.round(p.precioVentaPromedio - p.precioCompra).toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold text-[#e68628]">
                    {p.margenPorc.toFixed(1)}%
                  </div>
                  <span className="text-[11px] text-stone-500">
                    Costo: ${p.precioCompra.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
