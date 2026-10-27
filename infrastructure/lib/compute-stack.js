import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  aws_applicationautoscaling as appscaling,
  aws_cloudwatch as cloudwatch,
  aws_cloudwatch_actions as actions,
  aws_ec2 as ec2,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_iam as iam,
  aws_logs as logs,
} from 'aws-cdk-lib'
import { NagSuppressions } from 'cdk-nag'

export class ComputeStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)

    this.cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.vpc,
      clusterName: `${props.appName}-cluster`,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    })
    const repository = new ecr.Repository(this, 'AdminRepository', {
      repositoryName: `${props.appName}-admin`,
      imageScanOnPush: true,
      encryption: ecr.RepositoryEncryption.AES_256,
      lifecycleRules: [{ maxImageCount: 10, description: 'Keep the latest ten deployment images' }],
      removalPolicy: RemovalPolicy.RETAIN,
    })
    this.repository = repository

    const capacity = this.cluster.addCapacity('Ec2Capacity', {
      instanceType: new ec2.InstanceType('t3.small'),
      minCapacity: 1,
      desiredCapacity: 1,
      maxCapacity: 3,
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
      associatePublicIpAddress: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(30, { encrypted: true, deleteOnTermination: true }),
      }],
    })
    capacity.addSecurityGroup(props.applicationSecurityGroup)
    const cpuAlarm = new cloudwatch.Alarm(this, 'ClusterCpuAlarm', {
      alarmName: `${props.appName}-ecs-cpu-reservation-high`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'CPUReservation',
        dimensionsMap: { ClusterName: this.cluster.clusterName },
        statistic: 'Average',
        period: Duration.minutes(5),
      }),
      threshold: 70,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    })
    const cpuScaleOut = capacity.scaleOnMetric('HostCpuScaling', {
      metric: cpuAlarm.metric,
      scalingSteps: [{ upper: 70, change: 0 }, { lower: 70, change: 1 }],
      adjustmentType: appscaling.AdjustmentType.CHANGE_IN_CAPACITY,
    })
    cpuAlarm.addAlarmAction(new actions.AutoScalingAction(cpuScaleOut))

    this.taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    })
    this.taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    })
    const logGroup = new logs.LogGroup(this, 'ApplicationLogs', {
      logGroupName: `/ecs/${props.appName}-admin`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN,
    })
    this.taskExecutionRole.addToPolicy(new iam.PolicyStatement({
      actions: ['ecr:GetAuthorizationToken'],
      resources: ['*'],
    }))
    this.taskExecutionRole.addToPolicy(new iam.PolicyStatement({
      actions: ['ecr:BatchCheckLayerAvailability', 'ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
      resources: [repository.repositoryArn],
    }))
    this.taskExecutionRole.addToPolicy(new iam.PolicyStatement({
      actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [`${logGroup.logGroupArn}:*`],
    }))
    const imageUri = `${Stack.of(this).account}.dkr.ecr.${Stack.of(this).region}.amazonaws.com/${repository.repositoryName}:bootstrap`
    const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDefinition', {
      family: `${props.appName}-admin`,
      executionRole: this.taskExecutionRole,
      taskRole: this.taskRole,
      networkMode: ecs.NetworkMode.BRIDGE,
    })
    const container = taskDefinition.addContainer('NuxtAdmin', {
      image: ecs.ContainerImage.fromRegistry(imageUri),
      cpu: 512,
      memoryReservationMiB: 768,
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: 'nuxt' }),
      environment: { DB_HOST: '', DB_PORT: '5432', DB_NAME: '' },
      healthCheck: {
        command: ['CMD-SHELL', `node -e "fetch('http://127.0.0.1:3000').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`],
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        retries: 3,
        startPeriod: Duration.seconds(60),
      },
    })
    NagSuppressions.addResourceSuppressions(taskDefinition, [{
      id: 'AwsSolutions-ECS2',
      reason: 'Only non-secret DB host/port/name placeholders are placed in the task definition as explicitly requested; no credentials or sensitive values are supplied.',
    }])
    NagSuppressions.addResourceSuppressions(this.taskExecutionRole, [{
      id: 'AwsSolutions-IAM5',
      reason: 'ecr:GetAuthorizationToken is an AWS API that does not support resource-level permissions. All image-layer actions are restricted to this application ECR repository.',
      appliesTo: [
        'Resource::*',
        { regex: '/^Resource::<ApplicationLogs.*\\.Arn>:\\*$/g' },
      ],
    }], true)
    NagSuppressions.addResourceSuppressions(capacity, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'The ECS-optimized EC2 agent and CDK drain hook require a small set of ECS/ECR/EC2 discovery calls that AWS does not support resource scoping for. The generated role is attached only to this cluster capacity group.',
        appliesTo: [
          'Resource::*',
          'Action::ecs:Submit*',
          { regex: '/^Resource::arn:<AWS::Partition>:autoscaling:.*:autoScalingGroup:\\*:autoScalingGroupName/.*$/g' },
        ],
      },
      {
        id: 'AwsSolutions-IAM4',
        reason: 'CDK creates an AWS Lambda basic execution role for the ASG lifecycle drain hook; it is an internal, generated helper and is scoped to this stack.',
        appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
      },
      {
        id: 'AwsSolutions-L1',
        reason: 'The drain-hook Lambda is generated by the CDK ECS capacity construct and its runtime is managed by the installed CDK release.',
      },
      {
        id: 'AwsSolutions-SNS3',
        reason: 'This SNS topic is created by the CDK ECS drain hook for internal ASG lifecycle signaling, not as a user notification endpoint.',
      },
      {
        id: 'AwsSolutions-AS3',
        reason: 'The ECS capacity group emits CloudWatch CPU and memory alarms and scales through those signals; lifecycle notification topics are not exposed or subscribed.',
      },
    ], true)
    container.addPortMappings({ containerPort: 3000, hostPort: 3000, protocol: ecs.Protocol.TCP })

    this.service = new ecs.Ec2Service(this, 'AdminService', {
      cluster: this.cluster,
      serviceName: `${props.appName}-admin`,
      taskDefinition,
      desiredCount: 0,
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      circuitBreaker: { enable: true, rollback: true },
      healthCheckGracePeriod: Duration.seconds(90),
    })

    const memoryAlarm = new cloudwatch.Alarm(this, 'ServiceMemoryAlarm', {
      alarmName: `${props.appName}-ecs-memory-high`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'MemoryUtilization',
        dimensionsMap: { ClusterName: this.cluster.clusterName, ServiceName: this.service.serviceName },
        statistic: 'Average',
        period: Duration.minutes(5),
      }),
      threshold: 75,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    })
    const scaleOut = capacity.scaleOnMetric('ServiceMemoryScaleOut', {
      metric: memoryAlarm.metric,
      scalingSteps: [{ upper: 75, change: 0 }, { lower: 75, change: 1 }],
      adjustmentType: appscaling.AdjustmentType.CHANGE_IN_CAPACITY,
    })
    memoryAlarm.addAlarmAction(new actions.AutoScalingAction(scaleOut))

    const serviceMetric = (metricName, threshold, id, comparisonOperator) => new cloudwatch.Alarm(this, id, {
      alarmName: `${props.appName}-${id.toLowerCase()}`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName,
        dimensionsMap: { ClusterName: this.cluster.clusterName, ServiceName: this.service.serviceName },
        statistic: 'Average',
        period: Duration.minutes(5),
      }),
      threshold,
      evaluationPeriods: 2,
      comparisonOperator,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    })
    serviceMetric('CPUUtilization', 80, 'ServiceCpuAlarm', cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD)
    new cloudwatch.Alarm(this, 'TaskCountAlarm', {
      alarmName: `${props.appName}-ecs-running-tasks-low`,
      metric: this.service.metric('RunningTaskCount', { statistic: 'Minimum', period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    })
    const httpErrors = new logs.MetricFilter(this, 'HttpErrorMetric', {
      logGroup,
      filterPattern: logs.FilterPattern.literal('{ $.event = "http_error" }'),
      metricNamespace: `${props.appName}/Admin`,
      metricName: 'Http5xxCount',
      metricValue: '1',
    })
    new cloudwatch.Alarm(this, 'HttpErrorAlarm', {
      alarmName: `${props.appName}-http-5xx`,
      metric: httpErrors.metric({ statistic: 'Sum', period: Duration.minutes(5) }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    })

    new CfnOutput(this, 'ClusterName', { value: this.cluster.clusterName })
    new CfnOutput(this, 'ServiceName', { value: this.service.serviceName })
    new CfnOutput(this, 'RepositoryUri', { value: repository.repositoryUri })
    new CfnOutput(this, 'LogGroupName', { value: logGroup.logGroupName })
    new CfnOutput(this, 'InitialServiceDesiredCount', { value: '0; pipeline smoke-check scales to 1 after first build' })
  }
}
