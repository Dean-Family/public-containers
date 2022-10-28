import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
export class Al2DevEnvStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    repo = new cdk.aws_codecommit.Repository(this, generalName.concat("Repository"),
      {
        repositoryName: dashedName
    })
    // const pipeline = new cdk.pipelines.CodePipeline(this, general_name.concat("CodePipeline"), {
    //   synth: new cdk.pipelines.ShellStep,
    // })

  }
}
