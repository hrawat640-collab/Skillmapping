import { useState, useEffect } from "react";
import { api } from "../api";

export function useAppData() {
  const [roles, setRoles] = useState([]);
  const [skills, setSkills] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [rolesRes, skillsRes, deptsRes] = await Promise.all([
          api.get("/roles"),
          api.get("/skills"),
          api.get("/departments")
        ]);
        if (cancelled) return;
        setRoles(rolesRes.data?.roles || []);
        setSkills(skillsRes.data?.skills || []);
        setDepartments(deptsRes.data?.departments || []);
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.error || e?.message || "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { roles, skills, departments, loading, error };
}
