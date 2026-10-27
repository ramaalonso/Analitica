import React, { useState, useMemo, useEffect } from 'react';
import {
  Truck,
  DollarSign,
  PlusCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  MapPin,
  UserPlus,
  Users,
  ShoppingBag,
  Sparkles,
  Copy,
  Check,
  MessageCircle,
  RefreshCw,
  Trash2,
  ChevronRight,
  Package,
  CreditCard,
  Banknote,
  FileSpreadsheet,
  ExternalLink,
  Settings,
  X,
  RotateCcw,
  Calendar,
  Tag,
  ArrowRight,
  Columns,
  Smartphone,
  ShieldCheck,
  ClipboardCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  YerbazoDataset,
  SaleTransaction,
  CatalogProduct,
  ClienteRow,
  NewOrderPayload,
  NewOrderItemInput
} from '../types';
import {
  saveNewOrderAndSync,
  updateOrderStatusAndSync,
  deleteLocalOrder,
  generateOrderId,
  buildTabSeparatedRow,
  buildGoogleSheetNativeRowFromOrder,
  VENTAS_SHEET_HEADERS,
  getAppsScriptUrl,
  setAppsScriptUrl,
  sendToGoogleAppsScript,
  syncPendingToGoogleSheets,
  pullCloudSyncState,
  exportMergedDatasetToExcel,
  getLocalOrders,
  getStatusOverrides,
  GOOGLE_APPS_SCRIPT_TEMPLATE
} from '../services/dataService';
import { detectDeliveryNode, DeliveryNodeId } from './TransactionsExplorer';

const EXCEL_COL_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA'
];

interface OrderManagementHubProps {
  dataset: YerbazoDataset;
  onDatasetUpdate: (newDataset: YerbazoDataset) => void;
  onSyncSheets: () => void;
  isSyncing: boolean;
  initialSubView?: 'entregas' | 'cobros' | 'nuevo' | 'recientes';
  onOpenNewOrder?: () => void;
  onEditOrder?: (sale: SaleTransaction) => void;
}

const MONTH_NAMES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function computeMonthAndWeekFromDate(isoDateStr: string): { displayDate: string; mes: string; semana: string } {
  // isoDateStr format: YYYY-MM-DD
  const parts = isoDateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10); // 1-12
    const day = parseInt(parts[2], 10);
    const weekNum = Math.min(5, Math.max(1, Math.ceil(day / 7)));
    const mesName = MONTH_NAMES_ES[month - 1] || 'octubre';
    return {
      displayDate: `${day}/${month}/${year}`,
      mes: mesName.toLowerCase(),
      semana: `Semana ${weekNum}`
    };
  }
  const now = new Date();
  const d = now.getDate();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  const mesName = MONTH_NAMES_ES[m - 1] || 'octubre';
  return {
    displayDate: `${d}/${m}/${y}`,
    mes: mesName.toLowerCase(),
    semana: `Semana ${Math.min(5, Math.max(1, Math.ceil(d / 7)))}`
  };
}

export const OrderManagementHub: React.FC<OrderManagementHubProps> = ({
  dataset,
  onDatasetUpdate,
  onSyncSheets,
  isSyncing,
  initialSubView = 'entregas',
  onOpenNewOrder,
  onEditOrder
}) => {
  const [subView, setSubView] = useState<'entregas' | 'cobros' | 'nuevo' | 'recientes'>(initialSubView);
  const [desktopSplitMode, setDesktopSplitMode] = useState<boolean>(false);

  // Sync subView if parent passes a new initialSubView trigger
  useEffect(() => {
    if (initialSubView) {
      setSubView(initialSubView);
    }
  }, [initialSubView]);

  // Pull cloud sync state (Firebase Realtime DB) so orders loaded on phone appear on PC & vice versa
  useEffect(() => {
    let active = true;
    pullCloudSyncState().then(() => {
      if (active) {
        setScriptUrlInput(getAppsScriptUrl());
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Toast feedback
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'info' | 'warning' } | null>(null);
  const showToast = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4200);
  };

  // Apps Script Modal & Config state
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [scriptUrlInput, setScriptUrlInput] = useState(() => getAppsScriptUrl());
  const [isTestingScript, setIsTestingScript] = useState(false);
  const [copiedScriptCode, setCopiedScriptCode] = useState(false);

  // Alias Mercado Pago for collections
  const [mpAlias, setMpAlias] = useState<string>(() => {
    return localStorage.getItem('yerbazo_mp_alias') || 'yerbazo.ba';
  });
  const [copiedAlias, setCopiedAlias] = useState(false);

  useEffect(() => {
    localStorage.setItem('yerbazo_mp_alias', mpAlias);
  }, [mpAlias]);

  // Filters for Entregas & Cobros
  const [searchQuery, setSearchQuery] = useState('');
  const [nodeFilter, setNodeFilter] = useState<DeliveryNodeId>('ALL');
  const [checkedBagItems, setCheckedBagItems] = useState<Record<string, boolean>>({});
  const [selectedPayMethodForOrder, setSelectedPayMethodForOrder] = useState<Record<string, string>>({});
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  // ============================================================================
  // NEW ORDER FORM STATE
  // ============================================================================
  const todayIso = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [clientName, setClientName] = useState('');
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [isNewClient, setIsNewClient] = useState(false);
  const [clientChannel, setClientChannel] = useState('Un amigo');
  const [clientAddress, setClientAddress] = useState('');
  const [orderDateIso, setOrderDateIso] = useState(todayIso);
  const [medioPago, setMedioPago] = useState<'Mercado Pago' | 'Efectivo' | '-----'>('Mercado Pago');
  const [pagoStatus, setPagoStatus] = useState<'SI' | 'NO'>('NO');
  const [entregadoStatus, setEntregadoStatus] = useState<'SI' | 'NO'>('NO');
  const [observaciones, setObservaciones] = useState('');

  // Cart items (up to 5 slots as in Yerbazo Ventas sheet)
  const [orderItems, setOrderItems] = useState<NewOrderItemInput[]>([]);
  const [customFinalPrice, setCustomFinalPrice] = useState<string>('');
  const [isPriceManuallyEdited, setIsPriceManuallyEdited] = useState<boolean>(false);
  const [productSearch, setProductSearch] = useState('');
  const [productCatFilter, setProductCatFilter] = useState<'TODOS' | '1 KG' | '500 G' | 'Stock myb' | 'Accesorios'>('TODOS');
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [lastCreatedOrder, setLastCreatedOrder] = useState<NewOrderPayload | null>(null);
  const [copiedLastOrderRow, setCopiedLastOrderRow] = useState(false);

  // Client metadata lookup map
  const clientMap = useMemo(() => {
    const map = new Map<string, ClienteRow>();
    for (const c of dataset.clientes) {
      map.set(c.cliente.toLowerCase().trim(), c);
    }
    return map;
  }, [dataset.clientes]);

  // Matched client when typing/selecting
  const selectedClientRecord = useMemo(() => {
    if (!clientName.trim()) return null;
    return clientMap.get(clientName.toLowerCase().trim()) || null;
  }, [clientName, clientMap]);

  // Autocomplete suggestions for clients
  const clientSuggestions = useMemo(() => {
    const q = clientName.toLowerCase().trim();
    const list = [...dataset.clientes].sort((a, b) => b.totalCompras - a.totalCompras);
    if (!q) return list.slice(0, 8);
    return list
      .filter(c =>
        c.cliente.toLowerCase().includes(q) ||
        (c.direccionEntrega || '').toLowerCase().includes(q) ||
        (c.comoNosConocio || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [dataset.clientes, clientName]);

  // Pending Deliveries (ENTREGADO !== 'SI')
  const pendingDeliveries = useMemo(() => {
    return [...dataset.ventas]
      .filter(v => (v.entregado || '').toUpperCase() !== 'SI')
      .reverse();
  }, [dataset.ventas]);

  // Unpaid Orders (PAGO === 'NO' or 'PENDIENTE')
  const unpaidOrders = useMemo(() => {
    return [...dataset.ventas]
      .filter(v => {
        const p = (v.pago || '').toUpperCase();
        return p === 'NO' || p.includes('PENDIENTE');
      })
      .reverse();
  }, [dataset.ventas]);

  const totalUnpaidAmount = useMemo(() => {
    return unpaidOrders.reduce((acc, v) => acc + v.precioFinal, 0);
  }, [unpaidOrders]);

  const totalPendingPackages = useMemo(() => {
    return pendingDeliveries.reduce(
      (acc, v) => acc + v.items.reduce((s, it) => s + it.cantidad, 0),
      0
    );
  }, [pendingDeliveries]);

  // Node counts for Pending Deliveries
  const pendingByNode = useMemo(() => {
    const counts: Record<DeliveryNodeId, number> = {
      ALL: pendingDeliveries.length,
      uade: 0,
      club: 0,
      mirador: 0,
      devoto: 0,
      otros: 0
    };
    for (const v of pendingDeliveries) {
      const c = clientMap.get(v.cliente.toLowerCase().trim());
      const node = detectDeliveryNode(v, c?.direccionEntrega);
      counts[node.id] = (counts[node.id] || 0) + 1;
    }
    return counts;
  }, [pendingDeliveries, clientMap]);

  // Filtered Pending Deliveries
  const filteredPendingDeliveries = useMemo(() => {
    return pendingDeliveries.filter(v => {
      const c = clientMap.get(v.cliente.toLowerCase().trim());
      const node = detectDeliveryNode(v, c?.direccionEntrega);
      const matchNode = nodeFilter === 'ALL' || node.id === nodeFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        v.cliente.toLowerCase().includes(q) ||
        v.id.toLowerCase().includes(q) ||
        (c?.direccionEntrega || '').toLowerCase().includes(q) ||
        v.observaciones.toLowerCase().includes(q) ||
        v.items.some(i => i.producto.toLowerCase().includes(q));
      return matchNode && matchSearch;
    });
  }, [pendingDeliveries, nodeFilter, searchQuery, clientMap]);

  // Picking List (Consolidado de productos a preparar para las entregas filtradas)
  const pickingList = useMemo(() => {
    const map = new Map<string, { producto: string; cantidad: number; clientes: string[] }>();
    for (const v of filteredPendingDeliveries) {
      for (const it of v.items) {
        const key = it.producto.toLowerCase().trim();
        const existing = map.get(key) || { producto: it.producto, cantidad: 0, clientes: [] };
        existing.cantidad += it.cantidad;
        if (!existing.clientes.includes(v.cliente)) {
          existing.clientes.push(v.cliente);
        }
        map.set(key, existing);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.cantidad - a.cantidad);
  }, [filteredPendingDeliveries]);

  // Filtered Unpaid Orders
  const filteredUnpaidOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return unpaidOrders.filter(v => {
      if (!q) return true;
      const c = clientMap.get(v.cliente.toLowerCase().trim());
      return (
        v.cliente.toLowerCase().includes(q) ||
        v.id.toLowerCase().includes(q) ||
        (c?.direccionEntrega || '').toLowerCase().includes(q) ||
        v.items.some(i => i.producto.toLowerCase().includes(q))
      );
    });
  }, [unpaidOrders, searchQuery, clientMap]);

  // Recent Orders (last 25 orders in Ventas reversed)
  const recentOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return [...dataset.ventas]
      .reverse()
      .filter(v => {
        if (!q) return true;
        return (
          v.cliente.toLowerCase().includes(q) ||
          v.id.toLowerCase().includes(q) ||
          v.items.some(i => i.producto.toLowerCase().includes(q))
        );
      })
      .slice(0, 25);
  }, [dataset.ventas, searchQuery]);

  // Unsynced local items count
  const pendingCloudCount = useMemo(() => {
    const localOrd = getLocalOrders().filter(o => !o.syncedToSheet).length;
    const localOv = Object.values(getStatusOverrides()).filter(ov => !ov.syncedToSheet).length;
    return localOrd + localOv;
  }, [dataset]);

  // ============================================================================
  // CALCULATOR FOR NEW ORDER
  // ============================================================================
  const calculatedSystemPrice = useMemo(() => {
    return orderItems.reduce((acc, it) => acc + it.cantidad * it.precioVentaUnitario, 0);
  }, [orderItems]);

  const calculatedTotalCost = useMemo(() => {
    return orderItems.reduce((acc, it) => acc + it.cantidad * it.precioCompraUnitario, 0);
  }, [orderItems]);

  // Keep final price synced with system price unless manually edited
  useEffect(() => {
    if (!isPriceManuallyEdited) {
      setCustomFinalPrice(calculatedSystemPrice > 0 ? String(calculatedSystemPrice) : '');
    }
  }, [calculatedSystemPrice, isPriceManuallyEdited]);

  const finalPriceNumber = useMemo(() => {
    const parsed = parseFloat(customFinalPrice.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) return Math.round(parsed);
    return calculatedSystemPrice;
  }, [customFinalPrice, calculatedSystemPrice]);

  const calculatedProfit = useMemo(() => {
    return finalPriceNumber - calculatedTotalCost;
  }, [finalPriceNumber, calculatedTotalCost]);

  const calculatedMarginPct = useMemo(() => {
    if (finalPriceNumber <= 0) return 0;
    return (calculatedProfit / finalPriceNumber) * 100;
  }, [calculatedProfit, finalPriceNumber]);

  // Unified catalog combining "Stock" + "Stock myb"
  const orderableCatalog = useMemo<CatalogProduct[]>(() => {
    const existingNames = new Set(dataset.stock.map(s => s.nombre.toLowerCase().trim()));
    const mybProducts: CatalogProduct[] = (dataset.matesBombillas || [])
      .filter(m => m.producto && !existingNames.has(m.producto.toLowerCase().trim()))
      .map((m, idx) => {
        const restantes = m.restantes !== undefined ? m.restantes : m.cantidad;
        const precioVenta = m.precioVenta || m.precioUnidad || 0;
        const precioCompra = m.precioCompra || 0;
        return {
          id: `myb-${idx}-${m.producto}`,
          nombre: m.producto,
          nombreNormalizado: m.producto.toLowerCase().trim(),
          categoria: 'Mates y Bombillas',
          marca: 'Stock myb',
          peso: m.categoria || 'Mate',
          comprado: m.comprado || restantes,
          vendidas: m.vendidas || 0,
          restantes,
          precioCompra,
          precioVenta,
          precioViejo: precioVenta,
          gastoTotal: m.valorCosto || restantes * precioCompra,
          gananciaVendiendoTodo: m.gananciaTotal || restantes * Math.max(0, precioVenta - precioCompra),
          gananciaUnidad: m.gananciaUnidad || Math.max(0, precioVenta - precioCompra),
          gananciaRealizada: (m.vendidas || 0) * Math.max(0, precioVenta - precioCompra),
          porcentajeGanancia: m.porcentajeGanancia || (precioCompra > 0 ? ((precioVenta - precioCompra) / precioCompra) * 100 : 0)
        };
      });
    return [...dataset.stock, ...mybProducts];
  }, [dataset.stock, dataset.matesBombillas]);

  // Filtered catalog products for the order builder
  const filteredCatalog = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    return orderableCatalog.filter(p => {
      const matchSearch =
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        p.marca.toLowerCase().includes(q) ||
        p.peso.toLowerCase().includes(q);
      const matchCat =
        productCatFilter === 'TODOS' ||
        (productCatFilter === '1 KG' && p.peso === '1 KG') ||
        (productCatFilter === '500 G' && p.peso === '500 G') ||
        (productCatFilter === 'Stock myb' && (p.marca === 'Stock myb' || p.categoria === 'Mates y Bombillas')) ||
        (productCatFilter === 'Accesorios' && p.categoria !== 'Yerbas' && p.marca !== 'Stock myb');
      return matchSearch && matchCat;
    });
  }, [orderableCatalog, productSearch, productCatFilter]);

  // Add or increment product in New Order Cart
  const handleAddProductToOrder = (prod: CatalogProduct) => {
    setOrderItems(prev => {
      const existingIdx = prev.findIndex(i => i.producto.toLowerCase() === prod.nombre.toLowerCase());
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          cantidad: updated[existingIdx].cantidad + 1
        };
        return updated;
      }
      if (prev.length >= 5) {
        showToast('El Excel de Yerbazo admite hasta 5 variedades distintas por fila de pedido.', 'warning');
        return prev;
      }
      return [
        ...prev,
        {
          producto: prod.nombre,
          cantidad: 1,
          precioVentaUnitario: prod.precioVenta,
          precioCompraUnitario: prod.precioCompra,
          stockRestanteAntes: prod.restantes
        }
      ];
    });
  };

  const handleUpdateItemQty = (productoName: string, delta: number) => {
    setOrderItems(prev =>
      prev
        .map(it => {
          if (it.producto === productoName) {
            const nextQty = it.cantidad + delta;
            return nextQty > 0 ? { ...it, cantidad: nextQty } : null;
          }
          return it;
        })
        .filter(Boolean) as NewOrderItemInput[]
    );
  };

  const handleSelectSuggestionClient = (c: ClienteRow) => {
    setClientName(c.cliente);
    setClientAddress(c.direccionEntrega || '');
    setClientChannel(c.comoNosConocio || 'Directo');
    setIsNewClient(false);
    setClientSearchOpen(false);
  };

  const applyQuickDiscount = (pct: number) => {
    if (calculatedSystemPrice <= 0) return;
    if (pct === 0) {
      setIsPriceManuallyEdited(false);
      setCustomFinalPrice(String(calculatedSystemPrice));
      return;
    }
    const discounted = Math.round((calculatedSystemPrice * (100 - pct)) / 100);
    setIsPriceManuallyEdited(true);
    setCustomFinalPrice(String(discounted));
  };

  // ============================================================================
  // SUBMIT NEW ORDER
  // ============================================================================
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      showToast('Ingresá o elegí el nombre del cliente.', 'warning');
      return;
    }
    if (orderItems.length === 0) {
      showToast('Seleccioná al menos 1 producto del catálogo para el pedido.', 'warning');
      return;
    }

    setIsSavingOrder(true);
    try {
      const { displayDate, mes, semana } = computeMonthAndWeekFromDate(orderDateIso);
      const newOrder: NewOrderPayload = {
        id: generateOrderId(),
        cliente: clientName.trim(),
        esClienteNuevo: isNewClient || !selectedClientRecord,
        comoNosConocio: clientChannel || 'Directo',
        direccionEntrega: clientAddress.trim(),
        fecha: displayDate,
        precioSistema: calculatedSystemPrice,
        precioFinal: finalPriceNumber,
        medioPago: pagoStatus === 'NO' && medioPago === '-----' ? '-----' : medioPago,
        pago: pagoStatus,
        entregado: entregadoStatus,
        observaciones: observaciones.trim(),
        items: orderItems,
        mes,
        semana,
        ganancia: calculatedProfit
      };

      const result = await saveNewOrderAndSync(newOrder, dataset.webStore);
      onDatasetUpdate(result.dataset);
      setLastCreatedOrder(newOrder);

      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.6 },
        colors: ['#0f4b25', '#e68628', '#10b981']
      });

      showToast(
        result.syncedToCloud
          ? `¡Pedido #${newOrder.id} de ${newOrder.cliente} agregado al fondo de Ventas en "Copia de Yerbazo.ba"!`
          : `Guardado en la app, pero Google Sheet respondió: ${result.cloudMessage}`,
        result.syncedToCloud ? 'success' : 'warning'
      );

      // Reset form for next order
      setClientName('');
      setClientAddress('');
      setObservaciones('');
      setOrderItems([]);
      setIsPriceManuallyEdited(false);
      setCustomFinalPrice('');
      setIsNewClient(false);
    } catch (err) {
      showToast('Ocurrió un error al guardar el pedido.', 'warning');
    } finally {
      setIsSavingOrder(false);
    }
  };

  // ============================================================================
  // 1-TAP STATUS ACTIONS (ENTREGADO / PAGADO) & FULL ORDER EDITOR
  // ============================================================================
  const [editingOrder, setEditingOrder] = useState<SaleTransaction | null>(null);
  const [editCliente, setEditCliente] = useState('');
  const [editFecha, setEditFecha] = useState('');
  const [editPrecioFinal, setEditPrecioFinal] = useState('');
  const [editMedioPago, setEditMedioPago] = useState('Mercado Pago');
  const [editPago, setEditPago] = useState<'SI' | 'NO'>('NO');
  const [editEntregado, setEditEntregado] = useState<'SI' | 'NO'>('NO');
  const [editObservaciones, setEditObservaciones] = useState('');
  const [editItems, setEditItems] = useState<NewOrderItemInput[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const openEditOrderModal = (sale: SaleTransaction) => {
    if (onEditOrder) {
      onEditOrder(sale);
      return;
    }
    setEditingOrder(sale);
    setEditCliente(sale.cliente);
    setEditFecha(sale.fecha);
    setEditPrecioFinal(String(sale.precioFinal));
    setEditMedioPago(sale.medioPago || 'Mercado Pago');
    setEditPago(sale.pago === 'SI' ? 'SI' : 'NO');
    setEditEntregado(sale.entregado === 'SI' ? 'SI' : 'NO');
    setEditObservaciones(sale.observaciones || '');
    const mappedItems: NewOrderItemInput[] = sale.items.map(it => {
      const cat = dataset.stock.find(
        s => s.nombre.toLowerCase().trim() === it.producto.toLowerCase().trim()
      );
      return {
        producto: it.producto,
        cantidad: it.cantidad,
        precioVentaUnitario: cat ? cat.precioVenta : Math.round(sale.precioSistema / Math.max(1, sale.items.length)),
        precioCompraUnitario: cat ? cat.precioCompra : 0,
        stockRestanteAntes: cat ? cat.restantes + it.cantidad : parseInt(it.stockStatus || '0', 10) || 0
      };
    });
    setEditItems(mappedItems);
  };

  const editCalculatedSystemPrice = useMemo(() => {
    if (!editingOrder) return 0;
    const sum = editItems.reduce((acc, it) => acc + it.cantidad * it.precioVentaUnitario, 0);
    return sum > 0 ? sum : editingOrder.precioSistema;
  }, [editItems, editingOrder]);

  const editCalculatedCost = useMemo(() => {
    if (!editingOrder) return 0;
    const sum = editItems.reduce((acc, it) => acc + it.cantidad * it.precioCompraUnitario, 0);
    if (sum > 0) return sum;
    return Math.max(0, editingOrder.precioFinal - editingOrder.ganancia);
  }, [editItems, editingOrder]);

  const editFinalPriceNum = useMemo(() => {
    const n = parseFloat(editPrecioFinal.replace(/\./g, '').replace(',', '.'));
    return !isNaN(n) && n >= 0 ? Math.round(n) : 0;
  }, [editPrecioFinal]);

  const editCalculatedProfit = useMemo(() => {
    return editFinalPriceNum - editCalculatedCost;
  }, [editFinalPriceNum, editCalculatedCost]);

  const handleSaveEditedOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    setIsSavingEdit(true);
    try {
      const result = await updateOrderStatusAndSync(
        editingOrder.id,
        {
          rowIndex: editingOrder.rowIndex,
          cliente: editCliente.trim() || editingOrder.cliente,
          fecha: editFecha.trim() || editingOrder.fecha,
          precioSistema: editCalculatedSystemPrice,
          precioFinal: editFinalPriceNum,
          medioPago: editMedioPago,
          pago: editPago,
          entregado: editEntregado,
          observaciones: editObservaciones.trim(),
          items: editItems,
          ganancia: editCalculatedProfit
        },
        dataset.webStore
      );
      onDatasetUpdate(result.dataset);
      setEditingOrder(null);
      showToast(
        `¡Pedido #${editingOrder.id} de ${editCliente} modificado ($${editFinalPriceNum.toLocaleString('es-AR')})!${
          result.syncedToCloud ? ' Impactado en Google Sheet.' : ''
        }`,
        'success'
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleQuickStatusUpdate = async (
    sale: SaleTransaction,
    updates: { pago?: 'SI' | 'NO'; entregado?: 'SI' | 'NO'; medioPago?: string; precioFinal?: number }
  ) => {
    setBusyOrderId(sale.id);
    try {
      const result = await updateOrderStatusAndSync(
        sale.id,
        { ...updates, rowIndex: sale.rowIndex },
        dataset.webStore
      );
      onDatasetUpdate(result.dataset);

      if (updates.entregado === 'SI' || updates.pago === 'SI') {
        confetti({
          particleCount: 45,
          spread: 55,
          origin: { y: 0.7 },
          colors: ['#0f4b25', '#e68628', '#10b981']
        });
      }

      const actionsDesc: string[] = [];
      if (updates.entregado === 'SI') actionsDesc.push('marcado como ENTREGADO 📦');
      if (updates.entregado === 'NO') actionsDesc.push('devuelto a PENDIENTE DE ENTREGA ⏳');
      if (updates.pago === 'SI') actionsDesc.push('marcado como PAGADO 💰');
      if (updates.pago === 'NO') actionsDesc.push('devuelto a PENDIENTE DE PAGO ⚠️');
      if (updates.precioFinal !== undefined) actionsDesc.push(`precio final actualizado a $${updates.precioFinal.toLocaleString('es-AR')}`);

      showToast(
        `Pedido de ${sale.cliente} ${actionsDesc.join(' y ')}${result.syncedToCloud ? ' (Actualizado en Google Sheet)' : ''}`,
        'success'
      );
    } finally {
      setBusyOrderId(null);
    }
  };

  // Copy a SaleTransaction as a 27-col tab-separated row for Google Sheets paste
  const handleCopySaleRowForSheet = (sale: SaleTransaction) => {
    const payload: NewOrderPayload = {
      id: sale.id,
      cliente: sale.cliente,
      fecha: sale.fecha,
      precioSistema: sale.precioSistema || sale.precioFinal,
      precioFinal: sale.precioFinal,
      medioPago: sale.medioPago,
      pago: sale.pago === 'SI' ? 'SI' : 'NO',
      entregado: sale.entregado === 'SI' ? 'SI' : 'NO',
      observaciones: sale.observaciones || '',
      items: sale.items.map(it => ({
        producto: it.producto,
        cantidad: it.cantidad,
        precioVentaUnitario: 0,
        precioCompraUnitario: 0,
        stockRestanteAntes: parseInt(it.stockStatus || '0', 10) || 0
      })),
      mes: sale.mes,
      semana: sale.semana || 'Semana 1',
      ganancia: sale.ganancia
    };
    navigator.clipboard.writeText(buildTabSeparatedRow(payload));
    showToast(`Fila de ${sale.cliente} copiada. Pegala con Ctrl+V en la columna A de Ventas en Google Sheets.`, 'info');
  };

  // Generate WhatsApp message for Delivery or Payment
  const buildWhatsAppMessage = (sale: SaleTransaction, mode: 'delivery' | 'payment' | 'receipt') => {
    const firstName = sale.cliente.split(' ')[0] || sale.cliente;
    const itemsText = sale.items.map(i => `• ${i.cantidad}x ${i.producto}`).join('\n');
    const isPaid = sale.pago === 'SI';

    if (mode === 'delivery') {
      return `¡Hola ${firstName}! ¿Cómo estás? 🧉 Te escribo de *Yerbazo* para coordinar la entrega de tu pedido:\n\n${itemsText}\n\n💰 *Total:* $${sale.precioFinal.toLocaleString('es-AR')} (${isPaid ? 'Ya abonado ✅' : `Pendiente de pago - Alias MP: ${mpAlias}`})\n\n¿En qué horario te queda cómodo recibirlo?`;
    }
    if (mode === 'payment') {
      return `¡Hola ${firstName}! ¿Cómo va todo? 🧉 Te paso el recordatorio de tu pedido de *Yerbazo*:\n\n${itemsText}\n\n💰 *Total a abonar:* $${sale.precioFinal.toLocaleString('es-AR')}\n💳 *Alias Mercado Pago:* ${mpAlias}\n\n¡Muchas gracias por elegirnos! 🌿`;
    }
    return `🧾 *COMPROBANTE YERBAZO* 🌿\n👤 *Cliente:* ${sale.cliente}\n📅 *Fecha:* ${sale.fecha}\n\n🧉 *Pedido:*\n${itemsText}\n\n💰 *Total:* $${sale.precioFinal.toLocaleString('es-AR')}\n💳 *Pago:* ${isPaid ? 'ABONADO ✅' : `PENDIENTE (Alias: ${mpAlias})`}\n📦 *Entrega:* ${sale.entregado === 'SI' ? 'ENTREGADO ✅' : 'PENDIENTE DE ENTREGA ⏳'}\n\n¡Gracias por cebar con Yerbazo! 🧉✨`;
  };

  // Save & Test Google Apps Script URL
  const handleTestAndSaveScriptUrl = async () => {
    setAppsScriptUrl(scriptUrlInput);
    if (!scriptUrlInput.trim()) {
      showToast('URL de conector eliminada. Se usará modo local + exportación.', 'info');
      return;
    }
    setIsTestingScript(true);
    try {
      const res = await sendToGoogleAppsScript({ action: 'ping' });
      if (res.ok) {
        const syncRes = await syncPendingToGoogleSheets();
        showToast(`¡Conectado con éxito al Google Sheet! ${syncRes.message}`, 'success');
        onSyncSheets();
      } else {
        showToast(res.message, 'warning');
      }
    } finally {
      setIsTestingScript(false);
    }
  };

  // ============================================================================
  // RENDER HELPERS: PENDING DELIVERIES PANEL
  // ============================================================================
  const renderDeliveriesSection = () => (
    <div className="space-y-4">
      {/* Picking List / Bolso de Reparto */}
      {pickingList.length > 0 && (
        <div className="bg-gradient-to-br from-[#0f4b25] to-[#0a341a] text-[#ece7d7] rounded-3xl p-4 sm:p-5 shadow-lg border-2 border-[#e68628]/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/15">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#e68628] text-stone-950 flex items-center justify-center font-black shadow-sm shrink-0">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm sm:text-base text-white font-display flex items-center gap-2">
                  <span>Bolso de Reparto (Para Armar Hoy)</span>
                  <span className="bg-[#e68628] text-stone-950 text-[11px] font-black px-2 py-0.5 rounded-full">
                    {pickingList.reduce((a, b) => a + b.cantidad, 0)} u.
                  </span>
                </h3>
                <p className="text-[11px] text-[#ece7d7]/75">
                  Tocá cada producto a medida que lo guardás en el bolso o auto para las {filteredPendingDeliveries.length} entregas listadas
                </p>
              </div>
            </div>
            {Object.keys(checkedBagItems).length > 0 && (
              <button
                onClick={() => setCheckedBagItems({})}
                className="text-[11px] text-[#e68628] hover:underline font-bold self-start sm:self-auto cursor-pointer"
              >
                Reiniciar tilde
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-3">
            {pickingList.map((item) => {
              const checked = !!checkedBagItems[item.producto];
              return (
                <button
                  key={item.producto}
                  type="button"
                  onClick={() => setCheckedBagItems(prev => ({ ...prev, [item.producto]: !prev[item.producto] }))}
                  className={`flex items-center justify-between p-2.5 rounded-2xl border text-left transition-all cursor-pointer active:scale-98 ${
                    checked
                      ? 'bg-emerald-950/60 border-emerald-400/50 text-emerald-200 line-through opacity-75'
                      : 'bg-white/10 hover:bg-white/15 border-white/15 text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                      checked ? 'bg-emerald-500 text-stone-950' : 'bg-[#e68628] text-stone-950'
                    }`}>
                      {checked ? '✓' : `${item.cantidad}x`}
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-xs truncate capitalize">{item.producto}</div>
                      <div className="text-[10px] text-[#ece7d7]/65 truncate">
                        Para: {item.clientes.join(', ')}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Node / Zone Filters */}
      <div className="bg-white rounded-3xl p-4 border border-stone-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            {[
              { id: 'ALL', label: 'Todas las Zonas', count: pendingByNode.ALL },
              { id: 'uade', label: '🎓 UADE', count: pendingByNode.uade },
              { id: 'club', label: '🏉 Club / Rugby', count: pendingByNode.club },
              { id: 'mirador', label: '🏡 Mirador', count: pendingByNode.mirador },
              { id: 'devoto', label: '📍 Devoto / Beiró', count: pendingByNode.devoto },
              { id: 'otros', label: '📦 Domicilio', count: pendingByNode.otros }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setNodeFilter(tab.id as DeliveryNodeId)}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1.5 ${
                  nodeFilter === tab.id
                    ? 'bg-[#0f4b25] text-[#ece7d7] shadow-sm'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  nodeFilter === tab.id ? 'bg-[#e68628] text-stone-950' : 'bg-stone-200 text-stone-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente, dirección o yerba..."
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f4b25]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pending Deliveries Cards */}
      {filteredPendingDeliveries.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-stone-200 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h4 className="text-lg font-black text-stone-900 font-display">
            ¡No hay entregas pendientes en esta vista!
          </h4>
          <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
            Todos los pedidos están marcados como entregados. Podés cargar un pedido nuevo o revisar los cobros pendientes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPendingDeliveries.map(sale => {
            const clientInfo = clientMap.get(sale.cliente.toLowerCase().trim());
            const node = detectDeliveryNode(sale, clientInfo?.direccionEntrega);
            const isPaid = sale.pago === 'SI';
            const isBusy = busyOrderId === sale.id;

            return (
              <div
                key={sale.id}
                className={`bg-white rounded-3xl p-5 border-2 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 ${
                  !isPaid ? 'border-amber-400/90' : 'border-stone-200'
                }`}
              >
                {/* Top Header: Client, Zone, Payment Badge */}
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${node.color}`}>
                          {node.badge}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-stone-400 bg-stone-100 px-2 py-0.5 rounded-md">
                          #{sale.id} • {sale.fecha}
                        </span>
                        {sale.isLocalOrder && (
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                            {sale.syncedToSheet ? '☁️ En Sheet' : '📱 App'}
                          </span>
                        )}
                      </div>
                      <h4 className="text-lg font-black text-stone-900 font-display mt-1">
                        {sale.cliente}
                      </h4>
                    </div>

                    <div className="text-right shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditOrderModal(sale)}
                        title="Tocá para abrir pantalla completa y modificar cualquier detalle"
                        className="text-lg font-black text-[#0f4b25] hover:underline font-mono cursor-pointer"
                      >
                        ${sale.precioFinal.toLocaleString('es-AR')} ✏️
                      </button>
                      <div className="text-[10px] text-stone-500 font-semibold">
                        {sale.medioPago}
                      </div>
                    </div>
                  </div>

                  {/* Address & Observations */}
                  {(clientInfo?.direccionEntrega || sale.observaciones) && (
                    <div className="bg-stone-50 rounded-2xl p-2.5 border border-stone-200/80 text-xs space-y-1">
                      {clientInfo?.direccionEntrega && (
                        <div className="flex items-center space-x-1.5 text-stone-700 font-semibold">
                          <MapPin className="w-3.5 h-3.5 text-[#e68628] shrink-0" />
                          <span>{clientInfo.direccionEntrega}</span>
                          {clientInfo.comoNosConocio && (
                            <span className="text-[10px] text-stone-400">({clientInfo.comoNosConocio})</span>
                          )}
                        </div>
                      )}
                      {sale.observaciones && (
                        <div className="text-[11px] text-amber-900 font-medium pl-5">
                          📝 "{sale.observaciones}"
                        </div>
                      )}
                    </div>
                  )}

                  {/* Items to Deliver */}
                  <div className="bg-[#f7f5ed] rounded-2xl p-3 border border-stone-200/80 space-y-1.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-stone-500">
                      Productos a Entregar:
                    </div>
                    <div className="space-y-1">
                      {sale.items.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs font-bold text-stone-900">
                          <div className="flex items-center space-x-2">
                            <span className="w-6 h-6 rounded-lg bg-[#0f4b25] text-[#ece7d7] flex items-center justify-center font-black text-[11px]">
                              {it.cantidad}x
                            </span>
                            <span className="capitalize">{it.producto}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Alert Banner inside Delivery Card */}
                  {isPaid ? (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                      <span className="flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Pedido ya abonado ({sale.medioPago})</span>
                      </span>
                      <span className="text-[10px] uppercase font-black">Solo Entregar</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-extrabold">
                      <span className="flex items-center space-x-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>FALTA COBRAR ${sale.precioFinal.toLocaleString('es-AR')}</span>
                      </span>
                      <span className="text-[10px] uppercase font-black bg-rose-200/80 text-rose-950 px-2 py-0.5 rounded-full">
                        Pago Pendiente
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons (Mobile thumb-friendly) */}
                <div className="pt-2 border-t border-stone-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleQuickStatusUpdate(sale, { entregado: 'SI' })}
                    className="flex-1 py-3 px-4 rounded-2xl bg-[#0f4b25] hover:bg-[#155e30] text-white font-black text-xs shadow-md flex items-center justify-center space-x-2 transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>{isBusy ? 'Guardando...' : 'Marcar Entregado'}</span>
                  </button>

                  {!isPaid && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        handleQuickStatusUpdate(sale, {
                          entregado: 'SI',
                          pago: 'SI',
                          medioPago: sale.medioPago && sale.medioPago !== '-----' ? sale.medioPago : 'Efectivo'
                        })
                      }
                      className="flex-1 py-3 px-3.5 rounded-2xl bg-[#e68628] hover:bg-[#cf741b] text-stone-950 font-black text-xs shadow-md flex items-center justify-center space-x-1.5 transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                      title="Marca el pedido como Pagado y Entregado al mismo tiempo"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Cobrar + Entregar</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => openEditOrderModal(sale)}
                    title="Modificar pedido, precio final, productos o estado"
                    className="py-3 px-3.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-stone-700" />
                    <span>Modificar</span>
                  </button>

                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(buildWhatsAppMessage(sale, 'delivery'))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Coordinar entrega por WhatsApp"
                    className="py-3 px-3.5 rounded-2xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-700" />
                    <span className="sm:hidden">Coordinar por WhatsApp</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ============================================================================
  // RENDER HELPERS: UNPAID ORDERS (POR COBRAR)
  // ============================================================================
  const renderUnpaidSection = () => (
    <div className="space-y-4">
      {/* Alias Mercado Pago Quick Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-black shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm sm:text-base text-stone-900 font-display">
              Total Pendiente de Cobro: <span className="text-rose-600">${totalUnpaidAmount.toLocaleString('es-AR')}</span>
            </h3>
            <p className="text-xs text-stone-500">
              {unpaidOrders.length} pedido(s) aún figuran con PAGO = NO en el registro de Yerbazo
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-stone-50 p-2 rounded-2xl border border-stone-200">
          <span className="text-[11px] font-bold text-stone-500 pl-1">Alias MP:</span>
          <input
            type="text"
            value={mpAlias}
            onChange={e => setMpAlias(e.target.value)}
            className="bg-white border border-stone-300 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-stone-900 w-32 focus:outline-none focus:ring-2 focus:ring-[#0f4b25]"
          />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(mpAlias);
              setCopiedAlias(true);
              setTimeout(() => setCopiedAlias(false), 2000);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-[#0f4b25] text-[#ece7d7] text-xs font-bold flex items-center space-x-1 cursor-pointer"
          >
            {copiedAlias ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAlias ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>
      </div>

      {filteredUnpaidOrders.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-stone-200 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h4 className="text-lg font-black text-stone-900 font-display">
            ¡Todos los pedidos están cobrados al día!
          </h4>
          <p className="text-xs text-stone-500 mt-1">
            No tenés ventas pendientes de pago en este momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredUnpaidOrders.map(sale => {
            const isDelivered = sale.entregado === 'SI';
            const isBusy = busyOrderId === sale.id;
            const currentPayMethod =
              selectedPayMethodForOrder[sale.id] ||
              (sale.medioPago && sale.medioPago !== '-----' && sale.medioPago !== 'No especificado'
                ? sale.medioPago
                : 'Mercado Pago');

            return (
              <div
                key={sale.id}
                className="bg-white rounded-3xl p-5 border-2 border-rose-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 border border-rose-200">
                          💸 FALTA PAGAR
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                          isDelivered
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}>
                          {isDelivered ? '📦 Ya entregado' : '⏳ Aún sin entregar'}
                        </span>
                        <span className="text-[10px] font-mono text-stone-400">
                          #{sale.id} • {sale.fecha}
                        </span>
                      </div>
                      <h4 className="text-lg font-black text-stone-900 font-display mt-1">
                        {sale.cliente}
                      </h4>
                    </div>

                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => openEditOrderModal(sale)}
                        title="Tocá para modificar el precio final o el pedido"
                        className="text-xl font-black text-rose-600 hover:underline font-mono cursor-pointer"
                      >
                        ${sale.precioFinal.toLocaleString('es-AR')} ✏️
                      </button>
                      <div className="text-[10px] text-stone-400">
                        Ganancia: ${sale.ganancia.toLocaleString('es-AR')}
                      </div>
                    </div>
                  </div>

                  {/* Products */}
                  <div className="bg-stone-50 rounded-2xl p-3 border border-stone-200/80 space-y-1">
                    {sale.items.map((it, idx) => (
                      <div key={idx} className="text-xs font-bold text-stone-800 flex items-center space-x-2">
                        <span className="text-[#0f4b25] font-black">{it.cantidad}x</span>
                        <span className="capitalize">{it.producto}</span>
                      </div>
                    ))}
                    {sale.observaciones && (
                      <div className="text-[11px] text-stone-500 italic pt-1">
                        Nota: {sale.observaciones}
                      </div>
                    )}
                  </div>

                  {/* Payment Method Selector before confirming paid */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] font-bold text-stone-500">Medio de cobro:</span>
                    <div className="flex items-center gap-1.5">
                      {['Mercado Pago', 'Efectivo'].map(method => (
                        <button
                          key={method}
                          type="button"
                          onClick={() =>
                            setSelectedPayMethodForOrder(prev => ({ ...prev, [sale.id]: method }))
                          }
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                            currentPayMethod === method
                              ? 'bg-[#0f4b25] text-white shadow-2xs'
                              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-stone-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      handleQuickStatusUpdate(sale, {
                        pago: 'SI',
                        medioPago: currentPayMethod
                      })
                    }
                    className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md flex items-center justify-center space-x-2 transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isBusy ? 'Registrando...' : `Marcar Pagado (${currentPayMethod})`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditOrderModal(sale)}
                    title="Modificar pedido, precio final, productos o estado"
                    className="py-3 px-3.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-stone-700" />
                    <span>Modificar</span>
                  </button>

                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(buildWhatsAppMessage(sale, 'payment'))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-3.5 rounded-2xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                    title="Enviar recordatorio de pago con alias por WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4 text-amber-800" />
                    <span>Recordar Pago</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ============================================================================
  // RENDER HELPERS: NEW ORDER LOADER (CARGAR NUEVO PEDIDO)
  // ============================================================================
  const renderNewOrderForm = () => (
    <div className="space-y-5">
      {/* Last Created Order Quick Banner */}
      {lastCreatedOrder && (
        <div className="bg-emerald-950 text-[#ece7d7] rounded-3xl p-4 sm:p-5 border-2 border-emerald-400 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="bg-emerald-400 text-stone-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                ¡Recién Cargado!
              </span>
              <span className="font-mono text-xs text-emerald-300">#{lastCreatedOrder.id}</span>
            </div>
            <h4 className="font-black text-base text-white">
              {lastCreatedOrder.cliente} — ${lastCreatedOrder.precioFinal.toLocaleString('es-AR')}
            </h4>
            <p className="text-xs text-emerald-200/80">
              {lastCreatedOrder.items.map(i => `${i.cantidad}x ${i.producto}`).join(' + ')} • Ganancia: ${lastCreatedOrder.ganancia.toLocaleString('es-AR')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(buildTabSeparatedRow(lastCreatedOrder));
                setCopiedLastOrderRow(true);
                setTimeout(() => setCopiedLastOrderRow(false), 3000);
                showToast('¡Fila copiada! Podés pegarla con Ctrl+V directo en la columna A de Ventas en Google Sheets.', 'info');
              }}
              className="px-3.5 py-2 rounded-xl bg-[#e68628] hover:bg-[#cf741b] text-stone-950 font-black text-xs flex items-center space-x-1.5 cursor-pointer shadow-sm"
            >
              {copiedLastOrderRow ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLastOrderRow ? '¡Fila Copiada!' : 'Copiar Fila para Excel'}</span>
            </button>

            <button
              type="button"
              onClick={() => setLastCreatedOrder(null)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleCreateOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Client + Product Picker (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-5">
          {/* STEP 1: CLIENTE */}
          <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-[#0f4b25] text-[#ece7d7] text-xs font-black flex items-center justify-center">
                  1
                </span>
                <h3 className="font-extrabold text-sm sm:text-base text-stone-900 font-display">
                  Cliente y Dirección de Entrega
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setIsNewClient(!isNewClient)}
                className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  isNewClient
                    ? 'bg-[#e68628] text-stone-950'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isNewClient ? 'Modo Cliente Nuevo' : '+ Cliente Nuevo'}</span>
              </button>
            </div>

            {/* Client Autocomplete Input */}
            <div className="relative">
              <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                Nombre y Apellido del Cliente *
              </label>
              <div className="relative">
                <Users className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={clientName}
                  onFocus={() => setClientSearchOpen(true)}
                  onBlur={() => setTimeout(() => setClientSearchOpen(false), 180)}
                  onChange={e => {
                    setClientName(e.target.value);
                    setClientSearchOpen(true);
                  }}
                  placeholder="Escribí para buscar cliente habitual o cargar uno nuevo..."
                  className="w-full pl-10 pr-9 py-3 rounded-2xl border-2 border-stone-200 focus:border-[#0f4b25] focus:outline-none text-sm font-bold text-stone-900"
                />
                {clientName && (
                  <button
                    type="button"
                    onClick={() => {
                      setClientName('');
                      setClientAddress('');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {clientSearchOpen && clientSuggestions.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-stone-200 max-h-60 overflow-y-auto divide-y divide-stone-100">
                  {clientSuggestions.map(c => (
                    <button
                      key={c.cliente}
                      type="button"
                      onMouseDown={() => handleSelectSuggestionClient(c)}
                      className="w-full px-4 py-2.5 text-left hover:bg-[#f7f5ed] flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-xs text-stone-900">{c.cliente}</div>
                        <div className="text-[10px] text-stone-500">
                          📍 {c.direccionEntrega || 'Sin dirección'} • Canal: {c.comoNosConocio}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full">
                          {c.totalCompras} compras
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* If habitual client matched, show quick info & favorite yerbas */}
            {selectedClientRecord && (
              <div className="bg-[#f7f5ed] rounded-2xl p-3 border border-stone-200/90 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[#0f4b25] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Cliente registrado ({selectedClientRecord.totalCompras} compras • {selectedClientRecord.clubMateroNivel})</span>
                  </span>
                  {selectedClientRecord.saldoDeuda > 0 && (
                    <span className="bg-rose-100 text-rose-800 font-black text-[10px] px-2 py-0.5 rounded-full">
                      ⚠️ Tiene deuda previa: ${selectedClientRecord.saldoDeuda.toLocaleString('es-AR')}
                    </span>
                  )}
                </div>

                {selectedClientRecord.productosFavoritos.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-stone-500">Sus favoritas (tocá para sumar):</span>
                    {selectedClientRecord.productosFavoritos.map(fav => {
                      const catProd = dataset.stock.find(
                        s => s.nombre.toLowerCase().trim() === fav.toLowerCase().trim()
                      );
                      if (!catProd) return null;
                      return (
                        <button
                          key={fav}
                          type="button"
                          onClick={() => handleAddProductToOrder(catProd)}
                          className="px-2.5 py-1 rounded-xl bg-white hover:bg-[#0f4b25] hover:text-white border border-stone-300 text-[11px] font-bold text-stone-800 transition-colors cursor-pointer"
                        >
                          + {catProd.nombre}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Address & Channel inputs (always editable, highlighted when new client) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                  Dirección / Zona de Entrega
                </label>
                <input
                  type="text"
                  value={clientAddress}
                  onChange={e => setClientAddress(e.target.value)}
                  placeholder="Ej: UADE, Club, Mirador, Pedro Morán 3484..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0f4b25]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                  ¿Cómo nos conoció? (Pestaña Clientes)
                </label>
                <select
                  value={clientChannel}
                  onChange={e => setClientChannel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4b25]"
                >
                  <option value="Un amigo">Un amigo / Recomendación</option>
                  <option value="Club">Club / Rugby</option>
                  <option value="UADE">UADE / Facultad</option>
                  <option value="Mirador">Mirador</option>
                  <option value="Familiar">Familiar</option>
                  <option value="Instagram / Web">Instagram / Web yerbazo.com.ar</option>
                  <option value="Directo">Directo</option>
                </select>
              </div>
            </div>
          </div>

          {/* STEP 2: PRODUCTOS DEL CATÁLOGO */}
          <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-[#0f4b25] text-[#ece7d7] text-xs font-black flex items-center justify-center">
                  2
                </span>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-stone-900 font-display">
                    Elegir Productos del Catálogo ({orderItems.length}/5 variedades)
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Tocá cualquier producto para sumarlo al pedido con su precio y stock actual
                  </p>
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {(['TODOS', '1 KG', '500 G', 'Stock myb', 'Accesorios'] as const).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setProductCatFilter(cat)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer transition-all shrink-0 ${
                      productCatFilter === cat
                        ? 'bg-[#0f4b25] text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {cat === 'Stock myb' ? '🧉 Stock myb' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Filtrar yerba o accesorio (ej: Baldo, Canarias, Serena, Rei Verde, Pico)..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f4b25]"
              />
            </div>

            {/* Product Grid (Thumb-friendly buttons) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
              {filteredCatalog.map(prod => {
                const inCart = orderItems.find(i => i.producto.toLowerCase() === prod.nombre.toLowerCase());
                const outOfStock = prod.restantes <= 0;

                return (
                  <div
                    key={prod.id}
                    onClick={() => handleAddProductToOrder(prod)}
                    className={`p-3 rounded-2xl border-2 transition-all cursor-pointer select-none flex items-center justify-between gap-2 ${
                      inCart
                        ? 'bg-[#0f4b25]/5 border-[#0f4b25] shadow-xs'
                        : outOfStock
                        ? 'bg-stone-50 border-stone-200 opacity-60 hover:opacity-100'
                        : 'bg-white hover:bg-[#f7f5ed] border-stone-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-extrabold text-xs text-stone-900 capitalize truncate">
                        {prod.nombre}
                      </div>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-xs font-black text-[#0f4b25] font-mono">
                          ${prod.precioVenta.toLocaleString('es-AR')}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                          prod.restantes <= 0
                            ? 'bg-rose-100 text-rose-700'
                            : prod.restantes <= 4
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          Stock: {prod.restantes}
                        </span>
                      </div>
                    </div>

                    {inCart ? (
                      <div
                        className="flex items-center space-x-1.5 bg-[#0f4b25] text-white rounded-xl p-1 shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQty(inCart.producto, -1)}
                          className="w-6 h-6 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center font-black text-sm cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-black text-xs px-1.5">{inCart.cantidad}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQty(inCart.producto, 1)}
                          className="w-6 h-6 rounded-lg bg-[#e68628] text-stone-950 flex items-center justify-center font-black text-sm cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-stone-100 text-[#0f4b25] flex items-center justify-center font-black text-base shrink-0">
                        +
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary, Price/Profit Calculator & Status (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-3xl p-5 border-2 border-[#0f4b25] shadow-md space-y-4 sticky top-24">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-[#e68628] text-stone-950 text-xs font-black flex items-center justify-center">
                  3
                </span>
                <h3 className="font-black text-base text-stone-900 font-display">
                  Resumen, Calculadora & Estado
                </h3>
              </div>
              {orderItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOrderItems([])}
                  className="text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
                >
                  Vaciar ({orderItems.reduce((a, b) => a + b.cantidad, 0)} u.)
                </button>
              )}
            </div>

            {/* Selected Items Slots (Yerba 1 .. Yerba 5) */}
            {orderItems.length === 0 ? (
              <div className="bg-[#f7f5ed] rounded-2xl p-6 text-center border border-dashed border-stone-300">
                <Package className="w-7 h-7 text-stone-400 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-stone-600">
                  Aún no agregaste productos al pedido
                </p>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Tocá los productos de la lista para calcular precio y ganancia automáticamente
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {orderItems.map((it, idx) => (
                  <div
                    key={it.producto}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-[#f7f5ed] border border-stone-200 text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="text-[10px] font-black text-stone-400 uppercase block">
                        Yerba {idx + 1} (Stock rest.: {Math.max(0, it.stockRestanteAntes - it.cantidad)})
                      </span>
                      <span className="font-extrabold text-stone-900 capitalize truncate block">
                        {it.producto}
                      </span>
                      <span className="text-[11px] text-stone-500 font-mono">
                        ${it.precioVentaUnitario.toLocaleString('es-AR')} c/u → Subtotal: ${(it.cantidad * it.precioVentaUnitario).toLocaleString('es-AR')}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateItemQty(it.producto, -1)}
                        className="w-7 h-7 rounded-xl bg-white border border-stone-300 font-black text-stone-700 hover:bg-stone-100 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-black text-sm text-stone-900">
                        {it.cantidad}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateItemQty(it.producto, 1)}
                        className="w-7 h-7 rounded-xl bg-[#0f4b25] text-white font-black hover:bg-[#155e30] cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Price & Profit Live Calculator */}
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-500 font-bold">Precio Sistema (Lista):</span>
                <span className="font-mono font-bold text-stone-800">
                  ${calculatedSystemPrice.toLocaleString('es-AR')}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-black text-stone-900 uppercase">
                    Precio Final a Cobrar ($)
                  </label>
                  <div className="flex items-center gap-1">
                    {[
                      { label: 'Lista', pct: 0 },
                      { label: '-5%', pct: 5 },
                      { label: '-10%', pct: 10 }
                    ].map(btn => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => applyQuickDiscount(btn.pct)}
                        className="px-2 py-0.5 rounded-lg bg-stone-200 hover:bg-[#e68628] hover:text-stone-950 text-[10px] font-bold text-stone-700 transition-colors cursor-pointer"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  value={customFinalPrice}
                  onChange={e => {
                    setIsPriceManuallyEdited(true);
                    setCustomFinalPrice(e.target.value);
                  }}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#0f4b25]/40 focus:border-[#0f4b25] bg-white font-mono font-black text-lg text-[#0f4b25] focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-stone-500 font-bold block">Ganancia Neta (Columna AA):</span>
                  <span className="text-[10px] text-stone-400">
                    Costo mercadería: ${calculatedTotalCost.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="text-right">
                  <span className={`font-mono font-black text-base ${
                    calculatedProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    ${calculatedProfit.toLocaleString('es-AR')}
                  </span>
                  <span className="block text-[10px] font-bold text-stone-500">
                    Margen: {calculatedMarginPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Payment, Delivery & Date Controls */}
            <div className="space-y-3">
              {/* Medio de Pago */}
              <div>
                <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1.5">
                  Medio de Pago
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Mercado Pago', 'Efectivo', '-----'] as const).map(mp => (
                    <button
                      key={mp}
                      type="button"
                      onClick={() => setMedioPago(mp)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                        medioPago === mp
                          ? 'bg-[#0f4b25] text-white border-[#0f4b25] shadow-xs'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {mp === '-----' ? 'Sin definir' : mp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Estado de Pago & Entrega (2x2 touch switches) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1.5">
                    ¿Ya fue Pagado? (PAGO)
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-stone-100 p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setPagoStatus('NO')}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        pagoStatus === 'NO'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      NO (Debe)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPagoStatus('SI')}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        pagoStatus === 'SI'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      SÍ (Pagó)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1.5">
                    ¿Entregado? (ENTREGADO)
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-stone-100 p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setEntregadoStatus('NO')}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        entregadoStatus === 'NO'
                          ? 'bg-amber-500 text-stone-950 shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      NO (Pend.)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntregadoStatus('SI')}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        entregadoStatus === 'SI'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      SÍ (Listo)
                    </button>
                  </div>
                </div>
              </div>

              {/* Fecha y Observaciones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                    Fecha del Pedido
                  </label>
                  <input
                    type="date"
                    value={orderDateIso}
                    onChange={e => setOrderDateIso(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0f4b25]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                    Observaciones / Nota
                  </label>
                  <input
                    type="text"
                    value={observaciones}
                    onChange={e => setObservaciones(e.target.value)}
                    placeholder="Ej: Entregar jueves en UADE"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0f4b25]"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSavingOrder || orderItems.length === 0}
              className="w-full py-4 px-5 rounded-2xl bg-[#0f4b25] hover:bg-[#145e2f] disabled:bg-stone-300 text-[#ece7d7] font-black text-sm shadow-xl flex items-center justify-center space-x-2 transition-transform active:scale-98 cursor-pointer"
            >
              <PlusCircle className="w-5 h-5 text-[#e68628]" />
              <span>
                {isSavingOrder
                  ? 'Agregando fila en hoja Ventas...'
                  : `Agregar Nueva Fila en Hoja Ventas ($${finalPriceNumber.toLocaleString('es-AR')})`}
              </span>
            </button>
          </div>
        </div>
      </form>

      {/* LIVE 27-COLUMN PREVIEW OF THE NEW ROW IN SHEET "Ventas" */}
      {(() => {
        const { displayDate, mes, semana } = computeMonthAndWeekFromDate(orderDateIso);
        const previewOrder: NewOrderPayload =
          orderItems.length > 0 || clientName.trim()
            ? {
                id: 'YB-NUEVO',
                cliente: clientName.trim() || '(Nombre del Cliente)',
                esClienteNuevo: isNewClient || !selectedClientRecord,
                comoNosConocio: clientChannel || 'Directo',
                direccionEntrega: clientAddress.trim(),
                fecha: displayDate,
                precioSistema: calculatedSystemPrice,
                precioFinal: finalPriceNumber,
                medioPago: pagoStatus === 'NO' && medioPago === '-----' ? '-----' : medioPago,
                pago: pagoStatus,
                entregado: entregadoStatus,
                observaciones: observaciones.trim(),
                items: orderItems,
                mes,
                semana,
                ganancia: calculatedProfit
              }
            : lastCreatedOrder || {
                id: 'YB-EJEMPLO',
                cliente: 'Cliente Ejemplo',
                esClienteNuevo: false,
                comoNosConocio: 'Directo',
                direccionEntrega: '',
                fecha: displayDate,
                precioSistema: 0,
                precioFinal: 0,
                medioPago: medioPago,
                pago: pagoStatus,
                entregado: entregadoStatus,
                observaciones: '',
                items: [],
                mes,
                semana,
                ganancia: 0
              };

        const rowCells = buildGoogleSheetNativeRowFromOrder(previewOrder);
        const nextSheetRowNumber = dataset.ventas.length + 2; // Row 1 is header

        return (
          <div className="bg-white rounded-3xl p-5 border-2 border-stone-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-[#0f4b25] flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center flex-wrap gap-2">
                    <h4 className="font-black text-xs sm:text-sm text-stone-900 font-display">
                      Vista Previa de la Nueva Fila en Hoja <code className="bg-emerald-50 text-[#0f4b25] px-1.5 py-0.5 rounded font-mono">Ventas</code> (Fila #{nextSheetRowNumber} • 27 Columnas A → AA)
                    </h4>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      getAppsScriptUrl()
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}>
                      {getAppsScriptUrl()
                        ? '✅ Escritura automática en Google Sheet activa'
                        : '⚡ Sincronizado en Nube Yerbazo + 1 clic para Google Sheet'}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Al tocar <strong>"Agregar Nueva Fila en Hoja Ventas"</strong> se inserta esta fila exacta con las 27 columnas oficiales (incluyendo las 5 ranuras de Yerba/Stock/Cantidad, Mes, Semana y Ganancia).
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(buildTabSeparatedRow(previewOrder));
                    showToast('¡Fila de 27 columnas copiada! Podés pegarla con Ctrl+V en la columna A de la hoja Ventas.', 'info');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Fila (A→AA)</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportMergedDatasetToExcel(dataset)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#0f4b25] border border-emerald-200 font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Descargar Excel (.xlsx)</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-stone-300 bg-stone-50">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-stone-200/80 text-stone-600 font-mono text-[10px] border-b border-stone-300">
                    <th className="py-1 px-2 text-center border-r border-stone-300 bg-stone-300/60">Fila</th>
                    {EXCEL_COL_LETTERS.map((letter, idx) => (
                      <th key={letter} className="py-1 px-2.5 text-center border-r border-stone-300 font-bold">
                        {letter}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-[#0f4b25] text-[#ece7d7] font-extrabold whitespace-nowrap border-b border-stone-300">
                    <th className="py-2 px-2 text-center border-r border-white/15 font-mono text-[10px]">#</th>
                    {VENTAS_SHEET_HEADERS.map((hdr, idx) => (
                      <th key={idx} className="py-2 px-2.5 border-r border-white/15">
                        {hdr}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white font-mono whitespace-nowrap text-stone-900">
                    <td className="py-2.5 px-2 text-center font-bold bg-stone-100 border-r border-stone-200 text-stone-500">
                      {nextSheetRowNumber}
                    </td>
                    {rowCells.map((val, idx) => {
                      const isCurrencyCol = idx === 3 || idx === 4 || idx === 26; // Precio sistema, Precio final, Ganancia
                      const isStatusCol = idx === 6 || idx === 8; // PAGO, ENTREGADO
                      const displayVal =
                        val === '' || val === null || val === undefined
                          ? '—'
                          : isCurrencyCol && typeof val === 'number'
                          ? `$${val.toLocaleString('es-AR')}`
                          : String(val);

                      return (
                        <td
                          key={idx}
                          className={`py-2.5 px-2.5 border-r border-stone-200 ${
                            val === '' ? 'text-stone-300' : 'font-bold'
                          } ${
                            isCurrencyCol ? 'text-[#0f4b25] bg-emerald-50/40' : ''
                          } ${
                            isStatusCol && val === 'SI'
                              ? 'text-emerald-700 bg-emerald-50'
                              : isStatusCol && val === 'NO'
                              ? 'text-rose-700 bg-rose-50'
                              : ''
                          }`}
                        >
                          {displayVal}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );

  // ============================================================================
  // RENDER HELPERS: RECENT ORDERS & QUICK TOGGLE TABLE
  // ============================================================================
  const renderRecentOrdersSection = () => (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-base text-stone-900 font-display">
            Últimos 25 Pedidos (Cambio Rápido de Estado & Copiar Fila)
          </h3>
          <p className="text-xs text-stone-500">
            Tocá cualquier botón de Pago o Entrega para alternar entre SÍ y NO al instante, o copiá la fila lista para pegar en Google Sheets
          </p>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar pedido o cliente..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f4b25]"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#f7f5ed] text-stone-700 font-extrabold uppercase text-[11px] border-b border-stone-200">
            <tr>
              <th className="py-3 px-3">ID / Fecha</th>
              <th className="py-3 px-3">Cliente</th>
              <th className="py-3 px-3">Productos</th>
              <th className="py-3 px-3">Total / Ganancia</th>
              <th className="py-3 px-3 text-center">Estado Pago (1 clic)</th>
              <th className="py-3 px-3 text-center">Estado Entrega (1 clic)</th>
              <th className="py-3 px-3 text-right">Acciones Sheet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {recentOrders.map(v => {
              const isPaid = v.pago === 'SI';
              const isDelivered = v.entregado === 'SI';
              return (
                <tr key={v.id} className="hover:bg-stone-50">
                  <td className="py-3 px-3 font-mono">
                    <div className="font-bold text-stone-800">#{v.id}</div>
                    <div className="text-[10px] text-stone-400">{v.fecha}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-stone-900">{v.cliente}</div>
                    <div className="text-[10px] text-stone-500">{v.medioPago}</div>
                  </td>
                  <td className="py-3 px-3 max-w-[220px]">
                    <div className="truncate font-medium text-stone-800">
                      {v.items.map(i => `${i.cantidad}x ${i.producto}`).join(', ')}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono">
                    <button
                      type="button"
                      onClick={() => openEditOrderModal(v)}
                      title="Tocá para modificar el precio final o cualquier detalle del pedido"
                      className="font-black text-stone-900 hover:text-[#0f4b25] hover:underline cursor-pointer"
                    >
                      ${v.precioFinal.toLocaleString('es-AR')} ✏️
                    </button>
                    <div className="text-[10px] text-emerald-700 font-bold">+${v.ganancia.toLocaleString('es-AR')}</div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleQuickStatusUpdate(v, { pago: isPaid ? 'NO' : 'SI' })}
                      className={`px-3 py-1.5 rounded-xl font-black text-[11px] cursor-pointer transition-all ${
                        isPaid
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                      }`}
                    >
                      {isPaid ? '✅ PAGADO (SI)' : '⚠️ IMPAGO (NO)'}
                    </button>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleQuickStatusUpdate(v, { entregado: isDelivered ? 'NO' : 'SI' })}
                      className={`px-3 py-1.5 rounded-xl font-black text-[11px] cursor-pointer transition-all ${
                        isDelivered
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                      }`}
                    >
                      {isDelivered ? '📦 ENTREGADO (SI)' : '⏳ PENDIENTE (NO)'}
                    </button>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        type="button"
                        onClick={() => openEditOrderModal(v)}
                        title="Modificar pedido, precio final, productos o estado"
                        className="px-2.5 py-1.5 rounded-xl bg-[#e68628]/20 hover:bg-[#e68628] text-stone-950 font-black text-[11px] flex items-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Modificar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopySaleRowForSheet(v)}
                        title="Copiar fila con las 27 columnas lista para pegar en Google Sheets"
                        className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-[#0f4b25] hover:text-white text-stone-700 font-bold text-[11px] flex items-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Fila</span>
                      </button>
                      {v.isLocalOrder && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = deleteLocalOrder(v.id, dataset.webStore);
                            onDatasetUpdate(updated);
                            showToast(`Pedido local #${v.id} eliminado.`, 'info');
                          }}
                          title="Eliminar pedido local"
                          className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-16 md:pb-4">
      {/* Floating Toast */}
      {toast && (
        <div
          className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl border-2 flex items-center space-x-2.5 text-xs font-extrabold max-w-md animate-in fade-in slide-in-from-bottom-4 ${
            toast.type === 'warning'
              ? 'bg-amber-950 text-amber-100 border-amber-400'
              : 'bg-[#0f4b25] text-[#ece7d7] border-[#e68628]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-[#e68628] shrink-0" />
          <span>{toast.text}</span>
        </div>
      )}

      {/* Top Hero Banner: Ultra-compact on mobile (< md) so orders appear immediately, rich on desktop (md+) */}
      <div className="bg-[#0f4b25] text-white rounded-2xl sm:rounded-3xl p-3 sm:p-6 shadow-md sm:shadow-xl border-b-2 sm:border-b-4 border-[#e68628]">
        {/* Mobile-only compact status bar (1 single line instead of giant hero text) */}
        <div className="flex md:hidden items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-white/10">
          <button
            type="button"
            onClick={() => setIsScriptModalOpen(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#0a341a] text-[#ece7d7] text-[11px] font-bold border border-[#e68628]/40 cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{getAppsScriptUrl() ? 'Sheets: Conectado' : 'Conectar Sheets'}</span>
            {pendingCloudCount > 0 && (
              <span className="bg-[#e68628] text-stone-950 text-[10px] font-black px-1.5 rounded-full">
                {pendingCloudCount}
              </span>
            )}
          </button>

          <a
            href="https://docs.google.com/spreadsheets/d/15hjl5YFZqSFRGuh1IEv7zHDRXrQPPfvRU8dijVOmWPY/edit?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/10 text-[#ece7d7] text-[11px] font-bold"
          >
            <FileSpreadsheet className="w-3 h-3 text-emerald-300" />
            <span>Ver Excel</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-70" />
          </a>
        </div>

        {/* Desktop-only hero title & buttons */}
        <div className="hidden md:flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div>
            <div className="inline-flex items-center space-x-2 bg-[#e68628] text-stone-950 font-black text-[11px] uppercase px-3 py-1 rounded-full mb-2 shadow-xs">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Centro Operativo Móvil & PC • Yerbazo</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black font-display tracking-tight text-[#ece7d7]">
              Control de Entregas, Cobros Pendientes y Carga de Pedidos
            </h2>
            <p className="text-xs sm:text-sm text-[#ece7d7]/80 mt-0.5">
              Revisá qué pedidos faltan entregar, cuáles faltan cobrar y cargá o modificá ventas directo en el Excel de Yerbazo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Desktop Split View Toggle */}
            <button
              type="button"
              onClick={() => setDesktopSplitMode(!desktopSplitMode)}
              className={`hidden xl:flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                desktopSplitMode
                  ? 'bg-[#e68628] text-stone-950 border-[#e68628]'
                  : 'bg-white/10 text-[#ece7d7] border-white/20 hover:bg-white/20'
              }`}
              title="Ver el Cargador de Pedidos y la Lista de Pendientes lado a lado en pantalla grande"
            >
              <Columns className="w-4 h-4" />
              <span>{desktopSplitMode ? 'Vista Dividida Activa' : 'Modo Pantalla Dividida PC'}</span>
            </button>

            {/* Google Sheets Write Connector Config Button */}
            <button
              type="button"
              onClick={() => setIsScriptModalOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#0a341a] hover:bg-black/40 text-[#ece7d7] text-xs font-bold border border-[#e68628]/50 cursor-pointer transition-colors"
            >
              <Settings className="w-3.5 h-3.5 text-[#e68628]" />
              <span>
                {getAppsScriptUrl() ? '☁️ Sheets Escritura: Conectado' : '⚙️ Conectar Escritura Google Sheet'}
              </span>
              {pendingCloudCount > 0 && (
                <span className="bg-[#e68628] text-stone-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {pendingCloudCount}
                </span>
              )}
            </button>

            {/* Open Official Google Sheet */}
            <a
              href="https://docs.google.com/spreadsheets/d/15hjl5YFZqSFRGuh1IEv7zHDRXrQPPfvRU8dijVOmWPY/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#ece7d7] text-xs font-bold transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
              <span>Abrir Excel</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          </div>
        </div>

        {/* 4 Interactive Mode Switcher Cards (Compact on mobile, spacious on desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5">
          {/* Card 1: Pendientes de Entregar */}
          <button
            type="button"
            onClick={() => {
              setDesktopSplitMode(false);
              setSubView('entregas');
            }}
            className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all cursor-pointer border-2 flex flex-col justify-between ${
              subView === 'entregas' && !desktopSplitMode
                ? 'bg-[#ece7d7] text-[#0f4b25] border-[#e68628] shadow-md'
                : 'bg-[#0a341a]/90 text-[#ece7d7] border-white/10 hover:bg-[#0a341a]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider opacity-85">
                📦 Por Entregar
              </span>
              <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#e68628]" />
            </div>
            <div className="mt-1 sm:mt-2 flex items-baseline space-x-1.5">
              <span className="text-lg sm:text-3xl font-black font-mono leading-none">
                {pendingDeliveries.length}
              </span>
              <span className="text-[10px] sm:text-xs font-bold opacity-80 truncate">
                ped. ({totalPendingPackages} u.)
              </span>
            </div>
          </button>

          {/* Card 2: Pendientes de Pago */}
          <button
            type="button"
            onClick={() => {
              setDesktopSplitMode(false);
              setSubView('cobros');
            }}
            className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all cursor-pointer border-2 flex flex-col justify-between ${
              subView === 'cobros' && !desktopSplitMode
                ? 'bg-[#ece7d7] text-[#0f4b25] border-[#e68628] shadow-md'
                : 'bg-[#0a341a]/90 text-[#ece7d7] border-white/10 hover:bg-[#0a341a]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider opacity-85">
                💸 Por Cobrar
              </span>
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
            </div>
            <div className="mt-1 sm:mt-2 flex items-baseline justify-between w-full gap-1">
              <span className="text-base sm:text-2xl font-black font-mono leading-none truncate">
                ${totalUnpaidAmount.toLocaleString('es-AR')}
              </span>
              <span className="text-[10px] font-extrabold bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded-full shrink-0">
                {unpaidOrders.length}
              </span>
            </div>
          </button>

          {/* Card 3: Cargar Nuevo Pedido (Opens Full-Screen Order Builder) */}
          <button
            type="button"
            onClick={() => {
              if (onOpenNewOrder) {
                onOpenNewOrder();
              } else {
                setDesktopSplitMode(false);
                setSubView('nuevo');
              }
            }}
            className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all cursor-pointer border-2 flex flex-col justify-between ${
              subView === 'nuevo' && !desktopSplitMode
                ? 'bg-[#e68628] text-stone-950 border-white shadow-md'
                : 'bg-[#e68628] text-stone-950 border-white/40 hover:brightness-105 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
                ➕ Nuevo Pedido
              </span>
              <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="mt-1 sm:mt-2 flex items-baseline justify-between">
              <span className="text-sm sm:text-lg font-black leading-tight">
                Pantalla Completa
              </span>
              <span className="hidden sm:inline text-[11px] font-bold opacity-80">
                Directo a Sheets
              </span>
            </div>
          </button>

          {/* Card 4: Recientes / Historial */}
          <button
            type="button"
            onClick={() => {
              setDesktopSplitMode(false);
              setSubView('recientes');
            }}
            className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all cursor-pointer border-2 flex flex-col justify-between ${
              subView === 'recientes' && !desktopSplitMode
                ? 'bg-[#ece7d7] text-[#0f4b25] border-[#e68628] shadow-md'
                : 'bg-[#0a341a]/90 text-[#ece7d7] border-white/10 hover:bg-[#0a341a]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider opacity-85">
                🕒 Recientes
              </span>
              <ClipboardCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            </div>
            <div className="mt-1 sm:mt-2 flex items-baseline justify-between">
              <span className="text-sm sm:text-xl font-black font-mono leading-tight">
                {dataset.ventas.length} ventas
              </span>
              <span className="text-[10px] font-bold opacity-75 hidden sm:inline">
                Editar
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Main Content Area: Either Split Mode (Desktop) or Selected Sub-View */}
      {desktopSplitMode ? (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs text-amber-950 font-bold">
            <span>🖥️ Vista de Escritorio Completa: Cargador de Nuevos Pedidos arriba + Entregas y Cobros Pendientes abajo</span>
            <button
              type="button"
              onClick={() => setDesktopSplitMode(false)}
              className="underline cursor-pointer"
            >
              Volver a vista por pestañas
            </button>
          </div>
          {renderNewOrderForm()}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-4 border-t border-stone-300">
            <div>
              <h3 className="text-lg font-black text-stone-900 font-display mb-3">
                📦 Pedidos Pendientes de Entrega ({pendingDeliveries.length})
              </h3>
              {renderDeliveriesSection()}
            </div>
            <div>
              <h3 className="text-lg font-black text-stone-900 font-display mb-3">
                💸 Pedidos Pendientes de Cobro ({unpaidOrders.length})
              </h3>
              {renderUnpaidSection()}
            </div>
          </div>
        </div>
      ) : (
        <>
          {subView === 'entregas' && renderDeliveriesSection()}
          {subView === 'cobros' && renderUnpaidSection()}
          {subView === 'nuevo' && renderNewOrderForm()}
          {subView === 'recientes' && renderRecentOrdersSection()}
        </>
      )}

      {/* MODAL: Editar / Modificar Pedido Existente (Precio Final, Productos, Cliente, Estado) */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditedOrder}
            className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border-4 border-[#0f4b25] max-h-[92vh] overflow-y-auto space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-stone-200 pb-3">
              <div>
                <span className="bg-[#e68628] text-stone-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                  Modificar Pedido #{editingOrder.id} • Fila #{editingOrder.rowIndex + 1} en Ventas
                </span>
                <h3 className="text-lg sm:text-xl font-black text-stone-900 font-display mt-1">
                  Editar Detalles, Precio Final y Estado
                </h3>
                <p className="text-xs text-stone-500">
                  Cualquier cambio que guardes acá actualiza automáticamente la fila en la hoja <strong>Ventas</strong> y recalcula la ganancia.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                  Cliente (Columna A)
                </label>
                <input
                  type="text"
                  required
                  value={editCliente}
                  onChange={e => setEditCliente(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#0f4b25]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                  Fecha (Columna C)
                </label>
                <input
                  type="text"
                  value={editFecha}
                  onChange={e => setEditFecha(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#0f4b25]"
                />
              </div>
            </div>

            {/* Productos del pedido (Cantidades editables) */}
            <div className="bg-[#f7f5ed] rounded-2xl p-3.5 border border-stone-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-stone-700">
                  Productos del Pedido (Columnas J → X)
                </span>
                <span className="text-[11px] font-mono text-stone-500">
                  Precio Sistema: ${editCalculatedSystemPrice.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="space-y-1.5">
                {editItems.map((it, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-stone-200 text-xs"
                  >
                    <span className="font-bold text-stone-900 capitalize truncate pr-2">
                      {it.producto}
                    </span>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const next = editItems
                            .map((item, i) =>
                              i === idx ? { ...item, cantidad: item.cantidad - 1 } : item
                            )
                            .filter(item => item.cantidad > 0);
                          if (next.length > 0) {
                            setEditItems(next);
                            const newSys = next.reduce(
                              (a, b) => a + b.cantidad * b.precioVentaUnitario,
                              0
                            );
                            if (newSys > 0) setEditPrecioFinal(String(newSys));
                          }
                        }}
                        className="w-6 h-6 rounded-lg bg-stone-100 hover:bg-stone-200 font-black text-stone-700 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-black">{it.cantidad}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = editItems.map((item, i) =>
                            i === idx ? { ...item, cantidad: item.cantidad + 1 } : item
                          );
                          setEditItems(next);
                          const newSys = next.reduce(
                            (a, b) => a + b.cantidad * b.precioVentaUnitario,
                            0
                          );
                          if (newSys > 0) setEditPrecioFinal(String(newSys));
                        }}
                        className="w-6 h-6 rounded-lg bg-[#0f4b25] text-white font-black cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Precio Final & Ganancia */}
            <div className="bg-stone-50 rounded-2xl p-4 border-2 border-[#0f4b25]/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-stone-900 uppercase">
                  Precio Final Cobrado ($) — Columna E
                </label>
                <div className="flex items-center gap-1">
                  {[
                    { label: 'Lista', pct: 0 },
                    { label: '-5%', pct: 5 },
                    { label: '-10%', pct: 10 }
                  ].map(b => (
                    <button
                      key={b.label}
                      type="button"
                      onClick={() => {
                        if (editCalculatedSystemPrice > 0) {
                          setEditPrecioFinal(
                            String(Math.round((editCalculatedSystemPrice * (100 - b.pct)) / 100))
                          );
                        }
                      }}
                      className="px-2 py-0.5 rounded-lg bg-stone-200 hover:bg-[#e68628] text-[10px] font-bold text-stone-800 cursor-pointer"
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                required
                value={editPrecioFinal}
                onChange={e => setEditPrecioFinal(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#0f4b25] bg-white font-mono font-black text-lg text-[#0f4b25] focus:outline-none"
              />
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-stone-500 font-bold">
                  Ganancia Recalculada (Columna AA):
                </span>
                <span className={`font-mono font-black text-sm ${
                  editCalculatedProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}>
                  ${editCalculatedProfit.toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* Medio de pago, PAGO, ENTREGADO y Observaciones */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                  Medio de Pago (Col F)
                </label>
                <select
                  value={editMedioPago}
                  onChange={e => setEditMedioPago(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold bg-white"
                >
                  <option value="Mercado Pago">Mercado Pago</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="-----">-----</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                  ¿Pagado? (Col G)
                </label>
                <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEditPago('NO')}
                    className={`py-1.5 rounded-lg text-xs font-black cursor-pointer ${
                      editPago === 'NO' ? 'bg-rose-600 text-white' : 'text-stone-600'
                    }`}
                  >
                    NO
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPago('SI')}
                    className={`py-1.5 rounded-lg text-xs font-black cursor-pointer ${
                      editPago === 'SI' ? 'bg-emerald-600 text-white' : 'text-stone-600'
                    }`}
                  >
                    SI
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                  ¿Entregado? (Col I)
                </label>
                <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEditEntregado('NO')}
                    className={`py-1.5 rounded-lg text-xs font-black cursor-pointer ${
                      editEntregado === 'NO' ? 'bg-amber-500 text-stone-950' : 'text-stone-600'
                    }`}
                  >
                    NO
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditEntregado('SI')}
                    className={`py-1.5 rounded-lg text-xs font-black cursor-pointer ${
                      editEntregado === 'SI' ? 'bg-emerald-600 text-white' : 'text-stone-600'
                    }`}
                  >
                    SI
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                Observaciones / Nota (Columna H)
              </label>
              <input
                type="text"
                value={editObservaciones}
                onChange={e => setEditObservaciones(e.target.value)}
                placeholder="Notas de entrega, descuento aplicado, etc."
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs text-stone-800"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="px-5 py-2.5 rounded-xl bg-[#0f4b25] hover:bg-[#145e2f] text-[#ece7d7] font-black text-xs shadow-md cursor-pointer"
              >
                {isSavingEdit ? 'Actualizando Hoja Ventas...' : '💾 Guardar Cambios en Hoja Ventas'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Google Apps Script Setup & Sync */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border-4 border-[#0f4b25] max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="bg-[#e68628] text-stone-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                  Conexión Bidireccional Google Sheets
                </span>
                <h3 className="text-xl font-black text-stone-900 font-display mt-1">
                  Impactar Nuevos Pedidos y Modificaciones Directo en el Excel de Yerbazo
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Todos los pedidos y modificaciones que aplicás ya se guardan al instante en la nube de Yerbazo. Con este conector en tu Google Sheet, cada pedido nuevo, cambio de precio final o cambio de Entregado/Pagado se escribe automáticamente en la pestaña <strong>Ventas</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsScriptModalOpen(false)}
                className="p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step by step instructions */}
            <div className="bg-[#f7f5ed] rounded-2xl p-4 border border-stone-200 text-xs space-y-2 text-stone-800">
              <div className="font-black text-[#0f4b25] uppercase text-[11px]">
                Pasos por única vez (toma 1 minuto):
              </div>
              <ol className="list-decimal list-inside space-y-1.5 font-medium">
                <li>
                  Abrí tu{' '}
                  <a
                    href="https://docs.google.com/spreadsheets/d/15hjl5YFZqSFRGuh1IEv7zHDRXrQPPfvRU8dijVOmWPY/edit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0f4b25] font-bold underline"
                  >
                    Google Sheet de Yerbazo
                  </a>{' '}
                  en la compu y en el menú superior tocá <strong>Extensiones → Apps Script</strong>.
                </li>
                <li>
                  Tocá el botón de abajo <strong>"Copiar Código del Conector"</strong>, pegalo en el editor de Apps Script (reemplazando lo que haya) y guardá (💾).
                </li>
                <li>
                  Tocá el botón azul <strong>Implementar → Nueva implementación</strong>. Elegí tipo <strong>Aplicación web</strong>, en <em>Ejecutar como</em> dejá <strong>"Yo"</strong> y en <em>Quién tiene acceso</em> elegí <strong>"Cualquier persona"</strong>.
                </li>
                <li>
                  Copiá la <strong>URL de la aplicación web</strong> (termina en <code>/exec</code>) y pegala acá abajo (o pasámela por el chat para dejarla fija):
                </li>
              </ol>

              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
                    setCopiedScriptCode(true);
                    setTimeout(() => setCopiedScriptCode(false), 3000);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#0f4b25] text-[#ece7d7] font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  {copiedScriptCode ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedScriptCode ? '¡Código Copiado al Portapapeles!' : 'Copiar Código del Conector (Apps Script)'}</span>
                </button>
              </div>
            </div>

            {/* URL Input */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-stone-800">
                URL de tu Aplicación Web de Google Apps Script:
              </label>
              <input
                type="url"
                value={scriptUrlInput}
                onChange={e => setScriptUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-stone-300 focus:border-[#0f4b25] font-mono text-xs focus:outline-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsScriptModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={isTestingScript}
                onClick={handleTestAndSaveScriptUrl}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#e68628] hover:bg-[#cf741b] text-stone-950 font-black text-xs shadow-md cursor-pointer"
              >
                {isTestingScript ? 'Probando y Sincronizando...' : 'Guardar URL y Sincronizar Pendientes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

