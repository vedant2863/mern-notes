# File 14: Lab — ConfigMaps, Secrets, and Scheduling

**Topic:** Hands-on exercises for configuration management and pod scheduling

**WHY THIS MATTERS:** Theory without practice is like reading a recipe without cooking. This lab walks you through creating ConfigMaps with hot-reload, exposing the base64 myth about Secrets, targeting pods to specific nodes with affinity, and observing taint-based eviction in real time.

---

## Prerequisites

| Tool | Purpose | Install Command |
|------|---------|-----------------|
| `kind` | Multi-node local Kubernetes cluster | `go install sigs.k8s.io/kind@v0.22.0` or `brew install kind` |
| `kubectl` | Kubernetes CLI | `brew install kubectl` or `curl -LO "https://dl.k8s.io/release/$(curl -sL https://dl.k8s.io/release/stable.txt)/bin/$(uname -s | tr '[:upper:]' '[:lower:]')/amd64/kubectl"` |
| `docker` | Container runtime for kind | `brew install --cask docker` or [Docker Desktop](https://docs.docker.com/get-docker/) |
| `watch` | Live monitoring of resources | `brew install watch` (macOS) — pre-installed on Linux |

### Verify Tools

```bash
# Verify all tools are available
kind --version && kubectl version --client && docker info --format '{{.ServerVersion}}'

# EXPECTED OUTPUT:
# kind v0.22.0 go1.21.6 darwin/arm64
# Client Version: v1.29.2
# 25.0.3
```

---

## Cluster Setup

We need a multi-node cluster for scheduling exercises. Kind makes this easy.

```bash
# Create a kind cluster config with 1 control-plane + 3 workers
cat <<'EOF' > /tmp/kind-lab-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: config-scheduling-lab
nodes:
  - role: control-plane
  - role: worker
  - role: worker
  - role: worker
EOF

# Create the cluster
kind create cluster --config /tmp/kind-lab-config.yaml

# EXPECTED OUTPUT:
# Creating cluster "config-scheduling-lab" ...
#  ✓ Ensuring node image (kindest/node:v1.29.2) 🖼
#  ✓ Preparing nodes 📦 📦 📦 📦
#  ✓ Writing configuration 📜
#  ✓ Starting control-plane 🕹️
#  ✓ Installing CNI 🔌
#  ✓ Installing StorageClass 💾
#  ✓ Joining worker nodes 🚜
# Set kubectl context to "kind-config-scheduling-lab"

# Verify all nodes
kubectl get nodes

# EXPECTED OUTPUT:
# NAME                                   STATUS   ROLES           AGE   VERSION
# config-scheduling-lab-control-plane    Ready    control-plane   60s   v1.29.2
# config-scheduling-lab-worker           Ready    <none>          40s   v1.29.2
# config-scheduling-lab-worker2          Ready    <none>          40s   v1.29.2
# config-scheduling-lab-worker3          Ready    <none>          40s   v1.29.2
```

```bash
# Store worker node names for later use
export WORKER1=$(kubectl get nodes -o name | grep worker | head -1 | cut -d/ -f2)
export WORKER2=$(kubectl get nodes -o name | grep worker | sed -n 2p | cut -d/ -f2)
export WORKER3=$(kubectl get nodes -o name | grep worker | tail -1 | cut -d/ -f2)

echo "Worker 1: $WORKER1"
echo "Worker 2: $WORKER2"
echo "Worker 3: $WORKER3"

# EXPECTED OUTPUT:
# Worker 1: config-scheduling-lab-worker
# Worker 2: config-scheduling-lab-worker2
# Worker 3: config-scheduling-lab-worker3
```

---

## Exercise 1: ConfigMap with Volume Mount and Hot-Reload

**Objective:** Create a ConfigMap from a file, mount it as a volume, update the ConfigMap, and observe the automatic hot-reload inside the pod.

### Step 1: Create the Config File

```bash
# Create an application config file
cat <<'EOF' > /tmp/app-config.ini
[server]
port=8080
host=0.0.0.0

[database]
host=mongo-service
port=27017
name=myapp_db

[features]
dark_mode=false
max_upload_mb=10
EOF

# Verify the file
cat /tmp/app-config.ini

# EXPECTED OUTPUT:
# [server]
# port=8080
# host=0.0.0.0
# ...
```

### Step 2: Create the ConfigMap

```bash
# Create ConfigMap from the file
kubectl create configmap app-config --from-file=/tmp/app-config.ini

# EXPECTED OUTPUT:
# configmap/app-config created

# Verify the ConfigMap
kubectl describe configmap app-config

# EXPECTED OUTPUT:
# Name:         app-config
# Namespace:    default
# Labels:       <none>
# Annotations:  <none>
#
# Data
# ====
# app-config.ini:
# ----
# [server]
# port=8080
# host=0.0.0.0
# ...
```

### Step 3: Create a Pod That Mounts the ConfigMap

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: config-watcher
spec:
  volumes:
    - name: config-vol
      configMap:
        name: app-config
  containers:
    - name: watcher
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          echo "=== Initial config ==="
          cat /config/app-config.ini
          echo ""
          echo "=== Watching for changes (check every 5s) ==="
          LAST_HASH=""
          while true; do
            CURRENT_HASH=$(md5sum /config/app-config.ini | awk '{print $1}')
            if [ "$CURRENT_HASH" != "$LAST_HASH" ] && [ -n "$LAST_HASH" ]; then
              echo "[$(date)] CONFIG CHANGED! New content:"
              cat /config/app-config.ini
              echo ""
            fi
            LAST_HASH=$CURRENT_HASH
            sleep 5
          done
      volumeMounts:
        - name: config-vol
          mountPath: /config
          readOnly: true
EOF

# EXPECTED OUTPUT:
# pod/config-watcher created

# Wait for the pod to start
kubectl wait --for=condition=Ready pod/config-watcher --timeout=60s

# EXPECTED OUTPUT:
# pod/config-watcher condition met

# Verify the initial config
kubectl exec config-watcher -- cat /config/app-config.ini

# EXPECTED OUTPUT:
# [server]
# port=8080
# host=0.0.0.0
#
# [database]
# host=mongo-service
# port=27017
# name=myapp_db
#
# [features]
# dark_mode=false
# max_upload_mb=10
```

### Step 4: Update the ConfigMap and Observe Hot-Reload

```bash
# Update the ConfigMap — change dark_mode and max_upload_mb
kubectl edit configmap app-config
# In the editor, change:
#   dark_mode=false  → dark_mode=true
#   max_upload_mb=10 → max_upload_mb=50
# Save and exit

# Alternative: patch via kubectl
kubectl create configmap app-config \
  --from-literal=app-config.ini="$(cat <<'INNER'
[server]
port=8080
host=0.0.0.0

[database]
host=mongo-service
port=27017
name=myapp_db

[features]
dark_mode=true
max_upload_mb=50
INNER
)" --dry-run=client -o yaml | kubectl apply -f -

# EXPECTED OUTPUT:
# configmap/app-config configured

# Wait ~60 seconds for kubelet to sync, then check pod logs
sleep 65
kubectl logs config-watcher --tail=10

# EXPECTED OUTPUT:
# [Mon Jan 15 10:05:30 UTC 2024] CONFIG CHANGED! New content:
# [server]
# port=8080
# host=0.0.0.0
#
# [database]
# host=mongo-service
# port=27017
# name=myapp_db
#
# [features]
# dark_mode=true
# max_upload_mb=50

# Verify directly
kubectl exec config-watcher -- cat /config/app-config.ini

# EXPECTED OUTPUT:
# ...
# dark_mode=true
# max_upload_mb=50
```

### Key Observation

Volume-mounted ConfigMaps are updated automatically by the kubelet (typically within 60-90 seconds). The kubelet sync period is controlled by `--sync-frequency` (default 1m). Environment variable-based ConfigMaps are NOT updated — the pod must be restarted.

---

## Exercise 2: Secrets — Creation, Mounting, and the Base64 Myth

**Objective:** Create a Secret, mount it inside a pod, verify decoding happens automatically, and demonstrate that base64 is not encryption.

### Step 1: Create a Secret

```bash
# Create a secret with database credentials
kubectl create secret generic db-credentials \
  --from-literal=DB_USER=admin \
  --from-literal=DB_PASSWORD='S3cur3P@ssw0rd!' \
  --from-literal=DB_HOST=mongo.production.svc.cluster.local

# EXPECTED OUTPUT:
# secret/db-credentials created
```

### Step 2: Inspect the Secret — See Base64 Encoding

```bash
# View the secret in YAML format
kubectl get secret db-credentials -o yaml

# EXPECTED OUTPUT:
# apiVersion: v1
# kind: Secret
# metadata:
#   name: db-credentials
#   namespace: default
# type: Opaque
# data:
#   DB_HOST: bW9uZ28ucHJvZHVjdGlvbi5zdmMuY2x1c3Rlci5sb2NhbA==
#   DB_PASSWORD: UzNjdXIzUEBzc3cwcmQh
#   DB_USER: YWRtaW4=

# PROVE base64 is not encryption — decode instantly
echo "UzNjdXIzUEBzc3cwcmQh" | base64 --decode

# EXPECTED OUTPUT:
# S3cur3P@ssw0rd!

# WHY: Anyone with kubectl access can decode secrets trivially.
# base64 is an ENCODING format (like URL encoding), NOT encryption.
# It provides ZERO security. The only protection is RBAC.
```

### Step 3: Mount the Secret and Verify Auto-Decoding

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: secret-consumer
spec:
  volumes:
    - name: secret-vol
      secret:
        secretName: db-credentials
        defaultMode: 0400
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "echo '=== Volume Mounted Secrets ===' && ls -la /secrets/ && echo '' && echo 'DB_USER:' && cat /secrets/DB_USER && echo '' && echo 'DB_PASSWORD:' && cat /secrets/DB_PASSWORD && echo '' && echo 'DB_HOST:' && cat /secrets/DB_HOST && echo '' && echo '=== Env Var Secret ===' && echo \"DB_USER env: $DB_USER_ENV\" && sleep 3600"]
      volumeMounts:
        - name: secret-vol
          mountPath: /secrets
          readOnly: true
      env:
        - name: DB_USER_ENV
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: DB_USER
EOF

# EXPECTED OUTPUT:
# pod/secret-consumer created

kubectl wait --for=condition=Ready pod/secret-consumer --timeout=60s

# Check the logs
kubectl logs secret-consumer

# EXPECTED OUTPUT:
# === Volume Mounted Secrets ===
# total 0
# lrwxrwxrwx 1 root root 14 ... DB_HOST -> ..data/DB_HOST
# lrwxrwxrwx 1 root root 18 ... DB_PASSWORD -> ..data/DB_PASSWORD
# lrwxrwxrwx 1 root root 14 ... DB_USER -> ..data/DB_USER
#
# DB_USER:
# admin
# DB_PASSWORD:
# S3cur3P@ssw0rd!
# DB_HOST:
# mongo.production.svc.cluster.local
#
# === Env Var Secret ===
# DB_USER env: admin
```

### Step 4: File Permissions Verification

```bash
# Check that secret files have restrictive permissions
kubectl exec secret-consumer -- ls -la /secrets/..data/

# EXPECTED OUTPUT:
# -r-------- 1 root root  ... DB_HOST
# -r-------- 1 root root  ... DB_PASSWORD
# -r-------- 1 root root  ... DB_USER

# WHY: defaultMode: 0400 means read-only for the file owner (root).
# This prevents other processes in the container from reading secrets.
```

### Key Observation

Kubernetes automatically base64-decodes secrets when mounting them as volumes or injecting them as environment variables. The application receives plain-text values. The base64 encoding only exists in the Kubernetes API/etcd layer. For actual security, you must rely on RBAC, encryption at rest, and external secrets managers.

---

## Exercise 3: Node Scheduling with nodeSelector and nodeAffinity

**Objective:** Label nodes, use nodeSelector to pin a pod, then use nodeAffinity for flexible placement.

### Step 1: Label the Nodes

```bash
# Label each worker node with a different zone and type
kubectl label nodes $WORKER1 zone=north tier=frontend
kubectl label nodes $WORKER2 zone=south tier=backend
kubectl label nodes $WORKER3 zone=north tier=backend

# EXPECTED OUTPUT (for each):
# node/config-scheduling-lab-worker labeled

# Verify labels
kubectl get nodes -L zone,tier

# EXPECTED OUTPUT:
# NAME                                   STATUS   ROLES           AGE   VERSION   ZONE    TIER
# config-scheduling-lab-control-plane    Ready    control-plane   10m   v1.29.2
# config-scheduling-lab-worker           Ready    <none>          10m   v1.29.2   north   frontend
# config-scheduling-lab-worker2          Ready    <none>          10m   v1.29.2   south   backend
# config-scheduling-lab-worker3          Ready    <none>          10m   v1.29.2   north   backend
```

### Step 2: nodeSelector — Pin to Frontend Node

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: frontend-pod
spec:
  nodeSelector:
    tier: frontend
  containers:
    - name: web
      image: nginx:1.25
EOF

# EXPECTED OUTPUT:
# pod/frontend-pod created

kubectl wait --for=condition=Ready pod/frontend-pod --timeout=60s

# Verify placement
kubectl get pod frontend-pod -o wide

# EXPECTED OUTPUT:
# NAME           READY   STATUS    RESTARTS   AGE   IP           NODE
# frontend-pod   1/1     Running   0          10s   10.244.1.5   config-scheduling-lab-worker

# WHY: The pod landed on worker (the only node with tier=frontend)
```

### Step 3: nodeSelector — Prove Failure When No Node Matches

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: impossible-pod
spec:
  nodeSelector:
    tier: database
  containers:
    - name: db
      image: mongo:7.0
EOF

# EXPECTED OUTPUT:
# pod/impossible-pod created

# Wait a few seconds and check status
sleep 5
kubectl get pod impossible-pod

# EXPECTED OUTPUT:
# NAME             READY   STATUS    RESTARTS   AGE
# impossible-pod   0/1     Pending   0          5s

# Check why it is Pending
kubectl describe pod impossible-pod | tail -5

# EXPECTED OUTPUT:
# Events:
#   Type     Reason            Age   From               Message
#   ----     ------            ----  ----               -------
#   Warning  FailedScheduling  5s    default-scheduler  0/4 nodes are available:
#     1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: },
#     3 node(s) didn't match Pod's node affinity/selector.
```

### Step 4: nodeAffinity — Flexible Placement

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: affinity-pod
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: tier
                operator: In
                values:
                  - backend
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 80
          preference:
            matchExpressions:
              - key: zone
                operator: In
                values:
                  - south
  containers:
    - name: api
      image: nginx:1.25
EOF

# EXPECTED OUTPUT:
# pod/affinity-pod created

kubectl wait --for=condition=Ready pod/affinity-pod --timeout=60s

kubectl get pod affinity-pod -o wide

# EXPECTED OUTPUT:
# NAME           READY   STATUS    RESTARTS   AGE   IP           NODE
# affinity-pod   1/1     Running   0          10s   10.244.2.3   config-scheduling-lab-worker2

# WHY: Both worker2 (south/backend) and worker3 (north/backend) satisfy the
# required rule (tier=backend). But worker2 is preferred because of the
# weighted preference for zone=south (weight 80).
```

### Step 5: Deploy Multiple Replicas with Anti-Affinity

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: spread-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: spread-app
  template:
    metadata:
      labels:
        app: spread-app
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector:
                matchExpressions:
                  - key: app
                    operator: In
                    values:
                      - spread-app
              topologyKey: kubernetes.io/hostname
      containers:
        - name: app
          image: busybox:1.36
          command: ["sleep", "3600"]
EOF

# EXPECTED OUTPUT:
# deployment.apps/spread-app created

# Wait for rollout
kubectl rollout status deployment/spread-app --timeout=60s

# Verify each pod is on a different node
kubectl get pods -l app=spread-app -o wide

# EXPECTED OUTPUT:
# NAME                         READY   STATUS    NODE
# spread-app-abc12-xyz12       1/1     Running   config-scheduling-lab-worker
# spread-app-abc12-xyz34       1/1     Running   config-scheduling-lab-worker2
# spread-app-abc12-xyz56       1/1     Running   config-scheduling-lab-worker3

# WHY: Anti-affinity with topologyKey=hostname ensures no two replicas
# are on the same node. With 3 workers and 3 replicas, each gets one pod.
```

---

## Exercise 4: Taints, Tolerations, and NoExecute Eviction

**Objective:** Taint a node, observe that new pods avoid it, apply NoExecute to evict running pods, and add tolerations to survive eviction.

### Step 1: Deploy Pods Across All Workers

```bash
# First clean up previous exercise pods
kubectl delete pod frontend-pod impossible-pod affinity-pod --ignore-not-found
kubectl delete deployment spread-app --ignore-not-found

# Deploy 6 replicas to spread across workers
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: taint-test
spec:
  replicas: 6
  selector:
    matchLabels:
      app: taint-test
  template:
    metadata:
      labels:
        app: taint-test
    spec:
      containers:
        - name: app
          image: busybox:1.36
          command: ["sleep", "3600"]
EOF

# EXPECTED OUTPUT:
# deployment.apps/taint-test created

kubectl rollout status deployment/taint-test --timeout=60s

# Check pod distribution
kubectl get pods -l app=taint-test -o wide

# EXPECTED OUTPUT (roughly 2 per worker):
# NAME                         READY   STATUS    NODE
# taint-test-xxx-aaa           1/1     Running   config-scheduling-lab-worker
# taint-test-xxx-bbb           1/1     Running   config-scheduling-lab-worker
# taint-test-xxx-ccc           1/1     Running   config-scheduling-lab-worker2
# taint-test-xxx-ddd           1/1     Running   config-scheduling-lab-worker2
# taint-test-xxx-eee           1/1     Running   config-scheduling-lab-worker3
# taint-test-xxx-fff           1/1     Running   config-scheduling-lab-worker3
```

### Step 2: Taint Worker3 with NoSchedule

```bash
# Taint worker3 — new pods will NOT be scheduled here
kubectl taint nodes $WORKER3 maintenance=true:NoSchedule

# EXPECTED OUTPUT:
# node/config-scheduling-lab-worker3 tainted

# Scale up to 9 replicas — new pods should NOT go to worker3
kubectl scale deployment taint-test --replicas=9

# Wait for new pods
sleep 10
kubectl get pods -l app=taint-test -o wide

# EXPECTED OUTPUT:
# The 3 NEW pods are on worker and worker2 ONLY
# The 2 EXISTING pods on worker3 remain (NoSchedule doesn't evict)
# taint-test-xxx-eee    1/1     Running   config-scheduling-lab-worker3  ← still here
# taint-test-xxx-fff    1/1     Running   config-scheduling-lab-worker3  ← still here
# taint-test-xxx-ggg    1/1     Running   config-scheduling-lab-worker   ← new
# taint-test-xxx-hhh    1/1     Running   config-scheduling-lab-worker2  ← new
# taint-test-xxx-iii    1/1     Running   config-scheduling-lab-worker   ← new
```

### Step 3: Apply NoExecute — Watch Pods Get Evicted

```bash
# Remove NoSchedule first
kubectl taint nodes $WORKER3 maintenance=true:NoSchedule-

# EXPECTED OUTPUT:
# node/config-scheduling-lab-worker3 untainted

# Now apply NoExecute — this will EVICT running pods from worker3
kubectl taint nodes $WORKER3 maintenance=drain:NoExecute

# EXPECTED OUTPUT:
# node/config-scheduling-lab-worker3 tainted

# Immediately check pods
sleep 3
kubectl get pods -l app=taint-test -o wide

# EXPECTED OUTPUT:
# Pods that were on worker3 are Terminating or gone
# New replacement pods are created on worker and worker2
# ALL 9 pods now run on worker and worker2 ONLY

# Verify no pods on worker3
kubectl get pods -l app=taint-test -o wide | grep worker3

# EXPECTED OUTPUT:
# (no output — worker3 has been completely drained)
```

### Step 4: Add Toleration to Survive NoExecute

```bash
# Deploy a tolerating pod that CAN run on worker3
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: tolerant-pod
spec:
  tolerations:
    - key: "maintenance"
      operator: "Equal"
      value: "drain"
      effect: "NoExecute"
  nodeSelector:
    zone: north
  containers:
    - name: app
      image: busybox:1.36
      command: ["sleep", "3600"]
EOF

# EXPECTED OUTPUT:
# pod/tolerant-pod created

kubectl wait --for=condition=Ready pod/tolerant-pod --timeout=60s

kubectl get pod tolerant-pod -o wide

# EXPECTED OUTPUT (may land on worker or worker3 since both are zone=north):
# NAME           READY   STATUS    NODE
# tolerant-pod   1/1     Running   config-scheduling-lab-worker3

# WHY: The tolerant pod can run on worker3 because its toleration matches
# the taint. The nodeSelector narrows it to zone=north nodes (worker, worker3).
# Since worker already has many pods, the scheduler may prefer worker3.
```

### Step 5: Toleration with tolerationSeconds

```bash
# Deploy a pod that tolerates the taint but only for 30 seconds
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: temporary-toleration
spec:
  tolerations:
    - key: "maintenance"
      operator: "Equal"
      value: "drain"
      effect: "NoExecute"
      tolerationSeconds: 30
  nodeSelector:
    zone: north
  containers:
    - name: app
      image: busybox:1.36
      command: ["sleep", "3600"]
EOF

# EXPECTED OUTPUT:
# pod/temporary-toleration created

# Check immediately — pod should be Running
kubectl get pod temporary-toleration -o wide

# EXPECTED OUTPUT:
# NAME                    READY   STATUS    NODE
# temporary-toleration    1/1     Running   config-scheduling-lab-worker3

# Wait 35 seconds and check again
sleep 35
kubectl get pod temporary-toleration

# EXPECTED OUTPUT:
# NAME                    READY   STATUS        RESTARTS   AGE
# temporary-toleration    1/1     Terminating   0          35s
# (or it may already be gone)

# WHY: tolerationSeconds=30 means the pod survives the NoExecute taint
# for 30 seconds, then gets evicted. This is useful for giving pods
# time to drain connections during maintenance.
```

---

## Cleanup

```bash
# Delete all exercise resources
kubectl delete pod config-watcher secret-consumer tolerant-pod temporary-toleration --ignore-not-found
kubectl delete deployment taint-test --ignore-not-found
kubectl delete configmap app-config --ignore-not-found
kubectl delete secret db-credentials --ignore-not-found

# EXPECTED OUTPUT:
# pod "config-watcher" deleted
# pod "secret-consumer" deleted
# ...

# Remove taints from worker3
kubectl taint nodes $WORKER3 maintenance=drain:NoExecute- --ignore-not-found

# EXPECTED OUTPUT:
# node/config-scheduling-lab-worker3 untainted

# Remove custom labels
kubectl label nodes $WORKER1 zone- tier-
kubectl label nodes $WORKER2 zone- tier-
kubectl label nodes $WORKER3 zone- tier-

# EXPECTED OUTPUT (for each):
# node/config-scheduling-lab-worker unlabeled

# Delete the kind cluster
kind delete cluster --name config-scheduling-lab

# EXPECTED OUTPUT:
# Deleting cluster "config-scheduling-lab" ...
# Deleted nodes: ["config-scheduling-lab-control-plane"
#   "config-scheduling-lab-worker" "config-scheduling-lab-worker2"
#   "config-scheduling-lab-worker3"]
```

### Verify Full Cleanup

```bash
# Confirm the cluster is gone
kind get clusters

# EXPECTED OUTPUT:
# (empty or other clusters you had before)

# Verify no leftover temp files
rm -f /tmp/kind-lab-config.yaml /tmp/app-config.ini

echo "Lab cleanup complete."
```

---

## Summary of What You Practiced

| Exercise | Concept | Key Learning |
|----------|---------|--------------|
| 1 | ConfigMap volume mount | Hot-reload works within ~60s for volume mounts |
| 2 | Secrets + base64 myth | base64 is trivially reversible — it is NOT encryption |
| 3 | nodeSelector + nodeAffinity | Labels + selectors control pod placement; affinity adds flexibility |
| 4 | Taints + NoExecute eviction | NoSchedule blocks new pods; NoExecute evicts existing pods |
