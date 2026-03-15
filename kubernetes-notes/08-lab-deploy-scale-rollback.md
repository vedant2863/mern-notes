# File 08: Lab — Deploy, Scale, and Rollback

**Topic:** Hands-on lab for creating Deployments, scaling replicas, performing rolling updates, practicing rollbacks, and simulating blue-green deployments.

**WHY THIS MATTERS:** Reading about Deployments is one thing. Watching Pods being replaced in real-time, seeing a broken rollout stall, and recovering with a single command — that is when the concepts stick. This lab gives you muscle memory for the most common production operations.

---

## Prerequisites

| Tool | Version | Install Command | Verify Command |
|------|---------|----------------|----------------|
| **kind** | v0.20+ | `brew install kind` (macOS) / `go install sigs.k8s.io/kind@latest` | `kind version` |
| **kubectl** | v1.28+ | `brew install kubectl` (macOS) / `curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"` | `kubectl version --client` |
| **Docker** | v24+ | [https://docs.docker.com/get-docker/](https://docs.docker.com/get-docker/) | `docker version` |

---

## Cluster Setup

### Step 1 — Create a kind Cluster

```bash
# Create a cluster configuration file
cat <<'EOF' > kind-lab-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: lab-deploy
nodes:
  - role: control-plane
  - role: worker
  - role: worker
EOF

# Create the cluster
kind create cluster --config kind-lab-config.yaml

# EXPECTED OUTPUT:
# Creating cluster "lab-deploy" ...
#  ✓ Ensuring node image (kindest/node:v1.29.0) 🖼
#  ✓ Preparing nodes 📦 📦 📦
#  ✓ Writing configuration 📜
#  ✓ Starting control-plane 🕹️
#  ✓ Installing CNI 🔌
#  ✓ Installing StorageClass 💾
#  ✓ Joining worker nodes 🚜
# Set kubectl context to "kind-lab-deploy"
```

### Step 2 — Verify the Cluster

```bash
# Check nodes
kubectl get nodes

# EXPECTED OUTPUT:
# NAME                       STATUS   ROLES           AGE   VERSION
# lab-deploy-control-plane   Ready    control-plane   30s   v1.29.0
# lab-deploy-worker          Ready    <none>          15s   v1.29.0
# lab-deploy-worker2         Ready    <none>          15s   v1.29.0

# Set the context (if not auto-set)
kubectl cluster-info --context kind-lab-deploy

# EXPECTED OUTPUT:
# Kubernetes control plane is running at https://127.0.0.1:PORT
# CoreDNS is running at https://127.0.0.1:PORT/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy
```

---

## Exercise 1: Create a Deployment and Scale to 5 Replicas

### Objective

Create a Deployment with 3 replicas, verify it creates a ReplicaSet, then scale to 5 replicas and observe how the ReplicaSet adjusts.

### Step 1 — Create the Deployment YAML

```bash
cat <<'EOF' > nginx-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-lab
  labels:
    app: nginx-lab
  annotations:
    kubernetes.io/change-cause: "Initial deployment with nginx:1.24"
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx-lab
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: nginx-lab
        version: v1
    spec:
      containers:
        - name: nginx
          image: nginx:1.24
          ports:
            - containerPort: 80
          resources:
            requests:
              memory: "32Mi"
              cpu: "50m"
            limits:
              memory: "64Mi"
              cpu: "100m"
EOF
```

### Step 2 — Apply the Deployment

```bash
kubectl apply -f nginx-deployment.yaml

# EXPECTED OUTPUT:
# deployment.apps/nginx-lab created
```

### Step 3 — Verify the Deployment, ReplicaSet, and Pods

```bash
# Check the deployment
kubectl get deployment nginx-lab

# EXPECTED OUTPUT:
# NAME        READY   UP-TO-DATE   AVAILABLE   AGE
# nginx-lab   3/3     3            3           15s

# Check the ReplicaSet created by the deployment
kubectl get rs -l app=nginx-lab

# EXPECTED OUTPUT:
# NAME                   DESIRED   CURRENT   READY   AGE
# nginx-lab-5d4c6f7b8a   3         3         3       20s

# Check the individual Pods
kubectl get pods -l app=nginx-lab -o wide

# EXPECTED OUTPUT:
# NAME                         READY   STATUS    RESTARTS   AGE   IP           NODE
# nginx-lab-5d4c6f7b8a-abc12   1/1     Running   0          25s   10.244.1.3   lab-deploy-worker
# nginx-lab-5d4c6f7b8a-def34   1/1     Running   0          25s   10.244.2.4   lab-deploy-worker2
# nginx-lab-5d4c6f7b8a-ghi56   1/1     Running   0          25s   10.244.1.4   lab-deploy-worker

# Verify the owner chain: Pod -> ReplicaSet -> Deployment
kubectl get pod -l app=nginx-lab -o jsonpath='{.items[0].metadata.ownerReferences[0].kind} / {.items[0].metadata.ownerReferences[0].name}'

# EXPECTED OUTPUT:
# ReplicaSet / nginx-lab-5d4c6f7b8a
```

### Step 4 — Scale to 5 Replicas

```bash
kubectl scale deployment/nginx-lab --replicas=5

# EXPECTED OUTPUT:
# deployment.apps/nginx-lab scaled

# Watch pods appear
kubectl get pods -l app=nginx-lab -w

# EXPECTED OUTPUT:
# NAME                         READY   STATUS    RESTARTS   AGE
# nginx-lab-5d4c6f7b8a-abc12   1/1     Running   0          2m
# nginx-lab-5d4c6f7b8a-def34   1/1     Running   0          2m
# nginx-lab-5d4c6f7b8a-ghi56   1/1     Running   0          2m
# nginx-lab-5d4c6f7b8a-jkl78   0/1     ContainerCreating   0   2s
# nginx-lab-5d4c6f7b8a-mno90   0/1     ContainerCreating   0   2s
# nginx-lab-5d4c6f7b8a-jkl78   1/1     Running             0   5s
# nginx-lab-5d4c6f7b8a-mno90   1/1     Running             0   6s

# (Press Ctrl+C to stop watching)

# Verify ReplicaSet shows 5 desired
kubectl get rs -l app=nginx-lab

# EXPECTED OUTPUT:
# NAME                   DESIRED   CURRENT   READY   AGE
# nginx-lab-5d4c6f7b8a   5         5         5       3m
```

### Verification

```bash
# Confirm exactly 5 pods are running
kubectl get pods -l app=nginx-lab --no-headers | wc -l

# EXPECTED OUTPUT:
# 5

# Confirm all are in Running status
kubectl get pods -l app=nginx-lab -o jsonpath='{range .items[*]}{.status.phase}{"\n"}{end}'

# EXPECTED OUTPUT:
# Running
# Running
# Running
# Running
# Running
```

### Talking Points

- The ReplicaSet name includes a hash suffix (like `5d4c6f7b8a`) derived from the Pod template. If the template does not change, the same ReplicaSet is reused.
- Scaling does NOT create a new ReplicaSet — it simply adjusts the `replicas` count on the existing one.
- New Pods are spread across worker nodes by the scheduler (default behavior with no anti-affinity rules).

---

## Exercise 2: Rolling Update with Image Change

### Objective

Update the nginx image from 1.24 to 1.25, watch the rolling update in real-time, and verify the new ReplicaSet is created.

### Step 1 — Open a Watch Window

Open a second terminal (or use `tmux`/`screen`) and run:

```bash
# Terminal 2: Watch pods in real-time
kubectl get pods -l app=nginx-lab -w

# Keep this running throughout the exercise
```

### Step 2 — Trigger the Rolling Update

```bash
# Update the image
kubectl set image deployment/nginx-lab nginx=nginx:1.25

# EXPECTED OUTPUT:
# deployment.apps/nginx-lab image updated

# Annotate the change cause
kubectl annotate deployment/nginx-lab kubernetes.io/change-cause="Update nginx from 1.24 to 1.25" --overwrite

# EXPECTED OUTPUT:
# deployment.apps/nginx-lab annotated
```

### Step 3 — Monitor the Rollout

```bash
# In the original terminal, watch the rollout status
kubectl rollout status deployment/nginx-lab

# EXPECTED OUTPUT:
# Waiting for deployment "nginx-lab" rollout to finish: 1 out of 5 new replicas have been updated...
# Waiting for deployment "nginx-lab" rollout to finish: 2 out of 5 new replicas have been updated...
# Waiting for deployment "nginx-lab" rollout to finish: 3 out of 5 new replicas have been updated...
# Waiting for deployment "nginx-lab" rollout to finish: 4 out of 5 new replicas have been updated...
# Waiting for deployment "nginx-lab" rollout to finish: 4 of 5 updated replicas are available...
# deployment "nginx-lab" successfully rolled out
```

### Step 4 — Verify the Update

```bash
# Check that a new ReplicaSet was created
kubectl get rs -l app=nginx-lab

# EXPECTED OUTPUT:
# NAME                   DESIRED   CURRENT   READY   AGE
# nginx-lab-5d4c6f7b8a   0         0         0       10m    ← old RS (nginx:1.24), scaled to 0
# nginx-lab-7e9f1b2c3d   5         5         5       1m     ← new RS (nginx:1.25), 5 replicas

# Verify all pods are running the new image
kubectl get pods -l app=nginx-lab -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].image}{"\n"}{end}'

# EXPECTED OUTPUT:
# nginx-lab-7e9f1b2c3d-aaa11   nginx:1.25
# nginx-lab-7e9f1b2c3d-bbb22   nginx:1.25
# nginx-lab-7e9f1b2c3d-ccc33   nginx:1.25
# nginx-lab-7e9f1b2c3d-ddd44   nginx:1.25
# nginx-lab-7e9f1b2c3d-eee55   nginx:1.25

# Check rollout history
kubectl rollout history deployment/nginx-lab

# EXPECTED OUTPUT:
# deployment.apps/nginx-lab
# REVISION  CHANGE-CAUSE
# 1         Initial deployment with nginx:1.24
# 2         Update nginx from 1.24 to 1.25
```

### Verification

```bash
# Confirm the deployment shows the correct image
kubectl describe deployment nginx-lab | grep Image

# EXPECTED OUTPUT:
#     Image:        nginx:1.25

# Confirm all 5 replicas are available
kubectl get deployment nginx-lab

# EXPECTED OUTPUT:
# NAME        READY   UP-TO-DATE   AVAILABLE   AGE
# nginx-lab   5/5     5            5           12m
```

### Talking Points

- The rolling update created a NEW ReplicaSet. The old one is kept (scaled to 0) for potential rollback.
- Because `maxSurge: 1` and `maxUnavailable: 0`, we always had at least 5 Pods running during the update (5 old + 1 new temporarily = 6 max).
- The Pod template hash changed because the container image changed, which is how Kubernetes knows to create a new ReplicaSet.
- The watch terminal showed Pods being created and terminated in a controlled sequence.

---

## Exercise 3: Deploy Broken Image and Practice Rollback

### Objective

Intentionally deploy a non-existent image, observe the rollout stalling, and practice using `kubectl rollout undo` to recover.

### Step 1 — Deploy a Broken Image

```bash
# Set an image that does not exist
kubectl set image deployment/nginx-lab nginx=nginx:99.99.99

# EXPECTED OUTPUT:
# deployment.apps/nginx-lab image updated

# Annotate the bad change
kubectl annotate deployment/nginx-lab kubernetes.io/change-cause="BAD UPDATE: broken image nginx:99.99.99" --overwrite
```

### Step 2 — Watch the Rollout Stall

```bash
# Check rollout status (will hang)
kubectl rollout status deployment/nginx-lab --timeout=30s

# EXPECTED OUTPUT:
# Waiting for deployment "nginx-lab" rollout to finish: 1 out of 5 new replicas have been updated...
# error: timed out waiting for the condition

# Check pod status
kubectl get pods -l app=nginx-lab

# EXPECTED OUTPUT:
# NAME                         READY   STATUS             RESTARTS   AGE
# nginx-lab-7e9f1b2c3d-aaa11   1/1     Running            0          5m
# nginx-lab-7e9f1b2c3d-bbb22   1/1     Running            0          5m
# nginx-lab-7e9f1b2c3d-ccc33   1/1     Running            0          5m
# nginx-lab-7e9f1b2c3d-ddd44   1/1     Running            0          5m
# nginx-lab-7e9f1b2c3d-eee55   1/1     Running            0          5m
# nginx-lab-a1b2c3d4e5-zzz99   0/1     ImagePullBackOff   0          30s
```

### Step 3 — Investigate the Problem

```bash
# Describe the failing pod to see the error
kubectl describe pod -l app=nginx-lab | grep -A 5 "Events:" | tail -10

# EXPECTED OUTPUT:
# Events:
#   Type     Reason     Age   From               Message
#   ----     ------     ----  ----               -------
#   Normal   Scheduled  45s   default-scheduler  Successfully assigned default/nginx-lab-a1b2c3d4e5-zzz99 to lab-deploy-worker
#   Normal   Pulling    44s   kubelet            Pulling image "nginx:99.99.99"
#   Warning  Failed     42s   kubelet            Failed to pull image "nginx:99.99.99": rpc error: code = NotFound desc = ...
#   Warning  Failed     42s   kubelet            Error: ErrImagePull
#   Normal   BackOff    30s   kubelet            Back-off pulling image "nginx:99.99.99"
#   Warning  Failed     30s   kubelet            Error: ImagePullBackOff

# Check deployment conditions
kubectl get deployment nginx-lab -o jsonpath='{range .status.conditions[*]}{.type}: {.status} ({.reason}){"\n"}{end}'

# EXPECTED OUTPUT:
# Available: True (MinimumReplicasAvailable)
# Progressing: True (ReplicaSetUpdated)
```

### Step 4 — Rollback to Previous Working Version

```bash
# Check available revisions
kubectl rollout history deployment/nginx-lab

# EXPECTED OUTPUT:
# deployment.apps/nginx-lab
# REVISION  CHANGE-CAUSE
# 1         Initial deployment with nginx:1.24
# 2         Update nginx from 1.24 to 1.25
# 3         BAD UPDATE: broken image nginx:99.99.99

# Rollback to the previous revision (revision 2)
kubectl rollout undo deployment/nginx-lab

# EXPECTED OUTPUT:
# deployment.apps/nginx-lab rolled back

# Watch the recovery
kubectl rollout status deployment/nginx-lab

# EXPECTED OUTPUT:
# deployment "nginx-lab" successfully rolled out
```

### Step 5 — Verify Recovery

```bash
# Check all pods are healthy
kubectl get pods -l app=nginx-lab

# EXPECTED OUTPUT:
# NAME                         READY   STATUS    RESTARTS   AGE
# nginx-lab-7e9f1b2c3d-aaa11   1/1     Running   0          8m
# nginx-lab-7e9f1b2c3d-bbb22   1/1     Running   0          8m
# nginx-lab-7e9f1b2c3d-ccc33   1/1     Running   0          8m
# nginx-lab-7e9f1b2c3d-ddd44   1/1     Running   0          8m
# nginx-lab-7e9f1b2c3d-eee55   1/1     Running   0          8m

# Verify the image is back to 1.25
kubectl get deployment nginx-lab -o jsonpath='{.spec.template.spec.containers[0].image}'

# EXPECTED OUTPUT:
# nginx:1.25

# Check revision history after rollback
kubectl rollout history deployment/nginx-lab

# EXPECTED OUTPUT:
# deployment.apps/nginx-lab
# REVISION  CHANGE-CAUSE
# 1         Initial deployment with nginx:1.24
# 3         BAD UPDATE: broken image nginx:99.99.99
# 4         Update nginx from 1.24 to 1.25
#
# NOTE: Revision 2 is gone — it became revision 4 (the rollback target becomes the new revision)
```

### Verification

```bash
# Rollback to a SPECIFIC revision (revision 1, the original nginx:1.24)
kubectl rollout undo deployment/nginx-lab --to-revision=1

# EXPECTED OUTPUT:
# deployment.apps/nginx-lab rolled back

# Verify it's now running nginx:1.24
kubectl get deployment nginx-lab -o jsonpath='{.spec.template.spec.containers[0].image}'

# EXPECTED OUTPUT:
# nginx:1.24

# Restore to nginx:1.25 for the next exercise
kubectl set image deployment/nginx-lab nginx=nginx:1.25
kubectl annotate deployment/nginx-lab kubernetes.io/change-cause="Restored to nginx:1.25" --overwrite
kubectl rollout status deployment/nginx-lab

# EXPECTED OUTPUT:
# deployment "nginx-lab" successfully rolled out
```

### Talking Points

- Because `maxUnavailable: 0` was set, the 5 working Pods stayed alive the entire time the broken image was deployed. No customer-facing downtime.
- `kubectl rollout undo` is fast because it simply scales up an existing (old) ReplicaSet — no image pull needed since the old image is already cached on nodes.
- Rollback creates a new revision number — revision history is append-only. The "old" revision number disappears.
- Using `--timeout` flag with `rollout status` is good practice in CI/CD pipelines to fail fast on bad deployments.

---

## Exercise 4: Blue-Green Deployment Simulation

### Objective

Simulate a blue-green deployment pattern using two separate Deployments and a Service. Switch traffic between them by changing the Service's selector.

### Step 1 — Create the Blue Deployment (Current Production)

```bash
cat <<'EOF' > blue-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-blue
  labels:
    app: web
    color: blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
      color: blue
  template:
    metadata:
      labels:
        app: web
        color: blue
    spec:
      containers:
        - name: web
          image: nginx:1.24
          ports:
            - containerPort: 80
          # Custom index page to identify the version
          command: ["/bin/sh", "-c"]
          args:
            - |
              echo '<h1>BLUE - Version 1.24</h1>' > /usr/share/nginx/html/index.html
              nginx -g 'daemon off;'
          resources:
            requests:
              memory: "32Mi"
              cpu: "50m"
            limits:
              memory: "64Mi"
              cpu: "100m"
EOF

kubectl apply -f blue-deployment.yaml

# EXPECTED OUTPUT:
# deployment.apps/web-blue created
```

### Step 2 — Create the Service Pointing to Blue

```bash
cat <<'EOF' > web-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: web-service
spec:
  selector:
    app: web
    color: blue              # Currently pointing to BLUE deployment
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
  type: ClusterIP
EOF

kubectl apply -f web-service.yaml

# EXPECTED OUTPUT:
# service/web-service created
```

### Step 3 — Verify Blue Is Serving Traffic

```bash
# Create a temporary pod to test the service
kubectl run test-client --image=busybox:1.36 --rm -it --restart=Never -- wget -qO- http://web-service.default.svc.cluster.local

# EXPECTED OUTPUT:
# <h1>BLUE - Version 1.24</h1>
# pod "test-client" deleted

# Verify the service endpoints
kubectl get endpoints web-service

# EXPECTED OUTPUT:
# NAME          ENDPOINTS                                      AGE
# web-service   10.244.1.5:80,10.244.1.6:80,10.244.2.4:80     30s
```

### Step 4 — Deploy the Green Version (New Release)

```bash
cat <<'EOF' > green-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-green
  labels:
    app: web
    color: green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
      color: green
  template:
    metadata:
      labels:
        app: web
        color: green
    spec:
      containers:
        - name: web
          image: nginx:1.25
          ports:
            - containerPort: 80
          command: ["/bin/sh", "-c"]
          args:
            - |
              echo '<h1>GREEN - Version 1.25</h1>' > /usr/share/nginx/html/index.html
              nginx -g 'daemon off;'
          resources:
            requests:
              memory: "32Mi"
              cpu: "50m"
            limits:
              memory: "64Mi"
              cpu: "100m"
EOF

kubectl apply -f green-deployment.yaml

# EXPECTED OUTPUT:
# deployment.apps/web-green created

# Wait for green to be ready
kubectl rollout status deployment/web-green

# EXPECTED OUTPUT:
# deployment "web-green" successfully rolled out
```

### Step 5 — Test the Green Deployment Independently

```bash
# Verify green pods are running
kubectl get pods -l color=green

# EXPECTED OUTPUT:
# NAME                         READY   STATUS    RESTARTS   AGE
# web-green-8b7c9d0e1f-aaa11   1/1     Running   0          20s
# web-green-8b7c9d0e1f-bbb22   1/1     Running   0          20s
# web-green-8b7c9d0e1f-ccc33   1/1     Running   0          20s

# Test green directly (not through the service yet)
kubectl run test-green --image=busybox:1.36 --rm -it --restart=Never -- wget -qO- http://$(kubectl get pod -l color=green -o jsonpath='{.items[0].status.podIP}'):80

# EXPECTED OUTPUT:
# <h1>GREEN - Version 1.25</h1>
# pod "test-green" deleted

# Confirm the service is STILL pointing to blue
kubectl run test-service --image=busybox:1.36 --rm -it --restart=Never -- wget -qO- http://web-service

# EXPECTED OUTPUT:
# <h1>BLUE - Version 1.24</h1>
# pod "test-service" deleted
```

### Step 6 — Switch Traffic from Blue to Green (The Cutover)

```bash
# Patch the service selector to point to green
kubectl patch service web-service -p '{"spec":{"selector":{"color":"green"}}}'

# EXPECTED OUTPUT:
# service/web-service patched

# IMMEDIATELY verify traffic goes to green
kubectl run test-switch --image=busybox:1.36 --rm -it --restart=Never -- wget -qO- http://web-service

# EXPECTED OUTPUT:
# <h1>GREEN - Version 1.25</h1>
# pod "test-switch" deleted

# Verify the endpoints changed
kubectl get endpoints web-service

# EXPECTED OUTPUT:
# NAME          ENDPOINTS                                      AGE
# web-service   10.244.1.7:80,10.244.2.5:80,10.244.2.6:80     5m
```

### Step 7 — Rollback (If Green Has Issues)

```bash
# If green has problems, switch back to blue instantly
kubectl patch service web-service -p '{"spec":{"selector":{"color":"blue"}}}'

# EXPECTED OUTPUT:
# service/web-service patched

# Verify blue is serving again
kubectl run test-rollback --image=busybox:1.36 --rm -it --restart=Never -- wget -qO- http://web-service

# EXPECTED OUTPUT:
# <h1>BLUE - Version 1.24</h1>
# pod "test-rollback" deleted
```

### Step 8 — Finalize (If Green Is Good)

```bash
# Switch back to green (assuming it passed testing)
kubectl patch service web-service -p '{"spec":{"selector":{"color":"green"}}}'

# Scale down blue (save resources, keep for emergency rollback)
kubectl scale deployment/web-blue --replicas=0

# EXPECTED OUTPUT:
# deployment.apps/web-blue scaled

# Verify only green pods are running
kubectl get pods -l app=web

# EXPECTED OUTPUT:
# NAME                         READY   STATUS    RESTARTS   AGE
# web-green-8b7c9d0e1f-aaa11   1/1     Running   0          5m
# web-green-8b7c9d0e1f-bbb22   1/1     Running   0          5m
# web-green-8b7c9d0e1f-ccc33   1/1     Running   0          5m
```

### Verification

```bash
# Final verification — green is live, blue is scaled to 0
kubectl get deployments

# EXPECTED OUTPUT:
# NAME        READY   UP-TO-DATE   AVAILABLE   AGE
# nginx-lab   5/5     5            5           25m
# web-blue    0/0     0            0           10m
# web-green   3/3     3            3           5m

# Confirm the service endpoints match green pods
kubectl get endpoints web-service -o yaml | grep -A 5 "addresses:"
```

### Talking Points

- Blue-green deployment provides **instant rollback** — just change the Service selector. No waiting for Pods to terminate and restart.
- The downside is that you need **double the resources** during the transition (both blue and green running simultaneously).
- This pattern is a **Service-level switch** — the Deployment's built-in rolling update is a Pod-level rollout. Both have their place.
- In production, you would automate this with a CI/CD tool (Argo Rollouts, Flagger) rather than manual `kubectl patch` commands.
- Blue-green is useful when you need to run full integration tests against the new version before switching any traffic.

---

## Cleanup

```bash
# Delete all resources created in this lab
kubectl delete deployment nginx-lab web-blue web-green
kubectl delete service web-service

# EXPECTED OUTPUT:
# deployment.apps "nginx-lab" deleted
# deployment.apps "web-blue" deleted
# deployment.apps "web-green" deleted
# service "web-service" deleted

# Delete the kind cluster
kind delete cluster --name lab-deploy

# EXPECTED OUTPUT:
# Deleting cluster "lab-deploy" ...
# Deleted nodes: ["lab-deploy-control-plane" "lab-deploy-worker" "lab-deploy-worker2"]

# Clean up YAML files
rm -f kind-lab-config.yaml nginx-deployment.yaml blue-deployment.yaml green-deployment.yaml web-service.yaml

# Verify cleanup
kind get clusters

# EXPECTED OUTPUT:
# (no output, or other clusters if you have them)
```

---

## Summary

| Exercise | What You Learned |
|----------|-----------------|
| 1. Create & Scale | Deployment creates ReplicaSet; scaling adjusts the existing RS without creating a new one |
| 2. Rolling Update | Image change creates a new RS; old RS is kept at 0 replicas; rollout is gradual |
| 3. Rollback | `kubectl rollout undo` reactivates old RS instantly; revision history is append-only |
| 4. Blue-Green | Two Deployments + Service selector switch gives instant cutover and rollback at the cost of double resources |
