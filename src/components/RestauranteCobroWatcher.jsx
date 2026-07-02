import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { obtenerComandasPendientesCaja } from '../services/api';

const getLocalId = (selectedLocal, usuario) => {
  if (typeof selectedLocal === 'string') return selectedLocal;
  if (selectedLocal?._id) return selectedLocal._id;
  if (typeof usuario?.local === 'string') return usuario.local;
  if (usuario?.local?._id) return usuario.local._id;
  return '';
};

const beep = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(740, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {
    // ignore
  }
};

export default function RestauranteCobroWatcher() {
  const { usuario, selectedLocal } = useAuth();
  const navigate = useNavigate();
  const pollingRef = useRef(null);
  const requestInFlightRef = useRef(false);
  const [alerta, setAlerta] = useState(null);

  const puedeCobrar = ['admin', 'superadmin', 'cajero'].includes(usuario?.rol || '');
  const localId = useMemo(() => getLocalId(selectedLocal, usuario), [selectedLocal, usuario]);

  useEffect(() => {
    if (!usuario || !puedeCobrar || !localId) return undefined;

    const storageKey = `restaurante_cobros_seen_${localId}`;
    const readSeen = () => {
      try {
        const raw = sessionStorage.getItem(storageKey);
        const arr = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(arr) ? arr : []);
      } catch {
        return new Set();
      }
    };
    const writeSeen = (setSeen) => {
      sessionStorage.setItem(storageKey, JSON.stringify(Array.from(setSeen).slice(-400)));
    };

    const revisar = async () => {
      if (document.visibilityState === 'hidden' || requestInFlightRef.current) {
        return;
      }

      requestInFlightRef.current = true;
      try {
        const res = await obtenerComandasPendientesCaja();
        const pendientes = Array.isArray(res.data) ? res.data : [];
        const seen = readSeen();
        const nueva = pendientes.find((item) => !seen.has(item._id));
        if (nueva) {
          seen.add(nueva._id);
          writeSeen(seen);
          beep();
          setAlerta(nueva);
        }
      } catch {
        // ignore
      } finally {
        requestInFlightRef.current = false;
      }
    };

    revisar();
    pollingRef.current = setInterval(revisar, 15000);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [usuario, puedeCobrar, localId]);

  if (!usuario || !puedeCobrar || !localId) return null;

  return (
    <Dialog open={Boolean(alerta)} onClose={() => setAlerta(null)} fullWidth maxWidth="xs">
      <DialogTitle>Cobro pendiente restaurante</DialogTitle>
      <DialogContent dividers>
        {alerta && (
          <Box sx={{ display: 'grid', gap: 1 }}>
            <Typography>
              Tienes un cobro pendiente de la mesa <strong>#{alerta?.mesa?.numero || '-'}</strong>.
            </Typography>
            <Typography variant="body2">
              Total: <strong>${Number(alerta?.total || 0).toLocaleString('es-CL')}</strong>
            </Typography>
            <Typography variant="body2">
              Items: {Array.isArray(alerta?.items) ? alerta.items.length : 0}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setAlerta(null)}>Después</Button>
        <Button
          variant="contained"
          onClick={() => {
            const comanda = alerta;
            setAlerta(null);
            navigate('/pos', { state: { comandaPendiente: comanda } });
          }}
        >
          Ir al POS
        </Button>
      </DialogActions>
    </Dialog>
  );
}
