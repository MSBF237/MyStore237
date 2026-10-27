import {
  CfnParameter,
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  aws_codebuild as codebuild,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as actions,
  aws_iam as iam,
  aws_kms as kms,
  aws_s3 as s3,
} from 'aws-cdk-lib'
import { NagSuppressions } from 'cdk-nag'

export class PipelineStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)
    const connectionArn = new CfnParameter(this, 'GitHubConnectionArn', {
      type: 'String',
      description: 'ARN of an authorized CodeStar connection to GitHub.',
      allowedPattern: '^arn:[^:]+:codestar-connections:[^:]+:[0-9]{12}:connection/[a-f0-9-]+$',
    })
    const owner = new CfnParameter(this, 'GitHubOwner', {
      type: 'String',
      description: 'GitHub account or organization that owns the source repository.',
    })
    const repo = new CfnParameter(this, 'GitHubRepository', {
      type: 'String',
      description: 'GitHub source repository name.',
    })

    const sourceOutput = new codepipeline.Artifact('Source')
    const buildOutput = new codepipeline.Artifact('Build')
    const artifactAccessLogs = new s3.Bucket(this, 'ArtifactAccessLogs', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [{ expiration: Duration.days(90) }],
    })
    const artifactKey = new kms.Key(this, 'ArtifactEncryptionKey', {
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.RETAIN,
    })
    const artifactBucket = new s3.Bucket(this, 'ArtifactBucket', {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: artifactKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      serverAccessLogsBucket: artifactAccessLogs,
      serverAccessLogsPrefix: 'pipeline-artifacts/',
      removalPolicy: RemovalPolicy.RETAIN,
    })
    NagSuppressions.addResourceSuppressions(artifactAccessLogs, [{
      id: 'AwsSolutions-S1',
      reason: 'This dedicated access-log bucket is the terminal sink for artifact-bucket access logs; logging it to itself would recurse.',
    }])
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: `${props.appName}-main`,
      pipelineType: codepipeline.PipelineType.V2,
      executionMode: codepipeline.ExecutionMode.QUEUED,
      restartExecutionOnUpdate: true,
      artifactBucket,
    })
    pipeline.addStage({
      stageName: 'Source',
      actions: [new actions.CodeStarConnectionsSourceAction({
        actionName: 'GitHubMain',
        owner: owner.valueAsString,
        repo: repo.valueAsString,
        branch: 'main',
        connectionArn: connectionArn.valueAsString,
        output: sourceOutput,
        triggerOnPush: true,
      })],
    })

    const build = new codebuild.PipelineProject(this, 'BuildAndTest', {
      projectName: `${props.appName}-build`,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
        privileged: true,
        environmentVariables: {
          REPOSITORY_URI: { value: props.repository.repositoryUri },
          CONTAINER_NAME: { value: 'NuxtAdmin' },
          TASK_EXECUTION_ROLE_ARN: { value: props.taskExecutionRole.roleArn },
          TASK_ROLE_ARN: { value: props.taskRole.roleArn },
          DB_HOST: { value: this.node.tryGetContext('dbHost') ?? '' },
          DB_PORT: { value: String(this.node.tryGetContext('dbPort') ?? '5432') },
          DB_NAME: { value: this.node.tryGetContext('dbName') ?? '' },
        },
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('infrastructure/buildspec.yml'),
    })
    props.repository.grantPullPush(build)
    const buildAction = new actions.CodeBuildAction({
      actionName: 'TestBuildAndImage',
      project: build,
      input: sourceOutput,
      outputs: [buildOutput],
    })
    pipeline.addStage({ stageName: 'Build', actions: [buildAction] })
    pipeline.addStage({
      stageName: 'Approval',
      actions: [new actions.ManualApprovalAction({
        actionName: 'ApproveProduction',
        additionalInformation: 'Review build, tests, and deployment change before production release.',
      })],
    })
    const deploy = new codebuild.PipelineProject(this, 'DeployAndVerify', {
      projectName: `${props.appName}-deployment`,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
        environmentVariables: {
          ECS_CLUSTER: { value: props.cluster.clusterName },
          ECS_SERVICE: { value: props.service.serviceName },
          TASK_EXECUTION_ROLE_ARN: { value: props.taskExecutionRole.roleArn },
          TASK_ROLE_ARN: { value: props.taskRole.roleArn },
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: [
              'TASK_DEFINITION_ARN=$(aws ecs register-task-definition --cli-input-json file://task-definition.json --query "taskDefinition.taskDefinitionArn" --output text)',
              'aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" --task-definition "$TASK_DEFINITION_ARN" --desired-count 1',
              'aws ecs wait services-stable --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE"',
              'CURRENT=$(aws ecs describe-services --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" --query "services[0].taskDefinition" --output text)',
              'test "$CURRENT" = "$TASK_DEFINITION_ARN"',
              'RUNNING=$(aws ecs describe-services --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" --query "services[0].runningCount" --output text)',
              'test "$RUNNING" -ge 1',
            ],
          },
        },
      }),
    })
    deploy.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ecs:DescribeServices', 'ecs:UpdateService'],
      resources: [props.service.serviceArn],
    }))
    deploy.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ecs:RegisterTaskDefinition'],
      resources: ['*'],
    }))
    deploy.addToRolePolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [props.taskExecutionRole.roleArn, props.taskRole.roleArn],
      conditions: { StringEquals: { 'iam:PassedToService': 'ecs-tasks.amazonaws.com' } },
    }))
    pipeline.addStage({
      stageName: 'Deploy',
      actions: [new actions.CodeBuildAction({
        actionName: 'DeployAndVerifyHealth',
        project: deploy,
        input: buildOutput,
      })],
    })

    NagSuppressions.addResourceSuppressions(artifactKey, [{
      id: 'AwsSolutions-KMS5',
      reason: 'The artifact bucket uses a customer-managed KMS key with automatic annual rotation enabled.',
    }])
    NagSuppressions.addStackSuppressions(this, [{
      id: 'AwsSolutions-IAM5',
      reason: 'The CodePipeline and CodeBuild grants use wildcard action suffixes only for multipart S3/KMS operations against this encrypted, private artifact bucket; ECR token and task-definition registration APIs do not support resource scoping.',
      appliesTo: [
        'Action::s3:Abort*',
        'Action::s3:DeleteObject*',
        'Action::s3:GetBucket*',
        'Action::s3:GetObject*',
        'Action::s3:List*',
        'Action::kms:GenerateDataKey*',
        'Action::kms:ReEncrypt*',
        'Resource::*',
        { regex: '/^Resource::<ArtifactBucket.*\\.Arn>/\\*$/g' },
        { regex: '/^Resource::arn:<AWS::Partition>:logs:.*:log-group:/aws/codebuild/.*:\\*$/g' },
        { regex: '/^Resource::arn:<AWS::Partition>:codebuild:.*:report-group/.*-\\*$/g' },
      ],
    }])

    new CfnOutput(this, 'PipelineName', { value: pipeline.pipelineName })
    new CfnOutput(this, 'RepositoryName', { value: props.repository.repositoryName })
  }
}
