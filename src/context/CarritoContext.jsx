/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';

const CarritoContext = createContext();

export const useCarrito = () => useContext(CarritoContext);

const normalizarDescuento = (descuento) => {
  if (!descuento) return null;
  const descuentoId = descuento.descuentoId || descuento._id || null;
  const nombre = String(descuento.nombre || '').trim();
  const tipo = descuento.tipo === 'fijo' ? 'fijo' : descuento.tipo === 'porcentaje' ? 'porcentaje' : null;
  const valor = Number(descuento.valor);
  const esManual = Boolean(descuento.manual) || !descuentoId;
  if ((!descuentoId && !esManual) || !nombre || !tipo || !Number.isFinite(valor) || valor <= 0) return null;
  return { descuentoId, nombre, tipo, valor, manual: esManual };
};

const normalizarAgregados = (agregados) => {
  if (!Array.isArray(agregados)) return [];
  return agregados
    .map((agg) => {
      if (!agg) return null;
      const agregadoId = agg.agregadoId || agg._id || null;
      const nombre = (agg.nombre || '').toString().trim();
      if (!nombre) return null;
      const precio = Number(agg.precio);
      return {
        agregadoId,
        nombre,
        precio: Number.isFinite(precio) && precio > 0 ? precio : 0,
        grupo: agg.grupo || null,
        grupos: Array.isArray(agg.grupos) ? agg.grupos : []
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
};

const normalizarVariantes = (variantes) => {
  if (!Array.isArray(variantes)) return [];
  return variantes
    .map((variante) => {
      if (!variante) return null;
      const nombre = (variante.nombre || '').toString().trim();
      if (!nombre) return null;
      return {
        _id: variante._id || null,
        nombre,
        precio: variante.precio,
        stock: variante.stock,
        agotado: Boolean(variante.agotado),
        color: variante.color || '',
        talla: variante.talla || '',
        sku: variante.sku || ''
      };
    })
    .filter(Boolean);
};

const buildKey = (productoId, varianteId, agregados = []) => {
  const addonsKey = normalizarAgregados(agregados)
    .map((agg) => agg.agregadoId || agg.nombre)
    .join('|');
  return `${productoId}-${varianteId || 'base'}-${addonsKey || 'sin-agregados'}`;
};

const construirAtributos = (variante, atributos) => {
  if (Array.isArray(atributos) && atributos.length > 0) {
    return atributos;
  }
  const detalle = [];
  if (variante?.color) detalle.push({ nombre: 'Color', valor: variante.color });
  if (variante?.talla) detalle.push({ nombre: 'Talla', valor: variante.talla });
  return detalle;
};

const obtenerStockDisponible = (producto, variante) => {
  if (variante?.agotado) {
    return 0;
  }
  if (variante) {
    if (variante.stock === null || variante.stock === undefined || variante.stock === '') {
      return null;
    }
    const stockVariante = Number(variante.stock);
    if (Number.isFinite(stockVariante) && stockVariante >= 0) {
      return stockVariante;
    }
  }
  if (producto?.stock === null || producto?.stock === undefined || producto?.stock === '') {
    return null;
  }
  const stockProducto = Number(producto?.stock);
  if (Number.isFinite(stockProducto) && stockProducto >= 0) return stockProducto;
  return null;
};

const mergeItems = (items) => {
  const mapa = new Map();
  items.forEach((item) => {
    if (mapa.has(item.idCarrito)) {
      const existente = mapa.get(item.idCarrito);
      mapa.set(item.idCarrito, {
        ...existente,
        cantidad: existente.cantidad + item.cantidad,
        observacion: existente.observacion || item.observacion,
        agregadosDisponibles:
          Array.isArray(existente.agregadosDisponibles) && existente.agregadosDisponibles.length > 0
            ? existente.agregadosDisponibles
            : item.agregadosDisponibles,
        variantesDisponibles:
          Array.isArray(existente.variantesDisponibles) && existente.variantesDisponibles.length > 0
            ? existente.variantesDisponibles
            : item.variantesDisponibles,
        stockDisponible:
          typeof existente.stockDisponible === 'number'
            ? existente.stockDisponible
            : item.stockDisponible
      });
    } else {
      mapa.set(item.idCarrito, { ...item });
    }
  });
  return Array.from(mapa.values());
};

const calcularPrecioAgregados = (agregados = []) =>
  agregados.reduce((acc, agg) => acc + (Number(agg.precio) || 0), 0);

const recalcularPrecioItem = (item) => {
  const precioAgregados = calcularPrecioAgregados(item.agregados);
  const precioBase = Number(item.precioBase ?? (Number(item.precio) - Number(item.precioAgregados || 0))) || 0;
  return {
    ...item,
    precioBase,
    precioAgregados,
    precio: precioBase + precioAgregados
  };
};

export function CarritoProvider({ children }) {
  const [carrito, setCarrito] = useState([]);
  const [descuentoVenta, setDescuentoVenta] = useState(null);

  const agregarProducto = (producto, variante = null, opciones = {}) => {
    setCarrito((prev) => {
      const productoId = producto._id || producto.productoId;
      const varianteId = variante?._id || null;
      const agregados = normalizarAgregados(opciones?.agregados);
      const agregadosDisponibles = normalizarAgregados(
        Array.isArray(producto?.agregados)
          ? producto.agregados.filter((agg) => agg?.nombre && agg?.activo !== false)
          : []
      );
      const variantesDisponibles = normalizarVariantes(
        Array.isArray(producto?.variantes) ? producto.variantes : []
      );
      const key = buildKey(productoId, varianteId, agregados);
      const stockDisponible = obtenerStockDisponible(producto, variante);
      if (stockDisponible === 0) {
        return prev;
      }
      const precioBase =
        variante && variante.precio !== undefined && variante.precio !== null
          ? variante.precio
          : producto.precio;
      const precioBaseNumerico = Number(precioBase) || 0;
      const precioAgregados = calcularPrecioAgregados(agregados);
      const precio = precioBaseNumerico + precioAgregados;

      const existente = prev.find((p) => p.idCarrito === key);
      if (existente) {
        const max = typeof existente.stockDisponible === 'number' ? existente.stockDisponible : Infinity;
        if (existente.cantidad >= max) {
          return prev;
        }
        return prev.map((p) =>
          p.idCarrito === key
            ? { ...p, cantidad: Math.min(max, p.cantidad + 1) }
            : p
        );
      }

      return [
        ...prev,
        {
          idCarrito: key,
          _id: productoId,
          nombre: producto.nombre,
          varianteId,
          varianteNombre: variante?.nombre || '',
          atributos: construirAtributos(variante),
          agregados,
          agregadosDisponibles,
          variantesDisponibles,
          precioBase: precioBaseNumerico,
          precioAgregados,
          precio,
          cantidad: 1,
          observacion: '',
          descuento: null,
          stockDisponible
        }
      ];
    });
  };

  const actualizarCantidad = (id, cantidad) => {
    setCarrito((prev) =>
      prev.map((item) => {
        if (item.idCarrito !== id) return item;
        const max = typeof item.stockDisponible === 'number' ? item.stockDisponible : Infinity;
        const nuevaCantidad = Math.min(Math.max(1, cantidad), max);
        return { ...item, cantidad: nuevaCantidad };
      })
    );
  };

  const actualizarObservacion = (id, texto) => {
    setCarrito((prev) =>
      prev.map((item) =>
        item.idCarrito === id ? { ...item, observacion: texto } : item
      )
    );
  };

  const actualizarItemCarrito = (id, cambios = {}) => {
    setCarrito((prev) =>
      prev.map((item) => {
        if (item.idCarrito !== id) return item;
        const { variante: varianteActualizada, ...restCambios } = cambios;
        const precioBaseVariante =
          varianteActualizada && varianteActualizada.precio !== undefined && varianteActualizada.precio !== null
            ? Number(varianteActualizada.precio) || 0
            : item.precioBase;
        const stockDisponible =
          varianteActualizada
            ? obtenerStockDisponible(item, varianteActualizada)
            : item.stockDisponible;

        return recalcularPrecioItem({
          ...item,
          ...restCambios,
          ...(varianteActualizada
            ? {
                varianteId: varianteActualizada._id || null,
                varianteNombre: varianteActualizada.nombre || '',
                atributos: construirAtributos(varianteActualizada),
                precioBase: precioBaseVariante,
                stockDisponible,
                cantidad:
                  typeof stockDisponible === 'number'
                    ? Math.min(item.cantidad, stockDisponible)
                    : item.cantidad
              }
            : {}),
          agregados: Array.isArray(cambios.agregados) ? normalizarAgregados(cambios.agregados) : item.agregados
        });
      })
    );
  };

  const eliminarProducto = (id) => {
    setCarrito((prev) => prev.filter((item) => item.idCarrito !== id));
  };

  const vaciarCarrito = () => {
    setCarrito([]);
    setDescuentoVenta(null);
  };

  const actualizarDescuentoVenta = (descuento) => setDescuentoVenta(normalizarDescuento(descuento));

  const cargarCarrito = (items, reset = false) => {
    const normalizado = mergeItems(
      (items || []).map((p) => {
        const productoId = p.productoId || p._id;
        const varianteId = p.varianteId || null;
        const agregados = normalizarAgregados(p.agregados);
        const agregadosDisponibles = normalizarAgregados(p.agregadosDisponibles);
        const variantesDisponibles = normalizarVariantes(p.variantesDisponibles);
        const precio = Number(p.precio ?? p.precio_unitario) || 0;
        const precioAgregados = calcularPrecioAgregados(agregados);
        return {
          idCarrito: buildKey(productoId, varianteId, agregados),
          _id: productoId,
          nombre: p.nombre,
          varianteId,
          varianteNombre: p.varianteNombre || '',
          atributos: Array.isArray(p.atributos) ? p.atributos : [],
          agregados,
          agregadosDisponibles,
          variantesDisponibles,
          precioBase: Number(p.precioBase ?? (precio - precioAgregados)) || 0,
          precioAgregados,
          precio,
          cantidad: p.cantidad || 1,
          observacion: p.observacion || '',
          descuento: normalizarDescuento(p.descuento),
          stockDisponible: typeof p.stockDisponible === 'number' ? p.stockDisponible : null
        };
      })
    );

    if (reset) {
      setCarrito(normalizado);
    } else {
      setCarrito((prev) => mergeItems([...prev, ...normalizado]));
    }
  };

  return (
    <CarritoContext.Provider
      value={{
        carrito,
        agregarProducto,
        actualizarCantidad,
        actualizarObservacion,
        actualizarItemCarrito,
        eliminarProducto,
        vaciarCarrito,
        cargarCarrito,
        descuentoVenta,
        actualizarDescuentoVenta
      }}
    >
      {children}
    </CarritoContext.Provider>
  );
}
