import { FirebaseApp } from 'firebase/app';
import { Auth, getAuth, signInAnonymously } from 'firebase/auth';
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
  private auth: Auth;
  private db: Database;
  private registeredPeerId: string | null = null;

  constructor(firebaseApp: FirebaseApp) {
    this.app = firebaseApp;
    this.auth = getAuth(this.app);
    this.db = getDatabase(this.app);
  }

  async ensureSignedIn(): Promise<void> {
    if (!this.auth.currentUser) {
      await signInAnonymously(this.auth);
    }
  }

  async register(peer: IPeerContext): Promise<void> {
    await this.ensureSignedIn();
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
    await this.ensureSignedIn();
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
