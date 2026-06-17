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
  editarInsumo,
  registrarMovimientoInsumo
} from '../../services/api';

const emptyForm = {
  nombre: '',
  descripcion: '',
  sku: '',
  color: '',
  talla: '',
  imagen_url: '',
  unidad: 'unid',
  categoria: '',
  stock_minimo: '',
  stock_inicial: '',
  stock_total_manual: ''
};

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
  const [imagen, setImagen] = useState(null);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  const editingId = insumo?._id || null;

  useEffect(() => {
    if (!open) return;
    if (insumo) {
      setForm({
        nombre: insumo.nombre || '',
        descripcion: insumo.descripcion || '',
        sku: insumo.sku || '',
        color: insumo.color || '',
        talla: insumo.talla || '',
        imagen_url: insumo.imagen_url || '',
        unidad: insumo.unidad || 'unid',
        categoria: insumo.categoria?._id || '',
        stock_minimo: insumo.stock_minimo ?? '',
        stock_inicial: '',
        stock_total_manual: insumo.stock_total ?? ''
      });
    } else {
      setForm(emptyForm);
    }
    setImagen(null);
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

    if (form.imagen_url?.trim() && !/^https?:\/\/\S+$/i.test(form.imagen_url.trim())) {
      const msg = 'La URL de imagen debe comenzar con http:// o https://';
      setLocalError(msg);
      onError?.(msg);
      return;
    }

    const payload = new FormData();
    payload.append('nombre', form.nombre.trim());
    payload.append('descripcion', form.descripcion.trim());
    payload.append('sku', form.sku.trim());
    payload.append('color', form.color.trim());
    payload.append('talla', form.talla.trim());
    payload.append('imagen_url', form.imagen_url.trim());
    payload.append('unidad', 'unid');
    payload.append(
      'categoria',
      form.categoria && typeof form.categoria === 'object'
        ? form.categoria._id
        : form.categoria || ''
    );
    payload.append('stock_minimo', form.stock_minimo === '' ? '0' : String(Number(form.stock_minimo)));
    if (editingId && form.stock_total_manual !== '') {
      payload.append('stock_total', String(Number(form.stock_total_manual)));
    }
    if (imagen) payload.append('imagen', imagen);

    try {
      setSaving(true);
      if (editingId) {
        await editarInsumo(editingId, payload);
        onInfo?.('Producto bodega actualizado.');
      } else {
        const creado = await crearInsumo(payload);
        const stockInicial = Number(form.stock_inicial);
        if (Number.isFinite(stockInicial) && stockInicial > 0) {
          await registrarMovimientoInsumo(creado.data._id, {
            tipo: 'entrada',
            cantidad: stockInicial,
            motivo: 'Stock inicial'
          });
        }
        onInfo?.('Producto bodega creado.');
      }
      onClose?.();
      onSaved?.();
    } catch (err) {
      const msg = err?.response?.data?.error || 'No se pudo guardar el producto bodega.';
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
            label="Codigo SKU"
            value={form.sku}
            onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Color"
              value={form.color}
              onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Talla"
              value={form.talla}
              onChange={(e) => setForm((prev) => ({ ...prev, talla: e.target.value }))}
              fullWidth
            />
          </Stack>
          {form.imagen_url && (
            <Stack spacing={1} alignItems="flex-start">
              <Typography variant="body2" color="text.secondary">Imagen actual</Typography>
              <img
                src={form.imagen_url}
                alt="Producto bodega"
                style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8 }}
              />
            </Stack>
          )}
          <Button variant="outlined" component="label">
            Seleccionar imagen
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                if (file && !file.type.startsWith('image/')) {
                  const msg = 'Solo se permiten archivos de imagen.';
                  setLocalError(msg);
                  onError?.(msg);
                  return;
                }
                setImagen(file);
              }}
            />
          </Button>
          {imagen && (
            <Typography variant="body2" color="text.secondary">
              Imagen seleccionada: {imagen.name}
            </Typography>
          )}
          <TextField
            label="URL de imagen (opcional)"
            value={form.imagen_url}
            onChange={(e) => setForm((prev) => ({ ...prev, imagen_url: e.target.value }))}
            placeholder="https://..."
          />
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
          {editingId && (
            <TextField
              label="Existencia actual"
              type="number"
              value={form.stock_total_manual}
              onChange={(e) => setForm((prev) => ({ ...prev, stock_total_manual: e.target.value }))}
              helperText="Tambien puedes ajustar la existencia usando entradas y salidas."
            />
          )}
          {!editingId && (
            <TextField
              label="Existencia inicial (opcional)"
              type="number"
              value={form.stock_inicial}
              onChange={(e) => setForm((prev) => ({ ...prev, stock_inicial: e.target.value }))}
            />
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
