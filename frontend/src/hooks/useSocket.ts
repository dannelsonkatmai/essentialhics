import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.store';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001';

let socketInstance: Socket | null = null;

export function getSocket(): Socket | null {
  return socketInstance;
}

export function useSocket() {
  const token = useAuthStore((s) => s.accessToken);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;
    socketInstance = socket;

    return () => {
      socket.disconnect();
      socketInstance = null;
    };
  }, [token]);

  const joinIncident = useCallback((incidentId: string) => {
    socketRef.current?.emit('join:incident', incidentId);
  }, []);

  const leaveIncident = useCallback((incidentId: string) => {
    socketRef.current?.emit('leave:incident', incidentId);
  }, []);

  const on = useCallback(<T>(event: string, handler: (data: T) => void) => {
    socketRef.current?.on(event, handler);
    return () => { socketRef.current?.off(event, handler); };
  }, []);

  return { socket: socketRef.current, joinIncident, leaveIncident, on };
}

// Lightweight hook for subscribing to a specific incident's events
export function useIncidentSocket(incidentId: string | undefined) {
  const { socket, joinIncident, leaveIncident } = useSocket();

  useEffect(() => {
    if (!incidentId) return;
    joinIncident(incidentId);
    return () => leaveIncident(incidentId);
  }, [incidentId, joinIncident, leaveIncident]);

  return socket;
}
