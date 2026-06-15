import { Box, Typography, Button } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { obtenerConfigRecibo } from '../services/api';

export default function VistaTicket({ venta }) {
  const ticketRef = useRef();
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'Vista Ticket';
    return () => {
      document.title = originalTitle;
    };
  }, []);

  useEffect(() => {
    const cargarConfig = async () => {
      try {
        const res = await obtenerConfigRecibo();
        setConfig(res.data);
      } catch {
        setConfig({ nombre: 'Ticket de Venta' });
      }
    };
    cargarConfig();
  }, []);

  const handleImprimir = () => {
    const printContent = ticketRef.current.innerHTML;
    const ventana = window.open('', '', 'width=600,height=800');
    ventana.document.write(`
      <html>
        <head>
          <title>Ticket</title>
          <style>
            @page {
              size: auto;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: monospace;
              font-size: 14px;
              background: white;
              color: black;
            }
            .ticket {
              width: 80mm;
              max-width: 100%;
              margin: auto;
              padding: 10px;
              text-align: center;
            }
            hr {
              border: none;
              border-top: 1px dashed #999;
              margin: 10px 0;
            }
            .bold {
              font-weight: bold;
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="ticket">
            ${printContent}
          </div>
        </body>
      </html>
    `);
    ventana.document.close();
  };

  if (!venta) return null;

  return (
    <>
      <style>
        {`
        @media screen {
          body[data-theme='dark'] #ticket-vista {
            background-color: #1e1e1e;
            color: #f0f0f0;
          }

          body[data-theme='dark'] #ticket-vista hr {
            border-top: 1px dashed #666;
          }
        }

        @media print {
          .no-print {
            display: none !important;
          }
        }

        hr {
          border: none;
          border-top: 1px dashed #999;
          margin: 10px 0;
        }
        `}
      </style>

      <Box
        id="ticket-vista"
        ref={ticketRef}
        sx={{
          textAlign: 'center',
          px: 1,
        py: 2
      }}
    >
        {config?.logo_url && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
            <img src={config.logo_url} alt="Logo" style={{ maxWidth: 120, maxHeight: 80 }} />
          </Box>
        )}
        <Typography className="bold" fontSize="1.2rem">
          {config?.nombre || 'Ticket de Venta'}
        </Typography>
        <Typography>N° Pedido: #{String(venta.numero_pedido).padStart(2, '0')}</Typography>
        <Typography fontSize="0.8rem">
          {new Date(venta.fecha).toLocaleString()}
        </Typography>

        <hr />

        {venta.productos.map((item, i) => (
          <Box key={i} sx={{ mb: 1 }}>
            <Typography>
              {item.nombre}
              {item.varianteNombre ? ` (${item.varianteNombre})` : ''} x{item.cantidad}
            </Typography>
            {Array.isArray(item.atributos) && item.atributos.length > 0 && (
              <Typography variant="caption">
                {item.atributos.map(attr => `${attr.nombre}: ${attr.valor}`).join(' | ')}
              </Typography>
            )}
            {Array.isArray(item.agregados) && item.agregados.length > 0 && (
              <Typography variant="caption" display="block">
                Agregados: {item.agregados.map((agg) => agg.nombre).join(', ')}
              </Typography>
            )}
            {item.observacion && (
              <Typography variant="caption">Obs: {item.observacion}</Typography>
            )}
            {item.descuento?.nombre && (
              <Typography variant="caption" display="block">
                Desc. {item.descuento.nombre}: -${((Number(item.descuento.monto) || 0) * item.cantidad).toLocaleString()}
              </Typography>
            )}
            <Typography>${item.precio_unitario.toLocaleString()} c/u</Typography>
          </Box>
        ))}

        {/* 🔽 Total resaltado con líneas */}
        <Box sx={{ my: 2 }}>
          <hr />
          {Number(venta.descuento_total || 0) > 0 && (
            <>
              <Typography>Subtotal: ${Number(venta.subtotal || 0).toLocaleString()}</Typography>
              <Typography>Descuentos: -${Number(venta.descuento_total || 0).toLocaleString()}</Typography>
            </>
          )}
          <Typography className="bold" sx={{ fontSize: '1rem', my: 1 }}>
            Total: ${venta.total.toLocaleString()}
          </Typography>
          <hr />
        </Box>

        <Typography>Pago: {venta.tipo_pago || '—'}</Typography>
        {Array.isArray(venta.pagos) && venta.pagos.length > 0 && (
          <Box sx={{ mt: 0.5 }}>
            {venta.pagos.map((pago, index) => (
              <Typography key={`${pago.tipo}-${index}`}>
                {pago.tipo}: ${Number(pago.monto || 0).toLocaleString()}
              </Typography>
            ))}
          </Box>
        )}
        {typeof venta.monto_recibido === 'number' && (
          <Typography>Recibido: ${venta.monto_recibido.toLocaleString()}</Typography>
        )}
        {typeof venta.vuelto === 'number' && venta.vuelto >= 0 && (
          <Typography>Vuelto: ${venta.vuelto.toLocaleString()}</Typography>
        )}
        {venta.tipo_pedido && venta.tipo_pedido !== '—' && (
          <Typography>Pedido: {venta.tipo_pedido}</Typography>
        )}
        {(venta.cobrador_nombre || venta?.usuario?.nombre || venta?.usuario?.email) && (
          <Typography>
            Cobrado por: {venta.cobrador_nombre || venta?.usuario?.nombre || venta?.usuario?.email}
          </Typography>
        )}
        {venta.origen_cobro && (
          <Typography>Origen cobro: {venta.origen_cobro}</Typography>
        )}

        {config?.pie && (
          <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
            {config.pie}
          </Typography>
        )}
      </Box>

      {/* 🔘 Botón fuera de la impresión */}
      <Box className="no-print" sx={{ mt: 2, maxWidth: 400, mx: 'auto' }}>
        <Button
          variant="outlined"
          fullWidth
          onClick={handleImprimir}
        >
          🖨️ Imprimir Ticket
        </Button>
      </Box>
    </>
  );
}
