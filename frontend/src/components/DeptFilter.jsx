export default function DeptFilter({ depts, results, activeDept, onSelect }) {
  if (!depts.length) return null;

  const deptCounts = {};
  results.forEach((r) => {
    const d = r.dept || "General";
    deptCounts[d] = (deptCounts[d] || 0) + 1;
  });

  return (
    <div className="dept-filter">
      {depts.map((d) => {
        const label = d === "all"
          ? `All (${results.length})`
          : `${d} (${deptCounts[d] || 0})`;
        return (
          <button
            key={d}
            className={`dept-btn${activeDept === d ? " active" : ""}`}
            onClick={() => onSelect(d)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
