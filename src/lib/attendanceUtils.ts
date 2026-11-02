/**
 * Utilidades para representación de métodos de asistencia y verificaciones.
 *
 * ETIQUETAS DE MÉTODO (texto, no solo color):
 * manual = "Manual"
 * qr = "Código QR"
 * bluetooth = "Bluetooth"
 * sistema = "Cierre automático"
 * Los valores de method pueden ser nuevos en el futuro: nunca falles ante uno desconocido; muéstralo como texto tal cual.
 */

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
