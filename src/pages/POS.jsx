import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Card,
  CardContent,
  CardMedia,
  useMediaQuery,
  IconButton,
  Drawer,
  Snackbar,
  Tooltip,
  Fab,
  Badge
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  DragDropContext,
  Droppable,
  Draggable
} from '@hello-pangea/dnd';
import { useLocation, useNavigate } from 'react-router-dom';

import CarritoDrawer from '../components/CarritoDrawer';
import { obtenerProductos, obtenerCategorias, FILES_BASE } from '../services/api';
import { crearProducto } from '../services/api';
import { useCarrito } from '../context/CarritoContext';
import { useCaja } from '../context/CajaContext';
import { useAuth } from '../context/AuthContext';

import ShoppingCartIcon from '@mui/icons-material/PointOfSale';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SettingsIcon from '@mui/icons-material/Tune';

import BuscadorProducto from '../components/BuscadorProducto';
import ModalCrearProducto from '../components/ModalCrearProducto';
import SelectorVariantes from '../components/SelectorVariantes';
import SelectorAgregadosDialog from '../components/SelectorAgregadosDialog';

// ✅ Ahora usamos la base de archivos que sale de api.js
const BASE_URL = FILES_BASE || (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000');
const MIN_STOCK_ALERT = 3;
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;
const DESKTOP_CART_WIDTH = 380;

const normalizeCategoryKey = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

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

const getCategoriaId = (producto) => {
  const raw = producto?.categoria;
  if (!raw) return '';
  if (typeof raw === 'string') {
    const value = raw.trim();
    return OBJECT_ID_REGEX.test(value) ? value : '';
  }
  if (typeof raw === 'object' && raw._id) return String(raw._id);
  if (typeof raw === 'object' && raw.id) return String(raw.id);
  return '';
};

const getCategoriaTitulo = (producto) => {
  const raw = producto?.categoria;
  if (!raw) return 'Sin categoria';
  if (typeof raw === 'string') {
    const value = raw.trim();
    return OBJECT_ID_REGEX.test(value) ? 'Sin categoria' : (value || 'Sin categoria');
  }
  const titulo = raw?.label || raw?.nombre || '';
  return String(titulo || '').trim() || 'Sin categoria';
};

const getCategoryAliases = (cat) => {
  const aliases = new Set();
  const nombre = String(cat?.nombre || '').trim();
  const label = String(cat?.label || '').trim();

  if (nombre) aliases.add(normalizeCategoryKey(nombre));
  if (label) aliases.add(normalizeCategoryKey(label));

  if (label.includes('/')) {
    const leaf = label.split('/').pop()?.trim();
    if (leaf) aliases.add(normalizeCategoryKey(leaf));
  }

  return Array.from(aliases).filter(Boolean);
};

const buildCategoryLookups = (categorias) => {
  const categoriasPorId = new Map();
  const categoriaAliasAId = new Map();
  const categoriaAliasesPorId = new Map();

  categorias.forEach((cat) => {
    const id = String(cat?._id || '').trim();
    if (!id) return;

    categoriasPorId.set(id, cat);
    const aliases = getCategoryAliases(cat);
    categoriaAliasesPorId.set(id, new Set(aliases));

    aliases.forEach((alias) => {
      if (!categoriaAliasAId.has(alias)) categoriaAliasAId.set(alias, id);
    });
  });

  return { categoriasPorId, categoriaAliasAId, categoriaAliasesPorId };
};

const resolveProductoCategoriaId = (producto, lookups) => {
  const idDirecto = getCategoriaId(producto);
  if (idDirecto && lookups.categoriasPorId.has(String(idDirecto))) return idDirecto;

  const raw = producto?.categoria;
  if (typeof raw === 'string') {
    const key = normalizeCategoryKey(raw);
    return lookups.categoriaAliasAId.get(key) || '';
  }

  if (raw && typeof raw === 'object') {
    const titulo = normalizeCategoryKey(raw?.label || raw?.nombre || '');
    return lookups.categoriaAliasAId.get(titulo) || '';
  }

  return '';
};

const matchesCategoriaFiltro = (producto, filtroCategoria, lookups) => {
  if (!filtroCategoria) return true;

  const selectedId = String(filtroCategoria);
  const prodCatId = resolveProductoCategoriaId(producto, lookups);
  if (prodCatId === selectedId) return true;

  const aliasesSeleccionados = lookups.categoriaAliasesPorId.get(selectedId);
  if (!aliasesSeleccionados || aliasesSeleccionados.size === 0) return false;

  const tituloProd = normalizeCategoryKey(getCategoriaTitulo(producto));
  return aliasesSeleccionados.has(tituloProd);
};

export default function POS() {
  const { usuario, selectedLocal } = useAuth();
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [openCarrito, setOpenCarrito] = useState(false);
  const [openCrear, setOpenCrear] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [productoConVariantes, setProductoConVariantes] = useState(null);
  const [productoConAgregados, setProductoConAgregados] = useState(null);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [notificacionesGuardado, setNotificacionesGuardado] = useState([]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const cardBackground =
    theme.palette.mode === 'dark'
      ? theme.palette.background.paper
      : '#ffffff';
  const cardBorderColor =
    theme.palette.mode === 'dark'
      ? 'rgba(148,163,184,0.35)'
      : 'rgba(15,23,42,0.12)';
  const thumbBorderColor =
    theme.palette.mode === 'dark'
      ? 'rgba(148,163,184,0.35)'
      : 'rgba(15,23,42,0.15)';
  const thumbBackground =
    theme.palette.mode === 'dark' ? '#1f2937' : '#f8fafc';
  const titleColor =
    theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a';
  const descColor =
    theme.palette.mode === 'dark' ? '#94a3b8' : '#475569';
  const stockOkColor =
    theme.palette.mode === 'dark' ? '#a7f3d0' : '#15803d';

  const { carrito, agregarProducto, cargarCarrito } = useCarrito();
  const { cajaAbierta, cajaVerificada } = useCaja();
  const navigate = useNavigate();
  const location = useLocation();
  const procesadasRef = useRef(new Set());

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const superadminSinLocal = usuario?.rol === 'superadmin' && !selectedLocal?._id;
  const userId = user?.id || user?._id || 'anonimo';
  const userKey = `${userId}_${selectedLocal?._id || 'sin-local'}`;

  const categoryLookups = useMemo(() => buildCategoryLookups(categorias), [categorias]);

  const resolverCategoriaId = (producto) => resolveProductoCategoriaId(producto, categoryLookups);

  const tieneVariantes = (producto) =>
    Array.isArray(producto?.variantes) &&
    producto.variantes.length > 0;

  const normalizarNumero = (valor) => {
    if (valor === null || valor === undefined || valor === '') return null;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  };

  const obtenerStockControlado = (valor) => {
    const numero = normalizarNumero(valor);
    return numero !== null && numero >= 0 ? numero : null;
  };

  const varianteEstaAgotada = (variante) =>
    Boolean(variante?.agotado) || obtenerStockControlado(variante?.stock) === 0;

  const varianteDisponible = (variante) => !varianteEstaAgotada(variante);

  const obtenerStockTotal = (producto) => {
    const stockVirtual = obtenerStockControlado(producto?.stock_total);
    if (stockVirtual !== null) return stockVirtual;

    if (tieneVariantes(producto)) {
      const stocks = producto.variantes
        .map((vari) => obtenerStockControlado(vari.stock))
        .filter((stock) => stock !== null);
      if (stocks.length === 0) return null;
      return stocks.reduce((acc, val) => acc + val, 0);
    }

    return obtenerStockControlado(producto?.stock);
  };

  const ordenarProductosPorCategorias = (prods, cats) => {
    if (!Array.isArray(cats) || cats.length === 0) {
      return [...prods];
    }
    const orden = cats.map((cat) => cat._id);
    const ordenados = [];
    const usados = new Set();

    orden.forEach((catId) => {
      prods
        .filter((p) => resolverCategoriaId(p) === String(catId))
        .forEach((p) => {
          ordenados.push(p);
          usados.add(p._id);
        });
    });

    prods
      .filter((p) => !usados.has(p._id))
      .forEach((p) => ordenados.push(p));

    return ordenados;
  };

  const cargarDatos = async () => {
    const [resProd, resCat] = await Promise.all([
      obtenerProductos(),
      obtenerCategorias()
    ]);

    const categoriasConEtiqueta = buildCategoryLabelMap(resCat.data || []);
    const ordenGuardado = JSON.parse(
      localStorage.getItem(`ordenCategorias_${userKey}`)
    );

    let categoriasOrdenadas = categoriasConEtiqueta;
    if (ordenGuardado) {
      const ordenadas = ordenGuardado
        .map((id) => categoriasConEtiqueta.find((c) => c._id === id))
        .filter(Boolean);
      const faltantes = categoriasConEtiqueta.filter(
        (c) => !ordenGuardado.includes(c._id)
      );
      categoriasOrdenadas = [...ordenadas, ...faltantes];
    }

    setProductos(resProd.data);
    setCategorias(categoriasOrdenadas);
  };

  useEffect(() => {
    cargarDatos();

    const handler = (e) => {
      if (e.key === `ordenCategorias_${userKey}`) cargarDatos();
    };

    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [selectedLocal?._id]);

  useEffect(() => {
    const comanda = location.state?.comandaPendiente;
    if (!comanda?._id || procesadasRef.current.has(comanda._id)) {
      return;
    }

    const items = (comanda.items || []).map((item) => ({
      productoId: item.productoId,
      nombre: item.nombre,
      precio: Number(item.precio_unitario) || 0,
      cantidad: Number(item.cantidad) || 1,
      observacion: item.nota || '',
      atributos: [],
      agregados: []
    }));

    if (items.length > 0) {
      cargarCarrito(items, true);
      setOpenCarrito(true);
      procesadasRef.current.add(comanda._id);
      navigate('/pos', { replace: true, state: {} });
    }
  }, [location.state, cargarCarrito, navigate]);

  useEffect(() => {
    const onScroll = () => {
      setHeaderScrolled(window.scrollY > 2);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const abrirCarritoPersistente = () => {
    if (!isMobile) {
      setOpenCarrito(true);
    }
  };

  const handleAgregar = (producto) => {
    if (tieneVariantes(producto)) {
      const variantesConStock = producto.variantes.filter((v) => varianteDisponible(v));
      if (variantesConStock.length === 0) {
        alert('Todas las variantes de este producto están agotadas.');
        return;
      }
      setProductoConVariantes({ ...producto, variantes: variantesConStock });
      return;
    }

    const agregadosActivos = Array.isArray(producto?.agregados)
      ? producto.agregados.filter((agg) => agg?.nombre && agg?.activo !== false)
      : [];

    if (agregadosActivos.length > 0) {
      setProductoConAgregados({ producto, variante: null });
      return;
    }

    agregarProducto(producto);
    abrirCarritoPersistente();
  };

  const handleSeleccionVariante = (variante) => {
    if (!productoConVariantes) return;
    const agregadosActivos = Array.isArray(productoConVariantes?.agregados)
      ? productoConVariantes.agregados.filter((agg) => agg?.nombre && agg?.activo !== false)
      : [];

    if (agregadosActivos.length > 0) {
      setProductoConAgregados({ producto: productoConVariantes, variante });
      setProductoConVariantes(null);
      return;
    }

    agregarProducto(productoConVariantes, variante);
    setProductoConVariantes(null);
    abrirCarritoPersistente();
  };

  const handleConfirmarAgregados = (agregadosSeleccionados = []) => {
    if (!productoConAgregados?.producto) return;
    agregarProducto(
      productoConAgregados.producto,
      productoConAgregados.variante || null,
      { agregados: agregadosSeleccionados }
    );
    setProductoConAgregados(null);
    abrirCarritoPersistente();
  };

  const obtenerCantidadEnCarrito = (productoId) =>
    carrito.reduce(
      (total, item) => total + (String(item._id) === String(productoId) ? Number(item.cantidad) || 0 : 0),
      0
    );

  const cantidadTotalCarrito = carrito.reduce(
    (total, item) => total + (Number(item.cantidad) || 0),
    0
  );

  const handleTarjetaKeyDown = (event, producto, deshabilitado) => {
    if (deshabilitado) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleAgregar(producto);
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(categorias);
    const [reordenado] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordenado);

    setCategorias(items);
    localStorage.setItem(
      `ordenCategorias_${userKey}`,
      JSON.stringify(items.map((c) => c._id))
    );
    setSnackbarOpen(true);
  };

  const resetOrden = () => {
    localStorage.removeItem(`ordenCategorias_${userKey}`);
    cargarDatos();
  };

  const pushNotificacionGuardado = (texto, severity = 'success') => {
    setNotificacionesGuardado((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        texto,
        severity
      }
    ]);
  };

  const handleBackgroundSaveProducto = ({ data, nombre }) => {
    setOpenCrear(false);

    crearProducto(data)
      .then(async () => {
        pushNotificacionGuardado(`Se guardo producto: ${nombre}`);
        await cargarDatos();
      })
      .catch((err) => {
        pushNotificacionGuardado(
          err?.response?.data?.error || `No se pudo guardar producto: ${nombre}`,
          'error'
        );
      });
  };

  const busquedaLower = busqueda.trim().toLowerCase();

  const productosOrdenados = useMemo(
    () => ordenarProductosPorCategorias(productos, categorias),
    [productos, categorias]
  );

  const productosFiltrados = useMemo(
    () =>
      productosOrdenados.filter((prod) => {
        const coincideNombre = (prod.nombre || '')
          .toLowerCase()
          .includes(busquedaLower);
        const coincideVariante = tieneVariantes(prod)
          ? prod.variantes.some((vari) =>
              (vari.nombre || '')
                .toLowerCase()
                .includes(busquedaLower)
            )
          : false;

        const coincideCategoria = matchesCategoriaFiltro(
          prod,
          filtroCategoria,
          categoryLookups
        );

        const pasaBusqueda =
          busquedaLower === '' || coincideNombre || coincideVariante;

        return pasaBusqueda && coincideCategoria;
      }),
    [productosOrdenados, busquedaLower, filtroCategoria, categoryLookups]
  );

  const productosAgrupados = useMemo(() => {
    const gruposMap = new Map(
      categorias.map((cat) => [
        String(cat._id),
        {
          key: String(cat._id),
          titulo: cat.label || cat.nombre || 'Sin categoria',
          productos: []
        }
      ])
    );

    const sinCategoria = {
      key: 'sin-categoria',
      titulo: 'Sin categoria',
      productos: []
    };
    const gruposExtraMap = new Map();

    productosFiltrados.forEach((prod) => {
      const catId = resolverCategoriaId(prod);
      if (catId && gruposMap.has(String(catId))) {
        gruposMap.get(String(catId)).productos.push(prod);
      } else if (
        catId ||
        (prod?.categoria &&
          (typeof prod.categoria === 'object' || typeof prod.categoria === 'string'))
      ) {
        const titulo = getCategoriaTitulo(prod);
        const extraKey = `extra:${catId || titulo.toLowerCase()}`;
        if (!gruposExtraMap.has(extraKey)) {
          gruposExtraMap.set(extraKey, {
            key: extraKey,
            titulo,
            productos: []
          });
        }
        gruposExtraMap.get(extraKey).productos.push(prod);
      } else {
        sinCategoria.productos.push(prod);
      }
    });

    const grupos = categorias
      .map((cat) => gruposMap.get(String(cat._id)))
      .filter((g) => g && g.productos.length > 0);

    if (sinCategoria.productos.length > 0) {
      grupos.push(sinCategoria);
    }

    gruposExtraMap.forEach((grupo) => {
      if (grupo.productos.length > 0) grupos.push(grupo);
    });

    return grupos;
  }, [categorias, productosFiltrados]);

  if (!cajaVerificada) {
    return (
      <Box
        sx={{
          mt: 6,
          px: 2,
          display: 'flex',
          justifyContent: 'center'
        }}
      >
        <Typography variant="h6">
          Verificando estado de la caja...
        </Typography>
      </Box>
    );
  }

  if (superadminSinLocal) {
    return (
      <Box sx={{ mt: 6, px: 2 }}>
        <Card
          sx={{
            maxWidth: 460,
            mx: 'auto',
            textAlign: 'center',
            p: 3
          }}
        >
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Selecciona un local
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Para usar el POS como superadmin, primero debes elegir el local activo en el menú lateral.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (!cajaAbierta) {
    return (
      <Box sx={{ mt: 6, px: 2 }}>
        <Card
          sx={{
            maxWidth: 420,
            mx: 'auto',
            textAlign: 'center',
            p: 3
          }}
        >
          <CardContent>
            <Typography variant="h5" gutterBottom>
              POS bloqueado
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ mb: 3 }}
            >
              No puedes iniciar el POS si no abres la caja.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate('/caja')}
            >
              Ir a abrir caja
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        mt: 2,
        px: 2,
        pr: {
          xs: 2,
          sm: openCarrito ? `${DESKTOP_CART_WIDTH + 16}px` : 2
        },
        pb: { xs: 10, sm: 0 },
        transition: theme.transitions.create('padding-right', {
          duration: theme.transitions.duration.shortest
        })
      }}
    >
      {/* Encabezado */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          alignItems: 'center',
          mb: 3,
          gap: 2,
          position: { xs: 'static', sm: 'sticky' },
          top: { sm: 0 },
          zIndex: { sm: 20 },
          backgroundColor: { sm: '#fff' },
          boxShadow: { sm: 'none' },
          borderRadius: { sm: 0 },
          py: { sm: headerScrolled ? 1 : 0 },
          px: { sm: 2 },
          mx: { sm: -2 }
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <ShoppingCartIcon sx={{ fontSize: 24 }} />
          <Box>
            <Typography
              variant="subtitle1"
              fontWeight={700}
              sx={{ letterSpacing: 0.5 }}
            >
              Punto de Venta
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: descColor }}
            >
              Gestiona productos y tickets en tiempo real
            </Typography>
          </Box>
        </Stack>

        <BuscadorProducto
          busqueda={busqueda}
          setBusqueda={setBusqueda}
          filtroCategoria={filtroCategoria}
          setFiltroCategoria={setFiltroCategoria}
          categorias={categorias}
        />

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="success"
            onClick={() => setOpenCrear(true)}
          >
            + Producto
          </Button>
          <Button
            variant="outlined"
            onClick={() => setOpenCarrito((prev) => !prev)}
          >
            {openCarrito ? 'Ocultar Carrito' : 'Ver Carrito'}
          </Button>
        </Stack>
      </Box>

      {/* Grid de productos */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fill, minmax(168px, 1fr))',
          gap: 1.5,
          alignItems: 'stretch'
        }}
      >
        {productosAgrupados.map((grupo) => (
          <Fragment key={grupo.key}>
            <Box sx={{ gridColumn: '1 / -1', mt: 0.5 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 800, letterSpacing: 0.4, color: titleColor }}
              >
                {grupo.titulo}
              </Typography>
            </Box>
            {grupo.productos.map((prod) => {
              const stockTotal = obtenerStockTotal(prod);
              const mostrarStock = stockTotal !== null;
              const agotado = tieneVariantes(prod)
                ? prod.variantes.every((vari) => varianteEstaAgotada(vari))
                : (mostrarStock ? stockTotal === 0 : false);
              const stockBajo =
                mostrarStock && !agotado && stockTotal <= MIN_STOCK_ALERT;

              const resumenVariantes = tieneVariantes(prod)
                ? prod.variantes.slice(0, 2)
                : [];

              const imagenSrc = prod.imagen_url?.startsWith('/uploads')
                ? `${BASE_URL}${prod.imagen_url}`
                : prod.imagen_url || '';

              const hayVariantes = tieneVariantes(prod);
              const cantidadEnCarrito = obtenerCantidadEnCarrito(prod._id);

              return (
                <Box
                  key={prod._id}
                  role="button"
                  tabIndex={agotado ? -1 : 0}
                  aria-disabled={agotado}
                  aria-label={`${agotado ? 'Agotado' : 'Agregar'} ${prod.nombre}`}
                  onClick={() => {
                    if (!agotado) handleAgregar(prod);
                  }}
                  onKeyDown={(event) => handleTarjetaKeyDown(event, prod, agotado)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 1.25,
                  border: `1px solid ${cardBorderColor}`,
                  backgroundColor: cardBackground,
                  boxShadow:
                    '0 8px 24px rgba(15,23,42,0.12)',
                  p: 1.25,
                  minHeight: hayVariantes ? 256 : 220,
                  cursor: agotado ? 'not-allowed' : 'pointer',
                  userSelect: 'none',
                  transition:
                    'transform 0.2s ease, border 0.2s ease, box-shadow 0.2s ease',
                  '&:focus-visible': {
                    outline: `3px solid ${theme.palette.primary.main}`,
                    outlineOffset: 2
                  },
                  '&:hover': {
                    transform: agotado ? 'none' : 'translateY(-4px)',
                    borderColor: agotado ? cardBorderColor : theme.palette.primary.main,
                    boxShadow:
                      agotado ? '0 8px 24px rgba(15,23,42,0.12)' : '0 16px 32px rgba(15,23,42,0.18)'
                  },
                  '&:active': {
                    transform: agotado ? 'none' : 'translateY(-1px) scale(0.99)',
                    borderColor: agotado ? cardBorderColor : theme.palette.primary.dark
                  }
                }}
              >
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  pt: '55%',
                  borderTopLeftRadius: 8,
                  borderTopRightRadius: 8,
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                  overflow: 'hidden',
                  border: `1px solid ${thumbBorderColor}`,
                  backgroundColor: thumbBackground,
                  mb: 1.1
                }}
              >
                {imagenSrc ? (
                  <Box
                    component="img"
                    src={imagenSrc}
                    alt={prod.nombre}
                    loading="lazy"
                    decoding="async"
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      filter: agotado ? 'grayscale(1)' : 'none'
                    }}
                  />
                ) : (
                  <Stack
                    position="absolute"
                    inset={0}
                    alignItems="center"
                    justifyContent="center"
                    spacing={0.5}
                    sx={{
                      color: descColor,
                      fontSize: '0.75rem'
                    }}
                  >
                    <StorefrontIcon fontSize="small" />
                    <Typography variant="caption">
                      Sin imagen
                    </Typography>
                  </Stack>
                )}

                {agotado && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor:
                        'rgba(15,23,42,0.55)',
                      color: '#f87171',
                      fontWeight: 700,
                      letterSpacing: 1
                    }}
                  >
                    AGOTADO
                  </Box>
                )}

                {cantidadEnCarrito > 0 && !agotado && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      minWidth: 34,
                      height: 28,
                      px: 1,
                      borderRadius: 999,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: theme.palette.success.main,
                      color: theme.palette.success.contrastText,
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      boxShadow: '0 8px 18px rgba(15,23,42,0.22)'
                    }}
                  >
                    x{cantidadEnCarrito}
                  </Box>
                )}
              </Box>

              <Box
                sx={{
                  flexGrow: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.75
                }}
              >
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{
                    color: titleColor,
                    fontSize: '0.9rem'
                  }}
                >
                  {prod.nombre}
                </Typography>

                <Tooltip
                  title={prod.descripcion || 'Sin descripción'}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: descColor,
                      fontSize: '0.72rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {prod.descripcion || 'Sin descripción'}
                  </Typography>
                </Tooltip>

                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mt: 0.5
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      color: theme.palette.primary.main,
                      fontSize: '0.96rem'
                    }}
                  >
                    ${prod.precio.toLocaleString('es-CL')}
                  </Typography>

                  {mostrarStock ? (
                    <Typography
                      variant="caption"
                      sx={{
                        px: 1,
                        py: 0.2,
                        borderRadius: 6,
                        border: `1px solid ${cardBorderColor}`,
                        color: agotado
                          ? '#f87171'
                          : stockBajo
                            ? '#f59e0b'
                            : stockOkColor,
                        fontWeight: 600,
                        letterSpacing: 0.5
                      }}
                    >
                      {agotado
                        ? 'AGOTADO'
                        : stockBajo
                          ? `Stock bajo: ${stockTotal}`
                          : `Stock: ${stockTotal}`}
                    </Typography>
                  ) : (
                    <Typography
                      variant="caption"
                      sx={{
                        px: 1,
                        py: 0.2,
                        borderRadius: 6,
                        border: `1px solid ${cardBorderColor}`,
                        color: descColor,
                        fontWeight: 600,
                        letterSpacing: 0.5
                      }}
                    >
                      Stock libre
                    </Typography>
                  )}
                </Box>

                {hayVariantes && (
                  <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                    {resumenVariantes.map((vari) => {
                      const variStock = obtenerStockControlado(vari.stock);
                      const stockLabel = varianteEstaAgotada(vari)
                        ? 'AGOTADO'
                        : variStock === null
                          ? '∞'
                          : variStock;
                      return (
                        <Typography
                          key={`${prod._id}-${vari._id || vari.nombre}`}
                          variant="caption"
                          color={descColor}
                        >
                          {vari.nombre} - Stock {stockLabel}
                        </Typography>
                      );
                    })}
                    {prod.variantes.length >
                      resumenVariantes.length && (
                      <Typography
                        variant="caption"
                        color={descColor}
                      >
                        +{prod.variantes.length -
                          resumenVariantes.length}{' '}
                        variantes adicionales
                      </Typography>
                    )}
                  </Stack>
                )}
              </Box>
            </Box>
              );
            })}
          </Fragment>
        ))}
      </Box>

      <Button
        variant="contained"
        startIcon={<ShoppingCartIcon />}
        onClick={() => setOpenCarrito((prev) => !prev)}
        sx={{
          position: 'fixed',
          display: { xs: 'none', sm: 'inline-flex' },
          right: {
            xs: 16,
            sm: openCarrito ? DESKTOP_CART_WIDTH + 16 : 16
          },
          bottom: 20,
          zIndex: 1500,
          borderRadius: 999,
          px: 2,
          minHeight: 44,
          fontWeight: 800,
          textTransform: 'none',
          boxShadow: '0 12px 28px rgba(15,23,42,0.28)'
        }}
      >
        {openCarrito ? 'Ocultar' : 'Carrito'}
        {cantidadTotalCarrito > 0 ? ` (${cantidadTotalCarrito})` : ''}
      </Button>

      {/* Botón flotante derecho */}
      <Fab
        color="primary"
        size="medium"
        onClick={() => setDrawerOpen(true)}
        sx={{
          position: 'fixed',
          display: { xs: 'none', sm: 'inline-flex' },
          right: 16,
          bottom: 90,
          zIndex: 1500
        }}
      >
        <SettingsIcon />
      </Fab>

      <Box
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          display: { xs: 'flex', sm: 'none' },
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          zIndex: 1450,
          backgroundColor: theme.palette.background.paper,
          borderTop: '1px solid',
          borderColor: theme.palette.divider,
          boxShadow: '0 -8px 24px rgba(15,23,42,0.16)'
        }}
      >
        <Button
          variant="contained"
          fullWidth
          startIcon={
            <Badge
              badgeContent={cantidadTotalCarrito}
              color="error"
              invisible={cantidadTotalCarrito === 0}
            >
              <ShoppingCartIcon />
            </Badge>
          }
          onClick={() => setOpenCarrito((prev) => !prev)}
          sx={{
            minHeight: 52,
            borderRadius: 1,
            fontWeight: 900,
            textTransform: 'none'
          }}
        >
          {openCarrito ? 'Ocultar carrito' : 'Carrito'}
        </Button>
        <IconButton
          color="primary"
          onClick={() => setDrawerOpen(true)}
          aria-label="Ordenar categorias"
          sx={{
            width: 52,
            height: 52,
            borderRadius: 1,
            border: '1px solid',
            borderColor: theme.palette.divider,
            flexShrink: 0
          }}
        >
          <SettingsIcon />
        </IconButton>
      </Box>

      {/* Drawer ordenar categorías */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: isMobile ? '90%' : 320,
            p: 2,
            ...(isMobile
              ? {
                  mt: '56px',
                  height: 'calc(100dvh - 56px)'
                }
              : {})
          }
        }}
      >
        <Typography
          variant="h6"
          fontWeight={600}
          mb={2}
        >
          Ordenar Categorías
        </Typography>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="categorias-drawer">
            {(provided) => (
              <Box
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {categorias.map((cat, index) => (
                  <Draggable
                    key={cat._id}
                    draggableId={cat._id}
                    index={index}
                  >
                    {(providedDraggable) => (
                      <Box
                        ref={providedDraggable.innerRef}
                        {...providedDraggable.draggableProps}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          backgroundColor:
                            filtroCategoria === cat._id
                              ? 'primary.main'
                              : 'grey.200',
                          color:
                            filtroCategoria === cat._id
                              ? 'white'
                              : 'black',
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 0.75,
                          mb: 1,
                          cursor: 'pointer',
                          fontSize: '0.85rem'
                        }}
                        onClick={() =>
                          setFiltroCategoria(cat._id)
                        }
                      >
                        <IconButton
                          {...providedDraggable.dragHandleProps}
                          size="small"
                        >
                          <DragIndicatorIcon fontSize="small" />
                        </IconButton>
                        <Typography
                          variant="body2"
                          fontWeight={500}
                        >
                          {cat.nombre}
                        </Typography>
                      </Box>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </Box>
            )}
          </Droppable>
        </DragDropContext>

        <Button
          variant="outlined"
          color="error"
          fullWidth
          sx={{ mt: 2 }}
          onClick={resetOrden}
        >
          Restablecer Orden
        </Button>
      </Drawer>

      <ModalCrearProducto
        open={openCrear}
        onClose={() => setOpenCrear(false)}
        onCreado={cargarDatos}
        onBackgroundSave={handleBackgroundSaveProducto}
      />
      <CarritoDrawer
        open={openCarrito}
        onClose={() => setOpenCarrito(false)}
        onVentaCompletada={(venta) => {
          const vendidos = Array.isArray(venta?.productos) ? venta.productos : [];
          if (vendidos.length === 0) return;
          setProductos((prev) => prev.map((producto) => {
            const itemsProducto = vendidos.filter((item) => String(item.productoId) === String(producto._id));
            if (itemsProducto.length === 0) return producto;

            if (Array.isArray(producto.variantes) && producto.variantes.length > 0) {
              const variantes = producto.variantes.map((variante) => {
                const vendidosVariante = itemsProducto
                  .filter((item) => String(item.varianteId || '') === String(variante._id || ''))
                  .reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
                if (!vendidosVariante || typeof variante.stock !== 'number') return variante;
                return { ...variante, stock: Math.max(0, variante.stock - vendidosVariante) };
              });
              const stocks = variantes
                .map((variante) => (typeof variante.stock === 'number' ? variante.stock : null))
                .filter((stock) => stock !== null);
              return {
                ...producto,
                variantes,
                stock_total: stocks.length > 0 ? stocks.reduce((sum, stock) => sum + stock, 0) : producto.stock_total
              };
            }

            const cantidadVendida = itemsProducto.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
            if (typeof producto.stock !== 'number') return producto;
            const stock = Math.max(0, producto.stock - cantidadVendida);
            return { ...producto, stock, stock_total: stock };
          }));
        }}
        desktopWidth={DESKTOP_CART_WIDTH}
      />
      <SelectorVariantes
        open={Boolean(productoConVariantes)}
        producto={productoConVariantes}
        onClose={() => setProductoConVariantes(null)}
        onSelect={handleSeleccionVariante}
      />
      <SelectorAgregadosDialog
        open={Boolean(productoConAgregados)}
        producto={productoConAgregados?.producto}
        variante={productoConAgregados?.variante}
        onClose={() => setProductoConAgregados(null)}
        onConfirm={handleConfirmarAgregados}
      />
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={() => setSnackbarOpen(false)}
        message="Orden guardado"
      />

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
