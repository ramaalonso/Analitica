import {
  SaleTransaction,
  SaleItem,
  CatalogProduct,
  ProxCompraRow,
  ClienteRow,
  MateBombillaItem,
  YerbazoDataset
} from '../types';
import { RAW_SNAPSHOT_DATA } from '../data/initialData';

export function safeStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

export function normalizeProductName(name: string): string {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeClientName(name: string): string {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseCurrency(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    // Self-healing safeguard: Argentine peso values like 109.65, 794.1, 2.8 were divided by 1000 by Excel/XLSX
    if (val > 0 && val < 1000 && !Number.isInteger(val)) {
      const strVal = val.toString();
      const decimalDigits = strVal.split('.')[1]?.length || 0;
      if (decimalDigits <= 3) {
        return Math.round(val * 1000);
      }
    }
    return val;
  }
  const str = safeStr(val);
  if (!str || str === '-' || str === '-----' || str === '?') return 0;
  
  // Format could be " AR$9.100,00" or "13.800$" or "340.000$" or "-48550" or "9100"
  let clean = str.replace(/AR\$/gi, '').replace(/\$/g, '').trim();
  
  // Check if negative
  const isNegative = clean.startsWith('-');
  if (isNegative) clean = clean.substring(1).trim();

  // If contains '.' and ',' like 1.346.800,00: remove dots, replace comma with dot
  if (clean.includes(',') && clean.includes('.')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    // Argentine style decimals: 34,97 -> 34.97 or thousands: 1,400 -> check digits
    const parts = clean.split(',');
    if (parts[parts.length - 1].length === 2) {
      // Decimal: 9100,00
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      // Thousands
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes('.')) {
    // Argentine style thousands: 13.800 or 340.000
    const parts = clean.split('.');
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      clean = clean.replace(/\./g, '');
    }
  }
  
  clean = clean.replace(/[^\d.]/g, '');
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
}

export function parsePercentage(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const clean = safeStr(val).replace('%', '').replace(',', '.').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

export function parseDateString(dateStr: string): { display: string; iso: string | null } {
  const str = safeStr(dateStr);
  if (!str) return { display: '', iso: null };
  // Formats like "23/05/2026", "10/5/26", "15/6/26"
  const parts = str.split('/');
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const d = new Date(year, month - 1, day);
      return {
        display: `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`,
        iso: d.toISOString()
      };
    }
  }
  return { display: str, iso: null };
}

export function parseSaleDate(dateStr: string, monthStr: string): Date {
  if (dateStr) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      let d = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        return new Date(y, m - 1, d);
      }
    }
  }
  const months: Record<string, number> = {
    'abril': 3,
    'mayo': 4,
    'junio': 5,
    'julio': 6,
    'agosto': 7,
    'septiembre': 8,
    'octubre': 9
  };
  const mNorm = (monthStr || '').toLowerCase().trim();
  for (const [name, idx] of Object.entries(months)) {
    if (mNorm.includes(name)) {
      return new Date(2026, idx, 15);
    }
  }
  return new Date(2026, 3, 15);
}

export function extractBrand(name: string): string {
  const norm = normalizeProductName(name);
  if (norm.includes('canarias')) return 'Canarias';
  if (norm.includes('baldo')) return 'Baldo';
  if (norm.includes('rei verde')) return 'Rei Verde';
  if (norm.includes('verdecita')) return 'Verdecita';
  if (norm.includes('pindare')) return 'Pindaré';
  if (norm.includes('sol y lluvia')) return 'Sol y Lluvia';
  if (norm.includes('barao')) return 'Barão';
  if (norm.includes('sara')) return 'Sara';
  if (norm.includes('esmeralda')) return 'Esmeralda';
  if (norm.includes('armino')) return 'Armiño';
  if (norm.includes('torp') || norm.includes('imperial') || norm.includes('coquito') || norm.includes('galleta') || norm.includes('trenzado')) {
    return 'Mates & Bombillas';
  }
  return 'Accesorios';
}

export function extractWeight(name: string): string {
  const norm = normalizeProductName(name);
  if (norm.includes('1kg')) return '1 KG';
  if (norm.includes('500g')) return '500 G';
  if (norm.includes('400g')) return '400 G';
  return 'Accesorio / Mate';
}

export function extractCategory(name: string): 'Yerbas' | 'Accesorios' | 'Mates y Bombillas' {
  const norm = normalizeProductName(name);
  if (norm.includes('torp') || norm.includes('imperial') || norm.includes('coquito') || norm.includes('galleta') || norm.includes('trenzado') || (norm.includes('bombilla') && !norm.includes('guarda'))) {
    return 'Mates y Bombillas';
  }
  if (norm.includes('yerbera') || norm.includes('lata') || norm.includes('reposa mate') || norm.includes('guarda bombilla') || norm.includes('pico_system')) {
    return 'Accesorios';
  }
  return 'Yerbas';
}

export function standardizeMonthName(mesRaw: any, fechaStr?: any): string {
  const m = safeStr(mesRaw).toLowerCase();
  if (m.includes('mayo')) return 'Mayo';
  if (m.includes('junio')) return 'Junio';
  if (m.includes('julio')) return 'Julio';
  if (m.includes('agosto')) return 'Agosto';
  if (m.includes('septiembre')) return 'Septiembre';
  if (m.includes('octubre')) return 'Octubre';
  
  const f = safeStr(fechaStr);
  if (f) {
    const parts = f.split('/');
    if (parts.length >= 2) {
      const monthNum = parseInt(parts[1], 10);
      switch(monthNum) {
        case 4: return 'Abril';
        case 5: return 'Mayo';
        case 6: return 'Junio';
        case 7: return 'Julio';
        case 8: return 'Agosto';
        case 9: return 'Septiembre';
        case 10: return 'Octubre';
        case 11: return 'Noviembre';
        case 12: return 'Diciembre';
      }
    }
  }

  return 'Ventas Iniciales';
}

export function parseRawDataset(raw = RAW_SNAPSHOT_DATA): YerbazoDataset {
  // 1. Stock / Catalog
  const stockRows = raw.stock?.rows || [];
  const catalog: CatalogProduct[] = [];
  
  for (let i = 1; i < stockRows.length; i++) {
    const r = stockRows[i];
    if (!r || !safeStr(r[0]) || safeStr(r[0]).toLowerCase().includes('coste final')) continue;
    
    const originalName = safeStr(r[0]);
    const norm = normalizeProductName(originalName);
    const comprado = parseInt(safeStr(r[1]) || '0', 10) || 0;
    const vendidas = parseInt(safeStr(r[2]) || '0', 10) || 0;
    const restantes = parseInt(safeStr(r[3]) || '0', 10) || 0;
    const precioCompra = parseCurrency(r[4]);
    const precioVenta = parseCurrency(r[5]);
    const gastoTotal = parseCurrency(r[6]);
    const gananciaVendiendoTodo = parseCurrency(r[7]);
    const gananciaUnidad = parseCurrency(r[8]) || (precioVenta - precioCompra);
    const gananciaRealizada = parseCurrency(r[9]);
    const porcentajeGanancia = parsePercentage(r[10]) || (precioCompra > 0 ? ((precioVenta - precioCompra) / precioCompra) * 100 : 0);
    const precioViejo = parseCurrency(r[11]) || precioVenta;

    catalog.push({
      id: `prod-${i}`,
      nombre: originalName,
      nombreNormalizado: norm,
      categoria: extractCategory(originalName),
      marca: extractBrand(originalName),
      peso: extractWeight(originalName),
      comprado,
      vendidas,
      restantes,
      precioCompra,
      precioVenta,
      precioViejo,
      gastoTotal,
      gananciaVendiendoTodo,
      gananciaUnidad,
      gananciaRealizada,
      porcentajeGanancia
    });
  }

  // 2. Ventas
  const ventasRows = raw.ventas?.rows || [];
  const ventas: SaleTransaction[] = [];
  
  for (let i = 1; i < ventasRows.length; i++) {
    const r = ventasRows[i];
    if (!r || !r.some((c: any) => safeStr(c) !== '')) continue;
    
    const cliente = safeStr(r[0]);
    const id = safeStr(r[1]) || `YB-${i}`;
    const fechaRaw = safeStr(r[2]);
    const dateParsed = parseDateString(fechaRaw);
    const precioSistema = parseCurrency(r[3]);
    let precioFinal = parseCurrency(r[4]);
    if (precioFinal === 0 && precioSistema > 0) {
      precioFinal = precioSistema;
    }
    
    const medioPago = safeStr(r[5]) || 'No especificado';
    const pago = (safeStr(r[6]) || 'SI').toUpperCase();
    const observaciones = safeStr(r[7]);
    const entregado = (safeStr(r[8]) || 'SI').toUpperCase();
    
    // Items
    const items: SaleItem[] = [];
    const itemPairs = [
      { prodIdx: 9, stockIdx: 10, qtyIdx: 11 },
      { prodIdx: 12, stockIdx: 13, qtyIdx: 14 },
      { prodIdx: 15, stockIdx: 16, qtyIdx: 17 },
      { prodIdx: 18, stockIdx: 19, qtyIdx: 20 },
      { prodIdx: 21, stockIdx: 22, qtyIdx: 23 },
    ];
    
    for (const pair of itemPairs) {
      const prodName = safeStr(r[pair.prodIdx]);
      if (prodName) {
        const qtyRaw = safeStr(r[pair.qtyIdx]) || '1';
        let qty = parseFloat(qtyRaw.replace(',', '.'));
        if (isNaN(qty) || qty <= 0) qty = 1;
        items.push({
          producto: prodName,
          cantidad: qty,
          stockStatus: safeStr(r[pair.stockIdx])
        });
      }
    }

    const mesRaw = safeStr(r[24]);
    const semana = safeStr(r[25]);
    const ganancia = parseCurrency(r[26]);
    const deuda = safeStr(r[29]);

    const standardizedMonth = standardizeMonthName(mesRaw, fechaRaw);

    ventas.push({
      id,
      cliente,
      fecha: dateParsed.display || (semana ? `${standardizedMonth} (${semana})` : standardizedMonth),
      fechaObj: dateParsed.iso,
      precioSistema,
      precioFinal,
      medioPago,
      pago,
      observaciones,
      entregado,
      items,
      mes: standardizedMonth,
      semana,
      ganancia,
      deudaInfo: deuda,
      rowIndex: i
    });
  }

  // 3. Ganancia Historial
  const gananciaRows = raw.ganancia?.rows || [];
  const gananciaHistorial: { mes: string; precioFinal: number; ganancia: number }[] = [];
  for (let i = 1; i < gananciaRows.length; i++) {
    const r = gananciaRows[i];
    if (r && safeStr(r[0])) {
      gananciaHistorial.push({
        mes: safeStr(r[0]).replace('Total', '').trim(),
        precioFinal: parseCurrency(r[2]),
        ganancia: parseCurrency(r[3])
      });
    }
  }

  // 4. Prox Compra
  const proxRows = raw.prox_compra?.rows || [];
  const proxCompra: ProxCompraRow[] = [];
  for (let i = 1; i < proxRows.length; i++) {
    const r = proxRows[i];
    if (!r || !safeStr(r[0])) continue;
    const restante = parseInt(safeStr(r[1]) || '0', 10) || 0;
    const sugerida = parseInt(safeStr(r[2]) || '0', 10) || 0;
    const costeUnidad = parseCurrency(r[3]);
    const costeFinal = parseCurrency(r[4]);
    const totalPost = parseInt(safeStr(r[5]) || '0', 10) || (restante + sugerida);
    proxCompra.push({
      producto: safeStr(r[0]),
      restante,
      proxCompraSugerida: sugerida,
      costeUnidad,
      costeFinal,
      totalPostCompra: totalPost
    });
  }

  // 5. Clientes (Hoja oficial "Clientes" como fuente única y exclusiva de verdad)
  const clientesRows = raw.clientes?.rows || [];
  const clientMetaMap = new Map<string, { displayName: string; canal: string; direccion: string }>();
  for (let i = 1; i < clientesRows.length; i++) {
    const r = clientesRows[i];
    if (r && safeStr(r[0])) {
      const rawName = safeStr(r[0]);
      const normKey = normalizeClientName(rawName);
      if (normKey) {
        clientMetaMap.set(normKey, {
          displayName: rawName,
          canal: safeStr(r[1]) || 'Directo',
          direccion: safeStr(r[2])
        });
      }
    }
  }

  // Aggregate customer metrics ONLY for clients registered in the official "Clientes" sheet
  const clientSalesMap = new Map<string, {
    totalCompras: number;
    totalGastado: number;
    totalGanancia: number;
    saldoDeuda: number;
    productos: Map<string, number>;
    maxDate: Date | null;
    maxDateStr: string;
  }>();

  for (const v of ventas) {
    if (!v.cliente) continue;
    const clientNorm = normalizeClientName(v.cliente);
    // Ignore clients that are not in the official Clientes sheet
    if (!clientMetaMap.has(clientNorm)) continue;

    if (!clientSalesMap.has(clientNorm)) {
      clientSalesMap.set(clientNorm, {
        totalCompras: 0,
        totalGastado: 0,
        totalGanancia: 0,
        saldoDeuda: 0,
        productos: new Map(),
        maxDate: null,
        maxDateStr: ''
      });
    }
    const cStats = clientSalesMap.get(clientNorm)!;
    cStats.totalCompras += 1;
    cStats.totalGastado += v.precioFinal;
    cStats.totalGanancia += v.ganancia;
    if (v.pago === 'NO' || v.pago.includes('PENDIENTE')) {
      cStats.saldoDeuda += v.precioFinal;
    }
    for (const item of v.items) {
      cStats.productos.set(item.producto, (cStats.productos.get(item.producto) || 0) + item.cantidad);
    }

    const saleDate = v.fechaObj ? new Date(v.fechaObj) : parseSaleDate(v.fecha, v.mes);
    if (saleDate && (!cStats.maxDate || saleDate.getTime() > cStats.maxDate.getTime())) {
      cStats.maxDate = saleDate;
      cStats.maxDateStr = v.fecha || saleDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  }

  const clientes: ClienteRow[] = [];
  const now = new Date();

  // Strictly iterate over the official clients list from the Clientes sheet
  for (const [normKey, meta] of clientMetaMap.entries()) {
    const stats = clientSalesMap.get(normKey);

    const favProducts: string[] = [];
    if (stats) {
      const sortedProds = Array.from(stats.productos.entries()).sort((a, b) => b[1] - a[1]);
      favProducts.push(...sortedProds.slice(0, 3).map(p => p[0]));
    }

    let diasDesdeUltimaCompra = 999;
    let ultimaCompra = 'Sin compras registradas';
    let segmentoFrecuencia: 'activo' | 'en_riesgo' | 'inactivo' = 'inactivo';

    if (stats?.maxDate) {
      ultimaCompra = stats.maxDateStr;
      diasDesdeUltimaCompra = Math.max(0, Math.floor((now.getTime() - stats.maxDate.getTime()) / (1000 * 60 * 60 * 24)));
      if (diasDesdeUltimaCompra <= 30) {
        segmentoFrecuencia = 'activo';
      } else if (diasDesdeUltimaCompra <= 60) {
        segmentoFrecuencia = 'en_riesgo';
      } else {
        segmentoFrecuencia = 'inactivo';
      }
    }

    const totalCompras = stats ? stats.totalCompras : 0;
    let clubMateroNivel: 'Cebador Inicial' | 'Matero Habitual' | 'Matero Fiel' | 'Matero VIP' = 'Cebador Inicial';
    let proximoBeneficioCompras = 5;

    if (totalCompras >= 10) {
      clubMateroNivel = 'Matero VIP';
      proximoBeneficioCompras = 5 - (totalCompras % 5);
      if (proximoBeneficioCompras === 5) proximoBeneficioCompras = 0;
    } else if (totalCompras >= 5) {
      clubMateroNivel = 'Matero Fiel';
      proximoBeneficioCompras = 10 - totalCompras;
    } else if (totalCompras >= 3) {
      clubMateroNivel = 'Matero Habitual';
      proximoBeneficioCompras = 5 - totalCompras;
    } else {
      clubMateroNivel = 'Cebador Inicial';
      proximoBeneficioCompras = 5 - totalCompras;
    }

    clientes.push({
      cliente: meta.displayName,
      comoNosConocio: meta.canal,
      direccionEntrega: meta.direccion,
      totalCompras,
      totalGastado: stats ? stats.totalGastado : 0,
      totalGananciaGenerada: stats ? stats.totalGanancia : 0,
      saldoDeuda: stats ? stats.saldoDeuda : 0,
      ultimaCompra,
      diasDesdeUltimaCompra,
      segmentoFrecuencia,
      clubMateroNivel,
      proximoBeneficioCompras,
      productosFavoritos: favProducts
    });
  }

  // 6. Mates y bombillas
  const matesRows = raw.mates_bombillas?.rows || [];
  const matesBombillas: MateBombillaItem[] = [];
  for (let i = 1; i < matesRows.length; i++) {
    const r = matesRows[i];
    if (!r || !safeStr(r[0]) || safeStr(r[0]).includes('Final')) continue;
    const qty = parseInt(safeStr(r[1]) || '0', 10) || 0;
    const precio = parseCurrency(r[2]);
    const total = parseCurrency(r[3]);
    const detalle = safeStr(r[4]);
    matesBombillas.push({
      producto: safeStr(r[0]),
      cantidad: qty,
      precioUnidad: precio,
      total,
      detalle
    });
  }

  return {
    ventas,
    stock: catalog,
    gananciaHistorial,
    proxCompra,
    clientes,
    matesBombillas,
    lastSyncTime: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    isLive: false,
    sheetSourceUrl: 'https://docs.google.com/spreadsheets/d/15hjl5YFZqSFRGuh1IEv7zHDRXrQPPfvRU8dijVOmWPY/edit?usp=sharing'
  };
}
