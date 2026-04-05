const express = require("express");
const router = express.Router();
const QRCode = require("qrcode");
const bc = require("../utils/blockchain");

// POST /api/batches - Farmer creates a batch
router.post("/", async (req, res) => {
  try {
    const { productName, farmerName, location, quantity, farmerPrice, harvestDate, actorAddress } = req.body;
    if (!productName || !farmerName || !location || !quantity || !farmerPrice) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const batchId = await bc.createBatch({
      productName, farmerName, location,
      quantity: parseInt(quantity),
      farmerPrice: parseInt(farmerPrice),
      harvestDate: harvestDate ? Math.floor(new Date(harvestDate).getTime() / 1000) : Math.floor(Date.now() / 1000),
      actorAddress
    });
    res.json({ success: true, batchId, message: `Batch #${batchId} created on blockchain` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/batches - List all batches
router.get("/", async (req, res) => {
  try {
    const batches = await bc.getAllBatches();
    res.json({ batches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/batches/fraud/alerts - All fraud alerts
router.get("/fraud/alerts", async (req, res) => {
  try {
    const batches = await bc.getAllBatches();
    const alerts = batches
      .filter(b => b.isFlagged)
      .map(b => ({ batchId: b.id, productName: b.productName, reason: b.flagReason, trustScore: b.trustScore }));
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/batches/:id - Get single batch with full journey
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [batch, steps, priceHistory] = await Promise.all([
      bc.getBatch(id),
      bc.getSupplyChainSteps(id),
      bc.getPriceHistory(id)
    ]);

    // Fraud analysis
    const fraudFlags = [];
    if (batch.isFlagged) {
      batch.flagReason.split(" | ").filter(Boolean).forEach(r => fraudFlags.push(r));
    }

    // Check missing steps
    const stageIndices = steps.map(s => s.stageIndex !== undefined ? s.stageIndex : 
      ["Harvested","In Transit","At Warehouse","At Retail","Sold"].indexOf(s.stage));
    const hasDistributor = stageIndices.some(i => i >= 1);
    const hasRetail = stageIndices.some(i => i >= 3);
    if (hasRetail && !hasDistributor) fraudFlags.push("Retail price set without distributor step");

    // Price spike check
    if (priceHistory.length >= 2) {
      const first = priceHistory[0].price;
      const last = priceHistory[priceHistory.length - 1].price;
      if (last > first * 5) fraudFlags.push("Extreme price markup (>500% from farm price)");
    }

    // Trust score
    const trustScore = batch.trustScore;
    const trustLabel = trustScore >= 80 ? "High" : trustScore >= 50 ? "Medium" : "Low";

    // Profit margin
    const farmerPrice = batch.farmerPrice;
    const retailPrice = batch.currentPrice;
    const margin = farmerPrice > 0 ? (((retailPrice - farmerPrice) / farmerPrice) * 100).toFixed(1) : 0;

    res.json({
      batch,
      steps,
      priceHistory,
      fraudFlags,
      trustScore,
      trustLabel,
      margin,
      isDemo: bc.isDemo()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/batches/:id/shipment - Distributor updates
router.put("/:id/shipment", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { location, notes, actorAddress, carrier, trackingNumber } = req.body;
    if (!location) return res.status(400).json({ error: "Location is required" });
    await bc.updateShipment({
      batchId: id,
      location,
      notes: notes || "",
      actorAddress,
      carrier: carrier || "",
      trackingNumber: trackingNumber || ""
    });
    res.json({ success: true, message: "Shipment updated on blockchain" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/batches/:id/retail-price - Retailer updates price
router.put("/:id/retail-price", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { newPrice, notes, actorAddress } = req.body;
    if (!newPrice) return res.status(400).json({ error: "New price is required" });
    await bc.updateRetailPrice({ batchId: id, newPrice: parseInt(newPrice), notes: notes || "", actorAddress });
    const batch = await bc.getBatch(id);
    res.json({ success: true, message: "Retail price updated", isFlagged: batch.isFlagged, flagReason: batch.flagReason });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/batches/:id/confirm-sale - Consumer confirms purchase
router.put("/:id/confirm-sale", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { location, notes, actorAddress } = req.body;
    await bc.confirmSale({
      batchId: id,
      location: location || "Consumer Purchase Point",
      notes: notes || "Consumer confirmed purchase",
      actorAddress
    });
    res.json({ success: true, message: "Consumer purchase confirmed on blockchain" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/batches/:id/qr - Generate QR code
router.get("/:id/qr", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const url = `${frontendUrl}/scan/${id}`;
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: { dark: "#1a472a", light: "#ffffff" }
    });
    res.json({ qrCode: qrDataUrl, url, batchId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
