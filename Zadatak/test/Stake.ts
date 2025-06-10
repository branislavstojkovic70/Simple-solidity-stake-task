import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("MvpStaking", function () {
  async function deployStakingFixture() {
    const [owner, user] = await ethers.getSigners();

    // Deploy mock price feed (8 decimals, initial price 3000 USD)
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    const mockPriceFeed = await MockV3Aggregator.deploy(8, 3000 * 1e8);
    await mockPriceFeed.waitForDeployment();

    // Deploy staking contract with mock price feed
    const Staking = await ethers.getContractFactory("MvpStaking");
    const staking = await Staking.deploy(await mockPriceFeed.getAddress());
    await staking.waitForDeployment();

    return { staking, mockPriceFeed, owner, user };
  }

  describe("Deployment", function () {
    it("Should deploy with correct name and symbol", async function () {
      const { staking } = await loadFixture(deployStakingFixture);
      expect(await staking.name()).to.equal("MVPWorkshop");
      expect(await staking.symbol()).to.equal("MVP");
    });
  });

  describe("Stake Function", function () {
    it("Should revert if no ETH is sent", async function () {
      const { staking, user } = await loadFixture(deployStakingFixture);
      await expect(staking.connect(user).stake({ value: 0 }))
        .to.be.revertedWithCustomError(staking, "Stake_Insufficient_Funds");
    });

    it("Should mint correct amount of tokens when ETH is staked", async function () {
      const { staking, user } = await loadFixture(deployStakingFixture);
      const ethAmount = ethers.parseEther("1"); // 1 ETH
      const expectedUsdAmount = ethAmount * 3000n; // 3000 USD per ETH

      await staking.connect(user).stake({ value: ethAmount });

      const balance = await staking.balanceOf(user.address);
      expect(balance).to.equal(expectedUsdAmount);

      const stakeInfo = await staking.stakes(user.address);
      expect(stakeInfo.amountStaked).to.equal(expectedUsdAmount);
    });
  });

  describe("Withdraw Function", function () {
    it("Should revert if user hasn't staked", async function () {
      const { staking, user } = await loadFixture(deployStakingFixture);
      await expect(staking.connect(user).withdraw())
        .to.be.revertedWithCustomError(staking, "Stake_Must_Stake_First");
    });

    it("Should revert if minimum staking time hasn't passed", async function () {
      const { staking, user } = await loadFixture(deployStakingFixture);
      await staking.connect(user).stake({ value: ethers.parseEther("1") });
      
      await expect(staking.connect(user).withdraw())
        .to.be.revertedWithCustomError(staking, "Stake_Minimum_Required_Time_To_Stake");
    });

    it("Should allow withdraw after time has passed and burn tokens", async function () {
      const { staking, user } = await loadFixture(deployStakingFixture);
      const ethAmount = ethers.parseEther("1");
      await staking.connect(user).stake({ value: ethAmount });

      // Fast-forward time
      const minTime = 60 * 60 * 24 * 180 + 1; // 180 days + 1 second
      await ethers.provider.send("evm_increaseTime", [minTime]);
      await ethers.provider.send("evm_mine", []);

      // Check balances before withdraw
      const initialEthBalance = await ethers.provider.getBalance(user.address);
      await expect(staking.connect(user).withdraw())
        .to.changeTokenBalance(staking, user, -3000n * ethAmount);

      // Check ETH was returned
      const finalEthBalance = await ethers.provider.getBalance(user.address);
      expect(finalEthBalance).to.be.gt(initialEthBalance);

      // Check stake info is cleared
      const stakeInfo = await staking.stakes(user.address);
      expect(stakeInfo.amountStaked).to.equal(0);
    });
  });

  describe("Price Feed Integration", function () {
    it("Should reflect price changes in staking amounts", async function () {
      const { staking, mockPriceFeed, user } = await loadFixture(deployStakingFixture);
      
      await mockPriceFeed.updateAnswer(4000 * 1e8);
      
      const ethAmount = ethers.parseEther("1");
      await staking.connect(user).stake({ value: ethAmount });
      
      const balance = await staking.balanceOf(user.address);
      expect(balance).to.equal(4000n * ethAmount);
    });
  });
});