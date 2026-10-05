// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { IWebSocket } from "@foxglove/ws-protocol";
import { v4 as uuidv4 } from "uuid";

import {
  encodePlaybackControlRequest,
  parsePlaybackState,
  PlaybackCommand,
} from "./PlaybackProtocol";
import type { PlaybackState } from "./PlaybackProtocol";

export {
  PLAYBACK_CONTROL_CAPABILITY,
  PlaybackCommand,
  PlaybackStatus,
} from "./PlaybackProtocol";
export type { PlaybackState } from "./PlaybackProtocol";

type PlaybackStateListener = (state: PlaybackState) => void;

function getMessageData(event: unknown): unknown {
  if (typeof event === "object" && event != undefined) {
    if ("type" in event && event.type === "message" && "data" in event) {
      return event.data;
    }
    if ("data" in event) {
      return event.data;
    }
  }
  return event;
}

function isBinaryData(data: unknown): data is ArrayBuffer | ArrayBufferView {
  return data instanceof ArrayBuffer || ArrayBuffer.isView(data);
}

export default class PlaybackWebSocketAdapter implements IWebSocket {
  #webSocket: IWebSocket;
  #onPlaybackState: PlaybackStateListener;

  #binaryType = "";
  public protocol = "";
  public onerror: ((event: unknown) => void) | undefined;
  public onopen: ((event: unknown) => void) | undefined;
  public onclose: ((event: unknown) => void) | undefined;
  public onmessage: ((event: unknown) => void) | undefined;

  public constructor(webSocket: IWebSocket, onPlaybackState: PlaybackStateListener) {
    this.#webSocket = webSocket;
    this.#onPlaybackState = onPlaybackState;
    this.binaryType = "arraybuffer";

    this.#webSocket.onerror = (event: unknown) => this.onerror?.(event);
    this.#webSocket.onopen = (event: unknown) => {
      this.protocol = this.#webSocket.protocol;
      this.onopen?.(event);
    };
    this.#webSocket.onclose = (event: unknown) => this.onclose?.(event);
    this.#webSocket.onmessage = (event: unknown) => {
      const data = getMessageData(event);
      if (isBinaryData(data)) {
        const state = parsePlaybackState(data);
        if (state) {
          this.#onPlaybackState(state);
          return;
        }
      }
      this.onmessage?.(event);
    };
  }

  public get binaryType(): string {
    return this.#binaryType;
  }

  public set binaryType(value: string) {
    this.#binaryType = value;
    this.#webSocket.binaryType = value;
  }

  public close(): void {
    this.#webSocket.close();
  }

  public send(data: string | ArrayBuffer | ArrayBufferView): void {
    this.#webSocket.send(data);
  }

  public sendPlaybackControlRequest(
    command: PlaybackCommand,
    speed: number,
    seekTime: bigint | undefined,
  ): void {
    const requestId = uuidv4();
    this.#webSocket.send(encodePlaybackControlRequest(command, speed, seekTime, requestId));
  }
}