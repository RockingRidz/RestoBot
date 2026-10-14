import { app } from '../../server';
import type { Server } from 'node:http';
export async function openTestServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test listener');
  return { url: `http://127.0.0.1:${address.port}`, close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
