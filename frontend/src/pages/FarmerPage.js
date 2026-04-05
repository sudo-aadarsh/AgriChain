import React, { useEffect, useState } from "react";
import { createBatch, getRealtimeOverview } from "../utils/api";
import { useRefreshSeconds } from "../utils/refresh";

export default function FarmerPage() {
  const [form, setForm] = useState({
    productName: "", farmerName: "", location: "",
    quantity: "", farmerPrice: "", harvestDate: ""
  });
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const refreshSeconds = useRefreshSeconds();

  useEffect(() => {
    if (!form.productName || !form.location) {
      setLive(null);
      return;
    }
    const loadLive = () => {
      getRealtimeOverview({
        productName: form.productName,
        originLocation: form.location,
        currentLocation: form.location,
      })
        .then((r) => setLive(r.data?.data || null))
        .catch(() => setLive(null));
    };
    const t = setTimeout(() => {
      loadLive();
    }, 450);
    const i = refreshSeconds > 0 ? setInterval(loadLive, refreshSeconds * 1000) : null;
    return () => {
      clearTimeout(t);
      if (i) clearInterval(i);
    };
  }, [form.productName, form.location, refreshSeconds]);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setResult(null); setError("");
    try {
      const res = await createBatch({ ...form, actorAddress: "0xFarmerDemo" });
      setResult(res.data);
      setForm({ productName: "", farmerName: "", location: "", quantity: "", farmerPrice: "", harvestDate: "" });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create batch");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🌾 Farmer Dashboard</h1>
        <p className="page-subtitle">Register your produce batch on the blockchain</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">+ Register New Produce Batch</div>

          {result && (
            <div className="success-alert">
              <div className="success-alert-title">✅ Batch #{result.batchId} registered on blockchain!</div>
              <div style={{ fontSize: "0.8rem", marginTop: "0.3rem" }}>{result.message}</div>
            </div>
          )}
          {error && (
            <div className="fraud-alert">
              <div className="fraud-alert-title">❌ Error</div>
              <div className="fraud-alert-text">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input className="form-input" name="productName" value={form.productName}
                  onChange={handleChange} placeholder="e.g. Alphonso Mango" required />
              </div>
              <div className="form-group">
                <label className="form-label">Farmer Name *</label>
                <input className="form-input" name="farmerName" value={form.farmerName}
                  onChange={handleChange} placeholder="e.g. Ramesh Kumar" required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Origin Location *</label>
              <input className="form-input" name="location" value={form.location}
                onChange={handleChange} placeholder="e.g. Ratnagiri, Maharashtra" required />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Quantity (kg) *</label>
                <input className="form-input" type="number" name="quantity" value={form.quantity}
                  onChange={handleChange} placeholder="500" required min="1" />
              </div>
              <div className="form-group">
                <label className="form-label">Farmer Price (₹/kg) *</label>
                <input className="form-input" type="number" name="farmerPrice" value={form.farmerPrice}
                  onChange={handleChange} placeholder="40" required min="1" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Harvest Date</label>
              <input className="form-input" type="date" name="harvestDate" value={form.harvestDate}
                onChange={handleChange} />
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
              {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Recording on Blockchain...</> : "⛓ Register Batch on Blockchain"}
            </button>
          </form>
        </div>

        <div>
          {live && (
            <div className="card">
              <div className="card-title">🌐 Live Market Signal</div>
              <div className="price-row">
                <span className="price-label">Benchmark ({live?.benchmark?.label || "Commodity"})</span>
                <span className="price-value">{live?.benchmark?.price ? `$${Number(live.benchmark.price).toFixed(2)}` : "N/A"}</span>
              </div>
              <div className="price-row">
                <span className="price-label">Approx INR Benchmark</span>
                <span className="price-value">{live?.benchmark?.approximateInr ? `₹${Number(live.benchmark.approximateInr).toFixed(0)}` : "N/A"}</span>
              </div>
              <div className="price-row">
                <span className="price-label">Farm Weather</span>
                <span className="price-value">{live?.weather?.origin ? `${live.weather.origin.temperatureC}°C, ${live.weather.origin.weatherText}` : "N/A"}</span>
              </div>
              <div style={{ marginTop: "0.45rem", fontSize: "0.74rem", color: "var(--sprout)" }}>
                Source: {live?.benchmark?.source || "Yahoo Finance"} + {live?.weather?.origin?.source || "Open-Meteo"}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-title">ℹ️ How It Works</div>
            <div style={{ fontSize: "0.85rem", lineHeight: 1.7, color: "var(--soil)" }}>
              <p style={{ marginBottom: "0.75rem" }}>As a <strong>Farmer</strong>, you register your produce batch on the Polygon blockchain. This creates an immutable record that cannot be altered.</p>
              <div style={{ background: "var(--cream)", border: "1px solid var(--fog)", padding: "0.75rem", borderRadius: "2px", marginBottom: "0.75rem" }}>
                <strong style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>FRAUD DETECTION:</strong>
                <p style={{ marginTop: "0.3rem" }}>The system automatically checks for duplicate entries with the same product, farmer, and quantity combination.</p>
              </div>
              <p>After registration, a QR code is generated that tracks the full journey from farm to consumer.</p>
            </div>
          </div>

          <div className="card">
            <div className="card-title">🌱 Sample Data — Quick Fill</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[
                { productName: "Alphonso Mango", farmerName: "Ramesh Kumar", location: "Ratnagiri, Maharashtra", quantity: "500", farmerPrice: "45" },
                { productName: "Basmati Rice", farmerName: "Suresh Patel", location: "Dehradun, Uttarakhand", quantity: "1000", farmerPrice: "60" },
                { productName: "Organic Tomatoes", farmerName: "Lakshmi Devi", location: "Nashik, Maharashtra", quantity: "300", farmerPrice: "15" },
              ].map((sample, i) => (
                <button key={i} className="btn btn-outline" style={{ justifyContent: "flex-start", textTransform: "none", fontFamily: "var(--font-body)", fontSize: "0.82rem" }}
                  onClick={() => setForm(f => ({ ...f, ...sample, harvestDate: new Date().toISOString().split("T")[0] }))}>
                  📦 {sample.productName} — {sample.farmerName}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
