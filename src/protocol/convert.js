const { readdir, readFile, writeFile, unlink } = require("fs/promises")
const { basename } = require("path")

async function main() {

    const files = await readdir('./')

    for (const file of files) {
        if (!file.endsWith('.js') || file.startsWith('convert')) {
            continue
        }

        await convertcEMI(file)
        process.exit(0)

    }
}

async function convertcEMI(file) {
    const fileName = file.replace('.js', '')

    const content = await readFile('./' + file, 'utf-8')

    let newContent = content
        .replace("'use strict'", '')
        .replace(/exports\.(\w+) = void 0/, '')
        .replace(/Object.defineProperty.*$/gm, '')
        .replace(/const ([^=]+) = require\(([^)]+)\)/g, 'import $1 from $2')
        .replace(/class (\w+) /g, 'export default class $1')
        .replace(/\/\/ # sourceMappingURL=.*$/g, '')


    await writeFile(`${fileName}.ts`, newContent)
    // await unlink(`./${file}`)
}

async function convertDpt(file) {
    const dptName = file.replace('.js', '')

    const content = await readFile('./' + file, 'utf-8')

    let newContent = content
        .replace(`const knxLog = require('./../KnxLog')`, `import Log from "../KnxLog";`)
        .replace(/exports\.(\w+) = /g, ",$1: ")
        .replace(/function \((\w+)\)/g, '($1) =>')
        .replace(/knxLog\.get\(\)/g, `Log.get()`)
        .replace(/([\w.]+)\.hasOwnProperty\(/g, 'hasProp($1, ')

    newContent = `import { DatapointConfig } from ".";\n\nconst config: DatapointConfig = {
            id: "${dptName.toUpperCase()}"` + newContent + `};


        export default config`

    await writeFile(`${dptName}.ts`, newContent)
    await unlink(`./${file}`)
}


main()