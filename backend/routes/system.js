const express = require("express");
const router = express.Router();
const bc = require("../utils/blockchain");

router.get("/mode", async (req, res) => {
  try {
    const mode = bc.getRuntimeMode ? bc.getRuntimeMode() : { mode: bc.isDemo() ? "demo" : "blockchain" };
    res.json({ success: true, mode });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to get runtime mode" });
  }
});

router.get("/metrics", async (req, res) => {
  try {
    const batches = await bc.getAllBatches();
    const stepLists = await Promise.all(
      batches.map((b) => bc.getSupplyChainSteps(Number(b.id)).catch(() => []))
    );
    const soldBatches = stepLists.filter((steps) =>
      (steps || []).some((s) => Number(s.stageIndex) === 4 || String(s.stage).toLowerCase() === "sold")
    ).length;
    const flagged = batches.filter((b) => b.isFlagged);
    const trustAvg = batches.length
      ? Number((batches.reduce((sum, b) => sum + Number(b.trustScore || 0), 0) / batches.length).toFixed(2))
      : 0;
    const marginAvg = batches.length
      ? Number((
          batches.reduce((sum, b) => {
            const fp = Number(b.farmerPrice || 0);
            const cp = Number(b.currentPrice || 0);
            return sum + (fp > 0 ? ((cp - fp) / fp) * 100 : 0);
          }, 0) / batches.length
        ).toFixed(2))
      : 0;

    res.json({
      success: true,
      metrics: {
        totalBatches: batches.length,
        soldBatches,
        completionRatePercent: batches.length ? Number(((soldBatches / batches.length) * 100).toFixed(2)) : 0,
        flaggedBatches: flagged.length,
        cleanBatches: Math.max(0, batches.length - flagged.length),
        averageTrustScore: trustAvg,
        averageMarginPercent: marginAvg,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to get metrics" });
  }
});

module.exports = router;
