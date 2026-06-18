import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Tabs,
  Tab,
  useMediaQuery,
  Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import SearchIcon from '@mui/icons-material/Search';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RestoreIcon from '@mui/icons-material/Restore';
import { useTheme } from '@mui/material/styles';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useAuth } from '../context/AuthContext';
import InsumoDialog from './insumos/InsumoDialog';
import MovimientoDialog from './insumos/MovimientoDialog';
import HistorialDialog from './insumos/HistorialDialog';
import {
  obtenerInsumos,
  eliminarInsumo,
  eliminarInsumosMasivo,
  actualizarEstadoInsumo,
  obtenerObservacionesInsumo,
  crearObservacionInsumo,
  editarObservacionInsumo,
  eliminarObservacionInsumo,
  obtenerLocales,
  obtenerUsuarios,
  obtenerMovimientosInsumo,
  obtenerConfigAlertasInsumos,
  guardarConfigAlertasInsumos,
  enviarResumenAlertasInsumos,
  clonarInsumos,
  obtenerProductos,
  importarProductosABodega,
  moverCategoriaInsumos,
  actualizarOrdenInsumos,
  obtenerCategoriasInsumo,
  crearCategoriaInsumo,
  editarCategoriaInsumo,
  eliminarCategoriaInsumo,
  actualizarOrdenCategoriasInsumo,
  FILES_BASE
} from '../services/api';

const normalizarTexto = (valor = '') =>
  String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const esNotaConteoFisico = (nota = '') => {
  const texto = normalizarTexto(nota);
  return texto.startsWith('conteo fisico');
};

const getObsReadStorageKey = (userId, localId) =>
  `insumos_obs_read:${String(userId || 'anon')}:${String(localId || 'sin-local')}`;

const getObsLastTimestamp = (observaciones = []) => {
  if (!Array.isArray(observaciones) || observaciones.length === 0) return 0;
  return observaciones.reduce((maxTs, obs) => {
    const ts = new Date(obs?.actualizado_en || obs?.creado_en || 0).getTime();
    if (!Number.isFinite(ts)) return maxTs;
    return Math.max(maxTs, ts);
  }, 0);
};

const aplicarTransformacionCloudinary = (url = '', transformacion) => {
  const value = String(url || '');
  if (!value.includes('res.cloudinary.com') || !value.includes('/upload/')) return value;
  const [base, rest] = value.split('/upload/');
  const partes = rest.split('/');
  const primera = partes[0] || '';
  const tieneTransformacion = primera.includes(',') || /^(f_|q_|w_|h_|c_|g_|e_|dpr_|ar_)/.test(primera);
  const ruta = /^v\d+/.test(primera) || !tieneTransformacion ? partes : partes.slice(1);
  return `${base}/upload/${transformacion}/${ruta.join('/')}`;
};

const obtenerImagenStockUrl = (item, { miniatura = true } = {}) => {
  if (!item?.imagen_url) return '';
  const url = item.imagen_url.startsWith('/uploads')
    ? `${FILES_BASE}${item.imagen_url}`
    : item.imagen_url;
  return miniatura
    ? aplicarTransformacionCloudinary(url, 'f_auto,q_auto:good,w_120,h_120,c_fill')
    : aplicarTransformacionCloudinary(url, 'f_auto,q_auto:good,w_900,c_limit');
};

export default function Insumos() {
  const { usuario, selectedLocal } = useAuth();
  const userRole = String(usuario?.rol || '').trim().toLowerCase();
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';
  const isSuperadmin = userRole === 'superadmin';
  const puedeEditar = isAdmin || userRole === 'cajero';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [productos, setProductos] = useState([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);


  const [movOpen, setMovOpen] = useState(false);
  const [movimientos, setMovimientos] = useState([]);
  const [movInsumo, setMovInsumo] = useState(null);
  const [movTipoFijo, setMovTipoFijo] = useState(false);
  const [movTab, setMovTab] = useState('entrada');
  const [movBusqueda, setMovBusqueda] = useState('');
  const [movFechas, setMovFechas] = useState([]);
  const [histOpen, setHistOpen] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [soloBajoMinimo, setSoloBajoMinimo] = useState(false);
  const [mostrarInsumosOcultos, setMostrarInsumosOcultos] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertUsers, setAlertUsers] = useState([]);
  const [alertSeleccionados, setAlertSeleccionados] = useState([]);
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertSaving, setAlertSaving] = useState(false);
  const [alertSending, setAlertSending] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneLocales, setCloneLocales] = useState([]);
  const [cloneTarget, setCloneTarget] = useState('');
  const [cloneMode, setCloneMode] = useState('all');
  const [cloneInsumo, setCloneInsumo] = useState(null);
  const [cloneLoading, setCloneLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importProductoIds, setImportProductoIds] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedInsumoIds, setSelectedInsumoIds] = useState([]);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveCategoriaTarget, setMoveCategoriaTarget] = useState('');
  const [moveLoading, setMoveLoading] = useState(false);
  const [ordenando, setOrdenando] = useState(false);
  const [categoriasInsumo, setCategoriasInsumo] = useState([]);
  const [categoriaDialogOpen, setCategoriaDialogOpen] = useState(false);
  const [categoriaNombre, setCategoriaNombre] = useState('');
  const [categoriaEditando, setCategoriaEditando] = useState(null);
  const [categoriaOrdenando, setCategoriaOrdenando] = useState(false);
  const [tabCategoria, setTabCategoria] = useState('todas');
  const [ordenarTabs, setOrdenarTabs] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [descTexto, setDescTexto] = useState('');
  const [obsOpen, setObsOpen] = useState(false);
  const [obsTarget, setObsTarget] = useState(null);
  const [obsList, setObsList] = useState([]);
  const [obsLoading, setObsLoading] = useState(false);
  const [obsEditId, setObsEditId] = useState(null);
  const [obsInput, setObsInput] = useState('');
  const [obsSaving, setObsSaving] = useState(false);
  const [obsLeidosMap, setObsLeidosMap] = useState({});
  const [visibleCount, setVisibleCount] = useState(50);
  const tableContainerRef = useRef(null);
  const fetchInsumosSeqRef = useRef(0);
  const fetchCategoriasSeqRef = useRef(0);
  const obsReadStorageKey = useMemo(
    () => getObsReadStorageKey(usuario?._id, selectedLocal?._id),
    [usuario?._id, selectedLocal?._id]
  );


  const fetchInsumos = async () => {
    const localId = selectedLocal?._id || null;
    if (isSuperadmin && !localId) {
      setInsumos([]);
      setLoading(false);
      return;
    }

    const requestSeq = ++fetchInsumosSeqRef.current;
    setLoading(true);
    setError('');
    try {
      const res = await obtenerInsumos({
        incluir_ocultos: mostrarInsumosOcultos ? 'true' : 'false'
      });
      if (requestSeq !== fetchInsumosSeqRef.current) return;
      setInsumos(res.data || []);
    } catch (err) {
      if (requestSeq !== fetchInsumosSeqRef.current) return;
      setError('No se pudieron cargar los productos de bodega.');
    } finally {
      if (requestSeq === fetchInsumosSeqRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchInsumos();
  }, [selectedLocal?._id, mostrarInsumosOcultos, isSuperadmin]);

  useEffect(() => {
    const cargarCategorias = async () => {
      const localId = selectedLocal?._id || null;
      if (isSuperadmin && !localId) {
        setCategoriasInsumo([]);
        return;
      }

      const requestSeq = ++fetchCategoriasSeqRef.current;
      try {
        const res = await obtenerCategoriasInsumo();
        if (requestSeq !== fetchCategoriasSeqRef.current) return;
        setCategoriasInsumo(res.data || []);
      } catch {
        if (requestSeq !== fetchCategoriasSeqRef.current) return;
        setCategoriasInsumo([]);
      }
    };
    cargarCategorias();
  }, [selectedLocal?._id, isSuperadmin]);

  useEffect(() => {
    const cargarProductos = async () => {
      const localId = selectedLocal?._id || null;
      if (isSuperadmin && !localId) {
        setProductos([]);
        return;
      }

      try {
        const res = await obtenerProductos();
        setProductos(Array.isArray(res.data) ? res.data : []);
      } catch {
        setProductos([]);
      }
    };

    cargarProductos();
  }, [selectedLocal?._id, isSuperadmin]);

  useEffect(() => {
    setTabCategoria('todas');
    setOrdenarTabs(false);
    setDialogOpen(false);
    setCategoriaDialogOpen(false);
    setObsOpen(false);
    setObsTarget(null);
    setObsList([]);
    setObsEditId(null);
    setObsInput('');
    setObsLeidosMap({});
    setVisibleCount(50);
    setBusqueda('');
    setImportOpen(false);
    setImportProductoIds([]);
    setSelectionMode(false);
    setSelectedInsumoIds([]);
    setMoveDialogOpen(false);
    setMoveCategoriaTarget('');
  }, [selectedLocal?._id]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(obsReadStorageKey);
      if (!raw) {
        setObsLeidosMap({});
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setObsLeidosMap(parsed);
      } else {
        setObsLeidosMap({});
      }
    } catch {
      setObsLeidosMap({});
    }
  }, [obsReadStorageKey]);

  useEffect(() => {
    const cargarLocales = async () => {
      if (userRole !== 'superadmin') return;
      try {
        const res = await obtenerLocales();
        setCloneLocales(res.data || []);
      } catch {
        setCloneLocales([]);
      }
    };
    cargarLocales();
  }, [userRole]);

  const handleOcultarInsumo = async (insumoId, activo) => {
    try {
      await actualizarEstadoInsumo(insumoId, { activo });
      fetchInsumos();
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo actualizar el producto bodega.');
    }
  };

  const puedeGestionarObs = puedeEditar;

  const syncObsResumenInsumo = (insumoId, observaciones = []) => {
    const lista = Array.isArray(observaciones) ? observaciones : [];

    setInsumos((prev) =>
      prev.map((item) =>
        item._id === insumoId
          ? { ...item, observaciones: lista }
          : item
      )
    );
  };

  const cargarObservaciones = async (insumoId) => {
    setObsLoading(true);
    try {
      const res = await obtenerObservacionesInsumo(insumoId);
      const list = Array.isArray(res.data) ? res.data : [];
      setObsList(list);
      syncObsResumenInsumo(insumoId, list);
      return list;
    } catch (err) {
      setObsList([]);
      setError(err?.response?.data?.error || 'No se pudieron cargar las observaciones.');
      return [];
    } finally {
      setObsLoading(false);
    }
  };

  const marcarObsComoLeida = (insumoId, observaciones = []) => {
    const latestTs = getObsLastTimestamp(observaciones);
    if (!insumoId || !latestTs) return;
    setObsLeidosMap((prev) => {
      const prevTs = Number(prev?.[insumoId] || 0);
      if (prevTs >= latestTs) return prev;
      const next = { ...prev, [insumoId]: latestTs };
      try {
        localStorage.setItem(obsReadStorageKey, JSON.stringify(next));
      } catch {
        // Ignorar errores de persistencia local.
      }
      return next;
    });
  };

  const openObsDialog = async (insumo) => {
    if (!insumo?._id) return;
    setObsTarget(insumo);
    setObsOpen(true);
    setObsList([]);
    setObsEditId(null);
    setObsInput('');
    setError('');
    setInfo('');
    const list = await cargarObservaciones(insumo._id);
    marcarObsComoLeida(insumo._id, list);
  };

  const handleStartEditObs = (obs) => {
    if (!puedeGestionarObs) return;
    setObsEditId(String(obs?._id || ''));
    setObsInput(String(obs?.texto || ''));
  };

  const handleCancelEditObs = () => {
    setObsEditId(null);
    setObsInput('');
  };

  const handleGuardarObs = async () => {
    if (!puedeGestionarObs || !obsTarget?._id) return;
    const texto = String(obsInput || '').trim();
    if (!texto) {
      setError('La observacion no puede estar vacia.');
      return;
    }

    try {
      setObsSaving(true);
      if (obsEditId) {
        await editarObservacionInsumo(obsTarget._id, obsEditId, { texto });
        setInfo('Observacion actualizada.');
      } else {
        await crearObservacionInsumo(obsTarget._id, { texto });
        setInfo('Observacion creada.');
      }
      setObsEditId(null);
      setObsInput('');
      await cargarObservaciones(obsTarget._id);
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo guardar la observacion.');
    } finally {
      setObsSaving(false);
    }
  };

  const handleEliminarObs = async (obs) => {
    if (!puedeGestionarObs || !obsTarget?._id || !obs?._id) return;
    const confirmar = window.confirm('Seguro que deseas eliminar esta observacion?');
    if (!confirmar) return;

    try {
      setObsSaving(true);
      await eliminarObservacionInsumo(obsTarget._id, obs._id);
      if (String(obsEditId || '') === String(obs._id)) {
        handleCancelEditObs();
      }
      setInfo('Observacion eliminada.');
      const list = await cargarObservaciones(obsTarget._id);
      marcarObsComoLeida(obsTarget._id, list);
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo eliminar la observacion.');
    } finally {
      setObsSaving(false);
    }
  };

  const openCreate = () => {
    setEditingInsumo(null);
    setDialogOpen(true);
    setError('');
    setInfo('');
  };

  const openImportDialog = () => {
    setImportProductoIds([]);
    setImportOpen(true);
    setError('');
    setInfo('');
  };

  const handleImportarProductos = async ({ importarTodos = false } = {}) => {
    if (!importarTodos && importProductoIds.length === 0) {
      setError('Selecciona al menos un producto para importar.');
      return;
    }

    try {
      setImportLoading(true);
      const res = await importarProductosABodega(
        importarTodos
          ? { importarTodos: true }
          : { productoIds: importProductoIds }
      );
      setInfo(res.data?.mensaje || 'Importacion completada.');
      setImportOpen(false);
      setImportProductoIds([]);
      await fetchInsumos();
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudieron importar los productos.');
    } finally {
      setImportLoading(false);
    }
  };

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) {
        setSelectedInsumoIds([]);
      }
      return !prev;
    });
  };

  const toggleSelectInsumo = (insumoId) => {
    if (!selectionMode) return;
    setSelectedInsumoIds((prev) =>
      prev.includes(insumoId)
        ? prev.filter((id) => id !== insumoId)
        : [...prev, insumoId]
    );
  };

  const handleSeleccionarTodos = () => {
    setSelectedInsumoIds(insumosFiltrados.map((item) => item._id));
  };

  const handleLimpiarSeleccion = () => {
    setSelectedInsumoIds([]);
  };

  const openMoveDialog = () => {
    if (selectedInsumoIds.length === 0) {
      setError('Selecciona al menos un producto bodega.');
      return;
    }
    setMoveCategoriaTarget('');
    setMoveDialogOpen(true);
  };

  const handleEditarSeleccion = () => {
    if (selectedInsumoIds.length !== 1) {
      setError('Debes seleccionar un solo producto bodega para editar.');
      return;
    }
    const insumo = insumos.find((item) => item._id === selectedInsumoIds[0]);
    if (!insumo) {
      setError('Producto bodega no encontrado.');
      return;
    }
    setSelectionMode(false);
    setSelectedInsumoIds([]);
    openEdit(insumo);
  };

  const confirmDeleteSelection = () => {
    if (selectedInsumoIds.length === 0) {
      setError('Selecciona al menos un producto bodega.');
      return;
    }

    const seleccionados = insumos.filter((item) => selectedInsumoIds.includes(item._id));
    setDeleteTarget({
      ids: [...selectedInsumoIds],
      cantidad: selectedInsumoIds.length,
      nombre: selectedInsumoIds.length === 1 ? seleccionados[0]?.nombre || '' : ''
    });
    setError('');
    setInfo('');
  };

  const handleMoverCategoria = async () => {
    try {
      setMoveLoading(true);
      const res = await moverCategoriaInsumos({
        ids: selectedInsumoIds,
        categoria: moveCategoriaTarget || null
      });
      setInfo(res.data?.mensaje || 'Categoria actualizada.');
      setMoveDialogOpen(false);
      setSelectionMode(false);
      setSelectedInsumoIds([]);
      setMoveCategoriaTarget('');
      await fetchInsumos();
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudieron mover los productos de bodega.');
    } finally {
      setMoveLoading(false);
    }
  };

  const openAlertas = async () => {
    setAlertOpen(true);
    setAlertLoading(true);
    setError('');
    try {
      const [usuariosRes, configRes] = await Promise.all([
        obtenerUsuarios(),
        obtenerConfigAlertasInsumos()
      ]);
      setAlertUsers(usuariosRes.data || []);
      setAlertSeleccionados(configRes.data?.usuarios || []);
    } catch (err) {
      setError('No se pudieron cargar los usuarios para alertas.');
    } finally {
      setAlertLoading(false);
    }
  };

  const handleGuardarAlertas = async () => {
    try {
      setAlertSaving(true);
      await guardarConfigAlertasInsumos({ usuarios: alertSeleccionados });
      setInfo('Alertas configuradas.');
      setAlertOpen(false);
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo guardar la configuracion.');
    } finally {
      setAlertSaving(false);
    }
  };

  const handleEnviarResumen = async () => {
    try {
      setAlertSending(true);
      await enviarResumenAlertasInsumos();
      setInfo('Resumen enviado.');
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo enviar el resumen.');
    } finally {
      setAlertSending(false);
    }
  };

  const openCloneAll = () => {
    setCloneMode('all');
    setCloneInsumo(null);
    setCloneTarget('');
    setCloneOpen(true);
  };

  const openCloneOne = (insumo) => {
    setCloneMode('single');
    setCloneInsumo(insumo);
    setCloneTarget('');
    setCloneOpen(true);
  };

  const handleClone = async () => {
    if (!selectedLocal?._id) {
      setError('Selecciona un local de origen.');
      return;
    }
    if (!cloneTarget) {
      setError('Selecciona un local destino.');
      return;
    }
    try {
      setCloneLoading(true);
      const payload = {
        sourceLocalId: selectedLocal._id,
        targetLocalId: cloneTarget,
        clonarTodos: cloneMode === 'all'
      };
      if (cloneMode === 'single' && cloneInsumo?._id) {
        payload.insumoId = cloneInsumo._id;
      }
      const res = await clonarInsumos(payload);
      setInfo(res.data?.mensaje || 'Clonado completado.');
      setCloneOpen(false);
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo clonar el producto bodega.');
    } finally {
      setCloneLoading(false);
    }
  };

  const handleOrdenar = async (result) => {
    if (!result.destination) return;
    if (!isAdmin) return;
    const visibles = Array.from(insumosFiltrados);
    const [reordenado] = visibles.splice(result.source.index, 1);
    visibles.splice(result.destination.index, 0, reordenado);

    const visiblesIds = new Set(visibles.map((item) => item._id));
    let visibleIndex = 0;
    const items = insumos.map((item) => {
      if (!visiblesIds.has(item._id)) return item;
      const siguiente = visibles[visibleIndex];
      visibleIndex += 1;
      return siguiente;
    });

    const ordenIds = items.map((item) => item._id);
    const prevItems = insumos;
    setInsumos(items);
    try {
      setOrdenando(true);
      await actualizarOrdenInsumos({ orden: ordenIds });
      setInfo('Orden actualizado.');
    } catch (err) {
      setInsumos(prevItems);
      setError(err?.response?.data?.error || 'No se pudo actualizar el orden.');
    } finally {
      setOrdenando(false);
    }
  };

  const openCategorias = () => {
    setCategoriaDialogOpen(true);
    setCategoriaEditando(null);
    setCategoriaNombre('');
  };

  const handleGuardarCategoria = async () => {
    if (!categoriaNombre.trim()) {
      setError('Ingresa un nombre de categoria.');
      return;
    }
    try {
      if (categoriaEditando) {
        await editarCategoriaInsumo(categoriaEditando._id, {
          nombre: categoriaNombre.trim()
        });
      } else {
        await crearCategoriaInsumo({ nombre: categoriaNombre.trim() });
      }
      const res = await obtenerCategoriasInsumo();
      setCategoriasInsumo(res.data || []);
      setCategoriaNombre('');
      setCategoriaEditando(null);
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo guardar la categoria.');
    }
  };

  const handleEditarCategoria = (categoria) => {
    setCategoriaEditando(categoria);
    setCategoriaNombre(categoria.nombre || '');
  };

  const handleEliminarCategoria = async (categoria) => {
    const confirmar = window.confirm('Seguro que deseas eliminar esta categoria?');
    if (!confirmar) return;
    try {
      await eliminarCategoriaInsumo(categoria._id);
      const res = await obtenerCategoriasInsumo();
      setCategoriasInsumo(res.data || []);
      if (tabCategoria === categoria._id) {
        setTabCategoria('todas');
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo eliminar la categoria.');
    }
  };

  const handleOrdenCategorias = async (result) => {
    if (!result.destination) return;
    if (!isAdmin) return;
    const items = Array.from(categoriasInsumo);
    const [reordenado] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordenado);
    setCategoriasInsumo(items);
    try {
      setCategoriaOrdenando(true);
      await actualizarOrdenCategoriasInsumo({ orden: items.map((c) => c._id) });
      setInfo('Categorias ordenadas.');
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo ordenar las categorias.');
    } finally {
      setCategoriaOrdenando(false);
    }
  };

  const openEdit = (insumo) => {
    setEditingInsumo(insumo);
    setDialogOpen(true);
    setError('');
    setInfo('');
  };

  const confirmDelete = (insumo) => {
    setDeleteTarget({
      ids: [insumo._id],
      cantidad: 1,
      nombre: insumo.nombre || ''
    });
    setError('');
    setInfo('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      if ((deleteTarget.ids || []).length > 1) {
        await eliminarInsumosMasivo({ ids: deleteTarget.ids });
        setInfo('Productos de bodega eliminados.');
        setSelectionMode(false);
        setSelectedInsumoIds([]);
      } else {
        await eliminarInsumo(deleteTarget.ids?.[0]);
        setInfo('Producto bodega eliminado.');
      }
      setDeleteTarget(null);
      fetchInsumos();
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo eliminar el producto bodega.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openMovimientos = async (insumo) => {
    try {
      const res = await obtenerMovimientosInsumo(insumo._id);
      setMovimientos(res.data || []);
      setMovInsumo(insumo);
      setMovTipoFijo(false);
      setMovTab('entrada');
      setMovBusqueda('');
      setMovFechas([]);
      setMovOpen(true);
    } catch (err) {
      console.error('Error al cargar movimientos:', err);
      setError('No se pudieron cargar los movimientos.');
    }
  };

  const openHistorial = () => {
    setHistOpen(true);
  };

  const openMovimientoTipo = async (insumo, tipo) => {
    try {
      const movRes = await obtenerMovimientosInsumo(insumo._id);
      setMovimientos(movRes.data || []);
      setMovInsumo(insumo);
      setMovTipoFijo(true);
      setMovTab(tipo);
      setMovBusqueda('');
      setMovFechas([]);
      setMovOpen(true);
    } catch (err) {
      console.error('Error al cargar movimientos:', err);
      setError('No se pudieron cargar los movimientos.');
    }
  };

  const movimientosFiltrados = useMemo(() => {
    const texto = movBusqueda.trim().toLowerCase();
    const [inicio, fin] = movFechas;
    const inicioDate = inicio ? new Date(inicio.toDate()) : null;
    const finDate = fin ? new Date(fin.toDate()) : null;

    return movimientos.filter((mov) => {
      if (movTab && mov.tipo !== movTab) return false;
      if (texto) {
        const nota = (mov.nota || '').toLowerCase();
        if (!nota.includes(texto)) return false;
      }
      if (inicioDate && finDate) {
        const fecha = new Date(mov.fecha);
        if (fecha < inicioDate || fecha > finDate) return false;
      }
      return true;
    });
  }, [movimientos, movTab, movBusqueda, movFechas]);

  const busquedaNormalizada = useMemo(
    () => normalizarTexto(busqueda),
    [busqueda]
  );

  const insumosFiltrados = useMemo(() => {
    return insumos.filter((insumo) => {
      if (busquedaNormalizada) {
        const texto = [
          insumo.nombre,
          insumo.descripcion,
          insumo.sku,
          insumo.color,
          insumo.talla,
          insumo.categoria?.nombre,
          insumo.ultima_nota
        ]
          .map((valor) => normalizarTexto(valor))
          .join(' ');

        if (!texto.includes(busquedaNormalizada)) {
          return false;
        }
      }

      if (soloBajoMinimo) {
        if (Number(insumo.stock_total || 0) > Number(insumo.stock_minimo || 0)) {
          return false;
        }
      }
      if (tabCategoria === 'todas') return true;
      if (tabCategoria === 'sin') return !insumo.categoria;
      return insumo.categoria?._id === tabCategoria;
    });
  }, [insumos, busquedaNormalizada, soloBajoMinimo, tabCategoria]);

  useEffect(() => {
    setVisibleCount(50);
  }, [busquedaNormalizada, soloBajoMinimo, tabCategoria, mostrarInsumosOcultos, insumos.length]);

  useEffect(() => {
    if (visibleCount >= insumosFiltrados.length) return;
    const timer = setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 100, insumosFiltrados.length));
    }, 50);
    return () => clearTimeout(timer);
  }, [visibleCount, insumosFiltrados.length]);

  const insumosPaginados = useMemo(() => {
    return insumosFiltrados.slice(0, visibleCount);
  }, [insumosFiltrados, visibleCount]);

  const insumosStockBajo = useMemo(
    () =>
      insumos.filter(
        (insumo) =>
          Number(insumo.stock_total || 0) <= Number(insumo.stock_minimo || 0)
      ),
    [insumos]
  );

  return (
    <Box sx={{ mt: 2, px: 0.5 }}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          backgroundColor: 'transparent',
          boxShadow: 'none',
          fontSize: '0.92rem',
          '& .MuiTypography-body1, & .MuiTypography-body2, & .MuiTypography-subtitle2': {
            fontSize: '0.92rem'
          },
          '& .MuiTableCell-root': { fontSize: '0.75rem' }
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h5" gutterBottom>Stock bodega</Typography>
            <Typography variant="body2" color="text.secondary">
              Inventario de productos de bodega.
            </Typography>
          </Box>
          {isAdmin && (
            <Stack direction="row" spacing={1}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                Crear producto bodega
              </Button>
              <Button variant="outlined" onClick={openImportDialog}>
                Importar desde productos
              </Button>
              <Button
                variant={selectionMode ? 'contained' : 'outlined'}
                color={selectionMode ? 'secondary' : 'primary'}
                onClick={toggleSelectionMode}
              >
                {selectionMode ? 'Cancelar seleccion' : 'Seleccionar'}
              </Button>
              {isSuperadmin && (
                <>
                  <Button
                    variant="text"
                    onClick={openAlertas}
                    sx={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 400 }}
                  >
                    Configurar alertas
                  </Button>
                  <Button
                    variant="text"
                    onClick={handleEnviarResumen}
                    disabled={alertSending}
                    sx={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 400 }}
                  >
                    {alertSending ? 'Enviando...' : 'Enviar resumen'}
                  </Button>
                  <Button
                    variant="text"
                    onClick={openCloneAll}
                    sx={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 400 }}
                  >
                    Clonar inventario
                  </Button>
                </>
              )}
              <Button
                variant="text"
                onClick={openHistorial}
                sx={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 400 }}
              >
                Ver historial de E/S
              </Button>
            </Stack>
          )}
          {!isAdmin && (
            <Button
              variant="text"
              onClick={openHistorial}
              sx={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 400 }}
            >
              Ver historial de E/S
            </Button>
          )}
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {info && <Alert severity="success" sx={{ mb: 2 }}>{info}</Alert>}
        {insumosStockBajo.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Hay {insumosStockBajo.length} producto(s) de bodega por debajo del stock mínimo.
          </Alert>
        )}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          sx={{ mb: 2 }}
        >
          <TextField
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, SKU, color, talla, categoria..."
            size="small"
            sx={{ minWidth: { xs: '100%', sm: 320 } }}
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
            }}
          />
          <Typography variant="body2" color="text.secondary">
            {insumosFiltrados.length} de {insumos.length} producto(s)
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
          <Button
            variant={soloBajoMinimo ? 'contained' : 'outlined'}
            color="warning"
            onClick={() => setSoloBajoMinimo((prev) => !prev)}
          >
            {soloBajoMinimo ? 'Mostrando: Bajo mínimo' : 'Filtrar: Bajo mínimo'}
          </Button>
          <Button
            variant={mostrarInsumosOcultos ? 'contained' : 'outlined'}
            onClick={() => setMostrarInsumosOcultos((prev) => !prev)}
          >
            {mostrarInsumosOcultos ? 'Ocultos visibles' : 'Mostrar ocultos'}
          </Button>
          {isAdmin && (
            <Button
              variant="outlined"
              onClick={openCategorias}
              sx={{ mt: { xs: 1, sm: 0 } }}
            >
              Crear categorias de stock bodega
            </Button>
          )}
        </Stack>

        {selectionMode && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
            <Button variant="outlined" onClick={handleSeleccionarTodos}>
              Todos
            </Button>
            <Button variant="outlined" onClick={handleLimpiarSeleccion}>
              Limpiar
            </Button>
            <Button
              variant="outlined"
              onClick={handleEditarSeleccion}
              disabled={selectedInsumoIds.length !== 1}
            >
              Editar
            </Button>
            <Button
              variant="contained"
              onClick={openMoveDialog}
              disabled={selectedInsumoIds.length === 0}
            >
              Mover a ({selectedInsumoIds.length})
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={confirmDeleteSelection}
              disabled={selectedInsumoIds.length === 0}
            >
              Eliminar ({selectedInsumoIds.length})
            </Button>
          </Stack>
        )}

        {categoriasInsumo.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Categorias
              </Typography>
              {isAdmin && (
                <Button
                  variant="text"
                  onClick={() => setOrdenarTabs((prev) => !prev)}
                  sx={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 400 }}
                >
                  {ordenarTabs ? 'Listo' : 'Ordenar'}
                </Button>
              )}
            </Stack>

            {!ordenarTabs ? (
              <Tabs
                value={tabCategoria}
                onChange={(_e, value) => setTabCategoria(value)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
              >
                <Tab value="todas" label="Todas" sx={{ fontWeight: 400, fontSize: '0.8rem' }} />
                {categoriasInsumo.map((cat) => (
                  <Tab key={cat._id} value={cat._id} label={cat.nombre} sx={{ fontWeight: 400, fontSize: '0.8rem' }} />
                ))}
                <Tab value="sin" label="Sin categoria" sx={{ fontWeight: 400, fontSize: '0.8rem' }} />
              </Tabs>
            ) : (
              <DragDropContext onDragEnd={handleOrdenCategorias}>
                <Droppable droppableId="categorias-tabs" direction="horizontal">
                  {(provided) => (
                    <Stack
                      direction="row"
                      spacing={1}
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      sx={{ overflowX: 'auto', pb: 1 }}
                    >
                      <Box
                        sx={{
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 2,
                          border: '1px solid #e5e7eb',
                          bgcolor: '#f3f4f6',
                          fontSize: '0.8rem',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Todas
                      </Box>
                      {categoriasInsumo.map((cat, index) => (
                        <Draggable
                          key={cat._id}
                          draggableId={cat._id}
                          index={index}
                          isDragDisabled={!isAdmin || categoriaOrdenando}
                        >
                          {(draggableProvided) => (
                            <Box
                              ref={draggableProvided.innerRef}
                              {...draggableProvided.draggableProps}
                              {...draggableProvided.dragHandleProps}
                              sx={{
                                px: 1.5,
                                py: 0.5,
                                borderRadius: 2,
                                border: '1px solid #e5e7eb',
                                bgcolor: '#f9fafb',
                                fontSize: '0.8rem',
                                whiteSpace: 'nowrap',
                                cursor: 'grab'
                              }}
                            >
                              {cat.nombre}
                            </Box>
                          )}
                        </Draggable>
                      ))}
                      <Box
                        sx={{
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 2,
                          border: '1px solid #e5e7eb',
                          bgcolor: '#f3f4f6',
                          fontSize: '0.8rem',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Sin categoria
                      </Box>
                      {provided.placeholder}
                    </Stack>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </Box>
        )}

        <TableContainer
          component={Paper}
          variant="outlined"
          ref={tableContainerRef}
          sx={{
            backgroundColor: 'transparent',
            boxShadow: 'none'
          }}
        >
          {insumosPaginados.length < insumosFiltrados.length ? (
            <Typography variant="caption" color="text.secondary" sx={{ px: 1, pb: 1, display: 'block' }}>
              Cargando filas automaticamente... {insumosPaginados.length} de {insumosFiltrados.length}.
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ px: 1, pb: 1, display: 'block' }}>
              Todas las filas han sido cargadas.
            </Typography>
          )}
          <DragDropContext onDragEnd={handleOrdenar}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 40 }} />
                  {selectionMode && <TableCell sx={{ width: 52 }}>Sel.</TableCell>}
                  <TableCell>Imagen</TableCell>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Descripcion</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>Color</TableCell>
                  <TableCell>Talla</TableCell>
                  <TableCell sx={{ width: 92, minWidth: 92, maxWidth: 92, whiteSpace: 'nowrap' }}>Existencia</TableCell>
                  <TableCell>Minimo</TableCell>
                  <TableCell>Obs.</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>Entradas / Salidas</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem' }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <Droppable droppableId="insumos-table" direction="vertical">
                {(provided) => (
                  <TableBody ref={provided.innerRef} {...provided.droppableProps}>
                    {insumosFiltrados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={selectionMode ? 13 : 12} align="center">
                          No hay productos de bodega registrados.
                        </TableCell>
                      </TableRow>
                    )}
                    {insumosPaginados.map((insumo, index) => {
                        const stockBajo = Number(insumo.stock_total || 0) <= Number(insumo.stock_minimo || 0);
                        const oculto = insumo.activo === false;
                        const seleccionado = selectedInsumoIds.includes(insumo._id);
                        const imagenUrl = obtenerImagenStockUrl(insumo);
                        const notaConteo = String(insumo.ultima_nota || '').trim();
                        const mostrarInfoConteo = Boolean(notaConteo) && esNotaConteoFisico(notaConteo);
                        const cantidadObservaciones = Array.isArray(insumo.observaciones) ? insumo.observaciones.length : 0;
                        const esObsLegacy = !cantidadObservaciones && Boolean(notaConteo) && !esNotaConteoFisico(notaConteo);
                        const tieneObservaciones = cantidadObservaciones > 0 || esObsLegacy;
                        const latestObsTs = getObsLastTimestamp(insumo.observaciones) ||
                          (esObsLegacy ? new Date(insumo.actualizado_en || 0).getTime() : 0);
                        const ultimoLeidoTs = Number(obsLeidosMap?.[insumo._id] || 0);
                        const tieneObsNoLeidas = tieneObservaciones && latestObsTs > ultimoLeidoTs;
                        return (
                          <Draggable
                            key={insumo._id}
                            draggableId={insumo._id}
                            index={index}
                            isDragDisabled={
                              selectionMode || !isAdmin || ordenando || insumosPaginados.length < insumosFiltrados.length
                            }
                          >
                            {(draggableProvided) => (
                              <TableRow
                                ref={draggableProvided.innerRef}
                                {...draggableProvided.draggableProps}
                                hover={selectionMode}
                                onClick={() => {
                                  if (!selectionMode) return;
                                  toggleSelectInsumo(insumo._id);
                                }}
                                sx={
                                  seleccionado
                                    ? {
                                        backgroundColor: 'rgba(59, 130, 246, 0.14)',
                                        cursor: 'pointer'
                                      }
                                    : oculto
                                      ? { backgroundColor: 'rgba(148, 163, 184, 0.18)', cursor: selectionMode ? 'pointer' : 'default' }
                                      : stockBajo
                                        ? { backgroundColor: 'rgba(251, 191, 36, 0.15)', cursor: selectionMode ? 'pointer' : 'default' }
                                        : { cursor: selectionMode ? 'pointer' : 'default' }
                                }
                              >
                                <TableCell sx={{ width: 40 }}>
                                  <IconButton
                                    size="small"
                                    {...draggableProvided.dragHandleProps}
                                    disabled={selectionMode || !isAdmin || ordenando}
                                  >
                                    <DragIndicatorIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                                {selectionMode && (
                                  <TableCell sx={{ width: 52 }}>
                                    <Checkbox
                                      checked={seleccionado}
                                      onChange={() => toggleSelectInsumo(insumo._id)}
                                      onClick={(event) => event.stopPropagation()}
                                    />
                                  </TableCell>
                                )}
                                <TableCell>
                                  {imagenUrl ? (
                                    <Box
                                      component="img"
                                      src={imagenUrl}
                                      alt={insumo.nombre}
                                      loading="lazy"
                                      decoding="async"
                                      sx={{
                                        width: 52,
                                        height: 52,
                                        objectFit: 'cover',
                                        borderRadius: 1,
                                        bgcolor: '#f4f4f4'
                                      }}
                                    />
                                  ) : (
                                    <Typography variant="caption" color="text.secondary">Sin imagen</Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography variant="body2">{insumo.nombre}</Typography>
                                    {mostrarInfoConteo && (
                                      <Tooltip title={notaConteo} arrow disableHoverListener={isMobile}>
                                        <IconButton
                                          size="small"
                                          onClick={() => {
                                            if (!isMobile) return;
                                            setDescTexto(notaConteo);
                                            setDescOpen(true);
                                          }}
                                        >
                                          <InfoIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                  </Stack>
                                </TableCell>
                                <TableCell>
                                  <Tooltip title={insumo.descripcion || ''} placement="top" arrow disableHoverListener={isMobile}>
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                      sx={{ maxWidth: 80, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: insumo.descripcion ? 'pointer' : 'default' }}
                                      onClick={() => {
                                        if (!isMobile || !insumo.descripcion) return;
                                        setDescTexto(insumo.descripcion);
                                        setDescOpen(true);
                                      }}
                                    >
                                      {insumo.descripcion || '-'}
                                    </Typography>
                                  </Tooltip>
                                </TableCell>
                                <TableCell>{insumo.sku || '-'}</TableCell>
                                <TableCell>{insumo.color || '-'}</TableCell>
                                <TableCell>{insumo.talla || '-'}</TableCell>
                                <TableCell sx={{ width: 92, minWidth: 92, maxWidth: 92, whiteSpace: 'nowrap' }}>
                                  <Chip
                                    size="small"
                                    color={stockBajo ? 'warning' : 'success'}
                                    label={Number(insumo.stock_total || 0)}
                                    sx={{
                                      minWidth: 42,
                                      '& .MuiChip-label': {
                                        px: 0.75
                                      }
                                    }}
                                  />
                                </TableCell>
                                <TableCell>{Number(insumo.stock_minimo || 0)}</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                  {(puedeGestionarObs || tieneObservaciones) ? (
                                    <Button
                                      size="small"
                                      onClick={() => openObsDialog(insumo)}
                                      sx={{ fontWeight: 400, color: '#6b7280', fontSize: '0.75rem', minWidth: 'auto', px: 0.5 }}
                                    >
                                      {tieneObservaciones ? (
                                        <>
                                          Ver
                                          {tieneObsNoLeidas && (
                                            <Box
                                              component="span"
                                              sx={{
                                                ml: 0.5,
                                                width: 14,
                                                height: 14,
                                                borderRadius: '50%',
                                                backgroundColor: '#dc2626',
                                                color: '#fff',
                                                fontSize: '0.6rem',
                                                fontWeight: 700,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                lineHeight: 1
                                              }}
                                            >
                                              1
                                            </Box>
                                          )}
                                        </>
                                      ) : 'Agregar'}
                                    </Button>
                                  ) : (
                                    <Typography variant="caption" color="text.secondary">-</Typography>
                                  )}
                                </TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'nowrap' }}>
                                    <Button
                                      size="small"
                                      onClick={() => openMovimientoTipo(insumo, 'entrada')}
                                      sx={{ fontWeight: 400, color: '#6b7280', fontSize: '0.75rem', minWidth: 'auto', px: 0.5 }}
                                    >
                                      Entrada
                                    </Button>
                                    <Button
                                      size="small"
                                      onClick={() => openMovimientoTipo(insumo, 'salida')}
                                      sx={{ fontWeight: 400, color: '#6b7280', fontSize: '0.75rem', minWidth: 'auto', px: 0.5 }}
                                    >
                                      Salida
                                    </Button>
                                  </Stack>
                                </TableCell>
                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                  <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ flexWrap: 'nowrap' }}>
                                    {!selectionMode && puedeEditar && (
                                      <IconButton size="small" onClick={() => openEdit(insumo)}>
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                    )}
                                    {!selectionMode && isAdmin && (
                                      <IconButton size="small" onClick={() => confirmDelete(insumo)} color="error">
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    )}
                                    {!selectionMode && isAdmin && !oculto && (
                                      <Tooltip title="Ocultar" arrow>
                                        <IconButton
                                          size="small"
                                          onClick={() => handleOcultarInsumo(insumo._id, false)}
                                        >
                                          <VisibilityOffIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    {!selectionMode && isSuperadmin && !oculto && (
                                      <Tooltip title="Clonar" arrow>
                                        <IconButton
                                          size="small"
                                          onClick={() => openCloneOne(insumo)}
                                        >
                                          <ContentCopyIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    {!selectionMode && isAdmin && mostrarInsumosOcultos && oculto && (
                                      <Tooltip title="Restaurar" arrow>
                                        <IconButton
                                          size="small"
                                          onClick={() => handleOcultarInsumo(insumo._id, true)}
                                          color="success"
                                        >
                                          <RestoreIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                  </Stack>
                                </TableCell>
                              </TableRow>
                            )}
                          </Draggable>
                        );
                      })}
                    {provided.placeholder}
                  </TableBody>
                )}
              </Droppable>
            </Table>
          </DragDropContext>
        </TableContainer>
      </Paper>

      <InsumoDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        insumo={editingInsumo}
        categorias={categoriasInsumo}
        productos={productos}
        externalError={error}
        onInfo={setInfo}
        onError={setError}
        onSaved={fetchInsumos}
      />

      <Dialog open={importOpen} onClose={() => setImportOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Importar productos a stock bodega</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Recomendacion: importar desde productos es la forma correcta de poblar bodega cuando ya tienes catalogo creado. Si un producto tiene variantes, se crea un item por variante.
            </Typography>
            <TextField
              select
              label="Productos a importar"
              SelectProps={{
                multiple: true,
                value: importProductoIds,
                onChange: (e) => setImportProductoIds(e.target.value),
                renderValue: (selected) => {
                  const map = new Map(productos.map((item) => [item._id, item.nombre]));
                  return selected.map((id) => map.get(id) || 'Producto').join(', ');
                }
              }}
              helperText="Puedes elegir algunos productos o usar el boton de importar todos."
            >
              {productos.map((producto) => (
                <MenuItem key={producto._id} value={producto._id}>
                  {producto.nombre}
                  {Array.isArray(producto.variantes) && producto.variantes.length > 0
                    ? ` (${producto.variantes.length} variantes)`
                    : ''}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
          <Button onClick={() => handleImportarProductos({ importarTodos: true })} disabled={importLoading}>
            {importLoading ? 'Importando...' : 'Importar todos'}
          </Button>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button variant="contained" onClick={() => handleImportarProductos()} disabled={importLoading}>
              {importLoading ? 'Importando...' : 'Importar seleccionados'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      <Dialog open={moveDialogOpen} onClose={() => setMoveDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Mover a categoria</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Se moveran {selectedInsumoIds.length} producto(s) de bodega a la categoria que elijas.
            </Typography>
            <TextField
              select
              label="Categoria destino"
              value={moveCategoriaTarget}
              onChange={(e) => setMoveCategoriaTarget(e.target.value)}
              helperText="Tambien puedes moverlos a Sin categoria."
            >
              <MenuItem value="">Sin categoria</MenuItem>
              {categoriasInsumo.map((cat) => (
                <MenuItem key={cat._id} value={cat._id}>
                  {cat.nombre}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleMoverCategoria} disabled={moveLoading}>
            {moveLoading ? 'Moviendo...' : 'Aceptar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={alertOpen} onClose={() => setAlertOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Configurar alertas de stock bodega</DialogTitle>
        <DialogContent dividers>
          {alertLoading ? (
            <Typography color="text.secondary">Cargando usuarios...</Typography>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                select
                label="Usuarios que reciben alertas"
                SelectProps={{
                  multiple: true,
                  value: alertSeleccionados,
                  onChange: (e) => setAlertSeleccionados(e.target.value),
                  renderValue: (selected) => {
                    if (!selected || selected.length === 0) return 'Sin destinatarios';
                    const map = new Map(alertUsers.map((u) => [u._id, u]));
                    return selected
                      .map((id) => map.get(id)?.nombre || 'Usuario')
                      .join(', ');
                  }
                }}
              >
                {alertUsers.map((usuarioItem) => (
                  <MenuItem key={usuarioItem._id} value={usuarioItem._id}>
                    {usuarioItem.nombre} ({usuarioItem.email})
                  </MenuItem>
                ))}
              </TextField>
              <Typography variant="body2" color="text.secondary">
                Estas alertas se enviaran para el local seleccionado.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlertOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleGuardarAlertas} disabled={alertSaving}>
            {alertSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={categoriaDialogOpen} onClose={() => setCategoriaDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Categorias de stock bodega</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={categoriaEditando ? 'Editar categoria' : 'Nueva categoria'}
              value={categoriaNombre}
              onChange={(e) => setCategoriaNombre(e.target.value)}
              fullWidth
            />
            <Button variant="contained" onClick={handleGuardarCategoria}>
              {categoriaEditando ? 'Guardar cambios' : 'Crear categoria'}
            </Button>
            {categoriasInsumo.length === 0 ? (
              <Typography color="text.secondary">No hay categorias registradas.</Typography>
            ) : (
              <DragDropContext onDragEnd={handleOrdenCategorias}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 40 }} />
                      <TableCell>Nombre</TableCell>
                      <TableCell align="right">Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <Droppable droppableId="categorias-insumos" direction="vertical">
                    {(provided) => (
                      <TableBody ref={provided.innerRef} {...provided.droppableProps}>
                        {categoriasInsumo.map((cat, index) => (
                          <Draggable
                            key={cat._id}
                            draggableId={cat._id}
                            index={index}
                            isDragDisabled={!isAdmin || categoriaOrdenando}
                          >
                            {(draggableProvided) => (
                              <TableRow ref={draggableProvided.innerRef} {...draggableProvided.draggableProps}>
                                <TableCell sx={{ width: 40 }}>
                                  <IconButton
                                    size="small"
                                    {...draggableProvided.dragHandleProps}
                                    disabled={!isAdmin || categoriaOrdenando}
                                  >
                                    <DragIndicatorIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                                <TableCell>{cat.nombre}</TableCell>
                                <TableCell align="right">
                                  <Button size="small" onClick={() => handleEditarCategoria(cat)}>
                                    Editar
                                  </Button>
                                  <Button size="small" color="error" onClick={() => handleEliminarCategoria(cat)}>
                                    Eliminar
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </TableBody>
                    )}
                  </Droppable>
                </Table>
              </DragDropContext>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoriaDialogOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={descOpen} onClose={() => setDescOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Descripcion</DialogTitle>
        <DialogContent dividers>
          <Typography>{descTexto || '-'}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDescOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={obsOpen}
        onClose={() => {
          if (obsSaving) return;
          setObsOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Observacion</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {obsTarget?.nombre || '-'}
          </Typography>

          {obsLoading ? (
            <Typography color="text.secondary">Cargando observaciones...</Typography>
          ) : (
            <Stack spacing={1.25} sx={{ mb: 2.5 }}>
              {obsList.length === 0 ? (
                <Typography color="text.secondary">Sin observaciones.</Typography>
              ) : (
                obsList.map((obs) => {
                  const fecha = obs?.actualizado_en || obs?.creado_en;
                  return (
                    <Box
                      key={obs._id}
                      sx={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 1,
                        p: 1.2,
                        bgcolor: '#fafafa'
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {obs?.texto || '-'}
                      </Typography>
                      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" sx={{ mt: 0.75 }}>
                        <Typography variant="caption" color="text.secondary">
                          {fecha ? new Date(fecha).toLocaleString() : ''}
                        </Typography>
                        {puedeGestionarObs && (
                          <Stack direction="row" spacing={0.5}>
                            <Button
                              size="small"
                              onClick={() => handleStartEditObs(obs)}
                              disabled={obsSaving}
                              sx={{ minWidth: 'auto', px: 0.75, fontSize: '0.72rem' }}
                            >
                              Editar
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => handleEliminarObs(obs)}
                              disabled={obsSaving}
                              sx={{ minWidth: 'auto', px: 0.75, fontSize: '0.72rem' }}
                            >
                              Eliminar
                            </Button>
                          </Stack>
                        )}
                      </Stack>
                    </Box>
                  );
                })
              )}
            </Stack>
          )}

          {puedeGestionarObs && (
            <Stack spacing={1}>
              <TextField
                label={obsEditId ? 'Editar observacion' : 'Nueva observacion'}
                value={obsInput}
                onChange={(e) => setObsInput(e.target.value)}
                fullWidth
                multiline
                minRows={3}
                disabled={obsSaving}
                placeholder="Escribe una observacion para este producto de bodega"
              />
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                {obsEditId && (
                  <Button onClick={handleCancelEditObs} disabled={obsSaving}>
                    Cancelar edicion
                  </Button>
                )}
                <Button variant="contained" onClick={handleGuardarObs} disabled={obsSaving}>
                  {obsSaving ? 'Guardando...' : (obsEditId ? 'Guardar cambios' : 'Agregar observacion')}
                </Button>
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (obsSaving) return;
              setObsOpen(false);
            }}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={cloneOpen} onClose={() => setCloneOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Clonar stock bodega</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {cloneMode === 'all'
                ? 'Se clonaran todos los productos de bodega del local actual.'
                : `Se clonara el producto de bodega "${cloneInsumo?.nombre || ''}".`}
            </Typography>
            <TextField
              select
              label="Local destino"
              value={cloneTarget}
              onChange={(e) => setCloneTarget(e.target.value)}
            >
              {cloneLocales
                .filter((l) => l._id !== selectedLocal?._id)
                .map((local) => (
                  <MenuItem key={local._id} value={local._id}>
                    {local.nombre}
                  </MenuItem>
                ))}
            </TextField>
            <Typography variant="caption" color="text.secondary">
              Si un producto de bodega ya existe en el local destino, se omitira.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloneOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleClone} disabled={cloneLoading}>
            {cloneLoading ? 'Clonando...' : 'Clonar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar producto bodega</DialogTitle>
        <DialogContent dividers>
          <Typography>
            {deleteTarget?.cantidad > 1
              ? `Seguro que deseas eliminar ${deleteTarget?.cantidad || 0} productos de bodega seleccionados?`
              : `Seguro que deseas eliminar el producto bodega "${deleteTarget?.nombre || ''}"?`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleteLoading}>
            {deleteLoading ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

      <MovimientoDialog
        open={movOpen}
        onClose={() => setMovOpen(false)}
        insumo={movInsumo}
        tipoFijo={movTipoFijo}
        tipoInicial={movTab}
        onInfo={setInfo}
        onError={setError}
        onRefreshInsumos={fetchInsumos}
        onUpdateMovimientos={setMovimientos}
      />

      <HistorialDialog
        open={histOpen}
        onClose={() => setHistOpen(false)}
        insumos={insumos}
        isSuperadmin={isSuperadmin}
        isMobile={isMobile}
        onInfo={setInfo}
        onError={setError}
        onShowDesc={(texto) => {
          setDescTexto(texto);
          setDescOpen(true);
        }}
      />
    </Box>
  );
}
