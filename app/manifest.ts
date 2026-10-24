import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Leftover Clock",
    short_name: "Leftovers",
    description: "How old is each leftover container in your fridge? Just from photos.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff8ee",
    theme_color: "#fff8ee",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
