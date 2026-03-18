#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <script.js>" >&2
  exit 1
fi

SCRIPT_PATH="$1"

RESULT=$(
  node - "$SCRIPT_PATH" <<'NODE'
import('@octokit/rest').then(({ Octokit }) => {
  import('@octokit/graphql').then(({ graphql }) => {
    const scriptPath = process.argv[2];

    const auth = process.env.GITHUB_TOKEN || process.env.GH_PAT;
    if (!auth) {
      console.error('GH_PAT (or GITHUB_TOKEN) is not set');
      process.exit(1);
    }

    const baseUrl = (process.env.GH_API_URL || '').trim().replace(/\/+$/, '');
    if (!baseUrl) {
      console.error('GH_API_URL is not set');
      process.exit(1);
    }

    let gqlUrl = (process.env.GH_GRAPHQL_URL || '').trim();
    if (!gqlUrl) gqlUrl = `${baseUrl}/graphql`;
    gqlUrl = gqlUrl.replace(/\/+$/, '');

    // Octokit REST for DR
    const github = new Octokit({ auth, baseUrl });

    // GraphQL for DR (note: property is "url", not "baseUrl")
    github.graphql = graphql.defaults({
      url: gqlUrl,
      headers: { authorization: `token ${auth}` }
    });

    const core = {
      exportVariable: (n, v) => { console.log(`export ${n}='${String(v).replace(/'/g, "'\\''")}'`); },
      info: (...args) => console.error(...args),
      error: (...args) => console.error(...args),
      setFailed: (m) => { console.error(m); process.exitCode = 1; },
      setOutput: (n, v) => { console.error(`export ${n}='${String(v).replace(/'/g, "'\\''")}'`); }
    };

    const migrations = require('./index.js');
    const script = require(scriptPath);

    Promise.resolve(
      script({ github, context: {}, core, process, migrations })
    ).catch((e) => {
      console.error('Migration failed!');
      console.error('Message:', e?.message);
      console.error('Status:', e?.status);
      console.error('Request:', e?.request);
      console.error('Response:', e?.response?.data);
      console.error('Stack:', e?.stack);
      if (process.env.CONTINUE_ON_ERROR === 'true') {
        console.error('⚠️ continueOnError enabled — not exiting.');
      } else {
        process.exit(1);
      }
    });
  });
});
NODE
)

echo "$RESULT"
