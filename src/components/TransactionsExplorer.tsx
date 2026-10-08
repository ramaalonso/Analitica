import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  Clock, 
  XCircle,
  Eye,
  MapPin,
  Printer,
  Copy,
  Check,
  MessageCircle,
  ExternalLink,
  X,
  Sparkles,
  Truck,
  RotateCcw,
  Receipt
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SaleTransaction, YerbazoDataset } from '../types';
import { exportToExcel } from '../services/dataService';
import { CHRONOLOGICAL_MONTHS } from '../utils/analyticsEngine';

interface TransactionsExplorerProps {
  ventas: SaleTransaction[];
  selectedMonth: string;
  dataset?: YerbazoDataset;
}

export type DeliveryNodeId = 'ALL' | 'uade' | 'club' | 'mirador' | 'devoto' | 'otros';

export interface DeliveryNodeInfo {
  id: 'uade' | 'club' | 'mirador' | 'devoto' | 'otros';
  name: string;
  badge: string;
  icon: string;
  color: string;
}

export function detectDeliveryNode(v: SaleTransaction, clientAddress?: string): DeliveryNodeInfo {
  const text = `${v.cliente} ${v.observaciones} ${clientAddress || ''} ${v.deudaInfo || ''}`.toLowerCase();

  if (text.includes('uade') || text.includes('recreo') || text.includes('facultad') || text.includes('lacroze')) {
    return { 
      id: 'uade', 
      name: 'Polo UADE', 
      badge: '🎓 UADE', 
      icon: '🎓',
      color: 'bg-blue-100 text-blue-900 border-blue-200'
    };
  }

  if (text.includes('club') || text.includes('rugby') || text.includes('anexo') || text.includes('suipacha') || text.includes('delambre')) {
    return { 
      id: 'club', 
      name: 'Polo Club / Rugby', 
      badge: '🏉 Club / Rugby', 
      icon: '🏉',
      color: 'bg-emerald-100 text-emerald-900 border-emerald-200'
    };
  }

  if (text.includes('mirador')) {
    return { 
      id: 'mirador', 
      name: 'Polo Mirador', 
      badge: '🏡 Mirador', 
      icon: '🏡',
      color: 'bg-amber-100 text-amber-900 border-amber-200'
    };
  }

  if (
    text.includes('devoto') || 
    text.includes('beiro') || 
    text.includes('nogoya') || 
    text.includes('moran') || 
    text.includes('asuncion') || 
    text.includes('cubas') || 
    text.includes('pueyrredon') || 
    text.includes('sanabria') || 
    text.includes('vallejos') || 
    text.includes('nazca') ||
    text.includes('sastre') ||
    text.includes('estrada') ||
    text.includes('groussac')
  ) {
    return { 
      id: 'devoto', 
      name: 'Devoto / Pueyrredón', 
      badge: '📍 Devoto / Beiró', 
      icon: '📍',
      color: 'bg-purple-100 text-purple-900 border-purple-200'
    };
  }

  return { 
    id: 'otros', 
    name: 'Otros / Domicilio', 
    badge: '📦 Domicilio', 
    icon: '📦',
    color: 'bg-stone-100 text-stone-700 border-stone-200'
  };
}

export const TransactionsExplorer: React.FC<TransactionsExplorerProps> = ({
  ventas,
  selectedMonth,
  dataset
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState(selectedMonth || 'TODOS');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'SI' | 'NO'>('ALL');
  const [deliveryFilter, setDeliveryFilter] = useState<'ALL' | 'SI' | 'NO'>('ALL');
  const [nodeFilter, setNodeFilter] = useState<DeliveryNodeId>('ALL');
  const [onlyPendingDeliveries, setOnlyPendingDeliveries] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Receipt Modal State
  const [receiptSale, setReceiptSale] = useState<SaleTransaction | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Sync if parent prop changes
  React.useEffect(() => {
    if (selectedMonth && selectedMonth !== monthFilter) {
      setMonthFilter(selectedMonth);
      setCurrentPage(1);
    }
  }, [selectedMonth]);

  // Client address map lookup
  const clientAddressMap = useMemo(() => {
    const map = new Map<string, string>();
    if (dataset?.clientes) {
      for (const c of dataset.clientes) {
        map.set(c.cliente.toLowerCase().trim(), c.direccionEntrega || '');
      }
    }
    return map;
  }, [dataset]);

  // Summary counts for delivery logistics
  const logisticsSummary = useMemo(() => {
    let pendingCount = 0;
    let uadePending = 0;
    let clubPending = 0;
    let miradorPending = 0;
    let devotoPending = 0;
    let otrosPending = 0;

    for (const v of ventas) {
      const isPending = v.entregado !== 'SI';
      if (isPending) {
        pendingCount++;
        const addr = clientAddressMap.get(v.cliente.toLowerCase().trim()) || '';
        const node = detectDeliveryNode(v, addr);
        if (node.id === 'uade') uadePending++;
        else if (node.id === 'club') clubPending++;
        else if (node.id === 'mirador') miradorPending++;
        else if (node.id === 'devoto') devotoPending++;
        else otrosPending++;
      }
    }

    return {
      pendingCount,
      uadePending,
      clubPending,
      miradorPending,
      devotoPending,
      otrosPending
    };
  }, [ventas, clientAddressMap]);

  const filtered = useMemo(() => {
    return ventas.filter(v => {
      const addr = clientAddressMap.get(v.cliente.toLowerCase().trim()) || '';
      const node = detectDeliveryNode(v, addr);

      const matchSearch = v.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          v.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          v.medioPago.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          v.items.some(i => i.producto.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchMonth = monthFilter === 'TODOS' || v.mes === monthFilter;
      const matchPayment = paymentFilter === 'ALL' || 
                           (paymentFilter === 'SI' && (v.pago === 'SI' || v.pago === '')) ||
                           (paymentFilter === 'NO' && (v.pago === 'NO' || v.pago.includes('PENDIENTE')));
      
      const matchDelivery = onlyPendingDeliveries 
        ? v.entregado !== 'SI'
        : (deliveryFilter === 'ALL' || v.entregado === deliveryFilter);

      const matchNode = nodeFilter === 'ALL' || node.id === nodeFilter;

      return matchSearch && matchMonth && matchPayment && matchDelivery && matchNode;
    });
  }, [ventas, searchTerm, monthFilter, paymentFilter, deliveryFilter, nodeFilter, onlyPendingDeliveries, clientAddressMap]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExportFiltered = () => {
    const rows = filtered.map(v => {
      const addr = clientAddressMap.get(v.cliente.toLowerCase().trim()) || '';
      const node = detectDeliveryNode(v, addr);
      return {
        ID_Venta: v.id,
        Cliente: v.cliente,
        Fecha: v.fecha,
        Mes: v.mes,
        Semana: v.semana,
        Zona_Entrega: node.name,
        Precio_Final: v.precioFinal,
        Precio_Sistema: v.precioSistema,
        Ganancia: v.ganancia,
        Medio_Pago: v.medioPago,
        Pago_Estado: v.pago,
        Entregado: v.entregado,
        Productos: v.items.map(i => `${i.cantidad}x ${i.producto}`).join(' | '),
        Observaciones: v.observaciones,
        Deuda_Anotacion: v.deudaInfo
      };
    });

    exportToExcel(`Yerbazo_Ventas_${monthFilter}`, { 'Ventas_Filtradas': rows });
  };

  // Helper for generating Receipt text for WhatsApp
  const generateReceiptText = (sale: SaleTransaction) => {
    const addr = clientAddressMap.get(sale.cliente.toLowerCase().trim()) || '';
    const node = detectDeliveryNode(sale, addr);
    const itemsList = sale.items.map(i => `  • ${i.cantidad}x ${i.producto}`).join('\n');

    return `🧾 *COMPROBANTE DE PEDIDO | YERBAZO* 🌿
──────────────────────
📋 *Pedido:* ${sale.id}
📅 *Fecha:* ${sale.fecha}
👤 *Cliente:* ${sale.cliente}
📍 *Zona de entrega:* ${node.name}
──────────────────────
🧉 *Productos:*
${itemsList || '  • Pedido de yerba'}
──────────────────────
💰 *Total:* $${sale.precioFinal.toLocaleString('es-AR')}
💳 *Medio de pago:* ${sale.medioPago}
📦 *Estado entrega:* ${sale.entregado === 'SI' ? 'Entregado ✅' : 'Pendiente de entrega ⏳'}
${sale.pago === 'NO' || sale.pago.includes('PENDIENTE') ? '⚠️ *Pago:* PENDIENTE\n💳 *Alias Mercado Pago:* `yerbazo.ba`' : '✅ *Pago:* ABONADO'}
──────────────────────
¡Muchas gracias por elegir Yerbazo! Que disfrutes los mejores mates 🧉✨`;
  };

  const copyReceiptToClipboard = (sale: SaleTransaction) => {
    const text = generateReceiptText(sale);
    navigator.clipboard.writeText(text);
    confetti({
      particleCount: 35,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#0f4b25', '#e68628', '#10b981']
    });
    setCopiedReceipt(true);
    setFeedbackToast('¡Comprobante copiado al portapapeles!');
    setTimeout(() => {
      setCopiedReceipt(false);
      setFeedbackToast(null);
    }, 3000);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="space-y-6">

      {/* Floating Toast Notification */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0f4b25] text-[#ece7d7] px-5 py-3 rounded-2xl shadow-2xl border-2 border-[#e68628] flex items-center space-x-3 text-xs font-bold animate-bounce no-print">
          <Sparkles className="w-4 h-4 text-[#e68628]" />
          <span>{feedbackToast}</span>
        </div>
      )}
      
      {/* Header Banner */}
      <div className="bg-[#0f4b25] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border-b-4 border-[#e68628] no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center space-x-2 bg-[#e68628] text-stone-900 font-bold text-xs uppercase px-3 py-1 rounded-full mb-3 shadow-sm">
              <FileText className="w-3.5 h-3.5" />
              <span>Libro Mayor de Ventas & Logística</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-[#ece7d7]">
              Explorador de Ventas, Nodos de Entrega y Remitos
            </h2>
            <p className="text-sm text-[#ece7d7]/80 max-w-3xl mt-1">
              Registro histórico completo de transacciones con clientes, agrupación logística por polos de entrega (UADE, Club, Mirador, Devoto) y emisión de comprobantes en 1 clic.
            </p>
          </div>

          <button
            onClick={handleExportFiltered}
            className="px-4 py-2.5 rounded-2xl bg-[#e68628] hover:bg-[#cc721b] text-white font-bold text-xs sm:text-sm shadow-lg flex items-center space-x-2 self-start transition-transform active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Excel ({filtered.length})</span>
          </button>
        </div>
      </div>

      {/* Logística de Entregas por Zonas / Nodos Clave (Item 1) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-sm no-print space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 text-[#e68628] flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-stone-900 font-display">
                Logística de Entregas por Polos & Zonas
              </h3>
              <p className="text-xs text-stone-500">
                Agrupá pedidos antes de salir a repartir para coordinar viajes y no duplicar recorridos
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setOnlyPendingDeliveries(!onlyPendingDeliveries);
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              onlyPendingDeliveries 
                ? 'bg-rose-600 text-white shadow-xs' 
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>
              {onlyPendingDeliveries ? 'Mostrando solo pendientes' : `Ver ${logisticsSummary.pendingCount} entregas pendientes`}
            </span>
          </button>
        </div>

        {/* Node Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 text-xs">
          <button
            onClick={() => { setNodeFilter('ALL'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              nodeFilter === 'ALL' ? 'bg-[#0f4b25] text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            Todos los Nodos
          </button>

          <button
            onClick={() => { setNodeFilter('uade'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              nodeFilter === 'uade' ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-900 hover:bg-blue-100'
            }`}
          >
            <span>🎓 Polo UADE</span>
            {logisticsSummary.uadePending > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black ml-1">
                {logisticsSummary.uadePending} pend.
              </span>
            )}
          </button>

          <button
            onClick={() => { setNodeFilter('club'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              nodeFilter === 'club' ? 'bg-emerald-700 text-white shadow-xs' : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
            }`}
          >
            <span>🏉 Polo Club / Rugby</span>
            {logisticsSummary.clubPending > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black ml-1">
                {logisticsSummary.clubPending} pend.
              </span>
            )}
          </button>

          <button
            onClick={() => { setNodeFilter('mirador'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              nodeFilter === 'mirador' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <span>🏡 Polo Mirador</span>
            {logisticsSummary.miradorPending > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black ml-1">
                {logisticsSummary.miradorPending} pend.
              </span>
            )}
          </button>

          <button
            onClick={() => { setNodeFilter('devoto'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              nodeFilter === 'devoto' ? 'bg-purple-600 text-white shadow-xs' : 'bg-purple-50 text-purple-900 hover:bg-purple-100'
            }`}
          >
            <span>📍 Corredor Devoto / Beiró</span>
            {logisticsSummary.devotoPending > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black ml-1">
                {logisticsSummary.devotoPending} pend.
              </span>
            )}
          </button>

          <button
            onClick={() => { setNodeFilter('otros'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              nodeFilter === 'otros' ? 'bg-stone-700 text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <span>📦 Domicilio / Otros</span>
            {logisticsSummary.otrosPending > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black ml-1">
                {logisticsSummary.otrosPending} pend.
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200 space-y-6">
        
        {/* Secondary Filter Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Mes */}
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-stone-500">Mes:</span>
              <select
                value={monthFilter}
                onChange={(e) => { setMonthFilter(e.target.value); setCurrentPage(1); }}
                className="bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 font-bold text-stone-800 text-xs focus:ring-2 focus:ring-[#0f4b25]"
              >
                <option value="TODOS">Todos los Meses</option>
                {CHRONOLOGICAL_MONTHS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Pago */}
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-stone-500">Pago:</span>
              <select
                value={paymentFilter}
                onChange={(e) => { setPaymentFilter(e.target.value as any); setCurrentPage(1); }}
                className="bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 font-bold text-stone-800 text-xs focus:ring-2 focus:ring-[#0f4b25]"
              >
                <option value="ALL">Todos los Pagos</option>
                <option value="SI">Abonado (SI)</option>
                <option value="NO">Pendiente (NO)</option>
              </select>
            </div>

            {/* Entrega */}
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-stone-500">Entrega:</span>
              <select
                value={deliveryFilter}
                onChange={(e) => { setDeliveryFilter(e.target.value as any); setCurrentPage(1); }}
                className="bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 font-bold text-stone-800 text-xs focus:ring-2 focus:ring-[#0f4b25]"
              >
                <option value="ALL">Todas las Entregas</option>
                <option value="SI">Entregado (SI)</option>
                <option value="NO">Pendiente (NO)</option>
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por cliente, ID, producto, zona..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f4b25]"
            />
          </div>

        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto rounded-2xl border border-stone-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f7f5ed] text-stone-700 font-extrabold uppercase tracking-wider text-[11px] border-b border-stone-200">
              <tr>
                <th className="py-3 px-3.5">ID / Fecha</th>
                <th className="py-3 px-3.5">Cliente</th>
                <th className="py-3 px-3.5">Zona / Nodo</th>
                <th className="py-3 px-3.5">Productos</th>
                <th className="py-3 px-3.5">Total Final</th>
                <th className="py-3 px-3.5">Ganancia</th>
                <th className="py-3 px-3.5">Cobro</th>
                <th className="py-3 px-3.5">Entrega</th>
                <th className="py-3 px-3.5 text-right">Comprobante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-white">
              {paginated.map((v) => {
                const addr = clientAddressMap.get(v.cliente.toLowerCase().trim()) || '';
                const node = detectDeliveryNode(v, addr);
                const isPaid = v.pago === 'SI' || v.pago === '';
                const isDelivered = v.entregado === 'SI';

                return (
                  <tr key={v.id} className="hover:bg-stone-50 transition-colors">
                    
                    {/* ID / Fecha */}
                    <td className="py-3 px-3.5 font-mono">
                      <div className="font-extrabold text-stone-800 text-[11px]">{v.id}</div>
                      <div className="text-[10px] text-stone-400 font-sans">{v.fecha}</div>
                    </td>

                    {/* Cliente */}
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-stone-900 text-xs">{v.cliente}</div>
                      {v.observaciones && (
                        <div className="text-[10px] text-stone-500 italic truncate max-w-[150px]" title={v.observaciones}>
                          {v.observaciones}
                        </div>
                      )}
                    </td>

                    {/* Zona / Nodo de Entrega */}
                    <td className="py-3 px-3.5">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${node.color}`}>
                        {node.badge}
                      </span>
                    </td>

                    {/* Productos */}
                    <td className="py-3 px-3.5 max-w-[200px]">
                      <div className="text-stone-800 font-medium truncate text-[11px]" title={v.items.map(i => `${i.cantidad}x ${i.producto}`).join(', ')}>
                        {v.items.map(i => `${i.cantidad}x ${i.producto}`).join(', ') || '-'}
                      </div>
                    </td>

                    {/* Total Final */}
                    <td className="py-3 px-3.5 font-black text-stone-900 text-sm">
                      ${v.precioFinal.toLocaleString('es-AR')}
                    </td>

                    {/* Ganancia */}
                    <td className="py-3 px-3.5 font-bold text-[#0f4b25]">
                      ${v.ganancia.toLocaleString('es-AR')}
                    </td>

                    {/* Cobro */}
                    <td className="py-3 px-3.5">
                      {isPaid ? (
                        <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-[10px]">
                          <CheckCircle className="w-3 h-3" />
                          <span>Abonado</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-black text-[10px]">
                          <Clock className="w-3 h-3" />
                          <span>Pendiente</span>
                        </span>
                      )}
                      <div className="text-[10px] text-stone-400 mt-0.5">{v.medioPago}</div>
                    </td>

                    {/* Entrega */}
                    <td className="py-3 px-3.5">
                      {isDelivered ? (
                        <span className="inline-flex items-center space-x-1 text-emerald-700 font-bold text-[10px]">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span>Entregado</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-black text-[10px]">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Por entregar</span>
                        </span>
                      )}
                    </td>

                    {/* Botón Remito / Ticket */}
                    <td className="py-3 px-3.5 text-right">
                      <button
                        onClick={() => setReceiptSale(v)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-[#0f4b25] hover:text-white text-stone-800 font-bold text-[11px] transition-all cursor-pointer shadow-2xs"
                        title="Ver e imprimir comprobante / remito de entrega"
                      >
                        <Receipt className="w-3 h-3 text-[#e68628]" />
                        <span>Remito</span>
                      </button>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 text-xs text-stone-500">
          <div>
            Mostrando <strong>{paginated.length}</strong> de <strong>{filtered.length}</strong> ventas
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-xl border border-stone-300 disabled:opacity-30 hover:bg-stone-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-stone-700">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-xl border border-stone-300 disabled:opacity-30 hover:bg-stone-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* MODAL: Generador de Remito / Comprobante de Pedido (Item 1 Nuevo) */}
      {receiptSale && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border-4 border-[#0f4b25] relative animate-in fade-in zoom-in-95 duration-150">
            
            <button
              onClick={() => setReceiptSale(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors no-print cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Printable Receipt Area */}
            <div id="yerbazo-receipt" className="p-4 rounded-2xl border-2 border-dashed border-stone-300 bg-[#fbf9f4] space-y-4 font-sans text-xs text-stone-800">
              
              {/* Receipt Header */}
              <div className="text-center pb-3 border-b border-stone-200">
                <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-[#0f4b25] p-1 flex items-center justify-center border-2 border-[#e68628] overflow-hidden">
                  <img src="/logo.webp" alt="Yerbazo" className="w-full h-full object-contain" />
                </div>
                <h4 className="font-black text-base text-stone-900 uppercase font-display tracking-wider">
                  YERBAZO MATES & YERBAS
                </h4>
                <p className="text-[10px] text-stone-500">
                  Comprobante de Pedido & Remito de Entrega
                </p>
              </div>

              {/* Order Metadata */}
              <div className="grid grid-cols-2 gap-2 text-[11px] pb-3 border-b border-stone-200">
                <div>
                  <span className="text-stone-400 block text-[10px]">ID PEDIDO:</span>
                  <span className="font-mono font-bold text-stone-900">{receiptSale.id}</span>
                </div>
                <div className="text-right">
                  <span className="text-stone-400 block text-[10px]">FECHA:</span>
                  <span className="font-bold text-stone-900">{receiptSale.fecha}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">CLIENTE:</span>
                  <span className="font-black text-stone-900">{receiptSale.cliente}</span>
                </div>
                <div className="text-right">
                  <span className="text-stone-400 block text-[10px]">ZONA / NODO:</span>
                  <span className="font-bold text-[#0f4b25]">
                    {detectDeliveryNode(receiptSale, clientAddressMap.get(receiptSale.cliente.toLowerCase().trim())).name}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 pb-3 border-b border-stone-200">
                <div className="text-[10px] font-black text-stone-400 uppercase tracking-wider">
                  Detalle de Productos:
                </div>
                {receiptSale.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="font-bold text-stone-800">
                      {it.cantidad}x {it.producto}
                    </span>
                    <span className="text-stone-500 font-mono">
                      {it.stockStatus ? `(${it.stockStatus})` : ''}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total & Payment */}
              <div className="pt-1 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-black text-stone-900">TOTAL FINAL:</span>
                  <span className="font-black text-[#0f4b25] text-base font-mono">
                    ${receiptSale.precioFinal.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-stone-500">
                  <span>Método de pago:</span>
                  <span className="font-semibold text-stone-800">{receiptSale.medioPago}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Estado de pago:</span>
                  <span className={receiptSale.pago === 'SI' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                    {receiptSale.pago === 'SI' ? 'PAGADO ✅' : 'PENDIENTE DE PAGO ⚠️'}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Estado de entrega:</span>
                  <span className={receiptSale.entregado === 'SI' ? 'text-emerald-700 font-bold' : 'text-amber-800 font-bold'}>
                    {receiptSale.entregado === 'SI' ? 'ENTREGADO ✅' : 'PENDIENTE DE ENTREGA ⏳'}
                  </span>
                </div>
              </div>

              {/* Receipt Footer */}
              <div className="text-center pt-3 text-[10px] text-stone-400 italic">
                ¡Gracias por elegir Yerbazo! Que disfrutes los mejores mates 🧉✨
              </div>

            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 mt-5 no-print">
              <button
                onClick={handlePrintReceipt}
                className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-[#0f4b25] hover:bg-[#165a31] text-white font-extrabold text-xs shadow-md flex items-center justify-center space-x-2 transition-transform active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-[#e68628]" />
                <span>Imprimir Ticket / PDF</span>
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(generateReceiptText(receiptSale))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-transform active:scale-95 shadow-xs cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-emerald-100" />
                <span>Enviar por WhatsApp</span>
              </a>

              <button
                onClick={() => copyReceiptToClipboard(receiptSale)}
                className="w-full sm:w-auto py-3 px-4 rounded-2xl bg-amber-100 hover:bg-amber-200 text-stone-900 border border-amber-300 font-bold text-xs flex items-center justify-center space-x-1.5 transition-transform active:scale-95 cursor-pointer"
              >
                {copiedReceipt ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-stone-700" />}
                <span>{copiedReceipt ? '¡Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
