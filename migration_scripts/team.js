const { User } = require('./user.js')
const { Workflow } = require('./workflow.js')
const { Repository } = require('./repository.js')

/**
 * Represents a team with its members, repositories, and workflow information.
 */
class Team {
  // Private fields
  #name
  #idpGroup
  #slug
  #members
  #repositories
  #workflowRuns
  #workflow
  #stage
  #status

  /**
   * Creates a new Team instance
   * @param {Object} params - The team parameters
   * @param {string} params.name - Team name
   * @param {string} [params.idpGroup=''] - IDP group identifier
   * @param {string} [params.slug=''] - Team slug
   * @param {User[]} [params.members=[]] - Team members
   * @param {Repository[]} [params.repositories=[]] - Team repositories
   * @param {Workflow[]} [params.workflowRuns=[]] - Team workflow runs
   * @param {number} [params.workflow=0] - Current workflow
   * @param {string} [params.stage=''] - Current stage
   * @param {string} [params.status=''] - Current status
   */
  constructor({
    name,
    idpGroup = '',
    slug = '',
    members = [],
    repositories = [],
    workflowRuns = [],
    workflow = 0,
    stage = '',
    status = '',
  }) {
    // Validate all inputs upfront
    this.#validateConstructorInputs({
      name,
      idpGroup,
      slug,
      members,
      repositories,
      workflowRuns,
      workflow,
      stage,
      status,
    })

    // Initialize properties
    this.name = name
    this.idpGroup = idpGroup
    this.slug = slug
    this.members = members
    this.repositories = repositories
    this.workflowRuns = workflowRuns
    this.workflow = workflow
    this.stage = stage
    this.status = status
  }

  // Name property
  get name() {
    return this.#name
  }
  set name(value) {
    if (!value || typeof value !== 'string') {
      throw new Error('Team name is required and must be a string')
    }
    this.#name = value
  }

  // Slug property
  get slug() {
    return this.#slug
  }
  set slug(value) {
    if (typeof value !== 'string') {
      throw new Error('Team slug must be a string')
    }
    this.#slug = value
  }

  // IDP Group property
  get idpGroup() {
    return this.#idpGroup
  }
  set idpGroup(value) {
    if (typeof value !== 'string') {
      throw new Error('Team idpGroup must be a string')
    }
    this.#idpGroup = value
  }

  // Members property
  get members() {
    return this.#members
  }
  set members(value) {
    if (
      !Array.isArray(value) ||
      value.some((member) => !(member instanceof User))
    ) {
      throw new Error('Team members must be an array of User objects')
    }
    this.#members = value
    this.#members.push = (member) => {
      if (member instanceof User) {
        if (this.#isMemberUnique(member)) {
          Array.prototype.push.call(this.#members, member)
        } else {
          console.warn(
            `Team member, ${member.ghUsername}, already exists in the team, skipping`
          )
        }
      } else {
        throw new Error('Team member must be a User object')
      }
    }
  }

  // Repositories property
  get repositories() {
    return this.#repositories
  }
  set repositories(value) {
    if (
      !Array.isArray(value) ||
      value.some((repo) => !(repo instanceof Repository))
    ) {
      throw new Error('Team repositories must be an array of strings')
    }
    this.#repositories = value
    this.#repositories.push = (repo) => {
      if (repo instanceof Repository) {
        if (this.#isRepositoryUnique(repo)) {
          Array.prototype.push.call(this.#repositories, repo)
        } else {
          console.warn(
            `Team repository, ${repo.name}, already exists in the team, skipping`
          )
        }
      } else {
        throw new Error('Team repository must be a Repository object')
      }
    }
  }

  // Workflow runs property
  get workflowRuns() {
    return this.#workflowRuns
  }
  set workflowRuns(value) {
    if (!Array.isArray(value) || value.some((w) => !(w instanceof Workflow))) {
      throw new Error('Team workflowRuns must be an array of Workflow objects')
    }
    this.#workflowRuns = value
    this.#workflowRuns.push = (workflow) => {
      if (workflow instanceof Workflow) {
        Array.prototype.push.call(this.#workflowRuns, workflow)
      } else {
        throw new Error(
          'Team workflow must be an instance of the Workflow class'
        )
      }
    }
  }

  // Workflow property
  get workflow() {
    return this.#workflow
  }
  set workflow(value) {
    if (typeof value !== 'number') {
      throw new Error('Team workflow must be a number')
    }
    this.#workflow = value
  }

  // Stage property
  get stage() {
    return this.#stage
  }
  set stage(value) {
    if (typeof value !== 'string') {
      throw new Error('Team stage must be a string')
    }
    this.#stage = value
  }

  // Status property
  get status() {
    return this.#status
  }
  set status(value) {
    if (typeof value !== 'string') {
      throw new Error('Team status must be a string')
    }
    this.#status = value
  }

  /**
   * Validates member uniqueness by GitHub username
   * @private
   * @param {User} member - The member to validate
   * @returns {boolean} True if member is unique
   */
  #isMemberUnique(member) {
    return !this.#members.some((m) => m.ghUsername === member.ghUsername)
  }

  /**
   * Validates repository uniqueness by name
   * @private
   * @param {Repository} repository - The repository to validate
   * @returns {boolean} True if repository is unique
   */
  #isRepositoryUnique(repository) {
    return !this.#repositories.some((r) => r.name === repository.name)
  }

  /**
   * Validates constructor inputs
   * @private
   * @param {Object} params - The parameters to validate
   * @throws {Error} If any validation fails
   */
  #validateConstructorInputs(params) {
    if (!params.name || typeof params.name !== 'string') {
      throw new Error('Team name is required and must be a string')
    }
    if (typeof params.workflow !== 'number') {
      throw new Error('Team workflow must be a number')
    }
    // Add other validations...
  }

  /**
   * Creates a Team instance from a minimal set of required parameters
   * @param {string} name - Team name
   * @param {string} idpGroup - IDP group identifier
   * @returns {Team} A new Team instance
   */
  static create(name, idpGroup) {
    return new Team({ name, idpGroup })
  }

  toJSON() {
    return {
      name: this.#name,
      slug: this.#slug,
      idpGroup: this.#idpGroup,
      members: this.#members,
      repositories: this.#repositories,
      workflowRuns: this.#workflowRuns,
      workflow: this.#workflow,
      stage: this.#stage,
      status: this.#status,
    }
  }

  // Static public methods
  static fromJSON(jsonString) {
    // Parse the JSON string
    const data = JSON.parse(jsonString)

    // Convert plain objects to instances of User, Repository, and Workflow
    data.members = data.members.map((m) => new User(m))
    data.repositories = data.repositories.map((r) => new Repository(r))
    data.workflowRuns = data.workflowRuns.map((w) => new Workflow(w))

    // Return a new team instance
    return new Team(data)
  }
}

module.exports = { Team }
