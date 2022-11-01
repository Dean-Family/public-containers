import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as Al2DevEnv from '../lib/al2-dev-env-stack';
import { Config } from '../lib/config';
import * as fs from 'fs';

let config: Config = require('../lib/config.json');

// example test. To run these tests, uncomment this file along with the
// example resource in lib/al2-dev-env-stack.ts
test('Pipeline Stack Created', () => {
   const app = new cdk.App();
   const stack = new Al2DevEnv.Al2DevEnvStack(app, 'MyPipelineStack', config);
   const template = Template.fromStack(stack);

});
test('VPC Stack Has CidrBlock', () => {
   const app = new cdk.App();
   const stack = new Al2DevEnv.VpcStack(app, 'MyVPCStack', config);
   const template = Template.fromStack(stack);

   template.hasResourceProperties("AWS::EC2::VPC",{
     CidrBlock: "10.0.0.0/16",
   } )
});
test('Role Stack Exists', () => {
   const app = new cdk.App();
   const stack = new Al2DevEnv.RoleStack(app, 'MyRoleStack', config);
   const template = Template.fromStack(stack);

});
test('Image Pipeline Stack Created', () => {
   const app = new cdk.App();
   const vpcStack = new Al2DevEnv.VpcStack(app, 'MyVPCStack', config);
   const roleStack = new Al2DevEnv.RoleStack(app, 'MyRoleStack', config);
   const stack = new Al2DevEnv.ImagePipelineStack(app, 'MyImagePipelineStack', config, {
     vpc: vpcStack.vpc,
     role: roleStack.role
   });
   const template = Template.fromStack(stack);
	 const toolsComponentAwsToe = fs.readFileSync('tools/tools.yml', "utf-8")

   console.log(template.toJSON());

   template.hasResourceProperties("AWS::ECR::Repository",{
     ImageScanningConfiguration: { "ScanOnPush": true}
   })
   template.hasResourceProperties("AWS::ImageBuilder::Component", {
     Name: config.generalName.concat("ToolsComponent"),
     Platform: config.platform,
     Version: config.toolsComponentVersion,
     Data: toolsComponentAwsToe,
     Description: config.generalDescription
   })

});
