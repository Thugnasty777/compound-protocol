const {
  etherUnsigned,
  etherMantissa,
  etherExp,
} = require('./Utils/Ethereum');

const {
  makeComptroller,
  makeVToken,
  preApprove,
  preSupply,
  quickRedeem,
} = require('./Utils/Vortex');

async function compBalance(comptroller, user) {
  return etherUnsigned(await call(comptroller.vtx, 'balanceOf', [user]))
}

async function vtxAccrued(comptroller, user) {
  return etherUnsigned(await call(comptroller, 'vtxAccrued', [user]));
}

async function fastForwardPatch(patch, comptroller, blocks) {
  if (patch == 'unitroller') {
    return await send(comptroller, 'harnessFastForward', [blocks]);
  } else {
    return await send(comptroller, 'fastForward', [blocks]);
  }
}

const fs = require('fs');
const util = require('util');
const diffStringsUnified = require('jest-diff').default;


async function preRedeem(
  vToken,
  redeemer,
  redeemTokens,
  redeemAmount,
  exchangeRate
) {
  await preSupply(vToken, redeemer, redeemTokens);
  await send(vToken.underlying, 'harnessSetBalance', [
    vToken._address,
    redeemAmount
  ]);
}

const sortOpcodes = (opcodesMap) => {
  return Object.values(opcodesMap)
    .map(elem => [elem.fee, elem.name])
    .sort((a, b) => b[0] - a[0]);
};

const getGasCostFile = name => {
  try {
    const jsonString = fs.readFileSync(name);
    return JSON.parse(jsonString);
  } catch (err) {
    console.log(err);
    return {};
  }
};

const recordGasCost = (totalFee, key, filename, opcodes = {}) => {
  let fileObj = getGasCostFile(filename);
  const newCost = {fee: totalFee, opcodes: opcodes};
  console.log(diffStringsUnified(fileObj[key], newCost));
  fileObj[key] = newCost;
  fs.writeFileSync(filename, JSON.stringify(fileObj, null, ' '), 'utf-8');
};

async function mint(vToken, minter, mintAmount, exchangeRate) {
  expect(await preApprove(vToken, minter, mintAmount, {})).toSucceed();
  return send(vToken, 'mint', [mintAmount], { from: minter });
}

async function claimVtx(comptroller, holder) {
  return send(comptroller, 'claimVtx', [holder], { from: holder });
}

/// GAS PROFILER: saves a digest of the gas prices of common VToken operations
/// transiently fails, not sure why

describe('Gas report', () => {
  let root, minter, redeemer, accounts, vToken;
  const exchangeRate = 50e3;
  const preMintAmount = etherUnsigned(30e4);
  const mintAmount = etherUnsigned(10e4);
  const mintTokens = mintAmount.div(exchangeRate);
  const redeemTokens = etherUnsigned(10e3);
  const redeemAmount = redeemTokens.multipliedBy(exchangeRate);
  const filename = './gasCosts.json';

  describe('VToken', () => {
    beforeEach(async () => {
      [root, minter, redeemer, ...accounts] = saddle.accounts;
      vToken = await makeVToken({
        comptrollerOpts: { kind: 'bool'}, 
        interestRateModelOpts: { kind: 'white-paper'},
        exchangeRate
      });
    });

    it('first mint', async () => {
      await send(vToken, 'harnessSetAccrualBlockNumber', [40]);
      await send(vToken, 'harnessSetBlockNumber', [41]);

      const trxReceipt = await mint(vToken, minter, mintAmount, exchangeRate);
      recordGasCost(trxReceipt.gasUsed, 'first mint', filename);
    });

    it('second mint', async () => {
      await mint(vToken, minter, mintAmount, exchangeRate);

      await send(vToken, 'harnessSetAccrualBlockNumber', [40]);
      await send(vToken, 'harnessSetBlockNumber', [41]);

      const mint2Receipt = await mint(vToken, minter, mintAmount, exchangeRate);
      expect(Object.keys(mint2Receipt.events)).toEqual(['AccrueInterest', 'Transfer', 'Mint']);

      console.log(mint2Receipt.gasUsed);
      const opcodeCount = {};

      await saddle.trace(mint2Receipt, {
        execLog: log => {
          if (log.lastLog != undefined) {
            const key = `${log.op} @ ${log.gasCost}`;
            opcodeCount[key] = (opcodeCount[key] || 0) + 1;
          }
        }
      });

      recordGasCost(mint2Receipt.gasUsed, 'second mint', filename, opcodeCount);
    });

    it('second mint, no interest accrued', async () => {
      await mint(vToken, minter, mintAmount, exchangeRate);

      await send(vToken, 'harnessSetAccrualBlockNumber', [40]);
      await send(vToken, 'harnessSetBlockNumber', [40]);

      const mint2Receipt = await mint(vToken, minter, mintAmount, exchangeRate);
      expect(Object.keys(mint2Receipt.events)).toEqual(['Transfer', 'Mint']);
      recordGasCost(mint2Receipt.gasUsed, 'second mint, no interest accrued', filename);

      // console.log("NO ACCRUED");
      // const opcodeCount = {};
      // await saddle.trace(mint2Receipt, {
      //   execLog: log => {
      //     opcodeCount[log.op] = (opcodeCount[log.op] || 0) + 1;
      //   }
      // });
      // console.log(getOpcodeDigest(opcodeCount));
    });

    it('redeem', async () => {
      await preRedeem(vToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
      const trxReceipt = await quickRedeem(vToken, redeemer, redeemTokens);
      recordGasCost(trxReceipt.gasUsed, 'redeem', filename);
    });

    it.skip('print mint opcode list', async () => {
      await preMint(vToken, minter, mintAmount, mintTokens, exchangeRate);
      const trxReceipt = await quickMint(vToken, minter, mintAmount);
      const opcodeCount = {};
      await saddle.trace(trxReceipt, {
        execLog: log => {
          opcodeCount[log.op] = (opcodeCount[log.op] || 0) + 1;
        }
      });
      console.log(getOpcodeDigest(opcodeCount));
    });
  });

  describe.each([
    ['unitroller-g6'],
    ['unitroller']
  ])('Vtx claims %s', (patch) => {
    beforeEach(async () => {
      [root, minter, redeemer, ...accounts] = saddle.accounts;
      comptroller = await makeComptroller({ kind: patch });
      let interestRateModelOpts = {borrowRate: 0.000001};
      vToken = await makeVToken({comptroller, supportMarket: true, underlyingPrice: 2, interestRateModelOpts});
      if (patch == 'unitroller') {
        await send(comptroller, '_setVtxSpeed', [vToken._address, etherExp(0.05)]);
      } else {
        await send(comptroller, '_addVtxMarkets', [[vToken].map(c => c._address)]);
        await send(comptroller, 'setVtxSpeed', [vToken._address, etherExp(0.05)]);
      }
      await send(comptroller.vtx, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});
    });

    it(`${patch} second mint with vtx accrued`, async () => {
      await mint(vToken, minter, mintAmount, exchangeRate);

      await fastForwardPatch(patch, comptroller, 10);

      console.log('Vtx balance before mint', (await compBalance(comptroller, minter)).toString());
      console.log('Vtx accrued before mint', (await vtxAccrued(comptroller, minter)).toString());
      const mint2Receipt = await mint(vToken, minter, mintAmount, exchangeRate);
      console.log('Vtx balance after mint', (await compBalance(comptroller, minter)).toString());
      console.log('Vtx accrued after mint', (await vtxAccrued(comptroller, minter)).toString());
      recordGasCost(mint2Receipt.gasUsed, `${patch} second mint with vtx accrued`, filename);
    });

    it(`${patch} claim vtx`, async () => {
      await mint(vToken, minter, mintAmount, exchangeRate);

      await fastForwardPatch(patch, comptroller, 10);

      console.log('Vtx balance before claim', (await compBalance(comptroller, minter)).toString());
      console.log('Vtx accrued before claim', (await vtxAccrued(comptroller, minter)).toString());
      const claimReceipt = await claimVtx(comptroller, minter);
      console.log('Vtx balance after claim', (await compBalance(comptroller, minter)).toString());
      console.log('Vtx accrued after claim', (await vtxAccrued(comptroller, minter)).toString());
      recordGasCost(claimReceipt.gasUsed, `${patch} claim vtx`, filename);
    });
  });
});
