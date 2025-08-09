import { ccmEncrypt, ccmDecrypt } from "../src/secure/ccm";

test("AES-CCM roundtrip works", () => {
  const key = Buffer.alloc(16, 0x11);
  const nonce = Buffer.alloc(12, 0x22);
  const aad = Buffer.from([0x01, 0x02, 0x03]);
  const plain = Buffer.from("hello knx secure");
  const { ciphertext, tag } = ccmEncrypt(key, nonce, aad, plain, 16);
  const dec = ccmDecrypt(key, nonce, aad, ciphertext, tag, 16);
  expect(dec.equals(plain)).toBe(true);
});
