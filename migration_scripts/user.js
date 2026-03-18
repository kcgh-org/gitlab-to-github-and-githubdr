class User {
  // Constructor
  constructor({
    ghUsername,
    sourceUsername = '',
    repoPermission = '',
    teamRole = '',
  }) {
    this.ghUsername = ghUsername
    this.sourceUsername = sourceUsername
    this.repoPermission = repoPermission
    this.teamRole = teamRole
  }

  // Getters
  get ghUsername() {
    return this._ghUsername
  }

  get sourceUsername() {
    return this._sourceUsername
  }

  get repoPermission() {
    return this._repoPermission
  }

  get teamRole() {
    return this._teamRole
  }

  // Setters
  set ghUsername(value) {
    if (!value || typeof value !== 'string') {
      throw new Error('ghUsername is required and must be a string')
    }
    this._ghUsername = value
  }

  set sourceUsername(value) {
    if (typeof value !== 'string') {
      throw new Error('sourceUsername must be a string')
    }
    this._sourceUsername = value
  }

  set repoPermission(value) {
    if (typeof value !== 'string') {
      throw new Error('repoPermission must be a string')
    }
    this._repoPermission = value
  }

  set teamRole(value) {
    if (typeof value !== 'string') {
      throw new Error('teamRole must be a string')
    }
    this._teamRole = value
  }

  // Public methods
  toJSON() {
    return {
      ghUsername: this._ghUsername,
      sourceUsername: this._sourceUsername,
      repoPermission: this._repoPermission,
      teamRole: this._teamRole,
    }
  }

  // Static public methods
  static fromJSON(jsonString) {
    // Parse the JSON string
    const data = JSON.parse(jsonString)

    // Create a new User instance
    return new User({
      ghUsername: data.ghUsername,
      sourceUsername: data.sourceUsername,
      repoPermission: data.repoPermission,
      teamRole: data.teamRole,
    })
  }
}

module.exports = { User }
