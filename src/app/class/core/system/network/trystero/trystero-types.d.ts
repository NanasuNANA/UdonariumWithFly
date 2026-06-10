// Ambient declarations for trystero/firebase
// Needed because the package's exports field lacks a "types" entry for subpaths

declare module '@trystero-p2p/firebase' {
  import type { FirebaseApp } from 'firebase/app';

  export const selfId: string;

  export interface SendOptions {
    target?: string | string[] | null;
    metadata?: unknown;
  }

  export interface MessageContext {
    peerId: string;
    metadata?: unknown;
  }

  export interface MessageAction<T> {
    send: (data: T, options?: SendOptions) => Promise<void>;
    onMessage: ((data: T, context: MessageContext) => void | Promise<void>) | null;
    onReceiveProgress: unknown;
  }

  export interface Room {
    makeAction<T>(namespace: string): MessageAction<T>;
    leave: () => Promise<void>;
    getPeers: () => Record<string, RTCPeerConnection>;
    onPeerJoin: ((peerId: string) => void) | null;
    onPeerLeave: ((peerId: string) => void) | null;
    ping: (id: string) => Promise<number>;
  }

  export interface FirebaseRoomConfig {
    appId: string;
    password?: string;
    relayConfig?: {
      firebaseApp?: FirebaseApp;
      firebasePath?: string;
    };
    rtcConfig?: RTCConfiguration;
  }

  export function joinRoom(config: FirebaseRoomConfig, roomId: string): Room;
}
