const {
  makeComptroller,
  makeCToken,
  balanceOf,
  fastForward,
  pretendBorrow,
  quickMint
} = require('../Utils/Vortex');
const {
  etherExp,
  etherDouble,
  etherUnsigned,
  etherMantissa
} = require('../Utils/Ethereum');

const vtxRate = etherUnsigned(1e18);

async function vtxAccrued(comptroller, user) {
  return etherUnsigned(await call(comptroller, 'vtxAccrued', [user]));
}

async function compBalance(comptroller, user) {
  return etherUnsigned(await call(comptroller.vtx, 'balanceOf', [user]))
}

async function totalVtxAccrued(comptroller, user) {
  return (await vtxAccrued(comptroller, user)).plus(await compBalance(comptroller, user));
}

describe('Flywheel upgrade', () => {
  describe('becomes the comptroller', () => {
    it('adds the vtx markets', async () => {
      let root = saddle.accounts[0];
      let unitroller = await makeComptroller({kind: 'unitroller-g2'});
      let compMarkets = await Promise.all([1, 2, 3].map(async _ => {
        return makeCToken({comptroller: unitroller, supportMarket: true});
      }));
      compMarkets = compMarkets.map(c => c._address);
      unitroller = await makeComptroller({kind: 'unitroller-g3', unitroller, compMarkets});
      expect(await call(unitroller, 'getVtxMarkets')).toEqual(compMarkets);
    });

    it('adds the other markets', async () => {
      let root = saddle.accounts[0];
      let unitroller = await makeComptroller({kind: 'unitroller-g2'});
      let allMarkets = await Promise.all([1, 2, 3].map(async _ => {
        return makeCToken({comptroller: unitroller, supportMarket: true});
      }));
      allMarkets = allMarkets.map(c => c._address);
      unitroller = await makeComptroller({
        kind: 'unitroller-g3',
        unitroller,
        compMarkets: allMarkets.slice(0, 1),
        otherMarkets: allMarkets.slice(1)
      });
      expect(await call(unitroller, 'getAllMarkets')).toEqual(allMarkets);
      expect(await call(unitroller, 'getVtxMarkets')).toEqual(allMarkets.slice(0, 1));
    });

    it('_supportMarket() adds to all markets, and only once', async () => {
      let root = saddle.accounts[0];
      let unitroller = await makeComptroller({kind: 'unitroller-g3'});
      let allMarkets = [];
      for (let _ of Array(10)) {
        allMarkets.push(await makeCToken({comptroller: unitroller, supportMarket: true}));
      }
      expect(await call(unitroller, 'getAllMarkets')).toEqual(allMarkets.map(c => c._address));
      expect(
        makeComptroller({
          kind: 'unitroller-g3',
          unitroller,
          otherMarkets: [allMarkets[0]._address]
        })
      ).rejects.toRevert('revert market already added');
    });
  });
});

describe('Flywheel', () => {
  let root, a1, a2, a3, accounts;
  let comptroller, cLOW, cREP, cZRX, cEVIL;
  beforeEach(async () => {
    let interestRateModelOpts = {borrowRate: 0.000001};
    [root, a1, a2, a3, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    cLOW = await makeCToken({comptroller, supportMarket: true, underlyingPrice: 1, interestRateModelOpts});
    cREP = await makeCToken({comptroller, supportMarket: true, underlyingPrice: 2, interestRateModelOpts});
    cZRX = await makeCToken({comptroller, supportMarket: true, underlyingPrice: 3, interestRateModelOpts});
    cEVIL = await makeCToken({comptroller, supportMarket: false, underlyingPrice: 3, interestRateModelOpts});
  });

  describe('_grantVtx()', () => {
    beforeEach(async () => {
      await send(comptroller.vtx, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});
    });

    it('should award vtx if called by admin', async () => {
      const tx = await send(comptroller, '_grantVtx', [a1, 100]);
      expect(tx).toHaveLog('VtxGranted', {
        recipient: a1,
        amount: 100
      });
    });

    it('should revert if not called by admin', async () => {
      await expect(
        send(comptroller, '_grantVtx', [a1, 100], {from: a1})
      ).rejects.toRevert('revert only admin can grant vtx');
    });

    it('should revert if insufficient vtx', async () => {
      await expect(
        send(comptroller, '_grantVtx', [a1, etherUnsigned(1e20)])
      ).rejects.toRevert('revert insufficient vtx for grant');
    });
  });

  describe('getVtxMarkets()', () => {
    it('should return the vtx markets', async () => {
      for (let mkt of [cLOW, cREP, cZRX]) {
        await send(comptroller, '_setVtxSpeed', [mkt._address, etherExp(0.5)]);
      }
      expect(await call(comptroller, 'getVtxMarkets')).toEqual(
        [cLOW, cREP, cZRX].map((c) => c._address)
      );
    });
  });

  describe('_setVtxSpeed()', () => {
    it('should update market index when calling setVtxSpeed', async () => {
      const mkt = cREP;
      await send(comptroller, 'setBlockNumber', [0]);
      await send(mkt, 'harnessSetTotalSupply', [etherUnsigned(10e18)]);

      await send(comptroller, '_setVtxSpeed', [mkt._address, etherExp(0.5)]);
      await fastForward(comptroller, 20);
      await send(comptroller, '_setVtxSpeed', [mkt._address, etherExp(1)]);

      const {index, block} = await call(comptroller, 'vtxSupplyState', [mkt._address]);
      expect(index).toEqualNumber(2e36);
      expect(block).toEqualNumber(20);
    });

    it('should correctly drop a vtx market if called by admin', async () => {
      for (let mkt of [cLOW, cREP, cZRX]) {
        await send(comptroller, '_setVtxSpeed', [mkt._address, etherExp(0.5)]);
      }
      const tx = await send(comptroller, '_setVtxSpeed', [cLOW._address, 0]);
      expect(await call(comptroller, 'getVtxMarkets')).toEqual(
        [cREP, cZRX].map((c) => c._address)
      );
      expect(tx).toHaveLog('VtxSpeedUpdated', {
        cToken: cLOW._address,
        newSpeed: 0
      });
    });

    it('should correctly drop a vtx market from middle of array', async () => {
      for (let mkt of [cLOW, cREP, cZRX]) {
        await send(comptroller, '_setVtxSpeed', [mkt._address, etherExp(0.5)]);
      }
      await send(comptroller, '_setVtxSpeed', [cREP._address, 0]);
      expect(await call(comptroller, 'getVtxMarkets')).toEqual(
        [cLOW, cZRX].map((c) => c._address)
      );
    });

    it('should not drop a vtx market unless called by admin', async () => {
      for (let mkt of [cLOW, cREP, cZRX]) {
        await send(comptroller, '_setVtxSpeed', [mkt._address, etherExp(0.5)]);
      }
      await expect(
        send(comptroller, '_setVtxSpeed', [cLOW._address, 0], {from: a1})
      ).rejects.toRevert('revert only admin can set vtx speed');
    });

    it('should not add non-listed markets', async () => {
      const cBAT = await makeCToken({ comptroller, supportMarket: false });
      await expect(
        send(comptroller, 'harnessAddVtxMarkets', [[cBAT._address]])
      ).rejects.toRevert('revert vtx market is not listed');

      const markets = await call(comptroller, 'getVtxMarkets');
      expect(markets).toEqual([]);
    });
  });

  describe('updateVtxBorrowIndex()', () => {
    it('should calculate vtx borrower index correctly', async () => {
      const mkt = cREP;
      await send(comptroller, '_setVtxSpeed', [mkt._address, etherExp(0.5)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalBorrows', [etherUnsigned(11e18)]);
      await send(comptroller, 'harnessUpdateVtxBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);
      /*
        100 blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed

        borrowAmt   = totalBorrows * 1e18 / borrowIdx
                    = 11e18 * 1e18 / 1.1e18 = 10e18
        vtxAccrued = deltaBlocks * borrowSpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += 1e36 + vtxAccrued * 1e36 / borrowAmt
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */

      const {index, block} = await call(comptroller, 'vtxBorrowState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not revert or update vtxBorrowState index if cToken not in VTX markets', async () => {
      const mkt = await makeCToken({
        comptroller: comptroller,
        supportMarket: true,
        addVtxMarket: false,
      });
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdateVtxBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'vtxBorrowState', [mkt._address]);
      expect(index).toEqualNumber(0);
      expect(block).toEqualNumber(100);
      const speed = await call(comptroller, 'vtxSpeeds', [mkt._address]);
      expect(speed).toEqualNumber(0);
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = cREP;
      await send(comptroller, '_setVtxSpeed', [mkt._address, etherExp(0.5)]);
      await send(comptroller, 'harnessUpdateVtxBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'vtxBorrowState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });

    it('should not update index if vtx speed is 0', async () => {
      const mkt = cREP;
      await send(comptroller, '_setVtxSpeed', [mkt._address, etherExp(0.5)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, '_setVtxSpeed', [mkt._address, etherExp(0)]);
      await send(comptroller, 'harnessUpdateVtxBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'vtxBorrowState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(100);
    });
  });

  describe('updateVtxSupplyIndex()', () => {
    it('should calculate vtx supplier index correctly', async () => {
      const mkt = cREP;
      await send(comptroller, '_setVtxSpeed', [mkt._address, etherExp(0.5)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalSupply', [etherUnsigned(10e18)]);
      await send(comptroller, 'harnessUpdateVtxSupplyIndex', [mkt._address]);
      /*
        suppyTokens = 10e18
        vtxAccrued = deltaBlocks * supplySpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += vtxAccrued * 1e36 / supplyTokens
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */
      const {index, block} = await call(comptroller, 'vtxSupplyState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not update index on non-VTX markets', async () => {
      const mkt = await makeCToken({
        comptroller: comptroller,
        supportMarket: true,
        addVtxMarket: false
      });
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdateVtxSupplyIndex', [
        mkt._address
      ]);

      const {index, block} = await call(comptroller, 'vtxSupplyState', [mkt._address]);
      expect(index).toEqualNumber(0);
      expect(block).toEqualNumber(100);
      const speed = await call(comptroller, 'vtxSpeeds', [mkt._address]);
      expect(speed).toEqualNumber(0);
      // ctoken could have no vtx speed or vtx supplier state if not in vtx markets
      // this logic could also possibly be implemented in the allowed hook
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = cREP;
      await send(comptroller, 'setBlockNumber', [0]);
      await send(mkt, 'harnessSetTotalSupply', [etherUnsigned(10e18)]);
      await send(comptroller, '_setVtxSpeed', [mkt._address, etherExp(0.5)]);
      await send(comptroller, 'harnessUpdateVtxSupplyIndex', [mkt._address]);

      const {index, block} = await call(comptroller, 'vtxSupplyState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });

    it('should not matter if the index is updated multiple times', async () => {
      const compRemaining = vtxRate.multipliedBy(100)
      await send(comptroller, 'harnessAddVtxMarkets', [[cLOW._address]]);
      await send(comptroller.vtx, 'transfer', [comptroller._address, compRemaining], {from: root});
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessRefreshVtxSpeeds');

      await quickMint(cLOW, a2, etherUnsigned(10e18));
      await quickMint(cLOW, a3, etherUnsigned(15e18));

      const a2Accrued0 = await totalVtxAccrued(comptroller, a2);
      const a3Accrued0 = await totalVtxAccrued(comptroller, a3);
      const a2Balance0 = await balanceOf(cLOW, a2);
      const a3Balance0 = await balanceOf(cLOW, a3);

      await fastForward(comptroller, 20);

      const txT1 = await send(cLOW, 'transfer', [a2, a3Balance0.minus(a2Balance0)], {from: a3});

      const a2Accrued1 = await totalVtxAccrued(comptroller, a2);
      const a3Accrued1 = await totalVtxAccrued(comptroller, a3);
      const a2Balance1 = await balanceOf(cLOW, a2);
      const a3Balance1 = await balanceOf(cLOW, a3);

      await fastForward(comptroller, 10);
      await send(comptroller, 'harnessUpdateVtxSupplyIndex', [cLOW._address]);
      await fastForward(comptroller, 10);

      const txT2 = await send(cLOW, 'transfer', [a3, a2Balance1.minus(a3Balance1)], {from: a2});

      const a2Accrued2 = await totalVtxAccrued(comptroller, a2);
      const a3Accrued2 = await totalVtxAccrued(comptroller, a3);

      expect(a2Accrued0).toEqualNumber(0);
      expect(a3Accrued0).toEqualNumber(0);
      expect(a2Accrued1).not.toEqualNumber(0);
      expect(a3Accrued1).not.toEqualNumber(0);
      expect(a2Accrued1).toEqualNumber(a3Accrued2.minus(a3Accrued1));
      expect(a3Accrued1).toEqualNumber(a2Accrued2.minus(a2Accrued1));

      expect(txT1.gasUsed).toBeLessThan(200000);
      expect(txT1.gasUsed).toBeGreaterThan(140000);
      expect(txT2.gasUsed).toBeLessThan(150000);
      expect(txT2.gasUsed).toBeGreaterThan(100000);
    });
  });

  describe('distributeBorrowerVtx()', () => {

    it('should update borrow index checkpoint but not vtxAccrued for first time user', async () => {
      const mkt = cREP;
      await send(comptroller, "setVtxBorrowState", [mkt._address, etherDouble(6), 10]);
      await send(comptroller, "setVtxBorrowerIndex", [mkt._address, root, etherUnsigned(0)]);

      await send(comptroller, "harnessDistributeBorrowerVtx", [mkt._address, root, etherExp(1.1)]);
      expect(await call(comptroller, "vtxAccrued", [root])).toEqualNumber(0);
      expect(await call(comptroller, "vtxBorrowerIndex", [ mkt._address, root])).toEqualNumber(6e36);
    });

    it('should transfer vtx and update borrow index checkpoint correctly for repeat time user', async () => {
      const mkt = cREP;
      await send(comptroller.vtx, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, etherUnsigned(5.5e18), etherExp(1)]);
      await send(comptroller, "setVtxBorrowState", [mkt._address, etherDouble(6), 10]);
      await send(comptroller, "setVtxBorrowerIndex", [mkt._address, a1, etherDouble(1)]);

      /*
      * 100 delta blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed => 6e18 compBorrowIndex
      * this tests that an acct with half the total borrows over that time gets 25e18 VTX
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e18 * 1e18 / 1.1e18 = 5e18
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 6e36 - 1e36 = 5e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e18 * 5e36 / 1e36 = 25e18
      */
      const tx = await send(comptroller, "harnessDistributeBorrowerVtx", [mkt._address, a1, etherUnsigned(1.1e18)]);
      expect(await vtxAccrued(comptroller, a1)).toEqualNumber(25e18);
      expect(await compBalance(comptroller, a1)).toEqualNumber(0);
      expect(tx).toHaveLog('DistributedBorrowerVtx', {
        cToken: mkt._address,
        borrower: a1,
        compDelta: etherUnsigned(25e18).toFixed(),
        compBorrowIndex: etherDouble(6).toFixed()
      });
    });

    it('should not transfer vtx automatically', async () => {
      const mkt = cREP;
      await send(comptroller.vtx, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, etherUnsigned(5.5e17), etherExp(1)]);
      await send(comptroller, "setVtxBorrowState", [mkt._address, etherDouble(1.0019), 10]);
      await send(comptroller, "setVtxBorrowerIndex", [mkt._address, a1, etherDouble(1)]);
      /*
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e17 * 1e18 / 1.1e18 = 5e17
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 1.0019e36 - 1e36 = 0.0019e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
        0.00095e18 < compClaimThreshold of 0.001e18
      */
      await send(comptroller, "harnessDistributeBorrowerVtx", [mkt._address, a1, etherExp(1.1)]);
      expect(await vtxAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await compBalance(comptroller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-VTX market', async () => {
      const mkt = await makeCToken({
        comptroller: comptroller,
        supportMarket: true,
        addVtxMarket: false,
      });

      await send(comptroller, "harnessDistributeBorrowerVtx", [mkt._address, a1, etherExp(1.1)]);
      expect(await vtxAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await compBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, 'vtxBorrowerIndex', [mkt._address, a1])).toEqualNumber(0);
    });
  });

  describe('distributeSupplierVtx()', () => {
    it('should transfer vtx and update supply index correctly for first time user', async () => {
      const mkt = cREP;
      await send(comptroller.vtx, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, etherUnsigned(5e18)]);
      await send(comptroller, "setVtxSupplyState", [mkt._address, etherDouble(6), 10]);
      /*
      * 100 delta blocks, 10e18 total supply, 0.5e18 supplySpeed => 6e18 compSupplyIndex
      * confirming an acct with half the total supply over that time gets 25e18 VTX:
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 1e36 = 5e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 5e36 / 1e36 = 25e18
      */

      const tx = await send(comptroller, "harnessDistributeAllSupplierComp", [mkt._address, a1]);
      expect(await vtxAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await compBalance(comptroller, a1)).toEqualNumber(25e18);
      expect(tx).toHaveLog('DistributedSupplierVtx', {
        cToken: mkt._address,
        supplier: a1,
        compDelta: etherUnsigned(25e18).toFixed(),
        compSupplyIndex: etherDouble(6).toFixed()
      });
    });

    it('should update vtx accrued and supply index for repeat user', async () => {
      const mkt = cREP;
      await send(comptroller.vtx, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, etherUnsigned(5e18)]);
      await send(comptroller, "setVtxSupplyState", [mkt._address, etherDouble(6), 10]);
      await send(comptroller, "setVtxSupplierIndex", [mkt._address, a1, etherDouble(2)])
      /*
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 2e36 = 4e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 4e36 / 1e36 = 20e18
      */

      await send(comptroller, "harnessDistributeAllSupplierComp", [mkt._address, a1]);
      expect(await vtxAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await compBalance(comptroller, a1)).toEqualNumber(20e18);
    });

    it('should not transfer when vtxAccrued below threshold', async () => {
      const mkt = cREP;
      await send(comptroller.vtx, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, etherUnsigned(5e17)]);
      await send(comptroller, "setVtxSupplyState", [mkt._address, etherDouble(1.0019), 10]);
      /*
        supplierAmount  = 5e17
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 1.0019e36 - 1e36 = 0.0019e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
      */

      await send(comptroller, "harnessDistributeSupplierVtx", [mkt._address, a1]);
      expect(await vtxAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await compBalance(comptroller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-VTX market', async () => {
      const mkt = await makeCToken({
        comptroller: comptroller,
        supportMarket: true,
        addVtxMarket: false,
      });

      await send(comptroller, "harnessDistributeSupplierVtx", [mkt._address, a1]);
      expect(await vtxAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await compBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, 'vtxBorrowerIndex', [mkt._address, a1])).toEqualNumber(0);
    });

  });

  describe('transferVtx', () => {
    it('should transfer vtx accrued when amount is above threshold', async () => {
      const compRemaining = 1000, a1AccruedPre = 100, threshold = 1;
      const compBalancePre = await compBalance(comptroller, a1);
      const tx0 = await send(comptroller.vtx, 'transfer', [comptroller._address, compRemaining], {from: root});
      const tx1 = await send(comptroller, 'setVtxAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferVtx', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await vtxAccrued(comptroller, a1);
      const compBalancePost = await compBalance(comptroller, a1);
      expect(compBalancePre).toEqualNumber(0);
      expect(compBalancePost).toEqualNumber(a1AccruedPre);
    });

    it('should not transfer when vtx accrued is below threshold', async () => {
      const compRemaining = 1000, a1AccruedPre = 100, threshold = 101;
      const compBalancePre = await call(comptroller.vtx, 'balanceOf', [a1]);
      const tx0 = await send(comptroller.vtx, 'transfer', [comptroller._address, compRemaining], {from: root});
      const tx1 = await send(comptroller, 'setVtxAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferVtx', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await vtxAccrued(comptroller, a1);
      const compBalancePost = await compBalance(comptroller, a1);
      expect(compBalancePre).toEqualNumber(0);
      expect(compBalancePost).toEqualNumber(0);
    });

    it('should not transfer vtx if vtx accrued is greater than vtx remaining', async () => {
      const compRemaining = 99, a1AccruedPre = 100, threshold = 1;
      const compBalancePre = await compBalance(comptroller, a1);
      const tx0 = await send(comptroller.vtx, 'transfer', [comptroller._address, compRemaining], {from: root});
      const tx1 = await send(comptroller, 'setVtxAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferVtx', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await vtxAccrued(comptroller, a1);
      const compBalancePost = await compBalance(comptroller, a1);
      expect(compBalancePre).toEqualNumber(0);
      expect(compBalancePost).toEqualNumber(0);
    });
  });

  describe('claimVtx', () => {
    it('should accrue vtx and then transfer vtx accrued', async () => {
      const compRemaining = vtxRate.multipliedBy(100), mintAmount = etherUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.vtx, 'transfer', [comptroller._address, compRemaining], {from: root});
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await send(comptroller, '_setVtxSpeed', [cLOW._address, etherExp(0.5)]);
      await send(comptroller, 'harnessRefreshVtxSpeeds');
      const speed = await call(comptroller, 'vtxSpeeds', [cLOW._address]);
      const a2AccruedPre = await vtxAccrued(comptroller, a2);
      const compBalancePre = await compBalance(comptroller, a2);
      await quickMint(cLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimVtx', [a2]);
      const a2AccruedPost = await vtxAccrued(comptroller, a2);
      const compBalancePost = await compBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(400000);
      expect(speed).toEqualNumber(vtxRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(compBalancePre).toEqualNumber(0);
      expect(compBalancePost).toEqualNumber(vtxRate.multipliedBy(deltaBlocks).minus(1)); // index is 8333...
    });

    it('should accrue vtx and then transfer vtx accrued in a single market', async () => {
      const compRemaining = vtxRate.multipliedBy(100), mintAmount = etherUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.vtx, 'transfer', [comptroller._address, compRemaining], {from: root});
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddVtxMarkets', [[cLOW._address]]);
      await send(comptroller, 'harnessRefreshVtxSpeeds');
      const speed = await call(comptroller, 'vtxSpeeds', [cLOW._address]);
      const a2AccruedPre = await vtxAccrued(comptroller, a2);
      const compBalancePre = await compBalance(comptroller, a2);
      await quickMint(cLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimVtx', [a2, [cLOW._address]]);
      const a2AccruedPost = await vtxAccrued(comptroller, a2);
      const compBalancePost = await compBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(170000);
      expect(speed).toEqualNumber(vtxRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(compBalancePre).toEqualNumber(0);
      expect(compBalancePost).toEqualNumber(vtxRate.multipliedBy(deltaBlocks).minus(1)); // index is 8333...
    });

    it('should claim when vtx accrued is below threshold', async () => {
      const compRemaining = etherExp(1), accruedAmt = etherUnsigned(0.0009e18)
      await send(comptroller.vtx, 'transfer', [comptroller._address, compRemaining], {from: root});
      await send(comptroller, 'setVtxAccrued', [a1, accruedAmt]);
      await send(comptroller, 'claimVtx', [a1, [cLOW._address]]);
      expect(await vtxAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await compBalance(comptroller, a1)).toEqualNumber(accruedAmt);
    });

    it('should revert when a market is not listed', async () => {
      const cNOT = await makeCToken({comptroller});
      await expect(
        send(comptroller, 'claimVtx', [a1, [cNOT._address]])
      ).rejects.toRevert('revert market must be listed');
    });
  });

  describe('claimVtx batch', () => {
    it('should revert when claiming vtx from non-listed market', async () => {
      const compRemaining = vtxRate.multipliedBy(100), deltaBlocks = 10, mintAmount = etherExp(10);
      await send(comptroller.vtx, 'transfer', [comptroller._address, compRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;

      for(let from of claimAccts) {
        expect(await send(cLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(cLOW.underlying, 'approve', [cLOW._address, mintAmount], { from });
        send(cLOW, 'mint', [mintAmount], { from });
      }

      await pretendBorrow(cLOW, root, 1, 1, etherExp(10));
      await send(comptroller, 'harnessRefreshVtxSpeeds');

      await fastForward(comptroller, deltaBlocks);

      await expect(send(comptroller, 'claimVtx', [claimAccts, [cLOW._address, cEVIL._address], true, true])).rejects.toRevert('revert market must be listed');
    });

    it('should claim the expected amount when holders and ctokens arg is duplicated', async () => {
      const compRemaining = vtxRate.multipliedBy(100), deltaBlocks = 10, mintAmount = etherExp(10);
      await send(comptroller.vtx, 'transfer', [comptroller._address, compRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(cLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(cLOW.underlying, 'approve', [cLOW._address, mintAmount], { from });
        send(cLOW, 'mint', [mintAmount], { from });
      }
      await pretendBorrow(cLOW, root, 1, 1, etherExp(10));
      await send(comptroller, 'harnessAddVtxMarkets', [[cLOW._address]]);
      await send(comptroller, 'harnessRefreshVtxSpeeds');

      await fastForward(comptroller, deltaBlocks);

      const tx = await send(comptroller, 'claimVtx', [[...claimAccts, ...claimAccts], [cLOW._address, cLOW._address], false, true]);
      // vtx distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'vtxSupplierIndex', [cLOW._address, acct])).toEqualNumber(etherDouble(1.125));
        expect(await compBalance(comptroller, acct)).toEqualNumber(etherExp(1.25));
      }
    });

    it('claims vtx for multiple suppliers only', async () => {
      const compRemaining = vtxRate.multipliedBy(100), deltaBlocks = 10, mintAmount = etherExp(10);
      await send(comptroller.vtx, 'transfer', [comptroller._address, compRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(cLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(cLOW.underlying, 'approve', [cLOW._address, mintAmount], { from });
        send(cLOW, 'mint', [mintAmount], { from });
      }
      await pretendBorrow(cLOW, root, 1, 1, etherExp(10));
      await send(comptroller, 'harnessAddVtxMarkets', [[cLOW._address]]);
      await send(comptroller, 'harnessRefreshVtxSpeeds');

      await fastForward(comptroller, deltaBlocks);

      const tx = await send(comptroller, 'claimVtx', [claimAccts, [cLOW._address], false, true]);
      // vtx distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'vtxSupplierIndex', [cLOW._address, acct])).toEqualNumber(etherDouble(1.125));
        expect(await compBalance(comptroller, acct)).toEqualNumber(etherExp(1.25));
      }
    });

    it('claims vtx for multiple borrowers only, primes uninitiated', async () => {
      const compRemaining = vtxRate.multipliedBy(100), deltaBlocks = 10, mintAmount = etherExp(10), borrowAmt = etherExp(1), borrowIdx = etherExp(1)
      await send(comptroller.vtx, 'transfer', [comptroller._address, compRemaining], {from: root});
      let [_,__, ...claimAccts] = saddle.accounts;

      for(let acct of claimAccts) {
        await send(cLOW, 'harnessIncrementTotalBorrows', [borrowAmt]);
        await send(cLOW, 'harnessSetAccountBorrows', [acct, borrowAmt, borrowIdx]);
      }
      await send(comptroller, 'harnessAddVtxMarkets', [[cLOW._address]]);
      await send(comptroller, 'harnessRefreshVtxSpeeds');

      await send(comptroller, 'harnessFastForward', [10]);

      const tx = await send(comptroller, 'claimVtx', [claimAccts, [cLOW._address], true, false]);
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'vtxBorrowerIndex', [cLOW._address, acct])).toEqualNumber(etherDouble(2.25));
        expect(await call(comptroller, 'vtxSupplierIndex', [cLOW._address, acct])).toEqualNumber(0);
      }
    });

    it('should revert when a market is not listed', async () => {
      const cNOT = await makeCToken({comptroller});
      await expect(
        send(comptroller, 'claimVtx', [[a1, a2], [cNOT._address], true, true])
      ).rejects.toRevert('revert market must be listed');
    });
  });

  describe('harnessRefreshVtxSpeeds', () => {
    it('should start out 0', async () => {
      await send(comptroller, 'harnessRefreshVtxSpeeds');
      const speed = await call(comptroller, 'vtxSpeeds', [cLOW._address]);
      expect(speed).toEqualNumber(0);
    });

    it('should get correct speeds with borrows', async () => {
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddVtxMarkets', [[cLOW._address]]);
      const tx = await send(comptroller, 'harnessRefreshVtxSpeeds');
      const speed = await call(comptroller, 'vtxSpeeds', [cLOW._address]);
      expect(speed).toEqualNumber(vtxRate);
      expect(tx).toHaveLog(['VtxSpeedUpdated', 0], {
        cToken: cLOW._address,
        newSpeed: speed
      });
    });

    it('should get correct speeds for 2 assets', async () => {
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await pretendBorrow(cZRX, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddVtxMarkets', [[cLOW._address, cZRX._address]]);
      await send(comptroller, 'harnessRefreshVtxSpeeds');
      const speed1 = await call(comptroller, 'vtxSpeeds', [cLOW._address]);
      const speed2 = await call(comptroller, 'vtxSpeeds', [cREP._address]);
      const speed3 = await call(comptroller, 'vtxSpeeds', [cZRX._address]);
      expect(speed1).toEqualNumber(vtxRate.dividedBy(4));
      expect(speed2).toEqualNumber(0);
      expect(speed3).toEqualNumber(vtxRate.dividedBy(4).multipliedBy(3));
    });
  });

  describe('harnessAddVtxMarkets', () => {
    it('should correctly add a vtx market if called by admin', async () => {
      const cBAT = await makeCToken({comptroller, supportMarket: true});
      const tx1 = await send(comptroller, 'harnessAddVtxMarkets', [[cLOW._address, cREP._address, cZRX._address]]);
      const tx2 = await send(comptroller, 'harnessAddVtxMarkets', [[cBAT._address]]);
      const markets = await call(comptroller, 'getVtxMarkets');
      expect(markets).toEqual([cLOW, cREP, cZRX, cBAT].map((c) => c._address));
      expect(tx2).toHaveLog('VtxSpeedUpdated', {
        cToken: cBAT._address,
        newSpeed: 1
      });
    });

    it('should not write over a markets existing state', async () => {
      const mkt = cLOW._address;
      const bn0 = 10, bn1 = 20;
      const idx = etherUnsigned(1.5e36);

      await send(comptroller, "harnessAddVtxMarkets", [[mkt]]);
      await send(comptroller, "setVtxSupplyState", [mkt, idx, bn0]);
      await send(comptroller, "setVtxBorrowState", [mkt, idx, bn0]);
      await send(comptroller, "setBlockNumber", [bn1]);
      await send(comptroller, "_setVtxSpeed", [mkt, 0]);
      await send(comptroller, "harnessAddVtxMarkets", [[mkt]]);

      const supplyState = await call(comptroller, 'vtxSupplyState', [mkt]);
      expect(supplyState.block).toEqual(bn1.toString());
      expect(supplyState.index).toEqual(idx.toFixed());

      const borrowState = await call(comptroller, 'vtxBorrowState', [mkt]);
      expect(borrowState.block).toEqual(bn1.toString());
      expect(borrowState.index).toEqual(idx.toFixed());
    });
  });


  describe('updateContributorRewards', () => {
    it('should not fail when contributor rewards called on non-contributor', async () => {
      const tx1 = await send(comptroller, 'updateContributorRewards', [a1]);
    });

    it('should accrue vtx to contributors', async () => {
      const tx1 = await send(comptroller, '_setContributorVtxSpeed', [a1, 2000]);
      await fastForward(comptroller, 50);

      const a1Accrued = await vtxAccrued(comptroller, a1);
      expect(a1Accrued).toEqualNumber(0);

      const tx2 = await send(comptroller, 'updateContributorRewards', [a1], {from: a1});
      const a1Accrued2 = await vtxAccrued(comptroller, a1);
      expect(a1Accrued2).toEqualNumber(50 * 2000);
    });

    it('should accrue vtx with late set', async () => {
      await fastForward(comptroller, 1000);
      const tx1 = await send(comptroller, '_setContributorVtxSpeed', [a1, 2000]);
      await fastForward(comptroller, 50);

      const tx2 = await send(comptroller, 'updateContributorRewards', [a1], {from: a1});
      const a1Accrued2 = await vtxAccrued(comptroller, a1);
      expect(a1Accrued2).toEqualNumber(50 * 2000);
    });
  });

  describe('_setContributorVtxSpeed', () => {
    it('should revert if not called by admin', async () => {
      await expect(
        send(comptroller, '_setContributorVtxSpeed', [a1, 1000], {from: a1})
      ).rejects.toRevert('revert only admin can set vtx speed');
    });

    it('should start vtx stream if called by admin', async () => {
      const tx = await send(comptroller, '_setContributorVtxSpeed', [a1, 1000]);
      expect(tx).toHaveLog('ContributorVtxSpeedUpdated', {
        contributor: a1,
        newSpeed: 1000
      });
    });

    it('should reset vtx stream if set to 0', async () => {
      const tx1 = await send(comptroller, '_setContributorVtxSpeed', [a1, 2000]);
      await fastForward(comptroller, 50);

      const tx2 = await send(comptroller, '_setContributorVtxSpeed', [a1, 0]);
      await fastForward(comptroller, 50);

      const tx3 = await send(comptroller, 'updateContributorRewards', [a1], {from: a1});
      const a1Accrued = await vtxAccrued(comptroller, a1);
      expect(a1Accrued).toEqualNumber(50 * 2000);
    });
  });
});
