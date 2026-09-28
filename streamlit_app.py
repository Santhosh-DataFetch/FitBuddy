import os
import uuid
from datetime import date, timedelta
from typing import Literal

import pandas as pd
import streamlit as st
from pydantic import BaseModel, Field

try:
    from google import genai
    from google.genai import types
except Exception:
    genai = None
    types = None

try:
    from supabase import Client, create_client
except Exception:
    Client = object
    create_client = None


# -----------------------------------------------------------------------------
# FitBuddy Streamlit Showcase
# -----------------------------------------------------------------------------
# This is a Streamlit presentation/deployment surface for the existing FitBuddy
# Supabase schema. It does not replace the React/Node application in this repo.
# Secrets are read only from Streamlit secrets / environment variables.
# -----------------------------------------------------------------------------

st.set_page_config(
    page_title="FitBuddy — AI Fitness Coach",
    page_icon="🏋️",
    layout="wide",
    initial_sidebar_state="expanded",
)

CATALOG = {
    "squat": {"name": "Bodyweight Squat", "category": "Strength", "muscles": "Quadriceps · Glutes", "equipment": "Bodyweight", "difficulty": "Beginner", "instructions": "Sit the hips down and back, keep the chest open, then drive through the whole foot."},
    "pushup": {"name": "Incline Push-up", "category": "Strength", "muscles": "Chest · Shoulders · Triceps", "equipment": "Bench or wall", "difficulty": "Beginner", "instructions": "Keep a straight line from shoulders to heels and lower with control."},
    "row": {"name": "Resistance Band Row", "category": "Strength", "muscles": "Upper back · Biceps", "equipment": "Resistance band", "difficulty": "Beginner", "instructions": "Pull elbows toward your ribs while keeping shoulders relaxed."},
    "hinge": {"name": "Dumbbell Romanian Deadlift", "category": "Strength", "muscles": "Hamstrings · Glutes", "equipment": "Dumbbells", "difficulty": "Intermediate", "instructions": "Hinge at the hips with a long spine and stop when the hamstrings feel loaded."},
    "lunge": {"name": "Reverse Lunge", "category": "Strength", "muscles": "Glutes · Quadriceps", "equipment": "Bodyweight", "difficulty": "Beginner", "instructions": "Step back softly, keep the front knee tracking over the middle toes, then stand tall."},
    "plank": {"name": "Forearm Plank", "category": "Core", "muscles": "Core · Shoulders", "equipment": "Bodyweight", "difficulty": "Beginner", "instructions": "Brace gently, keep hips level, and breathe without forcing the hold."},
    "deadbug": {"name": "Dead Bug", "category": "Core", "muscles": "Deep core · Hip flexors", "equipment": "Bodyweight", "difficulty": "Beginner", "instructions": "Move opposite arm and leg slowly while keeping the lower back comfortably grounded."},
    "walk": {"name": "Brisk Walk", "category": "Cardio", "muscles": "Cardiovascular system · Legs", "equipment": "None", "difficulty": "Beginner", "instructions": "Walk at a pace where talking is possible but you feel purposefully warm."},
    "mobility": {"name": "Hip and Shoulder Flow", "category": "Mobility", "muscles": "Hips · Shoulders · Spine", "equipment": "Bodyweight", "difficulty": "Beginner", "instructions": "Move through a comfortable range and breathe evenly; never force a stretch."},
    "bridge": {"name": "Glute Bridge", "category": "Strength", "muscles": "Glutes · Hamstrings", "equipment": "Bodyweight", "difficulty": "Beginner", "instructions": "Press through the heels and squeeze the glutes at the top without arching the back."},
}


class Exercise(BaseModel):
    exercise_id: str
    sets: int | None = Field(default=None, ge=1, le=8)
    reps: int | None = Field(default=None, ge=1, le=50)
    duration_minutes: int | None = Field(default=None, ge=1, le=60)
    rest_seconds: int = Field(ge=0, le=300)
    instruction: str = Field(min_length=5, max_length=300)


class Workout(BaseModel):
    date: str
    day: str
    title: str
    type: str
    duration_minutes: int = Field(ge=10, le=120)
    intensity: Literal["low", "medium", "high"]
    warmup: list[str]
    exercises: list[Exercise]
    cooldown: list[str]
    recovery_note: str


class NutritionTip(BaseModel):
    category: str
    title: str
    content: str


class WeeklyPlan(BaseModel):
    summary: str
    why_this_plan: str
    weekly_plan: list[Workout] = Field(min_length=7, max_length=7)
    nutrition_tips: list[NutritionTip] = Field(min_length=2, max_length=5)



def secret(name: str, default: str = "") -> str:
    try:
        value = st.secrets.get(name, default)
    except Exception:
        value = os.getenv(name, default)
    return str(value or "").strip()


def get_supabase() -> Client | None:
    if create_client is None:
        return None
    url = secret("SUPABASE_URL")
    key = secret("SUPABASE_PUBLISHABLE_KEY") or secret("SUPABASE_ANON_KEY")
    if not url or not key:
        return None
    try:
        return create_client(url, key)
    except Exception:
        return None


def get_gemini():
    if genai is None:
        return None
    key = secret("GEMINI_API_KEY")
    if not key:
        return None
    return genai.Client(api_key=key)


@st.cache_data(ttl=300, show_spinner=False)
def catalog_for_prompt() -> list[dict]:
    return [
        {"exercise_id": key, "name": value["name"], "equipment": value["equipment"]}
        for key, value in CATALOG.items()
    ]


def generate_plan(profile: dict, start_date: date, model_name: str) -> WeeklyPlan:
    client = get_gemini()
    if client is None or types is None:
        raise RuntimeError("Gemini is not configured. Add GEMINI_API_KEY to Streamlit Secrets.")

    system = (
        "You are FitBuddy's safe fitness planning engine. Return ONLY JSON matching the supplied schema. "
        "Use only exercise_id values from the provided catalog. Build exactly seven consecutive dates. "
        "Respect age, goal, experience, location, equipment, schedule, session duration and limitations. "
        "Do not diagnose, treat injuries, or prescribe around medical conditions. Prefer sustainable training. "
        "For nutrition, give general wellness guidance, not medical or therapeutic advice."
    )
    prompt = f"""
{system}

Exercise catalog:
{catalog_for_prompt()}

Profile:
{profile}

Start date: {start_date.isoformat()}

Create a practical 7-day plan. Training days must respect the user's available days; use recovery/mobility/rest
on other days. Keep each session between 10 and the requested session duration. Use only catalog exercise IDs.
Each exercise should have either sets/reps or duration. Include concise warm-up, cooldown and recovery notes.
"""
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=WeeklyPlan,
        ),
    )
    if getattr(response, "parsed", None):
        plan = response.parsed
        if isinstance(plan, WeeklyPlan):
            return plan
    return WeeklyPlan.model_validate_json(response.text)


def save_profile(sb: Client, user_id: str, profile: dict) -> None:
    row = {
        "id": user_id,
        "name": profile["name"],
        "age": profile["age"],
        "weight_kg": profile["weight_kg"],
        "height_cm": profile.get("height_cm"),
        "unit": profile["unit"],
        "fitness_goal": profile["goal"],
        "experience_level": profile["experience"],
        "workout_intensity": profile["intensity"],
        "training_location": profile["location"],
        "available_days": profile["training_days"],
        "session_duration": profile["session_duration"],
        "equipment": profile["equipment"],
        "activities": profile.get("activities", []),
        "dietary_preference": profile.get("dietary_preference", ""),
        "foods_to_avoid": profile.get("foods_to_avoid", ""),
        "limitations": profile.get("limitations", ""),
        "timezone": profile.get("timezone", "UTC"),
        "onboarding_completed": True,
    }
    result = sb.table("profiles").upsert(row).execute()
    if getattr(result, "data", None) is None:
        raise RuntimeError("Supabase did not save the profile.")


def load_profile(sb: Client, user_id: str) -> dict | None:
    result = sb.table("profiles").select("*").eq("id", user_id).limit(1).execute()
    if result.data:
        return result.data[0]
    return None


def load_latest_plan(sb: Client, user_id: str):
    result = sb.table("workout_plans").select("*").eq("user_id", user_id).order("version", desc=True).limit(1).execute()
    return result.data[0] if result.data else None


def load_workouts(sb: Client, user_id: str, plan_id: str) -> list[dict]:
    result = sb.table("workouts").select("*").eq("user_id", user_id).eq("plan_id", plan_id).order("scheduled_date").execute()
    return result.data or []


def load_progress(sb: Client, user_id: str) -> list[dict]:
    result = sb.table("workout_completions").select("*").eq("user_id", user_id).order("completed_at", desc=True).limit(100).execute()
    return result.data or []


def persist_plan(sb: Client, user_id: str, plan: WeeklyPlan, profile: dict, reason: str) -> str:
    previous = load_latest_plan(sb, user_id)
    version = int(previous["version"]) + 1 if previous else 1
    plan_id = str(uuid.uuid4())
    generation_id = uuid.uuid4().hex[:18]
    start = date.fromisoformat(plan.weekly_plan[0].date)
    end = date.fromisoformat(plan.weekly_plan[-1].date)

    sb.table("workout_plans").insert({
        "id": plan_id,
        "user_id": user_id,
        "version": version,
        "plan_start_date": start.isoformat(),
        "plan_end_date": end.isoformat(),
        "user_timezone": profile.get("timezone") or "UTC",
        "summary": plan.summary,
        "why_this_plan": plan.why_this_plan,
        "reason": reason,
        "feedback": None,
        "model_id": secret("GEMINI_WORKOUT_MODEL", "gemini-3.8-flash"),
        "prompt_version": "fitbuddy.streamlit.v1",
        "schema_version": "2.0",
        "generation_id": generation_id,
    }).execute()

    snapshot = plan.model_dump()
    sb.table("plan_versions").insert({
        "plan_id": plan_id,
        "user_id": user_id,
        "version": version,
        "reason": reason,
        "feedback": None,
        "snapshot": snapshot,
        "model_id": secret("GEMINI_WORKOUT_MODEL", "gemini-3.8-flash"),
        "prompt_version": "fitbuddy.streamlit.v1",
        "schema_version": "2.0",
    }).execute()

    workout_rows = []
    for day in plan.weekly_plan:
        workout_rows.append({
            "plan_id": plan_id,
            "user_id": user_id,
            "scheduled_date": day.date,
            "day_label": day.day,
            "title": day.title,
            "type": day.type,
            "duration_minutes": day.duration_minutes,
            "intensity": day.intensity,
            "warmup": day.warmup,
            "exercises": [item.model_dump() for item in day.exercises],
            "cooldown": day.cooldown,
            "recovery_note": day.recovery_note,
            "status": "upcoming",
        })
    sb.table("workouts").insert(workout_rows).execute()

    nutrition_rows = [{
        "user_id": user_id,
        "plan_id": plan_id,
        "category": item.category,
        "title": item.title,
        "content": item.content,
    } for item in plan.nutrition_tips]
    if nutrition_rows:
        sb.table("nutrition_tips").insert(nutrition_rows).execute()

    if previous:
        sb.table("plan_changes").insert({
            "user_id": user_id,
            "plan_id": plan_id,
            "from_version": previous["version"],
            "to_version": version,
            "reason": reason,
            "changed_sections": ["weekly_plan", "nutrition"],
        }).execute()
    return plan_id


def complete_workout(sb: Client, user_id: str, workout: dict, feel: str, energy: str, note: str):
    sb.table("workout_completions").insert({
        "workout_id": workout["id"],
        "plan_id": workout["plan_id"],
        "user_id": user_id,
        "status": "completed",
        "feel": feel,
        "energy": energy,
        "completed_minutes": workout.get("duration_minutes", 0),
        "note": note,
    }).execute()
    sb.table("workouts").update({"status": "completed"}).eq("id", workout["id"]).eq("user_id", user_id).execute()


def record_feedback(sb: Client, user_id: str, plan_id: str, kind: str, payload: dict):
    sb.table("feedback").insert({"user_id": user_id, "plan_id": plan_id, "kind": kind, "payload": payload}).execute()


def sign_out():
    sb = get_supabase()
    if sb:
        try:
            sb.auth.sign_out()
        except Exception:
            pass
    for key in ["user", "profile", "plan", "workouts", "progress", "page"]:
        st.session_state.pop(key, None)
    st.rerun()


def css():
    st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');
    :root { --bg:#07110d; --panel:#0d1914; --panel2:#11221b; --line:#20352a; --text:#eef7f1; --muted:#91a89b; --accent:#b7f36b; --accent2:#79d89a; }
    .stApp { background: radial-gradient(circle at 15% 0%, rgba(183,243,107,.10), transparent 28%), linear-gradient(180deg,#07110d 0%,#08130f 100%); color:var(--text); font-family:'DM Sans',sans-serif; }
    [data-testid="stSidebar"] { background:#09150f; border-right:1px solid var(--line); }
    [data-testid="stSidebar"] * { font-family:'DM Sans',sans-serif; }
    h1,h2,h3,h4 { font-family:'Space Grotesk',sans-serif !important; letter-spacing:-.025em; }
    .hero { padding:2rem 0 .8rem; }
    .eyebrow { color:var(--accent); text-transform:uppercase; letter-spacing:.14em; font-size:.72rem; font-weight:700; }
    .hero h1 { font-size:clamp(2.4rem,5vw,4.8rem); line-height:.96; margin:.45rem 0 1rem; }
    .hero p { color:var(--muted); max-width:760px; font-size:1.08rem; line-height:1.65; }
    .glass { background:linear-gradient(145deg,rgba(17,34,27,.92),rgba(9,21,15,.92)); border:1px solid var(--line); border-radius:22px; padding:1.2rem 1.3rem; box-shadow:0 18px 55px rgba(0,0,0,.18); }
    .metric { background:var(--panel); border:1px solid var(--line); border-radius:18px; padding:1rem; }
    .metric .num { font:700 1.9rem 'Space Grotesk'; color:var(--accent); }
    .metric .label { color:var(--muted); font-size:.82rem; }
    .tag { display:inline-block; padding:.3rem .6rem; border:1px solid #34503e; border-radius:999px; color:#bfe6ca; font-size:.74rem; margin:.15rem .2rem .15rem 0; }
    .daycard { background:var(--panel); border:1px solid var(--line); border-radius:18px; padding:1rem; height:100%; }
    .daycard.active { border-color:#5b7e42; box-shadow:0 0 0 1px rgba(183,243,107,.14),0 18px 50px rgba(0,0,0,.18); }
    .exercise { background:#0b1711; border:1px solid #1d3127; border-radius:14px; padding:.9rem 1rem; margin:.55rem 0; }
    .exercise strong { color:#f4fbf6; }
    .small { color:var(--muted); font-size:.86rem; }
    .notice { border-left:3px solid var(--accent); background:rgba(183,243,107,.07); padding:.8rem 1rem; border-radius:0 12px 12px 0; }
    .stButton>button { border-radius:12px; border:1px solid #35513f; background:#102017; color:#f1faf4; font-weight:600; min-height:2.6rem; }
    .stButton>button:hover { border-color:var(--accent); color:var(--accent); }
    div[data-testid="stForm"] { background:rgba(13,25,20,.75); border:1px solid var(--line); border-radius:20px; padding:1.2rem; }
    </style>
    """, unsafe_allow_html=True)


def auth_screen(sb):
    st.markdown('<div class="hero"><div class="eyebrow">AI FITNESS COACH</div><h1>Train with a plan that<br>adapts to you.</h1><p>FitBuddy turns your goals, schedule, equipment and feedback into a practical weekly plan — then keeps the plan moving as you do.</p></div>', unsafe_allow_html=True)
    left, right = st.columns([1.05, .95], gap="large")
    with left:
        st.markdown('<div class="glass"><h3>Your training, not a template.</h3><p class="small">Personalized programming, structured workouts, recovery guidance and real progress tracking in one focused workspace.</p><span class="tag">AI-generated</span><span class="tag">Supabase-backed</span><span class="tag">7-day plans</span><span class="tag">Adaptive feedback</span></div>', unsafe_allow_html=True)
    with right:
        tabs = st.tabs(["Sign in", "Create account"])
        with tabs[0]:
            email = st.text_input("Email", key="login_email")
            password = st.text_input("Password", type="password", key="login_password")
            if st.button("Sign in →", use_container_width=True, key="login_btn"):
                try:
                    res = sb.auth.sign_in_with_password({"email": email.strip(), "password": password})
                    if res.user:
                        st.session_state.user = res.user
                        st.rerun()
                except Exception as exc:
                    st.error("Sign-in failed. Check your email and password.")
                    st.caption(str(exc))
        with tabs[1]:
            name = st.text_input("Name", key="signup_name")
            email = st.text_input("Email", key="signup_email")
            password = st.text_input("Password", type="password", key="signup_password")
            if st.button("Create account →", use_container_width=True, key="signup_btn"):
                if len(password) < 8:
                    st.warning("Use at least 8 characters for your password.")
                else:
                    try:
                        res = sb.auth.sign_up({"email": email.strip(), "password": password, "options": {"data": {"name": name.strip()}}})
                        if res.user:
                            if res.session:
                                st.session_state.user = res.user
                                st.rerun()
                            else:
                                st.success("Account created. Check your email if confirmation is enabled, then sign in.")
                    except Exception as exc:
                        st.error("Account creation failed.")
                        st.caption(str(exc))


def onboarding(sb, user_id: str, existing: dict | None):
    st.markdown('<div class="eyebrow">STEP 1 · YOUR BASELINE</div><h1>Build your starting profile.</h1>', unsafe_allow_html=True)
    st.caption("FitBuddy uses these inputs to shape the weekly plan. Keep limitations general; this is not a medical screening tool.")
    with st.form("onboarding"):
        c1, c2, c3 = st.columns(3)
        name = c1.text_input("Name", value=(existing or {}).get("name") or "")
        age = c2.number_input("Age", min_value=18, max_value=90, value=int((existing or {}).get("age") or 21))
        weight = c3.number_input("Weight (kg)", min_value=35.0, max_value=350.0, value=float((existing or {}).get("weight_kg") or 65), step=0.5)
        c1, c2, c3 = st.columns(3)
        height = c1.number_input("Height (cm)", min_value=120.0, max_value=230.0, value=float((existing or {}).get("height_cm") or 170), step=1.0)
        goal = c2.selectbox("Primary goal", ["Build strength", "Build muscle", "Improve fitness", "Lose body fat", "Improve mobility", "General health"], index=0)
        experience = c3.selectbox("Experience", ["Beginner", "Intermediate", "Advanced"], index=0)
        c1, c2, c3 = st.columns(3)
        intensity = c1.selectbox("Preferred intensity", ["low", "medium", "high"], index=1)
        location = c2.selectbox("Training location", ["Home", "Gym", "Outdoors", "Mixed"], index=0)
        duration = c3.slider("Session length", 10, 120, 45, step=5)
        days = st.multiselect("Training days", ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], default=["Mon", "Wed", "Fri"])
        equipment = st.multiselect("Equipment", ["Bodyweight", "Dumbbells", "Resistance band", "Bench or wall", "Gym machines"], default=["Bodyweight"])
        activities = st.multiselect("Activities you enjoy", ["Walking", "Strength training", "Cycling", "Running", "Mobility", "Sports"], default=["Walking", "Strength training"])
        c1, c2 = st.columns(2)
        dietary = c1.text_input("Diet preference (optional)", value=(existing or {}).get("dietary_preference") or "")
        avoid = c2.text_input("Foods to avoid (optional)", value=(existing or {}).get("foods_to_avoid") or "")
        limitations = st.text_area("Training limitations or considerations (optional)", value=(existing or {}).get("limitations") or "", max_chars=500)
        submitted = st.form_submit_button("Save profile →", use_container_width=True)
        if submitted:
            if not days:
                st.error("Choose at least one training day.")
                return
            profile = {"name": name.strip(), "age": int(age), "weight_kg": float(weight), "height_cm": float(height), "unit": "metric", "goal": goal, "experience": experience, "intensity": intensity, "location": location, "training_days": days, "session_duration": int(duration), "equipment": [x.lower() for x in equipment], "activities": activities, "dietary_preference": dietary, "foods_to_avoid": avoid, "limitations": limitations, "timezone": "Asia/Kolkata"}
            try:
                save_profile(sb, user_id, profile)
                st.session_state.profile = profile
                st.success("Profile saved. You're ready for your first plan.")
                st.rerun()
            except Exception as exc:
                st.error("Couldn't save your profile. Check the Supabase tables/RLS and try again.")
                st.caption(str(exc))


def render_workout(workout: dict, sb: Client, user_id: str):
    st.markdown(f"### {workout['title']}")
    st.caption(f"{workout['day_label']} · {workout['duration_minutes']} min · {workout['intensity'].title()} intensity · {workout['type']}")
    if workout.get("status") == "completed":
        st.success("Completed")
    if workout.get("warmup"):
        with st.expander("Warm-up", expanded=False):
            for item in workout["warmup"]:
                st.write("• " + item)
    for idx, ex in enumerate(workout.get("exercises") or [], start=1):
        exid = ex.get("exercise_id", "")
        meta = CATALOG.get(exid, {"name": exid, "category": "", "muscles": "", "equipment": "", "difficulty": "", "instructions": ""})
        dose = []
        if ex.get("sets") and ex.get("reps"): dose.append(f"{ex['sets']} × {ex['reps']}")
        elif ex.get("duration_minutes"): dose.append(f"{ex['duration_minutes']} min")
        dose.append(f"rest {ex.get('rest_seconds', 0)}s")
        st.markdown(f"<div class='exercise'><strong>{idx}. {meta['name']}</strong><br><span class='small'>{meta['muscles']} · {meta['equipment']} · {' · '.join(dose)}</span><br><span class='small'>{ex.get('instruction') or meta['instructions']}</span></div>", unsafe_allow_html=True)
    if workout.get("cooldown"):
        with st.expander("Cooldown & recovery", expanded=False):
            for item in workout["cooldown"]:
                st.write("• " + item)
            st.markdown(f"<div class='notice'>{workout.get('recovery_note','')}</div>", unsafe_allow_html=True)


def dashboard(sb, user_id: str):
    profile = st.session_state.get("profile") or load_profile(sb, user_id)
    if not profile or not profile.get("onboarding_completed"):
        onboarding(sb, user_id, profile)
        return
    st.session_state.profile = profile
    latest = load_latest_plan(sb, user_id)
    if latest:
        workouts = load_workouts(sb, user_id, latest["id"])
    else:
        workouts = []
    st.session_state.workouts = workouts
    today = date.today().isoformat()
    today_workout = next((w for w in workouts if w["scheduled_date"] == today), workouts[0] if workouts else None)

    st.markdown(f'<div class="hero"><div class="eyebrow">WELCOME BACK · {profile.get("name","ATHLETE").upper()}</div><h1>Your week, intelligently organized.</h1><p>{latest.get("summary") if latest else "Start with a personalized seven-day plan built around your real schedule."}</p></div>', unsafe_allow_html=True)
    if not latest:
        st.markdown('<div class="glass"><h3>Your first plan is waiting.</h3><p class="small">FitBuddy will use your profile, equipment and available days to generate a seven-day schedule with structured workouts and recovery guidance.</p></div>', unsafe_allow_html=True)
        if st.button("Generate my 7-day plan ✦", use_container_width=True, type="primary"):
            run_generation(sb, user_id, profile, reason="New plan")
        return

    completed = sum(1 for w in workouts if w.get("status") == "completed")
    cols = st.columns(4)
    for col, num, label in zip(cols, [str(latest["version"]), str(len(workouts)), str(completed), f"{profile.get('session_duration',45)}m"], ["Plan version", "Sessions", "Completed", "Session target"]):
        col.markdown(f"<div class='metric'><div class='num'>{num}</div><div class='label'>{label}</div></div>", unsafe_allow_html=True)

    st.write("")
    tabs = st.tabs(["Today", "7-day plan", "Adapt", "Progress", "Profile"])
    with tabs[0]:
        if today_workout:
            render_workout(today_workout, sb, user_id)
            if today_workout.get("status") != "completed":
                with st.form("complete_workout"):
                    feel = st.select_slider("How did it feel?", options=["Too easy", "Just right", "Challenging", "Too difficult"], value="Just right")
                    energy = st.select_slider("Energy after", options=["Low", "Okay", "Good", "High"], value="Good")
                    note = st.text_input("Optional note", max_chars=300)
                    if st.form_submit_button("Mark workout complete ✓", use_container_width=True):
                        try:
                            complete_workout(sb, user_id, today_workout, feel, energy, note)
                            record_feedback(sb, user_id, latest["id"], "workout_feedback", {"feel": feel, "energy": energy, "note": note})
                            st.success("Workout logged. Nice work.")
                            st.rerun()
                        except Exception as exc:
                            st.error("Couldn't record the workout.")
                            st.caption(str(exc))
        else:
            st.info("No workout is scheduled today. Use the 7-day plan tab to explore the week.")
    with tabs[1]:
        for start in range(0, len(workouts), 2):
            pair = workouts[start:start+2]
            cs = st.columns(len(pair))
            for col, workout in zip(cs, pair):
                with col:
                    cls = "daycard active" if workout["scheduled_date"] == today else "daycard"
                    st.markdown(f"<div class='{cls}'><div class='eyebrow'>{workout['day_label']} · {workout['scheduled_date']}</div><h3>{workout['title']}</h3><div class='small'>{workout['duration_minutes']} min · {workout['intensity'].title()}</div></div>", unsafe_allow_html=True)
                    with st.expander("View session"):
                        render_workout(workout, sb, user_id)
    with tabs[2]:
        st.markdown("### Tell FitBuddy what to change")
        request = st.text_area("Adjustment request", placeholder="Example: make the next week slightly easier and use more bodyweight movements.")
        if st.button("Adapt my plan with AI →", use_container_width=True):
            if request.strip():
                record_feedback(sb, user_id, latest["id"], "plan_adjustment", {"request": request.strip()})
                run_generation(sb, user_id, profile, reason=request.strip())
            else:
                st.warning("Describe what you'd like changed.")
        st.markdown(f"<div class='notice'><strong>Why this plan</strong><br>{latest['why_this_plan']}</div>", unsafe_allow_html=True)
    with tabs[3]:
        progress_view(sb, user_id)
    with tabs[4]:
        onboarding(sb, user_id, profile)


def run_generation(sb: Client, user_id: str, profile: dict, reason: str):
    model_name = secret("GEMINI_WORKOUT_MODEL", "gemini-3.8-flash")
    with st.status("Building your FitBuddy plan…", expanded=True) as status:
        st.write("Preparing your profile")
        st.write("Generating the weekly structure")
        try:
            plan = generate_plan(profile, date.today(), model_name)
            st.write("Validating exercise catalog and dates")
            ids = set(CATALOG)
            if len(plan.weekly_plan) != 7 or any(day.exercises and any(ex.exercise_id not in ids for ex in day.exercises) for day in plan.weekly_plan):
                raise ValueError("The generated plan contained an unsupported exercise reference.")
            st.write("Saving your plan")
            plan_id = persist_plan(sb, user_id, plan, profile, reason)
            status.update(label="Plan ready", state="complete")
            st.session_state.plan = plan_id
            st.success("Your plan is ready.")
            st.rerun()
        except Exception as exc:
            status.update(label="Plan generation failed", state="error")
            st.error("FitBuddy couldn't generate or save the plan. Check your Gemini/Supabase secrets and database schema.")
            st.caption(str(exc))


def progress_view(sb: Client, user_id: str):
    completions = load_progress(sb, user_id)
    count = len([x for x in completions if x.get("status") in {"completed", "modified"}])
    minutes = sum(int(x.get("completed_minutes") or 0) for x in completions if x.get("status") in {"completed", "modified"})
    dates = sorted({str(x.get("completed_at", ""))[:10] for x in completions if x.get("status") in {"completed", "modified"}}, reverse=True)
    streak = 0
    cursor = date.today()
    date_set = {date.fromisoformat(d) for d in dates if len(d) == 10}
    while cursor in date_set:
        streak += 1
        cursor -= timedelta(days=1)
    a,b,c = st.columns(3)
    a.metric("Completed", count)
    b.metric("Training minutes", minutes)
    c.metric("Current streak", streak)
    if completions:
        df = pd.DataFrame([{"Date": str(x.get("completed_at", ""))[:10], "Feel": x.get("feel") or "—", "Energy": x.get("energy") or "—", "Minutes": x.get("completed_minutes") or 0} for x in completions])
        st.dataframe(df, use_container_width=True, hide_index=True)
    else:
        st.info("Complete your first workout to start building real progress data.")


def main():
    css()
    sb = get_supabase()
    if sb is None:
        st.error("FitBuddy is not configured yet.")
        st.markdown("Add these values in Streamlit Cloud → **Settings → Secrets**:")
        st.code('SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"\nSUPABASE_PUBLISHABLE_KEY = "YOUR_PUBLISHABLE_KEY"\nGEMINI_API_KEY = "YOUR_GEMINI_API_KEY"\nGEMINI_WORKOUT_MODEL = "gemini-3.8-flash"', language="toml")
        st.caption("Never commit these values to GitHub. The Supabase service-role key is not required by this Streamlit surface.")
        return

    if "user" not in st.session_state:
        try:
            session = sb.auth.get_session()
            if session and getattr(session, "user", None):
                st.session_state.user = session.user
        except Exception:
            pass

    with st.sidebar:
        st.markdown("## FitBuddy")
        st.caption("AI fitness planning workspace")
        if st.session_state.get("user"):
            user = st.session_state.user
            st.success("Signed in")
            st.caption(getattr(user, "email", ""))
            st.divider()
            if st.button("Refresh data", use_container_width=True):
                st.rerun()
            if st.button("Sign out", use_container_width=True):
                sign_out()
        else:
            st.markdown("<div class='small'>Create an account to keep plans and progress synced to Supabase.</div>", unsafe_allow_html=True)

    if not st.session_state.get("user"):
        auth_screen(sb)
        return
    user_id = st.session_state.user.id
    dashboard(sb, user_id)


if __name__ == "__main__":
    main()
