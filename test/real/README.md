# Real KNX gateway tests

These tests are opt-in and are not part of `npm test` or `npm run test:all`.
They open a real connection and can optionally send a GroupValueWrite.

1. Copy `.env.knx-test.example` to `.env.knx-test`.
2. Fill the gateway and KNX Secure credentials.
3. Set `KNX_TEST_ENABLED=true`.
4. Run `npm run test:gateway`.

The local `.env.knx-test` file is ignored by Git. Never commit an ETS keyring
or its password.

By default the test only verifies the connection, assigned tunnel channel and
clean disconnection. To exercise a real Data Secure write, configure a safe
group address and set `KNX_TEST_WRITE_ENABLED=true`. For the long-frame
regression, use a Data Secure group address with `KNX_TEST_WRITE_DPT=19.001`
and a JSON string value such as:

```dotenv
KNX_TEST_WRITE_VALUE_JSON='"2026-07-31T12:30:00"'
```

Writing changes the real KNX installation. Enable it only for a group address
whose effect is understood and safe.
