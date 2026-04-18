import type { ChangeEvent, FormEvent } from "react";
import type { SearchRequest, TransportMode } from "../types";

interface SearchFormProps {
  value: SearchRequest;
  onChange: (next: SearchRequest) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

const certificationOptions = ["ISO 14001", "CDP", "SBT"];
const transportModes: TransportMode[] = ["sea", "air", "rail", "road"];

export function SearchForm({ value, onChange, onSubmit, isLoading }: SearchFormProps) {
  function updateField<K extends keyof SearchRequest>(field: K, fieldValue: SearchRequest[K]) {
    onChange({ ...value, [field]: fieldValue });
  }

  function handleCountryChange(event: ChangeEvent<HTMLInputElement>) {
    const nextCountries = event.target.value
      .split(",")
      .map((country) => country.trim())
      .filter(Boolean);

    updateField("countries", nextCountries);
  }

  function handleCertificationToggle(option: string) {
    const exists = value.certifications.includes(option);
    const next = exists
      ? value.certifications.filter((item) => item !== option)
      : [...value.certifications, option];

    updateField("certifications", next);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="field-grid">
        <label>
          Product
          <input
            value={value.product}
            onChange={(event) => updateField("product", event.target.value)}
            placeholder="Cotton t-shirts"
          />
        </label>

        <label>
          Quantity
          <input
            type="number"
            min="1"
            value={value.quantity}
            onChange={(event) => updateField("quantity", Number(event.target.value))}
          />
        </label>

        <label>
          Destination
          <input
            value={value.destinationCountry}
            onChange={(event) => updateField("destinationCountry", event.target.value)}
            placeholder="USA"
          />
        </label>

        <label>
          Countries to compare
          <input
            value={value.countries.join(", ")}
            onChange={handleCountryChange}
            placeholder="China, Portugal, Bangladesh"
          />
        </label>
      </div>

      <div className="toolbar-row">
        <div className="chip-group">
          {transportModes.map((mode) => (
            <button
              key={mode}
              type="button"
              className={mode === value.transportMode ? "chip active" : "chip"}
              onClick={() => updateField("transportMode", mode)}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="chip-group">
          {certificationOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={value.certifications.includes(option) ? "chip active" : "chip"}
              onClick={() => handleCertificationToggle(option)}
            >
              {option}
            </button>
          ))}
        </div>

        <button className="primary-button" type="submit" disabled={isLoading}>
          {isLoading ? "Searching..." : "Run comparison"}
        </button>
      </div>
    </form>
  );
}

