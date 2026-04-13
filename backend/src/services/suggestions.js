export async function generateSuggestions({ missingKeywords, targetRole }) {
  if (!missingKeywords?.length) return ["Your CV is aligned well. Keep recent quantified achievements visible."];
  return missingKeywords.slice(0, 5).map((k) => `Add ${k} with a concrete project/result under ${targetRole}.`);
}
