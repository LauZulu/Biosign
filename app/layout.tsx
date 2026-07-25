import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Senas Agent',
  description: 'Captura de mano en tiempo real con MediaPipe Hands',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
