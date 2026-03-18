module.exports = async ({ github, context, core, process, migrations }) => {
  // Initialize variables
  const ghOrg = process.env.GH_ORG
  const migration = JSON.parse(process.env.MIGRATION)

  // Initialize API client
  const ghApi = new migrations.GHApi({ github })

  // Get GitLab namespace and repository from migration sourceRepoUrl
  const parsedUrl = new URL(migration.sourceRepoUrl)

  // Get the pathname (removes hostname and protocol)
  let path = parsedUrl.pathname

  // Remove leading slash and .git suffix
  path = path.replace(/^\//, '').replace(/\.git$/, '')

  // Split the pathname to get the last segment for the repository name
  // and the other segments for the namespace
  const pathSegments = path.split('/')
  const glServerUrl = parsedUrl.origin
  const glProject = pathSegments[pathSegments.length - 1]
  const glNamespace = pathSegments.slice(0, pathSegments.length - 1).join('/')

  // Set GitHub target organization and repository
  const targetGHOrg = ghOrg
  const targetGHOrgId = await ghApi.getOrganizationId({ orgSlug: ghOrg })
  const targetGHRepo = migration.ghRepoName

  // Set environment variables
  core.exportVariable('SOURCE_GL_SERVER_URL', glServerUrl)
  core.exportVariable('SOURCE_GL_NAMESPACE', glNamespace)
  core.exportVariable('SOURCE_GL_PROJECT', glProject)
  core.exportVariable('TARGET_GH_ORG', targetGHOrg)
  core.exportVariable('TARGET_GH_ORG_ID', targetGHOrgId)
  core.exportVariable('TARGET_GH_REPO', targetGHRepo)
}
