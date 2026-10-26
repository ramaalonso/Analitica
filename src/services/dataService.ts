import { YerbazoDataset, WebStoreData, NewOrderPayload, OrderStatusOverride } from '../types';
import { parseRawDataset, normalizeClientName, normalizeProductName } from '../utils/dataParser';
import { RAW_SNAPSHOT_DATA } from '../data/initialData';
import * as XLSX from 'xlsx';

const GOOGLE_SHEET_ID = '15hjl5YFZqSFRGuh1IEv7zHDRXrQPPfvRU8dijVOmWPY';
const CACHE_VERSION = 'v7_live_sheet_truth_oct2026';
const LOCAL_ORDERS_KEY = 'yerbazo_local_orders_v2';
const STATUS_OVERRIDES_KEY = 'yerbazo_status_overrides_v2';
const LOCAL_CLIENTS_KEY = 'yerbazo_local_clients_v2';
const APPS_SCRIPT_URL_KEY = 'yerbazo_apps_script_url';

// Clean up legacy v1 keys that held deleted test orders
try {
  localStorage.removeItem('yerbazo_local_orders_v1');
  localStorage.removeItem('yerbazo_status_overrides_v1');
  localStorage.removeItem('yerbazo_local_clients_v1');
} catch {
  // ignore
}

const TABS_CONFIG = [
  { id: 'ventas', gid: '1558868693', name: 'Ventas' },
  { id: 'stock', gid: '1278668720', name: 'Stock' },
  { id: 'ganancia', gid: '1837448515', name: 'Ganancia' },
  { id: 'prox_compra', gid: '100594293', name: 'Prox compra' },
  { id: 'clientes', gid: '766684196', name: 'Clientes' },
  { id: 'mates_bombillas', gid: '1990667304', name: 'Stock myb' },
  { id: 'hoja1', gid: '0', name: 'Hoja 1' }
];

// RFC-compliant CSV parser that keeps all cells as raw text without XLSX numeric corruption
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(cell.trim());
      lines.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  
  if (cell || row.length > 0) {
    row.push(cell.trim());
    lines.push(row);
  }
  
  return lines;
}

// 23 Live products snapshot directly extracted from https://yerbazo.com.ar/ & Firebase store
export const DEFAULT_WEB_STORE_DATA: WebStoreData = {
  lastUpdated: new Date().toISOString(),
  coupons: [
    { id: 1791241665444, code: 'AMOAMAMA', discount: 10, active: true }
  ],
  products: [
    { id: 1, title: 'Baldo 1kg', price: 10900, category: '1kg', badge: '1 kg', weight: '1 kg', image: 'https://yerbazo.com.ar/img/Baldo%201kg.webp', isSale: false, stockStatus: 'normal' },
    { id: 2, title: 'Baldo 500g', price: 6200, category: '500g', badge: '500 g', weight: '500 g', image: 'https://yerbazo.com.ar/img/Baldo%20500g.webp', isSale: false, stockStatus: 'normal' },
    { id: 3, title: 'Canarias tradicional 1kg', price: 10700, category: '1kg', badge: '1 kg', weight: '1 kg', image: 'https://yerbazo.com.ar/img/Canarias%20tradicional%201kg.webp', isSale: false, stockStatus: 'normal' },
    { id: 4, title: 'Canarias tradicional 500g', price: 6000, category: '500g', badge: '500 g', weight: '500 g', image: 'https://yerbazo.com.ar/img/Canarias%20tradicional%20500g.webp', isSale: false, stockStatus: 'normal' },
    { id: 5, title: 'Canarias serena 1kg', price: 11500, category: '1kg', badge: '1 kg', weight: '1 kg', image: 'https://yerbazo.com.ar/img/Canarias%20serena%201kg.webp', isSale: false, isUrgent: true, stockStatus: 'ultimas' },
    { id: 6, title: 'Canarias serena 500g', price: 6700, category: '500g', badge: '500 g', weight: '500 g', image: 'https://yerbazo.com.ar/img/Canarias%20serena%20500g.webp', isSale: false, stockStatus: 'normal' },
    { id: 7, title: 'Canarias edicion especial 1kg', price: 11700, category: '1kg', badge: '1 kg', weight: '1 kg', image: 'https://yerbazo.com.ar/img/Canarias%20edicion%20especial%201kg.webp', isSale: false, isUrgent: true, stockStatus: 'ultimas' },
    { id: 8, title: 'Canarias edicion especial 500g', price: 6700, category: '500g', badge: '500 g', weight: '500 g', image: 'https://yerbazo.com.ar/img/Canarias%20edicion%20especial%20500g.webp', isSale: false, stockStatus: 'normal' },
    { id: 23, title: 'Canarias Te Verde y Jenjibre 1kg', price: 11700, category: '1kg', badge: '1 kg', weight: '1 kg', image: 'https://yerbazo.com.ar/img/Canarias%20te%20verde%20y%20jenjibre%201kg.webp', isSale: false, stockStatus: 'normal' },
    { id: 9, title: 'ReiVerde premium 1kg', price: 10500, category: '1kg', badge: '1 kg', weight: '1 kg', image: 'https://yerbazo.com.ar/img/ReiVerde%20premium%201kg.webp', isSale: false, stockStatus: 'normal' },
    { id: 10, title: 'ReiVerde premium 500g', price: 5800, category: '500g', badge: '500 g', weight: '500 g', image: 'https://yerbazo.com.ar/img/ReiVerde%20premium%20500g.webp', isSale: false, stockStatus: 'normal' },
    { id: 22, title: 'ReiVerde Padron Argentino 1kg', price: 7500, category: '1kg', badge: '1 kg', weight: '1 kg', image: 'https://yerbazo.com.ar/img/ReiVerde%20Padron%20Argentino%201kg.webp', isSale: false, stockStatus: 'normal' },
    { id: 21, title: 'ReiVerde Padron Argentino 500g', price: 4300, category: '500g', badge: '500 g', weight: '500 g', image: 'https://yerbazo.com.ar/img/ReiVerde%20Padron%20Argentino%20500g.webp', isSale: false, stockStatus: 'normal' },
    { id: 11, title: 'Verdecita 1kg', price: 8300, category: '1kg', badge: '1 kg', weight: '1 kg', image: 'https://yerbazo.com.ar/img/Verdecita%201kg.webp', isSale: false, stockStatus: 'normal' },
    { id: 12, title: 'Verdecita 500g', price: 4400, category: '500g', badge: '500 g', weight: '500 g', image: 'https://yerbazo.com.ar/img/Verdecita%20500g.webp', isSale: false, stockStatus: 'normal' },
    { id: 19, title: 'Verdecita con palo 1KG', price: 6200, salePrice: 5700, category: '1kg', badge: '1 kg', weight: '1 kg', image: 'https://yerbazo.com.ar/img/verdecita%20con%20palo%201kg.webp', isSale: true, stockStatus: 'normal' },
    { id: 13, title: 'Pindare 1kg', price: 7700, category: '1kg', badge: '1 kg', weight: '1 kg', image: 'https://yerbazo.com.ar/img/Pindare%201kg.webp', isSale: false, stockStatus: 'normal' },
    { id: 14, title: 'Pindare 500g', price: 5200, salePrice: 4700, category: '500g', badge: '500 g', weight: '500 g', image: 'https://yerbazo.com.ar/img/Pindare%20500g.webp', isSale: true, stockStatus: 'normal' },
    { id: 15, title: 'Lata baldo 500g', price: 23000, salePrice: 18500, category: 'otros', badge: '500 g', image: 'https://yerbazo.com.ar/img/Lata%20baldo.webp', isSale: true, isUrgent: true, stockStatus: 'ultimas' },
    { id: 16, title: 'Reposa mate', price: 4000, salePrice: 3500, category: 'otros', badge: 'Otros', image: 'https://yerbazo.com.ar/img/Reposa%20mate%20portada.webp', isSale: true, isUrgent: true, stockStatus: 'ultimas' },
    { id: 17, title: 'Yerbera marron 400G', price: 11000, category: 'otros', badge: 'Otros', image: 'https://yerbazo.com.ar/img/yerbera_marron.webp', isSale: false, stockStatus: 'normal' },
    { id: 18, title: 'Yerbera negra 400G', price: 11000, category: 'otros', badge: 'Otros', image: 'https://yerbazo.com.ar/img/yerbera_negra.webp', isSale: false, stockStatus: 'normal' },
    { id: 20, title: 'Pico mate System', price: 6000, category: 'otros', badge: 'Otros', image: 'https://yerbazo.com.ar/img/pico_sistem_2.webp', isSale: false, stockStatus: 'normal' }
  ]
};

export async function fetchLiveWebStore(): Promise<WebStoreData> {
  const timestamp = Date.now();
  const urls = [
    `https://yerbazo-default-rtdb.firebaseio.com/store.json?t=${timestamp}`,
    `/api/web-store?t=${timestamp}`
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.products) && data.products.length > 0) {
          const sanitizedProducts = data.products.map((p: any) => ({
            ...p,
            image: p.image && !p.image.startsWith('http') ? `https://yerbazo.com.ar/${p.image}` : p.image
          }));
          
          const rawCoupons = Array.isArray(data.coupons) ? data.coupons : [];
          const activeCoupons = rawCoupons
            .filter((c: any) => c && c.active && c.code && c.code !== '__EMPTY__' && Number(c.discount) > 0)
            .map((c: any) => ({
              id: c.id ?? Math.random(),
              code: String(c.code).trim().toUpperCase(),
              discount: Number(c.discount) || 0,
              active: true
            }));

          return {
            products: sanitizedProducts,
            coupons: activeCoupons,
            lastUpdated: data.lastUpdated || new Date().toISOString()
          };
        }
      }
    } catch (e) {
      // try next url
    }
  }

  return DEFAULT_WEB_STORE_DATA;
}

const FIREBASE_ORDERS_SYNC_URL = 'https://yerbazo-default-rtdb.firebaseio.com/orders_sync.json';
const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzx3mn3Whw-sDPwmIVylt7v_myFkXQiOlsHBMj8mIPyJXrFcTJu7sAp01gAqYsSOpD8/exec';

export function getAppsScriptUrl(): string {
  try {
    const saved = (localStorage.getItem(APPS_SCRIPT_URL_KEY) || '').trim();
    return saved || DEFAULT_APPS_SCRIPT_URL;
  } catch {
    return DEFAULT_APPS_SCRIPT_URL;
  }
}

export function setAppsScriptUrl(url: string): void {
  try {
    localStorage.setItem(APPS_SCRIPT_URL_KEY, url.trim());
    pushCloudSyncState().catch(() => {});
  } catch {
    // ignore
  }
}

export function getLocalOrders(): NewOrderPayload[] {
  try {
    const raw = localStorage.getItem(LOCAL_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalOrdersList(orders: NewOrderPayload[]): void {
  try {
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));
  } catch {
    // ignore
  }
}

export function getStatusOverrides(): Record<string, OrderStatusOverride> {
  try {
    const raw = localStorage.getItem(STATUS_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveStatusOverridesMap(map: Record<string, OrderStatusOverride>): void {
  try {
    localStorage.setItem(STATUS_OVERRIDES_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getLocalClients(): { cliente: string; comoNosConocio: string; direccionEntrega: string }[] {
  try {
    const raw = localStorage.getItem(LOCAL_CLIENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalClientsList(clients: { cliente: string; comoNosConocio: string; direccionEntrega: string }[]): void {
  try {
    localStorage.setItem(LOCAL_CLIENTS_KEY, JSON.stringify(clients));
  } catch {
    // ignore
  }
}

export function formatArsForSheet(amount: number): string {
  const rounded = Math.round(amount || 0);
  const absFormatted = Math.abs(rounded).toLocaleString('es-AR');
  return `${rounded < 0 ? '-' : ''}${absFormatted}$`;
}

export function generateOrderId(): string {
  const chars = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export const VENTAS_SHEET_HEADERS = [
  'Cliente',        // A (0)
  'ID_Venta',       // B (1)
  'Fecha',          // C (2)
  'Precio sistema', // D (3)
  'Precio final',   // E (4)
  'MEDIO DE PAGO',  // F (5)
  'PAGO',           // G (6)
  'Observaciones',  // H (7)
  'ENTREGADO',      // I (8)
  'Yerba 1',        // J (9)
  'STOCK',          // K (10)
  'Cantidad 1',     // L (11)
  'Yerba 2',        // M (12)
  'STOCK2',         // N (13)
  'Cantidad 2',     // O (14)
  'Yerba 3',        // P (15)
  'STOCK3',         // Q (16)
  'Cantidad 3',     // R (17)
  'Yerba 4',        // S (18)
  'STOCK4',         // T (19)
  'Cantidad 4',     // U (20)
  'Yerba 5',        // V (21)
  'STOCK5',         // W (22)
  'Cantidad 5',     // X (23)
  'Mes',            // Y (24)
  'Semana',         // Z (25)
  'Ganancia'        // AA (26)
];

// Builds the exact 27-column CSV/display string row (A to AA) matching the "Ventas" tab
export function buildSheetRowFromOrder(order: NewOrderPayload, includeMetaFlags = false): string[] {
  const row: string[] = new Array(includeMetaFlags ? 32 : 27).fill('');
  row[0] = order.cliente.trim();
  row[1] = order.id;
  row[2] = order.fecha;
  row[3] = formatArsForSheet(order.precioSistema);
  row[4] = formatArsForSheet(order.precioFinal);
  row[5] = order.medioPago || '-----';
  row[6] = order.pago;
  row[7] = order.observaciones || '';
  row[8] = order.entregado;

  const slots = [
    { prodIdx: 9, stockIdx: 10, qtyIdx: 11 },
    { prodIdx: 12, stockIdx: 13, qtyIdx: 14 },
    { prodIdx: 15, stockIdx: 16, qtyIdx: 17 },
    { prodIdx: 18, stockIdx: 19, qtyIdx: 20 },
    { prodIdx: 21, stockIdx: 22, qtyIdx: 23 },
  ];

  for (let i = 0; i < slots.length; i++) {
    const item = order.items[i];
    const slot = slots[i];
    if (item && item.producto) {
      const remainingAfter = Math.max(0, (item.stockRestanteAntes ?? 0) - item.cantidad);
      row[slot.prodIdx] = item.producto;
      row[slot.stockIdx] = String(remainingAfter);
      row[slot.qtyIdx] = String(item.cantidad);
    } else {
      row[slot.prodIdx] = '';
      row[slot.stockIdx] = '0';
      row[slot.qtyIdx] = '';
    }
  }

  row[24] = order.mes.toLowerCase();
  row[25] = order.semana;
  row[26] = formatArsForSheet(order.ganancia);

  if (includeMetaFlags) {
    row[30] = 'LOCAL_ORDER';
    row[31] = order.syncedToSheet ? 'SYNCED' : 'LOCAL';
  }

  return row;
}

// Builds the exact 27-column native row (numbers for prices, stock, quantities, profit) for Google Sheets setValues()
export function buildGoogleSheetNativeRowFromOrder(order: NewOrderPayload): (string | number)[] {
  const row: (string | number)[] = new Array(27).fill('');
  row[0] = order.cliente.trim();
  row[1] = order.id;
  row[2] = order.fecha;
  row[3] = Math.round(order.precioSistema || 0);
  row[4] = Math.round(order.precioFinal || 0);
  row[5] = order.medioPago || '-----';
  row[6] = order.pago;
  row[7] = order.observaciones || '';
  row[8] = order.entregado;

  const slots = [
    { prodIdx: 9, stockIdx: 10, qtyIdx: 11 },
    { prodIdx: 12, stockIdx: 13, qtyIdx: 14 },
    { prodIdx: 15, stockIdx: 16, qtyIdx: 17 },
    { prodIdx: 18, stockIdx: 19, qtyIdx: 20 },
    { prodIdx: 21, stockIdx: 22, qtyIdx: 23 },
  ];

  for (let i = 0; i < slots.length; i++) {
    const item = order.items[i];
    const slot = slots[i];
    if (item && item.producto) {
      const remainingAfter = Math.max(0, (item.stockRestanteAntes ?? 0) - item.cantidad);
      row[slot.prodIdx] = item.producto;
      row[slot.stockIdx] = Number(remainingAfter);
      row[slot.qtyIdx] = Number(item.cantidad);
    } else {
      row[slot.prodIdx] = '';
      row[slot.stockIdx] = 0;
      row[slot.qtyIdx] = '';
    }
  }

  row[24] = order.mes.toLowerCase();
  row[25] = order.semana;
  row[26] = Math.round(order.ganancia || 0);

  return row;
}

export function buildTabSeparatedRow(order: NewOrderPayload): string {
  return buildGoogleSheetNativeRowFromOrder(order).join('\t');
}

// Cross-device cloud sync via Yerbazo's live Firebase Realtime Database
export async function pullCloudSyncState(): Promise<void> {
  try {
    const res = await fetch(`${FIREBASE_ORDERS_SYNC_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const cloud = await res.json();
    if (!cloud || typeof cloud !== 'object') return;

    // 1. Sync Apps Script URL if configured on another device (e.g. PC -> Phone)
    if (cloud.appsScriptUrl && typeof cloud.appsScriptUrl === 'string' && !getAppsScriptUrl()) {
      localStorage.setItem(APPS_SCRIPT_URL_KEY, cloud.appsScriptUrl.trim());
    }

    // 2. Replace local orders with active cloud orders + any very recent local order (<15s)
    const now = Date.now();
    const cloudOrders: NewOrderPayload[] = Array.isArray(cloud.orders) ? cloud.orders : [];
    const localOrders = getLocalOrders();
    const map = new Map<string, NewOrderPayload>();

    for (const co of cloudOrders) {
      if (co && co.id) {
        map.set(co.id, co);
      }
    }
    for (const lo of localOrders) {
      if (lo && lo.id && !map.has(lo.id)) {
        const ageMs = now - new Date(lo.createdAt || 0).getTime();
        if (!lo.syncedToSheet || ageMs < 15000) {
          map.set(lo.id, lo);
        }
      }
    }
    saveLocalOrdersList(Array.from(map.values()));

    // 3. Sync status overrides (cloud is authoritative, keep recent local <15s)
    const cloudOv: Record<string, OrderStatusOverride> =
      cloud.overrides && typeof cloud.overrides === 'object' ? cloud.overrides : {};
    const localOv = getStatusOverrides();
    const mergedOv: Record<string, OrderStatusOverride> = { ...cloudOv };
    for (const [id, lov] of Object.entries(localOv)) {
      const ageMs = now - new Date(lov.updatedAt || 0).getTime();
      if (!mergedOv[id] && (!lov.syncedToSheet || ageMs < 15000)) {
        mergedOv[id] = lov;
      }
    }
    saveStatusOverridesMap(mergedOv);
  } catch {
    // ignore offline errors
  }
}

export async function pushCloudSyncState(): Promise<void> {
  try {
    const payload = {
      appsScriptUrl: getAppsScriptUrl(),
      orders: getLocalOrders(),
      overrides: getStatusOverrides(),
      clients: getLocalClients(),
      lastUpdated: new Date().toISOString()
    };
    await fetch(FIREBASE_ORDERS_SYNC_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch {
    // ignore offline errors
  }
}

export function applyLocalChangesToRawData(baseRawData: any, isFromLiveSheet = false): any {
  const rawData = {
    ...baseRawData,
    ventas: {
      ...(baseRawData.ventas || {}),
      rows: (baseRawData.ventas?.rows || []).map((r: string[]) => [...r])
    },
    stock: {
      ...(baseRawData.stock || {}),
      rows: (baseRawData.stock?.rows || []).map((r: string[]) => [...r])
    },
    clientes: {
      ...(baseRawData.clientes || {}),
      rows: (baseRawData.clientes?.rows || []).map((r: string[]) => [...r])
    }
  };

  const localOrders = getLocalOrders();
  const statusOverrides = getStatusOverrides();
  const localClients = getLocalClients();
  const now = Date.now();

  // 1. Check existing order IDs in Ventas rows from Google Sheets
  const sheetOrderIds = new Set<string>();
  for (let i = 1; i < rawData.ventas.rows.length; i++) {
    const id = String(rawData.ventas.rows[i]?.[1] || '').trim();
    if (id) sheetOrderIds.add(id.toLowerCase());
  }

  // 2. Reconcile localOrders against the live Google Sheet:
  // - If an order is ALREADY present in sheetOrderIds, Google Sheets now owns it -> remove from localOrders buffer!
  // - If an order had syncedToSheet=true and >15s have passed and it is NOT in sheetOrderIds on a live fetch,
  //   it means the user deleted it in Google Sheets -> remove from localOrders buffer!
  const remainingLocalOrders: NewOrderPayload[] = [];
  let localOrdersChanged = false;

  for (const lo of localOrders) {
    const idNorm = (lo.id || '').trim().toLowerCase();
    const ageMs = now - new Date(lo.createdAt || 0).getTime();

    if (sheetOrderIds.has(idNorm)) {
      // Already in the live Google Sheet! Purge from temporary local buffer so Sheet is 100% authoritative
      localOrdersChanged = true;
      continue;
    }

    if (isFromLiveSheet && lo.syncedToSheet && ageMs > 15000) {
      // Was synced to Sheet earlier, and now deleted from Google Sheets by user! Purge it
      localOrdersChanged = true;
      continue;
    }

    // Still pending or created <15s ago (waiting for Google CSV export cache to refresh)
    remainingLocalOrders.push(lo);
    const newRow = buildSheetRowFromOrder(lo, true);
    rawData.ventas.rows.push(newRow);

    // Adjust Stock counts (Vendidas & Restantes) for this pending order
    for (const item of lo.items) {
      const itemNorm = normalizeProductName(item.producto);
      const stockRow = rawData.stock.rows.find(
        (sr: string[], idx: number) => idx > 0 && normalizeProductName(sr?.[0] || '') === itemNorm
      );
      if (stockRow) {
        const prevVendidas = parseInt(stockRow[2] || '0', 10) || 0;
        const prevRestantes = parseInt(stockRow[3] || '0', 10) || 0;
        stockRow[2] = String(prevVendidas + item.cantidad);
        stockRow[3] = String(Math.max(0, prevRestantes - item.cantidad));
      }
    }
  }

  if (localOrdersChanged) {
    saveLocalOrdersList(remainingLocalOrders);
    pushCloudSyncState().catch(() => {});
  }

  // 3. Merge local clients into Clientes rows for any active remaining local orders
  const existingClientNorms = new Set<string>();
  for (let i = 1; i < rawData.clientes.rows.length; i++) {
    const name = rawData.clientes.rows[i]?.[0];
    if (name) existingClientNorms.add(normalizeClientName(name));
  }
  for (const lc of localClients) {
    const norm = normalizeClientName(lc.cliente);
    if (norm && !existingClientNorms.has(norm)) {
      rawData.clientes.rows.push([lc.cliente, lc.comoNosConocio || 'Directo', lc.direccionEntrega || '']);
      existingClientNorms.add(norm);
    }
  }

  // 4. Reconcile statusOverrides against the live Google Sheet:
  // Once an override has syncedToSheet=true and >15s have elapsed on a live fetch, purge it so direct edits in Google Sheets are never overwritten.
  let overridesChanged = false;
  const remainingOverrides: Record<string, OrderStatusOverride> = {};

  for (const [id, ov] of Object.entries(statusOverrides)) {
    const ageMs = now - new Date(ov.updatedAt || 0).getTime();
    if (isFromLiveSheet && ov.syncedToSheet && ageMs > 15000) {
      overridesChanged = true;
      continue;
    }
    remainingOverrides[id] = ov;
  }

  if (overridesChanged) {
    saveStatusOverridesMap(remainingOverrides);
    pushCloudSyncState().catch(() => {});
  }

  for (let i = 1; i < rawData.ventas.rows.length; i++) {
    const r = rawData.ventas.rows[i];
    if (!r) continue;
    const rowId = String(r[1] || `YB-${i}`).trim();
    const override = remainingOverrides[rowId];
    if (override) {
      if (override.cliente !== undefined) r[0] = override.cliente;
      if (override.fecha !== undefined) r[2] = override.fecha;
      if (override.precioSistema !== undefined) r[3] = formatArsForSheet(override.precioSistema);
      if (override.precioFinal !== undefined) r[4] = formatArsForSheet(override.precioFinal);
      if (override.medioPago !== undefined) r[5] = override.medioPago;
      if (override.pago !== undefined) r[6] = override.pago;
      if (override.observaciones !== undefined) r[7] = override.observaciones;
      if (override.entregado !== undefined) r[8] = override.entregado;
      if (override.items && override.items.length > 0) {
        for (let slot = 0; slot < 5; slot++) {
          const item = override.items[slot];
          const baseIdx = 9 + slot * 3;
          if (item && item.producto) {
            r[baseIdx] = item.producto;
            r[baseIdx + 1] = String(Math.max(0, item.stockRestanteAntes - item.cantidad));
            r[baseIdx + 2] = String(item.cantidad);
          } else {
            r[baseIdx] = '';
            r[baseIdx + 1] = '0';
            r[baseIdx + 2] = '';
          }
        }
      }
      if (override.mes !== undefined) r[24] = override.mes.toLowerCase();
      if (override.semana !== undefined) r[25] = override.semana;
      if (override.ganancia !== undefined) r[26] = formatArsForSheet(override.ganancia);
      r[31] = override.syncedToSheet ? 'SYNCED' : 'PENDING_SYNC';
    }
  }

  return rawData;
}

function getCurrentBaseRawData(): any {
  try {
    const cached = localStorage.getItem('yerbazo_cached_dataset');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.version === CACHE_VERSION && parsed.data) {
        return parsed.data;
      }
    }
  } catch {
    // ignore
  }
  return RAW_SNAPSHOT_DATA;
}

export async function sendToGoogleAppsScript(payload: Record<string, any>): Promise<{ ok: boolean; message: string }> {
  let scriptUrl = getAppsScriptUrl();
  if (!scriptUrl) {
    await pullCloudSyncState();
    scriptUrl = getAppsScriptUrl();
  }
  if (!scriptUrl) {
    return {
      ok: false,
      message: 'Guardado y sincronizado en la nube Yerbazo. Activá el script en tu hoja para impacto directo en Ventas.'
    };
  }

  // 1. Try server proxy endpoint (/api/sheet-write) first to handle redirects cleanly without browser CORS blocks
  try {
    const proxyResp = await fetch('/api/sheet-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptUrl, payload })
    });
    if (proxyResp.ok) {
      const json = await proxyResp.json();
      if (json && json.ok !== false) {
        return { ok: true, message: json.message || 'Hoja Ventas de Google Sheets actualizada automáticamente' };
      }
      if (json && json.error) {
        return { ok: false, message: String(json.error) };
      }
    }
  } catch {
    // Fallback to direct fetch below
  }

  // 2. Fallback: Direct browser POST with text/plain (CORS simple request)
  try {
    const resp = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    if (resp.ok) {
      const json = await resp.json().catch(() => ({ ok: true }));
      if (json && json.ok !== false) {
        return { ok: true, message: json.message || 'Hoja Ventas de Google Sheets actualizada automáticamente' };
      }
      return { ok: false, message: json.error || 'Respuesta con advertencia desde Google Apps Script' };
    }
    return { ok: false, message: `Error HTTP ${resp.status} al contactar Google Apps Script` };
  } catch (err: any) {
    return { ok: false, message: 'Guardado en la nube de Yerbazo (se impactará en la hoja al sincronizar)' };
  }
}

export async function saveNewOrderAndSync(
  order: NewOrderPayload,
  currentWebStore?: WebStoreData
): Promise<{ dataset: YerbazoDataset; syncedToCloud: boolean; cloudMessage: string }> {
  // 1. If new client or has address/channel, store in local clients
  if (order.cliente.trim()) {
    const clients = getLocalClients();
    const norm = normalizeClientName(order.cliente);
    const existingIdx = clients.findIndex(c => normalizeClientName(c.cliente) === norm);
    const clientEntry = {
      cliente: order.cliente.trim(),
      comoNosConocio: order.comoNosConocio?.trim() || 'Directo',
      direccionEntrega: order.direccionEntrega?.trim() || ''
    };
    if (existingIdx >= 0) {
      if (clientEntry.direccionEntrega) clients[existingIdx].direccionEntrega = clientEntry.direccionEntrega;
      if (clientEntry.comoNosConocio) clients[existingIdx].comoNosConocio = clientEntry.comoNosConocio;
    } else if (order.esClienteNuevo || order.direccionEntrega || order.comoNosConocio) {
      clients.push(clientEntry);
    }
    saveLocalClientsList(clients);
  }

  // 2. Save order locally first
  const localOrders = getLocalOrders();
  const newOrderRecord: NewOrderPayload = {
    ...order,
    createdAt: new Date().toISOString(),
    syncedToSheet: false
  };
  localOrders.push(newOrderRecord);
  saveLocalOrdersList(localOrders);

  // 3. Push to Firebase Realtime DB so both Phone and PC see it immediately
  pushCloudSyncState().catch(() => {});

  // 4. Write new 27-column row directly to Google Sheets "Ventas" tab via Apps Script
  const nativeRowValues = buildGoogleSheetNativeRowFromOrder(newOrderRecord);
  const cloudResult = await sendToGoogleAppsScript({
    action: 'addOrder',
    id: newOrderRecord.id,
    row: nativeRowValues,
    clientRow: order.esClienteNuevo
      ? [order.cliente.trim(), order.comoNosConocio?.trim() || 'Directo', order.direccionEntrega?.trim() || '']
      : null
  });

  if (cloudResult.ok) {
    const updatedList = getLocalOrders().map(o => o.id === newOrderRecord.id ? { ...o, syncedToSheet: true } : o);
    saveLocalOrdersList(updatedList);
    pushCloudSyncState().catch(() => {});
  }

  // 5. Recompute dataset immediately
  const baseRaw = getCurrentBaseRawData();
  const mergedRaw = applyLocalChangesToRawData(baseRaw);
  const dataset = parseRawDataset(mergedRaw);
  dataset.webStore = currentWebStore || DEFAULT_WEB_STORE_DATA;
  dataset.lastSyncTime = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return {
    dataset,
    syncedToCloud: cloudResult.ok,
    cloudMessage: cloudResult.message
  };
}

export async function updateOrderStatusAndSync(
  saleId: string,
  updates: Partial<Omit<OrderStatusOverride, 'id' | 'updatedAt' | 'syncedToSheet'>>,
  currentWebStore?: WebStoreData
): Promise<{ dataset: YerbazoDataset; syncedToCloud: boolean; cloudMessage: string }> {
  // 1. Save in status overrides
  const overrides = getStatusOverrides();
  const existing = overrides[saleId] || { id: saleId, updatedAt: new Date().toISOString() };
  const mergedOverride: OrderStatusOverride = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
    syncedToSheet: false
  };
  overrides[saleId] = mergedOverride;
  saveStatusOverridesMap(overrides);

  // Also update if it's in localOrders
  const localOrders = getLocalOrders();
  const localIdx = localOrders.findIndex(o => o.id === saleId);
  if (localIdx >= 0) {
    if (updates.cliente !== undefined) localOrders[localIdx].cliente = updates.cliente;
    if (updates.fecha !== undefined) localOrders[localIdx].fecha = updates.fecha;
    if (updates.precioSistema !== undefined) localOrders[localIdx].precioSistema = updates.precioSistema;
    if (updates.precioFinal !== undefined) localOrders[localIdx].precioFinal = updates.precioFinal;
    if (updates.medioPago !== undefined) localOrders[localIdx].medioPago = updates.medioPago;
    if (updates.pago !== undefined) localOrders[localIdx].pago = updates.pago;
    if (updates.entregado !== undefined) localOrders[localIdx].entregado = updates.entregado;
    if (updates.observaciones !== undefined) localOrders[localIdx].observaciones = updates.observaciones;
    if (updates.items !== undefined) localOrders[localIdx].items = updates.items;
    if (updates.mes !== undefined) localOrders[localIdx].mes = updates.mes;
    if (updates.semana !== undefined) localOrders[localIdx].semana = updates.semana;
    if (updates.ganancia !== undefined) localOrders[localIdx].ganancia = updates.ganancia;
    saveLocalOrdersList(localOrders);
  }

  pushCloudSyncState().catch(() => {});

  // 2. Send update to Google Apps Script
  const cloudResult = await sendToGoogleAppsScript({
    action: 'updateStatus',
    id: saleId,
    ...updates
  });

  if (cloudResult.ok) {
    const freshOverrides = getStatusOverrides();
    if (freshOverrides[saleId]) {
      freshOverrides[saleId].syncedToSheet = true;
      saveStatusOverridesMap(freshOverrides);
      pushCloudSyncState().catch(() => {});
    }
  }

  // 3. Recompute dataset immediately
  const baseRaw = getCurrentBaseRawData();
  const mergedRaw = applyLocalChangesToRawData(baseRaw);
  const dataset = parseRawDataset(mergedRaw);
  dataset.webStore = currentWebStore || DEFAULT_WEB_STORE_DATA;
  dataset.lastSyncTime = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return {
    dataset,
    syncedToCloud: cloudResult.ok,
    cloudMessage: cloudResult.message
  };
}

export function deleteLocalOrder(saleId: string, currentWebStore?: WebStoreData): YerbazoDataset {
  const localOrders = getLocalOrders().filter(o => o.id !== saleId);
  saveLocalOrdersList(localOrders);

  const overrides = getStatusOverrides();
  delete overrides[saleId];
  saveStatusOverridesMap(overrides);

  pushCloudSyncState().catch(() => {});

  const baseRaw = getCurrentBaseRawData();
  const mergedRaw = applyLocalChangesToRawData(baseRaw);
  const dataset = parseRawDataset(mergedRaw);
  dataset.webStore = currentWebStore || DEFAULT_WEB_STORE_DATA;
  return dataset;
}

export async function syncPendingToGoogleSheets(): Promise<{ syncedOrders: number; syncedUpdates: number; message: string }> {
  await pullCloudSyncState();
  const scriptUrl = getAppsScriptUrl();
  if (!scriptUrl) {
    return { syncedOrders: 0, syncedUpdates: 0, message: 'Primero pegá la URL de tu Google Apps Script.' };
  }

  let syncedOrders = 0;
  let syncedUpdates = 0;

  const localOrders = getLocalOrders();
  for (const order of localOrders) {
    if (!order.syncedToSheet) {
      const res = await sendToGoogleAppsScript({
        action: 'addOrder',
        id: order.id,
        row: buildGoogleSheetNativeRowFromOrder(order),
        clientRow: order.esClienteNuevo
          ? [order.cliente.trim(), order.comoNosConocio?.trim() || 'Directo', order.direccionEntrega?.trim() || '']
          : null
      });
      if (res.ok) {
        order.syncedToSheet = true;
        syncedOrders++;
      }
    }
  }
  saveLocalOrdersList(localOrders);

  const overrides = getStatusOverrides();
  for (const [id, ov] of Object.entries(overrides)) {
    if (!ov.syncedToSheet) {
      const res = await sendToGoogleAppsScript({
        action: 'updateStatus',
        ...ov,
        id
      });
      if (res.ok) {
        ov.syncedToSheet = true;
        syncedUpdates++;
      }
    }
  }
  saveStatusOverridesMap(overrides);
  pushCloudSyncState().catch(() => {});

  return {
    syncedOrders,
    syncedUpdates,
    message: `Sincronización completada: ${syncedOrders} fila(s) nueva(s) en Ventas y ${syncedUpdates} modificación(es) impactadas en Google Sheets.`
  };
}

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `// ============================================================================
// CONECTOR OFICIAL YERBAZO <-> HOJA "Ventas" DE GOOGLE SHEETS
// Hoja: 15hjl5YFZqSFRGuh1IEv7zHDRXrQPPfvRU8dijVOmWPY
// ============================================================================
// INSTRUCCIONES POR ÚNICA VEZ (1 minuto):
// 1. En tu Google Sheet de Yerbazo, abrí el menú superior: Extensiones -> Apps Script
// 2. Borrá lo que haya en Código.gs y pegá todo este código. Guardá (Ctrl+S o ícono 💾).
// 3. Tocá el botón azul "Implementar" (arriba a la derecha) -> "Nueva implementación"
// 4. Tocá la ruedita ⚙️ al lado de "Selecciona el tipo" y elegí "Aplicación web":
//    - Ejecutar como: "Yo"
//    - Quién tiene acceso: "Cualquier persona"
// 5. Tocá "Implementar", autorizá el acceso con tu cuenta de Google y copiá la URL que termina en /exec
// 6. Pegá esa URL en el botón "Conectar Escritura Google Sheet" de Yerbazo (o pasala en el chat).
// ============================================================================

const SHEET_ID = '15hjl5YFZqSFRGuh1IEv7zHDRXrQPPfvRU8dijVOmWPY';
const FIREBASE_SYNC_URL = 'https://yerbazo-default-rtdb.firebaseio.com/orders_sync.json';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🌿 Yerbazo App')
    .addItem('🔄 Sincronizar pedidos y cambios desde Celu/PC', 'sincronizarDesdeNubeYerbazo')
    .addToUi();
}

function doGet(e) {
  return jsonResponse({ ok: true, status: 'Conector Yerbazo activo' });
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SHEET_ID);

    if (payload.action === 'ping') {
      return jsonResponse({ ok: true, message: 'Conexión exitosa con la hoja Ventas de Yerbazo' });
    }

    if (payload.action === 'addOrder') {
      var res = insertarFilaEnVentas(ss, payload.id, payload.row, payload.clientRow);
      return jsonResponse(res);
    }

    if (payload.action === 'updateStatus' || payload.action === 'updateOrder') {
      var resStatus = actualizarFilaEnVentas(ss, payload);
      return jsonResponse(resStatus);
    }

    return jsonResponse({ ok: false, error: 'Acción no reconocida' });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function insertarFilaEnVentas(ss, orderId, rowValues, clientRow) {
  var ventasSheet = ss.getSheetByName('Ventas');
  if (!ventasSheet) return { ok: false, error: 'No se encontró la pestaña Ventas' };

  var data = ventasSheet.getDataRange().getValues();

  // 1. Evitar duplicados verificando ID_Venta en columna B
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim().toLowerCase() === String(orderId).trim().toLowerCase()) {
      return { ok: true, message: 'El pedido #' + orderId + ' ya estaba en la fila ' + (i + 1) + ' de Ventas' };
    }
  }

  // 2. Encontrar la última fila real con datos en Cliente (Col A) o Yerba 1 (Col J)
  var lastUsedRow = 1;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][0]).trim() !== '' || String(data[r][9]).trim() !== '') {
      lastUsedRow = r + 1;
    }
  }
  var targetRow = lastUsedRow + 1;

  // 3. Normalizar tipos numéricos para que las tablas de Stock y Ganancia sumen automáticamente
  var cleanRow = [];
  for (var c = 0; c < 27; c++) {
    var val = rowValues[c];
    var isNumericCol = (c === 3 || c === 4 || c === 10 || c === 11 || c === 13 || c === 14 || c === 16 || c === 17 || c === 19 || c === 20 || c === 22 || c === 23 || c === 26);
    if (isNumericCol && val !== '' && val !== null && val !== undefined) {
      var num = Number(String(val).replace(/\\$/g, '').replace(/\\./g, '').replace(',', '.').trim());
      cleanRow.push(isNaN(num) ? val : num);
    } else {
      cleanRow.push(val === undefined || val === null ? '' : val);
    }
  }

  // 4. Si la hoja Ventas termina exactamente en la última fila usada (sin filas vacías abajo),
  // insertar automáticamente la nueva fila al fondo de la hoja:
  if (targetRow > ventasSheet.getMaxRows()) {
    ventasSheet.insertRowsAfter(ventasSheet.getMaxRows(), targetRow - ventasSheet.getMaxRows());
  }

  // 5. Copiar el diseño y formato visual de la fila anterior
  var targetRange = ventasSheet.getRange(targetRow, 1, 1, 27);
  if (targetRow > 2) {
    var prevRange = ventasSheet.getRange(targetRow - 1, 1, 1, 27);
    prevRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  }

  // 6. Escribir las 27 columnas (A hasta AA) en la nueva fila de Ventas
  targetRange.setValues([cleanRow]);
  ventasSheet.getRange(targetRow, 4, 1, 2).setNumberFormat('#,##0"$"');
  ventasSheet.getRange(targetRow, 27, 1, 1).setNumberFormat('#,##0"$"');

  // 7. Si además es un cliente nuevo, agregarlo en la pestaña "Clientes"
  if (clientRow && clientRow[0]) {
    var clientesSheet = ss.getSheetByName('Clientes');
    if (clientesSheet) {
      var cData = clientesSheet.getDataRange().getValues();
      var clientNameNorm = String(clientRow[0]).trim().toLowerCase();
      var exists = false;
      var lastClientRow = 1;
      for (var k = 1; k < cData.length; k++) {
        if (String(cData[k][0]).trim() !== '') {
          lastClientRow = k + 1;
          if (String(cData[k][0]).trim().toLowerCase() === clientNameNorm) {
            exists = true;
          }
        }
      }
      if (!exists) {
        if (lastClientRow + 1 > clientesSheet.getMaxRows()) {
          clientesSheet.insertRowsAfter(clientesSheet.getMaxRows(), 1);
        }
        clientesSheet.getRange(lastClientRow + 1, 1, 1, 3).setValues([clientRow]);
      }
    }
  }

  SpreadsheetApp.flush();
  return { ok: true, message: 'Nueva fila ' + targetRow + ' agregada al fondo de la hoja Ventas con todos los detalles' };
}

function actualizarFilaEnVentas(ss, payload) {
  var ventasSheet = ss.getSheetByName('Ventas');
  if (!ventasSheet) return { ok: false, error: 'No se encontró la pestaña Ventas' };

  var data = ventasSheet.getDataRange().getValues();
  var searchId = String(payload.id || '').trim().toLowerCase();
  var targetSheetRow = -1;

  for (var i = 1; i < data.length; i++) {
    var colB = String(data[i][1] || '').trim().toLowerCase();
    var fallbackId = ('yb-' + i).toLowerCase();
    if ((colB !== '' && colB === searchId) || fallbackId === searchId) {
      targetSheetRow = i + 1;
      break;
    }
  }

  if (targetSheetRow === -1 && payload.rowIndex && payload.rowIndex > 0 && payload.rowIndex < data.length) {
    targetSheetRow = payload.rowIndex + 1;
  }

  if (targetSheetRow === -1) {
    return { ok: false, error: 'No se encontró el pedido ' + payload.id + ' en la hoja Ventas' };
  }

  // Actualizar cualquier campo modificado del pedido:
  if (payload.cliente !== undefined) ventasSheet.getRange(targetSheetRow, 1).setValue(payload.cliente);
  if (payload.fecha !== undefined) ventasSheet.getRange(targetSheetRow, 3).setValue(payload.fecha);
  if (payload.precioSistema !== undefined) {
    ventasSheet.getRange(targetSheetRow, 4).setValue(Number(payload.precioSistema)).setNumberFormat('#,##0"$"');
  }
  if (payload.precioFinal !== undefined) {
    ventasSheet.getRange(targetSheetRow, 5).setValue(Number(payload.precioFinal)).setNumberFormat('#,##0"$"');
  }
  if (payload.medioPago !== undefined) ventasSheet.getRange(targetSheetRow, 6).setValue(payload.medioPago);
  if (payload.pago !== undefined) ventasSheet.getRange(targetSheetRow, 7).setValue(payload.pago);
  if (payload.observaciones !== undefined) ventasSheet.getRange(targetSheetRow, 8).setValue(payload.observaciones);
  if (payload.entregado !== undefined) ventasSheet.getRange(targetSheetRow, 9).setValue(payload.entregado);

  // Si se modificaron los productos o cantidades (items 1..5):
  if (payload.items && payload.items.length) {
    for (var slot = 0; slot < 5; slot++) {
      var it = payload.items[slot];
      var colBase = 10 + slot * 3; // Col J = 10
      if (it && it.producto) {
        var stockRest = Math.max(0, Number(it.stockRestanteAntes || 0) - Number(it.cantidad || 1));
        ventasSheet.getRange(targetSheetRow, colBase, 1, 3).setValues([[it.producto, stockRest, Number(it.cantidad)]]);
      } else {
        ventasSheet.getRange(targetSheetRow, colBase, 1, 3).setValues([['', 0, '']]);
      }
    }
  }

  if (payload.mes !== undefined) ventasSheet.getRange(targetSheetRow, 25).setValue(String(payload.mes).toLowerCase());
  if (payload.semana !== undefined) ventasSheet.getRange(targetSheetRow, 26).setValue(payload.semana);
  if (payload.ganancia !== undefined) {
    ventasSheet.getRange(targetSheetRow, 27).setValue(Number(payload.ganancia)).setNumberFormat('#,##0"$"');
  }

  return { ok: true, message: 'Fila ' + targetSheetRow + ' actualizada en la hoja Ventas' };
}

function sincronizarDesdeNubeYerbazo() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var resp = UrlFetchApp.fetch(FIREBASE_SYNC_URL);
  var cloud = JSON.parse(resp.getContentText());
  if (!cloud) return;

  var insertados = 0;
  var actualizados = 0;
  if (cloud.orders && cloud.orders.length) {
    for (var i = 0; i < cloud.orders.length; i++) {
      var o = cloud.orders[i];
      var row = [
        o.cliente, o.id, o.fecha, o.precioSistema, o.precioFinal,
        o.medioPago || '-----', o.pago, o.observaciones || '', o.entregado,
        o.items[0] ? o.items[0].producto : '', o.items[0] ? Math.max(0, o.items[0].stockRestanteAntes - o.items[0].cantidad) : 0, o.items[0] ? o.items[0].cantidad : '',
        o.items[1] ? o.items[1].producto : '', o.items[1] ? Math.max(0, o.items[1].stockRestanteAntes - o.items[1].cantidad) : 0, o.items[1] ? o.items[1].cantidad : '',
        o.items[2] ? o.items[2].producto : '', o.items[2] ? Math.max(0, o.items[2].stockRestanteAntes - o.items[2].cantidad) : 0, o.items[2] ? o.items[2].cantidad : '',
        o.items[3] ? o.items[3].producto : '', o.items[3] ? Math.max(0, o.items[3].stockRestanteAntes - o.items[3].cantidad) : 0, o.items[3] ? o.items[3].cantidad : '',
        o.items[4] ? o.items[4].producto : '', o.items[4] ? Math.max(0, o.items[4].stockRestanteAntes - o.items[4].cantidad) : 0, o.items[4] ? o.items[4].cantidad : '',
        (o.mes || 'octubre').toLowerCase(), o.semana || 'Semana 1', o.ganancia
      ];
      var res = insertarFilaEnVentas(ss, o.id, row, o.esClienteNuevo ? [o.cliente, o.comoNosConocio || 'Directo', o.direccionEntrega || ''] : null);
      if (res.ok && res.message.indexOf('Nueva fila') === 0) insertados++;
    }
  }

  if (cloud.overrides) {
    for (var id in cloud.overrides) {
      var ov = cloud.overrides[id];
      ov.id = id;
      var resUpd = actualizarFilaEnVentas(ss, ov);
      if (resUpd.ok) actualizados++;
    }
  }

  SpreadsheetApp.getActiveSpreadsheet().toast('Sincronización lista: ' + insertados + ' nuevos pedidos y ' + actualizados + ' modificaciones aplicadas en Ventas.', '🌿 Yerbazo');
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export async function fetchLiveGoogleSheet(options?: { skipWebStore?: boolean }): Promise<YerbazoDataset> {
  const rawData: any = {};
  const cacheBuster = Date.now();

  // Fetch all tabs in parallel with strict cache-busting so Google Sheets changes appear immediately
  await Promise.all(TABS_CONFIG.map(async (tab) => {
    const directUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=${tab.gid}&t=${cacheBuster}`;
    let csvText = '';
    
    try {
      // 1. Try local server endpoint if running
      const localResp = await fetch(`/api/sheet?gid=${tab.gid}&t=${cacheBuster}`, { cache: 'no-store' }).catch(() => null);
      if (localResp && localResp.ok) {
        csvText = await localResp.text();
      } else {
        // 2. Try direct (works in some browsers/environments or when server proxies)
        const resp = await fetch(directUrl, { cache: 'no-store' }).catch(() => null);
        if (resp && resp.ok) {
          csvText = await resp.text();
        } else {
          // 3. Fallback to public CORS proxy
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}&t=${cacheBuster}`;
          const pResp = await fetch(proxyUrl, { cache: 'no-store' });
          if (pResp.ok) {
            csvText = await pResp.text();
          }
        }
      }
    } catch (err) {
      console.warn(`Could not live fetch tab ${tab.name}, using local snapshot fallback`, err);
    }

    if (csvText && csvText.length > 20 && !csvText.trim().startsWith('<')) {
      // Parse CSV into pure string rows preserving exact currency formatting (dots as thousands)
      const rows = parseCSV(csvText);
      rawData[tab.id] = {
        name: tab.name,
        gid: tab.gid,
        rowCount: rows.length,
        rows
      };
    } else {
      // Fallback to cached or snapshot for this tab
      const currentBase = getCurrentBaseRawData();
      rawData[tab.id] = currentBase[tab.id] || RAW_SNAPSHOT_DATA[tab.id];
    }
  }));

  // Save clean base rawData to localStorage
  const syncTimeStr = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  try {
    localStorage.setItem('yerbazo_cached_dataset', JSON.stringify({
      data: rawData,
      time: syncTimeStr,
      version: CACHE_VERSION
    }));
  } catch (e) {
    console.warn('Could not save to localStorage', e);
  }

  // Pull in-flight changes (<15s) & script URL from Yerbazo cloud before reconciling with live sheet
  await pullCloudSyncState();

  const mergedRawData = applyLocalChangesToRawData(rawData, true);
  const dataset = parseRawDataset(mergedRawData);
  dataset.isLive = true;
  dataset.lastSyncTime = syncTimeStr;
  
  // Fetch live web store unless skipped by rapid background sheet polling
  if (!options?.skipWebStore) {
    try {
      const webData = await fetchLiveWebStore();
      dataset.webStore = webData;
      dataset.lastWebSyncTime = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    } catch (err) {
      dataset.webStore = DEFAULT_WEB_STORE_DATA;
    }
  } else {
    dataset.webStore = DEFAULT_WEB_STORE_DATA;
  }

  return dataset;
}

export function loadInitialDataset(): YerbazoDataset {
  try {
    const cached = localStorage.getItem('yerbazo_cached_dataset');
    if (cached) {
      const parsed = JSON.parse(cached);
      // Ensure cache is modern clean version without XLSX decimal corruption
      if (parsed.version === CACHE_VERSION && parsed.data) {
        const mergedRaw = applyLocalChangesToRawData(parsed.data);
        const dataset = parseRawDataset(mergedRaw);
        dataset.lastSyncTime = parsed.time || 'Caché local';
        dataset.webStore = DEFAULT_WEB_STORE_DATA;
        return dataset;
      } else {
        // Invalidate old corrupted cache
        localStorage.removeItem('yerbazo_cached_dataset');
      }
    }
  } catch (e) {
    console.warn('Could not read cached dataset', e);
  }

  const mergedSnapshot = applyLocalChangesToRawData(RAW_SNAPSHOT_DATA);
  const initial = parseRawDataset(mergedSnapshot);
  initial.webStore = DEFAULT_WEB_STORE_DATA;
  return initial;
}

export function exportToExcel(filename: string, sheetsData: Record<string, any[]>) {
  const wb = XLSX.utils.book_new();
  
  for (const [sheetName, data] of Object.entries(sheetsData)) {
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  }
  
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportMergedDatasetToExcel(_dataset?: YerbazoDataset) {
  const baseRaw = getCurrentBaseRawData();
  const mergedRaw = applyLocalChangesToRawData(baseRaw);
  const wb = XLSX.utils.book_new();

  for (const tab of TABS_CONFIG) {
    const tabObj = mergedRaw[tab.id];
    if (tabObj && Array.isArray(tabObj.rows)) {
      const ws = XLSX.utils.aoa_to_sheet(tabObj.rows);
      XLSX.utils.book_append_sheet(wb, ws, tab.name.substring(0, 31));
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Yerbazo_Planilla_Oficial_${today}.xlsx`);
}


