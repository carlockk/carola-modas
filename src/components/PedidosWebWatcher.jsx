import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Typography
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { obtenerPedidosWeb } from '../services/api';

const CERRADOS = new Set(['entregado', 'rechazado', 'cancelado']);

const getEstado = (pedido) =>
  String(pedido?.estado_pedido || pedido?.estado || pedido?.status || 'pendiente').toLowerCase();

const getClienteLabel = (pedido) => {
  const nombre = pedido?.cliente_nombre || '';
  const telefono = pedido?.cliente_telefono || '';
  if (nombre && telefono) return `${nombre} (${telefono})`;
  return nombre || telefono || 'Cliente sin datos';
};

const getLocalId = (selectedLocal, usuario) => {
  if (typeof selectedLocal === 'string') return selectedLocal;
  if (selectedLocal?._id) return selectedLocal._id;
  if (typeof usuario?.local === 'string') return usuario.local;
  if (usuario?.local?._id) return usuario.local._id;
  return '';
};

const getPedidoDate = (pedido) =>
  new Date(pedido?.fecha || pedido?.createdAt || pedido?.updatedAt || 0).getTime();

const playAlertSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.25);
  } catch {
    // ignore
  }
};

export default function PedidosWebWatcher() {
  const { usuario, selectedLocal } = useAuth();
  const navigate = useNavigate();
  const [alertaPedido, setAlertaPedido] = useState(null);
  const pollingRef = useRef(null);
  const requestInFlightRef = useRef(false);

  const localId = useMemo(() => getLocalId(selectedLocal, usuario), [selectedLocal, usuario]);
  const puedeGestionar = ['admin', 'superadmin', 'cajero'].includes(usuario?.rol || '');

  useEffect(() => {
    if (!usuario || !puedeGestionar || !localId) return undefined;

    const storageKey = `pedidos_web_seen_${localId}`;
    const loadSeen = () => {
      try {
        const raw = sessionStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(parsed) ? parsed : []);
      } catch {
        return new Set();
      }
    };

    const saveSeen = (seenSet) => {
      const arr = Array.from(seenSet).slice(-400);
      sessionStorage.setItem(storageKey, JSON.stringify(arr));
    };

    const revisarPedidos = async () => {
      if (document.visibilityState === 'hidden' || requestInFlightRef.current) {
        return;
      }

      requestInFlightRef.current = true;
      try {
        const res = await obtenerPedidosWeb();
        const pedidos = Array.isArray(res.data) ? res.data : [];
        const abiertos = pedidos
          .filter((p) => !CERRADOS.has(getEstado(p)))
          .sort((a, b) => getPedidoDate(b) - getPedidoDate(a));

        const seen = loadSeen();
        const nuevo = abiertos.find((p) => !seen.has(p._id));

        if (nuevo) {
          playAlertSound();
          setAlertaPedido(nuevo);
          seen.add(nuevo._id);
          saveSeen(seen);
        }
      } catch {
        // ignore polling errors
      } finally {
        requestInFlightRef.current = false;
      }
    };

    revisarPedidos();
    pollingRef.current = setInterval(revisarPedidos, 15000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [usuario, puedeGestionar, localId]);

  if (!usuario || !puedeGestionar || !localId) return null;

  return (
    <Dialog
      open={Boolean(alertaPedido)}
      onClose={() => setAlertaPedido(null)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Nuevo pedido web</DialogTitle>
      <DialogContent dividers>
        {alertaPedido && (
          <Box sx={{ display: 'grid', gap: 1.25 }}>
            <Typography>
              <strong>Pedido:</strong> #{String(alertaPedido.numero_pedido || alertaPedido._id?.slice(-5) || '').trim()}
            </Typography>
            <Typography>
              <strong>Cliente:</strong> {getClienteLabel(alertaPedido)}
            </Typography>
            <Typography>
              <strong>Total:</strong> ${Number(alertaPedido.total || 0).toLocaleString('es-CL')}
            </Typography>
            <Typography>
              <strong>Estado:</strong>{' '}
              <Chip size="small" label={getEstado(alertaPedido)} color="warning" />
            </Typography>
            <Typography sx={{ mt: 0.5 }}><strong>Productos:</strong></Typography>
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              {(alertaPedido.productos || []).map((prod, i) => (
                <li key={`${prod?.nombre || 'item'}-${i}`}>
                  {prod?.nombre || 'Producto'} x {prod?.cantidad || 1}
                </li>
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setAlertaPedido(null)}>Cerrar</Button>
        <Button
          variant="contained"
          onClick={() => {
            const id = alertaPedido?._id;
            setAlertaPedido(null);
            navigate('/pedidos-web', { state: { focusPedidoId: id } });
          }}
        >
          Ver pedido
        </Button>
      </DialogActions>
    </Dialog>
  );
}
