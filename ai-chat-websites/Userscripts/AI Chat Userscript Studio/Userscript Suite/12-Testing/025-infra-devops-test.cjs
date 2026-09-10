'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MODULE_PATH = path.resolve(__dirname, '..', 'Modules', '00-Core', '036-infra-devops.module.user.js');
const source = fs.readFileSync(MODULE_PATH, 'utf8');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  PASS  ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + ': ' + e.message); }
}

const sandbox = {
  window: {},
  GM_setValue: (k, v) => { sandbox._store = sandbox._store || {}; sandbox._store[k] = v; },
  GM_getValue: (k, d) => { sandbox._store = sandbox._store || {}; return sandbox._store[k] !== undefined ? sandbox._store[k] : d; },
  Date, JSON, Math, Object, Array, String, Number, Boolean,
  console,
};
sandbox.window.__NEXUS_HUB__ = { register: () => {} };
const ctx = vm.createContext(sandbox);
vm.runInContext(source, ctx, { filename: '036-infra-devops.module.user.js' });
const m = sandbox.window.__NEXUS_INFRA__;
assert(m, 'module should export __NEXUS_INFRA__');

console.log('\n=== Module 036: Infrastructure & DevOps (321-340) ===\n');

// --- 321: Container orchestration ---
test('321 dockerComposeBuild basic', () => {
  const dc = m.Infra.dockerComposeBuild({ services: [{ name: 'web', image: 'nginx:1.25', ports: ['80:80'] }] });
  assert.strictEqual(dc.format, 'yaml');
  assert.ok(dc.content.includes('version: "3.8"'));
  assert.ok(dc.content.includes('  web:'));
  assert.ok(dc.content.includes('image: nginx:1.25'));
  assert.ok(dc.content.includes('- 80:80'));
});
test('321 dockerComposeBuild deps/env', () => {
  const dc = m.Infra.dockerComposeBuild({ services: [{ name: 'api', build: './api', environment: { PORT: 8080 }, depends_on: ['db'] }] });
  assert.ok(dc.content.includes('build: "./api"') || dc.content.includes('build: ./api'));
  assert.ok(dc.content.includes('PORT: 8080'));
  assert.ok(dc.content.includes('- db'));
});
test('321 orchestrateDeploy plan', () => {
  const plan = m.Infra.orchestrateDeploy({ strategy: 'canary', services: [{ service: 'api', canary: true }] });
  assert.strictEqual(plan.strategy, 'canary');
  assert.strictEqual(plan.steps.length, 4);
  assert.strictEqual(plan.steps[0].action, 'drain');
  assert.strictEqual(plan.steps[2].action, 'smoke');
});

// --- 322: Kubernetes manifests ---
test('322 k8sManifest Deployment', () => {
  const mf = m.Infra.k8sManifest({ kind: 'Deployment', name: 'web', image: 'reg/app:2.0', replicas: 3, env: { NODE_ENV: 'prod' }, containerPort: 3000 });
  assert.strictEqual(mf.kind, 'Deployment');
  assert.ok(mf.content.includes('kind: Deployment'));
  assert.ok(mf.content.includes('replicas: 3'));
  assert.ok(mf.content.includes('image: reg/app:2.0'));
  assert.ok(mf.content.includes('NODE_ENV'));
  assert.ok(mf.content.includes('containerPort: 3000'));
});
test('322 k8sManifest Service + secrets', () => {
  const mf = m.Infra.k8sManifest({ kind: 'Service', name: 'web', port: 80, targetPort: 3000 });
  assert.ok(mf.content.includes('kind: Service'));
  assert.ok(mf.content.includes('targetPort: 3000'));
  const dep = m.Infra.k8sManifest({ name: 'db', image: 'postgres:16', secrets: 'db-secrets' });
  assert.ok(dep.content.includes('secretRef'));
  assert.ok(dep.content.includes('db-secrets'));
});
test('322 k8sHelmValues', () => {
  const v = m.Infra.k8sHelmValues({ replicas: 2, repository: 'ghcr.io/x', env: { LOG: 'debug' } });
  assert.ok(v.content.includes('replicaCount: 2'));
  assert.ok(v.content.includes('ghcr.io/x'));
  assert.ok(v.content.includes('LOG: "debug"') || v.content.includes('LOG: debug'));
});

// --- 323: Helm charts ---
test('323 helmChartBuild files', () => {
  const chart = m.Infra.helmChartBuild({ name: 'myapp', version: '1.2.3', appVersion: '4.5.6', values: { replicas: 1 } });
  assert.ok(chart.files['Chart.yaml'].includes('name: myapp'));
  assert.ok(chart.files['Chart.yaml'].includes('version: 1.2.3'));
  assert.ok(chart.files['values.yaml'].includes('replicaCount: 1'));
});
// --- 324: Terraform ---
test('324 terraformResource HCL', () => {
  const tf = m.Infra.terraformResource({ kind: 'aws_s3_bucket', name: 'data', attrs: { bucket: 'my-bucket', force_destroy: false } });
  assert.strictEqual(tf.format, 'hcl');
  assert.ok(tf.content.includes('resource "aws_s3_bucket" "data" {'));
  assert.ok(tf.content.includes('"bucket" = "my-bucket"'));
  assert.ok(tf.content.includes('"force_destroy" = false'));
});
test('324 terraformFromSpec files', () => {
  const tf = m.Infra.terraformFromSpec({ resources: [{ kind: 'null_resource', name: 'provision' }], variables: { env: 'string' }, outputs: { id: 'resource1.id' } });
  assert.ok(tf.files['main.tf'].includes('null_resource'));
  assert.ok(tf.files['variables.tf'].includes('variable "env"'));
  assert.ok(tf.files['outputs.tf'].includes('output "id"'));
});

// --- 325: Ansible ---
test('325 ansiblePlaybook yaml', () => {
  const pb = m.Infra.ansiblePlaybook({ name: 'configure', hosts: 'web', become: true, tasks: [{ name: 'install nginx', module: { package: { pointer: { name: 'nginx', state: 'present' } } } }] });
  assert.strictEqual(pb.hosts, 'web');
  assert.ok(pb.content.includes('- name: "configure"'));
  assert.ok(pb.content.includes('hosts: web'));
  assert.ok(pb.content.includes('become: true'));
  assert.ok(pb.content.includes('install nginx'));
});
test('325 ansiblePlaybook empty tasks ok', () => {
  const pb = m.Infra.ansiblePlaybook({ name: 'ping', hosts: 'all' });
  assert.ok(pb.content.includes('hosts: all'));
});

// --- 326: Puppet ---
test('326 puppetModule pp', () => {
  const pp = m.Infra.puppetModule({ name: 'web', packages: [{ name: 'nginx' }, { name: 'curl', ensure: 'latest' }], files: [{ path: '/etc/nginx/conf', mode: '0644' }], services: [{ name: 'nginx', ensure: 'running' }] });
  assert.ok(pp.content.includes('class web {'));
  assert.ok(pp.content.includes("package { 'nginx':"));
  assert.ok(pp.content.includes("ensure => latest"));
  assert.ok(pp.content.includes("file { '/etc/nginx/conf':"));
  assert.ok(pp.content.includes("service { 'nginx':"));
});

// --- 327: Chef ---
test('327 chefRecipe rb', () => {
  const cr = m.Infra.chefRecipe({ packages: [{ name: 'build-essential' }], services: [{ name: 'nginx', action: 'enable' }] });
  assert.ok(cr.content.includes("package 'build-essential' do"));
  assert.ok(cr.content.includes('action :install'));
  assert.ok(cr.content.includes("service 'nginx' do"));
  assert.ok(cr.content.includes('action [:enable]'));
});

// --- 328: SaltStack ---
test('328 saltState sls', () => {
  const ss = m.Infra.saltState({ packages: [{ name: 'nginx' }], files: [{ id: 'conf', path: '/etc/nginx/nginx.conf', source: 'files/nginx.conf' }], services: [{ name: 'nginx' }] });
  assert.ok(ss.content.includes('nginx:'));
  assert.ok(ss.content.includes('pkg.installed:'));
  assert.ok(ss.content.includes('file.managed:'));
  assert.ok(ss.content.includes('service.running:'));
  assert.ok(ss.content.includes('salt://files/nginx.conf'));
});
// --- 329: CloudFormation ---
test('329 cloudFormation json', () => {
  const cf = m.Infra.cloudFormation({ description: 'Test stack', resources: [{ id: 'S3', type: 'AWS::S3::Bucket', properties: { BucketName: 'x' } }] });
  assert.strictEqual(cf.format, 'json');
  const doc = JSON.parse(cf.content);
  assert.strictEqual(doc.AWSTemplateFormatVersion, '2010-09-09');
  assert.ok(doc.Resources.S3);
  assert.strictEqual(doc.Resources.S3.Type, 'AWS::S3::Bucket');
});

// --- 330: ARM ---
test('330 armTemplate json', () => {
  const arm = m.Infra.armTemplate({ resources: [{ type: 'Microsoft.Storage/storageAccounts', name: 'acct', properties: {} }] });
  const doc = JSON.parse(arm.content);
  assert.ok(doc.$schema.includes('deploymentTemplate.json'));
  assert.strictEqual(doc.resources[0].name, 'acct');
});

// --- 331: Bicep ---
test('331 bicepFile', () => {
  const bp = m.Infra.bicepFile({ parameters: { env: { type: 'string', default: 'dev' } }, resources: [{ name: 'res', type: 'Microsoft.Resources/deployments', apiVersion: '2020-10-01', properties: {} }], outputs: { result: 'res.name' } });
  assert.ok(bp.content.includes('param env string = "dev"'));
  assert.ok(bp.content.includes('resource res'));
  assert.ok(bp.content.includes('output result string'));
});

// --- 332: Pulumi ---
test('332 pulumiProgram ts', () => {
  const pu = m.Infra.pulumiProgram({ resources: [{ name: 'db', type: 'aws.native.ec2.Instance', id: 'main', args: { instanceType: 't3.small' } }], exports: [{ name: 'instanceId', value: 'db.id' }] });
  assert.ok(pu.content.includes('new aws.native.ec2.Instance'));
  assert.ok(pu.content.includes('"t3.small"'));
  assert.ok(pu.content.includes('export const instanceId'));
});

// --- 333: CDK ---
test('333 cdkConstruct ts', () => {
  const cdk = m.Infra.cdkConstruct({ className: 'MyStack', resources: [{ type: 'AwsIamRole', id: 'role', args: { roleName: 'svc' } }] });
  assert.ok(cdk.content.includes('import * as cdk from "aws-cdk-lib";'));
  assert.ok(cdk.content.includes('export class MyStack extends cdk.Stack'));
  assert.ok(cdk.content.includes('AwsIamRole'));
});

// --- 334: Serverless ---
test('334 serverlessConfig yaml', () => {
  const sls = m.Infra.serverlessConfig({ service: 'orders', provider: 'aws', runtime: 'nodejs20.x', functions: { create: { handler: 'src/create.handler', events: [{ http: { path: 'orders', method: 'post' } }] } } });
  assert.ok(sls.content.includes('service: orders'));
  assert.ok(sls.content.includes('runtime: nodejs20.x'));
  assert.ok(sls.content.includes('handler: src/create.handler'));
  assert.ok(sls.content.includes('path: orders'));
  assert.ok(sls.content.includes('method: post'));
});
// --- 335: Architect ---
test('335 architectComponent defaults', () => {
  const c = m.Infra.architectComponent({ name: 'api' });
  assert.strictEqual(c.name, 'api');
  assert.strictEqual(c.type, 'http');
  assert.strictEqual(c.ports[0].port, 3000);
  assert.ok(Array.isArray(c.depends) && c.depends.length === 0, 'depends should be empty array');
});
test('335 architectLink', () => {
  const l = m.Infra.architectLink({ from: 'web', to: 'api', via: 'https', port: 443 });
  assert.strictEqual(l.from, 'web');
  assert.strictEqual(l.via, 'https');
  assert.strictEqual(l.port, 443);
});

// --- 336: SST ---
test('336 sstProject ts', () => {
  const sst = m.Infra.sstProject({ routes: { 'GET /': 'handler' } });
  assert.ok(sst.content.includes('new sst.Bucket("bucket")'));
  assert.ok(sst.content.includes('new sst.Api("api"'));
  assert.ok(sst.content.includes('"GET /": handler'));
});

// --- 337: Architecture diagrams ---
test('337 architectureDiagram mermaid', () => {
  const d = m.Infra.architectureDiagram({ title: 'system', nodes: [{ id: 'A', label: 'Client' }, { id: 'B', label: 'API' }], links: [{ from: 'A', to: 'B', label: 'https' }] });
  assert.ok(d.mermaid.includes('A[Client]'));
  assert.ok(d.mermaid.includes('A --> B: https'));
  assert.strictEqual(d.nodes.length, 2);
});

// --- 338: Infrastructure mapping ---
test('338 mapInfrastructure persist/list/get', () => {
  const map = m.Infra.mapInfrastructure({ name: 'prod-map', services: ['api', 'worker'] });
  assert.strictEqual(map.services.length, 2);
  assert.strictEqual(m.Infra.getMapping(map.id).name, 'prod-map');
  assert.ok(m.Infra.listMappings().some(x => x.id === map.id));
});

// --- 339: Service catalog ---
test('339 registerService/get/list', () => {
  const svc = m.Infra.registerService({ name: 'payments', owner: 'fin', deps: ['ledger'], tier: 1 });
  assert.strictEqual(m.Infra.getService(svc.id).owner, 'fin');
  assert.ok(m.Infra.listServices('fin').some(s => s.name === 'payments'));
  assert.strictEqual(m.Infra.listServices('other').length, 0);
});
test('339 serviceDependents', () => {
  const base = m.Infra.registerService({ name: 'base' });
  m.Infra.registerService({ name: 'consumer', deps: [base.id] });
  const deps = m.Infra.serviceDependents(base.id);
  assert.ok(deps.some(s => s.name === 'consumer'));
});

// --- 340: Asset inventory ---
test('340 registerAsset/list/filter', () => {
  m.Infra.registerAsset({ name: 'prod-bucket', type: 's3', env: 'prod', region: 'us-east-1', cost: 50 });
  m.Infra.registerAsset({ name: 'dev-bucket', type: 's3', env: 'dev', region: 'us-east-1', cost: 10 });
  const prod = m.Infra.listAssets({ env: 'prod' });
  assert.strictEqual(prod.length, 1);
  assert.ok(m.Infra.listAssets({ type: 's3' }).length >= 2);
});
test('340 assetTotalCost', () => {
  const p = m.Infra.assetTotalCost('prod');
  const all = m.Infra.assetTotalCost();
  assert.ok(p >= 50);
  assert.ok(all >= 60);
});

// --- Persistence ---
test('state persisted to GM storage', () => {
  assert.ok(sandbox._store['nexus_infra'], 'GM_setValue should store state');
  const parsed = JSON.parse(sandbox._store['nexus_infra']);
  assert.ok(parsed.catalog && parsed.catalog.services, 'stored state should have services');
  assert.ok(parsed.mappings, 'stored state should have mappings');
});

// --- Summary ---
console.log('\n--- Summary ---');
console.log('Passed: ' + passed + ' / ' + (passed + failed));
console.log('Failed: ' + failed);
if (failed > 0) { console.log('\nFAILED TESTS:\n  (see above)'); }
process.exitCode = failed > 0 ? 1 : 0;