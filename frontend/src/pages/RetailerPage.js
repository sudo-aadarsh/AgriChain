import React, { useState, useEffect } from "react";
import { getAllBatches, updateRetailPrice, getBatch, getRealtimeOverview } from "../utils/api";
import { useRefreshSeconds } from "../utils/refresh";

export default function RetailerPage() {
  const [batches, setBatches] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [form, setForm] = useState({ newPrice: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [live, setLive] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const refreshSeconds = useRefreshSeconds();

  useEffect(() => {
    getAllBatches()
      .then(r => setBatches(r.data.batches || []))
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (!selectedId) { setSelectedBatch(null); return; }
    getBatch(selectedId).then(r => setSelectedBatch(r.data.batch)).catch(() => {});
  }, [selectedId]);

  useEffect(() => {
    if (!selectedBatch) {
      setLive(null);
      return;
    }
    const loadLive = () => {
      getRealtimeOverview({
        productName: selectedBatch.productName,
        originLocation: selectedBatch.originLocation,
        currentLocation: "Retail Store",
      })
        .then((r) => setLive(r.data?.data || null))
        .catch(() => setLive(null));
    };
    const t = setTimeout(() => {
      loadLive();
    }, 300);
    const i = refreshSeconds > 0 ? setInterval(loadLive, refreshSeconds * 1000) : null;
    return () => {
      clearTimeout(t);
      if (i) clearInterval(i);
    };
  }, [selectedBatch, refreshSeconds]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedId) return setError("Select a batch first");
    setLoading(true); setResult(null); setError("");
    try {
      const res = await updateRetailPrice(selectedId, { ...form, newPrice: parseInt(form.newPrice), actorAddress: "0xRetailerDemo" });
      setResult(res.data);
      // Refresh batch
      getBatch(selectedId).then(r => setSelectedBatch(r.data.batch));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update price");
    } finally {
      setLoading(false);
    }
  };

  const marginPct = selectedBatch && selectedBatch.farmerPrice > 0
    ? (((parseInt(form.newPrice || selectedBatch.currentPrice) - selectedBatch.farmerPrice) / selectedBatch.farmerPrice) * 100).toFixed(1)
    : 0;

  const isHighMargin = marginPct > 300;
  const isExtremeMargin = marginPct > 500;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🏪 Retailer Dashboard</h1>
        <p className="page-subtitle">Set retail prices with full price transparency</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">💰 Update Retail Price</div>

          {result && (
            <>
              {result.isFlagged ? (
                <div className="fraud-alert">
                  <div className="fraud-alert-title">⚠️ Suspicious Activity Detected</div>
                  <div className="fraud-alert-text">{result.flagReason}</div>
                  <div className="fraud-alert-text" style={{ marginTop: "0.3rem" }}>Price was recorded but batch is now flagged for review.</div>
                </div>
              ) : (
                <div className="success-alert">
                  <div className="success-alert-title">✅ {result.message}</div>
                </div>
              )}
            </>
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
              {fetching ? (
                <div className="loading" style={{ padding: "0.5rem" }}><div className="spinner" /></div>
              ) : (
                <select className="form-select" value={selectedId}
                  onChange={e => { setSelectedId(e.target.value); setResult(null); setError(""); setForm({ newPrice: "", notes: "" }); }} required>
                  <option value="">— Choose a batch —</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>#{b.id} — {b.productName} ({b.farmerName})</option>
                  ))}
                </select>
              )}
            </div>

            {selectedBatch && (
              <div style={{ background: "var(--cream)", border: "1px solid var(--fog)", padding: "0.75rem", marginBottom: "1rem", borderRadius: "2px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--bark)", marginBottom: "0.5rem" }}>PRICE TRANSPARENCY</div>
                <div className="price-row">
                  <span className="price-label">Farmer Price</span>
                  <span className="price-value farmer">₹{selectedBatch.farmerPrice}/kg</span>
                </div>
                <div className="price-row">
                  <span className="price-label">Current Price</span>
                  <span className="price-value retail">₹{selectedBatch.currentPrice}/kg</span>
                </div>
                {form.newPrice && (
                  <div className="price-row">
                    <span className="price-label">New Price (preview)</span>
                    <span className="price-value" style={{ color: isExtremeMargin ? "var(--alert-red)" : isHighMargin ? "var(--alert-amber)" : "var(--leaf)" }}>
                      ₹{form.newPrice}/kg ({marginPct}% margin)
                    </span>
                  </div>
                )}
                {form.newPrice && (
                  <div className="margin-bar-container">
                    <div className="margin-bar-bg">
                      <div className="margin-bar-fill" style={{ width: `${Math.min(parseFloat(marginPct), 100)}%`, background: isExtremeMargin ? "var(--alert-red)" : isHighMargin ? "var(--alert-amber)" : "linear-gradient(90deg, var(--leaf), var(--wheat))" }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {isExtremeMargin && form.newPrice && (
              <div className="warning-alert">
                <div className="warning-alert-title">⚠️ FRAUD RISK: Price spike exceeds 500%</div>
                <div style={{ fontSize: "0.8rem" }}>This will trigger an automatic fraud alert on the blockchain.</div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">New Retail Price (₹/kg) *</label>
              <input className="form-input" type="number" name="newPrice" value={form.newPrice}
                onChange={e => setForm(f => ({ ...f, newPrice: e.target.value }))}
                placeholder="e.g. 120" required min="1" />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Premium grade, organic certified" />
            </div>

            <button className="btn btn-primary btn-full" type="submit" disabled={loading || !selectedId}>
              {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Updating...</> : "⛓ Set Price on Blockchain"}
            </button>
          </form>
        </div>

        <div>
          {live && (
            <div className="card">
              <div className="card-title">🌐 Live Market Feed</div>
              <div className="price-row">
                <span className="price-label">Benchmark ({live?.benchmark?.label || "Commodity"})</span>
                <span className="price-value">{live?.benchmark?.price ? `$${Number(live.benchmark.price).toFixed(2)}` : "N/A"}</span>
              </div>
              <div className="price-row">
                <span className="price-label">USD/INR</span>
                <span className="price-value">{live?.forex?.rate ? Number(live.forex.rate).toFixed(2) : "N/A"}</span>
              </div>
              <div className="price-row">
                <span className="price-label">Origin Weather</span>
                <span className="price-value">{live?.weather?.origin ? `${live.weather.origin.temperatureC}°C, ${live.weather.origin.weatherText}` : "N/A"}</span>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-title">📊 Fraud Detection Rules</div>
            <div style={{ fontSize: "0.85rem", lineHeight: 1.7 }}>
              <div style={{ marginBottom: "0.75rem", padding: "0.6rem", background: "#fdf2f2", border: "1px solid var(--alert-red)", borderRadius: "2px" }}>
                <strong style={{ color: "var(--alert-red)" }}>🔴 Blocked / Flagged:</strong>
                <ul style={{ marginTop: "0.3rem", paddingLeft: "1.2rem" }}>
                  <li>Price spike &gt;500% from farmer price</li>
                  <li>No distributor step before retail</li>
                </ul>
              </div>
              <div style={{ padding: "0.6rem", background: "#fef9e7", border: "1px solid var(--alert-amber)", borderRadius: "2px" }}>
                <strong style={{ color: "var(--alert-amber)" }}>🟡 High Margin Warning:</strong>
                <ul style={{ marginTop: "0.3rem", paddingLeft: "1.2rem" }}>
                  <li>Price markup &gt;300% triggers warning</li>
                  <li>Trust score reduced accordingly</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">💡 Suggested Retail Prices</div>
            <div style={{ fontSize: "0.82rem", color: "var(--sprout)" }}>
              {selectedBatch ? (
                [1.5, 2, 3, 5, 10].map(mult => {
                  const price = Math.round(selectedBatch.farmerPrice * mult);
                  const pct = ((mult - 1) * 100).toFixed(0);
                  const isSafe = mult <= 5;
                  return (
                    <div key={mult} className="price-row" style={{ cursor: "pointer" }}
                      onClick={() => setForm(f => ({ ...f, newPrice: String(price) }))}>
                      <span>{pct}% markup</span>
                      <span style={{ color: isSafe ? "var(--leaf)" : "var(--alert-red)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                        ₹{price}/kg {!isSafe && "⚠️"}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: "var(--sage)", textAlign: "center", padding: "1rem" }}>Select a batch to see price suggestions</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
