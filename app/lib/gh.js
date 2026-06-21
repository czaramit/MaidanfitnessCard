/**
 * Maidan Play — GitHub Actions thin client
 * Dispatches the generate.yml workflow and polls run status.
 */
const fetch = require('node-fetch');

const GH_API = 'https://api.github.com';
const REPO = () => process.env.GH_REPO || '';
const TOKEN = () => process.env.GH_TOKEN || '';

function headers() {
  return {
    'Authorization': `token ${TOKEN()}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

function checkConfig() {
  if (!REPO() || !TOKEN()) throw new Error('GH_REPO and GH_TOKEN must be set');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Dispatch the generate.yml workflow, then retry until we find the run_id */
async function dispatchWorkflow(session_id, student_ids) {
  checkConfig();
  const url = `${GH_API}/repos/${REPO()}/actions/workflows/generate.yml/dispatches`;

  // Timestamp BEFORE dispatch so we can filter runs created after it
  const before = new Date();

  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        session_id: session_id,
        student_ids: student_ids
          ? (Array.isArray(student_ids) ? student_ids.join(',') : student_ids)
          : '',
      },
    }),
  });

  if (res.status !== 204) {
    const text = await res.text();
    throw new Error(`GitHub dispatch failed (${res.status}): ${text}`);
  }

  // Retry up to 8 times (max ~20 sec) waiting for the run to appear
  for (let attempt = 0; attempt < 8; attempt++) {
    await sleep(attempt === 0 ? 3000 : 2500); // wait 3s first, then 2.5s each retry

    const runsRes = await fetch(
      `${GH_API}/repos/${REPO()}/actions/runs?event=workflow_dispatch&per_page=10`,
      { headers: headers() }
    );
    const runsData = await runsRes.json();
    const runs = runsData.workflow_runs || [];

    // Find runs created after our dispatch timestamp
    const run = runs.find(r => new Date(r.created_at) >= before);

    if (run) {
      return {
        ok: true,
        dispatched: true,
        run_id: run.id,
        run_url: run.html_url,
      };
    }
    console.log(`gh.js: run not found yet (attempt ${attempt + 1}/8)`);
  }

  // Timed out finding the run — return without run_id so the client can link to Actions page
  return {
    ok: true,
    dispatched: true,
    run_id: null,
    run_url: `https://github.com/${REPO()}/actions`,
  };
}

/** Poll a workflow run for status + artifact */
async function getRunStatus(run_id) {
  checkConfig();
  const url = `${GH_API}/repos/${REPO()}/actions/runs/${run_id}`;
  const res = await fetch(url, { headers: headers() });
  const data = await res.json();

  const result = {
    ok: true,
    status: data.status,         // queued, in_progress, completed
    conclusion: data.conclusion, // success, failure, null
    run_url: data.html_url,
  };

  // If complete and successful, get artifact download URL
  if (data.status === 'completed' && data.conclusion === 'success') {
    const artRes = await fetch(
      `${GH_API}/repos/${REPO()}/actions/runs/${run_id}/artifacts`,
      { headers: headers() }
    );
    const artData = await artRes.json();
    if (artData.artifacts && artData.artifacts.length > 0) {
      result.artifact_url = artData.artifacts[0].archive_download_url;
      result.artifact_name = artData.artifacts[0].name;
    }
  }

  return result;
}

module.exports = { dispatchWorkflow, getRunStatus };
