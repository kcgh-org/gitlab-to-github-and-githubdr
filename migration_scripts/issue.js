const { Batch } = require('./batch.js')

const ISSUE_TEMPLATE = `# {batchId} Migration Tracking Issue

This issue has been created to track the overall progress of the migration. It will be updated as the migration progresses.

## Migration Overview

Batch Id: {batchId}
Organization: {organization}
Dry Run: {dryrun}

<!-- REPO_TABLE_REPLACE -->

<!-- TEAM_TABLE_REPLACE -->

## Commands

| Command | Description |
| --- | --- |
| \`/sync\` | Update the issue with the latest resource stage/status, execute the next stage for each resource. |
| \`/reset-status <resource1>, <resource2>, ...\` | Reset the status for the current state of the resource. Repository example: \`/reset-status repo1, repo2\` Team example: \`/reset-status team1, team2, team3\` |
| \`/reset-stage <stage> <resource1>, <resource2>, ...\` | Reset the stage for the resource. Repository example: \`/reset-stage migrate-validate.yaml repo1, repo2\` Team example: \`/reset-stage team-create.yaml team1, team2, team3\` |`

/**
 * Formats tables for migration tracking issues
 */
class TableFormatter {
  /**
   * Creates a formatted markdown table
   * @param {string[]} headers - Table header columns
   * @param {string[]} rows - Table rows
   * @returns {string} Formatted table
   */
  createTable(headers, rows) {
    return [
      headers.join(' | '),
      headers.map(() => '---').join(' | '),
      ...rows,
    ].join('\n')
  }

  /**
   * Creates a workflow link or returns N/A
   * @param {string|number} workflow - Workflow ID
   * @param {string} serverUrl - Server URL
   * @returns {string} Formatted workflow link
   */
  createWorkflowLink(workflow, serverUrl) {
    return workflow && workflow !== 0
      ? `[${workflow}](${serverUrl}/actions/runs/${workflow})`
      : 'N/A'
  }

  /**
   * Creates a repository migration table
   * @param {Batch} batch - Batch data
   * @returns {string} Formatted table section
   */
  createRepoTable(batch) {
    const headers = [
      'Type',
      'Source Url',
      'GH Repo Name',
      'Workflow',
      'Stage',
      'Status',
    ]
    const rows = batch.migrations.map(
      (migration) =>
        `| ${migration.type} | ${migration.sourceRepoUrl} | ${
          migration.ghRepoName
        } | ${this.createWorkflowLink(migration.workflow, batch.serverUrl)} | ${
          migration.stage
        } | ${migration.status} |`
    )

    return this.#wrapSection(
      'Repositories',
      headers,
      rows,
      'TODO: Link to docs for repository migrations'
    )
  }

  /**
   * Creates a team migration table
   * @param {Batch} batch - Batch data
   * @returns {string} Formatted table section
   */
  createTeamTable(batch) {
    const headers = ['Name', 'Slug', 'IDP Group', 'Workflow', 'Stage', 'Status']
    const rows = batch.teams.map(
      (team) =>
        `| ${team.name} | ${team.slug} | ${
          team.idpGroup
        } | ${this.createWorkflowLink(team.workflow, batch.serverUrl)} | ${
          team.stage
        } | ${team.status} |`
    )

    return this.#wrapSection(
      'Teams',
      headers,
      rows,
      'TODO: Link to docs for team migrations'
    )
  }

  /**
   * Wraps a table section with title and description
   * @private
   */
  #wrapSection(title, headers, rows, description = '') {
    const parts = [`## ${title}`]
    if (description) parts.push(description)
    parts.push('', this.createTable(headers, rows))
    return parts.join('\n\n')
  }
}

/**
 * Manages issue template generation and replacement
 */
class TemplateManager {
  static REPLACEMENTS = [
    {
      key: 'REPO_TABLE_REPLACE',
      method: 'createRepoTable',
      dataKey: 'migrations',
    },
    { key: 'TEAM_TABLE_REPLACE', method: 'createTeamTable', dataKey: 'teams' },
  ]

  /**
   * Creates an issue template with placeholders
   * @param {Batch} batch - Batch data
   * @returns {string} Formatted template
   */
  static createIssueTemplate(batch) {
    return ISSUE_TEMPLATE.replace(/{batchId}/g, batch.id)
      .replace(/{organization}/g, batch.ghOrg)
      .replace(/{dryrun}/g, batch.dryrun ? 'Yes' : 'No')
  }
}

/**
 * Handles creation and formatting of migration tracking issues
 */
class Issue {
  /**
   * Creates the title and body for a migration tracking issue
   * @param {Object} params - The parameters
   * @param {Batch} params.batch - The batch object containing migration data
   * @returns {Promise<{title: string, body: string}>} The issue title and body
   * @throws {Error} If batch parameter is missing
   */
  static async createTitleBody({ batch }) {
    if (!batch) throw new Error('Batch parameter is required')

    const title = `[Batch Migration] ${batch.id}`
    const tableFormatter = new TableFormatter()
    let body = TemplateManager.createIssueTemplate(batch)

    for (const { key, method, dataKey } of TemplateManager.REPLACEMENTS) {
      if (batch[dataKey].length > 0) {
        body = body.replace(`<!-- ${key} -->`, tableFormatter[method](batch))
      }
    }

    return { title, body }
  }
}

module.exports = { Issue }
