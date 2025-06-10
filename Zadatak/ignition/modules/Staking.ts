import { ethers, run } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with the account:", deployer.address);

  const MvpStaking = await ethers.getContractFactory("MvpStaking");
  const mvpStaking = await MvpStaking.deploy();     

  const deploymentTx = mvpStaking.deploymentTransaction();
  if (!deploymentTx) {
    throw new Error("Deployment transaction not found");
  }

  console.log("Waiting for 6 confirmations...");
  await deploymentTx.wait(6); // <-- Čekaš 6 block confirmations

  const contractAddress = await mvpStaking.getAddress();
  console.log("MvpStaking deployed to:", contractAddress);

  // === Verifikacija na Etherscanu ===
  try {
    console.log("Verifying on Etherscan...");
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: [],
    });
    console.log("Contract verified successfully!");
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
