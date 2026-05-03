import { spawn } from 'child_process';
import { request } from 'http';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VITE_PORT = 5173;
const VITE_URL = `http://127.0.0.1:${VITE_PORT}`;
const MAX_RETRIES = 120;
const RETRY_INTERVAL = 500;

function pollServer(url, retries) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      const req = request(url, (res) => {
        resolve();
      });
      req.on('error', () => {
        if (remaining <= 0) {
          reject(new Error(`Vite server did not start after ${MAX_RETRIES} attempts`));
        } else {
          setTimeout(() => attempt(remaining - 1), RETRY_INTERVAL);
        }
      });
      req.end();
    };
    attempt(retries);
  });
}

const viteProcess = spawn('npx', ['vite', '--host', '127.0.0.1'], {
  stdio: ['ignore', 'inherit', 'inherit'],
  shell: true,
});

process.on('exit', () => {
  viteProcess.kill();
});

pollServer(VITE_URL, MAX_RETRIES)
  .then(() => {
    const electronProcess = spawn('npx', ['electron', path.resolve(__dirname, 'main.cjs')], {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, ELECTRON_DEV: '1' },
      shell: true,
    });

    process.on('exit', () => {
      electronProcess.kill();
    });

    electronProcess.on('exit', () => {
      viteProcess.kill();
      process.exit();
    });
  })
  .catch((err) => {
    console.error(err.message);
    viteProcess.kill();
    process.exit(1);
  });
