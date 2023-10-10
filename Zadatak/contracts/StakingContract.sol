pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

error StakingPeriodLowerThanMinimum();
error StakingPeriodNotPassedError();
error NotOwner();

/**@title A sample Funding Contract
 * @author Branislav Stojkovic
 * @notice This contract is for creating staking contract with ERC-20 standard reward
 * @dev This implements price feeds as our library
 */

contract StakingContract is ERC20, ERC20Burnable, Pausable, Ownable {
  // Type Declarations
  using SafeMath for uint256;
  using EnumerableSet for EnumerableSet.AddressSet;

  // State variables
  AggregatorV3Interface private s_priceFeed;

  uint256 public constant MIN_STAKING_PERIOD = 6 * 30 days;

  struct Stake {
    uint256 amount;
    uint256 startTime;
  }

  mapping(address => Stake) public stakers;
  EnumerableSet.AddressSet private stakerSet;

  event Staked(address indexed staker, uint256 amount, uint256 reward);
  event Unstaked(address indexed staker, uint256 amount);

  modifier onlyStaker() {
    if (stakerSet.contains(msg.sender)) revert NotOwner();
    _;
  }

  constructor(address _priceFeed) ERC20("MVPWorkShop", "MVP") {
    _mint(msg.sender, 10000 * 10 * decimals());
    _mint(address(this), 10000 * 10 * decimals());
    s_priceFeed = AggregatorV3Interface(_priceFeed);
  }

  function stake(uint256 stakingPeriod) external payable {
    if (stakingPeriod <= MIN_STAKING_PERIOD) {
      revert StakingPeriodLowerThanMinimum();
    }

    uint256 ethUSDPrice = getETHUSDPrice();
    uint256 reward = ethUSDPrice.mul(msg.value).div(1e8);

    ERC20.transferFrom(msg.sender, address(this), reward);

    stakers[msg.sender] = Stake(msg.value, block.timestamp);
    stakerSet.add(msg.sender);

    emit Staked(msg.sender, msg.value, reward);
  }

  function unstake() external onlyStaker {
    Stake memory staker = stakers[msg.sender];
    if (block.timestamp >= staker.startTime.add(MIN_STAKING_PERIOD)) {
      revert StakingPeriodNotPassedError();
    }

    payable(msg.sender).transfer(staker.amount);

    stakerSet.remove(msg.sender);
    delete stakers[msg.sender];

    emit Unstaked(msg.sender, staker.amount);
  }

  function getETHUSDPrice() public view returns (uint256) {
    (, int256 price, , , ) = s_priceFeed.latestRoundData();
    return uint256(price);
  }

  function getMinimumStakingPeriod() external view returns (uint256) {
    return MIN_STAKING_PERIOD;
  }
}
