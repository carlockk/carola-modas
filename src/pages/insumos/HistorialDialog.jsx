import { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-multi-date-picker';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  eliminarMovimientoInsumo,
  eliminarMovimientosInsumos,
  obtenerMovimientosInsumo,
  obtenerMovimientosInsumos
} from '../../services/api';

export default function HistorialDialog({
  open,
  onClose,
  insumos,
  isSuperadmin,
  isMobile,
  onInfo,
  onError,
  onShowDesc
}) {
  const [histInsumoId, setHistInsumoId] = useState('');
  const [histMovimientos, setHistMovimientos] = useState([]);
  const [histTab, setHistTab] = useState('entrada');
  const [histBusqueda, setHistBusqueda] = useState('');
  const [histFechas, setHistFechas] = useState([]);

  useEffect(() => {
    if (!open) return;
    setHistInsumoId('');
    setHistMovimientos([]);
    setHistTab('entrada');
    setHistBusqueda('');
    setHistFechas([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!histInsumoId) {
      obtenerMovimientosInsumos()
        .then((res) => setHistMovimientos(res.data || []))
        .catch(() => setHistMovimientos([]));
      return;
    }
    obtenerMovimientosInsumo(histInsumoId)
      .then((res) => setHistMovimientos(res.data || []))
      .catch(() => setHistMovimientos([]));
  }, [histInsumoId, open]);

  const recargarHistorial = async (insumoId) => {
    try {
      if (insumoId) {
        const res = await obtenerMovimientosInsumo(insumoId);
        setHistMovimientos(res.data || []);
      } else {
        const res = await obtenerMovimientosInsumos();
        setHistMovimientos(res.data || []);
      }
    } catch {
      setHistMovimientos([]);
    }
  };

  const handleEliminarMovimientoHist = async (movId) => {
    if (!isSuperadmin) return;
    const confirmar = window.confirm('Seguro que deseas eliminar este movimiento del historial?');
    if (!confirmar) return;
    try {
      await eliminarMovimientoInsumo(movId);
      onInfo?.('Movimiento eliminado.');
      recargarHistorial(histInsumoId);
    } catch (err) {
      onError?.(err?.response?.data?.error || 'No se pudo eliminar el movimiento.');
    }
  };

  const handleEliminarHistorial = async () => {
    if (!isSuperadmin) return;
    const mensaje = histInsumoId
      ? 'Seguro que deseas eliminar todo el historial de este producto de bodega?'
      : 'Seguro que deseas eliminar todo el historial de movimientos?';
    const confirmar = window.confirm(mensaje);
    if (!confirmar) return;
    try {
      await eliminarMovimientosInsumos(histInsumoId ? { insumo: histInsumoId } : {});
      onInfo?.('Historial eliminado.');
      recargarHistorial(histInsumoId);
    } catch (err) {
      onError?.(err?.response?.data?.error || 'No se pudo eliminar el historial.');
    }
  };

  const historialFiltrado = useMemo(() => {
    const texto = histBusqueda.trim().toLowerCase();
    const [inicio, fin] = histFechas;
    const inicioDate = inicio ? new Date(inicio.toDate()) : null;
    const finDate = fin ? new Date(fin.toDate()) : null;

    return histMovimientos.filter((mov) => {
      if (histTab && mov.tipo !== histTab) return false;
      if (texto) {
        const nota = (mov.nota || '').toLowerCase();
        const producto = (mov.insumo?.nombre || '').toLowerCase();
        const sku = (mov.insumo?.sku || '').toLowerCase();
        const color = (mov.insumo?.color || '').toLowerCase();
        const talla = (mov.insumo?.talla || '').toLowerCase();
        if (
          !nota.includes(texto) &&
          !producto.includes(texto) &&
          !sku.includes(texto) &&
          !color.includes(texto) &&
          !talla.includes(texto)
        ) return false;
      }
      if (inicioDate && finDate) {
        const fecha = new Date(mov.fecha);
        if (fecha < inicioDate || fecha > finDate) return false;
      }
      return true;
    });
  }, [histMovimientos, histTab, histBusqueda, histFechas]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: !isMobile
          ? { height: '90vh', display: 'flex', flexDirection: 'column' }
          : {}
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Historial de Entradas/Salidas
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={!isMobile ? { flex: 1, overflow: 'auto' } : {}}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="Producto bodega"
            value={histInsumoId}
            onChange={(e) => setHistInsumoId(e.target.value)}
          >
            <MenuItem value="">Todos los productos bodega</MenuItem>
            {insumos.map((insumo) => (
              <MenuItem key={insumo._id} value={insumo._id}>
                {insumo.nombre}
              </MenuItem>
            ))}
          </TextField>
          <Tabs value={histTab} onChange={(_e, value) => setHistTab(value)}>
            <Tab label="Entradas" value="entrada" />
            <Tab label="Salidas" value="salida" />
          </Tabs>
          {isSuperadmin && (
            <Button
              variant="outlined"
              color="error"
              onClick={handleEliminarHistorial}
              sx={{ alignSelf: 'flex-start' }}
            >
              {histInsumoId ? 'Eliminar historial del producto' : 'Eliminar todo el historial'}
            </Button>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Buscar por producto/nota"
              value={histBusqueda}
              onChange={(e) => setHistBusqueda(e.target.value)}
              size="small"
            />
            <DatePicker
              range
              value={histFechas}
              onChange={(dates) => setHistFechas([...dates])}
              format="YYYY-MM-DD"
              render={(value, openCalendar) => (
                <Box
                  onClick={openCalendar}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.25,
                    py: 0.7,
                    border: '1px solid #e5e7eb',
                    borderRadius: 1,
                    minHeight: 36,
                    cursor: 'pointer',
                    color: '#6b7280'
                  }}
                >
                  <SearchIcon fontSize="small" />
                  <Typography variant="body2">
                    {value || 'Buscar por fecha'}
                  </Typography>
                </Box>
              )}
            />
          </Stack>
        </Stack>
        <Box sx={{ mt: 3 }}>
          {historialFiltrado.length === 0 ? (
            <Typography color="text.secondary">Sin movimientos.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Producto bodega</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>Color</TableCell>
                  <TableCell>Talla</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Cantidad</TableCell>
                  <TableCell>Nota</TableCell>
                  {isSuperadmin && <TableCell align="right">Acciones</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {historialFiltrado.map((mov) => (
                  <TableRow key={mov._id}>
                    <TableCell>{new Date(mov.fecha).toLocaleString()}</TableCell>
                    <TableCell>{mov.insumo?.nombre || '-'}</TableCell>
                    <TableCell>{mov.insumo?.sku || '-'}</TableCell>
                    <TableCell>{mov.insumo?.color || '-'}</TableCell>
                    <TableCell>{mov.insumo?.talla || '-'}</TableCell>
                    <TableCell>{mov.tipo}</TableCell>
                    <TableCell>{mov.cantidad}</TableCell>
                    <TableCell>
                      {mov.nota ? (
                        <Tooltip title={mov.nota} arrow disableHoverListener={isMobile}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              if (!isMobile) return;
                              onShowDesc?.(mov.nota);
                            }}
                          >
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    {isSuperadmin && (
                      <TableCell align="right">
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleEliminarMovimientoHist(mov._id)}
                        >
                          Eliminar
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
