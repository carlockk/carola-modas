import { useEffect, useState, Fragment, useMemo, useCallback } from 'react';

import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  DialogContentText,
  Button,
  Snackbar,
  Alert,
  Pagination,
  Stack,
  Chip,
  Collapse,
  Skeleton,
  List,
  ListItem,
  ListItemText,
  MenuItem
} from '@mui/material';

import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

import {
  obtenerProductos,
  obtenerInsumos,
  eliminarProducto,
  obtenerCategorias,
  obtenerProductosBase,
  crearProductoBase,
  crearProducto,
  usarProductoBaseEnLocal,
  obtenerLocales,
  FILES_BASE,
} from '../services/api';

import ModalEditarProducto from '../components/ModalEditarProducto';
import BuscadorProducto from '../components/BuscadorProducto';
import ImageWithSkeleton from '../components/ImageWithSkeleton';
import ProductoForm from '../components/ProductoForm';
import VariantesForm from '../components/VariantesForm';
import { useAuth } from '../context/AuthContext';
import { optimizeImageFile } from '../lib/imageUpload';

const BASE_URL = FILES_BASE;

const normalizarTexto = (valor = '') =>
  String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const buildCategoryLabelMap = (items) => {
  const byId = new Map(items.map((cat) => [cat._id, cat]));
  const cache = new Map();

  const buildLabel = (cat, stack = new Set()) => {
    if (!cat) return '';
    if (cache.has(cat._id)) return cache.get(cat._id);
    if (stack.has(cat._id)) return cat.nombre || '';
    stack.add(cat._id);
    const parent = cat.parent ? byId.get(cat.parent) : null;
    const label = parent ? `${buildLabel(parent, stack)} / ${cat.nombre}` : cat.nombre || '';
    cache.set(cat._id, label);
    return label;
  };

  return items.map((cat) => ({
    ...cat,
    label: buildLabel(cat)
  }));
};

export default function Productos() {
  const { usuario, selectedLocal } = useAuth();
  const puedeEliminar = usuario?.rol !== 'cajero';
  const esSuperadmin = usuario?.rol === 'superadmin';
  const [productos, setProductos] = useState([]);
  const [insumosBodega, setInsumosBodega] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [openEditar, setOpenEditar] = useState(false);
  const [detalleAbierto, setDetalleAbierto] = useState(null);
  const [productoStockModal, setProductoStockModal] = useState(null);
  const [openCrear, setOpenCrear] = useState(false);
  const [openBase, setOpenBase] = useState(false);
  const [openBaseCreate, setOpenBaseCreate] = useState(false);
  const [openBaseUse, setOpenBaseUse] = useState(false);
  const [bases, setBases] = useState([]);
  const [baseSeleccionada, setBaseSeleccionada] = useState(null);
  const [baseUseForm, setBaseUseForm] = useState({
    precio: '',
    controlarStock: true,
    stock: ''
  });
  const [baseUseVariantes, setBaseUseVariantes] = useState([]);
  const [locales, setLocales] = useState([]);
  const [targetLocalId, setTargetLocalId] = useState('');
  const [usandoTodasBases, setUsandoTodasBases] = useState(false);
  const [baseForm, setBaseForm] = useState({
    nombre: '',
    descripcion: '',
    categoria: ''
  });
  const [baseImagen, setBaseImagen] = useState(null);
  const [baseVariantes, setBaseVariantes] = useState([]);
  const [baseError, setBaseError] = useState('');
  const [baseGuardando, setBaseGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [notificacionesGuardado, setNotificacionesGuardado] = useState([]);
  const [imagenAmpliada, setImagenAmpliada] = useState(null);
  const [loadingCatalogo, setLoadingCatalogo] = useState(true);

  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [precioMin, setPrecioMin] = useState('');
  const [precioMax, setPrecioMax] = useState('');
  const [stockMin, setStockMin] = useState('');

  const [paginaActual, setPaginaActual] = useState(1);
  const productosPorPagina = 10;

  const tieneVariantes = (prod) =>
    Array.isArray(prod?.variantes) && prod.variantes.length > 0;

  const obtenerStockTotal = (prod) => {
    // Si viene el virtual desde la API, úsalo
    if (typeof prod.stock_total === 'number') return prod.stock_total;

    // Si hay variantes, suma sus stocks
    if (Array.isArray(prod.variantes) && prod.variantes.length > 0) {
      return prod.variantes.reduce(
        (acc, vari) => acc + (Number(vari.stock) || 0),
        0
      );
    }

    // Si no hay variantes, usa stock base
    return Number(prod.stock) || 0;
  };

  const cargarProductosYCategorias = useCallback(async () => {
    setLoadingCatalogo(true);
    try {
      const [resProd, resCat] = await Promise.all([
        obtenerProductos(),
        obtenerCategorias()
      ]);

      const categoriasConEtiqueta = buildCategoryLabelMap(resCat.data || []);
      const productosOrdenados = ordenarProductosPorCategoria(
        resProd.data,
        categoriasConEtiqueta
      );

      setProductos(productosOrdenados);
      setCategorias(categoriasConEtiqueta);
    } finally {
      setLoadingCatalogo(false);
    }
  }, []);

  const cargarInsumosBodega = useCallback(async () => {
    const resInsumos = await obtenerInsumos();
    setInsumosBodega(Array.isArray(resInsumos.data) ? resInsumos.data : []);
  }, []);

  const cargarDatos = useCallback(async ({ incluirBodega = true } = {}) => {
    await cargarProductosYCategorias();
    if (incluirBodega) {
      cargarInsumosBodega().catch(() => setInsumosBodega([]));
    }
  }, [cargarProductosYCategorias, cargarInsumosBodega]);

  useEffect(() => {
    cargarDatos();
  }, [selectedLocal?._id, cargarDatos]);

  useEffect(() => {
    if (!esSuperadmin) return;
    obtenerLocales()
      .then((res) => setLocales(res.data || []))
      .catch(() => setLocales([]));
  }, [esSuperadmin]);

  const ordenarProductosPorCategoria = (prods, cats) => {
    if (!Array.isArray(cats) || cats.length === 0) {
      return [...prods];
    }

    const ordenIds = cats.map((c) => c._id);
    const ordenados = [];
    const usados = new Set();

    ordenIds.forEach((catId) => {
      prods
        .filter((p) => p.categoria?._id === catId)
        .forEach((p) => {
          ordenados.push(p);
          usados.add(p._id);
        });
    });

    // Agrega productos sin categoria o con categoria no encontrada
    prods
      .filter((p) => !usados.has(p._id))
      .forEach((p) => ordenados.push(p));

    return ordenados;
  };

  const handleEliminarClick = (producto) => {
    if (!puedeEliminar) return;
    setProductoSeleccionado(producto);
    setOpenConfirm(true);
  };

  const handleConfirmarEliminar = async () => {
    if (!productoSeleccionado) return;

    await eliminarProducto(productoSeleccionado._id);
    setOpenConfirm(false);
    setProductoSeleccionado(null);
    cargarProductosYCategorias();
  };

  const handleEditarClick = (producto) => {
    setProductoSeleccionado(producto);
    setOpenEditar(true);
  };

  const handleCerrarEditar = (_event, reason) => {
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
    setOpenEditar(false);
  };

  const handleCerrarCrear = (_event, reason) => {
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
    setOpenCrear(false);
  };

  const toggleDetalle = (id) => {
    setDetalleAbierto((prev) => (prev === id ? null : id));
  };

  const handleProductoCreado = async () => {
    await cargarProductosYCategorias();
    setPaginaActual(1);
    setOpenCrear(false);
    setMensaje('Producto creado correctamente');
  };

  const pushNotificacionGuardado = useCallback((texto, severity = 'success') => {
    setNotificacionesGuardado((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        texto,
        severity
      }
    ]);
  }, []);

  const handleBackgroundSaveProducto = useCallback(
    ({ data, nombre }) => {
      setOpenCrear(false);

      crearProducto(data)
        .then(async () => {
          pushNotificacionGuardado(`Se guardo producto: ${nombre}`);
          await cargarProductosYCategorias();
          setPaginaActual(1);
        })
        .catch((err) => {
          pushNotificacionGuardado(
            err?.response?.data?.error || `No se pudo guardar producto: ${nombre}`,
            'error'
          );
        });
    },
    [cargarProductosYCategorias, pushNotificacionGuardado]
  );

  const handleAbrirBases = async () => {
    try {
      const res = await obtenerProductosBase();
      setBases(res.data || []);
      setOpenBase(true);
    } catch (err) {
      alert('No se pudo cargar el catalogo base');
    }
  };

  const handleUsarBase = async (base) => {
    setBaseSeleccionada(base);
    setBaseUseForm({ precio: '', controlarStock: true, stock: '' });
    setBaseUseVariantes([]);
    setTargetLocalId('');
    setOpenBaseUse(true);
  };

  const handleUsarTodasBases = async () => {
    if (!Array.isArray(bases) || bases.length === 0) {
      alert('No hay productos en el catalogo base para usar.');
      return;
    }

    const localDestino = esSuperadmin
      ? (targetLocalId || selectedLocal?._id)
      : undefined;

    if (esSuperadmin && !localDestino) {
      alert('Selecciona un local destino para usar todos los productos.');
      return;
    }
    if (!window.confirm('Se intentaran agregar todos los productos del catalogo base. Deseas continuar?')) {
      return;
    }

    setUsandoTodasBases(true);

    try {
      const resultados = await Promise.allSettled(
        bases.map((base) =>
          usarProductoBaseEnLocal(
            base._id,
            { precio: 0, controlarStock: 'false' },
            localDestino
          )
        )
      );

      let agregados = 0;
      let existentes = 0;
      let errores = 0;

      resultados.forEach((resultado) => {
        if (resultado.status === 'fulfilled') {
          agregados += 1;
          return;
        }
        const mensajeError = resultado.reason?.response?.data?.error || '';
        if (String(mensajeError).toLowerCase().includes('ya existe')) {
          existentes += 1;
        } else {
          errores += 1;
        }
      });

      setMensaje(
        `Carga masiva finalizada: ${agregados} agregados, ${existentes} ya existentes, ${errores} con error`
      );
      await cargarProductosYCategorias();
      setOpenBase(false);
    } catch (_err) {
      alert('No se pudo completar la carga masiva');
    } finally {
      setUsandoTodasBases(false);
    }
  };

  const confirmarUsarBase = async () => {
    if (!baseSeleccionada) return;
    const precioNum = Number(baseUseForm.precio);
    if (Number.isNaN(precioNum)) {
      alert('Precio invalido');
      return;
    }
    if (esSuperadmin && !targetLocalId && selectedLocal?._id) {
      // usa el local activo si no se eligio otro
      setTargetLocalId(selectedLocal._id);
    }
    if (esSuperadmin && !targetLocalId && !selectedLocal?._id) {
      alert('Selecciona un local destino');
      return;
    }

    const payload = {
      precio: precioNum,
      controlarStock: String(baseUseForm.controlarStock)
    };
    if (baseSeleccionada?.sourceProductoLocalId) {
      payload.sourceProductoLocalId = baseSeleccionada.sourceProductoLocalId;
    }

    if (baseUseForm.controlarStock) {
      if (baseUseVariantes.length > 0) {
        payload.variantes = baseUseVariantes;
      } else if (baseUseForm.stock !== '') {
        payload.stock = baseUseForm.stock;
      }
    }

    try {
      await usarProductoBaseEnLocal(
        baseSeleccionada._id,
        payload,
        esSuperadmin ? (targetLocalId || selectedLocal?._id) : undefined
      );
      setOpenBaseUse(false);
      setOpenBase(false);
      setMensaje('Producto agregado desde catalogo base');
      cargarProductosYCategorias();
    } catch (err) {
      alert(err?.response?.data?.error || 'No se pudo agregar el producto');
    }
  };

  const handleUsarEnOtroLocal = (prod) => {
    if (!prod?.productoBaseId) {
      alert('Este producto no tiene base asociada.');
      return;
    }
    const base = {
      _id: prod.productoBaseId,
      nombre: prod.nombre,
      sourceProductoLocalId: prod._id
    };
    setBaseSeleccionada(base);
    setBaseUseForm({ precio: String(prod.precio || ''), controlarStock: true, stock: '' });
    setBaseUseVariantes([]);
    setTargetLocalId('');
    setOpenBaseUse(true);
  };

  const resetBaseForm = () => {
    setBaseForm({ nombre: '', descripcion: '', categoria: '' });
    setBaseImagen(null);
    setBaseVariantes([]);
    setBaseError('');
  };

  const handleCrearBase = async () => {
    if (baseGuardando) return;
    if (!baseForm.nombre.trim()) {
      setBaseError('El nombre es obligatorio');
      return;
    }
    try {
      setBaseGuardando(true);
      const data = new FormData();
      data.append('nombre', baseForm.nombre.trim());
      data.append('descripcion', baseForm.descripcion.trim());
      data.append('categoria', baseForm.categoria || '');
      if (baseImagen) {
        data.append('imagen', baseImagen);
      }
      if (baseVariantes.length > 0) {
        data.append('variantes', JSON.stringify(baseVariantes));
      }
      await crearProductoBase(data);
      resetBaseForm();
      setOpenBaseCreate(false);
      handleAbrirBases();
      setMensaje('Producto base creado');
    } catch (err) {
      setBaseError(err?.response?.data?.error || 'No se pudo crear el producto base');
    } finally {
      setBaseGuardando(false);
    }
  };

  const handleCerrarMensaje = () => setMensaje('');

  const optimizarCloudinary = (url, transformacion) => {
    const value = String(url || '');
    if (!value.includes('res.cloudinary.com') || !value.includes('/upload/')) return value;
    const [prefix, rest] = value.split('/upload/');
    const partes = rest.split('/');
    const primeraParte = partes[0] || '';
    const tieneTransformacion =
      primeraParte.includes(',') || /^(f_|q_|w_|h_|c_|g_|e_|dpr_|ar_)/.test(primeraParte);
    const resto = /^v\d+/.test(primeraParte) || !tieneTransformacion ? partes : partes.slice(1);
    return `${prefix}/upload/${transformacion}/${resto.join('/')}`;
  };

  const obtenerImagenUrl = (prod, { miniatura = false } = {}) => {
    if (!prod.imagen_url) return '';
    const url = prod.imagen_url.startsWith('/uploads')
      ? `${BASE_URL}${prod.imagen_url}`
      : prod.imagen_url;
    return miniatura
      ? optimizarCloudinary(url, 'f_auto,q_auto:good,w_160,h_160,c_fill')
      : optimizarCloudinary(url, 'f_auto,q_auto:good,w_900,c_limit');
  };

  const handleAbrirImagen = (prod) => {
    const url = obtenerImagenUrl(prod);
    if (!url) return;
    setImagenAmpliada({ src: url, alt: prod.nombre });
  };

  const handleCerrarImagen = () => setImagenAmpliada(null);

  const stockBodegaIndex = useMemo(
    () =>
      insumosBodega.map((insumo) => ({
        productoId: String(
          typeof insumo?.producto_relacionado === 'object'
            ? insumo?.producto_relacionado?._id || ''
            : insumo?.producto_relacionado || ''
        ).trim(),
        varianteId: String(
          typeof insumo?.variante_relacionada === 'object'
            ? insumo?.variante_relacionada?._id || ''
            : insumo?.variante_relacionada || ''
        ).trim(),
        nombre: normalizarTexto(insumo?.nombre),
        sku: normalizarTexto(insumo?.sku),
        color: normalizarTexto(insumo?.color),
        talla: normalizarTexto(insumo?.talla),
        stock: Number(insumo?.stock_total) || 0
      })),
    [insumosBodega]
  );

  const obtenerStockBodega = (producto, variante = null) => {
    const productoId = String(producto?._id || '').trim();
    const varianteId = String(variante?._id || '').trim();
    const sku = normalizarTexto(variante?.sku || producto?.sku);
    const nombre = normalizarTexto(producto?.nombre);
    const color = normalizarTexto(variante?.color);
    const talla = normalizarTexto(variante?.talla);

    const coincidencias = stockBodegaIndex.filter((item) => {
      if (item.productoId && item.productoId === productoId) {
        if (variante) {
          if (item.varianteId && item.varianteId === varianteId) return true;
          if (item.sku && sku && item.sku === sku) return true;
          if (item.color === color && item.talla === talla) return true;
          return false;
        }
        return !item.varianteId;
      }

      if (variante) {
        if (item.sku && sku && item.sku === sku) return true;
        return item.nombre === nombre && item.color === color && item.talla === talla;
      }

      return item.nombre === nombre && !item.color && !item.talla;
    });

    return coincidencias.reduce((acc, item) => acc + (Number(item.stock) || 0), 0);
  };

  const busquedaNormalizada = useMemo(
    () => busqueda.toLowerCase().trim(),
    [busqueda]
  );

  const filtrarProductos = useMemo(
    () =>
      productos.filter((prod) => {
        const nombreOk = (prod.nombre || '')
          .toLowerCase()
          .includes(busquedaNormalizada);

        const categoriaOk =
          !filtroCategoria || prod.categoria?._id === filtroCategoria;

        const stockTotal = obtenerStockTotal(prod);

        const precioOk =
          (!precioMin || prod.precio >= Number(precioMin)) &&
          (!precioMax || prod.precio <= Number(precioMax));

        const stockOk = !stockMin || stockTotal >= Number(stockMin);

        return nombreOk && categoriaOk && precioOk && stockOk;
      }),
    [productos, busquedaNormalizada, filtroCategoria, precioMin, precioMax, stockMin]
  );

  const totalPaginas = useMemo(
    () => Math.ceil(filtrarProductos.length / productosPorPagina),
    [filtrarProductos.length, productosPorPagina]
  );

  const productosEnPagina = useMemo(
    () =>
      filtrarProductos.slice(
        (paginaActual - 1) * productosPorPagina,
        paginaActual * productosPorPagina
      ),
    [filtrarProductos, paginaActual, productosPorPagina]
  );

  const handleCambioPagina = (_evento, nuevaPagina) => {
    setPaginaActual(nuevaPagina);
  };

  const mostrarSkeletonCatalogo = loadingCatalogo && productos.length === 0;

  return (
    <Box sx={{ mt: 4, px: 2 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          mb: 3
        }}
      >
        <Typography variant="h5" gutterBottom>
          Gestion de Productos
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={handleAbrirBases}>
            Usar del catalogo
          </Button>
          <Button variant="contained" onClick={() => setOpenCrear(true)}>
            Crear nuevo producto
          </Button>
        </Stack>
      </Box>

      {/* Filtros y buscador */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          backgroundColor: 'transparent',
          boxShadow: 'none',
          fontSize: '0.92rem',
          '& .MuiTypography-body1, & .MuiTypography-body2, & .MuiTypography-subtitle2': {
            fontSize: '0.92rem'
          },
          '& .MuiTableCell-root': { fontSize: '0.85rem' }
        }}
      >
        {mostrarSkeletonCatalogo ? (
          <Stack spacing={1.25}>
            <Skeleton variant="rounded" height={44} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Skeleton variant="rounded" height={40} sx={{ flex: 1 }} />
              <Skeleton variant="rounded" height={40} sx={{ flex: 1 }} />
              <Skeleton variant="rounded" height={40} sx={{ flex: 1 }} />
            </Stack>
          </Stack>
        ) : (
          <BuscadorProducto
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            categorias={categorias}
            filtroCategoria={filtroCategoria}
            setFiltroCategoria={setFiltroCategoria}
            precioMin={precioMin}
            setPrecioMin={setPrecioMin}
            precioMax={precioMax}
            setPrecioMax={setPrecioMax}
            stockMin={stockMin}
            setStockMin={setStockMin}
          />
        )}
      </Paper>

      {/* Tabla de productos */}
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          overflow: 'hidden',
          backgroundColor: 'transparent',
          boxShadow: 'none'
        }}
      >
        <Stack spacing={1.5} sx={{ display: { xs: 'flex', sm: 'none' }, p: 1 }}>
          {mostrarSkeletonCatalogo
            ? Array.from({ length: 6 }).map((_, index) => (
                <Paper key={`mobile-skeleton-${index}`} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    <Skeleton variant="rounded" width={76} height={76} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Skeleton variant="text" width="70%" height={28} />
                      <Skeleton variant="text" width="45%" />
                      <Skeleton variant="text" width="35%" />
                      <Skeleton variant="text" width="30%" />
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Skeleton variant="rounded" width={120} height={32} />
                    <Skeleton variant="rounded" width={84} height={32} />
                  </Stack>
                </Paper>
              ))
            : productosEnPagina.map((prod) => {
            const hayVariantes = tieneVariantes(prod);
            const stockTotal = obtenerStockTotal(prod);
            const imagenUrl = obtenerImagenUrl(prod, { miniatura: true });

            return (
              <Paper key={prod._id} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                <Stack direction="row" spacing={1.25} alignItems="flex-start">
                  <ImageWithSkeleton
                    src={imagenUrl}
                    alt={prod.nombre}
                    onClick={() => handleAbrirImagen(prod)}
                    containerSx={{
                      width: 76,
                      height: 76,
                      flexShrink: 0,
                      borderRadius: 1.5,
                      backgroundColor: '#f4f4f4',
                      cursor: imagenUrl ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    imageSx={{ objectFit: 'cover' }}
                  />

                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.25 }}>
                      <Typography fontWeight={800} sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {prod.nombre}
                      </Typography>
                      {hayVariantes && (
                        <Chip label="Variantes" size="small" color="primary" variant="outlined" />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {prod.categoria?.nombre || 'Sin categoria'}
                    </Typography>
                    <Typography variant="body2">
                      Stock: {stockTotal === null ? 'No controlado' : stockTotal}
                    </Typography>
                    {!hayVariantes && (
                      <Typography variant="body2" color="text.secondary">
                        Bodega: {obtenerStockBodega(prod)}
                      </Typography>
                    )}
                    <Typography fontWeight={800}>
                      ${prod.precio.toLocaleString('es-CL')}
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                  <Button size="small" onClick={() => toggleDetalle(prod._id)}>
                    {detalleAbierto === prod._id ? 'Ocultar detalle' : 'Ver detalle'}
                  </Button>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton size="small" color="primary" onClick={() => handleEditarClick(prod)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    {puedeEliminar && (
                      <IconButton size="small" color="error" onClick={() => handleEliminarClick(prod)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                </Stack>

                <Collapse in={detalleAbierto === prod._id} timeout="auto" unmountOnExit>
                  <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                    {hayVariantes ? (
                      <Stack spacing={0.75}>
                        {prod.variantes.map((vari, idx) => (
                          <Box key={idx}>
                            <Typography variant="body2" fontWeight={700}>{vari.nombre}</Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              {[vari.color, vari.talla].filter(Boolean).join(' / ') || 'Sin atributos'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              {`Stock venta: ${Number(vari.stock) || 0}`}
                              {` · Stock bodega: ${obtenerStockBodega(prod, vari)}`}
                              {vari.precio ? ` · $${vari.precio.toLocaleString('es-CL')}` : ''}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Producto sin variantes.
                      </Typography>
                    )}
                    {hayVariantes && (
                      <Button size="small" variant="outlined" sx={{ mt: 1 }} onClick={() => setProductoStockModal(prod)}>
                        Ver stock por variante
                      </Button>
                    )}
                  </Box>
                </Collapse>
              </Paper>
            );
          })}
        </Stack>

        <Table sx={{ display: { xs: 'none', sm: 'table' } }}>
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Nombre</TableCell>
              <TableCell>Categoría</TableCell>
              <TableCell>Stock</TableCell>
              <TableCell>Imagen</TableCell>
              <TableCell align="right">Precio</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mostrarSkeletonCatalogo
              ? Array.from({ length: 8 }).map((_, index) => (
                  <TableRow key={`desktop-skeleton-${index}`}>
                    <TableCell><Skeleton variant="circular" width={28} height={28} /></TableCell>
                    <TableCell><Skeleton variant="text" width="75%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="55%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="65%" /></TableCell>
                    <TableCell><Skeleton variant="rounded" width={60} height={60} /></TableCell>
                    <TableCell align="right"><Skeleton variant="text" width={70} sx={{ ml: 'auto' }} /></TableCell>
                    <TableCell align="right"><Skeleton variant="rounded" width={96} height={32} sx={{ ml: 'auto' }} /></TableCell>
                  </TableRow>
                ))
              : productosEnPagina.map((prod) => {
              const hayVariantes = tieneVariantes(prod);
              const stockTotal = obtenerStockTotal(prod);
              const totalVisible = stockTotal;
              const imagenUrl = obtenerImagenUrl(prod, { miniatura: true });

              return (
                <Fragment key={prod._id}>
                  <TableRow hover>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => toggleDetalle(prod._id)}
                      >
                        {detalleAbierto === prod._id ? (
                          <KeyboardArrowUpIcon />
                        ) : (
                          <KeyboardArrowDownIcon />
                        )}
                      </IconButton>
                    </TableCell>

                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography>{prod.nombre}</Typography>
                        {hayVariantes && (
                          <Chip
                            label="Con variantes"
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </TableCell>

                    <TableCell>{prod.categoria?.nombre || '-'}</TableCell>

                    <TableCell>
                      {hayVariantes ? (
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ flexWrap: 'wrap' }}
                        >
                          <Typography fontWeight="bold">
                            Total:{' '}
                            {totalVisible === null
                              ? 'No controlado'
                              : totalVisible}
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setProductoStockModal(prod)}
                          >
                            Ver por variante
                          </Button>
                        </Stack>
                      ) : (
                        <Stack spacing={0.25}>
                          <Typography>
                            {stockTotal === null
                              ? 'No controlado'
                              : stockTotal}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Bodega: {obtenerStockBodega(prod)}
                          </Typography>
                        </Stack>
                      )}
                    </TableCell>

                    <TableCell>
                      <ImageWithSkeleton
                        src={imagenUrl}
                        alt={prod.nombre}
                        onClick={() => handleAbrirImagen(prod)}
                        containerSx={{
                          width: 60,
                          height: 60,
                          borderRadius: '6px',
                          border: '4px solid white',
                          boxShadow: '0 0 4px rgba(0,0,0,0.3)',
                          backgroundColor: '#f4f4f4',
                          cursor: imagenUrl ? 'pointer' : 'default',
                          transition: 'transform 0.15s ease',
                          '&:hover': imagenUrl ? { transform: 'scale(1.03)' } : undefined
                        }}
                        imageSx={{ objectFit: 'cover' }}
                      />
                    </TableCell>

                    <TableCell align="right">
                      ${prod.precio.toLocaleString('es-CL')}
                    </TableCell>

                    <TableCell align="right">
                      <IconButton
                        color="primary"
                        onClick={() => handleEditarClick(prod)}
                      >
                        <EditIcon />
                      </IconButton>
                      {esSuperadmin && (
                        <Button
                          size="small"
                          sx={{ ml: 1 }}
                          onClick={() => handleUsarEnOtroLocal(prod)}
                        >
                          Usar en otro local
                        </Button>
                      )}
                      {puedeEliminar && (
                        <IconButton
                          color="error"
                          onClick={() => handleEliminarClick(prod)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Detalle colapsable */}
                  <TableRow>
                    <TableCell
                      style={{ paddingBottom: 0, paddingTop: 0 }}
                      colSpan={7}
                    >
                      <Collapse
                        in={detalleAbierto === prod._id}
                        timeout="auto"
                        unmountOnExit
                      >
                        <Box margin={2}>
                          <Typography variant="subtitle1" gutterBottom>
                            Detalles
                          </Typography>
                          {hayVariantes ? (
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Nombre</TableCell>
                                  <TableCell>Color / Talla</TableCell>
                                  <TableCell align="right">Stock venta</TableCell>
                                  <TableCell align="right">Stock bodega</TableCell>
                                  <TableCell align="right">Precio</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {prod.variantes.map((vari, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell>{vari.nombre}</TableCell>
                                    <TableCell>
                                      {[
                                        vari.color,
                                        vari.talla
                                      ]
                                        .filter(Boolean)
                                        .join(' / ') || 'Sin atributos'}
                                    </TableCell>
                                    <TableCell align="right">
                                      {Number(vari.stock) || 0}
                                    </TableCell>
                                    <TableCell align="right">
                                      {obtenerStockBodega(prod, vari)}
                                    </TableCell>
                                    <TableCell align="right">
                                      {vari.precio
                                        ? `$${vari.precio.toLocaleString(
                                            'es-CL'
                                          )}`
                                        : '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <Typography color="text.secondary">
                              Producto sin variantes.
                            </Typography>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>

        {/* Paginación */}
        {!mostrarSkeletonCatalogo && (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              count={totalPaginas || 1}
              page={paginaActual}
              onChange={handleCambioPagina}
              color="primary"
            />
          </Box>
        )}
      </Paper>

      {/* Modal de creacion */}
      <Dialog
        open={openCrear}
        onClose={handleCerrarCrear}
        keepMounted
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Crear nuevo producto</DialogTitle>
        <DialogContent dividers>
          <ProductoForm
            onSuccess={handleProductoCreado}
            onBackgroundSave={handleBackgroundSaveProducto}
            onCancel={() => setOpenCrear(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={openBase} onClose={() => setOpenBase(false)} fullWidth maxWidth="sm">
        <DialogTitle>Catalogo Base</DialogTitle>
        <DialogContent dividers>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
            spacing={1}
            sx={{ mb: 1 }}
          >
            {esSuperadmin && (
              <TextField
                select
                size="small"
                label="Local destino"
                value={targetLocalId}
                onChange={(e) => setTargetLocalId(e.target.value)}
                sx={{ minWidth: { sm: 230 } }}
              >
                <MenuItem value="">
                  {locales.length === 0 ? 'No hay locales disponibles' : 'Local activo'}
                </MenuItem>
                {locales.map((local) => (
                  <MenuItem key={local._id} value={local._id}>
                    {local.nombre}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                size="small"
                variant="outlined"
                onClick={handleUsarTodasBases}
                disabled={usandoTodasBases || bases.length === 0}
              >
                {usandoTodasBases ? 'Cargando...' : 'Usar todos en este local'}
              </Button>
              <Button size="small" onClick={() => setOpenBaseCreate(true)}>
                Crear producto base
              </Button>
            </Stack>
          </Stack>
          {bases.length === 0 ? (
            <DialogContentText>No hay productos base aun.</DialogContentText>
          ) : (
            <List dense>
              {bases.map((base) => (
                <ListItem
                  key={base._id}
                  secondaryAction={
                    <Button size="small" onClick={() => handleUsarBase(base)}>
                      Usar en este local
                    </Button>
                  }
                >
                  <ListItemText
                    primary={base.nombre}
                    secondary={base.descripcion || 'Sin descripcion'}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBase(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openBaseCreate} onClose={() => setOpenBaseCreate(false)} fullWidth maxWidth="sm">
        <DialogTitle>Crear Producto Base</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {baseError && <Alert severity="error">{baseError}</Alert>}
            <TextField
              label="Nombre"
              value={baseForm.nombre}
              onChange={(e) => setBaseForm((prev) => ({ ...prev, nombre: e.target.value }))}
              autoFocus
              required
            />
            <TextField
              label="Descripcion"
              value={baseForm.descripcion}
              onChange={(e) => setBaseForm((prev) => ({ ...prev, descripcion: e.target.value }))}
              multiline
              minRows={2}
            />
            <TextField
              select
              label="Categoria"
              value={baseForm.categoria}
              onChange={(e) => setBaseForm((prev) => ({ ...prev, categoria: e.target.value }))}
            >
              <MenuItem value="">Sin categoria</MenuItem>
              {categorias.map((cat) => (
                <MenuItem key={cat._id} value={cat._id}>
                  {cat.label || cat.nombre}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" component="label">
              Seleccionar imagen (opcional)
              <input
                hidden
                accept="image/*"
                type="file"
                onChange={async (e) => {
                  const archivo = e.target.files?.[0] || null;
                  const imagenOptimizada = archivo ? await optimizeImageFile(archivo) : null;
                  setBaseImagen(imagenOptimizada);
                }}
              />
            </Button>
            {baseImagen && (
              <DialogContentText>Imagen: {baseImagen.name}</DialogContentText>
            )}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Variantes (opcional)
              </Typography>
              <VariantesForm variantes={baseVariantes} onChange={setBaseVariantes} />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              resetBaseForm();
              setOpenBaseCreate(false);
            }}
          >
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleCrearBase} disabled={baseGuardando}>
            {baseGuardando ? 'Creando...' : 'Crear base'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openBaseUse} onClose={() => setOpenBaseUse(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          Usar en este local
          {baseSeleccionada ? ` - ${baseSeleccionada.nombre}` : ''}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {esSuperadmin && (
              <TextField
                select
                label="Local destino"
                value={targetLocalId}
                onChange={(e) => setTargetLocalId(e.target.value)}
                required
              >
                <MenuItem value="">
                  {locales.length === 0 ? 'No hay locales disponibles' : 'Selecciona un local'}
                </MenuItem>
                {locales.map((local) => (
                  <MenuItem key={local._id} value={local._id}>
                    {local.nombre}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              label="Precio"
              type="number"
              value={baseUseForm.precio}
              onChange={(e) => setBaseUseForm((prev) => ({ ...prev, precio: e.target.value }))}
              required
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2">Controlar stock</Typography>
              <Button
                size="small"
                variant={baseUseForm.controlarStock ? 'contained' : 'outlined'}
                onClick={() =>
                  setBaseUseForm((prev) => ({ ...prev, controlarStock: !prev.controlarStock }))
                }
              >
                {baseUseForm.controlarStock ? 'Si' : 'No'}
              </Button>
            </Stack>

            {baseUseForm.controlarStock && (
              <>
                <TextField
                  label="Stock base (opcional si no hay variantes)"
                  type="number"
                  value={baseUseForm.stock}
                  onChange={(e) => setBaseUseForm((prev) => ({ ...prev, stock: e.target.value }))}
                />
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Variantes (opcional)
                  </Typography>
                  <VariantesForm variantes={baseUseVariantes} onChange={setBaseUseVariantes} />
                </Box>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBaseUse(false)}>Cancelar</Button>
          <Button variant="contained" onClick={confirmarUsarBase}>
            Agregar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de confirmación de eliminación */}
      <Dialog open={openConfirm} onClose={() => setOpenConfirm(false)}>
        <DialogTitle>Eliminar producto</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro de que deseas eliminar el producto{' '}
            <strong>{productoSeleccionado?.nombre}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfirm(false)}>Cancelar</Button>
          <Button color="error" onClick={handleConfirmarEliminar}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de edición */}
      <ModalEditarProducto
        open={openEditar}
        onClose={handleCerrarEditar}
        producto={productoSeleccionado}
        onActualizado={cargarProductosYCategorias}
      />

      {/* Modal stock por variante */}
      <Dialog
        open={Boolean(productoStockModal)}
        onClose={() => setProductoStockModal(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Stock por variante
          {productoStockModal
            ? ` - ${productoStockModal.nombre}`
            : ''}
        </DialogTitle>
        <DialogContent dividers>
          {productoStockModal?.variantes &&
          productoStockModal.variantes.length > 0 ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Variante</TableCell>
                  <TableCell>Color / Talla</TableCell>
                  <TableCell align="right">Stock venta</TableCell>
                  <TableCell align="right">Stock bodega</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {productoStockModal.variantes.map((vari) => (
                  <TableRow key={vari._id || vari.nombre}>
                    <TableCell>{vari.nombre}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Typography variant="body2">
                          {[
                            vari.color,
                            vari.talla
                          ]
                            .filter(Boolean)
                            .join(' / ') || 'Sin atributos'}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      {Number(vari.stock) || 0}
                    </TableCell>
                    <TableCell align="right">
                      {obtenerStockBodega(productoStockModal, vari)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography color="text.secondary">
              Este producto no tiene variantes configuradas.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProductoStockModal(null)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Imagen ampliada */}
      <Dialog
        open={Boolean(imagenAmpliada)}
        onClose={handleCerrarImagen}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>{imagenAmpliada?.alt || 'Imagen'}</DialogTitle>
        <DialogContent dividers>
          {imagenAmpliada && (
            <ImageWithSkeleton
              src={imagenAmpliada.src}
              alt={imagenAmpliada.alt}
              containerSx={{
                width: '100%',
                minHeight: 320,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              imageSx={{
                width: '100%',
                height: 'auto',
                maxHeight: '70vh',
                objectFit: 'contain'
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          {imagenAmpliada?.src && (
            <Button
              component="a"
              href={imagenAmpliada.src}
              target="_blank"
              rel="noreferrer"
            >
              Abrir en nueva pestaña
            </Button>
          )}
          <Button onClick={handleCerrarImagen}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(mensaje)}
        autoHideDuration={4000}
        onClose={handleCerrarMensaje}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCerrarMensaje} severity="success" sx={{ width: '100%' }}>
          {mensaje}
        </Alert>
      </Snackbar>

      {notificacionesGuardado.map((item, index) => (
        <Snackbar
          key={item.id}
          open
          autoHideDuration={3000}
          onClose={() =>
            setNotificacionesGuardado((prev) => prev.filter((notif) => notif.id !== item.id))
          }
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{ mb: index * 8 }}
        >
          <Alert
            onClose={() =>
              setNotificacionesGuardado((prev) => prev.filter((notif) => notif.id !== item.id))
            }
            severity={item.severity}
            sx={{ width: '100%' }}
          >
            {item.texto}
          </Alert>
        </Snackbar>
      ))}
    </Box>
  );
}
