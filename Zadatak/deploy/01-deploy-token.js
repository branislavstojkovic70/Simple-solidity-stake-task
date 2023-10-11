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

  const stake = await deploy("StakingContract", {
    from: deployer,
    args: [ethUsdPriceFeedAddress, INITIAL_SUPPLY],
    log: true,
    // we need to wait if on a live network so we can verify properly
    waitConfirmations: network.config.blockConfirmations || 1,
  })
  log(`MVP deployed at ${stake.address}`)

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    console.log(stake.address)
    await verify(stake.address, [ethUsdPriceFeedAddress, INITIAL_SUPPLY])
  }
}

module.exports.tags = ["all", "token"]
