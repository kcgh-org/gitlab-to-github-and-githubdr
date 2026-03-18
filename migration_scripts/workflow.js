class Workflow {
  // Constructor
  constructor({
    name,
    runId,
    startDateTime,
    endDateTime = null,
    status = '',
    outputs = {},
    messages = [],
  }) {
    this.name = name
    this.runId = runId
    this.startDateTime = startDateTime
    this.endDateTime = endDateTime
    this.status = status
    this.outputs = outputs
    this.messages = messages
  }

  // Getters
  get name() {
    return this._name
  }

  get runId() {
    return this._runId
  }

  get startDateTime() {
    return this._startDateTime
  }

  get endDateTime() {
    return this._endDateTime
  }

  get status() {
    return this._status
  }

  get outputs() {
    return this._outputs
  }

  get messages() {
    return this._messages
  }

  // Setters
  set name(value) {
    if (!value || typeof value !== 'string') {
      throw new Error('Workflow name is required and must be a string')
    }
    this._name = value
  }

  set runId(value) {
    if (!value || typeof value !== 'number') {
      throw new Error('Workflow runId is required and must be a number')
    }
    this._runId = value
  }

  set startDateTime(value) {
    if (!value || isNaN(Date.parse(value))) {
      throw new Error(
        'Workflow startDateTime is required and must be a valid date'
      )
    }
    this._startDateTime = value
  }

  set endDateTime(value) {
    if (value !== null && isNaN(Date.parse(value))) {
      throw new Error('Workflow endDateTime must be a valid date or null')
    }
    this._endDateTime = value
  }

  set status(value) {
    if (value == null) {
      value = ''
    }

    if (typeof value !== 'string') {
      throw new Error('Workflow status must be a string')
    }
    this._status = value
  }

  set outputs(value) {
    if (typeof value !== 'object') {
      throw new Error('Workflow outputs must be an object')
    }
    this._outputs = value
  }

  set messages(value) {
    if (!Array.isArray(value)) {
      throw new Error('Workflow messages must be an array')
    }
    this._messages = value
  }

  // Public methods
  toJSON() {
    return {
      name: this._name,
      runId: this._runId,
      startDateTime: this._startDateTime,
      endDateTime: this._endDateTime,
      status: this._status,
      outputs: this._outputs,
      messages: this._messages,
    }
  }

  // Static public methods
  static fromJSON(jsonString) {
    // Parse the JSON string
    const parsedJson = JSON.parse(jsonString)

    // Return a new Workflow object
    return new Workflow(parsedJson)
  }
}

module.exports = { Workflow }
