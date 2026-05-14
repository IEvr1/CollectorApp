import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Salon Business Dashboard",
    short_name: "Salon Dashboard",
    description: "Business dashboard for salon bookings.",
    start_url: "/dashboard",
    scope: "/dashboard",
    display: "standalone",
    background_color: "#f8f5ff",
    theme_color: "#7c3aed",
    icons: [
      {
        src: "/dashboard-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/dashboard-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
