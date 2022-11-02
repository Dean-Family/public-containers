#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Al2DevEnvStack } from '../lib/al2-dev-env-stack';
import { Config } from '../lib/config';

let config: Config = require('../lib/config.json');
const app = new cdk.App();
new Al2DevEnvStack(app, 'Al2DevEnvStack', config, {
  env: { account: config.account, region: config.region },
});
