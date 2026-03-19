package harness

// Harness holds tiered verification commands for a project.
// Tier0 = fast gates (build, typecheck). Tier1 = slower gates (test, lint).
type Harness struct {
	Tier0 []string
	Tier1 []string
}

// Empty reports whether the harness has no commands in any tier.
func (h Harness) Empty() bool {
	return len(h.Tier0) == 0 && len(h.Tier1) == 0
}

// Tiers returns the command tiers as a slice of slices for RunTiered.
func (h Harness) Tiers() [][]string {
	var tiers [][]string
	if len(h.Tier0) > 0 {
		tiers = append(tiers, h.Tier0)
	}
	if len(h.Tier1) > 0 {
		tiers = append(tiers, h.Tier1)
	}
	return tiers
}

// LoadHarness returns verification commands for the project at root.
// Currently uses DetectCommands as the sole source. When the layered config
// loader (gt-qi4) lands, it will check bead-specific and repo-level config
// first, falling back to DetectCommands.
func LoadHarness(root string) Harness {
	cmds := DetectCommands(root)
	var h Harness

	// Tier0: build + typecheck (fast, must-pass)
	if cmds.Build != "" {
		h.Tier0 = append(h.Tier0, cmds.Build)
	}
	if cmds.Typecheck != "" {
		h.Tier0 = append(h.Tier0, cmds.Typecheck)
	}

	// Tier1: test + lint (slower)
	if cmds.Test != "" {
		h.Tier1 = append(h.Tier1, cmds.Test)
	}
	if cmds.Lint != "" {
		h.Tier1 = append(h.Tier1, cmds.Lint)
	}

	return h
}
