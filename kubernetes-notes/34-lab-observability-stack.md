# File 34: Lab — Observability Stack

**Topic:** Hands-on lab deploying Prometheus, Grafana, Loki, and debugging broken applications

**WHY THIS MATTERS:** Theory without practice is forgettable. This lab walks you through deploying a complete observability stack, writing real PromQL and LogQL queries, and debugging the most common Kubernetes failures you will encounter in production.

---

## Prerequisites

| Tool | Purpose | Install Command |
|------|---------|-----------------|
| **kind** | Local Kubernetes cluster | `brew install kind` or `go install sigs.k8s.io/kind@latest` |
| **kubectl** | Kubernetes CLI | `brew install kubectl` or `curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/$(uname -s | tr '[:upper:]' '[:lower:]')/amd64/kubectl"` |
| **helm** | Kubernetes package manager | `brew install helm` or `curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 \| bash` |
| **Helm repos** | Chart repositories | `helm repo add prometheus-community https://prometheus-community.github.io/helm-charts && helm repo add grafana https://grafana.github.io/helm-charts && helm repo update` |

---

## Cluster Setup

```bash
# Step 1: Create a kind cluster with extra port mappings for Grafana/Prometheus
cat <<EOF | kind create cluster --name observability-lab --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:
      - containerPort: 30080
        hostPort: 30080
        protocol: TCP
      - containerPort: 30090
        hostPort: 30090
        protocol: TCP
  - role: worker
  - role: worker
EOF

# EXPECTED OUTPUT:
# Creating cluster "observability-lab" ...
#  ✓ Ensuring node image (kindest/node:v1.31.0) 🖼
#  ✓ Preparing nodes 📦 📦 📦
#  ✓ Writing configuration 📜
#  ✓ Starting control-plane 🕹️
#  ✓ Installing CNI 🔌
#  ✓ Installing StorageClass 💾
#  ✓ Joining worker nodes 🚜
# Set kubectl context to "kind-observability-lab"

# Step 2: Verify cluster is ready
kubectl get nodes

# EXPECTED OUTPUT:
# NAME                              STATUS   ROLES           AGE   VERSION
# observability-lab-control-plane   Ready    control-plane   60s   v1.31.0
# observability-lab-worker          Ready    <none>          45s   v1.31.0
# observability-lab-worker2         Ready    <none>          45s   v1.31.0

# Step 3: Create namespaces
kubectl create namespace monitoring
kubectl create namespace logging
kubectl create namespace apps

# Step 4: Add and update Helm repos
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# EXPECTED OUTPUT:
# "prometheus-community" has been added to your repositories
# "grafana" has been added to your repositories
# Hang tight while we grab the latest from your chart repositories...
# ...Successfully got an update from the "prometheus-community" chart repository
# ...Successfully got an update from the "grafana" chart repository
# Update Complete. ⎈Happy Helming!⎈
```

---

## Exercise 1: Install kube-prometheus-stack and Explore Grafana

### Step 1: Install kube-prometheus-stack

```bash
# Install with custom values for the lab environment
helm install kube-prom prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set grafana.adminPassword=lab-password \
  --set grafana.service.type=NodePort \
  --set grafana.service.nodePort=30080 \
  --set prometheus.service.type=NodePort \
  --set prometheus.service.nodePort=30090 \
  --set prometheus.prometheusSpec.retention=2d \
  --set alertmanager.enabled=true \
  --wait --timeout=5m

# FLAGS:
#   --set grafana.service.type=NodePort  — expose Grafana on a NodePort for easy access
#   --set prometheus.prometheusSpec.retention=2d — keep metrics for 2 days (lab, not prod)
#   --wait --timeout=5m — wait up to 5 minutes for all pods to be ready

# EXPECTED OUTPUT:
# NAME: kube-prom
# LAST DEPLOYED: Mon Mar 16 10:00:00 2026
# NAMESPACE: monitoring
# STATUS: deployed
# REVISION: 1
```

### Step 2: Verify all components

```bash
kubectl get pods -n monitoring

# EXPECTED OUTPUT:
# NAME                                                     READY   STATUS    RESTARTS   AGE
# alertmanager-kube-prom-kube-prometheus-alertmanager-0     2/2     Running   0          3m
# kube-prom-grafana-xxxxxxxxx-xxxxx                        3/3     Running   0          3m
# kube-prom-kube-prometheus-operator-xxxxxxxxx-xxxxx       1/1     Running   0          3m
# kube-prom-kube-state-metrics-xxxxxxxxx-xxxxx             1/1     Running   0          3m
# kube-prom-prometheus-node-exporter-xxxxx                 1/1     Running   0          3m
# kube-prom-prometheus-node-exporter-yyyyy                 1/1     Running   0          3m
# kube-prom-prometheus-node-exporter-zzzzz                 1/1     Running   0          3m
# prometheus-kube-prom-kube-prometheus-prometheus-0         2/2     Running   0          3m

# Verify services
kubectl get svc -n monitoring

# EXPECTED OUTPUT (key services):
# NAME                                      TYPE        CLUSTER-IP      PORT(S)
# kube-prom-grafana                         NodePort    10.96.x.x       80:30080/TCP
# prometheus-operated                        ClusterIP   None            9090/TCP
# kube-prom-kube-prometheus-alertmanager     ClusterIP   10.96.x.x      9093/TCP
```

### Step 3: Access Grafana Dashboard

```bash
# Option 1: If NodePort works with kind
# Visit http://localhost:30080
# Login: admin / lab-password

# Option 2: Port-forward (more reliable with kind)
kubectl port-forward svc/kube-prom-grafana 3000:80 -n monitoring &

# Visit http://localhost:3000
# Login: admin / lab-password

# VERIFICATION: After logging in:
# 1. Click the hamburger menu (≡) -> Dashboards
# 2. Browse "General" folder
# 3. You should see 30+ pre-built dashboards including:
#    - Kubernetes / Compute Resources / Cluster
#    - Kubernetes / Compute Resources / Namespace (Pods)
#    - Kubernetes / Compute Resources / Node (Pods)
#    - Kubernetes / Networking / Cluster
#    - Node Exporter / Nodes
#    - Prometheus / Overview
```

### Step 4: Deploy a sample application to generate metrics

```bash
# Deploy an nginx app to generate some traffic and metrics
kubectl apply -n apps -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sample-web
  namespace: apps
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sample-web
  template:
    metadata:
      labels:
        app: sample-web
    spec:
      containers:
        - name: nginx
          image: nginx:1.25
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 128Mi
---
apiVersion: v1
kind: Service
metadata:
  name: sample-web
  namespace: apps
spec:
  selector:
    app: sample-web
  ports:
    - port: 80
      targetPort: 80
EOF

# EXPECTED OUTPUT:
# deployment.apps/sample-web created
# service/sample-web created

# Verify pods are running
kubectl get pods -n apps

# EXPECTED OUTPUT:
# NAME                          READY   STATUS    RESTARTS   AGE
# sample-web-xxxxxxxxx-xxxxx   1/1     Running   0          30s
# sample-web-xxxxxxxxx-yyyyy   1/1     Running   0          30s
# sample-web-xxxxxxxxx-zzzzz   1/1     Running   0          30s

# Generate some traffic
kubectl run load-generator --image=busybox:1.36 -n apps --restart=Never -- \
  /bin/sh -c "while true; do wget -qO- http://sample-web.apps.svc/; sleep 0.5; done"
```

### Verification

```bash
# Access Prometheus UI
kubectl port-forward svc/prometheus-operated 9090:9090 -n monitoring &

# Visit http://localhost:9090/targets
# VERIFY: All targets show "UP" status
# You should see targets for:
#   - kube-state-metrics
#   - node-exporter
#   - kubelet
#   - apiserver
#   - alertmanager
#   - prometheus

# In Grafana, go to:
# Dashboards -> Kubernetes / Compute Resources / Namespace (Pods) -> Select namespace "apps"
# VERIFY: You see CPU and memory graphs for the sample-web pods
```

---

## Exercise 2: Write PromQL Queries

### Step 1: Pod CPU Rate

```bash
# Access Prometheus UI at http://localhost:9090
# Enter the following queries in the "Expression" box and click "Execute"

# Query 1: CPU usage rate per pod in the apps namespace
rate(container_cpu_usage_seconds_total{namespace="apps", container!="", container!="POD"}[5m])

# EXPECTED OUTPUT (Table tab):
# container_cpu_usage_seconds_total{container="nginx", pod="sample-web-xxx-xxx"} 0.002345
# container_cpu_usage_seconds_total{container="nginx", pod="sample-web-xxx-yyy"} 0.001876
# container_cpu_usage_seconds_total{container="nginx", pod="sample-web-xxx-zzz"} 0.003012

# WHY: rate() calculates per-second CPU usage from the counter.
# container!="" excludes the pause container. container!="POD" excludes the pod sandbox.
```

### Step 2: Memory Usage

```bash
# Query 2: Memory usage per pod in MB
container_memory_working_set_bytes{namespace="apps", container!="", container!="POD"} / 1024 / 1024

# EXPECTED OUTPUT (Table tab):
# {container="nginx", pod="sample-web-xxx-xxx"} 12.45
# {container="nginx", pod="sample-web-xxx-yyy"} 11.89
# {container="nginx", pod="sample-web-xxx-zzz"} 13.21

# WHY: working_set_bytes is the actual memory in use (excluding cache that can be reclaimed).
# Dividing by 1024^2 converts bytes to MB.

# Query 3: Memory usage as percentage of limit
container_memory_working_set_bytes{namespace="apps", container!="", container!="POD"}
/
container_spec_memory_limit_bytes{namespace="apps", container!="", container!="POD"}
* 100

# EXPECTED OUTPUT:
# {container="nginx", pod="sample-web-xxx-xxx"} 9.73
# WHY: Shows what percentage of the memory limit is being used. Above 80% = danger zone.
```

### Step 3: Error Rate

```bash
# Query 4: HTTP error rate (if using a service mesh or API with metrics)
# Since nginx doesn't expose Prometheus metrics natively, we'll use kube-state-metrics

# Container restart rate (proxy for errors)
rate(kube_pod_container_status_restarts_total{namespace="apps"}[15m]) * 60 * 15

# EXPECTED OUTPUT:
# (should be 0 for healthy pods)
# {container="nginx", pod="sample-web-xxx-xxx"} 0

# Query 5: Pod not ready ratio
kube_pod_status_ready{namespace="apps", condition="false"}

# EXPECTED OUTPUT:
# (should return no results if all pods are healthy)
```

### Step 4: 95th Percentile Latency

```bash
# Query 6: API server request latency P95
histogram_quantile(0.95,
  sum by (le, verb) (
    rate(apiserver_request_duration_seconds_bucket[5m])
  )
)

# EXPECTED OUTPUT (Table tab):
# {verb="GET"}   0.045
# {verb="LIST"}  0.234
# {verb="WATCH"} 0.012
# {verb="POST"}  0.089

# WHY: This shows the 95th percentile latency for Kubernetes API server requests.
# 95% of GET requests complete within 45ms.

# Query 7: P99 latency (even more strict)
histogram_quantile(0.99,
  sum by (le, verb) (
    rate(apiserver_request_duration_seconds_bucket[5m])
  )
)

# WHY: P99 catches the "long tail" — the slowest 1% of requests.
# If P95 is 45ms but P99 is 2s, you have a latency problem affecting some users.
```

### Verification

```bash
# Create a Grafana dashboard with these queries:
# 1. In Grafana, click + -> New Dashboard -> Add Visualization
# 2. Select "Prometheus" as data source
# 3. Enter each query above and add as panels
# 4. Save dashboard as "Lab - Custom Metrics"

# VERIFY: All panels show data. Switch between Table and Graph views.
# The Graph tab shows how metrics change over time.
```

---

## Exercise 3: Install Loki Stack and Query Logs

### Step 1: Install Loki Stack

```bash
# Install Loki with Promtail (log shipper) and Grafana data source
helm install loki grafana/loki-stack \
  --namespace logging \
  --set grafana.enabled=false \
  --set promtail.enabled=true \
  --set loki.persistence.enabled=false \
  --wait --timeout=5m

# FLAGS:
#   --set grafana.enabled=false  — we already have Grafana from kube-prometheus-stack
#   --set promtail.enabled=true  — Promtail ships logs from nodes to Loki
#   --set loki.persistence.enabled=false — no persistent storage for lab

# EXPECTED OUTPUT:
# NAME: loki
# LAST DEPLOYED: Mon Mar 16 11:00:00 2026
# NAMESPACE: logging
# STATUS: deployed

# Verify installation
kubectl get pods -n logging

# EXPECTED OUTPUT:
# NAME                  READY   STATUS    RESTARTS   AGE
# loki-0                1/1     Running   0          2m
# loki-promtail-xxxxx   1/1     Running   0          2m
# loki-promtail-yyyyy   1/1     Running   0          2m
# loki-promtail-zzzzz   1/1     Running   0          2m
```

### Step 2: Add Loki as Data Source in Grafana

```bash
# Add Loki data source to the existing Grafana (from kube-prometheus-stack)
# Option A: Via Grafana UI
# 1. Go to http://localhost:3000
# 2. Navigate to Connections -> Data sources -> Add data source
# 3. Select "Loki"
# 4. URL: http://loki.logging.svc:3100
# 5. Click "Save & Test"

# Option B: Via kubectl (automated)
kubectl apply -n monitoring -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-loki-datasource
  namespace: monitoring
  labels:
    grafana_datasource: "1"
data:
  loki-datasource.yaml: |
    apiVersion: 1
    datasources:
      - name: Loki
        type: loki
        access: proxy
        url: http://loki.logging.svc:3100
        isDefault: false
        editable: true
EOF

# Restart Grafana to pick up the new data source
kubectl rollout restart deployment kube-prom-grafana -n monitoring

# EXPECTED OUTPUT:
# deployment.apps/kube-prom-grafana restarted

# Wait for rollout
kubectl rollout status deployment kube-prom-grafana -n monitoring --timeout=120s
```

### Step 3: Deploy an App with Logging

```bash
# Deploy an app that generates structured logs
kubectl apply -n apps -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: log-generator
  namespace: apps
spec:
  replicas: 2
  selector:
    matchLabels:
      app: log-generator
  template:
    metadata:
      labels:
        app: log-generator
    spec:
      containers:
        - name: logger
          image: busybox:1.36
          command: ["/bin/sh", "-c"]
          args:
            - |
              i=0
              while true; do
                i=$((i+1))
                LEVEL="info"
                if [ $((i % 10)) -eq 0 ]; then LEVEL="warn"; fi
                if [ $((i % 25)) -eq 0 ]; then LEVEL="error"; fi
                echo "{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"level\":\"$LEVEL\",\"message\":\"Processing request $i\",\"request_id\":\"req-$RANDOM\",\"duration_ms\":$((RANDOM % 500))}"
                sleep 2
              done
          resources:
            requests:
              cpu: 10m
              memory: 16Mi
            limits:
              cpu: 50m
              memory: 32Mi
EOF

# EXPECTED OUTPUT:
# deployment.apps/log-generator created

# Verify logs are being generated
kubectl logs -l app=log-generator -n apps --tail=5

# EXPECTED OUTPUT:
# {"timestamp":"2026-03-16T11:05:00Z","level":"info","message":"Processing request 1","request_id":"req-12345","duration_ms":234}
# {"timestamp":"2026-03-16T11:05:02Z","level":"info","message":"Processing request 2","request_id":"req-23456","duration_ms":89}
# ...
```

### Step 4: Query Logs with LogQL

```bash
# In Grafana, go to Explore -> Select "Loki" data source
# Enter these LogQL queries:

# Query 1: All logs from the apps namespace
{namespace="apps"}

# Query 2: Only logs from log-generator
{namespace="apps", app="log-generator"}

# Query 3: Filter for error logs
{namespace="apps", app="log-generator"} |= "error"

# Query 4: Parse JSON and filter by level
{namespace="apps", app="log-generator"} | json | level="error"

# Query 5: Count errors over time (switch to "Metrics" mode in Grafana)
count_over_time({namespace="apps", app="log-generator"} |= "error" [1m])

# Query 6: Parse JSON and show slow requests (>300ms)
{namespace="apps", app="log-generator"} | json | duration_ms > 300

# Query 7: Rate of all log lines per second
rate({namespace="apps", app="log-generator"}[5m])
```

### Verification

```bash
# VERIFY in Grafana Explore:
# 1. Select Loki data source
# 2. Enter: {namespace="apps", app="log-generator"} | json | level="error"
# 3. Click "Run Query"
# 4. EXPECTED: You see only error-level log entries
# 5. Switch to "Metrics" mode at top
# 6. Enter: count_over_time({namespace="apps"} |= "error" [5m])
# 7. EXPECTED: A graph showing error count over time
```

---

## Exercise 4: Debug Deliberately Broken Applications

### Step 1: Deploy 3 Broken Applications

```bash
# Broken App 1: CrashLoopBackOff — container exits immediately
kubectl apply -n apps -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: broken-crashloop
  namespace: apps
spec:
  replicas: 1
  selector:
    matchLabels:
      app: broken-crashloop
  template:
    metadata:
      labels:
        app: broken-crashloop
    spec:
      containers:
        - name: app
          image: busybox:1.36
          command: ["/bin/sh", "-c"]
          args: ["echo 'Starting app...'; echo 'ERROR: Database connection refused at db:5432'; exit 1"]
          resources:
            requests:
              cpu: 10m
              memory: 16Mi
            limits:
              cpu: 50m
              memory: 32Mi
EOF

# EXPECTED OUTPUT:
# deployment.apps/broken-crashloop created

# Broken App 2: ImagePullBackOff — wrong image name
kubectl apply -n apps -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: broken-imagepull
  namespace: apps
spec:
  replicas: 1
  selector:
    matchLabels:
      app: broken-imagepull
  template:
    metadata:
      labels:
        app: broken-imagepull
    spec:
      containers:
        - name: app
          image: nginx:nonexistent-tag-v999
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 10m
              memory: 16Mi
            limits:
              cpu: 50m
              memory: 32Mi
EOF

# EXPECTED OUTPUT:
# deployment.apps/broken-imagepull created

# Broken App 3: Pending — requesting more resources than available
kubectl apply -n apps -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: broken-pending
  namespace: apps
spec:
  replicas: 1
  selector:
    matchLabels:
      app: broken-pending
  template:
    metadata:
      labels:
        app: broken-pending
    spec:
      containers:
        - name: app
          image: nginx:1.25
          resources:
            requests:
              cpu: "64"
              memory: "128Gi"
            limits:
              cpu: "64"
              memory: "128Gi"
EOF

# EXPECTED OUTPUT:
# deployment.apps/broken-pending created
```

### Step 2: Wait and Observe

```bash
# Wait 30 seconds for issues to manifest, then check status
sleep 30
kubectl get pods -n apps

# EXPECTED OUTPUT:
# NAME                                READY   STATUS             RESTARTS      AGE
# broken-crashloop-xxx-xxx            0/1     CrashLoopBackOff   3             30s
# broken-imagepull-xxx-xxx            0/1     ImagePullBackOff   0             30s
# broken-pending-xxx-xxx              0/1     Pending            0             30s
# log-generator-xxx-xxx               1/1     Running            0             10m
# log-generator-xxx-yyy               1/1     Running            0             10m
# sample-web-xxx-xxx                  1/1     Running            0             20m
# ...
```

### Step 3: Debug CrashLoopBackOff

```bash
# Step 3a: Check pod status
kubectl get pods -n apps -l app=broken-crashloop

# EXPECTED OUTPUT:
# NAME                                READY   STATUS             RESTARTS      AGE
# broken-crashloop-xxx-xxx            0/1     CrashLoopBackOff   4 (30s ago)   2m

# Step 3b: Check previous logs (the container keeps crashing and restarting)
kubectl logs -l app=broken-crashloop -n apps --previous

# EXPECTED OUTPUT:
# Starting app...
# ERROR: Database connection refused at db:5432

# DIAGNOSIS: The application cannot connect to its database. The database service
# either doesn't exist or is unreachable.

# Step 3c: Confirm with describe
kubectl describe pod -l app=broken-crashloop -n apps | tail -20

# EXPECTED OUTPUT (Events section):
# Events:
#   Type     Reason     Age                From               Message
#   ----     ------     ----               ----               -------
#   Normal   Scheduled  2m                 default-scheduler  Successfully assigned apps/broken-crashloop-xxx to worker-1
#   Normal   Pulled     90s (x4 over 2m)   kubelet            Container image "busybox:1.36" already present on machine
#   Normal   Created    90s (x4 over 2m)   kubelet            Created container app
#   Normal   Started    90s (x4 over 2m)   kubelet            Started container app
#   Warning  BackOff    30s (x6 over 2m)   kubelet            Back-off restarting failed container

# Step 3d: Check exit code
kubectl get pod -l app=broken-crashloop -n apps -o jsonpath='{.items[0].status.containerStatuses[0].lastState.terminated.exitCode}'

# EXPECTED OUTPUT:
# 1
# WHY: Exit code 1 = application error (not OOMKilled which would be 137)
```

### Step 4: Debug ImagePullBackOff

```bash
# Step 4a: Check pod status
kubectl get pods -n apps -l app=broken-imagepull

# EXPECTED OUTPUT:
# NAME                                READY   STATUS             RESTARTS   AGE
# broken-imagepull-xxx-xxx            0/1     ImagePullBackOff   0          3m

# Step 4b: Describe to find the exact error
kubectl describe pod -l app=broken-imagepull -n apps | tail -15

# EXPECTED OUTPUT (Events section):
# Events:
#   Type     Reason     Age                From               Message
#   ----     ------     ----               ----               -------
#   Normal   Scheduled  3m                 default-scheduler  Successfully assigned apps/broken-imagepull-xxx to worker-2
#   Normal   Pulling    2m (x3 over 3m)    kubelet            Pulling image "nginx:nonexistent-tag-v999"
#   Warning  Failed     2m (x3 over 3m)    kubelet            Failed to pull image "nginx:nonexistent-tag-v999": ... tag does not exist
#   Warning  Failed     2m (x3 over 3m)    kubelet            Error: ErrImagePull
#   Normal   BackOff    60s (x5 over 3m)   kubelet            Back-off pulling image "nginx:nonexistent-tag-v999"
#   Warning  Failed     60s (x5 over 3m)   kubelet            Error: ImagePullBackOff

# DIAGNOSIS: The image tag "nonexistent-tag-v999" doesn't exist in the Docker Hub nginx repository.
# FIX: Change to a valid tag like "nginx:1.25"

# Step 4c: Fix the image
kubectl set image deployment/broken-imagepull app=nginx:1.25 -n apps

# EXPECTED OUTPUT:
# deployment.apps/broken-imagepull image updated

# Verify fix
kubectl rollout status deployment/broken-imagepull -n apps --timeout=60s

# EXPECTED OUTPUT:
# deployment "broken-imagepull" successfully rolled out
```

### Step 5: Debug Pending Pod

```bash
# Step 5a: Check pod status
kubectl get pods -n apps -l app=broken-pending

# EXPECTED OUTPUT:
# NAME                              READY   STATUS    RESTARTS   AGE
# broken-pending-xxx-xxx            0/1     Pending   0          4m

# Step 5b: Describe to find why it's pending
kubectl describe pod -l app=broken-pending -n apps | tail -10

# EXPECTED OUTPUT (Events section):
# Events:
#   Type     Reason            Age                From               Message
#   ----     ------            ----               ----               -------
#   Warning  FailedScheduling  60s (x3 over 4m)   default-scheduler  0/3 nodes are available:
#            3 Insufficient cpu, 3 Insufficient memory. preemption: 0/3 nodes are available:
#            3 No preemption victims found for incoming pod.

# DIAGNOSIS: The pod requests 64 CPUs and 128Gi memory, which exceeds all nodes' capacity.

# Step 5c: Check actual node capacity
kubectl describe nodes | grep -A6 "Allocated resources"

# EXPECTED OUTPUT (per node):
# Allocated resources:
#   Resource           Requests    Limits
#   --------           --------    ------
#   cpu                750m (37%)  0 (0%)
#   memory             290Mi (7%) 390Mi (10%)

# Step 5d: Fix by reducing resource requests
kubectl patch deployment broken-pending -n apps --type='json' \
  -p='[
    {"op": "replace", "path": "/spec/template/spec/containers/0/resources/requests/cpu", "value": "50m"},
    {"op": "replace", "path": "/spec/template/spec/containers/0/resources/requests/memory", "value": "64Mi"},
    {"op": "replace", "path": "/spec/template/spec/containers/0/resources/limits/cpu", "value": "200m"},
    {"op": "replace", "path": "/spec/template/spec/containers/0/resources/limits/memory", "value": "128Mi"}
  ]'

# EXPECTED OUTPUT:
# deployment.apps/broken-pending patched

# Verify fix
kubectl rollout status deployment/broken-pending -n apps --timeout=60s

# EXPECTED OUTPUT:
# deployment "broken-pending" successfully rolled out

kubectl get pods -n apps -l app=broken-pending

# EXPECTED OUTPUT:
# NAME                              READY   STATUS    RESTARTS   AGE
# broken-pending-yyy-yyy            1/1     Running   0          30s
```

### Verification

```bash
# Final check — all apps should be healthy now
kubectl get pods -n apps

# EXPECTED OUTPUT:
# NAME                                READY   STATUS    RESTARTS   AGE
# broken-crashloop-xxx-xxx            0/1     CrashLoopBackOff   8   10m   <-- still broken (needs DB)
# broken-imagepull-yyy-yyy            1/1     Running            0   2m    <-- fixed
# broken-pending-yyy-yyy              1/1     Running            0   1m    <-- fixed
# load-generator                      1/1     Running            0   25m
# log-generator-xxx-xxx               1/1     Running            0   15m
# log-generator-xxx-yyy               1/1     Running            0   15m
# sample-web-xxx-xxx                  1/1     Running            0   30m
# sample-web-xxx-yyy                  1/1     Running            0   30m
# sample-web-xxx-zzz                  1/1     Running            0   30m

# Check Grafana for alerts:
# In Grafana, go to Alerting -> Alert Rules
# You may see alerts for the broken-crashloop pod (KubePodCrashLooping)

# Check in Prometheus:
# Visit http://localhost:9090/alerts
# VERIFY: You see "KubePodCrashLooping" in firing state
```

---

## Cleanup

```bash
# Step 1: Delete all apps
kubectl delete namespace apps

# EXPECTED OUTPUT:
# namespace "apps" deleted

# Step 2: Uninstall Loki
helm uninstall loki -n logging

# EXPECTED OUTPUT:
# release "loki" uninstalled

# Step 3: Delete logging namespace
kubectl delete namespace logging

# Step 4: Uninstall kube-prometheus-stack
helm uninstall kube-prom -n monitoring

# EXPECTED OUTPUT:
# release "kube-prom" uninstalled

# Step 5: Clean up CRDs (kube-prometheus-stack leaves CRDs behind)
kubectl delete crd alertmanagerconfigs.monitoring.coreos.com 2>/dev/null
kubectl delete crd alertmanagers.monitoring.coreos.com 2>/dev/null
kubectl delete crd podmonitors.monitoring.coreos.com 2>/dev/null
kubectl delete crd probes.monitoring.coreos.com 2>/dev/null
kubectl delete crd prometheusagents.monitoring.coreos.com 2>/dev/null
kubectl delete crd prometheuses.monitoring.coreos.com 2>/dev/null
kubectl delete crd prometheusrules.monitoring.coreos.com 2>/dev/null
kubectl delete crd scrapeconfigs.monitoring.coreos.com 2>/dev/null
kubectl delete crd servicemonitors.monitoring.coreos.com 2>/dev/null
kubectl delete crd thanosrulers.monitoring.coreos.com 2>/dev/null

# Step 6: Delete monitoring namespace
kubectl delete namespace monitoring

# Step 7: Delete the kind cluster
kind delete cluster --name observability-lab

# EXPECTED OUTPUT:
# Deleting cluster "observability-lab" ...
# Deleted nodes: ["observability-lab-control-plane" "observability-lab-worker" "observability-lab-worker2"]

# Step 8: Kill any leftover port-forward processes
pkill -f "kubectl port-forward" 2>/dev/null || true

# VERIFICATION: Confirm cluster is deleted
kind get clusters

# EXPECTED OUTPUT:
# (empty — no clusters listed)
```
