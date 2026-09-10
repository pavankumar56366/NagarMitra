import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/staff/dashboard")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/staff" });
  },
  component: () => null,
});
