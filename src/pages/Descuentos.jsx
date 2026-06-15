import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, MenuItem, Paper, Stack, Switch, TextField,
  Typography
} from '@mui/material';
import { DeleteOutline, EditOutlined } from '@mui/icons-material';
import { crearDescuento, editarDescuento, eliminarDescuento, obtenerDescuentos } from '../services/api';
import { useAuth } from '../context/AuthContext';

const formularioInicial = { nombre: '', tipo: 'porcentaje', valor: '', activo: true };

export default function Descuentos() {
  const { selectedLocal } = useAuth();
  const [descuentos, setDescuentos] = useState([]);
  const [form, setForm] = useState(formularioInicial);
  const [editando, setEditando] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const localActivo = selectedLocal?._id;
    try {
      const res = await obtenerDescuentos();
      setDescuentos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudieron cargar los descuentos');
    }
    return localActivo;
  }, [selectedLocal?._id]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(formularioInicial);
    setError('');
    setAbierto(true);
  };

  const abrirEdicion = (descuento) => {
    setEditando(descuento);
    setForm({
      nombre: descuento.nombre || '',
      tipo: descuento.tipo || 'porcentaje',
      valor: descuento.valor ?? '',
      activo: descuento.activo !== false
    });
    setError('');
    setAbierto(true);
  };

  const guardar = async () => {
    const valor = Number(form.valor);
    if (!form.nombre.trim() || !Number.isFinite(valor) || valor <= 0) {
      setError('Ingresa un nombre y un valor mayor que 0');
      return;
    }
    if (form.tipo === 'porcentaje' && valor > 100) {
      setError('El porcentaje no puede superar 100');
      return;
    }
    setGuardando(true);
    try {
      const payload = { ...form, nombre: form.nombre.trim(), valor };
      if (editando?._id) await editarDescuento(editando._id, payload);
      else await crearDescuento(payload);
      setAbierto(false);
      await cargar();
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo guardar el descuento');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (descuento) => {
    if (!window.confirm(`Eliminar el descuento "${descuento.nombre}"?`)) return;
    try {
      await eliminarDescuento(descuento._id);
      await cargar();
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo eliminar el descuento');
    }
  };

  const describir = (descuento) => descuento.tipo === 'porcentaje'
    ? `${descuento.valor}%`
    : `$${Number(descuento.valor || 0).toLocaleString('es-CL')}`;

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Descuentos</Typography>
          <Typography color="text.secondary">Crea descuentos para ventas completas o productos individuales.</Typography>
        </Box>
        <Button variant="contained" onClick={abrirNuevo}>Nuevo descuento</Button>
      </Stack>
      {error && !abierto && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack spacing={1.5}>
        {descuentos.map((descuento) => (
          <Paper key={descuento._id} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography fontWeight={800}>{descuento.nombre}</Typography>
                <Typography color="text.secondary">
                  {describir(descuento)} · {descuento.activo ? 'Activo' : 'Inactivo'}
                </Typography>
              </Box>
              <Box>
                <IconButton onClick={() => abrirEdicion(descuento)} aria-label="Editar descuento"><EditOutlined /></IconButton>
                <IconButton color="error" onClick={() => eliminar(descuento)} aria-label="Eliminar descuento"><DeleteOutline /></IconButton>
              </Box>
            </Stack>
          </Paper>
        ))}
        {descuentos.length === 0 && <Typography color="text.secondary">No hay descuentos creados.</Typography>}
      </Stack>

      <Dialog open={abierto} onClose={() => setAbierto(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editando ? 'Editar descuento' : 'Nuevo descuento'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField fullWidth label="Nombre" value={form.nombre} sx={{ mb: 2, mt: 1 }}
            onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))} />
          <TextField select fullWidth label="Tipo" value={form.tipo} sx={{ mb: 2 }}
            onChange={(e) => setForm((prev) => ({ ...prev, tipo: e.target.value }))}>
            <MenuItem value="porcentaje">Porcentaje</MenuItem>
            <MenuItem value="fijo">Monto fijo</MenuItem>
          </TextField>
          <TextField fullWidth type="number" label={form.tipo === 'porcentaje' ? 'Porcentaje' : 'Monto fijo'}
            value={form.valor} inputProps={{ min: 0, max: form.tipo === 'porcentaje' ? 100 : undefined }}
            onChange={(e) => setForm((prev) => ({ ...prev, valor: e.target.value }))} />
          <FormControlLabel sx={{ mt: 1 }} control={<Switch checked={form.activo}
            onChange={(e) => setForm((prev) => ({ ...prev, activo: e.target.checked }))} />} label="Disponible en el POS" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAbierto(false)}>Cancelar</Button>
          <Button variant="contained" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
