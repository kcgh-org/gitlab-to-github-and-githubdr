# GitLab → GitHub Migration Pipeline

## 1. Overview
This repository contains a **GitLab CI/CD pipeline** that automates the migration of repositories from a **self-hosted GitLab Server** to **GitHub** using **GitLab migration archives** and **migration scripts**.

At a high level, the pipeline:
- Generates GitLab export (migration) archives
  (**Note:** GitHub object storage is used as a temporary staging location for migration archives (up to 30 GB supported).)
- Uploads those archives to GitHub storage
- Triggers GitHub repository migrations
- Preserves logs and artifacts for audit and troubleshooting

## 2. Requirements

### 2.1 GitLab Runner Host Requirements
- **OS:** Ubuntu
- **Docker:** latest stable
- **Node.js:** v20+
- **npm:** v10+
- **Docker image:** `gl-exporter`

### 2.2 Access Requirements
- **Password-less sudo** configured for the user running the **GitLab Runner** process
- **GitLab access** to:
  - View migration scripts stored in the project
  - Trigger the pipeline
  - Monitor the migration pipeline

### 2.3 Required Token Scopes

#### GitLab API Token
- Must be generated using an **admin user**
- Required permissions: **full API access**
- Used by `gl-exporter` during archive generation

#### GitHub Personal Access Token (PAT)
Required scopes:
- `repo`
- `admin:org`
- `workflow`
- `user`

### 2.4 Enable GitHub Object Storage Feature Flag
- GitHub object storage feature flag must be enabled both for GitHub handle and GitHub organizations. Raise a request with GitHub Support to enable this feature.

## 3. Repository Contents
    .
    ├── .gitlab-ci.yml
    ├── README.md
    ├── docs/
    │   ├── images/
    │   │   └── GitLab_to_GitHub_Migration_-_CI_Pipeline_Workflow.png
    │   └── diagrams/
    │       └── GitLab_to_GitHub_Migration_-_CI_Pipeline_Workflow.txt
    ├── config.sh
    ├── runner.sh
    ├── generate-gl-migration-archive.sh
    ├── upload-gl-migration-archive.sh
    ├── start-gl2gh-repo-migration.sh
    ├── gl-post-migration-validation.sh
    ├── gitlab-stats-sample.csv
    └── migration_scripts/
        ├── batch.js
        ├── create-env-vars.js
        ├── create-migration-source.js
        ├── gh-api.js
        ├── index.js
        ├── issue.js
        ├── migration.js
        ├── package.json
        ├── repository.js
        ├── start-repo-migration.js
        ├── state.js
        ├── team.js
        ├── upload-to-github-blob.sh
        ├── user.js
        └── workflow.js

## 4. Scripts and Purpose

### 4.1 Shell scripts
| Script | Purpose |
|------|---------|
| `config.sh` | Contains shared / generic variables used by multiple scripts. |
| `runner.sh` | Runner helper / wrapper script (used to execute the workflow in the runner environment). |
| `generate-gl-migration-archive.sh` | Generates GitLab migration archives (exports) for repositories defined in the inventory. |
| `upload-gl-migration-archive.sh` | Uploads the generated archives to GitHub storage (used later by migration jobs). |
| `start-gl2gh-repo-migration.sh` | Triggers repository migrations in GitHub. |
| `gl-post-migration-validation.sh` | Compares branch and commit counts between GitLab and GitHub to validate migration. This script is not part of the CI/CD pipeline and must be run manually after migration completes. |

### 4.2 Scripts in `migration_scripts/` directory
This directory contains JavaScript modules used to orchestrate GitHub migration operations.

| List of JS scripts |
|------|
| `batch.js` |
| `create-env-vars.js` |
| `create-migration-source.js` |
| `gh-api.js` |
| `index.js` |
| `issue.js` |
| `migration.js` |
| `repository.js` |
| `start-repo-migration.js` |
| `state.js` |
| `team.js` |
| `user.js` |
| `workflow.js` |
| `upload-to-github-blob.sh` |

## 5. Inventory File (Repository Mapping)
The inventory file defines the scope of GitLab repositories to be migrated and their target mappings in GitHub.

### 5.1 Generate inventory CSV
Before triggering the pipeline, generate an inventory file using the GitHub CLI extension `gitlab-stats`:

```bash
gh gitlab-stats --hostname "$SOURCE_GL_SERVER_URL" --token "$GITLAB_API_PRIVATE_TOKEN" --namespace <gitlab-group>
```

This produces a CSV inventory of repositories.

### 5.2 Edit inventory CSV
After generation, edit the CSV and add two columns:
- `github_org`
- `github_repo`

Fill in the target GitHub organization and repository name for each row.

#### Example Inventory CSV

| Namespace | Project | Is_Empty | isFork | isArchive | Project_Size(mb) | LFS_Size(mb) | Collaborator_Count | Protected_Branch_Count | MR_Review_Count | Milestone_Count | Issue_Count | MR_Count | MR_Review_Comment_Count | Commit_Count | Issue_Comment_Count | Release_Count | Branch_Count | Tag_Count | Has_Wiki | Full_URL | Created | Last_Push | Last_Update | github_org | github_repo |
| -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- |
| group-migration2gh/sub-group-migration2gh | demo-project-2 | false | false | false | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 0 | false | http://20.84.89.88/group-migration2gh/sub-group-migration2gh/demo-project-2 | 2025-12-18T14:21:09Z | 2025-12-19T11:20:27Z | 2025-12-19T11:20:27Z | kcghorg | demoproject2 |
| group-migration2gh/sub-group-migration2gh | demo-project-1 | false | false | false | 1 | 0 | 1 | 1 | 0 | 0 | 0 | 1 | 1 | 22 | 0 | 0 | 2 | 2 | false | http://20.84.89.88/group-migration2gh/sub-group-migration2gh/demo-project-1 | 2025-12-18T14:20:05Z | 2025-12-19T11:20:05Z | 2025-12-19T11:20:05Z | kcghorg | demoproject1 |

**Notes**
- Columns `github_org` and `github_repo` must be populated before running the pipeline.
- Upload the CSV to the GitLab project.
- This file name will be passed as the `INVENTORY_FILE` user input when running the pipeline.

### 5.3 Upload inventory to GitLab project
Upload the updated CSV into the GitLab project (so the pipeline can access it).

## 6. CI/CD Variable Setup (GitLab)
Configure CI/CD variables in:
**GitLab Project → Settings → CI/CD → Variables**

Add the following variables:

| Key | Example value | Description | Visibility |
|--------|-------------|--------|-------------|
| `SOURCE_GL_SERVER_URL` | `https://gitlab.company.com` | GitLab Server URL | Visible |
| `GITLAB_USERNAME` | `gitlab-user` | GitLab username | Visible |
| `GITLAB_API_PRIVATE_TOKEN` | `glpat-xxxxxxx` | GitLab API private token | Masked and hidden |
| `GH_PAT` | `ghp_xxxxx` | GitHub Personal Access Token | Masked and hidden |

## 7. Pipeline Flow
1. Validate CI/CD inputs, configuration, and prerequisites
2. Generate GitLab repository migration archives
3. Upload migration archives to GitHub-managed storage
4. Initiate GitHub repository migrations using uploaded archives
5. Display final migration summary (successes, failures, and migration IDs)
6. Preserve logs, reports, and outputs as pipeline artifacts

![GitLab Pipeline Flow](docs/images/GitLab_to_GitHub_Migration_-_CI_Pipeline_Workflow.png)

**Figure 1:** GitLab → GitHub migration pipeline showing validation, artifact staging, migration execution, and summary reporting.

### 7.1 Runner Tag Configuration
- This pipeline uses the GitLab Runner tag **`GLMigration`** to select the appropriate runner for execution.
- The runner tag **must be updated to match the GitLab Runner configured in your environment**.

#### Example
If your GitLab Runner is registered with the tag:
- `gitlab-runner-dev`

Then update the `tags:` section in `.gitlab-ci.yml` to match the runner tag for that environment.

```yaml
  tags: ["gitlab-runner-dev"]
```

### 7.2 Pipeline Trigger
The pipeline is **manually triggered** from GitLab Web UI and controlled using `workflow: rules`.

### 7.3 Executing the Pipeline
1. Open the GitLab project
2. Navigate to **Build → Pipelines**
3. Select **New Pipeline**
4. Provide the inventory filename as a variable:
   - Input: `INVENTORY_FILE`
   - Value: `<your-inventory-file>.csv`
5. Select **New Pipeline** to start

### 7.4 Artifacts and Retention
The pipeline uploads artifacts (retained for **7 days**) to support troubleshooting, including:
- Output files
- Migration logs

## 8. Monitoring Migration
- The pipeline outputs **GitHub migration IDs** for each repository
- Monitor migration progress using the GitHub CLI **migration-monitor** extension:

```bash
gh migration-monitor --organization $GH_ORG --github-token $GH_PAT
```

## 9. Post Migration Validation
- Run the below steps to perform migration validation

```bash
export INVENTORY_FILE="<your-inventory-file>.csv"
export GH_TOKEN="<github_pat>"
./gl-post-migration-validation.sh
```

- This script validates migration accuracy by comparing branch counts, commit counts, and repository metadata between GitLab and the corresponding GitHub repositories using the GitHub API.

## 10. User Identity Mapping (Mannequins)
- During migration, GitHub creates **mannequins** for users that cannot be automatically mapped.

### 10.1 Generate Mannequin CSV
- Generate a mannequin mapping file for the organization using command:

```bash
gh ado2gh generate-mannequin-csv --github-org "{github-org}"
```

### 10.2 Update Mannequin Mapping
- Open `mannequins.csv`
- Populate the **Target User** column with valid GitHub usernames


#### Mannequins User Mapping Example

The following table shows an example of a **Mannequins CSV** used for user identity mapping after migration.  
Each GitLab user (represented as a mannequin in GitHub) is mapped to the corresponding GitHub user.

| mannequin-user | mannequin-id      | target-user   |
|----------------|-------------------|---------------|
| gluser1        | M_kgDODtfbRA      | github-user1  |
| gluser2        | M_kgDODtfbRg      | github-user2  |

**Explanation:**
- During migration, unmapped GitLab users are imported into GitHub as **mannequins**.
- The `target-user` column is updated with the correct GitHub username.
- This mapping is later used to reclaim mannequins and correctly associate commits, issues, and comments with real GitHub users.

### 10.3 Reclaim Mannequins
- Reclaims mannequins by mapping them to the correct GitHub users. (Update the Mannequin CSV with Target User)

```bash
gh ado2gh reclaim-mannequin --github-org "{github-org}" --csv $CSV_FILE --skip-invitation
```

## Appendix

### Installing GitHub CLI extensions
- Login to GitHub using command:

```bash
gh auth login
```

- Install `gh-stats` GitHub CLI Extension:

```bash
gh extension install mona-actions/gh-gitlab-stats
```

- Install `gh-migration-monitor` GitHub CLI Extension:

```bash
gh extension install mona-actions/gh-migration-monitor
```

- Install `gh-ado2gh` GitHub CLI Extension:

```bash
gh extension install github/gh-ado2gh
```

### Build `gl-exporter` docker image
- Clone the 'gl-exporter' GitHub repository:
  `https://github.com/githubcustomers/msft-factory-gl-exporter/tree/master`
- Use the provided Dockerfile in the repository to build the `gl-exporter` Docker image.