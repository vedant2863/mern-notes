# File 37: Lab — Helm, Kustomize & ArgoCD

**Topic:** Hands-on lab creating Helm charts, Kustomize overlays, and deploying with ArgoCD GitOps

**WHY THIS MATTERS:** Understanding Helm, Kustomize, and ArgoCD separately is one thing. Using them together in a realistic workflow — create a chart, customize it for environments, deploy it via GitOps, and watch ArgoCD handle drift — is where the real learning happens. This lab simulates a real production deployment pipeline.

---

## Prerequisites

| Tool | Purpose | Install Command |
|------|---------|-----------------|
| **kind** | Local Kubernetes cluster | `brew install kind` or `go install sigs.k8s.io/kind@latest` |
| **kubectl** | Kubernetes CLI | `brew install kubectl` or `curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/$(uname -s | tr '[:upper:]' '[:lower:]')/amd64/kubectl"` |
| **helm** | Kubernetes package manager | `brew install helm` or `curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 \| bash` |
| **argocd CLI** | ArgoCD command-line tool | `brew install argocd` or `curl -sSL -o argocd-linux-amd64 https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64 && sudo install -m 555 argocd-linux-amd64 /usr/local/bin/argocd && rm argocd-linux-amd64` |
| **git** | Version control | `brew install git` (usually pre-installed) |

---

## Cluster Setup

```bash
# Step 1: Create a kind cluster
cat <<EOF | kind create cluster --name helm-gitops-lab --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30080
        hostPort: 30080
        protocol: TCP
      - containerPort: 30443
        hostPort: 30443
        protocol: TCP
  - role: worker
  - role: worker
EOF

# EXPECTED OUTPUT:
# Creating cluster "helm-gitops-lab" ...
#  ✓ Ensuring node image (kindest/node:v1.31.0) 🖼
#  ✓ Preparing nodes 📦 📦 📦
#  ✓ Writing configuration 📜
#  ✓ Starting control-plane 🕹️
#  ✓ Installing CNI 🔌
#  ✓ Installing StorageClass 💾
#  ✓ Joining worker nodes 🚜
# Set kubectl context to "kind-helm-gitops-lab"

# Step 2: Verify cluster
kubectl get nodes

# EXPECTED OUTPUT:
# NAME                             STATUS   ROLES           AGE   VERSION
# helm-gitops-lab-control-plane    Ready    control-plane   60s   v1.31.0
# helm-gitops-lab-worker           Ready    <none>          45s   v1.31.0
# helm-gitops-lab-worker2          Ready    <none>          45s   v1.31.0

# Step 3: Create a working directory for this lab
mkdir -p /tmp/helm-gitops-lab && cd /tmp/helm-gitops-lab
```

---

## Exercise 1: Create a Helm Chart from Scratch

### Step 1: Scaffold the Chart

```bash
# Create a new Helm chart
cd /tmp/helm-gitops-lab
helm create webapp

# EXPECTED OUTPUT:
# Creating webapp

# Explore the generated structure
find webapp/ -type f

# EXPECTED OUTPUT:
# webapp/Chart.yaml
# webapp/values.yaml
# webapp/.helmignore
# webapp/templates/NOTES.txt
# webapp/templates/_helpers.tpl
# webapp/templates/deployment.yaml
# webapp/templates/hpa.yaml
# webapp/templates/ingress.yaml
# webapp/templates/service.yaml
# webapp/templates/serviceaccount.yaml
# webapp/templates/tests/test-connection.yaml
```

### Step 2: Customize Chart.yaml

```bash
# Replace the default Chart.yaml with our custom one
cat > webapp/Chart.yaml <<'EOF'
apiVersion: v2
name: webapp
description: A demo web application Helm chart for the lab
type: application
version: 0.1.0
appVersion: "1.0.0"
keywords:
  - web
  - demo
  - lab
maintainers:
  - name: Lab Student
    email: student@example.com
EOF

# Verify
cat webapp/Chart.yaml

# EXPECTED OUTPUT:
# apiVersion: v2
# name: webapp
# description: A demo web application Helm chart for the lab
# ...
```

### Step 3: Customize values.yaml

```bash
# Create custom values.yaml
cat > webapp/values.yaml <<'EOF'
replicaCount: 1

image:
  repository: nginx
  pullPolicy: IfNotPresent
  tag: "1.25"

service:
  type: ClusterIP
  port: 80

resources:
  requests:
    cpu: 50m
    memory: 64Mi
  limits:
    cpu: 200m
    memory: 128Mi

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80

ingress:
  enabled: false

serviceAccount:
  create: true
  name: ""

env:
  APP_ENV: "development"
  LOG_LEVEL: "info"

configData:
  index.html: |
    <!DOCTYPE html>
    <html>
    <head><title>Helm Lab App</title></head>
    <body>
    <h1>Hello from Helm!</h1>
    <p>Environment: PLACEHOLDER</p>
    <p>Version: PLACEHOLDER</p>
    </body>
    </html>
EOF
```

### Step 4: Add a ConfigMap Template

```bash
# Create a ConfigMap template for custom nginx content
cat > webapp/templates/configmap.yaml <<'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "webapp.fullname" . }}-content
  labels:
    {{- include "webapp.labels" . | nindent 4 }}
data:
  {{- range $key, $value := .Values.configData }}
  {{ $key }}: |
    {{- $value | nindent 4 }}
  {{- end }}
EOF
```

### Step 5: Update Deployment to Use ConfigMap

```bash
# Update the deployment template to mount the ConfigMap
cat > webapp/templates/deployment.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "webapp.fullname" . }}
  labels:
    {{- include "webapp.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "webapp.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
      labels:
        {{- include "webapp.selectorLabels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ include "webapp.serviceAccountName" . }}
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: 80
              protocol: TCP
          env:
            {{- range $key, $value := .Values.env }}
            - name: {{ $key }}
              value: {{ $value | quote }}
            {{- end }}
          volumeMounts:
            - name: content
              mountPath: /usr/share/nginx/html
              readOnly: true
          livenessProbe:
            httpGet:
              path: /
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /
              port: http
            initialDelaySeconds: 3
            periodSeconds: 5
          {{- with .Values.resources }}
          resources:
            {{- toYaml . | nindent 12 }}
          {{- end }}
      volumes:
        - name: content
          configMap:
            name: {{ include "webapp.fullname" . }}-content
EOF
```

### Step 6: Validate and Install for Dev

```bash
# Lint the chart for errors
helm lint webapp/

# EXPECTED OUTPUT:
# ==> Linting webapp/
# [INFO] Chart.yaml: icon is recommended
# 1 chart(s) linted, 0 chart(s) failed

# Render templates to verify output (no cluster needed)
helm template dev-release webapp/ --namespace dev
# EXPECTED OUTPUT: rendered Kubernetes YAML for all resources

# Install for dev environment
kubectl create namespace dev
helm install dev-release webapp/ \
  --namespace dev \
  --set replicaCount=1 \
  --set env.APP_ENV=development \
  --set env.LOG_LEVEL=debug

# EXPECTED OUTPUT:
# NAME: dev-release
# NAMESPACE: dev
# STATUS: deployed
# REVISION: 1

# Verify pods
kubectl get pods -n dev

# EXPECTED OUTPUT:
# NAME                                  READY   STATUS    RESTARTS   AGE
# dev-release-webapp-xxxxxxxxx-xxxxx    1/1     Running   0          30s
```

### Step 7: Install for Prod with Different Values

```bash
# Create a prod values file
cat > /tmp/helm-gitops-lab/values-prod.yaml <<'EOF'
replicaCount: 3

image:
  repository: nginx
  tag: "1.25"

resources:
  requests:
    cpu: 200m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi

env:
  APP_ENV: "production"
  LOG_LEVEL: "warn"

configData:
  index.html: |
    <!DOCTYPE html>
    <html><head><title>Production App</title></head>
    <body><h1>Production Environment</h1></body></html>
EOF

# Install for prod
kubectl create namespace prod
helm install prod-release webapp/ --namespace prod -f values-prod.yaml

# EXPECTED OUTPUT:
# NAME: prod-release
# NAMESPACE: prod
# STATUS: deployed

# Verify prod has 3 replicas
kubectl get pods -n prod

# EXPECTED OUTPUT:
# NAME                                   READY   STATUS    RESTARTS   AGE
# prod-release-webapp-xxxxxxxxx-xxxxx    1/1     Running   0          30s
# prod-release-webapp-xxxxxxxxx-yyyyy    1/1     Running   0          30s
# prod-release-webapp-xxxxxxxxx-zzzzz    1/1     Running   0          30s

# Compare releases
helm list --all-namespaces

# EXPECTED OUTPUT:
# NAME           NAMESPACE  REVISION  STATUS    CHART         APP VERSION
# dev-release    dev        1         deployed  webapp-0.1.0  1.0.0
# prod-release   prod       1         deployed  webapp-0.1.0  1.0.0
```

### Verification

```bash
# Test deployments via port-forward
kubectl port-forward svc/dev-release-webapp 8081:80 -n dev &
kubectl port-forward svc/prod-release-webapp 8082:80 -n prod &
sleep 2

curl -s http://localhost:8081 | head -3
# EXPECTED OUTPUT: HTML with "Hello from Helm!"

curl -s http://localhost:8082 | head -3
# EXPECTED OUTPUT: HTML with "Production Environment"

pkill -f "kubectl port-forward" 2>/dev/null || true

# Check environment variables
kubectl exec -n dev deploy/dev-release-webapp -- env | grep -E "APP_ENV|LOG_LEVEL"
# EXPECTED OUTPUT: APP_ENV=development, LOG_LEVEL=debug

kubectl exec -n prod deploy/prod-release-webapp -- env | grep -E "APP_ENV|LOG_LEVEL"
# EXPECTED OUTPUT: APP_ENV=production, LOG_LEVEL=warn
```

---

## Exercise 2: Create Kustomize Base + Overlays

### Step 1: Create Directory Structure

```bash
cd /tmp/helm-gitops-lab

# Create Kustomize directory structure
mkdir -p kustomize-app/base
mkdir -p kustomize-app/overlays/dev
mkdir -p kustomize-app/overlays/prod

# Verify structure
find kustomize-app/ -type d

# EXPECTED OUTPUT:
# kustomize-app/
# kustomize-app/base
# kustomize-app/overlays
# kustomize-app/overlays/dev
# kustomize-app/overlays/prod
```

### Step 2: Create Base Manifests

```bash
# Base deployment
cat > kustomize-app/base/deployment.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kustom-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kustom-app
  template:
    metadata:
      labels:
        app: kustom-app
    spec:
      containers:
        - name: app
          image: nginx:1.25
          ports:
            - containerPort: 80
          envFrom:
            - configMapRef:
                name: kustom-app-config
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 128Mi
EOF

# Base service
cat > kustomize-app/base/service.yaml <<'EOF'
apiVersion: v1
kind: Service
metadata:
  name: kustom-app
spec:
  selector:
    app: kustom-app
  ports:
    - port: 80
      targetPort: 80
EOF

# Base configmap
cat > kustomize-app/base/configmap.yaml <<'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: kustom-app-config
data:
  APP_ENV: "base"
  LOG_LEVEL: "info"
  CACHE_TTL: "300"
EOF

# Base kustomization.yaml
cat > kustomize-app/base/kustomization.yaml <<'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

commonLabels:
  app: kustom-app
  managed-by: kustomize

resources:
  - deployment.yaml
  - service.yaml
  - configmap.yaml
EOF
```

### Step 3: Create Dev Overlay

```bash
# Dev kustomization
cat > kustomize-app/overlays/dev/kustomization.yaml <<'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

namespace: kustom-dev

namePrefix: dev-

commonLabels:
  environment: dev

images:
  - name: nginx
    newTag: 1.25-alpine

patches:
  - path: config-patch.yaml
EOF

# Dev config patch
cat > kustomize-app/overlays/dev/config-patch.yaml <<'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: kustom-app-config
data:
  APP_ENV: "development"
  LOG_LEVEL: "debug"
  CACHE_TTL: "10"
  DEBUG_MODE: "true"
EOF
```

### Step 4: Create Prod Overlay

```bash
# Prod kustomization
cat > kustomize-app/overlays/prod/kustomization.yaml <<'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base
  - hpa.yaml

namespace: kustom-prod

namePrefix: prod-

commonLabels:
  environment: production

commonAnnotations:
  team: platform-engineering

images:
  - name: nginx
    newTag: "1.25"

patches:
  - path: replica-patch.yaml
  - path: resource-patch.yaml
  - path: config-patch.yaml
EOF

# Prod replica patch
cat > kustomize-app/overlays/prod/replica-patch.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kustom-app
spec:
  replicas: 3
EOF

# Prod resource patch
cat > kustomize-app/overlays/prod/resource-patch.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kustom-app
spec:
  template:
    spec:
      containers:
        - name: app
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
EOF

# Prod config patch
cat > kustomize-app/overlays/prod/config-patch.yaml <<'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: kustom-app-config
data:
  APP_ENV: "production"
  LOG_LEVEL: "warn"
  CACHE_TTL: "3600"
EOF

# Prod HPA (additional resource, not in base)
cat > kustomize-app/overlays/prod/hpa.yaml <<'EOF'
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: prod-kustom-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: prod-kustom-app
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
EOF
```

### Step 5: Compare and Apply

```bash
# Render and compare overlays
kubectl kustomize kustomize-app/overlays/dev/
# KEY OUTPUT: namespace=kustom-dev, prefix=dev-, 1 replica, LOG_LEVEL=debug, nginx:1.25-alpine

kubectl kustomize kustomize-app/overlays/prod/
# KEY OUTPUT: namespace=kustom-prod, prefix=prod-, 3 replicas, LOG_LEVEL=warn, nginx:1.25, HPA included

# Side-by-side diff
diff <(kubectl kustomize kustomize-app/overlays/dev/) <(kubectl kustomize kustomize-app/overlays/prod/)
# Shows all differences: namespace, replicas, resources, config, HPA

# Apply dev overlay
kubectl create namespace kustom-dev
kubectl apply -k kustomize-app/overlays/dev/

# EXPECTED OUTPUT:
# configmap/dev-kustom-app-config created
# service/dev-kustom-app created
# deployment.apps/dev-kustom-app created

# Verify
kubectl get all -n kustom-dev

# EXPECTED OUTPUT:
# pod/dev-kustom-app-xxxxxxxxx-xxxxx    1/1     Running   0          30s
# service/dev-kustom-app                ClusterIP   10.96.x.x    80/TCP
# deployment.apps/dev-kustom-app        1/1     1            1         30s
```

### Verification

```bash
# Verify dev config
kubectl get configmap dev-kustom-app-config -n kustom-dev -o yaml | grep -A5 "data:"
# EXPECTED: APP_ENV=development, LOG_LEVEL=debug, DEBUG_MODE=true

# Verify labels include environment: dev
kubectl get deployment dev-kustom-app -n kustom-dev --show-labels
# EXPECTED: app=kustom-app, environment=dev, managed-by=kustomize
```

---

## Exercise 3: Install ArgoCD and Deploy from Git

### Step 1: Install ArgoCD

```bash
# Create ArgoCD namespace and install
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# EXPECTED OUTPUT: Multiple CRDs, ServiceAccounts, Deployments, Services created

# Wait for ArgoCD to be ready (may take 1-2 minutes)
kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=180s
# EXPECTED OUTPUT: deployment.apps/argocd-server condition met

# Verify all ArgoCD pods are running
kubectl get pods -n argocd

# EXPECTED OUTPUT: 7 pods all in Running state:
# argocd-application-controller-0, argocd-applicationset-controller-xxx,
# argocd-dex-server-xxx, argocd-notifications-controller-xxx,
# argocd-redis-xxx, argocd-repo-server-xxx, argocd-server-xxx
```

### Step 2: Access ArgoCD and Login

```bash
# Get the initial admin password
ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
echo "ArgoCD Password: $ARGOCD_PASSWORD"
# EXPECTED OUTPUT: ArgoCD Password: xK2j9m4pQ8nR5tYw (random string)

# Port-forward ArgoCD server and login
kubectl port-forward svc/argocd-server 8080:443 -n argocd &
sleep 3
argocd login localhost:8080 --insecure --username admin --password "$ARGOCD_PASSWORD"
# EXPECTED OUTPUT: 'admin:login' logged in successfully
```

### Step 3: Create ArgoCD Application

```bash
# We'll use ArgoCD's official example repo to demonstrate GitOps
kubectl create namespace argocd-demo

# Create ArgoCD Application pointing to a public Git repo
cat > /tmp/helm-gitops-lab/argocd-app.yaml <<'EOF'
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: demo-app
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: guestbook
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd-demo
  syncPolicy:
    syncOptions:
      - CreateNamespace=true
EOF

kubectl apply -f /tmp/helm-gitops-lab/argocd-app.yaml
# EXPECTED OUTPUT: application.argoproj.io/demo-app created
```

### Step 4: Sync and Verify

```bash
# Check application status (should be OutOfSync initially)
argocd app get demo-app
# EXPECTED: Sync Status: OutOfSync, Health Status: Missing

# Sync the application
argocd app sync demo-app

# EXPECTED OUTPUT:
# guestbook-ui   Synced   Healthy
# Sync Status:   Synced to HEAD (abc1234)
# Health Status:  Healthy

# Verify resources
kubectl get all -n argocd-demo

# EXPECTED OUTPUT:
# pod/guestbook-ui-xxxxxxxxx-xxxxx    1/1     Running   0          30s
# service/guestbook-ui                ClusterIP   10.96.x.x    80/TCP
# deployment.apps/guestbook-ui        1/1     1            1         30s

# Verify in ArgoCD UI at https://localhost:8080
# Click "demo-app" — you should see green "Synced" and "Healthy" status
# with a visual resource tree: Application -> Service + Deployment -> ReplicaSet -> Pod
```

---

## Exercise 4: Detect Drift and Auto-Sync

### Step 1: Make a Manual kubectl Change (Simulate Drift)

```bash
# First, check current replicas
kubectl get deployment guestbook-ui -n argocd-demo

# EXPECTED OUTPUT:
# NAME           READY   UP-TO-DATE   AVAILABLE   AGE
# guestbook-ui   1/1     1            1           5m

# Make a manual change — scale up replicas directly (bypassing Git)
kubectl scale deployment guestbook-ui --replicas=5 -n argocd-demo

# EXPECTED OUTPUT:
# deployment.apps/guestbook-ui scaled

# Verify the change took effect
kubectl get deployment guestbook-ui -n argocd-demo

# EXPECTED OUTPUT:
# NAME           READY   UP-TO-DATE   AVAILABLE   AGE
# guestbook-ui   5/5     5            5           6m
```

### Step 2: Observe ArgoCD Detect Drift

```bash
# Wait a moment for ArgoCD to detect the change (polls every 3 minutes by default)
# Or trigger a refresh manually:
argocd app get demo-app --refresh

# EXPECTED OUTPUT:
# Name:               argocd/demo-app
# ...
# Sync Status:        OutOfSync    <-- ArgoCD detected the drift!
# Health Status:      Healthy

# Check the diff — what's different between Git and cluster
argocd app diff demo-app

# EXPECTED OUTPUT:
# ===== apps/Deployment argocd-demo/guestbook-ui ======
# --- /path/to/git/version
# +++ /path/to/live/version
# @@ ... @@
# -  replicas: 1
# +  replicas: 5

# ArgoCD shows that Git says 1 replica, but the cluster has 5
# This is "drift" — the cluster state no longer matches Git
```

### Step 3: Enable Auto-Sync with Self-Heal

```bash
# Enable automated sync with self-heal
argocd app set demo-app \
  --sync-policy automated \
  --auto-prune \
  --self-heal

# EXPECTED OUTPUT:
# (no output — settings applied)

# Verify the sync policy
argocd app get demo-app

# EXPECTED OUTPUT:
# ...
# Sync Policy:        Automated (Prune, SelfHeal)
# Sync Status:        Synced    <-- ArgoCD already synced back to 1 replica!
# ...

# Check replicas — ArgoCD should have reverted the manual change
kubectl get deployment guestbook-ui -n argocd-demo

# EXPECTED OUTPUT:
# NAME           READY   UP-TO-DATE   AVAILABLE   AGE
# guestbook-ui   1/1     1            1           10m

# ArgoCD reverted from 5 replicas back to 1 (what Git says)!
```

### Step 4: Test Again — Watch Self-Heal in Action

```bash
# Make another manual change and watch it revert in real time
kubectl scale deployment guestbook-ui --replicas=10 -n argocd-demo
kubectl get deployment guestbook-ui -n argocd-demo -w

# EXPECTED OUTPUT (watch mode):
# guestbook-ui   1/10     1            1           12m    <-- manual scale to 10
# guestbook-ui   1/1      1            1           12m    <-- ArgoCD reverts to 1!
# Press Ctrl+C to stop watching

# Check sync history — each self-heal creates an entry
argocd app history demo-app

# EXPECTED OUTPUT:
# ID  DATE                           REVISION
# 0   2026-03-16 12:30:00 +0000 UTC  HEAD (abc1234)
# 1   2026-03-16 12:35:00 +0000 UTC  HEAD (abc1234)  <-- self-heal sync
# 2   2026-03-16 12:40:00 +0000 UTC  HEAD (abc1234)  <-- self-heal sync again
# WHY: Same revision — Git didn't change, ArgoCD just re-applied Git state
```

### Verification

```bash
# Final verification
argocd app get demo-app
# EXPECTED: Sync Policy: Automated (Prune, SelfHeal), Sync Status: Synced, Health: Healthy

# VERIFY in ArgoCD UI at https://localhost:8080:
# 1. Click "demo-app" -> check "LAST SYNC RESULT" shows multiple self-heal syncs
# 2. Click "APP DIFF" -> no diff (cluster matches Git)
# 3. All resource tree nodes should be green

# KEY LEARNING: With self-heal enabled:
# - Manual kubectl changes are automatically reverted
# - Git is ALWAYS the source of truth
# - The only way to change the cluster is through Git commits
# - This provides audit trail, code review, and easy rollback
```

---

## Cleanup

```bash
# Step 1: Delete ArgoCD application (this also deletes managed resources due to finalizer)
argocd app delete demo-app --cascade -y

# EXPECTED OUTPUT:
# application 'demo-app' deleted

# Wait for resources to be cleaned up
sleep 10

# Step 2: Delete ArgoCD
kubectl delete -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml 2>/dev/null
kubectl delete namespace argocd

# Step 3: Delete Kustomize resources
kubectl delete -k /tmp/helm-gitops-lab/kustomize-app/overlays/dev/ 2>/dev/null

# Step 4: Delete Helm releases
helm uninstall dev-release -n dev 2>/dev/null
helm uninstall prod-release -n prod 2>/dev/null

# Step 5: Delete namespaces
kubectl delete namespace dev prod kustom-dev argocd-demo 2>/dev/null

# Step 6: Delete the kind cluster
kind delete cluster --name helm-gitops-lab
# EXPECTED OUTPUT: Deleting cluster "helm-gitops-lab" ...

# Step 7: Clean up temp files and port-forwards
rm -rf /tmp/helm-gitops-lab
pkill -f "kubectl port-forward" 2>/dev/null || true

# VERIFICATION:
kind get clusters
# EXPECTED OUTPUT: (empty — no clusters listed)
```
