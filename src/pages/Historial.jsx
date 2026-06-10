import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, TextField, List, ListItemButton, Divider, Paper, Stack,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Alert
} from '@mui/material';
import { obtenerVentas, registrarDevolucion } from '../services/api';
import VistaTicket from '../components/VistaTicket';
import { useAuth } from '../context/AuthContext';

export default function Historial() {
  const { selectedLocal } = useAuth();
  const [ventas, setVentas] = useState([]);
  const [filtradas, setFiltradas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [dialogoDevolucion, setDialogoDevolucion] = useState(false);
  const [devolucion, setDevolucion] = useState({ monto: '', motivo: '', tipo_pago: 'Efectivo' });
  const [guardando, setGuardando] = useState(false);

  const totalDevuelto = (ventaSeleccionada?.devoluciones || [])
    .reduce((sum, item) => sum + (Number(item.monto) || 0), 0);
  const saldoDisponible = Math.max(0, Number(ventaSeleccionada?.total || 0) - totalDevuelto);

  const cargar = useCallback(async () => {
    try {
      const res = await obtenerVentas({});
      setVentas(res.data);
      setFiltradas(res.data);
    } catch {
      alert('❌ Error al cargar historial');
    }
  }, [selectedLocal?._id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    const b = busqueda.toLowerCase();
    const resultado = ventas.filter(v =>
      String(v.numero_pedido).includes(b) ||
      v.productos.some(p =>
        p.nombre.toLowerCase().includes(b) ||
        (p.varianteNombre || '').toLowerCase().includes(b)
      )
    );
    setFiltradas(resultado);
  }, [busqueda, ventas]);

  const guardarDevolucion = async () => {
    const monto = Math.round(Number(devolucion.monto));
    if (!Number.isFinite(monto) || monto <= 0) return alert('Ingresa un monto valido');
    if (!devolucion.motivo.trim()) return alert('Ingresa el motivo de la devolucion');
    setGuardando(true);
    try {
      await registrarDevolucion(ventaSeleccionada._id, { ...devolucion, monto });
      setDialogoDevolucion(false);
      setDevolucion({ monto: '', motivo: '', tipo_pago: 'Efectivo' });
      const res = await obtenerVentas({});
      setVentas(res.data);
      setFiltradas(res.data);
      setVentaSeleccionada(res.data.find((venta) => venta._id === ventaSeleccionada._id) || null);
    } catch (err) {
      alert(err?.response?.data?.error || 'No se pudo registrar la devolucion');
    } finally {
      setGuardando(false);
    }
  };

  const agrupadas = filtradas.reduce((acc, v) => {
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

        <Paper
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
                    onClick={() => setVentaSeleccionada(venta)}
                    selected={ventaSeleccionada?._id === venta._id}
                  >
                    <Box>
                      <Typography variant="body1">
                        🧾 Ticket #{String(venta.numero_pedido).padStart(2, '0')}
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
        </Paper>
      </Box>

      {/* Panel derecho: Detalle */}
      <Box sx={{ flex: 2 }}>
        {ventaSeleccionada ? (
          <Stack spacing={2}>
            <VistaTicket venta={ventaSeleccionada} />
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
          </Stack>
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
    </Stack>
  );
}
