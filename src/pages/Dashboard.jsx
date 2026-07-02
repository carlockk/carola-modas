import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, useTheme,
  useMediaQuery, Divider, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogContent, DialogTitle, IconButton, Tooltip
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseIcon from '@mui/icons-material/Close';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import DatePicker, { DateObject } from 'react-multi-date-picker';
import { obtenerResumenPorRango } from '../services/api';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#1976d2', '#2e7d32', '#f57c00', '#9c27b0', '#d32f2f'];

export default function Dashboard() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { selectedLocal } = useAuth();

  const [rangoFechas, setRangoFechas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [sinDatosHoy, setSinDatosHoy] = useState(false);
  const [productosVendidosExpandido, setProductosVendidosExpandido] = useState(false);

  useEffect(() => {
    if (rangoFechas.length === 0) {
      const hoy = new DateObject();
      setRangoFechas([hoy, hoy]);
    }
  }, []);

  useEffect(() => {
    const cargarResumen = async () => {
      if (!rangoFechas.length || rangoFechas.length < 2) return;

      try {
        const inicio = rangoFechas[0].format('YYYY-MM-DD');
        const fin = rangoFechas[1].format('YYYY-MM-DD');

        const res = await obtenerResumenPorRango(inicio, fin);
        setResumen(res.data);
        const hoy = new DateObject().format('YYYY-MM-DD');
        const esHoy = inicio === hoy && fin === hoy;
        setSinDatosHoy(esHoy && Number(res.data?.cantidad || 0) === 0);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('Error al obtener resumen por rango:', err);
        }
      }
    };

    cargarResumen();
  }, [rangoFechas, selectedLocal?._id]);

  const pieChartData = resumen
    ? Object.entries(resumen.porTipoPago || {}).map(([tipo, valor]) => ({
        name: tipo,
        value: valor
      }))
    : [];

  const pieChartProductoData = resumen
    ? Object.entries(resumen.porTipoProducto || {}).map(([tipo, valor]) => ({
        name: tipo,
        value: valor
      }))
    : [];

  const productosResumen = resumen?.porProducto || [];
  const topProductos = [...productosResumen].sort((a, b) => b.total - a.total).slice(0, 10);
  const totalPos = Number(resumen?.totalesPorCanal?.POS?.total || 0);
  const totalWeb = Number(resumen?.totalesPorCanal?.WEB?.total || 0);
  const cantidadPos = Number(resumen?.totalesPorCanal?.POS?.cantidad || 0);
  const cantidadWeb = Number(resumen?.totalesPorCanal?.WEB?.cantidad || 0);
  const desglosePagoPos = resumen?.porTipoPagoDetallado?.POS || {};
  const desglosePagoWeb = resumen?.porTipoPagoDetallado?.WEB || {};

  const formatoMoneda = (valor) =>
    Number(valor || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const renderProductoTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const { nombre, cantidad, total } = payload[0].payload || {};
    return (
      <Box
        sx={{
          backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#fff',
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          px: 1.5,
          py: 1,
          boxShadow: theme.palette.mode === 'dark' ? '0 6px 18px rgba(0,0,0,0.45)' : 1
        }}
      >
        <Typography variant="subtitle2" color="text.primary">{nombre}</Typography>
        <Typography variant="body2" color="text.secondary">Cantidad: {cantidad}</Typography>
        <Typography variant="body2" color="text.secondary">Total: ${formatoMoneda(total)}</Typography>
      </Box>
    );
  };

  const bgCard1 = theme.palette.mode === 'dark' ? '#0b1220' : '#e3f2fd';
  const bgCard2 = theme.palette.mode === 'dark' ? '#0f172a' : '#fff3e0';
  const bgCard3 = theme.palette.mode === 'dark' ? '#111827' : '#e8f5e9';
  const bgCard4 = theme.palette.mode === 'dark' ? '#111827' : '#f3e5f5';
  const bgCard5 = theme.palette.mode === 'dark' ? '#0b1220' : '#e1f5fe';
  const bgCard6 = theme.palette.mode === 'dark' ? '#0f172a' : '#f1f8e9';
  const dividerColor = theme.palette.divider;

  const renderProductosVendidosTable = (maxHeight) => (
    <TableContainer
      component={Paper}
      sx={{
        maxHeight,
        backgroundColor: theme.palette.mode === 'dark' ? '#0b1220' : undefined
      }}
    >
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ backgroundColor: theme.palette.mode === 'dark' ? '#111827' : undefined }}>
              Producto
            </TableCell>
            <TableCell align="right" sx={{ backgroundColor: theme.palette.mode === 'dark' ? '#111827' : undefined }}>
              Cantidad
            </TableCell>
            <TableCell align="right" sx={{ backgroundColor: theme.palette.mode === 'dark' ? '#111827' : undefined }}>
              Total
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {productosResumen.map((producto) => (
            <TableRow key={producto.nombre}>
              <TableCell sx={{ color: theme.palette.text.primary }}>{producto.nombre}</TableCell>
              <TableCell align="right" sx={{ color: theme.palette.text.primary }}>{producto.cantidad}</TableCell>
              <TableCell align="right" sx={{ color: theme.palette.text.primary }}>
                ${formatoMoneda(producto.total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Box sx={{ mt: 4, px: isMobile ? 2 : 4 }}>
      <Typography variant="h5" gutterBottom>
        Resumen de Ventas
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Typography
          variant="subtitle2"
          sx={{ color: theme.palette.mode === 'dark' ? '#cbd5f5' : 'inherit' }}
        >
          Seleccionar Rango de Fechas
        </Typography>
        <DatePicker
          range
          value={rangoFechas}
          onChange={(dates) => setRangoFechas([...dates])} // 🔥 Evitamos mutaciones directas
          format="YYYY-MM-DD"
          style={{
            height: 44,
            padding: '0 12px',
            width: isMobile ? '100%' : 260,
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 8
          }}
        />
        <Typography
          component="span"
          role="button"
          tabIndex={0}
          sx={{
            mt: 1,
            ml: 1,
            color: theme.palette.mode === 'dark' ? alpha('#fff', 0.85) : theme.palette.text.secondary,
            cursor: 'pointer',
            userSelect: 'none'
          }}
          onClick={() => {
            setRangoFechas([]);
            setResumen(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setRangoFechas([]);
              setResumen(null);
            }
          }}
        >
          Limpiar
        </Typography>
      </Box>

      {resumen ? (
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }
          }}
        >
          <Card elevation={4} sx={{ backgroundColor: bgCard1, flex: 1 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" color="primary">
                Total Vendido
              </Typography>
              <Divider sx={{ my: 1, borderColor: dividerColor }} />
              <Typography variant="h3" color="primary">
                ${resumen.total.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>

          <Card elevation={4} sx={{ backgroundColor: bgCard2, flex: 1 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
                Cantidad de Ventas
              </Typography>
              <Divider sx={{ my: 1, borderColor: dividerColor }} />
              <Typography variant="h3" color="text.primary">
                {resumen.cantidad}
              </Typography>
            </CardContent>
          </Card>

          <Card elevation={4} sx={{ backgroundColor: bgCard1, flex: 1 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
                Ventas POS
              </Typography>
              <Divider sx={{ my: 1, borderColor: dividerColor }} />
              <Typography variant="h5" color="text.primary">
                ${totalPos.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {cantidadPos} ventas
              </Typography>
            </CardContent>
          </Card>

          <Card elevation={4} sx={{ backgroundColor: bgCard2, flex: 1 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
                Pedidos Web Entregados
              </Typography>
              <Divider sx={{ my: 1, borderColor: dividerColor }} />
              <Typography variant="h5" color="text.primary">
                ${totalWeb.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {cantidadWeb} pedidos
              </Typography>
            </CardContent>
          </Card>

          <Card elevation={4} sx={{ backgroundColor: bgCard3, flex: 1, height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
                Distribución por Tipo de Pago
              </Typography>
              <Divider sx={{ my: 1, borderColor: dividerColor }} />
              {pieChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieChartData} dataKey="value" nameKey="name" outerRadius={80} label>
                      {pieChartData.map((entry, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <ReTooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No hay datos.
                </Typography>
              )}
            </CardContent>
          </Card>
          <Card elevation={4} sx={{ backgroundColor: bgCard4, flex: 1, height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
                Distribucion por Tipo de Producto
              </Typography>
              <Divider sx={{ my: 1, borderColor: dividerColor }} />
              {pieChartProductoData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieChartProductoData} dataKey="value" nameKey="name" outerRadius={80} label>
                      {pieChartProductoData.map((entry, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <ReTooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No hay datos.
                </Typography>
              )}
            </CardContent>
          </Card>

          <Card elevation={4} sx={{ backgroundColor: bgCard5, flex: 1, height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
                Top Productos (Total Vendido)
              </Typography>
              <Divider sx={{ my: 1, borderColor: dividerColor }} />
              {topProductos.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={topProductos} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={theme.palette.mode === 'dark' ? alpha('#fff', 0.08) : undefined}
                    />
                    <XAxis
                      type="number"
                      tickFormatter={(value) => `$${formatoMoneda(value)}`}
                      stroke={theme.palette.mode === 'dark' ? alpha('#fff', 0.5) : undefined}
                    />
                    <YAxis
                      type="category"
                      dataKey="nombre"
                      width={120}
                      tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                    />
                    <ReTooltip content={renderProductoTooltip} />
                    <Bar dataKey="total" fill={theme.palette.mode === 'dark' ? '#38bdf8' : '#0288d1'} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No hay datos.
                </Typography>
              )}
            </CardContent>
          </Card>

          <Card elevation={4} sx={{ backgroundColor: bgCard6, flex: 1 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
                  Productos Vendidos
                </Typography>
                {productosResumen.length > 0 && (
                  <Tooltip title="Ampliar tabla">
                    <IconButton
                      size="small"
                      onClick={() => setProductosVendidosExpandido(true)}
                      sx={{ color: theme.palette.text.primary }}
                    >
                      <OpenInFullIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              <Divider sx={{ my: 1, borderColor: dividerColor }} />
              {productosResumen.length > 0 ? (
                renderProductosVendidosTable(320)
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No hay datos.
                </Typography>
              )}
            </CardContent>
          </Card>

          <Card elevation={4} sx={{ backgroundColor: bgCard6, flex: 1 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
                Tipo de Pago por Canal
              </Typography>
              <Divider sx={{ my: 1, borderColor: dividerColor }} />
              <Stack spacing={1.25}>
                <Box>
                  <Typography variant="body2" fontWeight={700} color="text.primary">
                    POS
                  </Typography>
                  {Object.keys(desglosePagoPos).length > 0 ? (
                    Object.entries(desglosePagoPos).map(([tipo, valor]) => (
                      <Typography key={`pago-pos-${tipo}`} variant="body2" color="text.secondary">
                        {tipo}: ${formatoMoneda(valor)}
                      </Typography>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">Sin datos</Typography>
                  )}
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight={700} color="text.primary">
                    WEB
                  </Typography>
                  {Object.keys(desglosePagoWeb).length > 0 ? (
                    Object.entries(desglosePagoWeb).map(([tipo, valor]) => (
                      <Typography key={`pago-web-${tipo}`} variant="body2" color="text.secondary">
                        {tipo}: ${formatoMoneda(valor)}
                      </Typography>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">Sin datos</Typography>
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      ) : (
        <Typography color="text.secondary">
          {sinDatosHoy ? 'No hay datos en la fecha actual.' : 'Selecciona un rango para ver el resumen.'}
        </Typography>
      )}

      <Dialog
        open={productosVendidosExpandido}
        onClose={() => setProductosVendidosExpandido(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ pr: 7 }}>
          Productos Vendidos
          <IconButton
            aria-label="Cerrar"
            onClick={() => setProductosVendidosExpandido(false)}
            sx={{ position: 'absolute', right: 12, top: 12 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          {productosResumen.length > 0 ? (
            renderProductosVendidosTable('70vh')
          ) : (
            <Typography variant="body2" color="text.secondary">
              No hay datos.
            </Typography>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
