import { io, type Socket } from 'socket.io-client';
import { API_URL, getAccessToken, refreshSession } from './client';

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(API_URL, {
      auth: {
        token: getAccessToken(),
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('[socket] connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected:', reason);
    });

    socket.on('connect_error', async (err) => {
      console.warn('[socket] connect_error:', err.message);
      // Try to refresh the access token before the next reconnect attempt
      const refreshed = await refreshSession();
      if (refreshed) {
        const freshToken = getAccessToken();
        if (freshToken) {
          socket!.auth = { token: freshToken };
        }
      }
    });
  } else {
    socket.auth = {
      token: getAccessToken(),
    };
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
