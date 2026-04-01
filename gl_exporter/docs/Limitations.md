# Limitations
Every effort has been made to harden `gl-exporter` against a range of
discrepancies between GitLab and GitHub, but some are unfixable due to inherent
differences between GitHub's and GitLab's data models, or limitations in what
GitLab serializes or makes available through its API or Git operations. This is
intended to be a living document, which collects and explains shortfalls that,
for one reason or another, are unfortunately "one of those things."

## Infinite Commit Glitch
This issue manifests as migrated PRs on GitHub that render with "∞" for both the
number of commits and the number of changed files. Behind the scenes, this
indicates that GitHub could not find the object denoted by the PR's head SHA.

### Causes
#### Squash Merges
The most common reason why the head object can't be found is because the merge
request was squash-merged, and its associated branch was deleted. When an MR is
squash-merged, a new commit is created that collates all of the diffs between
the head branch and the target branch, which leaves the original commits
orphaned and garbage-collected when the repository is subsequently cloned.
GitLab gets around this by maintaining "keep-around refs," but does not make
these refs available to clone when we clone the repository, so they are lost in
the migration.

#### Forks
When an MR is opened against a fork of the repository, and then either
squash-merged or closed without merging, those commits similarly have no way of
making it into the original repository, and when we clone it down, we have no
way of tracking them down to their fork, so they are also lost during migration. 

### Fix
Unlike some other issues, this does not require a remigration to fix, but
unfortunately nor is there any "one size fits all" fix for it. Because the
migrated PR maintains a reference to the head SHA of the PR, as soon as that
object arrives on GitHub, the PR will render correctly. A general heuristic for
fixing this error is to find the missing object (either on GitLab or in a clone
of the repository), create a branch with that commit as its head, and
then push that branch to the GitHub repository.
