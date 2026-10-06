# 🌿 Yerbazo Analytics | Inteligencia Comercial y Control de Productos

Plataforma analítica y estratégica diseñada específicamente para **Yerbazo**, conectada de forma directa con la hoja de cálculo de Google Sheets oficial:
`https://docs.google.com/spreadsheets/d/15hjl5YFZqSFRGuh1IEv7zHDRXrQPPfvRU8dijVOmWPY/edit?usp=sharing`

La aplicación respeta estrictamente la paleta de colores oficial de la marca:
- **Verde Selva:** `#0f4b25`
- **Crema Matero:** `#ece7d7`
- **Naranja Energía:** `#e68628`

---

## 🚀 Inicio Rápido

### Opción 1: Lanzador Directo en Windows
Haz doble clic sobre el archivo **`iniciar.bat`** en la carpeta del proyecto. Automáticamente iniciará el servidor y abrirá la aplicación en tu navegador web en `http://localhost:3001`.

### Opción 2: Desde Terminal
```bash
# Modo Producción / Servidor con Proxy en vivo:
node server.js

# O en Modo Desarrollo:
npm.cmd run dev
```

---

## 📋 Módulos y Funcionalidades Desarrolladas

### 1. 📊 Resumen Ejecutivo y Facturación
- **Facturación del Período:** Cálculo automático de ingresos brutos y comparación MoM con badge de crecimiento porcentual y diferencia en pesos.
- **Ganancia Neta & Margen:** Beneficio líquido real obtenido y margen porcentual sobre ventas.
- **Rotación y Pedidos:** Unidades físicas vendidas, cantidad de transacciones y ticket promedio por compra.
- **Gráficos Interactivos:** Evolución mensual de facturación vs ganancia y desglose de ventas por marca de yerba.
- **Alertas Inteligentes en Tiempo Real:** Avisos automáticos de récords de facturación, oportunidades de margen y alertas de quiebre de stock.

### 2. 🏆 Análisis de Productos ("¿Cuánto se vende y cuál es el mejor?")
- **Podio de Honor:** 
  - 🥇 **Mejor Producto Integral (Score Ponderado de 0 a 100):** Algoritmo multicriterio que pondera volumen vendido (30%), facturación recaudada (30%), margen unitario (20%) y tendencia de crecimiento (20%).
  - 🥈 y 🥉 Segundo y Tercer puesto.
  - Líder en unidades físicas despachadas.
  - Líder en recaudación de dinero.
  - Líder en margen de ganancia líquida.
- **Matriz BCG Cuadrante (Boston Consulting Group):**
  - ⭐ **Estrellas:** Alto volumen y alta tracción (Baldo 1kg, Canarias 1kg, Rei Verde 1kg).
  - 🐄 **Vacas Lecheras:** Ventas continuas de alta madurez.
  - ❓ **Interrogantes:** Alto margen o potencial por impulsar.
  - 🐶 **Perros:** Baja rotación y capital inmovilizado.
- **Clasificación ABC (Pareto 80/20):** Identificación del 20% de artículos que genera el 80% del dinero de Yerbazo.
- **Catálogo Maestro:** Tabla con buscador en vivo, filtros por categoría y ordenamiento con un clic en cualquier columna.

### 3. 🚀 Motor de Recomendaciones ("¿Cuál promocionar?")
- **Reglas Estratégicas Claras:**
  - *Ventas en Alza:* No bajar el precio; usarlos como ancla para combos con accesorios de alto margen.
  - *Ventas en Baja:* Promociones "2x1", descuentos de liquidación o regalo de muestra para rotar stock parado.
  - *Alto Margen Oculto:* Productos con más del 25-39% de margen para up-selling en el checkout.
- **Generador de Combos & Bundles Inteligentes:** Packs calculados con precios sugeridos, descuentos justificados, costo de mercadería, ganancia neta garantizada y botón para **copiar el mensaje de venta listo para WhatsApp o Instagram**.

### 4. 📈 Comparativa Histórica ("¿Cuál mejoró respecto a un tiempo pasado?")
- Selector interactivo de **Período Actual vs Período Anterior** (ej. Septiembre vs Agosto, Agosto vs Julio, etc.).
- Variación en facturación ($ y %), ganancia neta ($ y %) y paquetes despachados (+/-).
- **Ranking de los que más mejoraron:** Productos con mayor salto en volumen y facturación.
- **Ranking de retrocesos:** Productos que perdieron tracción comercial.
- Gráfico comparativo de barras lado a lado.

### 5. 💡 Simulador de Precios y Elasticidad
- Ajuste porcentual interactivo (-20% a +30%) con slider y botones rápidos.
- Modelo de comportamiento del cliente:
  - *Hábito Fiel (Inelástica - Consumo matero diario).*
  - *Moderada.*
  - *Fija (Sin variación de demanda).*
- Proyección en vivo de:
  - Facturación resultante.
  - Ganancia neta adicional en pesos ($).
  - Nuevo margen de rentabilidad.
- Tabla de impacto unitario producto por producto.

### 6. 📦 Monitor de Inventario & Próxima Compra
- Sincronizado con las pestañas **"Stock"** y **"Prox compra"** de Google Sheets.
- **Semáforo de Salud:** Agotado, Crítico (< 7 días), Atención (7-15 días), Óptimo (> 15 días).
- **Planificador de Próxima Compra:** Unidades sugeridas, costo unitario, inversión total presupuestada y stock proyectado post-compra.
- **Colección de Mates & Bombillas:** Integración de la pestaña "mates - bombillas" con valuación de inventario artesanal (Torp Cincelado, Imperial Clásico, Coquito, Galleta, Trenzado Bronce).
- **Valuación Total de Almacén:** Capital inmovilizado al costo vs valor de venta proyectado.

### 7. 👥 Clientes, Canales & Cobranzas
- Sincronizado con la pestaña **"Clientes"** y la columna **"PAGO"** de Ventas.
- **Canales de Captación:** Gráfico de procedencia de clientes (Club, Rugby, UADE, Amigos, etc.).
- **Top Clientes Compradores (LTV):** Frecuencia, total gastado y variedades favoritas.
- **Panel de Cobranzas:** Listado de ventas impagas (PAGO = NO / PENDIENTE) con montos a recaudar.
- **Registro de Deuda:** Registro de deuda anotada en la hoja (Hernán - Roxana: $340.000).
- **Métodos de Pago:** Desglose de % en Efectivo, Mercado Pago y Mixtos.

### 8. 📋 Libro Mayor de Ventas
- Auditoría de todas las ventas con buscador instantáneo, filtros por mes, estado de cobro y entrega.
- Paginación dinámica y exportación directa de la vista filtrada a Excel.

### 9. 📄 Reporte Ejecutivo Imprimible / PDF
- Generación de informe gerencial formal con un clic, con diseño optimizado para imprimir o guardar en PDF (`window.print()`).

---

## 🔄 Sincronización en Vivo con Google Sheets

La plataforma incluye un botón de **"Sincronizar Sheets"** en el encabezado.
1. Al pulsarlo, el servidor consulta directamente las pestañas de tu Google Sheet y recarga automáticamente todas las métricas, ventas y stocks sin necesidad de reiniciar nada.
2. Si trabajas sin conexión a internet, la aplicación cuenta con un respaldo en caché local para que nunca te quedes sin acceso a tu información.
