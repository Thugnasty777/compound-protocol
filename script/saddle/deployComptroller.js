function printUsage() {
	console.log(`
	usage: npx saddle script comptroller:deploy

	note: pass VERIFY=true and ETHERSCAN_API_KEY=<api key> to verify contract on Etherscan

	npx saddle -n rinkeby script comptroller:deploy
	`)
}

function sleep(timeout) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
}

(async function () {
	console.log(`Deploying comptroller`)

	let contract = await saddle.deploy('Comptroller')

	console.log(`Deployed contract to ${contract._address}`)

	if (env['VERIFY']) {
    const etherscanApiKey = env['ETHERSCAN_API_KEY'];
    if (etherscanApiKey === undefined || etherscanApiKey.length === 0) {
      throw new Error(`ETHERSCAN_API_KEY must be set if using VERIFY flag...`);
    }

    console.log(`Sleeping for 30 seconds then verifying contract on Etherscan...`);
    await sleep(30000); // Give Etherscan time to learn about contract
    console.log(`Now verifying contract on Etherscan...`);

    await saddle.verify(etherscanApiKey, contract._address, 'Comptroller', [], 0);
    console.log(`Contract verified at https://${network}.etherscan.io/address/${contract._address}`);
  }

	return {
		address: contract._address
	}
})();