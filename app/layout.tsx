import "./globals.css";
import HeaderBar from "./header-bar";
import { RoleProvider } from "./role-store";
import { AppStateProvider } from "./app-state";

export const metadata = {
  title: "Restaurant OS",
  description: "Service, Kitchen, Pacing",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className="bg-black text-white h-screen overflow-hidden"
      >
        <RoleProvider>
          <AppStateProvider>
            <HeaderBar />
            <main className="h-[calc(100vh-56px)] w-full">{children}</main>
          </AppStateProvider>
        </RoleProvider>
      </body>
    </html>
  );
}
