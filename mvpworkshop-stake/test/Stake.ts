import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const DECIMALS = 8n;
const INITIAL_PRICE = 2000n * 10n ** DECIMALS; 
const MIN = 60n * 60n * 24n * 180n;     

describe("MvpStaking", function () {
  async function deployFixture() {
    const [deployer, user, other] = await ethers.getSigners();

    const MockFactory = await ethers.getContractFactory("MockV3Aggregator");
    const mock = await MockFactory.deploy(Number(DECIMALS), INITIAL_PRICE);
    await mock.waitForDeployment();

    const MVPToken = await ethers.getContractFactory("MVPToken");
    const token = await MVPToken.deploy();
    await token.waitForDeployment();

    const Staking = await ethers.getContractFactory("MvpStaking");
    const staking = await Staking.deploy(await mock.getAddress(), await token.getAddress());
    await staking.waitForDeployment();

    await (await token.transferOwnership(await staking.getAddress())).wait();

    return { deployer, user, other, mock, token, staking };
  }

  it("reverts if no ETH is sent", async () => {
    const { staking } = await loadFixture(deployFixture);
    await expect(staking.stake(MIN)).to.be.revertedWithCustomError(staking, "Stake_Insufficient_Funds");
  });

  it("reverts if staking period is below minimum", async () => {
    const { staking } = await loadFixture(deployFixture);
    await expect(
      staking.stake(MIN - 1n, { value: ethers.parseEther("1") })
    ).to.be.revertedWithCustomError(staking, "Stake_Staking_Period_Is_Short");
  });

  it("mints MVP in USD (1 ETH = 2000 MVP), stores stake and emits event", async () => {
    const { staking, token, user } = await loadFixture(deployFixture);

    const tx = await staking.connect(user).stake(MIN, { value: ethers.parseEther("1") });
    await expect(tx)
      .to.emit(staking, "Staked")
      .withArgs(user.address, ethers.parseEther("1"), MIN);

    const bal = await token.balanceOf(user.address);
    expect(bal).to.equal(ethers.parseEther("2000")); 

    const s = await staking.stakes(user.address);
    expect(s.amountEth).to.equal(ethers.parseEther("1"));
    expect(s.mintedUsd).to.equal(ethers.parseEther("2000"));
    expect(s.stakingPeriod).to.equal(MIN);
    expect(s.startTimestamp).to.be.gt(0);
  });

  it("does not allow withdraw before period ends", async () => {
    const { staking, user } = await loadFixture(deployFixture);

    await staking.connect(user).stake(MIN, { value: ethers.parseEther("1") });
    await expect(staking.connect(user).withdraw())
      .to.be.revertedWithCustomError(staking, "Stake_Minimum_Required_Time_To_Stake");
  });

  it("allows withdraw after period and returns ETH while burning MVP", async () => {
    const { staking, token, user } = await loadFixture(deployFixture);

    await staking.connect(user).stake(MIN, { value: ethers.parseEther("1") });

    await time.increase(Number(MIN));

    const balBefore = await ethers.provider.getBalance(user.address);

    const tx = await staking.connect(user).withdraw();
    const receipt = await tx.wait();
    const gasUsed = receipt!.gasUsed * receipt!.gasPrice!;

    const balAfter = await ethers.provider.getBalance(user.address);
    expect(balAfter + gasUsed - balBefore).to.equal(ethers.parseEther("1"));

    expect(await token.balanceOf(user.address)).to.equal(0);
  });

  it("reverts withdraw if user has not staked", async () => {
    const { staking, user } = await loadFixture(deployFixture);
    await expect(staking.connect(user).withdraw())
      .to.be.revertedWithCustomError(staking, "Stake_Must_Stake_First");
  });

  it("allows multiple stakes in a row (overwrites last one)", async () => {
    const { staking, token, user } = await loadFixture(deployFixture);

    await staking.connect(user).stake(MIN, { value: ethers.parseEther("1") });
    await staking.connect(user).stake(MIN, { value: ethers.parseEther("2") });

    const s = await staking.stakes(user.address);
    expect(s.amountEth).to.equal(ethers.parseEther("2"));
    expect(s.mintedUsd).to.equal(ethers.parseEther("4000"));

    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("6000"));
  });
});
