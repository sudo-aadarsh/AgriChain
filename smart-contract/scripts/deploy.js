const hre = require("hardhat");

async function main() {
  console.log("Deploying AgriChain contract...");
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const AgriChain = await hre.ethers.getContractFactory("AgriChain");
  const agriChain = await AgriChain.deploy();
  await agriChain.waitForDeployment();

  const address = await agriChain.getAddress();
  console.log("✅ AgriChain deployed to:", address);
  console.log("\n📋 Add this to your backend .env:");
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
