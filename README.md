# 🌾 AgriChain — Blockchain Agricultural Supply Chain

> Track produce from farmer to consumer on Polygon blockchain with built-in fraud detection.

---

## 🚀 Quick Start (Docker — Recommended)

```bash
# 1. Clone / extract the project
cd agrichain

# 2. Start everything
docker-compose up --build

# 3. Open browser
# Frontend: http://localhost:3000
# Backend:  http://localhost:5000/health
```

> **Demo Mode**: Works out-of-the-box with an in-memory store. No blockchain setup needed for the demo!

### 🎯 Judge-Focused Documentation

For detailed architecture, on-chain/off-chain boundaries, API inventory, setup flows, and judge Q&A:

- `HACKATHON_JUDGE_GUIDE.md`

---

## 📁 Project Structure

```
agrichain/
├── frontend/                  # React app (port 3000)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DashboardPage.js    # Overview + charts
│   │   │   ├── FarmerPage.js       # Register produce
│   │   │   ├── DistributorPage.js  # Update shipment
│   │   │   ├── RetailerPage.js     # Set retail price
│   │   │   ├── ConsumerPage.js     # QR generation
│   │   │   └── ScanPage.js         # Product journey view
│   │   ├── utils/api.js            # Axios API calls
│   │   ├── App.js                  # Router + Nav
│   │   └── App.css                 # Styling
│   ├── Dockerfile
│   └── package.json
│
├── backend/                   # Node.js + Express (port 5000)
│   ├── routes/batches.js      # All API endpoints
│   ├── utils/
│   │   ├── blockchain.js      # Ethers.js + demo fallback
│   │   └── contractABI.js     # Smart contract ABI
│   ├── server.js              # Express entry point
│   ├── .env                   # Environment config
│   └── Dockerfile
│
├── smart-contract/            # Solidity (Polygon testnet)
│   ├── contracts/AgriChain.sol
│   ├── scripts/deploy.js
│   └── hardhat.config.js
│
└── docker-compose.yml
```

---

## 🔗 Smart Contract Deployment (Polygon Amoy Testnet)

### Step 1: Get testnet MATIC
- Visit: https://faucet.polygon.technology
- Select **Amoy** testnet
- Enter your wallet address and get free test MATIC

### Step 2: Set up environment
```bash
cd smart-contract
npm install

# Create .env in smart-contract/
echo "PRIVATE_KEY=your_wallet_private_key_here" > .env
echo "POLYGON_RPC_URL=https://rpc-amoy.polygon.technology" >> .env
```

### Step 3: Deploy
```bash
npx hardhat run scripts/deploy.js --network polygonAmoy
```

Note: after pulling latest code, redeploy the contract to include `confirmSale` (final consumer stage).

Output:
```
✅ AgriChain deployed to: 0xYourContractAddress...

📋 Add this to your backend .env:
CONTRACT_ADDRESS=0xYourContractAddress
```

### Step 4: Connect backend to blockchain
Edit `backend/.env`:
```env
CONTRACT_ADDRESS=0xYourContractAddress
OWNER_PRIVATE_KEY=owner_private_key_here
FARMER_PRIVATE_KEY=farmer_private_key_here
DISTRIBUTOR_PRIVATE_KEY=distributor_private_key_here
RETAILER_PRIVATE_KEY=retailer_private_key_here
CONSUMER_PRIVATE_KEY=consumer_private_key_here
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
REQUIRE_BLOCKCHAIN=true
```

Then restart Docker:
```bash
docker-compose down && docker-compose up --build
```

### Step 5: Verify Strict Blockchain Mode (no demo fallback)
```bash
curl http://localhost:5000/api/system/mode
```

Expected:
- `mode = "blockchain"`
- `writeReady = true`
- all `roleAddresses` populated

If chain config is broken and `REQUIRE_BLOCKCHAIN=true`, backend will fail fast on startup (intentional).

---

## 🎭 Demo Walkthrough

### 1. Register Produce (Farmer)
- Go to **http://localhost:3000/farmer**
- Click "📦 Alphonso Mango" sample to auto-fill
- Click **Register Batch on Blockchain**
- Note the batch ID (e.g., #1)

### 2. Update Shipment (Distributor)
- Go to **http://localhost:3000/distributor**
- Select batch #1 from the dropdown
- Click "📍 Mumbai Cold Storage" to auto-fill
- Click **Update Shipment on Blockchain**

### 3. Set Retail Price (Retailer)
- Go to **http://localhost:3000/retailer**
- Select batch #1
- Enter a price (try ₹90 for normal, ₹999 to trigger fraud alert)
- Click **Set Price on Blockchain**

### 4. Trigger Fraud Detection
- **Duplicate entry**: In Farmer page, register same product with same farmer + quantity again → ⚠️ Flagged
- **Price spike**: In Retailer page, set price >5x farmer price → ⚠️ Flagged  
- **Missing steps**: Set retail price without distributor step → ⚠️ Flagged

### 5. Consumer View
- Go to **http://localhost:3000/consumer**
- Select any batch → **Generate QR Code**
- Click **View Journey** to see the full timeline
- Scan QR with phone → opens `http://localhost:3000/scan/1`

### 6. Dashboard
- Go to **http://localhost:3000**
- See all batches, fraud alerts, price comparison chart
- Flagged batches shown with ⚠️ and red border

---

## 🛡️ Fraud Detection Rules

| Rule | Trigger | Effect |
|------|---------|--------|
| Duplicate Entry | Same product + farmer + qty hash | Batch flagged, trust -50 |
| Price Spike | Retail > 500% of farmer price | Batch flagged, trust -30 |
| Missing Steps | Retail set without distributor | Batch flagged, trust -20 |
| Invalid Role Order | Wrong actor sequence | Rejected at contract level |

---

## 🌐 API Endpoints

```
GET    /health                         Health check
GET    /api/batches                    List all batches
POST   /api/batches                    Create batch (Farmer)
GET    /api/batches/:id                Get batch + journey + fraud analysis
PUT    /api/batches/:id/shipment       Update shipment (Distributor)
PUT    /api/batches/:id/retail-price   Update retail price (Retailer)
PUT    /api/batches/:id/confirm-sale   Confirm final consumer purchase (Consumer)
GET    /api/batches/:id/qr             Generate QR code
GET    /api/batches/fraud/alerts       All fraud alerts
GET    /api/realtime/ticker            Live commodity benchmark ticker
GET    /api/realtime/overview          Live benchmark + weather + FX snapshot
GET    /api/realtime/batch/:id         Live realtime snapshot for a batch
GET    /api/system/mode                Runtime mode + blockchain signer info
GET    /api/system/metrics             System KPIs for demo/pitch
```

---

## 🚚 Logistics Provider Setup (AfterShip)

To enable **real-time shipment tracking** (status + checkpoints), configure AfterShip API in backend.

### 1. Get an AfterShip API key
- Create a free AfterShip account and generate an API key.
- Add this to backend environment:

```env
AFTERSHIP_API_KEY=your_aftership_api_key_here
```

If using Docker Compose, add it under `backend.environment` in `docker-compose.yml`, then restart:

```bash
docker-compose down && docker-compose up --build
```

### 2. Use valid carrier slug + tracking number
When updating shipment (Distributor), provide:
- `carrier` (AfterShip slug)
- `trackingNumber`

Common carrier slug examples:
- `dhl`
- `fedex`
- `ups`
- `usps`
- `delhivery`
- `bluedart`
- `xpressbees`
- `dtdc`
- `india-post`
- `ekart`

### 3. Test workflow (UI)
1. Create a batch from Farmer page.
2. Open Distributor page.
3. Select the batch and fill:
   - `Current Location`
   - `Carrier Slug` (e.g. `dhl`)
   - `Tracking Number`
4. Submit **Update Shipment on Blockchain**.
5. Open Scan page for that batch and check the **Live Tracking** block.

### 4. Test workflow (API)

```bash
# Update shipment with tracking details
curl -X PUT http://localhost:5000/api/batches/1/shipment \
  -H "Content-Type: application/json" \
  -d '{"location":"Cold Storage Facility, Pune","notes":"Realtime logistics test","carrier":"dhl","trackingNumber":"1234567890"}'

# Fetch live realtime snapshot (includes logistics.tracking)
curl http://localhost:5000/api/realtime/batch/1
```

If tracking is configured but key is missing, response will show:
- `logistics.tracking.status = "API Key Missing"`

---

## 🧪 Test Data (curl examples)

```bash
# Create batch
curl -X POST http://localhost:5000/api/batches \
  -H "Content-Type: application/json" \
  -d '{"productName":"Alphonso Mango","farmerName":"Ramesh Kumar","location":"Ratnagiri","quantity":500,"farmerPrice":45}'

# Update shipment (use batchId from above)
curl -X PUT http://localhost:5000/api/batches/1/shipment \
  -H "Content-Type: application/json" \
  -d '{"location":"Mumbai Cold Storage","notes":"Temp maintained at 4C"}'

# Set retail price
curl -X PUT http://localhost:5000/api/batches/1/retail-price \
  -H "Content-Type: application/json" \
  -d '{"newPrice":120,"notes":"Premium grade"}'

# Confirm final consumer purchase
curl -X PUT http://localhost:5000/api/batches/1/confirm-sale \
  -H "Content-Type: application/json" \
  -d '{"location":"Consumer Purchase Point","notes":"Delivered and accepted"}'

# Trigger fraud - extreme price spike
curl -X PUT http://localhost:5000/api/batches/1/retail-price \
  -H "Content-Type: application/json" \
  -d '{"newPrice":9999,"notes":"Suspicious"}'

# View full journey
curl http://localhost:5000/api/batches/1
```

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + React Router + Recharts |
| Backend | Node.js + Express |
| Blockchain | Solidity 0.8.19 + Hardhat |
| Network | Polygon Amoy Testnet |
| QR Code | node-qrcode |
| Blockchain SDK | ethers.js v6 |
| Containerization | Docker + docker-compose |

---

## 🏆 Key Features

- ✅ **4-role system**: Farmer, Distributor, Retailer, Consumer
- ✅ **Immutable blockchain records** on Polygon testnet
- ✅ **Complete lifecycle**: Harvested → Transit/Warehouse → Retail → Sold
- ✅ **QR code generation** per batch linking to journey page
- ✅ **3-layer fraud detection**: duplicates, price spikes, missing steps
- ✅ **Price transparency dashboard** with farm vs retail comparison
- ✅ **Trust score** (0-100) calculated from fraud signals
- ✅ **Strict blockchain mode** (`REQUIRE_BLOCKCHAIN=true`) to block demo fallback in final demos
- ✅ **Price history chart** using Recharts
- ✅ **Full Docker containerization** with hot-reload
- ✅ **Demo mode** — works without blockchain for rapid prototyping

---

*Built for hackathon — prioritizes working demo over perfection.*
# AgriChain
# AgriChain
# AgriChain
# AgriChain
# AgriChain
# AgriChain
# AgriChain
