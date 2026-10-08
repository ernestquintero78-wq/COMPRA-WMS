import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Move,
  ClipboardCheck,
  TrendingUp,
  FileDown,
  MapPin,
  UserCheck,
  Package,
  Printer,
  Lightbulb,
  ShieldAlert,
  AlertTriangle,
  Play,
  CheckCircle,
  HelpCircle,
  Clock,
  Database,
  ChevronRight,
  Settings
} from 'lucide-react';

interface ManualSection {
  id: string;
  title: string;
  category: 'operacion' | 'analisis' | 'soporte';
  icon: any;
  summary: string;
  objective: string;
  steps: string[];
  fields: { name: string; description: string }[];
  bestPractices: string[];
  simulationNote?: string;
}

export function UserManual() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('intro');

  const sections: ManualSection[] = [
    {
      id: 'intro',
      title: 'Introducción al Sistema WMS',
      category: 'operacion',
      icon: BookOpen,
      summary: 'Conceptos fundamentales del Warehouse Management System (WMS) y su arquitectura conectada a Supabase PostgreSQL.',
      objective: 'Optimizar la eficiencia espacial, reducir tiempos de búsqueda físicos y garantizar la precisión absoluta de inventario de un 100% mediante digitalización de procesos.',
      steps: [
        'La plataforma funciona como un gemelo digital del almacén real, rastreando coordenadas en formato Pasillo-Estantería-Repisa-Nivel (ej: A-01-S1-L1).',
        'Cada cambio físico en el almacén real debe registrarse mediante la interfaz o escáner de código de barras para mantener sincronizada la base de datos central en Supabase.',
        'Los datos se actualizan de forma reactiva, alimentando un historial de auditoría inmutable en la pestaña de Logs.'
      ],
      fields: [
        { name: 'Celdas (Bins)', description: 'Ubicaciones físicas organizadas con límites de volumen (m³) y peso máximo (kg).' },
        { name: 'Catálogo de SKU', description: 'Registro técnico de cada tipo de artículo con sus dimensiones físicas, peso y stock mínimo de seguridad.' },
        { name: 'Órdenes (Orders)', description: 'Instrucciones transaccionales de Inbound (entradas de proveedor) u Outbound (despacho a cliente).' }
      ],
      bestPractices: [
        'Siempre inicie sesión con su perfil de operador correcto en la pestaña de "Registro de Personal" para firmar digitalmente cada transacción.',
        'No mueva físicamente ningún producto sin realizar previamente el movimiento digital en el sistema.',
        'Revise las "Alertas de Seguridad" que se proyectan automáticamente cuando una celda supera el peso o volumen máximo permitido.'
      ],
      simulationNote: 'Puede usar el botón "Entrega de Compra (Sim)" en la barra lateral para ver cómo el sistema reacciona en tiempo real, poblando inventarios y registrando alertas automáticas de seguridad si las celdas se sobrecargan.'
    },
    {
      id: 'entradas',
      title: 'Operación de Entradas (Inbound)',
      category: 'operacion',
      icon: ArrowDownLeft,
      summary: 'Proceso de recepción de mercancía de proveedores externos y su colocación óptima (Putaway) en las estanterías del almacén.',
      objective: 'Asegurar que toda mercancía recibida sea escaneada correctamente, ingresada con su código de barras y ubicada en el lugar físico óptimo para evitar cuellos de botella y maximizar el espacio.',
      steps: [
        'Vaya a la pestaña "Entradas" en el menú principal.',
        'Seleccione el sub-módulo "Escáner de Recepción" para realizar la entrada rápida de inventario.',
        'Haga clic en la simulación de lectura de un código de barras (ej: 7501020304012) o ingréselo manualmente.',
        'El sistema identificará automáticamente el artículo (ej: Industrial Controller i7). Ingrese la cantidad recibida.',
        'Utilice el algoritmo para buscar una celda libre recomendada, o bien diríjase a la pestaña "Guardado Optimizado" (Putaway Optimizer).',
        'El optimizador de Putaway evaluará la categoría del SKU y las capacidades físicas (peso, volumen) de las celdas disponibles para proponerle la ubicación más segura y lógica.',
        'Haga clic en "Confirmar Guardado (Commit)" para consolidar el stock en la celda y enviar los datos a Supabase.'
      ],
      fields: [
        { name: 'Código de Barras (Barcode)', description: 'Código único EAN/UPC que identifica el producto recibido.' },
        { name: 'Celda Destino (Bin ID)', description: 'Coordenada del almacén donde se colocará el producto físico.' },
        { name: 'Putaway Score', description: 'Porcentaje de idoneidad calculado algorítmicamente para el guardado (priorizando niveles bajos para cargas pesadas).' }
      ],
      bestPractices: [
        'Siempre asigne los artículos más pesados en el Nivel 1 (L1) de las estanterías para evitar riesgos estructurales.',
        'Evite mezclar SKUs diferentes en una misma celda física si desea evitar errores en el proceso posterior de picking.',
        'Verifique que las dimensiones registradas del SKU en el catálogo coincidan con el empaque real.'
      ],
      simulationNote: 'Active la simulación de Inbound desde la barra lateral. Verá cómo se simula la entrega de un pedido de compra pendiente PO-2026-002 de cables blindados.'
    },
    {
      id: 'salidas',
      title: 'Operación de Salidas y Despacho Rápido',
      category: 'operacion',
      icon: ArrowUpRight,
      summary: 'Despacho directo de mercancía sin requerir creación previa de órdenes: seleccione o escanee el producto, defina el destino y medio de entrega.',
      objective: 'Agilizar al máximo el flujo de salida y despacho de mercancías permitiendo egresos inmediatos en 3 pasos sencillos, deduciendo el stock y celdas físicas en tiempo real.',
      steps: [
        'Vaya a la pestaña "Salidas" en el menú lateral.',
        'Paso 1 (Producto): Escanee el código de barras/SKU con lector o seleccione el artículo directamente desde el catálogo visual con stock disponible y celdas de picking en vivo.',
        'Indique la cantidad a despachar utilizando los controles o botones rápidos (+1, +5, +10, Máx).',
        'Paso 2 (Destino): Ingrese el destino, cliente o sucursal (o use los chips rápidos: Cliente Mostrador, Sucursal Norte, Envío a Domicilio, etc.).',
        'Paso 3 (Medio de Entrega): Elija el transporte (Reparto Local, Paquetería Externa, Entrega en Mostrador, Transporte Pesado, Mensajería Express) y opcionalmente número de guía o notas.',
        'Haga clic en el botón "PROCESAR SALIDA INMEDIATA": El sistema deducirá el stock del catálogo y de las celdas físicas automáticamente, reflejándolo en los tableros de Métricas.',
        'Obtenga el Comprobante Digital / Vale de Salida oficial con opción a imprimir remisión y visualícelo en el historial de despachos.'
      ],
      fields: [
        { name: 'Producto / SKU', description: 'Artículo a despachar con validación de stock disponible y celdas de origen para picking.' },
        { name: 'Destino', description: 'Cliente, sucursal, tienda o punto de entrega de la mercancía.' },
        { name: 'Medio de Entrega', description: 'Método de transporte utilizado para el traslado físico del material.' },
        { name: 'Folio de Salida', description: 'Identificador único generado automáticamente (OUT-XXXXXX) para trazabilidad y auditoría.' }
      ],
      bestPractices: [
        'No es necesario crear órdenes previas: el módulo procesa la salida de inmediato con solo indicar producto, destino y transporte.',
        'Revise las celdas de extracción mostradas en la ficha del producto para tomar la mercancía de las ubicaciones físicas sugeridas.',
        'Utilice el botón de Imprimir Vale para acompañar la entrega física con el comprobante de salida formal.'
      ]
    },
    {
      id: 'movimientos',
      title: 'Gestión de Movimientos Internos',
      category: 'operacion',
      icon: Move,
      summary: 'Reubicación manual y reordenamiento de stock entre celdas para optimizar la densidad de almacenamiento o preparar consolidaciones.',
      objective: 'Permitir que un operador reubique mercancías entre ubicaciones del almacén sin alterar el inventario neto total, pero manteniendo la precisión de coordenadas al 100%.',
      steps: [
        'Vaya a la pestaña "Movimientos" en el menú lateral.',
        'El panel mostrará el "Transferidor de Celdas".',
        'Seleccione la "Celda de Origen" donde se encuentra el inventario actual de un artículo.',
        'Seleccione la "Celda de Destino" (que debe estar vacía o contener el mismo SKU).',
        'Ingrese la cantidad de unidades que trasladará físicamente.',
        'Haga clic en el botón "Confirmar Reubicación Interna".',
        'El sistema validará de inmediato los límites de peso de la celda destino, actualizará ambas celdas en Supabase y generará una firma de auditoría en los Logs.'
      ],
      fields: [
        { name: 'Celda Origen', description: 'Coordenada inicial desde donde se retira la mercancía.' },
        { name: 'Celda Destino', description: 'Coordenada final donde se deposita el stock.' },
        { name: 'Ubicaciones Sugeridas', description: 'Lista interactiva de celdas vacías compatibles con las dimensiones físicas del artículo.' }
      ],
      bestPractices: [
        'Utilice movimientos internos periódicamente para agrupar saldos de SKUs idénticos en menos celdas (consolidación de inventario).',
        'Nunca realice un movimiento físico sin reportarlo en el sistema; de lo contrario, la ruta de picking dirigirá a los operadores a celdas vacías.',
        'Si un artículo es perecedero, ubíquelo en posiciones frontales y bajas mediante un movimiento para facilitar su despacho rápido (FIFO).'
      ]
    },
    {
      id: 'conteos',
      title: 'Auditorías y Conteos Cíclicos',
      category: 'operacion',
      icon: ClipboardCheck,
      summary: 'Herramientas de control de calidad para auditar el inventario real y registrar discrepancias entre el stock físico y las cifras teóricas de la base de datos.',
      objective: 'Eliminar las discrepancias de inventario mediante la verificación periódica de SKUs seleccionados de forma sistemática y transparente.',
      steps: [
        'Vaya a la pestaña "Conteos Cíclicos" en el menú principal.',
        'En la pestaña "Efectuar Conteo", observará la "Sesión de Conteo Activa". El gráfico circular central muestra el porcentaje de SKUs auditados en esta sesión.',
        'En el listado de SKUs a la derecha, seleccione el SKU que desea auditar haciendo clic en él, o use el escáner para registrar el código de barras.',
        'El sistema cargará el SKU en la consola de auditoría. Ingrese la cantidad real de piezas que ha contado físicamente en los estantes.',
        'Haga clic en el botón "Confirmar Registro de Auditoría (Firma)".',
        'Si la cantidad física difiere del stock registrado en el sistema, el WMS calculará la desviación (positiva o negativa) y actualizará automáticamente la cantidad del SKU.',
        'Para revisar los desajustes históricos, haga clic en el botón superior de sub-navegación "Historial de Desviaciones". Verá la lista detallada con fechas, desviaciones y estatus de alineación.',
        'Al concluir el ejercicio de conteo, haga clic en "Imprimir Reporte y Firmas" o "Concluir y Generar Acta". Podrá seleccionar la fecha del ejercicio, asignar el responsable y supervisor, y generar el Acta Oficial de Conteo Cíclico en formato imprimible con el balance exacto de diferencias y los recuadros para firma física (Responsable, Supervisor y Gerencia).'
      ],
      fields: [
        { name: 'Inventario Físico (Physical)', description: 'La cantidad real contada manualmente en el estante por el operario.' },
        { name: 'Inventario de Sistema (System)', description: 'La cantidad que se encuentra registrada en la base de datos al momento del conteo.' },
        { name: 'Desviación (Deviation)', description: 'La diferencia aritmética (Físico - Sistema). Si es 0, la celda está perfectamente alineada.' }
      ],
      bestPractices: [
        'Se recomienda realizar conteos cíclicos diariamente sobre productos de alta rotación (Clasificación A).',
        'Si encuentra una desviación negativa constante para un SKU, investigue la estación de empaque o reporte fallas en las etiquetas.',
        'Al iniciar una nueva campaña de auditoría completa, haga clic en "Reiniciar Sesión" para limpiar el gráfico de avance.'
      ]
    },
    {
      id: 'dashboard',
      title: 'Métricas y Alertas de Seguridad',
      category: 'analisis',
      icon: TrendingUp,
      summary: 'Monitoreo analítico de KPIs críticos de la operación, rendimiento diario y sistema automatizado de prevención de riesgos estructurales.',
      objective: 'Brindar visibilidad completa y centralizada a supervisores y jefes de almacén sobre los niveles de stock, saturación espacial y alertas de riesgo estructural en tiempo real.',
      steps: [
        'Vaya a la pestaña "Métricas" en la sección de Soporte y Monitoreo.',
        'El panel superior muestra 4 KPIs macro en tarjetas estilizadas: Ocupación General de Celdas (%), Unidades Totales en Inventario, Pedidos Pendientes en Cola y Tasa de Precisión de Auditoría (%).',
        'Analice el gráfico dinámico de "Inventario vs. Nivel de Seguridad Mínimo" para identificar SKUs que estén por debajo del stock de seguridad (en color rojo/naranja).',
        'El gráfico "Flujo Transaccional Semanal" presenta el volumen de movimientos diarios de entradas y salidas.',
        'En la parte superior de la pantalla principal, el sistema despliega el panel de "Alertas de Seguridad Activas del WMS" si existen violaciones físicas críticas en alguna de las celdas.'
      ],
      fields: [
        { name: 'Saturación de Celda (%)', description: 'Cálculo volumétrico ocupado en base al límite m³ establecido para la coordenada.' },
        { name: 'Tasa de Precisión (Accuracy)', description: 'Porcentaje de coincidencia perfecta obtenida en las últimas sesiones de conteo cíclico.' },
        { name: 'Alertas Estructurales', description: 'Advertencias automáticas de sobrepeso (kg) o sobrevolumen (m³) en estanterías altas.' }
      ],
      bestPractices: [
        'Revise de inmediato cualquier alerta en color rojo del sistema. Estas se detonan si un operario coloca por error artículos que exceden la resistencia en kilogramos del estante.',
        'Mantenga la ocupación global del almacén por debajo del 85% para garantizar holgura operativa y rutas fluidas de Putaway.'
      ]
    },
    {
      id: 'reports',
      title: 'Centro de Reportes y Exportación',
      category: 'analisis',
      icon: FileDown,
      summary: 'Extractor modular de reportes operativos en formatos estándar (Excel y JSON) para auditorías externas o respaldos históricos.',
      objective: 'Generar documentación formal descargable del estado real del almacén para presentación ante la dirección o auditoría financiera de inventario.',
      steps: [
        'Vaya a la pestaña "Centro de Reportes" en el menú principal.',
        'Observe las métricas resumidas que calculan el valor económico total del inventario activo y el costo promedio por SKU.',
        'Utilice la barra de búsqueda de reportes rápidos para filtrar el reporte de interés.',
        'Haga clic en el botón "Exportar a Excel (XLSX)" para generar un archivo descargable de auditoría estructurado en pestañas de Celdas, Inventario, Órdenes y Logs.',
        'O use los botones específicos para descargar datos en formato JSON nativo si requiere importarlos en sistemas ERP alternos.'
      ],
      fields: [
        { name: 'Costo Valorizado', description: 'Suma económica del costo unitario del SKU multiplicado por las existencias reales.' },
        { name: 'Firma de Respaldo', description: 'Sello electrónico estampado en la parte inferior del archivo exportado que registra fecha y hora UTC.' }
      ],
      bestPractices: [
        'Exporte un reporte estructurado de inventario al final de cada turno y guárdelo como respaldo histórico de auditoría.',
        'El reporte XLSX de auditoría es totalmente compatible con Microsoft Excel, Google Sheets y LibreOffice.'
      ]
    },
    {
      id: 'map',
      title: 'Mapa Interactivo del Almacén',
      category: 'analisis',
      icon: MapPin,
      summary: 'Representación visual bidimensional de la planta del almacén, estanterías, pasillos y niveles de celdas.',
      objective: 'Visualizar instantáneamente la distribución física de la mercancía, el estado de saturación de cada ubicación y proyectar las rutas dinámicas de picking generadas por el sistema.',
      steps: [
        'Vaya a la pestaña "Mapa del Almacén" en el menú lateral.',
        'El mapa se estructura horizontalmente en Pasillos (A, B, C, D), y verticalmente en Racks (01, 02) y niveles de repisa.',
        'Cada celda del mapa está coloreada dinámicamente según su estatus: Gris para ubicaciones vacías (Empty), Azul para cargas parciales (Partial), y Naranja/Púrpura para celdas con capacidad máxima de stock (Full).',
        'Haga clic en cualquier celda individual del mapa para abrir el panel lateral de detalles de la coordenada.',
        'El panel detallará el SKU almacenado, la cantidad exacta de piezas, el peso actual soportado y los botones para editar directamente las coordenadas en Supabase.',
        'Cuando se calcula una ruta de picking de salida, el mapa proyecta una línea verde intermitente señalando la secuencia exacta que debe seguir el recolector.'
      ],
      fields: [
        { name: 'Coordenada del Almacén', description: 'Representación en cuadrícula indexada que evita búsquedas físicas aleatorias.' },
        { name: 'Estado de Capacidad', description: 'Indicador visual que cambia de color dinámicamente según la cantidad de unidades colocadas.' }
      ],
      bestPractices: [
        'Utilice la vista interactiva del mapa en pantallas gigantes o tabletas para que los supervisores de andén puedan guiar visualmente a los nuevos operadores.',
        'Si una celda muestra un color rojo de advertencia de sobrecarga, haga clic sobre ella en el mapa para revisar los kilogramos excedidos.'
      ]
    },
    {
      id: 'crew',
      title: 'Registro de Personal (En Configuración)',
      category: 'soporte',
      icon: UserCheck,
      summary: 'Consola de control de perfiles operativos, inicio de sesión digital rápido y preferencias de retroalimentación de notificaciones del sistema integrada en el módulo de Configuración.',
      objective: 'Controlar de forma centralizada los usuarios activos que operan el WMS y configurar el canal de avisos en tiempo real.',
      steps: [
        'Vaya a la pestaña "Configuración" (última opción al fondo de la barra lateral izquierda) y seleccione la pestaña "Registro de Personal".',
        'El sistema mostrará una lista de operadores logísticos precargados (ej: Alex Mercer, Sarah Jenkins, Marcus Chen, Elena Rostova) con sus respectivos roles (Operador Putaway, Supervisor WMS, Auditor de Calidad).',
        'Haga clic en "Iniciar Sesión" sobre el operador que está utilizando el dispositivo actualmente. El perfil activo se reflejará en el encabezado general del WMS.',
        'En la parte inferior, encontrará el selector de "Canal de Notificaciones Preferido".',
        'Seleccione entre "Notificaciones Visuales (En panel superior)", "Notificaciones Toast (Emergentes temporales)", o "Ambos Canales simultáneos". El sistema persistirá esta preferencia automáticamente.'
      ],
      fields: [
        { name: 'Perfil de Operador', description: 'Registro inmutable del nombre del empleado responsable de la firma digital de operaciones.' },
        { name: 'Canal de Notificación', description: 'Configura el nivel de interrupción de los avisos y alertas operativas en el navegador.' }
      ],
      bestPractices: [
        'Cada operario debe cerrar su sesión al final de su jornada laboral para evitar que sus credenciales se utilicen por error en auditorías o movimientos internos.',
        'Como supervisor, configure siempre las notificaciones en modo "Ambos" para recibir alertas inmediatas de sobrepeso estructural.'
      ]
    },
    {
      id: 'inventory',
      title: 'Registro de SKU (Catálogo de Artículos)',
      category: 'soporte',
      icon: Package,
      summary: 'Base de datos maestra que regula las propiedades físicas, volumétricas y comerciales de todos los artículos autorizados en el almacén.',
      objective: 'Mantener un catálogo actualizado y robusto con las dimensiones y pesos unitarios de los SKUs, los cuales alimentan los algoritmos de volumetría y Putaway Optimizado.',
      steps: [
        'Vaya a la pestaña "Registro de SKU" en el menú principal.',
        'El listado despliega todos los artículos con sus imágenes en miniatura, cantidad disponible, stock de seguridad y códigos de barras correspondientes.',
        'Para dar de alta un nuevo producto, haga clic en "Registrar Nuevo SKU". Complete el formulario detallando SKU, Nombre, Categoría, Dimensiones (Ancho, Alto, Largo) en centímetros, Peso en kilogramos, Costo unitario, Proveedor y Código de barras de fábrica.',
        'Para ajustar el stock de un producto directamente, use los controles de cantidad rápidos (+ / -).',
        'Para editar las dimensiones físicas o los límites mínimos, haga clic en el botón de edición rápida (icono de lápiz) en la tarjeta del producto.'
      ],
      fields: [
        { name: 'SKU (Stock Keeping Unit)', description: 'Código alfanumérico identificador único del artículo (ej: ROB-CPU-i7).' },
        { name: 'Stock Mínimo (Min Qty)', description: 'Umbral de seguridad por debajo del cual el sistema disparará una alarma visual de reabastecimiento en el dashboard.' },
        { name: 'Peso Unitario (Weight)', description: 'Peso físico del artículo (en kilogramos) utilizado para calcular la resistencia de las estanterías.' }
      ],
      bestPractices: [
        'Asegúrese de introducir el peso unitario exacto en kilogramos; un error en este campo inhabilitará las alertas automáticas de sobrepeso estructural en las estanterías.',
        'Utilice nomenclaturas estándar para los SKUs (ej: CATEGORIA-TIPO-TAMAÑO) para facilitar la búsqueda rápida.'
      ]
    },
    {
      id: 'etiquetas',
      title: 'Estación de Etiquetas',
      category: 'soporte',
      icon: Printer,
      summary: 'Herramienta de maquetación y generación de etiquetas industriales para productos y ubicaciones físicas.',
      objective: 'Generar archivos listos para impresión física con códigos de barra de alta precisión (estándares EAN-13 y Code 128) para rotular cajas, empaques y productos recibidos.',
      steps: [
        'Vaya a la pestaña "Estación de Etiquetas" en la barra lateral.',
        'Seleccione el formato de etiqueta que desea imprimir (ej: Envío Grande de 4"x6", Estándar de Almacén de 4"x3", o Código de Producto Mediana de 3"x2").',
        'Seleccione el SKU del producto que desea rotular del menú desplegable.',
        'El sistema generará dinámicamente un diseño de etiqueta que incluye: Código de barras legible por lectores láser, SKU, Nombre descriptivo del producto, Proveedor asignado, Peso en kg, y fecha de empaque.',
        'Haga clic en el botón "Imprimir Etiqueta actual".',
        'El sistema activará el cuadro de diálogo de impresión del sistema operativo con una hoja de estilos (CSS `@media print`) optimizada que elimina menús y bordes innecesarios, dejando únicamente la etiqueta perfectamente encuadrada.'
      ],
      fields: [
        { name: 'Dimensiones de Impresión', description: 'Formatos estándar de etiquetas autoadhesivas en pulgadas.' },
        { name: 'Code 128 / EAN-13', description: 'Simulación del patrón óptimo de barras negras y blancas para lectores ópticos.' }
      ],
      bestPractices: [
        'Verifique que su impresora térmica de etiquetas esté configurada en las mismas dimensiones físicas (pulgadas) que las seleccionadas en el sistema.',
        'Limpie regularmente el cabezal térmico de su impresora de etiquetas para evitar líneas en blanco que impidan la lectura de los códigos de barra.'
      ]
    },
    {
      id: 'alertas',
      title: 'Gestor de Alertas Operativas',
      category: 'soporte',
      icon: ShieldAlert,
      summary: 'Módulo de diseño y programación de alertas logísticas en tiempo real para control de existencias, sobrepeso en celdas, saturación de volumen y caducidades.',
      objective: 'Facilitar a los supervisores la configuración personalizada de condiciones de alerta, habilitando acciones oportunas y evitando fallas estructurales o desabasto.',
      steps: [
        'Vaya a la pestaña "Gestión de Alertas" en el menú de Soporte y Monitoreo.',
        'En la columna izquierda, visualice el formulario para crear o editar una alerta. Defina el nombre de la alerta y seleccione el tipo de condición (Stock Mínimo, Resistencia Peso, Capacidad Volumen, Vencimiento del Lote o Mensaje Manual).',
        'Asigne el SKU del artículo o la celda correspondiente, defina el umbral numérico límite de disparo, configure el nivel de criticidad/severidad (Baja, Media, Alta, Crítica) y redacte una instrucción clara para los operadores.',
        'Use la columna derecha para ver las "Alertas Disparadas" activas en tiempo real basadas en la información actual de celdas e inventario, o examine el listado de alertas programadas.',
        'Habilite, deshabilite o elimine las alertas utilizando los botones rápidos de control.'
      ],
      fields: [
        { name: 'Tipo de Condición', description: 'El algoritmo lógico que el sistema correrá constantemente para detectar anomalías físicas o de stock.' },
        { name: 'Límite de Carga / Umbral', description: 'El valor numérico clave (kilogramos, unidades, porcentaje o días) que detona la alerta al ser rebasado.' },
        { name: 'Nivel de Criticidad', description: 'Escala de urgencia (low, medium, high, critical) que colorea y clasifica la prioridad de atención.' }
      ],
      bestPractices: [
        'Mantenga activas las alertas de resistencia estructural en celdas de niveles altos (L2/L3) para salvaguardar la integridad de los racks.',
        'Asigne instrucciones sumamente detalladas y llanas para que cualquier operador sepa de inmediato qué acción de contingencia tomar.'
      ]
    },
    {
      id: 'configuracion',
      title: 'Configuración: Imagen, Colores, Personal y Manual',
      category: 'soporte',
      icon: Settings,
      summary: 'Módulo central ubicado como la última opción de la barra lateral izquierda que agrupa la personalización de imagen y colores de la plataforma, el registro de personal operativo y el manual de usuarios.',
      objective: 'Centralizar en un solo lugar la administración estética del WMS (logo, colores y branding), la gestión de operarios y turnos, y la consulta de manuales.',
      steps: [
        'Haga clic en la última opción de la barra lateral izquierda: "Configuración" (ubicada justo debajo de "Centro de Reportes", que es la penúltima opción).',
        'En la parte superior de Configuración verá 3 pestañas principales: "Apariencia y Colores", "Registro de Personal", y "Manual de Usuario".',
        'En "Apariencia y Colores": suba el logotipo o imagen corporativa (PNG, SVG, JPG), personalice el color primario y el color de fondo de la barra lateral, y guarde los cambios en tiempo real.',
        'En "Registro de Personal": gestione miembros del equipo, roles, contraseñas PIN, catálogo de posiciones y parámetros de terminales RF.',
        'En "Manual de Usuario": acceda al buscador general y procedimientos detallados de cada módulo del WMS.'
      ],
      fields: [
        { name: 'Logotipo de Plataforma', description: 'Imagen corporativa que se renderiza en la barra superior del sistema.' },
        { name: 'Color Primario', description: 'Color principal que tiñe los botones activos, resaltados, gráficas e indicadores.' },
        { name: 'Color Barra Lateral', description: 'Tono oscuro o corporativo de fondo del menú de opciones.' }
      ],
      bestPractices: [
        'Utilice imágenes con fondo transparente (formato PNG o SVG) para una integración visual óptima.',
        'Seleccione un color de acento de alto contraste para garantizar que los operadores identifiquen los botones de acción inmediata en pantallas táctiles o terminales móviles.'
      ]
    }
  ];

  const filteredSections = sections.filter(sec =>
    sec.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sec.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sec.objective.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeSection = sections.find(s => s.id === selectedSectionId) || sections[0];

  return (
    <div className="space-y-6 animate-fadeIn font-sans" id="user-manual-root">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 md:p-8 rounded-3xl border border-slate-950 shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2 relative z-10">
          <span className="bg-blue-500/20 text-blue-400 font-mono text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-blue-500/20">
            Centro de Documentación Oficial
          </span>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight font-sans flex items-center gap-2.5">
            <BookOpen className="h-8 w-8 text-blue-500 bg-blue-950 p-1.5 rounded-xl border border-blue-900/50" />
            Manual de Usuario WMS
          </h2>
          <p className="text-xs text-slate-400 max-w-xl font-medium leading-relaxed">
            Bienvenido al manual integral de operación paso a paso de la plataforma WMS (Warehouse Management System). 
            Consulte las guías y flujos lógicos detallados de cada herramienta para capacitar al personal y garantizar la eficiencia.
          </p>
        </div>

        {/* Live Search Input */}
        <div className="w-full md:w-80 relative z-10 shrink-0">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar sección o herramienta..."
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium focus:outline-none focus:border-blue-500 transition-colors"
            />
            <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-500" />
          </div>
        </div>

        {/* Decorative Grid Mesh */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-5 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Navigation Sidebar Card */}
        <div className="xl:col-span-1 bg-white border border-slate-200/60 rounded-2xl shadow-xs p-4 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
              Indice de Herramientas
            </h3>
            <p className="text-[9px] text-slate-400 mt-0.5 font-medium">Seleccione un módulo para detallar</p>
          </div>

          <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
            {filteredSections.map(sec => {
              const Icon = sec.icon;
              const isSelected = sec.id === selectedSectionId;
              let catBadgeColor = 'bg-slate-50 text-slate-600';
              if (sec.category === 'operacion') catBadgeColor = 'bg-blue-50 text-blue-600';
              if (sec.category === 'analisis') catBadgeColor = 'bg-emerald-50 text-emerald-600';

              return (
                <button
                  key={sec.id}
                  onClick={() => setSelectedSectionId(sec.id)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition cursor-pointer select-none group ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Icon className={`h-4.5 w-4.5 shrink-0 ${isSelected ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-700'}`} />
                    <span className="truncate">{sec.title}</span>
                  </div>
                  <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${
                    isSelected ? 'text-white transform translate-x-0.5' : 'text-slate-300 group-hover:text-slate-500'
                  }`} />
                </button>
              );
            })}

            {filteredSections.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-xs italic">
                No se encontraron coincidencias para "{searchTerm}"
              </div>
            )}
          </div>

          {/* Quick Stats Block inside user manual */}
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-3.5 space-y-2">
            <span className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-widest block">
              Estatus del Manual
            </span>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span>Capítulos Totales:</span>
              <span className="font-mono text-slate-800 font-bold bg-white border border-slate-200/50 px-1.5 py-0.5 rounded">
                {sections.length}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span>Versión de Guías:</span>
              <span className="font-mono text-slate-800 font-bold bg-white border border-slate-200/50 px-1.5 py-0.5 rounded">
                v2.6.4-prod
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span>Última Revisión:</span>
              <span className="font-mono text-blue-600 font-bold bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                Hoy UTC
              </span>
            </div>
          </div>
        </div>

        {/* Documentation Content Viewport */}
        <div className="xl:col-span-3 space-y-6">
          {/* Main Chapter Card */}
          <div className="bg-white border border-slate-200/60 rounded-2xl shadow-xs p-6 md:p-8 space-y-6">
            
            {/* Header section info */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
                  {(() => {
                    const ActiveIcon = activeSection.icon;
                    return <ActiveIcon className="h-6 w-6" />;
                  })()}
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight font-sans">
                    {activeSection.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Guía de uso oficial, flujos del sistema, campos técnicos y directrices.
                  </p>
                </div>
              </div>

              {/* Category Badge */}
              <span className={`text-[9px] font-mono font-black uppercase tracking-widest px-3 py-1 rounded-full border shrink-0 ${
                activeSection.category === 'operacion'
                  ? 'bg-blue-50 text-blue-600 border-blue-100'
                  : activeSection.category === 'analisis'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : 'bg-indigo-50 text-indigo-600 border-indigo-100'
              }`}>
                {activeSection.category === 'operacion' ? 'Operación Crítica' : activeSection.category === 'analisis' ? 'Análisis & Reportes' : 'Soporte Técnico'}
              </span>
            </div>

            {/* Summary Block */}
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed font-semibold">
              <strong className="text-slate-800 block mb-1">Resumen del Módulo:</strong>
              {activeSection.summary}
            </div>

            {/* Objective */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <CheckCircle className="h-4.5 w-4.5 text-blue-500" />
                Objetivo Operativo
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium pl-6">
                {activeSection.objective}
              </p>
            </div>

            {/* Step-by-Step Flow */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <Clock className="h-4.5 w-4.5 text-slate-500" />
                Flujo del Operador Paso a Paso
              </h4>
              
              <div className="relative pl-6 border-l border-slate-200 ml-2.5 space-y-4">
                {activeSection.steps.map((step, idx) => (
                  <div key={idx} className="relative group">
                    {/* Circle Index */}
                    <span className="absolute -left-[31px] top-0 h-[21px] w-[21px] bg-slate-900 text-white rounded-full flex items-center justify-center font-mono text-[10px] font-bold border border-white">
                      {idx + 1}
                    </span>
                    <p className="text-xs text-slate-600 font-semibold leading-relaxed pt-0.5">
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Database properties detailed */}
            <div className="space-y-3.5 border-t border-slate-100 pt-5">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <Database className="h-4.5 w-4.5 text-blue-500" />
                Propiedades y Campos de Datos Clave
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pl-1">
                {activeSection.fields.map((field, idx) => (
                  <div key={idx} className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-150">
                    <span className="font-mono font-bold text-[11px] text-slate-800 block truncate mb-1">
                      {field.name}
                    </span>
                    <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                      {field.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Best practices list */}
            <div className="space-y-3 border-t border-slate-100 pt-5">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <Lightbulb className="h-4.5 w-4.5 text-amber-500 animate-pulse" />
                Buenas Prácticas de Almacenamiento y Seguridad
              </h4>
              
              <ul className="space-y-2 pl-1">
                {activeSection.bestPractices.map((bp, idx) => (
                  <li key={idx} className="text-xs text-slate-500 leading-relaxed font-medium flex items-start gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>
                    <span>{bp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Simulation Warning Note */}
            {activeSection.simulationNote && (
              <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl text-xs text-emerald-800 flex items-start gap-3 mt-4">
                <Play className="h-5 w-5 text-emerald-500 shrink-0 fill-emerald-500 mt-0.5" />
                <div className="space-y-1">
                  <strong className="font-bold block uppercase tracking-wider text-[10px] font-mono">Entorno de Simulación Integrado:</strong>
                  <p className="font-medium leading-relaxed">{activeSection.simulationNote}</p>
                </div>
              </div>
            )}

          </div>

          {/* Quick FAQ card */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-950 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-1">
              <h4 className="text-xs font-black text-blue-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <HelpCircle className="h-4.5 w-4.5" />
                ¿Necesita Soporte Logístico Adicional?
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-xl font-medium">
                Consulte las guías y flujos de trabajo documentados en este manual de usuario o contacte a un supervisor del almacén para aclarar cualquier duda operativa.
              </p>
            </div>
            <div className="text-[10px] font-mono text-slate-500 self-end md:self-auto uppercase tracking-widest font-black shrink-0">
              © WMS Control System Docs
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
