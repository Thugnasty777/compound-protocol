# Vortex Operations

### How to verify contracts on Etherscan
After deploying the contract perform the following steps:
1. Verify and Publish
Under the contract address, next to the "Transaction" tab, you will
be able to find the "Code" tab. Then click on "Verify And Publish"
2. Verify Contract Code
    - Under Please select Compiler Type
    Select: `Solidity (Single file)`
    - Under Please select Compiler Version
    Select (the compiler version that was used to compile the contract): `v0.5.16+commit.9c3226ce`
    - Under Please select Open Source License Tyoe
    Select the license right license for the code
    - Click on Continue
3. Contract Source Code
    - Under Optimization
    Select: `Yes`
    - Under Enter the Solidity Contract Code below:
    Paste the flatten contract code
    - Under Contructor Arguments
    Make sure the arguments match deployment arguments
    - Verify and Publish

### Add support for a new vToken
We are adding the market to the markets mapping and setting it as listed
- We need to call `_supportMarket` in Unitroller contract
- `_supportMarket` params:
    - vToken: Address of the deployed vToken
- `_supportMarket` example (using vMKR on kovan):
    - vToken: `0xAb88476DF9a81b810C7510fF7E13c2d26DcFa33A`
