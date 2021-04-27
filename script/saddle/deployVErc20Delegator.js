let { getString, getNumber } = require('./support/tokenConfig')

function printUsage() {
  console.log(`
usage: npx saddle script vErc20Delegator:deploy {tokenConfig}

note: pass VERIFY=true and ETHERSCAN_API_KEY=<api key> to verify contract on Etherscan

example:

npx saddle -n kovan script vErc20Delegator:deploy '{                 
    "underlying": "0x8939196e3e5b130f776c4e09208e00c3ca465d6a",
    "comptroller": "0xc75bd46d58af863dc88593213cf3879b5a78eb18",
    "interestRateModel": "0xbad185f268b29fdc645f6270fc9aa55feac41902",
    "initialExchangeRateMantissa": "2.0e18",
    "name": "Vortex MakerDAO",
    "symbol": "vMKR",
    "decimals": "8",
    "admin": "0x5182364f1D98525d5Ab2Bef42132B43745F297E5",
    "implementation": "0x49e3970b26eb4bb6e7b3b818f979acc8fbe071cb",
    "becomeImplementationData": "0x"
}'
  `);
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
		underlying: getString(config, 'underlying'),
    comptroller: getString(config, 'comptroller'),
    interestRateModel: getString(config, 'interestRateModel'),
    initialExchangeRateMantissa: getNumber(config, 'initialExchangeRateMantissa'),
    name: getString(config, 'name'),
    symbol: getString(config, 'symbol'),
    decimals: getNumber(config, 'decimals'),
    admin: getString(config, 'admin'),
    implementation: getString(config, 'implementation'),
    becomeImplementationData: getString(config, 'becomeImplementationData')
	}
	console.log('Running with actual args: ', res)
	return res
}

(async function() {
  if (args.length !== 1) {
    return printUsage();
  }

  let conf = getConfig(args[0]);
  if (!conf) {
    return printUsage();
  }

  console.log(`Deploying vToken with ${JSON.stringify(conf)}`);

  let deployArgs = [conf.underlying, conf.comptroller, conf.interestRateModel, conf.initialExchangeRateMantissa.toString(), conf.name, conf.symbol, conf.decimals, conf.admin, conf.implementation, conf.becomeImplementationData];
  let contract = await saddle.deploy('VErc20Delegator', deployArgs);

  console.log(`Deployed contract to ${contract._address}`);

  if (env['VERIFY']) {
    const etherscanApiKey = env['ETHERSCAN_API_KEY'];
    if (etherscanApiKey === undefined || etherscanApiKey.length === 0) {
      throw new Error(`ETHERSCAN_API_KEY must be set if using VERIFY flag...`);
    }

    console.log(`Sleeping for 30 seconds then verifying contract on Etherscan...`);
    await sleep(30000); // Give Etherscan time to learn about contract
    console.log(`Now verifying contract on Etherscan...`);

    await saddle.verify(etherscanApiKey, contract._address, 'VErc20Delegator', deployArgs, 0);
    console.log(`Contract verified at https://${network}.etherscan.io/address/${contract._address}`);
  }

  return {
    ...conf,
    address: contract._address
  };
})();