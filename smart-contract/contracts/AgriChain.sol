// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract AgriChain {
    enum Role { None, Farmer, Distributor, Retailer, Consumer }
    enum Stage { Harvested, InTransit, AtWarehouse, AtRetail, Sold }

    struct PriceHistory {
        uint256 price;
        address updatedBy;
        uint256 timestamp;
        string note;
    }

    struct SupplyChainStep {
        Stage stage;
        address actor;
        string location;
        uint256 timestamp;
        string notes;
    }

    struct ProductBatch {
        uint256 id;
        string productName;
        string farmerName;
        string originLocation;
        uint256 quantity;       // in kg
        uint256 farmerPrice;    // in wei (or smallest unit)
        uint256 currentPrice;
        uint256 harvestDate;
        uint256 createdAt;
        bool exists;
        bool isFlagged;
        string flagReason;
        uint256 trustScore;     // 0-100
    }

    mapping(uint256 => ProductBatch) public batches;
    mapping(uint256 => SupplyChainStep[]) public supplyChainSteps;
    mapping(uint256 => PriceHistory[]) public priceHistories;
    mapping(address => Role) public userRoles;
    mapping(bytes32 => bool) public productHashes; // for duplicate detection

    uint256 public batchCount;
    address public owner;

    event BatchCreated(uint256 indexed batchId, string productName, address farmer);
    event StageUpdated(uint256 indexed batchId, Stage newStage, address actor);
    event PriceUpdated(uint256 indexed batchId, uint256 oldPrice, uint256 newPrice, address actor);
    event FraudDetected(uint256 indexed batchId, string reason);
    event RoleAssigned(address indexed user, Role role);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyRole(Role _role) {
        require(userRoles[msg.sender] == _role, "Unauthorized role");
        _;
    }

    modifier batchExists(uint256 _batchId) {
        require(batches[_batchId].exists, "Batch does not exist");
        _;
    }

    constructor() {
        owner = msg.sender;
        userRoles[msg.sender] = Role.Farmer; // deployer starts as farmer
    }

    function assignRole(address _user, Role _role) external onlyOwner {
        userRoles[_user] = _role;
        emit RoleAssigned(_user, _role);
    }

    function createBatch(
        string memory _productName,
        string memory _farmerName,
        string memory _location,
        uint256 _quantity,
        uint256 _farmerPrice,
        uint256 _harvestDate
    ) external onlyRole(Role.Farmer) returns (uint256) {
        // Duplicate detection
        bytes32 productHash = keccak256(abi.encodePacked(_productName, _farmerName, _harvestDate, _quantity));
        bool isDuplicate = productHashes[productHash];
        
        batchCount++;
        uint256 newId = batchCount;

        batches[newId] = ProductBatch({
            id: newId,
            productName: _productName,
            farmerName: _farmerName,
            originLocation: _location,
            quantity: _quantity,
            farmerPrice: _farmerPrice,
            currentPrice: _farmerPrice,
            harvestDate: _harvestDate,
            createdAt: block.timestamp,
            exists: true,
            isFlagged: isDuplicate,
            flagReason: isDuplicate ? "Potential duplicate entry detected" : "",
            trustScore: isDuplicate ? 50 : 100
        });

        productHashes[productHash] = true;

        supplyChainSteps[newId].push(SupplyChainStep({
            stage: Stage.Harvested,
            actor: msg.sender,
            location: _location,
            timestamp: block.timestamp,
            notes: string(abi.encodePacked("Harvested by ", _farmerName))
        }));

        priceHistories[newId].push(PriceHistory({
            price: _farmerPrice,
            updatedBy: msg.sender,
            timestamp: block.timestamp,
            note: "Initial farmer price"
        }));

        emit BatchCreated(newId, _productName, msg.sender);
        if (isDuplicate) emit FraudDetected(newId, "Duplicate product entry");

        return newId;
    }

    function updateShipment(
        uint256 _batchId,
        string memory _location,
        string memory _notes
    ) external onlyRole(Role.Distributor) batchExists(_batchId) {
        // Validate step order
        SupplyChainStep[] storage steps = supplyChainSteps[_batchId];
        Stage lastStage = steps[steps.length - 1].stage;
        require(lastStage == Stage.Harvested || lastStage == Stage.InTransit, "Invalid step order");

        Stage newStage = lastStage == Stage.Harvested ? Stage.InTransit : Stage.AtWarehouse;

        steps.push(SupplyChainStep({
            stage: newStage,
            actor: msg.sender,
            location: _location,
            timestamp: block.timestamp,
            notes: _notes
        }));

        emit StageUpdated(_batchId, newStage, msg.sender);
    }

    function updateRetailPrice(
        uint256 _batchId,
        uint256 _newPrice,
        string memory _notes
    ) external onlyRole(Role.Retailer) batchExists(_batchId) {
        ProductBatch storage batch = batches[_batchId];
        uint256 oldPrice = batch.currentPrice;

        // Fraud detection: price spike > 500%
        bool isPriceSpike = _newPrice > (oldPrice * 5);
        if (isPriceSpike) {
            batch.isFlagged = true;
            batch.flagReason = "Abnormal price spike detected (>500% increase)";
            batch.trustScore = batch.trustScore > 30 ? batch.trustScore - 30 : 0;
            emit FraudDetected(_batchId, "Abnormal price spike");
        }

        // Check supply chain completeness
        SupplyChainStep[] storage steps = supplyChainSteps[_batchId];
        Stage lastStage = steps[steps.length - 1].stage;
        bool missingSteps = lastStage == Stage.Harvested; // distributor step missing
        if (missingSteps) {
            batch.isFlagged = true;
            batch.flagReason = string(abi.encodePacked(batch.flagReason, " | Missing distributor step"));
            batch.trustScore = batch.trustScore > 20 ? batch.trustScore - 20 : 0;
            emit FraudDetected(_batchId, "Missing supply chain steps");
        }

        batch.currentPrice = _newPrice;

        steps.push(SupplyChainStep({
            stage: Stage.AtRetail,
            actor: msg.sender,
            location: "Retail Store",
            timestamp: block.timestamp,
            notes: _notes
        }));

        priceHistories[_batchId].push(PriceHistory({
            price: _newPrice,
            updatedBy: msg.sender,
            timestamp: block.timestamp,
            note: _notes
        }));

        emit PriceUpdated(_batchId, oldPrice, _newPrice, msg.sender);
        emit StageUpdated(_batchId, Stage.AtRetail, msg.sender);
    }

    function confirmSale(
        uint256 _batchId,
        string memory _location,
        string memory _notes
    ) external onlyRole(Role.Consumer) batchExists(_batchId) {
        SupplyChainStep[] storage steps = supplyChainSteps[_batchId];
        Stage lastStage = steps[steps.length - 1].stage;
        require(lastStage == Stage.AtRetail, "Batch must be at retail before sale");

        steps.push(SupplyChainStep({
            stage: Stage.Sold,
            actor: msg.sender,
            location: _location,
            timestamp: block.timestamp,
            notes: _notes
        }));

        emit StageUpdated(_batchId, Stage.Sold, msg.sender);
    }

    function getSupplyChainSteps(uint256 _batchId) external view returns (SupplyChainStep[] memory) {
        return supplyChainSteps[_batchId];
    }

    function getPriceHistory(uint256 _batchId) external view returns (PriceHistory[] memory) {
        return priceHistories[_batchId];
    }

    function getBatch(uint256 _batchId) external view returns (ProductBatch memory) {
        return batches[_batchId];
    }

    function getUserRole(address _user) external view returns (Role) {
        return userRoles[_user];
    }
}
