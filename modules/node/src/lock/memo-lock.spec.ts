import { delay } from "@connext/utils";
import { Test } from "@nestjs/testing";
import Redis from "ioredis";

import { RedisModule } from "../redis/redis.module";
import { RedisProviderId } from "../constants";
import { MemoLock } from "./memo-lock";
import { LoggerModule } from "../logger/logger.module";
import { LoggerService } from "../logger/logger.service";
import { expect } from "../test/utils";

describe("MemoLock", () => {
  let redis: Redis.Redis;
  let log: LoggerService;

  before(async () => {
    const module = await Test.createTestingModule({
      imports: [RedisModule, LoggerModule],
    }).compile();
    redis = module.get<Redis.Redis>(RedisProviderId);
    log = await module.resolve<LoggerService>(LoggerService);
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  describe("with a common lock", () => {
    let module: MemoLock;
    const TTL = 5000;

    beforeEach(async () => {
      module = new MemoLock(log, redis, 5, TTL, 100);
      await module.setupSubs();
    });

    afterEach(async () => {
      await module.stopSubs();
    });

    it("should not allow locks to simultaneously access resources", async () => {
      const store = { test: "value" };
      const callback = async (lockName: string, wait: number = TTL / 2) => {
        await delay(wait);
        store.test = lockName;
      };
      const lock = await module.acquireLock("foo");
      callback("round1").then(async () => {
        await module.releaseLock("foo", lock);
      });
      const nextLock = await module.acquireLock("foo");
      expect(nextLock).to.not.eq(lock);
      await callback("round2", TTL / 4);
      await module.releaseLock("foo", nextLock);
      expect(store.test).to.be.eq("round2");
    });

    it("should allow locking to occur", async () => {
      const lock = await module.acquireLock("foo");
      const start = Date.now();
      setTimeout(() => {
        module.releaseLock("foo", lock);
      }, 101);
      const nextLock = await module.acquireLock("foo");
      expect(Date.now() - start).to.be.at.least(100);
      await module.releaseLock("foo", nextLock);
    });

    it("should enforce the queue size", async () => {
      await module.acquireLock("foo");
      for (let i = 0; i < 4; i++) {
        module.acquireLock("foo").catch(console.error.bind(console, "Error acquiring lock:"));
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      try {
        await module.acquireLock("foo");
      } catch (e) {
        expect(e.message).to.contain("is full");
        return;
      }
      throw new Error("expected an error");
    });

    it("should handle deadlocks", async () => {
      await module.acquireLock("foo");
      await new Promise((resolve) => setTimeout(resolve, 800));
      const lock = await module.acquireLock("foo");
      await module.releaseLock("foo", lock);
    });

    it("should handle concurrent locking", async () => {
      const start = Date.now();
      const array = [1, 2, 3, 4];
      await Promise.all(
        array.map(async (i) => {
          const lock = await module.acquireLock("foo");
          await new Promise((resolve) => setTimeout(resolve, 800));
          await module.releaseLock("foo", lock);
          expect(Date.now() - start).to.be.gte(700 * i);
        }),
      );
    });
  });

  it("should expire locks in TTL order", async () => {
    const customModule = new MemoLock(log, redis, 5, 1000, 10000);
    await customModule.setupSubs();
    await customModule.acquireLock("foo");
    let err: Error;
    let done = false;
    customModule
      .acquireLock("foo")
      .then(() => console.error(`Lock was unlocked - should not happen!`))
      .catch((e) => {
        err = e;
      });
    setTimeout(
      () =>
        customModule
          .acquireLock("foo")
          .then(() => {
            done = true;
          })
          .catch((e) => console.error(`Caught error acquiring lock: ${e.stack}`)),
      500,
    );
    setTimeout(
      () => customModule.pulse().catch((e) => console.error(`Caught error pulsing: ${e.stack}`)),
      1200,
    );
    await new Promise((resolve, reject) =>
      setTimeout(() => {
        try {
          expect(err).not.to.be.undefined;
          expect(err!.message).to.contain("expired after");
          expect(done).to.be.true;
          resolve();
        } catch (e) {
          reject(e);
        }
      }, 2000),
    );
    await customModule.stopSubs();
  });
});
