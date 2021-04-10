pragma solidity ^0.5.16;

import "./CErc20Delegate.sol";

interface CompLike {
  function delegate(address delegatee) external;
}

/**
 * @title Vortex's CCompLikeDelegate Contract
 * @notice CTokens which can 'delegate votes' of their underlying ERC-20
 * @author Vortex
 */
contract CCompLikeDelegate is CErc20Delegate {
  /**
   * @notice Construct an empty delegate
   */
  constructor() public CErc20Delegate() {}

  /**
   * @notice Admin call to delegate the votes of the VTX-like underlying
   * @param compLikeDelegatee The address to delegate votes to
   */
  function _delegateCompLikeTo(address compLikeDelegatee) external {
    require(msg.sender == admin, "only the admin may set the vtx-like delegate");
    CompLike(underlying).delegate(compLikeDelegatee);
  }
}
