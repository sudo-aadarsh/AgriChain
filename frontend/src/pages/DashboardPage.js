import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllBatches, getRealtimeTicker, getSystemMetrics, getSystemMode } from "../utils/api";
import { useRefreshSeconds } from "../utils/refresh";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function DashboardPage() {
  const [batches, setBatches] = useState([]);
  const [ticker, setTicker] = useState(null);
  const [systemMode, setSystemMode] = useState(null);
  const [systemMetrics, setSystemMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshSeconds = useRefreshSeconds();
  const navigate = useNavigate();

  useEffect(() => {
    getAllBatches()
      .then((r) => setBatches(r.data.batches || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    const loadTicker = () => {
      getRealtimeTicker()
        .then((r) => {
          if (active) setTicker(r.data?.data || null);
        })
        .catch(() => {});
    };
    loadTicker();
    const id = refreshSeconds > 0 ? setInterval(loadTicker, refreshSeconds * 1000) : null;
    return () => {
      active = false;
      if (id) clearInterval(id);
    };
  }, [refreshSeconds]);

  useEffect(() => {
    const load = () => {
      getSystemMode().then((r) => setSystemMode(r.data?.mode || null)).catch(() => {});
      getSystemMetrics().then((r) => setSystemMetrics(r.data?.metrics || null)).catch(() => {});
    };
    load();
    const i = refreshSeconds > 0 ? setInterval(load, refreshSeconds * 1000) : null;
    return () => { if (i) clearInterval(i); };
  }, [refreshSeconds]);

  const flagged = useMemo(() => batches.filter((b) => b.isFlagged), [batches]);
  const trustAvg = batches.length
    ? Math.round(batches.reduce((sum, b) => sum + b.trustScore, 0) / batches.length)
    : 100;

  const avgMargin = batches.length
    ? (
        batches.reduce(
          (sum, b) => sum + (b.farmerPrice > 0 ? ((b.currentPrice - b.farmerPrice) / b.farmerPrice) * 100 : 0),
          0
        ) / batches.length
      ).toFixed(1)
    : "0.0";

  const productCount = batches.length;
  const liveProducts = batches.filter((b) => b.currentPrice > 0).length;
  const healthScore = Math.max(10, Math.min(99, Math.round((trustAvg * 0.65) + (100 - flagged.length * 8) * 0.35)));

  const priceChartData = batches.map((b) => ({
    name: b.productName.substring(0, 10),
    farmer: b.farmerPrice,
    retail: b.currentPrice,
  }));

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" /> Syncing chain intelligence...
      </div>
    );
  }

  return (
    <div className="dashboard-wrap">
      <div className="dashboard-topbar glass-animate">
        <div>
          <div className="dashboard-kicker">Operations Overview</div>
          <h1 className="dashboard-title">Supply Chain Command Center</h1>
          <p className="dashboard-subtitle">Track products, risk flags, trust score, and pricing from one interactive view.</p>
          {systemMode && (
            <div style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: "var(--sprout)" }}>
              Runtime: <strong style={{ color: "var(--soil)" }}>{systemMode.mode}</strong> {systemMode.blockchainRequired ? "(strict)" : "(fallback enabled)"} • Write Path: <strong style={{ color: systemMode.writeReady ? "var(--leaf)" : "var(--alert-red)" }}>{systemMode.writeReady ? "ready" : "not ready"}</strong>
            </div>
          )}
        </div>
        <div className="dashboard-live-pill">Live Sync • {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
      </div>

      {ticker?.rows?.length > 0 && (
        <div className="dashboard-ticker glass-animate" style={{ animationDelay: "0.04s" }}>
          {ticker.rows.map((row) => (
            <div className="ticker-chip" key={row.symbol}>
              <strong>{row.label}</strong>
              <span>{row.price ? `$${Number(row.price).toFixed(2)}` : "N/A"}</span>
              <em className={row.changePct >= 0 ? "up" : "down"}>
                {row.changePct === null || row.changePct === undefined ? "—" : `${row.changePct > 0 ? "+" : ""}${row.changePct}%`}
              </em>
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-hero glass-animate" style={{ animationDelay: "0.08s" }}>
        <div className="hero-left">
          <div className="hero-eyebrow">This Month</div>
          <div className="hero-value">{productCount.toLocaleString()}</div>
          <div className="hero-meta">Total registered products</div>
          <div className="hero-stats-row">
            <div>
              <span>Live tracked:</span>
              <strong>{liveProducts}</strong>
            </div>
            <div>
              <span>Avg margin:</span>
              <strong>{avgMargin}%</strong>
            </div>
          </div>
        </div>

        <div className="hero-right">
          <div className="hero-ring" style={{ ["--score"]: `${healthScore}%` }}>
            <div className="hero-ring-inner">
              <span>{healthScore}</span>
              <small>Health</small>
            </div>
          </div>
          <div className="hero-right-meta">
            <div><span>Trust Avg</span><strong>{trustAvg}%</strong></div>
            <div><span>Fraud Alerts</span><strong>{flagged.length}</strong></div>
            <div><span>Reliability</span><strong>{flagged.length === 0 ? "Stable" : "Needs review"}</strong></div>
          </div>
        </div>
      </div>

      {systemMetrics && (
        <div className="dashboard-ticker glass-animate" style={{ animationDelay: "0.1s" }}>
          <div className="ticker-chip"><strong>Total Batches</strong><span>{systemMetrics.totalBatches}</span></div>
          <div className="ticker-chip"><strong>Sold</strong><span>{systemMetrics.soldBatches}</span></div>
          <div className="ticker-chip"><strong>Completion%</strong><span>{systemMetrics.completionRatePercent}</span></div>
          <div className="ticker-chip"><strong>Flagged</strong><span>{systemMetrics.flaggedBatches}</span></div>
          <div className="ticker-chip"><strong>Clean</strong><span>{systemMetrics.cleanBatches}</span></div>
          <div className="ticker-chip"><strong>Avg Trust</strong><span>{systemMetrics.averageTrustScore}</span></div>
          <div className="ticker-chip"><strong>Avg Margin%</strong><span>{systemMetrics.averageMarginPercent}</span></div>
          <div className="ticker-chip"><strong>Mode</strong><span>{systemMode?.mode || "unknown"}</span></div>
        </div>
      )}

      <div className="dashboard-action-row glass-animate" style={{ animationDelay: "0.14s" }}>
        <button className="action-card" onClick={() => navigate("/farmer")}>🌾 Register New Batch</button>
        <button className="action-card" onClick={() => navigate("/distributor")}>🚚 Update Shipment</button>
        <button className="action-card" onClick={() => navigate("/retailer")}>🏪 Set Retail Price</button>
        <button className="action-card" onClick={() => navigate("/consumer")}>👤 Generate QR Trace</button>
      </div>

      {flagged.length > 0 && (
        <div className="fraud-alert glass-animate" style={{ animationDelay: "0.2s" }}>
          <div className="fraud-alert-title">⚠ Risk Feed — {flagged.length} flagged batch(es)</div>
          {flagged.slice(0, 3).map((b) => (
            <div className="fraud-alert-text" key={b.id}>
              Batch #{b.id} ({b.productName}) • {b.flagReason}
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-grid">
        <div className="card glass-animate" style={{ animationDelay: "0.25s" }}>
          <div className="card-title">📊 Pricing Intelligence</div>
          {priceChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={priceChartData} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,160,220,0.28)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: "SF Mono, Menlo, Monaco, monospace" }} />
                <YAxis tick={{ fontSize: 11, fontFamily: "SF Mono, Menlo, Monaco, monospace" }} />
                <Tooltip
                  contentStyle={{
                    border: "1px solid rgba(255,255,255,0.4)",
                    borderRadius: "12px",
                    backdropFilter: "blur(8px)",
                    background: "rgba(255,255,255,0.7)",
                    boxShadow: "0 10px 20px rgba(25,72,140,0.16)",
                  }}
                />
                <Line type="monotone" dataKey="farmer" stroke="#3398ff" strokeWidth={3} dot={{ r: 3 }} name="Farmer ₹" />
                <Line type="monotone" dataKey="retail" stroke="#8258ff" strokeWidth={3} dot={{ r: 3 }} name="Retail ₹" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="dashboard-empty">No pricing data yet. Add the first batch to activate charts.</div>
          )}
          <div className="dashboard-legends">
            <span className="legend farmer">● Farmer Price</span>
            <span className="legend retail">● Retail Price</span>
            <span className="legend neutral">Avg Margin {avgMargin}%</span>
          </div>
        </div>

        <div className="card glass-animate" style={{ animationDelay: "0.3s" }}>
          <div className="card-title">📦 Recent Products</div>
          {batches.length === 0 ? (
            <div className="dashboard-empty">No batches registered yet. Open Farmer and create one.</div>
          ) : (
            <div className="batch-list">
              {batches.slice(-7).reverse().map((b, i) => (
                <div
                  key={b.id}
                  className={`batch-item ${b.isFlagged ? "flagged" : ""}`}
                  onClick={() => navigate(`/scan/${b.id}`)}
                  style={{ animationDelay: `${0.35 + i * 0.03}s` }}
                >
                  <div>
                    <div className="batch-name">{b.productName} {b.isFlagged ? "⚠" : ""}</div>
                    <div className="batch-meta">{b.farmerName} • {b.quantity}kg • ₹{b.currentPrice}/kg</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="batch-id">#{b.id}</div>
                    <div style={{ marginTop: "0.3rem" }}>
                      <TrustBadge score={b.trustScore} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrustBadge({ score }) {
  const cls = score >= 80 ? "trust-high" : score >= 50 ? "trust-medium" : "trust-low";
  const label = score >= 80 ? "High" : score >= 50 ? "Medium" : "Low";
  return <span className={`trust-badge ${cls}`}>{label} Trust</span>;
}
