/** Short random id (url/key safe). */
export function newId(prefix = ''): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(9));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
  return prefix + b64;
}
