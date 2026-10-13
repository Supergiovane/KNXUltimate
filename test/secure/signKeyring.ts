/**
 * Test helper: sign a keyring XML fixture the way ETS does.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import {
	computeKeyringSignature,
	hashKeyringPassword,
} from '../../src/secure/keyring'

export default async function signKeyringXml(
	xml: string,
	password: string,
): Promise<string> {
	const { computed } = await computeKeyringSignature(
		xml,
		hashKeyringPassword(password),
	)
	return xml.replace(
		'<Keyring ',
		`<Keyring Signature="${computed.toString('base64')}" `,
	)
}
