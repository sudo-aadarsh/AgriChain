require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { initBlockchain } = require("./utils/blockchain");

const app = express();
const PORT = process.env.PORT || 5000;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
const allowedOrigins = new Set([
  frontendUrl,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://backend:5000"
]);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser clients and same-origin requests without Origin header.
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    // In local/demo mode, avoid turning CORS mismatches into 500s.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`⚠️ Allowing unexpected origin in non-production: ${origin}`);
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api/batches", require("./routes/batches"));
app.use("/api/realtime", require("./routes/realtime"));
app.use("/api/system", require("./routes/system"));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

async function start() {
  await initBlockchain();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 AgriChain Backend running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
  });
}

start();
