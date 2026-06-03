export default function DeptFilter({ departments, active, onChange, counts = {} }) {
  const matchedDepts = departments.filter((d) => counts[d.name] > 0);
  if (matchedDepts.length === 0) return null;

  return (
    <div className="dept-filter">
      <button
        className={`dept-btn${!active ? " active" : ""}`}
        onClick={() => onChange(null)}
      >
        All
      </button>
      {matchedDepts.map((d) => {
        const count = counts[d.name];
        return (
          <button
            key={d.id}
            className={`dept-btn${active === d.name ? " active" : ""}`}
            onClick={() => onChange(active === d.name ? null : d.name)}
            style={active === d.name && d.bg_color ? { background: d.bg_color, color: d.text_color, borderColor: d.bg_color } : {}}
          >
            {d.name} ({count})
          </button>
        );
      })}
    </div>
  );
}
