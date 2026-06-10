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
  DialogTitle
} from '@mui/material';
import { Add, Remove, Close, DeleteOutline, CheckCircle } from '@mui/icons-material';
import { useCarrito } from '../context/CarritoContext';
import { useCaja } from '../context/CajaContext';
import { registrarVenta, guardarTicket, obtenerConfigRecibo } from '../services/api'; // ✅ agregado
import { useEffect, useRef, useState } from 'react';
import ModalPago from './ModalPago';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';

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
          <Typography>{formatCLP(item.precio_unitario)} c/u</Typography>
        </Box>
      ))}

      <hr />
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
    vaciarCarrito
  } = useCarrito();
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [ticketNombre, setTicketNombre] = useState(''); // ✅ nombre del ticket
  const [dragState, setDragState] = useState(null);
  const [itemEditando, setItemEditando] = useState(null);
  const [editObservacion, setEditObservacion] = useState('');
  const [editAgregados, setEditAgregados] = useState([]);
  const [editVariante, setEditVariante] = useState(null);
  const [ultimaVenta, setUltimaVenta] = useState(null);
  const [configRecibo, setConfigRecibo] = useState(null);
  const ventaImpresaRef = useRef(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { cajaAbierta, cajaVerificada } = useCaja();

  const total = carrito.reduce((sum, p) => sum + p.precio * p.cantidad, 0);
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
      ...(editVariante ? { variante: editVariante } : {})
    });
    setItemEditando(null);
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
      agregados: Array.isArray(p.agregados) ? p.agregados : []
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
        pagos
      });

      vaciarCarrito();
      if (typeof onVentaCompletada === 'function') {
        onVentaCompletada();
      }

      setUltimaVenta({
        numero_pedido: res.data.numero_pedido,
        productos: productos_limpios,
        total,
        tipo_pago: tipoPago,
        tipo_pedido: tipoPedido || '—',
        monto_recibido: montoRecibido,
        vuelto,
        pagos,
        fecha: new Date().toISOString()
      });
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
      agregados: Array.isArray(p.agregados) ? p.agregados : []
    }));

    try {
      await guardarTicket({
        nombre: ticketNombre,
        productos: productos_limpios,
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
            borderTopRightRadius: isMobile ? 12 : 0
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
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
          <>
            {carrito.map(item => {
              const sinStockExtra =
                typeof item.stockDisponible === 'number' && item.cantidad >= item.stockDisponible;
              const itemId = item.idCarrito || item._id;
              const dragOffset = getDragOffset(itemId);
              return (
                <Box
                  key={itemId}
                  sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderBottom: '1px solid',
                    borderColor: theme.palette.divider,
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

                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Observación"
                      variant="outlined"
                      value={item.observacion}
                      onChange={e => actualizarObservacion(item.idCarrito, e.target.value)}
                      sx={{
                        mt: 0.65,
                        '& .MuiInputBase-input': {
                          py: 0.65,
                          fontSize: '0.82rem'
                        }
                      }}
                    />
                  </Box>
                </Box>
              );
            })}

            <Typography variant="h6" sx={{ mt: 2, textAlign: 'right' }}>
              Total: <strong>${total.toFixed(0)}</strong>
            </Typography>

            {cajaVerificada && !cajaDisponible && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                No puedes iniciar el POS si no abres la caja.
              </Alert>
            )}

            <Stack spacing={1} mt={2}>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={() => setModalOpen(true)}
                disabled={loading || !cajaDisponible}
                sx={{ py: 1.2, fontWeight: 600 }}
              >
                {cajaDisponible ? (loading ? 'Procesando...' : '💳 Finalizar Venta') : 'Abre la caja para vender'}
              </Button>
              <Button variant="text" color="error" onClick={vaciarCarrito}>
                🗑 Vaciar Carrito
              </Button>

              {/* ✅ Campo para guardar ticket */}
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
              >
                📝 Guardar Ticket
              </Button>
            </Stack>
          </>
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









