import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getBatch, getQRCode, getRealtimeForBatch } from "../utils/api";
import { useRefreshSeconds } from "../utils/refresh";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

const STAGE_ICONS = ["🌾", "🚚", "🏭", "🏪", "✅"];
const STAGE_COLORS = ["var(--leaf)", "var(--wheat)", "var(--sprout)", "var(--chain-blue)", "var(--alert-green)"];

export default function ScanPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("journey");
  const [live, setLive] = useState(null);
  const refreshSeconds = useRefreshSeconds();

  useEffect(() => {
    Promise.all([
      getBatch(id),
      getQRCode(id).catch(() => null)
    ])
      .then(([batchRes, qrRes]) => {
        setData(batchRes.data);
        if (qrRes) setQr(qrRes.data);
      })
      .catch(() => setError("Product not found"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    let active = true;
    const loadLive = () => {
      getRealtimeForBatch(id)
        .then((r) => {
          if (active) setLive(r.data?.data || null);
        })
        .catch(() => {
          if (active) setLive(null);
        });
    };
    loadLive();
    const ticker = refreshSeconds > 0 ? setInterval(loadLive, refreshSeconds * 1000) : null;
    return () => {
      active = false;
      if (ticker) clearInterval(ticker);
    };
  }, [id, refreshSeconds]);

  if (loading) return <div className="loading"><div className="spinner" /> Loading product journey from blockchain...</div>;
  if (error) return (
    <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔍</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "1rem" }}>{error}</div>
      <Link to="/" className="btn btn-primary" style={{ marginTop: "1rem", display: "inline-flex" }}>← Back to Dashboard</Link>
    </div>
  );

  const { batch, steps, priceHistory, fraudFlags, trustScore, trustLabel, margin } = data;

  const trustClass = trustScore >= 80 ? "trust-high" : trustScore >= 50 ? "trust-medium" : "trust-low";
  const priceChartData = priceHistory.map((ph, i) => ({
    name: i === 0 ? "Farm" : `Update ${i}`,
    price: ph.price,
    timestamp: new Date(ph.timestamp * 1000).toLocaleDateString()
  }));

  const farmerGets = batch.farmerPrice;
  const retailerGets = batch.currentPrice;
  const spreadPct = farmerGets > 0 ? (((retailerGets - farmerGets) / retailerGets) * 100).toFixed(1) : 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <Link to="/" style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--sprout)", textDecoration: "none" }}>← Back</Link>
          <h1 className="page-title" style={{ marginTop: "0.5rem" }}>
            {batch.productName}
          </h1>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <span className={`trust-badge ${trustClass}`}>
              {trustScore >= 80 ? "✅" : trustScore >= 50 ? "⚠️" : "🔴"} Trust: {trustLabel} ({trustScore}/100)
            </span>
            <span className="demo-badge">⛓ BLOCKCHAIN #{id}</span>
            {batch.isFlagged && <span style={{ background: "var(--alert-red)", color: "white", padding: "3px 10px", fontFamily: "var(--font-mono)", fontSize: "0.65rem", fontWeight: 700 }}>FLAGGED</span>}
          </div>
        </div>
        {qr && (
          <div style={{ textAlign: "center" }}>
            <img src={qr.qrCode} alt="QR" style={{ width: 80, height: 80, border: "2px solid var(--fog)" }} />
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "var(--sage)", marginTop: "0.2rem" }}>SCAN ME</div>
          </div>
        )}
      </div>

      {/* Fraud Alerts */}
      {fraudFlags && fraudFlags.length > 0 && (
        <div className="fraud-alert" style={{ marginBottom: "1.5rem" }}>
          <div className="fraud-alert-title">⚠️ Suspicious Activity Detected — {fraudFlags.length} issue(s)</div>
          {fraudFlags.map((flag, i) => (
            <div className="fraud-alert-text" key={i}>• {flag}</div>
          ))}
        </div>
      )}

      {/* Summary row */}
      <div className="grid-3" style={{ marginBottom: "1.5rem" }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--leaf)" }}>₹{batch.farmerPrice}</div>
          <div className="stat-label">Farmer Price /kg</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--chain-blue)" }}>₹{batch.currentPrice}</div>
          <div className="stat-label">Retail Price /kg</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: parseFloat(margin) > 300 ? "var(--alert-red)" : "var(--wheat)" }}>{margin}%</div>
          <div className="stat-label">Price Markup</div>
        </div>
      </div>

      {live && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div className="card-title">🌐 Realtime Signals</div>
          <div className="grid-3">
            <div className="price-row" style={{ borderBottom: "none" }}>
              <span className="price-label">Benchmark</span>
              <span className="price-value">{live?.benchmark?.price ? `$${Number(live.benchmark.price).toFixed(2)}` : "N/A"}</span>
            </div>
            <div className="price-row" style={{ borderBottom: "none" }}>
              <span className="price-label">Current Weather</span>
              <span className="price-value">{live?.weather?.current ? `${live.weather.current.temperatureC}°C` : "N/A"}</span>
            </div>
            <div className="price-row" style={{ borderBottom: "none" }}>
              <span className="price-label">Transit Risk</span>
              <span className="price-value">{live?.logistics?.risk || "Unknown"}</span>
            </div>
          </div>
          <div style={{ marginTop: "0.8rem" }}>
            <div className="price-row">
              <span className="price-label">Live Tracking</span>
              <span className="price-value">
                {live?.logistics?.trackingConfigured
                  ? (live?.logistics?.tracking?.status || "Awaiting provider update")
                  : "Not configured"}
              </span>
            </div>
            {live?.logistics?.trackingConfigured && (
              <div style={{ marginTop: "0.4rem", fontSize: "0.78rem", color: "var(--sprout)" }}>
                {live?.logistics?.tracking?.statusText || "Tracking synced from provider."}
              </div>
            )}
            {!!live?.logistics?.tracking?.checkpoints?.length && (
              <div style={{ marginTop: "0.6rem", display: "grid", gap: "0.4rem" }}>
                {live.logistics.tracking.checkpoints.map((cp, idx) => (
                  <div key={idx} style={{ background: "rgba(255,255,255,0.42)", border: "1px solid rgba(150,190,240,0.5)", borderRadius: "10px", padding: "0.5rem 0.65rem" }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--soil)" }}>{cp.message || "Checkpoint update"}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--sprout)", marginTop: "0.12rem" }}>
                      {[cp.city, cp.country].filter(Boolean).join(", ")} {cp.time ? `• ${new Date(cp.time).toLocaleString()}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {["journey", "prices", "details"].map(tab => (
          <button key={tab} className={`tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
            {tab === "journey" ? "📍 Journey" : tab === "prices" ? "💰 Prices" : "📋 Details"}
          </button>
        ))}
      </div>

      {/* Journey Tab */}
      {activeTab === "journey" && (
        <div className="card">
          <div className="card-title">📍 Supply Chain Journey</div>
          {steps.length === 0 ? (
            <div style={{ color: "var(--sage)", padding: "1rem", textAlign: "center" }}>No journey steps recorded yet</div>
          ) : (
            <div className="timeline">
              {steps.map((step, i) => {
                const stageIdx = step.stageIndex !== undefined ? step.stageIndex : i;
                const isLast = i === steps.length - 1;
                const isFraud = fraudFlags && fraudFlags.length > 0 && isLast && batch.isFlagged;
                return (
                  <div className="timeline-item" key={i}>
                    <div className={`timeline-dot ${isFraud ? "flagged" : ""}`} />
                    <div className="timeline-stage" style={{ color: STAGE_COLORS[stageIdx] || "var(--leaf)" }}>
                      {STAGE_ICONS[stageIdx] || "📦"} {step.stage}
                    </div>
                    <div className="timeline-meta">
                      📍 {step.location} &nbsp;|&nbsp; 🕐 {new Date(step.timestamp * 1000).toLocaleString()}
                    </div>
                    <div className="timeline-meta">
                      <span className="hash">{step.actor}</span>
                    </div>
                    {step.notes && <div className="timeline-notes" style={{ marginTop: "0.3rem" }}>{step.notes}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Missing steps warning */}
          {steps.length > 0 && !steps.some(s => (s.stageIndex || 0) >= 1) && (
            <div className="warning-alert" style={{ marginTop: "1rem" }}>
              <div className="warning-alert-title">⚠️ Missing Step: Distributor</div>
              <div style={{ fontSize: "0.8rem" }}>This product has not been recorded through a distributor.</div>
            </div>
          )}
        </div>
      )}

      {/* Prices Tab */}
      {activeTab === "prices" && (
        <div>
          <div className="card">
            <div className="card-title">💰 Price History</div>
            {priceChartData.length > 1 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={priceChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "Space Mono" }} />
                    <YAxis tick={{ fontSize: 10, fontFamily: "Space Mono" }} />
                    <Tooltip
                      contentStyle={{ fontFamily: "Space Mono", fontSize: 11, border: "2px solid #4a2c2a" }}
                      formatter={(v) => [`₹${v}/kg`, "Price"]}
                      labelFormatter={(l, p) => p[0]?.payload?.timestamp || l}
                    />
                    <ReferenceLine y={batch.farmerPrice} stroke="var(--leaf)" strokeDasharray="4 4" label={{ value: "Farm", fontSize: 10, fill: "var(--leaf)" }} />
                    <Line type="monotone" dataKey="price" stroke="var(--chain-blue)" strokeWidth={2} dot={{ r: 5, fill: "var(--chain-blue)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div style={{ color: "var(--sage)", textAlign: "center", padding: "1rem" }}>No price updates yet beyond initial farm price</div>
            )}

            <div style={{ marginTop: "1rem" }}>
              {priceHistory.map((ph, i) => (
                <div className="price-row" key={i}>
                  <div>
                    <div className="price-label">{i === 0 ? "🌾 Farm (Initial)" : `📍 Update ${i}`}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--sage)" }}>{new Date(ph.timestamp * 1000).toLocaleString()}</div>
                    {ph.note && <div style={{ fontSize: "0.75rem", color: "var(--sprout)", marginTop: "0.1rem" }}>{ph.note}</div>}
                  </div>
                  <div className="price-value" style={{ color: i === 0 ? "var(--leaf)" : "var(--chain-blue)" }}>₹{ph.price}/kg</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">📊 Price Distribution</div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "0.5rem" }}>
                <span>Farmer earns</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--leaf)", fontWeight: 700 }}>
                  {(100 - parseFloat(spreadPct)).toFixed(1)}% of retail price
                </span>
              </div>
              <div style={{ height: 24, background: "var(--fog)", borderRadius: 4, overflow: "hidden", display: "flex" }}>
                <div style={{ width: `${100 - parseFloat(spreadPct)}%`, background: "var(--leaf)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>
                  {parseFloat(100 - parseFloat(spreadPct)) > 15 ? "Farmer" : ""}
                </div>
                <div style={{ flex: 1, background: "var(--chain-blue)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>
                  {parseFloat(spreadPct) > 15 ? "Supply Chain" : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", fontSize: "0.75rem" }}>
                <span style={{ color: "var(--leaf)" }}>● Farmer: ₹{farmerGets}/kg</span>
                <span style={{ color: "var(--chain-blue)" }}>● Retail: ₹{retailerGets}/kg</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details Tab */}
      {activeTab === "details" && (
        <div className="card">
          <div className="card-title">📋 Batch Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", fontSize: "0.85rem" }}>
            {[
              ["Batch ID", `#${batch.id}`],
              ["Product", batch.productName],
              ["Farmer", batch.farmerName],
              ["Origin", batch.originLocation],
              ["Quantity", `${batch.quantity} kg`],
              ["Harvest Date", batch.harvestDate ? new Date(batch.harvestDate * 1000).toLocaleDateString() : "N/A"],
              ["Registered At", new Date(batch.createdAt * 1000).toLocaleString()],
              ["Trust Score", `${batch.trustScore}/100`],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: "0.6rem", background: "var(--cream)", borderRadius: "2px" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--sprout)", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono)" }}>{label}</div>
                <div style={{ fontWeight: 600, marginTop: "0.2rem" }}>{value}</div>
              </div>
            ))}
          </div>

          {batch.isFlagged && (
            <div className="fraud-alert" style={{ marginTop: "1rem" }}>
              <div className="fraud-alert-title">⚠️ Fraud Flag Details</div>
              <div className="fraud-alert-text">{batch.flagReason}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
