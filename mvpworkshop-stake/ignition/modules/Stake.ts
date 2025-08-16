import { ethers, run } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const MVPToken = await ethers.getContractFactory("MVPToken");
  const token = await MVPToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("MVPToken deployed to:", tokenAddress);


  const priceFeed = "0x694AA1769357215DE4FAC081bf1f309aDC325306"; 

  const MvpStaking = await ethers.getContractFactory("MvpStaking");
  const staking = await MvpStaking.deploy(priceFeed, tokenAddress);
  const deploymentTx = staking.deploymentTransaction();
  if (!deploymentTx) {
    throw new Error("Deployment transaction not found");
  }

  console.log("Waiting for 6 confirmations...");
  await deploymentTx.wait();

  const stakingAddress = await staking.getAddress();
  console.log("MvpStaking deployed to:", stakingAddress);

  await (await token.transferOwnership(stakingAddress)).wait();
  console.log("Ownership of MVPToken transferred to staking contract");

  try {
    console.log("Verifying staking contract on Etherscan...");
    await run("verify:verify", {
      address: stakingAddress,
      constructorArguments: [priceFeed, tokenAddress],
    });
    console.log("Staking contract verified successfully!");
  } catch (error: any) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("Already verified!");
    } else {
      console.error("Verification failed:", error);
    }
  }

  try {
    console.log("Verifying token contract on Etherscan...");
    await run("verify:verify", {
      address: tokenAddress,
      constructorArguments: [],
    });
    console.log("Token contract verified successfully!");
  } catch (error: any) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("Already verified!");
    } else {
      console.error("Verification failed:", error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
