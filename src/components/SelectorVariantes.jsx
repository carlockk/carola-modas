import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Paper,
  Typography,
  Box
} from '@mui/material';

const formatearPrecio = (valor, fallback) => {
  const numero = Number(valor ?? fallback ?? 0);
  return `$${numero.toLocaleString()}`;
};

const normalizarStock = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
};

export default function SelectorVariantes({ open, onClose, producto, onSelect }) {
  const variantes = producto?.variantes || [];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Selecciona una variante</DialogTitle>
      <DialogContent dividers>
        {variantes.length === 0 ? (
          <Typography color="text.secondary">Este producto no tiene variantes configuradas.</Typography>
        ) : (
          <Stack spacing={2}>
            {variantes.map((vari) => {
              const stock = normalizarStock(vari.stock);
              const stockControlado = stock !== null;
              const agotado = Boolean(vari.agotado) || stock === 0;
              const atributos = [vari.color, vari.talla].filter(Boolean).join(' / ') || 'Sin atributos';
              const sku = vari.sku || 'Sin SKU';

              return (
                <Paper
                  key={vari._id || `${vari.nombre}-${atributos}`}
                  role="button"
                  tabIndex={agotado ? -1 : 0}
                  aria-disabled={agotado}
                  aria-label={`${agotado ? 'Variante agotada' : 'Agregar variante'} ${vari.nombre}`}
                  onClick={() => {
                    if (!agotado) onSelect?.(vari);
                  }}
                  onKeyDown={(event) => {
                    if (agotado) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelect?.(vari);
                    }
                  }}
                  sx={{
                    p: 2,
                    borderRadius: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2,
                    cursor: agotado ? 'not-allowed' : 'pointer',
                    opacity: agotado ? 0.58 : 1,
                    border: '1px solid',
                    borderColor: agotado ? 'divider' : 'transparent',
                    transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                    '&:hover': {
                      transform: agotado ? 'none' : 'translateY(-1px)',
                      borderColor: agotado ? 'divider' : 'primary.main',
                      boxShadow: agotado ? 'none' : 3
                    },
                    '&:active': {
                      transform: agotado ? 'none' : 'scale(0.99)'
                    },
                    '&:focus-visible': {
                      outline: '3px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: 2
                    }
                  }}
                >
                  <Box>
                    <Typography fontWeight={600}>{vari.nombre}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {atributos}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      SKU: {sku}
                    </Typography>
                    <Typography variant="body2">
                      {agotado ? 'Estado: AGOTADO' : stockControlado ? `Stock: ${stock}` : 'Stock libre'}
                    </Typography>
                    <Typography variant="body2">
                      Precio: {formatearPrecio(vari.precio, producto?.precio)}
                    </Typography>
                  </Box>
                </Paper>
              );
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
