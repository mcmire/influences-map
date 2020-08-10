function formatStatementClauses(clauses) {
  return clauses.map((clause, index) => {
    if (index === clauses.length - 1) {
      return `  ${clause};`;
    } else if (index === 0) {
      return `${clause},`;
    } else {
      return `  ${clause},`;
    }
  });
}

module.exports = { formatStatementClauses };
