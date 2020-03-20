import {
  chan_signDigest,
  chan_getUserWithdrawal,
  chan_setUserWithdrawal,
  chan_setStateChannel,
  chan_restoreState,
  IChannelProvider,
  IClientStore,
  ConnextEventEmitter,
  StateChannelJSON,
  WithdrawalMonitorObject,
} from "@connext/types";
import { ChannelProvider } from "@connext/channel-provider";
import { signMessage } from "@connext/crypto";
import { Wallet } from "ethers";

import { CFCore, deBigNumberifyJson, xpubToAddress } from "./lib";
import {
  CFChannelProviderOptions,
  CFCoreTypes,
  ChannelProviderConfig,
  IRpcConnection,
  JsonRpcRequest,
} from "./types";
import { SigningKey, joinSignature } from "ethers/utils";

export const createCFChannelProvider = async ({
  ethProvider,
  keyGen,
  lockService,
  messaging,
  networkContext,
  nodeConfig,
  nodeUrl,
  store,
  xpub,
  logger,
}: CFChannelProviderOptions): Promise<IChannelProvider> => {
  const cfCore = await CFCore.create(
    messaging,
    store,
    networkContext,
    nodeConfig,
    ethProvider,
    lockService,
    xpub,
    keyGen,
    undefined,
    logger,
  );
  const channelProviderConfig: ChannelProviderConfig = {
    freeBalanceAddress: xpubToAddress(xpub),
    nodeUrl,
    signerAddress: xpubToAddress(xpub),
    userPublicIdentifier: xpub,
  };
  const wallet = new Wallet(await keyGen("0")).connect(ethProvider);
  const connection = new CFCoreRpcConnection(cfCore, store, wallet);
  const channelProvider = new ChannelProvider(connection, channelProviderConfig);
  return channelProvider;
};

export class CFCoreRpcConnection extends ConnextEventEmitter implements IRpcConnection {
  public connected: boolean = true;
  public cfCore: CFCore;
  public store: IClientStore;

  // TODO: replace this when signing keys are added!
  public wallet: Wallet;

  constructor(cfCore: CFCore, store: IClientStore, wallet: Wallet) {
    super();
    this.cfCore = cfCore;
    this.wallet = wallet;
    this.store = store;
  }

  public async send(payload: JsonRpcRequest): Promise<any> {
    const { method, params } = payload;
    let result;
    switch (method) {
      case chan_setUserWithdrawal:
        result = await this.storeSetUserWithdrawal(params.withdrawalObject);
        break;
      case chan_getUserWithdrawal:
        result = await this.storeGetUserWithdrawal();
        break;
      case chan_signDigest:
        result = await this.signDigest(params.message);
        break;
      case chan_restoreState:
        result = await this.restoreState();
        break;
      case chan_setStateChannel:
        result = await this.setStateChannel(params.state);
        break;
      default:
        result = await this.routerDispatch(method, params);
        break;
    }
    return result;
  }

  public on = (
    event: string | CFCoreTypes.EventName | CFCoreTypes.RpcMethodName,
    listener: (...args: any[]) => void,
  ): any => {
    this.cfCore.on(event as any, listener);
    return this.cfCore;
  };

  public once = (
    event: string | CFCoreTypes.EventName | CFCoreTypes.RpcMethodName,
    listener: (...args: any[]) => void,
  ): any => {
    this.cfCore.once(event as any, listener);
    return this.cfCore;
  };

  public open(): Promise<void> {
    return Promise.resolve();
  }

  public close(): Promise<void> {
    return Promise.resolve();
  }

  ///////////////////////////////////////////////
  ///// PRIVATE METHODS
  private walletSign = async (message: string): Promise<string> => {
    return signMessage(this.wallet.privateKey, message);
  };

  private signDigest = async (message: string): Promise<string> => {
    const key = new SigningKey(this.wallet.privateKey);
    return joinSignature(key.signDigest(message));
  };

  private storeGetUserWithdrawal = async (): Promise<WithdrawalMonitorObject | undefined> => {
    return this.store.getUserWithdrawal();
  };

  private storeSetUserWithdrawal = async (
    value: WithdrawalMonitorObject | undefined,
  ): Promise<void> => {
    return this.store.setUserWithdrawal(value);
  };

  private setStateChannel = async (channel: StateChannelJSON): Promise<void> => {
    return this.store.saveStateChannel(channel);
  };

  private restoreState = async (): Promise<void> => {
    await this.store.restore();
  };

  private routerDispatch = async (method: string, params: any = {}) => {
    const ret = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: method,
      parameters: deBigNumberifyJson(params),
    });
    return ret.result.result;
  };
}
