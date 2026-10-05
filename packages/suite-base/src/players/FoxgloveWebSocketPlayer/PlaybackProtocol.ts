// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export const PLAYBACK_CONTROL_CAPABILITY = "playbackControl";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export enum PlaybackCommand {
  Play = 0,
  Pause = 1,
}

export enum PlaybackStatus {
  Playing = 0,
  Paused = 1,
  Buffering = 2,
  Ended = 3,
}

export type PlaybackState = {
  status: PlaybackStatus;
  currentTime: bigint;
  playbackSpeed: number;
  didSeek: boolean;
  requestId?: string;
};

export function encodePlaybackControlRequest(
  command: PlaybackCommand,
  speed: number,
  seekTime: bigint | undefined,
  requestId: string,
): Uint8Array {
  const requestIdBytes = textEncoder.encode(requestId);
  const payload = new Uint8Array(1 + 1 + 4 + 1 + 8 + 4 + requestIdBytes.byteLength);
  const view = new DataView(payload.buffer);
  view.setUint8(0, 3);
  view.setUint8(1, command);
  view.setFloat32(2, speed, true);
  view.setUint8(6, seekTime == undefined ? 0 : 1);
  view.setBigUint64(7, seekTime ?? 0n, true);
  view.setUint32(15, requestIdBytes.byteLength, true);
  payload.set(requestIdBytes, 19);
  return payload;
}

export function parsePlaybackState(data: ArrayBuffer | ArrayBufferView): PlaybackState | undefined {
  const view = data instanceof ArrayBuffer
    ? new DataView(data)
    : new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.byteLength < 19 || view.getUint8(0) !== 5) {
    return undefined;
  }

  const status = view.getUint8(1);
  if (status > PlaybackStatus.Ended) {
    return undefined;
  }

  const requestIdLength = view.getUint32(15, true);
  if (view.byteLength < 19 + requestIdLength) {
    return undefined;
  }

  let requestId: string | undefined;
  if (requestIdLength > 0) {
    try {
      requestId = textDecoder.decode(
        new Uint8Array(view.buffer, view.byteOffset + 19, requestIdLength),
      );
    } catch {
      return undefined;
    }
  }

  return {
    status: status as PlaybackStatus,
    currentTime: view.getBigUint64(2, true),
    playbackSpeed: view.getFloat32(10, true),
    didSeek: view.getUint8(14) !== 0,
    requestId,
  };
}