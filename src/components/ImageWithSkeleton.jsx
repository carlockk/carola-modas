import { useEffect, useState } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';

export default function ImageWithSkeleton({
  src,
  alt,
  onClick,
  containerSx = {},
  imageSx = {},
  fallback = null
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!src) {
      setLoaded(false);
      return;
    }

    setLoaded(false);

    const image = new window.Image();
    image.onload = () => setLoaded(true);
    image.onerror = () => setLoaded(true);
    image.src = src;

    if (image.complete) {
      setLoaded(true);
    }
  }, [src]);

  return (
    <Box
      onClick={src && onClick ? onClick : undefined}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        ...containerSx
      }}
    >
      {src ? (
        <>
          {!loaded && (
            <Skeleton
              variant="rectangular"
              animation="wave"
              sx={{
                position: 'absolute',
                inset: 0,
                transform: 'none',
                borderRadius: 'inherit'
              }}
            />
          )}
          <Box
            component="img"
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            sx={{
              width: '100%',
              height: '100%',
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.15s ease',
              verticalAlign: 'middle',
              ...imageSx
            }}
          />
        </>
      ) : (
        fallback || (
          <Typography variant="caption" color="text.secondary" align="center">
            Sin imagen
          </Typography>
        )
      )}
    </Box>
  );
}
