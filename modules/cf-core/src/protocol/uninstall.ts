import {
  Opcode,
  ProtocolMessageData,
  ProtocolNames,
  ProtocolParams,
  ProtocolRoles,
  UninstallMiddlewareContext,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier, logTime, stringify } from "@connext/utils";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { getSetStateCommitment } from "../ethereum";
import { StateChannel } from "../models";
import { Context, PersistAppType, ProtocolExecutionFlow } from "../types";

import {
  assertIsValidSignature,
  computeTokenIndexedFreeBalanceIncrements,
  getPureBytecode,
} from "./utils";

const protocol = ProtocolNames.uninstall;
const { OP_SIGN, OP_VALIDATE, IO_SEND, IO_SEND_AND_WAIT, PERSIST_APP_INSTANCE } = Opcode;
/**
 * @description This exchange is described at the following URL:
 *
 * specs.counterfactual.com/06-uninstall-protocol#messages
 */
export const UNINSTALL_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function* (context: Context) {
    const { message, networks, preProtocolStateChannel } = context;
    const log = context.log.newContext("CF-UninstallProtocol");
    const start = Date.now();
    let substart = start;
    const { params, processID } = message;
    const loggerId = (params as ProtocolParams.Uninstall).appIdentityHash || processID;
    log.info(`[${loggerId}] Initiation started`);
    log.debug(`[${loggerId}] Protocol initiated with params ${stringify(params)}`);

    const {
      responderIdentifier,
      appIdentityHash,
      action,
      stateTimeout,
      initiatorIdentifier,
    } = params as ProtocolParams.Uninstall;

    if (!preProtocolStateChannel) {
      throw new Error("No state channel found for uninstall");
    }
    const appToUninstall = preProtocolStateChannel.getAppInstance(appIdentityHash);

    const error = yield [
      OP_VALIDATE,
      protocol,
      {
        params,
        appInstance: appToUninstall.toJson(),
        role: ProtocolRoles.initiator,
        stateChannel: preProtocolStateChannel.toJson(),
      } as UninstallMiddlewareContext,
    ];
    if (!!error) {
      throw new Error(error);
    }
    logTime(log, substart, `[${loggerId}] Validated uninstall request`);

    const network = networks[preProtocolStateChannel.chainId];

    let preUninstallStateChannel: StateChannel;
    if (action) {
      log.info(`[${loggerId}] Action provided. Finalizing app before uninstall`);
      // apply action
      substart = Date.now();
      const newState = await appToUninstall.computeStateTransition(
        getSignerAddressFromPublicIdentifier(initiatorIdentifier),
        action,
        network.provider,
        getPureBytecode(appToUninstall.appDefinition, network.contractAddresses),
      );
      logTime(log, substart, `[${loggerId}] computeStateTransition for action complete`);

      // ensure state is finalized after applying action
      if (!(newState as any).finalized) {
        throw new Error(`Action provided did not lead to terminal state, refusing to uninstall.`);
      }
      log.debug(`[${loggerId}] Resulting state is terminal state, proceeding with uninstall`);
      substart = Date.now();
      preUninstallStateChannel = preProtocolStateChannel.setState(
        appToUninstall,
        newState,
        stateTimeout,
      );
      logTime(log, substart, `[${loggerId}] setState for action complete`);
    } else {
      preUninstallStateChannel = preProtocolStateChannel;
    }
    // make sure the uninstalled app is the finalized app
    const preUninstallApp = preUninstallStateChannel.appInstances.get(appToUninstall.identityHash)!;

    substart = Date.now();

    const postProtocolStateChannel = preUninstallStateChannel.uninstallApp(
      preUninstallApp,
      await computeTokenIndexedFreeBalanceIncrements(preUninstallApp, network, undefined, log),
    );

    logTime(log, substart, `[${loggerId}] computeStateTransition for uninstall complete`);

    substart = Date.now();
    const responderFreeBalanceKey = getSignerAddressFromPublicIdentifier(responderIdentifier);

    const uninstallCommitment = getSetStateCommitment(
      network,
      postProtocolStateChannel.freeBalance,
    );
    const uninstallCommitmentHash = uninstallCommitment.hashToSign();

    // 4ms
    const mySignature = yield [OP_SIGN, uninstallCommitmentHash];
    logTime(log, substart, `[${loggerId}] Signed uninstall commitment initiator`);
    substart = Date.now();

    // 94ms
    const {
      data: {
        customData: { signature: counterpartySignature },
      },
    } = yield [
      IO_SEND_AND_WAIT,
      {
        protocol,
        processID,
        params,
        to: responderIdentifier,
        customData: { signature: mySignature },
        seq: 1,
      } as ProtocolMessageData,
    ] as any;
    logTime(log, substart, `[${loggerId}] Received responder's sig`);
    substart = Date.now();

    // 6ms
    await assertIsValidSignature(
      responderFreeBalanceKey,
      uninstallCommitmentHash,
      counterpartySignature,
      `Failed to validate responder's signature on free balance commitment in the uninstall protocol. Our commitment: ${stringify(
        uninstallCommitment.toJson(),
      )}`,
    );
    logTime(log, substart, `[${loggerId}] Verified responder's sig`);

    await uninstallCommitment.addSignatures(counterpartySignature, mySignature);

    // 24ms
    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.RemoveInstance,
      postProtocolStateChannel,
      preUninstallApp,
      uninstallCommitment,
    ];

    // 204ms
    logTime(log, start, `[${loggerId}] Initiation finished`);
  } as any,

  1 /* Responding */: async function* (context: Context) {
    const { message, preProtocolStateChannel, networks } = context;
    const log = context.log.newContext("CF-UninstallProtocol");
    const start = Date.now();
    let substart = start;
    const { params, processID } = message;
    const loggerId = (params as ProtocolParams.Uninstall).appIdentityHash || processID;
    log.info(`[${loggerId}] Response started`);
    log.debug(`[${loggerId}] Protocol response started with params ${stringify(params)}`);

    const {
      initiatorIdentifier,
      appIdentityHash,
      action,
      stateTimeout,
    } = params as ProtocolParams.Uninstall;

    if (!preProtocolStateChannel) {
      throw new Error("No state channel found for proposal");
    }
    const appToUninstall = preProtocolStateChannel.getAppInstance(appIdentityHash);

    const error = yield [
      OP_VALIDATE,
      protocol,
      {
        params,
        appInstance: appToUninstall.toJson(),
        role: ProtocolRoles.responder,
        stateChannel: preProtocolStateChannel.toJson(),
      } as UninstallMiddlewareContext,
    ];
    if (!!error) {
      throw new Error(error);
    }
    logTime(log, substart, `[${loggerId}] Validated uninstall request`);

    const network = networks[preProtocolStateChannel.chainId];

    let preUninstallStateChannel: StateChannel;
    if (action) {
      log.info(`[${loggerId}] Action provided. Finalizing app before uninstall`);
      // apply action
      substart = Date.now();
      const newState = await appToUninstall.computeStateTransition(
        getSignerAddressFromPublicIdentifier(initiatorIdentifier),
        action,
        network.provider,
        getPureBytecode(appToUninstall.appDefinition, network.contractAddresses),
      );
      logTime(log, substart, `[${loggerId}] computeStateTransition for action complete`);

      // ensure state is finalized after applying action
      if (!(newState as any).finalized) {
        throw new Error(`Action provided did not lead to terminal state, refusing to uninstall.`);
      }
      log.debug(`[${loggerId}] Resulting state is terminal state, proceeding with uninstall`);
      substart = Date.now();
      preUninstallStateChannel = preProtocolStateChannel.setState(
        appToUninstall,
        newState,
        stateTimeout,
      );
      logTime(log, substart, `[${loggerId}] setState for action complete`);
    } else {
      preUninstallStateChannel = preProtocolStateChannel;
    }

    substart = Date.now();
    // make sure the uninstalled app is the finalized app
    const preUninstallApp = preUninstallStateChannel.appInstances.get(appToUninstall.identityHash)!;

    const postProtocolStateChannel = preUninstallStateChannel.uninstallApp(
      preUninstallApp,
      await computeTokenIndexedFreeBalanceIncrements(preUninstallApp, network, undefined, log),
    );

    logTime(log, substart, `[${loggerId}] computeStateTransition for uninstall complete`);

    substart = Date.now();
    const initiatorFreeBalanceKey = getSignerAddressFromPublicIdentifier(initiatorIdentifier);

    const uninstallCommitment = getSetStateCommitment(
      network,
      postProtocolStateChannel.freeBalance,
    );

    const counterpartySignature = context.message.customData.signature;
    const uninstallCommitmentHash = uninstallCommitment.hashToSign();

    // 15ms
    await assertIsValidSignature(
      initiatorFreeBalanceKey,
      uninstallCommitmentHash,
      counterpartySignature,
      `Failed to validate initiator's signature on free balance commitment in the uninstall protocol. Our commitment: ${stringify(
        uninstallCommitment.toJson(),
      )}`,
    );
    logTime(log, substart, `[${loggerId}] Asserted valid signature in responding uninstall`);
    substart = Date.now();

    // 10ms
    const mySignature = yield [OP_SIGN, uninstallCommitmentHash];
    logTime(log, substart, `[${loggerId}] Signed commitment in responding uninstall`);

    await uninstallCommitment.addSignatures(counterpartySignature, mySignature);

    // 59ms
    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.RemoveInstance,
      postProtocolStateChannel,
      preUninstallApp,
      uninstallCommitment,
    ];

    // 0ms
    yield [
      IO_SEND,
      {
        protocol,
        processID,
        to: initiatorIdentifier,
        seq: UNASSIGNED_SEQ_NO,
        prevMessageReceived: start,
        customData: {
          signature: mySignature,
        },
      } as ProtocolMessageData,
      postProtocolStateChannel,
      preUninstallApp,
    ];

    // 100ms
    logTime(log, start, `[${loggerId}] Response finished`);
  },
};
