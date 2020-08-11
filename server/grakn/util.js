function formatStatementClauses(clauses) {
  return clauses.map((clause, index) => {
    if (index === clauses.length - 1) {
      return (clauses.length > 1 ? "  " : "") + `${clause};`;
    } else if (index === 0) {
      return `${clause},`;
    } else {
      return `  ${clause},`;
    }
  });
}

module.exports = { formatStatementClauses };
