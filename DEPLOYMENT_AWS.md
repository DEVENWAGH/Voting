# 🚀 AWS Deployment Guide — Block Vote DApp

Complete guide for deploying the Block Vote blockchain voting system to AWS, including three cloud-native integration architectures for production-grade scalability.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Option A: AWS EC2 Deployment](#option-a-aws-ec2-deployment)
4. [Option B: AWS ECS Fargate (Containerized)](#option-b-aws-ecs-fargate-containerized)
5. [Option C: AWS Amplify (Simplest)](#option-c-aws-amplify-simplest)
6. [MongoDB Atlas Setup](#mongodb-atlas-setup)
7. [Blockchain Node in Production](#blockchain-node-in-production)
8. [Environment Variables & Secrets](#environment-variables--secrets)
9. [SSL/Domain Configuration](#ssldomain-configuration)
10. [CI/CD Pipeline](#cicd-pipeline)
11. [Monitoring & Logging](#monitoring--logging)
12. [Cloud Integration 1: Zero-Knowledge Biometric Authentication](#cloud-integration-1-zero-knowledge-biometric-authentication)
13. [Cloud Integration 2: Serverless Real-Time Analytics Dashboard](#cloud-integration-2-serverless-real-time-analytics-dashboard)
14. [Cloud Integration 3: Edge Computing for Low Latency](#cloud-integration-3-edge-computing-for-low-latency)
15. [Cost Estimation](#cost-estimation)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          AWS Cloud                                  │
│                                                                     │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────────┐    │
│  │  Route53  │───▶│  CloudFront  │───▶│  ALB / Amplify         │    │
│  │  (DNS)    │    │  (CDN+Edge)  │    │  (Load Balancer)       │    │
│  └──────────┘    └──────────────┘    └──────────┬─────────────┘    │
│                                                  │                  │
│                          ┌───────────────────────┼─────────┐       │
│                          │                       │         │       │
│                  ┌───────▼───────┐   ┌──────────▼──┐  ┌───▼────┐  │
│                  │  EC2/ECS/     │   │  Lambda     │  │  S3    │  │
│                  │  Amplify      │   │  Functions  │  │  (CDN  │  │
│                  │  (Next.js)    │   │  (Events)   │  │  Assets│  │
│                  └───────┬───────┘   └──────┬──────┘  └────────┘  │
│                          │                  │                      │
│              ┌───────────┼──────────────────┼─────────┐           │
│              │           │                  │         │           │
│      ┌───────▼──┐ ┌──────▼─────┐  ┌────────▼──┐ ┌───▼────────┐  │
│      │ MongoDB  │ │ Ethereum   │  │  AWS       │ │  Secrets   │  │
│      │ Atlas    │ │ Node (RPC) │  │  Rekognition│ │  Manager   │  │
│      │ (DB)     │ │ (Alchemy)  │  │  (Biometric)│ │  (Env Vars)│  │
│      └──────────┘ └────────────┘  └────────────┘ └────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### AWS Account & CLI

```bash
# Install AWS CLI
# Windows: Download MSI from https://aws.amazon.com/cli/
# Or via winget:
winget install Amazon.AWSCLI

# Configure credentials
aws configure
# Enter: Access Key ID, Secret Access Key, Region (ap-south-1 for India), Output format (json)
```

### Required AWS Services

| Service | Purpose | Free Tier? |
|---------|---------|------------|
| EC2 / ECS / Amplify | Host Next.js app | EC2 t2.micro: 750hrs/mo free |
| Route 53 | Domain DNS | $0.50/hosted zone |
| ACM | SSL Certificates | Free |
| CloudFront | CDN + Edge | 1TB/mo free |
| Secrets Manager | Environment variables | $0.40/secret/month |
| CloudWatch | Monitoring & logs | Basic free |
| S3 | Static assets | 5GB free |
| Lambda | Serverless functions | 1M requests/mo free |
| Rekognition | Biometric (optional) | 5K images/mo free |

### Domain Name (Optional but Recommended)

Purchase a domain via Route 53 or transfer an existing one.

---

## Option A: AWS EC2 Deployment

Best for: Full control, persistent blockchain node, lowest cost for sustained workloads.

### Step 1: Launch EC2 Instance

```bash
# Launch Ubuntu 24.04 LTS instance
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.medium \
  --key-name your-key-pair \
  --security-group-ids sg-xxxx \
  --subnet-id subnet-xxxx \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=blockvote-app}]' \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]'
```

### Step 2: Security Group Rules

```bash
# Allow HTTP, HTTPS, SSH, and blockchain RPC
aws ec2 authorize-security-group-ingress --group-id sg-xxxx --protocol tcp --port 22 --cidr 0.0.0.0/0    # SSH
aws ec2 authorize-security-group-ingress --group-id sg-xxxx --protocol tcp --port 80 --cidr 0.0.0.0/0    # HTTP
aws ec2 authorize-security-group-ingress --group-id sg-xxxx --protocol tcp --port 443 --cidr 0.0.0.0/0   # HTTPS
aws ec2 authorize-security-group-ingress --group-id sg-xxxx --protocol tcp --port 3000 --cidr 0.0.0.0/0  # Next.js dev
aws ec2 authorize-security-group-ingress --group-id sg-xxxx --protocol tcp --port 8545 --cidr 10.0.0.0/8 # RPC (private only!)
```

> ⚠️ **NEVER expose port 8545 (RPC) to the public internet.** Keep it on private subnet only.

### Step 3: Server Setup

SSH into the instance and run:

```bash
#!/bin/bash
# === Server Setup Script ===

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Yarn
npm install -g yarn

# Install PM2 (process manager)
npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Clone your repository
cd /opt
sudo git clone https://github.com/your-org/voting-dapp.git
cd voting-dapp

# Install dependencies
yarn install --production=false

# Build the Next.js app
yarn build
```

### Step 4: PM2 Process Management

Create `ecosystem.config.cjs`:

```javascript
// ecosystem.config.cjs (in project root)
module.exports = {
  apps: [
    {
      name: 'blockvote-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '/opt/voting-dapp',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 'max',        // Use all CPU cores
      exec_mode: 'cluster',
      max_memory_restart: '500M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'hardhat-node',
      script: 'node_modules/.bin/hardhat',
      args: 'node --hostname 127.0.0.1',
      cwd: '/opt/voting-dapp',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      max_memory_restart: '1G',
      // Only run this if using local Hardhat chain (not recommended for production)
    },
  ],
};
```

```bash
# Start all processes
pm2 start ecosystem.config.cjs

# Save PM2 process list for auto-restart on reboot
pm2 save
pm2 startup
```

### Step 5: Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/blockvote
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (from Let's Encrypt or ACM)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    # Next.js application
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files caching
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # API routes - no caching
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/blockvote /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Install Let's Encrypt SSL
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## Option B: AWS ECS Fargate (Containerized)

Best for: Auto-scaling, zero server management, production-grade isolation.

### Step 1: Create Dockerfile

```dockerfile
# Dockerfile (in project root)
FROM node:20-alpine AS base

# Install dependencies only
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

Add `output: 'standalone'` to `next.config.mjs`:

```javascript
const nextConfig = {
  output: 'standalone',  // Add this for Docker
  // ... existing config
};
```

### Step 2: Build & Push to ECR

```bash
# Create ECR repository
aws ecr create-repository --repository-name blockvote --region ap-south-1

# Login to ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com

# Build and push
docker build -t blockvote .
docker tag blockvote:latest <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/blockvote:latest
docker push <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/blockvote:latest
```

### Step 3: ECS Task Definition

```json
{
  "family": "blockvote-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "blockvote",
      "image": "<ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/blockvote:latest",
      "portMappings": [{ "containerPort": 3000, "protocol": "tcp" }],
      "essential": true,
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/blockvote",
          "awslogs-region": "ap-south-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "secrets": [
        { "name": "MONGODB_URI", "valueFrom": "arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:blockvote/mongodb-xxxx" },
        { "name": "NEXTAUTH_SECRET", "valueFrom": "arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:blockvote/nextauth-xxxx" },
        { "name": "ADMIN_RELAY_PRIVATE_KEY", "valueFrom": "arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:blockvote/relay-key-xxxx" }
      ]
    }
  ]
}
```

### Step 4: Create ECS Service with ALB

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name blockvote-cluster

# Create service
aws ecs create-service \
  --cluster blockvote-cluster \
  --service-name blockvote-service \
  --task-definition blockvote-task \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=blockvote,containerPort=3000"
```

### Step 5: Auto-Scaling

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/blockvote-cluster/blockvote-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

# CPU-based scaling policy
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/blockvote-cluster/blockvote-service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": { "PredefinedMetricType": "ECSServiceAverageCPUUtilization" },
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }'
```

---

## Option C: AWS Amplify (Simplest)

Best for: Quick deployments, automatic CI/CD, managed SSL.

### Step 1: Connect Repository

```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Or deploy via AWS Console:
# 1. Go to AWS Amplify Console
# 2. Click "New app" → "Host web app"
# 3. Connect your GitHub repository
# 4. Select the branch to deploy
```

### Step 2: Build Settings

Create `amplify.yml` in the project root:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - yarn install --frozen-lockfile
    build:
      commands:
        - yarn build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

### Step 3: Environment Variables

In the Amplify Console:
1. Go to **App Settings → Environment Variables**
2. Add all variables from your `.env` file
3. Mark sensitive values as "encrypted"

### Step 4: Custom Domain

1. Go to **App Settings → Domain Management**
2. Click **Add Domain**
3. Enter your domain name
4. Amplify automatically provisions SSL via ACM

---

## MongoDB Atlas Setup

The app uses Mongoose/MongoDB. For production, use **MongoDB Atlas** (managed cloud MongoDB).

### Step 1: Create Atlas Cluster

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a new project → Build a Cluster
3. Select **AWS** as cloud provider, choose **ap-south-1** (Mumbai) region
4. Select tier:
   - **M0 Free** — 512MB, for demos
   - **M10** — $57/mo, for production with auto-scaling
   - **M30** — $840/mo, for high-traffic elections

### Step 2: Network Access

```
# Allow connections from your AWS VPC
# In Atlas: Network Access → Add IP Address
# Add your EC2/ECS public IP or use VPC Peering for private connectivity

# For VPC Peering (recommended for production):
# 1. In Atlas: Network Access → Peering → Add Peering Connection
# 2. Select AWS, enter your VPC ID and CIDR
# 3. Accept the peering request in AWS VPC Console
```

### Step 3: Connection String

```env
# Replace in your .env / Secrets Manager:
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/votingdapp?retryWrites=true&w=majority
```

### Step 4: Database Indexes

```javascript
// Run once to create optimal indexes
db.organizations.createIndex({ slug: 1 }, { unique: true });
db.organizations.createIndex({ adminEmail: 1 }, { unique: true });
db.voters.createIndex({ nullifierHash: 1 }, { unique: true });
db.voteactivities.createIndex({ electionId: 1, timestamp: -1 });
db.voteruploadbatches.createIndex({ orgId: 1, createdAt: -1 });
```

---

## Blockchain Node in Production

> ⚠️ **Do NOT use Hardhat node in production.** It's an in-memory development chain — all data is lost on restart.

### Option 1: Use a Managed RPC Provider (Recommended)

| Provider | Free Tier | Best For |
|----------|-----------|----------|
| [Alchemy](https://www.alchemy.com) | 300M compute units/mo | Most popular, excellent dashboard |
| [Infura](https://infura.io) | 100K requests/day | Reliable, ConsenSys-backed |
| [QuickNode](https://www.quicknode.com) | 10M API credits/mo | Fastest response times |

```env
# Update .env for production:
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# For mainnet (real elections):
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
NEXT_PUBLIC_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

### Option 2: Self-Hosted Geth/Nethermind Node

For full decentralization, run your own Ethereum node on a dedicated EC2 instance:

```bash
# Requires: t3.xlarge (4 vCPU, 16GB RAM), 2TB SSD
# Sync time: 2-7 days for full sync

# Install Geth
sudo add-apt-repository -y ppa:ethereum/ethereum
sudo apt update && sudo apt install -y geth

# Run as systemd service
sudo systemctl enable --now geth
```

### Option 3: Layer 2 / Sidechain (Cost-Effective)

For reducing gas costs in production elections:

| Network | Gas Cost | Speed | Security |
|---------|----------|-------|----------|
| Polygon PoS | ~$0.001/tx | 2s blocks | Good |
| Arbitrum | ~$0.01/tx | 250ms | Excellent (L2 rollup) |
| Base | ~$0.001/tx | 2s blocks | Good (Coinbase L2) |

To deploy on Polygon, add to `hardhat.config.js`:

```javascript
polygon: {
  url: "https://polygon-rpc.com",
  chainId: 137,
  accounts: [process.env.DEPLOYER_PRIVATE_KEY],
},
```

---

## Environment Variables & Secrets

### AWS Secrets Manager (Recommended)

```bash
# Store each secret
aws secretsmanager create-secret \
  --name blockvote/mongodb \
  --secret-string '{"MONGODB_URI":"mongodb+srv://..."}'

aws secretsmanager create-secret \
  --name blockvote/relay-key \
  --secret-string '{"ADMIN_RELAY_PRIVATE_KEY":"0x..."}'

aws secretsmanager create-secret \
  --name blockvote/auth \
  --secret-string '{"NEXTAUTH_SECRET":"...","GOOGLE_CLIENT_ID":"...","GOOGLE_CLIENT_SECRET":"..."}'

aws secretsmanager create-secret \
  --name blockvote/rpc \
  --secret-string '{"RPC_URL":"https://eth-sepolia.g.alchemy.com/v2/...","NEXT_PUBLIC_RPC_URL":"..."}'
```

### Loading Secrets at Runtime (EC2)

```bash
# Add to your startup script or PM2 ecosystem config:
export $(aws secretsmanager get-secret-value --secret-id blockvote/mongodb --query SecretString --output text | jq -r 'to_entries[] | "\(.key)=\(.value)"')
```

### Required Environment Variables for Production

```env
# === CRITICAL — Must change from defaults ===
MONGODB_URI=                          # MongoDB Atlas connection string
NEXTAUTH_SECRET=                      # openssl rand -base64 32
JWT_SECRET=                           # openssl rand -base64 32
SERVER_IDENTITY_SECRET=               # openssl rand -base64 32
SERVER_ENCRYPTION_KEY=                # openssl rand -base64 32
ADMIN_RELAY_PRIVATE_KEY=              # Funded wallet private key (NEVER Hardhat default!)
DEPLOYER_PRIVATE_KEY=                 # Deployer wallet key
GOOGLE_CLIENT_ID=                     # Google OAuth
GOOGLE_CLIENT_SECRET=                 # Google OAuth
GMAIL_USER=                           # Email OTP sender
GMAIL_APP_PASSWORD=                   # Gmail app password

# === Network ===
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_CONTRACT_ADDRESS=         # Deployed proxy address
NEXTAUTH_URL=https://yourdomain.com   # Your production URL

# === Optional ===
IMAGEKIT_PUBLIC_KEY=
IMAGEKIT_PRIVATE_KEY=
IMAGEKIT_URL_ENDPOINT=
```

> 🔴 **CRITICAL SECURITY**: The `.env` in this repo contains Hardhat's default private key (`0xac0974...`). This is public and has **ZERO value**. For production, generate new wallets and NEVER reuse development keys.

---

## SSL/Domain Configuration

### Route 53 + ACM

```bash
# 1. Create hosted zone
aws route53 create-hosted-zone --name yourdomain.com --caller-reference $(date +%s)

# 2. Request SSL certificate
aws acm request-certificate \
  --domain-name yourdomain.com \
  --subject-alternative-names "*.yourdomain.com" \
  --validation-method DNS \
  --region us-east-1  # Must be us-east-1 for CloudFront

# 3. Add the CNAME validation record to Route 53
# (Follow the output from the certificate request)

# 4. Create A record pointing to your ALB/EC2
aws route53 change-resource-record-sets --hosted-zone-id ZXXXXX --change-batch '{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "yourdomain.com",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "ALB_HOSTED_ZONE_ID",
        "DNSName": "your-alb-dns-name.elb.amazonaws.com",
        "EvaluateTargetHealth": true
      }
    }
  }]
}'
```

---

## CI/CD Pipeline

### GitHub Actions → AWS

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: yarn
      - run: yarn install --frozen-lockfile
      - run: yarn build
      - run: yarn compile  # Compile Solidity contracts

  deploy-ec2:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to EC2 via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /opt/voting-dapp
            git pull origin main
            yarn install --frozen-lockfile
            yarn build
            pm2 restart blockvote-web

  # OR for ECS:
  deploy-ecs:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build & Push Image
        run: |
          docker build -t blockvote .
          docker tag blockvote:latest ${{ secrets.ECR_REGISTRY }}/blockvote:latest
          docker push ${{ secrets.ECR_REGISTRY }}/blockvote:latest

      - name: Update ECS Service
        run: |
          aws ecs update-service \
            --cluster blockvote-cluster \
            --service blockvote-service \
            --force-new-deployment
```

---

## Monitoring & Logging

### CloudWatch Setup

```bash
# Create log group
aws logs create-log-group --log-group-name /blockvote/app

# Create dashboard
aws cloudwatch put-dashboard --dashboard-name BlockVote --dashboard-body '{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [["AWS/EC2", "CPUUtilization", "InstanceId", "i-xxxx"]],
        "period": 300,
        "title": "CPU Utilization"
      }
    }
  ]
}'

# Create alarm for high CPU
aws cloudwatch put-metric-alarm \
  --alarm-name blockvote-high-cpu \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:ap-south-1:<ACCOUNT_ID>:blockvote-alerts
```

### Key Metrics to Monitor

| Metric | Alert Threshold | Action |
|--------|----------------|--------|
| CPU > 80% | 5 min sustained | Scale out ECS tasks |
| Memory > 85% | 5 min sustained | Scale out or increase instance |
| 5XX errors > 10/min | 2 min sustained | Check logs, rollback deploy |
| Relay wallet balance < 0.1 ETH | Immediate | Fund relay wallet |
| MongoDB connections > 80% | 5 min sustained | Increase Atlas tier |
| API latency p99 > 5s | 10 min sustained | Investigate bottleneck |

---

## Cloud Integration 1: Zero-Knowledge Biometric Authentication

### Concept

Replace standard OTP-only verification with cloud-native biometric liveness detection. The voter captures a "live" selfie; AWS Rekognition verifies it against a biometric hash stored in IPFS metadata. Upon successful verification, a short-lived JWT is issued to unlock the smart contract's voting function.

### Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Voter App  │────▶│  API Gateway     │────▶│  Lambda:         │
│  (Next.js)  │     │  /api/biometric  │     │  BiometricVerify │
│             │     │                  │     │                  │
│  📸 Selfie  │     └──────────────────┘     └────────┬─────────┘
│  Capture    │                                        │
└─────────────┘                                        │
                                               ┌───────▼────────┐
                                               │                │
                                    ┌──────────┤  AWS           │
                                    │          │  Rekognition   │
                                    │          │                │
                                    │          │  - DetectFaces │
                                    │          │  - CompareFaces│
                                    │          └────────────────┘
                                    │
                              ┌─────▼──────┐
                              │  IPFS /    │     ┌──────────────┐
                              │  MongoDB   │────▶│  JWT Token   │
                              │  (Bio Hash)│     │  (60s TTL)   │
                              └────────────┘     └──────┬───────┘
                                                        │
                                                 ┌──────▼───────┐
                                                 │  Relay →     │
                                                 │  Smart       │
                                                 │  Contract    │
                                                 │  castVote()  │
                                                 └──────────────┘
```

### Implementation Steps

#### 1. Voter Registration: Store Biometric Hash

```javascript
// api/biometric/register/route.js
import { RekognitionClient, DetectFacesCommand } from '@aws-sdk/client-rekognition';
import crypto from 'crypto';

const rekognition = new RekognitionClient({ region: 'ap-south-1' });

export async function POST(req) {
  const { selfieBase64, voterId } = await req.json();

  // 1. Detect face and verify liveness attributes
  const detectResult = await rekognition.send(new DetectFacesCommand({
    Image: { Bytes: Buffer.from(selfieBase64, 'base64') },
    Attributes: ['ALL'],
  }));

  const face = detectResult.FaceDetails?.[0];
  if (!face) throw new Error('No face detected');

  // Liveness checks
  const isLive = (
    face.Confidence > 99 &&
    face.EyesOpen?.Value === true &&
    face.Smile !== undefined  // Real face has expression data
  );
  if (!isLive) throw new Error('Liveness check failed');

  // 2. Create biometric feature vector hash (zero-knowledge)
  // We hash the face landmarks — NEVER store the raw image
  const landmarkData = JSON.stringify(face.Landmarks);
  const biometricHash = crypto
    .createHmac('sha256', process.env.SERVER_IDENTITY_SECRET)
    .update(landmarkData)
    .digest('hex');

  // 3. Store hash in MongoDB (or IPFS for full decentralization)
  await db.voters.updateOne(
    { voterId },
    { $set: { biometricHash, biometricRegisteredAt: new Date() } }
  );

  return Response.json({ success: true });
}
```

#### 2. Vote-Time Verification: Compare & Issue JWT

```javascript
// api/biometric/verify/route.js
import { RekognitionClient, CompareFacesCommand } from '@aws-sdk/client-rekognition';
import jwt from 'jsonwebtoken';

export async function POST(req) {
  const { selfieBase64, voterId, electionId } = await req.json();

  // 1. Get stored biometric hash
  const voter = await db.voters.findOne({ voterId });
  if (!voter?.biometricHash) return Response.json({ error: 'Not registered' }, { status: 403 });

  // 2. Recompute biometric hash from new selfie
  const detectResult = await rekognition.send(new DetectFacesCommand({
    Image: { Bytes: Buffer.from(selfieBase64, 'base64') },
    Attributes: ['ALL'],
  }));

  const face = detectResult.FaceDetails?.[0];
  if (!face || face.Confidence < 99) {
    return Response.json({ error: 'Face detection failed' }, { status: 400 });
  }

  const landmarkData = JSON.stringify(face.Landmarks);
  const newHash = crypto
    .createHmac('sha256', process.env.SERVER_IDENTITY_SECRET)
    .update(landmarkData)
    .digest('hex');

  // 3. Compare hashes (zero-knowledge: we never stored the raw image)
  if (newHash !== voter.biometricHash) {
    return Response.json({ error: 'Biometric mismatch' }, { status: 403 });
  }

  // 4. Issue short-lived JWT (60 seconds) to authorize the vote
  const voteToken = jwt.sign(
    {
      voterId,
      electionId,
      nullifierHash: voter.nullifierHash,
      biometricVerified: true,
    },
    process.env.JWT_SECRET,
    { expiresIn: '60s' }
  );

  return Response.json({ voteToken });
}
```

#### 3. Smart Contract: Verify JWT Before Vote

The relay server verifies the JWT before calling `castVoteRelayed()`:

```javascript
// In lib/relay.js — enhanced castVote flow:
export async function relayCastVoteWithBiometric(voteToken) {
  // 1. Verify the short-lived JWT
  const payload = jwt.verify(voteToken, process.env.JWT_SECRET);

  if (!payload.biometricVerified) throw new Error('Biometric not verified');

  // 2. Proceed with relay vote (existing flow)
  const tx = await contract.castVoteRelayed(
    payload.electionId,
    payload.candidateId,
    payload.nullifierHash,
  );

  return tx;
}
```

### Privacy Guarantees

| Layer | Data Stored | Privacy Level |
|-------|------------|---------------|
| Browser | Raw selfie (ephemeral, never persisted) | Transient |
| AWS Rekognition | Processed in real-time, NOT stored by AWS | Zero retention |
| MongoDB/IPFS | HMAC-SHA256 hash of face landmarks | Irreversible hash |
| Smart Contract | Nullifier hash only | Zero-knowledge |

---

## Cloud Integration 2: Serverless Real-Time Analytics Dashboard

### Concept

Blockchains are great at recording votes but terrible at aggregating them for fast visualization. Instead of querying the slow blockchain every time, deploy AWS Lambda functions that "listen" to smart contract events and push data to MongoDB Atlas for instant frontend queries.

### Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Ethereum Node  │────▶│  AWS Lambda:     │────▶│  MongoDB Atlas   │
│  (Alchemy WS)   │     │  EventListener   │     │  (Analytics DB)  │
│                 │     │                  │     │                  │
│  Events:        │     │  Triggered by:   │     │  Collections:    │
│  - VoteCast     │     │  - WebSocket     │     │  - vote_events   │
│  - VoterReg     │     │  - Or: scheduled │     │  - hourly_stats  │
│  - PhaseChange  │     │    polling       │     │  - demographics  │
└─────────────────┘     └──────────────────┘     └────────┬─────────┘
                                                          │
                                                 ┌────────▼─────────┐
                                                 │  Next.js API     │
                                                 │  /api/analytics  │
                                                 │                  │
                                                 │  Real-time       │
                                                 │  charts & maps   │
                                                 └──────────────────┘
```

### Implementation Steps

#### 1. Lambda Event Listener

```javascript
// lambda/eventListener.js
import { ethers } from 'ethers';
import { MongoClient } from 'mongodb';

const ALCHEMY_WS = process.env.ALCHEMY_WS_URL; // wss://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const MONGODB_URI = process.env.MONGODB_URI;

// VotingV1 event ABI fragments
const EVENT_ABI = [
  'event VoteCast(uint256 indexed electionId, uint256 indexed candidateId)',
  'event VoterRegistered(bytes32 indexed nullifierHash)',
  'event PhaseChanged(uint256 indexed electionId, uint8 newPhase)',
  'event ElectionCreated(uint256 indexed electionId, string title, uint256 startTime, uint256 endTime)',
];

let mongoClient;

async function getDB() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
  }
  return mongoClient.db('votingdapp');
}

export async function handler(event) {
  const provider = new ethers.WebSocketProvider(ALCHEMY_WS);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, EVENT_ABI, provider);
  const db = await getDB();

  // Process VoteCast events
  contract.on('VoteCast', async (electionId, candidateId, event) => {
    const block = await event.getBlock();

    await db.collection('vote_events').insertOne({
      electionId: Number(electionId),
      candidateId: Number(candidateId),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: new Date(block.timestamp * 1000),
      hour: new Date(block.timestamp * 1000).toISOString().slice(0, 13),
    });

    // Update hourly aggregation
    await db.collection('hourly_stats').updateOne(
      {
        electionId: Number(electionId),
        hour: new Date(block.timestamp * 1000).toISOString().slice(0, 13),
      },
      {
        $inc: { totalVotes: 1, [`candidateVotes.${candidateId}`]: 1 },
        $set: { updatedAt: new Date() },
      },
      { upsert: true }
    );

    console.log(`Vote recorded: Election ${electionId}, Candidate ${candidateId}`);
  });

  // Process VoterRegistered events
  contract.on('VoterRegistered', async (nullifierHash, event) => {
    await db.collection('voter_registrations').insertOne({
      nullifierHash,
      blockNumber: event.blockNumber,
      timestamp: new Date(),
    });
  });

  // Keep the Lambda warm for WebSocket connection
  return new Promise((resolve) => {
    setTimeout(() => {
      provider.destroy();
      resolve({ statusCode: 200, body: 'Listener completed' });
    }, 14 * 60 * 1000); // Run for 14 minutes (Lambda max is 15)
  });
}
```

#### 2. Scheduled Aggregation Lambda

```javascript
// lambda/aggregateStats.js
// Triggered every 5 minutes by EventBridge

export async function handler() {
  const db = await getDB();

  // Aggregate vote counts per election
  const pipeline = [
    { $group: {
      _id: '$electionId',
      totalVotes: { $sum: 1 },
      uniqueTimestamps: { $addToSet: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$timestamp' } } },
      firstVote: { $min: '$timestamp' },
      lastVote: { $max: '$timestamp' },
    }},
  ];

  const stats = await db.collection('vote_events').aggregate(pipeline).toArray();

  for (const stat of stats) {
    await db.collection('election_stats').updateOne(
      { electionId: stat._id },
      {
        $set: {
          totalVotes: stat.totalVotes,
          hoursActive: stat.uniqueTimestamps.length,
          firstVote: stat.firstVote,
          lastVote: stat.lastVote,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  return { statusCode: 200, body: `Aggregated ${stats.length} elections` };
}
```

#### 3. Next.js Analytics API

```javascript
// app/api/analytics/[electionId]/route.js
import connectDB from '@/lib/db';
import mongoose from 'mongoose';

export async function GET(req, { params }) {
  await connectDB();
  const { electionId } = await params;
  const db = mongoose.connection.db;

  // Get hourly vote distribution
  const hourlyStats = await db.collection('hourly_stats')
    .find({ electionId: Number(electionId) })
    .sort({ hour: 1 })
    .toArray();

  // Get total stats
  const totalStats = await db.collection('election_stats')
    .findOne({ electionId: Number(electionId) });

  // Get vote timeline (last 100 events)
  const recentVotes = await db.collection('vote_events')
    .find({ electionId: Number(electionId) })
    .sort({ timestamp: -1 })
    .limit(100)
    .toArray();

  return Response.json({
    hourlyDistribution: hourlyStats,
    totalStats,
    recentVotes: recentVotes.map(v => ({
      candidateId: v.candidateId,
      timestamp: v.timestamp,
      blockNumber: v.blockNumber,
    })),
  });
}
```

#### 4. Deploy Lambda Functions

```bash
# Create IAM role for Lambda
aws iam create-role --role-name blockvote-lambda-role --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Principal": { "Service": "lambda.amazonaws.com" }, "Action": "sts:AssumeRole" }]
}'

# Package and deploy
cd lambda
zip -r function.zip .
aws lambda create-function \
  --function-name blockvote-event-listener \
  --runtime nodejs20.x \
  --handler eventListener.handler \
  --role arn:aws:iam::<ACCOUNT_ID>:role/blockvote-lambda-role \
  --zip-file fileb://function.zip \
  --timeout 900 \
  --memory-size 256

# Schedule aggregation every 5 minutes
aws events put-rule --name blockvote-aggregate --schedule-expression "rate(5 minutes)"
aws events put-targets --rule blockvote-aggregate --targets "Id"="1","Arn"="arn:aws:lambda:...:blockvote-aggregate"
```

### Dashboard Metrics Available

| Metric | Update Frequency | Source |
|--------|-----------------|--------|
| Total votes cast | Real-time | `vote_events` |
| Votes per hour chart | Real-time | `hourly_stats` |
| Voter turnout percentage | Every 5 min | `election_stats` |
| Candidate vote distribution | Real-time | `hourly_stats` |
| Time-series vote activity | Real-time | `vote_events` |
| Peak voting hours | Every 5 min | `hourly_stats` |

---

## Cloud Integration 3: Edge Computing for Low Latency

### Concept

To handle "peak periods" where millions vote simultaneously, deploy voter validation logic to AWS Edge locations (CloudFront + Lambda@Edge). This performs a "pre-flight" check to verify the voter hasn't already voted and is registered — using a fast cloud cache — BEFORE the voter's transaction hits the main Ethereum network and incurs gas fees.

### Architecture

```
┌──────────┐     ┌─────────────────────┐     ┌──────────────────────┐
│  Voter   │────▶│  CloudFront Edge   │────▶│  Lambda@Edge:        │
│  Browser │     │  (Nearest PoP)      │     │  PreFlightValidator  │
│          │     │                     │     │                      │
│  Mumbai  │     │  Edge Location:     │     │  1. Check DynamoDB   │
│  Pune    │     │  Mumbai PoP         │     │     Global Table     │
│  Delhi   │     │  Delhi PoP          │     │  2. Verify voter     │
│          │     │  Chennai PoP        │     │     registration     │
└──────────┘     └─────────────────────┘     │  3. Check duplicate  │
                                              │     vote             │
                                              └──────────┬───────────┘
                                                         │
                                              ┌──────────▼───────────┐
                                              │  Pass? ───────────▶  │
                                              │                      │
                                              │  ┌──────────────┐   │
                                              │  │ API Gateway   │   │
                                              │  │ /api/votes    │   │
                                              │  │ (Origin)      │   │
                                              │  └──────┬───────┘   │
                                              │         │            │
                                              │  ┌──────▼───────┐   │
                                              │  │ Relay Server  │   │
                                              │  │ → Blockchain  │   │
                                              │  └──────────────┘   │
                                              │                      │
                                              │  Fail? → 403        │
                                              │  (No gas wasted!)    │
                                              └──────────────────────┘
```

### Implementation Steps

#### 1. DynamoDB Global Table (Edge Cache)

```bash
# Create DynamoDB table with Global Tables for edge access
aws dynamodb create-table \
  --table-name blockvote-voter-cache \
  --attribute-definitions \
    AttributeName=nullifierHash,AttributeType=S \
    AttributeName=electionId,AttributeType=N \
  --key-schema \
    AttributeName=nullifierHash,KeyType=HASH \
    AttributeName=electionId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1

# Enable Global Tables for multi-region edge access
aws dynamodb create-global-table \
  --global-table-name blockvote-voter-cache \
  --replication-group RegionName=ap-south-1 RegionName=ap-southeast-1 RegionName=us-east-1
```

#### 2. Cache Sync Lambda (Keeps DynamoDB in sync with blockchain)

```javascript
// lambda/cacheSync.js
// Triggered by VoteCast and VoterRegistered events

import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';

const dynamo = new DynamoDBClient({ region: 'ap-south-1' });

export async function syncVoterRegistration(nullifierHash) {
  await dynamo.send(new PutItemCommand({
    TableName: 'blockvote-voter-cache',
    Item: {
      nullifierHash: { S: nullifierHash },
      electionId: { N: '0' },  // Registration record
      isRegistered: { BOOL: true },
      registeredAt: { S: new Date().toISOString() },
    },
  }));
}

export async function syncVoteCast(nullifierHash, electionId) {
  await dynamo.send(new PutItemCommand({
    TableName: 'blockvote-voter-cache',
    Item: {
      nullifierHash: { S: nullifierHash },
      electionId: { N: String(electionId) },
      hasVoted: { BOOL: true },
      votedAt: { S: new Date().toISOString() },
    },
  }));
}
```

#### 3. Lambda@Edge Pre-Flight Validator

```javascript
// lambda-edge/preFlightValidator.js
// Deployed to CloudFront as origin-request trigger

import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const dynamo = new DynamoDBClient({ region: 'ap-south-1' });

export async function handler(event) {
  const request = event.Records[0].cf.request;

  // Only intercept vote submission requests
  if (request.uri !== '/api/votes' || request.method !== 'POST') {
    return request; // Pass through to origin
  }

  try {
    const body = JSON.parse(Buffer.from(request.body.data, 'base64').toString());
    const { nullifierHash, electionId } = body;

    // Check 1: Is the voter registered?
    const regCheck = await dynamo.send(new GetItemCommand({
      TableName: 'blockvote-voter-cache',
      Key: {
        nullifierHash: { S: nullifierHash },
        electionId: { N: '0' },
      },
    }));

    if (!regCheck.Item?.isRegistered?.BOOL) {
      return {
        status: '403',
        statusDescription: 'Forbidden',
        headers: { 'content-type': [{ value: 'application/json' }] },
        body: JSON.stringify({ error: 'Voter not registered', cached: true }),
      };
    }

    // Check 2: Has the voter already voted in this election?
    const voteCheck = await dynamo.send(new GetItemCommand({
      TableName: 'blockvote-voter-cache',
      Key: {
        nullifierHash: { S: nullifierHash },
        electionId: { N: String(electionId) },
      },
    }));

    if (voteCheck.Item?.hasVoted?.BOOL) {
      return {
        status: '409',
        statusDescription: 'Conflict',
        headers: { 'content-type': [{ value: 'application/json' }] },
        body: JSON.stringify({ error: 'Already voted in this election', cached: true }),
      };
    }

    // All checks passed — forward to origin
    return request;

  } catch (err) {
    console.error('Pre-flight check failed:', err);
    // On error, fail-open to the origin (don't block legitimate voters)
    return request;
  }
}
```

#### 4. CloudFront Distribution

```bash
# Create CloudFront distribution with Lambda@Edge
aws cloudfront create-distribution --distribution-config '{
  "Origins": {
    "Items": [{
      "Id": "blockvote-origin",
      "DomainName": "your-alb-domain.elb.amazonaws.com",
      "CustomOriginConfig": {
        "HTTPPort": 80,
        "HTTPSPort": 443,
        "OriginProtocolPolicy": "https-only"
      }
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "blockvote-origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "LambdaFunctionAssociations": {
      "Items": [{
        "EventType": "origin-request",
        "LambdaFunctionARN": "arn:aws:lambda:us-east-1:<ACCOUNT_ID>:function:preFlightValidator:1"
      }]
    },
    "ForwardedValues": {
      "QueryString": true,
      "Cookies": { "Forward": "all" }
    }
  },
  "Enabled": true,
  "Comment": "Block Vote DApp with Edge Pre-flight",
  "Aliases": { "Items": ["yourdomain.com"] },
  "ViewerCertificate": {
    "ACMCertificateArn": "arn:aws:acm:us-east-1:<ACCOUNT_ID>:certificate/xxxx",
    "SSLSupportMethod": "sni-only"
  }
}'
```

### Performance Benefits

| Metric | Without Edge | With Edge |
|--------|-------------|-----------|
| Duplicate vote rejection | ~3-5s (blockchain query) | ~50ms (DynamoDB edge) |
| Unregistered voter rejection | ~3-5s (blockchain query) | ~50ms (DynamoDB edge) |
| Gas wasted on invalid txs | ~$0.50-$2 per tx | $0 (rejected at edge) |
| Spam attack mitigation | None | Rate-limited at edge |
| Geographic latency (India) | 200-500ms | 10-30ms |

---

## Cost Estimation

### Small Scale (College Election, ~1,000 voters)

| Service | Monthly Cost |
|---------|-------------|
| EC2 t3.micro (free tier) | $0 |
| MongoDB Atlas M0 (free tier) | $0 |
| Alchemy Free RPC | $0 |
| Route 53 | $0.50 |
| ACM SSL | $0 |
| **Total** | **~$0.50/month** |

### Medium Scale (Organization, ~50,000 voters)

| Service | Monthly Cost |
|---------|-------------|
| EC2 t3.medium | ~$30 |
| MongoDB Atlas M10 | ~$57 |
| Alchemy Growth RPC | ~$49 |
| CloudFront | ~$5 |
| Lambda (event listener) | ~$2 |
| Route 53 | $0.50 |
| **Total** | **~$145/month** |

### Large Scale (State/National, ~1M+ voters)

| Service | Monthly Cost |
|---------|-------------|
| ECS Fargate (4 tasks) | ~$120 |
| MongoDB Atlas M30 | ~$840 |
| Alchemy Enterprise RPC | ~$399 |
| CloudFront + Lambda@Edge | ~$50 |
| DynamoDB Global Tables | ~$25 |
| Rekognition (biometric) | ~$100 |
| Lambda (analytics) | ~$10 |
| Route 53 + CloudWatch | ~$10 |
| **Total** | **~$1,555/month** |

### Gas Costs (Blockchain Transactions)

| Network | Cost per Vote | 1M Votes Total |
|---------|--------------|----------------|
| Ethereum Mainnet | ~$0.50-$5 | $500K-$5M |
| Ethereum Sepolia | $0 (testnet) | $0 |
| Polygon PoS | ~$0.001 | ~$1,000 |
| Arbitrum | ~$0.01 | ~$10,000 |
| Base | ~$0.001 | ~$1,000 |

> 💡 **Recommendation**: Use **Polygon PoS** or **Arbitrum** for production elections to keep gas costs under $10K for 1M voters.

---

## Quick Start Checklist

- [ ] Choose deployment option (EC2 / ECS / Amplify)
- [ ] Set up MongoDB Atlas cluster
- [ ] Choose blockchain network (Sepolia testnet → Polygon/Arbitrum mainnet)
- [ ] Get Alchemy/Infura RPC API key
- [ ] Generate new wallet keys (NEVER use Hardhat defaults!)
- [ ] Store secrets in AWS Secrets Manager
- [ ] Deploy smart contract to chosen network
- [ ] Configure domain + SSL
- [ ] Deploy Next.js app
- [ ] Set up CI/CD pipeline
- [ ] Configure CloudWatch monitoring
- [ ] (Optional) Implement biometric verification
- [ ] (Optional) Deploy event listener Lambda
- [ ] (Optional) Set up CloudFront edge validation
- [ ] Test end-to-end with a test election
