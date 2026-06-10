import { useEffect, useState } from 'react';
import { Box, Typography, Divider, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { obtenerHistorialCaja } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function HistorialCajas() {
  const { selectedLocal } = useAuth();
  const [cajas, setCajas] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    obtenerHistorialCaja().then(res => setCajas(res.data)).catch(() => {});
  }, [selectedLocal?._id]);

  const handleImprimir = (caja) => {
    const resumen = {
      apertura: caja.apertura,
      cierre: caja.cierre,
      monto_inicial: caja.monto_inicial,
      vendido: caja.monto_total_vendido ?? 0,
      devoluciones: caja.monto_total_devoluciones ?? 0,
      total_neto: caja.monto_total_neto ?? caja.monto_total_vendido ?? 0,
      total: caja.monto_total_final ?? caja.monto_inicial,
      usuario: caja.usuario || 'No registrado',
      desglose_por_pago: caja.desglose_por_pago || {},
      desglose_devoluciones_por_pago: caja.desglose_devoluciones_por_pago || {},
      detalle_devoluciones: caja.devoluciones || [],
    };

    navigate('/ticket-caja', { state: { resumen } });
  };

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" gutterBottom>📚 Historial de Cajas</Typography>

      {cajas.map((caja, i) => (
        <Box key={i} sx={{ mb: 3, p: 2, border: '1px solid #ccc', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1">Caja #{cajas.length - i}</Typography>
            {caja.cierre && (
              <Button size="small" variant="outlined" onClick={() => handleImprimir(caja)}>
                🖨️ Imprimir
              </Button>
            )}
          </Box>

          <Typography>Apertura: {new Date(caja.apertura).toLocaleString()}</Typography>
          <Typography>Cierre: {caja.cierre ? new Date(caja.cierre).toLocaleString() : '— (abierta)'}</Typography>
          <Typography>Monto Inicial: ${caja.monto_inicial.toLocaleString()}</Typography>
          <Typography>Ventas Brutas: ${caja.monto_total_vendido?.toLocaleString() ?? '0'}</Typography>
          <Typography>Devoluciones: -${Number(caja.monto_total_devoluciones || 0).toLocaleString()}</Typography>
          <Typography>Venta Neta: ${Number(caja.monto_total_neto ?? caja.monto_total_vendido ?? 0).toLocaleString()}</Typography>
          <Typography>Total Final: ${caja.monto_total_final?.toLocaleString() ?? caja.monto_inicial.toLocaleString()}</Typography>
          <Typography>Usuario: {caja.usuario || 'No registrado'}</Typography>

          {caja.desglose_por_pago && Object.keys(caja.desglose_por_pago).length > 0 && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2">Desglose por pago:</Typography>
              {Object.entries(caja.desglose_por_pago).map(([tipo, valor]) => (
                <Typography key={tipo}>{tipo}: ${valor.toLocaleString()}</Typography>
              ))}
            </>
          )}
        </Box>
      ))}

      {cajas.length === 0 && (
        <Typography>No hay cajas registradas aún.</Typography>
      )}
    </Box>
  );
}
