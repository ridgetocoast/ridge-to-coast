#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const API_BASE = 'https://api.cloudflare.com/client/v4';
const DEFAULT_ZONE_NAME = 'ridgetocoast.com';
const DEFAULT_PAGES_PROJECT = 'ridgetocoast';

function usage() {
  console.log(`Usage:
  CLOUDFLARE_API_TOKEN=... node scripts/audit-cloudflare-config.mjs [options]

Options:
  --zone-name <name>       Cloudflare zone name (default: ${DEFAULT_ZONE_NAME})
  --zone-id <id>           Cloudflare zone id (otherwise looked up by zone name)
  --account-id <id>        Cloudflare account id (otherwise read from env or wrangler.toml)
  --pages-project <name>   Cloudflare Pages project name (default: ${DEFAULT_PAGES_PROJECT})
  --json                   Print raw JSON report only

Environment:
  CLOUDFLARE_API_TOKEN     Required. Needs read access for Zone/DNS, Workers, and
                           Pages. In CI this resolves from the 'audit' GitHub
                           Environment to Terraform's audit-readonly token.
  CLOUDFLARE_ACCOUNT_ID    Optional override. Not a secret and not a GitHub
                           secret — the account id is read from wrangler.toml
                           by default (see infra/terraform/main.tf).
  CLOUDFLARE_ZONE_ID       Optional if --zone-id is not provided.
`);
}

function argValue(args, name) {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
}

function hasArg(args, name) {
  return args.includes(name);
}

function parseWranglerToml(text) {
  const accountId = text.match(/^account_id\s*=\s*"([^"]+)"/m)?.[1] || null;
  const workerName = text.match(/^name\s*=\s*"([^"]+)"/m)?.[1] || null;
  const routeMatches = [...text.matchAll(/pattern\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
  const envMatches = [...text.matchAll(/^\[env\.([^\]]+)\]/gm)].map((m) => m[1]);
  return { accountId, workerName, routePatterns: routeMatches, environments: envMatches };
}

async function loadExpected() {
  const wrangler = await readFile('wrangler.toml', 'utf8');
  return { wrangler: parseWranglerToml(wrangler) };
}

function cfHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function cfFetch(token, path, searchParams = null) {
  const url = new URL(API_BASE + path);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, { headers: cfHeaders(token) });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    const details = body?.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') || response.statusText;
    throw new Error(`${response.status} ${url.pathname}: ${details}`);
  }
  return body;
}

async function cfList(token, path, searchParams = {}) {
  const first = await cfFetch(token, path, { per_page: 100, page: 1, ...searchParams });
  const results = Array.isArray(first.result) ? [...first.result] : [];
  const totalPages = first.result_info?.total_pages || 1;

  for (let page = 2; page <= totalPages; page += 1) {
    const next = await cfFetch(token, path, { per_page: 100, page, ...searchParams });
    if (Array.isArray(next.result)) results.push(...next.result);
  }

  return results;
}

async function optional(label, task) {
  try {
    return { ok: true, value: await task() };
  } catch (error) {
    return { ok: false, error: `${label}: ${error.message}` };
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (hasArg(args, '--help') || hasArg(args, '-h')) {
    usage();
    return;
  }

  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    usage();
    process.exitCode = 2;
    console.error('Missing required CLOUDFLARE_API_TOKEN.');
    return;
  }

  const jsonOnly = hasArg(args, '--json');
  const expected = await loadExpected();
  const accountId = argValue(args, '--account-id') || process.env.CLOUDFLARE_ACCOUNT_ID || expected.wrangler.accountId;
  const zoneName = argValue(args, '--zone-name') || DEFAULT_ZONE_NAME;
  const pagesProject = argValue(args, '--pages-project') || DEFAULT_PAGES_PROJECT;
  let zoneId = argValue(args, '--zone-id') || process.env.CLOUDFLARE_ZONE_ID || null;

  if (!accountId) {
    throw new Error('Missing account id. Pass --account-id, set CLOUDFLARE_ACCOUNT_ID, or add account_id to wrangler.toml.');
  }

  const tokenStatus = await optional('token verify', () => cfFetch(token, '/user/tokens/verify'));

  let zone = null;
  if (zoneId) {
    zone = (await optional('zone get', () => cfFetch(token, `/zones/${zoneId}`))).value?.result || null;
  } else {
    const zones = await cfList(token, '/zones', { name: zoneName });
    zone = zones.find((z) => z.name === zoneName) || zones[0] || null;
    zoneId = zone?.id || null;
  }

  if (!zoneId) {
    throw new Error(`Could not resolve zone id for ${zoneName}. Pass --zone-id or set CLOUDFLARE_ZONE_ID.`);
  }

  const dnsRecords = await optional('dns records', () => cfList(token, `/zones/${zoneId}/dns_records`));
  const dnsSettings = await optional('dns settings', () => cfFetch(token, `/zones/${zoneId}/dns_settings`));
  const workerRoutes = await optional('worker routes', () => cfList(token, `/zones/${zoneId}/workers/routes`));
  const workerScripts = await optional('worker scripts', () => cfList(token, `/accounts/${accountId}/workers/scripts`));
  const pages = await optional('pages project', () => cfFetch(token, `/accounts/${accountId}/pages/projects/${pagesProject}`));
  const pagesDomains = await optional('pages domains', () => cfList(token, `/accounts/${accountId}/pages/projects/${pagesProject}/domains`));
  const pagesDeployments = await optional('pages deployments', () => cfList(token, `/accounts/${accountId}/pages/projects/${pagesProject}/deployments`, { per_page: 5 }));

  const scriptNames = new Set();
  for (const route of workerRoutes.value || []) {
    if (route.script) scriptNames.add(route.script);
  }
  if (expected.wrangler.workerName) scriptNames.add(expected.wrangler.workerName);
  for (const env of expected.wrangler.environments) scriptNames.add(`${expected.wrangler.workerName}-${env}`);

  const workers = {};
  for (const scriptName of [...scriptNames].filter(Boolean).sort()) {
    workers[scriptName] = {
      settings: await optional(`worker ${scriptName} settings`, () => cfFetch(token, `/accounts/${accountId}/workers/scripts/${scriptName}/script-settings`)),
      deployments: await optional(`worker ${scriptName} deployments`, () => cfList(token, `/accounts/${accountId}/workers/scripts/${scriptName}/deployments`, { per_page: 5 })),
    };
  }

  const expectedDnsNames = ['ridgetocoast.com', 'www.ridgetocoast.com', ...expected.wrangler.routePatterns.map((p) => p.replace(/\/\*$/, ''))];
  const matchingDns = (dnsRecords.value || [])
    .filter((record) => expectedDnsNames.includes(record.name))
    .map((record) => ({
      name: record.name,
      type: record.type,
      content: record.content,
      proxied: record.proxied,
      ttl: record.ttl,
    }));

  const matchingRoutes = (workerRoutes.value || [])
    .filter((route) => expected.wrangler.routePatterns.includes(route.pattern))
    .map((route) => ({ pattern: route.pattern, script: route.script, id: route.id }));

  const report = {
    checkedAt: new Date().toISOString(),
    expected,
    resolved: { accountId, zoneId, zoneName, pagesProject },
    token: tokenStatus.ok ? tokenStatus.value.result : tokenStatus,
    zone,
    dns: {
      settings: dnsSettings.ok ? dnsSettings.value.result : dnsSettings,
      recordsForExpectedHosts: matchingDns,
      recordCount: dnsRecords.value?.length ?? null,
      error: dnsRecords.ok ? null : dnsRecords.error,
    },
    workers: {
      routesForExpectedPatterns: matchingRoutes,
      allRouteCount: workerRoutes.value?.length ?? null,
      scripts: workers,
      scriptList: workerScripts.ok ? workerScripts.value.map((s) => ({ id: s.id, created_on: s.created_on, modified_on: s.modified_on })) : workerScripts,
    },
    pages: {
      project: pages.ok ? pages.value.result : pages,
      domains: pagesDomains.ok ? pagesDomains.value : pagesDomains,
      recentDeployments: pagesDeployments.ok ? pagesDeployments.value.slice(0, 5) : pagesDeployments,
    },
  };

  if (jsonOnly) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Cloudflare config audit for ${zoneName}`);
  console.log(`Account: ${accountId}`);
  console.log(`Zone: ${zoneId}`);
  console.log('');

  console.log('Expected Worker routes from wrangler.toml:');
  for (const pattern of expected.wrangler.routePatterns) console.log(`  - ${pattern}`);
  console.log('');

  console.log('Actual DNS records for expected hosts:');
  for (const record of matchingDns) {
    console.log(`  - ${record.name} ${record.type} ${record.content} proxied=${record.proxied} ttl=${record.ttl}`);
  }
  if (matchingDns.length === 0) console.log('  - none found');
  console.log('');

  console.log('Actual Worker routes for expected patterns:');
  for (const route of matchingRoutes) console.log(`  - ${route.pattern} -> ${route.script || '(none)'}`);
  if (matchingRoutes.length === 0) console.log('  - none found');
  console.log('');

  console.log('Worker scripts inspected:');
  for (const [scriptName, data] of Object.entries(workers)) {
    const deploymentCount = data.deployments.ok ? data.deployments.value.length : 'unavailable';
    const settingsStatus = data.settings.ok ? 'ok' : data.settings.error;
    console.log(`  - ${scriptName}: settings=${settingsStatus}; recentDeployments=${deploymentCount}`);
  }
  console.log('');

  console.log('Pages project:');
  if (pages.ok) {
    const project = pages.value.result;
    console.log(`  - ${project.name}: production_branch=${project.production_branch || '(unset)'} subdomain=${project.subdomain || '(unset)'}`);
  } else {
    console.log(`  - ${pages.error}`);
  }
  if (pagesDomains.ok) {
    for (const domain of pagesDomains.value) console.log(`  - domain ${domain.name}: status=${domain.status || '(unknown)'}`);
  }
  console.log('');
  console.log('Use --json for full API response details.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
