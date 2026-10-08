import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Sparkles, 
  Check, 
  Copy, 
  ExternalLink, 
  AlertCircle, 
  Clock, 
  Flame, 
  Heart, 
  Share2, 
  Filter, 
  RotateCcw, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  MessageCircle, 
  Calendar, 
  Package, 
  TrendingUp, 
  Tag,
  CheckCircle2,
  X,
  AlertTriangle,
  Award,
  Zap,
  ShoppingBag
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { YerbazoDataset, CatalogProduct, WebStoreData, ClienteRecompra } from '../types';
import { analyzeRepurchaseRadar } from '../utils/repurchaseEngine';

interface RepurchaseRadarProps {
  dataset: YerbazoDataset;
  catalog: CatalogProduct[];
  webStore?: WebStoreData;
}

export type ContactStatus = 'pendiente' | 'contactado' | 'recompro' | 'pospuesto';

export const RepurchaseRadar: React.FC<RepurchaseRadarProps> = ({
  dataset,
  catalog,
  webStore
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'sin_yerba' | 'ultimas_cebadas' | 'medio' | 'abastecido'>('todos');
  const [contactFilter, setContactFilter] = useState<'ALL' | ContactStatus>('ALL');
  const [sortField, setSortField] = useState<'prioridad' | 'cliente' | 'porcentaje' | 'dias' | 'favorita'>('prioridad');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Contact Tracking State (saved in localStorage)
  const [contactTracking, setContactTracking] = useState<Record<string, { status: ContactStatus; date: string }>>(() => {
    try {
      const saved = localStorage.getItem('yerbazo_recompra_tracking');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleUpdateContactStatus = (clientName: string, status: ContactStatus) => {
    const next = {
      ...contactTracking,
      [clientName]: {
        status,
        date: new Date().toLocaleDateString('es-AR')
      }
    };
    setContactTracking(next);
    try {
      localStorage.setItem('yerbazo_recompra_tracking', JSON.stringify(next));
    } catch (e) {
      console.warn('Could not save contact tracking', e);
    }

    if (status === 'recompro') {
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
      setFeedbackToast(`¡Genial! Marcada recompra de ${clientName} 🎉`);
    } else if (status === 'contactado') {
      setFeedbackToast(`Marcado como contactado: ${clientName}`);
    }
  };

  // Modal for Custom WhatsApp Offer
  const [selectedClientForOffer, setSelectedClientForOffer] = useState<ClienteRecompra | null>(null);
  const [discountPercent, setDiscountPercent] = useState<number>(10);
  const [copiedClientId, setCopiedClientId] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Compute all clients radar data
  const allRadarClients = useMemo(() => {
    return analyzeRepurchaseRadar(dataset, catalog, webStore);
  }, [dataset, catalog, webStore]);

  // Counts by status and contacts
  const counts = useMemo(() => {
    let sinYerba = 0;
    let ultimas = 0;
    let medio = 0;
    let abastecido = 0;
    let potentialKg = 0;
    const favYerbaCounts: Record<string, number> = {};

    let contactados = 0;
    let recompras = 0;
    let pospuestos = 0;
    let pendientes = 0;

    for (const c of allRadarClients) {
      if (c.estadoConsumo === 'sin_yerba') {
        sinYerba++;
        potentialKg += c.kgCompradosUltima || 1;
      } else if (c.estadoConsumo === 'ultimas_cebadas') {
        ultimas++;
        potentialKg += c.kgCompradosUltima || 1;
      } else if (c.estadoConsumo === 'medio') {
        medio++;
      } else {
        abastecido++;
      }

      favYerbaCounts[c.yerbaFavorita] = (favYerbaCounts[c.yerbaFavorita] || 0) + 1;

      const st = contactTracking[c.cliente]?.status || 'pendiente';
      if (st === 'contactado') contactados++;
      else if (st === 'recompro') recompras++;
      else if (st === 'pospuesto') pospuestos++;
      else pendientes++;
    }

    const topFavYerba = Object.entries(favYerbaCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Canarias tradicional 1KG';
    const conversionRate = (contactados + recompras) > 0 ? Math.round((recompras / (contactados + recompras)) * 100) : 0;

    return {
      total: allRadarClients.length,
      sinYerba,
      ultimas,
      medio,
      abastecido,
      potentialKg: Math.round(potentialKg),
      topFavYerba,
      contactados,
      recompras,
      pospuestos,
      pendientes,
      conversionRate
    };
  }, [allRadarClients, contactTracking]);

  // Imminent Stock Bottleneck / Alerta de Quiebre de Stock
  const stockAlerts = useMemo(() => {
    const demandMap: Record<string, { yerbaName: string; unitsNeeded: number; clientCount: number }> = {};

    for (const c of allRadarClients) {
      if (c.estadoConsumo === 'sin_yerba' || c.estadoConsumo === 'ultimas_cebadas') {
        const yerba = c.yerbaFavorita;
        if (!demandMap[yerba]) {
          demandMap[yerba] = { yerbaName: yerba, unitsNeeded: 0, clientCount: 0 };
        }
        demandMap[yerba].clientCount++;
        demandMap[yerba].unitsNeeded += Math.max(1, Math.round(c.kgCompradosUltima || 1));
      }
    }

    const alerts: { yerbaName: string; demand: number; stock: number; missing: number; clients: number }[] = [];

    for (const [yerba, d] of Object.entries(demandMap)) {
      const matchCat = catalog.find(p => p.nombre.toLowerCase().includes(yerba.toLowerCase()) || yerba.toLowerCase().includes(p.nombre.toLowerCase()));
      const currentStock = matchCat ? matchCat.restantes : 0;
      if (currentStock < d.unitsNeeded) {
        alerts.push({
          yerbaName: yerba,
          demand: d.unitsNeeded,
          stock: currentStock,
          missing: d.unitsNeeded - currentStock,
          clients: d.clientCount
        });
      }
    }

    return alerts.sort((a, b) => b.missing - a.missing);
  }, [allRadarClients, catalog]);

  // Filtered & Sorted Clients
  const displayedClients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = allRadarClients.filter(c => {
      const matchSearch = 
        c.cliente.toLowerCase().includes(q) ||
        c.yerbaFavorita.toLowerCase().includes(q) ||
        c.canal.toLowerCase().includes(q) ||
        c.direccion.toLowerCase().includes(q);

      const matchStatus = statusFilter === 'todos' || c.estadoConsumo === statusFilter;
      
      const st = contactTracking[c.cliente]?.status || 'pendiente';
      const matchContact = contactFilter === 'ALL' || st === contactFilter;

      return matchSearch && matchStatus && matchContact;
    });

    if (sortField === 'prioridad') {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'cliente') {
        cmp = a.cliente.localeCompare(b.cliente, 'es', { sensitivity: 'base' });
      } else if (sortField === 'porcentaje') {
        cmp = a.porcentajeRestante - b.porcentajeRestante;
      } else if (sortField === 'dias') {
        cmp = a.diasDesdeUltimaCompra - b.diasDesdeUltimaCompra;
      } else if (sortField === 'favorita') {
        cmp = a.yerbaFavorita.localeCompare(b.yerbaFavorita, 'es', { sensitivity: 'base' });
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [allRadarClients, searchQuery, statusFilter, contactFilter, sortField, sortDirection, contactTracking]);

  // Handle Sort Toggle
  const handleSortToggle = (field: 'prioridad' | 'cliente' | 'porcentaje' | 'dias' | 'favorita') => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection('asc');
    } else {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField('prioridad');
        setSortDirection('asc');
      }
    }
  };

  // Generate Personalized WhatsApp Message Text
  const generateOfferPitch = (client: ClienteRecompra, discount: number) => {
    const discountedPrice = Math.round((client.precioRegularFavorita * (1 - discount / 100)) / 50) * 50;
    const ahorro = client.precioRegularFavorita - discountedPrice;
    const clientFirstName = client.cliente.split(' ')[0] || client.cliente;

    let timeContext = '';
    let yerbaIntro = `Como sabemos que tu favorita de siempre es la *${client.yerbaFavorita}*, queríamos guardarte un paquete con un *descuento especial del ${discount}% OFF*:`;

    if (client.yerbasUltimaCompra?.includes('Mates / Accesorios') || client.yerbasUltimaCompra?.includes('Sin compras de yerba')) {
      timeContext = `Vimos que tenés tu equipo de mate listo y queríamos ofrecerte la compañera ideal para tus cebadas.`;
      yerbaIntro = `Para que disfrutes al máximo tus mates, te preparamos nuestra variedad más recomendada (*${client.yerbaFavorita}*) con un *descuento exclusivo del ${discount}% OFF*:`;
    } else if (client.estadoConsumo === 'sin_yerba') {
      timeContext = `Vimos que ya pasaron unas semanas desde tu última compra y seguro ya te quedaste sin yerba.`;
    } else if (client.estadoConsumo === 'ultimas_cebadas') {
      timeContext = `Calculamos que deben quedarte las últimas cebadas de tu paquete.`;
    } else {
      timeContext = `Esperamos que estés disfrutando tus mates.`;
    }

    return `¡Hola ${clientFirstName}! 👋 ¿Cómo estás? Te escribo de Yerbazo 🌿

${timeContext}

${yerbaIntro}

🧉 *Precio habitual:* $${client.precioRegularFavorita.toLocaleString('es-AR')}
🔥 *Tu precio con descuento:* $${discountedPrice.toLocaleString('es-AR')} (Ahorrás $${ahorro.toLocaleString('es-AR')})

Avisanos si querés que te alcancemos yerba fresca esta semana a tu domicilio o te la dejamos reservada. ¡Que tengas lindo día! 🧉✨`;
  };

  // Copy to clipboard handler
  const handleCopyPitch = (client: ClienteRecompra, discount: number) => {
    const pitch = generateOfferPitch(client, discount);
    navigator.clipboard.writeText(pitch);
    setCopiedClientId(client.cliente);
    setFeedbackToast(`¡Mensaje para ${client.cliente} copiado! Marcado como contactado.`);

    handleUpdateContactStatus(client.cliente, 'contactado');

    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#0f4b25', '#e68628', '#10b981']
    });

    setTimeout(() => {
      setCopiedClientId(null);
      setFeedbackToast(null);
    }, 3000);
  };

  return (
    <div className="space-y-8">
      
      {/* Toast Notification */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0f4b25] text-[#ece7d7] px-5 py-3 rounded-2xl shadow-2xl border-2 border-[#e68628] flex items-center space-x-3 text-xs font-bold animate-bounce">
          <Sparkles className="w-4 h-4 text-[#e68628]" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Strategic Header */}
      <div className="bg-[#0f4b25] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border-b-4 border-[#e68628]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="inline-flex items-center space-x-2 bg-[#e68628] text-stone-900 font-bold text-xs uppercase px-3 py-1 rounded-full shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Motor Predictivo de Fidelización & Recompra</span>
              </div>
              <div className="inline-flex items-center space-x-1.5 bg-white/10 text-[#ece7d7] border border-white/20 text-xs px-3 py-1 rounded-full font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#e68628]" />
                <span>Hoja Oficial Clientes ({counts.total} clientes)</span>
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-[#ece7d7]">
              Radar de Recompra: ¿Quién necesita yerba hoy?
            </h2>
            <p className="text-sm text-[#ece7d7]/80 max-w-3xl mt-1">
              Calcula en tiempo real hace cuánto compró cada cliente y cuánta yerba le queda. Descubre su <strong>yerba favorita</strong> para tentarlo con una oferta justo antes de que compre en otro lado.
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="bg-[#0a341a] p-3 rounded-2xl border border-white/20 text-xs flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
              <div>
                <span className="font-extrabold text-[#ece7d7] block">{counts.sinYerba} Clientes Sin Yerba</span>
                <span className="text-stone-300 text-[11px]">Prioridad de contacto</span>
              </div>
            </div>

            <div className="bg-[#0a341a] p-3 rounded-2xl border border-white/20 text-xs flex items-center space-x-2">
              <Award className="w-4 h-4 text-[#e68628]" />
              <div>
                <span className="font-extrabold text-emerald-400 block">{counts.recompras} Recompras</span>
                <span className="text-stone-300 text-[11px]">{counts.conversionRate}% conversión</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de Quiebre de Stock Inminente (Item 4) */}
      {stockAlerts.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-400 rounded-3xl p-5 text-rose-950 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-bold text-lg shrink-0">
              🚨
            </div>
            <div>
              <h4 className="font-black text-sm font-display text-rose-900 uppercase tracking-wide">
                Alerta de Quiebre Inminente de Stock: Demanda de Recompra Supera Inventario
              </h4>
              <p className="text-xs text-rose-800/90 mt-0.5">
                Hay clientes listos para comprar su yerba favorita hoy, pero tu stock en depósito no alcanza para cubrir la demanda estimada:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {stockAlerts.map(a => (
                  <span key={a.yerbaName} className="inline-flex items-center space-x-1.5 bg-white border border-rose-300 text-rose-950 text-xs px-2.5 py-1 rounded-xl font-bold shadow-2xs">
                    <span>⚠️ {a.yerbaName}:</span>
                    <span className="text-stone-600 font-normal">Demanda {a.demand}u | Stock {a.stock}u</span>
                    <span className="text-rose-700 font-black underline">(Faltan {a.missing}u)</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards: Urgencia y Oportunidad Comercial */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Sin Yerba */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'sin_yerba' ? 'todos' : 'sin_yerba')}
          className={`bg-white rounded-3xl p-5 border-2 transition-all cursor-pointer shadow-sm relative overflow-hidden ${
            statusFilter === 'sin_yerba' ? 'border-rose-600 bg-rose-50/30 ring-2 ring-rose-500/20' : 'border-rose-200 hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="bg-rose-100 text-rose-800 text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              🔴 Sin Yerba (0%)
            </span>
            <span className="text-xs font-bold text-stone-400">Urgencia #1</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-rose-700 font-display">
              {counts.sinYerba}
            </span>
            <span className="text-xs text-stone-500 font-medium">clientes</span>
          </div>
          <p className="text-xs text-stone-600 mt-1.5 leading-snug">
            Ya consumieron todo su paquete. Escríbeles hoy con su yerba favorita antes de que compren en el supermercado.
          </p>
        </div>

        {/* Card 2: Últimas Cebadas */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'ultimas_cebadas' ? 'todos' : 'ultimas_cebadas')}
          className={`bg-white rounded-3xl p-5 border-2 transition-all cursor-pointer shadow-sm relative overflow-hidden ${
            statusFilter === 'ultimas_cebadas' ? 'border-amber-500 bg-amber-50/30 ring-2 ring-amber-500/20' : 'border-amber-200 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="bg-amber-100 text-amber-900 text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              🟠 Últimas Cebadas
            </span>
            <span className="text-xs font-bold text-stone-400">1% a 20%</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-[#e68628] font-display">
              {counts.ultimas}
            </span>
            <span className="text-xs text-stone-500 font-medium">clientes</span>
          </div>
          <p className="text-xs text-stone-600 mt-1.5 leading-snug">
            Les quedan entre 2 y 6 días de yerba. <strong>Momento de oro</strong> para ofrecer reposición y envío programado.
          </p>
        </div>

        {/* Card 3: Seguimiento y Recompras */}
        <div 
          onClick={() => setContactFilter(contactFilter === 'recompro' ? 'ALL' : 'recompro')}
          className={`bg-white rounded-3xl p-5 border transition-all cursor-pointer shadow-sm relative overflow-hidden ${
            contactFilter === 'recompro' ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500/20' : 'border-stone-200 hover:border-stone-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="bg-emerald-100 text-emerald-900 text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center space-x-1">
              <Award className="w-3.5 h-3.5 text-emerald-700" />
              <span>Recompras Logradas</span>
            </span>
            <span className="text-xs font-bold text-emerald-700">{counts.conversionRate}% éxito</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-emerald-700 font-display">
              {counts.recompras}
            </span>
            <span className="text-xs text-stone-500 font-medium">recompras cerradas</span>
          </div>
          <p className="text-xs text-stone-600 mt-1.5 leading-snug">
            {counts.contactados} clientes contactados en seguimiento.
          </p>
        </div>

        {/* Card 4: Yerba Favorita Más Repetida */}
        <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="bg-amber-100 text-amber-900 text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center space-x-1">
              <Flame className="w-3.5 h-3.5 text-[#e68628]" />
              <span>Yerba Más Querida</span>
            </span>
            <span className="text-xs font-bold text-stone-400">Favorita</span>
          </div>
          <div className="text-xl font-black text-stone-900 font-display truncate" title={counts.topFavYerba}>
            {counts.topFavYerba}
          </div>
          <p className="text-xs text-stone-600 mt-1.5 leading-snug">
            La variedad más elegida para recompra en tu base de clientes.
          </p>
        </div>

      </div>

      {/* Radar Main Table & Filters */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200 space-y-6">
        
        {/* Filter and Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-stone-100 p-1.5 rounded-2xl text-xs font-bold">
            <button
              onClick={() => setStatusFilter('todos')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                statusFilter === 'todos' 
                  ? 'bg-white text-stone-900 shadow-xs' 
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Todos ({counts.total})
            </button>

            <button
              onClick={() => setStatusFilter('sin_yerba')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1 ${
                statusFilter === 'sin_yerba' 
                  ? 'bg-rose-600 text-white shadow-xs' 
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>🔴 Sin Yerba ({counts.sinYerba})</span>
            </button>

            <button
              onClick={() => setStatusFilter('ultimas_cebadas')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1 ${
                statusFilter === 'ultimas_cebadas' 
                  ? 'bg-[#e68628] text-white shadow-xs' 
                  : 'text-[#e68628] hover:bg-amber-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#e68628]"></span>
              <span>🟠 Últimas Cebadas ({counts.ultimas})</span>
            </button>

            <button
              onClick={() => setStatusFilter('medio')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1 ${
                statusFilter === 'medio' 
                  ? 'bg-yellow-600 text-white shadow-xs' 
                  : 'text-yellow-700 hover:bg-yellow-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              <span>🟡 Medio ({counts.medio})</span>
            </button>

            <button
              onClick={() => setStatusFilter('abastecido')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1 ${
                statusFilter === 'abastecido' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>🟢 Abastecido ({counts.abastecido})</span>
            </button>
          </div>

          {/* Search Box & Reset Sort */}
          <div className="flex flex-wrap items-center gap-2">
            {sortField !== 'prioridad' && (
              <button
                onClick={() => { setSortField('prioridad'); setSortDirection('asc'); }}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-[#0f4b25] text-xs font-bold transition-all cursor-pointer border border-amber-300"
                title="Volver al orden predeterminado (más urgentes arriba)"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#e68628]" />
                <span>Restablecer orden prioritario</span>
              </button>
            )}

            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar cliente o yerba favorita..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f4b25]"
              />
            </div>
          </div>

        </div>

        {/* Contact Tracking Filter Pills (Item 3) */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 text-xs">
          <span className="font-bold text-stone-500 mr-1 flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-stone-400" />
            <span>Estado de contacto:</span>
          </span>

          <button
            onClick={() => setContactFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              contactFilter === 'ALL' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Todos
          </button>

          <button
            onClick={() => setContactFilter('pendiente')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              contactFilter === 'pendiente' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <span>🟡 Pendientes ({counts.pendientes})</span>
          </button>

          <button
            onClick={() => setContactFilter('contactado')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              contactFilter === 'contactado' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-900 hover:bg-blue-100'
            }`}
          >
            <span>🔵 Contactados ({counts.contactados})</span>
          </button>

          <button
            onClick={() => setContactFilter('recompro')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              contactFilter === 'recompro' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
            }`}
          >
            <span>🟢 Recompró ({counts.recompras})</span>
          </button>
        </div>

        {/* Priority Banner info */}
        <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/70 flex items-center justify-between text-xs text-amber-950">
          <div className="flex items-center space-x-2">
            <span className="text-base">🎯</span>
            <span className="font-medium">
              <strong>Lista ordenada por prioridad de venta:</strong> Arriba de todo aparecen los clientes que ya están <strong>sin yerba (0%)</strong> y con <strong>últimas cebadas</strong>.
            </span>
          </div>
          <span className="text-[11px] text-stone-500 font-bold hidden sm:inline">
            {displayedClients.length} clientes encontrados
          </span>
        </div>

        {/* Radar Table */}
        <div className="overflow-x-auto rounded-2xl border border-stone-200 shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f7f5ed] text-stone-700 font-extrabold uppercase tracking-wider text-[11px] border-b border-stone-200">
              <tr>
                
                {/* Cliente */}
                <th 
                  onClick={() => handleSortToggle('cliente')}
                  className="py-3 px-3.5 cursor-pointer hover:bg-stone-200/50 select-none group/th"
                >
                  <div className="flex items-center space-x-1">
                    <span>Cliente</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400 opacity-40 group-hover/th:opacity-100" />
                  </div>
                </th>

                {/* Última Compra */}
                <th 
                  onClick={() => handleSortToggle('dias')}
                  className="py-3 px-3.5 cursor-pointer hover:bg-stone-200/50 select-none group/th"
                >
                  <div className="flex items-center space-x-1">
                    <span>Última Compra & Fecha</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400 opacity-40 group-hover/th:opacity-100" />
                  </div>
                </th>

                {/* Yerba Restante (%) */}
                <th 
                  onClick={() => handleSortToggle('porcentaje')}
                  className="py-3 px-3.5 cursor-pointer hover:bg-stone-200/50 select-none group/th"
                >
                  <div className="flex items-center space-x-1">
                    <span>Nivel de Yerba Restante</span>
                    <ArrowUpDown className="w-3 h-3 text-stone-400 opacity-40 group-hover/th:opacity-100" />
                  </div>
                </th>

                {/* Cuándo se agota */}
                <th className="py-3 px-3.5 select-none">
                  Agotamiento Estimado
                </th>

                {/* Yerba Favorita & Oferta Tentadora */}
                <th 
                  onClick={() => handleSortToggle('favorita')}
                  className="py-3 px-3.5 cursor-pointer hover:bg-stone-200/50 select-none group/th bg-amber-50/50"
                >
                  <div className="flex items-center space-x-1 text-[#0f4b25]">
                    <span>Yerba Favorita & Oferta</span>
                    <ArrowUpDown className="w-3 h-3 text-[#e68628] opacity-60 group-hover/th:opacity-100" />
                  </div>
                </th>

                {/* Seguimiento de Contacto */}
                <th className="py-3 px-3.5 select-none text-center">
                  Seguimiento
                </th>

                {/* Acción Comercial */}
                <th className="py-3 px-3.5 text-center select-none">
                  Acción Comercial
                </th>

              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-white">
              {displayedClients.map((client) => {
                const isSinYerba = client.estadoConsumo === 'sin_yerba';
                const isUltimas = client.estadoConsumo === 'ultimas_cebadas';
                const isMedio = client.estadoConsumo === 'medio';
                const contactStatus = contactTracking[client.cliente]?.status || 'pendiente';

                return (
                  <tr 
                    key={client.cliente}
                    className={`transition-colors ${
                      isSinYerba 
                        ? 'hover:bg-rose-50/40 bg-rose-50/10' 
                        : isUltimas 
                        ? 'hover:bg-amber-50/40 bg-amber-50/10' 
                        : 'hover:bg-stone-50'
                    }`}
                  >
                    
                    {/* Cliente */}
                    <td className="py-3.5 px-3.5">
                      <div className="font-extrabold text-stone-900 text-sm">
                        {client.cliente}
                      </div>
                      <div className="flex items-center space-x-1.5 mt-0.5 text-[11px] text-stone-500">
                        <span className="bg-stone-100 px-1.5 py-0.2 rounded font-medium text-stone-700">
                          {client.canal}
                        </span>
                        {client.direccion && (
                          <span className="truncate max-w-[140px]" title={client.direccion}>
                            • {client.direccion}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Última Compra */}
                    <td className="py-3.5 px-3.5">
                      <div className="font-bold text-stone-800 text-xs">
                        {client.yerbasUltimaCompra || `${client.kgCompradosUltima}kg Yerba`}
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5 flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-stone-400" />
                        <span>{client.ultimaFecha}</span>
                        <span className="font-semibold text-stone-700">({client.diasDesdeUltimaCompra} días atrás)</span>
                      </div>
                    </td>

                    {/* Nivel de Yerba Restante */}
                    <td className="py-3.5 px-3.5 min-w-[180px]">
                      <div className="flex items-center justify-between mb-1 text-xs">
                        {isSinYerba ? (
                          <span className="inline-flex items-center space-x-1 font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full text-[10px] uppercase">
                            <span>🔴 0% Sin Yerba</span>
                          </span>
                        ) : isUltimas ? (
                          <span className="inline-flex items-center space-x-1 font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full text-[10px] uppercase">
                            <span>🟠 {client.porcentajeRestante}% Últimas u.</span>
                          </span>
                        ) : isMedio ? (
                          <span className="inline-flex items-center space-x-1 font-bold text-yellow-900 bg-yellow-100 px-2 py-0.5 rounded-full text-[10px] uppercase">
                            <span>🟡 {client.porcentajeRestante}% Medio</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px] uppercase">
                            <span>🟢 {client.porcentajeRestante}% Abastecido</span>
                          </span>
                        )}
                        <span className="text-[11px] text-stone-500 font-mono">
                          ~{client.kgRestantes} kg
                        </span>
                      </div>

                      {/* Visual progress bar */}
                      <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden border border-stone-200">
                        <div 
                          style={{ width: `${client.porcentajeRestante}%` }}
                          className={`h-full transition-all duration-300 ${
                            isSinYerba ? 'bg-rose-500' : isUltimas ? 'bg-[#e68628]' : isMedio ? 'bg-yellow-500' : 'bg-emerald-500'
                          }`}
                        ></div>
                      </div>
                    </td>

                    {/* Agotamiento Estimado */}
                    <td className="py-3.5 px-3.5">
                      {isSinYerba ? (
                        <div className="text-xs">
                          <span className="font-extrabold text-rose-700 block">
                            Agotado hace {client.diasAgotado} {client.diasAgotado === 1 ? 'día' : 'días'}
                          </span>
                          <span className="text-[10px] text-stone-400">
                            Est. {client.fechaEstimadaAgotamiento}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs">
                          <span className="font-bold text-stone-900 block">
                            En {client.diasRestantes} días
                          </span>
                          <span className="text-[10px] text-stone-500">
                            Hacia el {client.fechaEstimadaAgotamiento}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Yerba Favorita & Oferta Tentadora */}
                    <td className="py-3.5 px-3.5 bg-amber-50/30">
                      <div className="flex items-center space-x-1.5">
                        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />
                        <span className="font-extrabold text-stone-900 text-xs">
                          {client.yerbaFavorita}
                        </span>
                      </div>
                      
                      <div className="mt-1 flex items-center space-x-2 text-[11px]">
                        <span className="line-through text-stone-400">
                          ${client.precioRegularFavorita.toLocaleString('es-AR')}
                        </span>
                        <span className="font-black text-[#e68628] bg-amber-100/80 px-1.5 py-0.2 rounded">
                          ${client.precioOfertaTentadora.toLocaleString('es-AR')} ({client.descuentoPorcTentador}% OFF)
                        </span>
                      </div>
                    </td>

                    {/* Seguimiento de Contacto (Item 3) */}
                    <td className="py-3.5 px-3.5 text-center">
                      <select
                        value={contactStatus}
                        onChange={(e) => handleUpdateContactStatus(client.cliente, e.target.value as ContactStatus)}
                        className={`text-[11px] font-bold px-2 py-1 rounded-xl border transition-all cursor-pointer outline-none ${
                          contactStatus === 'recompro'
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : contactStatus === 'contactado'
                            ? 'bg-blue-100 text-blue-900 border-blue-300'
                            : contactStatus === 'pospuesto'
                            ? 'bg-stone-100 text-stone-600 border-stone-300'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                      >
                        <option value="pendiente">🟡 Pendiente</option>
                        <option value="contactado">🔵 Contactado</option>
                        <option value="recompro">🟢 Recompró 🎉</option>
                        <option value="pospuesto">⚪ Posponer</option>
                      </select>
                    </td>

                    {/* Acción Comercial */}
                    <td className="py-3.5 px-3.5 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => {
                            setSelectedClientForOffer(client);
                            setDiscountPercent(10);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#0f4b25] hover:bg-[#165a31] text-[#ece7d7] text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer flex items-center space-x-1"
                          title="Personalizar descuento y preparar mensaje de WhatsApp"
                        >
                          <Sparkles className="w-3 h-3 text-[#e68628]" />
                          <span>Oferta</span>
                        </button>

                        <button
                          onClick={() => handleCopyPitch(client, 10)}
                          className="p-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-stone-900 border border-amber-300 transition-all active:scale-95 cursor-pointer"
                          title="Copiar mensaje directo de WhatsApp con 10% OFF"
                        >
                          {copiedClientId === client.cliente ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-stone-700" />
                          )}
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

      {/* Modal: Preparar Oferta Personalizada de Fidelización */}
      {selectedClientForOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-stone-200 relative animate-in fade-in zoom-in-95 duration-150">
            
            <button
              onClick={() => setSelectedClientForOffer(null)}
              className="absolute top-5 right-5 p-1.5 text-stone-400 hover:text-stone-900 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center space-x-2.5 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-[#e68628] flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-black text-stone-900 font-display">
                  Oferta Tentadora: {selectedClientForOffer.cliente}
                </h3>
                <p className="text-xs text-stone-500">
                  Descuento exclusivo en su variedad preferida para asegurar la recompra
                </p>
              </div>
            </div>

            {/* Client Context Pill */}
            <div className="bg-stone-50 rounded-2xl p-4 mb-4 border border-stone-200 text-xs text-stone-700 space-y-1.5">
              <div className="flex justify-between">
                <span>Estado de consumo:</span>
                <strong className={selectedClientForOffer.estadoConsumo === 'sin_yerba' ? 'text-rose-700' : 'text-amber-800'}>
                  {selectedClientForOffer.estadoConsumo === 'sin_yerba' 
                    ? `🔴 Sin Yerba (hace ${selectedClientForOffer.diasAgotado} días)` 
                    : `🟠 Le queda ~${selectedClientForOffer.porcentajeRestante}%`}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Su Yerba Favorita:</span>
                <strong className="text-[#0f4b25] flex items-center space-x-1">
                  <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                  <span>{selectedClientForOffer.yerbaFavorita}</span>
                </strong>
              </div>
            </div>

            {/* Discount Selector */}
            <div className="mb-4">
              <label className="text-xs font-bold text-stone-700 block mb-2">
                Selecciona el Descuento Tentador a Ofrecer:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[10, 15, 20].map((d) => {
                  const price = Math.round((selectedClientForOffer.precioRegularFavorita * (1 - d / 100)) / 50) * 50;
                  return (
                    <button
                      key={d}
                      onClick={() => setDiscountPercent(d)}
                      className={`p-2.5 rounded-2xl text-center border-2 transition-all cursor-pointer ${
                        discountPercent === d
                          ? 'border-[#0f4b25] bg-[#0f4b25] text-white shadow-md'
                          : 'border-stone-200 hover:border-stone-400 text-stone-800 bg-stone-50'
                      }`}
                    >
                      <div className="font-black text-sm">{d}% OFF</div>
                      <div className={`text-[11px] font-mono mt-0.5 ${discountPercent === d ? 'text-[#ece7d7]' : 'text-stone-500'}`}>
                        ${price.toLocaleString('es-AR')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Message Preview */}
            <div className="mb-5">
              <label className="text-xs font-bold text-stone-700 block mb-1.5 flex items-center justify-between">
                <span>Mensaje Personalizado de WhatsApp listo para enviar:</span>
                <span className="text-[10px] text-stone-400 font-normal">Formato compatible con WhatsApp</span>
              </label>
              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 text-xs text-stone-800 font-sans whitespace-pre-wrap leading-relaxed shadow-inner max-h-52 overflow-y-auto">
                {generateOfferPitch(selectedClientForOffer, discountPercent)}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <button
                onClick={() => {
                  handleCopyPitch(selectedClientForOffer, discountPercent);
                  setSelectedClientForOffer(null);
                }}
                className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-[#0f4b25] hover:bg-[#155a30] text-[#ece7d7] font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Copy className="w-4 h-4 text-[#e68628]" />
                <span>Copiar Mensaje al Portapapeles</span>
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(generateOfferPitch(selectedClientForOffer, discountPercent))}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  handleCopyPitch(selectedClientForOffer, discountPercent);
                }}
                className="w-full sm:w-auto py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-md"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Enviar por WhatsApp</span>
              </a>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
