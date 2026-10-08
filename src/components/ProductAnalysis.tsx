import React, { useState } from 'react';
import { 
  Award, 
  Search, 
  Filter, 
  ArrowUpDown, 
  TrendingUp, 
  TrendingDown, 
  Sparkles, 
  Package, 
  DollarSign, 
  Percent, 
  ShieldCheck, 
  HelpCircle, 
  Info,
  ChevronRight,
  Globe,
  ExternalLink
} from 'lucide-react';
import { ProductPerformance } from '../types';

interface ProductAnalysisProps {
  performances: ProductPerformance[];
  selectedMonth: string;
  onSelectProduct?: (prod: ProductPerformance) => void;
}

export const ProductAnalysis: React.FC<ProductAnalysisProps> = ({
  performances,
  selectedMonth,
  onSelectProduct
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('TODAS');
  const [bcgFilter, setBcgFilter] = useState('TODOS');
  const [sortBy, setSortBy] = useState<'score' | 'unidades' | 'facturacion' | 'ganancia' | 'margen' | 'stock'>('score');
  const [sortDesc, setSortDesc] = useState(true);

  // Podiums
  const sortedByScore = [...performances].sort((a, b) => b.scoreIntegral - a.scoreIntegral);
  const bestProduct = sortedByScore[0];
  const runnerUp = sortedByScore[1];
  const thirdPlace = sortedByScore[2];

  const sortedByVolume = [...performances].sort((a, b) => b.unidadesVendidas - a.unidadesVendidas)[0];
  const sortedByRevenue = [...performances].sort((a, b) => b.facturacionTotal - a.facturacionTotal)[0];
  const sortedByMargin = [...performances].filter(p => p.unidadesVendidas > 0).sort((a, b) => b.margenPorc - a.margenPorc)[0];

  // Filtering
  const filtered = performances.filter(p => {
    const matchSearch = p.nombreOriginal.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.marca.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = categoryFilter === 'TODAS' || p.categoria === categoryFilter;
    const matchBcg = bcgFilter === 'TODOS' || p.cuadranteBCG === bcgFilter;
    return matchSearch && matchCat && matchBcg;
  });

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    let factor = sortDesc ? -1 : 1;
    switch (sortBy) {
      case 'score': return (a.scoreIntegral - b.scoreIntegral) * factor;
      case 'unidades': return (a.unidadesVendidas - b.unidadesVendidas) * factor;
      case 'facturacion': return (a.facturacionTotal - b.facturacionTotal) * factor;
      case 'ganancia': return (a.gananciaTotal - b.gananciaTotal) * factor;
      case 'margen': return (a.margenPorc - b.margenPorc) * factor;
      case 'stock': return (a.stockActual - b.stockActual) * factor;
      default: return 0;
    }
  });

  // BCG counts
  const stars = performances.filter(p => p.cuadranteBCG === 'Estrella');
  const cows = performances.filter(p => p.cuadranteBCG === 'Vaca Lechera');
  const questions = performances.filter(p => p.cuadranteBCG === 'Interrogante');
  const dogs = performances.filter(p => p.cuadranteBCG === 'Perro');

  const toggleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(column);
      setSortDesc(true);
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Header Banner */}
      <div className="bg-[#0f4b25] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center space-x-2 bg-[#e68628] text-stone-900 font-bold text-xs uppercase px-3 py-1 rounded-full mb-3 shadow-sm">
              <Award className="w-3.5 h-3.5" />
              <span>Diagnóstico & Ranking de Productos</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-[#ece7d7]">
              ¿Cuál es el mejor producto de Yerbazo y cuánto se vende de cada uno?
            </h2>
            <p className="text-sm text-[#ece7d7]/80 max-w-3xl mt-1">
              Evaluación multicriterio integral: combinamos volumen físico, recaudación en pesos, porcentaje de rentabilidad y constancia en el tiempo para definir la estrategia de cada artículo.
            </p>
          </div>
        </div>
      </div>

      {/* Podium of Honor / Winners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* 1st Place Champion */}
        <div className="bg-gradient-to-b from-amber-50 to-white rounded-3xl p-6 border-2 border-amber-400 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-200/50 rounded-full blur-xl pointer-events-none"></div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="bg-amber-400 text-stone-900 font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider flex items-center shadow-xs">
                🥇 1° Mejor Producto Integral
              </span>
              <span className="text-2xl font-black text-amber-600 font-display">
                {bestProduct?.scoreIntegral}/100
              </span>
            </div>
            
            {bestProduct?.imagenUrl && (
              <div className="flex items-center space-x-2.5 mb-3 bg-white/90 p-1.5 rounded-xl border border-amber-300 w-fit shadow-2xs">
                <img 
                  src={bestProduct.imagenUrl} 
                  alt={bestProduct.nombreOriginal} 
                  className="w-10 h-10 object-contain rounded-lg bg-stone-50 p-0.5"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
                <span className="text-[10px] font-bold text-amber-950 bg-amber-100/90 px-2 py-0.5 rounded">
                  Foto yerbazo.com.ar
                </span>
              </div>
            )}

            <h3 className="text-xl font-black text-[#0f4b25] font-display mb-1">
              {bestProduct?.nombreOriginal}
            </h3>
            <span className="text-xs text-stone-500 font-medium block mb-4">
              Marca: {bestProduct?.marca} • Peso: {bestProduct?.peso}
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
              <div className="bg-white p-2.5 rounded-xl border border-stone-200/80 shadow-xs">
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Unidades Vendidas</span>
                <span className="text-base font-extrabold text-stone-900">{bestProduct?.unidadesVendidas} u.</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-stone-200/80 shadow-xs">
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Facturación Generada</span>
                <span className="text-base font-extrabold text-[#0f4b25]">
                  ${bestProduct?.facturacionTotal.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-stone-200/80 shadow-xs">
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Ganancia Líquida</span>
                <span className="text-base font-extrabold text-[#e68628]">
                  ${bestProduct?.gananciaTotal.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-stone-200/80 shadow-xs">
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Margen de Ganancia</span>
                <span className="text-base font-extrabold text-emerald-700">
                  {bestProduct?.margenPorc.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-amber-100/70 p-3 rounded-2xl border border-amber-200/60 text-xs text-amber-950 font-medium leading-snug">
            ⭐ <strong>El corazón de Yerbazo:</strong> Mayor tracción absoluta de clientes y solidez de caja. Jamás debe faltar stock.
          </div>
        </div>

        {/* 2nd Place */}
        <div className="bg-gradient-to-b from-stone-50 to-white rounded-3xl p-6 border-2 border-stone-300 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="bg-stone-300 text-stone-800 font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wider flex items-center">
                🥈 2° Lugar General
              </span>
              <span className="text-2xl font-black text-stone-600 font-display">
                {runnerUp?.scoreIntegral}/100
              </span>
            </div>
            
            {runnerUp?.imagenUrl && (
              <div className="flex items-center space-x-2.5 mb-3 bg-stone-100 p-1.5 rounded-xl border border-stone-200 w-fit shadow-2xs">
                <img 
                  src={runnerUp.imagenUrl} 
                  alt={runnerUp.nombreOriginal} 
                  className="w-10 h-10 object-contain rounded-lg bg-white p-0.5"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
                <span className="text-[10px] font-bold text-stone-700 bg-stone-200 px-2 py-0.5 rounded">
                  Foto yerbazo.com.ar
                </span>
              </div>
            )}

            <h3 className="text-xl font-black text-stone-900 font-display mb-1">
              {runnerUp?.nombreOriginal}
            </h3>
            <span className="text-xs text-stone-500 font-medium block mb-4">
              Marca: {runnerUp?.marca} • Peso: {runnerUp?.peso}
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Unidades</span>
                <span className="text-base font-extrabold text-stone-900">{runnerUp?.unidadesVendidas} u.</span>
              </div>
              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Facturación</span>
                <span className="text-base font-extrabold text-[#0f4b25]">
                  ${runnerUp?.facturacionTotal.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Ganancia</span>
                <span className="text-base font-extrabold text-[#e68628]">
                  ${runnerUp?.gananciaTotal.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Margen</span>
                <span className="text-base font-extrabold text-emerald-700">
                  {runnerUp?.margenPorc.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-stone-100 p-3 rounded-2xl text-xs text-stone-700 font-medium leading-snug">
            🚀 <strong>Pilar de facturación:</strong> Gran volumen y preferencia constante entre los clientes recurrentes.
          </div>
        </div>

        {/* 3rd Place */}
        <div className="bg-gradient-to-b from-amber-50/50 to-white rounded-3xl p-6 border-2 border-amber-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="bg-amber-200 text-amber-900 font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wider flex items-center">
                🥉 3° Lugar General
              </span>
              <span className="text-2xl font-black text-amber-700 font-display">
                {thirdPlace?.scoreIntegral}/100
              </span>
            </div>
            
            {thirdPlace?.imagenUrl && (
              <div className="flex items-center space-x-2.5 mb-3 bg-amber-50/80 p-1.5 rounded-xl border border-amber-200 w-fit shadow-2xs">
                <img 
                  src={thirdPlace.imagenUrl} 
                  alt={thirdPlace.nombreOriginal} 
                  className="w-10 h-10 object-contain rounded-lg bg-white p-0.5"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  Foto yerbazo.com.ar
                </span>
              </div>
            )}

            <h3 className="text-xl font-black text-stone-900 font-display mb-1">
              {thirdPlace?.nombreOriginal}
            </h3>
            <span className="text-xs text-stone-500 font-medium block mb-4">
              Marca: {thirdPlace?.marca} • Peso: {thirdPlace?.peso}
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Unidades</span>
                <span className="text-base font-extrabold text-stone-900">{thirdPlace?.unidadesVendidas} u.</span>
              </div>
              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Facturación</span>
                <span className="text-base font-extrabold text-[#0f4b25]">
                  ${thirdPlace?.facturacionTotal.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Ganancia</span>
                <span className="text-base font-extrabold text-[#e68628]">
                  ${thirdPlace?.gananciaTotal.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Margen</span>
                <span className="text-base font-extrabold text-emerald-700">
                  {thirdPlace?.margenPorc.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 p-3 rounded-2xl text-xs text-amber-800 font-medium leading-snug">
            💎 <strong>Fuerte rentabilidad:</strong> Aporta flujo clave y complementa de forma ideal la oferta matera.
          </div>
        </div>

      </div>

      {/* Specialized Leaders: Volumen vs Facturacion vs Margen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="bg-white rounded-2xl p-4 border border-stone-200 flex items-center space-x-3.5 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-[#0f4b25] flex items-center justify-center font-bold text-xl">
            📦
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Más Vendido en Unidades</span>
            <h4 className="text-sm font-black text-stone-900 truncate max-w-[200px]" title={sortedByVolume?.nombreOriginal || 'Sin datos'}>
              {sortedByVolume?.nombreOriginal || 'Sin datos'}
            </h4>
            <span className="text-xs font-bold text-[#0f4b25]">
              {sortedByVolume ? `${sortedByVolume.unidadesVendidas} paquetes despachados` : '0 paquetes despachados'}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200 flex items-center space-x-3.5 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-[#e68628] flex items-center justify-center font-bold text-xl">
            💰
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Mayor Recaudación en Dinero</span>
            <h4 className="text-sm font-black text-stone-900 truncate max-w-[200px]" title={sortedByRevenue?.nombreOriginal || 'Sin datos'}>
              {sortedByRevenue?.nombreOriginal || 'Sin datos'}
            </h4>
            <span className="text-xs font-bold text-[#e68628]">
              {sortedByRevenue ? `$${sortedByRevenue.facturacionTotal.toLocaleString('es-AR')} facturados` : '$0 facturados'}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200 flex items-center space-x-3.5 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xl">
            💎
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Mayor Margen de Ganancia</span>
            <h4 className="text-sm font-black text-stone-900 truncate max-w-[200px]" title={sortedByMargin?.nombreOriginal || 'Sin datos'}>
              {sortedByMargin?.nombreOriginal || 'Sin datos'}
            </h4>
            <span className="text-xs font-bold text-emerald-600">
              {sortedByMargin?.margenPorc != null ? `${sortedByMargin.margenPorc.toFixed(1)}% margen neto` : '0.0% margen neto'}
            </span>
          </div>
        </div>

      </div>

      {/* BCG Matrix Quadrant Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-[#0f4b25]"></span>
              <h3 className="text-xl font-black text-stone-900 font-display">
                Matriz BCG de Productos (Boston Consulting Group)
              </h3>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Clasificación estratégica según volumen de rotación y ritmo de crecimiento de mercado
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold">
              ⭐ Estrellas ({stars.length})
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-bold">
              🐄 Vacas ({cows.length})
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 font-bold">
              ❓ Interrogantes ({questions.length})
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 font-bold">
              🐶 Perros ({dogs.length})
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Estrellas */}
          <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-black text-amber-900 flex items-center">
                <span className="mr-1.5 text-base">⭐</span> ESTRELLAS (Alto Volumen & Alto Crecimiento)
              </h4>
              <span className="text-[11px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full">
                Prioridad de Abastecimiento
              </span>
            </div>
            <p className="text-xs text-stone-600 mb-3">
              Los productos líderes con alta demanda y tracción. Recomendación: Asegurar stock, mantener precio y usarlos como ancla para promociones cruzadas.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {stars.slice(0, 6).map(p => (
                <span key={p.producto} className="text-xs font-bold bg-white text-stone-800 px-2.5 py-1 rounded-lg border border-amber-300 shadow-2xs">
                  {p.nombreOriginal} ({p.unidadesVendidas} u.)
                </span>
              ))}
            </div>
          </div>

          {/* Vacas Lecheras */}
          <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-black text-emerald-900 flex items-center">
                <span className="mr-1.5 text-base">🐄</span> VACAS LECHERAS (Alto Volumen & Madurez Estable)
              </h4>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-full">
                Generador de Efectivo
              </span>
            </div>
            <p className="text-xs text-stone-600 mb-3">
              Generan flujo continuo de ganancias con mínimo esfuerzo de venta. Recomendación: No bajar márgenes ni hacer descuentos agresivos innecesarios.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cows.length > 0 ? cows.slice(0, 6).map(p => (
                <span key={p.producto} className="text-xs font-bold bg-white text-stone-800 px-2.5 py-1 rounded-lg border border-emerald-300 shadow-2xs">
                  {p.nombreOriginal} ({p.unidadesVendidas} u.)
                </span>
              )) : (
                <span className="text-xs text-stone-400 italic">Productos estables consolidados en Estrellas</span>
              )}
            </div>
          </div>

          {/* Interrogantes */}
          <div className="p-5 rounded-2xl bg-blue-50/70 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-black text-blue-900 flex items-center">
                <span className="mr-1.5 text-base">❓</span> INTERROGANTES (Alto Margen / Potencial por Probar)
              </h4>
              <span className="text-[11px] font-bold text-blue-800 bg-blue-200/80 px-2 py-0.5 rounded-full">
                Oportunidad de Prueba
              </span>
            </div>
            <p className="text-xs text-stone-600 mb-3">
              Variedades o accesorios con potencial de crecimiento pero volumen aún bajo. Recomendación: Promocionar mediante degustación o packs con yerbas líderes.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {questions.slice(0, 6).map(p => (
                <span key={p.producto} className="text-xs font-bold bg-white text-stone-800 px-2.5 py-1 rounded-lg border border-blue-300 shadow-2xs">
                  {p.nombreOriginal} ({p.unidadesVendidas} u.)
                </span>
              ))}
            </div>
          </div>

          {/* Perros */}
          <div className="p-5 rounded-2xl bg-rose-50/70 border border-rose-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-black text-rose-900 flex items-center">
                <span className="mr-1.5 text-base">🐶</span> PERROS (Baja Rotación & Capital Inmovilizado)
              </h4>
              <span className="text-[11px] font-bold text-rose-800 bg-rose-200/80 px-2 py-0.5 rounded-full">
                Liquidación / Salida
              </span>
            </div>
            <p className="text-xs text-stone-600 mb-3">
              Artículos con pocas ventas y stock parado. Recomendación: Ofertas especiales, combos de liquidación para recuperar capital de compra.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {dogs.slice(0, 6).map(p => (
                <span key={p.producto} className="text-xs font-bold bg-white text-stone-800 px-2.5 py-1 rounded-lg border border-rose-300 shadow-2xs">
                  {p.nombreOriginal} ({p.stockActual} u. en stock)
                </span>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Master Products Table with Search & Filters */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200">
        
        {/* Table Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-black text-stone-900 font-display">
              Catálogo Completo y Métricas de Rendimiento ({sorted.length} productos)
            </h3>
            <p className="text-xs text-stone-500">
              Haz clic en cualquier columna para ordenar los datos
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Search input */}
            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar yerba o accesorio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f4b25]"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 bg-stone-50 focus:outline-none cursor-pointer"
            >
              <option value="TODAS">Categoría: Todas</option>
              <option value="Yerbas">Yerbas</option>
              <option value="Accesorios">Accesorios</option>
              <option value="Mates y Bombillas">Mates y Bombillas</option>
            </select>

            {/* BCG Filter */}
            <select
              value={bcgFilter}
              onChange={(e) => setBcgFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 bg-stone-50 focus:outline-none cursor-pointer"
            >
              <option value="TODOS">Matriz BCG: Todos</option>
              <option value="Estrella">⭐ Estrellas</option>
              <option value="Vaca Lechera">🐄 Vacas Lecheras</option>
              <option value="Interrogante">❓ Interrogantes</option>
              <option value="Perro">🐶 Perros</option>
            </select>

          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto rounded-2xl border border-stone-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f7f5ed] text-stone-700 font-extrabold uppercase tracking-wider text-[11px] border-b border-stone-200 select-none">
              <tr>
                <th className="py-3 px-3.5">#</th>
                <th className="py-3 px-3.5">Producto</th>
                <th className="py-3 px-3.5">Tienda Web</th>
                <th 
                  onClick={() => toggleSort('score')} 
                  className="py-3 px-3.5 cursor-pointer hover:bg-stone-200/70 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Score</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('unidades')} 
                  className="py-3 px-3.5 cursor-pointer hover:bg-stone-200/70 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Vendidas</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('facturacion')} 
                  className="py-3 px-3.5 cursor-pointer hover:bg-stone-200/70 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Facturación</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('ganancia')} 
                  className="py-3 px-3.5 cursor-pointer hover:bg-stone-200/70 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Ganancia</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('margen')} 
                  className="py-3 px-3.5 cursor-pointer hover:bg-stone-200/70 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Margen %</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('stock')} 
                  className="py-3 px-3.5 cursor-pointer hover:bg-stone-200/70 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Stock Restante</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  </div>
                </th>
                <th className="py-3 px-3.5">Tendencia</th>
                <th className="py-3 px-3.5">Estrategia Recomendada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {sorted.map((p, idx) => (
                <tr 
                  key={p.producto}
                  className="hover:bg-emerald-50/40 transition-colors cursor-pointer"
                  onClick={() => onSelectProduct?.(p)}
                >
                  <td className="py-3 px-3.5 font-bold text-stone-400 text-[11px]">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-3.5">
                    <div className="flex items-center space-x-2.5">
                      {p.imagenUrl && (
                        <img 
                          src={p.imagenUrl} 
                          alt={p.nombreOriginal} 
                          className="w-9 h-9 object-contain rounded-lg bg-stone-50 border border-stone-200 p-0.5 shrink-0"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      )}
                      <div>
                        <div className="font-extrabold text-stone-900 text-sm">
                          {p.nombreOriginal}
                        </div>
                        <div className="text-[11px] text-stone-500 flex items-center space-x-2 mt-0.5">
                          <span className="font-semibold text-[#0f4b25]">{p.marca}</span>
                          <span>•</span>
                          <span>{p.peso}</span>
                          <span>•</span>
                          <span className="bg-stone-100 px-1.5 py-0.2 rounded font-mono text-[10px]">
                            {p.clasificacionABC}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3.5 whitespace-nowrap">
                    {p.precioWeb ? (
                      <div>
                        <div className="flex items-center space-x-1.5">
                          {p.webEnOferta && p.precioWebOferta ? (
                            <>
                              <span className="line-through text-stone-400 text-[10px]">
                                ${p.precioWeb.toLocaleString('es-AR')}
                              </span>
                              <span className="font-black text-[#e68628] text-xs">
                                ${p.precioWebOferta.toLocaleString('es-AR')}
                              </span>
                              <span className="text-[9px] font-black bg-orange-100 text-orange-900 px-1 py-0.2 rounded">
                                OFERTA
                              </span>
                            </>
                          ) : (
                            <span className="font-bold text-[#0f4b25] text-xs">
                              ${p.precioWeb.toLocaleString('es-AR')}
                            </span>
                          )}
                        </div>
                        {p.webStockStatus === 'ultimas' && (
                          <span className="inline-block text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded mt-0.5">
                            🔥 Últimas u.
                          </span>
                        )}
                        {p.webStockStatus === 'sinstock' && (
                          <span className="inline-block text-[9px] font-bold text-rose-800 bg-rose-100 px-1.5 py-0.2 rounded mt-0.5">
                            🔴 Sin stock
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-stone-300 text-xs">-</span>
                    )}
                  </td>
                  <td className="py-3 px-3.5">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-black text-sm text-[#0f4b25]">{p.scoreIntegral}</span>
                      <div className="w-12 bg-stone-200 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#0f4b25] h-full rounded-full" 
                          style={{ width: `${Math.min(100, p.scoreIntegral)}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3.5 font-extrabold text-stone-900">
                    {p.unidadesVendidas} <span className="font-normal text-stone-400">u.</span>
                  </td>
                  <td className="py-3 px-3.5 font-extrabold text-[#0f4b25]">
                    ${p.facturacionTotal.toLocaleString('es-AR')}
                  </td>
                  <td className="py-3 px-3.5 font-extrabold text-[#e68628]">
                    ${p.gananciaTotal.toLocaleString('es-AR')}
                  </td>
                  <td className="py-3 px-3.5">
                    <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60">
                      {p.margenPorc.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-3.5">
                    <div className="flex items-center space-x-1.5">
                      <span className={`font-black text-sm ${
                        p.stockActual === 0 ? 'text-rose-600' :
                        p.stockActual <= 4 ? 'text-amber-600' : 'text-stone-800'
                      }`}>
                        {p.stockActual} u.
                      </span>
                      {p.stockActual <= 4 && p.unidadesVendidas > 0 && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                          ¡Bajo!
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3.5">
                    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      p.tendencia === 'Fuerte Alza' ? 'bg-emerald-100 text-emerald-900' :
                      p.tendencia === 'Crecimiento' ? 'bg-emerald-50 text-emerald-800' :
                      p.tendencia === 'Fuerte Caída' ? 'bg-rose-100 text-rose-900' :
                      p.tendencia === 'Baja Ligera' ? 'bg-amber-100 text-amber-900' :
                      'bg-stone-100 text-stone-600'
                    }`}>
                      {p.tendencia}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 text-stone-700 font-medium">
                    <div className="text-[11px] leading-tight font-semibold text-stone-800">
                      {p.estrategiaRecomendada}
                    </div>
                    <div className="text-[10px] text-stone-400 mt-0.5">
                      {p.tipoAccion}
                    </div>
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
