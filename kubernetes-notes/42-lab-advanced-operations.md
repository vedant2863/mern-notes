# File 42: Lab — Advanced Operations

## Prerequisites

Before starting this lab, ensure the following tools are installed and working:

| Tool | Purpose | Install Command | Verify Command |
|---|---|---|---|
| **kind** | Local Kubernetes clusters | `brew install kind` | `kind --version` |
| **kubectl** | Kubernetes CLI | `brew install kubectl` | `kubectl version --client` |
| **helm** | Package manager for Kubernetes | `brew install helm` | `helm version` |
| **hey** | HTTP load testing tool | `brew install hey` or `go install github.com/rakyll/hey@latest` | `hey -n 1 http://example.com` |
| **Docker** | Container runtime (required by kind) | `brew install --cask docker` | `docker info` |
| **jq** | JSON processor | `brew install jq` | `jq --version` |

```bash
# Install all prerequisites at once (macOS)
brew install kind kubectl helm hey jq

# For Linux users, install hey via Go:
# go install github.com/rakyll/hey@latest

# Verify all tools
kind --version
kubectl version --client
helm version --short
hey -n 1 http://example.com 2>/dev/null && echo "hey: OK"
jq --version
docker info > /dev/null 2>&1 && echo "Docker: OK"
```

---

## Cluster Setup

We will create two kind clusters for this lab. Cluster A is the primary cluster, and Cluster B is a secondary cluster used in the multi-cluster exercise.

```bash
# Create kind cluster configuration for Cluster A
# WHY: We need metrics-server support and port mappings for load testing
cat <<'EOF' > /tmp/kind-cluster-a.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: lab-cluster-a
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
        # WHY: Expose NodePort 30080 for load testing with hey
      - containerPort: 30081
        hostPort: 30081
        protocol: TCP
  - role: worker
  - role: worker
    # WHY: 3 nodes (1 control-plane + 2 workers) for realistic scheduling
EOF

# Create kind cluster configuration for Cluster B
cat <<'EOF' > /tmp/kind-cluster-b.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: lab-cluster-b
nodes:
  - role: control-plane
  - role: worker
EOF

# Create both clusters
# EXPECTED OUTPUT:
# Creating cluster "lab-cluster-a" ...
# ✓ Ensuring node image (kindest/node:v1.29.0)
# ✓ Preparing nodes
# ✓ Writing configuration
# ✓ Starting control-plane
# ✓ Joining worker nodes
# Set kubectl context to "kind-lab-cluster-a"
kind create cluster --config /tmp/kind-cluster-a.yaml --wait 120s

# EXPECTED OUTPUT:
# Creating cluster "lab-cluster-b" ...
# Set kubectl context to "kind-lab-cluster-b"
kind create cluster --config /tmp/kind-cluster-b.yaml --wait 120s

# Verify both clusters
# EXPECTED OUTPUT:
# kind-lab-cluster-a
# kind-lab-cluster-b
kind get clusters

# Set up context aliases for convenience
kubectl config get-contexts
# EXPECTED OUTPUT:
# CURRENT   NAME                    CLUSTER               AUTHINFO
#           kind-lab-cluster-a      kind-lab-cluster-a    kind-lab-cluster-a
# *         kind-lab-cluster-b      kind-lab-cluster-b    kind-lab-cluster-b

# Switch to Cluster A for the first exercises
kubectl config use-context kind-lab-cluster-a
# EXPECTED OUTPUT: Switched to context "kind-lab-cluster-a".

# Verify nodes in Cluster A
kubectl get nodes
# EXPECTED OUTPUT:
# NAME                           STATUS   ROLES           AGE   VERSION
# lab-cluster-a-control-plane    Ready    control-plane   2m    v1.29.0
# lab-cluster-a-worker           Ready    <none>          90s   v1.29.0
# lab-cluster-a-worker2          Ready    <none>          90s   v1.29.0
```

### Install Metrics Server on Cluster A

```bash
# WHY: HPA requires metrics-server to read CPU/memory metrics
# The --kubelet-insecure-tls flag is needed for kind (self-signed certs)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Patch metrics-server for kind compatibility
# WHY: kind uses self-signed kubelet certificates that metrics-server rejects by default
kubectl patch deployment metrics-server -n kube-system --type='json' -p='[
  {
    "op": "add",
    "path": "/spec/template/spec/containers/0/args/-",
    "value": "--kubelet-insecure-tls"
  },
  {
    "op": "add",
    "path": "/spec/template/spec/containers/0/args/-",
    "value": "--kubelet-preferred-address-types=InternalIP"
  }
]'

# Wait for metrics-server to be ready
kubectl wait --for=condition=available deployment/metrics-server -n kube-system --timeout=120s
# EXPECTED OUTPUT: deployment.apps/metrics-server condition met

# Verify metrics-server is working (may take 30-60 seconds to collect first metrics)
sleep 30
kubectl top nodes
# EXPECTED OUTPUT:
# NAME                           CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
# lab-cluster-a-control-plane    150m         7%     600Mi           15%
# lab-cluster-a-worker           30m          1%     200Mi           5%
# lab-cluster-a-worker2          25m          1%     180Mi           4%
```

---

## Exercise 1: HPA Load Test

**Objective:** Deploy an application with an HPA, generate load with `hey`, and watch pods scale up and then scale back down.

### Step 1 — Deploy the application

```bash
# Create a namespace for this exercise
kubectl create namespace hpa-lab
# EXPECTED OUTPUT: namespace/hpa-lab created

# Deploy a CPU-intensive web application
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: hpa-lab
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
        - name: web-app
          image: registry.k8s.io/hpa-example
          # WHY: This is the official Kubernetes HPA example image
          # It computes sqrt() in a loop on every request to burn CPU
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 200m
              memory: 64Mi
              # WHY: HPA uses requests as the baseline for utilization calculation
              # 50% of 200m = 100m average CPU triggers scaling
            limits:
              cpu: 500m
              memory: 128Mi
---
apiVersion: v1
kind: Service
metadata:
  name: web-app
  namespace: hpa-lab
spec:
  type: NodePort
  selector:
    app: web-app
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30080
      # WHY: NodePort 30080 is mapped to host port 30080 in our kind config
      # This allows hey to reach the service from the host machine
EOF

# EXPECTED OUTPUT:
# deployment.apps/web-app created
# service/web-app created

# Wait for pod to be ready
kubectl wait --for=condition=ready pod -l app=web-app -n hpa-lab --timeout=120s
# EXPECTED OUTPUT: pod/web-app-xxxxxxxxxx-xxxxx condition met

# Verify the app is accessible
curl -s http://localhost:30080
# EXPECTED OUTPUT: OK!
```

### Step 2 — Create the HPA

```bash
# Create an HPA targeting 50% CPU utilization
cat <<'EOF' | kubectl apply -f -
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-app-hpa
  namespace: hpa-lab
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  minReplicas: 1
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 50
          # WHY: Scale up when average CPU exceeds 50% of request (100m)
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 15
      # WHY: Short stabilization for the lab — scale up quickly
      policies:
        - type: Pods
          value: 4
          periodSeconds: 15
          # WHY: Add up to 4 pods every 15 seconds — aggressive for demo
    scaleDown:
      stabilizationWindowSeconds: 60
      # WHY: Wait 60 seconds before scaling down
      policies:
        - type: Percent
          value: 50
          periodSeconds: 30
          # WHY: Remove at most 50% of pods every 30 seconds
EOF

# EXPECTED OUTPUT:
# horizontalpodautoscaler.autoscaling/web-app-hpa created

# Verify HPA is created and reading metrics
kubectl get hpa -n hpa-lab
# EXPECTED OUTPUT:
# NAME          REFERENCE            TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
# web-app-hpa   Deployment/web-app   0%/50%   1         10        1          30s
# NOTE: If TARGETS shows <unknown>/50%, wait for metrics-server to catch up (up to 60s)
```

### Step 3 — Generate load and watch scaling

```bash
# Open a second terminal (or use tmux/screen) to watch the HPA
# WHY: We want to see the scaling happen in real-time
kubectl get hpa -n hpa-lab -w
# EXPECTED OUTPUT (updates over time):
# NAME          REFERENCE            TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
# web-app-hpa   Deployment/web-app   0%/50%   1         10        1          2m
# web-app-hpa   Deployment/web-app   210%/50% 1         10        1          2m30s
# web-app-hpa   Deployment/web-app   210%/50% 1         10        5          2m45s
# web-app-hpa   Deployment/web-app   85%/50%  1         10        5          3m
# web-app-hpa   Deployment/web-app   52%/50%  1         10        8          3m30s

# In the main terminal, generate load with hey
# SYNTAX: hey -z <duration> -c <concurrent> <url>
# FLAGS:
#   -z 120s: run for 120 seconds
#   -c 50: 50 concurrent workers
#   -q 10: 10 queries per second per worker (500 total QPS)
# EXPECTED OUTPUT: Load test summary with latency percentiles and throughput
hey -z 120s -c 50 -q 10 http://localhost:30080
# EXPECTED OUTPUT (after 120s):
# Summary:
#   Total:        120.0050 secs
#   Slowest:      2.3456 secs
#   Fastest:      0.0012 secs
#   Average:      0.0543 secs
#   Requests/sec: 489.23
#
# Status code distribution:
#   [200] 58700 responses
```

### Step 4 — Observe scale-up and scale-down

```bash
# Watch pods scaling up during the load test
kubectl get pods -n hpa-lab -w
# EXPECTED OUTPUT (during load):
# NAME                       READY   STATUS    RESTARTS   AGE
# web-app-xxxxxxxxxx-aaaaa   1/1     Running   0          5m
# web-app-xxxxxxxxxx-bbbbb   0/1     Pending   0          1s
# web-app-xxxxxxxxxx-bbbbb   1/1     Running   0          5s
# web-app-xxxxxxxxxx-ccccc   0/1     Pending   0          1s
# ... more pods appear ...

# After hey finishes (load stops), wait 60-90 seconds and watch scale-down
kubectl get hpa -n hpa-lab -w
# EXPECTED OUTPUT (after load stops):
# web-app-hpa   Deployment/web-app   2%/50%   1   10   8   5m
# web-app-hpa   Deployment/web-app   0%/50%   1   10   4   6m
# web-app-hpa   Deployment/web-app   0%/50%   1   10   2   7m
# web-app-hpa   Deployment/web-app   0%/50%   1   10   1   8m

# Check HPA events for detailed scaling decisions
kubectl describe hpa web-app-hpa -n hpa-lab
# EXPECTED OUTPUT (Events section):
# Events:
#   Type    Reason             Age   From                       Message
#   ----    ------             ----  ----                       -------
#   Normal  SuccessfulRescale  3m    horizontal-pod-autoscaler  New size: 5; reason: cpu resource utilization above target
#   Normal  SuccessfulRescale  2m    horizontal-pod-autoscaler  New size: 8; reason: cpu resource utilization above target
#   Normal  SuccessfulRescale  30s   horizontal-pod-autoscaler  New size: 4; reason: All metrics below target
#   Normal  SuccessfulRescale  10s   horizontal-pod-autoscaler  New size: 1; reason: All metrics below target
```

### Verification

```bash
# Confirm final state: back to 1 replica
kubectl get deployment web-app -n hpa-lab
# EXPECTED OUTPUT:
# NAME      READY   UP-TO-DATE   AVAILABLE   AGE
# web-app   1/1     1            1           10m

# Confirm HPA is healthy
kubectl get hpa -n hpa-lab
# EXPECTED OUTPUT:
# NAME          REFERENCE            TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
# web-app-hpa   Deployment/web-app   0%/50%   1         10        1          10m
```

---

## Exercise 2: Build a Bash-Based CRD Controller

**Objective:** Create a custom CRD called `Website`, then write a simple bash script that watches for Website CRs and creates/deletes Nginx Deployments + Services for each one.

### Step 1 — Create the CRD

```bash
# Create a namespace for this exercise
kubectl create namespace crd-lab
# EXPECTED OUTPUT: namespace/crd-lab created

# Create the Website CRD
cat <<'EOF' | kubectl apply -f -
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: websites.lab.example.com
spec:
  group: lab.example.com
  names:
    kind: Website
    plural: websites
    singular: website
    shortNames:
      - ws
  scope: Namespaced
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              required:
                - hostname
                - replicas
              properties:
                hostname:
                  type: string
                  description: "The hostname for the website"
                replicas:
                  type: integer
                  minimum: 1
                  maximum: 5
                  description: "Number of Nginx replicas"
                image:
                  type: string
                  default: "nginx:1.25"
                  description: "Container image to use"
            status:
              type: object
              properties:
                phase:
                  type: string
                readyReplicas:
                  type: integer
      subresources:
        status: {}
      additionalPrinterColumns:
        - name: Hostname
          type: string
          jsonPath: .spec.hostname
        - name: Replicas
          type: integer
          jsonPath: .spec.replicas
        - name: Status
          type: string
          jsonPath: .status.phase
        - name: Age
          type: date
          jsonPath: .metadata.creationTimestamp
EOF

# EXPECTED OUTPUT:
# customresourcedefinition.apiextensions.k8s.io/websites.lab.example.com created

# Verify the CRD is registered
kubectl api-resources | grep websites
# EXPECTED OUTPUT:
# websites   ws   lab.example.com/v1   true    Website
```

### Step 2 — Write the bash controller

```bash
# Create the controller script
cat <<'CONTROLLER_EOF' > /tmp/website-controller.sh
#!/bin/bash
# Simple bash-based Kubernetes controller for the Website CRD
# WHY: Demonstrates the reconciliation loop pattern in the simplest possible way

NAMESPACE="crd-lab"
echo "=== Website Controller Starting ==="
echo "Watching for Website resources in namespace: $NAMESPACE"
echo ""

reconcile() {
    local name=$1
    local hostname=$2
    local replicas=$3
    local image=$4

    echo "[RECONCILE] Processing Website: $name (hostname=$hostname, replicas=$replicas, image=$image)"

    # Check if Deployment exists
    if kubectl get deployment "website-${name}" -n "$NAMESPACE" > /dev/null 2>&1; then
        # Update existing deployment
        echo "[RECONCILE]   Deployment website-${name} exists — checking for drift..."
        CURRENT_REPLICAS=$(kubectl get deployment "website-${name}" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
        if [ "$CURRENT_REPLICAS" != "$replicas" ]; then
            echo "[RECONCILE]   Drift detected! Current replicas: $CURRENT_REPLICAS, Desired: $replicas"
            kubectl scale deployment "website-${name}" -n "$NAMESPACE" --replicas="$replicas"
            echo "[RECONCILE]   Scaled deployment to $replicas replicas"
        else
            echo "[RECONCILE]   No drift — deployment matches desired state"
        fi
    else
        # Create new deployment
        echo "[RECONCILE]   Creating Deployment website-${name}..."
        kubectl create deployment "website-${name}" \
            --image="$image" \
            --replicas="$replicas" \
            -n "$NAMESPACE"

        # Label the deployment so we can track ownership
        kubectl label deployment "website-${name}" -n "$NAMESPACE" \
            managed-by=website-controller \
            website-name="$name"

        echo "[RECONCILE]   Deployment created"
    fi

    # Check if Service exists
    if ! kubectl get service "website-${name}" -n "$NAMESPACE" > /dev/null 2>&1; then
        echo "[RECONCILE]   Creating Service website-${name}..."
        kubectl expose deployment "website-${name}" \
            --port=80 --target-port=80 \
            -n "$NAMESPACE"

        kubectl label service "website-${name}" -n "$NAMESPACE" \
            managed-by=website-controller \
            website-name="$name"

        echo "[RECONCILE]   Service created"
    else
        echo "[RECONCILE]   Service website-${name} already exists"
    fi

    # Update status
    kubectl patch website "$name" -n "$NAMESPACE" --type=merge --subresource=status \
        -p "{\"status\":{\"phase\":\"Running\",\"readyReplicas\":$replicas}}" 2>/dev/null

    echo "[RECONCILE] Done processing Website: $name"
    echo ""
}

cleanup() {
    local name=$1
    echo "[CLEANUP] Website $name was deleted — cleaning up child resources..."

    kubectl delete deployment "website-${name}" -n "$NAMESPACE" --ignore-not-found
    kubectl delete service "website-${name}" -n "$NAMESPACE" --ignore-not-found

    echo "[CLEANUP] Child resources for $name deleted"
    echo ""
}

# Main reconciliation loop
while true; do
    echo "--- Reconciliation cycle at $(date '+%H:%M:%S') ---"

    # Get all Website CRs
    WEBSITES=$(kubectl get websites -n "$NAMESPACE" -o json 2>/dev/null)

    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to list websites. Retrying in 5s..."
        sleep 5
        continue
    fi

    # Get list of current website names
    CURRENT_NAMES=$(echo "$WEBSITES" | jq -r '.items[].metadata.name' 2>/dev/null)

    # Reconcile each Website CR
    for name in $CURRENT_NAMES; do
        hostname=$(echo "$WEBSITES" | jq -r ".items[] | select(.metadata.name==\"$name\") | .spec.hostname")
        replicas=$(echo "$WEBSITES" | jq -r ".items[] | select(.metadata.name==\"$name\") | .spec.replicas")
        image=$(echo "$WEBSITES" | jq -r ".items[] | select(.metadata.name==\"$name\") | .spec.image // \"nginx:1.25\"")
        reconcile "$name" "$hostname" "$replicas" "$image"
    done

    # Cleanup: find deployments managed by us that no longer have a Website CR
    MANAGED_DEPLOYMENTS=$(kubectl get deployments -n "$NAMESPACE" -l managed-by=website-controller -o jsonpath='{.items[*].metadata.labels.website-name}' 2>/dev/null)

    for dep_name in $MANAGED_DEPLOYMENTS; do
        if ! echo "$CURRENT_NAMES" | grep -q "^${dep_name}$"; then
            cleanup "$dep_name"
        fi
    done

    echo "--- Cycle complete. Sleeping 10s... ---"
    echo ""
    sleep 10
done
CONTROLLER_EOF

chmod +x /tmp/website-controller.sh
echo "Controller script created at /tmp/website-controller.sh"
# EXPECTED OUTPUT: Controller script created at /tmp/website-controller.sh
```

### Step 3 — Run the controller and create Website CRs

```bash
# Start the controller in the background
# WHY: The controller runs an infinite loop, watching for changes every 10 seconds
/tmp/website-controller.sh &
CONTROLLER_PID=$!
echo "Controller started with PID: $CONTROLLER_PID"
# EXPECTED OUTPUT:
# === Website Controller Starting ===
# Watching for Website resources in namespace: crd-lab
# --- Reconciliation cycle at HH:MM:SS ---
# --- Cycle complete. Sleeping 10s... ---

# Create a Website CR
cat <<'EOF' | kubectl apply -f -
apiVersion: lab.example.com/v1
kind: Website
metadata:
  name: my-blog
  namespace: crd-lab
spec:
  hostname: blog.example.com
  replicas: 2
  image: nginx:1.25
EOF
# EXPECTED OUTPUT:
# website.lab.example.com/my-blog created

# Wait for the controller to process it (next reconciliation cycle)
sleep 15

# Verify the controller created child resources
kubectl get websites -n crd-lab
# EXPECTED OUTPUT:
# NAME      HOSTNAME            REPLICAS   STATUS    AGE
# my-blog   blog.example.com    2          Running   20s

kubectl get deployments -n crd-lab
# EXPECTED OUTPUT:
# NAME             READY   UP-TO-DATE   AVAILABLE   AGE
# website-my-blog  2/2     2            2           15s

kubectl get services -n crd-lab
# EXPECTED OUTPUT:
# NAME             TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
# website-my-blog  ClusterIP   10.96.xxx.xx   <none>        80/TCP    15s

kubectl get pods -n crd-lab
# EXPECTED OUTPUT:
# NAME                               READY   STATUS    RESTARTS   AGE
# website-my-blog-xxxxxxxxxx-aaaaa   1/1     Running   0          15s
# website-my-blog-xxxxxxxxxx-bbbbb   1/1     Running   0          15s
```

### Step 4 — Test reconciliation (drift correction and deletion)

```bash
# Create a second Website
cat <<'EOF' | kubectl apply -f -
apiVersion: lab.example.com/v1
kind: Website
metadata:
  name: my-shop
  namespace: crd-lab
spec:
  hostname: shop.example.com
  replicas: 3
EOF
# EXPECTED OUTPUT: website.lab.example.com/my-shop created

sleep 15

# Verify both websites are managed
kubectl get websites -n crd-lab
# EXPECTED OUTPUT:
# NAME      HOSTNAME            REPLICAS   STATUS    AGE
# my-blog   blog.example.com    2          Running   1m
# my-shop   shop.example.com    3          Running   15s

kubectl get deployments -n crd-lab
# EXPECTED OUTPUT:
# NAME             READY   UP-TO-DATE   AVAILABLE   AGE
# website-my-blog  2/2     2            2           1m
# website-my-shop  3/3     3            3           10s

# Test drift correction: manually scale the deployment
echo "--- Testing drift correction ---"
kubectl scale deployment website-my-blog -n crd-lab --replicas=1
# EXPECTED OUTPUT: deployment.apps/website-my-blog scaled

# Wait for controller to detect and fix the drift
sleep 15

kubectl get deployment website-my-blog -n crd-lab
# EXPECTED OUTPUT:
# NAME             READY   UP-TO-DATE   AVAILABLE   AGE
# website-my-blog  2/2     2            2           2m
# WHY: The controller detected replicas=1 != desired replicas=2 and scaled back

# Test cleanup: delete a Website CR
echo "--- Testing cleanup ---"
kubectl delete website my-shop -n crd-lab
# EXPECTED OUTPUT: website.lab.example.com "my-shop" deleted

sleep 15

# Verify child resources were cleaned up
kubectl get deployments -n crd-lab
# EXPECTED OUTPUT:
# NAME             READY   UP-TO-DATE   AVAILABLE   AGE
# website-my-blog  2/2     2            2           3m
# NOTE: website-my-shop deployment is gone — cleaned up by the controller

kubectl get services -n crd-lab
# EXPECTED OUTPUT:
# NAME             TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
# website-my-blog  ClusterIP   10.96.xxx.xx   <none>        80/TCP    3m
# NOTE: website-my-shop service is also gone

# Stop the controller
kill $CONTROLLER_PID 2>/dev/null
echo "Controller stopped"
# EXPECTED OUTPUT: Controller stopped
```

### Verification

```bash
# Final state check
kubectl get websites -n crd-lab
# EXPECTED OUTPUT:
# NAME      HOSTNAME            REPLICAS   STATUS    AGE
# my-blog   blog.example.com    2          Running   5m

kubectl get all -n crd-lab
# EXPECTED OUTPUT: Only my-blog resources remain (deployment, replicaset, pods, service)
```

---

## Exercise 3: Multi-Cluster with ExternalName Service

**Objective:** Create two kind clusters, deploy a service in Cluster B, and access it from Cluster A using an ExternalName service that resolves to Cluster B's address.

### Step 1 — Deploy a service in Cluster B

```bash
# Switch to Cluster B
kubectl config use-context kind-lab-cluster-b
# EXPECTED OUTPUT: Switched to context "kind-lab-cluster-b".

# Create namespace
kubectl create namespace multi-cluster-lab
# EXPECTED OUTPUT: namespace/multi-cluster-lab created

# Deploy a simple web server in Cluster B
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-b-api
  namespace: multi-cluster-lab
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cluster-b-api
  template:
    metadata:
      labels:
        app: cluster-b-api
    spec:
      containers:
        - name: api
          image: hashicorp/http-echo:0.2.3
          args:
            - "-text=Hello from Cluster B!"
            - "-listen=:8080"
          ports:
            - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: cluster-b-api
  namespace: multi-cluster-lab
spec:
  type: NodePort
  selector:
    app: cluster-b-api
  ports:
    - port: 8080
      targetPort: 8080
      nodePort: 30090
EOF

# EXPECTED OUTPUT:
# deployment.apps/cluster-b-api created
# service/cluster-b-api created

# Wait for pods to be ready
kubectl wait --for=condition=ready pod -l app=cluster-b-api -n multi-cluster-lab --timeout=120s
# EXPECTED OUTPUT: pod/cluster-b-api-xxxxxxxxxx-xxxxx condition met

# Get Cluster B's control-plane container IP (this is the "external" IP for kind)
CLUSTER_B_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' lab-cluster-b-control-plane)
echo "Cluster B IP: $CLUSTER_B_IP"
# EXPECTED OUTPUT: Cluster B IP: 172.18.0.x (varies)

# Verify the service works within Cluster B
kubectl exec -it deploy/cluster-b-api -n multi-cluster-lab -- wget -qO- http://localhost:8080
# EXPECTED OUTPUT: Hello from Cluster B!
```

### Step 2 — Create ExternalName service in Cluster A

```bash
# Switch to Cluster A
kubectl config use-context kind-lab-cluster-a
# EXPECTED OUTPUT: Switched to context "kind-lab-cluster-a".

# Create namespace
kubectl create namespace multi-cluster-lab
# EXPECTED OUTPUT: namespace/multi-cluster-lab created

# Get Cluster B's node IP from the kind Docker network
CLUSTER_B_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' lab-cluster-b-control-plane)
echo "Cluster B IP: $CLUSTER_B_IP"

# Since ExternalName requires a DNS name (not an IP), we create a headless approach
# using an Endpoints resource pointing to Cluster B's IP
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: remote-api
  namespace: multi-cluster-lab
  # WHY: This service in Cluster A will route traffic to Cluster B
spec:
  ports:
    - port: 8080
      targetPort: 30090
      # WHY: Target the NodePort on Cluster B's node
  clusterIP: None
  type: ClusterIP
  # WHY: Headless service — we manually provide the endpoints
---
apiVersion: v1
kind: Endpoints
metadata:
  name: remote-api
  namespace: multi-cluster-lab
  # WHY: Manually specify the IP address of Cluster B's node
subsets:
  - addresses:
      - ip: ${CLUSTER_B_IP}
        # WHY: This is the Docker IP of Cluster B's control-plane node
    ports:
      - port: 30090
        # WHY: NodePort on Cluster B where the service is exposed
EOF

# EXPECTED OUTPUT:
# service/remote-api created
# endpoints/remote-api created

# Verify the endpoints
kubectl get endpoints remote-api -n multi-cluster-lab
# EXPECTED OUTPUT:
# NAME         ENDPOINTS           AGE
# remote-api   172.18.0.x:30090    5s
```

### Step 3 — Test cross-cluster connectivity

```bash
# Deploy a debug pod in Cluster A
kubectl run debug-pod --image=curlimages/curl -n multi-cluster-lab -- sleep 3600
kubectl wait --for=condition=ready pod/debug-pod -n multi-cluster-lab --timeout=60s
# EXPECTED OUTPUT: pod/debug-pod condition met

# Call the remote service from Cluster A
kubectl exec debug-pod -n multi-cluster-lab -- curl -s http://remote-api.multi-cluster-lab.svc.cluster.local:8080
# EXPECTED OUTPUT: Hello from Cluster B!

# Run it multiple times to verify consistency
for i in 1 2 3; do
  echo "Request $i:"
  kubectl exec debug-pod -n multi-cluster-lab -- curl -s http://remote-api.multi-cluster-lab.svc.cluster.local:8080
done
# EXPECTED OUTPUT:
# Request 1:
# Hello from Cluster B!
# Request 2:
# Hello from Cluster B!
# Request 3:
# Hello from Cluster B!
```

### Verification

```bash
# Verify the full chain
echo "=== Cluster A Resources ==="
kubectl get svc,endpoints,pods -n multi-cluster-lab --context kind-lab-cluster-a
# EXPECTED OUTPUT:
# NAME                 TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)    AGE
# service/remote-api   ClusterIP   None         <none>        8080/TCP   2m
#
# NAME                   ENDPOINTS           AGE
# endpoints/remote-api   172.18.0.x:30090    2m
#
# NAME            READY   STATUS    RESTARTS   AGE
# pod/debug-pod   1/1     Running   0          1m

echo ""
echo "=== Cluster B Resources ==="
kubectl get svc,pods -n multi-cluster-lab --context kind-lab-cluster-b
# EXPECTED OUTPUT:
# NAME                    TYPE       CLUSTER-IP     EXTERNAL-IP   PORT(S)          AGE
# service/cluster-b-api   NodePort   10.96.xx.xx    <none>        8080:30090/TCP   5m
#
# NAME                                 READY   STATUS    RESTARTS   AGE
# pod/cluster-b-api-xxxxxxxxxx-xxxxx   1/1     Running   0          5m
# pod/cluster-b-api-xxxxxxxxxx-yyyyy   1/1     Running   0          5m
```

---

## Exercise 4: Argo Rollouts Canary Deployment

**Objective:** Install Argo Rollouts, deploy a canary rollout, and promote it through canary steps with traffic shifting.

### Step 1 — Install Argo Rollouts

```bash
# Switch to Cluster A
kubectl config use-context kind-lab-cluster-a
# EXPECTED OUTPUT: Switched to context "kind-lab-cluster-a".

# Install Argo Rollouts
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml
# EXPECTED OUTPUT:
# namespace/argo-rollouts created (or already exists)
# customresourcedefinition.apiextensions.k8s.io/rollouts.argoproj.io created
# customresourcedefinition.apiextensions.k8s.io/analysisruns.argoproj.io created
# ... (multiple resources created)
# deployment.apps/argo-rollouts created

# Wait for Argo Rollouts controller to be ready
kubectl wait --for=condition=available deployment/argo-rollouts -n argo-rollouts --timeout=120s
# EXPECTED OUTPUT: deployment.apps/argo-rollouts condition met

# Install the Argo Rollouts kubectl plugin (optional but recommended)
# SYNTAX: brew install argoproj/tap/kubectl-argo-rollouts
# Or download directly:
# curl -LO https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-darwin-amd64
# chmod +x kubectl-argo-rollouts-darwin-amd64
# mv kubectl-argo-rollouts-darwin-amd64 /usr/local/bin/kubectl-argo-rollouts
brew install argoproj/tap/kubectl-argo-rollouts 2>/dev/null || echo "Install plugin manually if brew fails"

# Verify installation
kubectl argo rollouts version 2>/dev/null || kubectl get deployment -n argo-rollouts
# EXPECTED OUTPUT:
# kubectl-argo-rollouts: v1.x.x
# OR
# NAME             READY   UP-TO-DATE   AVAILABLE   AGE
# argo-rollouts    1/1     1            1           30s
```

### Step 2 — Create a Canary Rollout

```bash
# Create namespace
kubectl create namespace rollouts-lab
# EXPECTED OUTPUT: namespace/rollouts-lab created

# Deploy the canary rollout
cat <<'EOF' | kubectl apply -f -
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: canary-demo
  namespace: rollouts-lab
spec:
  replicas: 5
  revisionHistoryLimit: 3
  selector:
    matchLabels:
      app: canary-demo
  strategy:
    canary:
      steps:
        - setWeight: 20
        # WHY: First step — send 20% of traffic to canary
        - pause: {duration: 30s}
        # WHY: Wait 30 seconds to observe canary behavior
        - setWeight: 40
        # WHY: If canary looks good, increase to 40%
        - pause: {duration: 30s}
        - setWeight: 60
        # WHY: Increase to 60%
        - pause: {duration: 30s}
        - setWeight: 80
        # WHY: Almost full traffic to canary
        - pause: {duration: 30s}
        # WHY: Final observation before full promotion
  template:
    metadata:
      labels:
        app: canary-demo
    spec:
      containers:
        - name: app
          image: argoproj/rollouts-demo:blue
          # WHY: Start with the "blue" version
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 50m
              memory: 32Mi
---
apiVersion: v1
kind: Service
metadata:
  name: canary-demo
  namespace: rollouts-lab
spec:
  selector:
    app: canary-demo
  ports:
    - port: 80
      targetPort: 8080
      nodePort: 30081
  type: NodePort
EOF

# EXPECTED OUTPUT:
# rollout.argoproj.io/canary-demo created
# service/canary-demo created

# Wait for the rollout to be ready
kubectl wait --for=condition=available rollout/canary-demo -n rollouts-lab --timeout=120s 2>/dev/null
sleep 10

# Check the rollout status
kubectl argo rollouts get rollout canary-demo -n rollouts-lab 2>/dev/null || \
  kubectl get rollout canary-demo -n rollouts-lab -o wide
# EXPECTED OUTPUT:
# Name:            canary-demo
# Namespace:       rollouts-lab
# Status:          ✔ Healthy
# Strategy:        Canary
#   Step:          8/8
#   SetWeight:     100
#   ActualWeight:  100
# Images:          argoproj/rollouts-demo:blue (stable)
# Replicas:
#   Desired:       5
#   Current:       5
#   Updated:       5
#   Ready:         5
#   Available:     5

kubectl get pods -n rollouts-lab
# EXPECTED OUTPUT:
# NAME                           READY   STATUS    RESTARTS   AGE
# canary-demo-xxxxxxxxxx-aaaaa   1/1     Running   0          30s
# canary-demo-xxxxxxxxxx-bbbbb   1/1     Running   0          30s
# canary-demo-xxxxxxxxxx-ccccc   1/1     Running   0          30s
# canary-demo-xxxxxxxxxx-ddddd   1/1     Running   0          30s
# canary-demo-xxxxxxxxxx-eeeee   1/1     Running   0          30s
```

### Step 3 — Trigger a canary update

```bash
# Update the image to trigger a canary rollout
# WHY: Changing the image starts the canary process defined in strategy.canary.steps
kubectl argo rollouts set image canary-demo -n rollouts-lab \
  app=argoproj/rollouts-demo:yellow 2>/dev/null || \
kubectl patch rollout canary-demo -n rollouts-lab --type='json' \
  -p='[{"op":"replace","path":"/spec/template/spec/containers/0/image","value":"argoproj/rollouts-demo:yellow"}]'
# EXPECTED OUTPUT:
# rollout "canary-demo" image updated

# Watch the rollout progress
# WHY: This shows real-time canary step progression
kubectl argo rollouts get rollout canary-demo -n rollouts-lab -w 2>/dev/null &
WATCH_PID=$!

# Alternative if plugin is not installed:
# kubectl get rollout canary-demo -n rollouts-lab -w

# Wait a moment and check status
sleep 5
kubectl argo rollouts status canary-demo -n rollouts-lab 2>/dev/null || \
  kubectl get rollout canary-demo -n rollouts-lab -o jsonpath='{.status.phase}{"\n"}'
# EXPECTED OUTPUT: Progressing (or Paused)

# Check pods — you should see both blue and yellow pods
kubectl get pods -n rollouts-lab -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image,STATUS:.status.phase
# EXPECTED OUTPUT:
# NAME                           IMAGE                              STATUS
# canary-demo-xxxxxxxxxx-aaaaa   argoproj/rollouts-demo:blue        Running
# canary-demo-xxxxxxxxxx-bbbbb   argoproj/rollouts-demo:blue        Running
# canary-demo-xxxxxxxxxx-ccccc   argoproj/rollouts-demo:blue        Running
# canary-demo-xxxxxxxxxx-ddddd   argoproj/rollouts-demo:blue        Running
# canary-demo-yyyyyyyyyy-eeeee   argoproj/rollouts-demo:yellow      Running
# WHY: 1 out of 5 pods (20%) is running the canary (yellow) version
```

### Step 4 — Promote the canary to full rollout

```bash
# Wait for canary to progress through timed steps (each step is 30s)
# The rollout auto-advances through timed pauses
# Let's check the status after the steps auto-complete
sleep 35

kubectl argo rollouts get rollout canary-demo -n rollouts-lab 2>/dev/null || \
  kubectl get rollout canary-demo -n rollouts-lab -o jsonpath='{.status.currentStepIndex}{"\n"}'
# EXPECTED OUTPUT: Shows step 2 or 3 (progressing through the canary steps)

# You can also manually promote to skip the remaining pauses
# SYNTAX: kubectl argo rollouts promote <rollout-name> -n <namespace>
# FLAGS: --full to skip all remaining steps and go to 100%
kubectl argo rollouts promote canary-demo -n rollouts-lab --full 2>/dev/null || \
kubectl patch rollout canary-demo -n rollouts-lab --type='json' \
  -p='[{"op":"replace","path":"/status/promoteFull","value":true}]'
# EXPECTED OUTPUT:
# rollout 'canary-demo' promoted

# Wait for full promotion
sleep 15

# Verify all pods are now running the new version
kubectl get pods -n rollouts-lab -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image,STATUS:.status.phase
# EXPECTED OUTPUT:
# NAME                           IMAGE                              STATUS
# canary-demo-yyyyyyyyyy-aaaaa   argoproj/rollouts-demo:yellow      Running
# canary-demo-yyyyyyyyyy-bbbbb   argoproj/rollouts-demo:yellow      Running
# canary-demo-yyyyyyyyyy-ccccc   argoproj/rollouts-demo:yellow      Running
# canary-demo-yyyyyyyyyy-ddddd   argoproj/rollouts-demo:yellow      Running
# canary-demo-yyyyyyyyyy-eeeee   argoproj/rollouts-demo:yellow      Running
# WHY: All 5 pods are now running yellow — canary is fully promoted

# Kill the watch if still running
kill $WATCH_PID 2>/dev/null

# Check final rollout status
kubectl argo rollouts get rollout canary-demo -n rollouts-lab 2>/dev/null || \
  kubectl get rollout canary-demo -n rollouts-lab
# EXPECTED OUTPUT:
# Name:            canary-demo
# Namespace:       rollouts-lab
# Status:          ✔ Healthy
# Strategy:        Canary
#   Step:          8/8
#   SetWeight:     100
#   ActualWeight:  100
# Images:          argoproj/rollouts-demo:yellow (stable)
# Replicas:
#   Desired:       5
#   Current:       5
#   Updated:       5
#   Ready:         5
#   Available:     5
```

### Verification

```bash
# Test the rollout abort feature (bonus verification)
# First, trigger another update
kubectl argo rollouts set image canary-demo -n rollouts-lab \
  app=argoproj/rollouts-demo:red 2>/dev/null || \
kubectl patch rollout canary-demo -n rollouts-lab --type='json' \
  -p='[{"op":"replace","path":"/spec/template/spec/containers/0/image","value":"argoproj/rollouts-demo:red"}]'
# EXPECTED OUTPUT: rollout "canary-demo" image updated

sleep 10

# Abort the rollout — simulates discovering a problem with the canary
kubectl argo rollouts abort canary-demo -n rollouts-lab 2>/dev/null || \
kubectl patch rollout canary-demo -n rollouts-lab --type=merge \
  -p '{"status":{"abort":true}}'
# EXPECTED OUTPUT:
# rollout 'canary-demo' aborted

sleep 10

# Verify rollback to yellow (the previous stable version)
kubectl get pods -n rollouts-lab -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image
# EXPECTED OUTPUT:
# NAME                           IMAGE
# canary-demo-yyyyyyyyyy-aaaaa   argoproj/rollouts-demo:yellow
# canary-demo-yyyyyyyyyy-bbbbb   argoproj/rollouts-demo:yellow
# canary-demo-yyyyyyyyyy-ccccc   argoproj/rollouts-demo:yellow
# canary-demo-yyyyyyyyyy-ddddd   argoproj/rollouts-demo:yellow
# canary-demo-yyyyyyyyyy-eeeee   argoproj/rollouts-demo:yellow
# WHY: Abort rolled back to yellow — red canary pods were terminated

# Set image back to yellow to clear the Degraded status after abort
kubectl argo rollouts set image canary-demo -n rollouts-lab \
  app=argoproj/rollouts-demo:yellow 2>/dev/null || \
kubectl patch rollout canary-demo -n rollouts-lab --type='json' \
  -p='[{"op":"replace","path":"/spec/template/spec/containers/0/image","value":"argoproj/rollouts-demo:yellow"}]'

echo ""
echo "=== Exercise 4 Complete ==="
echo "Summary:"
echo "  1. Deployed canary-demo with blue image (5 replicas)"
echo "  2. Updated to yellow — canary rolled out at 20%/40%/60%/80%/100%"
echo "  3. Promoted canary to full rollout"
echo "  4. Triggered red update and aborted — rolled back to yellow"
```

---

## Cleanup

Remove all lab resources and delete both kind clusters.

```bash
# Step 1: Delete namespaces (cleans up all resources within them)
echo "=== Cleaning up namespaces ==="

kubectl config use-context kind-lab-cluster-a
kubectl delete namespace hpa-lab --ignore-not-found
kubectl delete namespace crd-lab --ignore-not-found
kubectl delete namespace multi-cluster-lab --ignore-not-found
kubectl delete namespace rollouts-lab --ignore-not-found
kubectl delete namespace argo-rollouts --ignore-not-found
# EXPECTED OUTPUT:
# namespace "hpa-lab" deleted
# namespace "crd-lab" deleted
# namespace "multi-cluster-lab" deleted
# namespace "rollouts-lab" deleted
# namespace "argo-rollouts" deleted

kubectl config use-context kind-lab-cluster-b
kubectl delete namespace multi-cluster-lab --ignore-not-found
# EXPECTED OUTPUT:
# namespace "multi-cluster-lab" deleted

# Step 2: Delete the CRD (cluster-scoped, not in a namespace)
kubectl config use-context kind-lab-cluster-a
kubectl delete crd websites.lab.example.com --ignore-not-found
# EXPECTED OUTPUT:
# customresourcedefinition.apiextensions.k8s.io "websites.lab.example.com" deleted

# Step 3: Delete both kind clusters
echo ""
echo "=== Deleting kind clusters ==="

kind delete cluster --name lab-cluster-a
# EXPECTED OUTPUT:
# Deleting cluster "lab-cluster-a" ...
# Deleted nodes: ["lab-cluster-a-control-plane" "lab-cluster-a-worker" "lab-cluster-a-worker2"]

kind delete cluster --name lab-cluster-b
# EXPECTED OUTPUT:
# Deleting cluster "lab-cluster-b" ...
# Deleted nodes: ["lab-cluster-b-control-plane" "lab-cluster-b-worker"]

# Step 4: Clean up temp files
rm -f /tmp/kind-cluster-a.yaml /tmp/kind-cluster-b.yaml /tmp/website-controller.sh

# Step 5: Verify everything is gone
kind get clusters
# EXPECTED OUTPUT: (empty — no clusters)

docker ps --filter "name=lab-cluster" --format "{{.Names}}"
# EXPECTED OUTPUT: (empty — no containers)

echo ""
echo "=== Cleanup Complete ==="
echo "All lab resources, clusters, and temp files have been removed."
```
