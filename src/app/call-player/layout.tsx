import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '📹 Chamada de Vídeo',
  description: 'Toque para entrar na chamada de vídeo privada',
  openGraph: {
    title: '📹 Chamada de Vídeo Privada',
    description: 'Toque para entrar na chamada agora',
    type: 'website',
  },
};

export default function CallPlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
