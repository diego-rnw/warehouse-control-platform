import QRCode from 'qrcode';

export function captureUrl(sessionId: string): string {
  return `${window.location.origin}/captura-movil/${sessionId}`;
}

export async function generateQrDataUrl(sessionId: string): Promise<string> {
  return QRCode.toDataURL(captureUrl(sessionId), { width: 220, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
}
