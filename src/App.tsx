import React, { useState, useMemo, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  loadInitialDataset, 
  fetchLiveGoogleSheet, 
  fetchLiveWebStore,
  exportToExcel 
} from './services/dataService';
import { 
  computeMonthlyMetrics, 
  computeProductPerformances, 
  generateSmartCombos 
} from './utils/analyticsEngine';
import { YerbazoDataset, WebStoreData } from './types';
import { Header } from './components/Header';
import { DashboardOverview } from './components/DashboardOverview';
import { ProductAnalysis } from './components/ProductAnalysis';
import { RecommendationsAndPromos } from './components/RecommendationsAndPromos';
import { HistoricalComparison } from './components/HistoricalComparison';
import { PriceSimulator } from './components/PriceSimulator';
import { InventoryAndPurchases } from './components/InventoryAndPurchases';
import { ClientsAndBilling } from './components/ClientsAndBilling';
import { RepurchaseRadar } from './components/RepurchaseRadar';
import { TransactionsExplorer } from './components/TransactionsExplorer';
import { ExecutiveReportModal } from './components/ExecutiveReportModal';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export function App() {
  const [dataset, setDataset] = useState<YerbazoDataset>(() => loadInitialDataset());
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>('TODOS');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncNotification, setSyncNotification] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);

  // Auto-sync in background on initial load if possible
  useEffect(() => {
    // Attempt background live fetch
    fetchLiveGoogleSheet().then(updated => {
      setDataset(updated);
    }).catch(err => {
      console.log('Running on bundled snapshot', err);
    });
  }, []);

  // Compute derived analytics
  const monthlyMetrics = useMemo(() => {
    return computeMonthlyMetrics(dataset.ventas);
  }, [dataset.ventas]);

  const performances = useMemo(() => {
    return computeProductPerformances(dataset.ventas, dataset.stock, selectedMonth, dataset.webStore?.products);
  }, [dataset.ventas, dataset.stock, selectedMonth, dataset.webStore?.products]);

  const combos = useMemo(() => {
    return generateSmartCombos(performances, dataset.stock, 0, dataset.webStore);
  }, [performances, dataset.stock, dataset.webStore]);

  // Handle live sync click
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncNotification(null);
    try {
      const freshData = await fetchLiveGoogleSheet();
      setDataset(freshData);
      setSyncNotification('¡Datos sincronizados exitosamente con Google Sheets!');
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.15 },
        colors: ['#0f4b25', '#ece7d7', '#e68628']
      });
      setTimeout(() => setSyncNotification(null), 4000);
    } catch (e: any) {
      setSyncNotification('Error al conectar con Google Sheets. Se mantuvieron los datos en caché.');
      setTimeout(() => setSyncNotification(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle live web store sync (prices, offers, coupons)
  const handleSyncWebStore = async (): Promise<WebStoreData> => {
    try {
      const freshWeb = await fetchLiveWebStore();
      setDataset(prev => ({
        ...prev,
        webStore: freshWeb,
        lastWebSyncTime: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }));
      return freshWeb;
    } catch (e) {
      console.warn('Could not sync web store', e);
      return dataset.webStore || { products: [], coupons: [], lastUpdated: new Date().toISOString() };
    }
  };

  // Full export to Excel
  const handleExportFullExcel = () => {
    const sheets: Record<string, any[]> = {};
    
    // 1. Resumen Productos
    sheets['Productos_Ranking'] = performances.map(p => ({
      Producto: p.nombreOriginal,
      Marca: p.marca,
      Peso: p.peso,
      Score_Integral: p.scoreIntegral,
      Unidades_Vendidas: p.unidadesVendidas,
      Facturacion_Total: p.facturacionTotal,
      Ganancia_Total: p.gananciaTotal,
      Margen_Porc: `${p.margenPorc.toFixed(1)}%`,
      Stock_Restante: p.stockActual,
      Dias_Cobertura: p.diasCobertura,
      Tendencia: p.tendencia,
      Cuadrante_BCG: p.cuadranteBCG,
      Clasificacion_ABC: p.clasificacionABC,
      Accion_Recomendada: p.estrategiaRecomendada
    }));

    // 2. Metricas Mensuales
    sheets['Metricas_Mensuales'] = monthlyMetrics.map(m => ({
      Mes: m.mesNombre,
      Facturado: m.facturado,
      Ganancia: m.ganancia,
      Margen_Porc: `${m.margenPorc.toFixed(1)}%`,
      Cantidad_Ventas: m.cantVentas,
      Unidades_Vendidas: m.unidadesVendidas,
      Ticket_Promedio: m.ticketPromedio,
      Crecimiento_MoM_Facturacion: m.crecimientoFacturacionMoM !== null ? `${m.crecimientoFacturacionMoM.toFixed(1)}%` : '-',
      Diferencia_MoM_Facturacion: m.diferenciaFacturacionMoM !== null ? m.diferenciaFacturacionMoM : '-'
    }));

    // 3. Ventas completas
    sheets['Libro_Ventas'] = dataset.ventas.map(v => ({
      ID_Venta: v.id,
      Cliente: v.cliente,
      Fecha: v.fecha,
      Mes: v.mes,
      Precio_Final: v.precioFinal,
      Ganancia: v.ganancia,
      Medio_Pago: v.medioPago,
      Pago: v.pago,
      Entregado: v.entregado,
      Productos: v.items.map(i => `${i.cantidad}x ${i.producto}`).join(' | '),
      Observaciones: v.observaciones
    }));

    // 4. Stock Almacen
    sheets['Stock_Actual'] = dataset.stock.map(s => ({
      Producto: s.nombre,
      Comprado: s.comprado,
      Vendido: s.vendidas,
      Restante: s.restantes,
      Precio_Compra: s.precioCompra,
      Precio_Venta: s.precioVenta,
      Margen_Porc: `${s.porcentajeGanancia.toFixed(1)}%`
    }));

    exportToExcel(`Yerbazo_Informe_Consolidado_${new Date().toISOString().slice(0, 10)}`, sheets);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f5ed] text-stone-900 selection:bg-[#0f4b25] selection:text-[#ece7d7]">
      
      {/* Top Notification Banner if Sync */}
      {syncNotification && (
        <div className={`p-3 text-center text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
          syncNotification.includes('Error') 
            ? 'bg-rose-600 text-white' 
            : 'bg-[#0f4b25] text-[#ece7d7] border-b border-[#e68628]'
        }`}>
          {syncNotification.includes('Error') ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span>{syncNotification}</span>
        </div>
      )}

      {/* Main Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        onSync={handleSync}
        isSyncing={isSyncing}
        lastSyncTime={dataset.lastSyncTime}
        webStoreProductCount={dataset.webStore?.products?.length}
        onExportExcel={handleExportFullExcel}
        onOpenReportModal={() => setIsReportOpen(true)}
      />

      {/* Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {activeTab === 'dashboard' && (
          <DashboardOverview
            dataset={dataset}
            monthlyMetrics={monthlyMetrics}
            performances={performances}
            selectedMonth={selectedMonth}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'productos' && (
          <ProductAnalysis
            performances={performances}
            selectedMonth={selectedMonth}
          />
        )}

        {activeTab === 'recompra' && (
          <RepurchaseRadar
            dataset={dataset}
            catalog={dataset.stock}
            webStore={dataset.webStore}
          />
        )}

        {activeTab === 'recomendaciones' && (
          <RecommendationsAndPromos
            performances={performances}
            combos={combos}
            catalog={dataset.stock}
            selectedMonth={selectedMonth}
            onSync={handleSync}
            onSyncWebStore={handleSyncWebStore}
            isSyncing={isSyncing}
            lastSyncTime={dataset.lastSyncTime}
            webStore={dataset.webStore}
          />
        )}

        {activeTab === 'comparativa' && (
          <HistoricalComparison
            monthlyMetrics={monthlyMetrics}
            performances={performances}
            ventas={dataset.ventas}
          />
        )}

        {activeTab === 'simulador' && (
          <PriceSimulator
            performances={performances}
          />
        )}

        {activeTab === 'stock' && (
          <InventoryAndPurchases
            dataset={dataset}
            performances={performances}
          />
        )}

        {activeTab === 'clientes' && (
          <ClientsAndBilling
            dataset={dataset}
          />
        )}

        {activeTab === 'ventas' && (
          <TransactionsExplorer
            ventas={dataset.ventas}
            selectedMonth={selectedMonth}
            dataset={dataset}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="bg-[#0f4b25] text-[#ece7d7] py-8 border-t-4 border-[#e68628] mt-12 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 p-0.5 flex items-center justify-center border border-[#e68628]/40 overflow-hidden">
              <img src="/logo.webp" alt="Yerbazo Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight uppercase font-display">
                YERBAZO MATES & YERBAS
              </div>
              <p className="text-xs text-[#ece7d7]/70">
                Plataforma Analítica y Motor de Rentabilidad Comercial
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-6 text-xs text-[#ece7d7]/80">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0f4b25] border border-white"></span>
              <span>Verde #0f4b25</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ece7d7] border border-stone-600"></span>
              <span>Crema #ece7d7</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#e68628]"></span>
              <span>Naranja #e68628</span>
            </div>
          </div>

          <div className="text-xs text-[#ece7d7]/60 text-center md:text-right">
            Sincronizado con Google Sheets • Yerbazo © 2026
          </div>
        </div>
      </footer>

      {/* Executive Report Modal */}
      <ExecutiveReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        dataset={dataset}
        monthlyMetrics={monthlyMetrics}
        performances={performances}
        selectedMonth={selectedMonth}
      />

    </div>
  );
}

export default App;
