const { network } = require("hardhat")
const {
  networkConfig,
  developmentChains,
  INITIAL_SUPPLY,
} = require("../helper-hardhat-config")
const { verify } = require("../helper-functions")
require("dotenv").config()

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId

  const ethUsdPriceFeedAddress = networkConfig[chainId]["ethUsdPriceFeed"]
  const rewardToken = await ethers.getContract("MvpToken")
  const stake = await deploy("StakingContract", {
    from: deployer,
    args: [rewardToken.target, rewardToken.target, ethUsdPriceFeedAddress],
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  })
  log(`MVP deployed at ${stake.address}`)

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    console.log(stake.address)
    await verify(stake.address, [
      rewardToken.address,
      rewardToken.address,
      ethUsdPriceFeedAddress,
    ])
  }
  log("--------------------------------------------")
}

module.exports.tags = ["all", "stake"]
