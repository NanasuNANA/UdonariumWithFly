import { FirebaseApp } from 'firebase/app';
import { Database, get, getDatabase, onDisconnect, ref, remove, set } from 'firebase/database';
import { IPeerContext } from '../peer-context';

const LOBBY_ROOT = 'udonarium-lobby';
const STALE_MS = 10 * 60 * 1000;

interface LobbyEntry {
  peerId: string;
  timestamp: number;
}

export class TrysteroLobby {
  private app: FirebaseApp;
  private db: Database;
  private registeredPeerId: string | null = null;

  constructor(firebaseApp: FirebaseApp) {
    this.app = firebaseApp;
    this.db = getDatabase(this.app);
  }

  async register(peer: IPeerContext): Promise<void> {
    this.registeredPeerId = peer.peerId;
    const peerRef = ref(this.db, `${LOBBY_ROOT}/peers/${peer.peerId}`);
    const entry: LobbyEntry = { peerId: peer.peerId, timestamp: Date.now() };
    await set(peerRef, entry);
    onDisconnect(peerRef).remove();
  }

  async unregister(): Promise<void> {
    if (!this.registeredPeerId) return;
    const peerRef = ref(this.db, `${LOBBY_ROOT}/peers/${this.registeredPeerId}`);
    await remove(peerRef);
    this.registeredPeerId = null;
  }

  async listAllPeers(): Promise<string[]> {
    const snap = await get(ref(this.db, `${LOBBY_ROOT}/peers`));
    if (!snap.exists()) return [];

    const now = Date.now();
    const peerIds: string[] = [];

    snap.forEach(child => {
      const entry = child.val() as LobbyEntry;
      if (entry?.peerId && now - (entry.timestamp ?? 0) < STALE_MS) {
        peerIds.push(entry.peerId);
      }
    });

    return peerIds;
  }
}
