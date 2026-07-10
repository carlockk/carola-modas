import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  Stack,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem
} from '@mui/material';
import { Add, Remove, Close, DeleteOutline, CheckCircle } from '@mui/icons-material';
import { useCarrito } from '../context/CarritoContext';
import { useCaja } from '../context/CajaContext';
import { registrarVenta, guardarTicket, obtenerConfigRecibo, obtenerDescuentos } from '../services/api'; // ✅ agregado
import { useEffect, useRef, useState } from 'react';
import ModalPago from './ModalPago';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { useAuth } from '../context/AuthContext';

const formatCLP = (valor) => `$${Number(valor || 0).toLocaleString('es-CL')}`;

function ReciboPOSPrint({ venta, config }) {
  if (!venta) return null;

  const fechaHora = venta.fecha
    ? new Date(venta.fecha).toLocaleString()
    : new Date().toLocaleString();

  return (
    <Box id="pos-print-ticket">
      {config?.logo_url && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
          <img src={config.logo_url} alt="Logo" style={{ maxWidth: 120, maxHeight: 80 }} />
        </Box>
      )}
      <Typography className="ticket-title">{config?.nombre || 'Ticket de Venta'}</Typography>
      <Typography>N° Pedido: #{String(venta.numero_pedido || '').padStart(2, '0')}</Typography>
      <Typography>{fechaHora}</Typography>
      <hr />

      {venta.productos.map((item, index) => (
        <Box key={`${item.nombre}-${index}`} sx={{ mb: 1 }}>
          <Typography>
            {item.nombre}
            {item.varianteNombre ? ` (${item.varianteNombre})` : ''} x{item.cantidad}
          </Typography>
          {Array.isArray(item.atributos) && item.atributos.length > 0 && (
            <Typography>{item.atributos.map(attr => `${attr.nombre}: ${attr.valor}`).join(' | ')}</Typography>
          )}
          {Array.isArray(item.agregados) && item.agregados.length > 0 && (
            <Typography>Agregados: {item.agregados.map((agg) => agg.nombre).join(', ')}</Typography>
          )}
          {item.observacion && <Typography>Obs: {item.observacion}</Typography>}
          {item.descuento?.nombre && (
            <Typography>
              Desc. {item.descuento.nombre}: -{formatCLP((Number(item.descuento.monto) || 0) * item.cantidad)}
            </Typography>
          )}
          <Typography>{formatCLP(item.precio_unitario)} c/u</Typography>
        </Box>
      ))}

      <hr />
      {Number(venta.descuento_total || 0) > 0 && (
        <>
          <Typography>Subtotal: {formatCLP(venta.subtotal)}</Typography>
          <Typography>Descuentos: -{formatCLP(venta.descuento_total)}</Typography>
        </>
      )}
      <Typography className="ticket-total">Total: {formatCLP(venta.total)}</Typography>
      <Typography>Pago: {venta.tipo_pago || '—'}</Typography>
      {Array.isArray(venta.pagos) && venta.pagos.length > 0 && (
        <Box>
          {venta.pagos.map((pago, index) => (
            <Typography key={`${pago.tipo}-${index}`}>
              {pago.tipo}: {formatCLP(pago.monto)}
            </Typography>
          ))}
        </Box>
      )}
      {typeof venta.monto_recibido === 'number' && (
        <Typography>Recibido: {formatCLP(venta.monto_recibido)}</Typography>
      )}
      {typeof venta.vuelto === 'number' && venta.vuelto >= 0 && (
        <Typography>Vuelto: {formatCLP(venta.vuelto)}</Typography>
      )}
      {venta.tipo_pedido && venta.tipo_pedido !== '—' && (
        <Typography>Pedido: {venta.tipo_pedido}</Typography>
      )}
      {config?.pie && (
        <>
          <hr />
          <Typography>{config.pie}</Typography>
        </>
      )}
    </Box>
  );
}

export default function CarritoDrawer({ open, onClose, onVentaCompletada, desktopWidth = 360 }) {
  const {
    carrito,
    actualizarCantidad,
    actualizarObservacion,
    actualizarItemCarrito,
    eliminarProducto,
    vaciarCarrito,
    descuentoVenta,
    actualizarDescuentoVenta
  } = useCarrito();
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [ticketNombre, setTicketNombre] = useState(''); // ✅ nombre del ticket
  const [dragState, setDragState] = useState(null);
  const [itemEditando, setItemEditando] = useState(null);
  const [editObservacion, setEditObservacion] = useState('');
  const [editAgregados, setEditAgregados] = useState([]);
  const [editVariante, setEditVariante] = useState(null);
  const [editDescuento, setEditDescuento] = useState(null);
  const [manualVentaTipo, setManualVentaTipo] = useState('fijo');
  const [manualVentaValor, setManualVentaValor] = useState('');
  const [editManualTipo, setEditManualTipo] = useState('fijo');
  const [editManualValor, setEditManualValor] = useState('');
  const [descuentos, setDescuentos] = useState([]);
  const [ultimaVenta, setUltimaVenta] = useState(null);
  const [configRecibo, setConfigRecibo] = useState(null);
  const [observacionesAbiertas, setObservacionesAbiertas] = useState({});
  const [descuentoVentaAbierto, setDescuentoVentaAbierto] = useState(false);
  const [guardarTicketAbierto, setGuardarTicketAbierto] = useState(false);
  const ventaImpresaRef = useRef(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { cajaAbierta, cajaVerificada } = useCaja();
  const { selectedLocal } = useAuth();

  const calcularMontoDescuento = (base, descuento) => {
    const montoBase = Math.max(0, Math.round(Number(base) || 0));
    if (!descuento) return 0;
    const valor = Number(descuento.valor) || 0;
    const calculado = descuento.tipo === 'porcentaje'
      ? Math.round(montoBase * Math.min(Math.max(valor, 0), 100) / 100)
      : Math.round(Math.max(valor, 0));
    return Math.min(montoBase, calculado);
  };
  const subtotal = carrito.reduce((sum, p) => sum + (Number(p.precio) || 0) * p.cantidad, 0);
  const descuentoProductos = carrito.reduce((sum, p) =>
    sum + calcularMontoDescuento(p.precio, p.descuento) * p.cantidad, 0);
  const subtotalTrasProductos = Math.max(0, subtotal - descuentoProductos);
  const descuentoGeneral = calcularMontoDescuento(subtotalTrasProductos, descuentoVenta);
  const descuentoTotal = descuentoProductos + descuentoGeneral;
  const total = Math.max(0, subtotal - descuentoTotal);
  const cajaDisponible = cajaAbierta === true;
  const SWIPE_DELETE_THRESHOLD = -72;
  const agregadosEditables =
    Array.isArray(itemEditando?.agregadosDisponibles) && itemEditando.agregadosDisponibles.length > 0
      ? itemEditando.agregadosDisponibles
      : (Array.isArray(itemEditando?.agregados) ? itemEditando.agregados : []);
  const variantesEditables =
    Array.isArray(itemEditando?.variantesDisponibles) && itemEditando.variantesDisponibles.length > 0
      ? itemEditando.variantesDisponibles
      : [];

  const normalizarStockVariante = (valor) => {
    if (valor === null || valor === undefined || valor === '') return null;
    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= 0 ? numero : null;
  };

  const varianteEstaAgotada = (variante) => {
    const stock = normalizarStockVariante(variante?.stock);
    return Boolean(variante?.agotado) || stock === 0;
  };

  const crearDescuentoManual = (tipo, valor, nombre = 'Descuento manual') => {
    const tipoNormalizado = tipo === 'porcentaje' ? 'porcentaje' : 'fijo';
    const valorNumerico = Number(valor);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return null;
    return {
      descuentoId: null,
      nombre,
      tipo: tipoNormalizado,
      valor: tipoNormalizado === 'porcentaje'
        ? Math.min(Math.max(valorNumerico, 0), 100)
        : Math.round(Math.max(valorNumerico, 0)),
      manual: true
    };
  };

  const toggleObservacion = (itemId) => {
    setObservacionesAbiertas((prev) => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  useEffect(() => {
    const cargarConfigRecibo = async () => {
      try {
        const res = await obtenerConfigRecibo();
        setConfigRecibo(res.data);
      } catch {
        setConfigRecibo({ nombre: 'Ticket de Venta', copias_auto: 1 });
      }
    };
    cargarConfigRecibo();
  }, []);

  useEffect(() => {
    const cargarDescuentos = async () => {
      try {
        const res = await obtenerDescuentos(true);
        setDescuentos(Array.isArray(res.data) ? res.data : []);
      } catch {
        setDescuentos([]);
      }
    };
    cargarDescuentos();
  }, [selectedLocal?._id]);

  useEffect(() => {
    if (descuentoVenta && !descuentoVenta.descuentoId) {
      setManualVentaTipo(descuentoVenta.tipo === 'porcentaje' ? 'porcentaje' : 'fijo');
      setManualVentaValor(String(descuentoVenta.valor || ''));
      return;
    }
    setManualVentaTipo('fijo');
    setManualVentaValor('');
  }, [descuentoVenta]);

  useEffect(() => {
    if (descuentoVenta) setDescuentoVentaAbierto(true);
  }, [descuentoVenta]);

  useEffect(() => {
    if (!ultimaVenta || !configRecibo) return;
    const ventaKey = `${ultimaVenta.numero_pedido}-${ultimaVenta.fecha}`;
    if (ventaImpresaRef.current === ventaKey) return;
    ventaImpresaRef.current = ventaKey;

    if (configRecibo.imprimir_auto === false) return;

    const copiasRaw = Number(configRecibo.copias_auto ?? 1);
    const copias = Math.min(Math.max(Math.round(copiasRaw), 0), 5);
    if (copias <= 0) return;

    let contador = 0;
    const imprimir = () => {
      if (contador >= copias) return;
      window.print();
      contador += 1;
      if (contador < copias) {
        setTimeout(imprimir, 900);
      }
    };
    setTimeout(imprimir, 450);
  }, [ultimaVenta, configRecibo]);

  const imprimirUltimaVenta = () => {
    if (!ultimaVenta) return;
    setTimeout(() => window.print(), 100);
  };

  const iniciarNuevaVenta = () => {
    setUltimaVenta(null);
    ventaImpresaRef.current = null;
    onClose();
  };

  const getDragOffset = (itemId) =>
    dragState?.id === itemId ? dragState.offsetX : 0;

  const iniciarArrastre = (event, itemId) => {
    const target = event.target;
    if (target.closest('input, textarea, button')) return;
    setDragState({
      id: itemId,
      startX: event.clientX,
      offsetX: 0
    });
  };

  const moverArrastre = (event, itemId) => {
    if (dragState?.id !== itemId) return;
    const delta = event.clientX - dragState.startX;
    const offsetX = Math.min(0, Math.max(-96, delta));
    setDragState((prev) => (prev?.id === itemId ? { ...prev, offsetX } : prev));
  };

  const terminarArrastre = (itemId) => {
    if (dragState?.id !== itemId) return;
    if (dragState.offsetX <= SWIPE_DELETE_THRESHOLD) {
      eliminarProducto(itemId);
    }
    setDragState(null);
  };

  const abrirEditorItem = (item) => {
    setItemEditando(item);
    setEditObservacion(item.observacion || '');
    setEditAgregados(Array.isArray(item.agregados) ? item.agregados : []);
    setEditDescuento(item.descuento || null);
    if (item.descuento && !item.descuento.descuentoId) {
      setEditManualTipo(item.descuento.tipo === 'porcentaje' ? 'porcentaje' : 'fijo');
      setEditManualValor(String(item.descuento.valor || ''));
    } else {
      setEditManualTipo('fijo');
      setEditManualValor('');
    }
    const varianteActual = Array.isArray(item.variantesDisponibles)
      ? item.variantesDisponibles.find(
          (variante) => String(variante._id || '') === String(item.varianteId || '')
        )
      : null;
    setEditVariante(varianteActual || null);
  };

  const toggleAgregadoEdit = (agregado) => {
    const agregadoId = String(agregado.agregadoId || agregado._id || agregado.nombre || '');
    const gruposUnicos = (Array.isArray(agregado.grupos) ? agregado.grupos : (agregado.grupo ? [agregado.grupo] : []))
      .filter((grupo) => grupo?.modoSeleccion === 'unico')
      .map((grupo) => String(grupo._id || grupo.key || grupo.titulo || ''))
      .filter(Boolean);
    setEditAgregados((prev) => {
      const existe = prev.some((agg) => String(agg.agregadoId || agg._id || agg.nombre || '') === agregadoId);
      if (existe) {
        return prev.filter((agg) => String(agg.agregadoId || agg._id || agg.nombre || '') !== agregadoId);
      }
      const sinMismoGrupoUnico = gruposUnicos.length === 0
        ? prev
        : prev.filter((agg) => {
            const gruposAgg = Array.isArray(agg.grupos) ? agg.grupos : (agg.grupo ? [agg.grupo] : []);
            return !gruposAgg.some((grupo) =>
              gruposUnicos.includes(String(grupo?._id || grupo?.key || grupo?.titulo || ''))
            );
          });
      return [...sinMismoGrupoUnico, agregado];
    });
  };

  const guardarEdicionItem = () => {
    if (!itemEditando?.idCarrito) return;
    actualizarItemCarrito(itemEditando.idCarrito, {
      observacion: editObservacion,
      agregados: editAgregados,
      descuento: editDescuento,
      ...(editVariante ? { variante: editVariante } : {})
    });
    setItemEditando(null);
  };

  const aplicarDescuentoManualVenta = () => {
    const descuentoManual = crearDescuentoManual(manualVentaTipo, manualVentaValor);
    if (!descuentoManual) {
      alert('Ingresa un descuento manual valido.');
      return;
    }
    actualizarDescuentoVenta(descuentoManual);
  };

  const limpiarDescuentoVenta = () => {
    setManualVentaTipo('fijo');
    setManualVentaValor('');
    actualizarDescuentoVenta(null);
  };

  const aplicarDescuentoManualProducto = () => {
    const descuentoManual = crearDescuentoManual(editManualTipo, editManualValor);
    if (!descuentoManual) {
      alert('Ingresa un descuento manual valido.');
      return;
    }
    setEditDescuento(descuentoManual);
  };

  const limpiarDescuentoProducto = () => {
    setEditManualTipo('fijo');
    setEditManualValor('');
    setEditDescuento(null);
  };

  const handleVenta = async ({ tipoPago, tipoPedido, montoRecibido, vuelto, pagos }) => {
    if (!cajaDisponible) {
      alert('No puedes iniciar el POS si no abres la caja.');
      setModalOpen(false);
      return;
    }
    const productos_limpios = carrito.map(p => ({
      productoId: p._id,
      productoBaseId: p.productoBaseId || null,
      nombre: p.nombre,
      precio_unitario: p.precio,
      precio_base: p.precioBase || null,
      cantidad: p.cantidad,
      observacion: p.observacion,
      varianteId: p.varianteId || null,
      varianteNombre: p.varianteNombre || '',
      atributos: Array.isArray(p.atributos) ? p.atributos : [],
      agregados: Array.isArray(p.agregados) ? p.agregados : [],
      descuento: p.descuento || null
    }));

    try {
      setLoading(true);
      const res = await registrarVenta({
        productos: productos_limpios,
        total,
        tipo_pago: tipoPago,
        tipo_pedido: tipoPedido || '—',
        monto_recibido: montoRecibido,
        vuelto,
        pagos,
        descuento_venta: descuentoVenta
      });

      const ventaRegistrada = res.data.venta || {
        numero_pedido: res.data.numero_pedido, productos: productos_limpios, subtotal,
        descuento_total: descuentoTotal, descuento_venta: descuentoVenta, total,
        tipo_pago: tipoPago, tipo_pedido: tipoPedido || '—', monto_recibido: montoRecibido,
        vuelto, pagos, fecha: new Date().toISOString()
      };

      vaciarCarrito();
      if (typeof onVentaCompletada === 'function') {
        onVentaCompletada(ventaRegistrada);
      }

      setUltimaVenta(ventaRegistrada);
    } catch (err) {
      console.error(err);
      const mensaje = err?.response?.data?.error || 'Error al registrar la venta';
      alert(mensaje);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarTicket = async () => {
    if (!ticketNombre.trim()) {
      alert('❌ Debes ingresar un nombre para el ticket');
      return;
    }

    const productos_limpios = carrito.map(p => ({
      productoId: p._id,
      productoBaseId: p.productoBaseId || null,
      nombre: p.nombre,
      precio_unitario: p.precio,
      precio_base: p.precioBase || null,
      cantidad: p.cantidad,
      observacion: p.observacion,
      varianteId: p.varianteId || null,
      varianteNombre: p.varianteNombre || '',
      atributos: Array.isArray(p.atributos) ? p.atributos : [],
      agregados: Array.isArray(p.agregados) ? p.agregados : [],
      descuento: p.descuento || null
    }));

    try {
      await guardarTicket({
        nombre: ticketNombre,
        productos: productos_limpios,
        subtotal,
        descuento_total: descuentoTotal,
        descuento_venta: descuentoVenta,
        total
      });

      alert('✅ Ticket guardado correctamente');
      setTicketNombre('');
      vaciarCarrito();
      onClose();
    } catch (err) {
      alert('❌ Error al guardar el ticket');
      console.error(err);
    }
  };

  return (
    <>
      <Drawer
        anchor={isMobile ? 'bottom' : 'right'}
        variant={isMobile ? 'temporary' : 'persistent'}
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            width: isMobile ? '100%' : desktopWidth,
            height: isMobile ? 'calc(100dvh - 56px)' : '100%',
            maxHeight: isMobile ? 'calc(100dvh - 56px)' : '100%',
            p: 3,
            bgcolor: theme.palette.background.default,
            color: theme.palette.text.primary,
            boxSizing: 'border-box',
            borderTopLeftRadius: isMobile ? 12 : 0,
            borderTopRightRadius: isMobile ? 12 : 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
            pb: 1,
            borderBottom: '1px solid',
            borderColor: theme.palette.divider
          }}
        >
          <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>🛒 Carrito</Typography>
          <IconButton size="small" onClick={onClose} aria-label="Cerrar carrito">
            <Close fontSize="small" />
          </IconButton>
        </Box>

        {ultimaVenta ? (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Alert severity="success">
              Venta registrada correctamente. El recibo se enviará a impresión automáticamente.
            </Alert>
            <Box
              sx={{
                border: '1px solid',
                borderColor: theme.palette.divider,
                borderRadius: 1,
                p: 1.5,
                bgcolor: theme.palette.background.paper
              }}
            >
              <Typography variant="body2" color="text.secondary">Pedido</Typography>
              <Typography variant="h5" fontWeight={900}>
                #{String(ultimaVenta.numero_pedido || '').padStart(2, '0')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Total</Typography>
              <Typography variant="h5" fontWeight={900}>{formatCLP(ultimaVenta.total)}</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Pago: {ultimaVenta.tipo_pago || '—'}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              fullWidth
              onClick={imprimirUltimaVenta}
              sx={{ minHeight: 50, fontWeight: 800 }}
            >
              Imprimir otra copia
            </Button>
            <Button
              variant="contained"
              fullWidth
              onClick={iniciarNuevaVenta}
              sx={{ minHeight: 54, fontWeight: 900 }}
            >
              Nueva venta
            </Button>
          </Stack>
        ) : carrito.length === 0 ? (
          <Typography variant="body1" sx={{ mt: 2 }}>El carrito está vacío.</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                pr: 0.5,
                mr: -0.5,
                pb: 1,
                scrollBehavior: 'smooth',
                scrollbarWidth: 'thin',
                scrollbarColor: `${theme.palette.grey[400]} transparent`,
                '&::-webkit-scrollbar': {
                  width: 8
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent'
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: theme.palette.grey[400],
                  borderRadius: 999
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  backgroundColor: theme.palette.grey[500]
                }
              }}
            >
              {carrito.map(item => {
                const sinStockExtra =
                  typeof item.stockDisponible === 'number' && item.cantidad >= item.stockDisponible;
                const itemId = item.idCarrito || item._id;
                const dragOffset = getDragOffset(itemId);
                const observacionAbierta = Boolean(observacionesAbiertas[itemId]);
                const tieneObservacion = Boolean(item.observacion?.trim());
                return (
                  <Box
                    key={itemId}
                    sx={{
                      position: 'relative',
                      overflow: 'hidden',
                      borderBottom: '1px solid',
                      borderColor: theme.palette.divider,
                      mb: 0.35,
                      '&:hover .cart-row-delete': {
                        opacity: 1,
                        pointerEvents: 'auto'
                      }
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'stretch',
                        backgroundColor: 'error.main'
                      }}
                    >
                      <Button
                        color="inherit"
                        onClick={() => eliminarProducto(itemId)}
                        sx={{
                          width: 96,
                          minWidth: 96,
                          color: '#fff',
                          borderRadius: 0,
                          textTransform: 'none',
                          fontWeight: 800
                        }}
                      >
                        Eliminar
                      </Button>
                    </Box>

                    <Box
                      onPointerDown={(event) => iniciarArrastre(event, itemId)}
                      onPointerMove={(event) => moverArrastre(event, itemId)}
                      onPointerUp={() => terminarArrastre(itemId)}
                      onPointerCancel={() => setDragState(null)}
                      sx={{
                        position: 'relative',
                        px: 0.25,
                        py: 1.15,
                        backgroundColor: theme.palette.background.default,
                        transform: `translateX(${dragOffset}px)`,
                        transition: dragState?.id === itemId ? 'none' : 'transform 0.16s ease',
                        touchAction: 'pan-y'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Box
                          onClick={() => abrirEditorItem(item)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              abrirEditorItem(item);
                            }
                          }}
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            cursor: 'pointer',
                            borderRadius: 1,
                            '&:focus-visible': {
                              outline: '2px solid',
                              outlineColor: 'primary.main',
                              outlineOffset: 2
                            }
                          }}
                        >
                          <Typography
                            fontWeight={700}
                            sx={{
                              fontSize: '0.92rem',
                              lineHeight: 1.2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {item.nombre}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.25 }}>
                            ${Number(item.precio || 0).toLocaleString('es-CL')} c/u
                            {item.varianteNombre ? ` · ${item.varianteNombre}` : ''}
                            {typeof item.stockDisponible === 'number' ? ` · Disp. ${item.stockDisponible}` : ''}
                          </Typography>
                          {Array.isArray(item.atributos) && item.atributos.length > 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.25 }}>
                              {item.atributos.map((attr) => `${attr.nombre}: ${attr.valor}`).join(' · ')}
                            </Typography>
                          )}
                          {Array.isArray(item.agregados) && item.agregados.length > 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.25 }}>
                              {item.agregados
                                .map((agg) => `+ ${agg.nombre}${Number(agg.precio) > 0 ? ` ($${Number(agg.precio).toFixed(0)})` : ''}`)
                                .join(' · ')}
                            </Typography>
                          )}
                          {item.descuento && (
                            <Typography variant="caption" color="success.main" sx={{ display: 'block', lineHeight: 1.25 }}>
                              Descuento: {item.descuento.nombre} (-${(calcularMontoDescuento(item.precio, item.descuento) * item.cantidad).toLocaleString('es-CL')})
                            </Typography>
                          )}
                        </Box>

                        <Stack direction="row" spacing={0.25} alignItems="center" sx={{ flexShrink: 0 }}>
                          <IconButton size="small" onClick={() => actualizarCantidad(item.idCarrito, item.cantidad - 1)}>
                            <Remove fontSize="small" />
                          </IconButton>
                          <Typography sx={{ minWidth: 22, textAlign: 'center', fontWeight: 700 }}>
                            {item.cantidad}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => actualizarCantidad(item.idCarrito, item.cantidad + 1)}
                            disabled={sinStockExtra}
                          >
                            <Add fontSize="small" />
                          </IconButton>
                          <IconButton
                            className="cart-row-delete"
                            size="small"
                            onClick={() => eliminarProducto(itemId)}
                            aria-label={`Eliminar ${item.nombre}`}
                            sx={{
                              opacity: { xs: 1, sm: 0 },
                              pointerEvents: { xs: 'auto', sm: 'none' },
                              color: 'error.main',
                              transition: 'opacity 0.15s ease'
                            }}
                          >
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Box>
                      {sinStockExtra && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.25 }}>
                          Alcanzaste el stock disponible
                        </Typography>
                      )}

                      <Box sx={{ mt: 0.65 }}>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => toggleObservacion(itemId)}
                          sx={{
                            minWidth: 0,
                            px: 0,
                            textTransform: 'none',
                            fontWeight: 600,
                            alignSelf: 'flex-start'
                          }}
                        >
                          {observacionAbierta
                            ? 'Ocultar observacion'
                            : (tieneObservacion ? 'Ver/editar observacion' : 'Agregar observacion')}
                        </Button>

                        {!observacionAbierta && tieneObservacion && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: 'block',
                              mt: 0.25,
                              lineHeight: 1.25,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Obs: {item.observacion}
                          </Typography>
                        )}

                        {observacionAbierta && (
                          <TextField
                            fullWidth
                            size="small"
                            placeholder="Observacion"
                            variant="outlined"
                            value={item.observacion}
                            onChange={e => actualizarObservacion(item.idCarrito, e.target.value)}
                            sx={{
                              mt: 0.5,
                              '& .MuiInputBase-input': {
                                py: 0.65,
                                fontSize: '0.82rem'
                              }
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>

            <Box
              sx={{
                flexShrink: 0,
                position: 'sticky',
                bottom: 0,
                pt: 1.25,
                mt: 1,
                px: 1.25,
                pb: 0.85,
                borderTop: '1px solid',
                borderColor: theme.palette.divider,
                bgcolor: theme.palette.background.default,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                boxShadow: '0 -10px 24px rgba(15, 23, 42, 0.10)',
                zIndex: 1,
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: -20,
                  height: 20,
                  pointerEvents: 'none',
                  background: `linear-gradient(to top, ${theme.palette.background.default}, transparent)`
                }
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  gap: 1,
                  mb: 1.25
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setDescuentoVentaAbierto((prev) => !prev)}
                    sx={{ minWidth: 0, px: 0, textTransform: 'none', fontWeight: 700 }}
                  >
                    {descuentoVentaAbierto ? 'Ocultar descuento' : 'Agregar descuento'}
                  </Button>
                  {descuentoVenta && (
                    <Typography variant="caption" color="success.main" sx={{ display: 'block', lineHeight: 1.2 }}>
                      {descuentoVenta.nombre || 'Descuento manual'} aplicado
                    </Typography>
                  )}
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.15 }}>
                    Subtotal: ${subtotal.toLocaleString('es-CL')}
                  </Typography>
                  {descuentoTotal > 0 && (
                    <Typography variant="caption" color="success.main" sx={{ display: 'block', lineHeight: 1.15 }}>
                      Desc.: -${descuentoTotal.toLocaleString('es-CL')}
                    </Typography>
                  )}
                  <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.05, mt: 0.35 }}>
                    Total: ${total.toLocaleString('es-CL')}
                  </Typography>
                </Box>
              </Box>

              {descuentoVentaAbierto && (
                <Box
                  sx={{
                    mb: 1.25,
                    p: 1,
                    border: '1px solid',
                    borderColor: theme.palette.divider,
                    borderRadius: 2,
                    bgcolor: theme.palette.background.paper
                  }}
                >
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Descuento para toda la venta"
                    value={descuentoVenta && !descuentoVenta.descuentoId ? '__manual__' : (descuentoVenta?.descuentoId || '')}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (!value) {
                        limpiarDescuentoVenta();
                        return;
                      }
                      const descuentoSeleccionado =
                        descuentos.find((item) => String(item._id) === String(value)) || null;
                      actualizarDescuentoVenta(descuentoSeleccionado);
                    }}
                  >
                    <MenuItem value="">Sin descuento general</MenuItem>
                    {descuentoVenta && !descuentoVenta.descuentoId && (
                      <MenuItem value="__manual__" disabled>
                        Descuento manual activo
                      </MenuItem>
                    )}
                    {descuentos.map((descuento) => (
                      <MenuItem key={descuento._id} value={descuento._id}>
                        {descuento.nombre} ({descuento.tipo === 'porcentaje' ? `${descuento.valor}%` : `$${Number(descuento.valor).toLocaleString('es-CL')}`})
                      </MenuItem>
                    ))}
                  </TextField>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                    <TextField
                      select
                      size="small"
                      label="Tipo manual"
                      value={manualVentaTipo}
                      onChange={(e) => setManualVentaTipo(e.target.value)}
                      sx={{ minWidth: { sm: 140 } }}
                    >
                      <MenuItem value="fijo">Monto fijo</MenuItem>
                      <MenuItem value="porcentaje">Porcentaje</MenuItem>
                    </TextField>
                    <TextField
                      size="small"
                      type="number"
                      label={manualVentaTipo === 'porcentaje' ? 'Porcentaje' : 'Monto'}
                      value={manualVentaValor}
                      onChange={(e) => setManualVentaValor(e.target.value)}
                      inputProps={{
                        min: 0,
                        max: manualVentaTipo === 'porcentaje' ? 100 : undefined,
                        step: manualVentaTipo === 'porcentaje' ? 1 : 100
                      }}
                      fullWidth
                    />
                    <Button variant="outlined" onClick={aplicarDescuentoManualVenta}>
                      Aplicar
                    </Button>
                  </Stack>
                </Box>
              )}

              {cajaVerificada && !cajaDisponible && (
                <Alert severity="warning" sx={{ mb: 1.25 }}>
                  No puedes iniciar el POS si no abres la caja.
                </Alert>
              )}

              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={() => setModalOpen(true)}
                disabled={loading || !cajaDisponible}
                sx={{ py: 1, fontWeight: 700, borderRadius: 2.5 }}
              >
                {cajaDisponible ? (loading ? 'Procesando...' : '💳 Finalizar Venta') : 'Abre la caja para vender'}
              </Button>

              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.75 }}>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setGuardarTicketAbierto((prev) => !prev)}
                  sx={{ minWidth: 0, px: 0, textTransform: 'none', fontWeight: 700 }}
                >
                  {guardarTicketAbierto ? 'Ocultar ticket' : 'Guardar como ticket'}
                </Button>
                <Button
                  size="small"
                  variant="text"
                  color="error"
                  onClick={vaciarCarrito}
                  sx={{ minWidth: 0, px: 0, textTransform: 'none', fontWeight: 700 }}
                >
                  Vaciar carrito
                </Button>
              </Stack>

              {guardarTicketAbierto && (
                <Box
                  sx={{
                    mt: 1,
                    p: 1,
                    border: '1px solid',
                    borderColor: theme.palette.divider,
                    borderRadius: 2,
                    bgcolor: theme.palette.background.paper
                  }}
                >
                  <TextField
                    size="small"
                    fullWidth
                    variant="outlined"
                    label="Nombre del ticket"
                    value={ticketNombre}
                    onChange={(e) => setTicketNombre(e.target.value)}
                  />
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={handleGuardarTicket}
                    sx={{ mt: 1 }}
                  >
                    📝 Guardar Ticket
                  </Button>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Drawer>

      <ModalPago
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleVenta}
        total={total}
      />
      <Dialog
        open={Boolean(itemEditando)}
        onClose={() => setItemEditando(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Editar producto</DialogTitle>
        <DialogContent dividers>
          <Typography fontWeight={800} sx={{ mb: 0.5 }}>
            {itemEditando?.nombre}
          </Typography>
          {variantesEditables.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                Variantes
              </Typography>
              <Stack spacing={1}>
                {variantesEditables.map((variante, index) => {
                  const varianteId = String(variante._id || variante.nombre || index);
                  const seleccionado = String(editVariante?._id || '') === String(variante._id || '');
                  const agotada = varianteEstaAgotada(variante);
                  const stock = normalizarStockVariante(variante.stock);
                  const detalle = [variante.color, variante.talla].filter(Boolean).join(' / ');
                  return (
                    <Box
                      key={`${varianteId}-${index}`}
                      role="radio"
                      aria-checked={seleccionado}
                      aria-disabled={agotada}
                      tabIndex={agotada ? -1 : 0}
                      onClick={() => {
                        if (!agotada) setEditVariante(variante);
                      }}
                      onKeyDown={(event) => {
                        if (agotada) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setEditVariante(variante);
                        }
                      }}
                      sx={{
                        px: 1.25,
                        py: 1,
                        minHeight: 56,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: seleccionado ? 'primary.main' : 'divider',
                        backgroundColor: seleccionado ? 'primary.main' : 'background.paper',
                        color: seleccionado ? 'primary.contrastText' : 'text.primary',
                        opacity: agotada ? 0.55 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        cursor: agotada ? 'not-allowed' : 'pointer',
                        userSelect: 'none',
                        '&:focus-visible': {
                          outline: '3px solid',
                          outlineColor: 'primary.main',
                          outlineOffset: 2
                        }
                      }}
                    >
                      <Box>
                        <Typography fontWeight={800}>{variante.nombre}</Typography>
                        <Typography variant="body2" sx={{ color: seleccionado ? 'inherit' : 'text.secondary' }}>
                          {detalle ? `${detalle} · ` : ''}
                          ${Number(variante.precio ?? itemEditando?.precioBase ?? 0).toLocaleString('es-CL')}
                          {' · '}
                          {agotada ? 'Agotada' : stock === null ? 'Stock libre' : `Stock ${stock}`}
                        </Typography>
                      </Box>
                      <CheckCircle sx={{ opacity: seleccionado ? 1 : 0 }} />
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          )}

          <TextField
            fullWidth
            label="Observación"
            value={editObservacion}
            onChange={(event) => setEditObservacion(event.target.value)}
            multiline
            minRows={2}
            sx={{ mb: 2 }}
          />

          <TextField
            select fullWidth label="Descuento para este producto" sx={{ mb: 2 }}
            value={editDescuento && !editDescuento.descuentoId ? '__manual__' : (editDescuento?.descuentoId || editDescuento?._id || '')}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) {
                limpiarDescuentoProducto();
                return;
              }
              setEditDescuento(
                descuentos.find((item) => String(item._id) === String(value)) || null
              );
            }}
          >
            <MenuItem value="">Sin descuento</MenuItem>
            {editDescuento && !editDescuento.descuentoId && (
              <MenuItem value="__manual__" disabled>
                Descuento manual activo
              </MenuItem>
            )}
            {descuentos.map((descuento) => (
              <MenuItem key={descuento._id} value={descuento._id}>
                {descuento.nombre} ({descuento.tipo === 'porcentaje' ? `${descuento.valor}%` : `$${Number(descuento.valor).toLocaleString('es-CL')}`})
              </MenuItem>
            ))}
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
            <TextField
              select
              size="small"
              label="Tipo manual"
              value={editManualTipo}
              onChange={(e) => setEditManualTipo(e.target.value)}
              sx={{ minWidth: { sm: 140 } }}
            >
              <MenuItem value="fijo">Monto fijo</MenuItem>
              <MenuItem value="porcentaje">Porcentaje</MenuItem>
            </TextField>
            <TextField
              size="small"
              type="number"
              label={editManualTipo === 'porcentaje' ? 'Porcentaje' : 'Monto'}
              value={editManualValor}
              onChange={(e) => setEditManualValor(e.target.value)}
              inputProps={{
                min: 0,
                max: editManualTipo === 'porcentaje' ? 100 : undefined,
                step: editManualTipo === 'porcentaje' ? 1 : 100
              }}
              fullWidth
            />
            <Button variant="outlined" onClick={aplicarDescuentoManualProducto}>
              Aplicar manual
            </Button>
          </Stack>

          {agregadosEditables.length > 0 && (
            <Box>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                Agregados
              </Typography>
              <Stack spacing={1}>
                {agregadosEditables.map((agregado, index) => {
                  const agregadoId = String(agregado.agregadoId || agregado._id || agregado.nombre || index);
                  const seleccionado = editAgregados.some(
                    (agg) => String(agg.agregadoId || agg._id || agg.nombre || '') === agregadoId
                  );
                  return (
                    <Box
                      key={`${agregadoId}-${index}`}
                      role="checkbox"
                      aria-checked={seleccionado}
                      tabIndex={0}
                      onClick={() => toggleAgregadoEdit(agregado)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          toggleAgregadoEdit(agregado);
                        }
                      }}
                      sx={{
                        px: 1.25,
                        py: 1,
                        minHeight: 50,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: seleccionado ? 'primary.main' : 'divider',
                        backgroundColor: seleccionado ? 'primary.main' : 'background.paper',
                        color: seleccionado ? 'primary.contrastText' : 'text.primary',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:focus-visible': {
                          outline: '3px solid',
                          outlineColor: 'primary.main',
                          outlineOffset: 2
                        }
                      }}
                    >
                      <Box>
                        <Typography fontWeight={700}>{agregado.nombre}</Typography>
                        <Typography variant="body2" sx={{ color: seleccionado ? 'inherit' : 'text.secondary' }}>
                          {Number(agregado.precio) > 0
                            ? `+$${Number(agregado.precio).toLocaleString('es-CL')}`
                            : 'Incluido'}
                        </Typography>
                      </Box>
                      <CheckCircle sx={{ opacity: seleccionado ? 1 : 0 }} />
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="error" onClick={() => {
            if (itemEditando?.idCarrito) eliminarProducto(itemEditando.idCarrito);
            setItemEditando(null);
          }}>
            Eliminar producto
          </Button>
          <Button onClick={() => setItemEditando(null)}>Cancelar</Button>
          <Button variant="contained" onClick={guardarEdicionItem}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
      <ReciboPOSPrint venta={ultimaVenta} config={configRecibo} />
      <style>
        {`
          @media screen {
            #pos-print-ticket {
              display: none;
            }
          }
          @media print {
            body * {
              visibility: hidden !important;
            }
            #pos-print-ticket,
            #pos-print-ticket * {
              display: block !important;
              visibility: visible !important;
            }
            #pos-print-ticket {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 80mm !important;
              padding: 0 !important;
              margin: 0 !important;
              background: #fff !important;
              color: #000 !important;
              font-family: monospace !important;
              font-size: 11px !important;
              text-align: center !important;
            }
            #pos-print-ticket .ticket-title {
              font-size: 15px !important;
              font-weight: 700 !important;
            }
            #pos-print-ticket .ticket-total {
              font-size: 15px !important;
              font-weight: 700 !important;
            }
            #pos-print-ticket hr {
              border: 0 !important;
              border-top: 1px dashed #999 !important;
              margin: 8px 0 !important;
            }
            @page {
              size: auto;
              margin: 0;
            }
          }
        `}
      </style>
    </>
  );
}









