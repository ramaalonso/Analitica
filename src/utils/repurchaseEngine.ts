import { 
  YerbazoDataset, 
  CatalogProduct, 
  WebStoreData, 
  ClienteRecompra, 
  SaleTransaction,
  ClienteRow
} from '../types';
import { normalizeClientName } from './dataParser';

/**
 * Extracts weight in kilograms from a product name.
 * Returns 0 if it's an accessory or non-yerba product.
 */
export function extractProductYerbaWeightKg(productName: string): number {
  const norm = (productName || '').toLowerCase().trim();
  
  // Non-yerba items
  if (
    norm.includes('mate') || 
    norm.includes('bombilla') || 
    norm.includes('yerbera') || 
    norm.includes('pico') || 
    norm.includes('lata') || 
    norm.includes('reposa') || 
    norm.includes('guarda')
  ) {
    return 0;
  }

  if (norm.includes('1kg') || norm.includes('1 kg')) return 1.0;
  if (norm.includes('500g') || norm.includes('500 g') || norm.includes('1/2')) return 0.5;
  if (norm.includes('400g') || norm.includes('400 g')) return 0.4;

  // Recognizable yerba brands defaulting to 1kg if weight not explicitly stated
  if (
    norm.includes('canarias') || 
    norm.includes('baldo') || 
    norm.includes('rei verde') || 
    norm.includes('verdecita') || 
    norm.includes('pindare') || 
    norm.includes('sol y lluvia') || 
    norm.includes('barao') || 
    norm.includes('sara') || 
    norm.includes('armino')
  ) {
    return 1.0;
  }

  return 0;
}

/**
 * Parses date string or month into a Date object.
 */
export function parseSaleDate(fecha: string, mes: string): Date {
  if (fecha && fecha.includes('/')) {
    const parts = fecha.split('/');
    let d = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (y < 100) y += 2000;
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
      return new Date(y, m - 1, d);
    }
  }

  // Fallback to 2026 month center
  const mLower = (mes || '').toLowerCase();
  const monthMap: Record<string, number> = {
    'mayo': 4,
    'junio': 5,
    'julio': 6,
    'agosto': 7,
    'septiembre': 8,
    'octubre': 9,
    'noviembre': 10,
    'diciembre': 11
  };

  const mIdx = monthMap[mLower];
  if (mIdx !== undefined) {
    return new Date(2026, mIdx, 15);
  }

  // Initial sales
  return new Date(2026, 3, 15); // April 2026
}

/**
 * Looks up regular retail price of a yerba in catalog or live web store.
 */
export function findYerbaPrice(
  yerbaName: string, 
  catalog: CatalogProduct[], 
  webStore?: WebStoreData
): number {
  const norm = yerbaName.toLowerCase().trim();

  // Try webStore first
  if (webStore?.products && webStore.products.length > 0) {
    const foundWeb = webStore.products.find(p => 
      p.title && norm.includes(p.title.toLowerCase())
    );
    if (foundWeb && foundWeb.price > 0) return foundWeb.price;
  }

  // Try catalog
  if (catalog && catalog.length > 0) {
    const foundCat = catalog.find(p => 
      p.nombre && norm.includes(p.nombre.toLowerCase())
    );
    if (foundCat && foundCat.precioVenta > 0) return foundCat.precioVenta;
  }

  // Smart fallback by weight
  if (norm.includes('500g') || norm.includes('500 g')) return 5800;
  if (norm.includes('canarias serena') || norm.includes('edicion')) return 11200;
  return 10500;
}

/**
 * Main engine function: Analyzes consumption, predicts stock exhaustion,
 * identifies favorite yerba and calculates tempting personalized offers.
 */
export function analyzeRepurchaseRadar(
  dataset: YerbazoDataset,
  catalog: CatalogProduct[],
  webStore?: WebStoreData,
  referenceDate?: Date
): ClienteRecompra[] {
  const now = referenceDate || new Date();
  const sales = dataset.ventas || [];
  const clientMetaList = dataset.clientes || [];

  // Build map of valid clients strictly from dataset.clientes (official "Clientes" sheet)
  const validClientsMap = new Map<string, ClienteRow>();
  for (const c of clientMetaList) {
    const norm = normalizeClientName(c.cliente);
    if (norm) {
      validClientsMap.set(norm, c);
    }
  }

  // Group sales by client, ONLY for clients present in the official Clientes sheet
  const clientSalesMap = new Map<string, {
    displayName: string;
    sales: {
      date: Date;
      yerbaKg: number;
      yerbaItems: { name: string; qty: number; kg: number }[];
    }[];
  }>();

  for (const v of sales) {
    if (!v.cliente) continue;
    const clientNorm = normalizeClientName(v.cliente);
    if (!clientNorm || !validClientsMap.has(clientNorm)) continue; // Disregard clients not in Clientes sheet!

    const officialClient = validClientsMap.get(clientNorm)!;

    if (!clientSalesMap.has(clientNorm)) {
      clientSalesMap.set(clientNorm, {
        displayName: officialClient.cliente,
        sales: []
      });
    }

    const date = parseSaleDate(v.fecha, v.mes);
    let yerbaKg = 0;
    const yerbaItems: { name: string; qty: number; kg: number }[] = [];

    for (const item of v.items || []) {
      const w = extractProductYerbaWeightKg(item.producto);
      if (w > 0) {
        const itemKg = w * (item.cantidad || 1);
        yerbaKg += itemKg;
        yerbaItems.push({
          name: item.producto.trim(),
          qty: item.cantidad || 1,
          kg: itemKg
        });
      }
    }

    clientSalesMap.get(clientNorm)!.sales.push({
      date,
      yerbaKg,
      yerbaItems
    });
  }

  const results: ClienteRecompra[] = [];

  // Strictly process all official clients from the Clientes sheet
  for (const [clientNorm, officialClient] of validClientsMap.entries()) {
    const data = clientSalesMap.get(clientNorm);
    const allSales = data ? data.sales.sort((a, b) => a.date.getTime() - b.date.getTime()) : [];
    const yerbaSales = allSales.filter(s => s.yerbaKg > 0);

    if (yerbaSales.length > 0) {
      // 1. Find Favorite Yerba
      const yerbaCountMap: Record<string, { qty: number; kg: number; displayName: string }> = {};
      for (const s of yerbaSales) {
        for (const y of s.yerbaItems) {
          const yNorm = y.name.toLowerCase();
          if (!yerbaCountMap[yNorm]) {
            yerbaCountMap[yNorm] = { qty: 0, kg: 0, displayName: y.name };
          }
          yerbaCountMap[yNorm].qty += y.qty;
          yerbaCountMap[yNorm].kg += y.kg;
        }
      }

      const sortedYerbas = Object.values(yerbaCountMap).sort((a, b) => b.qty - a.qty || b.kg - a.kg);
      const favYerbaObj = sortedYerbas[0];
      const yerbaFavorita = favYerbaObj ? favYerbaObj.displayName : 'Canarias tradicional 1KG';

      // 2. Pricing and tempting discount
      const precioRegularFavorita = findYerbaPrice(yerbaFavorita, catalog, webStore);
      const descuentoPorcTentador = 10; // 10% OFF
      const precioOfertaTentadora = Math.round((precioRegularFavorita * (1 - descuentoPorcTentador / 100)) / 50) * 50;
      const ahorroMonto = precioRegularFavorita - precioOfertaTentadora;

      // 3. Last Yerba Purchase details
      const lastSale = yerbaSales[yerbaSales.length - 1];
      const diasDesdeUltimaCompra = Math.max(0, Math.floor((now.getTime() - lastSale.date.getTime()) / (1000 * 60 * 60 * 24)));
      const kgCompradosUltima = lastSale.yerbaKg;
      const yerbasUltimaCompra = lastSale.yerbaItems.map(y => `${y.qty}x ${y.name}`).join(' + ');

      // 4. Personalized consumption rate (kg/day)
      let consumoDiarioKg = 0.033; // Default: ~1kg per 30 days (~33g/day)
      if (yerbaSales.length >= 2) {
        const firstSale = yerbaSales[0];
        const intervalDays = Math.max(1, Math.floor((lastSale.date.getTime() - firstSale.date.getTime()) / (1000 * 60 * 60 * 24)));
        const totalKgExceptLast = yerbaSales.slice(0, -1).reduce((acc, s) => acc + s.yerbaKg, 0);

        if (totalKgExceptLast > 0 && intervalDays >= 10) {
          const measuredRate = totalKgExceptLast / intervalDays;
          // Clamp between realistic human consumption: 20g/day to 70g/day
          consumoDiarioKg = Math.max(0.020, Math.min(0.070, measuredRate));
        }
      }

      // 5. Stock estimation and remaining percentage
      const diasDuracionEstimada = Math.max(1, Math.round(kgCompradosUltima / consumoDiarioKg));
      const diasRestantes = diasDuracionEstimada - diasDesdeUltimaCompra;
      
      let porcentajeRestante = 0;
      let kgRestantes = 0;
      let diasAgotado = 0;
      let estadoConsumo: 'sin_yerba' | 'ultimas_cebadas' | 'medio' | 'abastecido' = 'sin_yerba';

      if (diasRestantes <= 0) {
        porcentajeRestante = 0;
        kgRestantes = 0;
        diasAgotado = Math.abs(diasRestantes);
        estadoConsumo = 'sin_yerba';
      } else {
        porcentajeRestante = Math.min(100, Math.max(1, Math.round((diasRestantes / diasDuracionEstimada) * 100)));
        kgRestantes = parseFloat((kgCompradosUltima * (porcentajeRestante / 100)).toFixed(2));
        diasAgotado = 0;

        if (porcentajeRestante <= 20) {
          estadoConsumo = 'ultimas_cebadas';
        } else if (porcentajeRestante <= 50) {
          estadoConsumo = 'medio';
        } else {
          estadoConsumo = 'abastecido';
        }
      }

      const agotamientoDate = new Date(lastSale.date.getTime() + diasDuracionEstimada * 24 * 60 * 60 * 1000);
      const fechaEstimadaAgotamiento = agotamientoDate.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short'
      });

      results.push({
        cliente: officialClient.cliente,
        canal: officialClient.comoNosConocio || 'Cliente recurrente',
        direccion: officialClient.direccionEntrega || '',
        totalCompras: officialClient.totalCompras || allSales.length,
        totalGastado: officialClient.totalGastado || 0,
        ultimaFecha: lastSale.date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        diasDesdeUltimaCompra,
        kgCompradosUltima,
        yerbasUltimaCompra,
        consumoDiarioKg,
        diasDuracionEstimada,
        diasRestantes,
        porcentajeRestante,
        kgRestantes,
        fechaEstimadaAgotamiento,
        diasAgotado,
        estadoConsumo,
        yerbaFavorita,
        precioRegularFavorita,
        precioOfertaTentadora,
        descuentoPorcTentador,
        ahorroMonto
      });
    } else {
      // Client has no yerba purchase registered (e.g. bought mates/accessories or new)
      // Since they are in the official Clientes sheet, they are 100% without yerba (0%)
      const defaultYerba = 'Canarias tradicional 1KG';
      const precioRegularFavorita = findYerbaPrice(defaultYerba, catalog, webStore);
      const descuentoPorcTentador = 10;
      const precioOfertaTentadora = Math.round((precioRegularFavorita * (1 - descuentoPorcTentador / 100)) / 50) * 50;
      const ahorroMonto = precioRegularFavorita - precioOfertaTentadora;

      const lastAnySale = allSales[allSales.length - 1];
      const ultimaFechaStr = lastAnySale 
        ? lastAnySale.date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'Sin compras previas';
      const diasDesdeUltima = lastAnySale
        ? Math.max(0, Math.floor((now.getTime() - lastAnySale.date.getTime()) / (1000 * 60 * 60 * 24)))
        : 60;

      results.push({
        cliente: officialClient.cliente,
        canal: officialClient.comoNosConocio || 'Cliente recurrente',
        direccion: officialClient.direccionEntrega || '',
        totalCompras: officialClient.totalCompras || allSales.length,
        totalGastado: officialClient.totalGastado || 0,
        ultimaFecha: ultimaFechaStr,
        diasDesdeUltimaCompra: diasDesdeUltima,
        kgCompradosUltima: 0,
        yerbasUltimaCompra: officialClient.totalCompras > 0 ? 'Mates / Accesorios' : 'Sin compras de yerba aún',
        consumoDiarioKg: 0.033,
        diasDuracionEstimada: 0,
        diasRestantes: 0,
        porcentajeRestante: 0,
        kgRestantes: 0,
        fechaEstimadaAgotamiento: 'Sin yerba registrada',
        diasAgotado: diasDesdeUltima,
        estadoConsumo: 'sin_yerba',
        yerbaFavorita: defaultYerba,
        precioRegularFavorita,
        precioOfertaTentadora,
        descuentoPorcTentador,
        ahorroMonto
      });
    }
  }

  // Priority sorting:
  // 1. Clientes sin yerba (0%) first. Within 0%, ordered by totalCompras / totalGastado desc
  // 2. Clientes con últimas cebadas (1% a 20%) ordered by lowest pct
  // 3. Clientes con consumo medio (21% a 50%)
  // 4. Clientes abastecidos (>50%)
  return results.sort((a, b) => {
    if (a.porcentajeRestante === 0 && b.porcentajeRestante === 0) {
      // Both ran out of yerba: prioritize top buyers
      return b.totalCompras - a.totalCompras || b.totalGastado - a.totalGastado;
    }
    if (a.porcentajeRestante === 0) return -1;
    if (b.porcentajeRestante === 0) return 1;

    // Remaining percentage ascending (the least remaining first)
    if (a.porcentajeRestante !== b.porcentajeRestante) {
      return a.porcentajeRestante - b.porcentajeRestante;
    }

    return b.totalCompras - a.totalCompras;
  });
}
