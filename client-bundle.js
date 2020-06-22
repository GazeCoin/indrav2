(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const messaging_1 = require("@connext/messaging");
const proxy_lock_1 = require("@connext/proxy-lock");
const types_1 = require("@connext/types");
const types_2 = require("@counterfactual/types");
require("core-js/stable");
const ethers_1 = require("ethers");
const constants_1 = require("ethers/constants");
const utils_1 = require("ethers/utils");
const human_standard_token_abi_1 = __importDefault(require("human-standard-token-abi"));
require("regenerator-runtime/runtime");
const ConditionalTransferController_1 = require("./controllers/ConditionalTransferController");
const DepositController_1 = require("./controllers/DepositController");
const ResolveConditionController_1 = require("./controllers/ResolveConditionController");
const SwapController_1 = require("./controllers/SwapController");
const TransferController_1 = require("./controllers/TransferController");
const WithdrawalController_1 = require("./controllers/WithdrawalController");
const cfCore_1 = require("./lib/cfCore");
const logger_1 = require("./lib/logger");
const utils_2 = require("./lib/utils");
const listener_1 = require("./listener");
const node_1 = require("./node");
const addresses_1 = require("./validation/addresses");
const bn_1 = require("./validation/bn");
function connect(opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const { logLevel, ethProviderUrl, mnemonic, natsClusterId, nodeUrl, natsToken, store } = opts;
        const logger = new logger_1.Logger("ConnextConnect", logLevel);
        const ethProvider = new ethers_1.providers.JsonRpcProvider(ethProviderUrl);
        const network = yield ethProvider.getNetwork();
        if (network.chainId === 4447) {
            network.name = "ganache";
            ethProvider.getSigner = (addressOrIndex) => {
                throw { code: "UNSUPPORTED_OPERATION" };
            };
        }
        logger.info(`Creating messaging service client (logLevel: ${logLevel})`);
        const messagingFactory = new messaging_1.MessagingServiceFactory({
            clusterId: natsClusterId,
            logLevel,
            messagingUrl: nodeUrl,
            token: natsToken,
        });
        const messaging = messagingFactory.createService("messaging");
        yield messaging.connect();
        logger.info("Messaging service is connected");
        const extendedXpriv = utils_1.HDNode.fromMnemonic(mnemonic).extendedKey;
        yield store.set([{ path: cfCore_1.EXTENDED_PRIVATE_KEY_PATH, value: extendedXpriv }]);
        const nodeApiConfig = {
            logLevel,
            messaging,
        };
        logger.info("creating node api client");
        const node = new node_1.NodeApiClient(nodeApiConfig);
        logger.info("created node api client successfully");
        const config = yield node.config();
        logger.info(`node is connected to eth network: ${JSON.stringify(config.ethNetwork)}`);
        node.setNodePublicIdentifier(config.nodePublicIdentifier);
        const appRegistry = yield node.appRegistry();
        logger.info("using node's proxy lock service");
        let lockService = new proxy_lock_1.ProxyLockService(messaging);
        logger.info("creating new cf module");
        const cfCore = yield cfCore_1.CFCore.create(messaging, store, {
            STORE_KEY_PREFIX: "store",
        }, ethProvider, config.contractAddresses, lockService);
        node.setUserPublicIdentifier(cfCore.publicIdentifier);
        logger.info("created cf module successfully");
        const signer = yield cfCore.signerAddress();
        logger.info(`cf module signer address: ${signer}`);
        const myChannel = yield node.getChannel();
        let multisigAddress;
        if (!myChannel) {
            logger.info("no channel detected, creating channel..");
            const creationEventData = yield new Promise((res, rej) => __awaiter(this, void 0, void 0, function* () {
                const timer = setTimeout(() => rej("Create channel event not fired within 30s"), 30000);
                cfCore.once(types_2.Node.EventName.CREATE_CHANNEL, (data) => {
                    clearTimeout(timer);
                    res(data.data);
                });
                const creationData = yield node.createChannel();
                logger.info(`created channel, transaction: ${creationData}`);
            }));
            logger.info(`create channel event data: ${JSON.stringify(creationEventData, utils_2.replaceBN, 2)}`);
            multisigAddress = creationEventData.multisigAddress;
        }
        else {
            multisigAddress = myChannel.multisigAddress;
        }
        logger.info(`multisigAddress: ${multisigAddress}`);
        const client = new ConnextInternal(Object.assign({ appRegistry,
            cfCore,
            ethProvider,
            messaging,
            multisigAddress,
            network,
            node, nodePublicIdentifier: config.nodePublicIdentifier }, opts));
        yield client.registerSubscriptions();
        return client;
    });
}
exports.connect = connect;
class ConnextChannel {
    constructor(opts) {
        this.on = (event, callback) => {
            return this.internal.on(event, callback);
        };
        this.emit = (event, data) => {
            return this.internal.emit(event, data);
        };
        this.deposit = (params) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.deposit(params);
        });
        this.swap = (params) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.swap(params);
        });
        this.transfer = (params) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.transfer(params);
        });
        this.withdraw = (params) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.withdraw(params);
        });
        this.resolveCondition = (params) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.resolveCondition(params);
        });
        this.conditionalTransfer = (params) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.conditionalTransfer(params);
        });
        this.config = () => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.node.config();
        });
        this.getChannel = () => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.node.getChannel();
        });
        this.getAppRegistry = (appDetails) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.node.appRegistry(appDetails);
        });
        this.createChannel = () => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.node.createChannel();
        });
        this.subscribeToSwapRates = (from, to, callback) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.node.subscribeToSwapRates(from, to, callback);
        });
        this.getLatestSwapRate = (from, to) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.node.getLatestSwapRate(from, to);
        });
        this.unsubscribeToSwapRates = (from, to) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.node.unsubscribeFromSwapRates(from, to);
        });
        this.requestCollateral = (tokenAddress) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.node.requestCollateral(tokenAddress);
        });
        this.addPaymentProfile = (profile) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.node.addPaymentProfile(profile);
        });
        this.getPaymentProfile = (assetId) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.node.getPaymentProfile(assetId);
        });
        this.verifyAppSequenceNumber = () => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.verifyAppSequenceNumber();
        });
        this.cfDeposit = (amount, assetId, notifyCounterparty = false) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.cfDeposit(amount, assetId, notifyCounterparty);
        });
        this.getFreeBalance = (assetId = constants_1.AddressZero) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.getFreeBalance(assetId);
        });
        this.getAppInstances = () => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.getAppInstances();
        });
        this.getAppInstanceDetails = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.getAppInstanceDetails(appInstanceId);
        });
        this.getAppState = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.getAppState(appInstanceId);
        });
        this.getProposedAppInstances = () => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.getProposedAppInstances();
        });
        this.getProposedAppInstance = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.getProposedAppInstance(appInstanceId);
        });
        this.proposeInstallApp = (params) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.proposeInstallApp(params);
        });
        this.proposeInstallVirtualApp = (params) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.proposeInstallVirtualApp(params);
        });
        this.installVirtualApp = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.installVirtualApp(appInstanceId);
        });
        this.installApp = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.installApp(appInstanceId);
        });
        this.rejectInstallApp = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.rejectInstallApp(appInstanceId);
        });
        this.rejectInstallVirtualApp = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.rejectInstallVirtualApp(appInstanceId);
        });
        this.takeAction = (appInstanceId, action) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.takeAction(appInstanceId, action);
        });
        this.updateState = (appInstanceId, newState) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.updateState(appInstanceId, newState);
        });
        this.uninstallApp = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.uninstallApp(appInstanceId);
        });
        this.uninstallVirtualApp = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.uninstallVirtualApp(appInstanceId);
        });
        this.cfWithdraw = (amount, assetId, recipient) => __awaiter(this, void 0, void 0, function* () {
            return yield this.internal.cfWithdraw(amount, assetId, recipient);
        });
        this.opts = opts;
        this.internal = this;
    }
}
exports.ConnextChannel = ConnextChannel;
class ConnextInternal extends ConnextChannel {
    constructor(opts) {
        super(opts);
        this.registerSubscriptions = () => __awaiter(this, void 0, void 0, function* () {
            yield this.listener.register();
        });
        this.deposit = (params) => __awaiter(this, void 0, void 0, function* () {
            return yield this.depositController.deposit(params);
        });
        this.swap = (params) => __awaiter(this, void 0, void 0, function* () {
            return yield this.swapController.swap(params);
        });
        this.transfer = (params) => __awaiter(this, void 0, void 0, function* () {
            return yield this.transferController.transfer(params);
        });
        this.withdraw = (params) => __awaiter(this, void 0, void 0, function* () {
            return yield this.withdrawalController.withdraw(params);
        });
        this.resolveCondition = (params) => __awaiter(this, void 0, void 0, function* () {
            return yield this.resolveConditionController.resolve(params);
        });
        this.conditionalTransfer = (params) => __awaiter(this, void 0, void 0, function* () {
            return yield this.conditionalTransferController.conditionalTransfer(params);
        });
        this.on = (event, callback) => {
            return this.listener.on(event, callback);
        };
        this.emit = (event, data) => {
            return this.listener.emit(event, data);
        };
        this.getStateChannel = () => __awaiter(this, void 0, void 0, function* () {
            const params = {
                id: Date.now(),
                methodName: "chan_getStateChannel",
                parameters: {
                    multisigAddress: this.multisigAddress,
                },
            };
            const getStateChannelRes = yield this.cfCore.rpcRouter.dispatch(params);
            return getStateChannelRes.result.result;
        });
        this.cfDeposit = (amount, assetId, notifyCounterparty = false) => __awaiter(this, void 0, void 0, function* () {
            const depositAddr = utils_2.publicIdentifierToAddress(this.cfCore.publicIdentifier);
            let bal;
            if (assetId === constants_1.AddressZero) {
                bal = yield this.ethProvider.getBalance(depositAddr);
            }
            else {
                const token = new ethers_1.Contract(assetId, human_standard_token_abi_1.default, this.ethProvider);
                bal = yield token.balanceOf(depositAddr);
            }
            const err = [
                bn_1.notPositive(amount),
                addresses_1.invalidAddress(assetId),
                bn_1.notLessThanOrEqualTo(amount, bal),
            ].filter(bn_1.falsy)[0];
            if (err) {
                this.logger.error(err);
                throw new Error(err);
            }
            const depositResponse = yield this.cfCore.rpcRouter.dispatch({
                id: Date.now(),
                methodName: types_2.Node.RpcMethodName.DEPOSIT,
                parameters: {
                    amount,
                    multisigAddress: this.opts.multisigAddress,
                    notifyCounterparty,
                    tokenAddress: types_1.makeChecksum(assetId),
                },
            });
            return depositResponse.result.result;
        });
        this.getAppInstances = () => __awaiter(this, void 0, void 0, function* () {
            const appInstanceResponse = yield this.cfCore.rpcRouter.dispatch({
                id: Date.now(),
                methodName: types_2.Node.RpcMethodName.GET_APP_INSTANCES,
                parameters: {},
            });
            return appInstanceResponse.result.result.appInstances;
        });
        this.getFreeBalance = (assetId = constants_1.AddressZero) => __awaiter(this, void 0, void 0, function* () {
            const normalizedAssetId = types_1.makeChecksum(assetId);
            try {
                const freeBalance = yield this.cfCore.rpcRouter.dispatch({
                    id: Date.now(),
                    methodName: types_2.Node.RpcMethodName.GET_FREE_BALANCE_STATE,
                    parameters: {
                        multisigAddress: this.multisigAddress,
                        tokenAddress: normalizedAssetId,
                    },
                });
                return freeBalance.result.result;
            }
            catch (e) {
                const error = `No free balance exists for the specified token: ${normalizedAssetId}`;
                if (e.message.includes(error)) {
                    const obj = {};
                    obj[utils_2.freeBalanceAddressFromXpub(this.nodePublicIdentifier)] = new utils_1.BigNumber(0);
                    obj[this.freeBalanceAddress] = new utils_1.BigNumber(0);
                    return obj;
                }
                throw e;
            }
        });
        this.getProposedAppInstances = () => __awaiter(this, void 0, void 0, function* () {
            const proposedRes = yield this.cfCore.rpcRouter.dispatch({
                id: Date.now(),
                methodName: types_2.Node.RpcMethodName.GET_PROPOSED_APP_INSTANCES,
                parameters: {},
            });
            return proposedRes.result.result;
        });
        this.getProposedAppInstance = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            const proposedRes = yield this.cfCore.rpcRouter.dispatch({
                id: Date.now(),
                methodName: types_2.Node.RpcMethodName.GET_PROPOSED_APP_INSTANCES,
                parameters: {
                    appInstanceId,
                },
            });
            return proposedRes.result.result;
        });
        this.getAppInstanceDetails = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            const err = yield this.appNotInstalled(appInstanceId);
            if (err) {
                this.logger.warn(err);
                return undefined;
            }
            const appInstanceResponse = yield this.cfCore.rpcRouter.dispatch({
                id: Date.now(),
                methodName: types_2.Node.RpcMethodName.GET_APP_INSTANCE_DETAILS,
                parameters: {
                    appInstanceId,
                },
            });
            return appInstanceResponse.result.result;
        });
        this.getAppState = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            const err = yield this.appNotInstalled(appInstanceId);
            if (err) {
                this.logger.warn(err);
                return undefined;
            }
            const stateResponse = yield this.cfCore.rpcRouter.dispatch({
                id: Date.now(),
                methodName: types_2.Node.RpcMethodName.GET_STATE,
                parameters: {
                    appInstanceId,
                },
            });
            return stateResponse.result.result;
        });
        this.takeAction = (appInstanceId, action) => __awaiter(this, void 0, void 0, function* () {
            const err = yield this.appNotInstalled(appInstanceId);
            if (err) {
                this.logger.error(err);
                throw new Error(err);
            }
            const state = yield this.getAppState(appInstanceId);
            if (state.state.finalized) {
                throw new Error("Cannot take action on an app with a finalized state.");
            }
            const actionResponse = yield this.cfCore.rpcRouter.dispatch({
                id: Date.now(),
                methodName: types_2.Node.RpcMethodName.TAKE_ACTION,
                parameters: {
                    action,
                    appInstanceId,
                },
            });
            return actionResponse.result.result;
        });
        this.updateState = (appInstanceId, newState) => __awaiter(this, void 0, void 0, function* () {
            const err = yield this.appNotInstalled(appInstanceId);
            if (err) {
                this.logger.error(err);
                throw new Error(err);
            }
            const state = yield this.getAppState(appInstanceId);
            if (state.state.finalized) {
                throw new Error("Cannot take action on an app with a finalized state.");
            }
            const updateResponse = yield this.cfCore.rpcRouter.dispatch({
                id: Date.now(),
                methodName: types_2.Node.RpcMethodName.UPDATE_STATE,
                parameters: {
                    appInstanceId,
                    newState,
                },
            });
            return updateResponse.result.result;
        });
        this.proposeInstallVirtualApp = (params) => __awaiter(this, void 0, void 0, function* () {
            if (params.intermediaryIdentifier !== this.nodePublicIdentifier) {
                throw new Error(`Cannot install virtual app without node as intermediary`);
            }
            const actionRes = yield this.cfCore.rpcRouter.dispatch({
                id: Date.now(),
                methodName: types_2.Node.RpcMethodName.PROPOSE_INSTALL_VIRTUAL,
                parameters: params,
            });
            return actionRes.result.result;
        });
        this.proposeInstallApp = (params) => __awaiter(this, void 0, void 0, function* () {
            const actionRes = yield this.cfCore.rpcRouter.dispatch({
                id: Date.now(),
                methodName: types_2.Node.RpcMethodName.PROPOSE_INSTALL,
                parameters: params,
            });
            return actionRes.result.result;
        });
        this.installVirtualApp = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            const alreadyInstalled = yield this.appInstalled(appInstanceId);
            if (alreadyInstalled) {
                throw new Error(alreadyInstalled);
            }
            const installVirtualResponse = yield this.cfCore.rpcRouter.dispatch({
                id: Date.now(),
                methodName: types_2.Node.RpcMethodName.INSTALL_VIRTUAL,
                parameters: {
                    appInstanceId,
                    intermediaryIdentifier: this.nodePublicIdentifier,
                },
            });
            return installVirtualResponse.result.result;
        });
        this.installApp = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            const alreadyInstalled = yield this.appInstalled(appInstanceId);
            if (alreadyInstalled) {
                throw new Error(alreadyInstalled);
            }
            const installResponse = yield this.cfCore.rpcRouter.dispatch({
                id: Date.now(),
                methodName: types_2.Node.RpcMethodName.INSTALL,
                parameters: {
                    appInstanceId,
                },
            });
            return installResponse.result.result;
        });
        this.uninstallApp = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            const err = yield this.appNotInstalled(appInstanceId);
            if (err) {
                this.logger.error(err);
                throw new Error(err);
            }
            const uninstallResponse = yield this.cfCore.rpcRouter.dispatch({
                id: Date.now(),
                methodName: types_2.Node.RpcMethodName.UNINSTALL,
                parameters: {
                    appInstanceId,
                },
            });
            return uninstallResponse.result.result;
        });
        this.uninstallVirtualApp = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            const err = yield this.appNotInstalled(appInstanceId);
            if (err) {
                this.logger.error(err);
                throw new Error(err);
            }
            const uninstallVirtualResponse = yield this.cfCore.rpcRouter.dispatch({
                id: Date.now(),
                methodName: types_2.Node.RpcMethodName.UNINSTALL_VIRTUAL,
                parameters: {
                    appInstanceId,
                    intermediaryIdentifier: this.nodePublicIdentifier,
                },
            });
            return uninstallVirtualResponse.result.result;
        });
        this.rejectInstallApp = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            const rejectResponse = yield this.cfCore.rpcRouter.dispatch({
                id: Date.now(),
                methodName: types_2.Node.RpcMethodName.REJECT_INSTALL,
                parameters: {
                    appInstanceId,
                },
            });
            return rejectResponse.result.result;
        });
        this.rejectInstallVirtualApp = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            const rejectResponse = yield this.cfCore.rpcRouter.dispatch({
                id: Date.now(),
                methodName: types_2.Node.RpcMethodName.REJECT_INSTALL,
                parameters: {
                    appInstanceId,
                },
            });
            return rejectResponse.result.result;
        });
        this.cfWithdraw = (amount, assetId, recipient) => __awaiter(this, void 0, void 0, function* () {
            const freeBalance = yield this.getFreeBalance(assetId);
            const preWithdrawalBal = freeBalance[this.freeBalanceAddress];
            const err = [
                bn_1.notLessThanOrEqualTo(amount, preWithdrawalBal),
                assetId ? addresses_1.invalidAddress(assetId) : null,
                recipient ? addresses_1.invalidAddress(recipient) : null,
            ].filter(bn_1.falsy)[0];
            if (err) {
                this.logger.error(err);
                throw new Error(err);
            }
            const withdrawalResponse = yield this.cfCore.rpcRouter.dispatch({
                id: Date.now(),
                methodName: types_2.Node.RpcMethodName.WITHDRAW,
                parameters: {
                    amount,
                    multisigAddress: this.multisigAddress,
                    recipient,
                    tokenAddress: types_1.makeChecksumOrEthAddress(assetId),
                },
            });
            return withdrawalResponse.result.result;
        });
        this.cfWithdrawCommitment = (amount, assetId, recipient) => __awaiter(this, void 0, void 0, function* () {
            const freeBalance = yield this.getFreeBalance(assetId);
            const preWithdrawalBal = freeBalance[this.freeBalanceAddress];
            const err = [
                bn_1.notLessThanOrEqualTo(amount, preWithdrawalBal),
                assetId ? addresses_1.invalidAddress(assetId) : null,
                recipient ? addresses_1.invalidAddress(recipient) : null,
            ].filter(bn_1.falsy)[0];
            if (err) {
                this.logger.error(err);
                throw new Error(err);
            }
            const withdrawalResponse = yield this.cfCore.rpcRouter.dispatch({
                id: Date.now(),
                methodName: types_2.Node.RpcMethodName.WITHDRAW_COMMITMENT,
                parameters: {
                    amount,
                    multisigAddress: this.multisigAddress,
                    recipient,
                    tokenAddress: types_1.makeChecksumOrEthAddress(assetId),
                },
            });
            return withdrawalResponse.result.result;
        });
        this.verifyAppSequenceNumber = () => __awaiter(this, void 0, void 0, function* () {
            const { data: sc } = yield this.getStateChannel();
            let appSequenceNumber;
            try {
                appSequenceNumber = (yield sc.mostRecentlyInstalledAppInstance()).appSeqNo;
            }
            catch (e) {
                if (e.message.includes("There are no installed AppInstances in this StateChannel")) {
                    appSequenceNumber = 0;
                }
                else {
                    throw e;
                }
            }
            return yield this.node.verifyAppSequenceNumber(appSequenceNumber);
        });
        this.getRegisteredAppDetails = (appName) => {
            const appInfo = this.appRegistry.filter((app) => {
                return app.name === appName && app.network === this.network.name;
            });
            if (!appInfo || appInfo.length === 0) {
                throw new Error(`Could not find ${appName} app details on ${this.network.name} network`);
            }
            if (appInfo.length > 1) {
                throw new Error(`Found multiple ${appName} app details on ${this.network.name} network`);
            }
            return appInfo[0];
        };
        this.appNotInstalled = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            const apps = yield this.getAppInstances();
            const app = apps.filter((app) => app.identityHash === appInstanceId);
            if (!app || app.length === 0) {
                return (`Could not find installed app with id: ${appInstanceId}. ` +
                    `Installed apps: ${JSON.stringify(apps, utils_2.replaceBN, 2)}.`);
            }
            if (app.length > 1) {
                return (`CRITICAL ERROR: found multiple apps with the same id. ` +
                    `Installed apps: ${JSON.stringify(apps, utils_2.replaceBN, 2)}.`);
            }
            return undefined;
        });
        this.appInstalled = (appInstanceId) => __awaiter(this, void 0, void 0, function* () {
            const apps = yield this.getAppInstances();
            const app = apps.filter((app) => app.identityHash === appInstanceId);
            if (app.length > 0) {
                return (`App with id ${appInstanceId} is already installed. ` +
                    `Installed apps: ${JSON.stringify(apps, utils_2.replaceBN, 2)}.`);
            }
            return undefined;
        });
        this.opts = opts;
        this.ethProvider = opts.ethProvider;
        this.node = opts.node;
        this.messaging = opts.messaging;
        this.appRegistry = opts.appRegistry;
        this.cfCore = opts.cfCore;
        this.freeBalanceAddress = this.cfCore.freeBalanceAddress;
        this.publicIdentifier = this.cfCore.publicIdentifier;
        this.multisigAddress = this.opts.multisigAddress;
        this.nodePublicIdentifier = this.opts.nodePublicIdentifier;
        this.logger = new logger_1.Logger("ConnextInternal", opts.logLevel);
        this.network = opts.network;
        this.listener = new listener_1.ConnextListener(opts.cfCore, this);
        this.depositController = new DepositController_1.DepositController("DepositController", this);
        this.transferController = new TransferController_1.TransferController("TransferController", this);
        this.swapController = new SwapController_1.SwapController("SwapController", this);
        this.withdrawalController = new WithdrawalController_1.WithdrawalController("WithdrawalController", this);
        this.resolveConditionController = new ResolveConditionController_1.ResolveConditionController("ResolveConditionController", this);
        this.conditionalTransferController = new ConditionalTransferController_1.ConditionalTransferController("ConditionalTransferController", this);
    }
}
exports.ConnextInternal = ConnextInternal;

},{"./controllers/ConditionalTransferController":3,"./controllers/DepositController":4,"./controllers/ResolveConditionController":5,"./controllers/SwapController":6,"./controllers/TransferController":7,"./controllers/WithdrawalController":8,"./lib/cfCore":10,"./lib/logger":11,"./lib/utils":12,"./listener":13,"./node":14,"./validation/addresses":15,"./validation/bn":17,"@connext/messaging":undefined,"@connext/proxy-lock":undefined,"@connext/types":undefined,"@counterfactual/types":undefined,"core-js/stable":undefined,"ethers":undefined,"ethers/constants":undefined,"ethers/utils":undefined,"human-standard-token-abi":undefined,"regenerator-runtime/runtime":undefined}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../lib/logger");
class AbstractController {
    constructor(name, connext) {
        this.connext = connext;
        this.name = name;
        this.node = connext.node;
        this.cfCore = connext.cfCore;
        this.listener = connext.listener;
        this.log = new logger_1.Logger(name, connext.opts.logLevel);
        this.ethProvider = connext.ethProvider;
    }
}
exports.AbstractController = AbstractController;

},{"../lib/logger":11}],3:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@connext/types");
const types_2 = require("@counterfactual/types");
const constants_1 = require("ethers/constants");
const utils_1 = require("../lib/utils");
const validation_1 = require("../validation");
const AbstractController_1 = require("./AbstractController");
class ConditionalTransferController extends AbstractController_1.AbstractController {
    constructor() {
        super(...arguments);
        this.conditionalTransfer = (params) => __awaiter(this, void 0, void 0, function* () {
            this.log.info(`Conditional transfer called with parameters: ${JSON.stringify(params, utils_1.replaceBN, 2)}`);
            const res = yield this.conditionalExecutors[params.conditionType](params);
            return res;
        });
        this.handleLinkedTransfers = (params) => __awaiter(this, void 0, void 0, function* () {
            const { amount, assetId, paymentId, preImage } = types_1.convert.LinkedTransfer("bignumber", params);
            const invalid = yield this.validateLinked(amount, assetId, paymentId, preImage);
            if (invalid) {
                throw new Error(invalid);
            }
            const appInfo = this.connext.getRegisteredAppDetails(types_1.SupportedApplications.SimpleLinkedTransferApp);
            const linkedHash = utils_1.createLinkedHash(amount, assetId, paymentId, preImage);
            const initialState = {
                amount,
                assetId,
                coinTransfers: [
                    {
                        amount,
                        to: utils_1.freeBalanceAddressFromXpub(this.connext.publicIdentifier),
                    },
                    {
                        amount: constants_1.Zero,
                        to: utils_1.freeBalanceAddressFromXpub(this.connext.nodePublicIdentifier),
                    },
                ],
                linkedHash,
                paymentId,
                preImage: constants_1.HashZero,
            };
            const appId = yield this.conditionalTransferAppInstalled(amount, assetId, initialState, appInfo);
            if (!appId) {
                throw new Error(`App was not installed`);
            }
            return {
                freeBalance: yield this.connext.getFreeBalance(assetId),
                paymentId,
                preImage,
            };
        });
        this.validateLinked = (amount, assetId, paymentId, preImage) => __awaiter(this, void 0, void 0, function* () {
            const freeBalance = yield this.connext.getFreeBalance(assetId);
            const preTransferBal = freeBalance[this.connext.freeBalanceAddress];
            const errs = [
                validation_1.invalidAddress(assetId),
                validation_1.notLessThanOrEqualTo(amount, preTransferBal),
                validation_1.invalid32ByteHexString(paymentId),
                validation_1.invalid32ByteHexString(preImage),
            ];
            return errs ? errs.filter(validation_1.falsy)[0] : undefined;
        });
        this.conditionalTransferAppInstalled = (initiatorDeposit, assetId, initialState, appInfo) => __awaiter(this, void 0, void 0, function* () {
            let boundResolve;
            let boundReject;
            const { appDefinitionAddress: appDefinition, outcomeType, stateEncoding, actionEncoding, } = appInfo;
            const params = {
                abiEncodings: {
                    actionEncoding,
                    stateEncoding,
                },
                appDefinition,
                initialState,
                initiatorDeposit,
                initiatorDepositTokenAddress: assetId,
                outcomeType,
                proposedToIdentifier: this.connext.nodePublicIdentifier,
                responderDeposit: constants_1.Zero,
                responderDepositTokenAddress: assetId,
                timeout: constants_1.Zero,
            };
            const proposeRes = yield this.connext.proposeInstallApp(params);
            this.appId = proposeRes.appInstanceId;
            try {
                yield new Promise((res, rej) => {
                    boundResolve = this.resolveInstallTransfer.bind(null, res);
                    boundReject = this.rejectInstallTransfer.bind(null, rej);
                    this.connext.messaging.subscribe(`indra.node.${this.connext.nodePublicIdentifier}.install.${proposeRes.appInstanceId}`, boundResolve);
                    this.listener.on(types_2.Node.EventName.REJECT_INSTALL, boundReject);
                });
                this.log.info(`App was installed successfully!: ${JSON.stringify(proposeRes)}`);
                return proposeRes.appInstanceId;
            }
            catch (e) {
                this.log.error(`Error installing app: ${e.toString()}`);
                return undefined;
            }
            finally {
                this.cleanupInstallListeners(boundReject, proposeRes.appInstanceId);
            }
        });
        this.resolveInstallTransfer = (res, message) => {
            const appInstance = message.data.data ? message.data.data : message.data;
            if (appInstance.identityHash !== this.appId) {
                this.log.info(`Caught INSTALL event for different app ${JSON.stringify(message)}, expected ${this.appId}`);
                return;
            }
            res(message);
            return message;
        };
        this.rejectInstallTransfer = (rej, msg) => {
            if (this.appId !== msg.data.appInstanceId) {
                return;
            }
            return rej(`Install failed. Event data: ${JSON.stringify(msg, utils_1.replaceBN, 2)}`);
        };
        this.cleanupInstallListeners = (boundReject, appId) => {
            this.connext.messaging.unsubscribe(`indra.node.${this.connext.nodePublicIdentifier}.install.${appId}`);
            this.listener.removeListener(types_2.Node.EventName.REJECT_INSTALL, boundReject);
        };
        this.conditionalExecutors = {
            LINKED_TRANSFER: this.handleLinkedTransfers,
        };
    }
}
exports.ConditionalTransferController = ConditionalTransferController;

},{"../lib/utils":12,"../validation":19,"./AbstractController":2,"@connext/types":undefined,"@counterfactual/types":undefined,"ethers/constants":undefined}],4:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@connext/types");
const types_2 = require("@counterfactual/types");
const ethers_1 = require("ethers");
const constants_1 = require("ethers/constants");
const human_standard_token_abi_1 = __importDefault(require("human-standard-token-abi"));
const utils_1 = require("../lib/utils");
const addresses_1 = require("../validation/addresses");
const bn_1 = require("../validation/bn");
const AbstractController_1 = require("./AbstractController");
class DepositController extends AbstractController_1.AbstractController {
    constructor() {
        super(...arguments);
        this.deposit = (params) => __awaiter(this, void 0, void 0, function* () {
            const myFreeBalanceAddress = this.connext.freeBalanceAddress;
            const { assetId, amount } = types_1.convert.Deposit("bignumber", params);
            const invalid = yield this.validateInputs(assetId, amount);
            if (invalid) {
                throw new Error(invalid);
            }
            const preDepositBalances = yield this.connext.getFreeBalance(assetId);
            this.log.info(`\nDepositing ${amount} of ${assetId} into ${this.connext.opts.multisigAddress}\n`);
            this.log.info("Registering listeners........");
            this.registerListeners();
            this.log.info("Registered!");
            try {
                this.log.info(`Calling ${types_2.Node.RpcMethodName.DEPOSIT}`);
                const depositResponse = yield this.connext.cfDeposit(amount, assetId);
                this.log.info(`Deposit Response: ${JSON.stringify(depositResponse, utils_1.replaceBN, 2)}`);
                const postDepositBalances = yield this.connext.getFreeBalance(assetId);
                const diff = postDepositBalances[myFreeBalanceAddress].sub(preDepositBalances[myFreeBalanceAddress]);
                if (!diff.eq(amount)) {
                    throw new Error("My balance was not increased by the deposit amount.");
                }
                this.log.info("Deposited!");
            }
            catch (e) {
                this.log.error(`Failed to deposit...`);
                this.removeListeners();
                throw new Error(e);
            }
            return {
                apps: yield this.connext.getAppInstances(),
                freeBalance: yield this.connext.getFreeBalance(assetId),
            };
        });
        this.validateInputs = (assetId, amount) => __awaiter(this, void 0, void 0, function* () {
            const depositAddr = utils_1.publicIdentifierToAddress(this.cfCore.publicIdentifier);
            let bal;
            if (assetId === constants_1.AddressZero) {
                bal = yield this.ethProvider.getBalance(depositAddr);
            }
            else {
                const token = new ethers_1.Contract(assetId, human_standard_token_abi_1.default, this.ethProvider);
                bal = yield token.balanceOf(depositAddr);
            }
            const errs = [
                addresses_1.invalidAddress(assetId),
                bn_1.notPositive(amount),
                bn_1.notLessThanOrEqualTo(amount, bal),
            ];
            return errs ? errs.filter(bn_1.falsy)[0] : undefined;
        });
        this.depositConfirmedCallback = (data) => {
            this.removeListeners();
        };
        this.depositFailedCallback = (data) => {
            this.removeListeners();
        };
    }
    registerListeners() {
        this.listener.registerCfListener(types_2.Node.EventName.DEPOSIT_CONFIRMED, this.depositConfirmedCallback);
        this.listener.registerCfListener(types_2.Node.EventName.DEPOSIT_FAILED, this.depositFailedCallback);
    }
    removeListeners() {
        this.listener.removeCfListener(types_2.Node.EventName.DEPOSIT_CONFIRMED, this.depositConfirmedCallback);
        this.listener.removeCfListener(types_2.Node.EventName.DEPOSIT_FAILED, this.depositFailedCallback);
    }
}
exports.DepositController = DepositController;

},{"../lib/utils":12,"../validation/addresses":15,"../validation/bn":17,"./AbstractController":2,"@connext/types":undefined,"@counterfactual/types":undefined,"ethers":undefined,"ethers/constants":undefined,"human-standard-token-abi":undefined}],5:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@connext/types");
const utils_1 = require("../lib/utils");
const AbstractController_1 = require("./AbstractController");
class ResolveConditionController extends AbstractController_1.AbstractController {
    constructor() {
        super(...arguments);
        this.resolve = (params) => __awaiter(this, void 0, void 0, function* () {
            this.log.info(`Resolve condition called with parameters: ${JSON.stringify(params, utils_1.replaceBN, 2)}`);
            const res = yield this.conditionResolvers[params.conditionType](params);
            return res;
        });
        this.resolveLinkedTransfer = (params) => __awaiter(this, void 0, void 0, function* () {
            const { paymentId, preImage, amount, assetId } = types_1.convert.ResolveLinkedTransfer("bignumber", params);
            const freeBal = yield this.connext.getFreeBalance(assetId);
            const preTransferBal = freeBal[this.connext.freeBalanceAddress];
            yield this.node.resolveLinkedTransfer(paymentId, preImage, amount, assetId);
            const postTransferBal = yield this.connext.getFreeBalance(assetId);
            const diff = postTransferBal[this.connext.freeBalanceAddress].sub(preTransferBal);
            if (!diff.eq(amount)) {
                this.log.error("Welp it appears the difference of the free balance before and after " +
                    "uninstalling is not what we expected......");
            }
            else if (postTransferBal[this.connext.freeBalanceAddress].lte(preTransferBal)) {
                this.log.info("Free balance after transfer is lte free balance " +
                    "before transfer..... That's not great..");
            }
            return {
                freeBalance: yield this.connext.getFreeBalance(assetId),
                paymentId,
            };
        });
        this.conditionResolvers = {
            LINKED_TRANSFER: this.resolveLinkedTransfer,
        };
    }
}
exports.ResolveConditionController = ResolveConditionController;

},{"../lib/utils":12,"./AbstractController":2,"@connext/types":undefined}],6:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@connext/types");
const types_2 = require("@counterfactual/types");
const constants_1 = require("ethers/constants");
const utils_1 = require("ethers/utils");
const hdnode_1 = require("ethers/utils/hdnode");
const utils_2 = require("../lib/utils");
const addresses_1 = require("../validation/addresses");
const bn_1 = require("../validation/bn");
const AbstractController_1 = require("./AbstractController");
exports.calculateExchange = (amount, swapRate) => {
    return utils_1.bigNumberify(utils_1.formatEther(amount.mul(utils_1.parseEther(swapRate))).replace(/\.[0-9]*$/, ""));
};
class SwapController extends AbstractController_1.AbstractController {
    constructor() {
        super(...arguments);
        this.validate = (amount, toAssetId, fromAssetId, swapRate) => __awaiter(this, void 0, void 0, function* () {
            const preSwapFromBal = yield this.connext.getFreeBalance(fromAssetId);
            const userBal = preSwapFromBal[this.connext.freeBalanceAddress];
            const preSwapToBal = yield this.connext.getFreeBalance(toAssetId);
            const nodeBal = preSwapToBal[utils_2.freeBalanceAddressFromXpub(this.connext.nodePublicIdentifier)];
            const swappedAmount = exports.calculateExchange(amount, swapRate);
            const errs = [
                addresses_1.invalidAddress(fromAssetId),
                addresses_1.invalidAddress(toAssetId),
                bn_1.notLessThanOrEqualTo(amount, userBal),
                bn_1.notLessThanOrEqualTo(swappedAmount, nodeBal),
                bn_1.notPositive(utils_1.parseEther(swapRate)),
            ];
            return errs ? errs.filter(bn_1.falsy)[0] : undefined;
        });
        this.resolveInstallSwap = (res, data) => {
            if (this.appId !== data.params.appInstanceId) {
                return;
            }
            if (this.timeout) {
                clearTimeout(this.timeout);
            }
            res(data);
            return data;
        };
        this.rejectInstallSwap = (rej, msg) => {
            if (this.appId !== msg.data.appInstanceId) {
                return;
            }
            rej(`Install rejected. Event data: ${JSON.stringify(msg.data, utils_2.replaceBN, 2)}`);
            return msg.data;
        };
        this.swapAppInstall = (amount, toAssetId, fromAssetId, swapRate, appInfo) => __awaiter(this, void 0, void 0, function* () {
            let boundResolve;
            let boundReject;
            const swappedAmount = exports.calculateExchange(amount, swapRate);
            this.log.info(`Installing swap app. Swapping ${amount.toString()} of ${fromAssetId}` +
                ` for ${swappedAmount.toString()} of ${toAssetId}`);
            const initialState = {
                coinTransfers: [
                    [
                        {
                            amount,
                            to: hdnode_1.fromExtendedKey(this.connext.publicIdentifier).derivePath("0").address,
                        },
                    ],
                    [
                        {
                            amount: swappedAmount,
                            to: hdnode_1.fromExtendedKey(this.connext.nodePublicIdentifier).derivePath("0").address,
                        },
                    ],
                ],
            };
            const { actionEncoding, appDefinitionAddress: appDefinition, stateEncoding } = appInfo;
            const params = {
                abiEncodings: {
                    actionEncoding,
                    stateEncoding,
                },
                appDefinition,
                initialState,
                initiatorDeposit: amount,
                initiatorDepositTokenAddress: fromAssetId,
                outcomeType: appInfo.outcomeType,
                proposedToIdentifier: this.connext.nodePublicIdentifier,
                responderDeposit: swappedAmount,
                responderDepositTokenAddress: toAssetId,
                timeout: constants_1.Zero,
            };
            const res = yield this.connext.proposeInstallApp(params);
            this.appId = res.appInstanceId;
            yield new Promise((res, rej) => {
                boundReject = this.rejectInstallSwap.bind(null, rej);
                boundResolve = this.resolveInstallSwap.bind(null, res);
                this.listener.on(types_2.Node.EventName.INSTALL, boundResolve);
                this.listener.on(types_2.Node.EventName.REJECT_INSTALL, boundReject);
            });
            this.cleanupInstallListeners(boundResolve, boundReject);
            return res.appInstanceId;
        });
        this.cleanupInstallListeners = (boundResolve, boundReject) => {
            this.listener.removeListener(types_2.Node.EventName.INSTALL, boundResolve);
            this.listener.removeListener(types_2.Node.EventName.REJECT_INSTALL, boundReject);
        };
    }
    swap(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { amount, toAssetId, fromAssetId, swapRate } = types_1.convert.SwapParameters("bignumber", params);
            const invalid = yield this.validate(amount, toAssetId, fromAssetId, swapRate);
            if (invalid) {
                throw new Error(invalid.toString());
            }
            const preSwapFromBal = yield this.connext.getFreeBalance(fromAssetId);
            const preSwapToBal = yield this.connext.getFreeBalance(toAssetId);
            const appInfo = this.connext.getRegisteredAppDetails("SimpleTwoPartySwapApp");
            yield this.swapAppInstall(amount, toAssetId, fromAssetId, swapRate, appInfo);
            this.log.info(`Swap app installed! Uninstalling without updating state.`);
            yield this.connext.uninstallApp(this.appId);
            const postSwapFromBal = yield this.connext.getFreeBalance(fromAssetId);
            const postSwapToBal = yield this.connext.getFreeBalance(toAssetId);
            const diffFrom = preSwapFromBal[this.connext.freeBalanceAddress].sub(postSwapFromBal[this.connext.freeBalanceAddress]);
            const diffTo = postSwapToBal[this.connext.freeBalanceAddress].sub(preSwapToBal[this.connext.freeBalanceAddress]);
            const swappedAmount = exports.calculateExchange(amount, swapRate);
            if (!diffFrom.eq(amount) || !diffTo.eq(swappedAmount)) {
                throw new Error("Invalid final swap amounts - this shouldn't happen!!");
            }
            const newState = yield this.connext.getChannel();
            return newState;
        });
    }
}
exports.SwapController = SwapController;

},{"../lib/utils":12,"../validation/addresses":15,"../validation/bn":17,"./AbstractController":2,"@connext/types":undefined,"@counterfactual/types":undefined,"ethers/constants":undefined,"ethers/utils":undefined,"ethers/utils/hdnode":undefined}],7:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@connext/types");
const types_2 = require("@counterfactual/types");
const constants_1 = require("ethers/constants");
const utils_1 = require("../lib/utils");
const addresses_1 = require("../validation/addresses");
const bn_1 = require("../validation/bn");
const AbstractController_1 = require("./AbstractController");
class TransferController extends AbstractController_1.AbstractController {
    constructor() {
        super(...arguments);
        this.transfer = (params) => __awaiter(this, void 0, void 0, function* () {
            this.log.info(`Transfer called with parameters: ${JSON.stringify(params, utils_1.replaceBN, 2)}`);
            const { recipient, amount, assetId } = types_1.convert.TransferParameters("bignumber", params);
            const invalid = yield this.validate(recipient, amount, assetId);
            if (invalid) {
                throw new Error(invalid.toString());
            }
            const freeBal = yield this.connext.getFreeBalance(assetId);
            const preTransferBal = freeBal[this.connext.freeBalanceAddress];
            const appInfo = this.connext.getRegisteredAppDetails(types_1.SupportedApplications.SimpleTransferApp);
            const appId = yield this.transferAppInstalled(amount, recipient, assetId, appInfo);
            if (!appId) {
                throw new Error(`App was not installed`);
            }
            yield this.connext.uninstallVirtualApp(appId);
            const postTransferBal = yield this.connext.getFreeBalance(assetId);
            const diff = preTransferBal.sub(postTransferBal[this.connext.freeBalanceAddress]);
            if (!diff.eq(amount)) {
                this.log.info("Welp it appears the difference of the free balance before and after " +
                    "uninstalling is not what we expected......");
            }
            else if (postTransferBal[this.connext.freeBalanceAddress].gte(preTransferBal)) {
                this.log.info("Free balance after transfer is gte free balance " +
                    "before transfer..... That's not great..");
            }
            const newState = yield this.connext.getChannel();
            return newState;
        });
        this.validate = (recipient, amount, assetId) => __awaiter(this, void 0, void 0, function* () {
            const freeBalance = yield this.connext.getFreeBalance(assetId);
            const preTransferBal = freeBalance[this.connext.freeBalanceAddress];
            const errs = [
                addresses_1.invalidXpub(recipient),
                addresses_1.invalidAddress(assetId),
                bn_1.notLessThanOrEqualTo(amount, preTransferBal),
            ];
            return errs ? errs.filter(bn_1.falsy)[0] : undefined;
        });
        this.resolveInstallTransfer = (res, data) => {
            if (this.appId !== data.params.appInstanceId) {
                this.log.info(`Caught INSTALL_VIRTUAL event for different app ${JSON.stringify(data)}, expected ${this.appId}`);
                res();
                return;
            }
            if (this.timeout) {
                clearTimeout(this.timeout);
            }
            res(data);
            return data;
        };
        this.rejectInstallTransfer = (rej, msg) => {
            if (this.appId !== msg.appInstanceId) {
                return;
            }
            return rej(`Install virtual failed. Event data: ${JSON.stringify(msg, utils_1.replaceBN, 2)}`);
        };
        this.transferAppInstalled = (amount, recipient, assetId, appInfo) => __awaiter(this, void 0, void 0, function* () {
            let boundResolve;
            let boundReject;
            const initialState = {
                coinTransfers: [
                    {
                        amount,
                        to: utils_1.freeBalanceAddressFromXpub(this.connext.publicIdentifier),
                    },
                    {
                        amount: constants_1.Zero,
                        to: utils_1.freeBalanceAddressFromXpub(recipient),
                    },
                ],
            };
            const { actionEncoding, appDefinitionAddress: appDefinition, stateEncoding } = appInfo;
            const params = {
                abiEncodings: {
                    actionEncoding,
                    stateEncoding,
                },
                appDefinition,
                initialState,
                initiatorDeposit: amount,
                initiatorDepositTokenAddress: assetId,
                intermediaryIdentifier: this.connext.nodePublicIdentifier,
                outcomeType: appInfo.outcomeType,
                proposedToIdentifier: recipient,
                responderDeposit: constants_1.Zero,
                responderDepositTokenAddress: assetId,
                timeout: constants_1.Zero,
            };
            const res = yield this.connext.proposeInstallVirtualApp(params);
            this.appId = res.appInstanceId;
            try {
                yield new Promise((res, rej) => {
                    boundReject = this.rejectInstallTransfer.bind(null, rej);
                    boundResolve = this.resolveInstallTransfer.bind(null, res);
                    this.listener.on(types_2.Node.EventName.INSTALL_VIRTUAL, boundResolve);
                    this.listener.on(types_2.Node.EventName.REJECT_INSTALL_VIRTUAL, boundReject);
                });
                this.log.info(`App was installed successfully!: ${JSON.stringify(res)}`);
                return res.appInstanceId;
            }
            catch (e) {
                this.log.error(`Error installing app: ${e.toString()}`);
                return undefined;
            }
            finally {
                this.cleanupInstallListeners(boundResolve, boundReject);
            }
        });
        this.cleanupInstallListeners = (boundResolve, boundReject) => {
            this.listener.removeListener(types_2.Node.EventName.INSTALL_VIRTUAL, boundResolve);
            this.listener.removeListener(types_2.Node.EventName.REJECT_INSTALL_VIRTUAL, boundReject);
        };
    }
}
exports.TransferController = TransferController;

},{"../lib/utils":12,"../validation/addresses":15,"../validation/bn":17,"./AbstractController":2,"@connext/types":undefined,"@counterfactual/types":undefined,"ethers/constants":undefined}],8:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@connext/types");
const types_2 = require("@counterfactual/types");
const utils_1 = require("ethers/utils");
const utils_2 = require("../lib/utils");
const addresses_1 = require("../validation/addresses");
const bn_1 = require("../validation/bn");
const AbstractController_1 = require("./AbstractController");
class WithdrawalController extends AbstractController_1.AbstractController {
    constructor() {
        super(...arguments);
        this.validateInputs = (amount, assetId, recipient) => __awaiter(this, void 0, void 0, function* () {
            const freeBalance = yield this.connext.getFreeBalance(assetId);
            const preWithdrawalBal = freeBalance[this.connext.freeBalanceAddress];
            const errs = [
                bn_1.notLessThanOrEqualTo(amount, preWithdrawalBal),
                addresses_1.invalidAddress(assetId),
            ];
            if (recipient) {
                errs.push(addresses_1.invalidAddress(recipient));
            }
            return errs ? errs.filter(bn_1.falsy)[0] : undefined;
        });
        this.withdrawConfirmedCallback = (data) => __awaiter(this, void 0, void 0, function* () {
            this.log.info(`Withdrawal confimed.`);
            this.removeListeners();
        });
        this.withdrawFailedCallback = (data) => {
            this.log.warn(`Withdrawal failed with data: ${JSON.stringify(data, utils_2.replaceBN, 2)}`);
            this.removeListeners();
        };
    }
    withdraw(params) {
        return __awaiter(this, void 0, void 0, function* () {
            params.assetId = params.assetId ? utils_1.getAddress(params.assetId) : undefined;
            const myFreeBalanceAddress = this.connext.freeBalanceAddress;
            const { amount, assetId, recipient, userSubmitted } = types_1.convert.Withdraw("bignumber", params);
            const invalid = yield this.validateInputs(amount, assetId, recipient);
            if (invalid) {
                throw new Error(invalid);
            }
            const preWithdrawBalances = yield this.connext.getFreeBalance(assetId);
            this.log.info(`\nWithdrawing ${amount} wei from ${this.connext.opts.multisigAddress}\n`);
            this.registerListeners();
            let transaction;
            try {
                if (!userSubmitted) {
                    this.log.info(`Calling ${types_2.Node.RpcMethodName.WITHDRAW_COMMITMENT}`);
                    const withdrawResponse = yield this.connext.cfWithdrawCommitment(amount, assetId, recipient);
                    this.log.info(`Withdraw Response: ${JSON.stringify(withdrawResponse, utils_2.replaceBN, 2)}`);
                    const minTx = withdrawResponse.transaction;
                    transaction = yield this.node.withdraw(minTx);
                    this.log.info(`Node Withdraw Response: ${JSON.stringify(transaction, utils_2.replaceBN, 2)}`);
                }
                else {
                    this.log.info(`Calling ${types_2.Node.RpcMethodName.WITHDRAW}`);
                    const withdrawResponse = yield this.connext.cfWithdraw(amount, assetId, recipient);
                    this.log.info(`Withdraw Response: ${JSON.stringify(withdrawResponse, utils_2.replaceBN, 2)}`);
                    transaction = yield this.ethProvider.getTransaction(withdrawResponse.txHash);
                }
                const postWithdrawBalances = yield this.connext.getFreeBalance(assetId);
                const expectedFreeBal = preWithdrawBalances[myFreeBalanceAddress].sub(amount);
                if (postWithdrawBalances && !postWithdrawBalances[myFreeBalanceAddress].eq(expectedFreeBal)) {
                    this.log.error(`My free balance was not decreased by the expected amount.`);
                }
                this.log.info("Withdrawn!");
            }
            catch (e) {
                this.log.error(`Failed to withdraw... ${JSON.stringify(e, utils_2.replaceBN, 2)}`);
                this.removeListeners();
                throw new Error(e);
            }
            return {
                apps: yield this.connext.getAppInstances(),
                freeBalance: yield this.connext.getFreeBalance(),
                transaction,
            };
        });
    }
    registerListeners() {
        this.listener.registerCfListener(types_2.Node.EventName.WITHDRAWAL_CONFIRMED, this.withdrawConfirmedCallback);
        this.listener.registerCfListener(types_2.Node.EventName.WITHDRAWAL_FAILED, this.withdrawFailedCallback);
    }
    removeListeners() {
        this.listener.removeCfListener(types_2.Node.EventName.WITHDRAWAL_CONFIRMED, this.withdrawConfirmedCallback);
        this.listener.removeCfListener(types_2.Node.EventName.WITHDRAWAL_FAILED, this.withdrawFailedCallback);
    }
}
exports.WithdrawalController = WithdrawalController;

},{"../lib/utils":12,"../validation/addresses":15,"../validation/bn":17,"./AbstractController":2,"@connext/types":undefined,"@counterfactual/types":undefined,"ethers/utils":undefined}],9:[function(require,module,exports){
"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const connext_1 = require("./connext");
exports.connect = connext_1.connect;
exports.ConnextInternal = connext_1.ConnextInternal;
const utils = __importStar(require("./lib/utils"));
exports.utils = utils;

},{"./connext":1,"./lib/utils":12}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var node_1 = require("@counterfactual/node");
exports.EXTENDED_PRIVATE_KEY_PATH = node_1.EXTENDED_PRIVATE_KEY_PATH;
exports.CFCore = node_1.Node;

},{"@counterfactual/node":undefined}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Logger {
    constructor(name, logLevel) {
        this.levels = {
            debug: 4,
            error: 1,
            info: 3,
            warn: 2,
        };
        this.logLevel = 3;
        this.name = "Logger";
        this.name = typeof name !== "undefined" ? name : this.name;
        this.logLevel =
            typeof logLevel !== "undefined"
                ? parseInt(logLevel.toString(), 10)
                : this.logLevel;
    }
    error(msg) {
        this.log("error", msg);
    }
    warn(msg) {
        this.log("warn", msg);
    }
    info(msg) {
        this.log("info", msg);
    }
    debug(msg) {
        this.log("debug", msg);
    }
    log(level, msg) {
        if (this.levels[level] > this.logLevel)
            return;
        return console[level](`${level}: [${this.name}] ${msg}`);
    }
}
exports.Logger = Logger;

},{}],12:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const utils_1 = require("ethers/utils");
const util_1 = require("util");
exports.replaceBN = (key, value) => value && value._hex ? value.toString() : value;
exports.capitalize = (str) => str.substring(0, 1).toUpperCase() + str.substring(1);
exports.objMap = (obj, func) => {
    const res = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            res[key] = func(key, obj[key]);
        }
    }
    return res;
};
exports.objMapPromise = (obj, func) => __awaiter(this, void 0, void 0, function* () {
    const res = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            res[key] = yield func(key, obj[key]);
        }
    }
    return res;
});
exports.insertDefault = (val, obj, keys) => {
    const adjusted = {};
    keys.concat(Object.keys(obj)).map((k) => {
        adjusted[k] = util_1.isNullOrUndefined(obj[k])
            ? val
            : obj[k];
    });
    return adjusted;
};
exports.mkHash = (prefix = "0x") => prefix.padEnd(66, "0");
exports.delay = (ms) => new Promise((res) => setTimeout(res, ms));
exports.publicIdentifierToAddress = (publicIdentifier) => {
    return ethers_1.utils.HDNode.fromExtendedKey(publicIdentifier).address;
};
exports.freeBalanceAddressFromXpub = (xpub) => {
    return ethers_1.utils.HDNode.fromExtendedKey(xpub).derivePath("0").address;
};
exports.createLinkedHash = (amount, assetId, paymentId, preImage) => {
    return utils_1.solidityKeccak256(["uint256", "address", "bytes32", "bytes32"], [amount, assetId, paymentId, preImage]);
};
exports.createRandom32ByteHexString = () => {
    return utils_1.hexlify(utils_1.randomBytes(32));
};
exports.createPaymentId = exports.createRandom32ByteHexString;
exports.createPreImage = exports.createRandom32ByteHexString;

},{"ethers":undefined,"ethers/utils":undefined,"util":undefined}],13:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@connext/types");
const types_2 = require("@counterfactual/types");
const utils_1 = require("ethers/utils");
const events_1 = require("events");
const logger_1 = require("./lib/logger");
const utils_2 = require("./lib/utils");
const appProposals_1 = require("./validation/appProposals");
class ConnextListener extends events_1.EventEmitter {
    constructor(cfCore, connext) {
        super();
        this.defaultCallbacks = {
            COUNTER_DEPOSIT_CONFIRMED: (data) => {
                this.emitAndLog(types_2.Node.EventName.COUNTER_DEPOSIT_CONFIRMED, data.data);
            },
            CREATE_CHANNEL: (data) => {
                this.emitAndLog(types_2.Node.EventName.CREATE_CHANNEL, data.data);
            },
            DEPOSIT_CONFIRMED: (data) => __awaiter(this, void 0, void 0, function* () {
                this.emitAndLog(types_2.Node.EventName.DEPOSIT_CONFIRMED, data);
            }),
            DEPOSIT_FAILED: (data) => {
                this.emitAndLog(types_2.Node.EventName.DEPOSIT_FAILED, data);
            },
            DEPOSIT_STARTED: (data) => {
                this.log.info(`deposit for ${data.value.toString()} started. hash: ${data.txHash}`);
                this.emitAndLog(types_2.Node.EventName.DEPOSIT_STARTED, data);
            },
            INSTALL: (data) => {
                this.emitAndLog(types_2.Node.EventName.INSTALL, data.data);
            },
            INSTALL_VIRTUAL: (data) => {
                this.emitAndLog(types_2.Node.EventName.INSTALL_VIRTUAL, data.data);
            },
            PROPOSE_INSTALL: (data) => __awaiter(this, void 0, void 0, function* () {
                this.emitAndLog(types_2.Node.EventName.PROPOSE_INSTALL, data.data);
                if (data.from === this.cfCore.publicIdentifier) {
                    this.log.info(`Received proposal from our own node, doing nothing: ${JSON.stringify(data)}`);
                    return;
                }
                const matchedResult = yield this.matchAppInstance(data);
                if (!matchedResult) {
                    this.log.warn(`No matched app, doing nothing, ${JSON.stringify(data)}`);
                    return;
                }
                if (matchedResult.matchedApp.name === "SimpleTransferApp") {
                    this.log.debug(`Caught propose install for what should always be a virtual app. CF should also emit a virtual app install event, so let this callback handle and verify. Will need to refactor soon!`);
                    return;
                }
                const { appInfo, matchedApp } = matchedResult;
                yield this.verifyAndInstallKnownApp(appInfo, matchedApp, false);
                return;
            }),
            PROPOSE_INSTALL_VIRTUAL: (data) => __awaiter(this, void 0, void 0, function* () {
                this.emitAndLog(types_2.Node.EventName.PROPOSE_INSTALL_VIRTUAL, data.data);
                if (data.from === this.cfCore.publicIdentifier) {
                    return;
                }
                const matchedResult = yield this.matchAppInstance(data);
                if (!matchedResult) {
                    return;
                }
                if (matchedResult.matchedApp.name !== "SimpleTransferApp") {
                    this.log.debug(`Caught propose install virtual for what should always be a regular app. CF should also emit a virtual app install event, so let this callback handle and verify. Will need to refactor soon!`);
                    return;
                }
                const { appInfo, matchedApp } = matchedResult;
                yield this.verifyAndInstallKnownApp(appInfo, matchedApp);
                return;
            }),
            PROPOSE_STATE: (data) => {
                this.emitAndLog(types_2.Node.EventName.PROPOSE_STATE, data);
            },
            PROTOCOL_MESSAGE_EVENT: (data) => {
                this.emitAndLog(types_2.Node.EventName.PROTOCOL_MESSAGE_EVENT, data);
            },
            REJECT_INSTALL: (data) => {
                this.emitAndLog(types_2.Node.EventName.REJECT_INSTALL, data);
            },
            REJECT_INSTALL_VIRTUAL: (data) => {
                this.emitAndLog(types_2.Node.EventName.REJECT_INSTALL_VIRTUAL, data.data);
            },
            REJECT_STATE: (data) => {
                this.emitAndLog(types_2.Node.EventName.REJECT_STATE, data);
            },
            UNINSTALL: (data) => {
                this.emitAndLog(types_2.Node.EventName.UNINSTALL, data.data);
            },
            UNINSTALL_VIRTUAL: (data) => {
                this.emitAndLog(types_2.Node.EventName.UNINSTALL_VIRTUAL, data.data);
            },
            UPDATE_STATE: (data) => {
                this.emitAndLog(types_2.Node.EventName.UPDATE_STATE, data.data);
            },
            WITHDRAW_EVENT: (data) => {
                this.emitAndLog(types_2.Node.EventName.WITHDRAW_EVENT, data);
            },
            WITHDRAWAL_CONFIRMED: (data) => {
                this.emitAndLog(types_2.Node.EventName.WITHDRAWAL_CONFIRMED, data.data);
            },
            WITHDRAWAL_FAILED: (data) => {
                this.emitAndLog(types_2.Node.EventName.WITHDRAWAL_FAILED, data);
            },
            WITHDRAWAL_STARTED: (data) => {
                this.log.info(`withdrawal for ${data.value.toString()} started. hash: ${data.txHash}`);
                this.emitAndLog(types_2.Node.EventName.WITHDRAWAL_STARTED, data);
            },
        };
        this.register = () => __awaiter(this, void 0, void 0, function* () {
            yield this.registerAvailabilitySubscription();
            this.registerDefaultCfListeners();
            return;
        });
        this.registerCfListener = (event, cb) => {
            this.log.info(`Registering listener for ${event}`);
            this.cfCore.on(event, (res) => __awaiter(this, void 0, void 0, function* () {
                yield cb(res);
                this.emit(event, res);
            }));
        };
        this.removeCfListener = (event, cb) => {
            this.log.info(`Removing listener for ${event}`);
            try {
                this.removeListener(event, cb);
                return true;
            }
            catch (e) {
                this.log.error(`Error trying to remove registered listener from event: ${event}. Error: ${e.message}`);
                return false;
            }
        };
        this.registerDefaultCfListeners = () => {
            Object.entries(this.defaultCallbacks).forEach(([event, callback]) => {
                this.cfCore.on(types_2.Node.EventName[event], callback);
            });
            this.cfCore.on(types_2.Node.RpcMethodName.INSTALL, (data) => {
                const appInstance = data.result.result.appInstance;
                this.log.debug(`Emitting CFCoreTypes.RpcMethodName.INSTALL event: ${JSON.stringify(appInstance)}`);
                this.connext.messaging.publish(`indra.client.${this.cfCore.publicIdentifier}.install.${appInstance.identityHash}`, JSON.stringify(appInstance));
            });
            this.cfCore.on(types_2.Node.RpcMethodName.UNINSTALL, (data) => {
                this.log.debug(`Emitting CFCoreTypes.RpcMethodName.UNINSTALL event: ${JSON.stringify(data.result.result)}`);
                this.connext.messaging.publish(`indra.client.${this.cfCore.publicIdentifier}.uninstall.${data.result.result.appInstanceId}`, JSON.stringify(data.result.result));
            });
        };
        this.emitAndLog = (event, data) => {
            this.log.info(`Emitted ${event} with data ${JSON.stringify(data)} at ${Date.now()}`);
            this.emit(event, data);
        };
        this.matchAppInstance = (data) => __awaiter(this, void 0, void 0, function* () {
            const filteredApps = this.connext.appRegistry.filter((app) => {
                return app.appDefinitionAddress === data.data.params.appDefinition;
            });
            if (!filteredApps || filteredApps.length === 0) {
                this.log.info(`Proposed app not in registered applications. App: ${JSON.stringify(data, utils_2.replaceBN, 2)}`);
                return undefined;
            }
            if (filteredApps.length > 1) {
                this.log.error(`Proposed app matched ${filteredApps.length} registered applications by definition address. App: ${JSON.stringify(data, utils_2.replaceBN, 2)}`);
                return undefined;
            }
            return {
                appInfo: Object.assign({}, data.data.params, { identityHash: data.data.appInstanceId, initiatorDeposit: utils_1.bigNumberify(data.data.params.initiatorDeposit), initiatorDepositTokenAddress: data.data.params.initiatorDepositTokenAddress, proposedByIdentifier: data.from, responderDeposit: utils_1.bigNumberify(data.data.params.responderDeposit), responderDepositTokenAddress: data.data.params.responderDepositTokenAddress }),
                matchedApp: filteredApps[0],
            };
        });
        this.verifyAndInstallKnownApp = (appInstance, matchedApp, isVirtual = true) => __awaiter(this, void 0, void 0, function* () {
            const invalidProposal = yield appProposals_1.appProposalValidation[matchedApp.name](appInstance, matchedApp, isVirtual, this.connext);
            if (invalidProposal) {
                this.log.error(`Proposed app is invalid. ${invalidProposal}`);
                yield this.connext.rejectInstallApp(appInstance.identityHash);
                return;
            }
            if (matchedApp.name === types_1.SupportedApplications.SimpleTwoPartySwapApp) {
                return;
            }
            if (matchedApp.name === types_1.SupportedApplications.SimpleTransferApp) {
                yield this.connext.requestCollateral(appInstance.initiatorDepositTokenAddress);
            }
            this.log.info(`Proposal for app install successful, attempting install now...`);
            let res;
            if (isVirtual) {
                res = yield this.connext.installVirtualApp(appInstance.identityHash);
            }
            else {
                res = yield this.connext.installApp(appInstance.identityHash);
            }
            this.log.info(`App installed, res: ${JSON.stringify(res, utils_2.replaceBN, 2)}`);
            return;
        });
        this.registerAvailabilitySubscription = () => __awaiter(this, void 0, void 0, function* () {
            const subject = `online.${this.connext.publicIdentifier}`;
            yield this.connext.messaging.subscribe(subject, (msg) => __awaiter(this, void 0, void 0, function* () {
                if (!msg.reply) {
                    this.log.info(`No reply found for msg: ${msg}`);
                    return;
                }
                const response = true;
                this.connext.messaging.publish(msg.reply, {
                    err: null,
                    response,
                });
            }));
            this.log.info(`Connected message pattern "${subject}"`);
        });
        this.cfCore = cfCore;
        this.connext = connext;
        this.log = new logger_1.Logger("ConnextListener", connext.opts.logLevel);
    }
}
exports.ConnextListener = ConnextListener;

},{"./lib/logger":11,"./lib/utils":12,"./validation/appProposals":16,"@connext/types":undefined,"@counterfactual/types":undefined,"ethers/utils":undefined,"events":undefined}],14:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@connext/types");
const uuid = require("uuid");
const logger_1 = require("./lib/logger");
const utils_1 = require("./lib/utils");
const API_TIMEOUT = 35000;
class NodeApiClient {
    constructor(opts) {
        this.latestSwapRates = {};
        this.recipientOnline = (recipientPublicIdentifier) => __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.send(`online.${recipientPublicIdentifier}`);
            }
            catch (e) {
                if (e.message.startsWith("Request timed out")) {
                    return false;
                }
                throw e;
            }
        });
        this.messaging = opts.messaging;
        this.log = new logger_1.Logger("NodeApiClient", opts.logLevel);
        this.userPublicIdentifier = opts.userPublicIdentifier;
        this.nodePublicIdentifier = opts.nodePublicIdentifier;
    }
    appRegistry(appDetails) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.send("app-registry", appDetails));
        });
    }
    config() {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.send("config.get"));
        });
    }
    createChannel() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.send(`channel.create.${this.userPublicIdentifier}`);
        });
    }
    getChannel() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.send(`channel.get.${this.userPublicIdentifier}`);
        });
    }
    getLatestSwapRate(from, to) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.send(`swap-rate.${from}.${to}`);
        });
    }
    requestCollateral(assetId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.send(`channel.request-collateral.${this.userPublicIdentifier}`, {
                    assetId,
                });
            }
            catch (e) {
                if (e.message.startsWith("Request timed out")) {
                    this.log.info(`request collateral message timed out`);
                    return;
                }
                throw e;
            }
        });
    }
    withdraw(tx) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.send(`channel.withdraw.${this.userPublicIdentifier}`, {
                tx,
            });
        });
    }
    resolveLinkedTransfer(paymentId, preImage, amount, assetId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.send(`transfer.resolve-linked.${this.userPublicIdentifier}`, {
                amount,
                assetId,
                paymentId,
                preImage,
            });
        });
    }
    addPaymentProfile(profile) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.send(`channel.add-profile.${this.userPublicIdentifier}`, profile);
        });
    }
    getPaymentProfile(assetId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.send(`channel.get-profile.${this.userPublicIdentifier}`, {
                assetId: types_1.makeChecksumOrEthAddress(assetId),
            });
        });
    }
    verifyAppSequenceNumber(appSequenceNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.send(`channel.verify-app-sequence.${this.userPublicIdentifier}`, {
                userAppSequenceNumber: appSequenceNumber,
            });
        });
    }
    setUserPublicIdentifier(publicIdentifier) {
        this.userPublicIdentifier = publicIdentifier;
    }
    setNodePublicIdentifier(publicIdentifier) {
        this.nodePublicIdentifier = publicIdentifier;
    }
    subscribeToSwapRates(from, to, callback) {
        this.messaging.subscribe(`swap-rate.${from}.${to}`, callback);
    }
    unsubscribeFromSwapRates(from, to) {
        this.messaging.unsubscribe(`swap-rate.${from}.${to}`);
    }
    send(subject, data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.debug(`Sending request to ${subject} ${data ? `with data: ${JSON.stringify(data, utils_1.replaceBN, 2)}` : `without data`}`);
            const msg = yield this.messaging.request(subject, API_TIMEOUT, Object.assign({}, data, { id: uuid.v4() }));
            if (!msg.data) {
                this.log.info(`Maybe this message is malformed: ${JSON.stringify(msg, utils_1.replaceBN, 2)}`);
                return undefined;
            }
            const _a = msg.data, { err, response } = _a, rest = __rest(_a, ["err", "response"]);
            const responseErr = response && response.err;
            if (err || responseErr) {
                throw new Error(`Error sending request. Message: ${JSON.stringify(msg, utils_1.replaceBN, 2)}`);
            }
            const isEmptyObj = typeof response === "object" && Object.keys(response).length === 0;
            return !response || isEmptyObj ? undefined : response;
        });
    }
}
exports.NodeApiClient = NodeApiClient;

},{"./lib/logger":11,"./lib/utils":12,"@connext/types":undefined,"uuid":undefined}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
function isValidAddress(value) {
    if (typeof value !== "string") {
        return false;
    }
    try {
        ethers_1.utils.getAddress(value);
    }
    catch (e) {
        return false;
    }
    return true;
}
function invalidXpub(value) {
    if (!value || !value.startsWith("xpub")) {
        return `Value must start with "xpub". Value: ${value}`;
    }
    return undefined;
}
exports.invalidXpub = invalidXpub;
function invalidAddress(value) {
    if (!value || !isValidAddress(value)) {
        return `Value provided is not a valid eth address. Value: ${value}`;
    }
    return undefined;
}
exports.invalidAddress = invalidAddress;

},{"ethers":undefined}],16:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("ethers/utils");
const logger_1 = require("../lib/logger");
const utils_2 = require("../lib/utils");
exports.validateSwapApp = (app, registeredInfo, isVirtual, connext) => __awaiter(this, void 0, void 0, function* () {
    const baseValidation = yield baseAppValidation(app, registeredInfo, isVirtual, connext);
    if (baseValidation) {
        return baseValidation;
    }
    return undefined;
});
exports.validateTransferApp = (app, registeredInfo, isVirtual, connext) => __awaiter(this, void 0, void 0, function* () {
    const baseValidation = yield baseAppValidation(app, registeredInfo, isVirtual, connext);
    if (baseValidation) {
        return baseValidation;
    }
    if (!app.responderDeposit.isZero()) {
        return `Responder (payee) must have a zero balance in proposed app. Proposed app: ${prettyLog(app)}`;
    }
    if (app.initiatorDeposit.isZero()) {
        return `Initiator (payor) must have nonzero balance in proposed app. Proposed app: ${prettyLog(app)}`;
    }
    return undefined;
});
exports.validateSimpleTransferApp = (app, registeredInfo, isVirtual, connext) => __awaiter(this, void 0, void 0, function* () {
    const baseValidation = yield baseAppValidation(app, registeredInfo, isVirtual, connext);
    if (baseValidation) {
        return baseValidation;
    }
    if (!app.responderDeposit.isZero()) {
        return `Responder (payee) must have a zero balance in proposed app. Proposed app: ${prettyLog(app)}`;
    }
    if (app.initiatorDeposit.isZero()) {
        return `Initiator (payor) must have nonzero balance in proposed app. Proposed app: ${prettyLog(app)}`;
    }
    return undefined;
});
exports.validateLinkedTransferApp = (app, registeredInfo, isVirtual, connext) => __awaiter(this, void 0, void 0, function* () {
    return undefined;
});
exports.appProposalValidation = {
    SimpleLinkedTransferApp: exports.validateLinkedTransferApp,
    SimpleTransferApp: exports.validateSimpleTransferApp,
    SimpleTwoPartySwapApp: exports.validateSwapApp,
};
const prettyLog = (app) => {
    const asStr = {};
    Object.entries(app).forEach(([name, value]) => {
        asStr[name] = value.toString();
    });
    return JSON.stringify(asStr, utils_2.replaceBN, 2);
};
const baseAppValidation = (app, registeredInfo, isVirtual, connext) => __awaiter(this, void 0, void 0, function* () {
    const log = new logger_1.Logger("baseAppValidation", connext.opts.logLevel);
    log.info(`Validating app: ${prettyLog(app)}`);
    log.info(`App has initial state? ${prettyLog(app.initialState)}`);
    const apps = yield connext.getAppInstances();
    if (apps) {
        const sharedIds = (yield connext.getAppInstances()).filter((a) => a.identityHash === app.identityHash);
        if (sharedIds.length !== 0) {
            return `Duplicate app id detected. Proposed app: ${prettyLog(app)}`;
        }
    }
    if (app.appDefinition !== registeredInfo.appDefinitionAddress) {
        return `Incorrect app definition detected. Proposed app: ${prettyLog(app)}`;
    }
    log.info(`app.abiEncodings.actionEncoding: ${JSON.stringify(app.abiEncodings.actionEncoding)}`);
    log.info(`registeredInfo.actionEncoding: ${JSON.stringify(registeredInfo.actionEncoding)}`);
    if (app.abiEncodings.actionEncoding !== registeredInfo.actionEncoding) {
        return `Incorrect action encoding detected. Proposed app: ${prettyLog(app)}`;
    }
    if (app.abiEncodings.stateEncoding !== registeredInfo.stateEncoding) {
        return `Incorrect state encoding detected. Proposed app: ${prettyLog(app)}`;
    }
    if (utils_1.bigNumberify(app.initiatorDeposit).isZero() && utils_1.bigNumberify(app.responderDeposit).isZero()) {
        return `Refusing to install app with two zero value deposits. Proposed app: ${prettyLog(app)}`;
    }
    const responderFreeBalance = yield connext.getFreeBalance(utils_1.getAddress(app.responderDepositTokenAddress));
    const userFreeBalance = responderFreeBalance[utils_2.freeBalanceAddressFromXpub(connext.publicIdentifier)];
    if (userFreeBalance.lt(app.responderDeposit)) {
        return `Insufficient free balance for requested asset,
      freeBalance: ${userFreeBalance.toString()}
      required: ${app.responderDeposit}. Proposed app: ${prettyLog(app)}`;
    }
    const initiatorFreeBalance = yield connext.getFreeBalance(utils_1.getAddress(app.initiatorDepositTokenAddress));
    const nodeFreeBalance = initiatorFreeBalance[utils_2.freeBalanceAddressFromXpub(connext.nodePublicIdentifier)];
    if (isVirtual && nodeFreeBalance.lt(app.initiatorDeposit)) {
        const reqRes = yield connext.requestCollateral(app.initiatorDepositTokenAddress);
        connext.logger.info(`Collateral Request result: ${JSON.stringify(reqRes, utils_2.replaceBN, 2)}`);
        return `Insufficient collateral for requested asset,
    freeBalance of node: ${nodeFreeBalance.toString()}
    required: ${app.initiatorDeposit}. Proposed app: ${prettyLog(app)}`;
    }
    const hasIntermediaries = app.intermediaryIdentifier;
    if (hasIntermediaries && !isVirtual) {
        return `Apps with connected node should have no intermediaries. Proposed app: ${prettyLog(app)}`;
    }
    if (isVirtual && !hasIntermediaries) {
        return `Virtual apps should have intermediaries. Proposed app: ${prettyLog(app)}`;
    }
    if (isVirtual && app.intermediaryIdentifier !== connext.nodePublicIdentifier) {
        return `Connected node is not in proposed intermediaries. Proposed app: ${prettyLog(app)}`;
    }
    return undefined;
});

},{"../lib/logger":11,"../lib/utils":12,"ethers/utils":undefined}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const utils_1 = require("../lib/utils");
exports.falsy = (x) => !!x;
function notBigNumber(value) {
    return ethers_1.utils.BigNumber.isBigNumber(value)
        ? undefined
        : `Value is not a bignumber. Value: ${JSON.stringify(value, utils_1.replaceBN, 2)}`;
}
exports.notBigNumber = notBigNumber;
function notBigNumberish(value) {
    try {
        ethers_1.utils.bigNumberify(value);
    }
    catch (e) {
        return `Value is not bignumberish. Value: ${JSON.stringify(value, utils_1.replaceBN, 2)}`;
    }
    return undefined;
}
exports.notBigNumberish = notBigNumberish;
function notGreaterThan(value, ceil) {
    if (notBigNumberish(value)) {
        return notBigNumberish(value);
    }
    return ethers_1.utils.bigNumberify(value).gt(ethers_1.utils.bigNumberify(ceil))
        ? undefined
        : `Value (${value.toString()}) is not greater than ${ceil.toString()}`;
}
exports.notGreaterThan = notGreaterThan;
function notGreaterThanOrEqualTo(value, ceil) {
    if (notBigNumberish(value)) {
        return notBigNumberish(value);
    }
    return ethers_1.utils.bigNumberify(value).gte(ceil)
        ? undefined
        : `Value (${value.toString()}) is not greater than or equal to ${ceil.toString()}`;
}
exports.notGreaterThanOrEqualTo = notGreaterThanOrEqualTo;
function notLessThan(value, floor) {
    if (notBigNumberish(value)) {
        return notBigNumberish(value);
    }
    return ethers_1.utils.bigNumberify(value).lt(floor)
        ? undefined
        : `Value (${value.toString()}) is not less than ${floor.toString()}`;
}
exports.notLessThan = notLessThan;
function notLessThanOrEqualTo(value, floor) {
    if (notBigNumberish(value)) {
        return notBigNumberish(value);
    }
    return ethers_1.utils.bigNumberify(value).lte(floor)
        ? undefined
        : `Value (${value.toString()}) is not less than or equal to ${floor.toString()}`;
}
exports.notLessThanOrEqualTo = notLessThanOrEqualTo;
function notPositive(value) {
    return notGreaterThanOrEqualTo(value, 0);
}
exports.notPositive = notPositive;
function notNegative(value) {
    return notLessThan(value, 0);
}
exports.notNegative = notNegative;

},{"../lib/utils":12,"ethers":undefined}],18:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const utils_1 = require("ethers/utils");
function invalid32ByteHexString(value) {
    if (typeof value !== "string" || !ethers_1.utils.isHexString(value)) {
        return `Value ${value.toString()} is not a valid hex string`;
    }
    if (utils_1.hexDataLength(value) !== 32) {
        return `Value ${value.toString()} is not a valid 32 byte hex string`;
    }
    return undefined;
}
exports.invalid32ByteHexString = invalid32ByteHexString;

},{"ethers":undefined,"ethers/utils":undefined}],19:[function(require,module,exports){
"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
__export(require("./addresses"));
__export(require("./appProposals"));
__export(require("./bn"));
__export(require("./hexStrings"));

},{"./addresses":15,"./appProposals":16,"./bn":17,"./hexStrings":18}]},{},[9]);
