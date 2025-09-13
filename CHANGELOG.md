

# [5.0.0-beta.4](https://github.com/Supergiovane/KNXUltimate/compare/v5.0.0-beta.3...v5.0.0-beta.4) (2025-09-13)


### Bug Fixes

* regression in secure connection keep alive. ([c6da3aa](https://github.com/Supergiovane/KNXUltimate/commit/c6da3aa6d97c6872709d8e4d74302dabb90432b3))

# [5.0.0-beta.3](https://github.com/Supergiovane/KNXUltimate/compare/v5.0.0-beta.2...v5.0.0-beta.3) (2025-09-13)


### Bug Fixes

* fided heartbeat in TunnelTCP secure ([06f24af](https://github.com/Supergiovane/KNXUltimate/commit/06f24af6618c822eeb16a91b3fcb5f7ec734066b))
* fixed tests and update README ([87c9b01](https://github.com/Supergiovane/KNXUltimate/commit/87c9b0136ad45e907a0d08b98286e4fa2d097a67))
* fixed wrong heartbeat log ([b46d5de](https://github.com/Supergiovane/KNXUltimate/commit/b46d5ded0ea73d1ce66738d84e6e3a91bd2026a0))

# [5.0.0-beta.2](https://github.com/Supergiovane/KNXUltimate/compare/v5.0.0-beta.1...v5.0.0-beta.2) (2025-09-12)

# [5.0.0-beta.1](https://github.com/Supergiovane/KNXUltimate/compare/v5.0.0-beta.0...v5.0.0-beta.1) (2025-09-11)

# [5.0.0-beta.0](https://github.com/Supergiovane/KNXUltimate/compare/v4.1.3...v5.0.0-beta.0) (2025-09-11)


### Bug Fixes

* [#23](https://github.com/Supergiovane/KNXUltimate/issues/23) writeRaw broken with length <= 6bits ([#24](https://github.com/Supergiovane/KNXUltimate/issues/24)) ([bfbc7ab](https://github.com/Supergiovane/KNXUltimate/commit/bfbc7abde6f68ac4e8d39f386db073493311684d))
* [#30](https://github.com/Supergiovane/KNXUltimate/issues/30) short value 0x3f decoding ([#29](https://github.com/Supergiovane/KNXUltimate/issues/29)) ([34b21be](https://github.com/Supergiovane/KNXUltimate/commit/34b21bee58106c43229c29ee4656eb0a431aa3c2))
* add build step to ci ([0618bc7](https://github.com/Supergiovane/KNXUltimate/commit/0618bc7dbf3be13ccb87c269f2cdfe4592599e33))
* add missing helps in dpts ([be3dee3](https://github.com/Supergiovane/KNXUltimate/commit/be3dee3381cfa14abd17f13cfd3700119e89e530))
* async closeSocket thtows an error if the socket is already closed. ([f81d1d0](https://github.com/Supergiovane/KNXUltimate/commit/f81d1d00c1459da71d34c49786d690e1ed878cf6))
* better checks of socket ready state ([#39](https://github.com/Supergiovane/KNXUltimate/issues/39)) ([a65d4b1](https://github.com/Supergiovane/KNXUltimate/commit/a65d4b1f9825991a9d113d5508e2680138722358))
* better rounding on dpt 9.001 ([#33](https://github.com/Supergiovane/KNXUltimate/issues/33)) ([30fe11d](https://github.com/Supergiovane/KNXUltimate/commit/30fe11dc9f6a5d96d061bb2a54b7cc2a34dba3d3)), closes [#32](https://github.com/Supergiovane/KNXUltimate/issues/32)
* better timers management for race conditions and leak prevention ([#17](https://github.com/Supergiovane/KNXUltimate/issues/17)) ([8ffcd93](https://github.com/Supergiovane/KNXUltimate/commit/8ffcd9308ac4e5dcc2e7debc3b7f9748a1cdc364))
* clear the queueitem in case of errors ([e7a718d](https://github.com/Supergiovane/KNXUltimate/commit/e7a718d482db9917b252f97f8132a97c176f9367))
* client close ([fd91d96](https://github.com/Supergiovane/KNXUltimate/commit/fd91d96898f3ad16f4a8e31ad2dc024fb53a7f45))
* disconnect request not sent properly in KNXClient.ts ([#55](https://github.com/Supergiovane/KNXUltimate/issues/55)) ([0de4c00](https://github.com/Supergiovane/KNXUltimate/commit/0de4c005e1b24b82b882d6d6f7f6c9cdac23f58d))
* ensure _clearToSend is correctly set during discovery ([#34](https://github.com/Supergiovane/KNXUltimate/issues/34)) ([5d4a2e4](https://github.com/Supergiovane/KNXUltimate/commit/5d4a2e4d8581c87c67f0c8c98ec14d43ba208e64))
* examples ([4c26f5a](https://github.com/Supergiovane/KNXUltimate/commit/4c26f5a87f3a822d4309448029924d5b886773e6))
* exiting the queue loop after error ([6d67807](https://github.com/Supergiovane/KNXUltimate/commit/6d678071442c50e9cf9e9ceb6464abfa44f0f88a))
* export all packet types ([196f712](https://github.com/Supergiovane/KNXUltimate/commit/196f712e757721031026383c191c1a7de6c6b60d))
* export dptlib ([a32d2ec](https://github.com/Supergiovane/KNXUltimate/commit/a32d2ec7355106677e88ff1a5fe3f1a59af34d82))
* finish conversion of curve25519 ([1e2743a](https://github.com/Supergiovane/KNXUltimate/commit/1e2743a6d8583b1a60fcfa53ee14be0a72f7e00b))
* fix DPT10.001 Time error when time passed as string ([ad2c314](https://github.com/Supergiovane/KNXUltimate/commit/ad2c314dab3a407df194eb0ab1f88a8af5a183ba))
* fix missing "test" folder ([f24f5f2](https://github.com/Supergiovane/KNXUltimate/commit/f24f5f240c0afa6ee6166626d7b370a887de1fd4))
* fix multicast socket, by removing the local ip interface from the binding ([99e1176](https://github.com/Supergiovane/KNXUltimate/commit/99e11766df74ccf956fdbd291bf0ec42a23da3ea))
* fixed an issue when "suppress ACK request" was set to true. ([1c70745](https://github.com/Supergiovane/KNXUltimate/commit/1c7074577a0517c1f46099bfd3a9808c90d0b19e))
* fixed an uncaught exception ([f9645c4](https://github.com/Supergiovane/KNXUltimate/commit/f9645c44bf5baefcb31ddd86ff9cf81ee411d876))
* fixed base beta release ([56e7f96](https://github.com/Supergiovane/KNXUltimate/commit/56e7f968758eef7401e1f135a7059d5b5b685904))
* fixed DPT6002 not showing up ([a4e95dd](https://github.com/Supergiovane/KNXUltimate/commit/a4e95ddb682dc6389ce64cb4d6fa5234a3764080))
* Fixed import issue ([c666954](https://github.com/Supergiovane/KNXUltimate/commit/c666954354707ca896ceb3597e53340809f33414))
* fixed lint issues in new DPT 6002 ([1b30857](https://github.com/Supergiovane/KNXUltimate/commit/1b308574dc046f677651946517c64885c2d27d11))
* fixed queue ACK issue. Now, the replies from request coming from the KNX Gateway, are put as priority item in the kNX output queue. ([76ded4b](https://github.com/Supergiovane/KNXUltimate/commit/76ded4baf0a8a8a62c8634135c070b63df786119))
* improve messages types ([b6c9f49](https://github.com/Supergiovane/KNXUltimate/commit/b6c9f49e4c86ce5ae626f4023b191ca62adb33c3))
* improved disconnect logic ([8e55945](https://github.com/Supergiovane/KNXUltimate/commit/8e5594544895aefa98c8d24d6b1fc8dc0f607a4c))
* improved types of events ([4658b45](https://github.com/Supergiovane/KNXUltimate/commit/4658b4565aa473d7e2eed242c5d9706069300404))
* index.ts of dtplib was whrowing an unmeaningful error. ([#47](https://github.com/Supergiovane/KNXUltimate/issues/47)) ([d517a82](https://github.com/Supergiovane/KNXUltimate/commit/d517a828ae11a54e7ba20fe85dfc3e6fe81dd767))
* ipAddressHelper uncatched error when running on raspberry pi, having interfaces without any ip. ([#44](https://github.com/Supergiovane/KNXUltimate/issues/44)) ([4b29af6](https://github.com/Supergiovane/KNXUltimate/commit/4b29af6f0ab86686e5510d9d57f6152975e063eb))
* issue where DPT9 was giving error ([#21](https://github.com/Supergiovane/KNXUltimate/issues/21)) ([f0c9120](https://github.com/Supergiovane/KNXUltimate/commit/f0c91207dd95a4ca1b0e48567bdfb264f984b93e))
* limiter improvements ([#28](https://github.com/Supergiovane/KNXUltimate/issues/28)) ([90ca11f](https://github.com/Supergiovane/KNXUltimate/commit/90ca11fa47e903e41cdefcf0cf2ed9a7e0518252))
* logger and deprecated buffer `slice` to `subarray` ([ddd6733](https://github.com/Supergiovane/KNXUltimate/commit/ddd6733be7852621a350654ac44d41ea2481247b))
* make release-it adding a patch release instead of main release. ([#51](https://github.com/Supergiovane/KNXUltimate/issues/51)) ([22bf2e9](https://github.com/Supergiovane/KNXUltimate/commit/22bf2e947f0d209da7f98ece081d6df2370b39f8))
* refactor method names and added js docs ([#19](https://github.com/Supergiovane/KNXUltimate/issues/19)) ([0bf6af4](https://github.com/Supergiovane/KNXUltimate/commit/0bf6af436fdcca6078dc786bf3336496f01f48e5))
* remove many useless try catches ([3c528f1](https://github.com/Supergiovane/KNXUltimate/commit/3c528f17ef896a7d01049780dd35185de29dae7a))
* remove references to `KNXEthInterface` ([2c1912f](https://github.com/Supergiovane/KNXUltimate/commit/2c1912f805d344edf3ea820e2035c669002e5bfd))
* removed the "test" folder from the include array ([b7341c9](https://github.com/Supergiovane/KNXUltimate/commit/b7341c961128aa7430d48f4a1cb99ec8ac464470))
* removed unwanted "desc" prop from DatapointConfig root. ([#48](https://github.com/Supergiovane/KNXUltimate/issues/48)) ([16d7538](https://github.com/Supergiovane/KNXUltimate/commit/16d753839771469b281720630548c85fdc0a7e14))
* socket end ([64a6296](https://github.com/Supergiovane/KNXUltimate/commit/64a62962395b080d7ef3d73d00b4a050dc783e94))
* some other types ([5d84716](https://github.com/Supergiovane/KNXUltimate/commit/5d847160fa3bcdb8c71c205c65cc38d47e73a282))
* some types ([b01ef85](https://github.com/Supergiovane/KNXUltimate/commit/b01ef8594384a6209dd276cc6873aa42b95154c6))
* test connect/disconnect ([b378c6a](https://github.com/Supergiovane/KNXUltimate/commit/b378c6a8a13ea48ab3ce1fe592fb1c06ec362bd4))
* the loglevel is now fixed. ([4faeab4](https://github.com/Supergiovane/KNXUltimate/commit/4faeab49dad6a4e4c7bfa27cb7131d20f5b67368))
* the tunnel socket creation function (createSocket), adding reusable option and specifying the port. This will likely prevent some UDP packets not arriving at the socket,  due to operating system routing restrictions. ([fed7e20](https://github.com/Supergiovane/KNXUltimate/commit/fed7e20f72bf6d614cc159b0b1c291878ff9117a))
* tlvinfo type ([1972fee](https://github.com/Supergiovane/KNXUltimate/commit/1972fee658364a2abb71d46c7e4a7305c99ccd59))
* typo ([f5c461c](https://github.com/Supergiovane/KNXUltimate/commit/f5c461cf01984a9b352d27bd8b2ff5ab3e8644ce))
* typo on knx client ([53e6b1b](https://github.com/Supergiovane/KNXUltimate/commit/53e6b1b65a35a2a68b697d5987b151c27bc39096))
* updated gitignore to exclude some personal keys ([f4b7d09](https://github.com/Supergiovane/KNXUltimate/commit/f4b7d09a68eef6e9253382f27d22d390f6b0dba2))
* use destroy for TCP socket close ([d00359f](https://github.com/Supergiovane/KNXUltimate/commit/d00359fa12f35e2bbbbb5a11a9fc11901b37a8b2))
* useless statics ([8da73f2](https://github.com/Supergiovane/KNXUltimate/commit/8da73f23d8bf51074735c03f2c618f77fb8524c1))
* vscode default fomatter ([c267cbf](https://github.com/Supergiovane/KNXUltimate/commit/c267cbff8681d07bc8de880b4d80b9489b017216))
* wrong address parsing ([e529650](https://github.com/Supergiovane/KNXUltimate/commit/e52965061adbf56e645ad63f48f902c0add00cac))
* wrong overload of `discovery` method ([709b7d1](https://github.com/Supergiovane/KNXUltimate/commit/709b7d1827b3fec995cf5f1f553651eb59f3587e))


* feat!: implemented KNX routing secure (#60) ([18671d6](https://github.com/Supergiovane/KNXUltimate/commit/18671d6c1f77c331f0ce513bddb14fa51e1a087a)), closes [#60](https://github.com/Supergiovane/KNXUltimate/issues/60)


### Features

* Ad DPT 14.1200 ([#50](https://github.com/Supergiovane/KNXUltimate/issues/50)) ([7830ae3](https://github.com/Supergiovane/KNXUltimate/commit/7830ae3bc994cafa799b9b7d25c2235a5399d5d8))
* Add Hager TXA223/225 custom status DPT 60002 ([cb66cdd](https://github.com/Supergiovane/KNXUltimate/commit/cb66cddceed04b8c9091feed059b6a11fc823587))
* added all subtypes to datapoint 20.x ([#45](https://github.com/Supergiovane/KNXUltimate/issues/45)) ([ce436c0](https://github.com/Supergiovane/KNXUltimate/commit/ce436c0df3cbd778dcb6f818f3f9b0a35853d8b3))
* Added first files for support to KNX Secure and Data Secure Tunneling ([e4fa892](https://github.com/Supergiovane/KNXUltimate/commit/e4fa89202ca5b05031f4f46774456b9fe9cf30cc))
* added getGatewayDescription method, to gather infos of the connected gateway ([9c6ae5d](https://github.com/Supergiovane/KNXUltimate/commit/9c6ae5d7abb12c568515a3790f16827e23199907))
* added src and destination addresses in the LDataInd LOG. ([#46](https://github.com/Supergiovane/KNXUltimate/issues/46)) ([a2f53e2](https://github.com/Supergiovane/KNXUltimate/commit/a2f53e21f934a971e8f2340831f812390f7ad863))
* added the gatewaydescription.ts sample ([b68427c](https://github.com/Supergiovane/KNXUltimate/commit/b68427cf88bd3e6d7e09f5b0ebd50b1fc165af92))
* added the KNX/IP Gateway description gatherer, wich contains the gateway's name, tunneling/routing modes etc.. ([97c5bdc](https://github.com/Supergiovane/KNXUltimate/commit/97c5bdc9a54a387f2466da2c6f60242d808370e4))
* client and other types ([06ea902](https://github.com/Supergiovane/KNXUltimate/commit/06ea9028e3018e596042b36719bcf7fa5273b4c3))
* device info in "discover", added KNXClient.getGatewayDescription ([#40](https://github.com/Supergiovane/KNXUltimate/issues/40)) ([06c7ed6](https://github.com/Supergiovane/KNXUltimate/commit/06c7ed661f0cdec141d95feb6a49685e0fd41cff)), closes [/github.com/Supergiovane/KNXUltimate/pull/40#discussion_r1850563396](https://github.com//github.com/Supergiovane/KNXUltimate/pull/40/issues/discussion_r1850563396)
* discovery ([#15](https://github.com/Supergiovane/KNXUltimate/issues/15)) ([087477e](https://github.com/Supergiovane/KNXUltimate/commit/087477ed86ab62951d5cb09d81f0918b326d9251))
* eslint + prettier ([6c10385](https://github.com/Supergiovane/KNXUltimate/commit/6c1038555430c11fb1b681d60ccb54a43639e328))
* finish converting dptlib ([6d5e75b](https://github.com/Supergiovane/KNXUltimate/commit/6d5e75bea73bda60b2e65159e6ed3641c2f0a218))
* going on ([7ebdec3](https://github.com/Supergiovane/KNXUltimate/commit/7ebdec3e4f82a53f79964f45405491eea8c9e8cb))
* going on with protcol ([0fe5d62](https://github.com/Supergiovane/KNXUltimate/commit/0fe5d6290f17c1424c7cccf1436f07d91c2dc9e5))
* going on with refactor ([a57efb3](https://github.com/Supergiovane/KNXUltimate/commit/a57efb35845096fca27747303a57f4e0815262d4))
* Preliminary support for knx virtual & ACK fix ([#53](https://github.com/Supergiovane/KNXUltimate/issues/53)) ([abd36a9](https://github.com/Supergiovane/KNXUltimate/commit/abd36a92040cc56906c1ecbfdd5267780f6b6b6a))
* protocol cemi conversion ([5e31a0a](https://github.com/Supergiovane/KNXUltimate/commit/5e31a0ad11f63fa3a8b34b98f6e37f2068b21d8a))
* refactor errors ([c8623e1](https://github.com/Supergiovane/KNXUltimate/commit/c8623e1b49e87404bb20cd626f399ebf18673529))
* securwe keyring ([3574fe0](https://github.com/Supergiovane/KNXUltimate/commit/3574fe0fedebb7f8e2de5c2dfbaf67d7a5f24a2d))
* transparent KNX queue. The sent telegrams are now queued and transmitted to the bus by obeying the time interval specified by the new property "KNXQueueSendIntervalMilliseconds" ([d4e8fd3](https://github.com/Supergiovane/KNXUltimate/commit/d4e8fd3e182e2db282e5bf151604d1777846f3be))
* Turn unknown error 0x25 to E_NO_MORE_UNIQUE_CONNECTIONS ([deabcfd](https://github.com/Supergiovane/KNXUltimate/commit/deabcfdfda802a116f3955e99403546a08ce81b1))
* typed event emitter ([ea29beb](https://github.com/Supergiovane/KNXUltimate/commit/ea29bebffaaf448f5928683167b1ea00992178d7))
* typescript refactor ([81d00af](https://github.com/Supergiovane/KNXUltimate/commit/81d00afe218314e33cbfd5fef059352f6a63dc13))
* zio cantante aggiungere qui la porca di quella merdassa perchè non committa vacca mincha merdosa ([f2fe52c](https://github.com/Supergiovane/KNXUltimate/commit/f2fe52c3b83442fc7f05318cfc8500f89c89c21f))


### BREAKING CHANGES

* deleted the echoLocalTelegramsInTunneling property. If you don't know what it is, it's not a breaking change for you.

* doc: updated docs.

* fix: fixed test fails

* fix: lint da figa!!

* chore: workaround test

* fix: caxxo

## [4.1.3](https://github.com/Supergiovane/KNXUltimate/compare/v4.1.2...v4.1.3) (2025-05-16)


### Bug Fixes

* disconnect request not sent properly in KNXClient.ts ([#55](https://github.com/Supergiovane/KNXUltimate/issues/55)) ([4253064](https://github.com/Supergiovane/KNXUltimate/commit/4253064ad4d96cb5898ec8dd16ac40b0ed94041a))

## [4.1.2](https://github.com/Supergiovane/KNXUltimate/compare/v4.1.1...v4.1.2) (2025-04-30)


### Features

* Preliminary support for knx virtual & ACK fix ([#53](https://github.com/Supergiovane/KNXUltimate/issues/53)) ([d2a340a](https://github.com/Supergiovane/KNXUltimate/commit/d2a340a91e7bd1524923421f67a7a69ea8dff025))

## [4.1.1](https://github.com/Supergiovane/KNXUltimate/compare/v4.1.0...v4.1.1) (2025-04-16)


### Bug Fixes

* make release-it adding a patch release instead of main release. ([#51](https://github.com/Supergiovane/KNXUltimate/issues/51)) ([211c0ef](https://github.com/Supergiovane/KNXUltimate/commit/211c0eff1cdcde23fed0a29abb2921b25b97ff7c))


### Features

* Ad DPT 14.1200 ([#50](https://github.com/Supergiovane/KNXUltimate/issues/50)) ([76eb6ed](https://github.com/Supergiovane/KNXUltimate/commit/76eb6edce953ca9c9f7b8b29fa227c58d5fa40d9))

# [4.1.0](https://github.com/Supergiovane/KNXUltimate/compare/v4.1.0-beta.10...v4.1.0) (2025-04-12)


### Bug Fixes

* removed unwanted "desc" prop from DatapointConfig root. ([#48](https://github.com/Supergiovane/KNXUltimate/issues/48)) ([a73166a](https://github.com/Supergiovane/KNXUltimate/commit/a73166abdbe8ff035e1ed55d2ebb8e59c5f04ebe))

# [4.1.0-beta.10](https://github.com/Supergiovane/KNXUltimate/compare/v4.1.0-beta.9...v4.1.0-beta.10) (2025-03-12)


### Bug Fixes

* index.ts of dtplib was whrowing an unmeaningful error. ([#47](https://github.com/Supergiovane/KNXUltimate/issues/47)) ([168d73a](https://github.com/Supergiovane/KNXUltimate/commit/168d73a106a1194ff707390ffbd17899eeb499fe))

# [4.1.0-beta.9](https://github.com/Supergiovane/KNXUltimate/compare/v4.1.0-beta.8...v4.1.0-beta.9) (2025-03-04)


### Features

* added src and destination addresses in the LDataInd LOG. ([#46](https://github.com/Supergiovane/KNXUltimate/issues/46)) ([1f5947d](https://github.com/Supergiovane/KNXUltimate/commit/1f5947dcd2ec61337cc6cfdbc10a0e04728d6722))

# [4.1.0-beta.8](https://github.com/Supergiovane/KNXUltimate/compare/v4.1.0-beta.7...v4.1.0-beta.8) (2025-01-28)


### Features

* added all subtypes to datapoint 20.x ([#45](https://github.com/Supergiovane/KNXUltimate/issues/45)) ([9051dbe](https://github.com/Supergiovane/KNXUltimate/commit/9051dbeadd7bc379dc2487454a2663ec007d91a4))

# [4.1.0-beta.7](https://github.com/Supergiovane/KNXUltimate/compare/v4.1.0-beta.4...v4.1.0-beta.7) (2024-12-30)


### Bug Fixes

* ipAddressHelper uncatched error when running on raspberry pi, having interfaces without any ip. ([#44](https://github.com/Supergiovane/KNXUltimate/issues/44)) ([a9e46ee](https://github.com/Supergiovane/KNXUltimate/commit/a9e46ee53c08f0d355acf454cb3515f523aee37a))

# [4.1.0-beta.4](https://github.com/Supergiovane/KNXUltimate/compare/v4.1.0-beta.3...v4.1.0-beta.4) (2024-12-07)

# [4.1.0-beta.3](https://github.com/Supergiovane/KNXUltimate/compare/v4.1.0-beta.2...v4.1.0-beta.3) (2024-12-07)

# [4.1.0-beta.2](https://github.com/Supergiovane/KNXUltimate/compare/v4.1.0-beta.1...v4.1.0-beta.2) (2024-12-06)

# [4.1.0-beta.1](https://github.com/Supergiovane/KNXUltimate/compare/v4.0.0-beta.6...v4.1.0-beta.1) (2024-11-21)


### Bug Fixes

* better checks of socket ready state ([#39](https://github.com/Supergiovane/KNXUltimate/issues/39)) ([92a2172](https://github.com/Supergiovane/KNXUltimate/commit/92a2172968e93ab75b22e76429f87e934b8d8979))
* fixed base beta release ([c9dfa79](https://github.com/Supergiovane/KNXUltimate/commit/c9dfa79d5d9abbe3d1bb023bfbab74a902a011c2))


### Features

* device info in "discover", added KNXClient.getGatewayDescription ([#40](https://github.com/Supergiovane/KNXUltimate/issues/40)) ([fede7fd](https://github.com/Supergiovane/KNXUltimate/commit/fede7fd81d86b817dca44e2aaf4489de17ead511)), closes [/github.com/Supergiovane/KNXUltimate/pull/40#discussion_r1850563396](https://github.com//github.com/Supergiovane/KNXUltimate/pull/40/issues/discussion_r1850563396)

# [4.0.0-beta.6](https://github.com/Supergiovane/KNXUltimate/compare/v4.0.0-beta.5...v4.0.0-beta.6) (2024-11-18)


### Bug Fixes

* clear the queueitem in case of errors ([393b818](https://github.com/Supergiovane/KNXUltimate/commit/393b818b9f33aac3771523e7c793d905eed4bdf6))
* exiting the queue loop after error ([0bb3c19](https://github.com/Supergiovane/KNXUltimate/commit/0bb3c193abcecba3554e6ff96b3f0e383c7e14cf))
* fixed an uncaught exception ([b48a5b1](https://github.com/Supergiovane/KNXUltimate/commit/b48a5b1665e4446bf89062f5fbc9ab5f1e4af61d))

# [4.0.0-beta.5](https://github.com/Supergiovane/KNXUltimate/compare/v4.0.0-beta.4...v4.0.0-beta.5) (2024-11-17)

# [4.0.0-beta.4](https://github.com/Supergiovane/KNXUltimate/compare/v4.0.0-beta.3...v4.0.0-beta.4) (2024-11-15)


### Bug Fixes

* fix multicast socket, by removing the local ip interface from the binding ([ca01449](https://github.com/Supergiovane/KNXUltimate/commit/ca01449873f94f6c5791d42fa5d4ff7967b42d5b))

# [4.0.0-beta.3](https://github.com/Supergiovane/KNXUltimate/compare/v4.0.0-beta.2...v4.0.0-beta.3) (2024-11-15)


### Bug Fixes

* fix missing "test" folder ([821e398](https://github.com/Supergiovane/KNXUltimate/commit/821e39820f936e3b568c05573565a0dc8be1cbb3))
* removed the "test" folder from the include array ([742a028](https://github.com/Supergiovane/KNXUltimate/commit/742a028fec4a122f7d049c766b819ba6fc5308bf))
* the tunnel socket creation function (createSocket), adding reusable option and specifying the port. This will likely prevent some UDP packets not arriving at the socket,  due to operating system routing restrictions. ([3fdd938](https://github.com/Supergiovane/KNXUltimate/commit/3fdd9383191bd3a842bf165448714784fc89a52b))


### Features

* added getGatewayDescription method, to gather infos of the connected gateway ([88b883a](https://github.com/Supergiovane/KNXUltimate/commit/88b883a5226cddbeea22864a2c848a249b7b6789))
* added the gatewaydescription.ts sample ([41b1f66](https://github.com/Supergiovane/KNXUltimate/commit/41b1f66679098f9c61fa162640ca83fdc887e585))
* added the KNX/IP Gateway description gatherer, wich contains the gateway's name, tunneling/routing modes etc.. ([f99170f](https://github.com/Supergiovane/KNXUltimate/commit/f99170ff63216ec0453a21aa51106c23dc622974))

# [4.0.0-beta.2](https://github.com/Supergiovane/KNXUltimate/compare/v4.0.0-beta.1...v4.0.0-beta.2) (2024-10-17)

# [4.0.0-beta.1](https://github.com/Supergiovane/KNXUltimate/compare/v4.0.0-beta.0...v4.0.0-beta.1) (2024-10-17)


### Bug Fixes

* [#30](https://github.com/Supergiovane/KNXUltimate/issues/30) short value 0x3f decoding ([#29](https://github.com/Supergiovane/KNXUltimate/issues/29)) ([d103ff2](https://github.com/Supergiovane/KNXUltimate/commit/d103ff2aec5c77fb5b0182b2859f7f6e0a0ef399))
* better rounding on dpt 9.001 ([#33](https://github.com/Supergiovane/KNXUltimate/issues/33)) ([4d706bd](https://github.com/Supergiovane/KNXUltimate/commit/4d706bdca939ce6498d6523cf7560e171c7a4469)), closes [#32](https://github.com/Supergiovane/KNXUltimate/issues/32)
* ensure _clearToSend is correctly set during discovery ([#34](https://github.com/Supergiovane/KNXUltimate/issues/34)) ([7640855](https://github.com/Supergiovane/KNXUltimate/commit/7640855e8ed663bc4cd8eeb1e79597680acb96db))

# [4.0.0-beta.0](https://github.com/Supergiovane/KNXUltimate/compare/v3.0.4...v4.0.0-beta.0) (2024-10-15)


### Bug Fixes

* limiter improvements ([#28](https://github.com/Supergiovane/KNXUltimate/issues/28)) ([e78a8c8](https://github.com/Supergiovane/KNXUltimate/commit/e78a8c844c79a5a959f1c05f9320b7d4bceec669))

## [3.0.4](https://github.com/Supergiovane/KNXUltimate/compare/v3.0.3...v3.0.4) (2024-10-08)

## [3.0.3](https://github.com/Supergiovane/KNXUltimate/compare/v3.0.2...v3.0.3) (2024-09-16)

## [3.0.2](https://github.com/Supergiovane/KNXUltimate/compare/v3.0.1...v3.0.2) (2024-09-16)


### Bug Fixes

* fixed queue ACK issue. Now, the replies from request coming from the KNX Gateway, are put as priority item in the kNX output queue. ([93ca4cc](https://github.com/Supergiovane/KNXUltimate/commit/93ca4ccdd4b49c832016ff4cf33e7a7c8ea35ba2))

## [3.0.1](https://github.com/Supergiovane/KNXUltimate/compare/v3.0.0...v3.0.1) (2024-09-16)


### Bug Fixes

* fixed an issue when "suppress ACK request" was set to true. ([83a5f5d](https://github.com/Supergiovane/KNXUltimate/commit/83a5f5dd77751d547976ab6a45c27e9701135b07))

# [3.0.0](https://github.com/Supergiovane/KNXUltimate/compare/v3.0.0-beta.1...v3.0.0) (2024-09-15)

# [3.0.0-beta.1](https://github.com/Supergiovane/KNXUltimate/compare/v3.0.0-beta.0...v3.0.0-beta.1) (2024-09-12)


### Bug Fixes

* Fixed import issue ([e232fc7](https://github.com/Supergiovane/KNXUltimate/commit/e232fc7d1262fe8605f86eb7fc8782a1efe61c47))

# [3.0.0-beta.0](https://github.com/Supergiovane/KNXUltimate/compare/v2.3.5...v3.0.0-beta.0) (2024-09-08)


### Features

* transparent KNX queue. The sent telegrams are now queued and transmitted to the bus by obeying the time interval specified by the new property "KNXQueueSendIntervalMilliseconds" ([93a65c9](https://github.com/Supergiovane/KNXUltimate/commit/93a65c97c426977b69b8c4f3044755229ad89b3a))

## [2.3.5](https://github.com/Supergiovane/KNXUltimate/compare/v2.3.4...v2.3.5) (2024-07-08)

## [2.3.4](https://github.com/Supergiovane/KNXUltimate/compare/v2.3.3...v2.3.4) (2024-07-08)


### Bug Fixes

* async closeSocket thtows an error if the socket is already closed. ([31baf39](https://github.com/Supergiovane/KNXUltimate/commit/31baf39ade13d6d329284342a7bc3a6c13cf4aa0))

## [2.3.3](https://github.com/Supergiovane/KNXUltimate/compare/v2.3.2...v2.3.3) (2024-06-14)


### Bug Fixes

* vscode default fomatter ([82ce441](https://github.com/Supergiovane/KNXUltimate/commit/82ce441955f714cc79b26ee85429333200b9cab3))

## [2.3.2](https://github.com/Supergiovane/KNXUltimate/compare/v2.3.1...v2.3.2) (2024-06-14)


### Bug Fixes

* fix DPT10.001 Time error when time passed as string ([23a27ab](https://github.com/Supergiovane/KNXUltimate/commit/23a27ab40176af11bdc047cb09c2fe31ae4b22fd))

## [2.3.1](https://github.com/Supergiovane/KNXUltimate/compare/v2.3.0...v2.3.1) (2024-06-13)


### Bug Fixes

* fixed DPT6002 not showing up ([593e548](https://github.com/Supergiovane/KNXUltimate/commit/593e548f74aebbb4c15cd48f98eb67aa93383391))

# [2.3.0](https://github.com/Supergiovane/KNXUltimate/compare/v2.2.0...v2.3.0) (2024-06-13)


### Bug Fixes

* fixed lint issues in new DPT 6002 ([529d392](https://github.com/Supergiovane/KNXUltimate/commit/529d3924f90189214d50b3be24e9a451c260010a))


### Features

* Add Hager TXA223/225 custom status DPT 60002 ([c61f576](https://github.com/Supergiovane/KNXUltimate/commit/c61f57647ea97b7201a9c01dae3c0e5a1ce3c23a))

# [2.2.0](https://github.com/Supergiovane/KNXUltimate/compare/v2.1.4...v2.2.0) (2024-06-12)


### Bug Fixes

* [#23](https://github.com/Supergiovane/KNXUltimate/issues/23) writeRaw broken with length <= 6bits ([#24](https://github.com/Supergiovane/KNXUltimate/issues/24)) ([1d30e81](https://github.com/Supergiovane/KNXUltimate/commit/1d30e8108b50877eb920aed8120c9c872d822545))


### Features

* Turn unknown error 0x25 to E_NO_MORE_UNIQUE_CONNECTIONS ([67f5dd8](https://github.com/Supergiovane/KNXUltimate/commit/67f5dd86e2688131c54c0a17cf5f2cbaf0bf9eb5))

## [2.1.4](https://github.com/Supergiovane/KNXUltimate/compare/v2.1.2...v2.1.4) (2024-05-30)



## [2.1.3](https://github.com/Supergiovane/KNXUltimate/compare/v2.1.2...v2.1.4) (2024-05-28)


### Bug Fixes

* issue where DPT9 was giving error ([#21](https://github.com/Supergiovane/KNXUltimate/issues/21)) ([2ac791e](https://github.com/Supergiovane/KNXUltimate/commit/2ac791e2a438ee37492f8109b5989ef6130244e5))

## [2.1.3](https://github.com/Supergiovane/KNXUltimate/compare/v2.1.2...2.1.3) (2024-05-28)

### Bug Fixes

* fix: issue where DPT9 was giving error by @maulik9898 in https://github.com/Supergiovane/KNXUltimate/pull/21

## New Contributors
* @maulik9898 made their first contribution in https://github.com/Supergiovane/KNXUltimate/pull/21


## [2.1.2](https://github.com/Supergiovane/KNXUltimate/compare/v2.1.1...v2.1.2) (2024-04-24)


### Bug Fixes

* refactor method names and added js docs ([#19](https://github.com/Supergiovane/KNXUltimate/issues/19)) ([432db89](https://github.com/Supergiovane/KNXUltimate/commit/432db89ac4a43be1a8037c4dbcd3cee8fe311e10))
* wrong overload of `discovery` method ([a41b65c](https://github.com/Supergiovane/KNXUltimate/commit/a41b65c537890177728708ec6d64282bab9df1ef))

## [2.1.1](https://github.com/Supergiovane/KNXUltimate/compare/v2.1.0...v2.1.1) (2024-04-23)


### Bug Fixes

* better timers management for race conditions and leak prevention ([#17](https://github.com/Supergiovane/KNXUltimate/issues/17)) ([494af28](https://github.com/Supergiovane/KNXUltimate/commit/494af282f06a9db475d4284bd4b0d6ca16a5845f))

# [2.1.0](https://github.com/Supergiovane/KNXUltimate/compare/v2.0.0-beta.0...v2.1.0) (2024-04-23)


### Features

* discovery ([#15](https://github.com/Supergiovane/KNXUltimate/issues/15)) ([f95836a](https://github.com/Supergiovane/KNXUltimate/commit/f95836ae6cb0e90922945810fd145781046feff2))

# 2.0.0-beta.0 (2024-04-18)


### Bug Fixes

* add build step to ci ([8bb668c](https://github.com/Supergiovane/KNXUltimate/commit/8bb668cedbd03e9779957621f9e2da3c7d48b1bb))
* add missing helps in dpts ([da61a86](https://github.com/Supergiovane/KNXUltimate/commit/da61a86afae91cc2c7231d36bd190fbfcb187b07))
* client close ([1996713](https://github.com/Supergiovane/KNXUltimate/commit/199671332760507ad746225233b1a08b2a51e0f2))
* examples ([9a2fcbc](https://github.com/Supergiovane/KNXUltimate/commit/9a2fcbced4d1931328ef7ee7a06010531e8653fe))
* export all packet types ([60043ee](https://github.com/Supergiovane/KNXUltimate/commit/60043eee9e1e64b35ffbb163e36a75f05bf908b9))
* export dptlib ([a13d6d8](https://github.com/Supergiovane/KNXUltimate/commit/a13d6d80114052cd5c133d65ad5415fd161b18cc))
* finish conversion of curve25519 ([8e972c1](https://github.com/Supergiovane/KNXUltimate/commit/8e972c17e7e3ed007d8d156531aa21a0709ed551))
* improve messages types ([f9a7006](https://github.com/Supergiovane/KNXUltimate/commit/f9a700614c11aba32a0178567ae67afef358ab81))
* improved disconnect logic ([3835601](https://github.com/Supergiovane/KNXUltimate/commit/38356012107daaec3498e56d74e800c9828df3d8))
* improved types of events ([dbc2812](https://github.com/Supergiovane/KNXUltimate/commit/dbc2812940a8dc1440894f2f8f52b7506524c700))
* logger and deprecated buffer `slice` to `subarray` ([5bcec07](https://github.com/Supergiovane/KNXUltimate/commit/5bcec07c69c1bbc86726437942945a78254aef61))
* remove many useless try catches ([4e50a81](https://github.com/Supergiovane/KNXUltimate/commit/4e50a811a6b833b311be88a482a80d65f2259d49))
* remove references to `KNXEthInterface` ([fcc366e](https://github.com/Supergiovane/KNXUltimate/commit/fcc366e7921ca0f76409f532ddc2641cfa02b892))
* socket end ([7af3c69](https://github.com/Supergiovane/KNXUltimate/commit/7af3c695e5e998192d139f3b987fd591fcd0e0bb))
* some other types ([b98f621](https://github.com/Supergiovane/KNXUltimate/commit/b98f62171c421df1285c3fbf3decfb73ba5dd424))
* some types ([b086a0e](https://github.com/Supergiovane/KNXUltimate/commit/b086a0e36c570dbeccdd0575666c39e7bb228d04))
* test connect/disconnect ([c2a6a18](https://github.com/Supergiovane/KNXUltimate/commit/c2a6a18fd02ea2332403531ef19eccdd54f55976))
* tlvinfo type ([fe0d52c](https://github.com/Supergiovane/KNXUltimate/commit/fe0d52c70a3e21346e42138d59e483fcc798e68f))
* typo ([e289d13](https://github.com/Supergiovane/KNXUltimate/commit/e289d1373ce7a9a349d39af1747f6e63f03d67d5))
* typo on knx client ([df4686e](https://github.com/Supergiovane/KNXUltimate/commit/df4686edeaee1f039f64bb895a71b3aae237a78f))
* use destroy for TCP socket close ([6440162](https://github.com/Supergiovane/KNXUltimate/commit/64401627e7f271334acaa0274c7d5b80623d6898))
* useless statics ([44bb692](https://github.com/Supergiovane/KNXUltimate/commit/44bb6926910bd43bf9e763ea388ffb8d5fefbca7))
* wrong address parsing ([40d8f98](https://github.com/Supergiovane/KNXUltimate/commit/40d8f9850e67db53b09c23de7ad54cbcd795bc34))


### Features

* client and other types ([8b030fa](https://github.com/Supergiovane/KNXUltimate/commit/8b030faf39300c8d016e98c3a00b47ee38d5188f))
* eslint + prettier ([0be8bbb](https://github.com/Supergiovane/KNXUltimate/commit/0be8bbb307f52bf7e1ecaf20dd8befe76c2cf96a))
* finish converting dptlib ([1b4b368](https://github.com/Supergiovane/KNXUltimate/commit/1b4b36814fc9b853d7fb7e40bbe7e941bdca28d2))
* going on ([0e5f8c9](https://github.com/Supergiovane/KNXUltimate/commit/0e5f8c9ba7f38c85d37782daba4c89b65224f424))
* going on with protcol ([becd54f](https://github.com/Supergiovane/KNXUltimate/commit/becd54fbf30a1c9df5c274c073749f3986c7f8e7))
* going on with refactor ([06278a3](https://github.com/Supergiovane/KNXUltimate/commit/06278a364fcb42b83ee148f2c5de779720bca2fd))
* protocol cemi conversion ([5b43f85](https://github.com/Supergiovane/KNXUltimate/commit/5b43f85379cc48da0945f1dd3cde6c7a0ce7de24))
* refactor errors ([5f12475](https://github.com/Supergiovane/KNXUltimate/commit/5f12475f80bd22daa5d31f1e561b50f7606b3eb1))
* securwe keyring ([0b1a250](https://github.com/Supergiovane/KNXUltimate/commit/0b1a250aa5ce46c18c6fcee3528b2069d3e06d5e))
* typed event emitter ([2360e63](https://github.com/Supergiovane/KNXUltimate/commit/2360e632dcadd58acb2aec4fd9785ceae8f7f761))
* typescript refactor ([ec8e26b](https://github.com/Supergiovane/KNXUltimate/commit/ec8e26b5601a0af96faac8e967ff95a96ed8e605))
## [Unreleased]

### Fixes

- TunnelUDP keeps using configured `physAddr` as source IA; the tunnel-assigned IA from `CONNECT_RESPONSE` is now applied only for TunnelTCP (secure). Improves compatibility and restores legacy behavior expected by tools/tests.

### Tests/CI

- Stabilized integration tests by avoiding real `os.networkInterfaces()` in CI and lowering log verbosity during tests.

### Docs

- Clarified IA behavior for TunnelUDP vs TunnelTCP in README, plus tips for UDP tunnelling (ACK suppression and `localIPAddress`).
