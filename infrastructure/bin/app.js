#!/usr/bin/env node
import { App, Aspects } from 'aws-cdk-lib'
import { AwsSolutionsChecks } from 'cdk-nag'
import { NetworkingStack } from '../lib/networking-stack.js'
import { ComputeStack } from '../lib/compute-stack.js'
import { PipelineStack } from '../lib/pipeline-stack.js'

const app = new App()
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
}
const appName = app.node.tryGetContext('appName')
const networking = new NetworkingStack(app, 'NetworkingStack', { env, appName })
const compute = new ComputeStack(app, 'ComputeStack', {
  env,
  appName,
  vpc: networking.vpc,
  applicationSecurityGroup: networking.applicationSecurityGroup,
  bastionSecurityGroup: networking.bastionSecurityGroup,
})
new PipelineStack(app, 'PipelineStack', {
  env,
  appName,
  cluster: compute.cluster,
  service: compute.service,
  repository: compute.repository,
  taskExecutionRole: compute.taskExecutionRole,
  taskRole: compute.taskRole,
})

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))
app.synth()
