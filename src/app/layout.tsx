import "./globals.css";
import { TuroProvider } from "./lib/contexts/TuroContext";
import Navigation from "./components/Navigation";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <TuroProvider>
          <Navigation />
          <div className="pt-4">
            {children}
          </div>
        </TuroProvider>
      </body>
    </html>
  );
}
