const { ethers } = require("ethers");
const CONTRACT_ABI = require("./contractABI");

let provider;
let roleSigners = { owner: null, farmer: null, distributor: null, retailer: null, consumer: null };
let roleContracts = { owner: null, farmer: null, distributor: null, retailer: null, consumer: null };
let contractRead = null;
let runtimeMode = "demo";
let runtimeReason = "not_initialized";

const STAGE_NAMES = ["Harvested", "In Transit", "At Warehouse", "At Retail", "Sold"];
const ROLE_NAMES = ["None", "Farmer", "Distributor", "Retailer", "Consumer"];

// In-memory store for demo mode (when no contract deployed)
const demoStore = {
  batches: {},
  count: 0,
  fraudAlerts: []
};

// Off-chain logistics metadata, used for both demo and on-chain modes.
const logisticsStore = {};

function isBlockchainRequired() {
  return String(process.env.REQUIRE_BLOCKCHAIN || "false").toLowerCase() === "true";
}

function isConfiguredForDemo() {
  const addr = process.env.CONTRACT_ADDRESS;
  return !addr || addr === "0x0000000000000000000000000000000000000000";
}

function isDemo() {
  return runtimeMode !== "blockchain";
}

function getConfiguredPrivateKey(name, fallback) {
  const val = process.env[name] || fallback;
  return val && !String(val).startsWith("demo_") && String(val).length > 20 ? val : null;
}

function seedDemoData() {
  if (demoStore.count > 0) return;

  const targetCount = Math.max(300, Number(process.env.DEMO_SEED_COUNT || 600));
  const productBases = [
    "Alphonso Mango", "Basmati Rice", "Organic Tomatoes", "Green Chilli", "Baby Potato",
    "Onion", "Garlic", "Cauliflower", "Cabbage", "Spinach", "Apple", "Banana",
    "Pomegranate", "Guava", "Papaya", "Groundnut", "Mustard Seeds", "Turmeric",
    "Ginger", "Coriander", "Moong Dal", "Chana Dal", "Toor Dal", "Wheat Grain",
    "Maize", "Brinjal", "Cucumber", "Bottle Gourd", "Pumpkin", "Okra",
    "Pearl Millet", "Jowar", "Ragi", "Black Gram", "Green Peas", "Soybean",
    "Sesame", "Sunflower Seeds", "Sugarcane", "Cotton", "Tea Leaves", "Coffee Cherry",
    "Cardamom", "Black Pepper", "Red Lentil", "Kidney Beans", "Yam", "Sweet Potato"
  ];
  const grades = ["Premium", "A-Grade", "Standard", "Fresh", "Organic", "Select"];
  const products = productBases.flatMap((p) => grades.map((g) => `${g} ${p}`));

  const firstNames = [
    "Ramesh", "Suresh", "Lakshmi", "Anita", "Amit", "Pooja", "Sunita", "Deepak",
    "Harish", "Prakash", "Vikram", "Sanjay", "Kiran", "Bhavna", "Rahul", "Nitin",
    "Ravindra", "Mahesh", "Naveen", "Seema", "Arjun", "Meena", "Ritu", "Nidhi",
    "Saket", "Vinod", "Gopal", "Naresh", "Kabir", "Rohan", "Madhav", "Tanvi",
    "Ritika", "Asha", "Neelam", "Yogesh", "Devika", "Imran", "Farhan", "Priya"
  ];
  const lastNames = [
    "Kumar", "Patel", "Devi", "Yadav", "Sharma", "Verma", "Rao", "Singh", "Joshi",
    "Nair", "Mehta", "Gupta", "Reddy", "Shah", "Das", "Iyer", "Pawar", "Kulkarni",
    "Rathi", "Tiwari", "Bose", "Chowdhury", "Naidu", "Shetty", "Pillai", "Mishra",
    "Pandey", "Solanki", "Jadhav", "Rana"
  ];
  const farmers = [];
  for (let i = 0; i < firstNames.length; i++) {
    for (let j = 0; j < lastNames.length; j += 3) {
      farmers.push(`${firstNames[i]} ${lastNames[(i + j) % lastNames.length]}`);
      if (farmers.length >= 160) break;
    }
    if (farmers.length >= 160) break;
  }

  const cities = [
    "Ratnagiri", "Nashik", "Dehradun", "Mysuru", "Indore", "Bhopal", "Ludhiana",
    "Jalgaon", "Nagpur", "Kurnool", "Warangal", "Kota", "Jaipur", "Varanasi",
    "Prayagraj", "Madurai", "Coimbatore", "Raipur", "Patna", "Siliguri", "Amritsar",
    "Ujjain", "Gwalior", "Hubballi", "Belagavi", "Jodhpur", "Udaipur", "Ahmednagar",
    "Surat", "Vadodara", "Kolhapur", "Akola", "Nanded", "Tirunelveli", "Salem",
    "Guntur", "Vijayawada", "Bikaner", "Alwar", "Gorakhpur"
  ];
  const states = [
    "Maharashtra", "Uttarakhand", "Karnataka", "Madhya Pradesh", "Punjab",
    "Andhra Pradesh", "Telangana", "Rajasthan", "Uttar Pradesh", "Tamil Nadu",
    "Chhattisgarh", "Bihar", "West Bengal", "Gujarat", "Haryana"
  ];
  const farmLocations = [];
  for (let i = 0; i < cities.length; i++) {
    const state = states[i % states.length];
    farmLocations.push(`${cities[i]}, ${state}`);
  }

  const transitCities = [
    "Mumbai", "Pune", "Delhi", "Ahmedabad", "Hyderabad", "Bengaluru", "Lucknow", "Jaipur",
    "Chandigarh", "Kolkata", "Noida", "Gurugram", "Nagpur", "Indore", "Patna", "Bhopal",
    "Surat", "Kanpur", "Agra", "Visakhapatnam"
  ];
  const transitKinds = [
    "APMC Warehouse", "Cold Storage Facility", "Distribution Hub", "Transit Yard",
    "Agri Logistics Park", "Wholesale Mandi", "Retail Prep Unit", "Consolidation Center"
  ];
  const transitLocations = [];
  for (let i = 0; i < transitCities.length; i++) {
    transitLocations.push(`${transitKinds[i % transitKinds.length]}, ${transitCities[i]}`);
  }
  const retailNotes = [
    "Premium grade", "Sorted and cleaned", "Export quality lot", "Organic certified",
    "Retail packaging completed", "Temperature-controlled chain maintained", "Top shelf batch",
    "Demand surge in city markets", "Limited supply window", "Festival season premium"
  ];

  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < targetCount; i++) {
    const productName = `${products[i % products.length]} ${Math.floor(i / products.length) + 1}`;
    const farmerName = farmers[(i * 3) % farmers.length];
    const location = farmLocations[(i * 7) % farmLocations.length];
    const quantity = 120 + (i % 15) * 35;
    const farmerPrice = 12 + (i % 18) * 4;
    const harvestDate = now - (i % 60) * 86400;

    const batchId = demoCreateBatch({
      productName,
      farmerName,
      location,
      quantity,
      farmerPrice,
      harvestDate,
      actorAddress: `0xFarmerDemo${String((i % 10) + 1).padStart(2, "0")}`
    });

    const batch = demoStore.batches[batchId];
    const createdAt = now - (targetCount - i) * 4200;
    batch.createdAt = createdAt;
    batch.harvestDate = harvestDate;
    batch.steps[0].timestamp = createdAt;
    batch.priceHistory[0].timestamp = createdAt;

    const skipDistributor = i % 19 === 0;
    if (!skipDistributor) {
      demoUpdateShipment({
        batchId,
        location: transitLocations[(i * 7) % transitLocations.length],
        notes: "Shipment scanned and moved to next stage",
        actorAddress: `0xDistributorDemo${String((i % 8) + 1).padStart(2, "0")}`
      });
      batch.steps[batch.steps.length - 1].timestamp = createdAt + 7200;
    }

    const priceMultiplier = i % 31 === 0 ? 6.2 : 1.3 + ((i % 7) * 0.22);
    demoUpdateRetailPrice({
      batchId,
      newPrice: Math.round(farmerPrice * priceMultiplier),
      notes: retailNotes[(i * 11) % retailNotes.length],
      actorAddress: `0xRetailerDemo${String((i % 9) + 1).padStart(2, "0")}`
    });
    batch.steps[batch.steps.length - 1].timestamp = createdAt + 14400;
    batch.priceHistory[batch.priceHistory.length - 1].timestamp = createdAt + 14400;

    if (i % 5 === 0) {
      demoConfirmSale({
        batchId,
        location: `Consumer Delivery Point ${((i % 12) + 1)}`,
        notes: "Consumer received and verified batch",
        actorAddress: `0xConsumerDemo${String((i % 11) + 1).padStart(2, "0")}`
      });
      batch.steps[batch.steps.length - 1].timestamp = createdAt + 21600;
    }
  }

  console.log(`🌱 Seeded demo data with ${demoStore.count} product batches.`);
}

async function ensureOnChainRoles() {
  const ownerContract = roleContracts.owner;
  if (!ownerContract || !roleSigners.owner) return;

  const wanted = [
    { signer: roleSigners.farmer, role: 1, label: "Farmer" },
    { signer: roleSigners.distributor, role: 2, label: "Distributor" },
    { signer: roleSigners.retailer, role: 3, label: "Retailer" },
    { signer: roleSigners.consumer, role: 4, label: "Consumer" },
  ];

  for (const w of wanted) {
    const current = Number(await ownerContract.getUserRole(w.signer.address));
    if (current !== w.role) {
      const tx = await ownerContract.assignRole(w.signer.address, w.role);
      await tx.wait();
      console.log(`🔐 Assigned on-chain role ${w.label} to ${w.signer.address}`);
    }
  }
}

async function initBlockchain() {
  if (isConfiguredForDemo()) {
    if (isBlockchainRequired()) {
      throw new Error("REQUIRE_BLOCKCHAIN=true but CONTRACT_ADDRESS is not configured.");
    }
    runtimeMode = "demo";
    runtimeReason = "contract_not_configured";
    console.log("⚠️  Running in DEMO MODE (no contract deployed). Using in-memory store.");
    seedDemoData();
    return;
  }

  try {
    provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);

    const ownerPk = getConfiguredPrivateKey("OWNER_PRIVATE_KEY", process.env.PRIVATE_KEY);
    const farmerPk = getConfiguredPrivateKey("FARMER_PRIVATE_KEY", ownerPk);
    const distributorPk = getConfiguredPrivateKey("DISTRIBUTOR_PRIVATE_KEY", ownerPk);
    const retailerPk = getConfiguredPrivateKey("RETAILER_PRIVATE_KEY", ownerPk);
    const consumerPk = getConfiguredPrivateKey("CONSUMER_PRIVATE_KEY", ownerPk);

    if (!ownerPk || !farmerPk || !distributorPk || !retailerPk || !consumerPk) {
      throw new Error("Missing blockchain private keys. Configure OWNER/FARMER/DISTRIBUTOR/RETAILER/CONSUMER private keys.");
    }

    roleSigners = {
      owner: new ethers.Wallet(ownerPk, provider),
      farmer: new ethers.Wallet(farmerPk, provider),
      distributor: new ethers.Wallet(distributorPk, provider),
      retailer: new ethers.Wallet(retailerPk, provider),
      consumer: new ethers.Wallet(consumerPk, provider),
    };

    roleContracts = {
      owner: new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, roleSigners.owner),
      farmer: new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, roleSigners.farmer),
      distributor: new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, roleSigners.distributor),
      retailer: new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, roleSigners.retailer),
      consumer: new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, roleSigners.consumer),
    };
    contractRead = roleContracts.owner;

    const network = await provider.getNetwork();
    console.log(`✅ Connected to blockchain: chainId=${network.chainId}`);
    console.log("👤 Role wallets:");
    console.log(`  owner       ${roleSigners.owner.address}`);
    console.log(`  farmer      ${roleSigners.farmer.address}`);
    console.log(`  distributor ${roleSigners.distributor.address}`);
    console.log(`  retailer    ${roleSigners.retailer.address}`);
    console.log(`  consumer    ${roleSigners.consumer.address}`);

    const code = await provider.getCode(process.env.CONTRACT_ADDRESS);
    if (!code || code === "0x") {
      throw new Error(`No contract bytecode found at ${process.env.CONTRACT_ADDRESS} on configured RPC network.`);
    }

    await ensureOnChainRoles();
    runtimeMode = "blockchain";
    runtimeReason = "connected";
  } catch (err) {
    if (isBlockchainRequired()) {
      throw err;
    }
    console.error("Blockchain connection failed, falling back to demo mode:", err.message);
    provider = null;
    roleSigners = { owner: null, farmer: null, distributor: null, retailer: null, consumer: null };
    roleContracts = { owner: null, farmer: null, distributor: null, retailer: null, consumer: null };
    contractRead = null;
    runtimeMode = "demo";
    runtimeReason = `fallback_after_error:${err.message}`;
    seedDemoData();
  }
}

function formatBatch(raw) {
  return {
    id: Number(raw.id),
    productName: raw.productName,
    farmerName: raw.farmerName,
    originLocation: raw.originLocation,
    quantity: Number(raw.quantity),
    farmerPrice: Number(raw.farmerPrice),
    currentPrice: Number(raw.currentPrice),
    harvestDate: Number(raw.harvestDate),
    createdAt: Number(raw.createdAt),
    isFlagged: raw.isFlagged,
    flagReason: raw.flagReason,
    trustScore: Number(raw.trustScore)
  };
}

function formatStep(step) {
  return {
    stage: STAGE_NAMES[Number(step.stage)],
    stageIndex: Number(step.stage),
    actor: step.actor,
    location: step.location,
    timestamp: Number(step.timestamp),
    notes: step.notes
  };
}

function formatPriceHistory(ph) {
  return {
    price: Number(ph.price),
    updatedBy: ph.updatedBy,
    timestamp: Number(ph.timestamp),
    note: ph.note
  };
}

function demoCreateBatch({ productName, farmerName, location, quantity, farmerPrice, harvestDate, actorAddress }) {
  demoStore.count++;
  const id = demoStore.count;
  const now = Math.floor(Date.now() / 1000);

  const existing = Object.values(demoStore.batches).find(
    b => b.productName === productName && b.farmerName === farmerName && b.quantity === Number(quantity)
  );
  const isDuplicate = !!existing;
  if (isDuplicate) demoStore.fraudAlerts.push({ batchId: id, reason: "Duplicate product entry detected" });

  demoStore.batches[id] = {
    id, productName, farmerName, originLocation: location,
    quantity: Number(quantity), farmerPrice: Number(farmerPrice),
    currentPrice: Number(farmerPrice), harvestDate: Number(harvestDate),
    createdAt: now, isFlagged: isDuplicate,
    flagReason: isDuplicate ? "Potential duplicate entry detected" : "",
    trustScore: isDuplicate ? 50 : 100,
    logistics: null,
    steps: [{
      stage: "Harvested", stageIndex: 0, actor: actorAddress || "0xFarmer",
      location, timestamp: now, notes: `Harvested by ${farmerName}`
    }],
    priceHistory: [{
      price: Number(farmerPrice), updatedBy: actorAddress || "0xFarmer",
      timestamp: now, note: "Initial farmer price"
    }]
  };
  return id;
}

function demoUpdateShipment({ batchId, location, notes, actorAddress, carrier, trackingNumber }) {
  const batch = demoStore.batches[batchId];
  if (!batch) throw new Error("Batch not found");
  const now = Math.floor(Date.now() / 1000);
  const lastStage = batch.steps[batch.steps.length - 1].stageIndex;
  const newStageIndex = lastStage === 0 ? 1 : 2;
  batch.steps.push({
    stage: STAGE_NAMES[newStageIndex], stageIndex: newStageIndex,
    actor: actorAddress || "0xDistributor", location, timestamp: now, notes
  });
  if (carrier && trackingNumber) {
    const metadata = {
      provider: "aftership",
      carrier: String(carrier).trim(),
      trackingNumber: String(trackingNumber).trim(),
      updatedAt: now
    };
    batch.logistics = metadata;
    logisticsStore[batchId] = metadata;
  }
}

function demoUpdateRetailPrice({ batchId, newPrice, notes, actorAddress }) {
  const batch = demoStore.batches[batchId];
  if (!batch) throw new Error("Batch not found");
  const now = Math.floor(Date.now() / 1000);
  const oldPrice = batch.currentPrice;

  if (newPrice > oldPrice * 5) {
    batch.isFlagged = true;
    batch.flagReason = (batch.flagReason ? batch.flagReason + " | " : "") + "Abnormal price spike (>500%)";
    batch.trustScore = Math.max(0, batch.trustScore - 30);
    demoStore.fraudAlerts.push({ batchId, reason: "Abnormal price spike" });
  }

  const hasDistributor = batch.steps.some(s => s.stageIndex >= 1);
  if (!hasDistributor) {
    batch.isFlagged = true;
    batch.flagReason = (batch.flagReason ? batch.flagReason + " | " : "") + "Missing distributor step";
    batch.trustScore = Math.max(0, batch.trustScore - 20);
    demoStore.fraudAlerts.push({ batchId, reason: "Missing supply chain steps" });
  }

  batch.currentPrice = Number(newPrice);
  batch.steps.push({
    stage: "At Retail", stageIndex: 3,
    actor: actorAddress || "0xRetailer", location: "Retail Store", timestamp: now, notes
  });
  batch.priceHistory.push({ price: Number(newPrice), updatedBy: actorAddress || "0xRetailer", timestamp: now, note: notes });
}

function demoConfirmSale({ batchId, location, notes, actorAddress }) {
  const batch = demoStore.batches[batchId];
  if (!batch) throw new Error("Batch not found");
  const now = Math.floor(Date.now() / 1000);
  const hasRetail = batch.steps.some((s) => s.stageIndex >= 3);
  if (!hasRetail) {
    throw new Error("Cannot mark sold before retail stage");
  }
  const alreadySold = batch.steps.some((s) => s.stageIndex === 4);
  if (alreadySold) return;
  batch.steps.push({
    stage: "Sold",
    stageIndex: 4,
    actor: actorAddress || "0xConsumer",
    location: location || "Consumer Purchase Point",
    timestamp: now,
    notes: notes || "Consumer confirmed purchase",
  });
}

async function createBatch(data) {
  if (isDemo() || !roleContracts.farmer) return demoCreateBatch(data);
  const tx = await roleContracts.farmer.createBatch(
    data.productName, data.farmerName, data.location,
    data.quantity, data.farmerPrice, data.harvestDate
  );
  const receipt = await tx.wait();
  const event = receipt.logs
    .map((l) => {
      try { return roleContracts.farmer.interface.parseLog(l); } catch { return null; }
    })
    .find((e) => e && e.name === "BatchCreated");
  return event ? Number(event.args.batchId) : Number(await contractRead.batchCount());
}

async function updateShipment(data) {
  if (isDemo() || !roleContracts.distributor) return demoUpdateShipment(data);
  const tx = await roleContracts.distributor.updateShipment(data.batchId, data.location, data.notes);
  await tx.wait();
  if (data.carrier && data.trackingNumber) {
    logisticsStore[data.batchId] = {
      provider: "aftership",
      carrier: String(data.carrier).trim(),
      trackingNumber: String(data.trackingNumber).trim(),
      updatedAt: Math.floor(Date.now() / 1000)
    };
  }
}

async function updateRetailPrice(data) {
  if (isDemo() || !roleContracts.retailer) return demoUpdateRetailPrice(data);
  const tx = await roleContracts.retailer.updateRetailPrice(data.batchId, data.newPrice, data.notes);
  await tx.wait();
}

async function confirmSale(data) {
  if (isDemo() || !roleContracts.consumer) return demoConfirmSale(data);
  const tx = await roleContracts.consumer.confirmSale(data.batchId, data.location || "", data.notes || "");
  await tx.wait();
}

async function getBatch(batchId) {
  if (isDemo() || !contractRead) {
    const b = demoStore.batches[batchId];
    if (!b) throw new Error("Batch not found");
    return b;
  }
  const raw = await contractRead.getBatch(batchId);
  return formatBatch(raw);
}

async function getSupplyChainSteps(batchId) {
  if (isDemo() || !contractRead) {
    return demoStore.batches[batchId]?.steps || [];
  }
  const steps = await contractRead.getSupplyChainSteps(batchId);
  return steps.map(formatStep);
}

async function getPriceHistory(batchId) {
  if (isDemo() || !contractRead) {
    return demoStore.batches[batchId]?.priceHistory || [];
  }
  const history = await contractRead.getPriceHistory(batchId);
  return history.map(formatPriceHistory);
}

async function getAllBatches() {
  if (isDemo() || !contractRead) {
    return Object.values(demoStore.batches);
  }
  const count = Number(await contractRead.batchCount());
  const batches = [];
  for (let i = 1; i <= count; i++) {
    try {
      const b = await contractRead.getBatch(i);
      if (b.exists) batches.push(formatBatch(b));
    } catch {}
  }
  return batches;
}

function getFraudAlerts() {
  return demoStore.fraudAlerts;
}

function getLogisticsForBatch(batchId) {
  if (isDemo()) {
    return demoStore.batches[batchId]?.logistics || null;
  }
  return logisticsStore[batchId] || null;
}

function getRuntimeMode() {
  const writeReady = runtimeMode === "blockchain"
    && !!roleContracts.farmer
    && !!roleContracts.distributor
    && !!roleContracts.retailer
    && !!roleContracts.consumer;
  return {
    mode: runtimeMode,
    reason: runtimeReason,
    writeReady,
    configuredForDemo: isConfiguredForDemo(),
    blockchainRequired: isBlockchainRequired(),
    contractAddress: process.env.CONTRACT_ADDRESS || null,
    rpcUrl: process.env.POLYGON_RPC_URL || null,
    roleAddresses: {
      owner: roleSigners.owner?.address || null,
      farmer: roleSigners.farmer?.address || null,
      distributor: roleSigners.distributor?.address || null,
      retailer: roleSigners.retailer?.address || null,
      consumer: roleSigners.consumer?.address || null,
    }
  };
}

module.exports = {
  initBlockchain, createBatch, updateShipment, updateRetailPrice, confirmSale,
  getBatch, getSupplyChainSteps, getPriceHistory, getAllBatches,
  getFraudAlerts, isDemo, getLogisticsForBatch, getRuntimeMode
};
