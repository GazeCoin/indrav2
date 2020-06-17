import { ChallengeStatus, AppChallenge } from "@connext/types";
import { toBN } from "@connext/utils";
import { Wallet, utils } from "ethers";

import { setupContext } from "../context";
import {
  AppWithCounterAction,
  AppWithCounterState,
  encodeState,
  expect,
  mineBlocks,
} from "../utils";

const { keccak256 } = utils;

describe("ChallengeRegistry", () => {
  let ONCHAIN_CHALLENGE_TIMEOUT: number;
  let alice: Wallet;
  let action: AppWithCounterAction;
  let state1: AppWithCounterState;
  let state0: AppWithCounterState;

  // helpers
  let setState: (versionNumber: number, appState?: string, timeout?: number) => Promise<void>;
  let setAndProgressState: (
    versionNumber: number,
    state?: AppWithCounterState,
    turnTaker?: Wallet,
  ) => Promise<void>;
  let setOutcome: (finalState?: string) => Promise<void>;
  let progressState: (
    state: AppWithCounterState,
    action: AppWithCounterAction,
    signer: Wallet,
  ) => Promise<void>;
  let progressStateAndVerify: (
    state: AppWithCounterState,
    action: AppWithCounterAction,
    signer?: Wallet,
  ) => Promise<void>;
  let cancelDisputeAndVerify: (versionNumber: number, signatures?: string[]) => Promise<void>;

  let verifyChallenge: (expected: Partial<AppChallenge>) => Promise<void>;
  let isProgressable: () => Promise<boolean>;

  beforeEach(async () => {
    const context = await setupContext();

    // apps / constants
    ONCHAIN_CHALLENGE_TIMEOUT = context["ONCHAIN_CHALLENGE_TIMEOUT"];
    alice = context["alice"];
    state0 = context["state0"];
    action = context["action"];
    state1 = context["state1"];

    // helpers
    setState = context["setStateAndVerify"];
    progressState = context["progressState"];
    progressStateAndVerify = context["progressStateAndVerify"];
    setOutcome = context["setOutcomeAndVerify"];
    setAndProgressState = (
      versionNumber: number,
      state?: AppWithCounterState,
      turnTaker?: Wallet,
    ) =>
      context["setAndProgressStateAndVerify"](
        versionNumber, // nonce
        state || state0, // state
        action, // action
        undefined, // timeout
        turnTaker || context["bob"], // turn taker
      );
    verifyChallenge = context["verifyChallenge"];
    isProgressable = context["isProgressable"];
    cancelDisputeAndVerify = context["cancelDisputeAndVerify"];
  });

  it("Can successfully dispute using: `setAndProgressState` + `progressState` + `setOutcome`", async () => {
    // first set the state
    await setAndProgressState(1, state0);

    // update with `progressState` to finalized state
    // state finalizes when counter > 5
    const finalizingAction = { ...action, increment: toBN(10) };
    await progressState(state1, finalizingAction, alice);
    // verify explicitly finalized
    const finalState = {
      counter: state1.counter.add(finalizingAction.increment),
    };
    await verifyChallenge({
      appStateHash: keccak256(encodeState(finalState)),
      status: ChallengeStatus.EXPLICITLY_FINALIZED,
      versionNumber: toBN(3),
    });

    // set + verify outcome
    await setOutcome(encodeState(finalState));
  });

  it("Can successfully dispute using: `setState` + `setState` + `setOutcome`", async () => {
    await setState(1, encodeState(state0));

    await setState(10, encodeState(state0));

    await setState(15, encodeState(state0));

    await mineBlocks(ONCHAIN_CHALLENGE_TIMEOUT + 15);

    await setOutcome(encodeState(state0));
  });

  it("Can successfully dispute using: `setState` + `progressState` + `progressState` + `setOutcome`", async () => {
    await setState(1, encodeState(state0));

    await setState(10, encodeState(state0));

    await setState(15, encodeState(state0));

    await mineBlocks(ONCHAIN_CHALLENGE_TIMEOUT + 2);
    expect(await isProgressable()).to.be.true;

    await progressStateAndVerify(state0, action);
    await progressStateAndVerify(state1, action, alice);

    await mineBlocks(ONCHAIN_CHALLENGE_TIMEOUT + 15);
    expect(await isProgressable()).to.be.false;

    await setOutcome(
      encodeState({
        ...state1,
        counter: state1.counter.add(action.increment),
      }),
    );
  });

  it("Cannot cancel challenge at `setState` phase", async () => {
    await setState(1, encodeState(state0));
    await expect(cancelDisputeAndVerify(1)).to.be.revertedWith(
      "cancelDispute called on challenge that cannot be cancelled",
    );

    await setState(15, encodeState(state0));
    await expect(cancelDisputeAndVerify(15)).to.be.revertedWith(
      "cancelDispute called on challenge that cannot be cancelled",
    );
  });

  it("Can cancel challenge at `progressState` phase", async () => {
    await setAndProgressState(1, state0);
    await cancelDisputeAndVerify(2);

    await setAndProgressState(2, state0);
    await cancelDisputeAndVerify(3);
  });

  it("Cannot cancel challenge after outcome set", async () => {
    await setState(1, encodeState(state0));

    await mineBlocks(ONCHAIN_CHALLENGE_TIMEOUT + 15);

    await setOutcome(encodeState(state0));
    await expect(cancelDisputeAndVerify(1)).to.be.revertedWith(
      "cancelDispute called on challenge that cannot be cancelled",
    );
  });
});
