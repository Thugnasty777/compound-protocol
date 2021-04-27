const { getString } = require('./support/tokenConfig')

function printUsage() {
	console.log(`
	usage: npx saddle script vtx:deploy {config}

	note: pass VERIFY=true and ETHERSCAN_API_KEY=<api key> to verify contract on Etherscan

	npx saddle -n rinkeby script vtx:deploy '{
		"account": "0x3a7386b069622D172c9E50332853a41a1Db134f9"
	}'
	`)
}

function sleep(timeout) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
}

function getConfig(configArgs) {
	let config
	if (!configArgs) {
		config = {}
	} else {
		try {
			config = JSON.parse(configArgs)
		} catch (e) {
			printUsage()
			console.error(e)
			return null
		}
	}

	let res = {
		account: getString(config, 'account', true)
	}
	console.log('Running with actual args: ', res)
	return res
}

(async function () {
	if (args.length !== 1) {
			return printUsage()
	}

	let conf = getConfig(args[0])

	console.log(`Deploying vtx with ${JSON.stringify(conf)}`)

	let deployArgs = [conf.account]
	let contract = await saddle.deploy('Vtx', deployArgs)

	console.log(`Deployed contract to ${contract._address}`)

	if (env['VERIFY']) {
    const etherscanApiKey = env['ETHERSCAN_API_KEY'];
    if (etherscanApiKey === undefined || etherscanApiKey.length === 0) {
      throw new Error(`ETHERSCAN_API_KEY must be set if using VERIFY flag...`);
    }

    console.log(`Sleeping for 30 seconds then verifying contract on Etherscan...`);
    await sleep(30000); // Give Etherscan time to learn about contract
    console.log(`Now verifying contract on Etherscan...`);

    await saddle.verify(etherscanApiKey, contract._address, 'Vtx', deployArgs, 0);
    console.log(`Contract verified at https://${network}.etherscan.io/address/${contract._address}`);
  }

	return {
		address: contract._address
	}
})();
