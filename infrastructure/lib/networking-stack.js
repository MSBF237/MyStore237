import {
  CfnOutput,
  CfnParameter,
  Stack,
  aws_budgets as budgets,
  aws_ec2 as ec2,
  aws_logs as logs,
} from 'aws-cdk-lib'

export class NetworkingStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)

    const sshCidr = new CfnParameter(this, 'AdminSshCidr', {
      type: 'String',
      description: 'Single trusted admin IPv4 CIDR, such as 203.0.113.10/32. Never use 0.0.0.0/0.',
      allowedPattern: '^(?!(0\\.0\\.0\\.0/0)$)(?:[0-9]{1,3}\\.){3}[0-9]{1,3}/(?:[0-9]|[12][0-9]|3[0-2])$',
    })
    const keyName = new CfnParameter(this, 'BastionKeyPairName', {
      type: 'AWS::EC2::KeyPair::KeyName',
      description: 'Name of a pre-created EC2 key pair; its private key must be stored securely by the operator.',
    })
    const alertEmail = new CfnParameter(this, 'BudgetAlertEmail', {
      type: 'String',
      description: 'Email address to receive the monthly estimated-cost budget alert.',
      allowedPattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
    })

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.40.0.0/16'),
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'PublicBastion', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'PrivateApplication', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 22 },
      ],
      gatewayEndpoints: {
        S3: { service: ec2.GatewayVpcEndpointAwsService.S3 },
        DynamoDb: { service: ec2.GatewayVpcEndpointAwsService.DYNAMODB },
      },
      enableDnsHostnames: true,
      enableDnsSupport: true,
    })
    const flowLogs = new logs.LogGroup(this, 'VpcFlowLogs', {
      logGroupName: `/${props.appName}/vpc-flow-logs`,
      retention: logs.RetentionDays.ONE_MONTH,
    })
    this.vpc.addFlowLog('FlowLogs', {
      destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogs),
    })

    this.applicationSecurityGroup = new ec2.SecurityGroup(this, 'ApplicationSecurityGroup', {
      vpc: this.vpc,
      description: 'Private ECS service traffic; app port is reachable from the bastion only.',
      allowAllOutbound: true,
    })
    this.partnerGatewaySecurityGroup = new ec2.SecurityGroup(this, 'PartnerGatewaySecurityGroup', {
      vpc: this.vpc,
      description: 'Reserved for a future partner gateway; no ingress rules are enabled.',
      allowAllOutbound: true,
    })
    this.bastionSecurityGroup = new ec2.SecurityGroup(this, 'BastionSecurityGroup', {
      vpc: this.vpc,
      description: 'SSH from the explicitly configured administrator CIDR only.',
      allowAllOutbound: true,
    })
    this.bastionSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(sshCidr.valueAsString),
      ec2.Port.tcp(22),
      'SSH from configured admin CIDR',
    )
    this.applicationSecurityGroup.addIngressRule(
      this.bastionSecurityGroup,
      ec2.Port.tcp(3000),
      'Nuxt SSR access through SSH tunnel from bastion',
    )
    const endpointSecurityGroup = new ec2.SecurityGroup(this, 'EndpointSecurityGroup', {
      vpc: this.vpc,
      description: 'HTTPS from ECS hosts to required AWS service endpoints.',
      allowAllOutbound: false,
    })
    endpointSecurityGroup.addIngressRule(
      this.applicationSecurityGroup,
      ec2.Port.tcp(443),
      'HTTPS from private ECS hosts to VPC endpoints',
    )

    const interfaceEndpoints = [
      ec2.InterfaceVpcEndpointAwsService.ECR,
      ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      ec2.InterfaceVpcEndpointAwsService.ECS,
      ec2.InterfaceVpcEndpointAwsService.ECS_AGENT,
      ec2.InterfaceVpcEndpointAwsService.ECS_TELEMETRY,
    ]
    for (const [index, service] of interfaceEndpoints.entries()) {
      this.vpc.addInterfaceEndpoint(`PrivateServiceEndpoint${index}`, {
        service,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [endpointSecurityGroup],
        open: false,
        privateDnsEnabled: true,
      })
    }

    const bastion = new ec2.Instance(this, 'Bastion', {
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType('t3.nano'),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      securityGroup: this.bastionSecurityGroup,
      keyPair: ec2.KeyPair.fromKeyPairName(this, 'BastionKeyPair', keyName.valueAsString),
      associatePublicIpAddress: true,
      requireImdsv2: true,
      detailedMonitoring: true,
      disableApiTermination: true,
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(8, { encrypted: true, deleteOnTermination: true }),
      }],
    })
    bastion.userData.addCommands(
      "sed -i -E 's/^[#[:space:]]*PasswordAuthentication[[:space:]]+.*/PasswordAuthentication no/' /etc/ssh/sshd_config",
      "grep -q '^PasswordAuthentication no$' /etc/ssh/sshd_config || printf '\\nPasswordAuthentication no\\n' >> /etc/ssh/sshd_config",
      "sed -i -E 's/^[#[:space:]]*PermitRootLogin[[:space:]]+.*/PermitRootLogin no/' /etc/ssh/sshd_config",
      "grep -q '^PermitRootLogin no$' /etc/ssh/sshd_config || printf '\\nPermitRootLogin no\\n' >> /etc/ssh/sshd_config",
      'systemctl reload sshd',
    )
    bastion.instance.addPropertyOverride('MetadataOptions.HttpTokens', 'required')
    bastion.instance.addPropertyOverride('MetadataOptions.HttpEndpoint', 'enabled')

    const monthlyBudget = Number(this.node.tryGetContext('monthlyBudgetUsd') ?? 150)
    const costBudget = new budgets.CfnBudget(this, 'MonthlyCostBudget', {
      budget: {
        budgetName: `${props.appName}-monthly-cost`,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: monthlyBudget, unit: 'USD' },
        costTypes: { includeTax: true, includeSubscription: true, useBlended: false },
      },
      notificationsWithSubscribers: [{
        notification: { notificationType: 'ACTUAL', comparisonOperator: 'GREATER_THAN', threshold: 80, thresholdType: 'PERCENTAGE' },
        subscribers: [{ subscriptionType: 'EMAIL', address: alertEmail.valueAsString }],
      }, {
        notification: { notificationType: 'FORECASTED', comparisonOperator: 'GREATER_THAN', threshold: 100, thresholdType: 'PERCENTAGE' },
        subscribers: [{ subscriptionType: 'EMAIL', address: alertEmail.valueAsString }],
      }],
    })
    this.vpc.node.addDependency(costBudget)

    new CfnOutput(this, 'VpcId', { value: this.vpc.vpcId })
    new CfnOutput(this, 'PrivateSubnetIds', { value: this.vpc.privateSubnets.map((subnet) => subnet.subnetId).join(',') })
    new CfnOutput(this, 'BastionInstanceId', { value: bastion.instanceId })
    new CfnOutput(this, 'PartnerGatewaySecurityGroupId', { value: this.partnerGatewaySecurityGroup.securityGroupId })
    new CfnOutput(this, 'SshCidrNote', { value: 'SSH is restricted by the AdminSshCidr parameter.' })
  }
}
