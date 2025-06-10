import { ethers, run } from "hardhat";

async function deployMockPriceFeed() {
  const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
  // 8 decimals, initial price: 3000 USD (3000 * 1e8)
  const mockPriceFeed = await MockV3Aggregator.deploy(8, 3000 * 1e8);
  await mockPriceFeed.waitForDeployment();
  return mockPriceFeed;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // First deploy mock price feed
  const mockPriceFeed = await deployMockPriceFeed();
  console.log("Mock PriceFeed deployed to:", await mockPriceFeed.getAddress());

  // Then deploy staking contract with mock price feed address
  const MvpStaking = await ethers.getContractFactory("MvpStaking");
  const mvpStaking = await MvpStaking.deploy(await mockPriceFeed.getAddress());
  await mvpStaking.waitForDeployment();

  console.log("MvpStaking deployed to:", await mvpStaking.getAddress());

  // Wait for confirmations before verification
  console.log("Waiting for confirmations...");
  await mvpStaking.deploymentTransaction()?.wait(6);

  // Verify contracts
  try {
    console.log("Verifying MvpStaking...");
    await run("verify:verify", {
      address: await mvpStaking.getAddress(),
      constructorArguments: [await mockPriceFeed.getAddress()],
    });
    console.log("MvpStaking verified!");
  } catch (error: any) {
    console.error("Verification failed:", error.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});