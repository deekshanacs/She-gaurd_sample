import uuid
import os
from datetime import datetime
from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import models
from database import engine, get_db
from forensics import run_forensic_suite

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="SheGuard Security Backend", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev environment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/analyze")
async def analyze_image(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    x_requested_with: str = Header(None)
):
    if x_requested_with != "sheguard-client":
        raise HTTPException(status_code=403, detail="CSRF Protection: Invalid request source")
        
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file is not an image.")
        
    try:
        contents = await file.read()
        
        # Run the forensics suite
        analysis = run_forensic_suite(contents)
        
        # Generate case ID
        case_id = f"SG-{uuid.uuid4().hex[:6].upper()}"
        
        # Save to database
        db_case = models.AnalysisCase(
            case_id=case_id,
            image_status=analysis["imageStatus"],
            confidence_score=analysis["confidenceScore"],
            forensic_score=analysis["forensicScore"],
            risk_level=analysis["riskLevel"],
            face_manipulation=analysis["details"]["faceManipulation"],
            splice_detection=analysis["details"]["spliceDetection"],
            metadata_anomaly=analysis["details"]["metadataAnomaly"],
            noise_analysis=analysis["details"]["noiseAnalysis"],
            ela_image_data=analysis["ela_image"]
        )
        db.add(db_case)
        db.commit()
        db.refresh(db_case)
        
        return {
            "caseId": case_id,
            "imageStatus": analysis["imageStatus"],
            "confidenceScore": analysis["confidenceScore"],
            "forensicScore": analysis["forensicScore"],
            "timestamp": db_case.timestamp.isoformat(),
            "riskLevel": analysis["riskLevel"],
            "details": analysis["details"],
            "metadata": analysis["metadata"],
            "ela_image": analysis["ela_image"]
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/api/reports")
def create_report(
    report_data: dict, 
    db: Session = Depends(get_db),
    x_requested_with: str = Header(None)
):
    if x_requested_with != "sheguard-client":
        raise HTTPException(status_code=403, detail="CSRF Protection: Invalid request source")
        
    # Validate input keys
    required_keys = ["name", "email", "gender", "age", "location", "contact", "description"]
    for key in required_keys:
        if key not in report_data:
            raise HTTPException(status_code=400, detail=f"Missing required field: {key}")
            
    case_id = f"SG-{uuid.uuid4().hex[:6].upper()}"
    
    db_report = models.IncidentReport(
        case_id=case_id,
        name=report_data["name"],
        email=report_data["email"],
        gender=report_data["gender"],
        age=str(report_data["age"]),
        location=report_data["location"],
        contact=report_data["contact"],
        description=report_data["description"],
        status="Filed",
        submitted_at=datetime.utcnow()
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    
    return {
        "caseId": db_report.case_id,
        "name": db_report.name,
        "email": db_report.email,
        "gender": db_report.gender,
        "age": db_report.age,
        "location": db_report.location,
        "contact": db_report.contact,
        "description": db_report.description,
        "status": db_report.status,
        "submittedAt": db_report.submitted_at.isoformat()
    }

@app.get("/api/reports")
def get_reports(db: Session = Depends(get_db)):
    reports = db.query(models.IncidentReport).order_by(models.IncidentReport.submitted_at.desc()).all()
    return [
        {
            "caseId": r.case_id,
            "name": r.name,
            "gender": r.gender,
            "age": r.age,
            "location": r.location,
            "contact": r.contact,
            "description": r.description,
            "status": r.status,
            "submittedAt": r.submitted_at.isoformat()
        } for r in reports
    ]

@app.get("/api/cases")
def get_cases(db: Session = Depends(get_db)):
    cases = db.query(models.AnalysisCase).order_by(models.AnalysisCase.timestamp.desc()).all()
    return [
        {
            "caseId": c.case_id,
            "imageStatus": c.image_status,
            "confidenceScore": c.confidence_score,
            "forensicScore": c.forensic_score,
            "timestamp": c.timestamp.isoformat(),
            "riskLevel": c.risk_level,
            "details": {
                "faceManipulation": c.face_manipulation,
                "spliceDetection": c.splice_detection,
                "metadataAnomaly": c.metadata_anomaly,
                "noiseAnalysis": c.noise_analysis
            }
        } for c in cases
    ]

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "sheguard-api"}

# Serve static files from the frontend build directory if it exists
frontend_dist = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{fallback_path:path}")
    async def serve_frontend(fallback_path: str):
        if fallback_path.startswith("api/") or fallback_path.startswith("health"):
            raise HTTPException(status_code=404)
        
        file_path = os.path.join(frontend_dist, fallback_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
            
        return FileResponse(os.path.join(frontend_dist, "index.html"))

