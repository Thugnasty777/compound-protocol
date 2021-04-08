pragma solidity ^0.5.16;

import "../../contracts/ComptrollerG6.sol";

contract ComptrollerScenarioG6 is ComptrollerG6 {
    uint public blockNumber;
    address public vtxAddress;

    constructor() ComptrollerG6() public {}

    function fastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;
        return blockNumber;
    }

    function setVtxAddress(address vtxAddress_) public {
        vtxAddress = vtxAddress_;
    }

    function getVtxAddress() public view returns (address) {
        return vtxAddress;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function getBlockNumber() public view returns (uint) {
        return blockNumber;
    }

    function membershipLength(CToken cToken) public view returns (uint) {
        return accountAssets[address(cToken)].length;
    }

    function unlist(CToken cToken) public {
        markets[address(cToken)].isListed = false;
    }

    function setVtxSpeed(address cToken, uint compSpeed) public {
        vtxSpeeds[cToken] = compSpeed;
    }
}
