const required = [
  'AWS_DEFAULT_REGION',
  'AWS_ACCOUNT_ID',
  'CONTAINER_NAME',
  'IMAGE_URI',
  'TASK_EXECUTION_ROLE_ARN',
  'TASK_ROLE_ARN',
]
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required build environment variable: ${name}`)
}

const taskDefinition = {
  family: 'tech-wave-cm-admin',
  executionRoleArn: process.env.TASK_EXECUTION_ROLE_ARN,
  taskRoleArn: process.env.TASK_ROLE_ARN,
  networkMode: 'bridge',
  requiresCompatibilities: ['EC2'],
  cpu: '512',
  memory: '1024',
  containerDefinitions: [{
    name: process.env.CONTAINER_NAME,
    image: process.env.IMAGE_URI,
    essential: true,
    cpu: 512,
    memoryReservation: 768,
    portMappings: [{ containerPort: 3000, hostPort: 3000, protocol: 'tcp' }],
    environment: [
      { name: 'NODE_ENV', value: 'production' },
      { name: 'DB_HOST', value: process.env.DB_HOST ?? '' },
      { name: 'DB_PORT', value: process.env.DB_PORT ?? '5432' },
      { name: 'DB_NAME', value: process.env.DB_NAME ?? '' },
    ],
    logConfiguration: {
      logDriver: 'awslogs',
      options: {
        'awslogs-group': '/ecs/tech-wave-cm-admin',
        'awslogs-region': process.env.AWS_DEFAULT_REGION,
        'awslogs-stream-prefix': 'nuxt',
      },
    },
    healthCheck: {
      command: ['CMD-SHELL', `node -e "fetch('http://127.0.0.1:3000').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`],
      interval: 30,
      timeout: 5,
      retries: 3,
      startPeriod: 60,
    },
  }],
}
process.stdout.write(`${JSON.stringify(taskDefinition, null, 2)}\n`)
