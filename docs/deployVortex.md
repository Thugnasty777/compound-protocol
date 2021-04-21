# Vortex Deployment

## Recommended tools
- Remix ide

## Overview
1. Deploy Timelock contract
2. Deploy VTX token contract
3. Deploy Oracle proxy contract
4. Deploy Unitroller (Comptroller storage)
5. Deploy Comptroller (Comptroller implementation)
6. Configure Unitroller and Comptroller
7. Deploy vTokens

### Deploy Timelock contract
- Source Code: contracts/Timelock.sol
- Flatten Source Code: flats/Timelock_flat.sol
- Compiler Version: v0.5.16+commit.9c3226ce
- Optimization Enabled: Yes with 200 runs
- Contructor: Empty

### Deploy VTX token contract
- Source Code: contracts/Goverance/Vtx.sol
- Flatten Source Code: flats/Vtx_flat.sol
- Compiler Version: v0.5.16+commit.9c3226ce
- Optimization Enabled: Yes with 200 runs
- Constructor
    - account: The initial account to grant all the tokens

### Deploy oracle proxy contract
- Source Code: contracts/ChainlinkPriceOracle.sol
- Flatten Source Code: flats/ChainlinkPriceOracle_flat.sol
- Compiler Version: v0.5.16+commit.9c3226ce
- Optimization Enabled: Yes with 200 runs
- Constructor
    - ethUsdChainlinkAggregatorAddress_: The Chainlink aggregator address for ETH/USD. For mainnet it is `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419`

### Deploy Unitroller (Comptroller Storage)
- Source Code: contracts/Unitroller.sol
- Flatten Source Code: flats/Unitroller_flat.sol
- Compiler Version: v0.5.16+commit.9c3226ce
- Optimization Enabled: Yes with 200 runs
- Constructor: Empty

### Deploy Comptroller (Comptroller implementation)
The VTX address is hardcoded in the source code at the bottom. If you have a new VTX token address you need to **modify** the code before deploying
- Source Code: contracts/Comptroller.sol
- Flatten Source Code: flats/Comptroller_flat.sol
- Compiler Version: v0.5.16+commit.9c3226ce
- Optimization Enabled: Yes with 200 runs
- Constructor: Empty

### Configure Unitroller and Comptroller
1. Unitroller: Call `_setPendingImplementation(<COMPTROLLER_ADDRESS>)`
2. Comptroller: Call `_become(<UNITROLLER_ADDRESS>)`
3. Unitroller: Call `_setPriceOracle(<CHAINLINK_PRICE_ORACLE_PROXY_ADDRESS>)`
4. Unitroller: Call `_setCloseFactor(500000000000000000)` (set close factor to 50%) 0.5 ether
5. Unitroller: Call `_setLiquidationIncentive(1080000000000000000)` (set liquidation incentive to 108%) 1.08 ether