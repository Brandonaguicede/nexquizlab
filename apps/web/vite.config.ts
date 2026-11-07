import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// Root environment file is shared by local services; only VITE_* is exposed.
export default defineConfig({ plugins: [react(), tailwindcss()], envDir: '../..', server: { port: 5173 } });
