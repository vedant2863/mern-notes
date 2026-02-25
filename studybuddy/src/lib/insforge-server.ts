import { createClient } from "@insforge/sdk";

// Server-side only — API key never reaches the browser
export const insforgeServer = createClient({
  baseUrl: process.env.INSFORGE_URL!,
  anonKey: process.env.INSFORGE_API_KEY!,
  headers: {
    "x-api-key": process.env.INSFORGE_API_KEY!,
  },
});
