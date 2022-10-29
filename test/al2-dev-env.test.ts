import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as Al2DevEnv from '../lib/al2-dev-env-stack';
import { Config } from '../lib/config';

let config: Config = require('../lib/config.json');

// example test. To run these tests, uncomment this file along with the
// example resource in lib/al2-dev-env-stack.ts
test('Pipeline Stack Created', () => {
   const app = new cdk.App();
   const stack = new Al2DevEnv.Al2DevEnvStack(app, 'MyTestStack', config);
   const template = Template.fromStack(stack);

});
