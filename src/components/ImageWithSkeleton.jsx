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
    setLoaded(false);
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
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
            sx={{
              width: '100%',
              height: '100%',
              display: loaded ? 'block' : 'none',
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
