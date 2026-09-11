import { useQuery } from "@tanstack/react-query";
import { photoUrlQuery } from "@/lib/citizen";

/** Renders a private-bucket photo (report or completion evidence) through a signed link. */
export function EvidencePhoto({
  path,
  label,
  className,
}: {
  path: string | null;
  label: string;
  className?: string;
}) {
  const { data: url } = useQuery(photoUrlQuery(path ?? null));
  if (!url) return null;
  return (
    <figure className={className}>
      <img src={url} alt={label} loading="lazy" className="w-full rounded-xl object-cover" />
      <figcaption className="mt-1.5 text-xs font-medium text-muted-foreground">{label}</figcaption>
    </figure>
  );
}
