import { AppABIEncodings, AppInstanceJson } from "./app";
import {
  Address,
  BigNumber,
  Bytes32,
  AssetId,
  PublicIdentifier,
  SolidityValueType,
  HexString,
} from "./basic";
import { OutcomeType } from "./contracts";
import { enumify } from "./utils";

type InstallProtocolParams = {
  initiatorIdentifier: PublicIdentifier; // protocol-specific
  responderIdentifier: PublicIdentifier; // protocol-specific
  proposal: AppInstanceJson;
  multisigAddress: Address;
  protocolMeta?: any;
};

type ProposeProtocolParams = {
  multisigAddress: Address;
  initiatorIdentifier: PublicIdentifier;
  responderIdentifier: PublicIdentifier;
  appDefinition: Address;
  abiEncodings: AppABIEncodings;
  initiatorDeposit: BigNumber;
  initiatorDepositAssetId: AssetId;
  responderDeposit: BigNumber;
  responderDepositAssetId: AssetId;
  defaultTimeout: BigNumber;
  stateTimeout: BigNumber; // optional in api, but should be defined in protocol
  initialState: SolidityValueType;
  outcomeType: OutcomeType;
  meta?: any;
  protocolMeta?: any;
};

type SetupProtocolParams = {
  initiatorIdentifier: PublicIdentifier;
  responderIdentifier: PublicIdentifier;
  multisigAddress: Address;
  chainId: number;
  protocolMeta?: any;
};

// NOTE: should only provide the appIdentityHash if the protocol
// also provides it in the params. These include:
// - takeAction
// - uninstall
type SyncProtocolParams = {
  initiatorIdentifier: PublicIdentifier;
  responderIdentifier: PublicIdentifier;
  multisigAddress: Address;
  appIdentityHash: HexString | undefined;
  protocolMeta?: any;
};

type TakeActionProtocolParams = {
  initiatorIdentifier: PublicIdentifier;
  responderIdentifier: PublicIdentifier;
  multisigAddress: Address;
  appIdentityHash: Address;
  action: SolidityValueType;
  stateTimeout: BigNumber;
  protocolMeta?: any;
};

type UninstallProtocolParams = {
  appIdentityHash: Bytes32;
  initiatorIdentifier: PublicIdentifier;
  responderIdentifier: PublicIdentifier;
  multisigAddress: Address;
  blockNumberToUseIfNecessary?: number;
  action?: SolidityValueType;
  stateTimeout?: BigNumber;
  protocolMeta?: any;
};

////////////////////////////////////////
// exports

// TODO: should we enumify?
export enum Opcode {
  // Middleware hook to send a ProtocolMessage to a peer.
  IO_SEND,
  // Middleware hook to both send and wait for a response from a ProtocolMessage
  IO_SEND_AND_WAIT,
  // Requests a signature on the hash of previously generated EthereumCommitments.
  OP_SIGN,
  // Middleware hook to write the app instances to store.
  PERSIST_APP_INSTANCE,
  // Middleware hook to write the state channel to store. Used to lock channel between protocols.
  PERSIST_STATE_CHANNEL,
  // Middleware hook to validate state transitions in protocol. Called before
  // `computeStateTransition` and registered using `injectMiddleware`
  OP_VALIDATE,
}

export const ProtocolNames = enumify({
  install: "install",
  propose: "propose",
  setup: "setup",
  sync: "sync",
  takeAction: "takeAction",
  uninstall: "uninstall",
});
export type ProtocolNames = typeof ProtocolNames[keyof typeof ProtocolNames];
export type ProtocolName = keyof typeof ProtocolNames;

export namespace ProtocolParams {
  export type Install = InstallProtocolParams;
  export type Propose = ProposeProtocolParams;
  export type Setup = SetupProtocolParams;
  export type Sync = SyncProtocolParams;
  export type TakeAction = TakeActionProtocolParams;
  export type Uninstall = UninstallProtocolParams;
}

export type ProtocolParam =
  | InstallProtocolParams
  | ProposeProtocolParams
  | SetupProtocolParams
  | TakeActionProtocolParams
  | UninstallProtocolParams;
