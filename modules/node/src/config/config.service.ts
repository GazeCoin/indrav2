import { NatsConfig } from "@connext/nats-messaging-client";
import * as dotenv from "dotenv";
import * as fs from "fs";

type PostgresConfig = {
  database: string;
  host: string;
  password: string;
  port: number;
  username: string;
};

export class ConfigService {
  private readonly envConfig: { [key: string]: string };

  constructor(filePath?: string) {
    let fileConfig;
    try {
      fileConfig = filePath ? dotenv.parse(fs.readFileSync(filePath)) : {};
    } catch (e) {
      console.error(`Error reading dotenv file: ${filePath}`);
      fileConfig = {};
    }
    this.envConfig = {
      ...fileConfig,
      ...process.env,
    };
  }

  get(key: string): string {
    return this.envConfig[key];
  }

  getEthProviderConfig(): { [key: string]: string } {
    return {
      ethNetwork: this.get("ETH_NETWORK"),
      ethUrl: this.get("ETH_RPC_URL"),
    };
  }

  getMnemonic(): string {
    return this.get("ETH_MNEMONIC");
  }

  getPostgresConfig(): PostgresConfig {
    return {
      database: this.get("INDRA_PG_DATABASE"),
      host: this.get("INDRA_PG_HOST"),
      password: this.get("INDRA_PG_PASSWORD"),
      port: parseInt(this.get("INDRA_PG_PORT"), 10),
      username: this.get("INDRA_PG_USERNAME"),
    };
  }

  getNatsConfig(): NatsConfig {
    return {
      clusterId: this.get("INDRA_NATS_CLUSTER_ID"),
      servers: this.get("INDRA_NATS_SERVERS").split(","),
      token: this.get("INDRA_NATS_TOKEN"),
    };
  }
}