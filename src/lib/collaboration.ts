/**
 * Yjs + Supabase Realtime collaboration transport
 *
 * Architecture:
 * - Each document gets a Y.Doc instance on the client
 * - Supabase Realtime Broadcast channels relay Yjs sync/awareness messages
 * - Document state is persisted to documents.content on a debounced interval
 */

import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import type { RealtimeChannel } from '@supabase/supabase-js'

export const MESSAGE_SYNC = 0
export const MESSAGE_AWARENESS = 1

export interface CollaboratorUser {
  id: string
  name: string
  color: string
  avatar?: string
}

const USER_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
]

export function getUserColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

export class SupabaseProvider {
  doc: Y.Doc
  awareness: Awareness
  channel: RealtimeChannel
  documentId: string
  connected = false
  private _synced = false
  private _onSyncCallbacks: Array<() => void> = []

  constructor(
    doc: Y.Doc,
    channel: RealtimeChannel,
    documentId: string,
    user: CollaboratorUser
  ) {
    this.doc = doc
    this.channel = channel
    this.documentId = documentId
    this.awareness = new Awareness(doc)

    // Set local user state
    this.awareness.setLocalStateField('user', {
      name: user.name,
      color: user.color,
      avatar: user.avatar,
      id: user.id,
    })

    // Handle incoming broadcast messages
    channel.on('broadcast', { event: 'yjs-sync' }, ({ payload }) => {
      if (!payload?.data) return
      const data = new Uint8Array(payload.data)
      const decoder = decoding.createDecoder(data)
      const messageType = decoding.readVarUint(decoder)

      if (messageType === MESSAGE_SYNC) {
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, MESSAGE_SYNC)
        const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, this.doc, this)
        if (syncMessageType === syncProtocol.messageYjsSyncStep1) {
          // Send sync step 2 back
          const reply = encoding.toUint8Array(encoder)
          if (reply.byteLength > 1) this._broadcast(reply)
        }
        if (!this._synced) {
          this._synced = true
          this._onSyncCallbacks.forEach(cb => cb())
        }
      } else if (messageType === MESSAGE_AWARENESS) {
        awarenessProtocol.applyAwarenessUpdate(
          this.awareness,
          decoding.readVarUint8Array(decoder),
          this
        )
      }
    })

    // Handle awareness updates from others
    this.awareness.on('update', ({ added, updated, removed }: { added: number[], updated: number[], removed: number[] }) => {
      const changedClients = added.concat(updated).concat(removed)
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS)
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
      )
      this._broadcast(encoding.toUint8Array(encoder))
    })

    // Send initial sync step 1 when connected
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.connected = true
        this._sendSyncStep1()
        this._broadcastAwareness()
      }
    })

    // Propagate doc updates to peers
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === this) return
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MESSAGE_SYNC)
      syncProtocol.writeUpdate(encoder, update)
      this._broadcast(encoding.toUint8Array(encoder))
    })
  }

  private _broadcast(data: Uint8Array) {
    if (!this.connected) return
    this.channel.send({
      type: 'broadcast',
      event: 'yjs-sync',
      payload: { data: Array.from(data) },
    })
  }

  private _sendSyncStep1() {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_SYNC)
    syncProtocol.writeSyncStep1(encoder, this.doc)
    this._broadcast(encoding.toUint8Array(encoder))
  }

  private _broadcastAwareness() {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS)
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(
        this.awareness,
        [this.doc.clientID]
      )
    )
    this._broadcast(encoding.toUint8Array(encoder))
  }

  onSync(callback: () => void) {
    if (this._synced) callback()
    else this._onSyncCallbacks.push(callback)
  }

  destroy() {
    awarenessProtocol.removeAwarenessStates(
      this.awareness,
      [this.doc.clientID],
      'window unload'
    )
    this.awareness.destroy()
    this.doc.destroy()
  }
}
