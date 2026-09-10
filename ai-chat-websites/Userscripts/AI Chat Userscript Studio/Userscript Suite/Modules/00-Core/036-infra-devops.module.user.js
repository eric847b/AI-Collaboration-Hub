// ==UserScript==
// @name         Nexus Infrastructure & DevOps
// @namespace     nexus-suite
// @version       2026.09.27.1
// @description  Container orchestration, Kubernetes manifests, Helm charts, Terraform, Ansible, Puppet, Chef, SaltStack, CloudFormation, ARM, Bicep, Pulumi, CDK, Serverless, Architect, SST, architecture diagrams, infra mapping, service catalog, asset inventory (ROADMAP 321-340)
// @match         *://*/*
// @grant         GM_getValue
// @grant         GM_setValue
// ==/UserScript==

(() => {
  'use strict';
  const MODULE_NAME = 'infra-devops';
  const STORE_KEY = 'nexus_infra';
  const state = {
    mappings: {},
    catalog: { services: {} },
    assets: {},
    diagrams: {},
    deployments: {},
  };
  const PERSISTED_KEYS = Object.keys(state);
  function load() {
    try {
      const raw = GM_getValue(STORE_KEY, '{}');
      const parsed = JSON.parse(raw);
      for (const key of PERSISTED_KEYS) if (parsed[key] !== undefined) state[key] = parsed[key];
    } catch (e) { /* corrupt storage */ }
  }
  function persist() {
    try {
      const out = {};
      for (const key of PERSISTED_KEYS) out[key] = state[key];
      GM_setValue(STORE_KEY, JSON.stringify(out));
    } catch (e) { /* storage unavailable */ }
  }
  function uid() { return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
  function indent(lines, pad) { const p = '  '.repeat(pad || 0); return lines.map(l => p + l); }
  function yamlScalar(v) {
    if (typeof v === 'boolean') return String(v);
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return /^[A-Za-z0-9_\-.\/]+$/.test(v) ? v : JSON.stringify(v);
    return JSON.stringify(v);
  }
  load();

  // ---- 321-323: Containers & Kubernetes ----
  // 321. Container orchestration
  function dockerComposeBuild(spec) {
    const services = spec.services || [];
    const lines = ['version: "3.8"', 'services:'];
    for (const s of services) {
      lines.push('  ' + s.name + ':');
      lines.push('    image: ' + (s.image || 'example:' + s.name));
      if (s.build) lines.push('    build: ' + yamlScalar(s.build));
      if (s.ports && s.ports.length) lines.push('    ports:');
      for (const p of s.ports || []) lines.push('      - ' + (p.includes(':') ? p : yamlScalar(p)));
      if (s.environment) {
        lines.push('    environment:');
        for (const [k, v] of Object.entries(s.environment)) lines.push('      ' + k + ': ' + yamlScalar(v));
      }
      if (s.depends_on && s.depends_on.length) {
        lines.push('    depends_on:');
        for (const d of s.depends_on) lines.push('      - ' + d);
      }
      if (s.volumes && s.volumes.length) {
        lines.push('    volumes:');
        for (const v of s.volumes) lines.push('      - ' + yamlScalar(v));
      }
    }
    return { kind: 'docker-compose', format: 'yaml', content: lines.join('\n') };
  }
  function orchestrateDeploy(spec) {
    const plan = { steps: [], strategy: spec.strategy || 'rolling', rollout: spec.rollout || 20 };
    for (const svc of spec.services || []) {
      plan.steps.push({ service: svc.service, action: 'drain', ttl: spec.drainTtl || 30 });
      plan.steps.push({ service: svc.service, action: 'deploy' });
      plan.steps.push({ service: svc.service, action: 'smoke', probe: svc.probe || '/health' });
      plan.steps.push({ service: svc.service, action: 'promote', canary: svc.canary || false });
    }
    return plan;
  }
// 322. Kubernetes manifests
  function k8sManifest(spec) {
    const kind = spec.kind || 'Deployment';
    const name = spec.name || 'app';
    const lines = ['apiVersion: v1', 'kind: ' + kind, 'metadata:', '  name: ' + name];
    if (spec.labels) {
      lines.push('  labels:');
      for (const [k, v] of Object.entries(spec.labels)) lines.push('    ' + k + ': ' + yamlScalar(v));
    }
    if (kind === 'Deployment') {
      lines.push('spec:');
      lines.push('  replicas: ' + (spec.replicas || 1));
      lines.push('  selector:');
      lines.push('    matchLabels:');
      lines.push('      app: ' + name);
      lines.push('  template:');
      lines.push('    metadata:');
      lines.push('      labels:');
      lines.push('        app: ' + name);
      lines.push('    spec:');
      lines.push('      containers:');
      lines.push('        - name: ' + name);
      lines.push('          image: ' + (spec.image || 'registry/' + name + ':latest'));
      lines.push('          ports:');
      lines.push('            - containerPort: ' + (spec.containerPort || 80));
      if (spec.env) {
        lines.push('          env:');
        for (const [k, v] of Object.entries(spec.env)) lines.push('            - name: ' + k, '              value: ' + yamlScalar(v));
      }
      if (spec.secrets) {
        lines.push('          envFrom:');
        lines.push('            - secretRef:');
        lines.push('                name: ' + spec.secrets);
      }
    } else if (kind === 'Service') {
      lines.push('spec:');
      lines.push('  type: ClusterIP');
      lines.push('  ports:');
      lines.push('    - port: ' + (spec.port || 80));
      lines.push('      targetPort: ' + (spec.targetPort || spec.port || 80));
    } else {
      lines.push('spec:');
      for (const [k, v] of Object.entries(spec.spec || {})) lines.push('  ' + k + ': ' + yamlScalar(v));
    }
    return { kind, name, format: 'yaml', content: lines.join('\n') };
  }
  function k8sHelmValues(spec) {
    const lines = ['replicaCount: ' + (spec.replicas || 1)];
    lines.push('image:');
    lines.push('  repository: ' + (spec.repository || 'registry'));
    lines.push('  tag: ' + (spec.tag || 'latest'));
    if (spec.env) {
      lines.push('env:');
      for (const [k, v] of Object.entries(spec.env)) lines.push('  ' + k + ': ' + yamlScalar(v));
    }
    if (spec.ingress) {
      lines.push('ingress:');
      lines.push('  enabled: ' + String(spec.ingress.enabled !== false));
      lines.push('  host: ' + yamlScalar(spec.ingress.host || 'example.com'));
      lines.push('  tls: ' + String(spec.ingress.tls || true));
    }
    return { format: 'yaml', content: lines.join('\n') };
  }

  // 323. Helm charts
  function helmChartBuild(spec) {
    const files = { 'Chart.yaml': ['apiVersion: v2', 'name: ' + (spec.name || 'chart'), 'version: ' + (spec.version || '0.1.0'), 'description: ' + JSON.stringify(spec.description || ''), 'appVersion: ' + (spec.appVersion || '1.0.0')].join('\n') };
    files['values.yaml'] = k8sHelmValues(spec.values || {}).content;
    if (spec.templates) files['templates/deployment.yaml'] = k8sManifest(Object.assign({ kind: 'Deployment' }, spec.templates)).content;
    return { name: spec.name || 'chart', version: spec.version || '0.1.0', files };
  }
// ---- 324-328: Provisioning tools ----
  // 324. Terraform modules
  function terraformResource(spec) {
    const kind = spec.kind || 'resource';
    const name = spec.name || 'default';
    const lines = ['resource "' + kind + '" "' + name + '" {'];
    for (const [k, v] of Object.entries(spec.attrs || {})) {
      if (typeof v === 'object' && !Array.isArray(v)) {
        lines.push('  ' + k + ' = {');
        for (const [kk, vv] of Object.entries(v)) lines.push('    ' + kk + ' = ' + JSON.stringify(vv));
        lines.push('  }');
      } else if (Array.isArray(v)) {
        lines.push('  ' + k + ' = [' + v.map(x => JSON.stringify(x)).join(', ') + ']');
      } else {
        lines.push('  "' + k + '" = ' + JSON.stringify(v));
      }
    }
    lines.push('}');
    return { kind, name, format: 'hcl', content: lines.join('\n') };
  }
  function terraformFromSpec(spec) {
    const blocks = [];
    for (const r of spec.resources || []) blocks.push(terraformResource(r).content);
    const files = { 'main.tf': blocks.join('\n\n') + '\n' };
    if (spec.variables) {
      files['variables.tf'] = Object.keys(spec.variables).map(v => 'variable "' + v + '" {\n  type = ' + JSON.stringify(spec.variables[v]) + '\n}').join('\n\n') + '\n';
    }
    if (spec.outputs) {
      files['outputs.tf'] = Object.entries(spec.outputs).map(([k, v]) => 'output "' + k + '" {\n  value = ' + JSON.stringify(v) + '\n}').join('\n\n') + '\n';
    }
    return { format: 'hcl', files };
  }

  // 325. Ansible playbooks
  function ansiblePlaybook(spec) {
    const lines = ['---', '- name: ' + JSON.stringify(spec.name || 'deploy')];
    lines.push('  hosts: ' + (spec.hosts || 'all'));
    lines.push('  become: ' + String(spec.become || false));
    if (spec.tasks) {
      lines.push('  tasks:');
      for (const t of spec.tasks) {
        lines.push('    - name: ' + JSON.stringify(t.name || 'task'));
        if (t.module) {
          lines.push('      ' + t.module + ':');
          for (const [k, v] of Object.entries(t.module.pointer || {})) lines.push('        ' + k + ': ' + yamlScalar(v));
        }
        if (t.register) lines.push('      register: ' + t.register);
        if (t.when) lines.push('      when: ' + yamlScalar(t.when));
      }
    }
    return { name: spec.name || 'deploy', hosts: spec.hosts || 'all', format: 'yaml', content: lines.join('\n') };
  }

  // 326. Puppet modules
  function puppetModule(spec) {
    const lines = ['class ' + (spec.name || 'module') + ' {'];
    for (const p of spec.packages || []) {
      lines.push('  package { \'' + p.name + '\':');
      lines.push('    ensure => ' + (p.ensure || 'present') + ',');
      lines.push('  }');
    }
    for (const f of spec.files || []) {
      lines.push('  file { \'' + f.path + '\':');
      lines.push('    ensure => ' + (f.ensure || 'file') + ',');
      if (f.mode) lines.push('    mode => \'' + f.mode + '\',');
      if (f.owner) lines.push('    owner => \'' + f.owner + '\',');
      lines.push('  }');
    }
    for (const s of spec.services || []) {
      lines.push('  service { \'' + s.name + '\':');
      lines.push('    ensure => ' + (s.ensure || 'running') + ',');
      lines.push('    enable => ' + (s.enable === false ? 'false' : 'true') + ',');
      lines.push('  }');
    }
    lines.push('}');
    return { name: spec.name || 'module', format: 'pp', content: lines.join('\n') };
  }

  // 327. Chef recipes
  function chefRecipe(spec) {
    const lines = [];
    for (const p of spec.packages || []) {
      lines.push('package \'' + p.name + '\' do');
      lines.push('  action :' + (p.action || 'install'));
      lines.push('end');
    }
    for (const t of spec.templates || []) {
      lines.push('template \'' + t.path + '\' do');
      lines.push('  source \'' + (t.source || 'default.erb') + '\'');
      if (t.variables) lines.push('  variables ' + JSON.stringify(t.variables));
      lines.push('end');
    }
    for (const s of spec.services || []) {
      lines.push('service \'' + s.name + '\' do');
      lines.push('  action [:' + (s.action || 'start') + ']');
      lines.push('end');
    }
    return { name: spec.name || 'recipe', format: 'rb', content: lines.join('\n') };
  }

  // 328. SaltStack states
  function saltState(spec) {
    const lines = [];
    for (const pkg of spec.packages || []) {
      lines.push((spec.name || 'pkgs') + '_' + pkg.name + ':');
      lines.push('  pkg.installed:');
      lines.push('    - name: ' + pkg.name);
    }
    for (const f of spec.files || []) {
      lines.push((spec.name || 'files') + '_' + f.id + ':');
      lines.push('  file.managed:');
      lines.push('    - name: ' + f.path);
      lines.push('    - source: salt://' + (f.source || 'files/' + f.id + '.tmpl'));
    }
    for (const s of spec.services || []) {
      lines.push((spec.name || 'svcs') + '_' + s.name + ':');
      lines.push('  service.running:');
      lines.push('    - name: ' + s.name);
      lines.push('    - enable: ' + String(s.enable !== false));
    }
    return { name: spec.name || 'state', format: 'sls', content: lines.join('\n') };
  }
// ---- 329-333: Cloud IaC ----
  // 329. CloudFormation templates
  function cloudFormation(spec) {
    const resources = {};
    for (const r of spec.resources || []) {
      resources[r.id] = { Type: r.type || 'Custom::Resource', Properties: r.properties || {} };
    }
    const doc = { AWSTemplateFormatVersion: '2010-09-09', Description: spec.description || 'Deployment', Resources: resources };
    if (spec.parameters) doc.Parameters = spec.parameters;
    if (spec.outputs) doc.Outputs = spec.outputs;
    return { format: 'json', content: JSON.stringify(doc, null, 2) };
  }

  // 330. ARM templates
  function armTemplate(spec) {
    const doc = { $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#', contentVersion: '1.0.0.0', resources: [] };
    for (const r of spec.resources || []) {
      doc.resources.push({ type: r.type || 'Microsoft.Resources/deployments', apiVersion: r.apiVersion || '2020-10-01', name: r.name || 'res', properties: r.properties || {} });
    }
    if (spec.parameters) doc.parameters = spec.parameters;
    if (spec.outputs) doc.outputs = spec.outputs;
    return { format: 'json', content: JSON.stringify(doc, null, 2) };
  }

  // 331. Bicep files
  function bicepFile(spec) {
    const lines = [];
    for (const [name, def] of Object.entries(spec.parameters || {})) {
      lines.push('param ' + name + ' ' + (def.type || 'string') + (def.default !== undefined ? ' = ' + JSON.stringify(def.default) : ''));
    }
    for (const [name, val] of Object.entries(spec.variables || {})) lines.push('var ' + name + ' = ' + JSON.stringify(val));
    for (const r of spec.resources || []) {
      lines.push('resource ' + r.name + ' \'' + (r.type || 'Microsoft.Resources/deployments') + '@' + (r.apiVersion || '2020-10-01') + '\' {');
      if (r.name) lines.push('  name: ' + JSON.stringify(r.name));
      for (const [k, v] of Object.entries(r.properties || {})) lines.push('  ' + k + ': ' + JSON.stringify(v));
      lines.push('}');
    }
    for (const [name, expr] of Object.entries(spec.outputs || {})) lines.push('output ' + name + ' string = ' + JSON.stringify(expr));
    return { name: spec.name || 'main', format: 'bicep', content: lines.join('\n') };
  }

  // 332. Pulumi programs
  function pulumiProgram(spec) {
    const lines = [];
    for (const r of spec.resources || []) {
      lines.push('const ' + (r.name || 'instance') + ' = new ' + (r.type || 'aws.native.ec2.Instance') + '("' + (r.id || 'main') + '", {');
      for (const [k, v] of Object.entries(r.args || {})) lines.push('  ' + k + ': ' + JSON.stringify(v) + ',');
      lines.push('});');
    }
    for (const o of spec.exports || []) lines.push('export const ' + o.name + ' = ' + o.value + ';');
    return { name: spec.name || 'index', format: 'ts', content: lines.join('\n') };
  }

  // 333. CDK constructs
  function cdkConstruct(spec) {
    const lines = ['import * as cdk from "aws-cdk-lib";', 'import { ' + (spec.classes || ['aws_iam_Role']).join(', ') + ' } from "aws-cdk-lib/' + (spec.stackName || 'aws') + '";', '', 'export class ' + (spec.className || 'Stack') + ' extends cdk.Stack {', '  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {', '    super(scope, id, props);'];
    for (const r of spec.resources || []) {
      lines.push('    new ' + (r.type || 'AwsIamRole') + '(this, "' + (r.id || 'res') + '", {');
      for (const [k, v] of Object.entries(r.args || {})) lines.push('      ' + k + ': ' + JSON.stringify(v) + ',');
      lines.push('    });');
    }
    lines.push('  }', '}');
    return { name: spec.name || 'stack', format: 'ts', content: lines.join('\n') };
  }
// ---- 334-336: Serverless frameworks ----
  // 334. Serverless Framework
  function serverlessConfig(spec) {
    const lines = ['service: ' + (spec.service || 'app')];
    lines.push('provider:');
    lines.push('  name: ' + (spec.provider || 'aws'));
    lines.push('  runtime: ' + (spec.runtime || 'nodejs20.x'));
    if (spec.region) lines.push('  region: ' + spec.region);
    if (spec.stage) lines.push('  stage: ' + spec.stage);
    for (const [key, fn] of Object.entries(spec.functions || {})) {
      lines.push('functions:');
      break;
    }
    for (const [key, fn] of Object.entries(spec.functions || {})) {
      lines.push('  ' + key + ':');
      lines.push('    handler: ' + (fn.handler || key + '.handler'));
      if (fn.events) {
        lines.push('    events:');
        for (const e of fn.events) {
          if (e.http) lines.push('      - http:', '          path: ' + e.http.path, '          method: ' + e.http.method);
          if (e.schedule) lines.push('      - schedule:', '          rate: ' + e.schedule);
        }
      }
    }
    if (spec.resources && spec.resources.length) {
      lines.push('resources:');
      for (const r of spec.resources) lines.push('  Resources:' + r.name + ': { Type: ' + JSON.stringify(r.type) + ' }');
    }
    return { service: spec.service || 'app', format: 'yaml', content: lines.join('\n') };
  }

  // 335. Architect framework
  const _defaults = { depends: [] };
  function architectComponent(spec) {
    return {
      name: spec.name || 'component',
      type: spec.type || 'http',
      ports: spec.ports || [{ port: 3000 }],
      depends: spec.depends != null ? spec.depends : _defaults.depends,
      env: spec.env || {},
      deploy: spec.deploy || { strategy: 'rolling', replicas: 1 },
    };
  }
  function architectLink(spec) {
    return { from: spec.from, to: spec.to, via: spec.via || 'http', port: spec.port || 80 };
  }

  // 336. SST framework
  function sstProject(spec) {
    const lines = ['import { "console: true", "sst: true" } from "sst";', '', 'const bucket = new sst.Bucket("bucket");', 'const api = new sst.Api("api", { routes: {'];
    if (spec.routes) {
      for (const [route, handler] of Object.entries(spec.routes)) lines.push('  ' + JSON.stringify(route) + ': ' + handler + ',');
    }
    lines.push('} });', '', 'export function main() {', '  return { api: api.url, bucket: bucket.name };', '}');
    return { name: spec.name || 'main', format: 'ts', content: lines.join('\n') };
  }

  // ---- 337-340: Topology & inventory ----
  // 337. Architecture diagrams
  function architectureDiagram(spec) {
    const nodes = spec.nodes || [];
    const links = spec.links || [];
    const lines = [];
    for (const n of nodes) lines.push(n.id + '[' + n.label + ']');
    for (const l of links) lines.push(l.from + ' --> ' + l.to + ': ' + (l.label || ''));
    return { title: spec.title || 'architecture', mermaid: lines.join('\n'), nodes, links };
  }

  // 338. Infrastructure mapping
  function mapInfrastructure(spec) {
    const id = uid();
    state.mappings[id] = { id, name: spec.name || 'map', services: spec.services || [], storedAt: Date.now() };
    persist();
    return state.mappings[id];
  }
  function getMapping(id) { return state.mappings[id]; }
  function listMappings() { return Object.values(state.mappings); }

  // 339. Service catalog
  function registerService(svc) {
    const s = { id: uid(), name: svc.name, owner: svc.owner || 'unassigned', version: svc.version || '1.0.0', deps: svc.deps || [], healthUrl: svc.healthUrl || '', tier: svc.tier || 3, status: svc.status || 'active' };
    state.catalog.services[s.id] = s;
    persist();
    return s;
  }
  function getService(id) { return state.catalog.services[id]; }
  function listServices(owner) {
    let all = Object.values(state.catalog.services);
    if (owner) all = all.filter(s => s.owner === owner);
    return all;
  }
  function serviceDependents(id) {
    return Object.values(state.catalog.services).filter(s => s.deps.includes(id));
  }

  // 340. Asset inventory
  function registerAsset(asset) {
    const a = { id: uid(), name: asset.name, type: asset.type || 'unknown', env: asset.env || 'prod', region: asset.region || 'global', owner: asset.owner || 'unassigned', cost: asset.cost || 0, tags: asset.tags || [] };
    state.assets[a.id] = a;
    persist();
    return a;
  }
  function getAsset(id) { return state.assets[id]; }
  function listAssets(filter) {
    let all = Object.values(state.assets);
    if (filter) {
      if (filter.type) all = all.filter(a => a.type === filter.type);
      if (filter.env) all = all.filter(a => a.env === filter.env);
      if (filter.region) all = all.filter(a => a.region === filter.region);
    }
    return all;
  }
  function assetTotalCost(env) {
    return listAssets(env ? { env } : undefined).reduce((acc, a) => acc + (a.cost || 0), 0);
  }
const Infra = {
    // 321-323
    dockerComposeBuild, orchestrateDeploy, k8sManifest, k8sHelmValues, helmChartBuild,
    // 324-328
    terraformResource, terraformFromSpec, ansiblePlaybook, puppetModule, chefRecipe, saltState,
    // 329-333
    cloudFormation, armTemplate, bicepFile, pulumiProgram, cdkConstruct,
    // 334-336
    serverlessConfig, architectComponent, architectLink, sstProject,
    // 337-340
    architectureDiagram, mapInfrastructure, getMapping, listMappings,
    registerService, getService, listServices, serviceDependents,
    registerAsset, getAsset, listAssets, assetTotalCost,
  };

  const NEXUS = {
    Infra,
    version: '2.3.0',
    metadata: { name: MODULE_NAME, version: '2.3.0', dependencies: [] },
    init() { load(); persist(); return this; },
    get state() { return state; },
  };

  if (typeof window !== 'undefined') {
    window.__NEXUS_INFRA__ = NEXUS;
    if (window.__NEXUS_HUB__ && typeof window.__NEXUS_HUB__.register === 'function') {
      window.__NEXUS_HUB__.register('infra', NEXUS);
    }
  }
  if (typeof module !== 'undefined') module.exports = NEXUS;
  return NEXUS;
})();