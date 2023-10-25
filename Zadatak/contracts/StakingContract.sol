// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./PriceConverter.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

error Unauthorized();
error AmountIsZero();
error MinimumStakingPeriodNotMet();
error InsufficientStakedBalance();
error StakingPeriodNotPassed();

contract StakingContract {
  using SafeMath for uint256;
  using PriceConverter for uint256;

  address public immutable i_owner;

  modifier onlyOwner() {
    if (msg.sender != i_owner) revert Unauthorized();

    _;
  }

  IERC20 public immutable i_sepoliaETH;
  IERC20 public immutable i_rewardsToken;

  uint256 public duration;
  uint256 public finishAt;
  uint256 public updatedAt;
  uint256 public rewardRate;
  uint256 public rewardPerTokenStored;
  uint256 public constant MIN_STAKING_PERIOD_IN_MONTHS = 6;
  AggregatorV3Interface private ethUsdPriceFeed;

  mapping(address => uint256) public userRewardPerTokenPaid;
  mapping(address => uint256) public rewards;

  uint256 public totalStaked;
  mapping(address => uint256) public stakedBalance;

  event Staked(
    address indexed user,
    uint256 amount,
    uint256 stakingPeriodMonths,
    uint256 reward
  );
  event Unstaked(address indexed user, uint256 amount, uint256 reward);

  constructor(
    address _sepoliaETH,
    address _rewardsToken,
    address _ethUsdPriceFeed
  ) {
    i_owner = msg.sender;
    i_sepoliaETH = IERC20(_sepoliaETH);
    i_rewardsToken = IERC20(_rewardsToken);
    ethUsdPriceFeed = AggregatorV3Interface(_ethUsdPriceFeed);
  }

  modifier updateReward(address _account) {
    rewardPerTokenStored = rewardPerToken();
    updatedAt = lastTimeRewardApplicable();

    if (_account != address(0)) {
      rewards[_account] = earned(_account);
      userRewardPerTokenPaid[_account] = rewardPerTokenStored;
    }

    _;
  }

  function stake(
    uint256 _stakingPeriodMonths
  ) external updateReward(msg.sender) {
    if (_stakingPeriodMonths < MIN_STAKING_PERIOD_IN_MONTHS)
      revert MinimumStakingPeriodNotMet();

    uint256 amount = i_sepoliaETH.balanceOf(msg.sender);
    if (amount == 0) revert AmountIsZero();

    i_sepoliaETH.transferFrom(msg.sender, address(this), amount);

    stakedBalance[msg.sender] += amount;
    totalStaked += amount;

    uint256 ethPriceInUSD = amount.getConversionRate(ethUsdPriceFeed);
    uint256 rewardAmount = ethPriceInUSD / 1e18;
    rewards[msg.sender] += rewardAmount;

    duration = _stakingPeriodMonths * 30 days;
    updatedAt = block.timestamp;
    finishAt = block.timestamp + duration;
    rewardRate = rewardAmount / duration;

    emit Staked(msg.sender, amount, _stakingPeriodMonths, rewardAmount);
  }

  function withdraw(uint256 _amount) external updateReward(msg.sender) {
    if (_amount == 0) revert AmountIsZero();
    if (stakedBalance[msg.sender] < _amount) revert InsufficientStakedBalance();
    if (block.timestamp < finishAt) revert StakingPeriodNotPassed();

    stakedBalance[msg.sender] -= _amount;
    totalStaked -= _amount;

    i_sepoliaETH.transfer(msg.sender, _amount);

    emit Unstaked(msg.sender, _amount, rewards[msg.sender]);
    rewards[msg.sender] = 0;
  }

  function getReward() external updateReward(msg.sender) {
    uint256 reward = rewards[msg.sender];
    if (reward > 0) {
      rewards[msg.sender] = 0;
      i_rewardsToken.transfer(msg.sender, reward);
    }
  }

  function earned(address _account) public view returns (uint256) {
    return
      ((stakedBalance[_account] *
        (rewardPerToken() - userRewardPerTokenPaid[_account])) / 1e18) +
      rewards[_account];
  }

  function lastTimeRewardApplicable() public view returns (uint256) {
    return _min(finishAt, block.timestamp);
  }

  function rewardPerToken() public view returns (uint256) {
    if (totalStaked == 0) {
      return rewardPerTokenStored;
    }

    return
      rewardPerTokenStored +
      (rewardRate * (lastTimeRewardApplicable() - updatedAt) * 1e18) /
      totalStaked;
  }

  function _min(uint256 x, uint256 y) private pure returns (uint256) {
    return x <= y ? x : y;
  }
}
