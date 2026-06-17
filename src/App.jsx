import { lazy, Suspense, useEffect, useState } from 'react';
import {
  AppBar, Toolbar, IconButton, Typography, Box, CssBaseline, useMediaQuery, Snackbar, Alert
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { useAuth } from './context/AuthContext';
import { CajaProvider } from './context/CajaContext';

import Sidebar from './components/Sidebar';
import PedidosWebWatcher from './components/PedidosWebWatcher';
import RestauranteCobroWatcher from './components/RestauranteCobroWatcher';
import { LOCAL_REQUIRED_EVENT } from './services/api';

const Productos = lazy(() => import('./pages/Productos'));
const CrearProducto = lazy(() => import('./pages/CrearProducto'));
const Categorias = lazy(() => import('./pages/CrearCategoria'));
const POS = lazy(() => import('./pages/POS'));
const Ticket = lazy(() => import('./pages/Ticket'));
const Historial = lazy(() => import('./pages/Historial'));
const Caja = lazy(() => import('./pages/Caja'));
const HistorialCajas = lazy(() => import('./pages/HistorialCajas'));
const TicketCaja = lazy(() => import('./pages/TicketCaja'));
const CrearUsuario = lazy(() => import('./pages/CrearUsuario'));
const ListaUsuarios = lazy(() => import('./pages/ListaUsuarios'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const TicketsAbiertos = lazy(() => import('./pages/TicketsAbiertos'));
const Locales = lazy(() => import('./pages/Locales'));
const Insumos = lazy(() => import('./pages/Insumos'));
const ConfigRecibo = lazy(() => import('./pages/ConfigRecibo'));
const Agregados = lazy(() => import('./pages/Agregados'));
const PedidosWeb = lazy(() => import('./pages/PedidosWeb'));
const SocialConfig = lazy(() => import('./pages/SocialConfig'));
const HorarioTienda = lazy(() => import('./pages/HorarioTienda'));
const Restaurante = lazy(() => import('./pages/Restaurante'));
const CheckoutResult = lazy(() => import('./pages/CheckoutResult'));
const Descuentos = lazy(() => import('./pages/Descuentos'));

const drawerWidth = 280;
const collapsedDrawerWidth = 72;

export default function App() {
  const { usuario } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [localNoticeOpen, setLocalNoticeOpen] = useState(false);
  const [localNoticeMessage, setLocalNoticeMessage] = useState('');
  const location = useLocation();
  const isLoginRoute = location.pathname === '/login';
  const esMesero = usuario?.rol === 'mesero';
  const esAdmin = usuario?.rol === 'admin' || usuario?.rol === 'superadmin';
  const usuarioGeneral = Boolean(usuario) && !esMesero;
  const rutaInicio = esMesero ? '/restaurante' : '/';

  const toggleDrawer = () => setMobileOpen(!mobileOpen);
  const activeDrawerWidth = !isMobile && sidebarCollapsed ? collapsedDrawerWidth : drawerWidth;

  useEffect(() => {
    const handler = (event) => {
      const message = event?.detail?.message || 'Debes seleccionar un local para continuar.';
      setLocalNoticeMessage(message);
      setLocalNoticeOpen(true);
    };

    window.addEventListener(LOCAL_REQUIRED_EVENT, handler);
    return () => window.removeEventListener(LOCAL_REQUIRED_EVENT, handler);
  }, []);

  return (
    <CajaProvider>
      <Box sx={{ display: isLoginRoute ? 'block' : 'flex', minHeight: '100vh' }}>
        <CssBaseline />

        {isMobile && !isLoginRoute && (
          <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
            <Toolbar>
              <IconButton color="inherit" edge="start" onClick={toggleDrawer}>
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" noWrap sx={{ ml: 2 }}>
                POSSail
              </Typography>
            </Toolbar>
          </AppBar>
        )}

        {!isLoginRoute && (
          <Sidebar
            mobileOpen={mobileOpen}
            toggleDrawer={toggleDrawer}
            collapsed={!isMobile && sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
            drawerWidth={activeDrawerWidth}
          />
        )}

        {!isLoginRoute && !esMesero && <PedidosWebWatcher />}
        {!isLoginRoute && !esMesero && <RestauranteCobroWatcher />}

        <Box
          component="main"
          sx={
            isLoginRoute
              ? {
                  flexGrow: 1,
                  width: '100%',
                  minHeight: '100vh',
                  p: 0,
                  backgroundColor: '#020617'
                }
              : {
                  flexGrow: 1,
                  p: 0.25,
                  mt: isMobile ? 7 : 0,
                  width: {
                    xs: '100%',
                    md: `calc(100% - ${activeDrawerWidth}px)`
                  },
                  maxWidth: '100%',
                  minWidth: 0,
                  overflowX: 'hidden',
                  transition: theme.transitions.create('width', {
                    duration: theme.transitions.duration.shortest
                  })
                }
          }
        >
          <Suspense fallback={<Box sx={{ p: 3 }}><Typography>Cargando...</Typography></Box>}>
          <Routes>
            <Route path="/login" element={!usuario ? <Login /> : <Navigate to={esMesero ? '/restaurante' : '/dashboard'} />} />
            <Route path="/checkout/result" element={<CheckoutResult />} />
            <Route path="/" element={!usuario ? <Navigate to="/login" /> : esMesero ? <Navigate to="/restaurante" /> : <Productos />} />
            <Route
              path="/crear"
              element={esAdmin ? <CrearProducto /> : <Navigate to={rutaInicio} />}
            />
            <Route path="/categorias" element={usuarioGeneral ? <Categorias /> : <Navigate to={rutaInicio} />} />
            <Route
              path="/crear-usuario"
              element={esAdmin ? <CrearUsuario /> : <Navigate to={rutaInicio} />}
            />
            <Route
              path="/usuarios"
              element={esAdmin ? <ListaUsuarios /> : <Navigate to={rutaInicio} />}
            />
            <Route path="/pos" element={usuarioGeneral ? <POS /> : <Navigate to={rutaInicio} />} />
            <Route path="/dashboard" element={usuarioGeneral ? <Dashboard /> : <Navigate to={rutaInicio} />} />
            <Route path="/historial" element={usuarioGeneral ? <Historial /> : <Navigate to={rutaInicio} />} />
            <Route path="/caja" element={usuarioGeneral ? <Caja /> : <Navigate to={rutaInicio} />} />
            <Route
              path="/historial-cajas"
              element={esAdmin ? <HistorialCajas /> : <Navigate to={rutaInicio} />}
            />
            <Route path="/ticket" element={usuarioGeneral ? <Ticket /> : <Navigate to={rutaInicio} />} />
            <Route path="/ticket-caja" element={usuarioGeneral ? <TicketCaja /> : <Navigate to={rutaInicio} />} />
            <Route path="/tickets-abiertos" element={usuarioGeneral ? <TicketsAbiertos /> : <Navigate to={rutaInicio} />} />
            <Route path="/pedidos-web" element={usuarioGeneral ? <PedidosWeb /> : <Navigate to={rutaInicio} />} />
            <Route path="/restaurante" element={usuario ? <Restaurante /> : <Navigate to="/login" />} />
            <Route path="/locales" element={usuarioGeneral ? <Locales /> : <Navigate to={rutaInicio} />} />
            <Route path="/insumos" element={usuarioGeneral ? <Insumos /> : <Navigate to={rutaInicio} />} />
            <Route path="/agregados" element={usuarioGeneral ? <Agregados /> : <Navigate to={rutaInicio} />} />
            <Route path="/descuentos" element={esAdmin ? <Descuentos /> : <Navigate to={rutaInicio} />} />
            <Route
              path="/social"
              element={esAdmin ? <SocialConfig /> : <Navigate to={rutaInicio} />}
            />
            <Route
              path="/horario-tienda"
              element={esAdmin ? <HorarioTienda /> : <Navigate to={rutaInicio} />}
            />
            <Route
              path="/config-recibo"
              element={esAdmin ? <ConfigRecibo /> : <Navigate to={rutaInicio} />}
            />
            <Route path="*" element={<Navigate to={usuario ? rutaInicio : '/login'} />} />
          </Routes>
          </Suspense>
        </Box>

        <Snackbar
          open={localNoticeOpen}
          autoHideDuration={3500}
          onClose={() => setLocalNoticeOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity="warning"
            variant="filled"
            onClose={() => setLocalNoticeOpen(false)}
            sx={{ width: '100%' }}
          >
            {localNoticeMessage}
          </Alert>
        </Snackbar>
      </Box>
    </CajaProvider>
  );
}
