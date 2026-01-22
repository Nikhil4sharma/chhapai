
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Try service key first for admin access, else anon key
const key = supabaseServiceKey || supabaseAnonKey;

if (!supabaseUrl || !key) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, key);

async function checkUsers() {
    console.log("Checking Roles...");
    const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

    if (rolesError) {
        console.error("Error fetching roles:", rolesError);
        // don't return, try profiles
    }

    console.log("Checking Profiles...");
    const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, department");

    if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        return;
    }

    // Summary
    const userMap: any = {};

    profiles?.forEach((p: any) => {
        userMap[p.user_id] = { ...p, roles: [] };
    });

    roles?.forEach((r: any) => {
        if (userMap[r.user_id]) {
            userMap[r.user_id].roles.push(r.role);
        } else {
            // user has role but no profile?
            userMap[r.user_id] = { user_id: r.user_id, full_name: "NO PROFILE", department: "UNKNOWN", roles: [r.role] };
        }
    });

    const outsourceUsers = Object.values(userMap).filter((u: any) =>
        u.department?.toLowerCase() === 'outsource' || u.roles.includes('outsource')
    );

    const productionUsers = Object.values(userMap).filter((u: any) =>
        u.department?.toLowerCase() === 'production' || u.roles.includes('production')
    );

    console.log("Users definition:");
    console.table(Object.values(userMap).map((u: any) => ({
        name: u.full_name,
        dept: u.department,
        roles: u.roles.join(', ')
    })));

    console.log("\nPotential Outsource Candidates (Dept='Outsource' or Role='outsource'):");
    console.log(outsourceUsers);

    console.log("\nPotential Production Candidates (Dept='Production' or Role='production'):");
    console.log(productionUsers.map((u: any) => `${u.full_name} (${u.department})`).join(', '));

    if (outsourceUsers.length === 0) {
        console.log("\nWARNING: No users found with department 'Outsource' or role 'outsource'.");
    }
}

checkUsers();
