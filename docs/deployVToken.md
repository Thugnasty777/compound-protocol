# vToken Deploy

## Overview
1. Deploy VErc20Delegate contract
2. Deploy InterestRateModel contract
3. Deploy vToken contract
4. Configure Chainlink oracle proxy
5. Add the vToken to the money market
6. Configure collateral factor
7. Configure reserve factor

### Deploy VErc20Delegate contract
- Source Code: contracts/VErc20Delegate.sol
- Flatten Source Code: flats/VErc20Delegate_flat.sol
- Compiler Version: v0.5.16+commit.9c3226ce
- Optimization Enabled: Yes with 200 runs
- Contructor: Empty

### Deploy InterestRateModel contract
There are various interest rate model contracts e.g JumpRateModel.sol, JumpRateModelV2.sol, 
WhitePaperInterestRateModel.sol, DaiInterestRateModelV3.sol, we need to deploy the interest rate model 
that suits the type of vToken we want to deploy. Please **don't** deploy the 
legacy interest rate model contracts e.g LegacyJumpRateModelV2.sol, LegacyJumpRateModelV2.sol because
the Comptroller doesn't support them anymore.
- Source Code: contracts/JumpRateModelV2.sol
- Flatten Source Code: flats/JumpRateModelV2_flat.sol
- Compiler Version: v0.5.16+commit.9c3226ce
- Optimization Enabled: Yes with 200 runs
- Constructor:
    - baseRatePerYear: The target base APR scaled by 1e18
    - multiplierPerYear: The rate of increase in interest rate wrt utilization scaled by 1e19
    - jumpMultiplierPerYear: The multiplierPerBlock after htting a specified utilization point
    - kink_: The utilization point at which the jump multiplier is applied
    - owner_: The address of the owner, i.e the Timelock contract (which has the ability to update parameters directly)
- Constructor example (using JumpRateModelV2 on kovan):
    - baseRatePerYear: `19999999999728000`
    - multiplierPerYear: `224999999998516800`
    - jumpMultiplierPerYear: `1799999999998646400`
    - kink_: `750000000000000000`
    - owner_: `0x5182364f1D98525d5Ab2Bef42132B43745F297E5`

### Deploy vToken contract
- Source Code: contracts/VErc20Delegator.sol
- Flatten Source Code: flats/VErc20Delegator_flat.sol
- Compiler Version: v0.5.16+commit.9c3226ce
- Optimization Enabled: Yes with 200 runs
- Contructor
    - underlying_: The address of the underlying asset
    - comptroller_: The address of the Unitroller
    - interestRateModel_: The address of the interest rate model contract
    - initialExchangeRateMantissa_: The initial exchange rate, scaled by 1e18. The rate can be 
    calculated by this formula:
        - e.g If the decimals of the underlying asset is 18, then the rate will be 2 * 10^8 * 10^18 = 2e26
    - name_: name of this token
    - symbol_: symbol for this token
    - decimals_: decimal precision of this token. It is always 8
    - admin_: address of the administrator of this token i.e the Timelock 
    contract (which has the ability to update parameters 
    - implementation_: The address of the VErc20Delegate contract.
    - becomeImplementationData: The encoded args for becomeImplementation. This value is unused, 
    so set it to 0x0
- Constructor example (using vMKR on Kovan):
    - underlying_: `0x8939196e3e5b130f776c4e09208e00c3ca465d6a`
    - comptroller_: `0xc75bd46d58af863dc88593213cf3879b5a78eb18`
    - interestRateModel_: `0xbad185f268b29fdc645f6270fc9aa55feac41902`
    - initialExchangeRateMantissa_: `200000000000000000000000000`
    - name_: `Vortex Maker`
    - symbol_: `vMKR`
    - decimals_: `8`
    - admin_: `0x5182364f1D98525d5Ab2Bef42132B43745F297E5`
    - implementation_: `0x49e3970b26eb4bb6e7b3b818f979acc8fbe071cb`
    - becomeImplementationData: `0x`

### Configure Chainlink oracle proxy
- We need to call `setTokenConfigs` in the ChainlinkPriceOracleProxy
- `setTokenConfigs` params:
    - vTokenAddress: Address of the deployed vToken.
    - chainlinkAggregatorAddress: ChainLink Aggregator contract address (can be
    found here: [https://docs.chain.link/docs/reference-contracts](https://docs.chain.link/docs/reference-contracts))
    - chainlinkPriceBase: Price feed base unit: 0: invalid, 1: USD, 2: ETH, we have to check base unit of the price feed and set that.
    - underlyingTokenDecimals: Decimals of the underlying token
- `setTokenConfigs` example (using vMKR on kovan):
    - vTokenAddress: `0xAb88476DF9a81b810C7510fF7E13c2d26DcFa33A`
    - chainlinlAggregatorAddress: `0x0B156192e04bAD92B6C1C13cf8739d14D78D5701`
    - chainlinkPriceBase: `2`
    - underlyingTokenDecimals: `18`

### Add the vToken to the money market
- We need to call `_supportMarket` in Unitroller contract
- `_supportMarket` params:
    - vToken: Address of the deployed vToken
- `_supportMarket` example (using vMKR on kovan):
    - vToken: `0xAb88476DF9a81b810C7510fF7E13c2d26DcFa33A`

### Configure collateral factor
- We need to call `_setCollateralFactor` in Unitroller contract
- `_setCollateralFactor` params:
    - vToken: The market to set the factor on.
    - newCollateralFactorMantissa: The new collateral factor, scaled by 1e18
- `_setCollateralFactor` example (using vMKR with 60% collateral factor as example):
    - vToken: `0xAb88476DF9a81b810C7510fF7E13c2d26DcFa33A`
    - newCollateralFactorMantissa: `600000000000000000`

### Configure reserve factor
- We need to call `_setReserveFactor` in vToken contract
- `_setReserveFactor` params:
    - newReserveFactorMantissa: The new reserve factor, scaled by 1e18
- `_setReserveFactor` example (using vMKR with 40% reserve factor as example):
    - newReserveFactorMantissa: `400000000000000000`