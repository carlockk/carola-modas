import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Typography, TextField, List, ListItemButton, Divider, Paper, Stack,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Alert, CircularProgress
} from '@mui/material';
import { anularVenta, obtenerDetalleVenta, obtenerVentas, registrarDevolucion } from '../services/api';
import VistaTicket from '../components/VistaTicket';
import { useAuth } from '../context/AuthContext';

export default function Historial() {
  const { selectedLocal, usuario } = useAuth();
  const localId = selectedLocal?._id;
  const [ventas, setVentas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [siguiente, setSiguiente] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [error, setError] = useState('');
  const [errorDetalle, setErrorDetalle] = useState('');
  const consultaRef = useRef(0);
  const detalleRef = useRef(0);
  const listaRef = useRef(null);
  const loadMoreRef = useRef(null);
  const cargaEnCursoRef = useRef(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [dialogoDevolucion, setDialogoDevolucion] = useState(false);
  const [devolucion, setDevolucion] = useState({ monto: '', motivo: '', tipo_pago: 'Efectivo' });
  const [guardando, setGuardando] = useState(false);
  const [dialogoAnulacion, setDialogoAnulacion] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [anulando, setAnulando] = useState(false);
  const esAdmin = ['admin', 'superadmin'].includes(usuario?.rol);

  const totalDevuelto = (ventaSeleccionada?.devoluciones || [])
    .reduce((sum, item) => sum + (Number(item.monto) || 0), 0);
  const saldoDisponible = Math.max(0, Number(ventaSeleccionada?.total || 0) - totalDevuelto);

  useEffect(() => {
    const timer = setTimeout(() => setBusquedaAplicada(busqueda.trim()), 350);
    return () => clearTimeout(timer);
  }, [busqueda]);

  useEffect(() => {
    const consulta = ++consultaRef.current;
    const secuencia = consultaRef;
    ++detalleRef.current;
    setVentas([]);
    setSiguiente(null);
    setVentaSeleccionada(null);
    setCargandoDetalle(false);
    setCargandoMas(false);
    cargaEnCursoRef.current = false;
    setErrorDetalle('');
    setError('');
    setCargando(true);
    if (!localId) {
      setCargando(false);
      return () => { ++secuencia.current; };
    }
    const parametros = { limite: 50, buscar: busquedaAplicada || undefined };
    if (desde) parametros.desde = new Date(`${desde}T00:00:00`).toISOString();
    if (hasta) {
      const fin = new Date(`${hasta}T00:00:00`);
      fin.setDate(fin.getDate() + 1);
      parametros.hasta = fin.toISOString();
    }
    obtenerVentas(parametros)
      .then(({ data }) => {
        if (consulta !== consultaRef.current) return;
        setVentas(data.items);
        setSiguiente(data.siguiente);
      })
      .catch((err) => {
        if (consulta === consultaRef.current) setError(err?.response?.data?.error || 'No se pudo cargar el historial');
      })
      .finally(() => {
        if (consulta === consultaRef.current) setCargando(false);
      });
    return () => { ++secuencia.current; };
  }, [localId, busquedaAplicada, desde, hasta]);

  const cargarMas = useCallback(async () => {
    if (!siguiente || cargaEnCursoRef.current) return;
    cargaEnCursoRef.current = true;
    const consulta = consultaRef.current;
    setCargandoMas(true);
    setError('');
    const parametros = {
      limite: 50, buscar: busquedaAplicada || undefined,
      cursorFecha: siguiente.fecha, cursorId: siguiente.id
    };
    if (desde) parametros.desde = new Date(`${desde}T00:00:00`).toISOString();
    if (hasta) {
      const fin = new Date(`${hasta}T00:00:00`);
      fin.setDate(fin.getDate() + 1);
      parametros.hasta = fin.toISOString();
    }
    try {
      const { data } = await obtenerVentas(parametros);
      if (consulta !== consultaRef.current) return;
      setVentas((actuales) => [...actuales, ...data.items]);
      setSiguiente(data.siguiente);
    } catch (err) {
      if (consulta === consultaRef.current) setError(err?.response?.data?.error || 'No se pudieron cargar más tickets');
    } finally {
      if (consulta === consultaRef.current) {
        cargaEnCursoRef.current = false;
        setCargandoMas(false);
      }
    }
  }, [siguiente, busquedaAplicada, desde, hasta]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    const lista = listaRef.current;
    if (!sentinel || !lista || !siguiente || cargando || cargandoMas || error ||
        typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        observer.disconnect();
        cargarMas();
      }
    }, { root: lista, rootMargin: '400px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [siguiente, cargando, cargandoMas, error, cargarMas]);

  const seleccionarVenta = async (id) => {
    const solicitud = ++detalleRef.current;
    setVentaSeleccionada(null);
    setErrorDetalle('');
    setCargandoDetalle(true);
    try {
      const { data } = await obtenerDetalleVenta(id);
      if (solicitud === detalleRef.current) setVentaSeleccionada(data);
    } catch (err) {
      if (solicitud === detalleRef.current) setErrorDetalle(err?.response?.data?.error || 'No se pudo cargar el ticket');
    } finally {
      if (solicitud === detalleRef.current) setCargandoDetalle(false);
    }
  };

  const actualizarVenta = async (id) => {
    const solicitud = detalleRef.current;
    const { data } = await obtenerDetalleVenta(id);
    if (solicitud === detalleRef.current) setVentaSeleccionada(data);
    setVentas((actuales) => actuales.map((venta) => venta._id === id
      ? { ...venta, estado: data.estado }
      : venta));
  };

  const guardarDevolucion = async () => {
    const monto = Math.round(Number(devolucion.monto));
    if (!Number.isFinite(monto) || monto <= 0) return alert('Ingresa un monto valido');
    if (!devolucion.motivo.trim()) return alert('Ingresa el motivo de la devolucion');
    setGuardando(true);
    let registrada = false;
    try {
      await registrarDevolucion(ventaSeleccionada._id, { ...devolucion, monto });
      registrada = true;
      setDialogoDevolucion(false);
      setDevolucion({ monto: '', motivo: '', tipo_pago: 'Efectivo' });
      await actualizarVenta(ventaSeleccionada._id);
    } catch (err) {
      alert(registrada ? 'Devolución registrada, pero no se pudo actualizar el ticket. Vuelve a abrirlo.' :
        (err?.response?.data?.error || 'No se pudo registrar la devolucion'));
    } finally {
      setGuardando(false);
    }
  };

  const guardarAnulacion = async () => {
    if (!motivoAnulacion.trim() || !ventaSeleccionada) return;
    setAnulando(true);
    let registrada = false;
    try {
      await anularVenta(ventaSeleccionada._id, motivoAnulacion.trim());
      registrada = true;
      setDialogoAnulacion(false);
      setMotivoAnulacion('');
      await actualizarVenta(ventaSeleccionada._id);
    } catch (err) {
      alert(registrada ? 'Venta anulada, pero no se pudo actualizar el ticket. Vuelve a abrirlo.' :
        (err?.response?.data?.error || 'No se pudo anular la venta'));
    } finally {
      setAnulando(false);
    }
  };

  const agrupadas = ventas.reduce((acc, v) => {
    const fecha = new Date(v.fecha).toLocaleDateString('es-CL');
    acc[fecha] = acc[fecha] || [];
    acc[fecha].push(v);
    return acc;
  }, {});

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      {/* Panel izquierdo: Lista de tickets */}
      <Box sx={{ flex: 1 }}>
        <TextField
          label="Buscar ticket o producto"
          variant="outlined"
          fullWidth
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          sx={{ mb: 2 }}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
          <TextField type="date" label="Desde" value={desde} onChange={(e) => setDesde(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }} fullWidth size="small" />
          <TextField type="date" label="Hasta" value={hasta} onChange={(e) => setHasta(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }} fullWidth size="small" />
        </Stack>
        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
        {cargando && <CircularProgress size={24} sx={{ mb: 1 }} />}
        {!cargando && !error && ventas.length === 0 && (
          <Typography color="text.secondary" sx={{ mb: 1 }}>No se encontraron tickets.</Typography>
        )}

        <Paper
          ref={listaRef}
          elevation={0}
          sx={{
            maxHeight: '75vh',
            overflowY: 'auto',
            p: 1,
            backgroundColor: 'transparent',
            boxShadow: 'none',
            fontSize: '0.92rem',
            '& .MuiTypography-body1, & .MuiTypography-body2, & .MuiTypography-subtitle2': {
              fontSize: '0.92rem'
            }
          }}
        >
          {Object.entries(agrupadas).map(([fecha, ventas]) => (
            <Box key={fecha} sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 1 }}>{fecha}</Typography>
              <Divider />
              <List dense>
                {ventas.map((venta) => (
                  <ListItemButton
                    key={venta._id}
                    onClick={() => seleccionarVenta(venta._id)}
                    selected={ventaSeleccionada?._id === venta._id}
                  >
                    <Box>
                      <Typography variant="body1">
                        🧾 Ticket #{String(venta.numero_pedido).padStart(2, '0')}
                        {venta.estado === 'anulada' && ' · ANULADO'}
                      </Typography>
                      <Typography variant="caption">
                        {new Date(venta.fecha).toLocaleTimeString()}
                      </Typography>
                      <Typography variant="caption" display="block">
                        {venta?.cobrador_nombre || venta?.usuario?.nombre || venta?.usuario?.email || 'Sin cobrador'} - {venta?.tipo_pago || 'Sin pago'}
                      </Typography>
                    </Box>
                  </ListItemButton>
                ))}
              </List>
            </Box>
          ))}
          <Box ref={loadMoreRef} sx={{ height: 1 }} />
          {cargandoMas && <CircularProgress size={22} sx={{ display: 'block', mx: 'auto', my: 1 }} />}
        </Paper>
        {siguiente && (error || typeof IntersectionObserver === 'undefined') && (
          <Button fullWidth variant="outlined" sx={{ mt: 1 }} onClick={cargarMas} disabled={cargandoMas}>
            {error ? 'Reintentar carga' : 'Mostrar más tickets'}
          </Button>
        )}
      </Box>

      {/* Panel derecho: Detalle */}
      <Box sx={{ flex: 2 }}>
        {ventaSeleccionada ? (
          <Stack spacing={2}>
            <VistaTicket venta={ventaSeleccionada} />
            {esAdmin && ventaSeleccionada.estado !== 'anulada' &&
              (!ventaSeleccionada.origen_cobro || ventaSeleccionada.origen_cobro === 'pos') && (
              <Paper variant="outlined" sx={{ p: 2, maxWidth: 400, mx: 'auto', width: '100%' }}>
                <Typography fontWeight={700}>Anulación interna</Typography>
                <Typography variant="body2" sx={{ my: 1 }}>
                  Solo para ventas de la caja actual, sin devoluciones. Repone el stock y excluye la venta de los totales.
                </Typography>
                <Button
                  variant="outlined" color="error" fullWidth
                  disabled={(ventaSeleccionada.devoluciones || []).length > 0}
                  onClick={() => setDialogoAnulacion(true)}
                >
                  Anular venta
                </Button>
              </Paper>
            )}
            {ventaSeleccionada.estado !== 'anulada' && (
              <Paper variant="outlined" sx={{ p: 2, maxWidth: 400, mx: 'auto', width: '100%' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography fontWeight={700}>Devoluciones</Typography>
                <Button
                  variant="contained"
                  color="warning"
                  size="small"
                  disabled={saldoDisponible <= 0}
                  onClick={() => setDialogoDevolucion(true)}
                >
                  Registrar devolucion
                </Button>
              </Stack>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Devuelto: ${totalDevuelto.toLocaleString('es-CL')} / Saldo: ${saldoDisponible.toLocaleString('es-CL')}
              </Typography>
              {(ventaSeleccionada.devoluciones || []).map((item) => (
                <Box key={item._id} sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" fontWeight={700}>
                    -${Number(item.monto || 0).toLocaleString('es-CL')} - {item.tipo_pago}
                  </Typography>
                  <Typography variant="caption" display="block">{item.motivo}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(item.fecha).toLocaleString('es-CL')}
                  </Typography>
                </Box>
              ))}
              </Paper>
            )}
          </Stack>
        ) : cargandoDetalle ? (
          <CircularProgress size={24} sx={{ mt: 4 }} />
        ) : errorDetalle ? (
          <Alert severity="error" sx={{ mt: 2 }}>{errorDetalle}</Alert>
        ) : (
          <Typography variant="body1" sx={{ mt: 4 }}>
            Selecciona un ticket para ver su detalle
          </Typography>
        )}
      </Box>

      <Dialog open={dialogoDevolucion} onClose={() => setDialogoDevolucion(false)} fullWidth maxWidth="xs">
        <DialogTitle>Registrar devolucion</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Saldo maximo a devolver: ${saldoDisponible.toLocaleString('es-CL')}. Debe existir una caja abierta.
          </Alert>
          <TextField
            autoFocus fullWidth type="number" label="Monto a devolver" sx={{ mb: 2 }}
            value={devolucion.monto}
            onChange={(e) => setDevolucion((prev) => ({ ...prev, monto: e.target.value }))}
            inputProps={{ min: 1, max: saldoDisponible }}
          />
          <TextField
            select fullWidth label="Medio de devolucion" sx={{ mb: 2 }}
            value={devolucion.tipo_pago}
            onChange={(e) => setDevolucion((prev) => ({ ...prev, tipo_pago: e.target.value }))}
          >
            {['Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Otro'].map((tipo) => (
              <MenuItem key={tipo} value={tipo}>{tipo}</MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth multiline minRows={3} label="Motivo de la devolucion"
            value={devolucion.motivo}
            onChange={(e) => setDevolucion((prev) => ({ ...prev, motivo: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogoDevolucion(false)}>Cancelar</Button>
          <Button variant="contained" onClick={guardarDevolucion} disabled={guardando || saldoDisponible <= 0}>
            {guardando ? 'Guardando...' : 'Confirmar devolucion'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogoAnulacion} onClose={() => !anulando && setDialogoAnulacion(false)} fullWidth maxWidth="xs">
        <DialogTitle>Anular venta</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            El ticket quedará marcado ANULADO, los productos volverán a sus variantes y la venta saldrá de los totales de caja y reportes. La devolución del pago, si corresponde, se gestiona por separado.
          </Alert>
          <TextField
            autoFocus fullWidth multiline minRows={3} label="Motivo de la anulación"
            value={motivoAnulacion}
            onChange={(e) => setMotivoAnulacion(e.target.value)}
            inputProps={{ maxLength: 300 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogoAnulacion(false)} disabled={anulando}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={guardarAnulacion} disabled={anulando || !motivoAnulacion.trim()}>
            {anulando ? 'Anulando...' : 'Confirmar anulación'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
