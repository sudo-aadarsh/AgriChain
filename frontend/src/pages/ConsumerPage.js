import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAllBatches, getBatch, getQRCode, getRealtimeForBatch, confirmSale } from "../utils/api";
import { useRefreshSeconds } from "../utils/refresh";

export default function ConsumerPage() {
  const [batches, setBatches] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [live, setLive] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmLocation, setConfirmLocation] = useState("Consumer Purchase Point");
  const [confirmNotes, setConfirmNotes] = useState("Consumer confirmed purchase");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [journeySold, setJourneySold] = useState(false);
  const refreshSeconds = useRefreshSeconds();
  const navigate = useNavigate();

  useEffect(() => {
    getAllBatches()
      .then(r => setBatches(r.data.batches || []))
      .finally(() => setFetching(false));
  }, []);

  const handleGenerateQR = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await getQRCode(selectedId);
      setQrData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectedBatch = batches.find(b => b.id === parseInt(selectedId));
  const selectedBatchSold = journeySold;

  const handleConfirmSale = async () => {
    if (!selectedId || selectedBatchSold) return;
    setConfirming(true);
    setConfirmMessage("");
    setConfirmError("");
    try {
      const res = await confirmSale(selectedId, {
        location: confirmLocation,
        notes: confirmNotes,
      });
      setConfirmMessage(res.data?.message || "Consumer purchase confirmed");
      const refreshed = await getAllBatches();
      setBatches(refreshed.data?.batches || []);
      setJourneySold(true);
    } catch (err) {
      setConfirmError(err?.response?.data?.error || "Failed to confirm sale");
    } finally {
      setConfirming(false);
    }
  };

  useEffect(() => {
    if (!selectedId) {
      setLive(null);
      setJourneySold(false);
      return;
    }
    const loadLive = () => {
      getRealtimeForBatch(selectedId)
        .then((r) => setLive(r.data?.data || null))
        .catch(() => setLive(null));
    };
    loadLive();
    const i = refreshSeconds > 0 ? setInterval(loadLive, refreshSeconds * 1000) : null;
    return () => {
      if (i) clearInterval(i);
    };
  }, [selectedId, refreshSeconds]);

  useEffect(() => {
    if (!selectedId) {
      setJourneySold(false);
      return;
    }
    getBatch(selectedId)
      .then((r) => {
        const steps = r.data?.steps || [];
        const sold = steps.some((s) => Number(s.stageIndex) === 4 || String(s.stage).toLowerCase() === "sold");
        setJourneySold(sold);
      })
      .catch(() => setJourneySold(false));
  }, [selectedId]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">👤 Consumer View</h1>
        <p className="page-subtitle">Scan QR codes to trace your food from farm to table</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">📱 Generate Product QR Code</div>
          <div className="form-group">
            <label className="form-label">Select Product Batch</label>
            {fetching ? (
              <div className="loading" style={{ padding: "0.5rem" }}><div className="spinner" /></div>
            ) : (
              <select className="form-select" value={selectedId}
                onChange={e => { setSelectedId(e.target.value); setQrData(null); }}>
                <option value="">— Choose a product —</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>#{b.id} — {b.productName} by {b.farmerName}</option>
                ))}
              </select>
            )}
          </div>

          {selectedBatch && (
            <div style={{ background: "var(--cream)", border: "1px solid var(--fog)", padding: "1rem", borderRadius: "2px", marginBottom: "1rem" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--bark)", marginBottom: "0.6rem" }}>PRODUCT DETAILS</div>
              <div style={{ fontSize: "0.85rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                <div><span style={{ color: "var(--sprout)" }}>Product:</span> <strong>{selectedBatch.productName}</strong></div>
                <div><span style={{ color: "var(--sprout)" }}>Farmer:</span> <strong>{selectedBatch.farmerName}</strong></div>
                <div><span style={{ color: "var(--sprout)" }}>Origin:</span> <strong>{selectedBatch.originLocation}</strong></div>
                <div><span style={{ color: "var(--sprout)" }}>Qty:</span> <strong>{selectedBatch.quantity}kg</strong></div>
                <div><span style={{ color: "var(--sprout)" }}>Farm Price:</span> <strong style={{ color: "var(--leaf)" }}>₹{selectedBatch.farmerPrice}/kg</strong></div>
                <div><span style={{ color: "var(--sprout)" }}>Retail Price:</span> <strong style={{ color: "var(--chain-blue)" }}>₹{selectedBatch.currentPrice}/kg</strong></div>
              </div>
              {selectedBatch.isFlagged && (
                <div style={{ marginTop: "0.75rem", background: "#fdf2f2", border: "1px solid var(--alert-red)", padding: "0.5rem", borderRadius: "2px", fontSize: "0.8rem", color: "var(--alert-red)" }}>
                  ⚠️ {selectedBatch.flagReason}
                </div>
              )}
              {selectedBatchSold && (
                <div style={{ marginTop: "0.75rem", background: "#f2fdf4", border: "1px solid var(--alert-green)", padding: "0.5rem", borderRadius: "2px", fontSize: "0.8rem", color: "var(--leaf)" }}>
                  ✅ This batch is already marked as sold on-chain
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn-primary" style={{ flex: 1 }}
              onClick={handleGenerateQR} disabled={!selectedId || loading}>
              {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Generating...</> : "📱 Generate QR Code"}
            </button>
            {selectedId && (
              <button className="btn btn-secondary"
                onClick={() => navigate(`/scan/${selectedId}`)}>
                👁 View Journey
              </button>
            )}
          </div>

          {selectedBatch && (
            <div style={{ marginTop: "1rem", background: "rgba(255,255,255,0.45)", border: "1px solid rgba(150,190,240,0.4)", borderRadius: "12px", padding: "0.8rem" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.74rem", color: "var(--bark)", marginBottom: "0.5rem" }}>
                ✅ CONSUMER PURCHASE CONFIRMATION
              </div>
              <div className="form-group" style={{ marginBottom: "0.45rem" }}>
                <label className="form-label">Purchase Location</label>
                <input className="form-input" value={confirmLocation} onChange={(e) => setConfirmLocation(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: "0.65rem" }}>
                <label className="form-label">Notes</label>
                <input className="form-input" value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} />
              </div>
              <button
                className="btn btn-primary"
                onClick={handleConfirmSale}
                disabled={!selectedId || confirming || selectedBatchSold}
              >
                {confirming ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Confirming...</> : "✅ Confirm Purchase On-Chain"}
              </button>
              {confirmMessage && (
                <div style={{ marginTop: "0.55rem", color: "var(--leaf)", fontSize: "0.8rem" }}>{confirmMessage}</div>
              )}
              {confirmError && (
                <div style={{ marginTop: "0.55rem", color: "var(--alert-red)", fontSize: "0.8rem" }}>{confirmError}</div>
              )}
            </div>
          )}

          {qrData && (
            <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
              <div className="qr-container">
                <img src={qrData.qrCode} alt="QR Code" style={{ maxWidth: 200 }} />
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--sprout)", marginTop: "0.75rem" }}>
                  Scan to trace product journey
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--sage)", marginTop: "0.3rem", wordBreak: "break-all" }}>
                  {qrData.url}
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          {live && (
            <div className="card">
              <div className="card-title">🌐 Live Transparency Feed</div>
              <div className="price-row">
                <span className="price-label">Benchmark Price</span>
                <span className="price-value">{live?.benchmark?.price ? `$${Number(live.benchmark.price).toFixed(2)}` : "N/A"}</span>
              </div>
              <div className="price-row">
                <span className="price-label">Current Location Weather</span>
                <span className="price-value">{live?.weather?.current ? `${live.weather.current.temperatureC}°C, ${live.weather.current.weatherText}` : "N/A"}</span>
              </div>
              <div className="price-row">
                <span className="price-label">Logistics Status</span>
                <span className="price-value">{live?.logistics?.risk || "Unknown"} risk</span>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-title">🔍 How to Verify Your Food</div>
            <div style={{ fontSize: "0.85rem", lineHeight: 1.8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {[
                  { step: "1", title: "Scan QR Code", desc: "Use your phone camera on the QR label attached to the produce packaging." },
                  { step: "2", title: "View Full Journey", desc: "See the complete supply chain: farmer → distributor → retailer with timestamps." },
                  { step: "3", title: "Check Trust Score", desc: "A high trust score means no fraud detected. Flagged items show detailed alerts." },
                  { step: "4", title: "See Price Transparency", desc: "Compare what the farmer got vs. what you're paying at retail." },
                ].map(s => (
                  <div key={s.step} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <div style={{ minWidth: 28, height: 28, background: "var(--leaf)", color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700 }}>{s.step}</div>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: "0.2rem" }}>{s.title}</div>
                      <div style={{ color: "var(--sprout)", fontSize: "0.82rem" }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">🌾 All Available Products</div>
            {batches.length === 0 ? (
              <div style={{ color: "var(--sage)", textAlign: "center", padding: "1rem", fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>No products registered yet</div>
            ) : (
              <div className="batch-list">
                {batches.map(b => (
                  <div key={b.id} className={`batch-item ${b.isFlagged ? "flagged" : ""}`}
                    onClick={() => navigate(`/scan/${b.id}`)}>
                    <div>
                      <div className="batch-name">{b.productName} {b.isFlagged && "⚠️"}</div>
                      <div className="batch-meta">{b.farmerName} · {b.originLocation}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--chain-blue)" }}>₹{b.currentPrice}/kg</div>
                      <div className="batch-id" style={{ marginTop: "0.3rem" }}>#{b.id}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
