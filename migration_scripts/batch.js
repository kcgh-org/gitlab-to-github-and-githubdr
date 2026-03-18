const { Migration } = require('./migration.js')
const { Team } = require('./team.js')
const { Repository } = require('./repository.js')
const { User } = require('./user.js')
const { Workflow } = require('./workflow.js')

/**
 * Represents a batch of migrations with associated teams and workflows.
 * @class
 */
class Batch {
  #id
  #ghOrg
  #serverUrl
  #issueNumber
  #migrations
  #teams
  #workflowRuns
  #status
  #dryrun

  /**
   * Creates a new Batch instance
   * @param {Object} config - The batch configuration
   * @param {string} config.id - Unique identifier for the batch
   * @param {string} config.ghOrg - GitHub organization name
   * @param {string} [config.serverUrl='https://github.com'] - GitHub server URL
   * @param {number} [config.issueNumber=0] - Associated issue number
   * @param {Migration[]} [config.migrations=[]] - List of migrations
   * @param {Team[]} [config.teams=[]] - List of teams
   * @param {Workflow[]} [config.workflowRuns=[]] - List of workflow runs
   * @param {string} [config.status='In Progress'] - Current status of the batch
   * @param {boolean} [config.dryrun=false] - Whether this is a dry run
   */
  constructor({
    id,
    ghOrg,
    serverUrl = process.env.GH_SERVER_URL,
    issueNumber = 0,
    migrations = [],
    teams = [],
    workflowRuns = [],
    status = 'In Progress',
    dryrun = false,
  }) {
    this.id = id
    this.ghOrg = ghOrg
    this.serverUrl = serverUrl
    this.issueNumber = issueNumber
    this.migrations = migrations
    this.teams = teams
    this.workflowRuns = workflowRuns
    this.status = status
    this.dryrun = dryrun
  }

  // Core Identity Properties
  get id() {
    return this.#id
  }

  set id(value) {
    if (!value?.trim() || typeof value !== 'string') {
      throw new Error('Batch id is required and must be a non-empty string')
    }
    this.#id = value
  }

  get ghOrg() {
    return this.#ghOrg
  }

  set ghOrg(value) {
    if (!value || typeof value !== 'string') {
      throw new Error('Batch ghOrg is required and must be a string')
    }
    this.#ghOrg = value
  }

  // Configuration Properties
  get serverUrl() {
    return this.#serverUrl
  }

  set serverUrl(value) {
    if (!value || typeof value !== 'string') {
      throw new Error('Batch serverUrl is required and must be a string')
    }
    this.#serverUrl = value
  }

  get issueNumber() {
    return this.#issueNumber
  }

  set issueNumber(value) {
    if (typeof value !== 'number') {
      throw new Error('Batch issueNumber must be a number')
    }
    this.#issueNumber = value
  }

  // Collection Properties
  get migrations() {
    return this.#migrations
  }

  set migrations(value) {
    if (!Array.isArray(value) || value.some((m) => !(m instanceof Migration))) {
      throw new Error('Batch migrations must be an array of Migration objects')
    }
    this.#migrations = value

    // Override push method for migrations array
    this.#migrations.push = (migration) => {
      if (migration instanceof Migration) {
        if (
          !this.#migrations.some((m) => m.ghRepoName === migration.ghRepoName)
        ) {
          Array.prototype.push.call(this.#migrations, migration)
        } else {
          console.warn(
            `Batch migration with the repository name, ${migration.ghRepoName}, already exists, skipping...`
          )
        }
      } else {
        throw new Error(
          'Batch migration must be an instance of the Migration class'
        )
      }
    }
  }

  get teams() {
    return this.#teams
  }

  set teams(value) {
    if (!Array.isArray(value) || value.some((t) => !(t instanceof Team))) {
      throw new Error('Batch teams must be an array of Team objects')
    }
    this.#teams = value

    // Override push method for teams array
    this.#teams.push = (team) => {
      if (team instanceof Team) {
        if (!this.#teams.some((t) => t.name === team.name)) {
          Array.prototype.push.call(this.#teams, team)
        } else {
          console.warn(
            `Batch team with the name, ${team.name}, already exists in this batch, skipping...`
          )
        }
      } else {
        throw new Error('Batch team must be an instance of the Team class')
      }
    }
  }

  get workflowRuns() {
    return this.#workflowRuns
  }

  set workflowRuns(value) {
    if (!Array.isArray(value) || value.some((w) => !(w instanceof Workflow))) {
      throw new Error('Batch workflowRuns must be an array of Workflow objects')
    }
    this.#workflowRuns = value

    // Override push method for workflowRuns array
    this.#workflowRuns.push = (workflow) => {
      if (workflow instanceof Workflow) {
        Array.prototype.push.call(this.#workflowRuns, workflow)
      } else {
        throw new Error(
          'Batch workflow must be an instance of the Workflow class'
        )
      }
    }
  }

  get status() {
    return this.#status
  }

  set status(value) {
    if (!value || typeof value !== 'string') {
      throw new Error('Batch status must be a non-empty string')
    }
    this.#status = value
  }

  get dryrun() {
    return this.#dryrun
  }

  set dryrun(value) {
    if (typeof value !== 'boolean') {
      throw new Error('Batch dryrun must be a boolean')
    }
    this.#dryrun = value
  }

  /**
   * Converts the batch instance to a JSON-serializable object
   * @returns {Object} Plain object representation of the batch
   */
  toJSON() {
    return {
      id: this.#id,
      issueNumber: this.#issueNumber,
      ghOrg: this.#ghOrg,
      serverUrl: this.#serverUrl,
      migrations: this.#migrations,
      teams: this.#teams,
      workflowRuns: this.#workflowRuns,
      status: this.#status,
      dryrun: this.#dryrun,
    }
  }

  /**
   * Creates a Batch instance from a JSON string
   * @param {string} jsonString - JSON string representation of a batch
   * @returns {Batch} New Batch instance
   * @throws {Error} If JSON is invalid or required properties are missing
   */
  static fromJSON(jsonString) {
    if (!jsonString) {
      throw new Error('JSON string is required')
    }

    let data
    try {
      data = JSON.parse(jsonString)
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error.message}`)
    }

    if (!data.id || !data.ghOrg) {
      throw new Error('Invalid batch data: missing required properties')
    }

    // Convert arrays with null check and proper instantiation
    data.migrations = (data.migrations || []).map((m) => {
      m.workflowRuns = (m.workflowRuns || []).map((w) => new Workflow(w))
      m.ghRepoCollaborators = (m.ghRepoCollaborators || []).map(
        (u) => new User(u)
      )
      return new Migration(m)
    })

    data.teams = (data.teams || []).map((t) => {
      t.members = (t.members || []).map((m) => new User(m))
      t.repositories = (t.repositories || []).map((r) => new Repository(r))
      t.workflowRuns = (t.workflowRuns || []).map((w) => new Workflow(w))
      return new Team(t)
    })

    data.workflowRuns = (data.workflowRuns || []).map((w) => new Workflow(w))
    data.status = data.status || 'In Progress'
    data.dryrun = data.dryrun || false

    return new Batch(data)
  }
}

module.exports = { Batch }
