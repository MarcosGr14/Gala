export function generateId(prefix = '') {
  // crypto.randomUUID() es nativo en navegadores modernos
  return `${prefix}_${crypto.randomUUID()}`;
}