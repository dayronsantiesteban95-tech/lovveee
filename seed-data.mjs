/**
 * QA Seed Script — Anika Control OS
 * Uses Supabase Service Role key to bypass RLS
 * 
 * Run: node seed-data.mjs
 */

// We need to use a service role key to bypass RLS
// Since we only have anon key, we'll use signUp with auto-confirm approach
// OR use the Supabase admin API if available

const SUPABASE_URL = "https://vdsknsypobnutnqcafre.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkc2tuc3lwb2JudXRucWNhZnJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NTU0MTYsImV4cCI6MjA4NjQzMTQxNn0.jmnnbU1c1N5P8NXCSnMPaXl2vBrmU5HHmNOzzy66-ag";

async function makeRequest(path, method, body, token) {
  const headers = {
    "apikey": ANON_KEY,
    "Authorization": `Bearer ${token || ANON_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation",
  };
  
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  const text = await response.text();
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch {
    return { status: response.status, data: text };
  }
}

// Step 1: Sign in with existing user (or create one)
async function getAuthToken() {
  // Try to sign in as the qa admin we created
  const resp = await makeRequest("/auth/v1/token?grant_type=password", "POST", {
    email: "anika.qa.admin@gmail.com",
    password: "AnikaQA2026!!"
  });
  
  if (resp.status === 200 && resp.data.access_token) {
    console.log("✓ Logged in as anika.qa.admin@gmail.com");
    return resp.data.access_token;
  }
  
  console.log("Sign-in failed:", resp.data);
  return null;
}

async function seed() {
  const token = await getAuthToken();
  if (!token) {
    console.error("Cannot get auth token — email confirmation required or user doesn't exist");
    console.log("Please manually sign in through the app and provide the token.");
    return;
  }
  
  console.log("Seeding data...");
  
  // Insert drivers
  const driversResp = await makeRequest("/rest/v1/drivers", "POST", [
    {
      full_name: "Marco Rivera",
      phone: "602-555-0101",
      email: "marco.rivera@anikalogistics.com",
      hub: "phoenix",
      status: "active",
      license_number: "DL-AZ-77291",
      license_expiry: "2027-06-30",
      hired_date: "2024-01-15",
      hourly_rate: 22.50,
      notes: "AOG specialist — available 24/7"
    },
    {
      full_name: "Destiny Flores",
      phone: "480-555-0182",
      email: "destiny.flores@anikalogistics.com",
      hub: "phoenix",
      status: "active",
      license_number: "DL-AZ-82019",
      license_expiry: "2026-11-15",
      hired_date: "2024-03-10",
      hourly_rate: 21.00,
      notes: "Courier & same-day specialist"
    }
  ], token);
  
  if (driversResp.status !== 201) {
    console.error("Failed to insert drivers:", driversResp.data);
    return;
  }
  
  console.log("✓ Drivers inserted:", driversResp.data.map(d => d.full_name).join(", "));
  const driver1Id = driversResp.data[0].id;
  const driver2Id = driversResp.data[1].id;
  
  const today = new Date().toISOString().slice(0, 10);
  const datePart = today.slice(2).replace(/-/g, "");
  
  // Insert loads
  const loadsResp = await makeRequest("/rest/v1/daily_loads", "POST", [
    {
      load_date: today,
      reference_number: `ANK-${datePart}-AOG01`,
      driver_id: driver1Id,
      shift: "day",
      hub: "phoenix",
      client_name: "PGL Aero Team",
      pickup_address: "3800 E Sky Harbor Blvd, Phoenix, AZ 85034",
      delivery_address: "1402 W 10th Pl, Tempe, AZ 85281",
      miles: 12.4,
      status: "in_progress",
      service_type: "rush",
      packages: 1,
      revenue: 185.00,
      driver_pay: 74.00,
      fuel_cost: 12.50,
      start_time: "08:00",
      wait_time_minutes: 0,
      description: "AOG: Landing gear actuator — PRIORITY",
      shipper_name: "UNICAL AVIATION",
      pickup_company: "PHX Air Cargo Terminal",
      delivery_company: "Tempe Aircraft MRO"
    },
    {
      load_date: today,
      reference_number: `ANK-${datePart}-MED02`,
      driver_id: driver2Id,
      shift: "day",
      hub: "phoenix",
      client_name: "Banner Health Supply",
      pickup_address: "2901 N Central Ave, Phoenix, AZ 85012",
      delivery_address: "7400 E Osborn Rd, Scottsdale, AZ 85251",
      miles: 18.7,
      status: "delivered",
      service_type: "same_day",
      packages: 3,
      revenue: 220.00,
      driver_pay: 88.00,
      fuel_cost: 16.00,
      start_time: "09:30",
      end_time: "11:15",
      wait_time_minutes: 15,
      description: "Medical supplies — temp controlled",
      shipper_name: "Stericycle Medical",
      pickup_company: "Banner Phoenix Medical Center",
      delivery_company: "HonorHealth Scottsdale"
    },
    {
      load_date: today,
      reference_number: `ANK-${datePart}-PGL03`,
      shift: "day",
      hub: "phoenix",
      client_name: "PGL Aero Team",
      pickup_address: "3800 E Sky Harbor Blvd, Phoenix, AZ 85034",
      delivery_address: "1843 N 16th St, Phoenix, AZ 85006",
      miles: 8.2,
      status: "pending",
      service_type: "standard",
      packages: 2,
      revenue: 120.00,
      driver_pay: 0,
      fuel_cost: 0,
      wait_time_minutes: 0,
      description: "Freight docs + parts bag — AOG support",
      shipper_name: "PGL Ground Services",
      pickup_company: "PHX Air Cargo Terminal",
      delivery_company: "Phoenix Sky Harbor FBO"
    }
  ], token);
  
  if (loadsResp.status !== 201) {
    console.error("Failed to insert loads:", loadsResp.data);
    return;
  }
  
  console.log("✓ Loads inserted:", loadsResp.data.map(l => l.reference_number).join(", "));
  const load3Id = loadsResp.data[2].id;
  
  // Insert dispatch blast
  const blastResp = await makeRequest("/rest/v1/dispatch_blasts", "POST", [{
    load_id: load3Id,
    message_text: "🚨 LOAD AVAILABLE — PHX\n📦 PGL Aero Team\n📍 PHX Sky Harbor → Phoenix FBO\n💰 $120 | 8.2 mi | 2 pkg\nReply ACCEPT to claim.",
    status: "sent",
    hub: "phoenix",
    blast_type: "sms"
  }], token);
  
  if (blastResp.status !== 201) {
    console.error("Failed to insert dispatch blast:", blastResp.data);
  } else {
    console.log("✓ Dispatch blast inserted");
  }
  
  console.log("\n✅ Seed complete!");
  console.log(`Driver IDs: ${driver1Id}, ${driver2Id}`);
  console.log(`Load IDs: ${loadsResp.data.map(l => l.id).join(", ")}`);
}

seed().catch(console.error);
