const { getString } = require('./support/tokenConfig')

function printUsage() {
	console.log(`
	usage: npx saddle script jumpRateModelV2:deploy {config}

	note: pass VERIFY=true and ETHERSCAN_API_KEY=<api key> to verify contract on Etherscan

	npx saddle -n rinkeby script jumpRateModelV2:deploy '{
		"baseRatePerYear": "19999999999728000",
		"multiplierPerYear": "224999999998516800",
		"jumpMultiplierPerYear": "1799999999998646400",
		"kink": "750000000000000000",
		"owner": "0x5182364f1D98525d5Ab2Bef42132B43745F297E5"
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
		baseRatePerYear: getString(config, 'baseRatePerYear', true),
		multiplierPerYear: getString(config, 'multiplierPerYear', true),
		jumpMultiplierPerYear: getString(config, 'jumpMultiplierPerYear', true),
		kink: getString(config, 'kink', true),
		owner: getString(config, 'owner', true)
	}
	console.log('Running with actual args: ', res)
	return res
}

(async function () {
	if (args.length !== 1) {
			return printUsage()
	}

	let conf = getConfig(args[0])

	console.log(`Deploying jumpRateModelV2 with ${JSON.stringify(conf)}`)

	let deployArgs = [conf.baseRatePerYear, conf.multiplierPerYear, conf.jumpMultiplierPerYear, conf.kink, conf.owner]
	let contract = await saddle.deploy('JumpRateModelV2', deployArgs)

	console.log(`Deployed contract to ${contract._address}`)

	if (env['VERIFY']) {
    const etherscanApiKey = env['ETHERSCAN_API_KEY'];
    if (etherscanApiKey === undefined || etherscanApiKey.length === 0) {
      throw new Error(`ETHERSCAN_API_KEY must be set if using VERIFY flag...`);
    }

    console.log(`Sleeping for 30 seconds then verifying contract on Etherscan...`);
    await sleep(30000); // Give Etherscan time to learn about contract
    console.log(`Now verifying contract on Etherscan...`);

    await saddle.verify(etherscanApiKey, contract._address, 'JumpRateModelV2', deployArgs, 0);
    console.log(`Contract verified at https://${network}.etherscan.io/address/${contract._address}`);
  }

	return {
		address: contract._address
	}
})();