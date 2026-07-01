const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });

const loadImageElement = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    image.src = src;
  });

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo convertir la imagen'));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });

export const optimizeImageFile = async (
  file,
  {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.82,
    outputType = 'image/jpeg'
  } = {}
) => {
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    return file;
  }

  try {
    const src = await readFileAsDataUrl(file);
    const image = await loadImageElement(src);

    const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return file;

    ctx.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, outputType, quality);

    if (blob.size >= file.size) {
      return file;
    }

    const originalName = String(file.name || 'imagen').replace(/\.[^.]+$/, '');
    return new File([blob], `${originalName}.jpg`, {
      type: outputType,
      lastModified: Date.now()
    });
  } catch (error) {
    console.error('No se pudo optimizar la imagen antes de subirla:', error);
    return file;
  }
};
