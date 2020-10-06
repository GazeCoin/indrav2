import {
  AppIdentity,
  AppInstanceJson,
  AppInterface,
  HexString,
  MultiAssetMultiPartyCoinTransferInterpreterParams,
  multiAssetMultiPartyCoinTransferInterpreterParamsEncoding,
  OutcomeType,
  PublicIdentifier,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  singleAssetTwoPartyCoinTransferInterpreterParamsEncoding,
  SolidityValueType,
  TwoPartyFixedOutcomeInterpreterParams,
  twoPartyFixedOutcomeInterpreterParamsEncoding,
} from "@connext/types";
import {
  appIdentityToHash,
  bigNumberifyJson,
  deBigNumberifyJson,
  getSignerAddressFromPublicIdentifier,
  isBN,
  stringify,
  toBN,
} from "@connext/utils";
import { Contract, constants, utils, providers } from "ethers";

import { CounterfactualApp } from "../contracts";

const { Zero } = constants;
const { defaultAbiCoder, keccak256 } = utils;

/**
 * Representation of an AppInstance.
 *
 * @property participants The sorted array of public keys used by the users of
 *           this AppInstance for which n-of-n consensus is needed on updates.

 * @property defaultTimeout The default timeout used when a new update is made.

 * @property appInterface An AppInterface object representing the logic this
 *           AppInstance relies on for verifying and proposing state updates.

 * @property latestState The unencoded representation of the latest state.

 * @property latestVersionNumber The versionNumber of the latest signed state update.

 * @property stateTimeout The timeout used in the latest signed state update.

 * @property multiAssetMultiPartyCoinTransferInterpreterParams The limit / maximum amount of funds
 *           to be distributed for an app where the interpreter type is COIN_TRANSFER

 * @property twoPartyOutcomeInterpreterParams Addresses of the two beneficiaries
 *           and the amount that is to be distributed for an app
 *           where the interpreter type is TWO_PARTY_FIXED_OUTCOME
 */
export class AppInstance {
  constructor(
    public readonly initiatorIdentifier: PublicIdentifier, // eth addr at appSeqNp idx
    public readonly responderIdentifier: PublicIdentifier, // eth addr at appSeqNp idx
    public readonly defaultTimeout: HexString,
    public readonly appInterface: AppInterface,
    public readonly appSeqNo: number, // channel nonce at app proposal
    public readonly latestState: any,
    public readonly latestVersionNumber: number, // app nonce
    public readonly stateTimeout: HexString,
    public readonly outcomeType: OutcomeType,
    public readonly multisigAddress: string,
    public readonly meta?: object,
    public readonly latestAction: any = undefined,
    private readonly twoPartyOutcomeInterpreterParamsInternal?: TwoPartyFixedOutcomeInterpreterParams,
    private readonly multiAssetMultiPartyCoinTransferInterpreterParamsInternal?: MultiAssetMultiPartyCoinTransferInterpreterParams,
    private readonly singleAssetTwoPartyCoinTransferInterpreterParamsInternal?: SingleAssetTwoPartyCoinTransferInterpreterParams,
  ) {}

  get twoPartyOutcomeInterpreterParams() {
    if (this.outcomeType !== OutcomeType.TWO_PARTY_FIXED_OUTCOME) {
      throw new Error(
        `Invalid Accessor. AppInstance has outcomeType ${this.outcomeType}, not TWO_PARTY_FIXED_OUTCOME`,
      );
    }

    return this.twoPartyOutcomeInterpreterParamsInternal!;
  }

  get multiAssetMultiPartyCoinTransferInterpreterParams() {
    if (this.outcomeType !== OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER) {
      throw new Error(
        `Invalid Accessor. AppInstance has outcomeType ${this.outcomeType}, not MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER`,
      );
    }

    return this.multiAssetMultiPartyCoinTransferInterpreterParamsInternal!;
  }

  get singleAssetTwoPartyCoinTransferInterpreterParams() {
    if (this.outcomeType !== OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER) {
      throw new Error(
        `Invalid Accessor. AppInstance has outcomeType ${this.outcomeType}, not SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER `,
      );
    }

    return this.singleAssetTwoPartyCoinTransferInterpreterParamsInternal!;
  }
  public static fromJson(json: AppInstanceJson) {
    const deserialized = bigNumberifyJson(json) as AppInstanceJson;

    const interpreterParams = {
      twoPartyOutcomeInterpreterParams: deserialized.twoPartyOutcomeInterpreterParams
        ? (bigNumberifyJson(
            deserialized.twoPartyOutcomeInterpreterParams,
          ) as TwoPartyFixedOutcomeInterpreterParams)
        : undefined,
      singleAssetTwoPartyCoinTransferInterpreterParams: deserialized.singleAssetTwoPartyCoinTransferInterpreterParams
        ? (bigNumberifyJson(
            deserialized.singleAssetTwoPartyCoinTransferInterpreterParams,
          ) as SingleAssetTwoPartyCoinTransferInterpreterParams)
        : undefined,
      multiAssetMultiPartyCoinTransferInterpreterParams: deserialized.multiAssetMultiPartyCoinTransferInterpreterParams
        ? (bigNumberifyJson(
            deserialized.multiAssetMultiPartyCoinTransferInterpreterParams,
          ) as MultiAssetMultiPartyCoinTransferInterpreterParams)
        : undefined,
    };

    return new AppInstance(
      deserialized.initiatorIdentifier,
      deserialized.responderIdentifier,
      deserialized.defaultTimeout,
      deserialized.appInterface,
      deserialized.appSeqNo,
      deserialized.latestState,
      deserialized.latestVersionNumber,
      deserialized.stateTimeout,
      deserialized.outcomeType as any, // OutcomeType is enum, so gives attitude
      deserialized.multisigAddress,
      deserialized.meta,
      deserialized.latestAction || undefined,
      interpreterParams.twoPartyOutcomeInterpreterParams,
      interpreterParams.multiAssetMultiPartyCoinTransferInterpreterParams,
      interpreterParams.singleAssetTwoPartyCoinTransferInterpreterParams,
    );
  }

  public toJson(): AppInstanceJson {
    // removes any fields which have an `undefined` value, as that's invalid JSON
    // an example would be having an `undefined` value for the `actionEncoding`
    // of an AppInstance that's not turn based
    return deBigNumberifyJson({
      identityHash: this.identityHash,
      initiatorIdentifier: this.initiatorIdentifier,
      responderIdentifier: this.responderIdentifier,
      defaultTimeout: this.defaultTimeout,
      appInterface: {
        ...this.appInterface,
        actionEncoding: this.appInterface.actionEncoding || null,
      },
      appSeqNo: this.appSeqNo,
      latestState: this.latestState,
      latestVersionNumber: this.latestVersionNumber,
      stateTimeout: this.stateTimeout,
      outcomeType: this.outcomeType,
      multisigAddress: this.multisigAddress,
      meta: this.meta,
      twoPartyOutcomeInterpreterParams: this.twoPartyOutcomeInterpreterParamsInternal || null,
      multiAssetMultiPartyCoinTransferInterpreterParams:
        this.multiAssetMultiPartyCoinTransferInterpreterParamsInternal || null,
      singleAssetTwoPartyCoinTransferInterpreterParams:
        this.singleAssetTwoPartyCoinTransferInterpreterParamsInternal || null,
    });
  }

  public get identityHash() {
    return appIdentityToHash(this.identity);
  }

  public get participants() {
    return [
      getSignerAddressFromPublicIdentifier(this.initiatorIdentifier),
      getSignerAddressFromPublicIdentifier(this.responderIdentifier),
    ];
  }

  public get identity(): AppIdentity {
    return {
      participants: this.participants,
      multisigAddress: this.multisigAddress,
      appDefinition: this.appInterface.addr,
      defaultTimeout: toBN(this.defaultTimeout),
      channelNonce: toBN(this.appSeqNo),
    };
  }

  public get hashOfLatestState() {
    return keccak256(this.encodedLatestState);
  }

  public get encodedLatestState() {
    return defaultAbiCoder.encode([this.appInterface.stateEncoding], [this.latestState]);
  }

  public get encodedInterpreterParams() {
    switch (this.outcomeType) {
      case OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER: {
        return defaultAbiCoder.encode(
          [singleAssetTwoPartyCoinTransferInterpreterParamsEncoding],
          [this.singleAssetTwoPartyCoinTransferInterpreterParams],
        );
      }

      case OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER: {
        return defaultAbiCoder.encode(
          [multiAssetMultiPartyCoinTransferInterpreterParamsEncoding],
          [this.multiAssetMultiPartyCoinTransferInterpreterParams],
        );
      }

      case OutcomeType.TWO_PARTY_FIXED_OUTCOME: {
        return defaultAbiCoder.encode(
          [twoPartyFixedOutcomeInterpreterParamsEncoding],
          [this.twoPartyOutcomeInterpreterParams],
        );
      }

      default: {
        throw new Error(
          `The outcome type in this application logic contract is not supported yet. Outcome type: ${this.outcomeType}, expected one of: ${OutcomeType.TWO_PARTY_FIXED_OUTCOME}, ${OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER}, or ${OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER}`,
        );
      }
    }
  }

  public get state() {
    return this.latestState;
  }

  public get versionNumber() {
    return this.latestVersionNumber;
  }

  public get timeout() {
    return this.stateTimeout;
  }

  public setState(newState: SolidityValueType, stateTimeout: utils.BigNumber = Zero) {
    try {
      defaultAbiCoder.encode([this.appInterface.stateEncoding], [newState]);
    } catch (e) {
      // TODO: Catch ethers.errors.INVALID_ARGUMENT specifically in catch {}

      throw new Error(
        `Attempted to setState on an app with an invalid state object.
          - appIdentityHash = ${this.identityHash}
          - newState = ${stringify(newState)}
          - encodingExpected = ${this.appInterface.stateEncoding}
          Error: ${e.message}`,
      );
    }

    return AppInstance.fromJson({
      ...this.toJson(),
      latestState: newState,
      latestVersionNumber: this.versionNumber + 1,
      latestAction: undefined,
      // any time you set app state, you should remove
      // any existing actions from previous states
      stateTimeout: stateTimeout.toHexString(),
    });
  }

  public setAction(action: SolidityValueType) {
    if (!this.appInterface.actionEncoding) {
      throw new Error(`Cannot set an action without providing an encoding`);
    }
    try {
      defaultAbiCoder.encode([this.appInterface.actionEncoding], [action]);
    } catch (e) {
      // TODO: Catch ethers.errors.INVALID_ARGUMENT specifically in catch {}

      throw new Error(
        `Attempted to setAction on an app with an invalid state object.
          - appIdentityHash = ${this.identityHash}
          - action = ${stringify(action)}
          - encodingExpected = ${this.appInterface.stateEncoding}
          Error: ${e.message}`,
      );
    }

    return AppInstance.fromJson({
      ...this.toJson(),
      latestAction: action,
    });
  }

  public async computeOutcome(
    state: SolidityValueType,
    provider: providers.JsonRpcProvider,
  ): Promise<string> {
    return this.toEthersContract(provider).functions.computeOutcome(this.encodeState(state));
  }

  public async isStateTerminal(
    state: SolidityValueType,
    provider: providers.JsonRpcProvider,
  ): Promise<string> {
    return this.toEthersContract(provider).functions.isStateTerminal(this.encodeState(state));
  }

  public async computeOutcomeWithCurrentState(
    provider: providers.JsonRpcProvider,
  ): Promise<string> {
    return this.computeOutcome(this.state, provider);
  }

  public async computeStateTransition(
    action: SolidityValueType,
    provider: providers.JsonRpcProvider,
  ): Promise<SolidityValueType> {
    const computedNextState = this.decodeAppState(
      await this.toEthersContract(provider).functions.applyAction(
        this.encodedLatestState,
        this.encodeAction(action),
      ),
    );

    // ethers returns an array of [ <each value by index>, <each value by key> ]
    // so we need to recursively clean this response before returning
    const keyify = (templateObj: any, dataObj: any, key?: string): any => {
      const template = key ? templateObj[key] : templateObj;
      const data = key ? dataObj[key] : dataObj;
      let output;
      if (isBN(template) || typeof template !== "object") {
        output = data;
      } else if (typeof template === "object" && typeof template.length === "number") {
        output = [];
        for (const index in template) {
          output.push(keyify(template, data, index));
        }
      } else if (typeof template === "object" && typeof template.length !== "number") {
        output = {};
        for (const subkey in template) {
          output[subkey] = keyify(template, data, subkey);
        }
      } else {
        throw new Error(`Couldn't keyify, unrecogized key/value: ${key}/${data}`);
      }
      return output;
    };

    return bigNumberifyJson(keyify(this.state, computedNextState)) as any;
  }

  public encodeAction(action: SolidityValueType) {
    return defaultAbiCoder.encode([this.appInterface.actionEncoding!], [action]);
  }

  public encodeState(state: SolidityValueType) {
    return defaultAbiCoder.encode([this.appInterface.stateEncoding], [state]);
  }

  public decodeAppState(encodedSolidityValueType: string): SolidityValueType {
    return defaultAbiCoder.decode([this.appInterface.stateEncoding], encodedSolidityValueType)[0];
  }

  public toEthersContract(provider: providers.JsonRpcProvider) {
    return new Contract(this.appInterface.addr, CounterfactualApp.abi, provider);
  }
}
