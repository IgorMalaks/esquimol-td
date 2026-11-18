import { createHash } from 'node:crypto';

const RFC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const LIMIT = 65_536;
const utf8 = new TextDecoder('utf-8', { fatal: true });

function frame(opcode, payload) {
  const length = payload.length;
  const header = Buffer.alloc(length < 126 ? 2 : length <= 65_535 ? 4 : 10);
  header[0] = 0x80 | opcode;
  if (length < 126) header[1] = length;
  else if (length <= 65_535) {
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, payload]);
}

export function acceptSocket(request, socket, head, { onMessage, onClose }) {
  const key = request.headers['sec-websocket-key'];
  const valid = request.method === 'GET' && request.headers.upgrade?.toLowerCase() === 'websocket' &&
    request.headers['sec-websocket-version'] === '13' && typeof key === 'string' && /^[A-Za-z0-9+/]{22}==$/.test(key);
  if (!valid) {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    return null;
  }
  const accept = createHash('sha1').update(key + RFC_GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  let pending = Buffer.alloc(0);
  let lastPong = Date.now();
  let closed = false;
  function close(code = 1000) {
    if (closed) return;
    closed = true;
    const payload = Buffer.alloc(2);
    payload.writeUInt16BE(code);
    socket.end(frame(8, payload));
  }
  function receive(chunk) {
    if (closed) return;
    pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
    while (!closed && pending.length >= 2) {
      const options = pending[0];
      const opcode = options & 0x0f;
      if ((options & 0xf0) !== 0x80 || !(pending[1] & 0x80) || ![1, 8, 9, 10].includes(opcode)) {
        close(1002);
        return;
      }
      let length = pending[1] & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (pending.length < 4) return;
        offset += 2;
        length = pending.readUInt16BE(2);
        if (length < 126) { close(1002); return; }
      } else if (length === 127) {
        if (pending.length < 10) return;
        offset += 8;
        const wide = pending.readBigUInt64BE(2);
        if (wide < 65_536n) { close(1002); return; }
        if (wide > BigInt(LIMIT)) { close(1009); return; }
        length = Number(wide);
      }
      if (opcode >= 8 && length > 125) { close(1002); return; }
      if (pending.length < offset + 4 + length) return;
      const mask = pending.subarray(offset, offset + 4);
      const payload = Buffer.alloc(length);
      for (let i = 0; i < length; i++) payload[i] = pending[offset + 4 + i] ^ mask[i % 4];
      pending = pending.subarray(offset + 4 + length);
      if (opcode === 8) { close(length === 1 ? 1002 : 1000); return; }
      if (opcode === 9) socket.write(frame(10, payload));
      if (opcode === 10) lastPong = Date.now();
      if (opcode === 1) {
        let message;
        try { message = utf8.decode(payload); } catch { close(1007); return; }
        onMessage(message);
      }
    }
  }
  const heartbeat = setInterval(() => {
    if (Date.now() - lastPong > 55_000) close(1001);
    else if (!closed) socket.write(frame(9, Buffer.alloc(0)));
  }, 25_000);
  heartbeat.unref();
  socket.on('data', receive);
  socket.on('error', () => socket.destroy());
  socket.once('close', () => { closed = true; clearInterval(heartbeat); onClose(); });
  if (head.length) queueMicrotask(() => receive(head));
  return {
    send(value) {
      const payload = Buffer.from(JSON.stringify(value));
      if (payload.length <= LIMIT && !closed && socket.writableLength < LIMIT * 4) socket.write(frame(1, payload));
    },
    close,
  };
}
