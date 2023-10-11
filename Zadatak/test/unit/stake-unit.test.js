const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const {
  developmentChains,
  INITIAL_SUPPLY,
} = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("StakingContract", function () {
      let StakingContract
      let stakingContract
      let aggregatorMock
      let deployer
      let staker
      const sendValue = ethers.parseEther("1")

      beforeEach(async () => {
        ;[deployer, staker] = await ethers.getSigners()

        await deployments.fixture(["all"])

        StakingContract = await ethers.getContractFactory("StakingContract")
        stakingContract = await StakingContract.deploy(aggregatorMock.address)
        await stakingContract.deployed()
      })

      describe("stake", function () {
        it("Fails if staking period is below the minimum", async () => {
          const stakingPeriod = stakingContract.MIN_STAKING_PERIOD - 1

          await expect(
            stakingContract.stake(stakingPeriod, { value: sendValue })
          ).to.be.revertedWith("StakingPeriodLowerThanMinimum")
        })

        it("Successfully stakes and updates staking data", async () => {
          const stakingPeriod = stakingContract.MIN_STAKING_PERIOD + 1

          await stakingContract.stake(stakingPeriod, { value: sendValue })

          const stakerData = await stakingContract.stakers(staker.address)
          assert.equal(stakerData.amount.toString(), sendValue.toString())
          assert.equal(stakerData.startTime, stakingPeriod)
        })
      })

      describe("unstake", function () {
        beforeEach(async () => {
          const stakingPeriod = stakingContract.MIN_STAKING_PERIOD + 1
          await stakingContract.stake(stakingPeriod, { value: sendValue })
        })

        it("Fails if unstaking before minimum staking period", async () => {
          await expect(stakingContract.unstake()).to.be.revertedWith(
            "StakingPeriodNotPassedError"
          )
        })

        it("Successfully unstakes and transfers rewards", async () => {
          await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 7])

          const stakerBalanceBefore = await ethers.provider.getBalance(
            staker.address
          )

          await stakingContract.unstake()

          const stakerBalanceAfter = await ethers.provider.getBalance(
            staker.address
          )

          const stakerData = await stakingContract.stakers(staker.address)

          assert.equal(stakerData.amount, 0)
          assert.isAbove(stakerBalanceAfter, stakerBalanceBefore)
        })
      })

      describe("getETHUSDPrice", function () {
        it("Returns the correct ETH to USD price", async () => {
          const ethUSDPrice = await stakingContract.getETHUSDPrice()
          assert.isNumber(ethUSDPrice)
        })
      })

      describe("getMinimumStakingPeriod", function () {
        it("Returns the correct minimum staking period", async () => {
          const minStakingPeriod =
            await stakingContract.getMinimumStakingPeriod()
          assert.equal(minStakingPeriod, stakingContract.MIN_STAKING_PERIOD)
        })
      })

      describe("getPriceFeed", function () {
        it("Returns the correct price feed address", async () => {
          const priceFeedAddress = await stakingContract.getPriceFeed()
          assert.equal(priceFeedAddress, aggregatorMock.address)
        })
      })
    })
