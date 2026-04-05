# AgriChain Hackathon Judge Guide

## 1. Problem Statement Mapping
Problem: blockchain-enabled agricultural traceability with transparency in movement, pricing, and stakeholder transactions.

How AgriChain maps to this:
- Movement transparency: every batch has a stage-wise journey (`Harvested -> In Transit -> At Warehouse -> At Retail`) with actor, location, timestamp, and notes.
- Movement transparency: every batch has a stage-wise journey (`Harvested -> In Transit -> At Warehouse -> At Retail -> Sold`) with actor, location, timestamp, and notes.
- Pricing transparency: farmer price + all subsequent price updates are tracked and visualized.
- Stakeholder transaction visibility: each role action is captured as a transaction record (on-chain in blockchain mode, in-memory event in demo mode).
- Risk/fraud controls: duplicate detection, abnormal markup detection, and missing-step detection are enforced.

## 2. What Is On-Chain vs Off-Chain
### On-chain (Blockchain Mode)
Stored in smart contract (`smart-contract/contracts/AgriChain.sol`):
- Batch metadata: product, farmer, origin, quantity, harvest date, trust/flag state.
- Supply chain steps.
- Price history.
- Role assignment state (`Farmer`, `Distributor`, `Retailer`, `Consumer`).
- Emitted events: `BatchCreated`, `StageUpdated`, `PriceUpdated`, `FraudDetected`, `RoleAssigned`.

### Off-chain (by design)
- Realtime market/weather/FX feeds from public APIs.
- Logistics provider (AfterShip) live tracking status/checkpoints.
- UI analytics cache and refresh settings.
- Optional logistics metadata (carrier + tracking no.) used to query provider.

Reason: external realtime providers are mutable and not chain-native; they are consumed as verification context.

## 3. Architecture
### Frontend
- React app (`frontend/`) with role pages: Dashboard, Farmer, Distributor, Retailer, Consumer, Scan.
- Global quick search (`Cmd/Ctrl + K`).
- Auto-refresh toggle: `Off / 15s / 30s / 60s` persisted in localStorage.

### Backend
- Node/Express (`backend/`) with route groups:
  - `/api/batches` (core batch lifecycle)
  - `/api/realtime` (external feed aggregation)
  - `/api/system` (runtime mode + KPIs)
- Blockchain adapter: `backend/utils/blockchain.js`.
- Realtime adapter: `backend/utils/realtime.js`.

### Smart Contract Layer
- Solidity contract: `AgriChain.sol`.
- Supports role-based methods for batch creation, shipment update, retail price update, and final consumer sale confirmation.

### External APIs Used
- Open-Meteo Geocoding + Forecast API (weather/geolocation)
- Yahoo Finance Chart API (commodity benchmark proxies)
- ERAPI (USD/INR forex)
- AfterShip Tracking API (live logistics checkpoints/status)

## 4. Runtime Modes
### Demo Mode
Triggered when `CONTRACT_ADDRESS` is zero address.
- Uses seeded in-memory dataset for fast demo.
- Default seed size: 600 batches.
- Does not require blockchain network.

### Blockchain Mode (strict, production-demo)
Triggered when valid `CONTRACT_ADDRESS` is set.
- Backend uses **dedicated role signers** (owner/farmer/distributor/retailer/consumer).
- Roles are auto-assigned on-chain at startup.
- Create/update actions execute via role-specific wallets.

### Strict Enforcement
Set `REQUIRE_BLOCKCHAIN=true` to fail startup if blockchain setup is invalid.
This prevents silent fallback and is recommended for judge demos.

## 5. Data Model and Volumes
### Seeded demo dataset
Current default:
- Total batches: 600
- Unique products: 600
- Unique farmers: 160
- Unique origin locations: 40

Generated attributes:
- Product names from 48+ base crops x quality variants.
- Multiple states/cities and transit hubs.
- Mixed fraud and clean records for realistic analytics.

## 6. Core API Inventory
### Health/System
- `GET /health`
- `GET /api/system/mode` -> demo vs blockchain + wallet addresses + strict flag
- `GET /api/system/metrics` -> total, sold/completion, flagged, trust avg, margin avg

### Batch lifecycle
- `POST /api/batches`
- `GET /api/batches`
- `GET /api/batches/:id`
- `PUT /api/batches/:id/shipment`
- `PUT /api/batches/:id/retail-price`
- `PUT /api/batches/:id/confirm-sale`
- `GET /api/batches/:id/qr`
- `GET /api/batches/fraud/alerts`

### Realtime feeds
- `GET /api/realtime/ticker`
- `GET /api/realtime/overview`
- `GET /api/realtime/batch/:id`

## 7. Realtime Logistics Integration
To enable live logistics tracking:
1. Set `AFTERSHIP_API_KEY` in backend env.
2. In Distributor page submit `carrier` slug and `trackingNumber` with shipment update.
3. View live tracking block in Scan page.

Carrier slug examples:
- `dhl`, `fedex`, `ups`, `usps`, `delhivery`, `bluedart`, `dtdc`, `xpressbees`, `india-post`, `ekart`.

Fallback behavior:
- If key missing, API returns `API Key Missing` explicit status.

## 8. Blockchain Setup (Judge Demo Path)
## Option A: Polygon Amoy
1. Deploy contract from `smart-contract/`.
2. Configure backend:
   - `POLYGON_RPC_URL`
   - `CONTRACT_ADDRESS`
   - `OWNER_PRIVATE_KEY`
   - `FARMER_PRIVATE_KEY`
   - `DISTRIBUTOR_PRIVATE_KEY`
   - `RETAILER_PRIVATE_KEY`
   - `CONSUMER_PRIVATE_KEY`
   - `REQUIRE_BLOCKCHAIN=true`
3. Restart backend.
4. Verify: `GET /api/system/mode` returns `mode=blockchain`.

## Option B: Local Hardhat Network
1. Run local node: `npx hardhat node`.
2. Deploy contract to localhost.
3. Set backend env to localhost RPC + deployed contract + role keys.
4. Set `REQUIRE_BLOCKCHAIN=true`.
5. Restart backend and verify mode endpoint.

## 9. Fraud/Risk Logic
Implemented checks:
- Duplicate product entry signature detection.
- Retail price spike >500%.
- Missing distributor step before retail.
- Trust score degradation based on violations.

Realtime risk augmentation:
- Weather-based logistics risk (Low/Medium/High + ETA impact estimate).

## 10. Security and Integrity Notes
- Role-gated smart contract methods.
- Role assignment controlled by owner wallet.
- Chain events auditable through explorer in testnet mode.
- CORS hardened for expected frontend origins.

Known hackathon simplifications:
- Logistics metadata (carrier/tracking) currently off-chain.
- No full user auth/tenant model (role wallets are backend-managed).

## 11. Demo Script (2.5-3 minutes)
1. Show `/api/system/mode` proving blockchain mode.
2. Create farmer batch.
3. Distributor update with carrier+tracking.
4. Retailer price update.
5. Consumer confirms purchase (`confirm-sale`) and Scan page shows final `Sold` stage.
6. Open Scan page: journey + price history + realtime signals + tracking status.
7. Trigger fraud scenario and show trust impact.
8. Show Dashboard KPIs and ticker refresh.

## 12. Likely Judge Questions and Suggested Answers
Q: Why blockchain here?
A: It ensures tamper-evident supply chain events and price updates between distrustful stakeholders.

Q: What is truly on-chain?
A: Batch state, journey steps, pricing history, fraud flags, and role-restricted actions.

Q: Why external APIs then?
A: Realtime weather/market/logistics are off-chain reference signals; they complement, not replace, the immutable ledger.

Q: How do you avoid fake role actions?
A: Contract enforces role-gated methods; backend uses role-specific wallets and auto-role assignment.

Q: How do you verify mode during demo?
A: `/api/system/mode` endpoint exposes runtime mode and signer addresses.

## 13. Current Strengths Summary
- End-to-end flow across all supply chain roles.
- Realtime external intelligence integrated into each section.
- Strict blockchain-mode support with role wallets.
- High-volume realistic seeded dataset for robust demo.
- Polished UI with modern interactions and search.

## 14. Next Upgrade Candidates (Post-hackathon)
- On-chain hash anchoring for logistics checkpoint proofs.
- Wallet-based end-user authentication (MetaMask/WalletConnect).
- ZK/privacy layer for sensitive commercial pricing.
- Event sourcing + Postgres for long-term audit analytics.
