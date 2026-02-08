import "./globals.css";
import HeaderBar from "./header-bar";
import { RoleProvider } from "./role-store";
import { AppStateProvider } from "./app-state";
import { I18nProvider } from "./i18n";

export const metadata = {
  title: "Restaurant OS",
  description: "Service, Kitchen, Pacing",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="bg-black text-white h-screen overflow-hidden">
        <RoleProvider>
          <I18nProvider>
            <AppStateProvider>
              <div className="h-screen w-screen flex flex-col">
                <HeaderBar />
                <main className="flex-1 overflow-auto">{children}</main>
              </div>
            </AppStateProvider>
          </I18nProvider>
        </RoleProvider>
      </body>
    </html>
  );
}
