# Vortex Deployment

## Recommended tools
- Remix ide
- Saddle
Saddle setup
    - Run `npm run install`
    - Run `npm run compile`
Notes:
To deploy contracts using saddle please set the `ACCOUNT` env with your private key e.g `export ACCOUNT=<PRIVATE_KEY>`
while deploying the script also verfies the contract, to verify the contract please set the `VERIFY` env to true
e.g `VERIFY=true` and add your etherscan api to the `ETHERSCAN_API_KEY` env e.g `ETHERSCAN_API_KEY=<API_KEY>` to automatically
verify contracts after deploying

## Overview
1. Deploy Timelock contract
2. Deploy VTX token contract
3. Deploy Oracle proxy contract
4. Deploy Unitroller (Comptroller storage)
5. Deploy Comptroller (Comptroller implementation)
6. Configure Unitroller and Comptroller
7. Deploy vTokens

### Deploy Timelock contract
- Using remix:
    - Source Code: contracts/Timelock.sol
    - Compiler Version: v0.5.16+commit.9c3226ce
    - Optimization Enabled: Yes with 200 runs
    - Contructor: Empty
- Using saddle:
    - `npx saddle -n rinkeby script timelock:deploy '{
		"admin": "0x3a7386b069622D172c9E50332853a41a1Db134f9",
		"delay": 172800,
	}'`

### Deploy VTX token contract
- Using remix:
    - Source Code: contracts/Goverance/Vtx.sol
    - Compiler Version: v0.5.16+commit.9c3226ce
    - Optimization Enabled: Yes with 200 runs
    - Constructor
        - account: The initial account to grant all the tokens
- Using saddle:
    - `npx saddle -n rinkeby script vtx:deploy '{
		"account": "0x3a7386b069622D172c9E50332853a41a1Db134f9"
	}'`

### Deploy oracle proxy contract
- Using remix:
    - Source Code: contracts/ChainlinkPriceOracle.sol
    - Compiler Version: v0.5.16+commit.9c3226ce
    - Optimization Enabled: Yes with 200 runs
    - Constructor
        - ethUsdChainlinkAggregatorAddress_: The Chainlink aggregator address for ETH/USD. For mainnet it is `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419`
- Using saddle:
    - `npx saddle -n rinkeby script chainlinkProxy:deploy '{
		"ethUsdChainlinkAggregatorAddress": "0x3a7386b069622D172c9E50332853a41a1Db134f9"
	}'`

### Deploy Unitroller (Comptroller Storage)
- Using remix:
    - Source Code: contracts/Unitroller.sol
    - Compiler Version: v0.5.16+commit.9c3226ce
    - Optimization Enabled: Yes with 200 runs
    - Constructor: Empty
- Using saddle:
    - `npx saddle -n rinkeby script unitroller:deploy`

### Deploy Comptroller (Comptroller implementation)
The VTX address is hardcoded in the source code at the bottom. If you have a new VTX token address you need to **modify** the code before deploying
- Using remix:
    - Source Code: contracts/Comptroller.sol
    - Compiler Version: v0.5.16+commit.9c3226ce
    - Optimization Enabled: Yes with 200 runs
    - Constructor: Empty
- Using saddle:
    - `npx saddle -n rinkeby script comptroller:deploy`

### Configure Unitroller and Comptroller
1. Unitroller: Call `_setPendingImplementation(<COMPTROLLER_ADDRESS>)`
2. Comptroller: Call `_become(<UNITROLLER_ADDRESS>)`
3. Unitroller: Call `_setPriceOracle(<CHAINLINK_PRICE_ORACLE_PROXY_ADDRESS>)`
4. Unitroller: Call `_setCloseFactor(500000000000000000)` (set close factor to 50%) 0.5 ether
5. Unitroller: Call `_setLiquidationIncentive(1080000000000000000)` (set liquidation incentive to 108%) 1.08 ether