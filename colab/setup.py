import uvicorn
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import os
import json
import requests
import asyncio
from typing import Dict, Any, Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RenderRequest(BaseModel):
    jobId: str
    inputProps: Dict[str, Any]
    s3PutUrl: str

jobs = {}

@app.get("/health")
def health():
    return {"status": "ok", "gpu_vram_gb": 16.0}

@app.post("/render")
async def start_render(req: RenderRequest, background_tasks: BackgroundTasks):
    job_id = req.jobId
    jobs[job_id] = {"stage": "rendering", "progressPct": 0}
    
    def render_task():
        try:
            # Save input props
            with open(f"input_{job_id}.json", "w") as f:
                json.dump(req.inputProps, f)
            
            # Run remotion
            cmd = [
                "npx", "remotion", "render", "ReelComposition", 
                f"out_{job_id}.mp4", 
                f"--props=input_{job_id}.json",
                "--browser-executable=/usr/bin/chromium-browser"
            ]
            
            process = subprocess.Popen(cmd, cwd="/content/Brainclip/remotion", stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            
            for line in process.stdout:
                print(line, end="")
                
            process.wait()
            
            if process.returncode != 0:
                jobs[job_id] = {"stage": "failed", "error": "Remotion render failed"}
                return
                
            # Upload to S3
            out_file = f"/content/Brainclip/remotion/out_{job_id}.mp4"
            with open(out_file, "rb") as f:
                r = requests.put(req.s3PutUrl, data=f, headers={"Content-Type": "video/mp4"})
                if not r.ok:
                    jobs[job_id] = {"stage": "failed", "error": f"S3 upload failed: {r.status_code}"}
                    return
                    
            jobs[job_id] = {"stage": "done", "progressPct": 100}
            
        except Exception as e:
            jobs[job_id] = {"stage": "failed", "error": str(e)}

    background_tasks.add_task(render_task)
    return {"status": "started", "jobId": job_id}
