// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "./PriceConverter.sol";
import {MVPToken} from "./MvpToken.sol";

// Custom errors
error Stake_Insufficient_Funds();
error Stake_Minimum_Required_Time_To_Stake();
error Stake_Must_Stake_First();
error Stake_Staking_Period_Is_Short();
error Stake_Unsucessful_Transaction();

event Staked(address indexed userAddress, uint256 indexed amountEthWei, uint256 indexed stakingPeriod);
event Unstaked(address indexed userAddress);

contract MvpStaking {
    struct StakeInfo {
        uint256 amountEth;        // uplaćen ETH u wei
        uint256 mintedUsd;        // koliko je MVP (USD 1e18) mintovano
        uint256 startTimestamp;   // kad je stake krenuo
        uint256 stakingPeriod;    // koliko traje
    }

    uint256 public constant MINIMUM_STAKING_TIME = 60 * 60 * 24 * 180; // 180 dana
    address public owner;
    MVPToken public immutable i_MVPToken;
    AggregatorV3Interface public immutable i_priceFeed;

    mapping(address => StakeInfo) public stakes;

    constructor(address priceFeed_, address mvpToken_) {
        owner = msg.sender;
        i_MVPToken = MVPToken(mvpToken_);
        i_priceFeed = AggregatorV3Interface(priceFeed_);
    }

    function stake(uint256 stakingPeriod) external payable {
        if (msg.value == 0) revert Stake_Insufficient_Funds();
        if (stakingPeriod < MINIMUM_STAKING_TIME) revert Stake_Staking_Period_Is_Short();

        uint256 usd = PriceConverter.getConversionRate(msg.value, i_priceFeed);
        i_MVPToken.mint(msg.sender, usd);

        stakes[msg.sender] = StakeInfo({
            amountEth: msg.value,
            mintedUsd: usd,
            startTimestamp: block.timestamp,
            stakingPeriod: stakingPeriod
        });

        emit Staked(msg.sender, msg.value, stakingPeriod);
    }

    function withdraw() external {
        StakeInfo memory s = stakes[msg.sender];
        if (s.amountEth == 0) revert Stake_Must_Stake_First();
        if (block.timestamp < s.startTimestamp + s.stakingPeriod) {
            revert Stake_Minimum_Required_Time_To_Stake();
        }

        i_MVPToken.burn(msg.sender, s.mintedUsd);
        delete stakes[msg.sender];

        (bool success, ) = payable(msg.sender).call{value: s.amountEth}("");
        if (!success) revert Stake_Unsucessful_Transaction();

        emit Unstaked(msg.sender);
    }
}
