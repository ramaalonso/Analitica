export interface SaleItem {
  producto: string;
  cantidad: number;
  stockStatus?: string;
}

export interface SaleTransaction {
  id: string;
  cliente: string;
  fecha: string;
  fechaObj?: string | null; // ISO string
  precioSistema: number;
  precioFinal: number;
  medioPago: string;
  pago: string; // 'SI' | 'NO' | 'PENDIENTE'
  observaciones: string;
  entregado: string;
  items: SaleItem[];
  mes: string;
  semana: string;
  ganancia: number;
  deudaInfo?: string;
  rowIndex: number;
}

export interface CatalogProduct {
  id: string;
  nombre: string;
  nombreNormalizado: string;
  categoria: 'Yerbas' | 'Accesorios' | 'Mates y Bombillas';
  marca: string;
  peso: string;
  comprado: number;
  vendidas: number;
  restantes: number;
  precioCompra: number;
  precioVenta: number;
  precioViejo: number;
  gastoTotal: number;
  gananciaVendiendoTodo: number;
  gananciaUnidad: number;
  gananciaRealizada: number;
  porcentajeGanancia: number;
  // Computed fields
  unidadesEnVentas?: number;
  facturacionEnVentas?: number;
  gananciaEnVentas?: number;
}

export interface MonthlyMetric {
  mesKey: string;
  mesNombre: string;
  order: number;
  facturado: number;
  ganancia: number;
  margenPorc: number;
  cantVentas: number;
  unidadesVendidas: number;
  ticketPromedio: number;
  crecimientoFacturacionMoM: number | null; // %
  diferenciaFacturacionMoM: number | null; // $
  crecimientoGananciaMoM: number | null; // %
  diferenciaGananciaMoM: number | null; // $
}

export interface ProductPerformance {
  producto: string;
  nombreOriginal: string;
  categoria: string;
  marca: string;
  peso: string;
  unidadesVendidas: number;
  facturacionTotal: number;
  gananciaTotal: number;
  margenPorc: number;
  precioVentaPromedio: number;
  precioCompra: number;
  stockActual: number;
  diasCobertura: number;
  velocidadSemanal: number;
  // Monthly history
  ventasPorMes: Record<string, { unidades: number; facturado: number; ganancia: number }>;
  // Comparisons
  crecimientoMoM: number; // vs previous active month
  diferenciaUnidadesMoM: number;
  tendencia: 'Fuerte Alza' | 'Crecimiento' | 'Estable' | 'Baja Ligera' | 'Fuerte Caída' | 'Sin Ventas Recientes';
  // Strategic classifications
  scoreIntegral: number; // 0 - 100
  cuadranteBCG: 'Estrella' | 'Vaca Lechera' | 'Interrogante' | 'Perro';
  clasificacionABC: 'A (Top 80% Fact.)' | 'B (Siguiente 15%)' | 'C (Último 5%)';
  // Actionable advice
  estrategiaRecomendada: string;
  tipoAccion: 'Promocionar' | 'Proteger Margen' | 'Liquidación' | 'Reorden Urgente' | 'Combo / Cross-sell';
  justificacionAccion: string;
  // Live web store sync fields
  webProduct?: WebStoreProduct;
  precioWeb?: number;
  precioWebOferta?: number | null;
  webEnOferta?: boolean;
  webStockStatus?: 'normal' | 'ultimas' | 'sinstock';
  imagenUrl?: string;
}

export interface WebStoreProduct {
  id: number;
  title: string;
  price: number;
  category: string;
  badge?: string;
  weight?: string;
  shortDesc?: string;
  fullDesc?: string;
  image?: string;
  images?: string[];
  isSale?: boolean;
  salePrice?: number | null;
  isUrgent?: boolean;
  stockStatus?: 'normal' | 'ultimas' | 'sinstock';
}

export interface WebStoreCoupon {
  id: number;
  code: string;
  discount: number;
  active: boolean;
}

export interface WebStoreData {
  products: WebStoreProduct[];
  coupons: WebStoreCoupon[];
  lastUpdated?: string;
}

export interface ComboOpportunity {
  id: string;
  titulo: string;
  tipo: string;
  badge?: string;
  descripcion: string;
  productoPrincipal: string;
  productoSecundario: string;
  productoTerciario?: string;
  imagenPrincipal?: string;
  imagenSecundaria?: string;
  imagenTerciaria?: string;
  cuponWebSugerido?: string;
  precioRegularTotal: number;
  precioComboSugerido: number;
  descuentoPorc: number;
  costoTotal: number;
  gananciaEstimada: number;
  margenPorc: number;
  razonamiento: string;
  motivoSugerencia?: string;
  categoriaEstrategica?: 'todos' | 'estrellas' | 'duos' | 'liquidacion' | 'kits' | 'fidelizacion' | 'ofertas_web';
}

export interface ProxCompraRow {
  producto: string;
  restante: number;
  proxCompraSugerida: number;
  costeUnidad: number;
  costeFinal: number;
  totalPostCompra: number;
}

export interface ClienteRow {
  cliente: string;
  comoNosConocio: string;
  direccionEntrega: string;
  totalCompras: number;
  totalGastado: number;
  totalGananciaGenerada: number;
  saldoDeuda: number;
  ultimaCompra?: string;
  diasDesdeUltimaCompra?: number;
  segmentoFrecuencia?: 'activo' | 'en_riesgo' | 'inactivo';
  clubMateroNivel?: 'Cebador Inicial' | 'Matero Habitual' | 'Matero Fiel' | 'Matero VIP';
  proximoBeneficioCompras?: number;
  productosFavoritos: string[];
}

export interface ClienteRecompra {
  cliente: string;
  canal: string;
  direccion: string;
  totalCompras: number;
  totalGastado: number;
  ultimaFecha: string;
  diasDesdeUltimaCompra: number;
  kgCompradosUltima: number;
  yerbasUltimaCompra: string;
  consumoDiarioKg: number;
  diasDuracionEstimada: number;
  diasRestantes: number;
  porcentajeRestante: number;
  kgRestantes: number;
  fechaEstimadaAgotamiento: string;
  diasAgotado: number;
  estadoConsumo: 'sin_yerba' | 'ultimas_cebadas' | 'medio' | 'abastecido';
  yerbaFavorita: string;
  precioRegularFavorita: number;
  precioOfertaTentadora: number;
  descuentoPorcTentador: number;
  ahorroMonto: number;
  contactoEstado?: 'pendiente' | 'contactado' | 'recompro' | 'pospuesto';
  contactoFecha?: string;
}

export interface MateBombillaItem {
  producto: string;
  cantidad: number;
  precioUnidad: number;
  total: number;
  detalle: string;
}

export interface YerbazoDataset {
  ventas: SaleTransaction[];
  stock: CatalogProduct[];
  gananciaHistorial: { mes: string; precioFinal: number; ganancia: number }[];
  proxCompra: ProxCompraRow[];
  clientes: ClienteRow[];
  matesBombillas: MateBombillaItem[];
  lastSyncTime: string;
  isLive: boolean;
  sheetSourceUrl: string;
  webStore?: WebStoreData;
  lastWebSyncTime?: string;
}
