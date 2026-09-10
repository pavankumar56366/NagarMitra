import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "@tanstack/react-router";
import type { Complaint } from "@/lib/queries";
import { CATEGORY_LABEL, STATUS_HEX, STATUS_LABEL } from "@/lib/waste";

export default function ComplaintMap({ complaints }: { complaints: Complaint[] }) {
  const center: [number, number] = complaints.length
    ? [complaints[0]!.lat, complaints[0]!.lng]
    : [19.076, 72.8777];

  return (
    <MapContainer center={center} zoom={12} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {complaints.map((c) => (
        <CircleMarker
          key={c.id}
          center={[c.lat, c.lng]}
          radius={9}
          pathOptions={{
            color: "#ffffff",
            weight: 2,
            fillColor: STATUS_HEX[c.status],
            fillOpacity: 0.95,
          }}
        >
          <Popup>
            <div className="min-w-[180px] space-y-1">
              <p className="font-mono text-[11px] text-neutral-500">{c.reference}</p>
              <p className="text-sm font-semibold">{c.address}</p>
              <p className="text-xs">
                {CATEGORY_LABEL[c.waste_category]} · {STATUS_LABEL[c.status]}
              </p>
              <Link
                to="/complaints/$id"
                params={{ id: c.id }}
                className="text-xs font-semibold underline"
              >
                Open complaint
              </Link>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
