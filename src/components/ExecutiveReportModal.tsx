import React from 'react';
import { X, Printer, Download, Award, TrendingUp, CheckCircle, Package } from 'lucide-react';
import { MonthlyMetric, ProductPerformance, YerbazoDataset } from '../types';

interface ExecutiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: YerbazoDataset;
  monthlyMetrics: MonthlyMetric[];
  performances: ProductPerformance[];
  selectedMonth: string;
}

export const ExecutiveReportModal: React.FC<ExecutiveReportModalProps> = ({
  isOpen,
  onClose,
  dataset,
  monthlyMetrics,
  performances,
  selectedMonth
}) => {
  if (!isOpen) return null;

  const currentMonthMetric = selectedMonth !== 'TODOS' 
    ? monthlyMetrics.find(m => m.mesKey === selectedMonth) 
    : null;

  const totalFacturado = currentMonthMetric 
    ? currentMonthMetric.facturado 
    : monthlyMetrics.reduce((acc, m) => acc + m.facturado, 0);

  const totalGanancia = currentMonthMetric 
    ? currentMonthMetric.ganancia 
    : monthlyMetrics.reduce((acc, m) => acc + m.ganancia, 0);

  const totalPedidos = currentMonthMetric 
    ? currentMonthMetric.cantVentas 
    : dataset.ventas.length;

  const margenGeneral = totalFacturado > 0 ? (totalGanancia / totalFacturado) * 100 : 0;
  const topProduct = performances[0];
  const criticalStock = dataset.stock.filter(p => p.restantes <= 4 && p.vendidas > 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200 flex flex-col">
        
        {/* Modal Controls (No print) */}
        <div className="p-4 sm:p-6 bg-[#0f4b25] text-white flex items-center justify-between no-print sticky top-0 z-20">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📄</span>
            <h3 className="font-extrabold text-base sm:text-lg font-display text-[#ece7d7]">
              Reporte Ejecutivo de Inteligencia Comercial Yerbazo
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-[#e68628] hover:bg-[#cc721b] text-white text-xs font-bold flex items-center space-x-2 shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Guardar PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 text-white/80 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Report Body */}
        <div className="p-6 sm:p-10 space-y-8 bg-white text-stone-900" id="executive-report-content">
          
          {/* Header Document */}
          <div className="border-b-2 border-[#0f4b25] pb-6 flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-[#0f4b25] p-1 flex items-center justify-center border-2 border-[#e68628] shadow-sm overflow-hidden">
                <img src="/logo.webp" alt="Yerbazo Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-3xl font-black font-display tracking-tight text-[#0f4b25] uppercase">
                  YERBAZO
                </h1>
                <p className="text-xs text-stone-500 font-semibold tracking-wide uppercase">
                  Informe de Gestión de Ventas, Márgenes & Stock
                </p>
              </div>
            </div>

            <div className="text-right text-xs text-stone-500 space-y-1">
              <div className="font-bold text-stone-800">Fecha de Emisión:</div>
              <div>{new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
              <div>Período: <strong className="text-[#0f4b25]">{selectedMonth === 'TODOS' ? 'Histórico Consolidado 2026' : `Mes de ${selectedMonth}`}</strong></div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-stone-400 mb-3">
              1. Resumen Ejecutivo de Desempeño
            </h2>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">Facturación Total</span>
                <span className="text-xl font-black text-stone-900">${totalFacturado.toLocaleString('es-AR')}</span>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block mb-1">Ganancia Líquida</span>
                <span className="text-xl font-black text-[#0f4b25]">${totalGanancia.toLocaleString('es-AR')}</span>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <span className="text-[10px] uppercase font-bold text-amber-800 block mb-1">Margen Neto Promedio</span>
                <span className="text-xl font-black text-[#e68628]">{margenGeneral.toFixed(1)}%</span>
              </div>
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">Total Pedidos</span>
                <span className="text-xl font-black text-stone-900">{totalPedidos}</span>
              </div>
            </div>
          </div>

          {/* Top 5 Products Leaderboard */}
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-stone-400 mb-3">
              2. Ranking de Productos Más Vendidos
            </h2>
            <table className="w-full text-left text-xs border border-stone-200 rounded-xl overflow-hidden">
              <thead className="bg-[#f7f5ed] font-bold text-stone-700">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Producto</th>
                  <th className="p-2.5">Unidades</th>
                  <th className="p-2.5">Facturación</th>
                  <th className="p-2.5">Ganancia</th>
                  <th className="p-2.5">Margen</th>
                  <th className="p-2.5">Clasificación BCG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {performances.slice(0, 7).map((p, idx) => (
                  <tr key={p.producto}>
                    <td className="p-2.5 font-bold text-stone-500">{idx + 1}</td>
                    <td className="p-2.5 font-bold text-stone-900">{p.nombreOriginal}</td>
                    <td className="p-2.5 font-semibold text-stone-800">{p.unidadesVendidas} u.</td>
                    <td className="p-2.5 font-extrabold text-[#0f4b25]">${p.facturacionTotal.toLocaleString('es-AR')}</td>
                    <td className="p-2.5 font-bold text-[#e68628]">${p.gananciaTotal.toLocaleString('es-AR')}</td>
                    <td className="p-2.5 font-semibold text-emerald-800">{p.margenPorc.toFixed(1)}%</td>
                    <td className="p-2.5 font-bold text-stone-700">{p.cuadranteBCG}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Inventory Alerts & Procurement */}
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-stone-400 mb-3">
              3. Alertas Críticas de Reabastecimiento de Stock
            </h2>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs space-y-2">
              <div className="font-bold text-amber-950 flex items-center">
                <span>⚠️ Productos con stock menor a 5 unidades que requieren orden inmediata:</span>
              </div>
              <ul className="list-disc list-inside text-stone-700 space-y-1">
                {criticalStock.map(p => (
                  <li key={p.nombre}>
                    <strong>{p.nombre}</strong>: Quedan solo <strong>{p.restantes} unidades</strong> en depósito (vendidas históricas: {p.vendidas} u.).
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Strategic Recommendations */}
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-stone-400 mb-3">
              4. Recomendaciones Comerciales para el Próximo Mes
            </h2>
            <div className="space-y-2.5 text-xs text-stone-700">
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <strong>• Proteger el stock de los productos Estrella:</strong> Baldo Tradicional 1KG y Canarias Tradicional 1KG son los motores de ventas; no deben quebrar stock bajo ninguna circunstancia.
              </div>
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <strong>• Activar combos con accesorios:</strong> Asociar yerbas líderes con accesorios (Lata Baldo, Yerbera, Reposa mate) para aumentar el ticket promedio por encima de $15.000.
              </div>
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <strong>• Cobranzas:</strong> Recuperar las ventas marcadas como impagas o pendientes de cobro para sanear el flujo de caja.
              </div>
            </div>
          </div>

          {/* Footer Signature */}
          <div className="pt-8 border-t border-stone-200 flex items-center justify-between text-xs text-stone-400">
            <span>Yerbazo Intelligence • Generado automáticamente</span>
            <span>Marca Registrada Yerbazo 2026</span>
          </div>

        </div>

      </div>
    </div>
  );
};
