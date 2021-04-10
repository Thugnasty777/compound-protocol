import { Event } from '../Event';
import { World } from '../World';
import { CErc20Delegate, CErc20DelegateScenario } from '../Contract/CErc20Delegate';
import { VToken } from '../Contract/VToken';
import { Invokation } from '../Invokation';
import { getStringV } from '../CoreValue';
import { AddressV, NumberV, StringV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract, getTestContract } from '../Contract';

const CDaiDelegateContract = getContract('CDaiDelegate');
const CDaiDelegateScenarioContract = getTestContract('CDaiDelegateScenario');
const CErc20DelegateContract = getContract('CErc20Delegate');
const CErc20DelegateScenarioContract = getTestContract('CErc20DelegateScenario');


export interface VTokenDelegateData {
  invokation: Invokation<CErc20Delegate>;
  name: string;
  contract: string;
  description?: string;
}

export async function buildVTokenDelegate(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; vTokenDelegate: CErc20Delegate; delegateData: VTokenDelegateData }> {
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
          invokation: await CDaiDelegateContract.deploy<CErc20Delegate>(world, from, []),
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
          invokation: await CDaiDelegateScenarioContract.deploy<CErc20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'CDaiDelegateScenario',
          description: 'Scenario CDai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, VTokenDelegateData>(
      `
        #### CErc20Delegate

        * "CErc20Delegate name:<String>"
          * E.g. "VTokenDelegate Deploy CErc20Delegate cDAIDelegate"
      `,
      'CErc20Delegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await CErc20DelegateContract.deploy<CErc20Delegate>(world, from, []),
          name: name.val,
          contract: 'CErc20Delegate',
          description: 'Standard CErc20 Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, VTokenDelegateData>(
      `
        #### CErc20DelegateScenario

        * "CErc20DelegateScenario name:<String>" - A CErc20Delegate Scenario for local testing
          * E.g. "VTokenDelegate Deploy CErc20DelegateScenario cDAIDelegate"
      `,
      'CErc20DelegateScenario',
      [
        new Arg('name', getStringV),
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await CErc20DelegateScenarioContract.deploy<CErc20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'CErc20DelegateScenario',
          description: 'Scenario CErc20 Delegate'
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
