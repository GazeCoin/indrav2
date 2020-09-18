/* global before */
import { SolidityValueType } from "@connext/types";
import { BigNumber, Contract, ContractFactory, utils } from "ethers";

import { NimApp } from "../../artifacts";

import { expect, provider } from "../utils";

const { defaultAbiCoder } = utils;

type NimAppState = {
  versionNumber: BigNumber;
  pileHeights: BigNumber[];
};

const decodeBytesToAppState = (encodedAppState: string): NimAppState => {
  return defaultAbiCoder.decode(
    ["tuple(uint256 versionNumber, uint256[3] pileHeights)"],
    encodedAppState,
  )[0];
};

describe("Nim", () => {
  let nim: Contract;

  const encodeState = (state: SolidityValueType) => {
    return defaultAbiCoder.encode(
      [
        `
        tuple(
          uint256 versionNumber,
          uint256[3] pileHeights
        )
      `,
      ],
      [state],
    );
  };

  const encodeAction = (state: SolidityValueType) => {
    return defaultAbiCoder.encode(
      [
        `
        tuple(
          uint256 pileIdx,
          uint256 takeAmnt
        )
      `,
      ],
      [state],
    );
  };

  const applyAction = async (state: SolidityValueType, action: SolidityValueType) => {
    return nim.applyAction(encodeState(state), encodeAction(action));
  };

  const isStateTerminal = async (state: SolidityValueType) => {
    return nim.isStateTerminal(encodeState(state));
  };

  before(async () => {
    const wallet = (await provider.getWallets())[0];
    nim = await new ContractFactory(NimApp.abi, NimApp.bytecode, wallet).deploy();
  });

  describe("applyAction", () => {
    it("can take from a pile", async () => {
      const preState = {
        versionNumber: 0,
        pileHeights: [6, 5, 12],
      };

      const action = {
        pileIdx: 0,
        takeAmnt: 5,
      };

      const ret = await applyAction(preState, action);

      const postState = decodeBytesToAppState(ret);

      expect(postState.pileHeights[0]).to.eq(1);
      expect(postState.pileHeights[1]).to.eq(5);
      expect(postState.pileHeights[2]).to.eq(12);
      expect(postState.versionNumber).to.eq(1);
    });

    it("can take to produce an empty pile", async () => {
      const preState = {
        versionNumber: 0,
        pileHeights: [6, 5, 12],
      };

      const action = {
        pileIdx: 0,
        takeAmnt: 6,
      };

      const ret = await applyAction(preState, action);

      const postState = decodeBytesToAppState(ret);

      expect(postState.pileHeights[0]).to.eq(0);
      expect(postState.pileHeights[1]).to.eq(5);
      expect(postState.pileHeights[2]).to.eq(12);
      expect(postState.versionNumber).to.eq(1);
    });

    it("should fail for taking too much", async () => {
      const preState = {
        versionNumber: 0,
        pileHeights: [6, 5, 12],
      };

      const action = {
        pileIdx: 0,
        takeAmnt: 7,
      };

      await expect(applyAction(preState, action)).to.be.revertedWith("invalid pileIdx");
    });
  });

  describe("isFinal", () => {
    it("empty state is final", async () => {
      const preState = {
        versionNumber: 49,
        pileHeights: [0, 0, 0],
      };
      expect(await isStateTerminal(preState)).to.eq(true);
    });

    it("nonempty state is not final", async () => {
      const preState = {
        versionNumber: 49,
        pileHeights: [0, 1, 0],
      };
      expect(await isStateTerminal(preState)).to.eq(false);
    });
  });
});
