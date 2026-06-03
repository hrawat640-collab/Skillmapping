import re
from difflib import SequenceMatcher
from typing import List, Dict, Any

import fitz
import pdfplumber
from fastapi import FastAPI
from pydantic import BaseModel

try:
    from sentence_transformers import SentenceTransformer, util
    MODEL = SentenceTransformer("all-MiniLM-L6-v2")
except Exception:
    MODEL = None

app = FastAPI(title="CV Processing Service")


class ProcessPayload(BaseModel):
    cv_path: str
    role_keywords: Dict[str, Any]
    target_role: str
    experience_years: int
    last_designation: str
    education: str
    jds: List[Dict[str, Any]]


def extract_text(pdf_path: str) -> str:
    text = ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text += (page.extract_text() or "") + "\n"
        if text.strip():
            return text
    except Exception:
        pass

    doc = fitz.open(pdf_path)
    for page in doc:
        text += page.get_text("text") + "\n"
    return text


def extract_years(cv_text: str) -> float:
    yrs = []
    for m in re.findall(r"(\d+(?:\.\d+)?)\+?\s*(?:years|yrs|year)", cv_text, re.I):
        try:
            yrs.append(float(m))
        except Exception:
            continue
    return max(yrs) if yrs else 0.0


def semantic_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if MODEL:
        emb = MODEL.encode([a, b], convert_to_tensor=True)
        return float(util.cos_sim(emb[0], emb[1]).item() * 100.0)
    return SequenceMatcher(None, a.lower(), b.lower()).ratio() * 100.0


@app.post("/process")
def process(payload: ProcessPayload):
    cv_text = extract_text(payload.cv_path)
    cv_lower = cv_text.lower()
    must_have = payload.role_keywords.get("mustHave", [])
    nice_to_have = payload.role_keywords.get("niceToHave", [])

    matched_must = [k for k in must_have if k.lower() in cv_lower]
    missing_must = [k for k in must_have if k.lower() not in cv_lower]
    matched_nice = [k for k in nice_to_have if k.lower() in cv_lower]
    missing_nice = [k for k in nice_to_have if k.lower() not in cv_lower]

    keyword_score = round((len(matched_must) / max(len(must_have), 1)) * 100)
    cv_years = extract_years(cv_text)
    exp_gap = abs(cv_years - float(payload.experience_years))
    exp_score = max(0, round(100 - min(100, exp_gap * 20)))

    designation_score = round(
        semantic_similarity(payload.last_designation, payload.target_role)
    )
    education_score = round(
        semantic_similarity(payload.education, payload.target_role + " education requirements")
    )
    overall = round((keyword_score * 0.5) + (exp_score * 0.25) + (designation_score * 0.25))

    per_jd_scores = []
    for jd in payload.jds:
        jd_desc = jd.get("description", "")
        jd_sim = round(semantic_similarity(cv_text[:4000], jd_desc[:2000]))
        jd_keyword_matches = sum(1 for k in must_have if k.lower() in jd_desc.lower() and k.lower() in cv_lower)
        jd_keyword_score = round((jd_keyword_matches / max(len(must_have), 1)) * 100)
        jd_overall = round(jd_keyword_score * 0.6 + jd_sim * 0.4)
        per_jd_scores.append({
            "title": jd.get("title", payload.target_role),
            "company": jd.get("company", "Unknown"),
            "keyword_score": jd_keyword_score,
            "semantic_score": jd_sim,
            "overall_score": jd_overall
        })

    return {
        "extracted": {
            "text_preview": cv_text[:1000],
            "skills_detected": sorted(list(set(matched_must + matched_nice))),
            "experience_years_detected": cv_years,
            "education_input": payload.education
        },
        "keyword_analysis": {
            "matched_keywords": matched_must + matched_nice,
            "missing_keywords": missing_must + missing_nice,
            "must_have_count": len(matched_must),
            "missing_count": len(missing_must + missing_nice)
        },
        "scores": {
            "keywords": keyword_score,
            "experience": exp_score,
            "education_fit": education_score,
            "designation_fit": designation_score,
            "overall": overall
        },
        "per_jd_scores": per_jd_scores
    }
