import React, { useState } from 'react';
import { 
  Sliders, 
  DollarSign, 
  TrendingUp, 
  Percent, 
  HelpCircle, 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownRight, 
  RotateCcw,
  Tag,
  CheckCircle2
} from 'lucide-react';
import { ProductPerformance } from '../types';
import { simulatePriceChange } from '../utils/analyticsEngine';

interface PriceSimulatorProps {
  performances: ProductPerformance[];
}

export const PriceSimulator: React.FC<PriceSimulatorProps> = ({ performances }) => {
  const [percentChange, setPercentChange] = useState<number>(10); // default +10%
  const [elasticityMode, setElasticityMode] = useState<'inelastic' | 'moderate' | 'zero'>('inelastic');
  
  // Custom single product price overrides
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});

  // Elasticity factor
  const elasticityFactor = elasticityMode === 'inelastic' ? 0.25 : elasticityMode === 'moderate' ? 0.6 : 0.0;

  // Run simulation
  const simulation = simulatePriceChange(performances, percentChange, elasticityFactor);

  const presets = [-10, -5, 0, 5, 10, 15, 20];

  const handleCustomPriceChange = (prodKey: string, newPrice: number) => {
    setCustomPrices(prev => ({
      ...prev,
      [prodKey]: newPrice
    }));
  };

  const handleResetCustomPrices = () => {
    setCustomPrices({});
    setPercentChange(10);
  };

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="bg-[#0f4b25] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border-b-4 border-[#e68628]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center space-x-2 bg-[#e68628] text-stone-900 font-bold text-xs uppercase px-3 py-1 rounded-full mb-3 shadow-sm">
              <Sliders className="w-3.5 h-3.5" />
              <span>Simulador de Precios & Rentabilidad</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-[#ece7d7]">
              ¿Qué pasa si modifico los precios de venta de mi catálogo?
            </h2>
            <p className="text-sm text-[#ece7d7]/80 max-w-3xl mt-1">
              Anticipa el impacto exacto en facturación y ganancias netas antes de aplicar cualquier aumento o promoción. Incluye modelo de elasticidad de demanda de consumo matero.
            </p>
          </div>

          <button
            onClick={handleResetCustomPrices}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 flex items-center space-x-2 self-start transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer Precios</span>
          </button>
        </div>
      </div>

      {/* Simulator Control Center */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          
          {/* Slider & Presets */}
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-black text-stone-900 font-display">
                  Variación General de Precios de Venta:
                </span>
                <span className={`text-2xl font-black font-display px-3 py-1 rounded-xl ${
                  percentChange > 0 ? 'bg-emerald-100 text-[#0f4b25]' :
                  percentChange < 0 ? 'bg-rose-100 text-rose-800' : 'bg-stone-100 text-stone-800'
                }`}>
                  {percentChange > 0 ? `+${percentChange}%` : `${percentChange}%`}
                </span>
              </div>
              
              <input
                type="range"
                min="-20"
                max="30"
                step="1"
                value={percentChange}
                onChange={(e) => setPercentChange(parseInt(e.target.value, 10))}
                className="w-full h-3 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#0f4b25]"
              />
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs font-bold text-stone-400 self-center mr-1">Rápidos:</span>
              {presets.map(p => (
                <button
                  key={p}
                  onClick={() => setPercentChange(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                    percentChange === p
                      ? 'bg-[#0f4b25] text-[#ece7d7] shadow-md scale-105'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  {p > 0 ? `+${p}%` : `${p}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Elasticity Mode Selector */}
          <div className="bg-[#f7f5ed] p-5 rounded-2xl border border-stone-200 space-y-3">
            <span className="text-xs font-black uppercase tracking-wider text-stone-700 block">
              Comportamiento del Consumidor (Elasticidad):
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              
              <button
                onClick={() => setElasticityMode('inelastic')}
                className={`p-3 rounded-xl text-left border transition-all ${
                  elasticityMode === 'inelastic'
                    ? 'bg-white border-[#0f4b25] shadow-sm ring-2 ring-[#0f4b25]/20'
                    : 'bg-white/60 border-stone-200 hover:bg-white'
                }`}
              >
                <div className="font-extrabold text-xs text-[#0f4b25] flex items-center">
                  <span>🧉 Hábito Fiel</span>
                </div>
                <p className="text-[11px] text-stone-500 mt-1 leading-snug">
                  Consumo matero diario; la demanda casi no baja (+10% precio ➔ -2.5% vol).
                </p>
              </button>

              <button
                onClick={() => setElasticityMode('moderate')}
                className={`p-3 rounded-xl text-left border transition-all ${
                  elasticityMode === 'moderate'
                    ? 'bg-white border-[#0f4b25] shadow-sm ring-2 ring-[#0f4b25]/20'
                    : 'bg-white/60 border-stone-200 hover:bg-white'
                }`}
              >
                <div className="font-extrabold text-xs text-stone-800">
                  <span>⚖️ Moderada</span>
                </div>
                <p className="text-[11px] text-stone-500 mt-1 leading-snug">
                  Sensibilidad normal (+10% precio ➔ -6% en unidades).
                </p>
              </button>

              <button
                onClick={() => setElasticityMode('zero')}
                className={`p-3 rounded-xl text-left border transition-all ${
                  elasticityMode === 'zero'
                    ? 'bg-white border-[#0f4b25] shadow-sm ring-2 ring-[#0f4b25]/20'
                    : 'bg-white/60 border-stone-200 hover:bg-white'
                }`}
              >
                <div className="font-extrabold text-xs text-stone-800">
                  <span>🎯 Fija / Cero</span>
                </div>
                <p className="text-[11px] text-stone-500 mt-1 leading-snug">
                  Se venden exactamente las mismas unidades que hoy.
                </p>
              </button>

            </div>
          </div>

        </div>

      </div>

      {/* Projections KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        
        {/* Ganancia Proyectada Delta */}
        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-3xl p-6 border-2 border-emerald-500/40 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
              Ganancia Neta Proyectada
            </span>
            <TrendingUp className="w-5 h-5 text-emerald-700" />
          </div>

          <div className="text-3xl font-black text-[#0f4b25] font-display">
            ${Math.round(simulation.simulatedProfit).toLocaleString('es-AR')}
          </div>

          <div className="mt-3 flex items-center">
            {simulation.profitDelta >= 0 ? (
              <span className="inline-flex items-center text-xs font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-xl">
                <ArrowUpRight className="w-4 h-4 mr-0.5" />
                +${Math.round(simulation.profitDelta).toLocaleString('es-AR')} de beneficio extra
              </span>
            ) : (
              <span className="inline-flex items-center text-xs font-extrabold text-rose-800 bg-rose-100 px-2.5 py-1 rounded-xl">
                <ArrowDownRight className="w-4 h-4 mr-0.5" />
                -${Math.round(Math.abs(simulation.profitDelta)).toLocaleString('es-AR')} de beneficio
              </span>
            )}
          </div>
        </div>

        {/* Facturación Proyectada */}
        <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Facturación Proyectada
            </span>
            <DollarSign className="w-5 h-5 text-stone-700" />
          </div>

          <div className="text-3xl font-black text-stone-900 font-display">
            ${Math.round(simulation.simulatedRevenue).toLocaleString('es-AR')}
          </div>

          <div className="mt-3 text-xs text-stone-500">
            Diferencia sobre actual: <strong className={simulation.revenueDelta >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
              {simulation.revenueDelta >= 0 ? '+' : ''}${Math.round(simulation.revenueDelta).toLocaleString('es-AR')}
            </strong>
          </div>
        </div>

        {/* Margen Nuevo */}
        <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Margen Porcentual Estimado
            </span>
            <Percent className="w-5 h-5 text-[#e68628]" />
          </div>

          <div className="text-3xl font-black text-[#e68628] font-display">
            {simulation.simulatedMargin.toFixed(1)}%
          </div>

          <div className="mt-3 text-xs text-stone-500">
            Margen actual de referencia: <strong>{simulation.currentMargin.toFixed(1)}%</strong>
          </div>
        </div>

      </div>

      {/* Product by Product Impact Table */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-black text-stone-900 font-display">
              Impacto por Producto Simulado
            </h3>
            <p className="text-xs text-stone-500">
              Proyección individual de precios, ganancia por unidad y ganancia total
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-stone-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f7f5ed] text-stone-700 font-extrabold uppercase tracking-wider text-[11px] border-b border-stone-200">
              <tr>
                <th className="py-3 px-3.5">Producto</th>
                <th className="py-3 px-3.5">Precio Actual</th>
                <th className="py-3 px-3.5">Precio Simulado ({percentChange >= 0 ? `+${percentChange}%` : `${percentChange}%`})</th>
                <th className="py-3 px-3.5">Unidades Proyectadas</th>
                <th className="py-3 px-3.5">Ganancia Actual</th>
                <th className="py-3 px-3.5">Ganancia Proyectada</th>
                <th className="py-3 px-3.5">Impacto Neto ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {simulation.impactTable.map((item) => (
                <tr key={item.producto} className="hover:bg-stone-50 transition-colors">
                  <td className="py-3 px-3.5 font-bold text-stone-900">
                    {item.producto}
                  </td>
                  <td className="py-3 px-3.5 font-medium text-stone-600">
                    ${Math.round(item.precioActual).toLocaleString('es-AR')}
                  </td>
                  <td className="py-3 px-3.5 font-black text-[#0f4b25]">
                    ${Math.round(item.precioNuevo).toLocaleString('es-AR')}
                  </td>
                  <td className="py-3 px-3.5 font-semibold text-stone-800">
                    {item.unidadesProyectadas} u. <span className="text-[10px] text-stone-400">({item.unidadesActuales} u. hoy)</span>
                  </td>
                  <td className="py-3 px-3.5 font-medium text-stone-600">
                    ${Math.round(item.gananciaActual).toLocaleString('es-AR')}
                  </td>
                  <td className="py-3 px-3.5 font-extrabold text-[#0f4b25]">
                    ${Math.round(item.gananciaProyectada).toLocaleString('es-AR')}
                  </td>
                  <td className="py-3 px-3.5">
                    <span className={`inline-flex items-center font-bold px-2 py-0.5 rounded-lg text-xs ${
                      item.gananciaDelta >= 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                    }`}>
                      {item.gananciaDelta >= 0 ? '+' : ''}${Math.round(item.gananciaDelta).toLocaleString('es-AR')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
