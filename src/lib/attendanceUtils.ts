
export function getMethodLabel(method: string | null | undefined): string {
  if (!method) return '—';
  const m = method.toLowerCase().trim();
  switch (m) {
    case 'manual':
      return 'Manual';
    case 'qr':
      return 'Código QR';
    case 'bluetooth':
      return 'Bluetooth';
    case 'sistema':
      return 'Cierre automático';
    default:
      return method;
  }
}
