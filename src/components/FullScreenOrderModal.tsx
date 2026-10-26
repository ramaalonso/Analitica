import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  X,
  PlusCircle,
  CheckCircle2,
  Search,
  UserPlus,
  Users,
  Package,
  FileSpreadsheet,
  Copy,
  Check,
  Sparkles,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Save,
  Trash2
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
  deleteOrderAndSync,
  generateOrderId,
  buildTabSeparatedRow,
  buildGoogleSheetNativeRowFromOrder,
  VENTAS_SHEET_HEADERS,
  getAppsScriptUrl
} from '../services/dataService';

const EXCEL_COL_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA'
];

const MONTH_NAMES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function computeMonthAndWeekFromDate(isoDateStr: string): { displayDate: string; mes: string; semana: string } {
  const parts = isoDateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
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

function parseDisplayDateToIso(fechaStr: string | undefined, fallbackIso: string): string {
  if (!fechaStr) return fallbackIso;
  const trimmed = fechaStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split('/');
  if (parts.length === 3) {
    const day = String(parseInt(parts[0], 10) || 1).padStart(2, '0');
    const month = String(parseInt(parts[1], 10) || 1).padStart(2, '0');
    let year = parts[2].trim();
    if (year.length === 2) year = `20${year}`;
    if (year.length === 4) {
      return `${year}-${month}-${day}`;
    }
  }
  return fallbackIso;
}

interface FullScreenOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: YerbazoDataset;
  onDatasetUpdate: (newDataset: YerbazoDataset) => void;
  editingOrder?: SaleTransaction | null;
  onOrderSavedToast?: (message: string, isSuccess: boolean) => void;
}

export const FullScreenOrderModal: React.FC<FullScreenOrderModalProps> = ({
  isOpen,
  onClose,
  dataset,
  onDatasetUpdate,
  editingOrder = null,
  onOrderSavedToast
}) => {
  const isEditMode = !!editingOrder;

  const step1Ref = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);

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

  const [orderItems, setOrderItems] = useState<NewOrderItemInput[]>([]);
  const [customFinalPrice, setCustomFinalPrice] = useState<string>('');
  const [isPriceManuallyEdited, setIsPriceManuallyEdited] = useState<boolean>(false);
  const [productSearch, setProductSearch] = useState('');
  const [productCatFilter, setProductCatFilter] = useState<'TODOS' | '1 KG' | '500 G' | 'Accesorios'>('TODOS');
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);
  const [lastCreatedOrder, setLastCreatedOrder] = useState<NewOrderPayload | null>(null);
  const [copiedLastOrderRow, setCopiedLastOrderRow] = useState(false);
  const [showSheetPreview, setShowSheetPreview] = useState(false);
  const [localToast, setLocalToast] = useState<{ text: string; type: 'success' | 'warning' | 'info' } | null>(null);

  const triggerLocalToast = (text: string, type: 'success' | 'warning' | 'info' = 'info') => {
    setLocalToast({ text, type });
    setTimeout(() => setLocalToast(null), 4000);
  };

  const clientMap = useMemo(() => {
    const map = new Map<string, ClienteRow>();
    for (const c of dataset.clientes) {
      map.set(c.cliente.toLowerCase().trim(), c);
    }
    return map;
  }, [dataset.clientes]);

  // Populate form when opening in Edit Mode or New Mode
  useEffect(() => {
    if (!isOpen) return;
    setConfirmingDelete(false);
    setIsDeletingOrder(false);

    if (editingOrder) {
      setClientName(editingOrder.cliente || '');
      const matchedClient = clientMap.get((editingOrder.cliente || '').toLowerCase().trim());
      setClientAddress(matchedClient?.direccionEntrega || '');
      setClientChannel(matchedClient?.comoNosConocio || 'Directo');
      setIsNewClient(false);

      setOrderDateIso(parseDisplayDateToIso(editingOrder.fecha, todayIso));

      const mpRaw = (editingOrder.medioPago || '').trim();
      if (mpRaw.toLowerCase().includes('efectivo')) {
        setMedioPago('Efectivo');
      } else if (mpRaw === '-----' || mpRaw.toLowerCase().includes('no especificado') || !mpRaw) {
        setMedioPago('-----');
      } else {
        setMedioPago('Mercado Pago');
      }

      setPagoStatus((editingOrder.pago || '').toUpperCase() === 'SI' ? 'SI' : 'NO');
      setEntregadoStatus((editingOrder.entregado || '').toUpperCase() === 'SI' ? 'SI' : 'NO');
      setObservaciones(editingOrder.observaciones || '');

      const totalQty = Math.max(1, editingOrder.items.reduce((a, b) => a + b.cantidad, 0));
      const fallbackUnitPrice = Math.round((editingOrder.precioSistema || editingOrder.precioFinal) / totalQty);

      const mappedItems: NewOrderItemInput[] = editingOrder.items.map(it => {
        const cat = dataset.stock.find(
          s => s.nombre.toLowerCase().trim() === it.producto.toLowerCase().trim()
        );
        return {
          producto: cat ? cat.nombre : it.producto,
          cantidad: it.cantidad,
          precioVentaUnitario: cat ? cat.precioVenta : fallbackUnitPrice,
          precioCompraUnitario: cat ? cat.precioCompra : 0,
          stockRestanteAntes: cat
            ? cat.restantes + it.cantidad
            : (parseInt(it.stockStatus || '0', 10) || 0) + it.cantidad
        };
      });

      setOrderItems(mappedItems);
      setCustomFinalPrice(String(editingOrder.precioFinal));
      setIsPriceManuallyEdited(true);
      setProductSearch('');
      setProductCatFilter('TODOS');
      setLastCreatedOrder(null);
    } else {
      setClientName('');
      setClientAddress('');
      setClientChannel('Un amigo');
      setIsNewClient(false);
      setOrderDateIso(todayIso);
      setMedioPago('Mercado Pago');
      setPagoStatus('NO');
      setEntregadoStatus('NO');
      setObservaciones('');
      setOrderItems([]);
      setCustomFinalPrice('');
      setIsPriceManuallyEdited(false);
      setProductSearch('');
      setProductCatFilter('TODOS');
    }
  }, [isOpen, editingOrder]);

  // Lock background scroll & handle Escape key while full-screen modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSavingOrder) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSavingOrder, onClose]);

  const selectedClientRecord = useMemo(() => {
    if (!clientName.trim()) return null;
    return clientMap.get(clientName.toLowerCase().trim()) || null;
  }, [clientName, clientMap]);

  const clientSuggestions = useMemo(() => {
    const q = clientName.toLowerCase().trim();
    const list = [...dataset.clientes].sort((a, b) => b.totalCompras - a.totalCompras);
    if (!q) return list.slice(0, 10);
    return list
      .filter(c =>
        c.cliente.toLowerCase().includes(q) ||
        (c.direccionEntrega || '').toLowerCase().includes(q) ||
        (c.comoNosConocio || '').toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [dataset.clientes, clientName]);

  const calculatedSystemPrice = useMemo(() => {
    return orderItems.reduce((acc, it) => acc + it.cantidad * it.precioVentaUnitario, 0);
  }, [orderItems]);

  const calculatedTotalCost = useMemo(() => {
    return orderItems.reduce((acc, it) => acc + it.cantidad * it.precioCompraUnitario, 0);
  }, [orderItems]);

  const totalSelectedUnits = useMemo(() => {
    return orderItems.reduce((acc, it) => acc + it.cantidad, 0);
  }, [orderItems]);

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

  const filteredCatalog = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    return dataset.stock.filter(p => {
      const matchSearch = !q || p.nombre.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q);
      const matchCat =
        productCatFilter === 'TODOS' ||
        (productCatFilter === '1 KG' && p.peso === '1 KG') ||
        (productCatFilter === '500 G' && p.peso === '500 G') ||
        (productCatFilter === 'Accesorios' && p.categoria !== 'Yerbas');
      return matchSearch && matchCat;
    });
  }, [dataset.stock, productSearch, productCatFilter]);

  const handleAddProductToOrder = (prod: CatalogProduct) => {
    setOrderItems(prev => {
      const existingIdx = prev.findIndex(i => i.producto.toLowerCase() === prod.nombre.toLowerCase());
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          cantidad: updated[existingIdx].cantidad + 1
        };
        setIsPriceManuallyEdited(false);
        return updated;
      }
      if (prev.length >= 5) {
        triggerLocalToast('El Excel de Yerbazo admite hasta 5 variedades distintas por fila de pedido.', 'warning');
        return prev;
      }
      setIsPriceManuallyEdited(false);
      // If this product was originally in editingOrder, include its original qty in stockRestanteAntes
      const origItem = editingOrder?.items.find(
        orig => orig.producto.toLowerCase().trim() === prod.nombre.toLowerCase().trim()
      );
      return [
        ...prev,
        {
          producto: prod.nombre,
          cantidad: 1,
          precioVentaUnitario: prod.precioVenta,
          precioCompraUnitario: prod.precioCompra,
          stockRestanteAntes: prod.restantes + (origItem ? origItem.cantidad : 0)
        }
      ];
    });
  };

  const handleUpdateItemQty = (productoName: string, delta: number) => {
    setIsPriceManuallyEdited(false);
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

  const handleResetForm = () => {
    if (editingOrder) {
      // Restore original values of the order being edited
      setClientName(editingOrder.cliente || '');
      setOrderDateIso(parseDisplayDateToIso(editingOrder.fecha, todayIso));
      setPagoStatus((editingOrder.pago || '').toUpperCase() === 'SI' ? 'SI' : 'NO');
      setEntregadoStatus((editingOrder.entregado || '').toUpperCase() === 'SI' ? 'SI' : 'NO');
      setObservaciones(editingOrder.observaciones || '');
      setCustomFinalPrice(String(editingOrder.precioFinal));
      setIsPriceManuallyEdited(true);
      const totalQty = Math.max(1, editingOrder.items.reduce((a, b) => a + b.cantidad, 0));
      const fallbackUnitPrice = Math.round((editingOrder.precioSistema || editingOrder.precioFinal) / totalQty);
      setOrderItems(
        editingOrder.items.map(it => {
          const cat = dataset.stock.find(
            s => s.nombre.toLowerCase().trim() === it.producto.toLowerCase().trim()
          );
          return {
            producto: cat ? cat.nombre : it.producto,
            cantidad: it.cantidad,
            precioVentaUnitario: cat ? cat.precioVenta : fallbackUnitPrice,
            precioCompraUnitario: cat ? cat.precioCompra : 0,
            stockRestanteAntes: cat ? cat.restantes + it.cantidad : (parseInt(it.stockStatus || '0', 10) || 0) + it.cantidad
          };
        })
      );
      triggerLocalToast('Se restauraron los datos originales del pedido.', 'info');
      return;
    }

    setClientName('');
    setClientAddress('');
    setObservaciones('');
    setOrderItems([]);
    setIsPriceManuallyEdited(false);
    setCustomFinalPrice('');
    setIsNewClient(false);
    setPagoStatus('NO');
    setEntregadoStatus('NO');
    setMedioPago('Mercado Pago');
    setOrderDateIso(todayIso);
  };

  const submitOrder = async (keepOpenForNext: boolean) => {
    if (!clientName.trim()) {
      triggerLocalToast('Ingresá o elegí el nombre del cliente (Paso 1).', 'warning');
      step1Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (orderItems.length === 0) {
      triggerLocalToast('Seleccioná al menos 1 producto del catálogo (Paso 2).', 'warning');
      step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    setIsSavingOrder(true);
    try {
      const { displayDate, mes, semana } = computeMonthAndWeekFromDate(orderDateIso);
      const effectiveMedioPago = pagoStatus === 'NO' && medioPago === '-----' ? '-----' : medioPago;

      // =======================================================================
      // EDIT EXISTING ORDER MODE
      // =======================================================================
      if (isEditMode && editingOrder) {
        const result = await updateOrderStatusAndSync(
          editingOrder.id,
          {
            rowIndex: editingOrder.rowIndex,
            cliente: clientName.trim(),
            fecha: displayDate,
            precioSistema: calculatedSystemPrice,
            precioFinal: finalPriceNumber,
            medioPago: effectiveMedioPago,
            pago: pagoStatus,
            entregado: entregadoStatus,
            observaciones: observaciones.trim(),
            items: orderItems,
            mes,
            semana,
            ganancia: calculatedProfit
          },
          dataset.webStore
        );

        onDatasetUpdate(result.dataset);

        confetti({
          particleCount: 65,
          spread: 65,
          origin: { y: 0.6 },
          colors: ['#0f4b25', '#e68628', '#10b981']
        });

        const editMsg = result.syncedToCloud
          ? `¡Pedido #${editingOrder.id} de ${clientName.trim()} ($${finalPriceNumber.toLocaleString('es-AR')}) modificado en la hoja Ventas!`
          : `Pedido #${editingOrder.id} modificado en la app (${result.cloudMessage})`;

        if (onOrderSavedToast) {
          onOrderSavedToast(editMsg, result.syncedToCloud);
        }
        onClose();
        return;
      }

      // =======================================================================
      // CREATE NEW ORDER MODE
      // =======================================================================
      const newOrder: NewOrderPayload = {
        id: generateOrderId(),
        cliente: clientName.trim(),
        esClienteNuevo: isNewClient || !selectedClientRecord,
        comoNosConocio: clientChannel || 'Directo',
        direccionEntrega: clientAddress.trim(),
        fecha: displayDate,
        precioSistema: calculatedSystemPrice,
        precioFinal: finalPriceNumber,
        medioPago: effectiveMedioPago,
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
        particleCount: 75,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0f4b25', '#e68628', '#10b981']
      });

      const msg = result.syncedToCloud
        ? `¡Pedido #${newOrder.id} de ${newOrder.cliente} ($${newOrder.precioFinal.toLocaleString('es-AR')}) agregado en la hoja Ventas!`
        : `Pedido guardado en la app (Google Sheet: ${result.cloudMessage})`;

      handleResetForm();

      if (keepOpenForNext) {
        triggerLocalToast(msg, result.syncedToCloud ? 'success' : 'warning');
        step1Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        if (onOrderSavedToast) {
          onOrderSavedToast(msg, result.syncedToCloud);
        }
        onClose();
      }
    } catch {
      triggerLocalToast('Ocurrió un error al guardar el pedido.', 'warning');
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!editingOrder) return;
    setIsDeletingOrder(true);
    try {
      const result = await deleteOrderAndSync(editingOrder, dataset.webStore);
      onDatasetUpdate(result.dataset);

      const delMsg = result.syncedToCloud
        ? `🗑️ Pedido #${editingOrder.id} de ${editingOrder.cliente} eliminado de la app y de la hoja Ventas.`
        : `🗑️ Pedido #${editingOrder.id} de ${editingOrder.cliente} eliminado (${result.cloudMessage}).`;

      if (onOrderSavedToast) {
        onOrderSavedToast(delMsg, result.syncedToCloud);
      }
      onClose();
    } catch {
      triggerLocalToast('Ocurrió un error al eliminar el pedido.', 'warning');
    } finally {
      setIsDeletingOrder(false);
      setConfirmingDelete(false);
    }
  };

  if (!isOpen) return null;

  const targetSheetRowNumber = isEditMode && editingOrder
    ? editingOrder.rowIndex + 1
    : dataset.ventas.length + 2;
  const hasAnyInput = clientName.trim().length > 0 || orderItems.length > 0 || observaciones.trim().length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEditMode ? `Modificar pedido de ${editingOrder?.cliente}` : 'Pantalla completa para agregar nuevo pedido'}
      className="fixed inset-0 z-[100] w-screen h-[100dvh] bg-[#f7f5ed] flex flex-col overflow-hidden animate-in fade-in duration-150"
    >
      {/* Floating Toast inside Full-Screen Modal */}
      {localToast && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-[120] px-4 py-2.5 rounded-2xl shadow-2xl border-2 flex items-center space-x-2 text-xs font-extrabold max-w-[92vw] sm:max-w-md ${
            localToast.type === 'warning'
              ? 'bg-amber-950 text-amber-100 border-amber-400'
              : 'bg-[#0f4b25] text-[#ece7d7] border-[#e68628]'
          }`}
        >
          {localToast.type === 'warning' ? (
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-[#e68628] shrink-0" />
          )}
          <span>{localToast.text}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* FULL-SCREEN TOP HEADER BAR                                            */}
      {/* ===================================================================== */}
      <header className="bg-[#0f4b25] text-[#ece7d7] border-b-2 border-[#e68628] px-3 sm:px-6 py-2.5 shrink-0 shadow-md">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSavingOrder}
              className="flex items-center space-x-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#ece7d7] text-xs font-black border border-white/15 transition-colors cursor-pointer shrink-0"
              title="Cerrar y volver (Esc)"
            >
              <ArrowLeft className="w-4 h-4 text-[#e68628]" />
              <span>Volver</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-lg font-black font-display tracking-tight text-white truncate">
                  {isEditMode
                    ? `Modificar Pedido #${editingOrder?.id} (${editingOrder?.cliente})`
                    : 'Nuevo Pedido Yerbazo'}
                </h2>
                <span className="hidden sm:inline-flex items-center space-x-1 bg-[#e68628] text-stone-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  <span>Fila #{targetSheetRowNumber} en Ventas</span>
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-[#ece7d7]/75 truncate">
                {isEditMode
                  ? `✏️ Editando Fila #${targetSheetRowNumber} en tiempo real • Cambiá cliente, productos, precio final o estado`
                  : getAppsScriptUrl()
                  ? '🟢 Conectado en vivo con "Copia de Yerbazo.ba" (Hoja Ventas)'
                  : '⚡ Guardado en Nube + Sincronización con Google Sheets'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {hasAnyInput && (
              <button
                type="button"
                onClick={handleResetForm}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-rose-600/80 text-[#ece7d7] text-[11px] font-bold transition-colors cursor-pointer"
                title={isEditMode ? 'Restaurar valores originales del pedido' : 'Limpiar selección actual'}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isEditMode ? 'Restaurar' : 'Limpiar'}</span>
              </button>
            )}

            <div className="hidden md:flex items-center space-x-2 bg-[#0a341a] px-3 py-1.5 rounded-xl border border-[#e68628]/40 text-xs">
              <span className="text-[#ece7d7]/80 font-bold">{totalSelectedUnits} u.</span>
              <span className="text-[#e68628] font-black font-mono">
                ${finalPriceNumber.toLocaleString('es-AR')}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSavingOrder}
              aria-label="Cerrar pantalla de pedido"
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#ece7d7] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* MOBILE QUICK-STEP JUMP BAR (< lg)                                     */}
      {/* ===================================================================== */}
      <div className="lg:hidden bg-white border-b border-stone-200 px-2.5 py-1.5 shrink-0 shadow-2xs">
        <div className="grid grid-cols-3 gap-1.5 text-[11px] font-extrabold">
          <button
            type="button"
            onClick={() => step1Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className={`py-1.5 px-2 rounded-xl flex items-center justify-center space-x-1 border cursor-pointer truncate ${
              clientName.trim()
                ? 'bg-emerald-50 border-emerald-300 text-[#0f4b25]'
                : 'bg-stone-100 border-stone-200 text-stone-700'
            }`}
          >
            <span>{clientName.trim() ? '✅' : '1.'}</span>
            <span className="truncate">{clientName.trim() || 'Cliente'}</span>
          </button>

          <button
            type="button"
            onClick={() => step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className={`py-1.5 px-2 rounded-xl flex items-center justify-center space-x-1 border cursor-pointer ${
              orderItems.length > 0
                ? 'bg-emerald-50 border-emerald-300 text-[#0f4b25]'
                : 'bg-stone-100 border-stone-200 text-stone-700'
            }`}
          >
            <span>{orderItems.length > 0 ? '🧉' : '2.'}</span>
            <span>Productos ({totalSelectedUnits})</span>
          </button>

          <button
            type="button"
            onClick={() => step3Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="py-1.5 px-2 rounded-xl flex items-center justify-center space-x-1 bg-amber-50 border border-amber-300 text-stone-900 cursor-pointer"
          >
            <span>3.</span>
            <span className="truncate">Pago & Envío</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MAIN FULL-SCREEN WORKSPACE                                            */}
      {/* ===================================================================== */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden">
        <div className="max-w-[1800px] mx-auto h-full lg:grid lg:grid-cols-12 lg:gap-0">
          
          {/* LEFT / MAIN PANEL: CLIENTE + CATÁLOGO COMPLETO (Scrollable on lg) */}
          <div className="lg:col-span-7 xl:col-span-8 lg:h-full lg:overflow-y-auto p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-5">
            
            {/* Last Created Order Banner (when using "Guardar + Otro") */}
            {lastCreatedOrder && !isEditMode && (
              <div className="bg-emerald-950 text-[#ece7d7] rounded-2xl p-3.5 sm:p-4 border-2 border-emerald-400 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="bg-emerald-400 text-stone-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                      ¡Cargado recién!
                    </span>
                    <span className="font-bold text-xs text-white truncate">
                      {lastCreatedOrder.cliente} — ${lastCreatedOrder.precioFinal.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-200/85 truncate mt-0.5">
                    {lastCreatedOrder.items.map(i => `${i.cantidad}x ${i.producto}`).join(' + ')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(buildTabSeparatedRow(lastCreatedOrder));
                      setCopiedLastOrderRow(true);
                      setTimeout(() => setCopiedLastOrderRow(false), 2500);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#e68628] text-stone-950 font-black text-[11px] flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedLastOrderRow ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLastOrderRow ? 'Copiada' : 'Copiar Fila'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLastCreatedOrder(null)}
                    className="p-1.5 rounded-lg bg-white/10 text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 1: CLIENTE Y DIRECCIÓN */}
            <div ref={step1Ref} className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-xs space-y-3.5 scroll-mt-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-[#0f4b25] text-[#ece7d7] text-xs font-black flex items-center justify-center shrink-0">
                    1
                  </span>
                  <h3 className="font-black text-sm sm:text-base text-stone-900 font-display">
                    Cliente y Lugar de Entrega
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setIsNewClient(!isNewClient)}
                  className={`px-2.5 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer ${
                    isNewClient
                      ? 'bg-[#e68628] text-stone-950 font-black'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isNewClient ? 'Cliente Nuevo Activo' : '+ Cliente Nuevo'}</span>
                </button>
              </div>

              {/* Client Search / Name Input */}
              <div className="relative">
                <div className="relative">
                  <Users className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={clientName}
                    onFocus={() => setClientSearchOpen(true)}
                    onBlur={() => setTimeout(() => setClientSearchOpen(false), 200)}
                    onChange={e => {
                      setClientName(e.target.value);
                      setClientSearchOpen(true);
                    }}
                    placeholder="Buscar cliente habitual o escribir nombre nuevo..."
                    className="w-full pl-10 pr-9 py-2.5 sm:py-3 rounded-2xl border-2 border-stone-200 focus:border-[#0f4b25] focus:outline-none text-sm font-bold text-stone-900 bg-[#f7f5ed]/40 focus:bg-white transition-colors"
                  />
                  {clientName && (
                    <button
                      type="button"
                      onClick={() => {
                        setClientName('');
                        setClientAddress('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Autocomplete Suggestions Dropdown */}
                {clientSearchOpen && clientSuggestions.length > 0 && (
                  <div className="absolute z-40 left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border-2 border-[#0f4b25]/25 max-h-64 overflow-y-auto divide-y divide-stone-100">
                    {clientSuggestions.map(c => (
                      <button
                        key={c.cliente}
                        type="button"
                        onMouseDown={() => handleSelectSuggestionClient(c)}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-[#f7f5ed] flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-extrabold text-xs sm:text-sm text-stone-900 truncate">{c.cliente}</div>
                          <div className="text-[11px] text-stone-500 truncate">
                            📍 {c.direccionEntrega || 'Sin dirección'} • {c.comoNosConocio}
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] font-black bg-emerald-50 text-[#0f4b25] border border-emerald-200 px-2 py-0.5 rounded-full">
                          {c.totalCompras} compras
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Top Clients Pills when no client selected yet */}
              {!clientName.trim() && dataset.clientes.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  <span className="text-[10px] font-bold text-stone-400 uppercase shrink-0">Frecuentes:</span>
                  {[...dataset.clientes]
                    .sort((a, b) => b.totalCompras - a.totalCompras)
                    .slice(0, 7)
                    .map(c => (
                      <button
                        key={c.cliente}
                        type="button"
                        onClick={() => handleSelectSuggestionClient(c)}
                        className="px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-[#0f4b25] hover:text-white text-[11px] font-bold text-stone-700 transition-colors shrink-0 cursor-pointer"
                      >
                        {c.cliente}
                      </button>
                    ))}
                </div>
              )}

              {/* Matched Habitual Client Info + 1-Tap Favorite Yerbas */}
              {selectedClientRecord && (
                <div className="bg-[#f7f5ed] rounded-2xl p-3 border border-stone-200/90 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-extrabold text-[#0f4b25] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        {selectedClientRecord.cliente} ({selectedClientRecord.totalCompras} compras • {selectedClientRecord.clubMateroNivel})
                      </span>
                    </span>
                    {selectedClientRecord.saldoDeuda > 0 && (
                      <span className="bg-rose-100 text-rose-800 font-black text-[10px] px-2 py-0.5 rounded-full">
                        ⚠️ Deuda pendiente: ${selectedClientRecord.saldoDeuda.toLocaleString('es-AR')}
                      </span>
                    )}
                  </div>

                  {selectedClientRecord.productosFavoritos.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] font-bold text-stone-500">Sumar favorita en 1 toque:</span>
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

              {/* Address + Quick Zone Chips + Channel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-stone-500 uppercase">
                    Dirección / Zona de Entrega
                  </label>
                  <input
                    type="text"
                    value={clientAddress}
                    onChange={e => setClientAddress(e.target.value)}
                    placeholder="Ej: UADE, Club, Mirador, Pedro Morán..."
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0f4b25]"
                  />
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {['UADE', 'Club', 'Mirador', 'Devoto'].map(zona => (
                      <button
                        key={zona}
                        type="button"
                        onClick={() => setClientAddress(zona)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-colors ${
                          clientAddress.toLowerCase() === zona.toLowerCase()
                            ? 'bg-[#0f4b25] text-white border-[#0f4b25]'
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        📍 {zona}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1.5">
                    ¿Cómo nos conoció?
                  </label>
                  <select
                    value={clientChannel}
                    onChange={e => setClientChannel(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4b25]"
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

            {/* STEP 2: CATÁLOGO COMPLETO DE PRODUCTOS (SIN CAJA CHICA, FULL VIEW) */}
            <div ref={step2Ref} className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-xs space-y-3.5 scroll-mt-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-[#0f4b25] text-[#ece7d7] text-xs font-black flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    <h3 className="font-black text-sm sm:text-base text-stone-900 font-display">
                      {isEditMode
                        ? `Agregar o Modificar Productos (${orderItems.length}/5 variedades • ${totalSelectedUnits} u.)`
                        : `Seleccionar Productos (${orderItems.length}/5 variedades • ${totalSelectedUnits} u.)`}
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      Tocá cualquier producto del catálogo para sumarlo o ajustar cantidades con - / +
                    </p>
                  </div>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {(['TODOS', '1 KG', '500 G', 'Accesorios'] as const).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setProductCatFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all shrink-0 ${
                        productCatFilter === cat
                          ? 'bg-[#0f4b25] text-[#ece7d7] shadow-2xs'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Product Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Buscar yerba, mate o bombilla (ej: Canarias, Baldo, Rei Verde, Serena)..."
                  className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-stone-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f4b25]"
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => setProductSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Full Catalog Grid (2 cols on mobile, 2 on sm, 3 on xl — NO cramped max-height!) */}
              <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3">
                {filteredCatalog.map(prod => {
                  const inCart = orderItems.find(i => i.producto.toLowerCase() === prod.nombre.toLowerCase());
                  const outOfStock = prod.restantes <= 0 && !inCart;

                  return (
                    <div
                      key={prod.id}
                      onClick={() => handleAddProductToOrder(prod)}
                      className={`p-2.5 sm:p-3.5 rounded-2xl border-2 transition-all cursor-pointer select-none flex flex-col justify-between gap-2 ${
                        inCart
                          ? 'bg-emerald-50/70 border-[#0f4b25] ring-2 ring-[#0f4b25]/15 shadow-xs'
                          : outOfStock
                          ? 'bg-stone-50 border-stone-200 opacity-65 hover:opacity-100'
                          : 'bg-white hover:bg-[#f7f5ed]/70 border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <span className={`text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                            prod.restantes <= 0
                              ? 'bg-rose-100 text-rose-700'
                              : prod.restantes <= 4
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100/80 text-emerald-800'
                          }`}>
                            Stock: {prod.restantes}
                          </span>
                          {inCart && (
                            <span className="bg-[#0f4b25] text-[#e68628] text-[10px] font-black px-1.5 py-0.5 rounded-md">
                              ${(inCart.cantidad * prod.precioVenta).toLocaleString('es-AR')}
                            </span>
                          )}
                        </div>

                        <div className="font-extrabold text-xs sm:text-sm text-stone-900 capitalize leading-snug line-clamp-2 mt-1.5">
                          {prod.nombre}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-stone-200/60">
                        <span className="text-xs sm:text-sm font-black text-[#0f4b25] font-mono">
                          ${prod.precioVenta.toLocaleString('es-AR')}
                        </span>

                        {inCart ? (
                          <div
                            className="flex items-center space-x-1 bg-[#0f4b25] text-white rounded-xl p-0.5 shrink-0"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(inCart.producto, -1)}
                              className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center font-black text-sm cursor-pointer active:scale-95"
                            >
                              -
                            </button>
                            <span className="font-black text-xs px-1.5 min-w-[20px] text-center">
                              {inCart.cantidad}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(inCart.producto, 1)}
                              className="w-7 h-7 rounded-lg bg-[#e68628] text-stone-950 flex items-center justify-center font-black text-sm cursor-pointer active:scale-95"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-xl bg-stone-100 text-[#0f4b25] font-black text-xs shrink-0">
                            + Sumar
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: CARRITO, PRECIO FINAL, MEDIO DE PAGO & ESTADO (Scrollable on lg) */}
          <div
            ref={step3Ref}
            className="lg:col-span-5 xl:col-span-4 lg:h-full lg:overflow-y-auto lg:bg-white lg:border-l-2 lg:border-stone-200 p-3 sm:p-5 lg:p-6 space-y-4 scroll-mt-3"
          >
            <div className="bg-white lg:bg-transparent rounded-2xl sm:rounded-3xl p-4 sm:p-5 lg:p-0 border-2 lg:border-0 border-[#0f4b25] shadow-sm lg:shadow-none space-y-4">
              
              {/* Header Step 3 */}
              <div className="flex items-center justify-between pb-2.5 border-b border-stone-200">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-[#e68628] text-stone-950 text-xs font-black flex items-center justify-center shrink-0">
                    3
                  </span>
                  <h3 className="font-black text-sm sm:text-base text-stone-900 font-display">
                    Resumen, Precio, Pago y Entrega
                  </h3>
                </div>
                {orderItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOrderItems([])}
                    className="text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
                  >
                    Vaciar ({totalSelectedUnits} u.)
                  </button>
                )}
              </div>

              {/* Selected Items List */}
              {orderItems.length === 0 ? (
                <div className="bg-[#f7f5ed] rounded-2xl p-5 text-center border border-dashed border-stone-300">
                  <Package className="w-6 h-6 text-stone-400 mx-auto mb-1" />
                  <p className="text-xs font-bold text-stone-600">
                    Todavía no seleccionaste productos
                  </p>
                  <p className="text-[11px] text-stone-400">
                    Tocá los productos del catálogo para armar el pedido
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
                          Ítem {idx + 1}/5 • Stock tras venta: {Math.max(0, it.stockRestanteAntes - it.cantidad)}
                        </span>
                        <span className="font-extrabold text-stone-900 capitalize truncate block">
                          {it.producto}
                        </span>
                        <span className="text-[11px] text-stone-500 font-mono">
                          ${it.precioVentaUnitario.toLocaleString('es-AR')} c/u →{' '}
                          <strong className="text-[#0f4b25]">
                            ${(it.cantidad * it.precioVentaUnitario).toLocaleString('es-AR')}
                          </strong>
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

              {/* Price & Profit Calculator */}
              <div className="bg-stone-50 rounded-2xl p-3.5 sm:p-4 border border-stone-200 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500 font-bold">Precio Sistema (Lista):</span>
                  <span className="font-mono font-bold text-stone-800">
                    ${calculatedSystemPrice.toLocaleString('es-AR')}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5 gap-1">
                    <label className="text-xs font-black text-stone-900 uppercase">
                      Precio Final ($)
                    </label>
                    <div className="flex items-center gap-1">
                      {[
                        { label: 'Lista', pct: 0 },
                        { label: '-5%', pct: 5 },
                        { label: '-10%', pct: 10 },
                        { label: '-15%', pct: 15 }
                      ].map(btn => (
                        <button
                          key={btn.label}
                          type="button"
                          onClick={() => applyQuickDiscount(btn.pct)}
                          className="px-2 py-0.5 rounded-lg bg-stone-200 hover:bg-[#e68628] hover:text-stone-950 text-[10px] font-extrabold text-stone-700 transition-colors cursor-pointer"
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
                    <span className="text-stone-500 font-bold block">Ganancia Neta:</span>
                    <span className="text-[10px] text-stone-400">
                      Costo: ${calculatedTotalCost.toLocaleString('es-AR')}
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

              {/* Estado de Pago & Entrega */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1.5">
                    ¿Ya fue Pagado?
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-2xl">
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
                    ¿Ya fue Entregado?
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-2xl">
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

              {/* Fecha & Observaciones */}
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

              {/* Optional Collapsible 27-Col Sheet Row Preview */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowSheetPreview(!showSheetPreview)}
                  className="w-full py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-bold flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center space-x-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#0f4b25]" />
                    <span>Vista previa de la fila #{targetSheetRowNumber} en Ventas (27 cols)</span>
                  </span>
                  {showSheetPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showSheetPreview && (() => {
                  const { displayDate, mes, semana } = computeMonthAndWeekFromDate(orderDateIso);
                  const previewOrder: NewOrderPayload = {
                    id: isEditMode && editingOrder ? editingOrder.id : 'YB-NUEVO',
                    cliente: clientName.trim() || '(Cliente)',
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
                  const rowCells = buildGoogleSheetNativeRowFromOrder(previewOrder);

                  return (
                    <div className="mt-2 space-y-2">
                      <div className="overflow-x-auto rounded-xl border border-stone-300 bg-stone-50">
                        <table className="w-full text-left text-[10px] border-collapse">
                          <thead>
                            <tr className="bg-stone-200 text-stone-600 font-mono border-b border-stone-300">
                              {EXCEL_COL_LETTERS.map(letter => (
                                <th key={letter} className="py-1 px-2 text-center border-r border-stone-300 font-bold">
                                  {letter}
                                </th>
                              ))}
                            </tr>
                            <tr className="bg-[#0f4b25] text-[#ece7d7] font-extrabold whitespace-nowrap">
                              {VENTAS_SHEET_HEADERS.map((hdr, idx) => (
                                <th key={idx} className="py-1.5 px-2 border-r border-white/15">
                                  {hdr}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="bg-white font-mono whitespace-nowrap text-stone-900">
                              {rowCells.map((val, idx) => (
                                <td key={idx} className="py-1.5 px-2 border-r border-stone-200 font-bold">
                                  {val === '' || val === null || val === undefined ? '—' : String(val)}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(buildTabSeparatedRow(previewOrder));
                          triggerLocalToast('¡Fila de 27 columnas copiada al portapapeles!', 'info');
                        }}
                        className="w-full py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 text-[11px] font-bold flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copiar Fila para pegar manualmente (A→AA)</span>
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Delete Order Option inside Step 3 when modifying an existing order */}
              {isEditMode && editingOrder && (
                <div className="pt-2 border-t border-rose-200/80">
                  {!confirmingDelete ? (
                    <button
                      type="button"
                      disabled={isSavingOrder || isDeletingOrder}
                      onClick={() => setConfirmingDelete(true)}
                      className="w-full py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar Pedido #{editingOrder.id}</span>
                    </button>
                  ) : (
                    <div className="p-3 rounded-2xl bg-rose-50 border-2 border-rose-300 space-y-2.5">
                      <p className="text-xs font-extrabold text-rose-900 text-center">
                        ¿Seguro que querés eliminar el pedido #{editingOrder.id} de {editingOrder.cliente}?
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={isDeletingOrder}
                          onClick={() => setConfirmingDelete(false)}
                          className="py-2 rounded-xl bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 text-xs font-extrabold cursor-pointer"
                        >
                          No, conservar
                        </button>
                        <button
                          type="button"
                          disabled={isDeletingOrder}
                          onClick={handleDeleteOrder}
                          className="py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center justify-center space-x-1 cursor-pointer shadow-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isDeletingOrder ? 'Eliminando...' : 'Sí, Eliminar'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

        </div>
      </div>

      {/* ===================================================================== */}
      {/* PINNED FULL-SCREEN BOTTOM ACTION BAR (MOBILE & DESKTOP)               */}
      {/* ===================================================================== */}
      <footer className="bg-white border-t-2 border-[#0f4b25]/20 px-3 sm:px-6 py-2.5 sm:py-3 shrink-0 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <div className="max-w-[1800px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Live Order Summary */}
          <div className="flex items-center justify-between sm:justify-start sm:space-x-4 text-xs">
            <div className="truncate max-w-[180px] sm:max-w-xs">
              <span className="text-stone-400 font-bold uppercase text-[10px] block">
                {isEditMode ? `Modificando #${editingOrder?.id}` : 'Cliente'}
              </span>
              <span className="font-black text-stone-900 truncate block">
                {clientName.trim() || 'Sin seleccionar'}
              </span>
            </div>

            <div className="h-7 w-px bg-stone-200 hidden sm:block" />

            <div className="text-right sm:text-left">
              <span className="text-stone-400 font-bold uppercase text-[10px] block">
                {totalSelectedUnits} paq. • {pagoStatus === 'SI' ? 'Pagado' : 'Debe'} • {entregadoStatus === 'SI' ? 'Entregado' : 'Por entregar'}
              </span>
              <div className="flex items-baseline justify-end sm:justify-start space-x-2">
                <span className="font-black text-base sm:text-lg text-[#0f4b25] font-mono">
                  ${finalPriceNumber.toLocaleString('es-AR')}
                </span>
                <span className="text-[11px] font-extrabold text-emerald-700 font-mono">
                  (+${calculatedProfit.toLocaleString('es-AR')} gan.)
                </span>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center gap-2">
            {isEditMode ? (
              confirmingDelete ? (
                <>
                  <button
                    type="button"
                    disabled={isDeletingOrder}
                    onClick={() => setConfirmingDelete(false)}
                    className="px-3.5 sm:px-4 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-800 font-extrabold text-xs transition-all active:scale-95 cursor-pointer shrink-0"
                  >
                    No, volver
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingOrder}
                    onClick={handleDeleteOrder}
                    className="flex-1 sm:flex-initial sm:min-w-[260px] py-3 px-5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-black text-xs sm:text-sm shadow-lg flex items-center justify-center space-x-2 transition-all active:scale-98 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                    <span>
                      {isDeletingOrder
                        ? 'Eliminando pedido...'
                        : `Confirmar Eliminar #${editingOrder?.id}`}
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isSavingOrder || isDeletingOrder}
                    onClick={() => setConfirmingDelete(true)}
                    className="px-3 sm:px-4 py-3 rounded-2xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 disabled:opacity-50 font-extrabold text-xs flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer shrink-0"
                    title="Eliminar este pedido de la app y de la hoja Ventas"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>Eliminar Pedido</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSavingOrder || isDeletingOrder}
                    onClick={onClose}
                    className="hidden sm:inline-flex px-3.5 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-800 font-extrabold text-xs transition-all active:scale-95 cursor-pointer shrink-0"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    disabled={isSavingOrder || isDeletingOrder}
                    onClick={() => submitOrder(false)}
                    className="flex-1 sm:flex-initial sm:min-w-[250px] py-3 px-4 sm:px-5 rounded-2xl bg-[#0f4b25] hover:bg-[#145e2f] disabled:bg-stone-300 text-[#ece7d7] font-black text-xs sm:text-sm shadow-lg flex items-center justify-center space-x-2 transition-all active:scale-98 cursor-pointer"
                  >
                    <Save className="w-4 h-4 sm:w-5 sm:h-5 text-[#e68628] shrink-0" />
                    <span>
                      {isSavingOrder
                        ? 'Guardando cambios...'
                        : `Guardar Cambios ($${finalPriceNumber.toLocaleString('es-AR')})`}
                    </span>
                  </button>
                </>
              )
            ) : (
              <>
                <button
                  type="button"
                  disabled={isSavingOrder}
                  onClick={() => submitOrder(true)}
                  className="px-3 sm:px-4 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-800 font-extrabold text-xs transition-all active:scale-95 cursor-pointer shrink-0"
                  title="Guarda este pedido en Google Sheets y deja la pantalla abierta para cargar otro"
                >
                  Guardar + Otro
                </button>

                <button
                  type="button"
                  disabled={isSavingOrder}
                  onClick={() => submitOrder(false)}
                  className="flex-1 sm:flex-initial sm:min-w-[260px] py-3 px-5 rounded-2xl bg-[#0f4b25] hover:bg-[#145e2f] disabled:bg-stone-300 text-[#ece7d7] font-black text-xs sm:text-sm shadow-lg flex items-center justify-center space-x-2 transition-all active:scale-98 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#e68628] shrink-0" />
                  <span>
                    {isSavingOrder
                      ? 'Guardando en Ventas...'
                      : `Cargar Pedido ($${finalPriceNumber.toLocaleString('es-AR')})`}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
