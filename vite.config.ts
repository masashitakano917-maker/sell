import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: 'dist' },
  optimizeDeps: {
    include: ['@supabase/supabase-js', 'react', 'react-dom', 'lucide-react'],
  },
});
