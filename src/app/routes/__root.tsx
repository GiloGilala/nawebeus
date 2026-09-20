// @ts-nocheck

import * as React from "react";
import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Nawebeus — Unified Social & PR Intelligence</title>
      </head>
      <body>
        <div id="app">
          <Outlet />
        </div>
        {/* TanStack Router devtools — only in development */}
      </body>
    </html>
  );
}
