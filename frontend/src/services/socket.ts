import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      // eslint-disable-next-line no-console
      console.log('[socket] connected', socket?.id);
    });
    socket.on('disconnect', (reason) => {
      // eslint-disable-next-line no-console
      console.log('[socket] disconnected:', reason);
    });
    socket.on('connect_error', (err) => {
      // eslint-disable-next-line no-console
      console.warn('[socket] error:', err.message);
    });
  }
  return socket;
}

export function joinRoom(room: 'kitchen' | 'cashiers' | 'managers') {
  const s = getSocket();
  const emit = () => s.emit(`join:${room}`);
  if (s.connected) emit();
  else s.once('connect', emit);
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
