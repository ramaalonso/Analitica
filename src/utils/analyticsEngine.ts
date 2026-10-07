import {
  YerbazoDataset,
  MonthlyMetric,
  ProductPerformance,
  ComboOpportunity,
  SaleTransaction,
  CatalogProduct,
  WebStoreProduct,
  WebStoreData
} from '../types';
import { normalizeProductName } from './dataParser';

export function findWebProductMatch(name: string, webProducts?: WebStoreProduct[]): WebStoreProduct | undefined {
  if (!webProducts || webProducts.length === 0) return undefined;
  const norm = normalizeProductName(name);
  return webProducts.find(wp => {
    const wpNorm = normalizeProductName(wp.title);
    if (norm === wpNorm) return true;
    if (norm.includes('baldo') && norm.includes('1kg') && wpNorm.includes('baldo') && wpNorm.includes('1kg')) return true;
    if (norm.includes('baldo') && norm.includes('500g') && wpNorm.includes('baldo') && wpNorm.includes('500g')) return true;
    if (norm.includes('canarias') && norm.includes('tradicional') && norm.includes('1kg') && wpNorm.includes('canarias') && wpNorm.includes('tradicional') && wpNorm.includes('1kg')) return true;
    if (norm.includes('canarias') && norm.includes('tradicional') && norm.includes('500g') && wpNorm.includes('canarias') && wpNorm.includes('tradicional') && wpNorm.includes('500g')) return true;
    if (norm.includes('canarias') && norm.includes('serena') && norm.includes('1kg') && wpNorm.includes('canarias') && wpNorm.includes('serena') && wpNorm.includes('1kg')) return true;
    if (norm.includes('canarias') && norm.includes('serena') && norm.includes('500g') && wpNorm.includes('canarias') && wpNorm.includes('serena') && wpNorm.includes('500g')) return true;
    if (norm.includes('canarias') && (norm.includes('edicion') || norm.includes('especial')) && norm.includes('1kg') && wpNorm.includes('canarias') && (wpNorm.includes('edicion') || wpNorm.includes('especial')) && wpNorm.includes('1kg')) return true;
    if (norm.includes('canarias') && (norm.includes('edicion') || norm.includes('especial')) && norm.includes('500g') && wpNorm.includes('canarias') && (wpNorm.includes('edicion') || wpNorm.includes('especial')) && wpNorm.includes('500g')) return true;
    if (norm.includes('canarias') && (norm.includes('verde') || norm.includes('jengibre') || norm.includes('jenjibre')) && wpNorm.includes('canarias') && (wpNorm.includes('verde') || wpNorm.includes('jenjibre'))) return true;
    if (norm.includes('lata') && norm.includes('baldo') && wpNorm.includes('lata') && wpNorm.includes('baldo')) return true;
    if (norm.includes('reposa') && wpNorm.includes('reposa')) return true;
    if (norm.includes('yerbera') && norm.includes('negra') && wpNorm.includes('yerbera') && wpNorm.includes('negra')) return true;
    if (norm.includes('yerbera') && norm.includes('marron') && wpNorm.includes('yerbera') && wpNorm.includes('marron')) return true;
    if (norm.includes('pico') && wpNorm.includes('pico')) return true;
    if (norm.includes('verdecita') && norm.includes('con palo') && wpNorm.includes('verdecita') && wpNorm.includes('con palo')) return true;
    if (norm.includes('verdecita') && norm.includes('1kg') && wpNorm.includes('verdecita') && wpNorm.includes('1kg') && !norm.includes('palo') && !wpNorm.includes('palo')) return true;
    if (norm.includes('verdecita') && norm.includes('500g') && wpNorm.includes('verdecita') && wpNorm.includes('500g') && !norm.includes('palo') && !wpNorm.includes('palo')) return true;
    if (norm.includes('pindare') && norm.includes('1kg') && wpNorm.includes('pindare') && wpNorm.includes('1kg')) return true;
    if (norm.includes('pindare') && norm.includes('500g') && wpNorm.includes('pindare') && wpNorm.includes('500g')) return true;
    if (norm.includes('rei verde') && norm.includes('premium') && norm.includes('1kg') && wpNorm.includes('reiverde') && wpNorm.includes('premium') && wpNorm.includes('1kg')) return true;
    if (norm.includes('rei verde') && norm.includes('premium') && norm.includes('500g') && wpNorm.includes('reiverde') && wpNorm.includes('premium') && wpNorm.includes('500g')) return true;
    if (norm.includes('rei verde') && (norm.includes('padron') || norm.includes('argentino')) && norm.includes('1kg') && wpNorm.includes('reiverde') && (wpNorm.includes('padron') || wpNorm.includes('argentino')) && wpNorm.includes('1kg')) return true;
    if (norm.includes('rei verde') && (norm.includes('padron') || norm.includes('argentino')) && norm.includes('500g') && wpNorm.includes('reiverde') && (wpNorm.includes('padron') || wpNorm.includes('argentino')) && wpNorm.includes('500g')) return true;
    return false;
  });
}

export const CHRONOLOGICAL_MONTHS = [
  'Ventas Iniciales',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre'
];

export function computeMonthlyMetrics(ventas: SaleTransaction[]): MonthlyMetric[] {
  const monthMap = new Map<string, {
    facturado: number;
    ganancia: number;
    cantVentas: number;
    unidades: number;
  }>();

  for (const v of ventas) {
    const m = v.mes || 'Sin mes';
    if (!monthMap.has(m)) {
      monthMap.set(m, { facturado: 0, ganancia: 0, cantVentas: 0, unidades: 0 });
    }
    const current = monthMap.get(m)!;
    current.facturado += v.precioFinal;
    current.ganancia += v.ganancia;
    current.cantVentas += 1;
    
    let totalItemsInSale = 0;
    for (const item of v.items) {
      totalItemsInSale += item.cantidad;
    }
    current.unidades += (totalItemsInSale || 1);
  }

  // Build ordered list according to chronology
  const results: MonthlyMetric[] = [];
  const orderedKeys = CHRONOLOGICAL_MONTHS.filter(m => monthMap.has(m));
  
  // Also include any other month found that wasn't in the default list
  for (const m of monthMap.keys()) {
    if (!orderedKeys.includes(m)) {
      orderedKeys.push(m);
    }
  }

  let prevMetric: MonthlyMetric | null = null;

  for (let idx = 0; idx < orderedKeys.length; idx++) {
    const mKey = orderedKeys[idx];
    const data = monthMap.get(mKey)!;
    const margenPorc = data.facturado > 0 ? (data.ganancia / data.facturado) * 100 : 0;
    const ticketPromedio = data.cantVentas > 0 ? data.facturado / data.cantVentas : 0;

    let crecimientoFacturacionMoM: number | null = null;
    let diferenciaFacturacionMoM: number | null = null;
    let crecimientoGananciaMoM: number | null = null;
    let diferenciaGananciaMoM: number | null = null;

    if (prevMetric && prevMetric.facturado > 0) {
      crecimientoFacturacionMoM = ((data.facturado - prevMetric.facturado) / prevMetric.facturado) * 100;
      diferenciaFacturacionMoM = data.facturado - prevMetric.facturado;
      if (prevMetric.ganancia > 0) {
        crecimientoGananciaMoM = ((data.ganancia - prevMetric.ganancia) / prevMetric.ganancia) * 100;
        diferenciaGananciaMoM = data.ganancia - prevMetric.ganancia;
      }
    }

    const metric: MonthlyMetric = {
      mesKey: mKey,
      mesNombre: mKey,
      order: idx,
      facturado: data.facturado,
      ganancia: data.ganancia,
      margenPorc,
      cantVentas: data.cantVentas,
      unidadesVendidas: data.unidades,
      ticketPromedio,
      crecimientoFacturacionMoM,
      diferenciaFacturacionMoM,
      crecimientoGananciaMoM,
      diferenciaGananciaMoM
    };

    results.push(metric);
    prevMetric = metric;
  }

  return results;
}

export function computeProductPerformances(
  ventas: SaleTransaction[],
  catalog: CatalogProduct[],
  selectedMonth: string = 'TODOS',
  webProducts?: WebStoreProduct[]
): ProductPerformance[] {
  // Filter sales if month is selected
  const filteredSales = selectedMonth === 'TODOS'
    ? ventas
    : ventas.filter(v => v.mes === selectedMonth);

  // Month history lookup (for trends and MoM)
  const productMonthlySales = new Map<string, Record<string, { unidades: number; facturado: number; ganancia: number }>>();

  // Aggregate by normalized product
  const statsMap = new Map<string, {
    originalName: string;
    unidades: number;
    facturadoEstimado: number;
    gananciaEstimada: number;
    ordersCount: number;
  }>();

  // Populate from catalog first so all catalog products exist
  for (const p of catalog) {
    const norm = normalizeProductName(p.nombre);
    if (!statsMap.has(norm)) {
      statsMap.set(norm, {
        originalName: p.nombre,
        unidades: 0,
        facturadoEstimado: 0,
        gananciaEstimada: 0,
        ordersCount: 0
      });
    }
  }

  // Track product performance across ALL months for trend analysis
  for (const v of ventas) {
    const m = v.mes;
    for (const item of v.items) {
      const norm = normalizeProductName(item.producto);
      if (!productMonthlySales.has(norm)) {
        productMonthlySales.set(norm, {});
      }
      const pMonths = productMonthlySales.get(norm)!;
      if (!pMonths[m]) {
        pMonths[m] = { unidades: 0, facturado: 0, ganancia: 0 };
      }
      pMonths[m].unidades += item.cantidad;

      // Estimate item price & ganancia based on catalog or transaction average
      const catProd = catalog.find(c => c.nombreNormalizado === norm);
      const unitPrice = catProd ? catProd.precioVenta : (v.precioFinal / Math.max(1, v.items.length));
      const unitCost = catProd ? catProd.precioCompra : (unitPrice * 0.75);
      const unitGain = unitPrice - unitCost;

      pMonths[m].facturado += unitPrice * item.cantidad;
      pMonths[m].ganancia += unitGain * item.cantidad;
    }
  }

  // Now aggregate for the filtered set
  for (const v of filteredSales) {
    for (const item of v.items) {
      const norm = normalizeProductName(item.producto);
      if (!statsMap.has(norm)) {
        statsMap.set(norm, {
          originalName: item.producto,
          unidades: 0,
          facturadoEstimado: 0,
          gananciaEstimada: 0,
          ordersCount: 0
        });
      }
      const st = statsMap.get(norm)!;
      st.unidades += item.cantidad;
      st.ordersCount += 1;

      const catProd = catalog.find(c => c.nombreNormalizado === norm);
      const unitPrice = catProd ? catProd.precioVenta : (v.precioFinal / Math.max(1, v.items.length));
      const unitCost = catProd ? catProd.precioCompra : (unitPrice * 0.75);
      const unitGain = catProd ? (catProd.gananciaUnidad || (unitPrice - unitCost)) : (unitPrice - unitCost);

      st.facturadoEstimado += unitPrice * item.cantidad;
      st.gananciaEstimada += unitGain * item.cantidad;
    }
  }

  // Total sales revenue and volume across products for relative weights
  const totalVolume = Array.from(statsMap.values()).reduce((acc, curr) => acc + curr.unidades, 0) || 1;
  const totalRevenue = Array.from(statsMap.values()).reduce((acc, curr) => acc + curr.facturadoEstimado, 0) || 1;

  // Calculate Pareto ABC ordering
  const sortedByRevenue = Array.from(statsMap.entries()).sort((a, b) => b[1].facturadoEstimado - a[1].facturadoEstimado);
  let cumulativeRevenue = 0;
  const abcMap = new Map<string, 'A (Top 80% Fact.)' | 'B (Siguiente 15%)' | 'C (Último 5%)'>();

  for (const [norm, data] of sortedByRevenue) {
    cumulativeRevenue += data.facturadoEstimado;
    const share = (cumulativeRevenue / totalRevenue) * 100;
    if (share <= 80) {
      abcMap.set(norm, 'A (Top 80% Fact.)');
    } else if (share <= 95) {
      abcMap.set(norm, 'B (Siguiente 15%)');
    } else {
      abcMap.set(norm, 'C (Último 5%)');
    }
  }

  // Determine active recent months for MoM trend (e.g. Septiembre vs Agosto)
  const currentMonthKey = selectedMonth !== 'TODOS' ? selectedMonth : 'Septiembre';
  const prevMonthKey = currentMonthKey === 'Septiembre' ? 'Agosto' :
                       currentMonthKey === 'Agosto' ? 'Julio' :
                       currentMonthKey === 'Julio' ? 'Junio' :
                       currentMonthKey === 'Junio' ? 'Mayo' : 'Ventas Iniciales';

  const performances: ProductPerformance[] = [];

  for (const [norm, st] of statsMap.entries()) {
    const catProd = catalog.find(c => c.nombreNormalizado === norm);
    const originalName = catProd ? catProd.nombre : st.originalName;
    const categoria = catProd ? catProd.categoria : 'Yerbas';
    const marca = catProd ? catProd.marca : 'Otras';
    const peso = catProd ? catProd.peso : '-';
    const precioCompra = catProd ? catProd.precioCompra : 0;
    const precioVenta = catProd ? catProd.precioVenta : (st.unidades > 0 ? st.facturadoEstimado / st.unidades : 0);
    const stockActual = catProd ? catProd.restantes : 0;

    const margenPorc = st.facturadoEstimado > 0
      ? (st.gananciaEstimada / st.facturadoEstimado) * 100
      : (catProd ? catProd.porcentajeGanancia : 0);

    // Monthly history
    const monthlyHistory = productMonthlySales.get(norm) || {};
    const unitsCurrent = monthlyHistory[currentMonthKey]?.unidades || 0;
    const unitsPrev = monthlyHistory[prevMonthKey]?.unidades || 0;

    let crecimientoMoM = 0;
    const diffUnits = unitsCurrent - unitsPrev;
    if (unitsPrev > 0) {
      crecimientoMoM = ((unitsCurrent - unitsPrev) / unitsPrev) * 100;
    } else if (unitsCurrent > 0) {
      crecimientoMoM = 100;
    }

    // Tendencia
    let tendencia: ProductPerformance['tendencia'] = 'Estable';
    if (unitsCurrent === 0 && unitsPrev === 0 && st.unidades === 0) {
      tendencia = 'Sin Ventas Recientes';
    } else if (crecimientoMoM >= 40) {
      tendencia = 'Fuerte Alza';
    } else if (crecimientoMoM > 5) {
      tendencia = 'Crecimiento';
    } else if (crecimientoMoM <= -40) {
      tendencia = 'Fuerte Caída';
    } else if (crecimientoMoM < -5) {
      tendencia = 'Baja Ligera';
    }

    // Inventory Run-Rate & Coverage
    // Average weekly sales over past ~20 active weeks
    const totalUnitsSoldLife = catProd ? catProd.vendidas : st.unidades;
    const velocidadSemanal = Math.max(0.1, totalUnitsSoldLife / 20); // ~20 weeks active period
    const diasCobertura = stockActual > 0 ? Math.round((stockActual / (velocidadSemanal / 7))) : 0;

    // Multicriteria Comprehensive Score (0 - 100)
    // 1. Volume score (0-30): relative to top product volume
    const volumeScore = Math.min(30, (st.unidades / Math.max(1, sortedByRevenue[0]?.[1]?.unidades || 1)) * 30);
    // 2. Revenue score (0-30): relative to top revenue
    const revenueScore = Math.min(30, (st.facturadoEstimado / Math.max(1, sortedByRevenue[0]?.[1]?.facturadoEstimado || 1)) * 30);
    // 3. Margin score (0-20): based on margin percentage (e.g. 35% is max)
    const marginScore = Math.min(20, (margenPorc / 40) * 20);
    // 4. Momentum & Stock health score (0-20)
    let momentumScore = 10;
    if (tendencia === 'Fuerte Alza') momentumScore = 20;
    else if (tendencia === 'Crecimiento') momentumScore = 16;
    else if (tendencia === 'Estable') momentumScore = 12;
    else if (tendencia === 'Baja Ligera') momentumScore = 6;
    else if (tendencia === 'Fuerte Caída') momentumScore = 2;
    else momentumScore = 4;

    const scoreIntegral = Math.round(volumeScore + revenueScore + marginScore + momentumScore);

    // BCG Matrix Quadrant
    // Market growth / trend threshold: growth >= 0%
    // Relative market share: units >= average units
    const avgUnits = totalVolume / Math.max(1, statsMap.size);
    const isHighVolume = st.unidades >= avgUnits;
    const isGrowing = crecimientoMoM >= 0 || tendencia === 'Fuerte Alza' || tendencia === 'Crecimiento';

    let cuadranteBCG: ProductPerformance['cuadranteBCG'] = 'Interrogante';
    if (isHighVolume && isGrowing) {
      cuadranteBCG = 'Estrella';
    } else if (isHighVolume && !isGrowing) {
      cuadranteBCG = 'Vaca Lechera';
    } else if (!isHighVolume && isGrowing) {
      cuadranteBCG = 'Interrogante';
    } else {
      cuadranteBCG = 'Perro';
    }

    // Action recommendations
    let estrategiaRecomendada = '';
    let tipoAccion: ProductPerformance['tipoAccion'] = 'Promocionar';
    let justificacionAccion = '';

    if (stockActual === 0 && st.unidades > 0) {
      estrategiaRecomendada = 'Reponer Stock con Prioridad Alta';
      tipoAccion = 'Reorden Urgente';
      justificacionAccion = 'El producto tiene demanda comprobada pero está actualmente agotado, generando pérdida de ventas.';
    } else if (cuadranteBCG === 'Estrella') {
      if (diasCobertura < 14) {
        estrategiaRecomendada = 'Reabastecer con urgencia y sostener visibilidad';
        tipoAccion = 'Reorden Urgente';
        justificacionAccion = `Producto líder con alta rotación (${st.unidades} u.), pero con stock crítico para solo ${diasCobertura} días.`;
      } else {
        estrategiaRecomendada = 'Potenciar con combos y publicidad activa';
        tipoAccion = 'Promocionar';
        justificacionAccion = 'Producto Estrella de Yerbazo. Es el imán de clientes; asociarlo con accesorios de alto margen aumentará el ticket.';
      }
    } else if (cuadranteBCG === 'Vaca Lechera') {
      estrategiaRecomendada = 'Mantener precio y proteger rentabilidad';
      tipoAccion = 'Proteger Margen';
      justificacionAccion = 'Generador de flujo continuo de efectivo. No bajar el precio; usar como base para ventas cruzadas.';
    } else if (cuadranteBCG === 'Interrogante') {
      estrategiaRecomendada = 'Lanzar promoción de prueba o degustación';
      tipoAccion = 'Combo / Cross-sell';
      justificacionAccion = 'Muestra buen margen o tendencia alcista pero volumen moderado. Un combo de prueba incentivará la primera compra.';
    } else {
      // Perro
      if (stockActual > 5) {
        estrategiaRecomendada = 'Campaña de liquidación o descuento 2x1';
        tipoAccion = 'Liquidación';
        justificacionAccion = `Baja rotación y capital inmovilizado en ${stockActual} unidades. Conviene rotarlo para liberar liquidez.`;
      } else {
        estrategiaRecomendada = 'Descontinuar o mantener solo a pedido';
        tipoAccion = 'Proteger Margen';
        justificacionAccion = 'Bajo volumen y baja rentabilidad histórica. No priorizar en la próxima orden de compra.';
      }
    }

    const webMatch = findWebProductMatch(originalName, webProducts);
    const precioWeb = webMatch ? webMatch.price : undefined;
    const precioWebOferta = webMatch && webMatch.isSale ? webMatch.salePrice : null;
    const webEnOferta = webMatch ? !!webMatch.isSale : false;
    const webStockStatus = webMatch ? webMatch.stockStatus : undefined;
    const imagenUrl = webMatch?.image;

    performances.push({
      producto: norm,
      nombreOriginal: originalName,
      categoria,
      marca,
      peso,
      unidadesVendidas: st.unidades,
      facturacionTotal: st.facturadoEstimado,
      gananciaTotal: st.gananciaEstimada,
      margenPorc,
      precioVentaPromedio: precioVenta,
      precioCompra,
      stockActual,
      diasCobertura,
      velocidadSemanal: parseFloat(velocidadSemanal.toFixed(1)),
      ventasPorMes: monthlyHistory,
      crecimientoMoM: Math.round(crecimientoMoM),
      diferenciaUnidadesMoM: diffUnits,
      tendencia,
      scoreIntegral,
      cuadranteBCG,
      clasificacionABC: abcMap.get(norm) || 'C (Último 5%)',
      estrategiaRecomendada,
      tipoAccion,
      justificacionAccion,
      webProduct: webMatch,
      precioWeb,
      precioWebOferta,
      webEnOferta,
      webStockStatus,
      imagenUrl
    });
  }

  // Sort by scoreIntegral descending
  return performances.sort((a, b) => b.scoreIntegral - a.scoreIntegral);
}

export function generateSmartCombos(
  performances: ProductPerformance[],
  catalog: CatalogProduct[],
  seed: number = 0,
  webStore?: WebStoreData
): ComboOpportunity[] {
  const combos: ComboOpportunity[] = [];
  const activeCoupons = (webStore?.coupons || []).filter(c => c && c.active && c.code && c.code !== '__EMPTY__' && c.discount > 0);
  const coupon10 = activeCoupons.find(c => c.discount === 10)?.code || (activeCoupons.length > 0 ? activeCoupons[0].code : undefined);
  const coupon20 = activeCoupons.find(c => c.discount === 20)?.code || (activeCoupons.length > 1 ? activeCoupons[1].code : (activeCoupons.length > 0 ? activeCoupons[0].code : undefined));

  // Helper to get real online retail price if available, else average sales price
  const getRegularPrice = (p: ProductPerformance): number => {
    return p.precioWeb || p.precioVentaPromedio;
  };

  // Categorize products based on month's performance and inventory
  // 1. Stars / Best Sellers (high sales volume & currently in stock)
  const stars = performances.filter(p => 
    p.categoria === 'Yerbas' && 
    p.unidadesVendidas > 0 && 
    p.stockActual > 0
  ).sort((a, b) => b.unidadesVendidas - a.unidadesVendidas);

  // 2. Accessories & Hardware (latas, yerberas, bombillas, mates)
  const accessories = performances.filter(p => 
    (p.categoria === 'Accesorios' || p.categoria === 'Mates y Bombillas' || 
     p.producto.includes('yerbera') || p.producto.includes('lata') || 
     p.producto.includes('pico') || p.producto.includes('reposa') ||
     p.producto.includes('guarda')) &&
    p.stockActual > 0
  );

  // 3. Stagnant / Slow moving stock (items with stock > 0, low sales or perro)
  const slowMovers = performances.filter(p => 
    (p.cuadranteBCG === 'Perro' || p.tendencia === 'Fuerte Caída' || p.tendencia === 'Sin Ventas Recientes' || p.diasCobertura > 45) && 
    p.stockActual > 0
  ).sort((a, b) => b.stockActual - a.stockActual);

  // 4. High Margin Yerbas (margenPorc >= 18%)
  const highMarginYerbas = performances.filter(p => 
    p.categoria === 'Yerbas' && 
    p.margenPorc >= 18 && 
    p.stockActual > 0
  ).sort((a, b) => b.margenPorc - a.margenPorc);

  // Fallbacks if lists are empty
  const fallbackStars = performances.filter(p => p.stockActual > 0);
  const getStar = (offset: number = 0) => stars[(seed + offset) % Math.max(1, stars.length)] || fallbackStars[0];
  
  // Sort accessories by margin descending to pair high-margin hardware with yerbas
  const sortedAccessories = [...accessories].sort((a, b) => b.margenPorc - a.margenPorc);
  const getAcc = (offset: number = 0) => sortedAccessories[(seed + offset) % Math.max(1, sortedAccessories.length)] || sortedAccessories[0];
  const getSlow = (offset: number = 0) => slowMovers[(seed + offset) % Math.max(1, slowMovers.length)] || performances[performances.length - 1];
  const getMargin = (offset: number = 0) => highMarginYerbas[(seed + offset) % Math.max(1, highMarginYerbas.length)] || performances[1];

  // Helper to calculate a safe promo discount that ensures margin >= 7%
  const calculateSafeDiscount = (regTotal: number, costoTotal: number, maxDesiredDiscount: number = 8) => {
    let discount = maxDesiredDiscount;
    while (discount >= 3) {
      const comboPrice = Math.round((regTotal * (1 - discount / 100)) / 100) * 100;
      const gain = comboPrice - costoTotal;
      const margin = comboPrice > 0 ? (gain / comboPrice) * 100 : 0;
      if (margin >= 7.0) {
        return { discount, comboPrice, gain, margin: parseFloat(margin.toFixed(1)) };
      }
      discount -= 1;
    }
    const comboPrice = Math.round((regTotal * (1 - discount / 100)) / 100) * 100;
    const gain = comboPrice - costoTotal;
    const margin = comboPrice > 0 ? (gain / comboPrice) * 100 : 0;
    return { discount, comboPrice, gain, margin: parseFloat(margin.toFixed(1)) };
  };

  // COMBO 1: Estrella del Mes + Accesorio Clave de Alto Margen (Ticket Promedio Booster)
  const star1 = getStar(0);
  const acc1 = getAcc(0);
  if (star1 && acc1 && star1.producto !== acc1.producto) {
    const regTotal = getRegularPrice(star1) + getRegularPrice(acc1);
    const costoTotal = star1.precioCompra + acc1.precioCompra;
    const { discount, comboPrice, gain, margin } = calculateSafeDiscount(regTotal, costoTotal, 8);

    combos.push({
      id: `combo-star-acc-${seed}`,
      titulo: `Combo Premium: ${star1.nombreOriginal} + ${acc1.nombreOriginal}`,
      tipo: 'Estrella + Accesorio',
      badge: 'Ticket Promedio Booster',
      categoriaEstrategica: 'estrellas',
      descripcion: `Combina el producto con mayor salida del mes (${star1.nombreOriginal}) con ${acc1.nombreOriginal} con un ${discount}% OFF garantizando alta ganancia.`,
      productoPrincipal: star1.nombreOriginal,
      productoSecundario: acc1.nombreOriginal,
      imagenPrincipal: star1.imagenUrl,
      imagenSecundaria: acc1.imagenUrl,
      cuponWebSugerido: coupon10 ? `${coupon10} (10% OFF en yerbazo.com.ar)` : undefined,
      precioRegularTotal: regTotal,
      precioComboSugerido: comboPrice,
      descuentoPorc: discount,
      costoTotal,
      gananciaEstimada: gain,
      margenPorc: margin,
      motivoSugerencia: `${star1.nombreOriginal} acumula ${star1.unidadesVendidas} unidades vendidas este mes.`,
      razonamiento: `Apalanca el flujo de ventas de tu yerba líder para traccionar la venta de accesorios, elevando el ticket promedio a $${comboPrice.toLocaleString('es-AR')}.`
    });
  }

  // COMBO 2: Dúo Degustación / Exploración Matera (Cross-sell de Alto Margen)
  const star2 = getStar(1);
  const marginYerba = getMargin(0);
  if (star2 && marginYerba && star2.producto !== marginYerba.producto) {
    const regTotal = getRegularPrice(star2) + getRegularPrice(marginYerba);
    const costoTotal = star2.precioCompra + marginYerba.precioCompra;
    const { discount, comboPrice, gain, margin } = calculateSafeDiscount(regTotal, costoTotal, 6);

    combos.push({
      id: `combo-duo-${seed}`,
      titulo: `Dúo Matero: ${star2.nombreOriginal} + ${marginYerba.nombreOriginal}`,
      tipo: 'Pack Degustación',
      badge: 'Cross-sell de Alto Margen',
      categoriaEstrategica: 'duos',
      descripcion: `Pack para invitar a tus clientes a descubrir ${marginYerba.nombreOriginal} (margen de ${marginYerba.margenPorc.toFixed(0)}%) junto a su favorita de siempre con ${discount}% OFF.`,
      productoPrincipal: star2.nombreOriginal,
      productoSecundario: marginYerba.nombreOriginal,
      imagenPrincipal: star2.imagenUrl,
      imagenSecundaria: marginYerba.imagenUrl,
      cuponWebSugerido: coupon10 ? `${coupon10} (10% OFF en yerbazo.com.ar)` : undefined,
      precioRegularTotal: regTotal,
      precioComboSugerido: comboPrice,
      descuentoPorc: discount,
      costoTotal,
      gananciaEstimada: gain,
      margenPorc: margin,
      motivoSugerencia: `${marginYerba.nombreOriginal} ofrece un excelente margen (${marginYerba.margenPorc.toFixed(0)}%) que compensa ampliamente el descuento.`,
      razonamiento: `Convierte compradores de una sola marca en clientes multivariedad, logrando una ganancia líquida de $${gain.toLocaleString('es-AR')} por combo.`
    });
  }

  // COMBO 3: Liquidación / Reactivación de Stock Inmovilizado Subvencionado
  const slowItem = getSlow(0);
  const highMarginSubsidizer = sortedAccessories[0] || getMargin(1);
  if (slowItem && highMarginSubsidizer && slowItem.producto !== highMarginSubsidizer.producto) {
    const regTotal = getRegularPrice(slowItem) + getRegularPrice(highMarginSubsidizer);
    const costoTotal = slowItem.precioCompra + highMarginSubsidizer.precioCompra;
    const { discount, comboPrice, gain, margin } = calculateSafeDiscount(regTotal, costoTotal, 10);

    combos.push({
      id: `combo-clearance-${seed}`,
      titulo: `Pack Desbloqueo: ${slowItem.nombreOriginal} + ${highMarginSubsidizer.nombreOriginal}`,
      tipo: 'Reactivación de Lento Movimiento',
      badge: 'Liberación de Capital Inmovilizado',
      categoriaEstrategica: 'liquidacion',
      descripcion: `Liquidación inteligente con ${discount}% OFF: recupera el capital inmovilizado en ${slowItem.nombreOriginal} apalancándolo con el alto margen de ${highMarginSubsidizer.nombreOriginal}.`,
      productoPrincipal: slowItem.nombreOriginal,
      productoSecundario: highMarginSubsidizer.nombreOriginal,
      imagenPrincipal: slowItem.imagenUrl,
      imagenSecundaria: highMarginSubsidizer.imagenUrl,
      cuponWebSugerido: coupon10 ? `${coupon10} (10% OFF en yerbazo.com.ar)` : undefined,
      precioRegularTotal: regTotal,
      precioComboSugerido: comboPrice,
      descuentoPorc: discount,
      costoTotal,
      gananciaEstimada: gain,
      margenPorc: margin,
      motivoSugerencia: `Hay ${slowItem.stockActual} unidades en depósito de ${slowItem.nombreOriginal} con baja rotación.`,
      razonamiento: `Es más rentable recuperar liquidez inmediata y reinvertirla en yerbas de alta rotación que mantener stock estacionado acumulando costo de oportunidad.`
    });
  }

  // COMBO 4: Kit Experiencia Matera Integral (Ticket Alto y Margen Sólido)
  const star4 = getStar(0);
  const acc2 = sortedAccessories.find(a => a.producto.includes('yerbera') || a.producto.includes('lata')) || sortedAccessories[0];
  const acc3 = sortedAccessories.find(a => a.producto.includes('reposa') || a.producto.includes('pico') || a.producto.includes('guarda'));
  if (star4 && acc2) {
    const regTotal = getRegularPrice(star4) + getRegularPrice(acc2) + (acc3 ? getRegularPrice(acc3) : 0);
    const costoTotal = star4.precioCompra + acc2.precioCompra + (acc3 ? acc3.precioCompra : 0);
    const { discount, comboPrice, gain, margin } = calculateSafeDiscount(regTotal, costoTotal, 8);

    combos.push({
      id: `combo-kit-completo-${seed}`,
      titulo: `Kit Experiencia Matera: ${star4.nombreOriginal} + ${acc2.nombreOriginal}${acc3 ? ' + ' + acc3.nombreOriginal : ''}`,
      tipo: 'Kit Matero Completo',
      badge: 'Pack Ticket Alto',
      categoriaEstrategica: 'kits',
      descripcion: `Experiencia de mate integral: incluye yerba de primera línea y accesorios de apoyo con un descuento atractivo del ${discount}%.`,
      productoPrincipal: star4.nombreOriginal,
      productoSecundario: acc2.nombreOriginal,
      productoTerciario: acc3 ? acc3.nombreOriginal : undefined,
      imagenPrincipal: star4.imagenUrl,
      imagenSecundaria: acc2.imagenUrl,
      imagenTerciaria: acc3 ? acc3.imagenUrl : undefined,
      cuponWebSugerido: coupon10 ? `${coupon10} (10% OFF en yerbazo.com.ar)` : undefined,
      precioRegularTotal: regTotal,
      precioComboSugerido: comboPrice,
      descuentoPorc: discount,
      costoTotal,
      gananciaEstimada: gain,
      margenPorc: margin,
      motivoSugerencia: `Maximiza el ticket de venta a más de $${comboPrice.toLocaleString('es-AR')}, ideal para regalos o nuevos clientes.`,
      razonamiento: `Genera una ganancia neta récord de $${gain.toLocaleString('es-AR')} en un único despacho, ahorrando costos logísticos de empaque.`
    });
  }

  // COMBO 5: Doble Pack Fidelización (2x Yerba de Margen Sostenible)
  // Priorizar yerbas con margen suficiente para soportar descuentos 2x (>= 18%)
  const fidelizacionYerba = highMarginYerbas.find(y => y.stockActual >= 4) || star1;
  if (fidelizacionYerba && fidelizacionYerba.stockActual >= 2) {
    const regTotal = getRegularPrice(fidelizacionYerba) * 2;
    const costoTotal = fidelizacionYerba.precioCompra * 2;
    const { discount, comboPrice, gain, margin } = calculateSafeDiscount(regTotal, costoTotal, 6);

    combos.push({
      id: `combo-fidelizacion-${seed}`,
      titulo: `Doble Pack Stock: 2x ${fidelizacionYerba.nombreOriginal}`,
      tipo: 'Fidelización Doble (2x)',
      badge: 'Defensa de Volumen',
      categoriaEstrategica: 'fidelizacion',
      descripcion: `Asegura el consumo mensual de tus clientes recurrentes con un ${discount}% OFF llevando dos paquetes iguales.`,
      productoPrincipal: `${fidelizacionYerba.nombreOriginal} (Unidad 1)`,
      productoSecundario: `${fidelizacionYerba.nombreOriginal} (Unidad 2)`,
      imagenPrincipal: fidelizacionYerba.imagenUrl,
      imagenSecundaria: fidelizacionYerba.imagenUrl,
      cuponWebSugerido: coupon10 ? `${coupon10} (10% OFF en yerbazo.com.ar)` : undefined,
      precioRegularTotal: regTotal,
      precioComboSugerido: comboPrice,
      descuentoPorc: discount,
      costoTotal,
      gananciaEstimada: gain,
      margenPorc: margin,
      motivoSugerencia: `${fidelizacionYerba.nombreOriginal} tiene stock suficiente (${fidelizacionYerba.stockActual} u.) para abastecer compras duplicadas.`,
      razonamiento: `Fideliza al consumidor por 30-45 días, cerrándole la puerta a competidores y asegurando una ganancia neta de $${gain.toLocaleString('es-AR')}.`
    });
  }

  // COMBO 6: Dúo Bestsellers (Canarias + Baldo) - Calibrado para Venta Directa
  const canarias = performances.find(p => p.producto.includes('canarias') && p.producto.includes('1kg') && p.stockActual > 0);
  const baldo = performances.find(p => p.producto.includes('baldo') && p.producto.includes('1kg') && p.stockActual > 0);
  if (canarias && baldo && canarias.producto !== baldo.producto) {
    const regTotal = getRegularPrice(canarias) + getRegularPrice(baldo);
    const costoTotal = canarias.precioCompra + baldo.precioCompra;
    // Calibrar descuento moderado para que en venta directa WA mantenga >10% de ganancia
    const discount = 4;
    const comboPrice = Math.round((regTotal * (1 - discount / 100)) / 100) * 100;
    const gain = comboPrice - costoTotal;
    const margin = comboPrice > 0 ? (gain / comboPrice) * 100 : 0;

    combos.push({
      id: `combo-elite-uruguayo-${seed}`,
      titulo: `Dúo Clásico Rioplatense: ${canarias.nombreOriginal} + ${baldo.nombreOriginal}`,
      tipo: 'Dúo Bestsellers',
      badge: 'Exclusivo Venta Directa',
      categoriaEstrategica: 'duos',
      descripcion: `El pack definitivo para los amantes del mate estilo uruguayo despalada: combina las dos marcas más vendidas de Yerbazo con un ${discount}% OFF en venta directa.`,
      productoPrincipal: canarias.nombreOriginal,
      productoSecundario: baldo.nombreOriginal,
      imagenPrincipal: canarias.imagenUrl,
      imagenSecundaria: baldo.imagenUrl,
      cuponWebSugerido: undefined,
      precioRegularTotal: regTotal,
      precioComboSugerido: comboPrice,
      descuentoPorc: discount,
      costoTotal,
      gananciaEstimada: gain,
      margenPorc: parseFloat(margin.toFixed(1)),
      motivoSugerencia: `Ambas marcas lideran el volumen de ventas del mes.`,
      razonamiento: `Es la combinación con menor resistencia a la compra. El cliente siente que aprovecha una oportunidad única sobre productos que compraría de todos modos.`
    });
  }

  // COMBO 7: Ofertas Web Oficiales yerbazo.com.ar
  const webOfferProducts = performances.filter(p => p.webEnOferta && p.precioWebOferta && p.stockActual > 0);
  if (webOfferProducts.length >= 2) {
    const p1 = webOfferProducts[seed % webOfferProducts.length];
    const p2 = webOfferProducts[(seed + 1) % webOfferProducts.length];
    if (p1 && p2 && p1.producto !== p2.producto) {
      const reg1 = getRegularPrice(p1);
      const reg2 = getRegularPrice(p2);
      const regTotal = reg1 + reg2;
      const costoTotal = p1.precioCompra + p2.precioCompra;
      const { discount, comboPrice, gain, margin } = calculateSafeDiscount(regTotal, costoTotal, 8);

      combos.push({
        id: `combo-web-offers-${seed}`,
        titulo: `Dúo Oferta Web: ${p1.nombreOriginal} + ${p2.nombreOriginal}`,
        tipo: 'Ofertas Web Oficiales',
        badge: 'Sincronizado con yerbazo.com.ar',
        categoriaEstrategica: 'ofertas_web',
        descripcion: `Combina dos referencias con rebaja activa en la tienda online (${p1.nombreOriginal} a $${p1.precioWebOferta?.toLocaleString('es-AR')} y ${p2.nombreOriginal} a $${p2.precioWebOferta?.toLocaleString('es-AR')}) con un ${discount}% OFF de pack promocional.`,
        productoPrincipal: p1.nombreOriginal,
        productoSecundario: p2.nombreOriginal,
        imagenPrincipal: p1.imagenUrl,
        imagenSecundaria: p2.imagenUrl,
        cuponWebSugerido: coupon10 || undefined,
        precioRegularTotal: regTotal,
        precioComboSugerido: comboPrice,
        descuentoPorc: discount,
        costoTotal,
        gananciaEstimada: gain,
        margenPorc: margin,
        motivoSugerencia: `Artículos actualmente en oferta en yerbazo.com.ar${p1.webStockStatus === 'ultimas' ? ' (¡últimas unidades online!)' : ''}.`,
        razonamiento: `Apalanca el descuento que los clientes ya ven en la web para concretar compras de mayor volumen manteniendo margen saludable.`
      });
    }
  }

  return combos;
}

export function simulatePriceChange(
  performances: ProductPerformance[],
  percentageChange: number, // e.g. +10 means +10%
  elasticityFactor: number = 0.3 // 0.3 means 10% price increase reduces demand by 3%
): {
  currentRevenue: number;
  simulatedRevenue: number;
  revenueDelta: number;
  currentProfit: number;
  simulatedProfit: number;
  profitDelta: number;
  currentMargin: number;
  simulatedMargin: number;
  impactTable: {
    producto: string;
    precioActual: number;
    precioNuevo: number;
    unidadesActuales: number;
    unidadesProyectadas: number;
    gananciaActual: number;
    gananciaProyectada: number;
    gananciaDelta: number;
  }[];
} {
  let currentRevenue = 0;
  let simulatedRevenue = 0;
  let currentProfit = 0;
  let simulatedProfit = 0;

  const impactTable = performances.map(p => {
    const pVenta = p.precioVentaPromedio;
    const pCompra = p.precioCompra;
    const units = p.unidadesVendidas;

    const pVentaNuevo = Math.round(pVenta * (1 + percentageChange / 100));
    // Demand volume change based on elasticity
    const volumeChangeFactor = 1 - (percentageChange / 100) * elasticityFactor;
    const unitsProjected = Math.max(0, Math.round(units * volumeChangeFactor));

    const curRev = pVenta * units;
    const simRev = pVentaNuevo * unitsProjected;

    const curProf = (pVenta - pCompra) * units;
    const simProf = (pVentaNuevo - pCompra) * unitsProjected;

    currentRevenue += curRev;
    simulatedRevenue += simRev;
    currentProfit += curProf;
    simulatedProfit += simProf;

    return {
      producto: p.nombreOriginal,
      precioActual: pVenta,
      precioNuevo: pVentaNuevo,
      unidadesActuales: units,
      unidadesProyectadas: unitsProjected,
      gananciaActual: curProf,
      gananciaProyectada: simProf,
      gananciaDelta: simProf - curProf
    };
  });

  const currentMargin = currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0;
  const simulatedMargin = simulatedRevenue > 0 ? (simulatedProfit / simulatedRevenue) * 100 : 0;

  return {
    currentRevenue,
    simulatedRevenue,
    revenueDelta: simulatedRevenue - currentRevenue,
    currentProfit,
    simulatedProfit,
    profitDelta: simulatedProfit - currentProfit,
    currentMargin,
    simulatedMargin,
    impactTable: impactTable.sort((a, b) => b.gananciaDelta - a.gananciaDelta)
  };
}
