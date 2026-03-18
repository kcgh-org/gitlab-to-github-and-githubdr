/**
 * Creates a GitLab migration source in GitHub
 * @param {Object} params - The parameters object
 * @param {Object} params.github - The GitHub API client
 * @param {Object} params.context - The GitHub Actions context
 * @param {Object} params.core - The GitHub Actions core
 * @param {Object} params.process - The Node.js process
 * @param {Object} params.migrations - The migrations module
 * @throws {Error} If required environment variables are missing
 */
module.exports = async ({ github, context, core, process, migrations }) => {
  try {
    // Validate required environment variables
    const requiredEnvVars = [
      'SOURCE_GL_SERVER_URL',
      'SOURCE_GL_NAMESPACE',
      'SOURCE_GL_PROJECT',
      'TARGET_GH_ORG_ID',
    ]
    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    )

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}`
      )
    }

    // Destructure environment variables
    const {
      SOURCE_GL_SERVER_URL: sourceGLServerUrl,
      SOURCE_GL_NAMESPACE: sourceGLNamespace,
      SOURCE_GL_PROJECT: sourceGLProject,
      TARGET_GH_ORG_ID: targetGHOrgId,
    } = process.env

    // Initialize API client
    const ghApi = new migrations.GHApi({ github })

    // Create the migration source
    const sourceName = `${sourceGLNamespace}-${sourceGLProject}`
    const migrationSourceId = await ghApi.createGLMigrationSource({
      ownerId: targetGHOrgId,
      name: sourceName,
      sourceServerUrl: sourceGLServerUrl,
    })

    // Export the migration source id
    core.exportVariable('MIGRATION_SOURCE_ID', migrationSourceId)
    core.info(`Migration source created: ${migrationSourceId}`)

    return migrationSourceId
  } catch (error) {
    core.setFailed('Failed to create migration source')
    core.error(`Error details: ${error.message}`)
  }
}
