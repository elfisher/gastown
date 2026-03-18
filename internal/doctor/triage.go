package doctor

// TriageCheck defines the interface for triage-specific health checks.
// Triage checks run after structural checks when --triage is passed,
// analyzing workspace state for operational issues (stuck agents,
// stale convoys, unhealthy dispatches, etc.).
type TriageCheck interface {
	Check // Embeds the standard Check interface
}

// BaseTriageCheck provides a base implementation for triage checks.
// Embed this in triage checks to get default category and fix behavior.
type BaseTriageCheck struct {
	BaseCheck
}

// NewBaseTriageCheck creates a BaseTriageCheck with the Triage category pre-set.
func NewBaseTriageCheck(name, description string) BaseTriageCheck {
	return BaseTriageCheck{
		BaseCheck: BaseCheck{
			CheckName:        name,
			CheckDescription: description,
			CheckCategory:    CategoryTriage,
		},
	}
}

// TriageRunner collects and executes triage checks using the standard Doctor engine.
type TriageRunner struct {
	doctor *Doctor
}

// NewTriageRunner creates a new TriageRunner.
func NewTriageRunner() *TriageRunner {
	return &TriageRunner{
		doctor: NewDoctor(),
	}
}

// Register adds a triage check.
func (t *TriageRunner) Register(check TriageCheck) {
	t.doctor.Register(check)
}

// RegisterAll adds multiple triage checks.
func (t *TriageRunner) RegisterAll(checks ...TriageCheck) {
	for _, c := range checks {
		t.doctor.Register(c)
	}
}

// Doctor returns the underlying Doctor for running checks.
func (t *TriageRunner) Doctor() *Doctor {
	return t.doctor
}
