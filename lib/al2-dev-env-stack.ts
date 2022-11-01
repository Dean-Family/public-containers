import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Config } from '../lib/config';
import {StageProps} from 'aws-cdk-lib';
import { aws_imagebuilder as imagebuilder, aws_ec2 as ec2, aws_iam as iam, aws_ecr } from 'aws-cdk-lib';
import * as fs from 'fs';

export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id);
    this.vpc = new ec2.Vpc(this, config.generalName.concat("Vpc"), {
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16")
    })
  }
}
export class RoleStack extends cdk.Stack {
  public readonly role: iam.Role;
  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id);
    this.role = new iam.Role(this, config.generalName.concat("ImagePipelineRole"), {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com")
    });
  }
}

interface ImagePipelineStackProps {
  readonly vpc: ec2.Vpc;
  readonly role: iam.Role;
}
export class ImagePipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, config: Config, props: ImagePipelineStackProps) {
    super(scope, id);
    const ecRepo = new aws_ecr.Repository(this, config.generalName.concat("ElasticContainerRepository"))
		const toolsComponentAwsToe = fs.readFileSync('tools/tools.yml', "utf-8")
    const cfnComponent = new imagebuilder.CfnComponent(this, config.generalName.concat("ToolsComponent"), {
      name: config.generalName.concat("ToolsComponent"),
      platform: config.platform,
      version: config.toolsComponentVersion,
      data: toolsComponentAwsToe,
      description: config.generalDescription
    });
    const cfnContainerRecipe = new imagebuilder.CfnContainerRecipe(this, config.generalName.concat("ContainerRecipe"), {
      components: [{
        componentArn: cfnComponent.attrArn,
      }],
      containerType: "Docker",
      description: config.generalDescription,
      name: config.dashedName,
      parentImage: config.parentImage,
      targetRepository: { repositoryName: ecRepo.repositoryName },
      version: config.containerRecipeVersion
    });
    cfnContainerRecipe.node.addDependency(cfnComponent);
    cfnContainerRecipe.node.addDependency(ecRepo);
    const cfnInstanceProfile = new iam.CfnInstanceProfile(this, config.generalName.concat("InstanceProfile"), {
      roles: [props.role.roleName],
      instanceProfileName: config.generalName.concat("InstanceProfile")
    });
    const cfnInfrastructureConfiguration = new imagebuilder.CfnInfrastructureConfiguration(this, config.generalName.concat("InfrastructureConfiguration"), {
      instanceProfileName: config.generalName.concat("InstanceProfile"),
      name: config.generalName.concat("InstanceProfile"),
      description: config.generalDescription,
    });
    cfnInfrastructureConfiguration.node.addDependency(cfnInstanceProfile);
    const cfnDistributionConfiguration = new imagebuilder.CfnDistributionConfiguration(this, config.generalName.concat("DistributionConfiguration"), {
      distributions: [{
        region: config.region,
        containerDistributionConfiguration: {
          description: config.generalDescription,
          targetRepository: { repositoryName: ecRepo.repositoryName }
        }
      }],
      name: config.generalName.concat("DistributionConfiguration"),
      description: config.generalDescription,
    });
    cfnDistributionConfiguration.node.addDependency(ecRepo);
    const cfnImagePipeline = new imagebuilder.CfnImagePipeline(this, config.generalName.concat("ImagePipeline"), {
      infrastructureConfigurationArn: cfnInfrastructureConfiguration.attrArn,
      name: config.generalName.concat("ImagePipeline"),
      containerRecipeArn: cfnContainerRecipe.attrArn,
      description: config.generalDescription,
      distributionConfigurationArn: cfnDistributionConfiguration.attrArn,
    });
    cfnImagePipeline.node.addDependency(cfnInfrastructureConfiguration);
    cfnImagePipeline.node.addDependency(cfnContainerRecipe);
    cfnImagePipeline.node.addDependency(cfnDistributionConfiguration);
  }
}

export class ImagePipelineStage extends cdk.Stage {
  constructor(scope: Construct, id: string, config: Config, props?: StageProps) {
    super(scope, id, props);
    const vpcStack = new VpcStack(this, config.generalName.concat("VpcStack"), config);
    const roleStack = new RoleStack(this, config.generalName.concat("RoleStack"), config);
    const imagePipelineStack = new ImagePipelineStack(this, config.generalName.concat("ImagePipelineStack"), config, {
      vpc: vpcStack.vpc,
      role: roleStack.role
    });
  }
}
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
    pipeline.addStage(new ImagePipelineStage(this, "temp", config));
  }
}
