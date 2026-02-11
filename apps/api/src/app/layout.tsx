export const metadata = {
  title: "Весна API",
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
