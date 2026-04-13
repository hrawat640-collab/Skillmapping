export async function fetchJobDescriptions({ targetRole, experienceYears, location }) {
  const scope = `${targetRole} (${experienceYears} yrs, ${location})`;
  return [
    {
      title: `${targetRole} - JD 1`,
      company: "Sample Company A",
      description: `Role scope: ${scope}. Build and maintain production-ready solutions, collaborate with teams, and deliver measurable outcomes.`
    },
    {
      title: `${targetRole} - JD 2`,
      company: "Sample Company B",
      description: `Role scope: ${scope}. Hands-on execution, stakeholder communication, and quality ownership are expected.`
    },
    {
      title: `${targetRole} - JD 3`,
      company: "Sample Company C",
      description: `Role scope: ${scope}. Candidate should demonstrate role-specific skills, consistency, and business impact.`
    }
  ];
}
