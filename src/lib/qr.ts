import QRCode from 'qrcode';

export function getVerificationUrl(rawToken: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl.replace(/\/$/, '')}/verify/${encodeURIComponent(rawToken.trim())}`;
}

export async function generateQrDataUrl(text: string, width: number = 400): Promise<string> {
  return await QRCode.toDataURL(text, {
    width,
    margin: 2,
    color: {
      dark: '#064e3b', // Vert corporate foncé Welj
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H', // Haute tolérance aux erreurs (30%) pour impression
  });
}

export async function generateQrSvg(text: string): Promise<string> {
  return await QRCode.toString(text, {
    type: 'svg',
    margin: 2,
    color: {
      dark: '#064e3b',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  });
}
