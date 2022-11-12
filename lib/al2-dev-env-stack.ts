import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Config } from '../lib/config';
import {StageProps} from 'aws-cdk-lib';
import { aws_imagebuilder as imagebuilder, aws_ec2 as ec2, aws_iam as iam, aws_ecr } from 'aws-cdk-lib';
import * as fs from 'fs';
import {SubnetType, SecurityGroup} from 'aws-cdk-lib/aws-ec2';
import {ManagedPolicy} from 'aws-cdk-lib/aws-iam';


// Creates VPC Stack Class
//
export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id);
    this.vpc = new ec2.Vpc(this, config.generalName.concat("Vpc"), {
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      subnetConfiguration: [{
        name: config.generalName.concat("PrivateSubnet"),
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      },{
        name: config.generalName.concat("PublicSubnet"),
        subnetType: ec2.SubnetType.PUBLIC
      }]
    })
  }
}
// Creates Role Stack Class
//
export class RoleStack extends cdk.Stack {
  public readonly role: iam.Role;
  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id);
    this.role = new iam.Role(this, config.generalName.concat("ImagePipelineRole"), {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
    });
    aws_ecr.PublicGalleryAuthorizationToken.grantRead(this.role.grantPrincipal);
    this.role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("EC2InstanceProfileForImageBuilder"));
    this.role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("EC2InstanceProfileForImageBuilderECRContainerBuilds"));
    this.role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"));

  }
}

// Creates Security Group Stack Class
//
interface SecurityGroupStackProps {
  readonly vpc: ec2.Vpc;
}
export class SecurityGroupStack extends cdk.Stack {
  public readonly securityGroup: ec2.SecurityGroup;
  constructor(scope: Construct, id: string, config: Config, props: SecurityGroupStackProps) {
    super(scope, id);
    this.securityGroup = new SecurityGroup(this, config.generalName.concat("SecurityGroup"), {
      vpc: props.vpc,
    });
  }
}

// Takes info from previous stacks
interface ImagePipelineStackProps {
  readonly vpc: ec2.Vpc;
  readonly role: iam.Role;
  readonly securityGroup: ec2.SecurityGroup;
}
// Creates Role Stack Class
//
export class ImagePipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, config: Config, props: ImagePipelineStackProps) {
    super(scope, id);
    // Sets up Container Repository to put the images
    // This would setup a private repo
    //const ecRepo = new aws_ecr.Repository(this, config.generalName.concat("ElasticContainerRepository"), {
    //  imageScanOnPush: true,
    //})
    // This sets up a public repo
    const cfnPublicRepository = new aws_ecr.CfnPublicRepository(this, config.generalName.concat("PublicRepository"), {
      repositoryName: config.dashedName.concat("-public"),
    });
    const ecRepo = new aws_ecr.Repository(this, config.generalName.concat("PrivateRepository"), {
      repositoryName: config.dashedName,
    });
    // Reads AWSTOE doc from file
		const toolsComponentAwsToe = fs.readFileSync('tools/tools.yml', "utf-8")
    // Make sure that if you update this to update the version in the config
    const cfnComponent = new imagebuilder.CfnComponent(this, config.generalName.concat("ToolsComponent"), {
      name: config.generalName.concat("ToolsComponent"),
      platform: config.platform,
      version: config.toolsComponentVersion,
      data: toolsComponentAwsToe,
      description: config.generalDescription
    });
    // Make sure that if you update this to update the version in the config
    const cfnContainerRecipe = new imagebuilder.CfnContainerRecipe(this, config.generalName.concat("ContainerRecipe"), {
      components: [{
        componentArn: cfnComponent.attrArn,
      }],
      containerType: "DOCKER",
      description: config.generalDescription,
      name: config.dashedName,
      parentImage: config.parentImage,
      targetRepository: { repositoryName: ecRepo.repositoryName, service: "ECR" },
      version: config.containerRecipeVersion,
      dockerfileTemplateData: fs.readFileSync('tools/Dockerfile', "utf-8")
    });
    cfnContainerRecipe.node.addDependency(cfnComponent);
    cfnContainerRecipe.node.addDependency(ecRepo);
    // Profile used by the EC2 Instances that are building the images
    const cfnInstanceProfile = new iam.CfnInstanceProfile(this, config.generalName.concat("InstanceProfile"), {
      roles: [props.role.roleName],
      instanceProfileName: config.generalName.concat("InstanceProfile")
    });
    const cfnInfrastructureConfiguration = new imagebuilder.CfnInfrastructureConfiguration(this, config.generalName.concat("InfrastructureConfiguration"), {
      instanceProfileName: config.generalName.concat("InstanceProfile"),
      name: config.generalName.concat("InstanceProfile"),
      description: config.generalDescription,
      securityGroupIds: [props.securityGroup.securityGroupId],
      subnetId: props.vpc.privateSubnets[0].subnetId
    });
    cfnInfrastructureConfiguration.node.addDependency(cfnInstanceProfile);
    const cfnContainerDistribution : imagebuilder.CfnDistributionConfiguration.ContainerDistributionConfigurationProperty = {
        description: config.generalDescription,
        targetRepository: {
          repositoryName: ecRepo.repositoryName,
          service: 'ECR'
        }
      }
    cfnInfrastructureConfiguration.node.addDependency(ecRepo);
    const cfnDistributionConfiguration = new imagebuilder.CfnDistributionConfiguration(this, config.generalName.concat("DistributionConfiguration"), {
      distributions: [{
        region: config.region,
        containerDistributionConfiguration: cfnContainerDistribution
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
    const securityGroupStack = new SecurityGroupStack(this, config.generalName.concat("SecurityGroupStack"), config,{
      vpc: vpcStack.vpc
    });
    const imagePipelineStack = new ImagePipelineStack(this, config.generalName.concat("ImagePipelineStack"), config, {
      vpc: vpcStack.vpc,
      role: roleStack.role,
      securityGroup: securityGroupStack.securityGroup
    });
  }
}
export class Al2DevEnvStack extends cdk.Stack {
  constructor(scope: Construct, id: string, config: Config, props?: cdk.StackProps) { super(scope, id, props);
    
    const pipeline = new cdk.pipelines.CodePipeline(this, config.generalName.concat("CodePipeline"), {
      synth: new cdk.pipelines.ShellStep("Synth", {
        input: cdk.pipelines.CodePipelineSource.connection("Dean-Family/public-containers", "main", {
          connectionArn: config.connectionArn
        }),
        commands: [
          "npm ci",
          "npm run build",
          "npx cdk synth",
          "curl --proto '=https' --tlsv1.2 -sSf https://raw.githubusercontent.com/aws-cloudformation/cloudformation-guard/main/install-guard.sh | sh",
          "~/.guard/bin/cfn-guard validate --data cdk.out/ --rules ./rules"
        ]
      })
    })
    pipeline.addStage(new ImagePipelineStage(this, config.generalName.concat("ImagePipelineStage"), config));
  }
}
