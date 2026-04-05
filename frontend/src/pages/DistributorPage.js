import React, { useState, useEffect } from "react";
import { getAllBatches, updateShipment, getRealtimeOverview } from "../utils/api";
import { useRefreshSeconds } from "../utils/refresh";

export default function DistributorPage() {
  const [batches, setBatches] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState({ location: "", notes: "", carrier: "", trackingNumber: "" });
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const refreshSeconds = useRefreshSeconds();

  useEffect(() => {
    getAllBatches().then(r => setBatches(r.data.batches || [])).catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedId) return setError("Select a batch first");
    setLoading(true); setResult(null); setError("");
    try {
      const res = await updateShipment(selectedId, { ...form, actorAddress: "0xDistributorDemo" });
      setResult(res.data);
      setForm({ location: "", notes: "", carrier: "", trackingNumber: "" });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update shipment");
    } finally {
      setLoading(false);
    }
  };

  const selectedBatch = batches.find(b => b.id === parseInt(selectedId));

  useEffect(() => {
    if (!selectedBatch) {
      setLive(null);
      return;
    }
    const loadLive = () => {
      getRealtimeOverview({
        productName: selectedBatch.productName,
        originLocation: selectedBatch.originLocation,
        currentLocation: form.location || selectedBatch.originLocation,
      })
        .then((r) => setLive(r.data?.data || null))
        .catch(() => setLive(null));
    };
    const t = setTimeout(() => {
      loadLive();
    }, 350);
    const i = refreshSeconds > 0 ? setInterval(loadLive, refreshSeconds * 1000) : null;
    return () => {
      clearTimeout(t);
      if (i) clearInterval(i);
    };
  }, [selectedBatch, form.location, refreshSeconds]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🚚 Distributor Dashboard</h1>
        <p className="page-subtitle">Update shipment status and location tracking</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">📦 Update Shipment</div>

          {result && (
            <div className="success-alert">
              <div className="success-alert-title">✅ {result.message}</div>
            </div>
          )}
          {error && (
            <div className="fraud-alert">
              <div className="fraud-alert-title">❌ Error</div>
              <div className="fraud-alert-text">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Select Batch *</label>
              <select className="form-select" value={selectedId} onChange={e => setSelectedId(e.target.value)} required>
                <option value="">-- Select a product batch --</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>#{b.id} — {b.productName} by {b.farmerName}</option>
                ))}
              </select>
            </div>

            {selectedBatch && (
              <div style={{ background: "var(--cream)", border: "1px solid var(--fog)", padding: "0.75rem", marginBottom: "1rem", borderRadius: "2px", fontSize: "0.82rem" }}>
                <strong style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>SELECTED BATCH:</strong>
                <div style={{ marginTop: "0.3rem" }}>
                  {selectedBatch.productName} • {selectedBatch.quantity}kg • Origin: {selectedBatch.originLocation}
                </div>
                <div style={{ marginTop: "0.2rem", color: "var(--sprout)" }}>
                  Farmer Price: ₹{selectedBatch.farmerPrice}/kg
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Current Location *</label>
              <input className="form-input" name="location" value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g. APMC Warehouse, Vashi, Mumbai" required />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" name="notes" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Quality check passed, cold storage maintained" />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Carrier Slug (Optional)</label>
                <input className="form-input" name="carrier" value={form.carrier}
                  onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))}
                  placeholder="e.g. dhl, fedex, delhivery" />
              </div>
              <div className="form-group">
                <label className="form-label">Tracking Number (Optional)</label>
                <input className="form-input" name="trackingNumber" value={form.trackingNumber}
                  onChange={e => setForm(f => ({ ...f, trackingNumber: e.target.value }))}
                  placeholder="e.g. 1234567890" />
              </div>
            </div>
            <div style={{ marginTop: "-0.35rem", marginBottom: "0.7rem", fontSize: "0.72rem", color: "var(--sprout)" }}>
              Add carrier + tracking to enable live logistics feed from AfterShip.
            </div>
            <button className="btn btn-secondary btn-full" type="submit" disabled={loading}>
              {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Updating Blockchain...</> : "🚚 Update Shipment on Blockchain"}
            </button>
          </form>
        </div>

        <div>
          {live && (
            <div className="card">
              <div className="card-title">🌐 Live Transit Signal</div>
              <div className="price-row">
                <span className="price-label">Commodity Benchmark</span>
                <span className="price-value">{live?.benchmark?.price ? `$${Number(live.benchmark.price).toFixed(2)}` : "N/A"}</span>
              </div>
              <div className="price-row">
                <span className="price-label">Current Route Weather</span>
                <span className="price-value">{live?.weather?.current ? `${live.weather.current.temperatureC}°C, ${live.weather.current.weatherText}` : "N/A"}</span>
              </div>
              <div className="price-row">
                <span className="price-label">Transit Risk</span>
                <span className="price-value">{live?.logistics?.risk || "Unknown"} ({live?.logistics?.etaImpactMinutes || 0} min)</span>
              </div>
              <div className="price-row">
                <span className="price-label">Tracking Status</span>
                <span className="price-value">
                  {live?.logistics?.trackingConfigured
                    ? (live?.logistics?.tracking?.status || "Awaiting provider update")
                    : "Not configured"}
                </span>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-title">ℹ️ Distributor Role</div>
            <div style={{ fontSize: "0.85rem", lineHeight: 1.7 }}>
              <p style={{ marginBottom: "0.75rem" }}>As a <strong>Distributor</strong>, you update the supply chain with warehouse and transit information. Your updates are recorded immutably on blockchain.</p>
              <div style={{ background: "var(--cream)", border: "1px solid var(--fog)", padding: "0.75rem", borderRadius: "2px" }}>
                <strong style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>⚠️ FRAUD CHECK:</strong>
                <p style={{ marginTop: "0.3rem" }}>Skipping the distributor step and going directly to retail will trigger a <strong>fraud alert</strong>. The system enforces role order.</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">📍 Quick Location Fill</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[
                { location: "APMC Warehouse, Vashi, Mumbai", notes: "Received from farm, quality checked" },
                { location: "Cold Storage Facility, Pune", notes: "Temperature maintained at 4°C" },
                { location: "Distribution Hub, Delhi", notes: "Sorted and packed for retail" },
              ].map((s, i) => (
                <button key={i} className="btn btn-outline" style={{ justifyContent: "flex-start", textTransform: "none", fontFamily: "var(--font-body)", fontSize: "0.8rem" }}
                  onClick={() => setForm(f => ({ ...f, ...s }))}>
                  📍 {s.location}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
