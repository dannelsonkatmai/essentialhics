import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/auth.store';

// Socket.io is not available without the backend; stub the interface
// so the rest of the app compiles and socket-dependent code fails gracefully.

export function getSocket(): null {
  return null;
}

export function useSocket() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const socketRef = useRef<null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Socket.io backend not available in Supabase environment
  }, [isAuthenticated]);

  const joinIncident = useCallback((_incidentId: string) => {}, []);
  const leaveIncident = useCallback((_incidentId: string) => {}, []);
  const on = useCallback(<T>(_event: string, _handler: (data: T) => void) => {
    return () => {};
  }, []);

  return { socket: socketRef.current, joinIncident, leaveIncident, on };
}

export function useIncidentSocket(incidentId: string | undefined) {
  const { joinIncident, leaveIncident } = useSocket();

  useEffect(() => {
    if (!incidentId) return;
    joinIncident(incidentId);
    return () => leaveIncident(incidentId);
  }, [incidentId, joinIncident, leaveIncident]);

  return null;
}
