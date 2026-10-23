# -*- coding: utf-8 -*-
# English edition of the approved-specifications guide (same design, LTR)
import html, os, re
D = os.path.dirname(os.path.abspath(__file__))
FD = '/root/.fonts/'
E = html.escape

BADGE = {
  'HD': 'Heavy Duty', 'HT': 'High Traffic', 'DIS': 'Disinfectant‑Resistant', 'HYG': 'Hygienic / Non‑Porous', 'FIRE': 'Fire‑Rated',
  'G1': 'ANSI/BHMA Grade 1', '247': '24/7 Operation', 'UNI': 'Cluster‑Standardized', 'ADA': 'Accessible', 'WAR': 'Long Warranty',
}
def badges(ks): return '<div class="bdg">' + ''.join(f'<span class="b b-{k}"><b>{E(BADGE[k])}</b></span>' for k in ks) + '</div>'
def refs(rs): return ' '.join(f'<sup class="rf">[{r}]</sup>' for r in rs)

SECTIONS = [
 ('Doors, Locks & Door Hardware', 'The most frequently used building element. A hospital corridor door is opened hundreds of times a day and struck by beds, trolleys and wheelchairs.', [
  dict(code='LS-54', title='Hollow Metal & Fire‑Rated Doors', en='HÖRMANN · Al Kuhaimi · Aldrees', rule='list',
    approved='HÖRMANN, Al Kuhaimi or Aldrees', bd=['HD', 'HT', 'FIRE'],
    rows=[('Door leaf thickness', 'Typically 0.8 – 1.2 mm', '1.6 mm (16 gauge) — “Extra Heavy Duty” level per ANSI/SDI A250.8'),
          ('Frame thickness', '1.2 – 1.5 mm', '2.0 mm (14 gauge)'),
          ('Fire doors', 'Undocumented label, or a standard door that merely looks similar', 'Tested door bearing the label of an accredited testing body for the required rating, fully matching its certificate (frame, hinges, lock and closer)'),
          ('Finish', 'Ordinary paint', 'Baked powder coating that withstands repeated cleaning'),
          ('Bottom protection', 'None', '90 cm kick plate by CS Group')],
    why='A thin leaf dents after the first impacts from beds and trolleys; the door then sags and the lock and closer lose alignment. A fire door is not simply a “thick door” — it is a fully tested assembly, and changing any component voids its rating.',
    risk='Dents and peeling within months, fire doors that do not self‑close or that leak smoke, and Civil Defense or CBAHI findings that require replacement.',
    submit=['Fire test certificate and label photo', 'Catalogue showing thicknesses and core', 'Cut sample of the leaf', 'Door & hardware schedule'], refs=[]),
  dict(code='LS-54', title='Hinges, Closers & Exit Devices', en='Door Hardware — ANSI/BHMA Grade 1', rule='eq',
    approved='ANSI/BHMA Grade 1 for all door hardware', bd=['G1', 'HD', 'HT'],
    rows=[('Hinges (A156.1)', 'Grade 3: approx. 350,000 cycles', 'Grade 1: 2,500,000 cycles'),
          ('Door closers (A156.4)', 'Grade 3: approx. 500,000 cycles', 'Grade 1: 2,000,000 cycles'),
          ('Mortise locks (A156.13)', 'Grade 3: approx. 800,000 cycles', 'Grade 1: 1,000,000 cycles + higher strength tests'),
          ('Cylindrical locks (A156.2)', 'Grade 3: approx. 200,000 cycles', 'Grade 1: 1,000,000 cycles'),
          ('Exit (panic) devices (A156.3)', 'Grade 3: approx. 100,000 cycles', 'Grade 1: 500,000 cycles')],
    why='One cycle = one opening and closing. A corridor door used 300 times a day consumes more than 100,000 cycles a year, so Grade 3 hardware may reach the end of its rated life within a few years, while Grade 1 is designed for heavy commercial and institutional buildings.',
    risk='Closers that leak oil and slam doors, hinges that drop so the door drags on the floor, and exit devices that fail at the most critical moment.',
    submit=['BHMA certificate or test report stating the grade for each item', 'Catalogue of the supplied model'], refs=[1]),
  dict(code='LS-54', title='SALTO Electronic Locks', en='SALTO XS4 Original Wide · PBE900 Panic', rule='only',
    approved='SALTO XS4 Original Wide locks and PBE900 for emergency exits — through the authorized distributor only', bd=['UNI', 'HD'],
    rows=[('Access method', 'Mechanical key, or residential/hotel electronic lock', 'Access card within a central permission system with master key'),
          ('Permission management', 'Keys copied or lost; access cannot be revoked', 'Access granted and revoked on the card instantly'),
          ('Audit trail', 'None', 'Audit trail stored in the lock (650 – 1,000 events)'),
          ('Battery', '—', '3 × AA batteries for approx. 40,000 – 60,000 openings'),
          ('Supply & programming', 'Any supplier', 'Authorized distributor only: programming, licensing and warranty')],
    why='Medication rooms, medical records, server rooms and stores require documented access control. One system across all Cluster facilities means one card per employee, one software platform and one maintenance team.',
    risk='A lock outside the system cannot be connected or managed; it remains an isolated island and is replaced at commissioning. Supply outside the authorized distributor may mean it cannot be programmed or loses its warranty.',
    submit=['SALTO authorized distributor letter', 'Lock schedule for every door', 'Confirmation of compatibility with the existing Cluster system'], refs=[2]),
  dict(code='LS-55', title='Automatic Sliding Door', en='dormakaba (Dorma) EL 301 — Heavy Use', rule='eq',
    approved='Dorma EL 301 or approved equivalent', bd=['HD', 'HT', '247'],
    rows=[('Operator class', 'Light commercial operator', 'Operator designed for heavy, continuous use'),
          ('On power failure', 'May stop in the closed position', 'Fail‑safe opening with a one‑hour backup battery'),
          ('Safety', 'Basic motion sensor', 'Motion and safety sensors meeting EN 16005 requirements for power‑operated doors'),
          ('Service', 'No local agent', 'Authorized agent with spare parts available')],
    why='Patients, visitors and beds pass through the main entrance around the clock, and it may be an escape route. The door must open safely, never close on a patient or wheelchair, and open automatically in an emergency.',
    risk='Repeated breakdowns at an entrance that cannot be closed, risk of entrapment or impact, and a blocked escape route.',
    submit=['Operator catalogue and duty class', 'Certificate of compliance with power‑operated door standards', 'Installation and sensor layout'], refs=[]),
 ]),
 ('Wall, Floor & Ceiling Protection', 'The surfaces touched every day by beds, trolleys and disinfectants. Their benchmark is not how they look at handover, but how they look after five years of daily cleaning.', [
  dict(code='LS-62', title='Wall & Corner Protection', en='Acrovyn Wall Protection (CS Group)', rule='eq',
    approved='Acrovyn by CS Group; Gerflor also accepted', bd=['HD', 'DIS', 'FIRE', 'HYG'],
    rows=[('Material', 'Aluminium or thin PVC corners, or paint only', 'Acrovyn sheets and corner guards, 1.02 – 1.9 mm thick'),
          ('Corner guard height', 'Short pieces', '1.5 m'),
          ('Fire performance', 'Unrated', 'Class A per UL 723 / ASTM E84'),
          ('Cleaning', 'Cracks or yellows with disinfectants', 'Withstands approved hospital cleaning agents'),
          ('Installation', 'Adhesive or silicone', "Manufacturer's fixing system")],
    why='A damaged or peeling wall is not only a cosmetic issue — it is a surface that cannot be disinfected and collects dust and bacteria, and repeated repairs mean closing corridors and a permanent operating cost.',
    risk='Broken corners and gypsum within the first year, repeated repainting, and infection‑control findings.',
    submit=['Data sheet with thicknesses and fire rating', 'Colour sample', 'Fixing details'], refs=[3]),
  dict(code='LS-58', title='Homogeneous Vinyl Flooring', en='Gerflor Mipolam (Infinity) 2 mm Homogeneous', rule='only',
    approved='Gerflor Mipolam homogeneous, 2 mm', bd=['HT', 'HYG', 'DIS', 'HD'],
    rows=[('Material type', 'Heterogeneous vinyl or click SPC/LVT with a thin wear layer', '2 mm homogeneous vinyl: colour and material through the full thickness'),
          ('Wear resistance', 'Not stated', 'Highest wear group (Group T)'),
          ('Joints', 'Open joints between pieces', 'Heat‑welded seams + coving up the wall'),
          ('Maintenance', 'Requires periodic waxing', 'Evercare treatment: no wax for life'),
          ('Hygiene', '—', 'Bacteriostatic and fungistatic; resistant to blood and iodine stains'),
          ('Slip resistance', 'Not stated', 'PTV above 36')],
    why='Hospital floors are washed daily with disinfectants and carry constant wheeled traffic. Open joints collect fluids and bacteria, and a thin wear layer wears through to expose what lies beneath.',
    risk='Pieces lifting under wheels, permanent stains, dirt trapped in joints and corners, and full floor replacement.',
    submit=['Original product data sheet', 'Sample and approved colour', 'Agent letter and qualification of the installation/welding team'], refs=[4]),
  dict(code='LS-59', title='Porcelain Tiles', en='EXA Porcelain', rule='only',
    approved='EXA, as specified in the BOQ', bd=['HT', 'UNI'],
    rows=[('Category', 'Ceramic, or glazed porcelain whose body colour shows when chipped', 'Porcelain as specified in the BOQ — water absorption ≤ 0.5% (group BIa)'),
          ('Batch & shade', 'Mixed batches and shades', 'Single documented batch'),
          ('Future replacement', 'Matching tile hard to find', 'Available product, easy to source for maintenance')],
    why='Approval ensures consistent colour and size and future availability for maintenance, so every broken tile does not become a mismatched patch.',
    risk='Shade variation, difficult replacement, and chipped edges in trolley areas.', submit=['Data sheet and sample', 'Batch number'], refs=[]),
  dict(code='LS-60', title='Suspended Ceilings', en='USG or MADA Ceiling Systems', rule='only',
    approved='USG or MADA (tiles and grid from the same system)', bd=['HYG', 'FIRE'],
    rows=[('Tiles', 'Low‑density mineral fibre', 'Humidity‑ and sag‑resistant, wipeable tiles'),
          ('Grid', 'Thin grid not matched to the tiles', 'Grid from the same system'),
          ('Fire', 'Not stated', 'Documented fire classification')],
    why='Ceilings in healthcare facilities are opened frequently for HVAC and electrical maintenance; they must not stain or sag with humidity and must remain cleanable.',
    risk='Sagging, stained tiles within a year, and breakage during maintenance.', submit=['Data sheets for tiles and grid', 'Sample'], refs=[]),
  dict(code='LS-53', title='Entrance Matting', en='emco MARSCHALL Premium Large + Care insert', rule='eq',
    approved='emco MARSCHALL Premium Large with Care insert and 517 PSL Care B', bd=['HT', 'HD'],
    rows=[('Type', 'Loose carpet or rubber mat on top of the floor', 'Recessed mat in a floor pit with aluminium frame and profiles'),
          ('Behaviour', 'Shifts and wrinkles under wheels', 'Flush with the floor; suitable for wheelchairs and trolleys'),
          ('Function', 'Decorative', 'Traps dirt and moisture at the door')],
    why='Dirt tracked in from the entrance is the main cause of floor wear inside the building, and a loose mat is a trip hazard.',
    risk='Patient trips, faster floor wear and more cleaning.', submit=['Data sheet, pit drawing and dimensions'], refs=[5]),
  dict(code='LS-53', title='Handrails & Wall Rails', en='Stainless Steel 304 Handrails', rule='eq',
    approved='Stainless steel grade 304', bd=['DIS', 'HD'],
    rows=[('Material', 'Painted steel or 201 stainless', 'Stainless steel 304'),
          ('With disinfectants', 'Rusts and stains with chlorine', 'Corrosion‑resistant')],
    why='Handrails are touched by every visitor and wiped with disinfectants daily. Grade 201 looks like 304 but has lower corrosion resistance.',
    risk='Rust and staining within months.', submit=['Mill certificate stating grade 304'], refs=[]),
 ]),
 ('Toilets & Washrooms', 'The wettest, most frequently cleaned and most heavily used areas. Any material that absorbs water or rusts will show its problems within the first year.', [
  dict(code='LS-63', title='Toilet Partitions & Doors', en='Compact HPL 19 mm (Bobrick or Fundermax)', rule='list',
    approved='Bobrick or Fundermax', bd=['HYG', 'DIS', 'HD'],
    rows=[('Material', 'MDF or particleboard with melamine, or 12 mm compact', 'Solid compact HPL, 19 mm thick (EN 438‑4)'),
          ('With water', 'Swells and delaminates at the edges', 'Unaffected by water and humidity'),
          ('Hardware', 'Light hinges and legs', 'Stainless steel hinges and legs from the same system')],
    why='Partitions are washed daily and exposed to direct water. Wood‑based boards swell and their surface layer separates.',
    risk='Swollen edges and loose hinges within months, and full replacement of partitions.', submit=['Data sheet and EN 438 certificate', 'Shop drawing'], refs=[]),
  dict(code='LS-63', title='Washroom Accessories', en='Bobrick Washroom Accessories', rule='only',
    approved='Bobrick (B‑6806, B‑4998, B‑750, B‑4388, B‑43644, B‑3942, B‑6827)', bd=['DIS', 'ADA', 'HD', 'UNI'],
    rows=[('Material', 'Chrome‑plated zinc or 201 stainless', 'Type 304 stainless steel, satin finish'),
          ('Grab bars', 'Weak surface fixing', 'Grab bars exceeding the ADA requirement (250 lbf)'),
          ('Spare parts & keys', 'Not standardized', 'Standardized across all Cluster facilities')],
    why='A patient or elderly person leans on a grab bar with their full weight; a failure is an incident. Standardized accessories mean one set of spare parts and keys for the maintenance team.',
    risk='Rust and breakage, dispensers that do not accept approved refills, and a risk to patient safety.', submit=['Model list matching the BOQ', 'Catalogue for each model'], refs=[]),
  dict(code='LS-63', title='Baby Changing Station', en='Koala Kare KB310‑SSRE', rule='eq',
    approved='Koala Kare KB310‑SSRE or approved equivalent', bd=['HYG', 'HD'],
    rows=[('Mounting', 'Surface‑mounted plastic unit', 'Recessed in the wall with a stainless steel exterior'),
          ('Bed', 'Ordinary plastic', 'Treated with Microban antimicrobial protection'),
          ('Capacity & warranty', 'Not stated', '136 kg (300 lb) load and 5‑year warranty')],
    why='A surface in direct contact with infants, disinfected after every use.', risk='Broken hinges and a falling unit.', submit=['Data sheet'], refs=[6]),
  dict(code='LS-67', title='Vanities & Mixers', en='Solid Surface Counters · Ideal Standard / Grohe Mixers', rule='only',
    approved='Mixers: Ideal Standard or Grohe — Counters: Solid Surface', bd=['HYG', 'DIS'],
    rows=[('Vanity top', 'Cultured marble or laminated wood', 'Solid Surface with no visible joints, non‑porous, soft‑close drawers'),
          ('Mixer', 'Zinc alloy with non‑standard cartridges', 'Brass with ceramic cartridges and spare parts available from the agent')],
    why='The washbasin is the first point of hand hygiene in infection control; porous surfaces retain bacteria, and a leaking mixer takes the basin out of service.',
    risk='Leaks, scaling and difficulty finding spare parts.', submit=['Data sheet and model number'], refs=[]),
  dict(code='LS-74', title='Concealed Cisterns', en='Geberit Concealed Cisterns', rule='eq',
    approved='Geberit', bd=['UNI', 'WAR'],
    rows=[('Spare parts', 'Not guaranteed', 'Spare parts availability guaranteed for 50 years'),
          ('Maintenance', 'Tiles broken to reach the cistern', 'Serviced through the flush‑plate opening without breaking finishes')],
    why='A concealed cistern sits inside the wall; if it fails and parts are unavailable, finishes must be broken.',
    risk='Breaking tiles and walls to fix a minor fault.', submit=['Data sheet and flush plate'], refs=[7]),
 ]),
 ('Elevators', 'In a healthcare facility the elevator carries patients, beds and emergencies; when it stops, the service stops.', [
  dict(code='LS-69', title='Elevators', en='Schindler 5000 (MRL)', rule='only',
    approved='Schindler 5000', bd=['UNI', 'HT', '247'],
    rows=[('Product', 'Elevator assembled from multi‑source components', 'Schindler 5000 machine‑room‑less (MRL)'),
          ('Maintenance', 'Supplier not linked to the manufacturer', 'Authorized agent, genuine parts and maintenance contract'),
          ('Standardization', 'System different from other facilities', 'Maintenance and spare parts standardized with Cluster facilities')],
    why='Multiple elevator brands mean multiple maintenance contracts and spare‑parts stocks, and slower repairs.', risk='Long outages waiting for unavailable parts.',
    submit=["Agent's technical proposal", 'Compliance and handover certificates'], refs=[8]),
 ]),
]

EXTRA = [
  dict(code='LS-85', title='Digital Signage & Display Screens', en='Samsung QMC Series + Navori — AAHC Digital Signage Standard', rule='eq',
    approved='Samsung QMC (standard), QHC for high‑ambient‑light areas, QBC for non‑critical administrative areas — connected to the Navori platform', bd=['247', 'UNI', 'HD'],
    rows=[('Display type', 'Consumer TV', 'Commercial display designed for continuous operation; consumer TVs are not installed in public or mission‑critical locations'),
          ('Resolution & brightness', 'Not stated', '4K UHD minimum; 500 nit in the QMC series'),
          ('Warranty', 'Consumer warranty not covering commercial use', '3‑year commercial warranty covering 24/7 operation'),
          ('Content management', 'Local USB playback', 'Navori platform mandatory in public areas (built‑in or external player) for health awareness, queue information and emergency notifications'),
          ('Power', 'One socket and a visible extension cord', 'Two sockets behind the display (screen and player), one preferably on emergency power/UPS'),
          ('Network', 'Wireless', 'One wired RJ45 point per display; wireless only with IT approval'),
          ('Cabling', 'Visible dangling cables', 'All cables concealed behind the display or in approved containment'),
          ('Height & size', 'Ad hoc', 'Per the standard’s tables: small waiting areas 43–55" at 1.5–1.7 m centreline; main lobbies 65–75" at 1.7–2.0 m')],
    why='Waiting‑area screens are the Cluster’s channel for health awareness, queue management and emergency notifications, and they run throughout operating hours. Connection to Navori allows content to be broadcast centrally to all facilities.',
    risk='A TV that fails and loses its warranty, a screen that cannot be managed centrally, and visible cables unbecoming of the facility.',
    submit=['Model data sheet', 'Display location schedule with sizes and heights', 'Confirmation of Navori compatibility, power and network points'], refs=[17, 9]),
  dict(code='LS-86', title='Addressable Fire Alarm System', en='Gent by Honeywell — Addressable, Online Monitoring', rule='list',
    approved='Gent by Honeywell, connected to the central monitoring network', bd=['FIRE', 'UNI', '247'],
    rows=[('System type', 'Conventional system identifying the zone only', 'Addressable system identifying the individual device'),
          ('Monitoring', 'Local panel seen only by those in the building', 'Connected to the central network for remote monitoring and control (online web monitoring)'),
          ('Interfaces', 'Limited or none', 'HVAC shutdown and fire damper closure, voice evacuation, release of automatic doors and emergency arms, elevator recall'),
          ('Cabling', 'Ordinary cables', 'LSZH low‑smoke, zero‑halogen cables'),
          ('Approval', '—', 'Civil Defense approved')],
    why='Patients may be unable to evacuate on their own, so every minute counts. Central monitoring delivers the alarm to the Cluster control room even outside working hours.',
    risk='Alarms whose source cannot be pinpointed, an isolated system nobody sees at night, and failure at Civil Defense inspection.',
    submit=['Civil Defense drawing approval', 'Panel and detector data sheets', 'Cause & effect matrix'], refs=[]),
  dict(code='LS-87', title='CCTV System', en='Hikvision Ultra Series Smart IP', rule='list',
    approved='Hikvision Ultra Series Smart IP, with Huawei PoE switches and Belden Cat6A cabling', bd=['UNI', '247', 'HD'],
    rows=[('Camera resolution', 'Typically 2 – 4 MP', '8 MP day/night with infrared'),
          ('Outdoor cameras', 'Unrated', 'Bullet or PTZ, IP66 protection'),
          ('Recording', 'Analogue recorder or ordinary disks', 'Network NVR with AI smart search and surveillance‑grade disks sized for the retention period'),
          ('Network', 'Generic switches and cables', 'Huawei PoE switches and Belden Cat6A cables'),
          ('Acceptance', 'Power‑on only', 'Testing of day and night image clarity, coverage angles and actual storage duration')],
    why='Footage is reviewed after an incident or complaint; its value lies in night‑time clarity and retention. A standard brand allows connection to the Cluster’s surveillance system.',
    risk='Images that do not show faces at night, recordings overwritten before the required period, and a system that cannot be integrated.',
    submit=['Camera layout and coverage angles', 'Camera and NVR data sheets', 'Storage capacity calculation'], refs=[]),
]

MEP = [
  ('LS-70 – 72', 'Firefighting', 'Lifeco · NAFCO · SFFECO · FM200 or Novec 1230', 'UL/FM and Civil Defense approved sprinklers, pumps and hose cabinets; clean‑agent suppression for electrical and telecom rooms per NFPA 2001, since water damages equipment.'),
  ('LS-75', 'Water heaters & pumps', 'A.O. Smith · Grundfos', 'Continuous hot water and pressure, with local agents and spare parts.'),
  ('LS-77 – 78', 'HVAC & ventilation', 'York DEH 360 · LG / Gree / York · Greenheck / Loren Cook · Armaflex', 'Compatibility with existing HVAC systems, performance‑rated exhaust fans, and insulation that prevents condensation.'),
  ('LS-79 – 81', 'Power & lighting', 'ABB / Schneider · Riyadh Cables · Legrand BLANKO or MK · PROlight (LEDVANCE, PHILIPS, ULTRA LIGHT, Lunor)', 'Reliable panels and breakers, cables compliant with Saudi standards, and emergency lighting on UPS with available spare parts.'),
  ('LS-82', 'UPS', 'EATON', 'Protection of critical equipment from power interruptions.'),
  ('LS-83 – 84', 'Network & telephony', 'Legrand · Huawei · AVAYA IP Office 500', 'Compatibility with the Cluster network and existing telephony system.'),
  ('LS-85', 'Public address', 'Bosch Praesideo / Plena · DSPPA', 'PA system linked to the fire alarm for voice evacuation, with LSZH cabling.'),
  ('LS-88', 'Nurse call (small centres)', 'SOLT Wireless', 'Integration with the other approved systems in the centres, user familiarity, and easy wireless installation without cabling: call buttons (including waterproof units for toilets), a nurse‑station display, wrist pagers and a range of up to 150 m. Hospitals use different, more advanced nurse‑call systems.'),
  ('LS-91', 'Irrigation', 'RainBird', 'Reliable irrigation control and available spare parts.'),
]

FURN_ROWS = [
  ('Testing', 'No test reports, or general claims', 'ANSI/BIFMA tests: X5.1 chairs, X5.4 lounge/public seating, X5.5 desks and tables'),
  ('Hours of use', 'Designed for single‑shift individual office use', 'Options for continuous 24/7 multi‑shift use (reception counters, nursing, control rooms)'),
  ('Warranty', 'Typically 1 – 2 years', 'Herman Miller: 12 years on many products, based on 3‑shift use · Global: 12 years on all components in the Heavy Duty category · OFS: 12 years on standard products · Steelcase: limited lifetime warranty on many components'),
  ('Fabric — double rubs', '15,000 – 30,000, or not stated', 'At least 75,000 double rubs for healthcare; over 100,000 for the Heavy Duty category'),
  ('Cleanability', 'Fabric that absorbs liquids and stains', 'Liquid‑impervious upholstery that withstands hospital cleaners, with a clean‑out gap between seat and back'),
  ('Fire', 'Untested', 'Class A flame spread and smoke developed ≤ 450 (ASTM E84); fabrics tested to their type'),
  ('Load capacity', 'Not stated', '136 kg for waiting and task seating; 340 kg for bariatric seating'),
  ('Frame & surfaces', 'Particleboard with swelling edges and exposed fasteners', 'Metal frames, high‑pressure surfaces and sealed edges'),
]

SOURCES = [
  ('Allegion — What are ANSI/BHMA hardware grades?', 'https://kc.allegion.com/kb/article/what-are-ansi-bhma-hardware-grades'),
  ('SALTO — XS4 Original datasheet', 'https://cms.saltosystems.com/sites/default/files/products/download/datasheet-xs4_original_sx6xxk-eng-10-20.pdf'),
  ('Construction Specialties — Acrovyn healthcare wall covering', 'https://www.c-sgroup.com/category/wall-protection/product-selector/healthcare-wall-covering'),
  ('RIBA Journal — Gerflor Mipolam with Evercare treatment', 'https://www.ribaj.com/spec/mipolam-with-evercare-treatment/'),
  ('ArchiExpo — emco MARSCHALL Premium entrance mat', 'https://www.archiexpo.com/prod/emco-bautechnik-gmbh/product-54726-2566842.html'),
  ('KaTom — Koala Kare KB310‑SSRE', 'https://www.katom.com/107-KB310SSRE.html'),
  ('Gulf Construction — Geberit extends parts guarantee to 50 years', 'https://gulfconstructiononline.com/Article/385983/Geberit_extends_parts_guarantee_to_50_years'),
  ('Buildings — Schindler 5000 MRL elevator', 'https://www.buildings.com/products/elevators-escalators/product/55287081/schindler-elevator-corp-this-machine-room-less-mrl-elevator-features-taller-cars-larger-entrances-and-higher-load-capacities'),
  ('Crown TV — Samsung QMC series', 'https://crowntv-us.com/blog/samsung-qmc-series-2025/'),
  ('Herman Miller — Warranty', 'https://www.hermanmiller.com/warranty/'),
  ('Global Furniture Group — Warranty', 'https://www.eandi.org/wp-content/uploads/Global_warranty_8.20.pdf'),
  ('OFS — Warranty', 'https://imagineaplace.ofs.com/page/warranty'),
  ('Steelcase — Warranty FAQ', 'https://steelcase.com/resources/documents/faq-warranty'),
  ('U.S. Defense Health Agency — DHA 12 52 00 Healthcare Seating', 'https://www.wbdg.org/FFC/DHA/DHA%2012%2052%2000.pdf'),
  ('Brentano — Abrasion (ACT guidelines)', 'https://brentanofabrics.com/faqs/abrasion/'),
  ('SOLT — Patient‑Nurse Wireless Calling System', 'https://www.solteurope.com/pages/patient-nurse-wireless-calling-system'),
  ('Al Ahsa Health Cluster — Digital Signage & TV Installation Standard, AAHC-FM-STD-DIGITAL-SIGNAGE-001 (Revision 0, Draft); owner: Facilities Management', ''),
]
STANDARDS = ['AAHC-FM-STD-DIGITAL-SIGNAGE-001 — Cluster digital signage standard', 'ANSI/SDI A250.8 — Steel doors and frames', 'ANSI/BHMA A156.1 / .2 / .3 / .4 / .13 — Door hardware',
  'EN 16005 — Safety of power‑operated doors', 'UL 723 / ASTM E84 — Flame spread and smoke', 'EN 438‑4 — Compact HPL boards', 'ISO 13006 / EN 14411 — Ceramic and porcelain tiles',
  'ADA 2010 Standards §609 — Grab bars', 'ANSI/BIFMA X5.1 / X5.4 / X5.5 — Office, lounge seating and tables', 'ASTM D4157 (Wyzenbeek) — Fabric abrasion resistance']

RULE = {'only': ('Exclusive', 'r-only'), 'list': ('From approved list', 'r-list'), 'eq': ('Or approved equivalent', 'r-eq')}

def card(it):
  rl, rc = RULE[it['rule']]
  rows = ''.join(f'<tr><th>{E(p)}</th><td class="mk">{E(m)}</td><td class="ap">{E(a)}</td></tr>' for p, m, a in it['rows'])
  sub = ''.join(f'<li>{E(s)}</li>' for s in it['submit'])
  return f'''<section class="item">
  <header class="ih"><div class="ic">{E(it['code'])}</div><div class="it"><h3>{E(it['title'])} {refs(it['refs'])}</h3><div class="en">{E(it['en'])}</div></div><div class="rule {rc}">{E(rl)}</div></header>
  <div class="apr"><span>Approved by the Cluster:</span> <b>{E(it['approved'])}</b></div>
  {badges(it['bd'])}
  <table class="cmp"><thead><tr><th>Property</th><th class="mk">Common in the market</th><th class="ap">Approved by the Cluster</th></tr></thead><tbody>{rows}</tbody></table>
  <div class="why"><div class="w1"><h4>Why it matters in a healthcare facility</h4><p>{E(it['why'])}</p></div><div class="w2"><h4>If the common option is installed</h4><p>{E(it['risk'])}</p></div></div>
  <div class="sub"><b>Submit for approval:</b><ul>{sub}</ul></div>
</section>'''

summary_rows = ''
for s in SECTIONS + [(0, 0, EXTRA)]:
  for it in s[2]:
    rl, rc = RULE[it['rule']]
    summary_rows += f'<tr><td class="c">{E(it["code"])}</td><td>{E(it["title"])}</td><td>{E(it["approved"])}</td><td><span class="rule sm {rc}">{E(rl)}</span></td></tr>'
summary_rows += '<tr><td class="c">LS-70 – 91</td><td>MEP & technology systems</td><td>See Section 5</td><td><span class="rule sm r-list">From approved list</span></td></tr>'
summary_rows += '<tr><td class="c">LS-93</td><td>Non‑medical & office furniture</td><td>Herman Miller · Global · OFS · Steelcase</td><td><span class="rule sm r-list">From approved list</span></td></tr>'

secs = ''
for i, (t, intro, items) in enumerate(SECTIONS, 1):
  secs += f'<div class="sec {"brk" if i > 1 else ""}"><div class="sh"><span class="sn">{i}</span><h2>{E(t)}</h2></div><p class="si">{E(intro)}</p>{"".join(card(x) for x in items)}</div>'
mep = ''.join(f'<tr><td class="c">{E(a)}</td><td>{E(b)}</td><td class="br">{E(c)}</td><td>{E(d)}</td></tr>' for a, b, c, d in MEP)
furn_rows = ''.join(f'<tr><th>{E(p)}</th><td class="mk">{E(m)}</td><td class="ap">{E(a)}</td></tr>' for p, m, a in FURN_ROWS)

# CSS: reuse the Arabic edition and mirror it to LTR
css = re.search(r'<style>(.*?)</style>', open(os.path.join(D, 'body.html')).read(), re.S).group(1)
for a, b in [('.cmp tbody th{background:#F5F8FA;color:var(--n);width:22%;text-align:right', '.cmp tbody th{background:#F5F8FA;color:var(--n);width:22%;text-align:left'),
             ('.en{direction:ltr;text-align:right', '.en{text-align:left'), ('border-right:4px solid var(--s)', 'border-left:4px solid var(--s)'),
             ('padding:6px 44px 6px 0', 'padding:6px 0 6px 44px'), ('position:absolute;right:0;top:6px', 'position:absolute;left:0;top:6px'),
             ('font-size:9.4pt;text-align:right;vertical-align:top', 'font-size:9.4pt;text-align:left;vertical-align:top'),
             ('.dr .v{direction:ltr;text-align:left', '.dr .v{text-align:right'), ('font-size:11pt;text-align:right}', 'font-size:11pt;text-align:left}'),
             ('.tbl td.br{text-align:left', '.tbl td.br{text-align:left'), ('line-height:1.75', 'line-height:1.6')]:
  css = css.replace(a, b)

BODY = f'''<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><style>{css}
.intro p{{text-align:justify}}</style></head><body>
<div class="intro">
<h2>Introduction</h2><div class="rib"></div>
<p class="lead">We would first like to extend our sincere thanks and appreciation to every donor who has chosen to leave their mark in a place where people heal. Developing or equipping a health centre is a gift whose benefit lasts for many years, touching patients, families and healthcare professionals every day.</p>
<p>Because such generosity deserves to endure, we have prepared this guide <b>for information and guidance</b>, as a shared reference between us, donors and the executing contractors. It explains why our bills of quantities specify particular products and specifications, and what distinguishes them from the common alternatives in the market — with figures and technical references published by manufacturers and standards bodies.</p>
<p>The difference rarely shows on handover day; two doors may look alike, and two chairs may appear identical. But a healthcare facility operates around the clock, is cleaned daily with strong disinfectants, and sees beds and trolleys moving through its corridors constantly. This is where the difference appears within a few months: either a material designed for this use, which lasts, or a material designed for an office or home, which needs repair or replacement — leaving the building with the operating cost and diminishing the impact of the donation.</p>
<p>These specifications do not reflect a preference for one brand over another. They are the outcome of operating and maintenance experience across Cluster facilities, the requirements of Civil Defense, healthcare accreditation and infection control, and our commitment to <b>standardizing systems</b> across facilities so that spare parts and maintenance remain available and fast.</p>
<div class="sig">We hope this guide is of help to everyone. The Projects Section team at the Technical Services Department is always available to answer any enquiry and to review any proposed alternative before supply, so that every project is delivered in a manner worthy of the donor and of those it serves.</div>

<h2 style="margin-top:22px">Why is a healthcare facility different?</h2><div class="rib"></div>
<div class="why5">
 <div><b>24/7 operation</b><span>No holidays or closing hours; doors, chairs and lighting work three shifts a day.</span></div>
 <div><b>Heavy, wheeled traffic</b><span>Beds, medication and meal trolleys and wheelchairs strike doors, walls and corners.</span></div>
 <div><b>Daily disinfection</b><span>Chlorine, alcohol and quaternary ammonium compounds damage materials not designed for them.</span></div>
 <div><b>Infection control</b><span>Every open joint, porous surface or water‑absorbing material is a place for microbes to collect.</span></div>
 <div><b>Safety & accreditation</b><span>Civil Defense requirements and healthcare accreditation standards (CBAHI) cover doors, floors and furniture.</span></div>
 <div><b>Standardized maintenance</b><span>One system for locks, elevators and accessories means one set of spare parts and faster repairs.</span></div>
</div>

<h3 class="brk">How to read this guide</h3>
<p style="margin:4px 0">Each item has its own card: the code as it appears in the BOQ, the product approved by the Cluster, performance badges, a comparison table between what is common in the market and what is approved, followed by the reason for approval and what must be submitted before supply. The small number beside a title refers to the sources at the end of the guide.</p>
<div class="legend">
 <div><span class="rule sm r-only">Exclusive</span> No alternative accepted, as the item is tied to a standardized system or existing approval</div>
 <div><span class="rule sm r-list">From approved list</span> Any of the names listed</div>
 <div><span class="rule sm r-eq">Or approved equivalent</span> A matching alternative is accepted after written approval</div>
 <div>The coloured badges (Heavy Duty, High Traffic…) summarize the type of performance required of the item.</div>
</div>
</div>

<div style="margin-top:16px"><h2 style="font-size:18pt;font-weight:800">Summary of approved items</h2><div class="intro"><div class="rib"></div></div>
<table class="tbl"><thead><tr><th style="width:13%">Code</th><th style="width:28%">Item</th><th>Approved by the Cluster</th><th style="width:20%">Condition</th></tr></thead><tbody>{summary_rows}</tbody></table>
<p class="note">The (LS) codes are the item numbers in the lump‑sum BOQ of the Al Naeem project; the same specifications apply to the Saad Al Hussain project and other donation projects.</p></div>

{secs}

<div class="sec brk"><div class="sh"><span class="sn">5</span><h2>MEP & Technology Systems</h2></div>
<p class="si">These systems work behind the walls, but they connect to Cluster networks, control panels and existing maintenance contracts. Here, approval is based first and foremost on <b>compatibility and standardization</b>.</p>
{"".join(card(x) for x in EXTRA)}
<h3 style="margin:6px 0">Other systems</h3>
<table class="tbl"><thead><tr><th style="width:13%">Code</th><th style="width:17%">System</th><th style="width:30%">Approved</th><th>Reason for approval</th></tr></thead><tbody>{mep}</tbody></table>
<p class="note">Fire suppression and fire alarm systems are subject to Civil Defense approval; no component may be installed before its drawings and models are approved.</p></div>

<div class="sec brk"><div class="sh"><span class="sn">6</span><h2>Non‑Medical & Office Furniture</h2></div>
<p class="si">Waiting seating, reception counters, nurse stations and administrative desks. This is the item where appearance is most similar and actual service life differs most — and where local alternatives are most often offered at a lower price.</p>
<div class="brands">
 <div><b>Herman Miller</b>12‑year warranty on many products, based on three‑shift use.<sup class="rf">[10]</sup></div>
 <div><b>Global (Canada)</b>Heavy Duty category: 12‑year warranty on all components for 24/7 use, and fabrics above 100,000 double rubs.<sup class="rf">[11]</sup></div>
 <div><b>OFS</b>12‑year warranty on standard products; 5 years on mechanisms and foam.<sup class="rf">[12]</sup></div>
 <div><b>Steelcase</b>Limited lifetime warranty on many components, with defined periods for other parts.<sup class="rf">[13]</sup></div>
</div>
<section class="item big" style="margin-top:10px"><header class="ih"><div class="ic">LS-93</div><div class="it"><h3>Office Furniture & Waiting Seating {refs([14])}</h3><div class="en">Herman Miller · Global · OFS · Steelcase</div></div><div class="rule r-list">From approved list</div></header>
{badges(["HD","HT","247","DIS","WAR"])}
<table class="cmp"><thead><tr><th>Property</th><th class="mk">Common furniture in the market</th><th class="ap">Approved by the Cluster</th></tr></thead><tbody>{furn_rows}</tbody></table>
<div class="why"><div class="w1"><h4>Why these companies?</h4><p>Because they test their products to BIFMA standards and publish the results, provide long written warranties covering multi‑shift use, and offer fabrics designed for cleaning with disinfectants. This is what keeps a chair serviceable for ten years instead of one or two.</p></div>
<div class="w2"><h4>If the common option is installed</h4><p>Torn and stained fabric, broken bases and armrests, swollen wooden surfaces — and in a healthcare facility, fabric that cannot be disinfected and must be replaced.</p></div></div>
</section>

<div class="box"><h3>What is a “double rub”?</h3>
<p style="margin:0 0 6px">The Wyzenbeek test moves a piece of cotton duck back and forth across the upholstery fabric under fixed tension and load; each back‑and‑forth movement counts as one double rub. Counting stops when noticeable wear appears. The higher the number, the longer the upholstery lasts.{refs([15, 14, 11])}</p>
<div class="dr">
 <div class="r mk"><span>General contract threshold</span><div class="bar"><i style="width:15%"></i></div><span class="v">15,000</span></div>
 <div class="r mk"><span>Heavy‑duty commercial use</span><div class="bar"><i style="width:30%"></i></div><span class="v">30,000</span></div>
 <div class="r"><span>Healthcare minimum</span><div class="bar"><i style="width:75%"></i></div><span class="v">75,000</span></div>
 <div class="r"><span>Heavy Duty category (Global)</span><div class="bar"><i style="width:100%"></i></div><span class="v">100,000+</span></div>
</div>
<p style="margin:0;font-size:9pt;color:var(--g)">Fabrics in common local furniture usually fall in the grey range, or their rating is not stated at all.</p></div>

<div class="note"><b>About local manufacturers:</b> We do not mean to diminish local industry; the aim is documented performance. The approved list consists of the four names above, and any other proposed product will be considered only if accompanied by BIFMA test reports from an accredited laboratory, fabric data (double rubs, disinfectant cleanability and fire), and a written manufacturer’s warranty comparable to the above. The final decision rests with the Department.</div>
</div>

<div class="sec brk"><div class="sh"><span class="sn">7</span><h2>Approval Before Supply</h2></div>
<p class="si">To keep the project free of site rejections and re‑supply, please follow these steps for every item:</p>
<ol class="steps">
 <li><b>Submit a material submittal</b> for each item before purchase, stating the BOQ item number and the proposed model.</li>
 <li><b>Attach original manufacturer documents:</b> data sheet, test certificates, certificate of origin, authorized agent or distributor letter, and warranty letter.</li>
 <li><b>Provide samples</b> for items that require them (flooring, tiles, colours, fabrics, accessories).</li>
 <li><b>For “or approved equivalent” items only:</b> a point‑by‑point comparison of the proposed and approved product against every property in this guide; an equivalent equals or exceeds every property — not most of them.</li>
 <li><b>Await written approval</b> from the Projects Section before supply.</li>
 <li><b>On delivery:</b> the model, batch number and labels are checked against the approval; any difference means rejection of the material.</li>
</ol>
<div class="note">Items marked <span class="rule sm r-only">Exclusive</span> are not open to alternatives, as they are tied to a standardized system across Cluster facilities or to existing maintenance and spare‑parts contracts.</div>

<h2 style="margin-top:22px">Sources</h2><div class="intro"><div class="rib"></div></div>
<ol class="src">{"".join(f'<li>{E(t)}' + (f'<br><a href="{u}">{E(u)}</a>' if u else '') + '</li>' for t, u in SOURCES)}</ol>
<h3 style="margin-top:10px">Referenced standards</h3>
<ul class="std">{"".join(f'<li>{E(s)}</li>' for s in STANDARDS)}</ul>
<p class="note">Figures are taken from manufacturers’ published data and standards at the time of preparation and may vary by model. The final reference at supply is the data sheet of the approved model and the item description in the BOQ.</p>
<p class="end">Thank you for your generosity and cooperation<br><span style="font-weight:500;color:var(--g)">Projects Section — Technical Services Department — Al Ahsa Health Cluster</span></p>
</div>
</body></html>'''

COVER = f'''<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><style>
@font-face{{font-family:T;src:url(file://{FD}Tajawal-Regular.ttf)}}@font-face{{font-family:T;font-weight:700;src:url(file://{FD}Tajawal-Bold.ttf)}}@font-face{{font-family:T;font-weight:800;src:url(file://{FD}Tajawal-ExtraBold.ttf)}}
@page{{size:A4;margin:0}}body{{margin:0;font-family:T}}
.c{{width:210mm;height:297mm;position:relative;overflow:hidden;background:#fff}}
.top{{padding:22mm 18mm 0;display:flex;justify-content:space-between;align-items:center}}.top img{{height:24mm}}
.tag{{color:#27A8DF;font-weight:700;font-size:11pt;border:1.5px solid #27A8DF;border-radius:30px;padding:4px 16px}}
.band{{position:absolute;left:0;right:0;top:78mm;height:150mm;background:#153E5C}}
.band:after{{content:"";position:absolute;left:0;right:0;bottom:0;height:8mm;background:#27A8DF}}
.tx{{position:absolute;top:98mm;right:18mm;left:18mm;color:#fff}}
.k{{color:#27A8DF;font-weight:700;font-size:13pt;letter-spacing:.5px}}
h1{{font-size:30pt;line-height:1.25;margin:8px 0 14px;font-weight:800}}
.sub{{font-size:13.5pt;line-height:1.6;opacity:.92;max-width:160mm}}
.pills{{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}}.pills span{{border:1px solid rgba(255,255,255,.45);border-radius:20px;padding:3px 12px;font-size:10pt}}
.ft{{position:absolute;bottom:20mm;right:18mm;left:18mm;display:flex;justify-content:space-between;align-items:flex-end;color:#153E5C}}
.ft b{{font-size:12.5pt;display:block}}.ft span{{color:#5B6B7A;font-size:10.5pt}}
</style></head><body><div class="c">
<div class="top"><img src="file://{D}/logo.png"><span class="tag">For information and guidance</span></div>
<div class="band"></div>
<div class="tx"><div class="k">A Guide for Donors and Contractors</div>
<h1>Approved Specifications for Finishes<br>and Fit‑Out in Healthcare Facilities</h1>
<div class="sub">An item‑by‑item comparison between what is common in the market and what the Cluster approves — and why healthcare facilities need materials designed for heavy duty, high traffic and daily disinfection.</div>
<div class="pills"><span>Heavy Duty</span><span>High Traffic</span><span>Disinfectant‑Resistant</span><span>ANSI/BHMA Grade 1</span><span>BIFMA</span></div></div>
<div class="ft"><div><b>Technical Services Department — Projects Section</b><span>Al Ahsa Health Cluster</span></div><div style="text-align:right"><b>First Edition</b><span>October 2026</span></div></div>
</div></body></html>'''

open(os.path.join(D, 'body_en.html'), 'w').write(BODY)
open(os.path.join(D, 'cover_en.html'), 'w').write(COVER)
print('ok')
