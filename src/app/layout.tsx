import "./globals.css";

export const metadata = { title: "bitrung;", description: "Climb the ladder, one bit at a time." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
