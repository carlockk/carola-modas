import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('recharts')) return 'vendor-charts';
          if (id.includes('@hello-pangea/dnd')) return 'vendor-dnd';
          if (
            id.includes('react-multi-date-picker') ||
            id.includes('@mui/x-date-pickers') ||
            id.includes('react-flatpickr') ||
            id.includes('flatpickr') ||
            id.includes('dayjs')
          ) {
            return 'vendor-dates';
          }
          if (id.includes('@mui') || id.includes('@emotion')) return 'vendor-mui';

          return 'vendor';
        }
      }
    }
  },
  server: {
    historyApiFallback: true, // 🔥 Para redirigir todas las rutas a index.html
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
