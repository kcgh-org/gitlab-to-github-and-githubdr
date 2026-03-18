class Repository {
  // Constructor
  constructor({ name, teamPermission = '' }) {
    this.name = name
    this.teamPermission = teamPermission
  }

  // Getters
  get name() {
    return this._name
  }

  get teamPermission() {
    return this._teamPermission
  }

  // Setters
  set name(value) {
    if (!value || typeof value !== 'string') {
      throw new Error('name is required and must be a string')
    }
    this._name = value
  }

  set teamPermission(value) {
    if (typeof value !== 'string') {
      throw new Error('teamPermission must be a string')
    }
    this._teamPermission = value
  }

  // Public methods
  toJSON() {
    return {
      name: this._name,
      teamPermission: this._teamPermission,
    }
  }

  // Static methods
  static fromJSON(jsonString) {
    // Parse the JSON string
    const data = JSON.parse(jsonString)

    // Create a new Repository instance
    return new Repository({
      name: data.name,
      teamPermission: data.teamPermission,
    })
  }
}

module.exports = { Repository }
