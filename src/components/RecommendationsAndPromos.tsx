import React, { useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  PackagePlus, 
  Sparkles, 
  CheckCircle, 
  Copy, 
  Check, 
  Flame, 
  RefreshCw, 
  Timer, 
  Clock, 
  Shuffle, 
  Filter, 
  Layers, 
  Info,
  Calendar,
  AlertCircle,
  Globe,
  ExternalLink,
  Tag,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { ProductPerformance, ComboOpportunity, CatalogProduct, WebStoreData } from '../types';
import { generateSmartCombos } from '../utils/analyticsEngine';
import { fetchLiveWebStore } from '../services/dataService';

interface RecommendationsAndPromosProps {
  performances: ProductPerformance[];
  combos: ComboOpportunity[];
  catalog?: CatalogProduct[];
  selectedMonth?: string;
  onSync?: () => Promise<void>;
  onSyncWebStore?: () => Promise<WebStoreData>;
  isSyncing?: boolean;
  lastSyncTime?: string | Date | null;
  webStore?: WebStoreData;
}

export const RecommendationsAndPromos: React.FC<RecommendationsAndPromosProps> = ({
  performances,
  combos: initialCombos,
  catalog = [],
  selectedMonth = 'TODOS',
  onSync,
  onSyncWebStore,
  isSyncing = false,
  lastSyncTime,
  webStore
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);
  const [currentWebStore, setCurrentWebStore] = useState<WebStoreData | undefined>(webStore);
  const [seed, setSeed] = useState<number>(0);

  useEffect(() => {
    if (webStore) {
      setCurrentWebStore(webStore);
    }
  }, [webStore]);
  const [selectedFilter, setSelectedFilter] = useState<string>('todos');
  const [customDiscounts, setCustomDiscounts] = useState<Record<string, number>>({});

  // Active coupon detection from web store
  const activeCouponsList = useMemo(() => {
    return (currentWebStore?.coupons || []).filter(c => c && c.active && c.code && c.code !== '__EMPTY__' && c.discount > 0);
  }, [currentWebStore]);

  const activeCoupon = activeCouponsList[0] || null;

  // Coupon discount percentage for margin comparison (defaults to active coupon's discount, or 10%)
  const [simulatedCouponDiscount, setSimulatedCouponDiscount] = useState<number>(() => {
    return activeCoupon ? activeCoupon.discount : 10;
  });

  useEffect(() => {
    if (activeCoupon) {
      setSimulatedCouponDiscount(activeCoupon.discount);
    }
  }, [activeCoupon]);
  
  // Auto-refresh configuration (options: '1d', '7d', '15d', 'pausa')
  const [frequency, setFrequency] = useState<'1d' | '7d' | '15d' | 'pausa'>(() => {
    const saved = localStorage.getItem('yerbazo_promos_freq');
    if (saved === '1d' || saved === '7d' || saved === '15d' || saved === 'pausa') {
      return saved;
    }
    return '7d'; // default weekly
  });

  const [lastUpdatedTime, setLastUpdatedTime] = useState<Date>(() => {
    const savedTime = localStorage.getItem('yerbazo_promos_last_update');
    if (savedTime) {
      const d = new Date(savedTime);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Helper to convert frequency to milliseconds
  const getFrequencyDurationMs = useCallback((freq: '1d' | '7d' | '15d' | 'pausa'): number => {
    if (freq === '1d') return 24 * 60 * 60 * 1000;
    if (freq === '7d') return 7 * 24 * 60 * 60 * 1000;
    if (freq === '15d') return 15 * 24 * 60 * 60 * 1000;
    return 0;
  }, []);

  // Dynamic combos computation according to seed & current month data
  const currentCombos = useMemo(() => {
    return generateSmartCombos(performances, catalog, seed, currentWebStore);
  }, [performances, catalog, seed, currentWebStore]);

  // Segment products based on trends & margins
  const trendingUpProds = performances.filter(
    p => (p.tendencia === 'Fuerte Alza' || p.tendencia === 'Crecimiento') && p.unidadesVendidas > 0
  );

  const decliningProds = performances.filter(
    p => (p.tendencia === 'Fuerte Caída' || p.tendencia === 'Baja Ligera' || p.tendencia === 'Sin Ventas Recientes') && p.stockActual > 0
  );

  const highMarginProds = performances.filter(
    p => p.margenPorc >= 20 && p.unidadesVendidas > 0
  ).sort((a, b) => b.margenPorc - a.margenPorc);

  // Trigger update logic: explicitly re-fetches web store prices, offers and discount coupons
  const handleUpdatePromos = useCallback(async (isManual: boolean = false) => {
    setIsRecalculating(true);
    try {
      // 1. Live refresh web store data from yerbazo.com.ar & Firebase
      let freshWeb: WebStoreData | undefined = currentWebStore;
      if (onSyncWebStore) {
        freshWeb = await onSyncWebStore();
        if (freshWeb) setCurrentWebStore(freshWeb);
      } else {
        const live = await fetchLiveWebStore();
        if (live) {
          freshWeb = live;
          setCurrentWebStore(live);
        }
      }

      // 2. Refresh Google Sheets data
      if (onSync) {
        await onSync();
      }

      setSeed(prev => prev + 1);
      const now = new Date();
      setLastUpdatedTime(now);
      localStorage.setItem('yerbazo_promos_last_update', now.toISOString());
      
      const activeCouponsList = (freshWeb?.coupons || []).filter(c => c && c.active && c.code && c.code !== '__EMPTY__' && c.discount > 0);
      const activeCouponsCount = activeCouponsList.length;
      const onSaleProdsCount = freshWeb?.products?.filter(p => p.isSale || (p.salePrice && p.salePrice < p.price)).length || 0;
      const couponsSummary = activeCouponsCount > 0 
        ? `y cupones: ${activeCouponsList.map(c => c.code).join(', ')}` 
        : '0 cupones activos (precios reales sin códigos)';

      const freqLabel = frequency === '1d' ? '1 día' : frequency === '7d' ? '7 días' : '15 días';
      const msg = isManual 
        ? `¡Promos actualizadas con la web yerbazo.com.ar! (${freshWeb?.products?.length || 23} productos revisados, ${onSaleProdsCount} ofertas activas, ${couponsSummary})` 
        : `Promociones y precios web actualizados automáticamente según ciclo de ${freqLabel}.`;
      setFeedbackToast(msg);

      if (isManual) {
        confetti({
          particleCount: 65,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#0f4b25', '#ece7d7', '#e68628']
        });
      }

      setTimeout(() => setFeedbackToast(null), 5000);
    } catch (err) {
      console.error('Error refreshing promos:', err);
      setFeedbackToast('Hubo un inconveniente al conectar con yerbazo.com.ar.');
      setTimeout(() => setFeedbackToast(null), 4000);
    } finally {
      setIsRecalculating(false);
    }
  }, [onSync, onSyncWebStore, frequency, currentWebStore]);

  // Handle frequency selection
  const handleSelectFrequency = (newFreq: '1d' | '7d' | '15d' | 'pausa') => {
    setFrequency(newFreq);
    localStorage.setItem('yerbazo_promos_freq', newFreq);
    if (newFreq === 'pausa') {
      setFeedbackToast('Actualización automática en pausa (modo manual).');
    } else {
      const label = newFreq === '1d' ? '1 día' : newFreq === '7d' ? '7 días' : '15 días';
      setFeedbackToast(`Frecuencia de actualización configurada a cada ${label}.`);
    }
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // Periodic check if elapsed time exceeds frequency
  useEffect(() => {
    if (frequency === 'pausa') return;
    const durationMs = getFrequencyDurationMs(frequency);
    const elapsed = Date.now() - lastUpdatedTime.getTime();
    if (elapsed >= durationMs) {
      handleUpdatePromos(false);
    }
  }, [frequency, lastUpdatedTime, getFrequencyDurationMs, handleUpdatePromos]);

  // Clock tick to keep countdown refreshed
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      if (frequency !== 'pausa') {
        const durationMs = getFrequencyDurationMs(frequency);
        if (now - lastUpdatedTime.getTime() >= durationMs) {
          handleUpdatePromos(false);
        }
      }
    }, 10000); // Check every 10 seconds
    return () => clearInterval(timer);
  }, [frequency, lastUpdatedTime, getFrequencyDurationMs, handleUpdatePromos]);

  // Calculate next update label
  const nextUpdateText = useMemo(() => {
    if (frequency === 'pausa') return 'Actualización en pausa';
    const durationMs = getFrequencyDurationMs(frequency);
    const nextTarget = new Date(lastUpdatedTime.getTime() + durationMs);
    const diffMs = nextTarget.getTime() - currentTime;

    if (diffMs <= 0) return 'Próxima actualización: en instantes';

    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days >= 1) {
      return `Próxima: en ${days}d ${hours}h (${nextTarget.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })})`;
    } else if (hours >= 1) {
      return `Próxima: en ${hours}h ${minutes}m (a las ${nextTarget.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs)`;
    } else {
      return `Próxima: en ${Math.max(1, minutes)} min`;
    }
  }, [frequency, lastUpdatedTime, currentTime, getFrequencyDurationMs]);

  const handleCopyPitch = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSetDiscount = (comboId: string, discount: number) => {
    setCustomDiscounts(prev => ({ ...prev, [comboId]: discount }));
  };

  // User hard requirement: "si la promocion no genera por lo menos 7% de ganancia, entonces ni siquiera me la muestre"
  const MIN_PROFIT_MARGIN_THRESHOLD = 7.0;

  // Filter combos based on selected strategy AND strict minimum 7% profit margin
  const { filteredCombos, hiddenDueToMarginCount } = useMemo(() => {
    let list = currentCombos;
    if (selectedFilter !== 'todos') {
      list = list.filter(c => c.categoriaEstrategica === selectedFilter);
    }

    let hiddenCount = 0;
    const passing = list.filter(combo => {
      const currentDiscount = customDiscounts[combo.id] ?? combo.descuentoPorc;
      const customPrice = Math.round((combo.precioRegularTotal * (1 - currentDiscount / 100)) / 100) * 100;
      const currentGain = customPrice - combo.costoTotal;
      const currentMargin = customPrice > 0 ? parseFloat(((currentGain / customPrice) * 100).toFixed(1)) : 0;

      const couponRate = simulatedCouponDiscount;
      const priceWithCoupon = couponRate > 0 
        ? Math.round((customPrice * (1 - couponRate / 100)) / 100) * 100 
        : customPrice;
      const gainWithCoupon = priceWithCoupon - combo.costoTotal;
      const marginWithCoupon = priceWithCoupon > 0 ? parseFloat(((gainWithCoupon / priceWithCoupon) * 100).toFixed(1)) : 0;

      // When a web coupon is simulated/active (>0%), check marginWithCoupon for web-compatible combos.
      // For combos that are exclusively direct sales (WhatsApp/local), evaluate their real direct margin!
      const isDirectOnly = !combo.cuponWebSugerido || combo.badge?.includes('Venta Directa');
      const effectiveMargin = (couponRate > 0 && !isDirectOnly) ? marginWithCoupon : currentMargin;

      const isViable = effectiveMargin >= MIN_PROFIT_MARGIN_THRESHOLD;
      if (!isViable) {
        hiddenCount++;
      }
      return isViable;
    });

    return { filteredCombos: passing, hiddenDueToMarginCount: hiddenCount };
  }, [currentCombos, selectedFilter, customDiscounts, simulatedCouponDiscount]);

  // Format time of last update
  const formattedLastUpdated = lastUpdatedTime.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div className="space-y-8">
      
      {/* Strategic Header */}
      <div className="bg-[#0f4b25] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border-b-4 border-[#e68628]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center space-x-2 bg-[#e68628] text-stone-900 font-bold text-xs uppercase px-3 py-1 rounded-full mb-3 shadow-sm">
              <Zap className="w-3.5 h-3.5" />
              <span>Motor Táctico de Promociones Dinámicas</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-[#ece7d7]">
              ¿Cuál promocionar dependiendo de cómo suben o bajan las ventas?
            </h2>
            <p className="text-sm text-[#ece7d7]/80 max-w-3xl mt-1">
              Guía táctica para maximizar la rentabilidad de Yerbazo: qué empujar con combos, cuándo no hacer descuentos y cómo reactivar productos según la rotación del mes.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => handleUpdatePromos(true)}
              disabled={isRecalculating || isSyncing}
              className="px-5 py-3 rounded-2xl bg-[#e68628] hover:bg-[#cf741e] text-stone-950 font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-stone-950 ${isRecalculating || isSyncing ? 'animate-spin' : ''}`} />
              <span>{isRecalculating || isSyncing ? 'Actualizando...' : 'Actualizar Promos Ahora'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid of the 3 Golden Rules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Rule 1: Escalado */}
        <div className="bg-white rounded-3xl p-6 border-2 border-emerald-500/40 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="bg-emerald-100 text-emerald-900 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center">
                <Flame className="w-3.5 h-3.5 mr-1 text-emerald-700" />
                Ventas en Alza
              </span>
              <span className="text-xs font-bold text-stone-400">Paso 1</span>
            </div>
            <h3 className="text-lg font-black text-stone-900 font-display mb-2">
              Productos en Crecimiento
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed mb-4">
              <strong>Regla de oro:</strong> ¡NO bajes el precio! Si la demanda está subiendo, hacer descuento erosiona tu margen innecesariamente.
            </p>
            
            <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/60 text-xs text-emerald-950 space-y-1.5 mb-4">
              <div className="font-bold flex items-center">
                <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Acción Sugerida:
              </div>
              <p>• Protégelos de quiebre de stock.</p>
              <p>• Úsalos como locomotora en combos con accesorios de alto margen.</p>
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1.5">
              Productos en esta condición:
            </span>
            <div className="flex flex-wrap gap-1">
              {trendingUpProds.slice(0, 4).map(p => (
                <span key={p.producto} className="text-[11px] font-bold bg-stone-100 text-stone-800 px-2 py-0.5 rounded-md">
                  {p.nombreOriginal} (+{p.crecimientoMoM}%)
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Rule 2: Reactivación */}
        <div className="bg-white rounded-3xl p-6 border-2 border-amber-500/40 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="bg-amber-100 text-amber-900 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center">
                <TrendingDown className="w-3.5 h-3.5 mr-1 text-amber-700" />
                Ventas en Baja
              </span>
              <span className="text-xs font-bold text-stone-400">Paso 2</span>
            </div>
            <h3 className="text-lg font-black text-stone-900 font-display mb-2">
              Productos Estancados
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed mb-4">
              <strong>Regla de oro:</strong> Capital inmovilizado es dinero que no rinde. Es preferible liquidar al costo + 5% que tener paquetes estacionados en depósito.
            </p>
            
            <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/60 text-xs text-amber-950 space-y-1.5 mb-4">
              <div className="font-bold flex items-center">
                <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-amber-600" /> Acción Sugerida:
              </div>
              <p>• Promoción "2x1" o 2da unidad al 50% de descuento.</p>
              <p>• Regalo de muestra con la compra de un producto estrella.</p>
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1.5">
              Productos para reactivar:
            </span>
            <div className="flex flex-wrap gap-1">
              {decliningProds.slice(0, 4).map(p => (
                <span key={p.producto} className="text-[11px] font-bold bg-amber-50 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200">
                  {p.nombreOriginal} ({p.stockActual} u.)
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Rule 3: Alto Margen */}
        <div className="bg-white rounded-3xl p-6 border-2 border-[#e68628]/40 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="bg-orange-100 text-orange-950 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center">
                <Percent className="w-3.5 h-3.5 mr-1 text-[#e68628]" />
                Margen Alto (&gt;20%)
              </span>
              <span className="text-xs font-bold text-stone-400">Paso 3</span>
            </div>
            <h3 className="text-lg font-black text-stone-900 font-display mb-2">
              Disparadores de Ganancia
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed mb-4">
              <strong>Regla de oro:</strong> Cada unidad vendida de estas referencias genera hasta el triple de ganancia neta líquida que un paquete tradicional.
            </p>
            
            <div className="bg-orange-50/70 p-3.5 rounded-2xl border border-orange-200/60 text-xs text-orange-950 space-y-1.5 mb-4">
              <div className="font-bold flex items-center">
                <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-[#e68628]" /> Acción Sugerida:
              </div>
              <p>• Venta cruzada activa: "¿Te sumo una yerbera o lata por solo $X?".</p>
              <p>• Posiciónalos como "Selección Especial Yerbazo".</p>
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1.5">
              Líderes de rentabilidad:
            </span>
            <div className="flex flex-wrap gap-1">
              {highMarginProds.slice(0, 4).map(p => (
                <span key={p.producto} className="text-[11px] font-bold bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-200">
                  {p.nombreOriginal} ({p.margenPorc.toFixed(0)}%)
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Smart Combos Generator Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200">
        
        {/* Toast Feedback */}
        {feedbackToast && (
          <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 text-[#0f4b25] text-xs font-bold rounded-2xl flex items-center space-x-2 animate-fade-in shadow-2xs">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackToast}</span>
          </div>
        )}

        {/* Section Title & Primary Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-stone-100">
          <div>
            <div className="flex items-center space-x-2">
              <PackagePlus className="w-5 h-5 text-[#e68628]" />
              <h3 className="text-xl font-black text-stone-900 font-display">
                Combos & Bundles Estratégicos Precalculados
              </h3>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Packs diseñados matemáticamente para elevar el ticket promedio protegiendo tu margen de ganancia líquida
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleUpdatePromos(true)}
              disabled={isRecalculating || isSyncing}
              className="px-4 py-2 rounded-xl bg-[#0f4b25] hover:bg-[#165a31] text-[#ece7d7] text-xs font-bold flex items-center space-x-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Sincroniza ventas de Google Sheets y recalcula las mejores combinaciones para este mes"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#e68628] ${isRecalculating || isSyncing ? 'animate-spin' : ''}`} />
              <span>{isRecalculating || isSyncing ? 'Recalculando...' : 'Actualizar Promos'}</span>
            </button>

            <button
              onClick={() => {
                setSeed(s => s + 1);
                confetti({
                  particleCount: 30,
                  spread: 50,
                  origin: { y: 0.6 },
                  colors: ['#e68628', '#0f4b25']
                });
              }}
              className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Genera variantes alternativas con otros productos del catálogo"
            >
              <Shuffle className="w-3.5 h-3.5 text-stone-600" />
              <span>Rotar Variantes</span>
            </button>

            <span className="text-xs font-bold text-[#0f4b25] bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
              Margen Garantizado
            </span>
          </div>
        </div>

        {/* Web Store Sync Banner */}
        <div className="mt-4 p-3.5 rounded-2xl bg-[#0f4b25]/5 border border-[#0f4b25]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2.5 text-stone-800">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
            <Globe className="w-4 h-4 text-[#0f4b25]" />
            <div>
              <span className="font-extrabold text-[#0f4b25]">Tienda Online yerbazo.com.ar sincronizada:</span>
              <span className="text-stone-600 ml-1.5 font-medium">
                {currentWebStore?.products?.length || 23} productos analizados en tiempo real, {(currentWebStore?.products || []).filter(p => p.isSale || (p.salePrice && p.salePrice < p.price)).length} ofertas activas y {(currentWebStore?.coupons || []).filter(c => c.active).length} cupones de descuento vigentes.
              </span>
            </div>
          </div>
          <a
            href="https://yerbazo.com.ar/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 font-bold text-[#0f4b25] hover:text-[#e68628] transition-colors self-start sm:self-auto shrink-0"
          >
            <span>Ver tienda en vivo</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Active Web Coupons & Live Store Offers Interactive Widget */}
        <div className="mt-3 p-4 rounded-3xl bg-gradient-to-r from-amber-50/90 to-orange-50/80 border border-amber-200/90 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-amber-200/50">
            <div className="flex items-center space-x-2">
              <Tag className="w-4 h-4 text-[#e68628]" />
              <span className="font-extrabold text-stone-900 text-xs">
                Precios Online & Códigos de Descuento Activos en yerbazo.com.ar
              </span>
              <span className="bg-[#0f4b25] text-[#ece7d7] font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                Sincronizado
              </span>
            </div>
            <span className="text-[11px] text-stone-500">
              Usa estos cupones para combinarlos con las sugerencias tácticas
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Active Coupons List */}
            <div className="bg-white p-3 rounded-2xl border border-amber-200/70 space-y-2">
              <span className="text-[10px] font-bold uppercase text-stone-400 block tracking-wider">
                Cupones Vigentes en la Web (haz clic para copiar):
              </span>
              <div className="flex flex-wrap gap-2">
                {(currentWebStore?.coupons || []).filter(c => c && c.active && c.code && c.code !== '__EMPTY__' && c.discount > 0).length > 0 ? (
                  (currentWebStore?.coupons || []).filter(c => c && c.active && c.code && c.code !== '__EMPTY__' && c.discount > 0).map(cp => (
                    <button
                      key={cp.id}
                      onClick={() => {
                        navigator.clipboard.writeText(cp.code);
                        setCopiedCoupon(cp.code);
                        setTimeout(() => setCopiedCoupon(null), 2500);
                      }}
                      className="flex items-center space-x-2 bg-amber-100 hover:bg-amber-200 text-stone-900 px-3 py-1.5 rounded-xl border border-amber-300 font-mono font-black transition-all cursor-pointer group/cp active:scale-95 shadow-2xs"
                      title={`Copiar cupón ${cp.code} (${cp.discount}% OFF)`}
                    >
                      <span>{cp.code}</span>
                      <span className="bg-[#0f4b25] text-white text-[10px] px-1.5 py-0.2 rounded font-sans font-extrabold">
                        {cp.discount}% OFF
                      </span>
                      {copiedCoupon === cp.code ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-stone-500 group-hover/cp:text-stone-900" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="flex items-center space-x-2 text-stone-500 py-1 text-xs">
                    <span className="w-2 h-2 rounded-full bg-stone-300 shrink-0"></span>
                    <span>No hay cupones de descuento activos en la tienda online yerbazo.com.ar actualmente.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Products currently on sale on yerbazo.com.ar */}
            <div className="bg-white p-3 rounded-2xl border border-amber-200/70 space-y-2">
              <span className="text-[10px] font-bold uppercase text-stone-400 block tracking-wider">
                Productos con Rebaja Activa en la Tienda Online:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(currentWebStore?.products || [])
                  .filter(p => p.isSale || (p.salePrice && p.salePrice < p.price))
                  .slice(0, 5)
                  .map(p => (
                    <span 
                      key={p.id}
                      className="inline-flex items-center space-x-1.5 bg-stone-50 text-stone-800 px-2.5 py-1 rounded-xl border border-stone-200 text-[11px]"
                    >
                      <span className="font-bold text-stone-900">{p.title}:</span>
                      <span className="line-through text-stone-400 text-[10px]">${p.price?.toLocaleString('es-AR')}</span>
                      <span className="font-black text-[#e68628]">${p.salePrice?.toLocaleString('es-AR')}</span>
                      {p.stockStatus === 'ultimas' && (
                        <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1 py-0.2 rounded">
                          Últimas u.
                        </span>
                      )}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {/* Interactive Coupon Rate for Margin Comparison */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-amber-200/60 bg-amber-50/70 p-3 rounded-2xl">
            <div className="flex items-center space-x-2 text-xs">
              <span className="font-extrabold text-stone-800">🏷️ Cupón Web a Comparar en los Márgenes:</span>
              <span className="text-stone-500 text-[11px]">
                {activeCoupon ? `Detectado en yerbazo.com.ar: ${activeCoupon.code} (${activeCoupon.discount}% OFF)` : 'Simulando cupón web'}
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              {[
                { rate: activeCoupon?.discount || 10, label: activeCoupon ? `${activeCoupon.code} (${activeCoupon.discount}% Activo)` : '10% Activo' },
                { rate: 15, label: '15% OFF' },
                { rate: 20, label: '20% OFF' },
                { rate: 0, label: '0% (Sin Cupón)' }
              ].map(opt => (
                <button
                  key={opt.rate}
                  onClick={() => setSimulatedCouponDiscount(opt.rate)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    simulatedCouponDiscount === opt.rate
                      ? 'bg-[#0f4b25] text-[#ece7d7] font-black shadow-2xs'
                      : 'bg-white hover:bg-stone-100 text-stone-700 border border-amber-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Live Auto-Refresh & Frequency Control Bar */}
        <div className="mt-3 p-4 rounded-2xl bg-[#fcfbf7] border border-stone-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 text-stone-700 font-semibold">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${frequency !== 'pausa' ? 'bg-emerald-400' : 'bg-stone-300'}`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${frequency !== 'pausa' ? 'bg-emerald-600' : 'bg-stone-400'}`}></span>
              </span>
              <span>
                {frequency !== 'pausa' 
                  ? `Sincronización periódica activa (cada ${frequency === '1d' ? '1 día' : frequency === '7d' ? '7 días' : '15 días'})`
                  : 'Sincronización periódica en pausa'}
              </span>
            </div>

            {frequency !== 'pausa' && (
              <span className="inline-flex items-center space-x-1 bg-white px-2.5 py-1 rounded-lg border border-stone-200 text-stone-600 font-mono text-[11px]">
                <Timer className="w-3 h-3 text-[#e68628]" />
                <span>{nextUpdateText}</span>
              </span>
            )}

            <span className="text-stone-400 text-[11px] flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>Último análisis: {formattedLastUpdated} hs</span>
            </span>
          </div>

          {/* Interval Selector with 1 dia, 7 dias, 15 dias, pausa */}
          <div className="flex items-center space-x-1.5 self-start md:self-auto">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mr-1">
              Frecuencia:
            </span>
            {[
              { val: '1d', label: '1 día', title: 'Actualización diaria según ritmo del mes' },
              { val: '7d', label: '7 días', title: 'Actualización semanal según ritmo del mes' },
              { val: '15d', label: '15 días', title: 'Actualización quincenal según ritmo del mes' },
              { val: 'pausa', label: 'Pausar', title: 'Solo actualización manual con el botón' }
            ].map(opt => (
              <button
                key={opt.val}
                onClick={() => handleSelectFrequency(opt.val as any)}
                title={opt.title}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  frequency === opt.val
                    ? 'bg-[#0f4b25] text-[#ece7d7] shadow-2xs font-black'
                    : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

        </div>

        {/* Rentabilidad Mínima 7% Guardrail Banner */}
        <div className="mt-4 p-3.5 bg-emerald-50/90 border border-emerald-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center space-x-2.5 text-xs text-emerald-950 font-bold">
            <div className="w-7 h-7 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-emerald-100" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span>Filtro de Rentabilidad Mínima: ≥ 7% de Ganancia</span>
                <span className="bg-[#0f4b25] text-[#ece7d7] text-[10px] uppercase font-black px-2 py-0.2 rounded-md">
                  Activo
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                Cualquier combo que genere menos del 7% de margen neto {simulatedCouponDiscount > 0 ? `(considerando el cupón web del ${simulatedCouponDiscount}%)` : '(en venta directa)'} se oculta automáticamente para proteger tu caja.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
            {hiddenDueToMarginCount > 0 ? (
              <span className="text-[11px] text-amber-900 bg-amber-100/90 border border-amber-300/80 font-bold px-2.5 py-1 rounded-xl">
                🛡️ {hiddenDueToMarginCount} {hiddenDueToMarginCount === 1 ? 'combo ocultado por margen < 7%' : 'combos ocultados por margen < 7%'}
              </span>
            ) : (
              <span className="text-[11px] text-emerald-800 bg-emerald-100/80 font-bold px-2.5 py-1 rounded-xl">
                ✨ Todos los combos visibles superan el 7% de margen
              </span>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 mt-5">
          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mr-1 flex items-center">
            <Filter className="w-3 h-3 mr-1" />
            Estrategia:
          </span>
          {[
            { id: 'todos', label: `Todos (${filteredCombos.length})` },
            { id: 'ofertas_web', label: '🔥 Ofertas Web Oficiales' },
            { id: 'estrellas', label: '⭐ Estrellas + Accesorios' },
            { id: 'duos', label: '🍃 Dúos de Yerbas' },
            { id: 'liquidacion', label: '⚡ Liquidación Stock Inmovilizado' },
            { id: 'kits', label: '🎁 Kits Completos' },
            { id: 'fidelizacion', label: '👥 Packs Fidelización (2x)' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setSelectedFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                selectedFilter === f.id
                  ? 'bg-[#0f4b25] text-[#ece7d7] shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Combos Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {filteredCombos.length === 0 && (
            <div className="col-span-full bg-[#fcfbf7] rounded-3xl p-8 text-center border-2 border-dashed border-stone-200 my-4">
              <ShieldAlert className="w-10 h-10 text-[#e68628] mx-auto mb-3" />
              <h4 className="text-base font-black text-stone-900 font-display">
                Sin promociones disponibles en esta sección con margen ≥ 7%
              </h4>
              <p className="text-xs text-stone-500 max-w-md mx-auto mt-1 leading-relaxed">
                {simulatedCouponDiscount > 0 
                  ? `Las opciones de esta categoría con el cupón web del ${simulatedCouponDiscount}% dejaban menos del 7% de ganancia. Podés seleccionar '0% (Sin Cupón)' arriba para verlas en venta directa/WhatsApp donde sí superan el 7%.` 
                  : 'Ningún combo en este filtro cumple con el 7% de ganancia mínima requerida.'}
              </p>
            </div>
          )}
          {filteredCombos.map((combo) => {
            const currentDiscount = customDiscounts[combo.id] ?? combo.descuentoPorc;
            const customPrice = Math.round((combo.precioRegularTotal * (1 - currentDiscount / 100)) / 100) * 100;
            const currentGain = customPrice - combo.costoTotal;
            const currentMargin = customPrice > 0 ? parseFloat(((currentGain / customPrice) * 100).toFixed(1)) : 0;

            // Calculations WITH coupon applied in web checkout
            const couponRate = simulatedCouponDiscount;
            const priceWithCoupon = couponRate > 0 
              ? Math.round((customPrice * (1 - couponRate / 100)) / 100) * 100 
              : customPrice;
            const gainWithCoupon = priceWithCoupon - combo.costoTotal;
            const marginWithCoupon = priceWithCoupon > 0 ? parseFloat(((gainWithCoupon / priceWithCoupon) * 100).toFixed(1)) : 0;

            const savingsAmount = combo.precioRegularTotal - customPrice;
            const itemsText = combo.itemsDesglose && combo.itemsDesglose.length > 0
              ? combo.itemsDesglose.map(it => `• ${it.nombre} ($${it.precioRegular.toLocaleString('es-AR')})`).join('\n')
              : `• ${combo.productoPrincipal}\n• ${combo.productoSecundario}${combo.productoTerciario ? `\n• ${combo.productoTerciario}` : ''}`;
            const webLinkText = activeCoupon 
              ? `\n🏷️ ¡Comprando en yerbazo.com.ar podés sumar el cupón "${activeCoupon.code}" para un ${activeCoupon.discount}% OFF adicional!\n🛒 Web: https://yerbazo.com.ar/` 
              : '\n🛒 Hacé tu pedido directo en: https://yerbazo.com.ar/';
            const pitch = `🌿 ¡PROMO ESPECIAL EN YERBAZO! 🌿\nLlevate el ${combo.titulo} a un precio imperdible:\n🔥 Precio regular por separado: $${combo.precioRegularTotal.toLocaleString('es-AR')}\n${itemsText}\n✨ Precio Promo: $${customPrice.toLocaleString('es-AR')} (${currentDiscount}% OFF)\n💰 ¡Ahorrás $${savingsAmount.toLocaleString('es-AR')}!${webLinkText}\n¡Escribinos por privado o hacé tu pedido online!`;

            return (
              <div 
                key={combo.id}
                className="bg-[#fcfbf7] rounded-3xl p-6 border-2 border-stone-200/90 hover:border-[#0f4b25] transition-all shadow-sm flex flex-col justify-between group"
              >
                <div>
                  
                  {/* Badge & Category */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-[#0f4b25] text-[#ece7d7] px-2.5 py-1 rounded-lg">
                      {combo.tipo}
                    </span>
                    <span className="text-xs font-extrabold text-[#e68628] bg-orange-100/70 px-2 py-0.5 rounded-md">
                      {currentDiscount}% OFF
                    </span>
                  </div>

                  {/* Web Product Images Preview */}
                  {(combo.imagenPrincipal || combo.imagenSecundaria) && (
                    <div className="flex items-center justify-center space-x-3 mb-3 bg-white p-2.5 rounded-2xl border border-stone-200/80 shadow-2xs">
                      {combo.imagenPrincipal && (
                        <div className="flex flex-col items-center">
                          <img 
                            src={combo.imagenPrincipal} 
                            alt={combo.productoPrincipal} 
                            className="w-14 h-14 object-contain rounded-xl bg-stone-50 border border-stone-100 p-1"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                          <span className="text-[9px] font-semibold text-stone-500 mt-1 max-w-[95px] truncate text-center">
                            {combo.productoPrincipal}
                          </span>
                        </div>
                      )}
                      {combo.imagenSecundaria && (
                        <>
                          <span className="text-stone-400 font-bold text-base">+</span>
                          <div className="flex flex-col items-center">
                            <img 
                              src={combo.imagenSecundaria} 
                              alt={combo.productoSecundario} 
                              className="w-14 h-14 object-contain rounded-xl bg-stone-50 border border-stone-100 p-1"
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                            <span className="text-[9px] font-semibold text-stone-500 mt-1 max-w-[95px] truncate text-center">
                              {combo.productoSecundario}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <h4 className="text-base font-black text-stone-900 font-display mb-1 group-hover:text-[#0f4b25] transition-colors">
                    {combo.titulo}
                  </h4>
                  
                  {combo.badge && (
                    <span className="inline-block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2">
                      🎯 {combo.badge}
                    </span>
                  )}

                  {/* Web Coupon Tag */}
                  {activeCoupon && (
                    <div className="flex items-center justify-between bg-amber-50/90 border border-amber-200/80 rounded-xl px-2.5 py-1.5 mb-3 text-xs">
                      <div className="flex items-center space-x-1.5 text-amber-950 font-medium">
                        <Tag className="w-3.5 h-3.5 text-[#e68628] shrink-0" />
                        <span className="text-[10px]">Cupón Web Disponible:</span>
                        <span className="font-mono font-bold bg-amber-200/90 px-1.5 py-0.5 rounded text-stone-900 text-[11px]">
                          {activeCoupon.code} (-{activeCoupon.discount}%)
                        </span>
                      </div>
                      <a 
                        href="https://yerbazo.com.ar/" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[10px] font-bold text-[#0f4b25] hover:text-[#e68628] flex items-center space-x-0.5"
                      >
                        <span>yerbazo.com.ar</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}

                  <p className="text-xs text-stone-600 mb-4">
                    {combo.descripcion}
                  </p>

                  {/* Why recommended for this month */}
                  {combo.motivoSugerencia && (
                    <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl p-2.5 mb-4 text-[11px] text-amber-950 flex items-start space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#e68628] shrink-0 mt-0.5" />
                      <span><strong>Momento del mes:</strong> {combo.motivoSugerencia}</span>
                    </div>
                  )}

                  {/* Price comparison card */}
                  <div className="bg-white rounded-2xl p-4 border border-stone-200/80 mb-4 shadow-2xs space-y-3">
                    
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-stone-600 font-bold">
                        <span>Suma regular por separado:</span>
                        <span className="line-through font-black text-stone-800">${combo.precioRegularTotal.toLocaleString('es-AR')}</span>
                      </div>
                      {combo.itemsDesglose && combo.itemsDesglose.length > 0 && (
                        <div className="bg-stone-50 p-2 rounded-xl text-[11px] text-stone-600 space-y-0.5 border border-stone-200/60 font-sans">
                          {combo.itemsDesglose.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span className="truncate max-w-[200px] text-stone-500">• {it.nombre}</span>
                              <span className="font-semibold text-stone-700 font-mono">${it.precioRegular.toLocaleString('es-AR')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-stone-100 pt-2">
                      <div>
                        <span className="text-xs font-extrabold text-stone-900 block">Precio Promoción Combo:</span>
                        <span className="text-[10px] text-stone-500 font-medium">Descuento base del combo ({currentDiscount}% OFF)</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-[#0f4b25] font-display">
                          ${customPrice.toLocaleString('es-AR')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-500 bg-stone-50 px-2.5 py-1.5 rounded-xl border border-stone-200/60">
                      <span>Costo total mercadería:</span>
                      <span className="font-bold text-stone-700">${combo.costoTotal.toLocaleString('es-AR')}</span>
                    </div>

                    {/* COMPARATIVA DUAL DE MÁRGENES: SIN CUPÓN VS CON CUPÓN */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      
                      {/* Sin Cupón */}
                      <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-2.5 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900">
                              Sin Cupón
                            </span>
                            <span className="text-[9px] bg-emerald-200/80 text-emerald-900 font-bold px-1.5 py-0.2 rounded">
                              Directo / WA
                            </span>
                          </div>
                          <div className="text-sm font-black text-stone-900">
                            ${customPrice.toLocaleString('es-AR')}
                          </div>
                          <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                            Ganancia: <strong className="text-emerald-700">+${currentGain.toLocaleString('es-AR')}</strong>
                          </span>
                        </div>
                        <div className="mt-2 pt-1.5 border-t border-emerald-200/70 flex items-center justify-between text-[11px] font-bold text-emerald-900">
                          <span>Margen neto:</span>
                          <span className="font-black text-xs text-emerald-700">{currentMargin}%</span>
                        </div>
                      </div>

                      {/* Con Cupón */}
                      <div className={`border rounded-xl p-2.5 flex flex-col justify-between ${
                        marginWithCoupon >= 18 
                          ? 'bg-amber-50/80 border-amber-200/90 text-amber-950' 
                          : marginWithCoupon >= 10 
                          ? 'bg-orange-50/80 border-orange-200/90 text-orange-950' 
                          : 'bg-rose-50/80 border-rose-200/90 text-rose-950'
                      }`}>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider">
                              Con Cupón Web
                            </span>
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                              marginWithCoupon >= 18 ? 'bg-amber-200/90 text-amber-950' : 'bg-rose-200/90 text-rose-950'
                            }`}>
                              -{couponRate}%
                            </span>
                          </div>
                          <div className="text-sm font-black text-stone-900">
                            ${priceWithCoupon.toLocaleString('es-AR')}
                          </div>
                          <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                            Ganancia: <strong className={marginWithCoupon >= 15 ? 'text-amber-800' : 'text-rose-700'}>+${gainWithCoupon.toLocaleString('es-AR')}</strong>
                          </span>
                        </div>
                        <div className={`mt-2 pt-1.5 border-t flex items-center justify-between text-[11px] font-bold ${
                          marginWithCoupon >= 18 ? 'border-amber-200/70 text-amber-950' : 'border-rose-200/70 text-rose-950'
                        }`}>
                          <span>Margen con cupón:</span>
                          <span className={`font-black text-xs ${marginWithCoupon >= 18 ? 'text-amber-800' : 'text-rose-700'}`}>
                            {marginWithCoupon}%
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* Diagnóstico de Salud del Margen */}
                    <div className={`text-[10px] px-2.5 py-1.5 rounded-xl border flex items-center justify-between ${
                      marginWithCoupon >= 18
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : marginWithCoupon >= 10
                        ? 'bg-amber-50 text-amber-900 border-amber-200'
                        : 'bg-rose-50 text-rose-900 border-rose-200'
                    }`}>
                      <span className="font-semibold">
                        {marginWithCoupon >= 18
                          ? '🟢 Margen seguro aun sumando cupón web'
                          : marginWithCoupon >= 10
                          ? '🟡 Margen ajustado si aplican el cupón web'
                          : '🔴 Cuidado: margen crítico con cupón web'}
                      </span>
                      <span className="font-bold">
                        {activeCoupon ? activeCoupon.code : `-${couponRate}%`}
                      </span>
                    </div>

                    {/* Interactive Discount Selector */}
                    <div className="pt-2 border-t border-stone-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1.5">
                        Ajustar Descuento Base de la Promo:
                      </span>
                      <div className="flex items-center space-x-1">
                        {[5, 8, 10, 12, 15, 20].map(disc => {
                          const testPrice = Math.round((combo.precioRegularTotal * (1 - disc / 100)) / 100) * 100;
                          const testPriceWithCoupon = couponRate > 0 ? Math.round((testPrice * (1 - couponRate / 100)) / 100) * 100 : testPrice;
                          const testGain = (couponRate > 0 ? testPriceWithCoupon : testPrice) - combo.costoTotal;
                          const testEffectiveMargin = (couponRate > 0 ? testPriceWithCoupon : testPrice) > 0 
                            ? parseFloat(((testGain / (couponRate > 0 ? testPriceWithCoupon : testPrice)) * 100).toFixed(1))
                            : 0;
                          const isDiscSafe = testEffectiveMargin >= 7.0;

                          return (
                            <button
                              key={disc}
                              onClick={() => handleSetDiscount(combo.id, disc)}
                              title={isDiscSafe ? `Descuento ${disc}%: deja margen seguro de ${testEffectiveMargin}%` : `Descuento ${disc}% riesgoso: dejaría margen de ${testEffectiveMargin}% (< 7%) y ocultaría el combo`}
                              className={`flex-1 py-1 rounded-md text-[10px] font-black transition-all cursor-pointer ${
                                currentDiscount === disc
                                  ? 'bg-[#0f4b25] text-white shadow-2xs'
                                  : !isDiscSafe
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                              }`}
                            >
                              {disc}%
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>

                  <div className="text-xs text-stone-600 italic bg-stone-100/70 p-3 rounded-xl mb-4">
                    "💡 {combo.razonamiento}"
                  </div>

                </div>

                {/* WhatsApp Pitch Copy Button */}
                <button
                  onClick={() => handleCopyPitch(combo.id, pitch)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0f4b25] hover:bg-[#145d2f] text-white text-xs font-bold flex items-center justify-center space-x-2 transition-colors shadow-sm active:scale-98 cursor-pointer"
                >
                  {copiedId === combo.id ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>¡Mensaje Copiado al Portapapeles!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-[#ece7d7]" />
                      <span>Copiar Texto para WhatsApp / Redes</span>
                    </>
                  )}
                </button>

              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
};
