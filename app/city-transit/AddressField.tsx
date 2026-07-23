import { useEffect, useRef, useState } from "react";
import type { TransitCoordinate } from "../transit-router";
import type { AddressResult } from "./model";

const geocodeCache = new Map<string, AddressResult[]>();

async function searchAddress(query: string) {
  const key = query.toLocaleLowerCase("uk-UA").trim();
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error("geocode");
  const payload = (await response.json()) as { results: AddressResult[] };
  geocodeCache.set(key, payload.results);
  return payload.results;
}

export type AddressFieldProps = {
  marker: string;
  label: string;
  point: TransitCoordinate | null;
  placeholder: string;
  onSelect: (point: TransitCoordinate) => void;
  onError: (message: string) => void;
};

export default function AddressField({
  marker,
  label,
  point,
  placeholder,
  onSelect,
  onError,
}: AddressFieldProps) {
  const [value, setValue] = useState(point?.name || "");
  const [results, setResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    setValue(point?.name || "");
  }, [point]);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 3 || query === point?.name) {
      setOpen(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setLoading(true);
      searchAddress(query)
        .then((next) => {
          setResults(next);
          setOpen(true);
        })
        .catch(() => onErrorRef.current("Пошук адрес тимчасово недоступний"))
        .finally(() => setLoading(false));
    }, 380);
    return () => window.clearTimeout(timer);
  }, [point?.name, value]);

  return (
    <div className="transport-address-field">
      <span className={`transport-address-marker is-${marker.toLowerCase()}`}>
        {marker}
      </span>
      <label>
        <small>{label}</small>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="street-address"
          aria-label={label}
          aria-expanded={open}
          role="combobox"
        />
      </label>
      {loading && <span className="transport-address-loading" aria-label="Пошук" />}
      {open && (
        <div className="transport-address-results" role="listbox">
          {results.length ? (
            results.map((result) => (
              <button
                type="button"
                role="option"
                key={result.id}
                onClick={() => {
                  onSelect(result);
                  setValue(result.name);
                  setOpen(false);
                }}
              >
                <span>⌖</span>
                <span>
                  <strong>{result.name}</strong>
                  <small>{result.detail}</small>
                </span>
              </button>
            ))
          ) : (
            <p>Нічого не знайдено. Уточніть адресу.</p>
          )}
          <footer>OpenStreetMap · Київ і Київська область</footer>
        </div>
      )}
    </div>
  );
}
