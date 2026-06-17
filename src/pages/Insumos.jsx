import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
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
import LotesDialog from './insumos/LotesDialog';
import {
  obtenerInsumos,
  eliminarInsumo,
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
  actualizarOrdenInsumos,
  obtenerCategoriasInsumo,
  crearCategoriaInsumo,
  editarCategoriaInsumo,
  eliminarCategoriaInsumo,
  actualizarOrdenCategoriasInsumo
} from '../services/api';

const estadoVencimiento = (lote, alertaDias) => {
  if (!lote?.fecha_vencimiento) return 'normal';
  const hoy = new Date();
  const venc = new Date(lote.fecha_vencimiento);
  if (Number.isNaN(venc.getTime())) return 'normal';
  const diff = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'vencido';
  if (diff <= alertaDias) return 'por_vencer';
  return 'normal';
};

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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [lotesOpen, setLotesOpen] = useState(false);
  const [lotesInsumo, setLotesInsumo] = useState(null);

  const [movOpen, setMovOpen] = useState(false);
  const [movimientos, setMovimientos] = useState([]);
  const [movInsumo, setMovInsumo] = useState(null);
  const [movTipoFijo, setMovTipoFijo] = useState(false);
  const [movTab, setMovTab] = useState('entrada');
  const [movBusqueda, setMovBusqueda] = useState('');
  const [movFechas, setMovFechas] = useState([]);
  const [histOpen, setHistOpen] = useState(false);
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
      setError('No se pudieron cargar los insumos.');
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
      setError(err?.response?.data?.error || 'No se pudo actualizar el insumo.');
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
      setError(err?.response?.data?.error || 'No se pudo clonar el insumo.');
    } finally {
      setCloneLoading(false);
    }
  };

  const handleOrdenar = async (result) => {
    if (!result.destination) return;
    if (!isAdmin) return;
    const items = Array.from(insumos);
    const [reordenado] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordenado);
    setInsumos(items);
    try {
      setOrdenando(true);
      await actualizarOrdenInsumos({ orden: items.map((i) => i._id) });
      setInfo('Orden actualizado.');
    } catch (err) {
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
    setDeleteTarget(insumo);
    setError('');
    setInfo('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      await eliminarInsumo(deleteTarget._id);
      setInfo('Insumo eliminado.');
      setDeleteTarget(null);
      fetchInsumos();
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo eliminar el insumo.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openLotes = (insumo) => {
    setLotesInsumo(insumo);
    setLotesOpen(true);
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
      console.error('Error al cargar movimientos/lotes:', err);
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
        const lote = (mov.lote || '').toLowerCase();
        const nota = (mov.nota || '').toLowerCase();
        if (!lote.includes(texto) && !nota.includes(texto)) return false;
      }
      if (inicioDate && finDate) {
        const fecha = new Date(mov.fecha);
        if (fecha < inicioDate || fecha > finDate) return false;
      }
      return true;
    });
  }, [movimientos, movTab, movBusqueda, movFechas]);

  const insumosFiltrados = useMemo(() => {
    return insumos.filter((insumo) => {
      if (soloBajoMinimo) {
        if (Number(insumo.stock_total || 0) > Number(insumo.stock_minimo || 0)) {
          return false;
        }
      }
      if (tabCategoria === 'todas') return true;
      if (tabCategoria === 'sin') return !insumo.categoria;
      return insumo.categoria?._id === tabCategoria;
    });
  }, [insumos, soloBajoMinimo, tabCategoria]);

  useEffect(() => {
    setVisibleCount(50);
  }, [soloBajoMinimo, tabCategoria, mostrarInsumosOcultos, insumos.length]);

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
    <Box sx={{ mt: 2, px: 1 }}>
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
            Hay {insumosStockBajo.length} insumo(s) por debajo del stock mínimo.
          </Alert>
        )}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
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
            >
              Crear categorias de insumos
            </Button>
          )}
        </Stack>

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
                  <TableCell>Nombre</TableCell>
                  <TableCell>Descripcion</TableCell>
                  <TableCell>Unidad</TableCell>
                  <TableCell sx={{ width: 74, minWidth: 74, maxWidth: 74, whiteSpace: 'nowrap' }}>Stock</TableCell>
                  <TableCell>Minimo</TableCell>
                  <TableCell>Vencimiento</TableCell>
                  <TableCell>Obs.</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>Ingresos/Egresos</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem' }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <Droppable droppableId="insumos-table" direction="vertical">
                {(provided) => (
                  <TableBody ref={provided.innerRef} {...provided.droppableProps}>
                    {insumosFiltrados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} align="center">
                          No hay insumos registrados.
                        </TableCell>
                      </TableRow>
                    )}
                    {insumosPaginados.map((insumo, index) => {
                        const stockBajo = Number(insumo.stock_total || 0) <= Number(insumo.stock_minimo || 0);
                        const oculto = insumo.activo === false;
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
                            isDragDisabled={!isAdmin || ordenando || insumosPaginados.length < insumosFiltrados.length}
                          >
                            {(draggableProvided) => (
                              <TableRow
                                ref={draggableProvided.innerRef}
                                {...draggableProvided.draggableProps}
                                sx={
                                  oculto
                                    ? { backgroundColor: 'rgba(148, 163, 184, 0.18)' }
                                    : stockBajo
                                      ? { backgroundColor: 'rgba(251, 191, 36, 0.15)' }
                                      : {}
                                }
                              >
                                <TableCell sx={{ width: 40 }}>
                                  <IconButton
                                    size="small"
                                    {...draggableProvided.dragHandleProps}
                                    disabled={!isAdmin || ordenando}
                                  >
                                    <DragIndicatorIcon fontSize="small" />
                                  </IconButton>
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
                                <TableCell>{insumo.unidad}</TableCell>
                                <TableCell sx={{ width: 74, minWidth: 74, maxWidth: 74, whiteSpace: 'nowrap' }}>
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
                                <TableCell>
                                  <Button size="small" onClick={() => openLotes(insumo)} sx={{ fontWeight: 400, color: '#6b7280' }}>
                                    Ver lotes
                                  </Button>
                                </TableCell>
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
                                      Conteo físico
                                    </Button>
                                  </Stack>
                                </TableCell>
                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                  <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ flexWrap: 'nowrap' }}>
                                    {puedeEditar && (
                                      <IconButton size="small" onClick={() => openEdit(insumo)}>
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                    )}
                                    {isAdmin && (
                                      <IconButton size="small" onClick={() => confirmDelete(insumo)} color="error">
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    )}
                                    {isAdmin && !oculto && (
                                      <Tooltip title="Ocultar" arrow>
                                        <IconButton
                                          size="small"
                                          onClick={() => handleOcultarInsumo(insumo._id, false)}
                                        >
                                          <VisibilityOffIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    {isSuperadmin && !oculto && (
                                      <Tooltip title="Clonar" arrow>
                                        <IconButton
                                          size="small"
                                          onClick={() => openCloneOne(insumo)}
                                        >
                                          <ContentCopyIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    {isAdmin && mostrarInsumosOcultos && oculto && (
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
        externalError={error}
        onInfo={setInfo}
        onError={setError}
        onSaved={fetchInsumos}
      />

      <Dialog open={alertOpen} onClose={() => setAlertOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Configurar alertas de insumos</DialogTitle>
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
        <DialogTitle>Categorias de insumos</DialogTitle>
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
                placeholder="Escribe una observacion para este insumo"
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
        <DialogTitle>Clonar insumos</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {cloneMode === 'all'
                ? 'Se clonaran todos los insumos del local actual (sin lotes ni vencimientos).'
                : `Se clonara el insumo "${cloneInsumo?.nombre || ''}" (sin lotes ni vencimientos).`}
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
              Si un insumo ya existe en el local destino, se omitira.
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
        <DialogTitle>Eliminar insumo</DialogTitle>
        <DialogContent dividers>
          <Typography>
            Seguro que deseas eliminar el insumo "{deleteTarget?.nombre}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleteLoading}>
            {deleteLoading ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

      <LotesDialog
        open={lotesOpen}
        onClose={() => setLotesOpen(false)}
        insumo={lotesInsumo}
        isAdmin={isAdmin}
        onError={setError}
        onInfo={setInfo}
        onRefreshInsumos={fetchInsumos}
      />

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
