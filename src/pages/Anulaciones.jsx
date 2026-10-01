import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress, Divider, List, ListItemButton, Paper, Stack, TextField, Typography } from '@mui/material';
import { obtenerAnulaciones } from '../services/api';
import { useAuth } from '../context/AuthContext';
import VistaTicket from '../components/VistaTicket';

export default function Anulaciones() {
  const { selectedLocal } = useAuth();
  const localId = selectedLocal?._id;
  const [ventas, setVentas] = useState([]);
  const [seleccionada, setSeleccionada] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    if (!localId) {
      setVentas([]);
      setSeleccionada(null);
      setCargando(false);
      return;
    }
    setCargando(true);
    setError('');
    try {
      const { data } = await obtenerAnulaciones();
      setVentas(data);
      setSeleccionada((actual) => data.find((venta) => venta._id === actual?._id) || null);
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudieron cargar las anulaciones');
    } finally {
      setCargando(false);
    }
  }, [localId]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return ventas;
    return ventas.filter((venta) =>
      String(venta.numero_pedido).includes(texto) ||
      (venta.anulacion?.motivo || '').toLowerCase().includes(texto) ||
      venta.productos.some((producto) =>
        producto.nombre?.toLowerCase().includes(texto) ||
        producto.varianteNombre?.toLowerCase().includes(texto)
      )
    );
  }, [busqueda, ventas]);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Anulaciones</Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <TextField fullWidth label="Buscar ticket, producto o motivo" value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)} sx={{ mb: 2 }} />
          {cargando && <CircularProgress size={24} />}
          {error && <Alert severity="error">{error}</Alert>}
          {!cargando && !error && filtradas.length === 0 && (
            <Typography color="text.secondary">No hay anulaciones que coincidan.</Typography>
          )}
          <Paper variant="outlined" sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <List dense disablePadding>
              {filtradas.map((venta) => (
                <ListItemButton key={venta._id} selected={seleccionada?._id === venta._id}
                  onClick={() => setSeleccionada(venta)} divider>
                  <Box sx={{ width: '100%' }}>
                    <Typography fontWeight={700}>Ticket #{String(venta.numero_pedido).padStart(2, '0')} · ANULADO</Typography>
                    <Typography variant="body2">{new Date(venta.anulacion.fecha).toLocaleString('es-CL')} · ${Number(venta.total || 0).toLocaleString('es-CL')}</Typography>
                    <Typography variant="caption" color="text.secondary">{venta.anulacion.motivo}</Typography>
                  </Box>
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Box>
        <Box sx={{ flex: 2, minWidth: 0 }}>
          {seleccionada ? (
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography fontWeight={700}>Registro de anulación</Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2">Venta: {new Date(seleccionada.fecha).toLocaleString('es-CL')}</Typography>
                <Typography variant="body2">Anulada: {new Date(seleccionada.anulacion.fecha).toLocaleString('es-CL')}</Typography>
                <Typography variant="body2">Por: {seleccionada.anulacion.usuario?.nombre || seleccionada.anulacion.usuario?.email || 'Usuario no disponible'}</Typography>
                <Typography variant="body2">Motivo: {seleccionada.anulacion.motivo}</Typography>
              </Paper>
              <VistaTicket venta={seleccionada} />
            </Stack>
          ) : (
            <Typography color="text.secondary">Selecciona una anulación para ver su detalle.</Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
