import { AppChallenge, ChallengeStatus } from "@connext/types";
import { toBN } from "@connext/utils";
import { BigNumberish, Wallet, utils } from "ethers";

import { setupContext } from "../context";
import {
  ActionType,
  AppWithCounterAction,
  expect,
  mineBlocks,
  provider,
  restore,
  snapshot,
} from "../utils";

describe("LibStateChannelApp", () => {
  let wallet: Wallet;

  // apps/constants
  let ONCHAIN_CHALLENGE_TIMEOUT: number;
  let bob: Wallet;
  let alice: Wallet;

  // helpers
  let hasPassed: (timeout: BigNumberish) => Promise<boolean>;
  let isDisputable: (challenge?: AppChallenge) => Promise<boolean>;
  let setState: (versionNumber: number) => Promise<void>;
  let verifyChallenge: (expected: Partial<AppChallenge>) => Promise<void>;
  let setAndProgressState: (versionNumber: number, action?: AppWithCounterAction) => Promise<void>;
  let isProgressable: () => Promise<boolean>;
  let verifySignatures: (digest?: string, sigs?: string[], signers?: string[]) => Promise<boolean>;
  let isCancellable: () => Promise<boolean>;

  before(async () => {
    wallet = (await provider.getWallets())[0];
    await wallet.getTransactionCount();
  });

  beforeEach(async () => {
    const context = await setupContext();

    // apps/constants
    ONCHAIN_CHALLENGE_TIMEOUT = context["ONCHAIN_CHALLENGE_TIMEOUT"];
    bob = context["bob"];
    alice = context["alice"];

    // helpers
    hasPassed = context["hasPassed"];
    isProgressable = context["isProgressable"];
    isCancellable = context["isCancellable"];
    isDisputable = context["isDisputable"];
    setState = context["setStateAndVerify"];
    verifyChallenge = context["verifyChallenge"];
    setAndProgressState = (versionNumber: number, action?: AppWithCounterAction) =>
      context["setAndProgressStateAndVerify"](
        versionNumber,
        context["state0"],
        action || context["action"],
      );

    verifySignatures = context["verifySignatures"];
  });

  describe("hasPassed", () => {
    it("should return true if timeout < curr block", async () => {
      const currBlock = await provider.getBlockNumber();
      expect(await hasPassed(currBlock - 2)).to.be.true;
    });

    it("should return true if timeout == curr block", async () => {
      const currBlock = await provider.getBlockNumber();
      expect(await hasPassed(currBlock)).to.be.true;
    });

    it("should return false if timeout > curr block", async () => {
      const currBlock = await provider.getBlockNumber();
      expect(await hasPassed(currBlock + 10)).to.be.false;
    });
  });

  describe("isDisputable", () => {
    it("should return true for an empty challenge", async () => {
      expect(await isDisputable()).to.be.true;
    });

    it("should return true for a challenge IN_DISPUTE phase", async () => {
      await setState(1);
      expect(await isDisputable()).to.be.true;
    });

    it("should return false once the IN_DISPUTE phase elapses", async () => {
      await setState(1);
      await mineBlocks(45);
      expect(await isDisputable()).to.be.false;
    });

    it("should return false if status is not IN_DISPUTE", async () => {
      await setAndProgressState(1);
      expect(await isDisputable()).to.be.false;
    });
  });

  describe("isProgressable", () => {
    it("should return true if challenge is in dispute, and the progress state period has not elapsed, but the set state period has", async () => {
      await setState(1);

      await mineBlocks(ONCHAIN_CHALLENGE_TIMEOUT + 2);

      expect(await isProgressable()).to.be.true;
    });

    it("should return true if challenge is in onchain progression and the progress state period has not elapsed", async () => {
      await setAndProgressState(1);
      await verifyChallenge({
        versionNumber: toBN(2),
        status: ChallengeStatus.IN_ONCHAIN_PROGRESSION,
      });

      await mineBlocks(2);

      expect(await isProgressable()).to.be.true;
    });

    it("should return false if progress state period has elapsed", async () => {
      await setAndProgressState(1);

      await mineBlocks(100);

      expect(await isProgressable()).to.be.false;
    });

    it("should return false if channel is still in set state period", async () => {
      await setState(1);

      expect(await isProgressable()).to.be.false;
    });

    it("should return false for an empty challenge", async () => {
      expect(await isProgressable()).to.be.false;
    });
  });

  describe("isCancellable", () => {
    it("should return false if it is set state phase", async () => {
      await setState(1);
      expect(await isCancellable()).to.be.false;
    });

    it("should return true if it is state progression phase", async () => {
      await setAndProgressState(1);
      expect(await isCancellable()).to.be.true;
    });

    it("should return false if it is explicitly finalized", async () => {
      await setAndProgressState(1, {
        actionType: ActionType.SUBMIT_COUNTER_INCREMENT,
        increment: toBN(10),
      });
      await verifyChallenge({ status: ChallengeStatus.EXPLICITLY_FINALIZED });
      expect(await isProgressable()).to.be.false;
      expect(await isCancellable()).to.be.false;
    });

    it("should return false if the progress state period has elapsed", async () => {
      await setAndProgressState(1);
      await mineBlocks(100);
      expect(await isCancellable()).to.be.false;
    });

    it("should return false if there is no challenge", async () => {
      expect(await isCancellable()).to.be.false;
    });
  });

  describe("verifySignatures", () => {
    it("should fail if signatures.length !== signers.length", async () => {
      await expect(verifySignatures(undefined, undefined, [alice.address])).to.be.revertedWith(
        "Signers and signatures should be of equal length",
      );
    });

    it("should fail if the signers are not sorted", async () => {
      await expect(
        verifySignatures(undefined, undefined, [bob.address, alice.address]),
      ).to.be.revertedWith("Invalid signature");
    });

    it("should fail if the signer is invalid", async () => {
      await expect(
        verifySignatures(undefined, undefined, [wallet.address, bob.address]),
      ).to.be.revertedWith("Invalid signature");
    });

    it("should work", async () => {
      expect(await verifySignatures()).to.be.true;
    });
  });
});
