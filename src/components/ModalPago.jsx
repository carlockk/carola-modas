import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { Add, Close, DeleteOutline, Payments } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';

const TIPOS_PAGO = ['Efectivo', 'Débito', 'Crédito', 'Transferencia'];
const MONTOS_RAPIDOS = [5000, 10000, 20000];

const formatear = (valor) => `$${Number(valor || 0).toLocaleString('es-CL')}`;

export default function ModalPago({ open, onClose, onSubmit, total = 0 }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const totalNumerico = Math.round(Number(total) || 0);

  const [tipoPago, setTipoPago] = useState('Efectivo');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [dividirPago, setDividirPago] = useState(false);
  const [pagos, setPagos] = useState([]);
  const [tipoPagoParcial, setTipoPagoParcial] = useState('Efectivo');
  const [montoParcial, setMontoParcial] = useState('');
  const [montoRecibidoParcial, setMontoRecibidoParcial] = useState('');
  const [efectivoDividido, setEfectivoDividido] = useState(null);

  const pagado = useMemo(
    () => pagos.reduce((sum, pago) => sum + (Number(pago.monto) || 0), 0),
    [pagos]
  );
  const restante = Math.max(totalNumerico - pagado, 0);

  const vueltoRapido = useMemo(() => {
    if (montoRecibido === '') return null;
    const recibido = Number(montoRecibido);
    if (!Number.isFinite(recibido)) return null;
    return recibido - totalNumerico;
  }, [montoRecibido, totalNumerico]);

  const vueltoParcial = useMemo(() => {
    if (montoRecibidoParcial === '') return null;
    const recibido = Number(montoRecibidoParcial);
    const aplicado = montoParcial === '' ? restante : Number(montoParcial);
    if (!Number.isFinite(recibido) || !Number.isFinite(aplicado)) return null;
    return recibido - aplicado;
  }, [montoParcial, montoRecibidoParcial, restante]);

  const limpiarFormulario = () => {
    setTipoPago('Efectivo');
    setMontoRecibido('');
    setDividirPago(false);
    setPagos([]);
    setTipoPagoParcial('Efectivo');
    setMontoParcial('');
    setMontoRecibidoParcial('');
    setEfectivoDividido(null);
  };

  useEffect(() => {
    if (!open) limpiarFormulario();
  }, [open]);

  const handleClose = () => {
    onClose();
    limpiarFormulario();
  };

  const seleccionarPagoRapido = (tipo) => {
    setTipoPago(tipo);
    if (tipo !== 'Efectivo') setMontoRecibido('');
  };

  const seleccionarPagoParcial = (tipo) => {
    setTipoPagoParcial(tipo);
    if (tipo !== 'Efectivo') setMontoRecibidoParcial('');
  };

  const agregarPagoParcial = () => {
    if (!tipoPagoParcial) return alert('Selecciona un medio de pago');
    if (restante <= 0) return;

    const monto = montoParcial === '' ? restante : Number(montoParcial);
    if (!Number.isFinite(monto) || monto <= 0) {
      return alert('Ingresa un monto válido');
    }
    if (monto > restante) {
      return alert('El monto no puede superar el saldo pendiente');
    }

    if (tipoPagoParcial === 'Efectivo' && montoRecibidoParcial !== '') {
      const recibido = Number(montoRecibidoParcial);
      if (!Number.isFinite(recibido) || recibido < monto) {
        return alert('El efectivo recibido debe cubrir el monto aplicado');
      }
      setEfectivoDividido({ recibido, vuelto: recibido - monto });
    }

    setPagos((prev) => [...prev, { tipo: tipoPagoParcial, monto: Math.round(monto) }]);
    setMontoParcial('');
    setMontoRecibidoParcial('');
  };

  const quitarPagoParcial = (index) => {
    const pago = pagos[index];
    setPagos((prev) => prev.filter((_, i) => i !== index));
    if (pago?.tipo === 'Efectivo') {
      setEfectivoDividido(null);
    }
  };

  const handleEnviar = () => {
    let pagosFinales = [];
    let montoRecibidoFinal = null;
    let vueltoFinal = null;

    if (dividirPago) {
      if (restante > 0) {
        return alert('Falta completar el total de la venta');
      }
      pagosFinales = pagos;
      montoRecibidoFinal = efectivoDividido?.recibido ?? null;
      vueltoFinal = efectivoDividido?.vuelto ?? null;
    } else {
      if (!tipoPago) return alert('Debes seleccionar un tipo de pago');
      if (tipoPago === 'Efectivo' && montoRecibido !== '') {
        const recibido = Number(montoRecibido);
        if (!Number.isFinite(recibido) || recibido < totalNumerico) {
          return alert('El monto recibido debe ser mayor o igual al total');
        }
        montoRecibidoFinal = recibido;
        vueltoFinal = recibido - totalNumerico;
      }
      pagosFinales = [{ tipo: tipoPago, monto: totalNumerico }];
    }

    const tipoPagoFinal = pagosFinales.length > 1 ? 'Mixto' : pagosFinales[0]?.tipo || tipoPago;

    onSubmit({
      tipoPago: tipoPagoFinal,
      tipoPedido: '',
      montoRecibido: montoRecibidoFinal,
      vuelto: vueltoFinal,
      pagos: pagosFinales
    });
    handleClose();
  };

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={open}
      onClose={handleClose}
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 460,
          height: isMobile ? '92vh' : '100%',
          p: 2,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          borderTopLeftRadius: isMobile ? 12 : 0,
          borderTopRightRadius: isMobile ? 12 : 0
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={900}>Cobrar venta</Typography>
          <Typography variant="body2" color="text.secondary">Total</Typography>
        </Box>
        <IconButton onClick={handleClose} aria-label="Cerrar cobro">
          <Close />
        </IconButton>
      </Box>

      <Typography sx={{ fontSize: '2.4rem', lineHeight: 1.1, fontWeight: 900, my: 1 }}>
        {formatear(totalNumerico)}
      </Typography>

      <Divider sx={{ my: 1.5 }} />

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button
          variant={!dividirPago ? 'contained' : 'outlined'}
          fullWidth
          onClick={() => setDividirPago(false)}
          sx={{ minHeight: 48, fontWeight: 800 }}
        >
          Pago único
        </Button>
        <Button
          variant={dividirPago ? 'contained' : 'outlined'}
          fullWidth
          onClick={() => setDividirPago(true)}
          sx={{ minHeight: 48, fontWeight: 800 }}
        >
          Dividir pago
        </Button>
      </Stack>

      {!dividirPago ? (
        <Stack spacing={2}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {TIPOS_PAGO.map((tipo) => (
              <Button
                key={tipo}
                variant={tipoPago === tipo ? 'contained' : 'outlined'}
                onClick={() => seleccionarPagoRapido(tipo)}
                sx={{ minHeight: 70, fontWeight: 900, textTransform: 'none' }}
              >
                {tipo}
              </Button>
            ))}
          </Box>

          {tipoPago === 'Efectivo' && (
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {[...new Set([...MONTOS_RAPIDOS, totalNumerico])].map((monto) => (
                  <Button
                    key={monto}
                    variant={Number(montoRecibido) === monto ? 'contained' : 'outlined'}
                    onClick={() => setMontoRecibido(String(monto))}
                    sx={{ minHeight: 42, fontWeight: 800 }}
                  >
                    {formatear(monto)}
                  </Button>
                ))}
              </Stack>
              <TextField
                label="Con cuánto paga"
                type="number"
                value={montoRecibido}
                onChange={(e) => setMontoRecibido(e.target.value)}
                inputProps={{ min: 0, step: 1 }}
              />
              {vueltoRapido !== null && (
                <Alert severity={vueltoRapido < 0 ? 'warning' : 'success'} sx={{ fontSize: '1.05rem' }}>
                  {vueltoRapido < 0
                    ? `Faltan ${formatear(Math.abs(vueltoRapido))}`
                    : `Vuelto a entregar: ${formatear(vueltoRapido)}`}
                </Alert>
              )}
            </Stack>
          )}
        </Stack>
      ) : (
        <Stack spacing={1.5}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Pagado</Typography>
              <Typography fontWeight={900}>{formatear(pagado)}</Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">Pendiente</Typography>
              <Typography fontWeight={900} color={restante > 0 ? 'error.main' : 'success.main'}>
                {formatear(restante)}
              </Typography>
            </Box>
          </Box>

          {pagos.length > 0 && (
            <Stack spacing={0.75}>
              {pagos.map((pago, index) => (
                <Box
                  key={`${pago.tipo}-${index}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    py: 0.75,
                    borderBottom: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <Box>
                    <Typography fontWeight={800}>{pago.tipo}</Typography>
                    <Typography variant="body2" color="text.secondary">{formatear(pago.monto)}</Typography>
                  </Box>
                  <IconButton color="error" onClick={() => quitarPagoParcial(index)} aria-label="Quitar pago">
                    <DeleteOutline />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          )}

          <Divider />

          <Typography fontWeight={900}>Agregar pago</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {TIPOS_PAGO.map((tipo) => (
              <Button
                key={tipo}
                variant={tipoPagoParcial === tipo ? 'contained' : 'outlined'}
                onClick={() => seleccionarPagoParcial(tipo)}
                disabled={restante <= 0}
                sx={{ minHeight: 58, fontWeight: 900, textTransform: 'none' }}
              >
                {tipo}
              </Button>
            ))}
          </Box>
          <TextField
            label="Monto a aplicar"
            type="number"
            value={montoParcial}
            onChange={(e) => setMontoParcial(e.target.value)}
            placeholder={String(restante)}
            disabled={restante <= 0}
            inputProps={{ min: 0, max: restante, step: 1 }}
          />

          {tipoPagoParcial === 'Efectivo' && (
            <>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {[...new Set([...MONTOS_RAPIDOS, restante])].filter((monto) => monto > 0).map((monto) => (
                  <Button
                    key={monto}
                    variant={Number(montoRecibidoParcial) === monto ? 'contained' : 'outlined'}
                    onClick={() => setMontoRecibidoParcial(String(monto))}
                    disabled={restante <= 0}
                    sx={{ minHeight: 42, fontWeight: 800 }}
                  >
                    {formatear(monto)}
                  </Button>
                ))}
              </Stack>
              <TextField
                label="Efectivo recibido"
                type="number"
                value={montoRecibidoParcial}
                onChange={(e) => setMontoRecibidoParcial(e.target.value)}
                disabled={restante <= 0}
                inputProps={{ min: 0, step: 1 }}
              />
              {vueltoParcial !== null && (
                <Alert severity={vueltoParcial < 0 ? 'warning' : 'success'}>
                  {vueltoParcial < 0
                    ? `Faltan ${formatear(Math.abs(vueltoParcial))}`
                    : `Vuelto de este pago: ${formatear(vueltoParcial)}`}
                </Alert>
              )}
            </>
          )}

          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={agregarPagoParcial}
            disabled={restante <= 0}
            sx={{ minHeight: 48, fontWeight: 900 }}
          >
            Agregar al pago
          </Button>
        </Stack>
      )}

      <Box sx={{ flex: 1 }} />

      <Button
        variant="contained"
        size="large"
        startIcon={<Payments />}
        onClick={handleEnviar}
        disabled={dividirPago && restante > 0}
        sx={{ mt: 2, minHeight: 56, fontWeight: 900 }}
      >
        Confirmar venta
      </Button>
    </Drawer>
  );
}
