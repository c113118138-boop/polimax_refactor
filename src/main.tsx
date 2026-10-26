import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { queryClient } from "./api";
import App from "./App";
import { NavigationGuardProvider } from "./NavigationGuard";
import "./style.css";
import "./calendar.css";
import "./sidebar.css";
import "./forms.css";
import "./queries.css";
const theme = createTheme({
  typography: { fontFamily: 'Inter, "Noto Sans TC", system-ui, sans-serif' },
  palette: { primary: { main: "#277c67" } },
  shape: { borderRadius: 12 },
});
const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <NavigationGuardProvider>
        <App />
      </NavigationGuardProvider>
    ),
  },
]);
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
