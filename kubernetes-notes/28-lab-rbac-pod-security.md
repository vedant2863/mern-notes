# File 28: Lab — RBAC and Pod Security

**Topic:** Hands-on exercises for RBAC configuration, ServiceAccount permissions, Pod Security Contexts, and Pod Security Admission enforcement

**WHY THIS MATTERS:**
Reading about RBAC and Pod Security is not enough. You need to build muscle memory for creating Roles, testing permissions with `kubectl auth can-i`, deploying hardened pods, and watching PSA reject insecure configurations. These exercises take you through real-world scenarios that you will encounter in production clusters.

---

## Prerequisites

| Tool | Purpose | Install Command | Verify Command |
|------|---------|----------------|----------------|
| kind | Local Kubernetes cluster | `brew install kind` | `kind --version` |
| kubectl | Kubernetes CLI | `brew install kubectl` | `kubectl version --client` |
| docker | Container runtime for kind | `brew install --cask docker` | `docker --version` |

### Cluster Setup

Create a kind cluster for this lab:

```bash
# SYNTAX: kind create cluster --name <name> --config <file>
# Create a single-node cluster

cat <<'EOF' > /tmp/kind-rbac-lab.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: rbac-lab
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: ClusterConfiguration
    apiServer:
      extraArgs:
        # WHY: Enable RBAC authorization (enabled by default in kind, but explicit is better)
        authorization-mode: "Node,RBAC"
EOF

kind create cluster --config /tmp/kind-rbac-lab.yaml

# EXPECTED OUTPUT:
# Creating cluster "rbac-lab" ...
#  ✓ Ensuring node image (kindest/node:v1.30.0) 🖼
#  ✓ Preparing nodes 📦
#  ✓ Writing configuration 📜
#  ✓ Starting control-plane 🕹️
#  ✓ Installing CNI 🔌
#  ✓ Installing StorageClass 💾
# Set kubectl context to "kind-rbac-lab"

# Verify the cluster is running
kubectl cluster-info --context kind-rbac-lab

# EXPECTED OUTPUT:
# Kubernetes control plane is running at https://127.0.0.1:XXXXX
# CoreDNS is running at https://127.0.0.1:XXXXX/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy
```

---

## Exercise 1: Create Role for Read-Only Pod Access and Test with ServiceAccount

**Objective:** Create a Role that grants read-only access to pods, bind it to a ServiceAccount, and verify permissions using `kubectl auth can-i --as`.

### Step 1 — Create a Namespace

```bash
# Create a namespace for the exercise
kubectl create namespace rbac-exercise

# EXPECTED OUTPUT:
# namespace/rbac-exercise created

# Verify
kubectl get namespace rbac-exercise

# EXPECTED OUTPUT:
# NAME             STATUS   AGE
# rbac-exercise    Active   5s
```

### Step 2 — Create a ServiceAccount

```bash
# SYNTAX: kubectl create serviceaccount <name> -n <namespace>

kubectl create serviceaccount pod-viewer -n rbac-exercise

# EXPECTED OUTPUT:
# serviceaccount/pod-viewer created

# Verify the ServiceAccount exists
kubectl get serviceaccount pod-viewer -n rbac-exercise

# EXPECTED OUTPUT:
# NAME         SECRETS   AGE
# pod-viewer   0         5s
```

### Step 3 — Create a Role for Read-Only Pod Access

```bash
# Create the Role YAML
cat <<'EOF' > /tmp/pod-reader-role.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: rbac-exercise
  name: pod-reader
rules:
- apiGroups: [""]               # WHY: Core API group — pods live here
  resources: ["pods"]           # WHY: Only pods — not services, secrets, or other resources
  verbs: ["get", "watch", "list"]  # WHY: Read-only — no create, update, delete
- apiGroups: [""]
  resources: ["pods/log"]       # WHY: Subresource — allows reading pod logs
  verbs: ["get"]                # WHY: Logs are retrieved with GET, not list
EOF

kubectl apply -f /tmp/pod-reader-role.yaml

# EXPECTED OUTPUT:
# role.rbac.authorization.k8s.io/pod-reader created

# Verify the Role
kubectl get role pod-reader -n rbac-exercise -o yaml

# EXPECTED OUTPUT (key fields):
# apiVersion: rbac.authorization.k8s.io/v1
# kind: Role
# metadata:
#   name: pod-reader
#   namespace: rbac-exercise
# rules:
# - apiGroups: [""]
#   resources: ["pods"]
#   verbs: ["get", "watch", "list"]
# - apiGroups: [""]
#   resources: ["pods/log"]
#   verbs: ["get"]
```

### Step 4 — Create a RoleBinding

```bash
# Bind the pod-reader Role to the pod-viewer ServiceAccount
cat <<'EOF' > /tmp/pod-reader-binding.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: pod-viewer-binding
  namespace: rbac-exercise
subjects:
- kind: ServiceAccount
  name: pod-viewer               # WHY: The ServiceAccount we created
  namespace: rbac-exercise       # WHY: Must specify namespace for ServiceAccounts
roleRef:
  kind: Role
  name: pod-reader               # WHY: Reference the Role we created
  apiGroup: rbac.authorization.k8s.io
EOF

kubectl apply -f /tmp/pod-reader-binding.yaml

# EXPECTED OUTPUT:
# rolebinding.rbac.authorization.k8s.io/pod-viewer-binding created
```

### Step 5 — Test Permissions with kubectl auth can-i

```bash
# SYNTAX: kubectl auth can-i <verb> <resource> --as system:serviceaccount:<namespace>:<name> -n <namespace>

# Test: Can the ServiceAccount list pods? (Should be YES)
kubectl auth can-i list pods \
  --as system:serviceaccount:rbac-exercise:pod-viewer \
  -n rbac-exercise

# EXPECTED OUTPUT:
# yes

# Test: Can the ServiceAccount get pod logs? (Should be YES)
kubectl auth can-i get pods/log \
  --as system:serviceaccount:rbac-exercise:pod-viewer \
  -n rbac-exercise

# EXPECTED OUTPUT:
# yes

# Test: Can the ServiceAccount delete pods? (Should be NO)
kubectl auth can-i delete pods \
  --as system:serviceaccount:rbac-exercise:pod-viewer \
  -n rbac-exercise

# EXPECTED OUTPUT:
# no

# Test: Can the ServiceAccount create deployments? (Should be NO)
kubectl auth can-i create deployments \
  --as system:serviceaccount:rbac-exercise:pod-viewer \
  -n rbac-exercise

# EXPECTED OUTPUT:
# no

# Test: Can the ServiceAccount list pods in a DIFFERENT namespace? (Should be NO)
kubectl auth can-i list pods \
  --as system:serviceaccount:rbac-exercise:pod-viewer \
  -n default

# EXPECTED OUTPUT:
# no

# List all permissions for this ServiceAccount
kubectl auth can-i --list \
  --as system:serviceaccount:rbac-exercise:pod-viewer \
  -n rbac-exercise

# EXPECTED OUTPUT:
# Resources                                       Non-Resource URLs   Resource Names   Verbs
# selfsubjectaccessreviews.authorization.k8s.io    []                  []               [create]
# selfsubjectrulesreviews.authorization.k8s.io     []                  []               [create]
# pods                                             []                  []               [get watch list]
# pods/log                                         []                  []               [get]
```

### Verification

```bash
# Deploy a test pod to verify the ServiceAccount can actually read pods
kubectl run test-pod --image=nginx:alpine -n rbac-exercise

# EXPECTED OUTPUT:
# pod/test-pod created

# Wait for pod to be ready
kubectl wait --for=condition=Ready pod/test-pod -n rbac-exercise --timeout=60s

# Use the ServiceAccount to list pods (simulated via --as)
kubectl get pods -n rbac-exercise \
  --as system:serviceaccount:rbac-exercise:pod-viewer

# EXPECTED OUTPUT:
# NAME       READY   STATUS    RESTARTS   AGE
# test-pod   1/1     Running   0          30s

# Try to delete (should be forbidden)
kubectl delete pod test-pod -n rbac-exercise \
  --as system:serviceaccount:rbac-exercise:pod-viewer

# EXPECTED OUTPUT:
# Error from server (Forbidden): pods "test-pod" is forbidden:
# User "system:serviceaccount:rbac-exercise:pod-viewer" cannot delete resource "pods"
# in API group "" in the namespace "rbac-exercise"
```

---

## Exercise 2: Create Aggregated ClusterRole and Verify Inherited Permissions

**Objective:** Create an aggregated ClusterRole that automatically combines permissions from labeled ClusterRoles.

### Step 1 — Create the Aggregating ClusterRole

```bash
# This ClusterRole aggregates permissions from any ClusterRole with the matching label
cat <<'EOF' > /tmp/aggregate-monitoring.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: aggregate-monitoring-viewer
aggregationRule:
  clusterRoleSelectors:
  - matchLabels:
      custom-rbac/aggregate-to-monitoring: "true"  # WHY: Selects ClusterRoles with this label
rules: []  # WHY: Must be empty — the controller fills this automatically
EOF

kubectl apply -f /tmp/aggregate-monitoring.yaml

# EXPECTED OUTPUT:
# clusterrole.rbac.authorization.k8s.io/aggregate-monitoring-viewer created

# Check initial rules — should be empty
kubectl get clusterrole aggregate-monitoring-viewer -o yaml | grep -A 5 "^rules"

# EXPECTED OUTPUT:
# rules: []
```

### Step 2 — Create Component ClusterRoles with Labels

```bash
# Component 1: Pod metrics viewer
cat <<'EOF' > /tmp/pod-metrics-role.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: pod-metrics-viewer
  labels:
    custom-rbac/aggregate-to-monitoring: "true"   # WHY: This label triggers aggregation
rules:
- apiGroups: ["metrics.k8s.io"]
  resources: ["pods"]
  verbs: ["get", "list"]
EOF

# Component 2: Node metrics viewer
cat <<'EOF' > /tmp/node-metrics-role.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: node-metrics-viewer
  labels:
    custom-rbac/aggregate-to-monitoring: "true"   # WHY: Same label — will be aggregated
rules:
- apiGroups: ["metrics.k8s.io"]
  resources: ["nodes"]
  verbs: ["get", "list"]
EOF

# Component 3: Events viewer
cat <<'EOF' > /tmp/events-viewer-role.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: events-viewer
  labels:
    custom-rbac/aggregate-to-monitoring: "true"   # WHY: Same label — will be aggregated
rules:
- apiGroups: [""]
  resources: ["events"]
  verbs: ["get", "list", "watch"]
EOF

kubectl apply -f /tmp/pod-metrics-role.yaml
kubectl apply -f /tmp/node-metrics-role.yaml
kubectl apply -f /tmp/events-viewer-role.yaml

# EXPECTED OUTPUT:
# clusterrole.rbac.authorization.k8s.io/pod-metrics-viewer created
# clusterrole.rbac.authorization.k8s.io/node-metrics-viewer created
# clusterrole.rbac.authorization.k8s.io/events-viewer created
```

### Step 3 — Verify Aggregation

```bash
# Check the aggregated ClusterRole — it should now contain ALL rules from the three components
kubectl get clusterrole aggregate-monitoring-viewer -o yaml

# EXPECTED OUTPUT (key sections):
# apiVersion: rbac.authorization.k8s.io/v1
# kind: ClusterRole
# metadata:
#   name: aggregate-monitoring-viewer
# aggregationRule:
#   clusterRoleSelectors:
#   - matchLabels:
#       custom-rbac/aggregate-to-monitoring: "true"
# rules:
# - apiGroups: ["metrics.k8s.io"]
#   resources: ["pods"]
#   verbs: ["get", "list"]
# - apiGroups: ["metrics.k8s.io"]
#   resources: ["nodes"]
#   verbs: ["get", "list"]
# - apiGroups: [""]
#   resources: ["events"]
#   verbs: ["get", "list", "watch"]
```

### Step 4 — Bind and Test the Aggregated Role

```bash
# Create a ServiceAccount to test
kubectl create serviceaccount monitoring-bot -n rbac-exercise

# Bind the aggregated ClusterRole
cat <<'EOF' > /tmp/monitoring-binding.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: monitoring-bot-binding
subjects:
- kind: ServiceAccount
  name: monitoring-bot
  namespace: rbac-exercise
roleRef:
  kind: ClusterRole
  name: aggregate-monitoring-viewer
  apiGroup: rbac.authorization.k8s.io
EOF

kubectl apply -f /tmp/monitoring-binding.yaml

# EXPECTED OUTPUT:
# clusterrolebinding.rbac.authorization.k8s.io/monitoring-bot-binding created

# Test inherited permissions
kubectl auth can-i list pods.metrics.k8s.io \
  --as system:serviceaccount:rbac-exercise:monitoring-bot

# EXPECTED OUTPUT:
# yes

kubectl auth can-i list events \
  --as system:serviceaccount:rbac-exercise:monitoring-bot

# EXPECTED OUTPUT:
# yes

kubectl auth can-i list nodes.metrics.k8s.io \
  --as system:serviceaccount:rbac-exercise:monitoring-bot

# EXPECTED OUTPUT:
# yes

# Verify no OTHER permissions were inherited
kubectl auth can-i list pods \
  --as system:serviceaccount:rbac-exercise:monitoring-bot

# EXPECTED OUTPUT:
# no
```

### Step 5 — Add a New Component and Verify Automatic Aggregation

```bash
# Add a new ClusterRole with the aggregation label
cat <<'EOF' > /tmp/configmap-viewer-role.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: configmap-viewer
  labels:
    custom-rbac/aggregate-to-monitoring: "true"
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list"]
EOF

kubectl apply -f /tmp/configmap-viewer-role.yaml

# EXPECTED OUTPUT:
# clusterrole.rbac.authorization.k8s.io/configmap-viewer created

# Verify the aggregated role now includes configmap access — NO rebinding needed
kubectl auth can-i list configmaps \
  --as system:serviceaccount:rbac-exercise:monitoring-bot

# EXPECTED OUTPUT:
# yes
```

### Verification

```bash
# Confirm the aggregated role has 4 rule sets
kubectl get clusterrole aggregate-monitoring-viewer -o json | \
  jq '.rules | length'

# EXPECTED OUTPUT:
# 4
```

---

## Exercise 3: Deploy Pod as Non-Root with Security Hardening

**Objective:** Deploy a pod with full security hardening — non-root user, read-only filesystem, all capabilities dropped — and verify each restriction works.

### Step 1 — Deploy a Hardened Pod

```bash
cat <<'EOF' > /tmp/hardened-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: hardened-app
  namespace: rbac-exercise
spec:
  securityContext:
    runAsNonRoot: true           # WHY: Reject if image tries to run as root
    runAsUser: 1000              # WHY: Run as UID 1000 — a non-privileged user
    runAsGroup: 1000             # WHY: Primary group GID 1000
    fsGroup: 1000                # WHY: Volume files owned by this group
    seccompProfile:
      type: RuntimeDefault      # WHY: Block dangerous syscalls
  containers:
  - name: app
    image: busybox:1.36
    command: ["sh", "-c", "echo 'Hardened pod running'; sleep 3600"]
    securityContext:
      allowPrivilegeEscalation: false    # WHY: Prevent setuid escalation
      readOnlyRootFilesystem: true       # WHY: No writes to container filesystem
      capabilities:
        drop:
        - ALL                            # WHY: Remove all Linux capabilities
    resources:
      requests:
        cpu: 50m
        memory: 32Mi
      limits:
        cpu: 100m
        memory: 64Mi
    volumeMounts:
    - name: tmp
      mountPath: /tmp                    # WHY: App can write temp files here
  volumes:
  - name: tmp
    emptyDir:
      sizeLimit: 10Mi                    # WHY: Limit writable space
EOF

kubectl apply -f /tmp/hardened-pod.yaml

# EXPECTED OUTPUT:
# pod/hardened-app created

# Wait for the pod to start
kubectl wait --for=condition=Ready pod/hardened-app -n rbac-exercise --timeout=60s

# EXPECTED OUTPUT:
# pod/hardened-app condition met
```

### Step 2 — Verify the User is Non-Root

```bash
# Check the running user
kubectl exec hardened-app -n rbac-exercise -- id

# EXPECTED OUTPUT:
# uid=1000 gid=1000 groups=1000

# Verify we are NOT root
kubectl exec hardened-app -n rbac-exercise -- whoami

# EXPECTED OUTPUT:
# whoami: unknown uid 1000
# (This is expected — the UID exists but has no /etc/passwd entry)
```

### Step 3 — Verify Read-Only Filesystem

```bash
# Try to write to the root filesystem (should fail)
kubectl exec hardened-app -n rbac-exercise -- touch /testfile

# EXPECTED OUTPUT:
# touch: /testfile: Read-only file system
# command terminated with exit code 1

# Try to write to /tmp (should succeed — it is an emptyDir volume)
kubectl exec hardened-app -n rbac-exercise -- touch /tmp/testfile

# EXPECTED OUTPUT:
# (no output — success)

# Verify the file was created
kubectl exec hardened-app -n rbac-exercise -- ls -la /tmp/testfile

# EXPECTED OUTPUT:
# -rw-r--r--    1 1000     1000             0 <date> /tmp/testfile
```

### Step 4 — Verify Capabilities are Dropped

```bash
# Check the capability bitmask
kubectl exec hardened-app -n rbac-exercise -- cat /proc/1/status | head -10

# Look at CapEff (effective capabilities) — should show 0 or near-zero
kubectl exec hardened-app -n rbac-exercise -- grep Cap /proc/1/status

# EXPECTED OUTPUT:
# CapInh: 0000000000000000
# CapPrm: 0000000000000000
# CapEff: 0000000000000000
# CapBnd: 0000000000000000
# CapAmb: 0000000000000000

# Try to bind to a privileged port (should fail — NET_BIND_SERVICE was not added)
# This confirms capabilities are truly dropped
```

### Step 5 — Verify Privilege Escalation is Blocked

```bash
# Check the no_new_privs flag
kubectl exec hardened-app -n rbac-exercise -- cat /proc/1/status | grep NoNewPrivs

# EXPECTED OUTPUT:
# NoNewPrivs:     1
# (1 means privilege escalation is blocked)
```

### Verification

```bash
# Summary check — all security features in one command
kubectl get pod hardened-app -n rbac-exercise -o jsonpath='{
  "runAsNonRoot": {.spec.securityContext.runAsNonRoot},
  "runAsUser": {.spec.securityContext.runAsUser},
  "seccomp": {.spec.securityContext.seccompProfile.type},
  "readOnly": {.spec.containers[0].securityContext.readOnlyRootFilesystem},
  "escalation": {.spec.containers[0].securityContext.allowPrivilegeEscalation}
}'

# EXPECTED OUTPUT:
# "runAsNonRoot": true,  "runAsUser": 1000,  "seccomp": RuntimeDefault,
# "readOnly": true,  "escalation": false
```

---

## Exercise 4: Label Namespace with PSA Restricted and Test Enforcement

**Objective:** Apply Pod Security Admission labels to a namespace, attempt to deploy a privileged pod (which should be rejected), then fix the pod to comply with the restricted level.

### Step 1 — Create a Namespace with PSA Labels

```bash
# Create a new namespace for PSA testing
cat <<'EOF' > /tmp/psa-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: psa-restricted
  labels:
    pod-security.kubernetes.io/enforce: restricted      # WHY: Reject non-compliant pods
    pod-security.kubernetes.io/enforce-version: v1.30   # WHY: Pin to specific version
    pod-security.kubernetes.io/warn: restricted          # WHY: Show warnings too
    pod-security.kubernetes.io/audit: restricted         # WHY: Log violations
EOF

kubectl apply -f /tmp/psa-namespace.yaml

# EXPECTED OUTPUT:
# namespace/psa-restricted created

# Verify the labels
kubectl get namespace psa-restricted --show-labels

# EXPECTED OUTPUT:
# NAME             STATUS   AGE   LABELS
# psa-restricted   Active   5s    pod-security.kubernetes.io/audit=restricted,
#                                  pod-security.kubernetes.io/enforce=restricted,
#                                  pod-security.kubernetes.io/enforce-version=v1.30,
#                                  pod-security.kubernetes.io/warn=restricted,...
```

### Step 2 — Attempt to Deploy a Privileged Pod (Should Be Rejected)

```bash
# This pod violates multiple restricted-level policies
cat <<'EOF' > /tmp/privileged-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: insecure-pod
  namespace: psa-restricted
spec:
  containers:
  - name: app
    image: nginx:latest
    securityContext:
      privileged: true           # VIOLATION: privileged containers are forbidden
    ports:
    - containerPort: 80
EOF

kubectl apply -f /tmp/privileged-pod.yaml

# EXPECTED OUTPUT:
# Error from server (Forbidden): error when creating "/tmp/privileged-pod.yaml":
# pods "insecure-pod" is forbidden: violates PodSecurity "restricted:v1.30":
# privileged (container "app" must not set securityContext.privileged=true),
# allowPrivilegeEscalation != false (container "app" must set securityContext.allowPrivilegeEscalation to false),
# unrestricted capabilities (container "app" must set securityContext.capabilities.drop=["ALL"]),
# runAsNonRoot != true (pod or container "app" must set securityContext.runAsNonRoot=true),
# seccompProfile (pod or container "app" must set securityContext.seccompProfile.type to "RuntimeDefault" or "Localhost")
```

### Step 3 — Attempt a Pod Without Privileged Flag but Still Insecure

```bash
# Remove privileged flag but still miss other requirements
cat <<'EOF' > /tmp/almost-secure-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: almost-secure
  namespace: psa-restricted
spec:
  containers:
  - name: app
    image: nginx:latest
    securityContext:
      runAsNonRoot: true        # Fixed: running as non-root
    ports:
    - containerPort: 80
EOF

kubectl apply -f /tmp/almost-secure-pod.yaml

# EXPECTED OUTPUT:
# Error from server (Forbidden): error when creating "/tmp/almost-secure-pod.yaml":
# pods "almost-secure" is forbidden: violates PodSecurity "restricted:v1.30":
# allowPrivilegeEscalation != false (container "app" must set securityContext.allowPrivilegeEscalation to false),
# unrestricted capabilities (container "app" must set securityContext.capabilities.drop=["ALL"]),
# seccompProfile (pod or container "app" must set securityContext.seccompProfile.type to "RuntimeDefault" or "Localhost")
```

**WHY:** Even without `privileged: true`, the pod is still rejected because it does not meet all restricted-level requirements. The error message tells you exactly what is missing.

### Step 4 — Fix the Pod to Be Fully Compliant

```bash
# Fully compliant with PSA restricted level
cat <<'EOF' > /tmp/compliant-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: compliant-app
  namespace: psa-restricted
spec:
  securityContext:
    runAsNonRoot: true                    # WHY: Required by restricted
    runAsUser: 65534                      # WHY: "nobody" user — image may default to root
    seccompProfile:
      type: RuntimeDefault               # WHY: Required by restricted
  containers:
  - name: app
    image: busybox:1.36                   # WHY: Using busybox instead of nginx — nginx needs root by default
    command: ["sh", "-c", "echo 'PSA-compliant pod running'; sleep 3600"]
    securityContext:
      allowPrivilegeEscalation: false     # WHY: Required by restricted
      readOnlyRootFilesystem: true        # WHY: Best practice (strongly recommended by restricted)
      capabilities:
        drop:
        - ALL                             # WHY: Required by restricted
    resources:
      requests:
        cpu: 50m
        memory: 32Mi
      limits:
        cpu: 100m
        memory: 64Mi
    volumeMounts:
    - name: tmp
      mountPath: /tmp
  volumes:
  - name: tmp
    emptyDir: {}
EOF

kubectl apply -f /tmp/compliant-pod.yaml

# EXPECTED OUTPUT:
# pod/compliant-app created

# Wait for it to run
kubectl wait --for=condition=Ready pod/compliant-app -n psa-restricted --timeout=60s

# EXPECTED OUTPUT:
# pod/compliant-app condition met

# Verify it is running
kubectl get pods -n psa-restricted

# EXPECTED OUTPUT:
# NAME            READY   STATUS    RESTARTS   AGE
# compliant-app   1/1     Running   0          10s
```

### Step 5 — Verify the Pod is Actually Running with Restrictions

```bash
# Check the user
kubectl exec compliant-app -n psa-restricted -- id

# EXPECTED OUTPUT:
# uid=65534(nobody) gid=65534(nobody)

# Verify read-only filesystem
kubectl exec compliant-app -n psa-restricted -- touch /file

# EXPECTED OUTPUT:
# touch: /file: Read-only file system

# Verify /tmp is writable
kubectl exec compliant-app -n psa-restricted -- touch /tmp/testfile

# EXPECTED OUTPUT:
# (no output — success)

# Verify capabilities are dropped
kubectl exec compliant-app -n psa-restricted -- grep CapEff /proc/1/status

# EXPECTED OUTPUT:
# CapEff: 0000000000000000
```

### Verification

```bash
# Final verification — attempt one more privileged pod to confirm enforcement is active
kubectl run rogue-pod --image=nginx -n psa-restricted

# EXPECTED OUTPUT:
# Error from server (Forbidden): pods "rogue-pod" is forbidden: violates PodSecurity "restricted:v1.30": ...

# Confirm only the compliant pod is running
kubectl get pods -n psa-restricted

# EXPECTED OUTPUT:
# NAME            READY   STATUS    RESTARTS   AGE
# compliant-app   1/1     Running   0          2m
```

---

## Cleanup

```bash
# Delete all resources created in this lab

# Delete the PSA namespace (also deletes all pods in it)
kubectl delete namespace psa-restricted

# EXPECTED OUTPUT:
# namespace "psa-restricted" deleted

# Delete the RBAC exercise namespace
kubectl delete namespace rbac-exercise

# EXPECTED OUTPUT:
# namespace "rbac-exercise" deleted

# Delete ClusterRoles (not namespace-scoped, so they persist)
kubectl delete clusterrole aggregate-monitoring-viewer
kubectl delete clusterrole pod-metrics-viewer
kubectl delete clusterrole node-metrics-viewer
kubectl delete clusterrole events-viewer
kubectl delete clusterrole configmap-viewer

# EXPECTED OUTPUT:
# clusterrole.rbac.authorization.k8s.io "aggregate-monitoring-viewer" deleted
# clusterrole.rbac.authorization.k8s.io "pod-metrics-viewer" deleted
# clusterrole.rbac.authorization.k8s.io "node-metrics-viewer" deleted
# clusterrole.rbac.authorization.k8s.io "events-viewer" deleted
# clusterrole.rbac.authorization.k8s.io "configmap-viewer" deleted

# Delete ClusterRoleBindings
kubectl delete clusterrolebinding monitoring-bot-binding

# EXPECTED OUTPUT:
# clusterrolebinding.rbac.authorization.k8s.io "monitoring-bot-binding" deleted

# Delete the kind cluster
kind delete cluster --name rbac-lab

# EXPECTED OUTPUT:
# Deleting cluster "rbac-lab" ...
# Deleted nodes: ["rbac-lab-control-plane"]

# Clean up temp files
rm -f /tmp/kind-rbac-lab.yaml /tmp/pod-reader-role.yaml /tmp/pod-reader-binding.yaml
rm -f /tmp/aggregate-monitoring.yaml /tmp/pod-metrics-role.yaml /tmp/node-metrics-role.yaml
rm -f /tmp/events-viewer-role.yaml /tmp/configmap-viewer-role.yaml /tmp/monitoring-binding.yaml
rm -f /tmp/hardened-pod.yaml /tmp/privileged-pod.yaml /tmp/almost-secure-pod.yaml
rm -f /tmp/compliant-pod.yaml /tmp/psa-namespace.yaml
```

**Cleanup Verification:**

```bash
# Confirm the cluster is deleted
kind get clusters

# EXPECTED OUTPUT:
# (no output — or list without "rbac-lab")

# Confirm no leftover ClusterRoles
kubectl get clusterrole aggregate-monitoring-viewer 2>&1

# EXPECTED OUTPUT:
# Error from server (NotFound): clusterroles.rbac.authorization.k8s.io "aggregate-monitoring-viewer" not found
```
