import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' lets the built folder open from any static host or sub-path.
export default defineConfig({
  base: './',
  plugins: [react()],
});
