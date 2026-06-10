import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Card,
  CardContent,
  Divider,
  Alert
} from '@mui/material';
import {
  abrirCaja,
  cerrarCaja,
  cobrarComandaCaja,
  obtenerComandasPendientesCaja,
  obtenerRendicionesPendientesCaja,
  rendirCobroMesaCaja
} from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCaja } from '../context/CajaContext';
import ModalPago from '../components/ModalPago';

export default function Caja() {
  const [montoInicial, setMontoInicial] = useState('');
  const [pendientes, setPendientes] = useState([]);
  const [cargandoPendientes, setCargandoPendientes] = useState(false);
  const [modalCobroOpen, setModalCobroOpen] = useState(false);
  const [comandaSeleccionada, setComandaSeleccionada] = useState(null);
  const [rendicionesPendientes, setRendicionesPendientes] = useState([]);
  const navigate = useNavigate();
  const { usuario, selectedLocal } = useAuth();
  const { cajaAbierta, setCajaAbierta } = useCaja();
  const superadminSinLocal = usuario?.rol === 'superadmin' && !selectedLocal?._id;

  const cargarPendientes = async () => {
    if (!cajaAbierta || superadminSinLocal) {
      setPendientes([]);
      setRendicionesPendientes([]);
      return;
    }
    setCargandoPendientes(true);
    try {
      const [resPendientes, resRendiciones] = await Promise.all([
        obtenerComandasPendientesCaja(),
        obtenerRendicionesPendientesCaja()
      ]);
      setPendientes(resPendientes.data || []);
      setRendicionesPendientes(resRendiciones.data || []);
    } catch (err) {
      setPendientes([]);
      setRendicionesPendientes([]);
    } finally {
      setCargandoPendientes(false);
    }
  };

  useEffect(() => {
    cargarPendientes();
  }, [cajaAbierta, superadminSinLocal, selectedLocal?._id]);

  const handleAbrir = async () => {
    if (superadminSinLocal) {
      alert('Debes seleccionar un local antes de abrir caja.');
      return;
    }

    const monto = parseFloat(montoInicial);
    if (isNaN(monto) || monto <= 0) {
      alert('❌ Ingresa un monto válido.');
      return;
    }

    try {
      await abrirCaja({ monto_inicial: monto });
      alert('✅ Caja abierta correctamente.');
      setCajaAbierta(true);
      setMontoInicial('');
      await cargarPendientes();
      navigate('/pos');
    } catch (err) {
      alert(err.response?.data?.error || '❌ Ya hay una caja abierta.');
    }
  };

  const handleCerrar = async () => {
    if (superadminSinLocal) {
      alert('Debes seleccionar un local antes de cerrar caja.');
      return;
    }

    try {
      const res = await cerrarCaja({ nombre: usuario?.nombre });
      setCajaAbierta(false);
      setPendientes([]);
      setRendicionesPendientes([]);
      navigate('/ticket-caja', { state: { resumen: res.data.resumen } });
    } catch (err) {
      alert(err.response?.data?.error || '❌ No hay caja abierta.');
    }
  };

  const abrirCobroComanda = (comanda) => {
    setComandaSeleccionada(comanda);
    setModalCobroOpen(true);
  };

  const handleCobrarComanda = async ({ tipoPago, tipoPedido, montoRecibido, vuelto }) => {
    if (!comandaSeleccionada?._id) return;
    try {
      const res = await cobrarComandaCaja(comandaSeleccionada._id, {
        tipo_pago: tipoPago,
        tipo_pedido: tipoPedido || `restaurante mesa ${comandaSeleccionada?.mesa?.numero || ''}`,
        cobrador_nombre: usuario?.nombre || usuario?.email || '',
        monto_recibido: montoRecibido,
        vuelto
      });
      await cargarPendientes();
      navigate('/ticket', { state: { venta: res.data.venta } });
    } catch (err) {
      alert(err?.response?.data?.error || '❌ No se pudo cobrar la comanda');
    } finally {
      setComandaSeleccionada(null);
    }
  };

  const rendirCobro = async (comandaId) => {
    try {
      await rendirCobroMesaCaja(comandaId);
      await cargarPendientes();
    } catch (err) {
      alert(err?.response?.data?.error || '❌ No se pudo registrar la rendicion');
    }
  };

  return (
    <Box sx={{ maxWidth: 500, mx: 'auto', mt: 4 }}>
      <Typography variant="h5">💰 Caja</Typography>
      {superadminSinLocal && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Selecciona primero un local activo en el menú lateral para abrir o cerrar caja.
        </Alert>
      )}
      <TextField
        fullWidth
        label="Monto Inicial"
        type="number"
        value={montoInicial}
        onChange={(e) => setMontoInicial(e.target.value)}
        sx={{ my: 2 }}
        disabled={cajaAbierta || superadminSinLocal}
      />
      <Button
        variant="contained"
        color="primary"
        onClick={handleAbrir}
        disabled={cajaAbierta || superadminSinLocal}
      >
        Abrir Caja
      </Button>
      <Button
        variant="contained"
        color="error"
        onClick={handleCerrar}
        sx={{ ml: 2 }}
        disabled={superadminSinLocal}
      >
        Cerrar Caja
      </Button>

      <Divider sx={{ my: 3 }} />

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6">Comandas pendientes de cobro</Typography>
        <Button size="small" variant="outlined" onClick={cargarPendientes} disabled={!cajaAbierta || cargandoPendientes || superadminSinLocal}>
          {cargandoPendientes ? 'Actualizando...' : 'Actualizar'}
        </Button>
      </Stack>

      {superadminSinLocal ? (
        <Typography variant="body2" color="text.secondary">
          Selecciona un local para ver comandas pendientes.
        </Typography>
      ) : !cajaAbierta ? (
        <Typography variant="body2" color="text.secondary">
          Abre la caja para ver y cobrar comandas de restaurante.
        </Typography>
      ) : pendientes.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No hay comandas pendientes por ahora.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {pendientes.map((comanda) => (
            <Card key={comanda._id} variant="outlined">
              <CardContent sx={{ py: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography fontWeight={700}>
                      Mesa {comanda?.mesa?.numero || '-'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Mesero: {comanda?.mesero?.nombre || comanda?.mesero?.email || 'Sin asignar'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Items: {Array.isArray(comanda.items) ? comanda.items.length : 0}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography fontWeight={700}>
                      ${Number(comanda.total || 0).toLocaleString('es-CL')}
                    </Typography>
                    <Button
                      size="small"
                      variant="contained"
                      sx={{ mt: 1 }}
                      onClick={() => abrirCobroComanda(comanda)}
                    >
                      Cobrar
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Divider sx={{ my: 3 }} />
      <Typography variant="h6" sx={{ mb: 1 }}>Rendiciones de efectivo pendientes</Typography>
      {superadminSinLocal ? (
        <Typography variant="body2" color="text.secondary">
          Selecciona un local para gestionar rendiciones.
        </Typography>
      ) : !cajaAbierta ? (
        <Typography variant="body2" color="text.secondary">
          Abre la caja para gestionar rendiciones en efectivo.
        </Typography>
      ) : rendicionesPendientes.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No hay rendiciones pendientes.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {rendicionesPendientes.map((comanda) => (
            <Card key={`rend-${comanda._id}`} variant="outlined">
              <CardContent sx={{ py: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography fontWeight={700}>Mesa {comanda?.mesa?.numero || '-'}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Cobrado por: {comanda?.cobradaPor?.nombre || comanda?.mesero?.nombre || comanda?.mesero?.email || 'Mesero'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pago: {comanda?.tipo_pago || 'Efectivo'}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography fontWeight={700}>
                      ${Number(comanda.total || 0).toLocaleString('es-CL')}
                    </Typography>
                    <Button size="small" variant="contained" sx={{ mt: 1 }} onClick={() => rendirCobro(comanda._id)}>
                      Marcar rendido
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <ModalPago
        open={modalCobroOpen}
        onClose={() => {
          setModalCobroOpen(false);
          setComandaSeleccionada(null);
        }}
        onSubmit={handleCobrarComanda}
        total={Number(comandaSeleccionada?.total || 0)}
      />
    </Box>
  );
}
