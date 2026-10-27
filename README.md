# TECH WAVE CM

This repository contains the existing static storefront and a separate Nuxt 3 SSR admin console in [`admin/`](./admin/), plus AWS CDK infrastructure in [`infrastructure/`](./infrastructure/). The admin console is a frontend-first prototype: authentication, data, uploads, notifications, and audit events are mock services. **Do not expose it as a production administration system until real authentication, server-side authorization, APIs, and persistence are implemented.**

## Run the admin console locally

Requirements: Node.js 22 LTS and npm.

```sh
cd admin
npm ci
npm run dev
```

Visit the local URL printed by Nuxt and sign in with the demo role selector. Build and validate with:

```sh
npm run lint
npm test
npm run build
```

Each route is SSR-rendered and split by Nuxt's file-based router. The Pinia stores use replaceable services under `admin/services/`; visual tokens live in `admin/assets/css/tokens.css`, and flat English/French dictionaries live in `admin/i18n/`. The database config is intentionally inert.

## AWS access and account safety

AWS CLI is installed in the current development environment. I did not run `aws configure` or a live STS call; credentials were not requested, entered, or accessed in this workspace. Do not paste access keys into chat, source control, build variables, or this repository. Prefer AWS IAM Identity Center (`aws configure sso`) with an appropriately restricted deployment role. If your organization requires static credentials, enter them only into the local AWS CLI prompt and use short-lived credentials where possible.

Install AWS CLI v2 on macOS if needed:

```sh
brew install awscli
aws --version
```

For a local profile, run `aws configure` in your own terminal and follow its prompts. To verify your selected identity/account without changing AWS resources:

```sh
aws sts get-caller-identity
aws configure list
```

Before deployment, choose the AWS region and make sure it supports ECS, ECR, CodePipeline/CodeBuild, CloudWatch, EC2, and the required interface endpoints. Create a dedicated EC2 key pair in that region and keep its private key in a secure local location. Determine the administrator's current public IPv4 CIDR (normally a single address with `/32`); never use `0.0.0.0/0` for SSH.

## AWS cost and architecture notes

The CDK creates a **$150/month estimated-cost budget** by default and sends alerts at 80% actual spend and 100% forecast spend. This is an alert, not a spending cap; review and adjust it before deployment. AWS Budgets is a billing service and may require billing permissions that normal deployment roles do not have.

This is not a low-cost architecture. The two-AZ VPC interface endpoints for ECR, ECS, and CloudWatch Logs are billed per endpoint-hour and data processed; six endpoint services across two AZs can cost roughly $85–$100/month before compute, storage, build minutes, and logs, depending on region/pricing. The `t3.small` ECS host, bastion, EBS, public IPv4, and monitoring add cost. The total can exceed the $150 alert, particularly at higher data transfer or with extra capacity. Check the AWS Pricing Calculator for the selected region. For the smallest dev environment, consider one AZ and a smaller EC2 host, while understanding this reduces availability; do not remove required endpoints unless a private egress alternative is deliberately designed.

The bastion is in a dedicated public subnet; **application instances/tasks are in private subnets with no NAT gateway and no public IPs**. The admin app has no public load balancer: reach it through an SSH local-forward from the bastion. A placeholder security group is emitted for a future partner gateway; it has no public ingress. The ECR repository lives in `ComputeStack` because the ECS task definition needs its image URI without a stack dependency cycle; `PipelineStack` builds and pushes to that repository.

## CDK deployment walkthrough

Prerequisites: Node.js 22, Docker, AWS CLI v2, an authenticated AWS CLI profile, a GitHub CodeStar connection already authorized for this repository, an EC2 key pair in the target region, and an SSH CIDR and budget-alert email.

1. Install infrastructure dependencies and bootstrap the account/region once:

   ```sh
   cd infrastructure
   npm ci
   npx cdk bootstrap aws://ACCOUNT_ID/REGION
   ```

   Replace `ACCOUNT_ID` and `REGION` with the values for the intended deployment account and region. Bootstrap provisions the CDK asset bucket and deployment roles; review the synthesized IAM changes before accepting.

2. Deploy the VPC and budget first. CDK prompts for parameters if they are not supplied:

   ```sh
   npx cdk deploy NetworkingStack \
     --parameters NetworkingStack:AdminSshCidr=YOUR_PUBLIC_IPV4/32 \
     --parameters NetworkingStack:BastionKeyPairName=YOUR_EC2_KEY_PAIR \
     --parameters NetworkingStack:BudgetAlertEmail=YOUR_ALERT_EMAIL
   ```

   Verify the stack is `CREATE_COMPLETE`, then inspect its `VpcId`, private subnet IDs, and bastion instance ID outputs. Confirm the VPC has no NAT gateway, private subnets have no public IP assignment, the bastion SSH rule matches only your CIDR, and the monthly budget is present. Confirm the budget alert email subscription from the AWS notification email.

3. Deploy ECS compute:

   ```sh
   npx cdk deploy ComputeStack
   ```

   Confirm the ECS cluster, one private EC2 capacity instance, ECR repository, log group, task definition, and service exist. The service intentionally starts with desired count zero so it cannot pull a not-yet-built image; the first approved pipeline run builds the image and activates one task. Confirm the ECS container-instance is registered and interface endpoint connections are available from the private subnets.

4. Create/authorize a CodeStar connection to GitHub, then deploy the pipeline. Provide its ARN and repo metadata as CDK context (these are identifiers, not credentials):

   ```sh
   npx cdk deploy PipelineStack \
     --parameters PipelineStack:GitHubConnectionArn=arn:aws:codestar-connections:REGION:ACCOUNT_ID:connection/CONNECTION_ID \
     --parameters PipelineStack:GitHubOwner=MSBF237 \
     --parameters PipelineStack:GitHubRepository=MyStore237
   ```

   Confirm the pipeline and CodeBuild projects exist and the source connection status is `AVAILABLE`. Push to `main` or start an execution from the CodePipeline console. The build runs `npm ci`, lint, unit/snapshot tests, Nuxt build, then builds and pushes the image. The `Approval` stage pauses before production deployment. Review the execution, then approve or reject it. The ECS deployment circuit breaker rolls back a failed task deployment; the following verification action waits for a stable service and at least one running task.

   Build-time `DB_HOST`, `DB_PORT`, and `DB_NAME` can be supplied as CDK context values (`-c dbHost=...`, etc.). These are non-secret placeholders; do not put credentials or secrets into build variables. Change the family/log group names together if changing `appName`.

5. Reach the application only after the pipeline's verification action succeeds. Find the running ECS container instance's private IP in the EC2 console. Open an SSH tunnel from a trusted local machine:

   ```sh
   ssh -i /secure/path/to/key.pem -N \
     -L 3000:PRIVATE_ECS_INSTANCE_IP:3000 \
     ec2-user@BASTION_PUBLIC_IP
   ```

   Visit `http://localhost:3000`. The localhost hop is an encrypted SSH tunnel; the admin app itself is not exposed publicly. Stop the tunnel with Ctrl-C.

6. Verify observability:

   ```sh
   aws logs tail /ecs/tech-wave-cm-admin --follow --region REGION
   aws cloudwatch describe-alarms --alarm-name-prefix tech-wave-cm --region REGION
   aws ecs describe-services --cluster tech-wave-cm-cluster --services tech-wave-cm-admin --region REGION
   ```

   Confirm the `nuxt` log stream receives output, the ECS service has a running task, and CPU, memory, task-count, and HTTP 5xx alarms appear in CloudWatch. Metric alarms need datapoints before entering a meaningful state; the HTTP 5xx metric only appears after an HTTP 5xx is logged. Do not generate failure traffic in production just to test an alarm.

## Security, availability, and growth

Role selection and role guards are demo-only; browser-side RBAC is not a security boundary. Before production, replace the mock auth adapter with Auth0 or an equivalent OIDC provider, enforce authorization on every backend API, add CSRF/session protections appropriate to the auth flow, and replace in-memory mock/audit/upload functions with server-side services. Never treat the demo cookie or client state as proof of identity.

The current Nuxt 3 dependency tree has six high and one moderate `npm audit` findings (primarily Nuxt 3 advisories and a transitive `node-forge` issue); `npm audit --omit=dev` reports no production-only dependency findings. Because the requirement specifies Nuxt 3 and the available npm fix requires Nuxt 4, this starter remains on Nuxt 3 and **must not be treated as security-cleared for production** until the framework advisories are patched or a documented risk acceptance is approved. Re-run `npm audit` before deployment.

The initial single EC2 host and one task are a deliberate cost-conscious start, not multi-AZ availability. The ASG scales up to three hosts on CPU and ECS service memory signals; CPU/memory/task/HTTP alarms are provided. For higher availability, add a private, multi-AZ ALB with TLS and a deliberate partner access design, multiple ECS tasks across AZs, stronger backup/restore and deployment testing, and a real database. Scale beyond the current 10x target by revisiting capacity-provider behavior, database architecture, rate limits, and regional recovery. No public partner gateway or database is deployed in this phase.

CDK Nag `AwsSolutionsChecks` runs across all three stacks at synthesis. Review all findings and explicit exceptions before deployment. The requested AWS MCP servers are not configured by these repository changes; configure them in your coding environment if you want live documentation, account inspection, price estimates, and post-deployment alarm/log verification.
