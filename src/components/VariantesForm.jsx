import { memo, useCallback } from 'react';
import {
  Box,
  Stack,
  TextField,
  Typography,
  IconButton,
  Button,
  Divider,
  FormControlLabel,
  Switch
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';

const varianteBase = {
  _id: undefined,
  nombre: '',
  color: '',
  talla: '',
  sku: '',
  precio: '',
  stock: '',
  agotado: false
};

const VarianteItem = memo(function VarianteItem({
  variante,
  index,
  onFieldChange,
  onRemove
}) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        p: 2
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle2">
          Variante #{index + 1}
        </Typography>
        <IconButton
          size="small"
          color="error"
          onClick={() => onRemove(index)}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Stack spacing={1.5}>
        <TextField
          label="Nombre identificador"
          value={variante.nombre}
          onChange={(e) => onFieldChange(index, 'nombre', e.target.value)}
          required
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            label="Color"
            value={variante.color || ''}
            onChange={(e) => onFieldChange(index, 'color', e.target.value)}
            fullWidth
          />
          <TextField
            label="Talla"
            value={variante.talla || ''}
            onChange={(e) => onFieldChange(index, 'talla', e.target.value)}
            fullWidth
          />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            label="SKU / código"
            value={variante.sku || ''}
            onChange={(e) => onFieldChange(index, 'sku', e.target.value)}
            fullWidth
          />
          <TextField
            label="Stock"
            type="number"
            value={variante.stock}
            onChange={(e) => onFieldChange(index, 'stock', e.target.value)}
            helperText="Vacío o 0 = stock libre"
            fullWidth
          />
          <TextField
            label="Precio (opcional)"
            type="number"
            value={variante.precio}
            onChange={(e) => onFieldChange(index, 'precio', e.target.value)}
            fullWidth
          />
        </Stack>
        <FormControlLabel
          control={
            <Switch
              checked={Boolean(variante.agotado)}
              onChange={(e) => onFieldChange(index, 'agotado', e.target.checked)}
            />
          }
          label="Marcar como agotado"
        />
      </Stack>
    </Box>
  );
}, (prevProps, nextProps) =>
  prevProps.index === nextProps.index &&
  prevProps.variante === nextProps.variante
);

export default function VariantesForm({ variantes = [], onChange }) {
  const handleChange = useCallback((index, field, value) => {
    const copia = variantes.map((item, idx) =>
      idx === index ? { ...item, [field]: value } : item
    );
    onChange?.(copia);
  }, [variantes, onChange]);

  const handleAdd = useCallback(() => {
    onChange?.([
      ...variantes,
      {
        ...varianteBase,
        tempId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
      }
    ]);
  }, [variantes, onChange]);

  const handleRemove = useCallback((index) => {
    const copia = variantes.filter((_, idx) => idx !== index);
    onChange?.(copia);
  }, [variantes, onChange]);

  return (
    <Stack spacing={2}>
      {variantes.length === 0 && (
        <Box
          sx={{
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
            textAlign: 'center',
            color: 'text.secondary'
          }}
        >
          <Typography variant="body2">
            Aún no agregas variantes. Usa el botón para crear combinaciones de color, talla, etc.
          </Typography>
        </Box>
      )}

      {variantes.map((variante, index) => (
        <VarianteItem
          key={variante._id || variante.tempId || index}
          variante={variante}
          index={index}
          onFieldChange={handleChange}
          onRemove={handleRemove}
        />
      ))}

      <Divider />

      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={handleAdd}
      >
        Agregar variante
      </Button>
    </Stack>
  );
}
