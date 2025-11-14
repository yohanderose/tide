import { useEffect, useState } from "react";
import { useMap, MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet-draw";

import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

function DrawControl({ onCreated }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      draw: {
        polygon: true,
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: {
        featureGroup: drawnItems,
      },
    });

    map.addControl(drawControl);

    function handleDrawCreated(e) {
      const layer = e.layer;
      drawnItems.addLayer(layer);
      if (onCreated) {
        onCreated(layer.toGeoJSON());
      }
    }

    map.on(L.Draw.Event.CREATED, handleDrawCreated);

    return () => {
      map.off(L.Draw.Event.CREATED, handleDrawCreated);
      map.removeControl(drawControl);
      map.removeLayer(drawnItems);
    };
  }, [map, onCreated]);

  return null;
}

const center = [51.505, -0.09];

function PolygonDraw({ setServiceForm }) {
  const [geoJson, setGeoJson] = useState(null);

  const handleCreated = (geojson) => {
    setGeoJson(geojson);
    setServiceForm((prev) => ({
      ...prev,
      serviceable_area: JSON.stringify(geojson.geometry),
    }));
    console.log("Drawn Polygon GeoJSON:", geojson);
  };

  return (
    <>
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "400px", width: "100%" }}
      >
        <TileLayer
          attribution="© OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <DrawControl onCreated={handleCreated} />
      </MapContainer>
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {geoJson
          ? JSON.stringify(geoJson, null, 2)
          : "Draw a polygon to see GeoJSON here"}
      </pre>
    </>
  );
}

export { PolygonDraw };
