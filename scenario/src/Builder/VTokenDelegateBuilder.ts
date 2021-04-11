import { Event } from '../Event';
import { World } from '../World';
import { VErc20Delegate, VErc20DelegateScenario } from '../Contract/VErc20Delegate';
import { VToken } from '../Contract/VToken';
import { Invokation } from '../Invokation';
import { getStringV } from '../CoreValue';
import { AddressV, NumberV, StringV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract, getTestContract } from '../Contract';

const CDaiDelegateContract = getContract('CDaiDelegate');
const CDaiDelegateScenarioContract = getTestContract('CDaiDelegateScenario');
const VErc20DelegateContract = getContract('VErc20Delegate');
const VErc20DelegateScenarioContract = getTestContract('VErc20DelegateScenario');


export interface VTokenDelegateData {
  invokation: Invokation<VErc20Delegate>;
  name: string;
  contract: string;
  description?: string;
}

export async function buildVTokenDelegate(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; vTokenDelegate: VErc20Delegate; delegateData: VTokenDelegateData }> {
  const fetchers = [
    new Fetcher<{ name: StringV; }, VTokenDelegateData>(
      `
        #### CDaiDelegate

        * "CDaiDelegate name:<String>"
          * E.g. "VTokenDelegate Deploy CDaiDelegate cDAIDelegate"
      `,
      'CDaiDelegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await CDaiDelegateContract.deploy<VErc20Delegate>(world, from, []),
          name: name.val,
          contract: 'CDaiDelegate',
          description: 'Standard CDai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, VTokenDelegateData>(
      `
        #### CDaiDelegateScenario

        * "CDaiDelegateScenario name:<String>" - A CDaiDelegate Scenario for local testing
          * E.g. "VTokenDelegate Deploy CDaiDelegateScenario cDAIDelegate"
      `,
      'CDaiDelegateScenario',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await CDaiDelegateScenarioContract.deploy<VErc20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'CDaiDelegateScenario',
          description: 'Scenario CDai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, VTokenDelegateData>(
      `
        #### VErc20Delegate

        * "VErc20Delegate name:<String>"
          * E.g. "VTokenDelegate Deploy VErc20Delegate cDAIDelegate"
      `,
      'VErc20Delegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await VErc20DelegateContract.deploy<VErc20Delegate>(world, from, []),
          name: name.val,
          contract: 'VErc20Delegate',
          description: 'Standard VErc20 Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, VTokenDelegateData>(
      `
        #### VErc20DelegateScenario

        * "VErc20DelegateScenario name:<String>" - A VErc20Delegate Scenario for local testing
          * E.g. "VTokenDelegate Deploy VErc20DelegateScenario cDAIDelegate"
      `,
      'VErc20DelegateScenario',
      [
        new Arg('name', getStringV),
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await VErc20DelegateScenarioContract.deploy<VErc20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'VErc20DelegateScenario',
          description: 'Scenario VErc20 Delegate'
        };
      }
    )
  ];

  let delegateData = await getFetcherValue<any, VTokenDelegateData>("DeployVToken", fetchers, world, params);
  let invokation = delegateData.invokation;
  delete delegateData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const vTokenDelegate = invokation.value!;

  world = await storeAndSaveContract(
    world,
    vTokenDelegate,
    delegateData.name,
    invokation,
    [
      {
        index: ['VTokenDelegate', delegateData.name],
        data: {
          address: vTokenDelegate._address,
          contract: delegateData.contract,
          description: delegateData.description
        }
      }
    ]
  );

  return { world, vTokenDelegate, delegateData };
}
