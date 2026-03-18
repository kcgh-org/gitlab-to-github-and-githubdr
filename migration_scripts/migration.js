const { User } = require('./user.js')
const { Workflow } = require('./workflow.js')

/**
 * Represents a migration with its associated properties and validations
 */
class Migration {
  // Private fields
  #type
  #sourceRepoUrl
  #ghRepoName
  #ghRepoCollaborators
  #workflowRuns
  #workflow
  #stage
  #status
  #customProperties

  // Constructor
  constructor({
    type,
    sourceRepoUrl,
    ghRepoName,
    ghRepoCollaborators = [],
    workflowRuns = [],
    workflow = 0,
    stage = '',
    status = '',
    customProperties = [],
  }) {
    // Validate required parameters first
    if (!sourceRepoUrl || !ghRepoName) {
      throw new Error('sourceRepoUrl and ghRepoName are required')
    }

    // Initialize all properties using setters for validation
    this.type = type
    this.sourceRepoUrl = sourceRepoUrl
    this.ghRepoName = ghRepoName
    this.ghRepoCollaborators = ghRepoCollaborators
    this.workflowRuns = workflowRuns
    this.workflow = workflow
    this.stage = stage
    this.status = status
    this.customProperties = customProperties
  }

  // ===== Private Validation Methods =====

  #validateString(value, fieldName) {
    const processed = value ?? ''
    if (typeof processed !== 'string') {
      throw new Error(`${fieldName} must be a string`)
    }
    return processed
  }

  #validateUrl(value, fieldName) {
    try {
      new URL(value)
      return value
    } catch (e) {
      throw new Error(`Invalid ${fieldName}: ${value}`)
    }
  }

  // ===== Static Methods =====

  static #isValidRepoName(name) {
    return /^[a-zA-Z0-9_-]+$/.test(name)
  }

  static fromJSON(jsonString) {
    const data = JSON.parse(jsonString)
    data.workflowRuns = data.workflowRuns.map((w) => new Workflow(w))
    data.ghRepoCollaborators = data.ghRepoCollaborators.map((u) => new User(u))
    return new Migration(data)
  }

  // ===== Basic Property Accessors =====

  get type() {
    return this.#type
  }
  set type(value) {
    this.#type = this.#validateString(value, 'type')
  }

  get stage() {
    return this.#stage
  }
  set stage(value) {
    this.#stage = this.#validateString(value, 'stage')
  }

  get status() {
    return this.#status
  }
  set status(value) {
    this.#status = this.#validateString(value, 'status')
  }

  // ===== URL and Name Property Accessors =====

  get sourceRepoUrl() {
    return this.#sourceRepoUrl
  }
  set sourceRepoUrl(value) {
    this.#sourceRepoUrl = this.#validateUrl(value, 'sourceRepoUrl')
  }

  get ghRepoName() {
    return this.#ghRepoName
  }
  set ghRepoName(value) {
    if (!Migration.#isValidRepoName(value)) {
      throw new Error(`Invalid repository name format: ${value}`)
    }
    this.#ghRepoName = value
  }

  // ===== Numeric Property Accessors =====

  get workflow() {
    return this.#workflow
  }
  set workflow(value) {
    if (typeof value !== 'number') {
      throw new Error('Migration workflow is required and must be a number')
    }
    this.#workflow = value
  }

  // ===== Collection Property Accessors =====

  get ghRepoCollaborators() {
    return this.#ghRepoCollaborators
  }
  set ghRepoCollaborators(value) {
    if (!Array.isArray(value) || value.some((u) => !(u instanceof User))) {
      throw new Error(
        'Migration ghRepoCollaborators must be an array of User objects'
      )
    }
    this.#ghRepoCollaborators = value

    // Override the push method to ensure that only User objects are added
    // to the ghRepoCollaborators array and there are no duplicates based on
    // ghUsername
    this.#ghRepoCollaborators.push = (user) => {
      if (user instanceof User) {
        if (
          !this.#ghRepoCollaborators.some(
            (u) => u.ghUsername === user.ghUsername
          )
        ) {
          Array.prototype.push.call(this.#ghRepoCollaborators, user)
        } else {
          console.warn(
            `Migration ghRepoCollaborators user with the user name, ${user.ghUsername}, already exists in this migration, skipping...`
          )
        }
      } else {
        throw new Error(
          'Migration ghRepoCollaborators user must be an instance of the User class'
        )
      }
    }
  }

  get workflowRuns() {
    return this.#workflowRuns
  }
  set workflowRuns(value) {
    if (!Array.isArray(value) || value.some((w) => !(w instanceof Workflow))) {
      throw new Error(
        'Migration workflowRuns must be an array of Workflow objects'
      )
    }
    this.#workflowRuns = value

    // Override the push method to ensure that only Workflow objects are added
    this.#workflowRuns.push = (workflow) => {
      if (workflow instanceof Workflow) {
        Array.prototype.push.call(this.#workflowRuns, workflow)
      } else {
        throw new Error(
          'Migration workflowRuns must be an instance of the Workflow class'
        )
      }
    }
  }

  get customProperties() {
    return this.#customProperties
  }
  set customProperties(value) {
    if (!Array.isArray(value)) {
      throw new Error('customProperties must be an array')
    }

    if (
      value.some(
        (item) =>
          !item.key ||
          !item.value ||
          typeof item.key !== 'string' ||
          typeof item.value !== 'string'
      )
    ) {
      throw new Error(
        'customProperties must contain objects with string key and value properties'
      )
    }

    this.#customProperties = value
  }

  // ===== Collection Management Methods =====

  addCollaborator(user) {
    if (!(user instanceof User)) {
      throw new Error('Collaborator must be an instance of User')
    }

    // Use the custom push method which handles duplicates
    this.#ghRepoCollaborators.push(user)
    return true
  }

  addWorkflowRun(workflow) {
    if (!(workflow instanceof Workflow)) {
      throw new Error('Workflow must be an instance of Workflow')
    }

    this.#workflowRuns.push(workflow)
    return true
  }

  // ===== Serialization Methods =====

  toJSON() {
    return {
      type: this.#type,
      sourceRepoUrl: this.#sourceRepoUrl,
      ghRepoName: this.#ghRepoName,
      ghRepoCollaborators: this.#ghRepoCollaborators,
      workflowRuns: this.#workflowRuns,
      workflow: this.#workflow,
      stage: this.#stage,
      status: this.#status,
      customProperties: this.#customProperties,
    }
  }
}

module.exports = { Migration }
