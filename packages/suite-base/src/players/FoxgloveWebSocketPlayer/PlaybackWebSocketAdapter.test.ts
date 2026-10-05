// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { IWebSocket } from "@foxglove/ws-protocol";

import PlaybackWebSocketAdapter, {
  PlaybackCommand,
  PlaybackStatus,
} from "./PlaybackWebSocketAdapter";

class FakeWebSocket implements IWebSocket {
  public binaryType = "";
  public protocol = "foxglove.websocket.v1";
  public onerror: ((event: unknown) => void) | undefined;
  public onopen: ((event: unknown) => void) | undefined;
  public onclose: ((event: unknown) => void) | undefined;
  public onmessage: ((event: unknown) => void) | undefined;
  public sent: string | ArrayBuffer | ArrayBufferView | undefined;

  public close(): void {}

  public send(data: string | ArrayBuffer | ArrayBufferView): void {
    this.sent = data;
  }
}

describe("PlaybackWebSocketAdapter", () => {
  it("sends a playback control request using the Foxglove binary protocol", () => {
    const socket = new FakeWebSocket();
    const adapter = new PlaybackWebSocketAdapter(socket, jest.fn());

    adapter.sendPlaybackControlRequest(PlaybackCommand.Play, 0.5, 123n);

    const data = new Uint8Array(socket.sent as ArrayBuffer);
    const view = new DataView(data.buffer);
    expect(view.getUint8(0)).toBe(3);
    expect(view.getUint8(1)).toBe(PlaybackCommand.Play);
    expect(view.getFloat32(2, true)).toBe(0.5);
    expect(view.getUint8(6)).toBe(1);
    expect(view.getBigUint64(7, true)).toBe(123n);
    expect(view.getUint32(15, true)).toBeGreaterThan(0);
  });

  it("intercepts playback state messages from browser and worker socket events", () => {
    const socket = new FakeWebSocket();
    const onPlaybackState = jest.fn();
    const adapter = new PlaybackWebSocketAdapter(socket, onPlaybackState);
    const requestId = new TextEncoder().encode("request");
    const payload = new Uint8Array(19 + requestId.byteLength);
    const view = new DataView(payload.buffer);
    view.setUint8(0, 5);
    view.setUint8(1, PlaybackStatus.Paused);
    view.setBigUint64(2, 456n, true);
    view.setFloat32(10, 0.25, true);
    view.setUint8(14, 1);
    view.setUint32(15, requestId.byteLength, true);
    payload.set(requestId, 19);

    socket.onmessage?.({ data: payload.buffer });
    socket.onmessage?.({ type: "message", data: payload.buffer });

    expect(onPlaybackState).toHaveBeenCalledTimes(2);
    expect(onPlaybackState).toHaveBeenLastCalledWith({
      status: PlaybackStatus.Paused,
      currentTime: 456n,
      playbackSpeed: 0.25,
      didSeek: true,
      requestId: "request",
    });
    expect(adapter.onmessage).toBeUndefined();
  });

  it("ignores malformed playback state messages", () => {
    const socket = new FakeWebSocket();
    const onPlaybackState = jest.fn();
    new PlaybackWebSocketAdapter(socket, onPlaybackState);

    const payload = new Uint8Array(19);
    const view = new DataView(payload.buffer);
    view.setUint8(0, 5);
    view.setUint8(1, 4);
    view.setUint32(15, 1, true);

    socket.onmessage?.({ data: payload.buffer });

    expect(onPlaybackState).not.toHaveBeenCalled();
  });

  it("ignores playback state messages with invalid request IDs", () => {
    const socket = new FakeWebSocket();
    const onPlaybackState = jest.fn();
    new PlaybackWebSocketAdapter(socket, onPlaybackState);

    const payload = new Uint8Array(20);
    const view = new DataView(payload.buffer);
    view.setUint8(0, 5);
    view.setUint8(1, PlaybackStatus.Paused);
    view.setUint32(15, 1, true);
    payload[19] = 0xff;

    socket.onmessage?.({ data: payload.buffer });

    expect(onPlaybackState).not.toHaveBeenCalled();
  });
});
