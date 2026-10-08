import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowRight, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus,
  Sparkles,
  BarChart3,
  LineChart,
  Layers,
  Clock,
  DollarSign
} from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';
import '../utils/chartConfig';
import { MonthlyMetric, ProductPerformance, SaleTransaction } from '../types';
import { normalizeProductName } from '../utils/dataParser';

interface HistoricalComparisonProps {
  monthlyMetrics: MonthlyMetric[];
  performances: ProductPerformance[];
  ventas: SaleTransaction[];
}

export const HistoricalComparison: React.FC<HistoricalComparisonProps> = ({
  monthlyMetrics,
  performances,
  ventas
}) => {
  // Available closed months in chronological order
  const availableMonths = monthlyMetrics.map(m => m.mesKey);
  
  // Default to the two most recent available months
  const defaultPeriodA = availableMonths.length > 0 ? availableMonths[availableMonths.length - 1] : 'Septiembre';
  const defaultPeriodB = availableMonths.length > 1 ? availableMonths[availableMonths.length - 2] : (availableMonths[0] || 'Agosto');

  const [periodA, setPeriodA] = useState<string>(() => defaultPeriodA);
  const [periodB, setPeriodB] = useState<string>(() => defaultPeriodB);
  const [timeView, setTimeView] = useState<'quincenas' | 'acumulado' | 'diario' | 'semanas'>('quincenas');
  const [metricView, setMetricView] = useState<'ambos' | 'facturacion' | 'ganancia'>('ambos');

  const metricA = monthlyMetrics.find(m => m.mesKey === periodA);
  const metricB = monthlyMetrics.find(m => m.mesKey === periodB);

  // Calculate product sales in Period A vs Period B
  const compareMap = new Map<string, {
    originalName: string;
    marca: string;
    unidadesA: number;
    unidadesB: number;
    facturadoA: number;
    facturadoB: number;
  }>();

  // Initialize from performances
  for (const p of performances) {
    const norm = p.producto;
    const hist = p.ventasPorMes;
    const aData = hist[periodA] || { unidades: 0, facturado: 0 };
    const bData = hist[periodB] || { unidades: 0, facturado: 0 };
    
    if (aData.unidades > 0 || bData.unidades > 0) {
      compareMap.set(norm, {
        originalName: p.nombreOriginal,
        marca: p.marca,
        unidadesA: aData.unidades,
        unidadesB: bData.unidades,
        facturadoA: aData.facturado,
        facturadoB: bData.facturado
      });
    }
  }

  const comparisonItems = Array.from(compareMap.values()).map(item => {
    const deltaUnits = item.unidadesA - item.unidadesB;
    const deltaRevenue = item.facturadoA - item.facturadoB;
    let growthPorc = 0;
    if (item.unidadesB > 0) {
      growthPorc = ((item.unidadesA - item.unidadesB) / item.unidadesB) * 100;
    } else if (item.unidadesA > 0) {
      growthPorc = 100;
    }

    return {
      ...item,
      deltaUnits,
      deltaRevenue,
      growthPorc: Math.round(growthPorc)
    };
  });

  // Top gainers (improved the most)
  const topGainers = [...comparisonItems]
    .filter(i => i.deltaUnits > 0)
    .sort((a, b) => b.deltaUnits - a.deltaUnits);

  // Top decliners (dropped the most)
  const topDecliners = [...comparisonItems]
    .filter(i => i.deltaUnits < 0)
    .sort((a, b) => a.deltaUnits - b.deltaUnits);

  // High-level deltas
  const factA = metricA?.facturado || 0;
  const factB = metricB?.facturado || 0;
  const deltaFact = factA - factB;
  const growthFactPorc = factB > 0 ? (deltaFact / factB) * 100 : 0;

  const gainA = metricA?.ganancia || 0;
  const gainB = metricB?.ganancia || 0;
  const deltaGain = gainA - gainB;
  const growthGainPorc = gainB > 0 ? (deltaGain / gainB) * 100 : 0;

  const unitsA = metricA?.unidadesVendidas || 0;
  const unitsB = metricB?.unidadesVendidas || 0;
  const deltaUnitsTotal = unitsA - unitsB;

  // Chart data: Top 8 products compared side-by-side
  const topChartItems = [...comparisonItems]
    .sort((a, b) => Math.max(b.unidadesA, b.unidadesB) - Math.max(a.unidadesA, a.unidadesB))
    .slice(0, 8);

  const chartData = {
    labels: topChartItems.map(i => i.originalName),
    datasets: [
      {
        label: `${periodA} (Unidades)`,
        data: topChartItems.map(i => i.unidadesA),
        backgroundColor: '#0f4b25',
        borderRadius: 6
      },
      {
        label: `${periodB} (Unidades)`,
        data: topChartItems.map(i => i.unidadesB),
        backgroundColor: '#e68628',
        borderRadius: 6
      }
    ]
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };

  // Timeline Data Computation (Day 1..31, Fortnights 1..15 vs 16..31, and Weeks)
  const timelineData = useMemo(() => {
    const norm = (s: string) => (s || '').trim().toLowerCase();
    const targetA = norm(periodA);
    const targetB = norm(periodB);

    // Group by day 1..31
    const dayMap: Record<number, { factA: number; gainA: number; countA: number; factB: number; gainB: number; countB: number }> = {};
    for (let d = 1; d <= 31; d++) {
      dayMap[d] = { factA: 0, gainA: 0, countA: 0, factB: 0, gainB: 0, countB: 0 };
    }

    for (const v of ventas) {
      const vMes = norm(v.mes);
      const isA = vMes === targetA;
      const isB = vMes === targetB;
      if (!isA && !isB) continue;

      let d: number | null = null;
      if (v.fecha && typeof v.fecha === 'string' && v.fecha.includes('/')) {
        const parts = v.fecha.split('/');
        const parsed = parseInt(parts[0], 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 31) d = parsed;
      }
      if (d === null && v.fechaObj) {
        const dateStr = v.fechaObj.split('T')[0];
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const parsed = parseInt(parts[2], 10);
          if (!isNaN(parsed) && parsed >= 1 && parsed <= 31) d = parsed;
        }
      }

      if (d === null && v.semana) {
        const s = norm(v.semana);
        if (s.includes('1')) d = 4;
        else if (s.includes('2')) d = 11;
        else if (s.includes('3')) d = 18;
        else if (s.includes('4')) d = 25;
        else if (s.includes('5')) d = 30;
      }

      if (d === null) d = 15;

      const pFinal = v.precioFinal || 0;
      const gan = v.ganancia || 0;

      if (isA) {
        dayMap[d].factA += pFinal;
        dayMap[d].gainA += gan;
        dayMap[d].countA += 1;
      } else if (isB) {
        dayMap[d].factB += pFinal;
        dayMap[d].gainB += gan;
        dayMap[d].countB += 1;
      }
    }

    // Cumulative sums
    let cumFactA = 0;
    let cumGainA = 0;
    let cumFactB = 0;
    let cumGainB = 0;

    const days = [];
    for (let d = 1; d <= 31; d++) {
      cumFactA += dayMap[d].factA;
      cumGainA += dayMap[d].gainA;
      cumFactB += dayMap[d].factB;
      cumGainB += dayMap[d].gainB;

      days.push({
        day: d,
        factA: dayMap[d].factA,
        gainA: dayMap[d].gainA,
        countA: dayMap[d].countA,
        factB: dayMap[d].factB,
        gainB: dayMap[d].gainB,
        countB: dayMap[d].countB,
        cumFactA,
        cumGainA,
        cumFactB,
        cumGainB
      });
    }

    // Fortnights: Días 1..15 vs 16..31
    let q1_factA = 0, q1_gainA = 0, q1_countA = 0;
    let q1_factB = 0, q1_gainB = 0, q1_countB = 0;
    let q2_factA = 0, q2_gainA = 0, q2_countA = 0;
    let q2_factB = 0, q2_gainB = 0, q2_countB = 0;

    for (let d = 1; d <= 15; d++) {
      q1_factA += dayMap[d].factA;
      q1_gainA += dayMap[d].gainA;
      q1_countA += dayMap[d].countA;
      q1_factB += dayMap[d].factB;
      q1_gainB += dayMap[d].gainB;
      q1_countB += dayMap[d].countB;
    }

    for (let d = 16; d <= 31; d++) {
      q2_factA += dayMap[d].factA;
      q2_gainA += dayMap[d].gainA;
      q2_countA += dayMap[d].countA;
      q2_factB += dayMap[d].factB;
      q2_gainB += dayMap[d].gainB;
      q2_countB += dayMap[d].countB;
    }

    // Weeks: Semana 1 a 5
    const weeks = [
      { name: 'Semana 1 (Días 1-7)', factA: 0, gainA: 0, factB: 0, gainB: 0 },
      { name: 'Semana 2 (Días 8-14)', factA: 0, gainA: 0, factB: 0, gainB: 0 },
      { name: 'Semana 3 (Días 15-21)', factA: 0, gainA: 0, factB: 0, gainB: 0 },
      { name: 'Semana 4 (Días 22-28)', factA: 0, gainA: 0, factB: 0, gainB: 0 },
      { name: 'Semana 5 (Días 29-31)', factA: 0, gainA: 0, factB: 0, gainB: 0 },
    ];

    for (let d = 1; d <= 31; d++) {
      const wIdx = d <= 7 ? 0 : d <= 14 ? 1 : d <= 21 ? 2 : d <= 28 ? 3 : 4;
      weeks[wIdx].factA += dayMap[d].factA;
      weeks[wIdx].gainA += dayMap[d].gainA;
      weeks[wIdx].factB += dayMap[d].factB;
      weeks[wIdx].gainB += dayMap[d].gainB;
    }

    return {
      days,
      quincena1: {
        factA: q1_factA,
        gainA: q1_gainA,
        countA: q1_countA,
        factB: q1_factB,
        gainB: q1_gainB,
        countB: q1_countB,
        deltaFact: q1_factA - q1_factB,
        deltaGain: q1_gainA - q1_gainB,
        growthFactPorc: q1_factB > 0 ? ((q1_factA - q1_factB) / q1_factB) * 100 : 0,
        growthGainPorc: q1_gainB > 0 ? ((q1_gainA - q1_gainB) / q1_gainB) * 100 : 0,
      },
      quincena2: {
        factA: q2_factA,
        gainA: q2_gainA,
        countA: q2_countA,
        factB: q2_factB,
        gainB: q2_gainB,
        countB: q2_countB,
        deltaFact: q2_factA - q2_factB,
        deltaGain: q2_gainA - q2_gainB,
        growthFactPorc: q2_factB > 0 ? ((q2_factA - q2_factB) / q2_factB) * 100 : 0,
        growthGainPorc: q2_gainB > 0 ? ((q2_gainA - q2_gainB) / q2_gainB) * 100 : 0,
      },
      weeks
    };
  }, [ventas, periodA, periodB]);

  // Chart dataset based on selected view mode
  const temporalChartData = useMemo(() => {
    const { days, quincena1, quincena2, weeks } = timelineData;

    if (timeView === 'quincenas') {
      const labels = ['1ª Quincena (Días 1 al 15)', '2ª Quincena (Días 16 al fin)'];
      const datasets: any[] = [];

      if (metricView === 'facturacion' || metricView === 'ambos') {
        datasets.push({
          label: `Facturación ${periodA}`,
          data: [quincena1.factA, quincena2.factA],
          backgroundColor: '#0f4b25',
          borderRadius: 8,
          order: 1
        });
        datasets.push({
          label: `Facturación ${periodB}`,
          data: [quincena1.factB, quincena2.factB],
          backgroundColor: '#e68628',
          borderRadius: 8,
          order: 2
        });
      }

      if (metricView === 'ganancia' || metricView === 'ambos') {
        datasets.push({
          label: `Ganancia ${periodA}`,
          data: [quincena1.gainA, quincena2.gainA],
          backgroundColor: '#10b981',
          borderRadius: 8,
          order: 3
        });
        datasets.push({
          label: `Ganancia ${periodB}`,
          data: [quincena1.gainB, quincena2.gainB],
          backgroundColor: '#f59e0b',
          borderRadius: 8,
          order: 4
        });
      }

      return { labels, datasets };
    }

    if (timeView === 'acumulado') {
      const labels = days.map(d => `Día ${d.day}`);
      const datasets: any[] = [];

      if (metricView === 'facturacion' || metricView === 'ambos') {
        datasets.push({
          label: `Facturación Acum. ${periodA}`,
          data: days.map(d => d.cumFactA),
          borderColor: '#0f4b25',
          backgroundColor: 'rgba(15, 75, 37, 0.08)',
          fill: true,
          tension: 0.25,
          borderWidth: 3,
          pointRadius: 2,
          pointHoverRadius: 6
        });
        datasets.push({
          label: `Facturación Acum. ${periodB}`,
          data: days.map(d => d.cumFactB),
          borderColor: '#e68628',
          backgroundColor: 'rgba(230, 134, 40, 0.05)',
          fill: true,
          tension: 0.25,
          borderWidth: 3,
          pointRadius: 2,
          pointHoverRadius: 6
        });
      }

      if (metricView === 'ganancia' || metricView === 'ambos') {
        datasets.push({
          label: `Ganancia Acum. ${periodA}`,
          data: days.map(d => d.cumGainA),
          borderColor: '#10b981',
          borderDash: metricView === 'ambos' ? [5, 4] : undefined,
          borderWidth: 2.5,
          tension: 0.25,
          pointRadius: 2,
          pointHoverRadius: 5
        });
        datasets.push({
          label: `Ganancia Acum. ${periodB}`,
          data: days.map(d => d.cumGainB),
          borderColor: '#f59e0b',
          borderDash: metricView === 'ambos' ? [5, 4] : undefined,
          borderWidth: 2.5,
          tension: 0.25,
          pointRadius: 2,
          pointHoverRadius: 5
        });
      }

      return { labels, datasets };
    }

    if (timeView === 'semanas') {
      const labels = weeks.map(w => w.name);
      const datasets: any[] = [];

      if (metricView === 'facturacion' || metricView === 'ambos') {
        datasets.push({
          label: `Facturación ${periodA}`,
          data: weeks.map(w => w.factA),
          backgroundColor: '#0f4b25',
          borderRadius: 6
        });
        datasets.push({
          label: `Facturación ${periodB}`,
          data: weeks.map(w => w.factB),
          backgroundColor: '#e68628',
          borderRadius: 6
        });
      }

      if (metricView === 'ganancia' || metricView === 'ambos') {
        datasets.push({
          label: `Ganancia ${periodA}`,
          data: weeks.map(w => w.gainA),
          backgroundColor: '#10b981',
          borderRadius: 6
        });
        datasets.push({
          label: `Ganancia ${periodB}`,
          data: weeks.map(w => w.gainB),
          backgroundColor: '#f59e0b',
          borderRadius: 6
        });
      }

      return { labels, datasets };
    }

    // Default: 'diario'
    const labels = days.map(d => `Día ${d.day}`);
    const datasets: any[] = [];

    if (metricView === 'facturacion' || metricView === 'ambos') {
      datasets.push({
        label: `Facturación ${periodA}`,
        data: days.map(d => d.factA),
        backgroundColor: '#0f4b25',
        borderRadius: 4
      });
      datasets.push({
        label: `Facturación ${periodB}`,
        data: days.map(d => d.factB),
        backgroundColor: '#e68628',
        borderRadius: 4
      });
    }

    if (metricView === 'ganancia' || metricView === 'ambos') {
      datasets.push({
        label: `Ganancia ${periodA}`,
        data: days.map(d => d.gainA),
        backgroundColor: '#10b981',
        borderRadius: 4
      });
      datasets.push({
        label: `Ganancia ${periodB}`,
        data: days.map(d => d.gainB),
        backgroundColor: '#f59e0b',
        borderRadius: 4
      });
    }

    return { labels, datasets };
  }, [timelineData, timeView, metricView, periodA, periodB]);

  const temporalChartOptions: any = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          boxWidth: 12,
          usePointStyle: timeView === 'acumulado',
          font: { size: 11, weight: 'bold' }
        }
      },
      tooltip: {
        backgroundColor: '#0f4b25',
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 11 },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y !== null ? context.parsed.y : 0;
            return ` ${label}: $${Math.round(value).toLocaleString('es-AR')}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 } }
      },
      y: {
        beginAtZero: true,
        ticks: {
          font: { size: 10 },
          callback: (value: any) => `$${Number(value).toLocaleString('es-AR')}`
        }
      }
    }
  }), [timeView]);

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="bg-[#0f4b25] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border-b-4 border-[#e68628]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center space-x-2 bg-[#e68628] text-stone-900 font-bold text-xs uppercase px-3 py-1 rounded-full mb-3 shadow-sm">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Análisis Evolutivo MoM</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-[#ece7d7]">
              ¿Cuál mejoró respecto a un tiempo pasado y cómo facturé a comparación del mes anterior?
            </h2>
            <p className="text-sm text-[#ece7d7]/80 max-w-3xl mt-1">
              Compara directamente dos meses cualquiera para ver la variación exacta en recaudación, ganancias y qué productos ganaron o perdieron ritmo comercial.
            </p>
          </div>

          {/* Period Selector Controls */}
          <div className="bg-[#0a341a] p-3 rounded-2xl border border-white/20 flex flex-wrap items-center gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#ece7d7]/70 block mb-1">Período Actual:</span>
              <select
                value={periodA}
                onChange={(e) => setPeriodA(e.target.value)}
                className="bg-[#ece7d7] text-[#0f4b25] text-xs font-bold px-3 py-1.5 rounded-xl focus:outline-none cursor-pointer"
              >
                {availableMonths.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="text-[#e68628] font-black text-sm px-1">vs</div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[#ece7d7]/70 block mb-1">Período Anterior:</span>
              <select
                value={periodB}
                onChange={(e) => setPeriodB(e.target.value)}
                className="bg-white/10 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 focus:outline-none cursor-pointer"
              >
                {availableMonths.map(m => (
                  <option key={m} value={m} className="bg-[#0a341a] text-white">{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Global Delta KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        
        {/* Facturación Delta */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block mb-2">
            Variación de Facturación
          </span>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-stone-900 font-display">
              ${factA.toLocaleString('es-AR')}
            </span>
            <span className="text-xs text-stone-400 font-medium">vs ${factB.toLocaleString('es-AR')}</span>
          </div>

          <div className="mt-3 flex items-center">
            {deltaFact >= 0 ? (
              <span className="inline-flex items-center text-xs font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl">
                <ArrowUpRight className="w-4 h-4 mr-1 text-emerald-600" />
                +{growthFactPorc.toFixed(1)}% (+${deltaFact.toLocaleString('es-AR')})
              </span>
            ) : (
              <span className="inline-flex items-center text-xs font-extrabold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-xl">
                <ArrowDownRight className="w-4 h-4 mr-1 text-rose-600" />
                {growthFactPorc.toFixed(1)}% (-${Math.abs(deltaFact).toLocaleString('es-AR')})
              </span>
            )}
          </div>
        </div>

        {/* Ganancia Delta */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block mb-2">
            Variación de Ganancia Neta
          </span>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-[#0f4b25] font-display">
              ${gainA.toLocaleString('es-AR')}
            </span>
            <span className="text-xs text-stone-400 font-medium">vs ${gainB.toLocaleString('es-AR')}</span>
          </div>

          <div className="mt-3 flex items-center">
            {deltaGain >= 0 ? (
              <span className="inline-flex items-center text-xs font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl">
                <ArrowUpRight className="w-4 h-4 mr-1 text-emerald-600" />
                +{growthGainPorc.toFixed(1)}% (+${deltaGain.toLocaleString('es-AR')})
              </span>
            ) : (
              <span className="inline-flex items-center text-xs font-extrabold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-xl">
                <ArrowDownRight className="w-4 h-4 mr-1 text-rose-600" />
                {growthGainPorc.toFixed(1)}% (-${Math.abs(deltaGain).toLocaleString('es-AR')})
              </span>
            )}
          </div>
        </div>

        {/* Unidades Delta */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block mb-2">
            Variación de Paquetes Vendidos
          </span>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-stone-900 font-display">
              {unitsA} u.
            </span>
            <span className="text-xs text-stone-400 font-medium">vs {unitsB} u.</span>
          </div>

          <div className="mt-3 flex items-center">
            {deltaUnitsTotal >= 0 ? (
              <span className="inline-flex items-center text-xs font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl">
                <ArrowUpRight className="w-4 h-4 mr-1 text-emerald-600" />
                +{deltaUnitsTotal} paquetes despachados
              </span>
            ) : (
              <span className="inline-flex items-center text-xs font-extrabold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-xl">
                <ArrowDownRight className="w-4 h-4 mr-1 text-rose-600" />
                {deltaUnitsTotal} paquetes vs período anterior
              </span>
            )}
          </div>
        </div>

      </div>

      {/* Temporal Evolution & Fortnight (15-Day) Comparative Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200 space-y-6">
        
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-stone-100">
          <div>
            <div className="inline-flex items-center space-x-1.5 bg-amber-100 text-stone-900 text-xs font-bold px-2.5 py-1 rounded-full mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#e68628]" />
              <span>Análisis de Ritmo & Quincenas</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-stone-900 font-display">
              Evolución a lo largo del Mes: Facturación & Ganancia
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Descubre si ganaste más en los primeros 15 días o en la segunda mitad comparando <strong className="text-stone-800">{periodA}</strong> vs <strong className="text-stone-800">{periodB}</strong>.
            </p>
          </div>

          {/* Controls: Time Horizon & Metric Filters */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* View Mode Selector */}
            <div className="bg-stone-100 p-1 rounded-2xl flex items-center space-x-1 text-xs">
              <button
                onClick={() => setTimeView('quincenas')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  timeView === 'quincenas'
                    ? 'bg-[#0f4b25] text-[#ece7d7] shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Comparar 1ª Quincena (Días 1-15) vs 2ª Quincena (Días 16-31)"
              >
                Por Quincenas
              </button>
              <button
                onClick={() => setTimeView('acumulado')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  timeView === 'acumulado'
                    ? 'bg-[#0f4b25] text-[#ece7d7] shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Curva continua acumulada del día 1 al 31"
              >
                Acumulado Día a Día
              </button>
              <button
                onClick={() => setTimeView('diario')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  timeView === 'diario'
                    ? 'bg-[#0f4b25] text-[#ece7d7] shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Ventas por día individual"
              >
                Por Día
              </button>
              <button
                onClick={() => setTimeView('semanas')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  timeView === 'semanas'
                    ? 'bg-[#0f4b25] text-[#ece7d7] shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Comparativa por semanas de cada mes"
              >
                Por Semanas
              </button>
            </div>

            {/* Metric Mode Filter */}
            <div className="bg-amber-50 border border-amber-200/80 p-1 rounded-2xl flex items-center space-x-1 text-xs">
              <button
                onClick={() => setMetricView('ambos')}
                className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  metricView === 'ambos'
                    ? 'bg-[#e68628] text-stone-950 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Ambos
              </button>
              <button
                onClick={() => setMetricView('facturacion')}
                className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  metricView === 'facturacion'
                    ? 'bg-[#e68628] text-stone-950 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Facturación
              </button>
              <button
                onClick={() => setMetricView('ganancia')}
                className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  metricView === 'ganancia'
                    ? 'bg-[#e68628] text-stone-950 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Ganancia
              </button>
            </div>

          </div>
        </div>

        {/* 15-Day Fortnights (Quincenas) High-Impact Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* 1ª Quincena (Días 1-15) */}
          <div className="bg-gradient-to-br from-[#0f4b25]/5 to-emerald-50/50 rounded-2xl p-4 sm:p-5 border border-emerald-200/70 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#0f4b25] bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                <span>🥇</span>
                <span>Primeros 15 Días (1ª Quincena)</span>
              </span>
              <span className="text-[10px] font-bold text-stone-400">Días 1 al 15</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200/40">
                <span className="text-stone-600 font-medium">Facturación:</span>
                <div className="text-right">
                  <span className="font-extrabold text-stone-900">${Math.round(timelineData.quincena1.factA).toLocaleString('es-AR')}</span>
                  <span className="text-stone-400 text-[11px] ml-1.5 font-medium">vs ${Math.round(timelineData.quincena1.factB).toLocaleString('es-AR')}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200/40">
                <span className="text-stone-600 font-medium">Ganancia Neta:</span>
                <div className="text-right">
                  <span className="font-black text-[#0f4b25]">${Math.round(timelineData.quincena1.gainA).toLocaleString('es-AR')}</span>
                  <span className="text-stone-400 text-[11px] ml-1.5 font-medium">vs ${Math.round(timelineData.quincena1.gainB).toLocaleString('es-AR')}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2">
              {timelineData.quincena1.deltaGain >= 0 ? (
                <div className="bg-emerald-100 text-emerald-900 p-2 rounded-xl text-[11px] font-bold flex items-center space-x-1.5">
                  <ArrowUpRight className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Ganaste <strong>+${Math.round(timelineData.quincena1.deltaGain).toLocaleString('es-AR')}</strong> (+{timelineData.quincena1.growthGainPorc.toFixed(1)}%) más en los 1ros 15 días de {periodA}.
                  </span>
                </div>
              ) : (
                <div className="bg-rose-100 text-rose-900 p-2 rounded-xl text-[11px] font-bold flex items-center space-x-1.5">
                  <ArrowDownRight className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>
                    Ganaste <strong>-${Math.round(Math.abs(timelineData.quincena1.deltaGain)).toLocaleString('es-AR')}</strong> ({timelineData.quincena1.growthGainPorc.toFixed(1)}%) menos en los 1ros 15 días de {periodA}.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 2ª Quincena (Días 16-31) */}
          <div className="bg-gradient-to-br from-amber-50/60 to-orange-50/40 rounded-2xl p-4 sm:p-5 border border-amber-200/80 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#e68628] bg-amber-100 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                <span>🥈</span>
                <span>Segunda Quincena (Días 16 al fin)</span>
              </span>
              <span className="text-[10px] font-bold text-stone-400">Días 16 al fin</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/40">
                <span className="text-stone-600 font-medium">Facturación:</span>
                <div className="text-right">
                  <span className="font-extrabold text-stone-900">${Math.round(timelineData.quincena2.factA).toLocaleString('es-AR')}</span>
                  <span className="text-stone-400 text-[11px] ml-1.5 font-medium">vs ${Math.round(timelineData.quincena2.factB).toLocaleString('es-AR')}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/40">
                <span className="text-stone-600 font-medium">Ganancia Neta:</span>
                <div className="text-right">
                  <span className="font-black text-[#0f4b25]">${Math.round(timelineData.quincena2.gainA).toLocaleString('es-AR')}</span>
                  <span className="text-stone-400 text-[11px] ml-1.5 font-medium">vs ${Math.round(timelineData.quincena2.gainB).toLocaleString('es-AR')}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2">
              {timelineData.quincena2.deltaGain >= 0 ? (
                <div className="bg-emerald-100 text-emerald-900 p-2 rounded-xl text-[11px] font-bold flex items-center space-x-1.5">
                  <ArrowUpRight className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    En la 2ª mitad ganaste <strong>+${Math.round(timelineData.quincena2.deltaGain).toLocaleString('es-AR')}</strong> (+{timelineData.quincena2.growthGainPorc.toFixed(1)}%) más en {periodA}.
                  </span>
                </div>
              ) : (
                <div className="bg-rose-100 text-rose-900 p-2 rounded-xl text-[11px] font-bold flex items-center space-x-1.5">
                  <ArrowDownRight className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>
                    En la 2ª mitad ganaste <strong>-${Math.round(Math.abs(timelineData.quincena2.deltaGain)).toLocaleString('es-AR')}</strong> ({timelineData.quincena2.growthGainPorc.toFixed(1)}%) menos en {periodA}.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Distribution & Momentum Balance */}
          <div className="bg-stone-50 rounded-2xl p-4 sm:p-5 border border-stone-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-stone-700 bg-stone-200/80 px-2.5 py-0.5 rounded-full">
                  ⚖️ Distribución del Mes
                </span>
                <span className="text-[10px] font-bold text-stone-400">1ra vs 2da mitad</span>
              </div>
              <p className="text-xs text-stone-500 mb-3">
                ¿Cuándo se generó la ganancia en cada período?
              </p>

              {/* Distribution visual progress bar for Period A & B */}
              {(() => {
                const totalGainA = (timelineData.quincena1.gainA + timelineData.quincena2.gainA) || 1;
                const p1PorcA = Math.round((timelineData.quincena1.gainA / totalGainA) * 100);
                const p2PorcA = 100 - p1PorcA;

                const totalGainB = (timelineData.quincena1.gainB + timelineData.quincena2.gainB) || 1;
                const p1PorcB = Math.round((timelineData.quincena1.gainB / totalGainB) * 100);
                const p2PorcB = 100 - p1PorcB;

                return (
                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between font-bold text-[11px] text-stone-700 mb-1">
                        <span>{periodA}:</span>
                        <span>{p1PorcA}% (días 1-15) | {p2PorcA}% (días 16-31)</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-stone-200 overflow-hidden flex">
                        <div style={{ width: `${p1PorcA}%` }} className="bg-[#0f4b25]" title={`1ª Quincena: ${p1PorcA}%`}></div>
                        <div style={{ width: `${p2PorcA}%` }} className="bg-emerald-400" title={`2ª Quincena: ${p2PorcA}%`}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-bold text-[11px] text-stone-700 mb-1">
                        <span>{periodB}:</span>
                        <span>{p1PorcB}% (días 1-15) | {p2PorcB}% (días 16-31)</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-stone-200 overflow-hidden flex">
                        <div style={{ width: `${p1PorcB}%` }} className="bg-[#e68628]" title={`1ª Quincena: ${p1PorcB}%`}></div>
                        <div style={{ width: `${p2PorcB}%` }} className="bg-amber-300" title={`2ª Quincena: ${p2PorcB}%`}></div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="text-[11px] text-stone-500 bg-white p-2.5 rounded-xl border border-stone-200/70 mt-3 font-medium">
              💡 {timelineData.quincena1.gainA > timelineData.quincena2.gainA 
                ? `En ${periodA} el negocio arrancó más fuerte al inicio del mes.` 
                : `En ${periodA} el negocio creció de menor a mayor con cierre potente.`}
            </div>
          </div>

        </div>

        {/* Dynamic Chart Container */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3 text-xs text-stone-500 font-medium">
            <span>
              {timeView === 'quincenas' && 'Comparativa directa agrupada por mitades de mes:'}
              {timeView === 'acumulado' && 'Evolución acumulada del día 1 al 31 (revisa el día 15 para comparar quincenas):'}
              {timeView === 'diario' && 'Facturación y ganancia por cada día individual del calendario:'}
              {timeView === 'semanas' && 'Comparativa dividida por semanas del mes:'}
            </span>
            <span className="font-bold text-stone-800">
              {metricView === 'ambos' && '📊 Facturación & Ganancia'}
              {metricView === 'facturacion' && '💰 Solo Facturación'}
              {metricView === 'ganancia' && '📈 Solo Ganancia Neta'}
            </span>
          </div>

          <div className="h-80 sm:h-96">
            {timeView === 'acumulado' ? (
              <Line data={temporalChartData} options={temporalChartOptions} />
            ) : (
              <Bar data={temporalChartData} options={temporalChartOptions} />
            )}
          </div>
        </div>

      </div>

      {/* Top Gainers & Top Decliners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Top Gainers */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              🚀
            </div>
            <div>
              <h4 className="font-extrabold text-stone-900 font-display text-base">
                Productos que más MEJORARON en {periodA} vs {periodB}
              </h4>
              <p className="text-xs text-stone-500">Los mayores saltos en volumen y preferencia</p>
            </div>
          </div>

          <div className="space-y-3">
            {topGainers.length > 0 ? (
              topGainers.slice(0, 5).map((item) => (
                <div key={item.originalName} className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-stone-800 truncate" title={item.originalName}>
                      {item.originalName}
                    </p>
                    <span className="text-[11px] text-stone-500">
                      De {item.unidadesB} u. en {periodB} ➔ <strong className="text-stone-800">{item.unidadesA} u.</strong> en {periodA}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center font-black text-xs text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg">
                      <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                      +{item.deltaUnits} u. ({item.growthPorc >= 100 ? 'Nuevo / +100%' : `+${item.growthPorc}%`})
                    </span>
                    <div className="text-[10px] text-stone-400 mt-0.5">
                      +${item.deltaRevenue.toLocaleString('es-AR')} fact.
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-stone-400 italic py-4">No hubo incrementos directos de unidades en este corte.</p>
            )}
          </div>
        </div>

        {/* Top Decliners */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
              ⚠️
            </div>
            <div>
              <h4 className="font-extrabold text-stone-900 font-display text-base">
                Productos que más CAYERON en {periodA} vs {periodB}
              </h4>
              <p className="text-xs text-stone-500">Alertas de desaceleración que requieren atención o combos</p>
            </div>
          </div>

          <div className="space-y-3">
            {topDecliners.length > 0 ? (
              topDecliners.slice(0, 5).map((item) => (
                <div key={item.originalName} className="flex items-center justify-between p-3 rounded-2xl bg-rose-50/50 border border-rose-100">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-stone-800 truncate" title={item.originalName}>
                      {item.originalName}
                    </p>
                    <span className="text-[11px] text-stone-500">
                      De {item.unidadesB} u. en {periodB} ➔ <strong className="text-stone-800">{item.unidadesA} u.</strong> en {periodA}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center font-black text-xs text-rose-800 bg-rose-100 px-2 py-0.5 rounded-lg">
                      <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                      {item.deltaUnits} u. ({item.growthPorc}%)
                    </span>
                    <div className="text-[10px] text-stone-400 mt-0.5">
                      -${Math.abs(item.deltaRevenue).toLocaleString('es-AR')} fact.
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-stone-400 italic py-4">Sin caídas registradas en este corte comparativo.</p>
            )}
          </div>
        </div>

      </div>

      {/* Side-by-side Chart */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="font-extrabold text-stone-900 font-display text-lg">
              Comparativa Visual de Unidades Vendidas ({periodA} vs {periodB})
            </h4>
            <p className="text-xs text-stone-500">Top referencias comparadas una a una</p>
          </div>
          <div className="flex items-center space-x-3 text-xs font-semibold">
            <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#0f4b25] mr-1.5"></span>{periodA}</span>
            <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#e68628] mr-1.5"></span>{periodB}</span>
          </div>
        </div>

        <div className="h-72">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>

    </div>
  );
};
