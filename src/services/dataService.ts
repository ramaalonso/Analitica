import { YerbazoDataset, WebStoreData } from '../types';
import { parseRawDataset } from '../utils/dataParser';
import { RAW_SNAPSHOT_DATA } from '../data/initialData';
import * as XLSX from 'xlsx';

const GOOGLE_SHEET_ID = '15hjl5YFZqSFRGuh1IEv7zHDRXrQPPfvRU8dijVOmWPY';
const CACHE_VERSION = 'v4_real_prices_2026';

const TABS_CONFIG = [
  { id: 'ventas', gid: '1558868693', name: 'Ventas' },
  { id: 'stock', gid: '1278668720', name: 'Stock' },
  { id: 'ganancia', gid: '1837448515', name: 'Ganancia' },
  { id: 'prox_compra', gid: '100594293', name: 'Prox compra' },
  { id: 'clientes', gid: '766684196', name: 'Clientes' },
  { id: 'mates_bombillas', gid: '816238572', name: 'mates - bombillas' },
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
  coupons: [],
  products: [
    { id: 1, title: 'Baldo 1kg', price: 10900, category: '1kg', badge: '1 kg', weight: '1 kg', image: 'https://yerbazo.com.ar/img/Baldo%201kg.webp', isSale: false, stockStatus: 'normal' },
    { id: 2, title: 'Baldo 500g', price: 6200, salePrice: 5800, category: '500g', badge: '500 g', weight: '500 g', image: 'https://yerbazo.com.ar/img/Baldo%20500g.webp', isSale: true, isUrgent: true, stockStatus: 'ultimas' },
    { id: 3, title: 'Canarias tradicional 1kg', price: 10700, category: '1kg', badge: '1 kg', weight: '1 kg', image: 'https://yerbazo.com.ar/img/Canarias%20tradicional%201kg.webp', isSale: false, stockStatus: 'normal' },
    { id: 4, title: 'Canarias tradicional 500g', price: 6000, salePrice: 5600, category: '500g', badge: '500 g', weight: '500 g', image: 'https://yerbazo.com.ar/img/Canarias%20tradicional%20500g.webp', isSale: false, stockStatus: 'normal' },
    { id: 5, title: 'Canarias serena 1kg', price: 11500, category: '1kg', badge: '1 kg', weight: '1 kg', image: 'https://yerbazo.com.ar/img/Canarias%20serena%201kg.webp', isSale: false, isUrgent: true, stockStatus: 'ultimas' },
    { id: 6, title: 'Canarias serena 500g', price: 6700, salePrice: 6000, category: '500g', badge: '500 g', weight: '500 g', image: 'https://yerbazo.com.ar/img/Canarias%20serena%20500g.webp', isSale: false, stockStatus: 'normal' },
    { id: 7, title: 'Canarias edicion especial 1kg', price: 11700, category: '1kg', badge: '1 kg', weight: '1 kg', image: 'https://yerbazo.com.ar/img/Canarias%20edicion%20especial%201kg.webp', isSale: false, isUrgent: true, stockStatus: 'ultimas' },
    { id: 8, title: 'Canarias edicion especial 500g', price: 6700, salePrice: 6300, category: '500g', badge: '500 g', weight: '500 g', image: 'https://yerbazo.com.ar/img/Canarias%20edicion%20especial%20500g.webp', isSale: false, stockStatus: 'normal' },
    { id: 23, title: 'Canarias Te Verde y Jenjibre 1kg', price: 11700, category: '1kg', badge: '1 kg', weight: '1 kg', image: 'https://yerbazo.com.ar/img/Canarias%20te%20verde%20y%20jenjibre%201kg.webp', isSale: false, stockStatus: 'normal' },
    { id: 9, title: 'ReiVerde premium 1kg', price: 10500, category: '1kg', badge: '1 kg', weight: '1 kg', image: 'https://yerbazo.com.ar/img/ReiVerde%20premium%201kg.webp', isSale: false, stockStatus: 'normal' },
    { id: 10, title: 'ReiVerde premium 500g', price: 5800, salePrice: 5500, category: '500g', badge: '500 g', weight: '500 g', image: 'https://yerbazo.com.ar/img/ReiVerde%20premium%20500g.webp', isSale: false, stockStatus: 'normal' },
    { id: 22, title: 'ReiVerde Padron Argentino 1kg', price: 7500, category: '1kg', badge: '1 kg', weight: '1 kg', image: 'https://yerbazo.com.ar/img/ReiVerde%20Padron%20Argentino%201kg.webp', isSale: false, stockStatus: 'normal' },
    { id: 21, title: 'ReiVerde Padron Argentino 500g', price: 4300, category: '500g', badge: '500 g', weight: '500 g', image: 'https://yerbazo.com.ar/img/ReiVerde%20Padron%20Argentino%20500g.webp', isSale: false, stockStatus: 'normal' },
    { id: 11, title: 'Verdecita 1kg', price: 8300, category: '1kg', badge: '1 kg', weight: '1 kg', image: 'https://yerbazo.com.ar/img/Verdecita%201kg.webp', isSale: false, stockStatus: 'normal' },
    { id: 12, title: 'Verdecita 500g', price: 4400, salePrice: 4000, category: '500g', badge: '500 g', weight: '500 g', image: 'https://yerbazo.com.ar/img/Verdecita%20500g.webp', isSale: false, stockStatus: 'normal' },
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

export async function fetchLiveGoogleSheet(): Promise<YerbazoDataset> {
  const rawData: any = {};

  // Try direct fetch or local proxy first, then CORS proxy
  for (const tab of TABS_CONFIG) {
    const directUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=${tab.gid}`;
    let csvText = '';
    
    try {
      // 1. Try local server endpoint if running
      const localResp = await fetch(`/api/sheet?gid=${tab.gid}`).catch(() => null);
      if (localResp && localResp.ok) {
        csvText = await localResp.text();
      } else {
        // 2. Try direct (works in some browsers/environments or when server proxies)
        const resp = await fetch(directUrl).catch(() => null);
        if (resp && resp.ok) {
          csvText = await resp.text();
        } else {
          // 3. Fallback to public CORS proxy
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`;
          const pResp = await fetch(proxyUrl);
          if (pResp.ok) {
            csvText = await pResp.text();
          }
        }
      }
    } catch (err) {
      console.warn(`Could not live fetch tab ${tab.name}, using local snapshot fallback`, err);
    }

    if (csvText && csvText.length > 20) {
      // Parse CSV into pure string rows preserving exact currency formatting (dots as thousands)
      const rows = parseCSV(csvText);
      rawData[tab.id] = {
        name: tab.name,
        gid: tab.gid,
        rowCount: rows.length,
        rows
      };
    } else {
      // Fallback to snapshot for this tab
      rawData[tab.id] = RAW_SNAPSHOT_DATA[tab.id];
    }
  }

  const dataset = parseRawDataset(rawData);
  dataset.isLive = true;
  dataset.lastSyncTime = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  // Also fetch live web store
  try {
    const webData = await fetchLiveWebStore();
    dataset.webStore = webData;
    dataset.lastWebSyncTime = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  } catch (err) {
    dataset.webStore = DEFAULT_WEB_STORE_DATA;
  }

  // Save clean data to localStorage
  try {
    localStorage.setItem('yerbazo_cached_dataset', JSON.stringify({
      data: rawData,
      time: dataset.lastSyncTime,
      version: CACHE_VERSION
    }));
  } catch (e) {
    console.warn('Could not save to localStorage', e);
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
        const dataset = parseRawDataset(parsed.data);
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

  const initial = parseRawDataset(RAW_SNAPSHOT_DATA);
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
