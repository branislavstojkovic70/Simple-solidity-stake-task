const { assert, expect } = require("chai")
const { deployments, ethers, waffle } = require("hardhat")
const {
  developmentChains,
  getNamedAccounts,
} = require("../helper-hardhat-config.js")
const { parseEther } = ethers.utils

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("StakingContract", function () {
      let stakingContract
      let mockPriceFeed
      let deployer
      const stakingAmount = parseEther("10")

      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        stakingContract = await ethers.getContract("StakingContract", deployer)
        mockPriceFeed = await ethers.getContract("MockV3Aggregator", deployer)
      })

      describe("constructor", function () {
        it("sets the price feed address correctly", async () => {
          const response = await stakingContract.s_priceFeed()
          assert.equal(response, mockPriceFeed.address)
        })

        it("sets the initial supply correctly", async () => {
          const totalSupply = await stakingContract.totalSupply()
          assert.equal(totalSupply, parseEther("200"))
        })
      })

      describe("stake", function () {
        it("Fails if staking period is lower than the minimum", async () => {
          await expect(stakingContract.stake(90)).to.be.revertedWith(
            "StakingPeriodLowerThanMinimum"
          )
        })

        it("Successfully stakes ETH and issues ERC-20 tokens as rewards", async () => {
          await mockPriceFeed.setLatestRoundData(0, 300000000000, 0, 0, 0)
          await stakingContract.stake(180, { value: stakingAmount })

          const stakerBalance = await stakingContract.balanceOf(deployer)
          const stakerStakedAmount = await stakingContract.getBalanceStaked()
          assert.equal(stakerBalance, stakingAmount)
          assert.equal(stakerStakedAmount, stakingAmount)

          const contractBalance = await stakingContract.balanceOf(
            stakingContract.address
          )
          assert.equal(
            contractBalance,
            stakingAmount.mul(300000000000).div(1e8)
          )
        })
      })

      describe("unstake", function () {
        beforeEach(async () => {
          await mockPriceFeed.setLatestRoundData(0, 300000000000, 0, 0, 0)
          await stakingContract.stake(180, { value: stakingAmount })
        })

        it("Fails if staking period has not passed", async () => {
          await expect(
            stakingContract.unstake(stakingAmount)
          ).to.be.revertedWith("StakingPeriodNotPassedError")
        })

        it("Fails if unstake amount is greater than staked amount", async () => {
          await expect(
            stakingContract.unstake(stakingAmount.mul(2))
          ).to.be.revertedWith("NotEnoughStaked")
        })

        it("Successfully unstakes and transfers ERC-20 tokens back to the user", async () => {
          await waffle.provider.send("evm_increaseTime", [181 * 24 * 60 * 60]) // Increase time to pass staking period
          await stakingContract.unstake(stakingAmount)

          const stakerBalance = await stakingContract.balanceOf(deployer)
          const stakerStakedAmount = await stakingContract.getBalanceStaked()
          assert.equal(stakerBalance, 0)
          assert.equal(stakerStakedAmount, 0)

          const contractBalance = await stakingContract.balanceOf(
            stakingContract.address
          )
          assert.equal(contractBalance, 0)
        })
      })

      describe("calculateInSeconds", function () {
        it("Correctly calculates seconds from days", async () => {
          const seconds = await stakingContract.calculateInSeconds(5)
          assert.equal(seconds, 5 * 24 * 60 * 60)
        })
      })

      describe("getETHUSDPrice", function () {
        it("Returns the correct ETH to USD price", async () => {
          await mockPriceFeed.setLatestRoundData(0, 300000000000, 0, 0, 0)
          const price = await stakingContract.getETHUSDPrice()
          assert.equal(price, 300000000000)
        })
      })

      describe("getMinimumStakingPeriod", function () {
        it("Returns the correct minimum staking period", async () => {
          const minStakingPeriod =
            await stakingContract.getMinimumStakingPeriod()
          assert.equal(minStakingPeriod, 180 * 24 * 60 * 60)
        })
      })

      describe("getBalanceStaked", function () {
        it("Returns the correct staked amount for a user", async () => {
          await mockPriceFeed.setLatestRoundData(0, 300000000000, 0, 0, 0)
          await stakingContract.stake(180, { value: stakingAmount })

          const stakerStakedAmount = await stakingContract.getBalanceStaked()
          assert.equal(stakerStakedAmount, stakingAmount)
        })
      })

      describe("getBalance", function () {
        it("Returns the correct ETH balance for a user", async () => {
          const stakerBalance = await stakingContract.getBalance()
          assert.equal(stakerBalance, 0)
        })
      })

      describe("onlyStaker modifier", function () {
        it("Reverts if the caller is not a staker", async () => {
          await expect(
            stakingContract.unstake(stakingAmount)
          ).to.be.revertedWith("NotOwner")
        })

        it("Allows the operation if the caller is a staker", async () => {
          await mockPriceFeed.setLatestRoundData(0, 300000000000, 0, 0, 0)
          await stakingContract.stake(180, { value: stakingAmount })

          await expect(stakingContract.unstake(stakingAmount)).to.not.be
            .reverted
        })
      })
      describe("Events", function () {
        it("Emits Staked event with correct parameters", async () => {
          await mockPriceFeed.setLatestRoundData(0, 300000000000, 0, 0, 0)
          const tx = await stakingContract.stake(180, { value: stakingAmount })
          const receipt = await tx.wait()
          const stakedEvent = receipt.events.find(
            (event) => event.event === "Staked"
          )

          assert.exists(stakedEvent, "Staked event should be emitted")
          assert.equal(
            stakedEvent.args.staker,
            deployer,
            "Incorrect staker address"
          )
          assert.equal(
            stakedEvent.args.amount,
            stakingAmount,
            "Incorrect staking amount"
          )
          assert.equal(
            stakedEvent.args.reward,
            stakingAmount.mul(300000000000).div(1e8),
            "Incorrect reward amount"
          )
        })

        it("Emits Unstaked event with correct parameters", async () => {
          await mockPriceFeed.setLatestRoundData(0, 300000000000, 0, 0, 0)
          await stakingContract.stake(180, { value: stakingAmount })

          await waffle.provider.send("evm_increaseTime", [181 * 24 * 60 * 60]) // Increase time to pass staking period

          const tx = await stakingContract.unstake(stakingAmount)
          const receipt = await tx.wait()
          const unstakedEvent = receipt.events.find(
            (event) => event.event === "Unstaked"
          )

          assert.exists(unstakedEvent, "Unstaked event should be emitted")
          assert.equal(
            unstakedEvent.args.staker,
            deployer,
            "Incorrect staker address"
          )
          assert.equal(
            unstakedEvent.args.amount,
            stakingAmount,
            "Incorrect unstaking amount"
          )
        })
      })

      describe("Edge Cases", function () {
        it("Fails if staking with zero staking period", async () => {
          await expect(
            stakingContract.stake(0, { value: stakingAmount })
          ).to.be.revertedWith("StakingPeriodLowerThanMinimum")
        })

        it("Fails if unstaking with zero staking period", async () => {
          await mockPriceFeed.setLatestRoundData(0, 300000000000, 0, 0, 0)
          await stakingContract.stake(180, { value: stakingAmount })

          await waffle.provider.send("evm_increaseTime", [180 * 24 * 60 * 60]) // Set time to minimum staking period

          await expect(
            stakingContract.unstake(stakingAmount)
          ).to.be.revertedWith("StakingPeriodNotPassedError")
        })

        it("Fails if unstaking more than staked amount", async () => {
          await expect(
            stakingContract.unstake(stakingAmount)
          ).to.be.revertedWith("NotEnoughStaked")
        })
      })
      it("Doesn't allow withdrawal if not the owner", async () => {
        const accounts = await ethers.getSigners()
        const stakingContractConnected = await stakingContract.connect(
          accounts[1]
        )
        await expect(
          stakingContractConnected.cheaperWithdraw()
        ).to.be.revertedWith("FundMe__NotOwner")
      })
    })
