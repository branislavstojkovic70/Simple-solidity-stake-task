// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

library PriceConverter {
    // cena ETH/USD skalirana na 1e18
    function getPrice(AggregatorV3Interface priceFeed) internal view returns (uint256) {
        (, int256 answer,,,) = priceFeed.latestRoundData(); // npr. 2000 * 1e8
        uint8 dec = priceFeed.decimals();                   // obično 8
        return uint256(answer) * (10 ** (18 - dec));        // na 1e18
    }

    // ethAmount (wei, 1e18) -> USD (1e18)
    function getConversionRate(uint256 ethAmount, AggregatorV3Interface priceFeed)
        internal
        view
        returns (uint256)
    {
        uint256 ethPrice = getPrice(priceFeed); // 1e18
        return (ethPrice * ethAmount) / 1e18;   // 1e18
    }
}
