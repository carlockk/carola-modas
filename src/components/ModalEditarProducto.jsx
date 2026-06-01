import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  MenuItem,
  Select,
  FormControl,
  FormHelperText,
  InputLabel,
  Switch,
  FormControlLabel
} from '@mui/material';
import { useState, useEffect, useMemo } from 'react';
import { editarProducto, obtenerCategorias, obtenerOpcionesAgregados } from '../services/api';
import VariantesForm from './VariantesForm';

const esObjectId = (value) => typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);

const extraerCategoriaId = (categoria) => {
  if (!categoria) return '';
  if (typeof categoria === 'string') return esObjectId(categoria) ? categoria : '';
  if (typeof categoria === 'object' && categoria._id && esObjectId(String(categoria._id))) {
    return String(categoria._id);
  }
  return '';
};

export default function ModalEditarProducto({ open, onClose, producto, onActualizado }) {
  const [form, setForm] = useState({
    nombre: '',
    precio: '',
    descripcion: '',
    imagen_url: '',
    categoria: '',
    stock: ''
  });

  const [imagenNueva, setImagenNueva] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [usaVariantes, setUsaVariantes] = useState(false);
  const [variantes, setVariantes] = useState([]);
  const [gruposAgregados, setGruposAgregados] = useState([]);
  const [agregadosOptions, setAgregadosOptions] = useState([]);
  const [agregadosSeleccionados, setAgregadosSeleccionados] = useState([]);
  const [gruposSeleccionados, setGruposSeleccionados] = useState([]);

  useEffect(() => {
    if (producto) {
      setForm({
        nombre: producto.nombre || '',
        precio: producto.precio || '',
        descripcion: producto.descripcion || '',
        imagen_url: producto.imagen_url || '',
        categoria: extraerCategoriaId(producto.categoria),
        stock: producto.stock ?? ''
      });
      setUsaVariantes(Array.isArray(producto.variantes) && producto.variantes.length > 0);
      setVariantes(
        (producto.variantes || []).map((v) => ({
          _id: v._id,
          baseVarianteId: v.baseVarianteId || '',
          nombre: v.nombre || '',
          color: v.color || '',
          talla: v.talla || '',
          sku: v.sku || '',
          precio: v.precio === 0 || v.precio ? String(v.precio) : '',
          stock: v.stock === 0 || v.stock ? String(v.stock) : '',
          agotado: Boolean(v.agotado)
        }))
      );
      const preseleccion = (producto.agregados || [])
        .map((agg) => (typeof agg === 'object' ? agg._id : agg))
        .filter(Boolean)
        .map((id) => String(id));
      setAgregadosSeleccionados(preseleccion);
      setImagenNueva(null);
      setError('');
    }
  }, [producto]);

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

  useEffect(() => {
    const groups = gruposAgregados
      .filter((grupo) => {
        const ids = agregadosByGrupo.get(String(grupo._id)) || [];
        return ids.length > 0 && ids.every((id) => agregadosSeleccionados.includes(id));
      })
      .map((g) => String(g._id));
    setGruposSeleccionados(groups);
  }, [agregadosSeleccionados, gruposAgregados, agregadosByGrupo]);

  const handleChangeAgregados = (value) => {
    const ids = Array.from(new Set((value || []).map((id) => String(id))));
    setAgregadosSeleccionados(ids);
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

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImagen = (e) => {
    const archivo = e.target.files[0];
    if (archivo && !archivo.type.startsWith('image/')) {
      setError('Solo se permiten archivos de imagen');
      return;
    }
    setImagenNueva(archivo);
    setError('');
  };

  const handleSubmit = async () => {
    if (!form.nombre.trim() || !form.precio) {
      setError('Nombre y precio son obligatorios');
      return;
    }

    if (form.imagen_url && !/^https?:\/\/\S+$/i.test(form.imagen_url.trim())) {
      setError('La URL de imagen debe comenzar con http:// o https://');
      return;
    }

    if (!usaVariantes && form.stock !== '' && parseInt(form.stock, 10) < 0) {
      setError('El stock no puede ser negativo');
      return;
    }

    if (usaVariantes) {
      if (variantes.length === 0 || variantes.some((v) => !v.nombre.trim())) {
        setError('Agrega al menos una variante con nombre.');
        return;
      }
    }

    const data = new FormData();
    data.append('nombre', form.nombre.trim());
    data.append('precio', form.precio);
    data.append('descripcion', form.descripcion.trim());
    data.append('imagen_url', form.imagen_url?.trim() || '');
    data.append('categoria', form.categoria || '');
    data.append('controlarStock', 'true');
    if (imagenNueva) {
      data.append('imagen', imagenNueva);
    }
    if (usaVariantes) {
      data.append('stock', '');
      data.append('variantes', JSON.stringify(variantes));
    } else {
      data.append('stock', form.stock !== '' ? parseInt(form.stock, 10) : '');
    }
    data.append('agregados', JSON.stringify(agregadosSeleccionados));

    try {
      setCargando(true);
      await editarProducto(producto._id, data);
      alert('Cambios guardados correctamente');
      onClose();
      onActualizado?.();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || 'Error al guardar los cambios');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Editar Producto</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mt: 1, mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          label="Nombre"
          name="nombre"
          value={form.nombre}
          onChange={handleChange}
          sx={{ mt: 2 }}
        />

        <TextField
          fullWidth
          type="number"
          label="Precio"
          name="precio"
          value={form.precio}
          onChange={handleChange}
          sx={{ mt: 2 }}
        />

        <TextField
          fullWidth
          label="Descripción"
          name="descripcion"
          value={form.descripcion}
          onChange={handleChange}
          sx={{ mt: 2 }}
        />

        <FormControlLabel
          control={
            <Switch
              checked={usaVariantes}
              onChange={(e) => {
                setUsaVariantes(e.target.checked);
                if (!e.target.checked) {
                  setVariantes([]);
                }
              }}
            />
          }
          label="Controlar stock por variantes"
          sx={{ mt: 2 }}
        />

        {!usaVariantes && (
          <TextField
            fullWidth
            type="number"
            label="Stock (opcional)"
            name="stock"
            value={form.stock}
            onChange={handleChange}
            sx={{ mt: 2 }}
          />
        )}

        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel id="categoria-label">Categoría</InputLabel>
          <Select
            labelId="categoria-label"
            name="categoria"
            value={form.categoria}
            onChange={handleChange}
            label="Categoría"
          >
            <MenuItem value="">Sin categoria</MenuItem>
            {categorias.map((cat) => (
              <MenuItem key={cat._id} value={cat._id}>
                {cat.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel id="grupo-agregados-label">Grupos de agregados</InputLabel>
          <Select
            labelId="grupo-agregados-label"
            multiple
            value={gruposSeleccionados}
            onChange={(e) => handleChangeGrupos(e.target.value)}
            label="Grupos de agregados"
          >
            {gruposConCantidad.map((grupo) => (
              <MenuItem key={grupo._id} value={grupo._id} disabled={grupo.opcionesCount === 0}>
                {grupo.categoriaPrincipal ? `${grupo.categoriaPrincipal} / ` : ''}{grupo.titulo}
                {` (${grupo.opcionesCount})`}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            Solo puedes seleccionar titulos que tengan opciones. Crea opciones en Agregados si aparece (0).
          </FormHelperText>
        </FormControl>

        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel id="agregados-label">Agregados</InputLabel>
          <Select
            labelId="agregados-label"
            multiple
            value={agregadosSeleccionados}
            onChange={(e) => handleChangeAgregados(e.target.value)}
            label="Agregados"
          >
            {agregadosOptions.map((agg) => (
              <MenuItem key={agg._id} value={agg._id}>
                {agg.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {usaVariantes && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Variantes
            </Typography>
            <VariantesForm variantes={variantes} onChange={setVariantes} />
          </Box>
        )}

        {form.imagen_url && (
          <Box sx={{ mt: 2, mb: 1, textAlign: 'center' }}>
            <Typography variant="body2">Imagen actual:</Typography>
            <img
              src={
                form.imagen_url.startsWith('/uploads')
                  ? `http://localhost:5000${form.imagen_url}`
                  : form.imagen_url
              }
              alt="preview"
              width={80}
              height={80}
              style={{ objectFit: 'cover', borderRadius: 8 }}
            />
          </Box>
        )}

        <Button variant="outlined" component="label" sx={{ mt: 1 }}>
          Cambiar Imagen
          <input hidden type="file" accept="image/*" onChange={handleImagen} />
        </Button>

        {imagenNueva && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            Nueva imagen: {imagenNueva.name}
          </Typography>
        )}

        <TextField
          fullWidth
          label="URL de imagen (opcional)"
          name="imagen_url"
          value={form.imagen_url}
          onChange={handleChange}
          placeholder="https://..."
          sx={{ mt: 2 }}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={cargando}>
          {cargando ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
