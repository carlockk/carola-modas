import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { obtenerMovimientosInsumo, registrarMovimientoInsumo } from '../../services/api';

const buildEmptyForm = (tipo) => ({
  tipo: tipo || 'entrada',
  cantidad: '',
  nota: ''
});

export default function MovimientoDialog({
  open,
  onClose,
  insumo,
  tipoFijo,
  tipoInicial,
  onInfo,
  onError,
  onRefreshInsumos,
  onUpdateMovimientos
}) {
  const [form, setForm] = useState(buildEmptyForm('entrada'));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const tipo = tipoFijo ? (tipoInicial || 'entrada') : 'entrada';
    setForm(buildEmptyForm(tipo));
  }, [open, tipoFijo, tipoInicial]);

  const handleMovimiento = async () => {
    if (!insumo?._id || saving) return;
    const cantidad = Number(form.cantidad);
    const stockActual = Number(insumo?.stock_total || 0);
    if (!Number.isFinite(cantidad) || cantidad < 0) {
      onError?.('Ingresa una cantidad válida.');
      return;
    }

    let tipoFinal = form.tipo;
    let cantidadFinal = cantidad;
    let notaFinal = form.nota || '';

    if (cantidadFinal <= 0) {
      onError?.('Ingresa una cantidad válida.');
      return;
    }

    if (form.tipo === 'salida' && cantidadFinal > stockActual) {
      onError?.('La salida supera la existencia disponible.');
      return;
    }

    const payload = {
      tipo: tipoFinal,
      cantidad: cantidadFinal,
      nota: notaFinal || undefined
    };
    try {
      setSaving(true);
      await registrarMovimientoInsumo(insumo._id, payload);
      onInfo?.('Movimiento registrado.');
      setForm(buildEmptyForm(tipoFijo ? (tipoInicial || 'entrada') : 'entrada'));
      onRefreshInsumos?.();
      const res = await obtenerMovimientosInsumo(insumo._id);
      onUpdateMovimientos?.(res.data || []);
    } catch (err) {
      onError?.(err?.response?.data?.error || 'No se pudo registrar el movimiento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {tipoFijo && tipoInicial === 'salida'
          ? `Salida - ${insumo?.nombre || ''}`
          : `Movimientos - ${insumo?.nombre || ''}`}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {!tipoFijo ? (
            <TextField
              select
              label="Tipo"
              value={form.tipo}
              onChange={(e) => setForm((prev) => ({ ...prev, tipo: e.target.value }))}
            >
              <MenuItem value="entrada">Entrada</MenuItem>
              <MenuItem value="salida">Salida</MenuItem>
            </TextField>
          ) : (
            <TextField
              label="Tipo"
              value={form.tipo === 'entrada' ? 'Entrada' : 'Salida'}
              disabled
            />
          )}
          <TextField
            label={form.tipo === 'salida' ? 'Cantidad a descontar' : 'Cantidad a ingresar'}
            type="number"
            value={form.cantidad}
            onChange={(e) => setForm((prev) => ({ ...prev, cantidad: e.target.value }))}
            helperText={form.tipo === 'salida' ? `Existencia actual: ${Number(insumo?.stock_total || 0)}` : ''}
          />
          <TextField
            label="Nota (opcional)"
            value={form.nota}
            onChange={(e) => setForm((prev) => ({ ...prev, nota: e.target.value }))}
            multiline
            minRows={2}
          />
          <Button variant="contained" onClick={handleMovimiento} disabled={saving}>
            {saving ? 'Registrando...' : 'Registrar movimiento'}
          </Button>
        </Stack>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            El historial completo está disponible en “Ver historial de E/S”.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
