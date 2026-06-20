import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import VariantesForm from './VariantesForm';
import { crearProducto, obtenerCategorias, obtenerOpcionesAgregados } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ProductoForm({ onSuccess, onCancel }) {
  const { usuario, selectedLocal } = useAuth();
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
  const [controlarStock, setControlarStock] = useState(true);
  const [usaVariantes, setUsaVariantes] = useState(false);
  const [variantes, setVariantes] = useState([]);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [cargando, setCargando] = useState(false);
  const [gruposAgregados, setGruposAgregados] = useState([]);
  const [agregadosOptions, setAgregadosOptions] = useState([]);
  const [agregadosSeleccionados, setAgregadosSeleccionados] = useState([]);
  const [gruposSeleccionados, setGruposSeleccionados] = useState([]);

  useEffect(() => {
    obtenerCategorias().then((res) => setCategorias(res.data));
    obtenerOpcionesAgregados()
      .then((res) => {
        setGruposAgregados(res.data?.grupos || []);
        setAgregadosOptions(res.data?.agregados || []);
      })
      .catch(() => {
        setGruposAgregados([]);
        setAgregadosOptions([]);
      });
  }, []);

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
    setControlarStock(true);
    setAgregadosSeleccionados([]);
    setGruposSeleccionados([]);
    setError('');
    setExito('');
  };

  const agregadosByGrupo = useMemo(() => {
    const map = new Map();
    const getGroupIds = (agg) => {
      const fromArray = Array.isArray(agg?.grupos) ? agg.grupos : [];
      const fromLegacy = agg?.grupo ? [agg.grupo] : [];
      return Array.from(new Set([...fromArray, ...fromLegacy].map((id) => String(id || '')).filter(Boolean)));
    };
    agregadosOptions.forEach((agg) => {
      const groupIds = getGroupIds(agg);
      groupIds.forEach((key) => {
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(String(agg._id));
      });
    });
    return map;
  }, [agregadosOptions]);

  const gruposConCantidad = useMemo(
    () =>
      (gruposAgregados || []).map((grupo) => ({
        ...grupo,
        opcionesCount: (agregadosByGrupo.get(String(grupo._id)) || []).length
      })),
    [gruposAgregados, agregadosByGrupo]
  );

  const syncGruposDesdeAgregados = (agregadosIds) => {
    const groups = gruposAgregados
      .filter((grupo) => {
        const ids = agregadosByGrupo.get(String(grupo._id)) || [];
        return ids.length > 0 && ids.every((id) => agregadosIds.includes(id));
      })
      .map((g) => String(g._id));
    setGruposSeleccionados(groups);
  };

  const handleChangeAgregados = (value) => {
    const ids = Array.from(new Set((value || []).map((id) => String(id))));
    setAgregadosSeleccionados(ids);
    syncGruposDesdeAgregados(ids);
  };

  const handleChangeGrupos = (value) => {
    const groupIds = Array.from(new Set((value || []).map((id) => String(id))));
    setGruposSeleccionados(groupIds);
    const nextAgregados = new Set();
    groupIds.forEach((gid) => {
      (agregadosByGrupo.get(gid) || []).forEach((id) => nextAgregados.add(id));
    });
    setAgregadosSeleccionados(Array.from(nextAgregados));
  };

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleImageChange = (event) => {
    const archivo = event.target.files?.[0] || null;
    if (archivo && !archivo.type.startsWith('image/')) {
      setError('Solo se permiten archivos de imagen.');
      return;
    }
    setImagen(archivo);
    setError('');
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    setError('');
    setExito('');
    setCargando(true);

    if (!form.nombre || !form.precio) {
      setError('Nombre y precio son obligatorios.');
      setCargando(false);
      return;
    }
    if (!imagen && !form.imagen_url?.trim()) {
      setError('Debes cargar una imagen desde dispositivo o URL.');
      setCargando(false);
      return;
    }
    if (form.imagen_url?.trim() && !/^https?:\/\/\S+$/i.test(form.imagen_url.trim())) {
      setError('La URL de imagen debe comenzar con http:// o https://');
      setCargando(false);
      return;
    }
    if (controlarStock && !usaVariantes && form.stock && parseInt(form.stock, 10) < 0) {
      setError('El stock no puede ser negativo.');
      setCargando(false);
      return;
    }

    if (controlarStock && usaVariantes) {
      const variantesInvalidas =
        variantes.length === 0 ||
        variantes.some((vari) => !vari.nombre || !vari.nombre.trim());
      if (variantesInvalidas) {
        setError('Agrega al menos una variante con nombre.');
        setCargando(false);
        return;
      }
    }

    const data = new FormData();
    data.append('nombre', form.nombre);
    data.append('precio', form.precio);
    data.append('descripcion', form.descripcion);
    data.append('categoria', form.categoria);
    data.append('imagen_url', form.imagen_url?.trim() || '');
    if (imagen) data.append('imagen', imagen);
    data.append('controlarStock', controlarStock);

    if (controlarStock && usaVariantes) {
      data.append('variantes', JSON.stringify(variantes));
    } else if (controlarStock && form.stock !== '') {
      data.append('stock', parseInt(form.stock, 10));
    }
    data.append('agregados', JSON.stringify(agregadosSeleccionados));

    try {
      const res = await crearProducto(data);
      resetForm();
      setExito('Producto creado correctamente.');
      onSuccess?.(res?.data);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || 'Error al crear el producto. Intentalo nuevamente.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        {exito && <Alert severity="success">{exito}</Alert>}

        {usuario?.rol === 'superadmin' && (
          <Typography variant="body2" color="text.secondary">
            Local activo: {selectedLocal?.nombre || 'Sin seleccionar'}
          </Typography>
        )}

        <TextField
          label="Nombre"
          name="nombre"
          value={form.nombre}
          onChange={handleChange}
          fullWidth
          required
        />

        <TextField
          label="Precio"
          name="precio"
          type="number"
          value={form.precio}
          onChange={handleChange}
          fullWidth
          required
        />

        <TextField
          label="Descripcion"
          name="descripcion"
          value={form.descripcion}
          onChange={handleChange}
          fullWidth
          multiline
          minRows={2}
        />

        <FormControlLabel
          control={
            <Switch
              checked={controlarStock}
              onChange={(event) => {
                const value = event.target.checked;
                setControlarStock(value);
                if (!value) {
                  setUsaVariantes(false);
                  setVariantes([]);
                  setForm((prev) => ({ ...prev, stock: '' }));
                }
              }}
            />
          }
          label="Controlar stock"
        />

        {controlarStock && (
          <>
            <FormControlLabel
              control={
                <Switch
                  checked={usaVariantes}
                  onChange={(event) => {
                    setUsaVariantes(event.target.checked);
                    if (!event.target.checked) {
                      setVariantes([]);
                    }
                  }}
                />
              }
              label="Controlar stock por variantes"
            />

            {!usaVariantes && (
              <TextField
                label="Stock (opcional)"
                name="stock"
                type="number"
                value={form.stock}
                onChange={handleChange}
                fullWidth
              />
            )}
          </>
        )}

        <FormControl fullWidth>
          <InputLabel>Categoria</InputLabel>
          <Select
            label="Categoria"
            name="categoria"
            value={form.categoria}
            onChange={handleChange}
          >
            <MenuItem value="">Sin categoria</MenuItem>
            {categorias.map((cat) => (
              <MenuItem key={cat._id} value={cat._id}>
                {cat.label || cat.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box>
          <Button variant="outlined" component="label">
            Seleccionar imagen
            <input
              hidden
              accept="image/*"
              type="file"
              onChange={handleImageChange}
            />
          </Button>
          {imagen && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Imagen seleccionada: {imagen.name}
            </Typography>
          )}
        </Box>

        <TextField
          label="URL de imagen (opcional)"
          name="imagen_url"
          value={form.imagen_url}
          onChange={handleChange}
          fullWidth
          placeholder="https://..."
        />

        {usaVariantes && (
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
              Variantes
            </Typography>
            <VariantesForm variantes={variantes} onChange={setVariantes} />
          </Box>
        )}

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          {onCancel && (
            <Button variant="outlined" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button variant="contained" type="submit" disabled={cargando}>
            {cargando ? 'Creando...' : 'Crear'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
