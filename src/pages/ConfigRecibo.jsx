import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
  Alert
} from '@mui/material';
import VistaTicket from '../components/VistaTicket';
import { guardarConfigRecibo, obtenerConfigRecibo } from '../services/api';

export default function ConfigRecibo() {
  const [form, setForm] = useState({
    nombre: '',
    pie: '',
    imprimir_auto: true,
    copias_auto: 1,
    logo_url: '',
    remove_logo: false
  });
  const [logoFile, setLogoFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [previewVenta, setPreviewVenta] = useState(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await obtenerConfigRecibo();
        const data = res.data || {};
        setForm({
          nombre: data.nombre || 'Ticket de Venta',
          pie: data.pie || '',
          imprimir_auto: data.imprimir_auto !== false,
          copias_auto: data.copias_auto ?? 1,
          logo_url: data.logo_url || '',
          remove_logo: false
        });
        setPreviewVenta({
          numero_pedido: 1,
          fecha: new Date().toISOString(),
          productos: [
            { nombre: 'Producto demo', cantidad: 1, precio_unitario: 2500, observacion: '' }
          ],
          total: 2500,
          tipo_pago: 'efectivo',
          tipo_pedido: '—'
        });
      } catch (err) {
        setError('No se pudo cargar la configuracion.');
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const previewLogo = useMemo(() => {
    if (logoFile) return URL.createObjectURL(logoFile);
    if (form.logo_url && !form.remove_logo) return form.logo_url;
    return '';
  }, [logoFile, form.logo_url, form.remove_logo]);

  useEffect(() => {
    if (!previewVenta) return;
    setPreviewVenta((prev) => ({
      ...prev,
      fecha: new Date().toISOString()
    }));
  }, [form.nombre, form.pie, form.copias_auto, previewLogo]);

  const handleSave = async () => {
    setError('');
    setInfo('');
    try {
      setSaving(true);
      const data = new FormData();
      data.append('nombre', form.nombre);
      data.append('pie', form.pie);
      data.append('imprimir_auto', form.imprimir_auto ? 'true' : 'false');
      data.append('copias_auto', form.copias_auto);
      data.append('remove_logo', form.remove_logo ? 'true' : 'false');
      if (logoFile) {
        data.append('logo', logoFile);
      }
      const res = await guardarConfigRecibo(data);
      const saved = res.data || {};
      setForm((prev) => ({
        ...prev,
        nombre: saved.nombre || prev.nombre,
        pie: saved.pie || '',
        imprimir_auto: saved.imprimir_auto !== false,
        copias_auto: saved.copias_auto ?? prev.copias_auto,
        logo_url: saved.logo_url || '',
        remove_logo: false
      }));
      setLogoFile(null);
      setInfo('Configuracion guardada.');
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo guardar la configuracion.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Typography sx={{ mt: 4 }}>Cargando configuracion...</Typography>;
  }

  return (
    <Box sx={{ mt: 4, px: 2 }}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          maxWidth: 640,
          backgroundColor: 'transparent',
          boxShadow: 'none',
          fontSize: '0.92rem',
          '& .MuiTypography-body1, & .MuiTypography-body2, & .MuiTypography-subtitle2': {
            fontSize: '0.92rem'
          },
          '& .MuiTableCell-root': { fontSize: '0.85rem' }
        }}
      >
        <Typography variant="h5" gutterBottom>Configuracion de Recibos</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Personaliza el ticket que se imprime al finalizar la venta.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {info && <Alert severity="success" sx={{ mb: 2 }}>{info}</Alert>}

        <Stack spacing={2}>
          <TextField
            label="Nombre del recibo"
            value={form.nombre}
            onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Pie de pagina (opcional)"
            value={form.pie}
            onChange={(e) => setForm((prev) => ({ ...prev, pie: e.target.value }))}
            fullWidth
            multiline
            minRows={2}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.imprimir_auto !== false}
                onChange={(e) => setForm((prev) => ({ ...prev, imprimir_auto: e.target.checked }))}
              />
            }
            label="Imprimir automaticamente al vender"
          />
          <TextField
            label="Copias automaticas"
            type="number"
            value={form.copias_auto}
            onChange={(e) => setForm((prev) => ({ ...prev, copias_auto: e.target.value }))}
            inputProps={{ min: 0, max: 5 }}
          />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Logo (opcional)</Typography>
            {previewLogo ? (
              <Box sx={{ mb: 1 }}>
                <img src={previewLogo} alt="Logo" style={{ maxWidth: 120, maxHeight: 80 }} />
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Sin logo configurado.
              </Typography>
            )}
            <Stack direction="row" spacing={1} alignItems="center">
              <Button variant="outlined" component="label">
                Subir logo
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setLogoFile(file);
                      setForm((prev) => ({ ...prev, remove_logo: false }));
                    }
                  }}
                />
              </Button>
              <Button
                variant="text"
                color="error"
                onClick={() => {
                  setLogoFile(null);
                  setForm((prev) => ({ ...prev, remove_logo: true }));
                }}
              >
                Quitar logo
              </Button>
            </Stack>
          </Box>

          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar configuracion'}
          </Button>
        </Stack>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: 3,
          mt: 3,
          maxWidth: 640,
          backgroundColor: 'transparent',
          boxShadow: 'none',
          fontSize: '0.92rem',
          '& .MuiTypography-body1, & .MuiTypography-body2, & .MuiTypography-subtitle2': {
            fontSize: '0.92rem'
          },
          '& .MuiTableCell-root': { fontSize: '0.85rem' }
        }}
      >
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          Vista previa del ticket
        </Typography>
        {previewVenta ? (
          <VistaTicket venta={previewVenta} />
        ) : (
          <Typography color="text.secondary">No hay vista previa disponible.</Typography>
        )}
      </Paper>
    </Box>
  );
}
