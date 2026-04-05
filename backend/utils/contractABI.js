// Auto-generated ABI for AgriChain contract
// Re-generate after contract changes by running: npx hardhat compile
const CONTRACT_ABI = [
  "function batchCount() view returns (uint256)",
  "function createBatch(string _productName, string _farmerName, string _location, uint256 _quantity, uint256 _farmerPrice, uint256 _harvestDate) returns (uint256)",
  "function updateShipment(uint256 _batchId, string _location, string _notes)",
  "function updateRetailPrice(uint256 _batchId, uint256 _newPrice, string _notes)",
  "function confirmSale(uint256 _batchId, string _location, string _notes)",
  "function getBatch(uint256 _batchId) view returns (tuple(uint256 id, string productName, string farmerName, string originLocation, uint256 quantity, uint256 farmerPrice, uint256 currentPrice, uint256 harvestDate, uint256 createdAt, bool exists, bool isFlagged, string flagReason, uint256 trustScore))",
  "function getSupplyChainSteps(uint256 _batchId) view returns (tuple(uint8 stage, address actor, string location, uint256 timestamp, string notes)[])",
  "function getPriceHistory(uint256 _batchId) view returns (tuple(uint256 price, address updatedBy, uint256 timestamp, string note)[])",
  "function assignRole(address _user, uint8 _role)",
  "function getUserRole(address _user) view returns (uint8)",
  "event BatchCreated(uint256 indexed batchId, string productName, address farmer)",
  "event StageUpdated(uint256 indexed batchId, uint8 newStage, address actor)",
  "event PriceUpdated(uint256 indexed batchId, uint256 oldPrice, uint256 newPrice, address actor)",
  "event FraudDetected(uint256 indexed batchId, string reason)"
];

module.exports = CONTRACT_ABI;
