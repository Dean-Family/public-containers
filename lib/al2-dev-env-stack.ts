import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Config } from '../lib/config';
export class Al2DevEnvStack extends cdk.Stack {
  constructor(scope: Construct, id: string, config: Config, props?: cdk.StackProps) { super(scope, id, props);
    
    const repo = new cdk.aws_codecommit.Repository(this, config.generalName.concat("Repository"),{
      repositoryName: config.dashedName
    });
    const pipeline = new cdk.pipelines.CodePipeline(this, config.generalName.concat("CodePipeline"), {
      synth: new cdk.pipelines.ShellStep("Synth", {
        input: cdk.pipelines.CodePipelineSource.codeCommit(repo, "main"),
        commands: [
          "npm ci",
          "npm run build",
          "npm cdk synth"
        ]
      })
    })
  }
}
