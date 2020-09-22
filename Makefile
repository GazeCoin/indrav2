
SHELL=/bin/bash # shell make will use to execute commands
VPATH=.flags # prerequisite search path
$(shell mkdir -p $(VPATH))

########################################
# Run shell commands to fetch info from environment

dir=$(shell cd "$(shell dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )
project=$(shell cat $(dir)/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4)
registry=$(shell cat $(dir)/package.json | grep '"registry":' | head -n 1 | cut -d '"' -f 4)

cwd=$(shell pwd)
wincwd="C:\dev\workspace\indra_6.5.1"
commit=$(shell git rev-parse HEAD | head -c 8)

# version that will be tested against for backwards compatibility checks
backwards_compatible_version=$(shell cat package.json | grep '"backwardsCompatibleWith"' | head -n 1 | cut -d '"' -f 4)

# If Linux, give the container our uid & gid so we know what to reset permissions to. If Mac, the docker-VM takes care of this for us so pass root's id (ie noop)
id=$(shell if [[ "`uname`" == "Darwin" ]]; then echo 0:0; else echo "`id -u`:`id -g`"; fi)

# Pool of images to pull cached layers from during docker build steps
image_cache=$(shell if [[ -n "${GITHUB_WORKFLOW}" ]]; then echo "--cache-from=$(project)_builder:latest,$(project)_database:latest,$(project)_ethprovider:latest,$(project)_node:latest,$(project)_proxy:latest"; else echo ""; fi)

interactive=$(shell if [[ -t 0 && -t 2 ]]; then echo "--interactive"; else echo ""; fi)
is_win=$(shell if [[ "`uname -a`" =~ .*Microsoft.* ]]; then echo true; else echo false; fi)
ifeq ($(is_win), true)
  volcwd=$(wincwd)
else
  volcwd=$(cwd)
endif

#	@echo 'echo volcwd'
#	$(shell echo $(volcwd))

########################################
# Setup more vars

find_options=-type f -not -path "*/node_modules/*" -not -name "address-book.json" -not -name "*.swp" -not -path "*/.*" -not -path "*/cache/*" -not -path "*/build/*" -not -path "*/dist/*" -not -name "*.log"

docker_run=docker run --name=$(project)_builder $(interactive) --tty --rm --volume=$(volcwd):/root $(project)_builder $(id)

startTime=.flags/.startTime
totalTime=.flags/.totalTime
log_start=@echo "=============";echo "[Makefile] => Start building $@"; date "+%s" > $(startTime)
log_finish=@echo $$((`date "+%s"` - `cat $(startTime)`)) > $(totalTime); rm $(startTime); echo "[Makefile] => Finished building $@ in `cat $(totalTime)` seconds";echo "=============";echo

########################################
# Build Shortcuts

default: indra
indra: database proxy node
extras: bot ethprovider test-runner
all: indra extras

########################################
# Command & Control Shortcuts

start: indra
	bash ops/start-indra.sh

start-prod:
	INDRA_ENV=prod bash ops/start-indra.sh

start-daicard: client
	bash ops/start-daicard.sh

start-testnet: contracts
	INDRA_CHAIN_LOG_LEVEL=1 bash ops/start-testnet.sh

start-bot: bot
	bash ops/test/tps.sh 2 1000

stop:
	bash ops/stop.sh indra
	bash ops/stop.sh daicard

stop-daicard:
	bash ops/stop.sh daicard

stop-all:
	bash ops/stop.sh indra
	bash ops/stop.sh daicard
	bash ops/stop.sh testnet

restart: indra stop
	bash ops/start-indra.sh

restart-prod: stop
	INDRA_ENV=prod bash ops/start-indra.sh

clean: stop-all
	docker container prune -f
	rm -rf .flags/*
	rm -rf node_modules/@connext modules/*/node_modules/@connext
	rm -rf node_modules/@walletconnect modules/*/node_modules/@walletconnect
	rm -rf modules/*/node_modules/*/.git
	rm -rf modules/*/node_modules/.bin
	rm -rf modules/contracts/artifacts modules/*/build modules/*/dist docs/build
	rm -rf modules/*/.*cache* modules/*/node_modules/.cache modules/contracts/cache/*.json
	rm -rf modules/*/package-lock.json

reset: stop-all
	docker container prune -f
	docker network rm $(project) $(project)_cf_tester $(project)_node_tester $(project)_test_store 2> /dev/null || true
	docker secret rm $(project)_database_dev 2> /dev/null || true
	docker volume rm $(project)_database_dev  2> /dev/null || true
	docker volume rm `docker volume ls -q -f name=$(project)_database_test_*` 2> /dev/null || true
	rm -rf .chaindata/*
	rm -rf modules/bot/.bot-store

quick-reset:
	bash ops/db.sh 'truncate table app_registry cascade;'
	bash ops/db.sh 'truncate table channel cascade;'
	bash ops/db.sh 'truncate table channel_rebalance_profiles_rebalance_profile cascade;'
	bash ops/db.sh 'truncate table node_records cascade;'
	bash ops/db.sh 'truncate table onchain_transaction cascade;'
	bash ops/db.sh 'truncate table rebalance_profile cascade;'
	bash ops/db.sh 'truncate table app_instance cascade;'
	bash ops/redis.sh 'flushall'
	rm -rf modules/bot/.bot-store
	touch modules/node/src/main.ts

reset-images:
	rm -f .flags/bot .flags/daicard .flags/database .flags/ethprovider .flags/node .flags/proxy .flags/test-runner

purge: clean reset

push:
	bash ops/push-images.sh

pull:
	bash ops/pull-images.sh

pull-latest:
	bash ops/pull-images.sh latest

build-report:
	bash ops/build-report.sh

lint:
	bash ops/lint.sh

publish-contracts:
	bash ops/npm-publish.sh contracts

publish-packages:
	bash ops/npm-publish.sh

dls:
	@docker service ls
	@echo "====="
	@docker container ls -a

########################################
# Test Runner Shortcuts

test-utils: utils
	bash ops/test/unit.sh utils

test-store: store
	bash ops/test/store.sh

test-contracts: contracts
	bash ops/test/unit.sh contracts

test-cf: cf-core
	bash ops/test/cf.sh test

test-watcher: watcher
	bash ops/test/watcher.sh

test-node: node
	bash ops/test/node.sh test

watch-node:
	bash ops/test/node.sh watch

test-tps: bot
	bash ops/test/tps.sh 5 0 10

test-tps-prod:
	INDRA_ENV=prod bash ops/test/tps.sh 3 0 10

test-integration: test-runner
	bash ops/test/integration.sh

watch-integration:
	bash ops/test/integration.sh latest watch

test-integration-prod:
	INDRA_ENV=prod bash ops/test/integration.sh

test-backwards-compatibility:
	bash ops/pull-images.sh $(backwards_compatible_version)
	INDRA_ENV=prod bash ops/test/integration.sh $(backwards_compatible_version)

test-daicard:
	bash ops/test/daicard.sh

watch-daicard:
	bash ops/test/daicard.sh --watch

test-docs: docs
	$(docker_run) "source .pyEnv/bin/activate && cd docs && sphinx-build -b linkcheck -d build/linkcheck . build/html"

########################################
# Begin Real Build Rules

# All rules from here on should only depend on rules that come before it
# ie first no dependencies, last no dependents

########################################
# Common Prerequisites

builder: $(shell find ops/builder)
	$(log_start)
	docker build --file ops/builder/Dockerfile $(image_cache) --tag $(project)_builder ops/builder
	docker tag ${project}_builder ${project}_builder:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

node-modules: builder package.json $(shell ls modules/*/package.json)
	$(log_start)
	$(docker_run) "lerna bootstrap --hoist"
	$(log_finish) && mv -f $(totalTime) .flags/$@

py-requirements: builder docs/requirements.txt
	$(log_start)
	$(docker_run) "bash ops/py-install.sh"
	$(log_finish) && mv -f $(totalTime) .flags/$@

########################################
# Docs

.PHONY: docs
docs: documentation
documentation: py-requirements $(shell find docs $(find_options))
	$(log_start)
	$(docker_run) "rm -rf docs/build"
	$(docker_run) "source .pyEnv/bin/activate && cd docs && sphinx-build -b html -d build/doctrees ./src build/html"
	$(log_finish) && mv -f $(totalTime) .flags/$@

########################################
# Build Core JS libs & bundles
# Keep prerequisites synced w the @connext/* dependencies of each module's package.json

types: node-modules $(shell find modules/types $(find_options))
	$(log_start)
	$(docker_run) "cd modules/types && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

utils: types $(shell find modules/utils $(find_options))
	$(log_start)
	$(docker_run) "cd modules/utils && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

channel-provider: types $(shell find modules/channel-provider $(find_options))
	$(log_start)
	$(docker_run) "cd modules/channel-provider && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

messaging: types utils $(shell find modules/messaging $(find_options))
	$(log_start)
	$(docker_run) "cd modules/messaging && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

contracts: types utils $(shell find modules/contracts $(find_options))
	$(log_start)
	$(docker_run) "cd modules/contracts && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

store: types utils contracts $(shell find modules/store $(find_options))
	$(log_start)
	$(docker_run) "cd modules/store && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

cf-core: types utils store contracts $(shell find modules/cf-core $(find_options))
	$(log_start)
	$(docker_run) "cd modules/cf-core && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

apps: types utils contracts cf-core $(shell find modules/apps $(find_options))
	$(log_start)
	$(docker_run) "cd modules/apps && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

client: types utils channel-provider messaging store contracts cf-core apps watcher $(shell find modules/client $(find_options))
	$(log_start)
	$(docker_run) "cd modules/client && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

watcher: types utils contracts store $(shell find modules/watcher $(find_options))
	$(log_start)
	$(docker_run) "cd modules/watcher && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

daicard-bundle: types utils store client $(shell find modules/daicard $(find_options))
	$(log_start)
	$(docker_run) "cd modules/daicard && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

bot-bundle: types utils channel-provider messaging store contracts cf-core apps client $(shell find modules/bot $(find_options))
	$(log_start)
	$(docker_run) "cd modules/bot && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

node-bundle: types utils messaging store contracts cf-core apps watcher client $(shell find modules/node $(find_options))
	$(log_start)
	$(docker_run) "cd modules/node && npm run build && touch src/main.ts"
	$(log_finish) && mv -f $(totalTime) .flags/$@

test-runner-bundle: types utils channel-provider messaging store contracts cf-core apps client $(shell find modules/test-runner $(find_options))
	$(log_start)
	$(docker_run) "cd modules/test-runner && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

########################################
# Build Docker Images

bot: bot-bundle $(shell find modules/bot/ops $(find_options))
	$(log_start)
	docker build --file modules/bot/ops/Dockerfile $(image_cache) --tag $(project)_bot modules/bot
	docker tag $(project)_bot $(project)_bot:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

daicard: daicard-bundle $(shell find modules/daicard/ops $(find_options))
	$(log_start)
	docker build --file modules/daicard/ops/Dockerfile $(image_cache) --tag ${project}_daicard modules/daicard
	docker tag ${project}_daicard ${project}_daicard:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

database: $(shell find ops/database $(find_options))
	$(log_start)
	docker build --file ops/database/db.dockerfile $(image_cache) --tag $(project)_database ops/database
	docker tag $(project)_database $(project)_database:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

ethprovider: contracts $(shell find modules/contracts/ops $(find_options))
	$(log_start)
	docker build --file modules/contracts/ops/Dockerfile $(image_cache) --tag $(project)_ethprovider modules/contracts
	docker tag $(project)_ethprovider $(project)_ethprovider:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

node: node-bundle $(shell find modules/node/ops $(find_options))
	$(log_start)
	docker build --file modules/node/ops/Dockerfile $(image_cache) --tag $(project)_node modules/node
	docker tag $(project)_node $(project)_node:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

proxy: $(shell find ops/proxy $(find_options))
	$(log_start)
	docker build $(image_cache) --tag $(project)_proxy ops/proxy
	docker tag $(project)_proxy $(project)_proxy:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

ssh-action: $(shell find ops/ssh-action $(find_options))
	$(log_start)
	docker build --file ops/ssh-action/Dockerfile --tag $(project)_ssh_action ops/ssh-action
	docker tag $(project)_ssh_action $(project)_ssh_action:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

test-runner: test-runner-bundle $(shell find modules/test-runner/ops $(find_options))
	$(log_start)
	docker build --file modules/test-runner/ops/Dockerfile $(image_cache) --tag $(project)_test_runner modules/test-runner
	docker tag $(project)_test_runner $(project)_test_runner:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@
