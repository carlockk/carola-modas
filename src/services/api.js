import axios from 'axios';

export const LOCAL_REQUIRED_EVENT = 'app:local-required';
export const SESSION_EXPIRED_EVENT = 'app:session-expired';

// ✅ Resolver base de API y base de archivos a partir de la variable de entorno
const rawBase = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api';

// Normalizamos para que SIEMPRE tenga /api al final
const API_BASE = rawBase.endsWith('/api')
  ? rawBase
  : `${rawBase.replace(/\/+$/, '')}/api`;

// Base para archivos estáticos (/uploads), sin /api
export const FILES_BASE = API_BASE.replace(/\/api\/?$/, '');

// Instancia base de la API usando la URL normalizada
const API = axios.create({
  baseURL: API_BASE,
});

let lastLocalRequiredNoticeAt = 0;

const buildFallbackDataByUrl = (url = '') => {
  const lower = String(url).toLowerCase();

  if (lower.includes('/ventas/resumen-rango')) {
    return {
      total: 0,
      cantidad: 0,
      porTipoPago: {},
      porTipoProducto: {},
      porProducto: [],
      totalesPorCanal: {
        POS: { total: 0, cantidad: 0 },
        WEB: { total: 0, cantidad: 0 },
      },
      porTipoPagoDetallado: {
        POS: {},
        WEB: {},
      },
    };
  }

  if (
    lower.includes('/caja/historial') ||
    lower.includes('/categorias') ||
    lower.includes('/productos') ||
    lower.includes('/agregados')
  ) {
    return [];
  }

  return null;
};

API.interceptors.request.use((config) => {
  const stored = localStorage.getItem('usuario');
  const storedLocal = localStorage.getItem('localSeleccionado');

  let token = '';
  let role = '';
  let localId = '';

  if (stored) {
    try {
      const usuario = JSON.parse(stored);
      token = typeof usuario?.token === 'string' ? usuario.token : '';
      role = typeof usuario?.rol === 'string' ? usuario.rol : '';
      if (role && role !== 'superadmin') {
        localId = typeof usuario?.local === 'string' ? usuario.local : (usuario?.local?._id || '');
      } else if (storedLocal) {
        const localParsed = JSON.parse(storedLocal);
        localId = typeof localParsed === 'string' ? localParsed : (localParsed?._id || '');
      }
    } catch (err) {
      // ignore parse errors
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const hasLocalHeader =
    config?.headers &&
    (config.headers['x-local-id'] || config.headers['X-Local-Id']);
  if (localId && role === 'superadmin' && !hasLocalHeader) {
    config.headers['x-local-id'] = localId;
  }

  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url || '');
    const backendMessage = String(error?.response?.data?.error || '').toLowerCase();
    const isLocalRequired = status === 400 && backendMessage.includes('local requerido');
    const method = String(error?.config?.method || '').toLowerCase();

    if (status === 401 && !url.includes('/auth/login') && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(SESSION_EXPIRED_EVENT, {
          detail: { message: 'Tu sesion expiro. Inicia sesion nuevamente.' },
        })
      );
    }

    if (isLocalRequired && typeof window !== 'undefined') {
      const now = Date.now();
      if (now - lastLocalRequiredNoticeAt > 2500) {
        lastLocalRequiredNoticeAt = now;
        window.dispatchEvent(
          new CustomEvent(LOCAL_REQUIRED_EVENT, {
            detail: { message: 'Debes seleccionar un local para continuar.' },
          })
        );
      }
    }

    if (isLocalRequired && method === 'get') {
      const fallbackData = buildFallbackDataByUrl(url);
      if (fallbackData !== null) {
        return Promise.resolve({
          data: fallbackData,
          status: 200,
          statusText: 'OK',
          headers: error?.response?.headers || {},
          config: error?.config || {},
        });
      }
    }

    return Promise.reject(error);
  }
);

// ─────────────────────────────────────────────
// 🛍️ Productos
// ─────────────────────────────────────────────
export const obtenerProductos = () => API.get('/productos');
export const obtenerProductosBase = () => API.get('/productos/base');

export const crearProducto = (data) =>
  API.post('/productos', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const crearProductoBase = (data) =>
  API.post('/productos/base', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const usarProductoBaseEnLocal = (baseId, data, localId) =>
  API.post(`/productos/local/use-base/${baseId}`, data, {
    ...(localId ? { headers: { 'x-local-id': localId } } : {}),
  });

export const eliminarProducto = (id) => API.delete(`/productos/${id}`);

export const obtenerProductoPorId = (id) => API.get(`/productos/${id}`);

export const editarProducto = (id, data) =>
  API.put(`/productos/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// ─────────────────────────────────────────────
// ➕ Agregados
// ─────────────────────────────────────────────
export const obtenerAgregados = (localId) =>
  API.get('/agregados', {
    ...(localId ? { headers: { 'x-local-id': localId } } : {}),
  });
export const crearAgregado = (data) => API.post('/agregados', data);
export const editarAgregado = (id, data) => API.put(`/agregados/${id}`, data);
export const eliminarAgregado = (id) => API.delete(`/agregados/${id}`);
export const obtenerOpcionesAgregados = () => API.get('/agregados/opciones');
export const obtenerGruposAgregados = () => API.get('/agregados/grupos');
export const crearGrupoAgregados = (data) => API.post('/agregados/grupos', data);
export const editarGrupoAgregados = (id, data) => API.put(`/agregados/grupos/${id}`, data);
export const eliminarGrupoAgregados = (id) => API.delete(`/agregados/grupos/${id}`);
export const clonarAgregados = (data) => API.post('/agregados/clonar', data);

// ─────────────────────────────────────────────
// 💸 Ventas
// ─────────────────────────────────────────────
export const registrarVenta = (data) => API.post('/ventas', data);

export const obtenerVentas = (params) => API.get('/ventas', { params });

export const registrarDevolucion = (ventaId, data) =>
  API.post(`/ventas/${ventaId}/devoluciones`, data);

export const obtenerDescuentos = (soloActivos = false) =>
  API.get('/descuentos', { params: soloActivos ? { activos: true } : {} });
export const crearDescuento = (data) => API.post('/descuentos', data);
export const editarDescuento = (id, data) => API.put(`/descuentos/${id}`, data);
export const eliminarDescuento = (id) => API.delete(`/descuentos/${id}`);

export const obtenerResumenPorFecha = (fecha) =>
  API.get('/ventas/resumen', { params: { fecha } });

export const obtenerResumenPorRango = (inicio, fin) =>
  API.get('/ventas/resumen-rango', { params: { inicio, fin } });

// ─────────────────────────────────────────────
// 👤 Usuarios
// ─────────────────────────────────────────────
export const loginUsuario = (data) => API.post('/auth/login', data);

export const crearUsuario = (data) => API.post('/usuarios', data);

export const obtenerUsuarios = () => API.get('/usuarios');

export const eliminarUsuario = (id) => API.delete(`/usuarios/${id}`);

export const editarUsuario = (id, data) => API.put(`/usuarios/${id}`, data);

// ─────────────────────────────────────────────
// 💼 Caja
// ─────────────────────────────────────────────
export const abrirCaja = (data) => API.post('/caja/abrir', data);
export const cerrarCaja = (data = {}) => API.post('/caja/cerrar', data);
export const obtenerHistorialCaja = () => API.get('/caja/historial');

// ─────────────────────────────────────────────
// 📁 Categorías
// ─────────────────────────────────────────────
export const obtenerCategorias = (localId) =>
  API.get('/categorias', {
    ...(localId ? { headers: { 'x-local-id': localId } } : {}),
  });
export const crearCategoria = (data) => API.post('/categorias', data);
export const editarCategoria = (id, data) => API.put(`/categorias/${id}`, data);
export const eliminarCategoria = (id) => API.delete(`/categorias/${id}`);
export const clonarCategorias = (data) => API.post('/categorias/clonar', data);

// ─────────────────────────────────────────────
// 🧾 Tickets Abiertos
// ─────────────────────────────────────────────
export const guardarTicket = (data) => API.post('/tickets', data);
export const obtenerTicketsAbiertos = () => API.get('/tickets');
export const eliminarTicket = (id) => API.delete(`/tickets/${id}`);

// ─────────────────────────────────────────────
// 🧪 Insumos
// ─────────────────────────────────────────────
export const obtenerInsumos = (params) => API.get('/insumos', { params });
export const crearInsumo = (data) => API.post('/insumos', data);
export const editarInsumo = (id, data) => API.put(`/insumos/${id}`, data);
export const eliminarInsumo = (id) => API.delete(`/insumos/${id}`);
export const eliminarInsumosMasivo = (data) => API.delete('/insumos', { data });
export const actualizarEstadoInsumo = (id, data) => API.put(`/insumos/${id}/estado`, data);
export const actualizarNotaInsumo = (id, data) => API.put(`/insumos/${id}/nota`, data);
export const obtenerObservacionesInsumo = (id) => API.get(`/insumos/${id}/observaciones`);
export const crearObservacionInsumo = (id, data) => API.post(`/insumos/${id}/observaciones`, data);
export const editarObservacionInsumo = (id, obsId, data) =>
  API.put(`/insumos/${id}/observaciones/${obsId}`, data);
export const eliminarObservacionInsumo = (id, obsId) =>
  API.delete(`/insumos/${id}/observaciones/${obsId}`);
export const clonarInsumos = (data) => API.post('/insumos/clonar', data);
export const importarProductosABodega = (data) => API.post('/insumos/importar-productos', data);
export const actualizarOrdenInsumos = (data) => API.put('/insumos/orden', data);
export const moverCategoriaInsumos = (data) => API.put('/insumos/categoria-masiva', data);
export const obtenerCategoriasInsumo = () => API.get('/insumo-categorias');
export const crearCategoriaInsumo = (data) => API.post('/insumo-categorias', data);
export const editarCategoriaInsumo = (id, data) => API.put(`/insumo-categorias/${id}`, data);
export const eliminarCategoriaInsumo = (id) => API.delete(`/insumo-categorias/${id}`);
export const actualizarOrdenCategoriasInsumo = (data) =>
  API.put('/insumo-categorias/orden', data);
export const obtenerLotesInsumo = (id, params) =>
  API.get(`/insumos/${id}/lotes`, { params });
export const eliminarLoteInsumo = (insumoId, loteId) =>
  API.delete(`/insumos/${insumoId}/lotes/${loteId}`);
export const eliminarLotesInsumo = (insumoId) =>
  API.delete(`/insumos/${insumoId}/lotes`);
export const actualizarEstadoLoteInsumo = (insumoId, loteId, data) =>
  API.put(`/insumos/${insumoId}/lotes/${loteId}/estado`, data);
export const crearLoteInsumo = (insumoId, data) =>
  API.post(`/insumos/${insumoId}/lotes`, data);
export const obtenerMovimientosInsumo = (id) => API.get(`/insumos/${id}/movimientos`);
export const obtenerMovimientosInsumos = (params) =>
  API.get('/insumos/movimientos', { params });
export const registrarMovimientoInsumo = (id, data) =>
  API.post(`/insumos/${id}/movimientos`, data);
export const eliminarMovimientoInsumo = (id) => API.delete(`/insumos/movimientos/${id}`);
export const eliminarMovimientosInsumos = (params) =>
  API.delete('/insumos/movimientos', { params });
export const obtenerConfigAlertasInsumos = () => API.get('/insumos/alertas/config');
export const guardarConfigAlertasInsumos = (data) => API.put('/insumos/alertas/config', data);
export const enviarResumenAlertasInsumos = () => API.post('/insumos/alertas/resumen');

// ─────────────────────────────────────────────
// 🧾 Configuracion de recibos
// ─────────────────────────────────────────────
export const obtenerConfigRecibo = () => API.get('/recibo-config');
export const guardarConfigRecibo = (data) =>
  API.put('/recibo-config', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });


// ─────────────────────────────────────────────
// 🌐 Configuracion social
// ─────────────────────────────────────────────
export const obtenerConfigSocial = () => API.get('/social-config');
export const guardarConfigSocial = (data) => API.put('/social-config', data);
export const clonarConfigSocial = (data) => API.post('/social-config/clonar', data);
export const guardarLogoWebCliente = (data) =>
  API.put('/social-config/logo', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
// ─────────────────────────────────────────────
// 🏬 Locales
// ─────────────────────────────────────────────
export const obtenerLocales = () => API.get('/locales');
export const crearLocal = (data) => API.post('/locales', data);
export const editarLocal = (id, data) => API.put(`/locales/${id}`, data);
export const eliminarLocal = (id) => API.delete(`/locales/${id}`);

// ─────────────────────────────────────────────
// 🌐 Pedidos Web (cliente)
// ─────────────────────────────────────────────
export const obtenerPedidosWeb = (params) => API.get('/ventasCliente/local/pedidos', { params });
export const obtenerEstadosPedidoWeb = () => API.get('/ventasCliente/local/estados');
export const obtenerEstadosRepartidorPedidoWeb = () => API.get('/ventasCliente/local/estados-repartidor');
export const guardarEstadosRepartidorPedidoWeb = (estados) =>
  API.put('/ventasCliente/local/estados-repartidor', { estados });
export const crearEstadoPedidoWeb = (data) => API.post('/ventasCliente/local/estados', data);
export const editarEstadoPedidoWeb = (estadoActual, data) =>
  API.put(`/ventasCliente/local/estados/${encodeURIComponent(estadoActual)}`, data);
export const eliminarEstadoPedidoWeb = (estado) =>
  API.delete(`/ventasCliente/local/estados/${encodeURIComponent(estado)}`);
export const actualizarEstadoPedidoWeb = (id, data) => API.patch(`/ventasCliente/local/pedidos/${id}/estado`, data);
export const obtenerRepartidoresPedidoWeb = () => API.get('/ventasCliente/local/repartidores');
export const asignarRepartidorPedidoWeb = (id, repartidor_id) =>
  API.patch(`/ventasCliente/local/pedidos/${id}/repartidor`, { repartidor_id });






export const eliminarPedidoWeb = (id) => API.delete('/ventasCliente/local/pedidos/' + id);

// ─────────────────────────────────────────────
// 🍽️ Restaurante
// ─────────────────────────────────────────────
export const obtenerMesasRestaurante = () => API.get('/restaurante/mesas');
export const obtenerProductosRestaurante = () => API.get('/restaurante/productos');
export const crearMesaRestaurante = (data) => API.post('/restaurante/mesas', data);
export const obtenerMeserosRestaurante = () => API.get('/restaurante/meseros');
export const actualizarEstadoMesaRestaurante = (id, data) =>
  API.patch(`/restaurante/mesas/${id}/estado`, data);
export const editarMesaRestaurante = (id, data) => API.put(`/restaurante/mesas/${id}`, data);
export const eliminarMesaRestaurante = (id) => API.delete(`/restaurante/mesas/${id}`);
export const tomarMesaRestaurante = (id) => API.post(`/restaurante/mesas/${id}/tomar`);
export const liberarMesaRestaurante = (id) => API.post(`/restaurante/mesas/${id}/liberar`);
export const transferirMesaRestaurante = (id, data) => API.post(`/restaurante/mesas/${id}/transferir`, data);
export const obtenerComandasRestaurante = (params) =>
  API.get('/restaurante/comandas', { params });
export const crearComandaRestaurante = (data) => API.post('/restaurante/comandas', data);
export const agregarItemsComandaRestaurante = (id, data) =>
  API.post(`/restaurante/comandas/${id}/items`, data);
export const actualizarEstadoComandaRestaurante = (id, data) =>
  API.patch(`/restaurante/comandas/${id}/estado`, data);
export const editarComandaRestaurante = (id, data) =>
  API.put(`/restaurante/comandas/${id}`, data);
export const eliminarComandaRestaurante = (id) =>
  API.delete(`/restaurante/comandas/${id}`);
export const enviarComandaACaja = (id) => API.post(`/restaurante/comandas/${id}/enviar-caja`);
export const obtenerComandasPendientesCaja = () => API.get('/restaurante/caja/pendientes');
export const cobrarComandaCaja = (id, data) => API.post(`/restaurante/caja/cobrar/${id}`, data);
export const cobrarComandaEnMesa = (id, data) => API.post(`/restaurante/comandas/${id}/cobrar-mesa`, data);
export const obtenerRendicionesPendientesCaja = () => API.get('/restaurante/caja/rendiciones-pendientes');
export const rendirCobroMesaCaja = (id) => API.post(`/restaurante/caja/rendir/${id}`);

// ─────────────────────────────────────────────
// 💳 Webpay (Transbank)
// ─────────────────────────────────────────────
export const crearSesionPagoWeb = (order) => API.post('/pagos/crear-sesion', { order });
export const confirmarSesionPagoWeb = (token_ws) => API.post('/pagos/confirmar-sesion', { token_ws });

export const redirigirAWebpay = ({ url, token }) => {
  if (!url || !token) {
    throw new Error('Datos de redireccion Webpay incompletos');
  }

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  form.style.display = 'none';

  const tokenField = document.createElement('input');
  tokenField.type = 'hidden';
  tokenField.name = 'token_ws';
  tokenField.value = token;

  form.appendChild(tokenField);
  document.body.appendChild(form);
  form.submit();
};
