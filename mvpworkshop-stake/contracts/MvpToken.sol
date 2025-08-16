// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MVPToken is ERC20, Ownable {
    constructor() ERC20("MVPToken", "MVP") Ownable(msg.sender) {}

    function mint(address to_, uint256 amount_) external onlyOwner {
        _mint(to_, amount_);
    }

    function burn(address from_, uint256 amount_) external onlyOwner {
        _burn(from_, amount_);
    }
}