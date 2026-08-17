import './globals.css';

export const metadata = {
  title: 'Code Paste',
  description: 'Editable raw code pastes'
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
