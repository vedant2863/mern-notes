# File 25: Lab — Kubernetes Storage

**Topic:** Hands-on lab covering PersistentVolumes, PersistentVolumeClaims, StorageClasses with dynamic provisioning, volume expansion, and projected volumes

**WHY THIS MATTERS:**
Storage mistakes are among the most costly errors in Kubernetes — a wrong reclaim policy can delete production data, a missing StorageClass can leave pods stuck in Pending forever, and misunderstanding access modes can block pod scheduling. This lab gives you direct experience with the full storage lifecycle: creating volumes manually, using dynamic provisioning, expanding volumes on running pods, and combining multiple data sources into a single mount with projected volumes.

---

## Prerequisites

| Tool | Purpose | Install Command |
|------|---------|----------------|
| kind | Local Kubernetes cluster | `brew install kind` (macOS) / `go install sigs.k8s.io/kind@latest` |
| kubectl | Kubernetes CLI | `brew install kubectl` (macOS) / `curl -LO "https://dl.k8s.io/release/$(curl -sL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"` |
| docker | Container runtime for kind | `brew install --cask docker` (macOS) / `sudo apt-get install docker.io` |

---

## Cluster Setup

Create a kind cluster. The default kind cluster includes the `local-path-provisioner` StorageClass which supports dynamic provisioning — perfect for our storage exercises.

```yaml
# Save as: kind-storage-lab.yaml
# WHY: Single control-plane + 2 workers for testing storage across nodes
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: storage-lab
nodes:
  - role: control-plane
  - role: worker
    labels:
      storage-node: "true"
  - role: worker
    labels:
      storage-node: "true"
```

```bash
# Create the cluster
# EXPECTED OUTPUT:
# Creating cluster "storage-lab" ...
#  ✓ Ensuring node image (kindest/node:v1.31.0)
#  ✓ Preparing nodes
#  ✓ Writing configuration
#  ✓ Starting control-plane
#  ✓ Installing CNI
#  ✓ Installing StorageClass
#  ✓ Joining worker nodes
# Set kubectl context to "kind-storage-lab"

kind create cluster --config kind-storage-lab.yaml
```

```bash
# Verify cluster is ready
# EXPECTED OUTPUT:
# NAME                        STATUS   ROLES           AGE   VERSION
# storage-lab-control-plane   Ready    control-plane   60s   v1.31.0
# storage-lab-worker          Ready    <none>          45s   v1.31.0
# storage-lab-worker2         Ready    <none>          45s   v1.31.0

kubectl get nodes
```

```bash
# WHY: Check the default StorageClass that comes with kind
# EXPECTED OUTPUT:
# NAME                 PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
# standard (default)   rancher.io/local-path   Delete          WaitForFirstConsumer   false                  30s

kubectl get storageclass
```

---

## Exercise 1: Manual PV Creation, PVC Binding, and Data Persistence

**Objective:** Create a PersistentVolume manually, bind it with a PVC, mount it in a pod, write data, delete the pod, and verify the data persists when a new pod mounts the same PVC.

### Step 1 — Create a PersistentVolume

```bash
# WHY: Create the host directory on a worker node for our PV
# kind nodes are Docker containers, so we exec into the worker node
docker exec storage-lab-worker mkdir -p /mnt/data/manual-pv
```

```yaml
# Save as: manual-pv.yaml
# WHY: Manually provisioned PV using hostPath (for learning — not for production)
apiVersion: v1
kind: PersistentVolume
metadata:
  name: manual-pv
  labels:
    type: manual
    purpose: lab-exercise
spec:
  capacity:
    storage: 1Gi                              # WHY: 1Gi capacity
  accessModes:
    - ReadWriteOnce                           # WHY: single node read-write
  persistentVolumeReclaimPolicy: Retain       # WHY: keep data even after PVC deletion
  storageClassName: manual                    # WHY: custom class name — PVC must match this
  hostPath:
    path: /mnt/data/manual-pv                 # WHY: directory on the node
    type: DirectoryOrCreate
  nodeAffinity:                               # WHY: ensure PV is only usable on the worker node where we created the directory
    required:
      nodeSelectorTerms:
        - matchExpressions:
            - key: kubernetes.io/hostname
              operator: In
              values:
                - storage-lab-worker
```

```bash
kubectl apply -f manual-pv.yaml

# WHY: Verify PV is created and in "Available" state
# EXPECTED OUTPUT:
# NAME        CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS      CLAIM   STORAGECLASS   AGE
# manual-pv   1Gi        RWO            Retain           Available           manual         5s

kubectl get pv
```

### Step 2 — Create a PVC to bind to the PV

```yaml
# Save as: manual-pvc.yaml
# WHY: PVC requests storage — Kubernetes will find and bind it to our manual PV
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: manual-claim
spec:
  accessModes:
    - ReadWriteOnce                # WHY: must match the PV's access mode
  resources:
    requests:
      storage: 500Mi               # WHY: requesting 500Mi — PV has 1Gi, so it qualifies
  storageClassName: manual         # WHY: must match the PV's storageClassName
  selector:
    matchLabels:
      purpose: lab-exercise        # WHY: target our specific PV using labels
```

```bash
kubectl apply -f manual-pvc.yaml

# WHY: Verify PVC is bound to the PV
# EXPECTED OUTPUT:
# NAME           STATUS   VOLUME      CAPACITY   ACCESS MODES   STORAGECLASS   AGE
# manual-claim   Bound    manual-pv   1Gi        RWO            manual         5s

kubectl get pvc manual-claim

# WHY: PV should now show "Bound" status with the claim reference
# EXPECTED OUTPUT:
# NAME        CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM                  STORAGECLASS   AGE
# manual-pv   1Gi        RWO            Retain           Bound    default/manual-claim   manual         30s

kubectl get pv manual-pv
```

### Step 3 — Mount in a pod and write data

```yaml
# Save as: writer-pod.yaml
# WHY: Pod that writes data to the persistent volume
apiVersion: v1
kind: Pod
metadata:
  name: data-writer
spec:
  nodeSelector:
    kubernetes.io/hostname: storage-lab-worker  # WHY: must run on the node where the PV's hostPath exists
  containers:
    - name: writer
      image: busybox
      command:
        - sh
        - -c
        - |
          echo "=== Writing data to persistent volume ==="
          echo "Timestamp: $(date)" > /data/timestamp.txt
          echo "Message: Hello from the data-writer pod!" >> /data/timestamp.txt
          echo "Pod Name: $HOSTNAME" >> /data/timestamp.txt
          echo "Random ID: $(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 16)" >> /data/timestamp.txt
          echo "Written successfully. Contents:"
          cat /data/timestamp.txt
          echo "=== Sleeping to keep pod running ==="
          sleep 3600
      volumeMounts:
        - name: persistent-data
          mountPath: /data                  # WHY: where the PV is mounted in the container
  volumes:
    - name: persistent-data
      persistentVolumeClaim:
        claimName: manual-claim             # WHY: references our PVC
```

```bash
kubectl apply -f writer-pod.yaml
kubectl wait --for=condition=Ready pod/data-writer --timeout=60s

# WHY: Verify data was written
# EXPECTED OUTPUT:
# Timestamp: Mon Jan 15 10:30:00 UTC 2024
# Message: Hello from the data-writer pod!
# Pod Name: data-writer
# Random ID: aB3dEf7gHi9jKlMn

kubectl exec data-writer -- cat /data/timestamp.txt
```

### Step 4 — Delete the pod and verify data persists

```bash
# WHY: Delete the writer pod — data should survive because it's on a PV
kubectl delete pod data-writer

# Verify pod is gone
kubectl get pods
```

```yaml
# Save as: reader-pod.yaml
# WHY: New pod that reads the data written by the previous pod — proves persistence
apiVersion: v1
kind: Pod
metadata:
  name: data-reader
spec:
  nodeSelector:
    kubernetes.io/hostname: storage-lab-worker
  containers:
    - name: reader
      image: busybox
      command:
        - sh
        - -c
        - |
          echo "=== Reading data from persistent volume ==="
          if [ -f /data/timestamp.txt ]; then
            echo "SUCCESS: Data persisted across pod deletion!"
            echo "Contents:"
            cat /data/timestamp.txt
          else
            echo "FAILURE: No data found!"
          fi
          sleep 3600
      volumeMounts:
        - name: persistent-data
          mountPath: /data
  volumes:
    - name: persistent-data
      persistentVolumeClaim:
        claimName: manual-claim        # WHY: same PVC — same underlying storage
```

```bash
kubectl apply -f reader-pod.yaml
kubectl wait --for=condition=Ready pod/data-reader --timeout=60s

# WHY: Verify the data written by the previous pod is still there
# EXPECTED OUTPUT: same content as before — proves data persistence
kubectl exec data-reader -- cat /data/timestamp.txt

# WHY: Check logs to see the success message
# EXPECTED OUTPUT:
# === Reading data from persistent volume ===
# SUCCESS: Data persisted across pod deletion!
# Contents:
# Timestamp: Mon Jan 15 10:30:00 UTC 2024
# Message: Hello from the data-writer pod!
# ...

kubectl logs data-reader
```

### Step 5 — Explore the PV lifecycle

```bash
# WHY: Delete the PVC and observe the PV goes to "Released" (not Available) because reclaimPolicy=Retain

# First, delete the pod using the PVC
kubectl delete pod data-reader

# Now delete the PVC
kubectl delete pvc manual-claim

# WHY: PV status should be "Released" — data is preserved but PV can't be reused yet
# EXPECTED OUTPUT:
# NAME        CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS     CLAIM                  STORAGECLASS
# manual-pv   1Gi        RWO            Retain           Released   default/manual-claim   manual

kubectl get pv manual-pv
```

```bash
# WHY: To make the PV available again, remove the old claim reference
# SYNTAX: kubectl patch pv <name> --type=json -p='[{"op":"remove","path":"/spec/claimRef"}]'
# EXPECTED OUTPUT: persistentvolume/manual-pv patched

kubectl patch pv manual-pv --type=json -p='[{"op":"remove","path":"/spec/claimRef"}]'

# WHY: PV should be "Available" again
# EXPECTED OUTPUT: STATUS=Available

kubectl get pv manual-pv
```

```bash
# WHY: Verify the data is STILL on the node (Retain policy preserved it)
docker exec storage-lab-worker cat /mnt/data/manual-pv/timestamp.txt
```

---

## Exercise 2: Dynamic Provisioning with StorageClass

**Objective:** Set up a StorageClass with the local-path provisioner, create a PVC that triggers automatic PV creation, and verify the full dynamic provisioning workflow.

### Step 1 — Examine the default StorageClass

```bash
# WHY: kind comes with a default StorageClass using local-path-provisioner
# EXPECTED OUTPUT:
# Name:            standard
# IsDefaultClass:  Yes
# Provisioner:     rancher.io/local-path
# ReclaimPolicy:   Delete
# VolumeBindingMode: WaitForFirstConsumer
# AllowVolumeExpansion: false

kubectl describe storageclass standard
```

### Step 2 — Create a custom StorageClass

```yaml
# Save as: custom-storageclass.yaml
# WHY: Custom StorageClass with specific settings for our lab
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-local
  annotations:
    storageclass.kubernetes.io/is-default-class: "false"  # WHY: not the default — must be explicitly requested
provisioner: rancher.io/local-path      # WHY: same provisioner as default (kind uses local-path)
reclaimPolicy: Delete                    # WHY: auto-cleanup when PVC is deleted
volumeBindingMode: WaitForFirstConsumer  # WHY: wait for pod scheduling before provisioning
```

```bash
kubectl apply -f custom-storageclass.yaml

# WHY: Verify both StorageClasses exist
# EXPECTED OUTPUT:
# NAME                 PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION
# fast-local           rancher.io/local-path   Delete          WaitForFirstConsumer   false
# standard (default)   rancher.io/local-path   Delete          WaitForFirstConsumer   false

kubectl get storageclass
```

### Step 3 — Create a PVC using dynamic provisioning

```yaml
# Save as: dynamic-pvc.yaml
# WHY: PVC that triggers automatic PV creation via StorageClass
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: dynamic-claim
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-local       # WHY: references our custom StorageClass
  resources:
    requests:
      storage: 2Gi                   # WHY: request 2Gi — provisioner creates a 2Gi volume
```

```bash
kubectl apply -f dynamic-pvc.yaml

# WHY: PVC is "Pending" because volumeBindingMode=WaitForFirstConsumer
# No pod has requested this PVC yet, so no PV is created
# EXPECTED OUTPUT:
# NAME            STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   AGE
# dynamic-claim   Pending                                      fast-local     5s

kubectl get pvc dynamic-claim
```

### Step 4 — Create a pod that uses the PVC

```yaml
# Save as: dynamic-pod.yaml
# WHY: Pod triggers PV creation (WaitForFirstConsumer binding mode)
apiVersion: v1
kind: Pod
metadata:
  name: dynamic-app
spec:
  containers:
    - name: app
      image: nginx:1.25
      volumeMounts:
        - name: web-data
          mountPath: /usr/share/nginx/html    # WHY: serve files from the persistent volume
      ports:
        - containerPort: 80
  volumes:
    - name: web-data
      persistentVolumeClaim:
        claimName: dynamic-claim               # WHY: references the PVC — triggers binding
```

```bash
kubectl apply -f dynamic-pod.yaml
kubectl wait --for=condition=Ready pod/dynamic-app --timeout=120s

# WHY: Now the PVC should be "Bound" — PV was dynamically created
# EXPECTED OUTPUT:
# NAME            STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS
# dynamic-claim   Bound    pvc-xxxxxxxx-yyyy-zzzz-aaaa-bbbbbbbbbbbb   2Gi        RWO            fast-local

kubectl get pvc dynamic-claim
```

```bash
# WHY: A PV was automatically created — check it
# EXPECTED OUTPUT:
# NAME                                       CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM                   STORAGECLASS
# pvc-xxxxxxxx-yyyy-zzzz-aaaa-bbbbbbbbbbbb   2Gi        RWO            Delete           Bound    default/dynamic-claim   fast-local

kubectl get pv
```

```bash
# WHY: Write some web content to the volume and access it
kubectl exec dynamic-app -- sh -c 'echo "<h1>Served from Persistent Volume!</h1><p>Dynamic provisioning works.</p>" > /usr/share/nginx/html/index.html'

# Verify the content is served
kubectl exec dynamic-app -- curl -s http://localhost/
# EXPECTED OUTPUT: <h1>Served from Persistent Volume!</h1><p>Dynamic provisioning works.</p>
```

### Step 5 — Test the Delete reclaim policy

```bash
# WHY: With reclaimPolicy=Delete, deleting the PVC should also delete the PV

# Note the PV name before deletion
PV_NAME=$(kubectl get pvc dynamic-claim -o jsonpath='{.spec.volumeName}')
echo "PV name: $PV_NAME"

# Delete the pod first (it's using the PVC)
kubectl delete pod dynamic-app

# Delete the PVC
kubectl delete pvc dynamic-claim

# WHY: Both PVC and PV should be gone
# EXPECTED OUTPUT: PV not found (it was automatically deleted)
kubectl get pv $PV_NAME 2>&1 || echo "PV was deleted automatically (reclaimPolicy=Delete)"
```

---

## Exercise 3: Volume Expansion on a Running Pod

**Objective:** Create a StorageClass that allows volume expansion, provision a PVC, and expand it while the pod is running.

### Step 1 — Create an expansion-enabled StorageClass

```yaml
# Save as: expandable-sc.yaml
# WHY: StorageClass with allowVolumeExpansion=true
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: expandable-local
provisioner: rancher.io/local-path
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true               # WHY: this enables PVC resizing
```

```bash
kubectl apply -f expandable-sc.yaml

# WHY: Verify the ALLOWVOLUMEEXPANSION column shows true
# EXPECTED OUTPUT includes:
# NAME               PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION
# expandable-local   rancher.io/local-path   Delete          WaitForFirstConsumer   true

kubectl get storageclass expandable-local
```

### Step 2 — Create PVC and pod

```yaml
# Save as: expand-test.yaml
# WHY: PVC using the expandable StorageClass, and a pod that mounts it
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: expandable-claim
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: expandable-local
  resources:
    requests:
      storage: 1Gi                      # WHY: start with 1Gi — we'll expand to 5Gi later
---
apiVersion: v1
kind: Pod
metadata:
  name: expand-test-pod
spec:
  containers:
    - name: app
      image: busybox
      command: ["sh", "-c", "while true; do df -h /data; sleep 30; done"]
      volumeMounts:
        - name: expandable-vol
          mountPath: /data
  volumes:
    - name: expandable-vol
      persistentVolumeClaim:
        claimName: expandable-claim
```

```bash
kubectl apply -f expand-test.yaml
kubectl wait --for=condition=Ready pod/expand-test-pod --timeout=120s

# WHY: Check current volume size
# EXPECTED OUTPUT:
# NAME               STATUS   VOLUME     CAPACITY   ACCESS MODES   STORAGECLASS
# expandable-claim   Bound    pvc-xxx    1Gi        RWO            expandable-local

kubectl get pvc expandable-claim
```

```bash
# WHY: Check the filesystem size inside the pod
# EXPECTED OUTPUT: shows ~1Gi mounted at /data
kubectl exec expand-test-pod -- df -h /data
```

### Step 3 — Expand the volume

```bash
# WHY: Expand from 1Gi to 5Gi by patching the PVC
# SYNTAX: kubectl patch pvc <name> -p '{"spec":{"resources":{"requests":{"storage":"<new-size>"}}}}'
# EXPECTED OUTPUT: persistentvolumeclaim/expandable-claim patched

kubectl patch pvc expandable-claim -p '{"spec":{"resources":{"requests":{"storage":"5Gi"}}}}'
```

```bash
# WHY: Check PVC status — it may show a resize condition
# EXPECTED OUTPUT: CAPACITY may still show 1Gi initially, then updates to 5Gi

kubectl get pvc expandable-claim

# WHY: Check for resize conditions
kubectl describe pvc expandable-claim | grep -A 5 "Conditions"
# Possible conditions:
#   FileSystemResizePending — waiting for pod to notice
#   Resizing — in progress
```

```bash
# WHY: After expansion completes, verify new size
# Note: with local-path-provisioner, expansion may complete quickly or require a pod restart
# In production CSI drivers (EBS, GCE-PD), filesystem expansion happens online

kubectl get pvc expandable-claim -o jsonpath='{.status.capacity.storage}'
echo ""

# Check inside the pod
kubectl exec expand-test-pod -- df -h /data
```

```bash
# WHY: If the expansion doesn't take effect, restart the pod
kubectl delete pod expand-test-pod

# Recreate the pod (reapply the pod portion of expand-test.yaml or use this):
kubectl run expand-test-pod --image=busybox --restart=Never \
  --overrides='{
    "spec": {
      "containers": [{
        "name": "app",
        "image": "busybox",
        "command": ["sh", "-c", "df -h /data && sleep 3600"],
        "volumeMounts": [{"name": "expandable-vol", "mountPath": "/data"}]
      }],
      "volumes": [{
        "name": "expandable-vol",
        "persistentVolumeClaim": {"claimName": "expandable-claim"}
      }]
    }
  }'

kubectl wait --for=condition=Ready pod/expand-test-pod --timeout=60s
kubectl exec expand-test-pod -- df -h /data
```

---

## Exercise 4: Projected Volume — Combining Secret, ConfigMap, and downwardAPI

**Objective:** Create a projected volume that combines a Secret, a ConfigMap, and downwardAPI metadata into a single mount point. Verify all data sources are accessible from one directory.

### Step 1 — Create the Secret and ConfigMap

```bash
# WHY: Create a Secret with database credentials
# EXPECTED OUTPUT: secret/db-credentials created

kubectl create secret generic db-credentials \
  --from-literal=username=admin \
  --from-literal=password=s3cretP@ss \
  --from-literal=host=db.production.svc.cluster.local \
  --from-literal=port=5432
```

```yaml
# Save as: app-configmap.yaml
# WHY: ConfigMap with application configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-settings
data:
  app.conf: |
    # Application Configuration
    log_level=info
    max_connections=100
    cache_ttl=300
    feature_new_ui=true
    feature_dark_mode=false
  database.conf: |
    # Database Configuration
    pool_size=10
    timeout=30
    retry_count=3
```

```bash
kubectl apply -f app-configmap.yaml
```

### Step 2 — Create the projected volume pod

```yaml
# Save as: projected-pod.yaml
# WHY: Pod with a projected volume combining Secret + ConfigMap + downwardAPI
apiVersion: v1
kind: Pod
metadata:
  name: projected-demo
  labels:
    app: demo
    version: v2.1.0
    environment: lab
  annotations:
    team: platform
    oncall: platform-eng@company.com
spec:
  serviceAccountName: default
  containers:
    - name: app
      image: busybox
      command:
        - sh
        - -c
        - |
          echo "=== Projected Volume Contents ==="
          echo ""
          echo "--- Secret Data (db credentials) ---"
          echo "Username: $(cat /etc/app-config/secrets/username)"
          echo "Password: $(cat /etc/app-config/secrets/password)"
          echo "Host: $(cat /etc/app-config/secrets/host)"
          echo "Port: $(cat /etc/app-config/secrets/port)"
          echo ""
          echo "--- ConfigMap Data (app settings) ---"
          echo "App Config:"
          cat /etc/app-config/config/app.conf
          echo ""
          echo "Database Config:"
          cat /etc/app-config/config/database.conf
          echo ""
          echo "--- Downward API Data ---"
          echo "Pod Name: $(cat /etc/app-config/metadata/pod-name)"
          echo "Pod Namespace: $(cat /etc/app-config/metadata/namespace)"
          echo "Pod UID: $(cat /etc/app-config/metadata/uid)"
          echo "Node Name: $(cat /etc/app-config/metadata/node-name)"
          echo "Pod Labels:"
          cat /etc/app-config/metadata/labels
          echo ""
          echo "Pod Annotations:"
          cat /etc/app-config/metadata/annotations
          echo ""
          echo "--- Service Account Token ---"
          echo "Token (first 50 chars): $(head -c 50 /etc/app-config/token/sa-token)..."
          echo ""
          echo "=== Full Directory Listing ==="
          find /etc/app-config -type f | sort
          echo ""
          echo "=== Done ==="
          sleep 3600
      resources:
        requests:
          cpu: "100m"
          memory: "64Mi"
        limits:
          cpu: "200m"
          memory: "128Mi"
      volumeMounts:
        - name: all-config
          mountPath: /etc/app-config        # WHY: single mount point for everything
          readOnly: true
  volumes:
    - name: all-config
      projected:
        sources:
          # Source 1: Secret — database credentials
          - secret:
              name: db-credentials
              items:
                - key: username
                  path: secrets/username      # WHY: nested under secrets/ subdirectory
                - key: password
                  path: secrets/password
                - key: host
                  path: secrets/host
                - key: port
                  path: secrets/port

          # Source 2: ConfigMap — application settings
          - configMap:
              name: app-settings
              items:
                - key: app.conf
                  path: config/app.conf       # WHY: nested under config/ subdirectory
                - key: database.conf
                  path: config/database.conf

          # Source 3: Downward API — pod metadata
          - downwardAPI:
              items:
                - path: metadata/pod-name
                  fieldRef:
                    fieldPath: metadata.name    # WHY: pod's name
                - path: metadata/namespace
                  fieldRef:
                    fieldPath: metadata.namespace  # WHY: pod's namespace
                - path: metadata/uid
                  fieldRef:
                    fieldPath: metadata.uid     # WHY: pod's unique ID
                - path: metadata/node-name
                  fieldRef:
                    fieldPath: spec.nodeName    # WHY: which node the pod runs on
                - path: metadata/labels
                  fieldRef:
                    fieldPath: metadata.labels  # WHY: all pod labels as key=value pairs
                - path: metadata/annotations
                  fieldRef:
                    fieldPath: metadata.annotations  # WHY: all pod annotations
                - path: metadata/cpu-request
                  resourceFieldRef:
                    containerName: app
                    resource: requests.cpu      # WHY: CPU request as a file
                - path: metadata/memory-limit
                  resourceFieldRef:
                    containerName: app
                    resource: limits.memory     # WHY: memory limit as a file

          # Source 4: Service Account Token
          - serviceAccountToken:
              path: token/sa-token             # WHY: auto-rotated bound token
              expirationSeconds: 3600          # WHY: expires in 1 hour, kubelet auto-refreshes
              audience: "kubernetes.default.svc"
```

```bash
kubectl apply -f projected-pod.yaml
kubectl wait --for=condition=Ready pod/projected-demo --timeout=60s
```

### Step 3 — Verify all projected sources

```bash
# WHY: Check the pod logs to see all projected data
# EXPECTED OUTPUT includes data from all 4 sources:
# - Secret: username, password, host, port
# - ConfigMap: app.conf, database.conf contents
# - downwardAPI: pod-name, namespace, uid, node-name, labels, annotations
# - ServiceAccountToken: JWT token (truncated)

kubectl logs projected-demo
```

```bash
# WHY: Explore the directory structure interactively
# EXPECTED OUTPUT:
# /etc/app-config/
# ├── config/
# │   ├── app.conf
# │   └── database.conf
# ├── metadata/
# │   ├── annotations
# │   ├── cpu-request
# │   ├── labels
# │   ├── memory-limit
# │   ├── namespace
# │   ├── node-name
# │   ├── pod-name
# │   └── uid
# ├── secrets/
# │   ├── host
# │   ├── password
# │   ├── port
# │   └── username
# └── token/
#     └── sa-token

kubectl exec projected-demo -- find /etc/app-config -type f | sort
```

```bash
# WHY: Read individual files to verify content

echo "=== Secret: username ==="
kubectl exec projected-demo -- cat /etc/app-config/secrets/username

echo ""
echo "=== ConfigMap: app.conf ==="
kubectl exec projected-demo -- cat /etc/app-config/config/app.conf

echo ""
echo "=== Downward API: labels ==="
kubectl exec projected-demo -- cat /etc/app-config/metadata/labels

echo ""
echo "=== Downward API: cpu-request ==="
kubectl exec projected-demo -- cat /etc/app-config/metadata/cpu-request

echo ""
echo "=== Downward API: memory-limit ==="
kubectl exec projected-demo -- cat /etc/app-config/metadata/memory-limit

echo ""
echo "=== Service Account Token (first 80 chars) ==="
kubectl exec projected-demo -- head -c 80 /etc/app-config/token/sa-token
echo "..."
```

### Step 4 — Test live updates (ConfigMap changes propagate)

```bash
# WHY: ConfigMap changes propagate to projected volumes (with some delay)
# Update the ConfigMap
kubectl patch configmap app-settings --type=merge -p '{
  "data": {
    "app.conf": "# Application Configuration\nlog_level=debug\nmax_connections=200\ncache_ttl=600\nfeature_new_ui=true\nfeature_dark_mode=true"
  }
}'

echo "ConfigMap updated. Waiting 60 seconds for propagation..."
sleep 60

# WHY: Verify the change propagated
# EXPECTED OUTPUT: log_level should now be "debug", max_connections "200", dark_mode "true"
kubectl exec projected-demo -- cat /etc/app-config/config/app.conf
```

```bash
# WHY: Note that Secret changes also propagate, but serviceAccountToken is managed by kubelet
# Update the secret
kubectl patch secret db-credentials --type=merge -p '{"stringData":{"password":"newP@ssw0rd!"}}'

echo "Secret updated. Waiting 60 seconds for propagation..."
sleep 60

# WHY: Verify the secret change propagated
kubectl exec projected-demo -- cat /etc/app-config/secrets/password
# EXPECTED OUTPUT: newP@ssw0rd!
```

---

## Cleanup

```bash
# WHY: Remove all lab resources systematically

# Delete pods
kubectl delete pod data-reader data-writer dynamic-app expand-test-pod projected-demo --ignore-not-found

# Delete PVCs
kubectl delete pvc manual-claim dynamic-claim expandable-claim --ignore-not-found

# Delete PVs (manual PV might still exist with Retain policy)
kubectl delete pv manual-pv --ignore-not-found

# Delete StorageClasses (keep the default "standard" one)
kubectl delete storageclass fast-local expandable-local --ignore-not-found

# Delete Secret and ConfigMap
kubectl delete secret db-credentials --ignore-not-found
kubectl delete configmap app-settings --ignore-not-found

# Delete the kind cluster
kind delete cluster --name storage-lab

# Clean up YAML files
rm -f kind-storage-lab.yaml manual-pv.yaml manual-pvc.yaml writer-pod.yaml reader-pod.yaml \
  custom-storageclass.yaml dynamic-pvc.yaml dynamic-pod.yaml expandable-sc.yaml \
  expand-test.yaml app-configmap.yaml projected-pod.yaml

echo "Cleanup complete. All resources and the kind cluster have been removed."
```

```bash
# WHY: Verify the cluster is deleted
# EXPECTED OUTPUT: "storage-lab" should NOT appear in the list
kind get clusters
```
