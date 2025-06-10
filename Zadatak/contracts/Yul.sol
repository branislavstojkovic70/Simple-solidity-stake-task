// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.30;


contract Yul{
    constructor(){}

    function getColor(bytes32 metadata) external pure returns (uint24 color) {
        assembly {
            let shifted := shr(160, metadata)
            color := and(shifted, 0xFFFFFF)
        }
    }

}