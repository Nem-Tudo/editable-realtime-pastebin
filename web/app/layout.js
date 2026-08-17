import './globals.css';

export const metadata = {
  title: 'Code Paste',
  description: 'Paste de texto e código'
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
