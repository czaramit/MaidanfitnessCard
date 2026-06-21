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

/** Dispatch the generate.yml workflow */
async function dispatchWorkflow(session_id, student_ids) {
  checkConfig();
  const url = `${GH_API}/repos/${REPO()}/actions/workflows/generate.yml/dispatches`;

  // Record the time so we can find the run
  const dispatchedAt = new Date().toISOString();

  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        session_id: session_id,
        student_ids: student_ids ? (Array.isArray(student_ids) ? student_ids.join(',') : student_ids) : '',
      },
    }),
  });

  if (res.status !== 204) {
    const text = await res.text();
    throw new Error(`GitHub dispatch failed (${res.status}): ${text}`);
  }

  // Wait a moment then find the run
  await new Promise(r => setTimeout(r, 2000));
  const runsUrl = `${GH_API}/repos/${REPO()}/actions/runs?event=workflow_dispatch&created=>${dispatchedAt.slice(0,10)}&per_page=5`;
  const runsRes = await fetch(runsUrl, { headers: headers() });
  const runsData = await runsRes.json();

  const run = runsData.workflow_runs && runsData.workflow_runs[0];
  return {
    ok: true,
    dispatched: true,
    run_id: run ? run.id : null,
    run_url: run ? run.html_url : null,
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

  // If complete, get artifact download URL
  if (data.status === 'completed' && data.conclusion === 'success') {
    const artUrl = `${GH_API}/repos/${REPO()}/actions/runs/${run_id}/artifacts`;
    const artRes = await fetch(artUrl, { headers: headers() });
    const artData = await artRes.json();
    if (artData.artifacts && artData.artifacts.length > 0) {
      result.artifact_url = artData.artifacts[0].archive_download_url;
      result.artifact_name = artData.artifacts[0].name;
    }
  }

  return result;
}

module.exports = { dispatchWorkflow, getRunStatus };
