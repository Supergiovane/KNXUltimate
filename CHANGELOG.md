

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
