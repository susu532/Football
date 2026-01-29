/**
 * OmniPitch 3D Soccer Experience
 * Copyright (c) 2026 OmniPitch Games. All Rights Reserved.
 *
 * This file is proprietary and confidential.
 * Unauthorized copying, transfer, or use is strictly prohibited.
 */

export const codeToRoomId = new Map()
export const roomIdToCode = new Map()

export function registerPrivateRoom(roomId, code) {
  codeToRoomId.set(code, roomId)
  roomIdToCode.set(roomId, code)
}

export function unregisterRoom(roomId) {
  const code = roomIdToCode.get(roomId)
  if (code) {
    codeToRoomId.delete(code)
  }
  roomIdToCode.delete(roomId)
}

export function getRoomIdByCode(code) {
  return codeToRoomId.get(code)
}
