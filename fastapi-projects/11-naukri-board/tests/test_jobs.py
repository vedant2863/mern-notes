import pytest


@pytest.mark.anyio
async def test_create_job(client, sample_job):
    response = await client.post("/v1/jobs/", json=sample_job)
    assert response.status_code == 200

    data = response.json()
    assert data["title"] == "Python Developer"
    assert data["company"]["name"] == "TechCorp"
    assert "id" in data


@pytest.mark.anyio
async def test_list_jobs_v1(client, sample_job):
    # Create two jobs
    await client.post("/v1/jobs/", json=sample_job)
    job2 = sample_job.copy()
    job2["title"] = "Go Developer"
    await client.post("/v1/jobs/", json=job2)

    response = await client.get("/v1/jobs/")
    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.anyio
async def test_get_single_job(client, sample_job):
    create_resp = await client.post("/v1/jobs/", json=sample_job)
    job_id = create_resp.json()["id"]

    response = await client.get(f"/v1/jobs/{job_id}")
    assert response.status_code == 200
    assert response.json()["title"] == "Python Developer"


@pytest.mark.anyio
async def test_update_job(client, sample_job):
    create_resp = await client.post("/v1/jobs/", json=sample_job)
    job_id = create_resp.json()["id"]

    response = await client.put(f"/v1/jobs/{job_id}", json={"title": "Senior Python Dev"})
    assert response.status_code == 200
    assert response.json()["title"] == "Senior Python Dev"


@pytest.mark.anyio
async def test_delete_job(client, sample_job):
    create_resp = await client.post("/v1/jobs/", json=sample_job)
    job_id = create_resp.json()["id"]

    response = await client.delete(f"/v1/jobs/{job_id}")
    assert response.status_code == 200

    # Verify it is gone
    get_resp = await client.get(f"/v1/jobs/{job_id}")
    assert get_resp.status_code == 404


@pytest.mark.anyio
async def test_v2_filter_by_type(client, sample_job):
    await client.post("/v2/jobs/", json=sample_job)

    # Create a part-time job
    part_time = sample_job.copy()
    part_time["title"] = "Part-time Analyst"
    part_time["job_type"] = "part-time"
    await client.post("/v2/jobs/", json=part_time)

    # Filter for full-time only
    response = await client.get("/v2/jobs/?job_type=full-time")
    assert response.status_code == 200

    jobs = response.json()
    assert len(jobs) == 1
    assert jobs[0]["job_type"] == "full-time"
