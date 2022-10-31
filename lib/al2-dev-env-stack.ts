import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Config } from '../lib/config';
export class Al2DevEnvStack extends cdk.Stack {
  constructor(scope: Construct, id: string, config: Config, props?: cdk.StackProps) { super(scope, id, props);
    
    const pipeline = new cdk.pipelines.CodePipeline(this, config.generalName.concat("CodePipeline"), {
      synth: new cdk.pipelines.ShellStep("Synth", {
        input: cdk.pipelines.CodePipelineSource.connection("Dean-Family/public-containers", "main", {
          connectionArn: "arn:aws:codestar-connections:us-west-2:822585835475:connection/67f85605-5637-4317-b154-c3b3edcf900b"
        }),
        commands: [
          "npm ci",
          "npm run build",
          "npx cdk synth"
        ]
      })
    })
  }
}
