
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all envs instead of just those with `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
    },
    define: {
      // Expose the API_KEY to the browser as process.env.API_KEY
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
  };
});
