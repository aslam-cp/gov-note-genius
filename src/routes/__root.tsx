import { createRootRoute, Outlet, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import AppLayout from "@/components/AppLayout";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "File Noting Assistant — Government Drafting Aid" },
      { name: "description", content: "Single-user AI assistant that reads file documents and drafts official Government note-sheet text in proper administrative style." },
      { property: "og:title", content: "File Noting Assistant — Government Drafting Aid" },
      { name: "twitter:title", content: "File Noting Assistant — Government Drafting Aid" },
      { property: "og:description", content: "Single-user AI assistant that reads file documents and drafts official Government note-sheet text in proper administrative style." },
      { name: "twitter:description", content: "Single-user AI assistant that reads file documents and drafts official Government note-sheet text in proper administrative style." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/da220fd7-2bc6-464f-b1b5-efaef1efa099/id-preview-c0fd6499--de6b7916-5760-4aa9-8948-1e2fd27945a5.lovable.app-1776656672454.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/da220fd7-2bc6-464f-b1b5-efaef1efa099/id-preview-c0fd6499--de6b7916-5760-4aa9-8948-1e2fd27945a5.lovable.app-1776656672454.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <AppLayout />
      <Toaster richColors position="top-center" />
    </>
  );
}
