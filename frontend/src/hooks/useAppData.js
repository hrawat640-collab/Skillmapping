import { useState, useEffect } from "react";
import { api } from "../api";
import { buildSkillFlatList } from "../utils/searchUtils";

export function useAppData() {
  const [roles, setRoles] = useState([]);
  const [skillsList, setSkillsList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get("/roles"),
      api.get("/skills"),
      api.get("/departments")
    ])
      .then(([rRes, sRes, dRes]) => {
        setRoles(rRes.data.roles || []);
        setSkillsList(buildSkillFlatList(sRes.data.skills || []));
        setDepartments(dRes.data.departments || []);
      })
      .catch((e) => {
        setError(e?.response?.data?.error || e?.message || "Failed to load data");
      })
      .finally(() => setLoading(false));
  }, []);

  return { roles, skillsList, departments, loading, error };
}
