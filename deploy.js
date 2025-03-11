// This is a hardhat deployment script for the contracts
// Run with: npx hardhat run scripts/deploy.js --network <network_name>

const hre = require("hardhat");

async function main() {
  console.log("Deploying contracts...");

  // Deploy the ECC Operations contract
  const ECCOperations = await hre.ethers.getContractFactory("ECCOperations");
  const eccOperations = await ECCOperations.deploy();
  await eccOperations.deployed();
  console.log("ECCOperations deployed to:", eccOperations.address);

  // Deploy the Key Share Registry contract
  const KeyShareRegistry = await hre.ethers.getContractFactory("KeyShareRegistry");
  const keyShareRegistry = await KeyShareRegistry.deploy();
  await keyShareRegistry.deployed();
  console.log("KeyShareRegistry deployed to:", keyShareRegistry.address);

  // Deploy the ShamirSecretSharing contract template
  const ShamirSecretSharing = await hre.ethers.getContractFactory("ShamirSecretSharing");
  const shamirTemplate = await ShamirSecretSharing.deploy();
  await shamirTemplate.deployed();
  console.log("ShamirSecretSharing template deployed to:", shamirTemplate.address);
  
  // Deploy the ShamirSecretSharingFactory contract
  const ShamirFactory = await hre.ethers.getContractFactory("ShamirSecretSharingFactory");
  const shamirFactory = await ShamirFactory.deploy();
  await shamirFactory.deployed();
  console.log("ShamirSecretSharingFactory deployed to:", shamirFactory.address);

  // Write the contract addresses to a file for easy import
  const fs = require("fs");
  const contractAddresses = {
    eccOperations: eccOperations.address,
    keyShareRegistry: keyShareRegistry.address,
    shamirTemplate: shamirTemplate.address,
    shamirFactory: shamirFactory.address
  };

  fs.writeFileSync(
    "./contract-addresses.json",
    JSON.stringify(contractAddresses, null, 2)
  );
  console.log("Contract addresses written to contract-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });