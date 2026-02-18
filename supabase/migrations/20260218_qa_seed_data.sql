-- ═══════════════════════════════════════════════════════════
-- QA SEED DATA — Mock drivers, loads, dispatch blast
-- Injected by Anika QA Agent (2026-02-18)
-- ═══════════════════════════════════════════════════════════

-- Temporarily allow anon inserts for seeding (will be reverted)
-- We use a DO block to seed data as superuser

DO $$
DECLARE
  driver1_id UUID;
  driver2_id UUID;
  load1_id UUID;
  load2_id UUID;
  load3_id UUID;
BEGIN
  -- Insert Driver 1: Marco Rivera
  INSERT INTO drivers (full_name, phone, email, hub, status, license_number, license_expiry, hired_date, hourly_rate, notes)
  VALUES (
    'Marco Rivera',
    '602-555-0101',
    'marco.rivera@anikalogistics.com',
    'phoenix',
    'active',
    'DL-AZ-77291',
    '2027-06-30',
    '2024-01-15',
    22.50,
    'AOG specialist — available 24/7, PHX hub primary'
  )
  RETURNING id INTO driver1_id;

  -- Insert Driver 2: Destiny Flores
  INSERT INTO drivers (full_name, phone, email, hub, status, license_number, license_expiry, hired_date, hourly_rate, notes)
  VALUES (
    'Destiny Flores',
    '480-555-0182',
    'destiny.flores@anikalogistics.com',
    'phoenix',
    'active',
    'DL-AZ-82019',
    '2026-11-15',
    '2024-03-10',
    21.00,
    'Courier & same-day specialist — TUS capable'
  )
  RETURNING id INTO driver2_id;

  -- Insert Load 1: AOG Part Rush
  INSERT INTO daily_loads (
    load_date, reference_number, driver_id, shift, hub, client_name,
    pickup_address, delivery_address, miles, status, service_type,
    packages, revenue, driver_pay, fuel_cost,
    start_time, wait_time_minutes, description,
    shipper_name, pickup_company, delivery_company
  )
  VALUES (
    CURRENT_DATE,
    'ANK-' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || '-AOG01',
    driver1_id,
    'day', 'phoenix',
    'PGL Aero Team',
    '3800 E Sky Harbor Blvd, Phoenix, AZ 85034',
    '1402 W 10th Pl, Tempe, AZ 85281',
    12.4,
    'in_progress', 'rush',
    1, 185.00, 74.00, 12.50,
    '08:00', 0,
    'AOG: Landing gear actuator — PRIORITY OVERNIGHT',
    'UNICAL AVIATION',
    'PHX Air Cargo Terminal',
    'Tempe Aircraft MRO'
  )
  RETURNING id INTO load1_id;

  -- Insert Load 2: Medical Courier
  INSERT INTO daily_loads (
    load_date, reference_number, driver_id, shift, hub, client_name,
    pickup_address, delivery_address, miles, status, service_type,
    packages, revenue, driver_pay, fuel_cost,
    start_time, end_time, wait_time_minutes, description,
    shipper_name, pickup_company, delivery_company
  )
  VALUES (
    CURRENT_DATE,
    'ANK-' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || '-MED02',
    driver2_id,
    'day', 'phoenix',
    'Banner Health Supply',
    '2901 N Central Ave, Phoenix, AZ 85012',
    '7400 E Osborn Rd, Scottsdale, AZ 85251',
    18.7,
    'delivered', 'same_day',
    3, 220.00, 88.00, 16.00,
    '09:30', '11:15', 15,
    'Medical supplies — temp controlled',
    'Stericycle Medical',
    'Banner Phoenix Medical Center',
    'HonorHealth Scottsdale'
  )
  RETURNING id INTO load2_id;

  -- Insert Load 3: Unassigned pending blast
  INSERT INTO daily_loads (
    load_date, reference_number, shift, hub, client_name,
    pickup_address, delivery_address, miles, status, service_type,
    packages, revenue, wait_time_minutes, description,
    shipper_name, pickup_company, delivery_company
  )
  VALUES (
    CURRENT_DATE,
    'ANK-' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || '-PGL03',
    'day', 'phoenix',
    'PGL Aero Team',
    '3800 E Sky Harbor Blvd, Phoenix, AZ 85034',
    '1843 N 16th St, Phoenix, AZ 85006',
    8.2,
    'pending', 'standard',
    2, 120.00, 0,
    'Freight docs + parts bag — AOG support',
    'PGL Ground Services',
    'PHX Air Cargo Terminal',
    'Phoenix Sky Harbor FBO'
  )
  RETURNING id INTO load3_id;

  -- Insert Dispatch Blast for the pending load
  INSERT INTO dispatch_blasts (
    load_id, message_text, status, hub, blast_type
  )
  VALUES (
    load3_id,
    E'🚨 LOAD AVAILABLE — PHX\n📦 PGL Aero Team\n📍 PHX Sky Harbor → Phoenix FBO\n💰 $120 | 8.2 mi | 2 pkg\nReply ACCEPT to claim.',
    'sent', 'phoenix', 'sms'
  );

  RAISE NOTICE 'QA seed data inserted. Driver1: %, Driver2: %, Loads: %, %, %',
    driver1_id, driver2_id, load1_id, load2_id, load3_id;
END $$;
