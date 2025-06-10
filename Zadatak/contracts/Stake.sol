// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "contracts/PriceConverter.sol";

///Insufficient funds. Must send eth
error Stake_Insufficient_Funds();

///Time has not passed
error Stake_Minimum_Required_Time_To_Stake();

///First stake then withdraw
error Stake_Must_Stake_First();

///First stake then withdraw
error Stake_Unsucessful_Transaction();

contract MvpStaking is ERC20 {
    AggregatorV3Interface internal priceFeed;
    
    struct StakeInfo {
        uint256 amountStaked;
        uint256 startTimestamp;
    }

    uint256 public constant MINIMUM_STAKING_TIME = 60 * 60 * 24 * 180; // 180 days
    address public owner;

    mapping(address => StakeInfo) public stakes;

    constructor(address _priceFeed) ERC20("MVPWorkshop", "MVP") {
        priceFeed = AggregatorV3Interface(_priceFeed);
        owner = msg.sender;
    }

    function getPrice() internal view returns (uint256) {
        (, int256 answer, , , ) = priceFeed.latestRoundData();
        return uint256(answer * 1e10); // Convert to 18 decimals
    }

    function getConversionRate(uint256 ethAmount) internal view returns (uint256) {
        uint256 ethPrice = getPrice();
        uint256 ethAmountInUsd = (ethPrice * ethAmount) / 1e18;
        return ethAmountInUsd;
    }

    function stake() external payable {
        if (msg.value == 0) revert Stake_Insufficient_Funds();
        uint256 ethAmountInUsd = getConversionRate(msg.value);
        _mint(msg.sender, ethAmountInUsd);
        stakes[msg.sender] = StakeInfo({
            amountStaked: ethAmountInUsd,
            startTimestamp: block.timestamp
        });
    }

    function withdraw() external {
        StakeInfo storage stakeInfo = stakes[msg.sender];
        if (stakeInfo.amountStaked == 0) revert Stake_Must_Stake_First();
        if (block.timestamp < stakeInfo.startTimestamp + MINIMUM_STAKING_TIME) {
            revert Stake_Minimum_Required_Time_To_Stake();
        }
        
        uint256 amount = stakeInfo.amountStaked;
        _burn(msg.sender, amount);
        delete stakes[msg.sender];
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert Stake_Unsucessful_Transaction();
    }
}
