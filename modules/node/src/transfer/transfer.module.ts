import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { AuthModule } from "../auth/auth.module";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { ChannelModule } from "../channel/channel.module";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";
import { MessagingModule } from "../messaging/messaging.module";

import { transferProviderFactory } from "./transfer.provider";
import { TransferRepository } from "./transfer.repository";
import { TransferService } from "./transfer.service";
import { LinkedTransferRepository } from "./linkedTransfer.repository";
import { PeerToPeerTransferRepository } from "./peerToPeerTransfer.repository";
import { FastSignedTransferRepository } from "./fastSignedTransfer.repository";

@Module({
  controllers: [],
  exports: [TransferService],
  imports: [
    AuthModule,
    CFCoreModule,
    ChannelModule,
    ConfigModule,
    LoggerModule,
    MessagingModule,
    TypeOrmModule.forFeature([
      ChannelRepository,
      AppRegistryRepository,
      LinkedTransferRepository,
      PeerToPeerTransferRepository,
      TransferRepository,
      FastSignedTransferRepository,
    ]),
  ],
  providers: [TransferService, transferProviderFactory],
})
export class TransferModule {}
