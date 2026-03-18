/**
 * Starts a GitLab repository migration in GitHub
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
    const {
      TARGET_GH_ORG_ID: targetGHOrgId,
      MIGRATION: migration,
      PRESIGNED_URL: archiveUrl,
      MIGRATION_SOURCE_ID: sourceId,
      GH_PAT: ghPAT,
    } = process.env

    // Validate required environment variables
    if (!targetGHOrgId || !migration || !archiveUrl || !sourceId || !ghPAT) {
      throw new Error('Missing required environment variables')
    }

    const githubApi = new migrations.GHApi({ github })
    githubApi.ghPAT = ghPAT

    const repoMigration = JSON.parse(migration)

    const migrationId = await githubApi.startGLRepositoryMigration({
      sourceId: sourceId,
      organizationId: targetGHOrgId,
      repositoryName: repoMigration.ghRepoName,
      signedArchiveUrl: archiveUrl,
      glArchiveUrl: repoMigration.sourceRepoUrl.replace(/\.git$/, ''),
    })

    core.exportVariable('MIGRATION_ID', migrationId)
    core.info(`Migration started: ${migrationId}`)
  } catch (error) {
    core.setFailed(`Failed to start repository migration: ${error.message}`)
  }
}
