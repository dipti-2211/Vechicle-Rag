"""
Vehicle Intelligence Assistant — Auth Routes

Endpoints:
  POST /api/auth/initialize-user
    Called by the frontend after a new user signs up.
    Seeds 3 pre-written demo documents so new users immediately have
    something to explore in the dashboard and chat.

    Idempotent — checks if user already has documents before seeding.
"""

import logging
import tempfile
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.auth.deps import require_user
from app.config import get_settings
from app.models.database import get_database
from app.services.document_service import DocumentService

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Demo document content ─────────────────────────────────────────────────────

DEMO_DOCUMENTS = [
    {
        "filename": "Tata_Motors_Vehicle_Manual.txt",
        "content": """\
TATA MOTORS VEHICLE OWNER'S MANUAL
Vehicle: Tata Nexon (2024)
Manufacturer: Tata Motors Limited

== INTRODUCTION ==
Welcome to Tata Nexon — India's #1 SUV. This manual contains important information about operating, maintaining, and caring for your vehicle. Please read this manual carefully before driving your vehicle for the first time.

== INSTRUMENT CLUSTER & WARNING LIGHTS ==

Engine Warning Light (Check Engine): Illuminates when the engine management system detects a fault. Visit a Tata authorized service center promptly. Do not ignore this warning as it may lead to serious engine damage.

Battery / Charging Warning Light: Indicates the battery is not charging correctly. May indicate alternator failure. Turn off non-essential electrical loads and visit a service center.

Oil Pressure Warning Light: STOP IMMEDIATELY if this light comes on while driving. Low oil pressure can cause severe engine damage within seconds. Check engine oil level and do not restart without addressing the issue.

Coolant Temperature Warning: Engine is overheating. Pull over safely, turn off the engine, and allow it to cool for at least 20 minutes before checking coolant level.

Tyre Pressure Monitoring System (TPMS): One or more tyres are significantly underinflated. Check all tyre pressures. Recommended pressure: 32 PSI (front), 32 PSI (rear) when cold.

Airbag Warning: Indicates a fault in the Supplemental Restraint System (SRS). The airbags may not deploy in a collision. Visit a service center immediately.

Seatbelt Reminder: One or more seatbelts are not fastened. Ensure all occupants buckle up before driving.

== FUEL SYSTEM ==
Fuel Type: Petrol (BS6) or Diesel (BS6) depending on variant.
Fuel Tank Capacity: 44 litres.
Recommended Fuel: Minimum RON 91 for petrol variants.
Low Fuel Warning: Activates when approximately 5 litres remain. Refuel promptly.

== ENGINE OIL ==
Engine Oil Grade: SAE 5W-40 (fully synthetic, API SN or higher).
Oil Change Interval: Every 10,000 km or 12 months (whichever comes first) for normal driving.
Oil Change Interval (Severe): Every 7,500 km under dusty or extreme conditions.
Oil Capacity: 3.8 litres (with filter change).
Checking Oil Level: Check with engine cold, on level ground. Oil should be between MIN and MAX marks on dipstick.

== MAINTENANCE SCHEDULE ==

10,000 km / 12 months:
  - Engine oil and filter change
  - Air filter inspection (replace if dirty)
  - Brake fluid check
  - Tyre rotation and pressure check
  - All fluid levels check (coolant, power steering, washer fluid)

20,000 km / 24 months:
  - All items from 10,000 km service
  - Air filter replacement
  - Spark plugs inspection (petrol variant)
  - Cabin air filter replacement
  - Drive belt inspection

40,000 km / 48 months:
  - All items from 20,000 km service
  - Spark plug replacement (petrol variant)
  - Coolant flush and replacement
  - Brake fluid replacement
  - Fuel filter replacement (diesel variant)

80,000 km / 96 months:
  - Transmission oil change
  - Timing belt inspection (replace if showing wear)
  - Brake pad replacement (if worn)
  - Oxygen sensor check

== BATTERY MAINTENANCE ==
Battery Voltage (normal): 12.4–12.7V (at rest).
Replace battery if voltage drops below 12.0V or if engine cranking is slow.
Battery terminals should be clean and corrosion-free. Clean with baking soda solution if corroded.

== TYRE CARE ==
Tyre Size (Standard): 215/60 R16.
Tyre Size (Higher Variants): 215/55 R17.
Wheel Alignment: Check every 10,000 km or after hitting a pothole.
Wheel Balancing: Check every 10,000 km.
Tyre Rotation: Every 10,000 km for even wear.
Tread Depth Minimum: Replace tyres when tread depth reaches 1.6mm.

== SAFETY SYSTEMS ==
ABS (Anti-lock Braking System): Prevents wheel lock during emergency braking.
EBD (Electronic Brakeforce Distribution): Distributes braking force appropriately.
ESP (Electronic Stability Program): Available in higher variants. Corrects oversteer/understeer.
Airbags: Dual front airbags standard. Side airbags optional.

For assistance: Tata Motors Customer Care: 1800-209-7979
Website: www.tatamotors.com
""",
    },
    {
        "filename": "Hyundai_Creta_Maintenance_Guide.txt",
        "content": """\
HYUNDAI CRETA MAINTENANCE GUIDE
Model Year: 2024
Manufacturer: Hyundai Motor India Limited

== ABOUT THIS GUIDE ==
This maintenance guide provides a comprehensive overview of routine service intervals, fluid specifications, and best practices for maintaining your Hyundai Creta in peak condition.

== SCHEDULED MAINTENANCE INTERVALS ==

FIRST FREE SERVICE — 1,000 km or 1 Month
  - Engine oil and oil filter change (use 0W-20 synthetic)
  - Visual inspection of all fluid levels
  - Check and adjust tyre pressures
  - Check brake operation
  - Check all lights and electricals
  - Inspection of air cleaner element

FIRST REGULAR SERVICE — 10,000 km or 12 Months
  - Replace engine oil (5W-30 or 5W-40 full synthetic)
  - Replace oil filter
  - Inspect air cleaner element; replace if needed
  - Check drive belt tension
  - Inspect brake pads and discs
  - Check clutch fluid level (manual transmission)
  - Inspect steering linkage and boots
  - Check exhaust system for leaks
  - Lubricate hood latch and hinges

20,000 km or 24 Months:
  - All items from 10,000 km
  - Replace air cleaner element
  - Replace cabin air filter (pollen filter)
  - Inspect fuel lines and connections
  - Check brake hose condition
  - Inspect spark plugs (petrol variant – do not replace yet)
  - Inspect fuel cap gasket

40,000 km or 48 Months:
  - All items from 20,000 km
  - Replace spark plugs (iridium type, petrol variant)
  - Inspect timing belt (check for cracks/wear)
  - Replace brake fluid (DOT 3 or DOT 4)
  - Inspect and clean throttle body
  - Check and clean fuel injectors if needed
  - Replace drive belts if showing wear

80,000 km or 96 Months:
  - Replace timing belt (mandatory)
  - Replace water pump (recommended together with timing belt)
  - Replace all coolant hoses
  - Replace coolant (OAT type, red/pink)
  - Flush and replace transmission fluid
  - Replace brake fluid

160,000 km:
  - Replace engine mounts if showing signs of deterioration

== ENGINE OIL SPECIFICATIONS ==
Petrol 1.5L NA: 5W-30 SN/GF-5 or better, synthetic. Capacity: 4.2L with filter.
Petrol 1.5L Turbo: 0W-20 or 5W-30 SP/GF-6, full synthetic. Capacity: 4.5L with filter.
Diesel 1.5L: 5W-40 CF or better, full synthetic. Capacity: 4.7L with filter.

Oil Change Interval (Normal): Every 10,000 km or 12 months.
Oil Change Interval (Severe/Dusty): Every 7,500 km or 6 months.

== COOLANT SPECIFICATION ==
Type: Hyundai Super Long Life Coolant (OAT – Organic Acid Technology).
Colour: Blue or Pink (do NOT mix with green/yellow types).
Mix Ratio: 50% coolant + 50% distilled water.
Replacement Interval: Every 5 years or 100,000 km (whichever comes first).
System Capacity: Approximately 6.5 litres.

== BRAKE FLUID ==
Type: DOT 3 or DOT 4.
Replacement: Every 2 years or 40,000 km regardless of appearance.
Low Level Warning: If brake fluid level is below MIN mark, inspect brake pads for wear before topping up. Worn pads cause the level to drop as the caliper pistons extend.

== POWER STEERING FLUID ==
Electric Power Steering (EPS): No fluid required — fully electronic.
Hydraulic PS (older variants only): PSF-3, replace every 4 years.

== AUTOMATIC TRANSMISSION FLUID (ATF) ==
Type: SP-IV or SP-IV-M (Hyundai genuine).
Capacity: 7.0 litres (total).
Replacement: Every 80,000 km under normal conditions; 40,000 km for towing/severe use.

== TYRE SPECIFICATIONS ==
Standard: 215/60 R16 95H.
Higher variants: 215/55 R17 94V.

Recommended Tyre Pressures:
  Front: 33 PSI (normal load), 35 PSI (full load).
  Rear: 33 PSI (normal load), 36 PSI (full load).
  Spare: 60 PSI (compact spare — for emergency use only, max 80 km/h).

Tyre Rotation: Every 10,000 km. Pattern: Front-to-back (same side).
Wheel Alignment: Check after any impact or every 20,000 km.

== FUEL SYSTEM ==
Petrol Tank Capacity: 50 litres.
Diesel Tank Capacity: 50 litres.
Minimum Octane Rating (Petrol): 91 RON (95 RON recommended for turbocharged variants).
Diesel Standard: BS6 compliant diesel only.

== AIR CONDITIONING ==
Refrigerant: R-134a (conventional) or R-1234yf (newer variants).
Refrigerant Recharge: As needed; typically every 3-4 years.
Cabin Air Filter: Replace every 20,000 km or 12 months.
A/C Service: Annual inspection of compressor, condenser, and evaporator recommended.

Customer Care: 1800-258-5500
Service Booking: www.hyundai.com/in/en/find-a-dealer
""",
    },
    {
        "filename": "Vehicle_Safety_Checklist.txt",
        "content": """\
VEHICLE SAFETY CHECKLIST
A comprehensive guide for vehicle operators

== PRE-DRIVE INSPECTION (5-Minute Check) ==

LIGHTS & SIGNALS
[ ] Headlights (low beam and high beam) — working
[ ] Tail lights — working
[ ] Brake lights — working (get someone to help or use a wall/reflection)
[ ] Turn signals (front and rear, both sides) — working
[ ] Hazard lights — working
[ ] Reverse lights — working

TYRES
[ ] Visual check of all 4 tyres for obvious damage (cuts, bulges, nails)
[ ] Tyre pressure within recommended range (check placard in door jamb)
[ ] No visible wear bars exposed (if visible, tyres must be replaced)
[ ] Spare tyre present and properly inflated (check monthly)

FLUIDS (Weekly Check)
[ ] Engine oil level — between MIN and MAX on dipstick
[ ] Coolant level — between MIN and MAX in reservoir (cold engine only)
[ ] Brake fluid — at or above MIN mark
[ ] Windshield washer fluid — adequate level
[ ] Power steering fluid (if hydraulic) — at correct level

WINDSCREEN & WIPERS
[ ] Windscreen free of cracks or chips in driver's line of sight
[ ] Wiper blades in good condition (no streaking, no skipping)
[ ] Wiper fluid sprays correctly

MIRRORS & VISIBILITY
[ ] Driver side mirror properly adjusted
[ ] Passenger side mirror properly adjusted
[ ] Interior rear-view mirror clean and properly adjusted
[ ] Rear window clear (defogged/cleared)

BRAKES
[ ] Brake pedal feels firm (not spongy or sinking to the floor)
[ ] No grinding, squealing, or pulling when brakes are applied
[ ] Handbrake/parking brake holds vehicle on incline

SAFETY EQUIPMENT
[ ] Seatbelts functional in all occupied seats (check retraction and latch)
[ ] First aid kit present (recommended)
[ ] Fire extinguisher present (recommended, especially for long trips)
[ ] Reflective triangles / emergency flares present
[ ] Vehicle registration and insurance documents present

== EMERGENCY PROCEDURES ==

IF YOUR ENGINE OVERHEATS
1. Turn off the air conditioning immediately to reduce engine load.
2. Turn on the heater to maximum — this draws heat away from the engine.
3. Pull over safely to the side of the road.
4. Turn off the engine. Do NOT open the radiator cap while the engine is hot.
5. Allow the engine to cool for at least 20–30 minutes.
6. Check coolant level ONLY when engine is completely cool.
7. If coolant is low, add distilled water as a temporary measure.
8. Contact roadside assistance if the problem persists.

IF YOUR TYRE BLOWS OUT
1. Grip the steering wheel firmly with both hands.
2. Do NOT brake suddenly — let the vehicle slow down gradually.
3. Gently ease off the accelerator.
4. Steer the vehicle to a safe, level area.
5. Apply gentle braking once the vehicle has slowed significantly.
6. Activate hazard lights and place warning triangles.
7. Change to the spare tyre following your vehicle manual instructions.
8. Note: Never drive a flat tyre. It damages the rim and is unsafe.

IF YOUR BRAKES FAIL
1. Pump the brake pedal rapidly to build hydraulic pressure (older systems).
2. Engage the engine brake by downshifting (manual: lower gears; automatic: L or 2).
3. Apply the handbrake/parking brake gradually — do NOT yank it suddenly.
4. Steer toward an uphill slope, sand pit, or barrier to slow down if necessary.
5. Turn on hazard lights and sound the horn to warn other road users.
6. After stopping, do not drive the vehicle. Call for assistance.

IF YOUR VEHICLE SKIDS
1. Do NOT brake suddenly.
2. Steer in the direction you WANT the front of the vehicle to go.
3. For oversteer (rear sliding out): steer into the skid, then straighten.
4. Release the accelerator gently.
5. Avoid sudden steering corrections that may cause a counter-skid.

IF YOUR ACCELERATOR STICKS
1. Shift to neutral immediately (move gear selector to N).
2. Apply brakes firmly and steer to a safe stop.
3. Turn off the ignition.
4. Do NOT restart the vehicle. Call for assistance.

IF YOUR VEHICLE CATCHES FIRE
1. Pull over immediately and turn off the engine.
2. Exit the vehicle quickly. Do NOT attempt to retrieve belongings.
3. Move all occupants at least 50 meters away from the vehicle.
4. Call emergency services (fire: 101).
5. Never open the bonnet/boot if you suspect fire inside — it feeds oxygen.

== DRIVING IN ADVERSE CONDITIONS ==

RAIN / WET ROADS
- Increase following distance to at least 4 seconds (normal is 2 seconds).
- Reduce speed by 20–30% on wet roads.
- Avoid sudden acceleration, braking, or sharp turns.
- Turn on headlights even in light rain.
- If aquaplaning occurs: ease off the accelerator gently, do not brake.

NIGHT DRIVING
- Use low beams in city areas. Switch to high beams on dark roads with no oncoming traffic.
- Dim dashboard lights to reduce glare inside the car.
- Take breaks every 2 hours; fatigue is a major cause of night accidents.
- Increase following distance to allow more reaction time.

FOG
- Use fog lights (front and rear) if equipped.
- Reduce speed significantly — use speed appropriate for your visibility range.
- Never use high beams in fog — light reflects off water droplets and reduces visibility.
- Follow the road markings rather than the lights of vehicles ahead.

HIGHWAY DRIVING
- Maintain at least 3-second following distance at highway speeds.
- Merge at speed — match highway traffic speed before merging.
- Avoid driving in another vehicle's blind spot.
- Keep left unless overtaking.
- Check mirrors every 5–8 seconds.

== VEHICLE STORAGE ==

If storing vehicle for more than 4 weeks:
  1. Fill fuel tank to prevent moisture condensation inside the tank.
  2. Add fuel stabilizer if storage is longer than 3 months.
  3. Disconnect the negative (-) battery terminal to prevent drain.
  4. Inflate tyres to maximum recommended pressure to resist flat-spotting.
  5. Place vehicle on jack stands if storing more than 3 months.
  6. Cover with a breathable car cover.
  7. Leave windows slightly open to prevent mildew.

Before returning to service after storage:
  - Reconnect battery and check voltage (should be ≥12.4V).
  - Check all fluid levels.
  - Check tyre pressures and visually inspect tyres.
  - Start engine and listen for unusual noises.
  - Test all brakes before driving on public roads.

Emergency helpline: 112 (India universal emergency)
Road assistance: Check your vehicle insurance card for the roadside assistance number.
""",
    },
]


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post(
    "/initialize-user",
    summary="Initialize a new user with demo documents",
    description=(
        "Called by the frontend after a successful signup. "
        "Seeds 3 pre-written demo vehicle documents for the user. "
        "Idempotent — if the user already has documents, returns seeded=false."
    ),
)
async def initialize_user(
    user_id: str = Depends(require_user),
) -> dict:
    """
    Seed demo documents for a new user.

    Checks if the user already has documents. If yes, skips (idempotent).
    If not, creates 3 demo vehicle documents and triggers background processing
    through the document pipeline (parse → chunk → embed → store).
    """
    settings = get_settings()
    db = get_database()
    service = DocumentService(db)

    # Import here to avoid circular imports
    from app.routes.documents import _process_document

    # ── Check if user already has documents (idempotent guard) ────────
    existing_count = await service.get_document_count(user_id=user_id)
    if existing_count > 0:
        logger.info("User %s already has %d documents — skipping demo seeding.", user_id, existing_count)
        return {"seeded": False, "reason": "already_initialized", "document_count": existing_count}

    logger.info("Seeding demo documents for new user: %s", user_id)

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    seeded_docs = []

    for demo in DEMO_DOCUMENTS:
        doc_id = str(uuid.uuid4())
        filename = f"{doc_id}.txt"
        file_path = upload_dir / filename

        try:
            # Write demo content to the upload directory
            file_path.write_text(demo["content"], encoding="utf-8")
            file_size = file_path.stat().st_size

            # Create the document record in the database
            doc = await service.create_document_record(
                original_filename=demo["filename"],
                file_type="txt",
                file_size=file_size,
                file_path=str(file_path),
                doc_id=doc_id,
                user_id=user_id,
            )

            # Launch the processing pipeline (async, non-blocking)
            import asyncio
            asyncio.create_task(
                _process_document(
                    doc_id=doc_id,
                    file_path=str(file_path),
                    file_type="txt",
                    original_filename=demo["filename"],
                    storage_path=None,
                    user_id=user_id,
                )
            )

            seeded_docs.append(doc_id)
            logger.info("Demo document queued for processing: %s -> %s", demo["filename"], doc_id)

        except Exception as e:
            logger.error("Failed to seed demo document '%s' for user %s: %s", demo["filename"], user_id, e)
            # Clean up the file if DB record creation failed
            if file_path.exists():
                file_path.unlink(missing_ok=True)
            # Non-fatal: continue with other documents

    logger.info("Demo seeding complete for user %s: %d documents queued.", user_id, len(seeded_docs))
    return {
        "seeded": True,
        "documents_queued": len(seeded_docs),
        "document_ids": seeded_docs,
    }
