const {
  makeVToken,
} = require('../Utils/Vortex');


describe('CCompLikeDelegate', function () {
  describe("_delegateCompLikeTo", () => {
    it("does not delegate if not the admin", async () => {
      const [root, a1] = saddle.accounts;
      const vToken = await makeVToken({kind: 'ccomp'});
      await expect(send(vToken, '_delegateCompLikeTo', [a1], {from: a1})).rejects.toRevert('revert only the admin may set the vtx-like delegate');
    });

    it("delegates successfully if the admin", async () => {
      const [root, a1] = saddle.accounts, amount = 1;
      const cCOMP = await makeVToken({kind: 'ccomp'}), VTX = cCOMP.underlying;
      const tx1 = await send(cCOMP, '_delegateCompLikeTo', [a1]);
      const tx2 = await send(VTX, 'transfer', [cCOMP._address, amount]);
      await expect(await call(VTX, 'getCurrentVotes', [a1])).toEqualNumber(amount);
    });
  });
});