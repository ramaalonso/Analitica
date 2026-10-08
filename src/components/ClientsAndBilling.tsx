import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  DollarSign, 
  CreditCard, 
  AlertCircle, 
  MapPin, 
  Search, 
  ShieldCheck, 
  Share2, 
  Sparkles,
  Phone,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Award,
  Copy,
  Check,
  ExternalLink,
  X,
  MessageCircle,
  Calendar,
  Send,
  Zap,
  Gift
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Doughnut, Bar } from 'react-chartjs-2';
import '../utils/chartConfig';
import { YerbazoDataset, ClienteRow, SaleTransaction } from '../types';

export type ClientSortField = 
  | 'cliente' 
  | 'comoNosConocio' 
  | 'direccionEntrega' 
  | 'totalCompras' 
  | 'totalGastado' 
  | 'totalGananciaGenerada'
  | 'diasDesdeUltimaCompra';

export type SortDirection = 'asc' | 'desc';

interface ClientsAndBillingProps {
  dataset: YerbazoDataset;
}

export const ClientsAndBilling: React.FC<ClientsAndBillingProps> = ({ dataset }) => {
  const [clientSearch, setClientSearch] = useState('');
  const [onlyDebtors, setOnlyDebtors] = useState(false);
  const [frequencyFilter, setFrequencyFilter] = useState<'ALL' | 'activo' | 'en_riesgo' | 'inactivo'>('ALL');
  const [sortField, setSortField] = useState<ClientSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null);

  // Modals state
  const [debtModalClient, setDebtModalClient] = useState<ClienteRow | null>(null);
  const [loyaltyModalClient, setLoyaltyModalClient] = useState<ClienteRow | null>(null);
  const [mpAlias, setMpAlias] = useState<string>(() => {
    const saved = localStorage.getItem('yerbazo_mp_alias');
    if (!saved || saved === 'yerbazo.mp') return 'yerbazo.ba';
    return saved;
  });
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [copiedPitch, setCopiedPitch] = useState(false);

  useEffect(() => {
    localStorage.setItem('yerbazo_mp_alias', mpAlias);
  }, [mpAlias]);

  // Unpaid sales in Ventas
  const unpaidSales = dataset.ventas.filter(v => {
    const p = (v.pago || '').toUpperCase();
    return p === 'NO' || p.includes('PENDIENTE');
  });

  const totalUnpaidSalesAmount = unpaidSales.reduce((acc, v) => acc + v.precioFinal, 0);

  // Customer Acquisition Channels breakdown
  const channelCount: Record<string, number> = {};
  for (const c of dataset.clientes) {
    const ch = c.comoNosConocio || 'Directo';
    channelCount[ch] = (channelCount[ch] || 0) + 1;
  }

  const sortedChannels = Object.entries(channelCount).sort((a, b) => b[1] - a[1]);

  const channelChartData = {
    labels: sortedChannels.map(c => c[0]),
    datasets: [
      {
        data: sortedChannels.map(c => c[1]),
        backgroundColor: [
          '#0f4b25',
          '#e68628',
          '#186d38',
          '#8fa382',
          '#d4a373',
          '#e9edc9',
          '#4a5759',
          '#c084fc'
        ],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  const channelChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: { boxWidth: 12, font: { size: 11 } }
      }
    }
  };

  // Payment methods breakdown
  const paymentMethods: Record<string, { count: number; total: number }> = {};
  for (const v of dataset.ventas) {
    let m = v.medioPago.trim().toLowerCase();
    if (m.includes('mercadopago') || m.includes('mp')) m = 'Mercado Pago';
    else if (m.includes('efectivo') || m.includes('eft')) m = 'Efectivo';
    else if (m === '-' || m === '-----' || !m) m = 'No especificado';
    else m = 'Canje / Mixto';

    if (!paymentMethods[m]) paymentMethods[m] = { count: 0, total: 0 };
    paymentMethods[m].count += 1;
    paymentMethods[m].total += v.precioFinal;
  }

  // Frequency segments count
  const frequencyCounts = useMemo(() => {
    let activo = 0;
    let en_riesgo = 0;
    let inactivo = 0;
    let deudores = 0;

    for (const c of dataset.clientes) {
      if (c.saldoDeuda > 0) deudores++;
      if (c.segmentoFrecuencia === 'activo') activo++;
      else if (c.segmentoFrecuencia === 'en_riesgo') en_riesgo++;
      else inactivo++;
    }

    return {
      total: dataset.clientes.length,
      activo,
      en_riesgo,
      inactivo,
      deudores
    };
  }, [dataset.clientes]);

  const handleSort = (field: ClientSortField) => {
    const isAlphabetical = field === 'cliente' || field === 'comoNosConocio' || field === 'direccionEntrega';

    if (sortField !== field) {
      setSortField(field);
      setSortDirection(isAlphabetical ? 'asc' : 'desc');
    } else {
      if (isAlphabetical) {
        if (sortDirection === 'asc') {
          setSortDirection('desc');
        } else {
          setSortField(null);
          setSortDirection(null);
        }
      } else {
        if (sortDirection === 'desc') {
          setSortDirection('asc');
        } else {
          setSortField(null);
          setSortDirection(null);
        }
      }
    }
  };

  const handleResetSort = () => {
    setSortField(null);
    setSortDirection(null);
  };

  // Filtered and sorted clients list
  const filteredClients = useMemo(() => {
    const list = dataset.clientes.filter(c => {
      const matchSearch = (c.cliente || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
                          (c.comoNosConocio || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
                          (c.direccionEntrega || '').toLowerCase().includes(clientSearch.toLowerCase());
      const matchDebtors = !onlyDebtors || c.saldoDeuda > 0;
      const matchFreq = frequencyFilter === 'ALL' || c.segmentoFrecuencia === frequencyFilter;
      return matchSearch && matchDebtors && matchFreq;
    });

    if (!sortField || !sortDirection) {
      // Default order: highest totalGastado first (ranking natural de consumo)
      return [...list].sort((a, b) => b.totalGastado - a.totalGastado);
    }

    return [...list].sort((a, b) => {
      if (sortField === 'cliente' || sortField === 'comoNosConocio' || sortField === 'direccionEntrega') {
        const valA = (a[sortField] || '').trim().toLowerCase();
        const valB = (b[sortField] || '').trim().toLowerCase();
        const cmp = valA.localeCompare(valB, 'es', { sensitivity: 'base', numeric: true });
        return sortDirection === 'asc' ? cmp : -cmp;
      } else {
        const valA = Number(a[sortField]) || 0;
        const valB = Number(b[sortField]) || 0;
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
    });
  }, [dataset.clientes, clientSearch, onlyDebtors, frequencyFilter, sortField, sortDirection]);

  const topClients = [...dataset.clientes].sort((a, b) => b.totalGastado - a.totalGastado).slice(0, 5);

  const renderSortHeader = (field: ClientSortField, label: string) => {
    const isActive = sortField === field;
    const isAlphabetical = field === 'cliente' || field === 'comoNosConocio' || field === 'direccionEntrega';

    let badge = null;
    let title = `${label}: Clic para ordenar (${isAlphabetical ? '1 toque: A-Z, 2 toques: Z-A, 3 toques: reiniciar' : '1 toque: mayor a menor, 2 toques: menor a mayor, 3 toques: reiniciar'})`;

    if (isActive) {
      if (isAlphabetical) {
        if (sortDirection === 'asc') {
          badge = (
            <span className="inline-flex items-center space-x-0.5 bg-[#0f4b25] text-[#ece7d7] text-[9px] font-black px-1.5 py-0.5 rounded shadow-2xs font-mono">
              <ArrowUp className="w-3 h-3 text-[#e68628]" />
              <span>A-Z</span>
            </span>
          );
          title = `${label}: Ordenado alfabéticamente A → Z (clic para Z → A)`;
        } else {
          badge = (
            <span className="inline-flex items-center space-x-0.5 bg-[#e68628] text-stone-950 text-[9px] font-black px-1.5 py-0.5 rounded shadow-2xs font-mono">
              <ArrowDown className="w-3 h-3 text-stone-950" />
              <span>Z-A</span>
            </span>
          );
          title = `${label}: Ordenado alfabéticamente Z → A (clic para reiniciar orden)`;
        }
      } else {
        if (sortDirection === 'desc') {
          badge = (
            <span className="inline-flex items-center space-x-0.5 bg-[#0f4b25] text-[#ece7d7] text-[9px] font-black px-1.5 py-0.5 rounded shadow-2xs font-mono">
              <ArrowDown className="w-3 h-3 text-[#e68628]" />
              <span>Mayor</span>
            </span>
          );
          title = `${label}: Más alto primero (clic para menor primero)`;
        } else {
          badge = (
            <span className="inline-flex items-center space-x-0.5 bg-amber-500 text-stone-950 text-[9px] font-black px-1.5 py-0.5 rounded shadow-2xs font-mono">
              <ArrowUp className="w-3 h-3 text-stone-950" />
              <span>Menor</span>
            </span>
          );
          title = `${label}: Más bajo primero (clic para reiniciar orden)`;
        }
      }
    }

    return (
      <th 
        onClick={() => handleSort(field)}
        className="py-3 px-3.5 cursor-pointer hover:bg-stone-200/50 select-none group/th transition-colors"
        title={title}
      >
        <div className="flex items-center space-x-1.5">
          <span>{label}</span>
          {badge || (
            <ArrowUpDown className="w-3 h-3 text-stone-400 opacity-40 group-hover/th:opacity-100 transition-opacity" />
          )}
        </div>
      </th>
    );
  };

  // Helper for generating Debt Reminder Pitch
  const getDebtPitch = (client: ClienteRow) => {
    const firstName = client.cliente.split(' ')[0] || client.cliente;
    const clientUnpaidSales = dataset.ventas.filter(v => {
      const match = v.cliente.toLowerCase().trim() === client.cliente.toLowerCase().trim();
      const p = (v.pago || '').toUpperCase();
      return match && (p === 'NO' || p.includes('PENDIENTE'));
    });

    let itemsDetail = '';
    if (clientUnpaidSales.length > 0) {
      itemsDetail = clientUnpaidSales.map(s => {
        const prodSummary = s.items.map(i => `${i.cantidad}x ${i.producto}`).join(' + ') || 'Pedido de yerba';
        return `• *${s.fecha}* (${prodSummary}): $${s.precioFinal.toLocaleString('es-AR')}`;
      }).join('\n');
    }

    return `¡Hola ${firstName}! 👋 ¿Cómo estás? Te escribo de Yerbazo 🌿

Te paso el resumen del saldo pendiente por tus compras materas:

${itemsDetail || `• Saldo pendiente: $${client.saldoDeuda.toLocaleString('es-AR')}`}

💰 *Total a abonar:* $${client.saldoDeuda.toLocaleString('es-AR')}
💳 *Alias Mercado Pago:* \`${mpAlias}\`

Cualquier duda avisame. ¡Muchas gracias y que disfrutes las cebadas! 🧉✨`;
  };

  // Helper for generating Club Loyalty Reward Pitch
  const getLoyaltyPitch = (client: ClienteRow) => {
    const firstName = client.cliente.split(' ')[0] || client.cliente;
    const tier = client.clubMateroNivel || 'Cebador Inicial';
    const purchases = client.totalCompras;

    let benefitOffer = 'un 15% OFF en tu próxima compra o un accesorio matero de regalo';
    if (purchases >= 10) {
      benefitOffer = 'un descuento VIP exclusivo del 20% OFF + regalo sorpresa en tu pedido';
    } else if (purchases >= 5) {
      benefitOffer = 'un accesorio de regalo (despolvillador o reposa mate) con tu próxima yerba';
    }

    return `¡Hola ${firstName}! 🏆 ¡Felicitaciones de parte de todo el equipo de Yerbazo! 🌿

Vimos que con tu trayectoria ya acumulaste *${purchases} pedidos* con nosotros y alcanzaste el nivel *${tier}* del Club Matero Yerbazo 🧉✨

Como agradecimiento por elegirnos siempre para tus mates, tenés disponible para tu próxima compra:
🎁 *Beneficio exclusivo:* ${benefitOffer}

Avisanos cuando quieras hacer tu próximo pedido y ya te lo dejamos reservado con tu premio. ¡Buenos mates! 🧉`;
  };

  const copyToClipboard = (text: string, clientName: string) => {
    navigator.clipboard.writeText(text);
    confetti({
      particleCount: 35,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#0f4b25', '#e68628', '#10b981']
    });
    setFeedbackToast(`¡Mensaje para ${clientName} copiado!`);
    setCopiedPitch(true);
    setTimeout(() => {
      setFeedbackToast(null);
      setCopiedPitch(false);
    }, 3000);
  };

  return (
    <div className="space-y-8">

      {/* Floating Toast Notification */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0f4b25] text-[#ece7d7] px-5 py-3 rounded-2xl shadow-2xl border-2 border-[#e68628] flex items-center space-x-3 text-xs font-bold animate-bounce">
          <Sparkles className="w-4 h-4 text-[#e68628]" />
          <span>{feedbackToast}</span>
        </div>
      )}
      
      {/* Header Banner */}
      <div className="bg-[#0f4b25] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border-b-4 border-[#e68628]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="inline-flex items-center space-x-2 bg-[#e68628] text-stone-900 font-bold text-xs uppercase px-3 py-1 rounded-full shadow-sm">
                <Users className="w-3.5 h-3.5" />
                <span>Gestión de Clientes & Cobranzas</span>
              </div>
              <div className="inline-flex items-center space-x-1.5 bg-white/10 text-[#ece7d7] border border-white/20 text-xs px-3 py-1 rounded-full font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#e68628]" />
                <span>Base Oficial Hoja Clientes ({dataset.clientes.length} clientes)</span>
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-[#ece7d7]">
              Canales de Captación, Clientes VIP y Control de Cobros
            </h2>
            <p className="text-sm text-[#ece7d7]/80 max-w-3xl mt-1">
              Conoce de dónde provienen tus clientes (UADE, Rugby, Club, amigos), quiénes son los compradores más fieles y gestiona ventas con saldo pendiente de pago.
            </p>
          </div>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Clientes Registrados */}
        <div 
          onClick={() => { setOnlyDebtors(false); setFrequencyFilter('ALL'); }}
          className={`bg-white rounded-3xl p-6 shadow-sm border transition-all cursor-pointer ${
            !onlyDebtors && frequencyFilter === 'ALL' ? 'border-[#0f4b25] ring-2 ring-[#0f4b25]/20' : 'border-stone-200 hover:border-stone-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              Clientes Oficiales
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#0f4b25] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-stone-900 font-display">
            {dataset.clientes.length} clientes
          </div>
          <p className="text-xs text-stone-500 mt-2">
            Base activa sincronizada con la pestaña Clientes
          </p>
        </div>

        {/* Clientes con Deuda Activa */}
        <div 
          onClick={() => setOnlyDebtors(!onlyDebtors)}
          className={`rounded-3xl p-6 shadow-sm border-2 transition-all cursor-pointer ${
            onlyDebtors 
              ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20' 
              : totalUnpaidSalesAmount > 0 
                ? 'bg-amber-50/40 border-amber-300 hover:border-amber-400' 
                : 'bg-white border-stone-200'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              Saldo Pendiente de Cobro
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              ⚠️
            </div>
          </div>
          <div className="text-3xl font-black text-rose-700 font-display">
            ${totalUnpaidSalesAmount.toLocaleString('es-AR')}
          </div>
          <p className="text-xs text-stone-600 mt-2 flex items-center justify-between">
            <span>{unpaidSales.length} ventas sin cobrar</span>
            <span className="font-bold underline text-rose-700">
              {onlyDebtors ? 'Ver todos' : 'Filtrar deudores'}
            </span>
          </p>
        </div>

        {/* Clientes Activos este mes */}
        <div 
          onClick={() => setFrequencyFilter(frequencyFilter === 'activo' ? 'ALL' : 'activo')}
          className={`bg-white rounded-3xl p-6 shadow-sm border transition-all cursor-pointer ${
            frequencyFilter === 'activo' ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500/20' : 'border-stone-200 hover:border-stone-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              🟢 Activos (&lt; 30 días)
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-700 font-display">
            {frequencyCounts.activo} clientes
          </div>
          <p className="text-xs text-stone-500 mt-2">
            Compraron en las últimas 4 semanas
          </p>
        </div>

        {/* Clientes en Riesgo */}
        <div 
          onClick={() => setFrequencyFilter(frequencyFilter === 'en_riesgo' ? 'ALL' : 'en_riesgo')}
          className={`bg-white rounded-3xl p-6 shadow-sm border transition-all cursor-pointer ${
            frequencyFilter === 'en_riesgo' ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20' : 'border-stone-200 hover:border-stone-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              🟡 En Riesgo (30 a 60d)
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-800 font-display">
            {frequencyCounts.en_riesgo} clientes
          </div>
          <p className="text-xs text-stone-500 mt-2">
            Hace más de un mes que no piden yerba
          </p>
        </div>

      </div>

      {/* Two Column Layout: Channels Breakdown & Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Acquisition Channels Breakdown */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-black text-stone-900 font-display">
              ¿De Dónde Llegan tus Clientes? (Canales)
            </h3>
            <MapPin className="w-4 h-4 text-stone-400" />
          </div>
          <p className="text-xs text-stone-500 mb-6">
            Distribución de compradores según origen registrado en la pestaña "Clientes"
          </p>

          <div className="h-64 mb-6">
            <Doughnut data={channelChartData} options={channelChartOptions} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {sortedChannels.slice(0, 6).map((c, i) => (
              <div key={c[0]} className="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-100">
                <span className="font-bold text-stone-700 truncate">{c[0]}</span>
                <span className="font-extrabold text-[#0f4b25] bg-emerald-50 px-2 py-0.5 rounded-md">
                  {c[1]} clientes
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods Breakdown */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-black text-stone-900 font-display">
                Métodos de Pago Más Utilizados
              </h3>
              <CreditCard className="w-4 h-4 text-stone-400" />
            </div>
            <p className="text-xs text-stone-500 mb-4">
              Preferencia de pago y recaudación en dinero por canal
            </p>

            <div className="space-y-3">
              {Object.entries(paymentMethods).map(([method, data]) => {
                const totalAll = dataset.ventas.reduce((acc, v) => acc + v.precioFinal, 0) || 1;
                const sharePorc = (data.total / totalAll) * 100;

                return (
                  <div key={method} className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-extrabold text-sm text-stone-900">{method}</span>
                      <span className="font-black text-sm text-[#0f4b25]">
                        ${data.total.toLocaleString('es-AR')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
                      <span>{data.count} pedidos</span>
                      <span>{sharePorc.toFixed(1)}% del total facturado</span>
                    </div>
                    <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#0f4b25] h-full rounded-full" 
                        style={{ width: `${Math.min(100, sharePorc)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Unpaid Sales Table (Pendientes de Cobro) */}
      {unpaidSales.length > 0 && (
        <div className="bg-amber-50/60 rounded-3xl p-6 sm:p-8 border-2 border-amber-300 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                ⚠️
              </div>
              <div>
                <h3 className="text-lg font-black text-amber-950 font-display">
                  Detalle de Ventas Pendientes de Cobro ({unpaidSales.length} transacciones - ${totalUnpaidSalesAmount.toLocaleString('es-AR')})
                </h3>
                <p className="text-xs text-amber-900/80">
                  Usa el botón de WhatsApp al lado de cada cliente para enviar el recordatorio con alias en 1 clic
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs bg-white px-3 py-1.5 rounded-xl border border-amber-300">
              <span className="text-stone-500 font-bold">Alias MP:</span>
              <input 
                type="text"
                value={mpAlias}
                onChange={(e) => setMpAlias(e.target.value)}
                className="font-mono font-black text-[#0f4b25] bg-transparent outline-none border-b border-[#0f4b25]/40 text-xs w-28"
                title="Configurá tu alias de Mercado Pago para los mensajes de cobranza"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-amber-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-amber-100/60 text-amber-950 font-bold uppercase text-[11px] border-b border-amber-200">
                <tr>
                  <th className="py-3 px-3.5">ID Venta</th>
                  <th className="py-3 px-3.5">Cliente</th>
                  <th className="py-3 px-3.5">Fecha / Mes</th>
                  <th className="py-3 px-3.5">Productos</th>
                  <th className="py-3 px-3.5">Medio Pago</th>
                  <th className="py-3 px-3.5">Monto Adeudado</th>
                  <th className="py-3 px-3.5 text-right">Acción Rápida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {unpaidSales.map(v => {
                  const clientObj = dataset.clientes.find(c => c.cliente.toLowerCase().trim() === v.cliente.toLowerCase().trim());
                  return (
                    <tr key={v.id} className="hover:bg-amber-50/50">
                      <td className="py-2.5 px-3.5 font-mono font-bold text-stone-700">{v.id}</td>
                      <td className="py-2.5 px-3.5 font-bold text-stone-900">{v.cliente}</td>
                      <td className="py-2.5 px-3.5 text-stone-500">{v.fecha}</td>
                      <td className="py-2.5 px-3.5 text-stone-700">
                        {v.items.map(i => `${i.cantidad}x ${i.producto}`).join(', ') || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-stone-500">{v.medioPago}</td>
                      <td className="py-2.5 px-3.5 font-black text-rose-700 text-sm">
                        ${v.precioFinal.toLocaleString('es-AR')}
                      </td>
                      <td className="py-2.5 px-3.5 text-right">
                        {clientObj && (
                          <button
                            onClick={() => setDebtModalClient(clientObj)}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-transform active:scale-95 cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>Cobrar WhatsApp</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Clients Directory Table with Frequency & Club Matero */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-black text-stone-900 font-display">
              Directorio de Clientes & Club Matero Yerbazo
            </h3>
            <p className="text-xs text-stone-500">
              Seguimiento de compras, antigüedad del último pedido, niveles de fidelización y cobranzas
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sortField && (
              <button
                onClick={handleResetSort}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-[#0f4b25] border border-amber-300 text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 select-none"
                title="Restablecer al orden original por gasto total"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#e68628]" />
                <span>Restablecer orden</span>
              </button>
            )}

            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar cliente, canal o dirección..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f4b25]"
              />
            </div>
          </div>
        </div>

        {/* Frequency & Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-stone-200 mb-4">
          <button
            onClick={() => { setFrequencyFilter('ALL'); setOnlyDebtors(false); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              frequencyFilter === 'ALL' && !onlyDebtors 
                ? 'bg-[#0f4b25] text-white shadow-sm' 
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            Todos ({dataset.clientes.length})
          </button>

          <button
            onClick={() => { setFrequencyFilter('activo'); setOnlyDebtors(false); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              frequencyFilter === 'activo' 
                ? 'bg-emerald-700 text-white shadow-sm' 
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>🟢 Activos (&lt;30d) ({frequencyCounts.activo})</span>
          </button>

          <button
            onClick={() => { setFrequencyFilter('en_riesgo'); setOnlyDebtors(false); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              frequencyFilter === 'en_riesgo' 
                ? 'bg-amber-600 text-white shadow-sm' 
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>🟡 En Riesgo (30-60d) ({frequencyCounts.en_riesgo})</span>
          </button>

          <button
            onClick={() => { setFrequencyFilter('inactivo'); setOnlyDebtors(false); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              frequencyFilter === 'inactivo' 
                ? 'bg-rose-700 text-white shadow-sm' 
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>🔴 Inactivos (+60d) ({frequencyCounts.inactivo})</span>
          </button>

          <button
            onClick={() => setOnlyDebtors(!onlyDebtors)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ml-auto flex items-center space-x-1 ${
              onlyDebtors 
                ? 'bg-rose-600 text-white shadow-sm' 
                : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
            }`}
          >
            <span>⚠️ Con Deuda Pendiente ({frequencyCounts.deudores})</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-stone-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f7f5ed] text-stone-700 font-extrabold uppercase tracking-wider text-[11px] border-b border-stone-200">
              <tr>
                {renderSortHeader('cliente', 'Cliente')}
                {renderSortHeader('comoNosConocio', 'Canal')}
                {renderSortHeader('direccionEntrega', 'Dirección')}
                {renderSortHeader('totalCompras', 'Pedidos')}
                {renderSortHeader('diasDesdeUltimaCompra', 'Última Compra')}
                <th className="py-3 px-3.5 select-none">Club Matero</th>
                {renderSortHeader('totalGastado', 'Total Gastado')}
                <th className="py-3 px-3.5 select-none text-right">Saldo / Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredClients.map((c) => {
                const daysSince = c.diasDesdeUltimaCompra !== undefined ? c.diasDesdeUltimaCompra : 999;
                const freq = c.segmentoFrecuencia || 'inactivo';
                const tier = c.clubMateroNivel || 'Cebador Inicial';

                let tierIcon = '🥉';
                let tierBg = 'bg-stone-100 text-stone-800';
                if (tier === 'Matero VIP') {
                  tierIcon = '👑';
                  tierBg = 'bg-purple-100 text-purple-900 border border-purple-300';
                } else if (tier === 'Matero Fiel') {
                  tierIcon = '🥇';
                  tierBg = 'bg-amber-100 text-amber-900 border border-amber-300';
                } else if (tier === 'Matero Habitual') {
                  tierIcon = '🥈';
                  tierBg = 'bg-blue-100 text-blue-900 border border-blue-200';
                }

                return (
                  <tr key={c.cliente} className="hover:bg-stone-50 transition-colors">
                    
                    {/* Cliente */}
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-stone-900">{c.cliente}</div>
                      {c.productosFavoritos.length > 0 && (
                        <div className="text-[10px] text-stone-500 truncate max-w-[150px]">
                          Prefiere: {c.productosFavoritos[0]}
                        </div>
                      )}
                    </td>

                    {/* Canal */}
                    <td className="py-3 px-3.5">
                      <span className="font-semibold text-[11px] text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md">
                        {c.comoNosConocio}
                      </span>
                    </td>

                    {/* Dirección */}
                    <td className="py-3 px-3.5 text-stone-500 max-w-[160px] truncate" title={c.direccionEntrega}>
                      {c.direccionEntrega || '-'}
                    </td>

                    {/* Compras */}
                    <td className="py-3 px-3.5 font-bold text-stone-800">
                      {c.totalCompras} {c.totalCompras === 1 ? 'pedido' : 'pedidos'}
                    </td>

                    {/* Última Compra & Frecuencia */}
                    <td className="py-3 px-3.5">
                      <div className="text-stone-900 font-semibold text-[11px]">
                        {c.ultimaCompra || 'Sin registro'}
                      </div>
                      {daysSince < 900 && (
                        <div className="mt-0.5">
                          {freq === 'activo' && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full inline-block">
                              Hace {daysSince}d (Activo)
                            </span>
                          )}
                          {freq === 'en_riesgo' && (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-full inline-block">
                              Hace {daysSince}d (Riesgo)
                            </span>
                          )}
                          {freq === 'inactivo' && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-full inline-block">
                              Hace {daysSince}d (Inactivo)
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Club Matero */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg flex items-center space-x-1 ${tierBg}`}>
                          <span>{tierIcon}</span>
                          <span>{tier}</span>
                        </span>
                        <button
                          onClick={() => setLoyaltyModalClient(c)}
                          className="p-1 rounded-lg text-amber-600 hover:bg-amber-100 transition-colors"
                          title="Ver beneficio y enviar mensaje Club Matero"
                        >
                          <Gift className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {c.proximoBeneficioCompras !== undefined && c.proximoBeneficioCompras > 0 && (
                        <span className="text-[10px] text-stone-400 block mt-0.5">
                          A {c.proximoBeneficioCompras} compras del próx. nivel
                        </span>
                      )}
                    </td>

                    {/* Total Gastado */}
                    <td className="py-3 px-3.5 font-black text-[#0f4b25] text-sm">
                      ${c.totalGastado.toLocaleString('es-AR')}
                    </td>

                    {/* Saldo / Acciones */}
                    <td className="py-3 px-3.5 text-right space-x-1.5">
                      {c.saldoDeuda > 0 ? (
                        <button
                          onClick={() => setDebtModalClient(c)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] shadow-xs transition-transform active:scale-95 cursor-pointer animate-pulse"
                          title="Enviar detalle de deuda por WhatsApp"
                        >
                          <DollarSign className="w-3 h-3" />
                          <span>Cobrar ${c.saldoDeuda.toLocaleString('es-AR')}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md inline-flex items-center space-x-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Al día</span>
                        </span>
                      )}

                      <button
                        onClick={() => setLoyaltyModalClient(c)}
                        className="inline-flex items-center space-x-1 px-2 py-1 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-[11px] cursor-pointer"
                        title="Enviar felicitación / premio Club Matero"
                      >
                        <Award className="w-3 h-3 text-[#e68628]" />
                        <span className="hidden sm:inline">Premio</span>
                      </button>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Gestor de Cobranzas Rápidas por WhatsApp */}
      {debtModalClient && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border-4 border-rose-500 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setDebtModalClient(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-black text-lg">
                📲
              </div>
              <div>
                <h3 className="text-xl font-black text-stone-900 font-display">
                  Cobranza por WhatsApp: {debtModalClient.cliente}
                </h3>
                <p className="text-xs text-rose-700 font-bold">
                  Saldo pendiente acumulado: ${debtModalClient.saldoDeuda.toLocaleString('es-AR')}
                </p>
              </div>
            </div>

            {/* Alias Configuration */}
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 mb-4 flex items-center justify-between text-xs">
              <span className="font-bold text-stone-700">Tu Alias de Mercado Pago:</span>
              <input
                type="text"
                value={mpAlias}
                onChange={(e) => setMpAlias(e.target.value)}
                className="font-mono font-black text-[#0f4b25] bg-white px-2.5 py-1 rounded-lg border border-stone-300 text-xs w-36 text-center"
              />
            </div>

            {/* Generated Message Box */}
            <div className="mb-4">
              <label className="text-xs font-bold text-stone-700 block mb-1.5">
                Mensaje generado listo para enviar:
              </label>
              <div className="p-4 rounded-2xl bg-[#ece7d7]/60 border border-[#0f4b25]/20 text-xs text-stone-800 font-mono whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                {getDebtPitch(debtModalClient)}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => copyToClipboard(getDebtPitch(debtModalClient), debtModalClient.cliente)}
                className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-[#0f4b25] hover:bg-[#186d38] text-white font-extrabold text-xs sm:text-sm shadow-lg flex items-center justify-center space-x-2 transition-transform active:scale-95 cursor-pointer"
              >
                {copiedPitch ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedPitch ? '¡Copiado!' : 'Copiar Mensaje'}</span>
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(getDebtPitch(debtModalClient))}`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-lg flex items-center justify-center space-x-2 transition-transform active:scale-95"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Abrir WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Tarjeta Club Matero & Beneficio de Fidelización */}
      {loyaltyModalClient && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border-4 border-[#e68628] relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setLoyaltyModalClient(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-[#e68628] flex items-center justify-center font-black text-2xl shadow-xs">
                🏆
              </div>
              <div>
                <span className="text-[11px] font-black text-[#e68628] uppercase tracking-wider">
                  Club Matero Yerbazo
                </span>
                <h3 className="text-xl font-black text-stone-900 font-display">
                  {loyaltyModalClient.cliente}
                </h3>
              </div>
            </div>

            {/* Tier Stats Card */}
            <div className="p-4 rounded-2xl bg-[#0f4b25] text-white mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#ece7d7]/80">Nivel actual de fidelidad:</span>
                <span className="font-black text-amber-300 text-sm flex items-center space-x-1">
                  <span>⭐</span>
                  <span>{loyaltyModalClient.clubMateroNivel || 'Cebador Inicial'}</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#ece7d7]/90 mb-2">
                <span>Historial de compras:</span>
                <span className="font-extrabold text-[#ece7d7]">{loyaltyModalClient.totalCompras} pedidos</span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#ece7d7]/90">
                <span>Total consumido:</span>
                <span className="font-black text-amber-300">${loyaltyModalClient.totalGastado.toLocaleString('es-AR')}</span>
              </div>
            </div>

            {/* Generated Message Box */}
            <div className="mb-4">
              <label className="text-xs font-bold text-stone-700 block mb-1.5">
                Mensaje de premio / felicitación listo para WhatsApp:
              </label>
              <div className="p-4 rounded-2xl bg-[#ece7d7]/60 border border-[#0f4b25]/20 text-xs text-stone-800 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {getLoyaltyPitch(loyaltyModalClient)}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => copyToClipboard(getLoyaltyPitch(loyaltyModalClient), loyaltyModalClient.cliente)}
                className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-[#0f4b25] hover:bg-[#186d38] text-white font-extrabold text-xs sm:text-sm shadow-lg flex items-center justify-center space-x-2 transition-transform active:scale-95 cursor-pointer"
              >
                {copiedPitch ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedPitch ? '¡Copiado!' : 'Copiar Felicitación'}</span>
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(getLoyaltyPitch(loyaltyModalClient))}`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-lg flex items-center justify-center space-x-2 transition-transform active:scale-95"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Enviar por WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
