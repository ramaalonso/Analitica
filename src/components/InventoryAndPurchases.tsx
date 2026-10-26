import React, { useState, useMemo, useEffect } from 'react';
import { 
  Package, 
  AlertTriangle, 
  ShoppingCart, 
  DollarSign, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  ShieldAlert,
  Search,
  Layers,
  ChevronRight,
  Copy,
  Check,
  FileSpreadsheet,
  Plus,
  Minus,
  RotateCcw,
  Zap,
  Info,
  TrendingUp,
  ArrowRight,
  Percent
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { YerbazoDataset, ProductPerformance } from '../types';
import { exportToExcel } from '../services/dataService';
import { analyzeRepurchaseRadar } from '../utils/repurchaseEngine';

interface InventoryAndPurchasesProps {
  dataset: YerbazoDataset;
  performances: ProductPerformance[];
}

export const InventoryAndPurchases: React.FC<InventoryAndPurchasesProps> = ({
  dataset,
  performances
}) => {
  const [stockSearch, setStockSearch] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'CRITICAL' | 'ALERT' | 'HEALTHY' | 'OUT'>('ALL');
  const [targetCoverageDays, setTargetCoverageDays] = useState<number>(30); // 30 days coverage target
  const [copiedOrder, setCopiedOrder] = useState<boolean>(false);
  const [purchaseFilter, setPurchaseFilter] = useState<'ALL' | 'ONLY_BUY' | 'CRITICAL'>('ALL');
  const [mateSearch, setMateSearch] = useState('');
  const [mateCategoryFilter, setMateCategoryFilter] = useState<'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK' | 'Mate' | 'Bombilla' | 'Canasta'>('ALL');

  // Manual purchase quantities state: { [productName]: quantity }
  const [manualPurchases, setManualPurchases] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('yerbazo_manual_purchases');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not read saved manual purchases', e);
    }
    
    // Default initial quantities from sheet's proxCompra
    const initial: Record<string, number> = {};
    for (const item of dataset.proxCompra) {
      if (item.proxCompraSugerida > 0) {
        initial[item.producto] = item.proxCompraSugerida;
      }
    }
    return initial;
  });

  // Save manual purchases to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('yerbazo_manual_purchases', JSON.stringify(manualPurchases));
    } catch (e) {
      console.warn('Could not save manual purchases', e);
    }
  }, [manualPurchases]);

  // Overall Stock valuations
  const totalStockUnits = dataset.stock.reduce((acc, p) => acc + p.restantes, 0);
  const totalStockValuationCost = dataset.stock.reduce((acc, p) => acc + (p.restantes * p.precioCompra), 0);
  const totalStockValuationSale = dataset.stock.reduce((acc, p) => acc + (p.restantes * p.precioVenta), 0);
  const projectedStockProfit = totalStockValuationSale - totalStockValuationCost;

  // Mates valuation (Stock myb)
  const matesStockUnits = dataset.matesBombillas.reduce((acc, m) => acc + (m.restantes !== undefined ? m.restantes : m.cantidad), 0);
  const matesStockSaleValuation = dataset.matesBombillas.reduce((acc, m) => acc + (m.valorVenta !== undefined ? m.valorVenta : m.total), 0);
  const matesStockCostValuation = dataset.matesBombillas.reduce((acc, m) => acc + (m.valorCosto !== undefined ? m.valorCosto : (m.cantidad * m.precioCompra)), 0);
  const matesStockValuation = matesStockSaleValuation;

  // Filtered Mates & Bombillas list
  const filteredMates = useMemo(() => {
    return dataset.matesBombillas.filter(mate => {
      const matchSearch = mate.producto.toLowerCase().includes(mateSearch.toLowerCase());
      const restantes = mate.restantes !== undefined ? mate.restantes : mate.cantidad;
      if (mateCategoryFilter === 'IN_STOCK') return matchSearch && restantes > 0;
      if (mateCategoryFilter === 'OUT_OF_STOCK') return matchSearch && restantes <= 0;
      if (mateCategoryFilter === 'Mate' || mateCategoryFilter === 'Bombilla' || mateCategoryFilter === 'Canasta') {
        return matchSearch && mate.categoria === mateCategoryFilter;
      }
      return matchSearch;
    });
  }, [dataset.matesBombillas, mateSearch, mateCategoryFilter]);

  // Unified items list for Próxima Compra planning
  // We merge dataset.stock and dataset.proxCompra
  const procurementItems = useMemo(() => {
    return dataset.stock.map(stockItem => {
      const perf = performances.find(p => 
        p.producto === stockItem.nombreNormalizado || 
        p.nombreOriginal.toLowerCase() === stockItem.nombre.toLowerCase()
      );
      const proxSheet = dataset.proxCompra.find(p => 
        p.producto.toLowerCase() === stockItem.nombre.toLowerCase() ||
        (stockItem.nombreNormalizado && p.producto.toLowerCase() === stockItem.nombreNormalizado)
      );
      
      const restantes = stockItem.restantes;
      const costoUnitario = stockItem.precioCompra || (proxSheet ? proxSheet.costeUnidad : 0);
      const precioVenta = stockItem.precioVenta;
      const velSemanal = perf ? perf.velocidadSemanal : 0.5; // units per week
      const velDiaria = Math.max(0.05, velSemanal / 7);

      // Smart recommended purchase quantity:
      // Units needed to reach targetCoverageDays minus current remaining stock
      const unitsNeededForTarget = Math.ceil(velDiaria * targetCoverageDays);
      const smartRecommended = Math.max(0, unitsNeededForTarget - restantes);

      // User's manual chosen quantity
      const userQty = manualPurchases[stockItem.nombre] !== undefined 
        ? manualPurchases[stockItem.nombre] 
        : (proxSheet ? proxSheet.proxCompraSugerida : 0);

      // Post-purchase calculations
      const totalPostCompra = restantes + userQty;
      const costoTotalCompra = userQty * costoUnitario;
      const diasCoberturaPostCompra = Math.round(totalPostCompra / velDiaria);
      const gananciaProyectadaCompra = userQty * (precioVenta - costoUnitario);

      return {
        producto: stockItem.nombre,
        categoria: stockItem.categoria,
        marca: stockItem.marca,
        restantes,
        costoUnitario,
        precioVenta,
        velocidadSemanal: parseFloat(velSemanal.toFixed(1)),
        diasCoberturaActual: perf ? perf.diasCobertura : 0,
        smartRecommended,
        userQty,
        totalPostCompra,
        costoTotalCompra,
        diasCoberturaPostCompra,
        gananciaProyectadaCompra,
        status: restantes === 0 ? 'OUT' : (restantes <= 4 || (perf && perf.diasCobertura < 7)) ? 'CRITICAL' : 'OK'
      };
    });
  }, [dataset.stock, dataset.proxCompra, performances, targetCoverageDays, manualPurchases]);

  // Aggregate totals for the planned manual purchase
  const totalUserUnits = procurementItems.reduce((acc, item) => acc + item.userQty, 0);
  const totalUserCost = procurementItems.reduce((acc, item) => acc + item.costoTotalCompra, 0);
  const totalUserProfit = procurementItems.reduce((acc, item) => acc + item.gananciaProyectadaCompra, 0);
  const totalItemsToBuyCount = procurementItems.filter(item => item.userQty > 0).length;

  // Stock status items for bottom table
  const enrichedStock = procurementItems.map(item => ({
    id: item.producto,
    nombre: item.producto,
    comprado: dataset.stock.find(s => s.nombre === item.producto)?.comprado || 0,
    vendidas: dataset.stock.find(s => s.nombre === item.producto)?.vendidas || 0,
    restantes: item.restantes,
    precioCompra: item.costoUnitario,
    precioVenta: item.precioVenta,
    diasCobertura: item.diasCoberturaActual,
    velocidadSemanal: item.velocidadSemanal,
    status: item.status
  }));

  // Imminent demand from Repurchase Radar
  const radarClients = useMemo(() => {
    return analyzeRepurchaseRadar(dataset, dataset.stock, dataset.webStore);
  }, [dataset]);

  const imminentDemandByProduct = useMemo(() => {
    const demandMap: Record<string, { yerbaName: string; unitsNeeded: number; clientCount: number }> = {};
    for (const c of radarClients) {
      if (c.estadoConsumo === 'sin_yerba' || c.estadoConsumo === 'ultimas_cebadas') {
        const yerba = c.yerbaFavorita;
        if (!demandMap[yerba]) {
          demandMap[yerba] = { yerbaName: yerba, unitsNeeded: 0, clientCount: 0 };
        }
        demandMap[yerba].clientCount++;
        demandMap[yerba].unitsNeeded += Math.max(1, Math.round(c.kgCompradosUltima || 1));
      }
    }
    return demandMap;
  }, [radarClients]);

  // Stock Bottlenecks (urgent repurchase demand > current warehouse stock)
  const stockBottlenecks = useMemo(() => {
    const list: { yerbaName: string; demand: number; stock: number; missing: number; clients: number }[] = [];
    for (const [yerba, d] of Object.entries(imminentDemandByProduct)) {
      const matchStock = dataset.stock.find(p => p.nombre.toLowerCase().includes(yerba.toLowerCase()) || yerba.toLowerCase().includes(p.nombre.toLowerCase()));
      const currentStock = matchStock ? matchStock.restantes : 0;
      if (currentStock < d.unitsNeeded) {
        list.push({
          yerbaName: yerba,
          demand: d.unitsNeeded,
          stock: currentStock,
          missing: d.unitsNeeded - currentStock,
          clients: d.clientCount
        });
      }
    }
    return list.sort((a, b) => b.missing - a.missing);
  }, [imminentDemandByProduct, dataset.stock]);

  const criticalItems = enrichedStock.filter(i => i.status === 'CRITICAL' || i.status === 'OUT');

  const filteredStock = enrichedStock.filter(item => {
    const matchSearch = item.nombre.toLowerCase().includes(stockSearch.toLowerCase());
    const matchStatus = stockStatusFilter === 'ALL' || item.status === stockStatusFilter;
    return matchSearch && matchStatus;
  });

  // Filter for procurement table
  const filteredProcurement = procurementItems.filter(item => {
    if (purchaseFilter === 'ONLY_BUY') return item.userQty > 0 || item.smartRecommended > 0;
    if (purchaseFilter === 'CRITICAL') return item.status === 'CRITICAL' || item.status === 'OUT';
    return true;
  });

  // Handlers for manual purchase inputs
  const handleQuantityChange = (productName: string, qty: number) => {
    const val = Math.max(0, isNaN(qty) ? 0 : Math.round(qty));
    setManualPurchases(prev => ({
      ...prev,
      [productName]: val
    }));
  };

  const handleStepQuantity = (productName: string, delta: number) => {
    const current = manualPurchases[productName] || 0;
    handleQuantityChange(productName, current + delta);
  };

  const handleApplySmartRecommendations = () => {
    const updated: Record<string, number> = {};
    for (const item of procurementItems) {
      if (item.smartRecommended > 0) {
        updated[item.producto] = item.smartRecommended;
      } else {
        updated[item.producto] = 0;
      }
    }
    setManualPurchases(updated);
  };

  const handleResetManualQuantities = () => {
    const zeroed: Record<string, number> = {};
    for (const item of dataset.stock) {
      zeroed[item.nombre] = 0;
    }
    for (const item of dataset.proxCompra) {
      zeroed[item.producto] = 0;
    }
    setManualPurchases(zeroed);
    try {
      localStorage.setItem('yerbazo_manual_purchases', JSON.stringify(zeroed));
    } catch (e) {
      console.warn('Could not save zeroed manual purchases', e);
    }
  };

  const handleCopyOrderWhatsApp = () => {
    const itemsToBuy = procurementItems.filter(i => i.userQty > 0);
    if (itemsToBuy.length === 0) {
      alert('No has seleccionado cantidades a comprar aún.');
      return;
    }

    const lines = [
      '🌿 *ORDEN DE COMPRA - YERBAZO* 🌿',
      `📅 Fecha: ${new Date().toLocaleDateString('es-AR')}`,
      '----------------------------------------',
      ...itemsToBuy.map(i => `• *${i.userQty}x* ${i.producto} ($${i.costoUnitario.toLocaleString('es-AR')} c/u ➔ $${i.costoTotalCompra.toLocaleString('es-AR')})`),
      '----------------------------------------',
      `📦 *Total de Unidades:* ${totalUserUnits} paquetes`,
      `💰 *Total Inversión Estimada:* $${totalUserCost.toLocaleString('es-AR')}`,
      '',
      '¡Por favor confirmar disponibilidad y fecha de entrega! Muchas gracias.'
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedOrder(true);
    setTimeout(() => setCopiedOrder(false), 3000);
  };

  const handleCoverStockBottlenecks = () => {
    setManualPurchases(prev => {
      const next = { ...prev };
      for (const alert of stockBottlenecks) {
        const match = procurementItems.find(p => p.producto.toLowerCase().includes(alert.yerbaName.toLowerCase()) || alert.yerbaName.toLowerCase().includes(p.producto.toLowerCase()));
        const key = match ? match.producto : alert.yerbaName;
        next[key] = Math.max(next[key] || 0, alert.missing);
      }
      return next;
    });
    confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
  };

  const handleExportOrderExcel = () => {
    const rows = procurementItems.filter(i => i.userQty > 0 || i.smartRecommended > 0).map(i => ({
      Producto: i.producto,
      Stock_Restante_Actual: i.restantes,
      Cuanto_Recomienda_Yerbazo: i.smartRecommended,
      Cuanto_Comprare_Manual: i.userQty,
      Stock_Final_Me_Quedaran: i.totalPostCompra,
      Costo_Unitario: i.costoUnitario,
      Costo_Total_Me_Saldra: i.costoTotalCompra,
      Precio_Venta_Publico: i.precioVenta,
      Ganancia_Proyectada: i.gananciaProyectadaCompra,
      Dias_Cobertura_Proyectados: i.diasCoberturaPostCompra
    }));

    exportToExcel(`Yerbazo_Orden_Compra_${new Date().toISOString().slice(0, 10)}`, {
      'Orden_Proxima_Compra': rows
    });
  };

  return (
    <div className="space-y-8">
      
      {/* Header (Compact on mobile, full on desktop) */}
      <div className="bg-[#0f4b25] text-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-md sm:shadow-xl relative overflow-hidden border-b-2 sm:border-b-4 border-[#e68628]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center space-x-1.5 bg-[#e68628] text-stone-900 font-bold text-[10px] sm:text-xs uppercase px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full mb-1.5 sm:mb-3 shadow-sm">
              <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Stock & Próxima Compra</span>
            </div>
            <h2 className="text-lg sm:text-3xl font-black font-display tracking-tight text-[#ece7d7] leading-tight">
              Control de Stock y Próxima Compra
            </h2>
            <p className="hidden sm:block text-sm text-[#ece7d7]/80 max-w-3xl mt-1">
              Consulta cuánto te recomendamos comprar según tu ritmo de venta real, define manualmente tus cantidades y proyecta en tiempo real cuánto te costará y cuántas unidades te quedarán.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards: 2x2 on mobile, 4 cols on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        
        {/* Total a Pagar por esta Compra */}
        <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border-2 border-[#e68628] shadow-sm">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-600">Costo Compra</span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-orange-100 text-[#e68628] flex items-center justify-center font-black text-xs sm:text-base">
              💰
            </div>
          </div>
          <div className="text-lg sm:text-3xl font-black text-[#e68628] font-display truncate">
            ${totalUserCost.toLocaleString('es-AR')}
          </div>
          <span className="text-[10px] sm:text-xs text-stone-600 mt-1 block font-medium truncate">
            <strong>{totalUserUnits} paq.</strong> ({totalItemsToBuyCount} prod.)
          </span>
        </div>

        {/* Ganancia Proyectada por esta Compra */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-500">Ganancia Proy.</span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 text-[#0f4b25] flex items-center justify-center font-black text-xs sm:text-base">
              📈
            </div>
          </div>
          <div className="text-lg sm:text-3xl font-black text-[#0f4b25] font-display truncate">
            ${totalUserProfit.toLocaleString('es-AR')}
          </div>
          <span className="text-[10px] sm:text-xs text-emerald-800 mt-1 block font-semibold truncate">
            Al vender la compra
          </span>
        </div>

        {/* Capital Actual en Stock */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-500">Stock Actual</span>
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-stone-500" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-stone-900 font-display truncate">
            {totalStockUnits} <span className="text-xs sm:text-sm font-normal text-stone-500">un.</span>
          </div>
          <span className="text-[10px] sm:text-xs text-stone-500 mt-1 block truncate">
            Costo: ${totalStockValuationCost.toLocaleString('es-AR')}
          </span>
        </div>

        {/* Alerta de Quiebre */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-500">En Riesgo</span>
            <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-rose-700 font-display truncate">
            {criticalItems.length} prod.
          </div>
          <span className="text-[10px] sm:text-xs text-rose-800 font-semibold mt-1 block truncate">
            &lt; 7-12 días stock
          </span>
        </div>

      </div>

      {/* 🚨 Alerta de Quiebre de Stock cruzada con Demanda del Radar */}
      {stockBottlenecks.length > 0 && (
        <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border-2 border-rose-300 rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200">
                    Alerta de Quiebre Cruzada con Radar
                  </span>
                  <span className="text-xs text-stone-500 font-bold">
                    {stockBottlenecks.length} producto{stockBottlenecks.length > 1 ? 's' : ''} en riesgo
                  </span>
                </div>
                <h4 className="text-base sm:text-lg font-black text-stone-900 mt-1">
                  Demanda inminente de clientes supera el stock físico disponible
                </h4>
                <p className="text-xs text-stone-600 mt-0.5">
                  Hay clientes en el Radar de Recompra que se quedaron o están por quedarse sin yerba y buscan productos con stock insuficiente en depósito:
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {stockBottlenecks.map((b, idx) => (
                    <div key={idx} className="inline-flex items-center space-x-2 bg-white border border-rose-200 text-stone-800 text-xs px-3 py-1.5 rounded-xl shadow-xs">
                      <span className="font-bold text-rose-700">{b.yerbaName}</span>
                      <span className="text-stone-300">|</span>
                      <span className="text-stone-500 font-medium">En Depósito: <strong>{b.stock}</strong></span>
                      <span className="text-stone-300">|</span>
                      <span className="text-rose-600 font-extrabold">Faltan {b.missing} un. ({b.clients} clientes)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="shrink-0 flex items-center">
              <button
                onClick={handleCoverStockBottlenecks}
                className="w-full md:w-auto inline-flex items-center justify-center space-x-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-4 py-3 rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>⚡ Cargar faltantes en "¿Cuánto compraré?"</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Procurement Workstation */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border-2 border-stone-200/90 space-y-6">
        
        {/* Controls Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-stone-100">
          <div>
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-5 h-5 text-[#0f4b25]" />
              <h3 className="text-xl font-black text-stone-900 font-display">
                Planificador Interactivo de Próxima Compra
              </h3>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Modifica las cantidades en la columna <strong>"¿Cuánto compraré?"</strong> para recalcular en tiempo real tu costo total y stock final.
            </p>
          </div>

          {/* Quick Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Target coverage selector */}
            <div className="flex items-center space-x-1.5 bg-stone-100 px-3 py-1.5 rounded-xl text-xs font-bold text-stone-700">
              <span className="text-stone-400 font-medium">Meta:</span>
              <select
                value={targetCoverageDays}
                onChange={(e) => setTargetCoverageDays(parseInt(e.target.value, 10))}
                className="bg-transparent font-extrabold text-[#0f4b25] focus:outline-none cursor-pointer"
              >
                <option value={15}>15 días de stock</option>
                <option value={30}>30 días de stock (Recomendado)</option>
                <option value={45}>45 días de stock</option>
                <option value={60}>60 días de stock</option>
              </select>
            </div>

            {/* Apply Smart Recommendation */}
            <button
              onClick={handleApplySmartRecommendations}
              title="Cargar automáticamente las cantidades recomendadas por el algoritmo"
              className="px-3 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-black flex items-center space-x-1.5 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-700" />
              <span>Cargar Sugerencia Inteligente</span>
            </button>

            {/* Reset to 0 */}
            <button
              onClick={handleResetManualQuantities}
              title="Reiniciar todas las cantidades de '¿Cuánto compraré?' a 0"
              className="p-2 rounded-xl border border-stone-200 text-stone-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all cursor-pointer active:scale-90"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* WhatsApp Order Copy */}
            <button
              onClick={handleCopyOrderWhatsApp}
              className="px-3.5 py-2 rounded-xl bg-[#0f4b25] hover:bg-[#145d2f] text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all active:scale-95"
            >
              {copiedOrder ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>¡Pedido Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#ece7d7]" />
                  <span>Copiar para WhatsApp</span>
                </>
              )}
            </button>

            {/* Export Order Excel */}
            <button
              onClick={handleExportOrderExcel}
              className="px-3 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
              <span>Excel</span>
            </button>

          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="font-bold text-stone-400">Ver:</span>
          <button
            onClick={() => setPurchaseFilter('ALL')}
            className={`px-3 py-1 rounded-xl font-bold transition-all ${
              purchaseFilter === 'ALL' ? 'bg-[#0f4b25] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Todos ({procurementItems.length})
          </button>
          <button
            onClick={() => setPurchaseFilter('ONLY_BUY')}
            className={`px-3 py-1 rounded-xl font-bold transition-all ${
              purchaseFilter === 'ONLY_BUY' ? 'bg-[#0f4b25] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Con Compra / Sugeridos ({procurementItems.filter(i => i.userQty > 0 || i.smartRecommended > 0).length})
          </button>
          <button
            onClick={() => setPurchaseFilter('CRITICAL')}
            className={`px-3 py-1 rounded-xl font-bold transition-all ${
              purchaseFilter === 'CRITICAL' ? 'bg-rose-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Quiebre o Críticos ({procurementItems.filter(i => i.status === 'CRITICAL' || i.status === 'OUT').length})
          </button>
        </div>

        {/* MOBILE PROCUREMENT CARDS (md:hidden): Touch-friendly stepper cards for phone */}
        <div className="md:hidden space-y-2.5">
          {filteredProcurement.map((item) => {
            const isSelected = item.userQty > 0;
            return (
              <div
                key={item.producto}
                className={`p-3.5 rounded-2xl border space-y-2.5 ${
                  isSelected ? 'bg-amber-50/50 border-amber-300' : 'bg-stone-50/70 border-stone-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-black text-stone-900 text-sm truncate">
                      {item.producto}
                    </div>
                    <div className="text-[11px] text-stone-500 flex items-center flex-wrap gap-1.5 mt-0.5">
                      <span className="font-bold text-[#0f4b25]">{item.marca}</span>
                      <span>•</span>
                      <span>Costo: ${item.costoUnitario.toLocaleString('es-AR')}</span>
                      <span>•</span>
                      <span>~{item.velocidadSemanal} u./sem</span>
                    </div>
                  </div>
                  <span className={`font-black text-xs px-2 py-0.5 rounded-lg shrink-0 ${
                    item.restantes === 0 ? 'bg-rose-100 text-rose-800' :
                    item.restantes <= 4 ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-800'
                  }`}>
                    Stock: {item.restantes} u.
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-stone-200">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-stone-400 block">¿Cuánto compraré?</span>
                    {item.smartRecommended > 0 ? (
                      <button
                        onClick={() => handleQuantityChange(item.producto, item.smartRecommended)}
                        className="text-[11px] font-black text-emerald-800 underline cursor-pointer"
                      >
                        Sugerido: +{item.smartRecommended} u.
                      </button>
                    ) : (
                      <span className="text-[10px] text-stone-400">Stock suficiente</span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleStepQuantity(item.producto, -1)}
                      disabled={item.userQty <= 0}
                      className="w-8 h-8 rounded-xl bg-stone-100 border border-stone-300 text-stone-800 font-black disabled:opacity-30 flex items-center justify-center"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={item.userQty}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                        handleQuantityChange(item.producto, isNaN(val) ? 0 : val);
                      }}
                      className="w-14 py-1 text-center rounded-xl border-2 border-amber-400 font-black text-sm text-stone-900 bg-white"
                    />
                    <button
                      onClick={() => handleStepQuantity(item.producto, 1)}
                      className="w-8 h-8 rounded-xl bg-[#0f4b25] text-white font-black flex items-center justify-center"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {item.userQty > 0 && (
                  <div className="flex items-center justify-between text-xs pt-0.5 px-1">
                    <span className="text-stone-600">
                      Quedarán: <strong>{item.totalPostCompra} u.</strong> (~{item.diasCoberturaPostCompra}d)
                    </span>
                    <span className="font-black text-[#e68628]">
                      Total: ${item.costoTotalCompra.toLocaleString('es-AR')}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Interactive Procurement Table (Desktop) */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-stone-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f7f5ed] text-stone-700 font-extrabold uppercase tracking-wider text-[11px] border-b border-stone-200">
              <tr>
                <th className="py-3.5 px-3.5">Producto</th>
                <th className="py-3.5 px-3.5 text-center">Stock Actual</th>
                <th className="py-3.5 px-3.5 text-center bg-emerald-100/60 text-emerald-950">
                  <div className="flex items-center justify-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Recomendación Yerbazo</span>
                  </div>
                </th>
                <th className="py-3.5 px-3.5 text-center bg-amber-100/70 text-amber-950 font-black">
                  ¿Cuánto compraré? (Manual)
                </th>
                <th className="py-3.5 px-3.5 text-center bg-stone-100">
                  ¿Cuántas me quedarán?
                </th>
                <th className="py-3.5 px-3.5 text-right">Costo Unitario</th>
                <th className="py-3.5 px-3.5 text-right font-black text-[#e68628]">
                  ¿Cuánto me saldrá comprar eso?
                </th>
                <th className="py-3.5 px-3.5 text-center">Autonomía Proyectada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredProcurement.map((item) => {
                const isSelected = item.userQty > 0;

                return (
                  <tr 
                    key={item.producto} 
                    className={`transition-colors ${
                      isSelected ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-stone-50'
                    }`}
                  >
                    {/* Producto */}
                    <td className="py-3 px-3.5">
                      <div className="font-extrabold text-stone-900 text-sm">
                        {item.producto}
                      </div>
                      <div className="text-[11px] text-stone-500 flex items-center space-x-2 mt-0.5">
                        <span className="font-semibold text-[#0f4b25]">{item.marca}</span>
                        <span>•</span>
                        <span>Ritmo: ~{item.velocidadSemanal} u./sem</span>
                      </div>
                    </td>

                    {/* Stock Actual */}
                    <td className="py-3 px-3.5 text-center">
                      <span className={`font-black text-sm px-2 py-0.5 rounded-lg ${
                        item.restantes === 0 ? 'bg-rose-100 text-rose-800' :
                        item.restantes <= 4 ? 'bg-amber-100 text-amber-800' : 'text-stone-800'
                      }`}>
                        {item.restantes} u.
                      </span>
                    </td>

                    {/* Cuánto me recomiendas comprar */}
                    <td className="py-3 px-3.5 text-center bg-emerald-50/40">
                      {item.smartRecommended > 0 ? (
                        <button
                          onClick={() => handleQuantityChange(item.producto, item.smartRecommended)}
                          title="Hacer clic para usar esta cantidad recomendada"
                          className="inline-flex items-center space-x-1 font-black text-xs text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-xl transition-all shadow-2xs"
                        >
                          <span>+{item.smartRecommended} u.</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-stone-400">Stock suficiente</span>
                      )}
                    </td>

                    {/* Cuánto compraré (Manual input) */}
                    <td className="py-3 px-3.5 text-center bg-amber-50/50">
                      <div className="inline-flex items-center space-x-1">
                        <button
                          onClick={() => handleStepQuantity(item.producto, -1)}
                          disabled={item.userQty <= 0}
                          className="w-7 h-7 rounded-lg bg-white border border-stone-300 text-stone-700 font-black hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <input
                          type="number"
                          min="0"
                          value={item.userQty}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                            handleQuantityChange(item.producto, isNaN(val) ? 0 : val);
                          }}
                          className="w-16 py-1 px-2 text-center rounded-lg border-2 border-amber-400 font-black text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#e68628] bg-white shadow-inner"
                        />

                        <button
                          onClick={() => handleStepQuantity(item.producto, 1)}
                          className="w-7 h-7 rounded-lg bg-white border border-stone-300 text-stone-700 font-black hover:bg-stone-100 flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Cuántas me quedarán (Stock Post-Compra) */}
                    <td className="py-3 px-3.5 text-center bg-stone-50">
                      <div className="font-black text-sm text-stone-900">
                        {item.totalPostCompra} <span className="font-normal text-stone-400 text-xs">u.</span>
                      </div>
                      {item.userQty > 0 && (
                        <div className="text-[10px] font-bold text-emerald-700">
                          (+{item.userQty} nuevas)
                        </div>
                      )}
                    </td>

                    {/* Costo Unitario */}
                    <td className="py-3 px-3.5 text-right font-medium text-stone-600">
                      ${item.costoUnitario.toLocaleString('es-AR')}
                    </td>

                    {/* Cuánto me saldrá comprar eso (Costo Final) */}
                    <td className="py-3 px-3.5 text-right">
                      <div className="font-black text-sm text-[#e68628]">
                        ${item.costoTotalCompra.toLocaleString('es-AR')}
                      </div>
                      {item.userQty > 0 && (
                        <div className="text-[10px] text-emerald-700 font-semibold">
                          Ganancia: +${item.gananciaProyectadaCompra.toLocaleString('es-AR')}
                        </div>
                      )}
                    </td>

                    {/* Autonomía proyectada */}
                    <td className="py-3 px-3.5 text-center">
                      <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                        item.diasCoberturaPostCompra < 10 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                      }`}>
                        ~{item.diasCoberturaPostCompra} días cubiertos
                      </span>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Purchase Summary Bar */}
        <div className="bg-[#f7f5ed] p-4 sm:p-5 rounded-2xl border-2 border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-black text-sm text-stone-900 uppercase tracking-wider font-display">
              Resumen Total de tu Próxima Orden
            </h4>
            <p className="text-xs text-stone-600">
              Comprarás <strong>{totalUserUnits} unidades</strong> de <strong>{totalItemsToBuyCount} productos</strong> distintos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-right">
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Total a Pagar al Proveedor</span>
              <span className="text-xl sm:text-2xl font-black text-[#e68628] font-display">
                ${totalUserCost.toLocaleString('es-AR')}
              </span>
            </div>

            <div className="border-l border-stone-300 pl-4">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Ganancia Proyectada al Vender</span>
              <span className="text-xl sm:text-2xl font-black text-[#0f4b25] font-display">
                +${totalUserProfit.toLocaleString('es-AR')}
              </span>
            </div>

            <button
              onClick={handleCopyOrderWhatsApp}
              className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl bg-[#0f4b25] hover:bg-[#145d2f] text-white text-xs font-extrabold flex items-center space-x-1.5 shadow-md transition-all active:scale-95"
            >
              {copiedOrder ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#ece7d7]" />
                  <span>Copiar Pedido para WhatsApp</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Mates y Bombillas (Accessories tab) - Formato Tabla interactiva idéntica a "el de arriba" */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm border border-stone-200 space-y-6">
        
        {/* Header & Controls Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-stone-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl">🧉</span>
              <h3 className="text-xl font-black text-stone-900 font-display">
                Mates & Bombillas Artesanales
              </h3>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Inventario físico en vivo integrado con la pestaña <strong>"Stock myb"</strong>: stock disponible, costos y precios de venta.
            </p>
          </div>

          {/* Quick Badges / Summary */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-bold text-stone-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
              Valuación Venta: <strong className="text-[#0f4b25]">${matesStockSaleValuation.toLocaleString('es-AR')}</strong> ({matesStockUnits} u.)
            </div>
            <div className="text-xs font-bold text-stone-600 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200">
              Costo: <strong className="text-stone-800">${matesStockCostValuation.toLocaleString('es-AR')}</strong>
            </div>
            <div className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              Ganancia Proyectada: <strong className="text-emerald-700">+${(matesStockSaleValuation - matesStockCostValuation).toLocaleString('es-AR')}</strong>
            </div>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* Category filter pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-stone-400 mr-1">Filtrar:</span>
            {[
              { id: 'ALL', label: `Todos (${dataset.matesBombillas.length})` },
              { id: 'IN_STOCK', label: `Con Stock (${dataset.matesBombillas.filter(m => (m.restantes !== undefined ? m.restantes : m.cantidad) > 0).length})` },
              { id: 'OUT_OF_STOCK', label: `Sin Stock (${dataset.matesBombillas.filter(m => (m.restantes !== undefined ? m.restantes : m.cantidad) <= 0).length})` },
              { id: 'Mate', label: `Mates (${dataset.matesBombillas.filter(m => m.categoria === 'Mate').length})` },
              { id: 'Bombilla', label: `Bombillas (${dataset.matesBombillas.filter(m => m.categoria === 'Bombilla').length})` },
              { id: 'Canasta', label: `Canastas (${dataset.matesBombillas.filter(m => m.categoria === 'Canasta').length})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setMateCategoryFilter(tab.id as any)}
                className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                  mateCategoryFilter === tab.id
                    ? 'bg-[#0f4b25] text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar mate, bombilla..."
              value={mateSearch}
              onChange={(e) => setMateSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#0f4b25] transition-colors"
            />
          </div>
        </div>

        {/* Mobile View (md:hidden): Touch-friendly cards */}
        <div className="md:hidden space-y-2.5">
          {filteredMates.map((mate) => {
            const restantes = mate.restantes !== undefined ? mate.restantes : mate.cantidad;
            const precioVenta = mate.precioVenta || mate.precioUnidad || 0;
            const precioCompra = mate.precioCompra || 0;
            const ganancia = mate.gananciaUnidad || Math.max(0, precioVenta - precioCompra);
            const isOutOfStock = restantes <= 0;

            return (
              <div
                key={mate.producto}
                className={`p-3.5 rounded-2xl border space-y-2.5 ${
                  isOutOfStock ? 'bg-stone-50/80 border-stone-200 opacity-60' : 'bg-stone-50/70 border-stone-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-black text-stone-900 text-sm truncate">
                      {mate.producto}
                    </div>
                    <div className="text-[11px] text-stone-500 flex items-center flex-wrap gap-1.5 mt-0.5">
                      <span className="font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded text-[10px]">
                        {mate.categoria || 'Artesanal'}
                      </span>
                      <span>•</span>
                      <span>{mate.comprado || 0} comp. / {mate.vendidas || 0} vend.</span>
                    </div>
                  </div>
                  <span className={`font-black text-xs px-2 py-0.5 rounded-lg shrink-0 ${
                    isOutOfStock ? 'bg-stone-200 text-stone-600' : 'bg-emerald-100 text-[#0f4b25]'
                  }`}>
                    {isOutOfStock ? 'Sin stock' : `${restantes} u. rest.`}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] bg-white p-2.5 rounded-xl border border-stone-200">
                  <div>
                    <span className="text-stone-400 block text-[10px]">Precio Venta</span>
                    <span className="font-black text-[#0f4b25] text-xs">${precioVenta.toLocaleString('es-AR')}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Costo</span>
                    <span className="font-bold text-stone-700">${precioCompra.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-stone-400 block text-[10px]">Valuación Stock</span>
                    <span className="font-black text-stone-900">${(restantes * precioVenta).toLocaleString('es-AR')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop View (hidden md:block): TABLA IDÉNTICA A LA SUPERIOR */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-stone-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f7f5ed] text-stone-700 font-extrabold uppercase tracking-wider text-[11px] border-b border-stone-200">
              <tr>
                <th className="py-3.5 px-3.5">Modelo / Producto</th>
                <th className="py-3.5 px-3.5 text-center">Stock Actual</th>
                <th className="py-3.5 px-3.5 text-center bg-stone-100">Comprado / Vendido</th>
                <th className="py-3.5 px-3.5 text-right">Costo Unitario</th>
                <th className="py-3.5 px-3.5 text-right font-black bg-emerald-100/60 text-[#0f4b25]">
                  Precio de Venta
                </th>
                <th className="py-3.5 px-3.5 text-right font-bold text-[#e68628]">
                  Margen por Unidad
                </th>
                <th className="py-3.5 px-3.5 text-right font-black">
                  Valuación en Stock
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredMates.map((mate) => {
                const restantes = mate.restantes !== undefined ? mate.restantes : mate.cantidad;
                const precioVenta = mate.precioVenta || mate.precioUnidad || 0;
                const precioCompra = mate.precioCompra || 0;
                const ganancia = mate.gananciaUnidad || Math.max(0, precioVenta - precioCompra);
                const isOutOfStock = restantes <= 0;
                const valorStock = restantes * precioVenta;

                return (
                  <tr 
                    key={mate.producto} 
                    className={`transition-colors ${
                      isOutOfStock ? 'bg-stone-50/70 opacity-60' : 'hover:bg-[#fbf9f4]'
                    }`}
                  >
                    {/* Modelo / Producto */}
                    <td className="py-3 px-3.5">
                      <div className="font-extrabold text-stone-900 text-sm">
                        {mate.producto}
                      </div>
                      <div className="text-[11px] text-stone-500 flex items-center space-x-2 mt-0.5">
                        <span className="font-semibold text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded text-[10px] uppercase">
                          {mate.categoria || 'Artesanal'}
                        </span>
                        <span>•</span>
                        <span>Línea artesanal Yerbazo</span>
                      </div>
                    </td>

                    {/* Stock Actual */}
                    <td className="py-3 px-3.5 text-center">
                      <span className={`font-black text-xs px-2.5 py-1 rounded-xl inline-flex items-center space-x-1 ${
                        isOutOfStock 
                          ? 'bg-stone-200 text-stone-600' 
                          : restantes <= 1 
                          ? 'bg-amber-100 text-amber-900' 
                          : 'bg-emerald-100 text-[#0f4b25]'
                      }`}>
                        <span>{isOutOfStock ? 'Sin stock' : `${restantes} u.`}</span>
                      </span>
                    </td>

                    {/* Comprado / Vendido */}
                    <td className="py-3 px-3.5 text-center bg-stone-50/50">
                      <div className="font-bold text-stone-800">
                        {mate.comprado || 0} <span className="font-normal text-stone-400">comp.</span>
                      </div>
                      <div className="text-[10px] text-stone-500">
                        {mate.vendidas || 0} vendidas
                      </div>
                    </td>

                    {/* Costo Unitario */}
                    <td className="py-3 px-3.5 text-right font-semibold text-stone-600">
                      ${precioCompra.toLocaleString('es-AR')}
                    </td>

                    {/* Precio de Venta */}
                    <td className="py-3 px-3.5 text-right bg-emerald-50/50 font-black text-sm text-[#0f4b25]">
                      ${precioVenta.toLocaleString('es-AR')}
                    </td>

                    {/* Margen por Unidad */}
                    <td className="py-3 px-3.5 text-right">
                      <div className="font-black text-xs text-[#e68628]">
                        +${ganancia.toLocaleString('es-AR')}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-semibold">
                        {mate.porcentajeGanancia > 0 ? `+${mate.porcentajeGanancia.toFixed(1)}%` : '-'}
                      </div>
                    </td>

                    {/* Valuación en Stock */}
                    <td className="py-3 px-3.5 text-right font-black text-sm text-stone-900">
                      ${valorStock.toLocaleString('es-AR')}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Resumen Total Footer Bar (idéntico a la barra resumen superior) */}
        <div className="bg-[#f7f5ed] p-4 sm:p-5 rounded-2xl border-2 border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-black text-sm text-stone-900 uppercase tracking-wider font-display">
              Resumen Total de Mates & Bombillas en Stock
            </h4>
            <p className="text-xs text-stone-600">
              Total de <strong>{matesStockUnits} unidades físicas</strong> distribuidas en <strong>{dataset.matesBombillas.filter(m => (m.restantes !== undefined ? m.restantes : m.cantidad) > 0).length} modelos</strong> disponibles.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-right">
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Costo Total Invertido</span>
              <span className="text-xl sm:text-2xl font-black text-stone-700 font-display">
                ${matesStockCostValuation.toLocaleString('es-AR')}
              </span>
            </div>

            <div className="border-l border-stone-300 pl-4">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Valuación en Venta</span>
              <span className="text-xl sm:text-2xl font-black text-[#0f4b25] font-display">
                ${matesStockSaleValuation.toLocaleString('es-AR')}
              </span>
            </div>

            <div className="border-l border-stone-300 pl-4">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Ganancia Proyectada</span>
              <span className="text-xl sm:text-2xl font-black text-[#e68628] font-display">
                +${(matesStockSaleValuation - matesStockCostValuation).toLocaleString('es-AR')}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Detailed Stock Inventory Table */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm border border-stone-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div>
            <h3 className="text-base sm:text-xl font-black text-stone-900 font-display">
              Existencias Físicas & Días de Cobertura
            </h3>
            <p className="hidden sm:block text-xs text-stone-500">
              Cálculo de autonomía restante según la velocidad semanal de venta
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar artículo..."
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f4b25]"
              />
            </div>

            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 bg-stone-50 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Estado: Todos</option>
              <option value="CRITICAL">🔴 Crítico (&lt; 7 días)</option>
              <option value="ALERT">🟡 Atención (7-15 días)</option>
              <option value="HEALTHY">🟢 Óptimo (&gt; 15 días)</option>
              <option value="OUT">Agotado (0 u.)</option>
            </select>
          </div>
        </div>

        {/* MOBILE STOCK CARDS (md:hidden) */}
        <div className="md:hidden grid grid-cols-1 gap-2.5">
          {filteredStock.map((item) => (
            <div key={item.id} className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50/70 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="font-black text-stone-900 text-sm truncate">
                  {item.nombre}
                </div>
                <span className={`font-black text-xs px-2 py-0.5 rounded-lg shrink-0 ${
                  item.restantes === 0 ? 'bg-rose-100 text-rose-700' :
                  item.restantes <= 4 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-[#0f4b25]'
                }`}>
                  {item.restantes} u. rest.
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] bg-white p-2 rounded-xl border border-stone-200/80">
                <div>
                  <span className="text-stone-400 block text-[10px]">Costo / Venta</span>
                  <span className="font-bold text-stone-800">${item.precioCompra.toLocaleString('es-AR')}</span>
                  <span className="text-stone-400"> → </span>
                  <span className="font-black text-[#0f4b25]">${item.precioVenta.toLocaleString('es-AR')}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">Vendidas</span>
                  <span className="font-bold text-stone-800">{item.vendidas} / {item.comprado} u.</span>
                </div>
                <div className="text-right">
                  <span className="text-stone-400 block text-[10px]">Autonomía</span>
                  <span className="font-extrabold text-stone-800">
                    {item.status === 'OUT' ? 'Agotado' : `~${item.diasCobertura}d`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto rounded-2xl border border-stone-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f7f5ed] text-stone-700 font-extrabold uppercase tracking-wider text-[11px] border-b border-stone-200">
              <tr>
                <th className="py-3 px-3.5">Producto</th>
                <th className="py-3 px-3.5">Comprado Histórico</th>
                <th className="py-3 px-3.5">Vendido Histórico</th>
                <th className="py-3 px-3.5">Stock Restante</th>
                <th className="py-3 px-3.5">Costo Unitario</th>
                <th className="py-3 px-3.5">Precio Venta</th>
                <th className="py-3 px-3.5">Ritmo Semanal</th>
                <th className="py-3 px-3.5">Autonomía / Cobertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredStock.map((item) => (
                <tr key={item.id} className="hover:bg-stone-50 transition-colors">
                  <td className="py-3 px-3.5 font-bold text-stone-900">
                    {item.nombre}
                  </td>
                  <td className="py-3 px-3.5 text-stone-600 font-medium">
                    {item.comprado} u.
                  </td>
                  <td className="py-3 px-3.5 text-stone-600 font-medium">
                    {item.vendidas} u.
                  </td>
                  <td className="py-3 px-3.5">
                    <span className={`font-black text-sm ${
                      item.restantes === 0 ? 'text-rose-600' :
                      item.restantes <= 4 ? 'text-amber-600' : 'text-[#0f4b25]'
                    }`}>
                      {item.restantes} u.
                    </span>
                  </td>
                  <td className="py-3 px-3.5 text-stone-600 font-medium">
                    ${item.precioCompra.toLocaleString('es-AR')}
                  </td>
                  <td className="py-3 px-3.5 font-extrabold text-[#0f4b25]">
                    ${item.precioVenta.toLocaleString('es-AR')}
                  </td>
                  <td className="py-3 px-3.5 text-stone-700 font-semibold">
                    ~{item.velocidadSemanal} u./sem
                  </td>
                  <td className="py-3 px-3.5">
                    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                      item.status === 'OUT' ? 'bg-stone-200 text-stone-600' :
                      item.status === 'CRITICAL' ? 'bg-rose-100 text-rose-900' :
                      item.status === 'ALERT' ? 'bg-amber-100 text-amber-900' :
                      'bg-emerald-100 text-emerald-900'
                    }`}>
                      {item.status === 'OUT' ? 'Agotado' : `~${item.diasCobertura} días de stock`}
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
