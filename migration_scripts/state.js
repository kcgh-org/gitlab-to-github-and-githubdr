const fs = require('fs').promises
const path = require('path')

class State {
  static async writeState(jsonString) {
    try {
      const data = JSON.parse(jsonString)
      if (!data.id) {
        throw new Error('JSON must contain an id field')
      }

      const filename = path.join(
        process.cwd(),
        '.github',
        'state',
        `${data.id}.json`
      )
      await fs.mkdir(path.dirname(filename), { recursive: true })
      await fs.writeFile(filename, jsonString, 'utf8')
      return filename
    } catch (error) {
      throw new Error(`Failed to write state: ${error.message}`)
    }
  }

  static async readState(id) {
    try {
      const filename = path.join(
        process.cwd(),
        '.github',
        'state',
        `${id}.json`
      )
      const data = await fs.readFile(filename, 'utf8')
      return data
    } catch (error) {
      throw new Error(`Failed to read state: ${error.message}`)
    }
  }
}

module.exports = { State }
