import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import type { MessageAction, Room } from '@trystero-p2p/firebase';
// @ts-ignore — resolved by webpack at bundle time
import { joinRoom, selfId } from '@trystero-p2p/firebase';

import { compressAsync, decompressAsync } from '../../util/compress';
import { MessagePack } from '../../util/message-pack';
import { setZeroTimeout } from '../../util/zero-timeout';
import { Connection, ConnectionCallback } from '../connection';
import { IPeerContext, PeerContext } from '../peer-context';
import { IRoomInfo, RoomInfo } from '../room-info';
import { TrysteroLobby } from './trystero-lobby';

interface DataContainer {
  data: Uint8Array;
  ttl: number;
  isCompressed?: boolean;
}

interface HelloPayload {
  peerId: string;
  userId: string;
}

type TrysteroPeerId = string;

export class TrysteroConnection implements Connection {
  get peerId(): string { return this._peer?.peerId ?? ''; }
  get peerIds(): string[] { return Array.from(this.trysteroToContext.keys()); }
  get peer(): PeerContext { return this._peer; }
  get peers(): PeerContext[] { return Array.from(this.trysteroToContext.values()); }

  readonly callback: ConnectionCallback = new ConnectionCallback();
  bandwidthUsage: number = 0;

  private _peer: PeerContext;
  private room: Room | null = null;
  private firebaseApp: FirebaseApp | null = null;
  private lobby: TrysteroLobby | null = null;
  private config: any = {};

  // Trystero peer ID → Udonarium PeerContext
  private trysteroToContext: Map<TrysteroPeerId, PeerContext> = new Map();
  // Udonarium peerId → Trystero peer ID
  private udonariumToTrystero: Map<string, TrysteroPeerId> = new Map();

  private gameAction: MessageAction<ArrayBuffer> | null = null;
  private helloAction: MessageAction<HelloPayload> | null = null;

  private outboundQueue: Promise<void> = Promise.resolve();
  private inboundQueue: Promise<void> = Promise.resolve();

  configure(config: any) {
    this.config = config;
  }

  open(userId?: string): void;
  open(userId: string, roomId: string, roomName: string, password: string): void;
  open(...args: any[]): void {
    let peer: PeerContext;
    if (args.length === 0) {
      peer = PeerContext.create(PeerContext.generateId());
    } else if (args.length === 1) {
      peer = PeerContext.create(args[0]);
    } else {
      peer = PeerContext.create(args[0], args[1], args[2], args[3]);
    }
    this._peer = peer;
    this.openAsync(peer);
  }

  close(): void {
    this.lobby?.unregister();
    this.room?.leave();
    this.room = null;
    this.gameAction = null;
    this.helloAction = null;
    this.trysteroToContext.clear();
    this.udonariumToTrystero.clear();
    if (this._peer?.isOpen) {
      this._peer.isOpen = false;
      if (this.callback.onClose) this.callback.onClose(this._peer);
    }
  }

  connect(peer: IPeerContext): boolean {
    // Already connected
    if (this.udonariumToTrystero.has(peer.peerId)) return true;
    // Valid room peer — Trystero will connect automatically;
    // return true so the lobby waits for the CONNECT_PEER event
    // instead of treating it as an immediate failure.
    if (this._peer?.isRoom && this._peer.verifyPeer(peer.peerId)) return true;
    return false;
  }

  disconnect(peer: IPeerContext): boolean {
    const trysteroId = this.udonariumToTrystero.get(peer.peerId);
    if (!trysteroId) return false;
    this.removePeer(trysteroId);
    return true;
  }

  disconnectAll(): void {
    for (const context of this.trysteroToContext.values()) {
      if (this.callback.onDisconnect) this.callback.onDisconnect(context);
    }
    this.trysteroToContext.clear();
    this.udonariumToTrystero.clear();
  }

  send(data: any, sendTo?: string): void {
    if (this.trysteroToContext.size < 1) return;

    const container: DataContainer = {
      data: MessagePack.encode(data),
      ttl: 0,
    };

    const byteLength = container.data.byteLength;
    this.bandwidthUsage += byteLength;

    this.outboundQueue = this.outboundQueue.then(() => new Promise<void>(resolve => {
      setZeroTimeout(async () => {
        if (1024 < container.data.byteLength && Array.isArray(data) && 1 < data.length) {
          const compressed = await compressAsync(container.data);
          if (compressed.byteLength < container.data.byteLength) {
            container.data = compressed;
            container.isCompressed = true;
          }
        }

        const encoded = MessagePack.encode(container).buffer as ArrayBuffer;

        if (sendTo) {
          const trysteroId = this.udonariumToTrystero.get(sendTo);
          if (trysteroId && this.gameAction) {
            this.gameAction.send(encoded, { target: [trysteroId] });
          }
        } else if (this.gameAction) {
          this.gameAction.send(encoded);
        }

        this.bandwidthUsage -= byteLength;
        resolve();
      });
    }));
  }

  async listAllPeers(): Promise<string[]> {
    return this.lobby?.listAllPeers() ?? [];
  }

  async listAllRooms(): Promise<IRoomInfo[]> {
    const peerIds = await this.listAllPeers();
    return RoomInfo.listFrom(peerIds);
  }

  private async openAsync(peer: PeerContext): Promise<void> {
    const firebaseConfig = this.config?.trystero?.firebase;
    if (!firebaseConfig?.databaseURL) {
      const msg = 'Trystero: Firebase databaseURL が設定されていません。config.yaml を確認してください。';
      console.error(msg);
      if (this.callback.onError) this.callback.onError(peer, 'trystero-config', msg, {});
      return;
    }

    try {
      const appName = 'trystero-main';
      const existing = getApps().find(a => a.name === appName);
      this.firebaseApp = existing ?? initializeApp(firebaseConfig, appName);

      this.lobby = new TrysteroLobby(firebaseConfig);
      if (peer.isRoom) await this.lobby.register(peer);

      const trysteroRoomId = this.calcTrysteroRoomId(peer);
      this.room = joinRoom(
        {
          appId: firebaseConfig.databaseURL,
          relayConfig: { firebaseApp: this.firebaseApp },
        },
        trysteroRoomId
      );

      const gameAction = this.room.makeAction<ArrayBuffer>('game');
      const helloAction = this.room.makeAction<HelloPayload>('hello');
      this.gameAction = gameAction;
      this.helloAction = helloAction;

      gameAction.onMessage = (buffer: ArrayBuffer, { peerId: trysteroId }) => {
        this.onGameData(trysteroId, buffer);
      };

      helloAction.onMessage = (payload: HelloPayload, { peerId: trysteroId }) => {
        this.onHello(trysteroId, payload);
      };

      this.room.onPeerJoin = (trysteroId: TrysteroPeerId) => {
        console.log('Trystero: peer joined', trysteroId);
        // Send our Udonarium identity to the new peer
        this.helloAction?.send(
          { peerId: this._peer.peerId, userId: this._peer.userId },
          { target: [trysteroId] }
        );
      };

      this.room.onPeerLeave = (trysteroId: TrysteroPeerId) => {
        console.log('Trystero: peer left', trysteroId);
        this.removePeer(trysteroId);
      };

      this._peer.isOpen = true;
      if (this.callback.onOpen) this.callback.onOpen(this._peer);

    } catch (error) {
      console.error('Trystero open error:', error);
      if (this.callback.onError) {
        this.callback.onError(peer, 'trystero-open', String(error), error);
      }
    }
  }

  // Derive Trystero room ID from Udonarium room params
  // All peers in the same room will compute the same ID
  private calcTrysteroRoomId(peer: PeerContext): string {
    if (!peer.isRoom) return `private-${peer.digestUserId}`;
    // Use the non-userId part of peerId: roomId + encoded roomName + digestPassword
    return `room-${peer.peerId.slice(6)}`;
  }

  private onHello(trysteroId: TrysteroPeerId, payload: HelloPayload): void {
    const context = PeerContext.parse(payload.peerId);
    context.userId = payload.userId;

    if (this._peer.isRoom && !this._peer.verifyPeer(payload.peerId)) {
      console.warn('Trystero: invalid peer rejected', payload.peerId);
      return;
    }

    context.isOpen = true;
    this.trysteroToContext.set(trysteroId, context);
    this.udonariumToTrystero.set(payload.peerId, trysteroId);

    if (this.callback.onConnect) this.callback.onConnect(context);
  }

  private removePeer(trysteroId: TrysteroPeerId): void {
    const context = this.trysteroToContext.get(trysteroId);
    this.trysteroToContext.delete(trysteroId);
    if (context) {
      this.udonariumToTrystero.delete(context.peerId);
      context.isOpen = false;
      if (this.callback.onDisconnect) this.callback.onDisconnect(context);
    }
  }

  private onGameData(trysteroId: TrysteroPeerId, buffer: ArrayBuffer): void {
    const peer = this.trysteroToContext.get(trysteroId);
    if (!peer) {
      console.warn('Trystero: data from unknown peer', trysteroId);
      return;
    }

    const byteLength = buffer.byteLength;
    this.bandwidthUsage += byteLength;

    this.inboundQueue = this.inboundQueue.then(() => new Promise<void>(resolve => {
      setZeroTimeout(async () => {
        if (!this.callback.onData) { resolve(); return; }

        const container = MessagePack.decode(new Uint8Array(buffer)) as DataContainer;
        const raw = container.isCompressed
          ? await decompressAsync(container.data)
          : container.data;

        this.callback.onData(peer, MessagePack.decode(raw));
        this.bandwidthUsage -= byteLength;
        resolve();
      });
    }));
  }
}
