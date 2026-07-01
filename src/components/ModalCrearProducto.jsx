import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Typography,
  Switch,
  FormControlLabel,
  Alert,
  Box
} from '@mui/material';
import { useEffect, useState } from 'react';
import { crearProducto, obtenerCategorias } from '../services/api';
import VariantesForm from './VariantesForm';
import { optimizeImageFile } from '../lib/imageUpload';

export default function ModalCrearProducto({
  open,
  onClose,
  onCreado
}) {
  const [form, setForm] = useState({
    nombre: '',
    precio: '',
    descripcion: '',
    categoria: '',
    stock: '',
    imagen_url: ''
  });
  const [imagen, setImagen] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [usaVariantes, setUsaVariantes] = useState(false);
  const [variantes, setVariantes] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (open) {
      obtenerCategorias().then((res) => setCategorias(res.data));
    }
  }, [open]);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const resetForm = () => {
    setForm({
      nombre: '',
      precio: '',
      descripcion: '',
      categoria: '',
      stock: '',
      imagen_url: ''
    });
    setImagen(null);
    setVariantes([]);
    setUsaVariantes(false);
    setError('');
  };

  const handleSubmit = async () => {
    if (cargando) return;

    if (!form.nombre.trim() || !form.precio) {
      setError('Faltan campos obligatorios (nombre y precio).');
      return;
    }

    if (!imagen && !form.imagen_url?.trim()) {
      setError('Debes cargar una imagen desde dispositivo o URL.');
      return;
    }

    if (form.imagen_url?.trim() && !/^https?:\/\/\S+$/i.test(form.imagen_url.trim())) {
      setError('La URL de imagen debe comenzar con http:// o https://');
      return;
    }

    if (!usaVariantes && form.stock && parseInt(form.stock, 10) < 0) {
      setError('El stock no puede ser negativo');
      return;
    }

    if (usaVariantes) {
      if (
        variantes.length === 0 ||
        variantes.some((v) => !v.nombre.trim())
      ) {
        setError('Agrega al menos una variante con nombre.');
        return;
      }
    }

    const data = new FormData();
    data.append('nombre', form.nombre.trim());
    data.append('precio', form.precio);
    data.append('descripcion', form.descripcion.trim());
    data.append('categoria', form.categoria);
    data.append('imagen_url', form.imagen_url?.trim() || '');
    if (imagen) data.append('imagen', imagen);

    if (usaVariantes) {
      data.append('stock', '');
      data.append('variantes', JSON.stringify(variantes));
    } else if (form.stock !== '') {
      data.append('stock', parseInt(form.stock, 10));
    }

    try {
      setCargando(true);
      await crearProducto(data);
      onCreado?.();
      resetForm();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || 'Error al crear producto');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Crear Producto</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="Nombre"
          name="nombre"
          fullWidth
          sx={{ mb: 2 }}
          value={form.nombre}
          onChange={handleChange}
        />
        <TextField
          label="Precio"
          name="precio"
          type="number"
          fullWidth
          sx={{ mb: 2 }}
          value={form.precio}
          onChange={handleChange}
        />
        <TextField
          label="Descripción"
          name="descripcion"
          fullWidth
          sx={{ mb: 2 }}
          value={form.descripcion}
          onChange={handleChange}
        />

        <FormControlLabel
          control={
            <Switch
              checked={usaVariantes}
              onChange={(e) => {
                setUsaVariantes(e.target.checked);
                if (!e.target.checked) setVariantes([]);
              }}
            />
          }
          label="Controlar stock por variantes"
          sx={{ mb: 2 }}
        />

        {!usaVariantes && (
          <TextField
            label="Stock (opcional)"
            name="stock"
            type="number"
            fullWidth
            sx={{ mb: 2 }}
            value={form.stock}
            onChange={handleChange}
          />
        )}

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Categoría</InputLabel>
          <Select
            name="categoria"
            value={form.categoria}
            onChange={handleChange}
            label="Categoría"
          >
            {categorias.map((cat) => (
              <MenuItem key={cat._id} value={cat._id}>
                {cat.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="outlined"
          component="label"
          sx={{ mb: 2 }}
        >
          Seleccionar Imagen
          <input
            hidden
            accept="image/*"
            type="file"
            onChange={async (e) => {
              const archivo = e.target.files?.[0] || null;
              if (archivo && !archivo.type.startsWith('image/')) {
                setError('Solo se permiten archivos de imagen');
                return;
              }
              const imagenOptimizada = archivo ? await optimizeImageFile(archivo) : null;
              setImagen(imagenOptimizada);
              setError('');
            }}
          />
        </Button>

        {imagen && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            Imagen: {imagen.name}
          </Typography>
        )}

        <TextField
          label="URL de imagen (opcional)"
          name="imagen_url"
          fullWidth
          sx={{ mb: 2 }}
          value={form.imagen_url}
          onChange={handleChange}
          placeholder="https://..."
        />

        {usaVariantes && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Variantes
            </Typography>
            <VariantesForm
              variantes={variantes}
              onChange={setVariantes}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            resetForm();
            onClose();
          }}
        >
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={cargando}>
          {cargando ? 'Creando...' : 'Crear'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
