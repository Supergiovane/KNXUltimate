/* eslint-disable no-console */
/**
 * Removes "conflict copy" artifacts (typically created by sync tools like iCloud Drive)
 * from the build output folder before packaging.
 *
 * These files usually contain spaces in their names, e.g.:
 * - "dpt1 3.js"
 * - "index.js 2.map"
 * - "dpt1.d 2.ts"
 *
 * The published package should only contain deterministic build outputs.
 */

const fs = require('fs')
const path = require('path')

const BUILD_DIR = path.join(__dirname, '..', 'build')

function walk(dir) {
	const entries = fs.readdirSync(dir, { withFileTypes: true })
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			walk(fullPath)
			continue
		}
		if (entry.name.includes(' ')) {
			fs.rmSync(fullPath, { force: true })
		}
	}
}

function listFilesWithSpaces(dir) {
	const results = []
	const entries = fs.readdirSync(dir, { withFileTypes: true })
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			results.push(...listFilesWithSpaces(fullPath))
			continue
		}
		if (entry.name.includes(' ')) results.push(fullPath)
	}
	return results
}

if (!fs.existsSync(BUILD_DIR)) {
	process.exit(0)
}

walk(BUILD_DIR)

const remaining = listFilesWithSpaces(BUILD_DIR)
if (remaining.length > 0) {
	console.error('cleanupPackArtifacts: unable to delete all conflict artifacts:')
	for (const filePath of remaining) console.error(`- ${filePath}`)
	process.exit(1)
}

