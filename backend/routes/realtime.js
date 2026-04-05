const express = require("express");
const router = express.Router();
const realtime = require("../utils/realtime");

router.get("/overview", async (req, res) => {
  try {
    const { productName = "", originLocation = "", currentLocation = "" } = req.query;
    const data = await realtime.getRealtimeOverview({ productName, originLocation, currentLocation });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch realtime overview" });
  }
});

router.get("/batch/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = await realtime.getRealtimeForBatch(id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch realtime batch data" });
  }
});

router.get("/ticker", async (req, res) => {
  try {
    const data = await realtime.getTicker();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch realtime ticker" });
  }
});

module.exports = router;
