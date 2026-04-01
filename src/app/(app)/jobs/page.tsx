"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/components/workspace-provider";

export default function JobsPage() {
  const {
    jobs,
    activeJobId,
    activeJob,
    jobResultUrl,
    selectedJobDetail,
    setSelectedJobDetail,
    isRetryingJob,
    isDeletingJob,
    openJobDetail,
    startPollingJob,
    retryJob,
    deleteJob,
    deleteOldJobs,
    refreshJobUrl
  } = useWorkspace();

  const [detailJobUrl, setDetailJobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (selectedJobDetail?.status === "done") {
      setDetailJobUrl(null);
      refreshJobUrl(selectedJobDetail.id).then(() => {
        fetch(`/api/jobs/${selectedJobDetail.id}/result`)
          .then(res => res.json())
          .then(data => {
            if (data.url) setDetailJobUrl(data.url);
          })
          .catch(() => {});
      });
    } else {
      setDetailJobUrl(null);
    }
  }, [selectedJobDetail?.id, selectedJobDetail?.status, refreshJobUrl]);

  const completedJobs = jobs.filter((job) => job.status === "done").length;

  return (
    <div className="workspace-stack">
      <div className="view-header">
        <h1>Jobs & Activity</h1>
        <p>Monitor your active renders and review past completed reels.</p>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <span className="stat-card-value">{jobs.length}</span>
          <span className="stat-card-label">Total Jobs</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-value">{completedJobs}</span>
          <span className="stat-card-label">Completed Renders</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-value">{activeJob?.progressPct ?? 0}%</span>
          <span className="stat-card-label">Live Progress</span>
        </div>
      </div>

      {activeJob && (
        <section className="panel-block active-job-panel" style={{boxShadow: 'var(--shadow-lg)', border: '1px solid var(--accent-soft)', background: 'linear-gradient(to bottom, var(--panel), var(--bg))'}}>
          <div className="panel-intro">
            <strong style={{color: 'var(--accent-deep)', fontSize: '1.2rem'}}>Active Pipeline</strong>
          </div>
          <div className="progress-track" style={{height: '14px', margin: '8px 0', border: '1px solid var(--line)'}}>
            <div className="progress-fill" style={{ width: `${activeJob.progressPct}%`, transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }} />
          </div>
          <div className="status-list wide" style={{display: 'flex', gap: '16px', background: 'var(--panel-strong)', padding: '16px', borderRadius: '16px'}}>
             <div className="status-row" style={{flex: 1, flexDirection: 'column', alignItems: 'flex-start', border: 'none', padding: 0}}>
                <strong style={{fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em'}}>Status</strong>
                <span style={{fontSize: '1.2rem', color: 'var(--ink)', fontWeight: 600}}>{activeJob.status}</span>
             </div>
             <div className="status-row" style={{flex: 1, flexDirection: 'column', alignItems: 'flex-start', border: 'none', padding: 0}}>
                <strong style={{fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em'}}>Stage</strong>
                <span style={{fontSize: '1.2rem', color: 'var(--ink)'}}>{activeJob.stage ?? "Waiting"}</span>
             </div>
          </div>
          {activeJob.errorMessage && <div className="error-banner">{activeJob.errorMessage}</div>}
          {jobResultUrl && <a className="primary-button inline-link" href={jobResultUrl} target="_blank" style={{boxShadow: 'var(--shadow-sm)', marginTop: '8px'}}>Download Video</a>}
        </section>
      )}

      <section className="panel-block">
        <div className="panel-intro">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <strong>Job History</strong>
            {jobs.length > 5 && (
              <button className="secondary-button small" onClick={deleteOldJobs} title="Delete old completed jobs">
                Cleanup Old
              </button>
            )}
          </div>
        </div>
        <div className="job-grid">
          {jobs.length === 0 ? (
            <div className="empty-panel" style={{textAlign: 'center'}}>No jobs rendered yet.</div>
          ) : (
            jobs.map((job) => (
              <button 
                key={job.id} 
                className={`job-card ${activeJobId === job.id ? "active" : ""} ${job.status === "failed" ? "failed" : ""}`} 
                onClick={() => openJobDetail(job)}
              >
                <div>
                  <strong className={`job-status-badge ${job.status}`}>{job.status}</strong>
                  <span>{job.stage ?? "Waiting"}</span>
                </div>
                <div className="job-progress-pill">{job.progressPct}%</div>
                {job.status === "done" && (
                  <div className="job-download-hint">Click to download</div>
                )}
              </button>
            ))
          )}
        </div>
      </section>

      {/* Job Detail Modal */}
      {selectedJobDetail && (
        <div className="job-detail-modal-overlay" onClick={() => setSelectedJobDetail(null)}>
          <div className="job-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="job-detail-header">
              <div>
                <h3>Job Details</h3>
                <span className="job-detail-id">ID: {selectedJobDetail.id.slice(0, 8)}...</span>
              </div>
              <button className="voice-modal-close" onClick={() => setSelectedJobDetail(null)}>×</button>
            </div>

            <div className="job-detail-body">
              <div className="job-detail-status">
                <div className={`status-indicator ${selectedJobDetail.status}`}>
                  {selectedJobDetail.status === "failed" && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="15" y1="9" x2="9" y2="15"/>
                      <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                  )}
                  {selectedJobDetail.status === "done" && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  )}
                  {selectedJobDetail.status === "pending" || selectedJobDetail.status === "voice_processing" || selectedJobDetail.status === "rendering" ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                  ) : null}
                  <span>{selectedJobDetail.status}</span>
                </div>
                <span className="job-detail-progress">{selectedJobDetail.progressPct}%</span>
              </div>

              <div className="job-detail-info">
                <div className="job-detail-row">
                  <span className="label">Stage</span>
                  <span className="value">{selectedJobDetail.stage ?? "Waiting"}</span>
                </div>
                <div className="job-detail-row">
                  <span className="label">Created</span>
                  <span className="value">{new Date(selectedJobDetail.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {selectedJobDetail.errorMessage && (
                <div className="job-detail-error">
                  <strong>Error:</strong>
                  <p>{selectedJobDetail.errorMessage}</p>
                </div>
              )}

              {selectedJobDetail.status === "failed" && (
                <div className="job-detail-actions">
                  <p className="action-hint">This job failed. You can retry from the failed stage:</p>
                  <div className="retry-buttons">
                    <button 
                      className="primary-button"
                      onClick={() => retryJob(selectedJobDetail.id, "voice")}
                      disabled={isRetryingJob}
                    >
                      {isRetryingJob ? (
                        <><span className="spinner-sm"></span> Retrying...</>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="1 4 1 10 7 10"/>
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                          </svg>
                          Retry from Voice
                        </>
                      )}
                    </button>
                    <button 
                      className="secondary-button"
                      onClick={() => retryJob(selectedJobDetail.id, "render")}
                      disabled={isRetryingJob}
                    >
                      Retry from Render
                    </button>
                    <button 
                      className="danger-button"
                      onClick={() => deleteJob(selectedJobDetail.id)}
                      disabled={isDeletingJob}
                    >
                      {isDeletingJob ? "Deleting..." : "Delete Job"}
                    </button>
                  </div>
                </div>
              )}

              {selectedJobDetail.status === "done" && (
                <div className="job-detail-actions">
                  {detailJobUrl ? (
                    <a className="primary-button" href={detailJobUrl} target="_blank">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download Video
                    </a>
                  ) : (
                    <button 
                      className="primary-button"
                      onClick={() => {
                        fetch(`/api/jobs/${selectedJobDetail.id}/result`)
                          .then(res => res.json())
                          .then(data => {
                            if (data.url) {
                              setDetailJobUrl(data.url);
                              window.open(data.url, "_blank");
                            }
                          })
                          .catch(() => {});
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download Video
                    </button>
                  )}
                  <button 
                    className="danger-button"
                    onClick={() => deleteJob(selectedJobDetail.id)}
                    disabled={isDeletingJob}
                  >
                    {isDeletingJob ? "Deleting..." : "Delete Job"}
                  </button>
                </div>
              )}

              {(selectedJobDetail.status === "pending" || selectedJobDetail.status === "voice_processing" || selectedJobDetail.status === "rendering") && (
                <div className="job-detail-actions">
                  <button 
                    className="secondary-button"
                    onClick={() => {
                      startPollingJob(selectedJobDetail.id);
                      setSelectedJobDetail(null);
                    }}
                  >
                    View Live Progress
                  </button>
                  <button 
                    className="danger-button"
                    onClick={() => deleteJob(selectedJobDetail.id)}
                    disabled={isDeletingJob}
                  >
                    {isDeletingJob ? "Deleting..." : "Cancel & Delete"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
