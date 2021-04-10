import { Event } from '../Event';
import { World } from '../World';
import { CErc20Delegate } from '../Contract/CErc20Delegate';
import {
  getCoreValue,
  mapValue
} from '../CoreValue';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import {
  AddressV,
  Value,
} from '../Value';
import { getWorldContractByAddress, getVTokenDelegateAddress } from '../ContractLookup';

export async function getVTokenDelegateV(world: World, event: Event): Promise<CErc20Delegate> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getVTokenDelegateAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<CErc20Delegate>(world, address.val);
}

async function vTokenDelegateAddress(world: World, vTokenDelegate: CErc20Delegate): Promise<AddressV> {
  return new AddressV(vTokenDelegate._address);
}

export function vTokenDelegateFetchers() {
  return [
    new Fetcher<{ vTokenDelegate: CErc20Delegate }, AddressV>(`
        #### Address

        * "VTokenDelegate <VTokenDelegate> Address" - Returns address of VTokenDelegate contract
          * E.g. "VTokenDelegate cDaiDelegate Address" - Returns cDaiDelegate's address
      `,
      "Address",
      [
        new Arg("vTokenDelegate", getVTokenDelegateV)
      ],
      (world, { vTokenDelegate }) => vTokenDelegateAddress(world, vTokenDelegate),
      { namePos: 1 }
    ),
  ];
}

export async function getVTokenDelegateValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("VTokenDelegate", vTokenDelegateFetchers(), world, event);
}
