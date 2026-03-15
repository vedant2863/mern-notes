# File 11: Lab — StatefulSets and Batch Workloads

**Topic:** Hands-on lab for deploying StatefulSets with stable DNS, verifying PVC reattachment, running parallel Jobs, and testing CronJob concurrency policies.

**WHY THIS MATTERS:** StatefulSets and Jobs behave fundamentally differently from Deployments. You need to see stable DNS in action, watch a deleted Pod reclaim its exact PVC, observe parallel Job execution, and understand what happens when a CronJob overlaps. This lab builds the operational intuition that theory alone cannot provide.

---

## Prerequisites

| Tool | Version | Install Command | Verify Command |
|------|---------|----------------|----------------|
| **kind** | v0.20+ | `brew install kind` (macOS) / `go install sigs.k8s.io/kind@latest` | `kind version` |
| **kubectl** | v1.28+ | `brew install kubectl` (macOS) / `curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"` | `kubectl version --client` |
| **Docker** | v24+ | [https://docs.docker.com/get-docker/](https://docs.docker.com/get-docker/) | `docker version` |

---

## Cluster Setup

### Step 1 — Create a kind Cluster with Persistent Storage

```bash
# Create the cluster configuration
cat <<'EOF' > kind-stateful-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: lab-stateful
nodes:
  - role: control-plane
  - role: worker
  - role: worker
  - role: worker
EOF

# Create the cluster
kind create cluster --config kind-stateful-config.yaml

# EXPECTED OUTPUT:
# Creating cluster "lab-stateful" ...
#  ✓ Ensuring node image (kindest/node:v1.29.0) 🖼
#  ✓ Preparing nodes 📦 📦 📦 📦
#  ✓ Writing configuration 📜
#  ✓ Starting control-plane 🕹️
#  ✓ Installing CNI 🔌
#  ✓ Installing StorageClass 💾
#  ✓ Joining worker nodes 🚜
# Set kubectl context to "kind-lab-stateful"
```

### Step 2 — Verify the Cluster

```bash
# Check nodes are ready
kubectl get nodes

# EXPECTED OUTPUT:
# NAME                         STATUS   ROLES           AGE   VERSION
# lab-stateful-control-plane   Ready    control-plane   30s   v1.29.0
# lab-stateful-worker          Ready    <none>          15s   v1.29.0
# lab-stateful-worker2         Ready    <none>          15s   v1.29.0
# lab-stateful-worker3         Ready    <none>          15s   v1.29.0

# Verify the default StorageClass exists (kind provides one)
kubectl get storageclass

# EXPECTED OUTPUT:
# NAME                 PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
# standard (default)   rancher.io/local-path   Delete          WaitForFirstConsumer   false                  30s
```

### Step 3 — Set Up Context

```bash
# Confirm we are using the right cluster
kubectl cluster-info --context kind-lab-stateful

# EXPECTED OUTPUT:
# Kubernetes control plane is running at https://127.0.0.1:PORT
# CoreDNS is running at https://127.0.0.1:PORT/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy
```

---

## Exercise 1: Deploy a 3-Replica StatefulSet and Verify Stable DNS

### Objective

Deploy a 3-replica StatefulSet with a headless Service, then verify that each Pod gets a stable, individually addressable DNS name using `nslookup` from a debug Pod.

### Step 1 — Create the Headless Service

The headless Service MUST be created before the StatefulSet. It provides the individual DNS records for each Pod.

```bash
cat <<'EOF' > headless-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: web-headless
  labels:
    app: web
spec:
  clusterIP: None
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80
      name: http
EOF

kubectl apply -f headless-service.yaml

# EXPECTED OUTPUT:
# service/web-headless created
```

### Step 2 — Create the StatefulSet

```bash
cat <<'EOF' > web-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
  labels:
    app: web
spec:
  serviceName: web-headless
  replicas: 3
  podManagementPolicy: OrderedReady
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      terminationGracePeriodSeconds: 10
      containers:
        - name: nginx
          image: nginx:1.25
          ports:
            - containerPort: 80
              name: http
          # Write the hostname to index.html so we can identify each Pod
          command:
            - /bin/sh
            - -c
            - |
              echo "Hello from $(hostname)" > /usr/share/nginx/html/index.html
              nginx -g 'daemon off;'
          volumeMounts:
            - name: data
              mountPath: /usr/share/nginx/html
          resources:
            requests:
              memory: "32Mi"
              cpu: "50m"
            limits:
              memory: "64Mi"
              cpu: "100m"
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes:
          - ReadWriteOnce
        storageClassName: standard
        resources:
          requests:
            storage: 1Gi
EOF

kubectl apply -f web-statefulset.yaml

# EXPECTED OUTPUT:
# statefulset.apps/web created
```

### Step 3 — Watch Ordered Startup

```bash
# Watch Pods start in order: web-0, then web-1, then web-2
kubectl get pods -l app=web -w

# EXPECTED OUTPUT:
# NAME    READY   STATUS    RESTARTS   AGE
# web-0   0/1     Pending   0          0s
# web-0   0/1     ContainerCreating   0   2s
# web-0   1/1     Running   0          8s
# web-1   0/1     Pending   0          0s        ← starts only after web-0 is Ready
# web-1   0/1     ContainerCreating   0   2s
# web-1   1/1     Running   0          9s
# web-2   0/1     Pending   0          0s        ← starts only after web-1 is Ready
# web-2   0/1     ContainerCreating   0   3s
# web-2   1/1     Running   0          10s

# (Press Ctrl+C when all 3 are Running)
```

### Step 4 — Verify PVCs Were Created

```bash
# Check that each Pod got its own PVC
kubectl get pvc

# EXPECTED OUTPUT:
# NAME         STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
# data-web-0   Bound    pvc-abc12345-6789-0123-4567-890abcdef01    1Gi        RWO            standard       30s
# data-web-1   Bound    pvc-def12345-6789-0123-4567-890abcdef02    1Gi        RWO            standard       22s
# data-web-2   Bound    pvc-ghi12345-6789-0123-4567-890abcdef03    1Gi        RWO            standard       13s
```

### Step 5 — Verify Stable DNS with nslookup from a Debug Pod

```bash
# Launch a debug pod with DNS tools
kubectl run dns-debug --image=busybox:1.36 --rm -it --restart=Never -- sh

# Once inside the debug pod, run these commands:

# Test 1: Resolve the headless Service (returns ALL Pod IPs)
nslookup web-headless.default.svc.cluster.local

# EXPECTED OUTPUT:
# Server:    10.96.0.10
# Address:   10.96.0.10:53
#
# Name:      web-headless.default.svc.cluster.local
# Address:   10.244.1.3
# Address:   10.244.2.4
# Address:   10.244.3.3

# Test 2: Resolve individual Pod DNS names
nslookup web-0.web-headless.default.svc.cluster.local

# EXPECTED OUTPUT:
# Server:    10.96.0.10
# Address:   10.96.0.10:53
#
# Name:      web-0.web-headless.default.svc.cluster.local
# Address:   10.244.1.3

nslookup web-1.web-headless.default.svc.cluster.local

# EXPECTED OUTPUT:
# Server:    10.96.0.10
# Address:   10.96.0.10:53
#
# Name:      web-1.web-headless.default.svc.cluster.local
# Address:   10.244.2.4

nslookup web-2.web-headless.default.svc.cluster.local

# EXPECTED OUTPUT:
# Server:    10.96.0.10
# Address:   10.96.0.10:53
#
# Name:      web-2.web-headless.default.svc.cluster.local
# Address:   10.244.3.3

# Test 3: Fetch content from each Pod by DNS name
wget -qO- http://web-0.web-headless.default.svc.cluster.local

# EXPECTED OUTPUT:
# Hello from web-0

wget -qO- http://web-1.web-headless.default.svc.cluster.local

# EXPECTED OUTPUT:
# Hello from web-1

wget -qO- http://web-2.web-headless.default.svc.cluster.local

# EXPECTED OUTPUT:
# Hello from web-2

# Exit the debug pod
exit

# EXPECTED OUTPUT:
# pod "dns-debug" deleted
```

### Verification

```bash
# Confirm StatefulSet is healthy
kubectl get statefulset web

# EXPECTED OUTPUT:
# NAME   READY   AGE
# web    3/3     2m

# Confirm Pod names are deterministic (web-0, web-1, web-2)
kubectl get pods -l app=web -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}'

# EXPECTED OUTPUT:
# web-0
# web-1
# web-2

# Confirm each Pod is on a different node (if anti-affinity or scheduler spread)
kubectl get pods -l app=web -o wide

# EXPECTED OUTPUT:
# NAME    READY   STATUS    RESTARTS   AGE   IP           NODE
# web-0   1/1     Running   0          2m    10.244.1.3   lab-stateful-worker
# web-1   1/1     Running   0          2m    10.244.2.4   lab-stateful-worker2
# web-2   1/1     Running   0          2m    10.244.3.3   lab-stateful-worker3
```

### Talking Points

- Unlike Deployment Pods (which get random hash names like `web-7f89bc4d1-abc12`), StatefulSet Pods get deterministic, sequential names: `web-0`, `web-1`, `web-2`.
- Each Pod has its own DNS record via the headless Service. This is how distributed systems discover individual members (e.g., Kafka brokers, Elasticsearch nodes).
- The headless Service (`clusterIP: None`) returns multiple A records — one for each Pod IP. A regular Service returns a single virtual IP.
- Ordered startup ensures `web-0` (often the primary/leader) is fully ready before replicas start.

---

## Exercise 2: Delete Pod-1 and Verify PVC Reattachment

### Objective

Delete `web-1`, watch it get recreated with the same name and the same PVC, proving that StatefulSet data persists across Pod restarts.

### Step 1 — Write Data to web-1

```bash
# Write a unique file to web-1's persistent volume
kubectl exec web-1 -- sh -c 'echo "Important data written at $(date)" > /usr/share/nginx/html/proof.txt'

# EXPECTED OUTPUT:
# (no output)

# Verify the file exists
kubectl exec web-1 -- cat /usr/share/nginx/html/proof.txt

# EXPECTED OUTPUT:
# Important data written at Mon Jan 15 10:30:00 UTC 2024

# Record the current PVC name and volume
kubectl get pvc data-web-1

# EXPECTED OUTPUT:
# NAME         STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
# data-web-1   Bound    pvc-def12345-6789-0123-4567-890abcdef02    1Gi        RWO            standard       5m
```

### Step 2 — Record the Pod UID (it will change after deletion)

```bash
# Save the current Pod UID for comparison
kubectl get pod web-1 -o jsonpath='{.metadata.uid}'

# EXPECTED OUTPUT:
# a1b2c3d4-e5f6-7890-abcd-ef0123456789
```

### Step 3 — Delete web-1

```bash
# Delete the Pod
kubectl delete pod web-1

# EXPECTED OUTPUT:
# pod "web-1" deleted

# Immediately watch it come back
kubectl get pods -l app=web -w

# EXPECTED OUTPUT:
# NAME    READY   STATUS        RESTARTS   AGE
# web-0   1/1     Running       0          6m
# web-1   1/1     Terminating   0          6m
# web-2   1/1     Running       0          6m
# web-1   0/1     Pending       0          0s
# web-1   0/1     ContainerCreating   0   2s
# web-1   1/1     Running       0          8s

# (Press Ctrl+C)
```

### Step 4 — Verify Same Name, New UID, Same PVC

```bash
# Verify the Pod name is the same
kubectl get pod web-1 -o jsonpath='{.metadata.name}'

# EXPECTED OUTPUT:
# web-1

# Verify the UID is DIFFERENT (it is a new Pod, not the old one)
kubectl get pod web-1 -o jsonpath='{.metadata.uid}'

# EXPECTED OUTPUT:
# f9e8d7c6-b5a4-3210-fedc-ba9876543210   ← Different from before!

# Verify the PVC is the SAME
kubectl get pvc data-web-1

# EXPECTED OUTPUT:
# NAME         STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
# data-web-1   Bound    pvc-def12345-6789-0123-4567-890abcdef02    1Gi        RWO            standard       7m
# ↑ Same volume name, same PVC — the data was preserved!
```

### Step 5 — Verify Data Survived the Restart

```bash
# Check if our file still exists
kubectl exec web-1 -- cat /usr/share/nginx/html/proof.txt

# EXPECTED OUTPUT:
# Important data written at Mon Jan 15 10:30:00 UTC 2024
# ↑ The EXACT same data from before the deletion!

# Also check the index.html was rewritten by the new container
kubectl exec web-1 -- cat /usr/share/nginx/html/index.html

# EXPECTED OUTPUT:
# Hello from web-1
```

### Step 6 — Verify DNS Still Works

```bash
# Run nslookup from a debug pod
kubectl run dns-verify --image=busybox:1.36 --rm -it --restart=Never -- nslookup web-1.web-headless.default.svc.cluster.local

# EXPECTED OUTPUT:
# Server:    10.96.0.10
# Address:   10.96.0.10:53
#
# Name:      web-1.web-headless.default.svc.cluster.local
# Address:   10.244.2.7    ← IP may have changed, but DNS name resolves correctly
# pod "dns-verify" deleted

# Fetch content via DNS
kubectl run http-verify --image=busybox:1.36 --rm -it --restart=Never -- wget -qO- http://web-1.web-headless.default.svc.cluster.local/proof.txt

# EXPECTED OUTPUT:
# Important data written at Mon Jan 15 10:30:00 UTC 2024
# pod "http-verify" deleted
```

### Verification

```bash
# Summary check: 3 Pods running, 3 PVCs bound, DNS resolves
kubectl get statefulset web
kubectl get pvc -l app=web
kubectl get pods -l app=web

# EXPECTED OUTPUT:
# NAME   READY   AGE
# web    3/3     8m
#
# NAME         STATUS   VOLUME         CAPACITY   ACCESS MODES   STORAGECLASS   AGE
# data-web-0   Bound    pvc-abc12...   1Gi        RWO            standard       8m
# data-web-1   Bound    pvc-def12...   1Gi        RWO            standard       8m
# data-web-2   Bound    pvc-ghi12...   1Gi        RWO            standard       8m
#
# NAME    READY   STATUS    RESTARTS   AGE
# web-0   1/1     Running   0          8m
# web-1   1/1     Running   0          1m     ← recently recreated
# web-2   1/1     Running   0          8m
```

### Talking Points

- The Pod UID changed (it is a completely new Pod), but the name `web-1` and PVC `data-web-1` remained the same. This is the core guarantee of StatefulSets.
- In a Deployment, a deleted Pod would get a random new name (like `web-7f89bc4d1-xyz99`) and would not reattach to any specific volume.
- The IP address may change after restart, but the DNS name always resolves to the current IP. This is why applications should use DNS names, not IP addresses.
- The PVC was never deleted during the Pod deletion — it stayed Bound the entire time, waiting for the new Pod to claim it.

---

## Exercise 3: Create a Job with completions=9, parallelism=3

### Objective

Create a Job that must complete 9 tasks, running 3 at a time. Watch 3 waves of 3 Pods execute and observe the Job's progress counter.

### Step 1 — Create the Parallel Job

```bash
cat <<'EOF' > parallel-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: parallel-worker
  labels:
    app: parallel-worker
spec:
  completions: 9
  parallelism: 3
  backoffLimit: 6
  template:
    metadata:
      labels:
        app: parallel-worker
    spec:
      restartPolicy: Never
      containers:
        - name: worker
          image: busybox:1.36
          command:
            - /bin/sh
            - -c
            - |
              WORKER=$(hostname)
              echo "[$WORKER] Starting work at $(date +%T)"
              DURATION=$((RANDOM % 6 + 5))
              echo "[$WORKER] Processing for ${DURATION} seconds..."
              sleep $DURATION
              echo "[$WORKER] Completed at $(date +%T)"
          resources:
            requests:
              memory: "16Mi"
              cpu: "25m"
            limits:
              memory: "32Mi"
              cpu: "50m"
EOF

kubectl apply -f parallel-job.yaml

# EXPECTED OUTPUT:
# job.batch/parallel-worker created
```

### Step 2 — Watch Pod Execution in Real-Time

```bash
# Open a second terminal or use this in the primary terminal
kubectl get pods -l app=parallel-worker -w

# EXPECTED OUTPUT (illustrative — timing will vary):
# NAME                      READY   STATUS              RESTARTS   AGE
# parallel-worker-abc12     0/1     ContainerCreating    0          1s
# parallel-worker-def34     0/1     ContainerCreating    0          1s
# parallel-worker-ghi56     0/1     ContainerCreating    0          1s     ← Wave 1: 3 pods
# parallel-worker-abc12     1/1     Running              0          3s
# parallel-worker-def34     1/1     Running              0          3s
# parallel-worker-ghi56     1/1     Running              0          3s
# parallel-worker-abc12     0/1     Completed            0          10s
# parallel-worker-jkl78     0/1     ContainerCreating    0          0s     ← Slot freed, 4th pod starts
# parallel-worker-def34     0/1     Completed            0          12s
# parallel-worker-mno90     0/1     ContainerCreating    0          0s     ← 5th pod
# parallel-worker-ghi56     0/1     Completed            0          13s
# parallel-worker-pqr12     0/1     ContainerCreating    0          0s     ← Wave 2: slots refill to 3
# parallel-worker-jkl78     0/1     Completed            0          8s
# parallel-worker-stu34     0/1     ContainerCreating    0          0s     ← 7th pod
# parallel-worker-mno90     0/1     Completed            0          9s
# parallel-worker-vwx56     0/1     ContainerCreating    0          0s     ← 8th pod
# parallel-worker-pqr12     0/1     Completed            0          7s
# parallel-worker-yza78     0/1     ContainerCreating    0          0s     ← 9th pod (last)
# parallel-worker-stu34     0/1     Completed            0          10s
# parallel-worker-vwx56     0/1     Completed            0          11s
# parallel-worker-yza78     0/1     Completed            0          8s     ← All 9 done!

# (Press Ctrl+C)
```

### Step 3 — Monitor Job Progress

```bash
# Check Job completions counter during execution
kubectl get job parallel-worker -w

# EXPECTED OUTPUT:
# NAME              COMPLETIONS   DURATION   AGE
# parallel-worker   0/9           3s         3s
# parallel-worker   1/9           10s        10s
# parallel-worker   2/9           12s        12s
# parallel-worker   3/9           13s        13s
# parallel-worker   4/9           21s        21s
# parallel-worker   5/9           22s        22s
# parallel-worker   6/9           23s        23s
# parallel-worker   7/9           31s        31s
# parallel-worker   8/9           33s        33s
# parallel-worker   9/9           35s        35s

# (Press Ctrl+C)
```

### Step 4 — View Logs from All Pods

```bash
# View logs with Pod name prefix
kubectl logs -l app=parallel-worker --prefix --timestamps

# FLAGS:
#   --prefix       Prepend pod name to each line
#   --timestamps   Add timestamps to each line
#
# EXPECTED OUTPUT:
# [pod/parallel-worker-abc12/worker] 2024-01-15T10:30:03Z [parallel-worker-abc12] Starting work at 10:30:03
# [pod/parallel-worker-abc12/worker] 2024-01-15T10:30:03Z [parallel-worker-abc12] Processing for 7 seconds...
# [pod/parallel-worker-abc12/worker] 2024-01-15T10:30:10Z [parallel-worker-abc12] Completed at 10:30:10
# [pod/parallel-worker-def34/worker] 2024-01-15T10:30:03Z [parallel-worker-def34] Starting work at 10:30:03
# [pod/parallel-worker-def34/worker] 2024-01-15T10:30:03Z [parallel-worker-def34] Processing for 9 seconds...
# [pod/parallel-worker-def34/worker] 2024-01-15T10:30:12Z [parallel-worker-def34] Completed at 10:30:12
# ...
```

### Step 5 — Inspect Completed Job

```bash
# Describe the Job
kubectl describe job parallel-worker

# EXPECTED OUTPUT (relevant sections):
# Completions:    9
# Parallelism:    3
# Start Time:     Mon, 15 Jan 2024 10:30:00 +0530
# Completed At:   Mon, 15 Jan 2024 10:30:35 +0530
# Duration:       35s
# Pods Statuses:  0 Active / 9 Succeeded / 0 Failed
# Events:
#   Type    Reason            Age   From            Message
#   ----    ------            ----  ----            -------
#   Normal  SuccessfulCreate  35s   job-controller  Created pod: parallel-worker-abc12
#   Normal  SuccessfulCreate  35s   job-controller  Created pod: parallel-worker-def34
#   Normal  SuccessfulCreate  35s   job-controller  Created pod: parallel-worker-ghi56
#   Normal  SuccessfulCreate  25s   job-controller  Created pod: parallel-worker-jkl78
#   ...
#   Normal  Completed         0s    job-controller  Job completed

# Count all completed pods
kubectl get pods -l app=parallel-worker --field-selector=status.phase=Succeeded --no-headers | wc -l

# EXPECTED OUTPUT:
# 9
```

### Verification

```bash
# Confirm all 9 completions
kubectl get job parallel-worker -o jsonpath='{.status.succeeded}'

# EXPECTED OUTPUT:
# 9

# Confirm 0 failures
kubectl get job parallel-worker -o jsonpath='{.status.failed}'

# EXPECTED OUTPUT:
# (empty — no failures)

# Confirm the job condition
kubectl get job parallel-worker -o jsonpath='{.status.conditions[0].type}'

# EXPECTED OUTPUT:
# Complete
```

### Talking Points

- The Job controller maintained exactly 3 active Pods at all times (until fewer than 3 completions remained). As one Pod completed, a new one was immediately created to fill the slot.
- All 9 Pods ran the same container image with the same command. Without an indexed job or work queue, each Pod does identical work — useful for load testing or embarrassingly parallel tasks.
- The `backoffLimit: 6` means if any Pod fails, the Job retries. Total failures across all Pods are counted against this limit.
- Completed Pods stay in `Completed` status (not deleted) so you can view their logs. Use `ttlSecondsAfterFinished` for automatic cleanup.

---

## Exercise 4: Create a CronJob and Test concurrencyPolicy: Forbid

### Objective

Create a CronJob that runs every 2 minutes with `concurrencyPolicy: Forbid`. Observe that if a Job is still running when the next schedule fires, the new run is skipped.

### Step 1 — Create the CronJob

```bash
cat <<'EOF' > report-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: report-generator
  labels:
    app: report-generator
spec:
  schedule: "*/2 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 2
  startingDeadlineSeconds: 120
  jobTemplate:
    spec:
      backoffLimit: 1
      template:
        metadata:
          labels:
            app: report-generator
        spec:
          restartPolicy: OnFailure
          containers:
            - name: reporter
              image: busybox:1.36
              command:
                - /bin/sh
                - -c
                - |
                  echo "Report generation started at $(date +%T)"
                  echo "Generating quarterly report..."
                  sleep 30
                  echo "Report completed at $(date +%T)"
              resources:
                requests:
                  memory: "16Mi"
                  cpu: "25m"
                limits:
                  memory: "32Mi"
                  cpu: "50m"
EOF

kubectl apply -f report-cronjob.yaml

# EXPECTED OUTPUT:
# cronjob.batch/report-generator created
```

### Step 2 — Check CronJob Status

```bash
# Verify the CronJob was created
kubectl get cronjob report-generator

# EXPECTED OUTPUT:
# NAME               SCHEDULE      SUSPEND   ACTIVE   LAST SCHEDULE   AGE
# report-generator   */2 * * * *   False     0        <none>          10s

# Wait for the first run (up to 2 minutes)
# You can watch for the Job to be created:
kubectl get jobs -l app=report-generator -w

# EXPECTED OUTPUT (after up to 2 minutes):
# NAME                            COMPLETIONS   DURATION   AGE
# report-generator-28401120       0/1           5s         5s
# report-generator-28401120       1/1           32s        32s
```

### Step 3 — Create a Long-Running Version to Test Forbid

To properly test `concurrencyPolicy: Forbid`, we need a Job that runs longer than the 2-minute schedule interval.

```bash
# Patch the CronJob to make the task take 150 seconds (longer than 2-minute interval)
kubectl patch cronjob report-generator -p '{"spec":{"jobTemplate":{"spec":{"template":{"spec":{"containers":[{"name":"reporter","command":["/bin/sh","-c","echo \"Long report started at $(date +%T)\"; sleep 150; echo \"Report done at $(date +%T)\""]}]}}}}}}'

# EXPECTED OUTPUT:
# cronjob.batch/report-generator patched

# Wait for the next scheduled run (check every 30s)
kubectl get cronjob report-generator

# EXPECTED OUTPUT (once a Job starts):
# NAME               SCHEDULE      SUSPEND   ACTIVE   LAST SCHEDULE   AGE
# report-generator   */2 * * * *   False     1        30s             5m
#                                            ↑ 1 active Job

# Watch what happens at the NEXT scheduled time (2 minutes later)
# The new Job should be SKIPPED because concurrencyPolicy is Forbid
kubectl get events --field-selector reason=MissSchedule --watch

# Alternative: Check the CronJob description for skip events
kubectl describe cronjob report-generator

# EXPECTED OUTPUT (relevant section):
# Events:
#   Type     Reason            Age   From                Message
#   ----     ------            ----  ----                -------
#   Normal   SuccessfulCreate  3m    cronjob-controller  Created job report-generator-28401120
#   Normal   SawCompletedJob   90s   cronjob-controller  Saw completed job: report-generator-28401120
#   Normal   SuccessfulCreate  60s   cronjob-controller  Created job report-generator-28401122
#   Warning  MissSchedule      0s    cronjob-controller  Missed scheduled time to start a job
#                                                        ↑ SKIPPED because previous Job is still running!
```

### Step 4 — Verify Forbid Behavior

```bash
# Check active Jobs — should never exceed 1 with Forbid
kubectl get jobs -l app=report-generator

# EXPECTED OUTPUT:
# NAME                           COMPLETIONS   DURATION   AGE
# report-generator-28401120      1/1           32s        6m     ← old completed
# report-generator-28401122      0/1           90s        90s    ← currently running
# NO second active Job exists — Forbid policy prevented it

# Count active pods (should be exactly 1 or 0)
kubectl get pods -l app=report-generator --field-selector=status.phase=Running --no-headers | wc -l

# EXPECTED OUTPUT:
# 1    (or 0 if between runs)
```

### Step 5 — Restore Short Duration and Watch Normal Operation

```bash
# Patch back to a short-running Job (30 seconds, less than 2-minute interval)
kubectl patch cronjob report-generator -p '{"spec":{"jobTemplate":{"spec":{"template":{"spec":{"containers":[{"name":"reporter","command":["/bin/sh","-c","echo \"Quick report at $(date +%T)\"; sleep 30; echo \"Done at $(date +%T)\""]}]}}}}}}'

# EXPECTED OUTPUT:
# cronjob.batch/report-generator patched

# Wait a few minutes and check that Jobs are now running without skips
kubectl get jobs -l app=report-generator --sort-by=.metadata.creationTimestamp

# EXPECTED OUTPUT (after waiting ~6 minutes):
# NAME                           COMPLETIONS   DURATION   AGE
# report-generator-28401122      1/1           152s       8m
# report-generator-28401124      1/1           32s        4m
# report-generator-28401126      1/1           31s        2m
# ↑ When Jobs finish before the next schedule, every run executes normally
```

### Step 6 — Manually Trigger a CronJob

```bash
# Create a Job from the CronJob template (manual trigger)
kubectl create job --from=cronjob/report-generator report-manual-test

# EXPECTED OUTPUT:
# job.batch/report-manual-test created

# Watch it run
kubectl get pod -l job-name=report-manual-test -w

# EXPECTED OUTPUT:
# NAME                       READY   STATUS              RESTARTS   AGE
# report-manual-test-abc12   0/1     ContainerCreating    0          1s
# report-manual-test-abc12   1/1     Running              0          3s
# report-manual-test-abc12   0/1     Completed            0          33s

# View logs
kubectl logs job/report-manual-test

# EXPECTED OUTPUT:
# Quick report at 10:45:03
# Done at 10:45:33
```

### Verification

```bash
# Final verification of the CronJob state
kubectl get cronjob report-generator

# EXPECTED OUTPUT:
# NAME               SCHEDULE      SUSPEND   ACTIVE   LAST SCHEDULE   AGE
# report-generator   */2 * * * *   False     0        45s             12m

# Check history limits are being respected
kubectl get jobs -l app=report-generator --no-headers | wc -l

# EXPECTED OUTPUT:
# 3 (or 4 if manual job is counted)
# successfulJobsHistoryLimit: 3 keeps only the last 3 successful Jobs

# Verify no Jobs are in failed state
kubectl get jobs -l app=report-generator -o jsonpath='{range .items[*]}{.metadata.name}: {.status.conditions[0].type}{"\n"}{end}'

# EXPECTED OUTPUT:
# report-generator-28401122: Complete
# report-generator-28401124: Complete
# report-generator-28401126: Complete
```

### Talking Points

- `concurrencyPolicy: Forbid` is the safest option for jobs that access shared resources (databases, APIs with rate limits). It prevents overlap at the cost of occasionally skipping a run.
- The CronJob controller logs a `MissSchedule` event when a run is skipped. Monitor these events to detect if your Job consistently runs longer than the schedule interval.
- `successfulJobsHistoryLimit: 3` automatically cleans up old Jobs. Without this, completed Jobs and their Pods accumulate indefinitely.
- `kubectl create job --from=cronjob/` is invaluable for testing — it runs the CronJob immediately without waiting for the next scheduled time.
- `startingDeadlineSeconds: 120` means if the CronJob controller misses the schedule by more than 2 minutes (e.g., controller was down), it skips the run entirely rather than executing it late.

---

## Cleanup

```bash
# Delete all resources created in this lab

# Delete the StatefulSet (Pods will be terminated in reverse order)
kubectl delete statefulset web

# EXPECTED OUTPUT:
# statefulset.apps "web" deleted

# Delete the headless Service
kubectl delete service web-headless

# EXPECTED OUTPUT:
# service "web-headless" deleted

# Delete PVCs (StatefulSet does NOT auto-delete these)
kubectl delete pvc data-web-0 data-web-1 data-web-2

# EXPECTED OUTPUT:
# persistentvolumeclaim "data-web-0" deleted
# persistentvolumeclaim "data-web-1" deleted
# persistentvolumeclaim "data-web-2" deleted

# Delete the parallel Job and its Pods
kubectl delete job parallel-worker

# EXPECTED OUTPUT:
# job.batch "parallel-worker" deleted

# Delete the CronJob (this also deletes any Jobs it created)
kubectl delete cronjob report-generator

# EXPECTED OUTPUT:
# cronjob.batch "report-generator" deleted

# Delete any remaining manual test jobs
kubectl delete job report-manual-test --ignore-not-found

# EXPECTED OUTPUT:
# job.batch "report-manual-test" deleted

# Delete the kind cluster
kind delete cluster --name lab-stateful

# EXPECTED OUTPUT:
# Deleting cluster "lab-stateful" ...
# Deleted nodes: ["lab-stateful-control-plane" "lab-stateful-worker" "lab-stateful-worker2" "lab-stateful-worker3"]

# Clean up YAML files
rm -f kind-stateful-config.yaml headless-service.yaml web-statefulset.yaml parallel-job.yaml report-cronjob.yaml

# Verify cleanup
kind get clusters

# EXPECTED OUTPUT:
# (no output, or other clusters if you have them)

kubectl config get-contexts

# The "kind-lab-stateful" context should no longer appear
```

---

## Summary

| Exercise | What You Learned |
|----------|-----------------|
| 1. StatefulSet DNS | Pods get deterministic names (web-0, web-1, web-2) and individual DNS records via headless Service |
| 2. PVC Reattachment | Deleting a StatefulSet Pod recreates it with the same name and reattaches the same PVC — data survives |
| 3. Parallel Job | `completions` sets total work, `parallelism` sets concurrency; Kubernetes manages the queue |
| 4. CronJob Forbid | `concurrencyPolicy: Forbid` skips new runs if the previous one is still active — prevents overlap |
