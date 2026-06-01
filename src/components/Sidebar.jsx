import {
  Drawer,
  Box,
  Typography,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Button,
  Collapse,
  useMediaQuery,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';

import { useTheme } from '@mui/material/styles';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LogoutIcon from '@mui/icons-material/LogoutOutlined';
import { useAuth } from '../context/AuthContext';
import { useEffect, useRef, useState } from 'react';
import { useCaja } from '../context/CajaContext';
import { guardarLogoWebCliente, obtenerConfigSocial, obtenerLocales } from '../services/api';

// Icons
import DashboardIcon from '@mui/icons-material/DashboardOutlined';
import InventoryIcon from '@mui/icons-material/Inventory2Outlined';
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import PointOfSaleIcon from '@mui/icons-material/PointOfSaleOutlined';
import HistoryIcon from '@mui/icons-material/HistoryOutlined';
import StoreIcon from '@mui/icons-material/StoreOutlined';
import StorefrontIcon from '@mui/icons-material/StorefrontOutlined';
import PeopleAltIcon from '@mui/icons-material/PeopleAltOutlined';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import LanguageIcon from '@mui/icons-material/Language';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import { useThemeMode } from '../context/ThemeContext';
import logo from '../possail.png';

const expandedDrawerWidth = 280;

export default function Sidebar({
  mobileOpen,
  toggleDrawer,
  collapsed = false,
  onToggleCollapsed,
  drawerWidth = expandedDrawerWidth
}) {
  const { usuario, logout, selectedLocal, seleccionarLocal } = useAuth();
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { modoOscuro, toggleTema } = useThemeMode();
  const { cajaAbierta } = useCaja(); // ✅ Estado dinámico de caja
  const esMesero = usuario?.rol === 'mesero';

  const [openMenus, setOpenMenus] = useState({
    caja: false,
    usuarios: false,
  });
  const [locales, setLocales] = useState([]);
  const [localesLoading, setLocalesLoading] = useState(false);
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  const [logoWebUrl, setLogoWebUrl] = useState('');
  const [logoWebActual, setLogoWebActual] = useState('');
  const [logoWebFile, setLogoWebFile] = useState(null);
  const [logoWebSaving, setLogoWebSaving] = useState(false);
  const [logoWebError, setLogoWebError] = useState('');
  const drawerContentRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('sidebarMenus');
    if (saved) {
      const parsed = JSON.parse(saved);
      setOpenMenus({
        caja: Boolean(parsed.caja),
        usuarios: Boolean(parsed.usuarios),
      });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebarMenus', JSON.stringify(openMenus));
  }, [openMenus]);

  useEffect(() => {
    if (isMobile && toggleDrawer) {
      toggleDrawer();
    }
  }, [location]);

  useEffect(() => {
    const root = drawerContentRef.current;
    if (!root) return;

    const buttons = root.querySelectorAll('.MuiListItemButton-root');
    buttons.forEach((button) => {
      const label = button.querySelector('.MuiListItemText-root')?.textContent?.trim() || '';
      if (!isMobile && collapsed && label) {
        button.setAttribute('title', label);
      } else {
        button.removeAttribute('title');
      }
    });
  }, [collapsed, isMobile, openMenus]);

  useEffect(() => {
    const cargarLocales = async () => {
      if (usuario?.rol !== 'superadmin') return;
      setLocalesLoading(true);
      try {
        const res = await obtenerLocales();
        setLocales(res.data || []);
      } catch (err) {
        setLocales([]);
      } finally {
        setLocalesLoading(false);
      }
    };

    cargarLocales();
  }, [usuario?.rol]);

  const toggleMenu = (key) => {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const abrirDialogLogoWeb = async () => {
    setLogoWebError('');
    setLogoWebFile(null);
    try {
      const res = await obtenerConfigSocial();
      const current = String(res?.data?.logo_url || '').trim();
      setLogoWebActual(current);
      setLogoWebUrl(current);
    } catch (_err) {
      setLogoWebActual('');
      setLogoWebUrl('');
    }
    setLogoDialogOpen(true);
  };

  const guardarLogoWeb = async (removeLogo = false) => {
    setLogoWebSaving(true);
    setLogoWebError('');
    try {
      const data = new FormData();
      data.append('remove_logo', removeLogo ? 'true' : 'false');
      if (!removeLogo) {
        data.append('logo_url', logoWebUrl.trim());
      }
      if (logoWebFile) {
        data.append('logo', logoWebFile);
      }
      const res = await guardarLogoWebCliente(data);
      const current = String(res?.data?.logo_url || '').trim();
      setLogoWebActual(current);
      setLogoWebUrl(current);
      setLogoWebFile(null);
      setLogoDialogOpen(false);
    } catch (err) {
      setLogoWebError(err?.response?.data?.error || 'No se pudo guardar el logo web.');
    } finally {
      setLogoWebSaving(false);
    }
  };

  const drawerContent = (
    <Box
      ref={drawerContentRef}
      sx={{
        width: drawerWidth,
        minWidth: drawerWidth,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#111827',
        color: '#fff',
        borderRight: '1px solid #1f2937',
        overflowX: 'hidden',
        transition: theme.transitions.create(['width', 'min-width'], {
          duration: theme.transitions.duration.shortest
        }),
        '& .MuiListItemButton-root': !isMobile && collapsed
          ? {
              px: 0,
              justifyContent: 'center',
              position: 'relative',
              overflow: 'visible'
            }
          : undefined,
        '& .MuiListItemButton-root > .MuiBox-root': !isMobile && collapsed
          ? {
              mr: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }
          : undefined,
        '& .MuiListItemText-root': !isMobile && collapsed
          ? {
              display: 'none'
            }
          : undefined,
        '& .MuiCollapse-root': !isMobile && collapsed
          ? {
              display: 'none'
            }
          : undefined,
        '& .MuiListItemButton-root .MuiSvgIcon-root + .MuiSvgIcon-root': !isMobile && collapsed
          ? {
              display: 'none'
            }
          : undefined,
      }}
    >
      {/* Header */}
      <Box sx={{ p: collapsed && !isMobile ? 1.25 : 2 }}>
  {!isMobile && (
    <Box sx={{ display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end', mb: 1 }}>
      <Tooltip title={collapsed ? 'Mostrar menú' : 'Ocultar menú'}>
        <IconButton
          size="small"
          onClick={onToggleCollapsed}
          sx={{ color: '#93c5fd', border: '1px solid #374151' }}
        >
          {collapsed ? <ChevronRightIcon fontSize="small" /> : <MenuOpenIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Box>
  )}
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
    <img
      src={logo}
      alt="POS System"
      style={{
        width: collapsed && !isMobile ? 40 : '58%',
        height: collapsed && !isMobile ? 34 : 50,
        maxWidth: 112,
        objectFit: 'contain'
      }}
    />
    {(usuario?.rol === 'admin' || usuario?.rol === 'superadmin') && !isMobile && !collapsed && (
      <Tooltip title="Cambiar logo web cliente">
        <IconButton
          size="small"
          onClick={abrirDialogLogoWeb}
          sx={{ color: '#93c5fd', border: '1px solid #374151' }}
        >
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    )}
  </Box>
  {!collapsed && (
  <Typography sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center', fontSize: '0.9rem' }}>
    Sistema de punto de venta
  </Typography>
  )}
  {usuario && !collapsed && (
    <Typography variant="body2" sx={{ mt: 1, color: '#9ca3af', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
      👤 {usuario.email} ({usuario.rol})
    </Typography>
  )}
  {usuario?.local?.nombre && !collapsed && (
    <Typography variant="body2" sx={{ mt: 0.5, color: '#9ca3af', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
      📍 {usuario.local.nombre}
    </Typography>
  )}
  {(usuario?.rol === 'admin' || usuario?.rol === 'superadmin') && isMobile && (
    <Typography
      variant="caption"
      onClick={abrirDialogLogoWeb}
      sx={{
        mt: 0.5,
        color: '#4b5563',
        fontSize: '10px',
        lineHeight: 1.2,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer'
      }}
    >
      Cambiar logo web cliente
    </Typography>
  )}
  {usuario?.rol === 'superadmin' && !collapsed && (
    <Box sx={{ mt: 2 }}>
      <FormControl fullWidth size="small">
        <InputLabel id="locales-select-label" sx={{ color: '#e5e7eb' }}>
          Local activo
        </InputLabel>
        <Select
          labelId="locales-select-label"
          label="Local activo"
          value={selectedLocal?._id || ''}
          onChange={(e) => {
            const local = locales.find((item) => item._id === e.target.value);
            seleccionarLocal(local || null);
          }}
          disabled={localesLoading || locales.length === 0}
          sx={{
            color: '#fff',
            '.MuiOutlinedInput-notchedOutline': { borderColor: '#374151' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4b5563' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#93c5fd' },
            '.MuiSvgIcon-root': { color: '#e5e7eb' },
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                bgcolor: '#111827',
                color: '#fff',
              },
            },
          }}
        >
          <MenuItem value="" sx={{ color: '#e5e7eb' }}>
            {localesLoading ? 'Cargando...' : 'Selecciona un local'}
          </MenuItem>
          {locales.map((local) => (
            <MenuItem key={local._id} value={local._id} sx={{ color: '#fff' }}>
              {local.nombre}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  )}
</Box>

      <Divider sx={{ borderColor: '#374151' }} />

      <List
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          pr: 0.5,
          '&::-webkit-scrollbar': {
            width: '8px'
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#0f172a'
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#334155',
            borderRadius: '8px'
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: '#475569'
          }
        }}
      >
        {esMesero ? (
          <ListItem disablePadding>
            <ListItemButton component={Link} to="/restaurante" sx={{ px: 3, py: 1.5, color: '#d1d5db' }}>
              <Box sx={{ mr: 2 }}><RestaurantIcon /></Box>
              <ListItemText primary="Restaurante" />
            </ListItemButton>
          </ListItem>
        ) : (
          <>
        <ListItem disablePadding>
          <ListItemButton component={Link} to="/dashboard" sx={{ px: 3, py: 1.5, color: '#d1d5db' }}>
            <Box sx={{ mr: 2 }}><DashboardIcon /></Box>
            <ListItemText primary="Dashboard" />
          </ListItemButton>
        </ListItem>

        {/* Productos */}
        <ListItem disablePadding>
          <ListItemButton component={Link} to="/" sx={{ px: 3, py: 1.5, color: '#d1d5db' }}>
            <Box sx={{ mr: 2 }}><InventoryIcon /></Box>
            <ListItemText primary="Productos" />
          </ListItemButton>
        </ListItem>

        {/* Insumos */}
        {usuario && (
          <ListItem disablePadding>
            <ListItemButton component={Link} to="/insumos" sx={{ px: 3, py: 1.5, color: '#d1d5db' }}>
              <Box sx={{ mr: 2 }}><InventoryOutlinedIcon /></Box>
              <ListItemText primary="Insumos" />
            </ListItemButton>
          </ListItem>
        )}

        {(usuario?.rol === 'admin' || usuario?.rol === 'superadmin' || usuario?.rol === 'cajero') && (
          <ListItem disablePadding>
            <ListItemButton component={Link} to="/agregados" sx={{ px: 3, py: 1.5, color: '#d1d5db' }}>
              <Box sx={{ mr: 2 }}><AddCircleOutlineIcon /></Box>
              <ListItemText primary="Agregados" />
            </ListItemButton>
          </ListItem>
        )}

        {/* Categorias */}
        {(usuario?.rol === 'admin' || usuario?.rol === 'superadmin') && (
          <ListItem disablePadding>
            <ListItemButton component={Link} to="/categorias" sx={{ px: 3, py: 1.5, color: '#d1d5db' }}>
              <Box sx={{ mr: 2 }}><StoreIcon /></Box>
              <ListItemText primary="Categorias" />
            </ListItemButton>
          </ListItem>
        )}

        {/* Locales */}
        {(usuario?.rol === 'admin' || usuario?.rol === 'superadmin') && (
          <ListItem disablePadding>
            <ListItemButton component={Link} to="/locales" sx={{ px: 3, py: 1.5, color: '#d1d5db' }}>
              <Box sx={{ mr: 2 }}><StorefrontIcon /></Box>
              <ListItemText primary="Locales" />
            </ListItemButton>
          </ListItem>
        )}

        {/* Configuracion recibos */}
        {(usuario?.rol === 'admin' || usuario?.rol === 'superadmin') && (
          <ListItem disablePadding>
            <ListItemButton component={Link} to="/config-recibo" sx={{ px: 3, py: 1.5, color: '#d1d5db' }}>
              <Box sx={{ mr: 2 }}><ReceiptLongIcon /></Box>
              <ListItemText primary="Configuracion de Recibos" />
            </ListItemButton>
          </ListItem>
        )}


        {/* Configuracion social */}
        {(usuario?.rol === 'admin' || usuario?.rol === 'superadmin') && (
          <ListItem disablePadding>
            <ListItemButton component={Link} to="/social" sx={{ px: 3, py: 1.5, color: '#d1d5db' }}>
              <Box sx={{ mr: 2 }}><LanguageIcon /></Box>
              <ListItemText primary="Social" />
            </ListItemButton>
          </ListItem>
        )}
        {(usuario?.rol === 'admin' || usuario?.rol === 'superadmin') && (
          <ListItem disablePadding>
            <ListItemButton component={Link} to="/horario-tienda" sx={{ px: 3, py: 1.5, color: '#d1d5db' }}>
              <Box sx={{ mr: 2 }}><AccessTimeIcon /></Box>
              <ListItemText primary="Horario de la tienda" />
            </ListItemButton>
          </ListItem>
        )}
        {/* POS */}
        <ListItem disablePadding>
          <ListItemButton component={Link} to="/pos" sx={{ px: 3, py: 1.5, color: '#d1d5db' }}>
            <Box sx={{ mr: 2 }}><PointOfSaleIcon /></Box>
            <ListItemText primary="POS" />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton component={Link} to="/restaurante" sx={{ px: 3, py: 1.5, color: '#d1d5db' }}>
            <Box sx={{ mr: 2 }}><RestaurantIcon /></Box>
            <ListItemText primary="Restaurante" />
          </ListItemButton>
        </ListItem>

        {/* Historial */}
        <ListItem disablePadding>
          <ListItemButton component={Link} to="/historial" sx={{ px: 3, py: 1.5, color: '#d1d5db' }}>
            <Box sx={{ mr: 2 }}><HistoryIcon /></Box>
            <ListItemText primary="Historial de tickets" />
          </ListItemButton>
        </ListItem>

 {/* tickets abiertos */}
        <ListItem disablePadding>
  <ListItemButton component={Link} to="/tickets-abiertos" sx={{ px: 3, py: 1.5, color: '#d1d5db' }}>
    <Box sx={{ mr: 2 }}><StoreIcon /></Box>
    <ListItemText primary="Tickets Abiertos" />
  </ListItemButton>
</ListItem>

        {/* pedidos web */}
        {(usuario?.rol === 'admin' || usuario?.rol === 'superadmin' || usuario?.rol === 'cajero') && (
          <ListItem disablePadding>
            <ListItemButton component={Link} to="/pedidos-web" sx={{ px: 3, py: 1.5, color: '#d1d5db' }}>
              <Box sx={{ mr: 2 }}><LanguageIcon /></Box>
              <ListItemText primary="Pedidos Web" />
            </ListItemButton>
          </ListItem>
        )}

        {/* Solo admin */}
        {(usuario?.rol === 'admin' || usuario?.rol === 'superadmin' || usuario?.rol === 'cajero') && (
          <>
            {/* Caja */}
            <ListItemButton onClick={() => toggleMenu('caja')} sx={{ px: 3, py: 1.5, color: '#d1d5db' }}>
              <Box sx={{ mr: 2 }}><StoreIcon /></Box>
              <ListItemText primary="Caja" />
              {openMenus.caja ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            <Collapse in={openMenus.caja} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                <ListItemButton component={Link} to="/caja" sx={{ pl: 5, py: 1, color: '#d1d5db' }}>
                  <ListItemText primary={cajaAbierta ? 'Cerrar Caja' : 'Abrir Caja'} />
                </ListItemButton>
                {(usuario?.rol === 'admin' || usuario?.rol === 'superadmin') && (
                  <ListItemButton component={Link} to="/historial-cajas" sx={{ pl: 5, py: 1, color: '#d1d5db' }}>
                    <ListItemText primary="Historial de Cajas" />
                  </ListItemButton>
                )}
              </List>
            </Collapse>

            {/* Usuarios */}
            {(usuario?.rol === 'admin' || usuario?.rol === 'superadmin') && (
              <ListItem disablePadding>
                <ListItemButton component={Link} to="/usuarios" sx={{ px: 3, py: 1.5, color: '#d1d5db' }}>
                  <Box sx={{ mr: 2 }}><PeopleAltIcon /></Box>
                  <ListItemText primary="Usuarios" />
                </ListItemButton>
              </ListItem>
            )}
          </>
        )}
          </>
        )}
      </List>

      {/* Cambiar tema + Cerrar sesión */}
      <Box
        sx={{
          px: collapsed && !isMobile ? 1 : 2,
          py: 1,
          display: 'flex',
          justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
          alignItems: 'center'
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: '#9ca3af',
            display: collapsed && !isMobile ? 'none' : 'block'
          }}
        >
          Tema
        </Typography>
        <Tooltip title="Cambiar tema">
          <IconButton onClick={toggleTema} color="inherit" sx={{ mr: collapsed && !isMobile ? 0 : 2.5 }}>
            {modoOscuro ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
        </Tooltip>
      </Box>

      {usuario && (
        <Box sx={{ p: collapsed && !isMobile ? 1 : 2 }}>
          <Button
            fullWidth={!collapsed || isMobile}
            color="error"
            variant="outlined"
            startIcon={<LogoutIcon />}
            onClick={() => {
              logout();
              navigate('/login');
            }}
            sx={{
              color: '#f87171',
              borderColor: '#f87171',
              minWidth: collapsed && !isMobile ? 44 : undefined,
              width: collapsed && !isMobile ? 44 : '90%',
              px: collapsed && !isMobile ? 0 : undefined,
              '& .MuiButton-startIcon': {
                mr: collapsed && !isMobile ? 0 : 1
              },
              '&:hover': {
                backgroundColor: '#7f1d1d',
                color: '#fff',
                borderColor: '#ef4444',
              }
            }}
          >
            {collapsed && !isMobile ? '' : 'Cerrar Sesión'}
          </Button>
        </Box>
      )}

      <Dialog open={logoDialogOpen} onClose={() => setLogoDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Cambiar logo frontend cliente</DialogTitle>
        <DialogContent dividers>
          {logoWebError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {logoWebError}
            </Alert>
          )}
          {!!logoWebActual && (
            <Box sx={{ mb: 2, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ mb: 1 }}>Logo actual</Typography>
              <img src={logoWebActual} alt="Logo web cliente" style={{ maxHeight: 70, maxWidth: '100%' }} />
            </Box>
          )}
          <TextField
            fullWidth
            label="URL del logo (opcional)"
            placeholder="https://..."
            value={logoWebUrl}
            onChange={(e) => setLogoWebUrl(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Button variant="outlined" component="label">
            Subir imagen
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={(e) => setLogoWebFile(e.target.files?.[0] || null)}
            />
          </Button>
          {logoWebFile && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Archivo: {logoWebFile.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogoDialogOpen(false)}>Cancelar</Button>
          <Button color="error" onClick={() => guardarLogoWeb(true)} disabled={logoWebSaving}>
            Quitar logo
          </Button>
          <Button variant="contained" onClick={() => guardarLogoWeb(false)} disabled={logoWebSaving}>
            {logoWebSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'permanent'}
      open={isMobile ? mobileOpen : true}
      onClose={toggleDrawer}
      ModalProps={{ keepMounted: true }}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: '#111827',
          overflowX: 'hidden',
          ...(isMobile
            ? {
                marginTop: '56px',
                height: 'calc(100% - 56px)'
              }
            : {})
        }
      }}
    >
      {drawerContent}
    </Drawer>
  );
}



