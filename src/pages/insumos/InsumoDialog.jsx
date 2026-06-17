import { useEffect, useState } from 'react';
import {
  Alert,
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
import {
  crearInsumo,
  crearLoteInsumo,
  editarInsumo,
  registrarMovimientoInsumo
} from '../../services/api';

const emptyForm = {
  nombre: '',
  descripcion: '',
  unidad: 'unid',
  categoria: '',
  stock_minimo: '',
  alerta_vencimiento_dias: '7',
  stock_inicial: '',
  lote_inicial: '',
  vencimiento_inicial: '',
  lote_nuevo: '',
  vencimiento_nuevo: '',
  cantidad_nueva: '',
  stock_total_manual: ''
};

const unidades = [
  { value: 'unid', label: 'Unidad' },
  { value: 'kg', label: 'Kilogramo' },
  { value: 'lt', label: 'Litro' },
  { value: 'pack', label: 'Pack' }
];

export default function InsumoDialog({
  open,
  onClose,
  insumo,
  categorias,
  externalError,
  onInfo,
  onError,
  onSaved
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  const editingId = insumo?._id || null;

  useEffect(() => {
    if (!open) return;
    if (insumo) {
      setForm({
        nombre: insumo.nombre || '',
        descripcion: insumo.descripcion || '',
        unidad: insumo.unidad || 'unid',
        categoria: insumo.categoria?._id || '',
        stock_minimo: insumo.stock_minimo ?? '',
        alerta_vencimiento_dias: insumo.alerta_vencimiento_dias ?? '7',
        stock_inicial: '',
        lote_inicial: '',
        vencimiento_inicial: '',
        lote_nuevo: '',
        vencimiento_nuevo: '',
        cantidad_nueva: '',
        stock_total_manual: insumo.stock_total ?? ''
      });
    } else {
      setForm(emptyForm);
    }
    setLocalError('');
  }, [open, insumo]);

  const handleSave = async () => {
    setLocalError('');
    if (!form.nombre.trim() || !form.unidad) {
      const msg = 'Nombre y unidad son obligatorios.';
      setLocalError(msg);
      onError?.(msg);
      return;
    }

    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      unidad: form.unidad,
      categoria:
        form.categoria && typeof form.categoria === 'object'
          ? form.categoria._id
          : form.categoria || null,
      stock_minimo: form.stock_minimo === '' ? 0 : Number(form.stock_minimo),
      alerta_vencimiento_dias:
        form.alerta_vencimiento_dias === '' ? 7 : Number(form.alerta_vencimiento_dias),
      ...(editingId && form.stock_total_manual !== ''
        ? { stock_total: Number(form.stock_total_manual) }
        : {})
    };

    try {
      setSaving(true);
      if (editingId) {
        const tieneLoteNuevo = form.lote_nuevo.trim() || form.vencimiento_nuevo;
        await editarInsumo(editingId, payload);
        if (tieneLoteNuevo) {
          await crearLoteInsumo(editingId, {
            lote: form.lote_nuevo.trim() || undefined,
            fecha_vencimiento: form.vencimiento_nuevo || undefined,
            cantidad: form.cantidad_nueva === '' ? 0 : Number(form.cantidad_nueva)
          });
        }
        onInfo?.('Insumo actualizado.');
      } else {
        const creado = await crearInsumo(payload);
        const stockInicial = Number(form.stock_inicial);
        if (Number.isFinite(stockInicial) && stockInicial > 0) {
          await registrarMovimientoInsumo(creado.data._id, {
            tipo: 'entrada',
            cantidad: stockInicial,
            lote: form.lote_inicial || undefined,
            fecha_vencimiento: form.vencimiento_inicial || undefined,
            motivo: 'Stock inicial'
          });
        }
        onInfo?.('Insumo creado.');
      }
      onClose?.();
      onSaved?.();
    } catch (err) {
      const msg = err?.response?.data?.error || 'No se pudo guardar el insumo.';
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editingId ? 'Editar producto bodega' : 'Crear producto bodega'}</DialogTitle>
      <DialogContent dividers>
        {(localError || externalError) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {localError || externalError}
          </Alert>
        )}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Nombre"
            value={form.nombre}
            onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
            required
          />
          <TextField
            label="Descripcion"
            value={form.descripcion}
            onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
            multiline
            minRows={2}
          />
          <TextField
            select
            label="Unidad"
            value={form.unidad}
            onChange={(e) => setForm((prev) => ({ ...prev, unidad: e.target.value }))}
          >
            {unidades.map((u) => (
              <MenuItem key={u.value} value={u.value}>
                {u.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Categoria (opcional)"
            value={form.categoria}
            onChange={(e) => setForm((prev) => ({ ...prev, categoria: e.target.value }))}
          >
            <MenuItem value="">Sin categoria</MenuItem>
            {categorias.map((cat) => (
              <MenuItem key={cat._id} value={cat._id}>
                {cat.nombre}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Stock minimo"
            type="number"
            value={form.stock_minimo}
            onChange={(e) => setForm((prev) => ({ ...prev, stock_minimo: e.target.value }))}
          />
          <TextField
            label="Dias alerta vencimiento"
            type="number"
            value={form.alerta_vencimiento_dias}
            onChange={(e) => setForm((prev) => ({ ...prev, alerta_vencimiento_dias: e.target.value }))}
          />
          {editingId && (
            <>
              <TextField
                label="Stock actual"
                type="number"
                value={form.stock_total_manual}
                onChange={(e) => setForm((prev) => ({ ...prev, stock_total_manual: e.target.value }))}
              />
              <Typography variant="subtitle2" color="text.secondary">
                Registrar lote (opcional)
              </Typography>
              <TextField
                label="Lote"
                value={form.lote_nuevo}
                onChange={(e) => setForm((prev) => ({ ...prev, lote_nuevo: e.target.value }))}
              />
              <TextField
                label="Fecha vencimiento"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={form.vencimiento_nuevo}
                onChange={(e) => setForm((prev) => ({ ...prev, vencimiento_nuevo: e.target.value }))}
              />
              <TextField
                label="Cantidad (opcional si defines lote/fecha)"
                type="number"
                value={form.cantidad_nueva}
                onChange={(e) => setForm((prev) => ({ ...prev, cantidad_nueva: e.target.value }))}
              />
            </>
          )}
          {!editingId && (
            <>
              <TextField
                label="Stock inicial (opcional)"
                type="number"
                value={form.stock_inicial}
                onChange={(e) => setForm((prev) => ({ ...prev, stock_inicial: e.target.value }))}
              />
              <TextField
                label="Lote inicial (opcional)"
                value={form.lote_inicial}
                onChange={(e) => setForm((prev) => ({ ...prev, lote_inicial: e.target.value }))}
              />
              <TextField
                label="Vencimiento inicial (opcional)"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={form.vencimiento_inicial}
                onChange={(e) => setForm((prev) => ({ ...prev, vencimiento_inicial: e.target.value }))}
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
