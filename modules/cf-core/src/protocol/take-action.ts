import { PersistAppType } from "@connext/types";
import { SetStateCommitment } from "../ethereum";
import { Opcode, Protocol, xkeyKthAddress, Commitment, ProtocolExecutionFlow } from "../machine";
import { Context, ProtocolMessage, TakeActionProtocolParams } from "../types";
import { logTime } from "../utils";

import { assertIsValidSignature, UNASSIGNED_SEQ_NO } from "./utils";
import { StateChannel } from "../models";

const protocol = Protocol.TakeAction;
const { OP_SIGN, IO_SEND, IO_SEND_AND_WAIT, PERSIST_APP_INSTANCE, PERSIST_COMMITMENT } = Opcode;
const { SetState } = Commitment;

/**
 * @description This exchange is described at the following URL:
 *
 * TODO: write a todo message here
 *
 */
export const TAKE_ACTION_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function*(context: Context) {
    const { store, provider, message, network } = context;
    const log = context.log.newContext("CF-TakeActionProtocol");
    const start = Date.now();
    log.debug(`Initiation started for Take Action`);

    const { processID, params } = message;

    const {
      appIdentityHash,
      multisigAddress,
      responderXpub,
      action,
    } = params as TakeActionProtocolParams;

    // 8ms
    const preProtocolStateChannel = await store.getStateChannel(multisigAddress) as StateChannel;
    const preAppInstance = preProtocolStateChannel.getAppInstance(appIdentityHash);

    // 40ms
    let substart = Date.now();
    const postProtocolStateChannel = preProtocolStateChannel.setState(
      preAppInstance,
      await preAppInstance.computeStateTransition(action, provider),
    );
    logTime(log, substart, `SetState called in takeAction initiating`)

    // 0ms
    const appInstance = postProtocolStateChannel.getAppInstance(appIdentityHash);

    // 0ms
    const responderEphemeralKey = xkeyKthAddress(responderXpub, appInstance.appSeqNo);

    const setStateCommitment = new SetStateCommitment(
      network.ChallengeRegistry,
      appInstance.identity,
      appInstance.hashOfLatestState,
      appInstance.versionNumber,
      appInstance.timeout,
    );
    const setStateCommitmentHash = setStateCommitment.hashToSign();

    // 6ms
    const initiatorSignature = yield [OP_SIGN, setStateCommitmentHash, appInstance.appSeqNo];

    // 117ms
    const {
      customData: { signature: responderSignature },
    } = yield [
      IO_SEND_AND_WAIT,
      {
        protocol,
        processID,
        params,
        seq: 1,
        toXpub: responderXpub,
        customData: {
          signature: initiatorSignature,
        },
      } as ProtocolMessage,
    ];

    // 10ms
    await assertIsValidSignature(responderEphemeralKey, setStateCommitmentHash, responderSignature);

    // add signatures and write commitment to store
    setStateCommitment.signatures = [initiatorSignature, responderSignature];

    // 9ms
    yield [PERSIST_COMMITMENT, SetState, setStateCommitment, appIdentityHash];

    // 36ms
    yield [PERSIST_APP_INSTANCE, PersistAppType.Instance, postProtocolStateChannel, appInstance];

    // 228ms
    logTime(log, start, `Finished Initiating takeAction`);
  },

  1 /* Responding */: async function*(context: Context) {
    const { store, provider, message, network } = context;
    const log = context.log.newContext("CF-TakeActionProtocol");
    const start = Date.now();
    let substart = start;
    log.debug(`Response started for takeAction`);

    const {
      processID,
      params,
      customData: { signature: initiatorSignature },
    } = message;

    const {
      appIdentityHash,
      multisigAddress,
      initiatorXpub,
      action,
    } = params as TakeActionProtocolParams;

    // 9ms
    const preProtocolStateChannel = await store.getStateChannel(multisigAddress);
    const preAppInstance = preProtocolStateChannel.getAppInstance(appIdentityHash);
    // 48ms
    const postProtocolStateChannel = preProtocolStateChannel.setState(
      preAppInstance,
      await preAppInstance.computeStateTransition(action, provider),
    );

    // 0ms
    const appInstance = postProtocolStateChannel.getAppInstance(appIdentityHash);

    // 0ms
    const initiatorEphemeralKey = xkeyKthAddress(initiatorXpub, appInstance.appSeqNo);

    const setStateCommitment = new SetStateCommitment(
      network.ChallengeRegistry,
      appInstance.identity,
      appInstance.hashOfLatestState,
      appInstance.versionNumber,
      appInstance.timeout,
    );
    const setStateCommitmentHash = setStateCommitment.hashToSign();

    // 9ms
    await assertIsValidSignature(initiatorEphemeralKey, setStateCommitmentHash, initiatorSignature);

    // 7ms
    const responderSignature = yield [OP_SIGN, setStateCommitmentHash, appInstance.appSeqNo];

    // add signatures and write commitment to store
    setStateCommitment.signatures = [initiatorSignature, responderSignature];

    // 16ms
    yield [PERSIST_COMMITMENT, SetState, setStateCommitment, appIdentityHash];

    // 60ms
    yield [PERSIST_APP_INSTANCE, PersistAppType.Instance, postProtocolStateChannel, appInstance];

    // 0ms
    yield [
      IO_SEND,
      {
        protocol,
        processID,
        toXpub: initiatorXpub,
        seq: UNASSIGNED_SEQ_NO,
        customData: {
          signature: responderSignature,
        },
      } as ProtocolMessage,
    ];

    // 149ms
    logTime(log, start, `Finished responding to takeAction`);
  },
};
