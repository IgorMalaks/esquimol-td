export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

export async function jsonBody(request, limit = 65_536) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    throw httpError(415, 'Envie o conteúdo em JSON.');
  }
  if (Number(request.headers['content-length']) > limit) throw httpError(413, 'O corpo da requisição é muito grande.');
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) {
      request.resume();
      throw httpError(413, 'O corpo da requisição é muito grande.');
    }
    chunks.push(chunk);
  }
  try {
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error();
    return result;
  } catch {
    throw httpError(400, 'O corpo da requisição precisa ser um objeto JSON.');
  }
}

export function sendJSON(response, status, value, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  response.end(JSON.stringify(value));
}
