// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./PriceConverter.sol";

error StakingPeriodLowerThanMinimum();
error StakingPeriodNotPassedError();
error NotOwner();
error NotEnoughStaked();

/**@title A sample Funding Contract
 * @author Branislav Stojkovic
 * @notice This contract is for creating staking contract with ERC-20 standard reward
 * @dev This implements price feeds as our library
 */

contract StakingContract is ERC20 {
  using SafeMath for uint256;
  using PriceConverter for uint256;
  using EnumerableSet for EnumerableSet.AddressSet;

  AggregatorV3Interface private s_priceFeed;

  uint256 public constant MIN_STAKING_PERIOD = 180 days;

  struct Stake {
    uint256 amount;
    uint256 startTime;
  }

  mapping(address => Stake) public stakers;
  EnumerableSet.AddressSet private stakerSet;

  event Staked(address indexed staker, uint256 amount, uint256 reward);
  event Unstaked(address indexed staker, uint256 amount);

  modifier onlyStaker() {
    if (!stakerSet.contains(msg.sender)) revert NotOwner();
    _;
  }

  constructor(address _priceFeed, uint256 initialSupply)
    ERC20("MVPWorkShop", "MVP")
  {
    _mint(address(this), initialSupply);
    s_priceFeed = AggregatorV3Interface(_priceFeed);
  }

  function stake(uint256 stakingPeriod) public payable {
    stakingPeriod = stakingPeriod.mul(3600); //transfer to seconds

    if (stakingPeriod < MIN_STAKING_PERIOD)
      revert StakingPeriodLowerThanMinimum();

    uint256 reward = msg.value.getConversionRate(s_priceFeed);

    _transfer(address(this), msg.sender, reward);

    stakers[msg.sender] = Stake(msg.value, block.timestamp);
    stakerSet.add(msg.sender);

    emit Staked(msg.sender, msg.value, reward);
  }

  function unstake(uint256 unstakeAmount) external onlyStaker {
    Stake memory staker = stakers[msg.sender];
    if (block.timestamp < staker.startTime.add(MIN_STAKING_PERIOD))
      revert StakingPeriodNotPassedError();

    if (unstakeAmount < staker.amount) revert NotEnoughStaked();

    _transfer(address(this), msg.sender, unstakeAmount);
    //ovde dodati da on mora da vrati na contract ERC20 samo videti odakle treba preuzeti to

    stakerSet.remove(msg.sender);
    delete stakers[msg.sender];

    emit Unstaked(msg.sender, staker.amount);
  }

  function getMinimumStakingPeriod() external pure returns (uint256) {
    return MIN_STAKING_PERIOD;
  }

  function getBalanceStaked() external view returns (uint256) {
    return stakers[msg.sender].amount;
  }

  function getBalance() external view returns (uint256) {
    return msg.sender.balance;
  }
}
