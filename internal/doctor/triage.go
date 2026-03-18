package doctor

// CategoryTriage is the category for triage-specific checks.
const CategoryTriage = "Triage"

func init() {
	CategoryOrder = append(CategoryOrder, CategoryTriage)
}

// TriageCheck defines the interface for triage-specific health checks.
// Triage checks run after structural checks when --triage is passed to gt doctor.
// They share the same Check interface, output format, and --fix integration.
type TriageCheck interface {
	Check
}

// TriageChecks returns all registered triage checks.
// No actual checks yet — this is the framework scaffold.
func TriageChecks() []Check {
	return []Check{}
}
