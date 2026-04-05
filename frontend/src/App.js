import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from "react-router-dom";
import "./App.css";
import FarmerPage from "./pages/FarmerPage";
import DistributorPage from "./pages/DistributorPage";
import RetailerPage from "./pages/RetailerPage";
import ConsumerPage from "./pages/ConsumerPage";
import ScanPage from "./pages/ScanPage";
import DashboardPage from "./pages/DashboardPage";
import { getAllBatches } from "./utils/api";
import { REFRESH_OPTIONS, setRefreshSeconds, useRefreshSeconds } from "./utils/refresh";

function Nav() {
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [batches, setBatches] = useState([]);
  const refreshSeconds = useRefreshSeconds();

  const roles = [
    { path: "/", label: "Dashboard", icon: "⊞" },
    { path: "/farmer", label: "Farmer", icon: "🌾" },
    { path: "/distributor", label: "Distributor", icon: "🚚" },
    { path: "/retailer", label: "Retailer", icon: "🏪" },
    { path: "/consumer", label: "Consumer", icon: "👤" },
  ];

  useEffect(() => {
    getAllBatches()
      .then((res) => setBatches(res.data?.batches || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const productEntries = useMemo(
    () =>
      batches.map((b) => ({
        id: `product-${b.id}`,
        title: b.productName,
        subtitle: `Batch #${b.id} • ${b.farmerName}`,
        action: () => {
          navigate(`/scan/${b.id}`);
          setPaletteOpen(false);
          setQuery("");
        },
      })),
    [batches, navigate]
  );

  const featureEntries = useMemo(
    () =>
      [
        { title: "Dashboard", subtitle: "Overview and analytics", path: "/" },
        { title: "Farmer Registration", subtitle: "Create produce batches", path: "/farmer" },
        { title: "Distributor Update", subtitle: "Update shipment stages", path: "/distributor" },
        { title: "Retail Price Manager", subtitle: "Set and review retail pricing", path: "/retailer" },
        { title: "Consumer QR View", subtitle: "Generate and scan traceability QR", path: "/consumer" },
      ].map((item, idx) => ({
        id: `feature-${idx}`,
        title: item.title,
        subtitle: item.subtitle,
        action: () => {
          navigate(item.path);
          setPaletteOpen(false);
          setQuery("");
        },
      })),
    [navigate]
  );

  const mergedEntries = useMemo(() => [...featureEntries, ...productEntries], [featureEntries, productEntries]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredEntries = normalizedQuery
    ? mergedEntries.filter(
        (entry) =>
          entry.title.toLowerCase().includes(normalizedQuery) ||
          entry.subtitle.toLowerCase().includes(normalizedQuery)
      )
    : mergedEntries.slice(0, 8);

  const cycleRefresh = () => {
    const idx = REFRESH_OPTIONS.indexOf(refreshSeconds);
    const next = REFRESH_OPTIONS[(idx + 1) % REFRESH_OPTIONS.length];
    setRefreshSeconds(next);
  };

  return (
    <>
      <nav className="navbar">
        <div className="nav-brand">
          <span className="brand-icon">⛓</span>
          <span className="brand-text">AgriChain</span>
          <span className="brand-tag">Blockchain</span>
        </div>
        <button className="nav-search-button" onClick={() => setPaletteOpen(true)}>
          <span>🔎</span>
          <span>Search products or features</span>
          <kbd>⌘K</kbd>
        </button>
        <button className="nav-refresh-button" onClick={cycleRefresh} title="Cycle auto-refresh interval">
          <span>⟳</span>
          <span>{refreshSeconds === 0 ? "Refresh Off" : `Refresh ${refreshSeconds}s`}</span>
        </button>
        <div className="nav-links">
          {roles.map(r => (
            <NavLink key={r.path} to={r.path} end={r.path === "/"} className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
              <span>{r.icon}</span> {r.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {paletteOpen && (
        <div className="search-overlay" onClick={() => setPaletteOpen(false)}>
          <div className="search-modal" onClick={(e) => e.stopPropagation()}>
            <div className="search-modal-header">
              <input
                autoFocus
                className="search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products, roles, dashboard actions..."
              />
              <button className="search-close" onClick={() => setPaletteOpen(false)}>✕</button>
            </div>
            <div className="search-list">
              {filteredEntries.length > 0 ? (
                filteredEntries.map((entry) => (
                  <button key={entry.id} className="search-item" onClick={entry.action}>
                    <div className="search-item-title">{entry.title}</div>
                    <div className="search-item-subtitle">{entry.subtitle}</div>
                  </button>
                ))
              ) : (
                <div className="search-empty">No matches for "{query}"</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AppLayout() {
  const location = useLocation();

  return (
    <div className="app">
      <Nav />
      <main className="main-content">
        <div key={location.pathname} className="route-transition">
          <Routes location={location}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/farmer" element={<FarmerPage />} />
            <Route path="/distributor" element={<DistributorPage />} />
            <Route path="/retailer" element={<RetailerPage />} />
            <Route path="/consumer" element={<ConsumerPage />} />
            <Route path="/scan/:id" element={<ScanPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
